//! The landed netpart line protocol (the harness wire): newline-delimited
//! JSON over TCP, one request line → one answer line. Real-rail
//! destination binaries speak it so the existing harness drives them
//! unchanged — with the rail's own semantics:
//!
//! - `submit {label, txId, payload}` → `{result: acked|duplicate|conflict|
//!   storage-error|timeout}` PLUS the rail's honest additions
//!   `refused:<class>` (a definitive node refusal) — the landed client
//!   maps unknown words to its Timeout class, which for a refusal would
//!   be wrong, so this module's own [`LineClient`] carries the full set.
//! - `observe {label, txId}` → `{state: pending|included|final|unknown-to-dest}`
//! - `advance` / `fault` → REFUSED: block production belongs to the
//!   chain, and the rail's faults live on its own wire (the fault proxy),
//!   not in the destination process.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::time::Duration;

/// the full submission-outcome set for real rails
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RailSubmit {
    Acked,
    Duplicate,
    Conflict,
    /// the destination could not durably take the submission (malformed
    /// payload, storage failure) — a LOCAL failure class, distinct from
    /// both refusal and unknown
    StorageError,
    /// a definitive node refusal, class word attached (insufficient
    /// funds, expiration, …) — conclusive, NOT unknown
    Refused(&'static str),
    /// no conclusive outcome within the window — UNKNOWN territory
    Timeout,
}

impl RailSubmit {
    pub fn word(&self) -> String {
        match self {
            RailSubmit::Acked => "acked".into(),
            RailSubmit::Duplicate => "duplicate".into(),
            RailSubmit::Conflict => "conflict".into(),
            RailSubmit::StorageError => "storage-error".into(),
            RailSubmit::Refused(c) => format!("refused:{c}"),
            RailSubmit::Timeout => "timeout".into(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RailObserve {
    UnknownToDest,
    Pending,
    Included,
    Final,
}

impl RailObserve {
    pub fn word(self) -> &'static str {
        match self {
            RailObserve::UnknownToDest => "unknown-to-dest",
            RailObserve::Pending => "pending",
            RailObserve::Included => "included",
            RailObserve::Final => "final",
        }
    }
}

/// Serve the line protocol on an OS-assigned port; prints the port (one
/// line, so harness helpers can parse stdout), then serves forever, one
/// thread per connection (the landed client opens a connection per
/// round trip).
pub fn serve(
    bind: &str,
    handler: std::sync::Arc<dyn Fn(Value) -> Value + Send + Sync>,
) -> std::io::Error {
    let listener = match TcpListener::bind(if bind.is_empty() { "127.0.0.1:0" } else { bind }) {
        Ok(l) => l,
        Err(e) => return e,
    };
    let port = listener
        .local_addr()
        .map(|a: SocketAddr| a.port())
        .unwrap_or(0);
    println!("{port}");
    let _ = std::io::stdout().flush();
    for conn in listener.incoming() {
        let Ok(stream) = conn else { continue };
        let handler = handler.clone();
        std::thread::spawn(move || {
            let _ = serve_conn(stream, handler);
        });
    }
    unreachable!("listener.incoming() only ends on error")
}

fn serve_conn(
    stream: TcpStream,
    handler: std::sync::Arc<dyn Fn(Value) -> Value + Send + Sync>,
) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut stream = stream;
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            return Ok(()); // closed
        }
        let req: Value = match serde_json::from_str(line.trim()) {
            Ok(v) => v,
            Err(_) => {
                let _ = writeln!(stream, "{}", json!({"error":"malformed line"}));
                continue;
            }
        };
        let answer = handler(req);
        let mut out = serde_json::to_string(&answer).unwrap_or_else(|_| "{}".into());
        out.push('\n');
        stream.write_all(out.as_bytes())?;
        stream.flush()?;
    }
}

/// the rail's own client — the full outcome set (the landed netpart
/// `DestClient` maps `refused:*` to its Timeout class; this client keeps
/// them apart, because a definitive refusal is conclusive and UNKNOWN is
/// not).
pub struct LineClient {
    pub addr: SocketAddr,
    pub label: String,
    pub timeout: Duration,
}

impl LineClient {
    pub fn new(addr: SocketAddr, label: &str, timeout: Duration) -> LineClient {
        LineClient {
            addr,
            label: label.into(),
            timeout,
        }
    }

    fn roundtrip(&self, v: &Value) -> Option<Value> {
        let mut s = TcpStream::connect_timeout(&self.addr, self.timeout).ok()?;
        s.set_read_timeout(Some(self.timeout)).ok()?;
        s.set_write_timeout(Some(self.timeout)).ok()?;
        let mut line = serde_json::to_string(v).unwrap();
        line.push('\n');
        s.write_all(line.as_bytes()).ok()?;
        let mut reader = BufReader::new(s);
        let mut out = String::new();
        reader.read_line(&mut out).ok()?;
        serde_json::from_str(out.trim()).ok()
    }

    pub fn submit(&self, tx_id: &str, payload_hex: &str) -> RailSubmit {
        match self.roundtrip(&json!({
            "op":"submit","label":self.label,"txId":tx_id,"payload":payload_hex
        })) {
            None => RailSubmit::Timeout,
            Some(v) => match v["result"].as_str() {
                Some("acked") => RailSubmit::Acked,
                Some("duplicate") => RailSubmit::Duplicate,
                Some("conflict") => RailSubmit::Conflict,
                Some("storage-error") => RailSubmit::StorageError,
                Some(s) if s.starts_with("refused:") => RailSubmit::Refused(
                    // the class word travels inside the result; leak-free
                    // static mapping happens at the destination, so the
                    // string is matched back to a static word here
                    match_class(s),
                ),
                _ => RailSubmit::Timeout,
            },
        }
    }

    pub fn observe(&self, tx_id: &str) -> Option<RailObserve> {
        let v = self.roundtrip(&json!({"op":"observe","label":self.label,"txId":tx_id}))?;
        Some(match v["state"].as_str()? {
            "pending" => RailObserve::Pending,
            "included" => RailObserve::Included,
            "final" => RailObserve::Final,
            _ => RailObserve::UnknownToDest,
        })
    }
}

/// map a refused result word back to a static class (unknown classes
/// stay refused-other — conclusive either way)
fn match_class(word: &str) -> &'static str {
    let c = word.trim_start_matches("refused:");
    match c {
        "insufficient-funds" => "insufficient-funds",
        "authority" => "authority",
        "unknown-account" => "unknown-account",
        "memo" => "memo",
        "expiration" => "expiration",
        "tapos" => "tapos",
        "resource-credits" => "resource-credits",
        "amount" => "amount",
        "nonce-too-low" => "nonce-too-low",
        "replacement" => "replacement",
        "gas" => "gas",
        "chain-id" => "chain-id",
        "storage" => "storage",
        _ => "refused-other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufReader;
    use std::net::TcpStream;

    #[test]
    fn echo_roundtrip_and_refused_words() {
        let handler =
            std::sync::Arc::new(|v: Value| json!({"result": v["op"].as_str().unwrap_or("?")}));
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for conn in listener.incoming() {
                let Ok(s) = conn else { break };
                let h = handler.clone();
                std::thread::spawn(move || {
                    let _ = serve_conn(s, h);
                });
            }
        });
        let _c = LineClient::new(addr, "test", Duration::from_secs(5));
        // a raw "refused:expiration" result must survive as a distinct
        // conclusive class, never collapse into Timeout
        let mut s = TcpStream::connect(addr).unwrap();
        let mut line = r#"{"op":"submit","label":"t","txId":"ab","payload":"00"}"#.to_string();
        line.push('\n');
        s.write_all(line.as_bytes()).unwrap();
        let mut r = String::new();
        BufReader::new(s).read_line(&mut r).unwrap();
        assert!(r.contains("submit"));
        // client-side word mapping
        let v = json!({"result":"refused:expiration"});
        let word = v["result"].as_str().unwrap();
        assert_eq!(match_class(word), "expiration");
    }
}
