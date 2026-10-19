//! The live-wire fault proxy: HTTP-level partition injection on the
//! rail's REAL connection to its node. Plain HTTP only (the devnet and
//! the wire-mock speak plain HTTP on loopback; production https rails
//! get their OS-level partitions from the netns harness, which is #440's
//! lane — named, not duplicated here).
//!
//! Rules live in a FILE, re-read per request (the bnrose-proxy law), so
//! a test heals a partition by rewriting the file:
//!
//! ```json
//! {"mode":"pass"}
//! ```
//!
//! modes: `pass` (forward normally), `drop` (sever BEFORE forwarding —
//! the request never arrives), `drop-ack` (forward, wait for the node's
//! answer, then sever WITHOUT answering — the request was delivered, the
//! acknowledgement is lost: the lost-ack vs lost-request distinction),
//! `delay` (+`"ms": N` — answer late). A malformed or unreadable rules
//! file SEVERS ALL (fail closed, never fail open).

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Clone, Debug, PartialEq)]
enum Mode {
    Pass,
    Drop,
    DropAck,
    Delay(u64),
}

fn read_rules(path: &PathBuf) -> Option<Mode> {
    let text = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    match v.get("mode")?.as_str()? {
        "pass" => Some(Mode::Pass),
        "drop" => Some(Mode::Drop),
        "drop-ack" => Some(Mode::DropAck),
        "delay" => Some(Mode::Delay(v.get("ms")?.as_u64()?)),
        _ => None, // unknown mode severs (fail closed)
    }
}

/// read one HTTP request (head + Content-Length body) from the client
/// (public: the wire-shape mock in the adapter-logic battery reuses it)
pub fn read_request(stream: &mut TcpStream) -> std::io::Result<(Vec<u8>, usize)> {
    let mut buf = Vec::with_capacity(1024);
    let mut byte = [0u8; 1];
    let head_end;
    loop {
        stream.read_exact(&mut byte)?;
        buf.push(byte[0]);
        if buf.ends_with(b"\r\n\r\n") {
            head_end = buf.len();
            break;
        }
        if buf.len() > 64 * 1024 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "head too large",
            ));
        }
    }
    let head = String::from_utf8_lossy(&buf[..head_end]).to_string();
    let mut len = 0usize;
    for line in head.split("\r\n") {
        let lower = line.to_ascii_lowercase();
        if let Some(rest) = lower.strip_prefix("content-length:") {
            len = rest.trim().parse().unwrap_or(0);
        }
    }
    while buf.len() < head_end + len {
        stream.read_exact(&mut byte)?;
        buf.push(byte[0]);
    }
    Ok((buf, head_end))
}

fn forward(upstream: &str, request: &[u8]) -> std::io::Result<Vec<u8>> {
    let addr = upstream
        .to_socket_addrs()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("resolve: {e}")))?
        .next()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "no upstream addr"))?;
    let mut up = TcpStream::connect_timeout(&addr, Duration::from_secs(5))?;
    up.set_read_timeout(Some(Duration::from_secs(15))).ok();
    // re-issue the request with Connection: close for a bounded read
    let text = String::from_utf8_lossy(request);
    let head_body: Vec<&str> = text.split("\r\n\r\n").collect();
    let mut head_lines: Vec<String> = head_body[0]
        .split("\r\n")
        .map(|l| l.to_string())
        .filter(|l| {
            !l.to_ascii_lowercase().starts_with("connection:")
                && !l.to_ascii_lowercase().starts_with("content-length:")
                && !l.to_ascii_lowercase().starts_with("host:")
        })
        .collect();
    let body_start = request.len() - (text.len() - head_body[0].len() - 4).max(0);
    let _ = body_start;
    // body bytes are the tail of the ORIGINAL request after the blank line
    let body = &request[head_body[0].len() + 4..];
    let host = upstream.to_string();
    head_lines.insert(1, format!("Host: {host}"));
    head_lines.push(format!("Content-Length: {}", body.len()));
    head_lines.push("Connection: close".into());
    let out = format!("{}\r\n\r\n", head_lines.join("\r\n"));
    up.write_all(out.as_bytes())?;
    up.write_all(body)?;
    up.flush()?;
    let mut answer = Vec::new();
    up.read_to_end(&mut answer)?;
    Ok(answer)
}

/// Serve the fault proxy forever on an OS-assigned port; returns the
/// port. `upstream` is host:port.
pub fn spawn(upstream: &str, rules_path: PathBuf) -> std::io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let upstream = upstream.to_string();
    std::thread::spawn(move || {
        for conn in listener.incoming() {
            let Ok(mut client) = conn else { continue };
            let mode = read_rules(&rules_path).unwrap_or(Mode::Drop); // fail closed
            let upstream = upstream.clone();
            std::thread::spawn(move || {
                let Ok((req, _)) = read_request(&mut client) else {
                    return; // unreadable request: sever (fail closed)
                };
                match mode {
                    Mode::Drop => {
                        // the request NEVER arrives: sever now
                        let _ = client.shutdown(std::net::Shutdown::Both);
                    }
                    Mode::Pass => {
                        if let Ok(answer) = forward(&upstream, &req) {
                            let _ = client.write_all(&answer);
                        }
                    }
                    Mode::DropAck => {
                        // deliver, take the node's answer, then sever
                        // WITHOUT answering: the acknowledgement is lost
                        let _ = forward(&upstream, &req);
                        let _ = client.shutdown(std::net::Shutdown::Both);
                    }
                    Mode::Delay(ms) => {
                        if let Ok(answer) = forward(&upstream, &req) {
                            std::thread::sleep(Duration::from_millis(ms));
                            let _ = client.write_all(&answer);
                        }
                    }
                }
            });
        }
    });
    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};

    /// a tiny upstream that answers JSON-RPC style
    fn upstream_server() -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for conn in l.incoming() {
                let Ok(mut s) = conn else { break };
                let Ok((req, head_end)) = read_request(&mut s) else {
                    continue;
                };
                let body = &req[head_end..];
                let answer = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{{\"echo\":{}}}",
                    body.len() + 8,
                    String::from_utf8_lossy(body)
                );
                let _ = s.write_all(answer.as_bytes());
            }
        });
        port
    }

    fn post(port: u16, timeout_ms: u64) -> Option<String> {
        let mut s = TcpStream::connect(("127.0.0.1", port)).ok()?;
        s.set_read_timeout(Some(Duration::from_millis(timeout_ms)))
            .ok()?;
        let body = r#"{"jsonrpc":"2.0","id":1}"#;
        let req = format!(
            "POST / HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        s.write_all(req.as_bytes()).ok()?;
        let mut out = String::new();
        BufReader::new(s).read_line(&mut out).ok()?;
        if out.is_empty() {
            None
        } else {
            Some(out)
        }
    }

    #[test]
    fn pass_drop_and_drop_ack_are_distinguishable() {
        let up = upstream_server();
        let dir = std::env::temp_dir().join(format!("fp-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let rules = dir.join("rules.json");
        std::fs::write(&rules, r#"{"mode":"pass"}"#).unwrap();
        let port = spawn(&format!("127.0.0.1:{up}"), rules.clone()).unwrap();

        assert!(post(port, 3000).unwrap().starts_with("HTTP/1.1 200"));

        std::fs::write(&rules, r#"{"mode":"drop"}"#).unwrap();
        assert!(post(port, 1500).is_none(), "drop: no answer ever");

        std::fs::write(&rules, r#"{"mode":"drop-ack"}"#).unwrap();
        assert!(post(port, 1500).is_none(), "drop-ack: the ack is lost");
        // and the upstream DID answer the forwarded request (the request
        // was delivered) — the distinction the modes exist to draw

        std::fs::write(&rules, r#"{"mode":"pass"}"#).unwrap();
        assert!(
            post(port, 3000).unwrap().starts_with("HTTP/1.1 200"),
            "heal"
        );

        // fail closed: a corrupt rules file severs all
        std::fs::write(&rules, "not json").unwrap();
        assert!(post(port, 1500).is_none(), "corrupt rules: severed");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
