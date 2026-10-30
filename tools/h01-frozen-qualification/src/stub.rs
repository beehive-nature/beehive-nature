use crate::{read_bounded, sha256, Result};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("UTC after epoch")
        .as_millis()
}

pub struct PinGate {
    source: PathBuf,
    pub external: PathBuf,
    evidence: Mutex<Option<Value>>,
}

impl PinGate {
    pub fn new(source: PathBuf, external: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            source,
            external,
            evidence: Mutex::new(None),
        })
    }

    fn ensure(&self, request_line: &str) -> Result<()> {
        let mut pinned = self.evidence.lock().map_err(|_| "pin lock")?;
        if pinned.is_some() {
            return Ok(());
        }
        let bytes = read_bounded(&self.source, 64 * 1024)?;
        let material: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        let fields = material
            .as_object()
            .ok_or("public material must be an object")?;
        let allowed = ["did", "alg", "verifying_key_b64u", "genesis_op_b64u"];
        if fields.len() != allowed.len()
            || allowed.iter().any(|name| {
                fields
                    .get(*name)
                    .and_then(Value::as_str)
                    .is_none_or(str::is_empty)
            })
        {
            return Err("public material is incomplete or contains unexpected fields".into());
        }
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&self.external)
            .map_err(|e| format!("create independent pin: {e}"))?;
        output.write_all(&bytes).map_err(|e| e.to_string())?;
        output.sync_all().map_err(|e| e.to_string())?;
        let mut permissions = output.metadata().map_err(|e| e.to_string())?.permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&self.external, permissions).map_err(|e| e.to_string())?;
        *pinned = Some(json!({
            "classification":"PUBLIC-CONSTANT: public identity pin retained before any scripted model response",
            "source":self.source, "external":self.external, "sha256":sha256(&bytes),
            "bytes":bytes.len(), "pinned_unix_ms":now_ms(), "trigger_request":request_line.trim(),
            "did":material["did"], "genesis_op_present":true
        }));
        Ok(())
    }

    pub fn evidence(&self) -> Result<Value> {
        self.evidence
            .lock()
            .map_err(|_| "pin lock")?
            .clone()
            .ok_or_else(|| "no public pin was established".into())
    }
}

pub struct Stub {
    pub url: String,
    stop: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<Value>>>,
    thread: Option<thread::JoinHandle<()>>,
}

impl Stub {
    pub fn start(script: Vec<String>, gate: Arc<PinGate>) -> Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let url = format!(
            "http://{}",
            listener.local_addr().map_err(|e| e.to_string())?
        );
        let stop = Arc::new(AtomicBool::new(false));
        let events = Arc::new(Mutex::new(Vec::new()));
        let thread_stop = stop.clone();
        let thread_events = events.clone();
        let join = thread::spawn(move || {
            let mut queue = VecDeque::from(script);
            while !thread_stop.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        let count = thread_events.lock().expect("events lock").len();
                        if count >= 64 {
                            break;
                        }
                        let event = handle(stream, &mut queue, &gate)
                            .unwrap_or_else(|error| json!({"error":error}));
                        thread_events.lock().expect("events lock").push(event);
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5))
                    }
                    Err(error) => {
                        thread_events
                            .lock()
                            .expect("events lock")
                            .push(json!({"error":error.to_string()}));
                        break;
                    }
                }
            }
        });
        Ok(Self {
            url,
            stop,
            events,
            thread: Some(join),
        })
    }

    pub fn finish(mut self) -> Result<Vec<Value>> {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(join) = self.thread.take() {
            join.join().map_err(|_| "stub thread panicked")?;
        }
        Ok(self.events.lock().map_err(|_| "events lock")?.clone())
    }
}

impl Drop for Stub {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(join) = self.thread.take() {
            let _ = join.join();
        }
    }
}

fn read_line(reader: &mut BufReader<TcpStream>) -> Result<String> {
    let mut bytes = Vec::new();
    reader
        .take(8193)
        .read_until(b'\n', &mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 8192 || !bytes.ends_with(b"\n") {
        return Err("invalid or oversized HTTP line".into());
    }
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

fn handle(mut stream: TcpStream, queue: &mut VecDeque<String>, gate: &PinGate) -> Result<Value> {
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let request = read_line(&mut reader)?;
    let mut length = 0usize;
    let mut total_headers = request.len();
    loop {
        let line = read_line(&mut reader)?;
        total_headers += line.len();
        if total_headers > 64 * 1024 {
            return Err("HTTP headers exceed limit".into());
        }
        if line.trim().is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                length = value.trim().parse().map_err(|_| "invalid Content-Length")?;
            }
        }
    }
    if length > 4 * 1024 * 1024 {
        return Err("HTTP request body exceeds limit".into());
    }
    let mut body = vec![0; length];
    reader.read_exact(&mut body).map_err(|e| e.to_string())?;
    gate.ensure(&request)?;
    let is_models = request
        .split_whitespace()
        .nth(1)
        .is_some_and(|s| s.ends_with("/models"));
    let is_chat = request
        .split_whitespace()
        .nth(1)
        .is_some_and(|s| s.ends_with("/chat/completions"));
    let (kind, content_type, payload) = if is_models {
        ("health", "application/json", "{}".to_string())
    } else if is_chat {
        let text = queue
            .pop_front()
            .ok_or("unexpected completion after script exhausted")?;
        if text == "DROP" {
            return Ok(
                json!({"request":request.trim(),"at_unix_ms":now_ms(),"body_bytes":body.len(),"body_sha256":sha256(&body),"action":"drop","external_pin_retained":true}),
            );
        }
        let event = json!({"choices":[{"delta":{"content":text}}]});
        (
            "completion",
            "text/event-stream",
            format!("data: {event}\n\ndata: [DONE]\n\n"),
        )
    } else {
        return Err(format!("unexpected loopback path: {}", request.trim()));
    };
    let reply = format!("HTTP/1.1 200 OK\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{payload}", payload.len());
    stream
        .write_all(reply.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(
        json!({"request":request.trim(),"at_unix_ms":now_ms(),"body_bytes":body.len(),"body_sha256":sha256(&body),"action":kind,"external_pin_retained":true}),
    )
}

pub fn closed_url() -> Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let url = format!(
        "http://{}",
        listener.local_addr().map_err(|e| e.to_string())?
    );
    drop(listener);
    Ok(url)
}
