//! Hand-rolled HTTP/1.1 + SSE against the node's management-plane API.
//! Estate idiom: no HTTP dependency — plain std TCP to loopback-rig
//! addresses, one counterparty (the daemon's own REST surface).

use std::io::Write;
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, Receiver};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[path = "http_response.rs"]
mod http_response;
#[path = "sse.rs"]
mod sse;

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
        http_response::read_response(&mut stream, Duration::from_secs(30))
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

/// One SSE frame received from a node stream.
#[derive(Debug, Clone)]
pub struct SseFrame {
    pub data: String,
    pub at_ms: u64,
}

/// Sticky per-node observation failures are independent of the bounded data queue.
#[derive(Debug, Clone, serde::Serialize, Default)]
pub struct Observation {
    pub failures: Vec<String>,
}
impl Observation {
    pub fn require_valid(&self) -> Result<(), String> {
        if self.failures.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "INVALID observation (not network loss): {}",
                self.failures.join("; ")
            ))
        }
    }
}
struct Entry {
    node: String,
    rx: Receiver<SseFrame>,
    handle: Option<JoinHandle<()>>,
    failure: Arc<Mutex<Option<String>>>,
}
impl Entry {
    fn fail(&self, reason: String) {
        let mut failure = self.failure.lock().unwrap();
        if failure.is_none() {
            *failure = Some(reason);
        }
    }
}
/// Each node holds at most 128 frames of at most 64 KiB. Failure is sticky,
/// never enqueued behind evidence, and prohibits a delivery verdict.
pub struct CollectorSet {
    entries: Vec<Entry>,
    stop: Arc<AtomicBool>,
}
impl CollectorSet {
    pub fn spawn(rig: &crate::rig::Rig, nodes: &[String]) -> Result<Self, String> {
        let mut set = Self {
            entries: Vec::new(),
            stop: Arc::new(AtomicBool::new(false)),
        };
        for label in nodes {
            let n = rig.node(label)?;
            let token = std::fs::read_to_string(n.data_dir.join("api-token"))
                .map_err(|e| format!("SSE token read: {e}"))?;
            set.add(
                label,
                format!("{}:{}", n.mgmt_ip, n.api_port),
                token.trim().into(),
            )?;
        }
        Ok(set)
    }
    fn add(&mut self, node: &str, addr: String, token: String) -> Result<(), String> {
        let (tx, rx) = sync_channel(sse::QUEUE_FRAMES);
        let (ready_tx, ready_rx) = sync_channel(1);
        let failure = Arc::new(Mutex::new(None));
        let f = failure.clone();
        let stop = self.stop.clone();
        let handle = std::thread::spawn(move || {
            if let Err(e) = sse::reader(&addr, &token, &stop, &tx, &ready_tx) {
                // Only the explicit cancellation sentinel is benign. A simultaneous
                // overflow/disconnect must remain a failure even during shutdown.
                if e != "collector stopped" {
                    let mut failure = f.lock().unwrap();
                    if failure.is_none() {
                        *failure = Some(e.clone());
                    }
                }
                let _ = ready_tx.try_send(Err(e));
            }
        });
        self.entries.push(Entry {
            node: node.into(),
            rx,
            handle: Some(handle),
            failure,
        });
        ready_rx
            .recv_timeout(Duration::from_secs(22))
            .map_err(|_| format!("{node}: SSE readiness timeout/disconnect"))??;
        Ok(())
    }
    pub fn drain_into(&self, ledger: &mut crate::ledger::Ledger) {
        for entry in &self.entries {
            // A continuously producing peer cannot monopolize the caller.
            for _ in 0..sse::QUEUE_FRAMES {
                let Ok(frame) = entry.rx.try_recv() else {
                    break;
                };
                let v = match serde_json::from_str::<serde_json::Value>(&frame.data) {
                    Ok(v) => v,
                    Err(_) => {
                        entry.fail("SSE invalid JSON evidence".into());
                        continue;
                    }
                };
                let inner = v.get("data").unwrap_or(&v);
                let Some(payload) = inner.get("payload") else {
                    continue;
                };
                let bytes = match payload
                    .as_str()
                    .ok_or("non-string payload".into())
                    .and_then(b64::decode)
                {
                    Ok(bytes) => bytes,
                    Err(_) => {
                        entry.fail("SSE invalid payload evidence".into());
                        continue;
                    }
                };
                if payload.as_str() != Some(b64::encode(&bytes).as_str()) {
                    entry.fail("SSE noncanonical base64 evidence".into());
                    continue;
                }
                let digest = crate::identity::op_digest(&bytes);
                if !ledger.ops.iter().any(|o| o.op_id == digest) {
                    continue;
                }
                let node = entry.node.clone();
                if ledger.has_delivery(&digest, &node) {
                    ledger.record(crate::ledger::Event::DuplicateDelivery {
                        op_id: digest,
                        node,
                        at_ms: frame.at_ms,
                    });
                } else {
                    ledger.record(crate::ledger::Event::Delivered {
                        op_id: digest,
                        node,
                        at_ms: frame.at_ms,
                    });
                }
            }
        }
    }
    fn join(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        for entry in &mut self.entries {
            if let Some(h) = entry.handle.take() {
                if h.join().is_err() {
                    entry.fail("SSE reader panicked".into());
                }
            }
        }
    }
    /// Join producers before the final drain; accepted evidence cannot race it.
    pub fn finish(mut self, ledger: &mut crate::ledger::Ledger) -> Observation {
        self.join();
        self.drain_into(ledger);
        Observation {
            failures: self
                .entries
                .iter()
                .filter_map(|e| {
                    e.failure
                        .lock()
                        .unwrap()
                        .as_ref()
                        .map(|f| format!("{}: {f}", e.node))
                })
                .collect(),
        }
    }
}
impl Drop for CollectorSet {
    fn drop(&mut self) {
        self.join();
    }
}

#[cfg(test)]
mod collector_tests {
    use super::*;
    use crate::identity::{op_digest, OpClass};
    use crate::ledger::{Ledger, OperationRecord};
    use std::io::Read;
    use std::net::TcpListener;
    use std::time::Instant;

    fn ledger() -> Ledger {
        let mut l = Ledger::default();
        l.ops.push(OperationRecord {
            op_id: op_digest(b"observed"),
            logical_id: "one".into(),
            class: OpClass::ClassProbe,
            sender: "seed".into(),
            destination: "probe".into(),
            intended: vec!["leaf".into()],
            payload_bytes: 8,
            envelope_b64: b64::encode(b"observed"),
            published_at_ms: 0,
            deadline_ms: 10_000,
        });
        l
    }
    fn fixture(
        body: Vec<u8>,
        chunked: bool,
        hold: bool,
    ) -> (CollectorSet, std::sync::mpsc::Sender<()>, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (release, wait) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                let mut b = [0];
                stream.read_exact(&mut b).unwrap();
                request.push(b[0]);
            }
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n{}\r\n",
                if chunked {
                    "Transfer-Encoding: chunked\r\n"
                } else {
                    ""
                }
            );
            // Every header and chunk boundary can split across socket reads.
            for b in header.bytes() {
                if stream.write_all(&[b]).is_err() {
                    return;
                }
            }
            if chunked {
                for part in body.chunks(7) {
                    if write!(stream, "{:x}\r\n", part.len())
                        .and_then(|_| stream.write_all(part))
                        .and_then(|_| stream.write_all(b"\r\n"))
                        .is_err()
                    {
                        return;
                    }
                }
            } else {
                let _ = stream.write_all(&body);
            }
            if hold {
                let _ = wait.recv_timeout(Duration::from_secs(5));
            }
        });
        let mut set = CollectorSet {
            entries: Vec::new(),
            stop: Arc::new(AtomicBool::new(false)),
        };
        set.add("leaf", addr, "test".into()).unwrap();
        (set, release, server)
    }
    fn data() -> String {
        format!("data: {{\"payload\":\"{}\"}}\n\n", b64::encode(b"observed"))
    }
    fn wait_for(set: &CollectorSet, failure: bool) {
        let deadline = Instant::now() + Duration::from_secs(3);
        while if failure {
            set.entries[0].failure.lock().unwrap().is_none()
        } else {
            !set.entries[0].handle.as_ref().unwrap().is_finished()
        } {
            assert!(Instant::now() < deadline, "collector failed to settle");
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    #[test]
    fn overflow_is_sticky_and_final_drain_preserves_accepted_evidence() {
        let (set, release, server) = fixture(
            data().repeat(sse::QUEUE_FRAMES + 1).into_bytes(),
            false,
            true,
        );
        wait_for(&set, true);
        let mut l = ledger();
        set.drain_into(&mut l);
        assert_eq!(l.events.len(), sse::QUEUE_FRAMES);
        let report = set.finish(&mut l);
        assert!(report.require_valid().unwrap_err().contains("queue full"));
        assert!(l.has_delivery(&op_digest(b"observed"), "leaf"));
        let _ = release.send(());
        server.join().unwrap();
    }
    #[test]
    fn chunked_fragmented_stream_records_delivery_but_disconnect_invalidates() {
        let (set, _, server) = fixture(data().into_bytes(), true, false);
        wait_for(&set, true);
        let mut l = ledger();
        let report = set.finish(&mut l);
        assert!(l.has_delivery(&op_digest(b"observed"), "leaf"));
        assert!(report.require_valid().unwrap_err().contains("disconnected"));
        server.join().unwrap();
    }
    #[test]
    fn malformed_json_is_not_silently_discarded() {
        let (set, release, server) = fixture(b"data: {broken}\n\n".to_vec(), false, true);
        // Consume the frame deterministically, then validate sticky parsing failure.
        let frame = set.entries[0]
            .rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap();
        let (tx, rx) = sync_channel(1);
        tx.send(frame).unwrap();
        let mut set = set;
        set.entries[0].rx = rx;
        let report = set.finish(&mut ledger());
        assert!(report.require_valid().unwrap_err().contains("invalid JSON"));
        let _ = release.send(());
        server.join().unwrap();
    }
    #[test]
    fn idle_stream_cancels_promptly_without_reconnect_or_false_failure() {
        let (set, release, server) = fixture(Vec::new(), true, true);
        let t = Instant::now();
        set.finish(&mut ledger()).require_valid().unwrap();
        assert!(t.elapsed() < Duration::from_secs(2));
        let _ = release.send(());
        server.join().unwrap();
    }
    #[test]
    fn startup_refuses_error_status_encoding_and_oversized_headers() {
        for header in [
            "HTTP/1.1 401 Unauthorized\r\nContent-Type: text/event-stream\r\n\r\n".to_string(),
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Encoding: gzip\r\n\r\n"
                .to_string(),
            format!("HTTP/1.1 200 OK\r\nX-Large: {}", "x".repeat(16 * 1024)),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap().to_string();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0; 1024];
                let _ = stream.read(&mut request);
                let _ = stream.write_all(header.as_bytes());
            });
            let mut set = CollectorSet {
                entries: Vec::new(),
                stop: Arc::new(AtomicBool::new(false)),
            };
            assert!(set.add("leaf", addr, "test".into()).is_err());
            assert!(set.finish(&mut ledger()).require_valid().is_err());
            server.join().unwrap();
        }
    }
}
