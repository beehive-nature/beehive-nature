//! `bnrose-proxy` — the THIRD independent process (BNROSE-NETPART layer
//! 2): a network middlebox between the hosts and the destination. The
//! partition is no longer destination-side label lookup — it is a
//! separate executable the tests can drop, delay, or sever, exactly as a
//! real network path would. Control plane = a RULES FILE (JSON) re-read
//! per request, so a running partition changes without touching either
//! endpoint.
//!
//! Usage: bnrose-proxy <rules-file> <dest-addr> [listen-port-or-0]
//! Prints the bound port.
//!
//! Rules file shape (labels default to pass-through):
//!   { "hostA": {"mode": "drop"}, "hostB": {"mode": "delay", "ms": 1500} }
//! Modes: pass | drop (sever: connection closed, no answer — lost
//! request AND lost acknowledgement both manifest here) | delay.

use serde_json::Value;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};

/// FAIL-CLOSED rules (founder review): a rule entry is one of
/// {"mode": "pass" | "drop" | "drop-ack" | "delay", "ms": n}. A label
/// NOT LISTED is dropped; an unreadable or malformed rules file drops
/// EVERYTHING — the proxy never passes traffic it cannot account for.
fn rules_of(path: &str) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()?
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let rules_file = args.get(1).cloned().unwrap_or_else(|| "rules.json".into());
    let dest: std::net::SocketAddr = args.get(2).and_then(|a| a.parse().ok()).expect("dest addr");
    let port: u16 = args.get(3).and_then(|p| p.parse().ok()).unwrap_or(0);
    let listener = TcpListener::bind(("127.0.0.1", port)).expect("bind");
    println!("{}", listener.local_addr().expect("addr").port());
    std::io::Write::flush(&mut std::io::stdout()).ok();
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        // unreadable or malformed rules: sever EVERY connection — the
        // proxy never passes traffic it cannot account for
        let Some(rules) = rules_of(&rules_file) else {
            continue;
        };
        let Ok(mut upstream) = TcpStream::connect(dest) else {
            continue;
        };
        let _ = upstream.set_nodelay(true);
        if !pump(stream, &mut upstream, &rules) {
            continue;
        }
    }
}

/// One request line in, the label inspected, the fault applied, the
/// answer relayed. Returns false when the connection is done.
fn pump(mut client: TcpStream, upstream: &mut TcpStream, rules: &Value) -> bool {
    let mut reader = BufReader::new(client.try_clone().expect("clone"));
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() || line.is_empty() {
        return false;
    }
    let label = serde_json::from_str::<Value>(&line)
        .ok()
        .and_then(|v| v["label"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    // whitelist: an unlisted label defaults to DROP, never pass
    let listed = rules
        .get(&label)
        .cloned()
        .unwrap_or(serde_json::json!({"mode": "drop"}));
    let mode = listed["mode"].as_str().unwrap_or("drop").to_string();
    match mode.as_str() {
        "drop" => {
            // SEVERED: the request is swallowed and the connection closed
            // — no answer ever arrives (lost request / lost ack)
            false
        }
        "drop-ack" => {
            // the request IS delivered and the destination answers — only
            // the acknowledgement is lost: the sender times out on a fact
            if upstream.write_all(line.as_bytes()).is_err() {
                return false;
            }
            let mut answer = String::new();
            let _ = BufReader::new(upstream.try_clone().expect("clone3")).read_line(&mut answer);
            true
        }
        "delay" => {
            let ms = listed["ms"].as_u64().unwrap_or(1000);
            std::thread::sleep(std::time::Duration::from_millis(ms));
            relay(&mut client, upstream, &line)
        }
        "pass" => relay(&mut client, upstream, &line),
        // an UNKNOWN mode is not a pass — it is a drop: the proxy never
        // forwards on a rule it cannot interpret
        _ => false,
    }
}

fn relay(client: &mut TcpStream, upstream: &mut TcpStream, line: &str) -> bool {
    if upstream.write_all(line.as_bytes()).is_err() {
        return false;
    }
    let mut answer = String::new();
    if BufReader::new(upstream.try_clone().expect("clone2"))
        .read_line(&mut answer)
        .is_err()
    {
        return false;
    }
    client.write_all(answer.as_bytes()).is_ok()
}
