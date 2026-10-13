//! Hand-rolled HTTP/1.1 + SSE against the node's management-plane API.
//! Estate idiom: no HTTP dependency — plain std TCP to loopback-rig
//! addresses, one counterparty (the daemon's own REST surface).

use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub struct NodeClient {
    addr: String,
    token: String,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Standard-alphabet base64 (encode + decode), dependency-free.
pub mod b64 {
    const TAB: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    pub fn encode(data: &[u8]) -> String {
        let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
        for chunk in data.chunks(3) {
            let b = [
                chunk[0],
                *chunk.get(1).unwrap_or(&0),
                *chunk.get(2).unwrap_or(&0),
            ];
            let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
            out.push(TAB[(n >> 18) as usize & 63] as char);
            out.push(TAB[(n >> 12) as usize & 63] as char);
            out.push(if chunk.len() > 1 {
                TAB[(n >> 6) as usize & 63] as char
            } else {
                '='
            });
            out.push(if chunk.len() > 2 {
                TAB[n as usize & 63] as char
            } else {
                '='
            });
        }
        out
    }

    pub fn decode(s: &str) -> Result<Vec<u8>, String> {
        fn val(c: u8) -> Result<u32, String> {
            match c {
                b'A'..=b'Z' => Ok((c - b'A') as u32),
                b'a'..=b'z' => Ok((c - b'a' + 26) as u32),
                b'0'..=b'9' => Ok((c - b'0' + 52) as u32),
                b'+' => Ok(62),
                b'/' => Ok(63),
                _ => Err(format!("bad base64 byte {c}")),
            }
        }
        let clean: Vec<u8> = s
            .bytes()
            .filter(|b| *b != b'=' && !b.is_ascii_whitespace())
            .collect();
        let mut out = Vec::with_capacity(clean.len() * 3 / 4);
        for chunk in clean.chunks(4) {
            let mut n: u32 = 0;
            for (i, c) in chunk.iter().enumerate() {
                n |= val(*c)? << (18 - 6 * i);
            }
            out.push((n >> 16) as u8);
            if chunk.len() > 2 {
                out.push((n >> 8) as u8);
            }
            if chunk.len() > 3 {
                out.push(n as u8);
            }
        }
        Ok(out)
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn roundtrip() {
            for s in [&b""[..], b"f", b"fo", b"foo", b"foob", b"fooba", b"foobar"] {
                assert_eq!(decode(&encode(s)).unwrap(), s);
            }
            assert_eq!(encode(b"foobar"), "Zm9vYmFy");
        }
    }
}

impl NodeClient {
    pub fn new(addr: &str, token: &str) -> Self {
        NodeClient {
            addr: addr.into(),
            token: token.into(),
        }
    }

    fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> Result<(u16, String), String> {
        let mut stream =
            TcpStream::connect(&self.addr).map_err(|e| format!("connect {}: {e}", self.addr))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| e.to_string())?;
        let mut req = format!(
            "{method} {path} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n",
            self.addr
        );
        if !self.token.is_empty() {
            req.push_str(&format!("Authorization: Bearer {}\r\n", self.token));
        }
        if let Some(b) = body {
            req.push_str(&format!(
                "Content-Type: application/json\r\nContent-Length: {}\r\n",
                b.len()
            ));
        }
        req.push_str("\r\n");
        stream
            .write_all(req.as_bytes())
            .map_err(|e| e.to_string())?;
        if let Some(b) = body {
            stream.write_all(b.as_bytes()).map_err(|e| e.to_string())?;
        }
        let mut raw = Vec::new();
        stream
            .read_to_end(&mut raw)
            .map_err(|e| format!("read: {e}"))?;
        parse_response(&raw)
    }

    /// An unauthenticated GET (only /health and /constitution* are public).
    pub fn get_public(&self, path: &str) -> Result<(u16, String), String> {
        self.request("GET", path, None)
    }

    pub fn get(&self, path: &str) -> Result<(u16, String), String> {
        self.request("GET", path, None)
    }

    pub fn post_json(&self, path: &str, body: &str) -> Result<(u16, String), String> {
        self.request("POST", path, Some(body))
    }

    pub fn put_json(&self, path: &str, body: &str) -> Result<(u16, String), String> {
        self.request("PUT", path, Some(body))
    }

    pub fn delete(&self, path: &str) -> Result<(u16, String), String> {
        self.request("DELETE", path, None)
    }

    /// Convenience: GET a JSON value.
    pub fn get_json(&self, path: &str) -> Result<serde_json::Value, String> {
        let (s, b) = self.get(path)?;
        if s != 200 {
            return Err(format!("GET {path} -> {s}: {}", truncate(&b, 300)));
        }
        serde_json::from_str(&b).map_err(|e| format!("json: {e}"))
    }
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        s.to_string()
    } else {
        format!("{}…", &s[..n])
    }
}

/// Parse an HTTP/1.1 response: status line, headers, body (honoring
/// Content-Length, de-chunking Transfer-Encoding: chunked).
fn parse_response(raw: &[u8]) -> Result<(u16, String), String> {
    let sep = find(raw, b"\r\n\r\n").ok_or("no header terminator")?;
    let head = String::from_utf8_lossy(&raw[..sep]).into_owned();
    let mut lines = head.lines();
    let status_line = lines.next().ok_or("empty response")?;
    let status: u16 = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| format!("bad status line: {status_line}"))?;
    let mut content_length: Option<usize> = None;
    let mut chunked = false;
    for l in lines {
        let lower = l.to_ascii_lowercase();
        if let Some(v) = lower.strip_prefix("content-length:") {
            content_length = v.trim().parse().ok();
        }
        if lower.starts_with("transfer-encoding:") && lower.contains("chunked") {
            chunked = true;
        }
    }
    let mut body = raw[sep + 4..].to_vec();
    if chunked {
        body = dechunk(&body)?;
    } else if let Some(n) = content_length {
        body.truncate(n);
    }
    Ok((status, String::from_utf8_lossy(&body).into_owned()))
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn dechunk(body: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut i = 0usize;
    loop {
        let nl = find(&body[i..], b"\r\n").ok_or("bad chunk header")? + i;
        let size_str = String::from_utf8_lossy(&body[i..nl]).into_owned();
        let size = usize::from_str_radix(size_str.trim().split(';').next().unwrap_or("0"), 16)
            .map_err(|e| format!("chunk size {size_str}: {e}"))?;
        if size == 0 {
            break;
        }
        let start = nl + 2;
        if start + size > body.len() {
            return Err("truncated chunk".into());
        }
        out.extend_from_slice(&body[start..start + size]);
        i = start + size + 2;
    }
    Ok(out)
}

/// One SSE frame received from a node stream.
#[derive(Debug, Clone)]
pub struct SseFrame {
    pub data: String,
    pub at_ms: u64,
}

/// A set of per-node `/events` collectors. Owns the stop flag; drains
/// frames into ledger events matched by envelope digest.
pub struct CollectorSet {
    entries: Vec<(String, Receiver<SseFrame>, JoinHandle<()>)>,
    stop: Arc<AtomicBool>,
}

impl CollectorSet {
    pub fn spawn(rig: &crate::rig::Rig, nodes: &[String]) -> Result<CollectorSet, String> {
        let stop = Arc::new(AtomicBool::new(false));
        let mut entries = Vec::new();
        for l in nodes {
            let n = rig.node(l)?;
            let addr = format!("{}:{}", n.mgmt_ip, n.api_port);
            let token = std::fs::read_to_string(n.data_dir.join("api-token")).unwrap_or_default();
            let (tx, rx): (Sender<SseFrame>, Receiver<SseFrame>) = channel();
            let s = stop.clone();
            let path = "/events".to_string();
            let handle =
                std::thread::spawn(move || sse_reader(addr, token.trim().to_string(), path, s, tx));
            entries.push((l.clone(), rx, handle));
        }
        Ok(CollectorSet { entries, stop })
    }

    /// Drain pending frames into Delivered/DuplicateDelivery ledger
    /// events, matched by envelope digest against the ledger's ops.
    pub fn drain_into(&self, ledger: &mut crate::ledger::Ledger) {
        for (node, rx, _) in &self.entries {
            while let Ok(frame) = rx.try_recv() {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(&frame.data) else {
                    continue;
                };
                let Some(payload) = v.get("payload").and_then(|p| p.as_str()) else {
                    continue;
                };
                let Ok(bytes) = b64::decode(payload) else {
                    continue;
                };
                let digest = crate::identity::op_digest(&bytes);
                if !ledger.ops.iter().any(|o| o.op_id == digest) {
                    continue;
                }
                if ledger.has_delivery(&digest, node) {
                    ledger.record(crate::ledger::Event::DuplicateDelivery {
                        op_id: digest,
                        node: node.clone(),
                        at_ms: frame.at_ms,
                    });
                } else {
                    ledger.record(crate::ledger::Event::Delivered {
                        op_id: digest,
                        node: node.clone(),
                        at_ms: frame.at_ms,
                    });
                }
            }
        }
    }

    /// Stop all collector threads and join them.
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::Relaxed);
        for (_, _, h) in self.entries.drain(..) {
            let _ = h.join();
        }
    }
}

/// The SSE reader thread body: reconnect loop, bounded by the read
/// timeout; exits promptly when `stop` is set.
fn sse_reader(
    addr: String,
    token: String,
    path: String,
    stop: Arc<AtomicBool>,
    tx: Sender<SseFrame>,
) {
    let mut carry = String::new();
    'outer: loop {
        if stop.load(Ordering::Relaxed) {
            break;
        }
        let Ok(mut stream) = TcpStream::connect(&addr) else {
            std::thread::sleep(Duration::from_millis(500));
            continue;
        };
        let _ = stream.set_read_timeout(Some(Duration::from_millis(400)));
        let req =
            format!("GET {path} HTTP/1.1\r\nHost: {addr}\r\nAuthorization: Bearer {token}\r\n\r\n");
        if stream.write_all(req.as_bytes()).is_err() {
            std::thread::sleep(Duration::from_millis(500));
            continue;
        }
        let mut buf = [0u8; 8192];
        let mut header_done = false;
        loop {
            if stop.load(Ordering::Relaxed) {
                break 'outer;
            }
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    carry.push_str(&String::from_utf8_lossy(&buf[..n]));
                    if !header_done {
                        if let Some(p) = find(carry.as_bytes(), b"\r\n\r\n") {
                            carry = carry[p + 4..].to_string();
                            header_done = true;
                        } else {
                            carry.clear();
                        }
                    }
                    while header_done {
                        let Some(nl) = find(carry.as_bytes(), b"\n") else {
                            break;
                        };
                        let line: String = carry[..nl].trim_end_matches('\r').to_string();
                        carry = carry[nl + 1..].to_string();
                        if let Some(data) = line.strip_prefix("data:") {
                            let _ = tx.send(SseFrame {
                                data: data.trim().to_string(),
                                at_ms: now_ms(),
                            });
                        }
                    }
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_parsing_content_length_and_chunked() {
        let raw = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhelloEXTRA";
        assert_eq!(parse_response(raw).unwrap(), (200, "hello".to_string()));
        let chunked = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n3;x=1\r\n fo\r\n0\r\n\r\n";
        assert_eq!(
            parse_response(chunked).unwrap(),
            (200, "hello fo".to_string())
        );
    }

    #[test]
    fn status_errors_parse() {
        let raw = b"HTTP/1.1 504 timeout\r\nContent-Length: 2\r\n\r\n{}";
        assert_eq!(parse_response(raw).unwrap().0, 504);
    }
}
