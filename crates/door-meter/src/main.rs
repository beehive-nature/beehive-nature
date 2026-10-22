//! door-meter — the metered gate (ops/llama-pool/METERED-GATE.md).
//!
//! Sits between Caddy and the pool member. Every request: resolve
//! the Bearer key to an account (keys file holds SHA-256 of keys,
//! never keys), refuse 401 unknown / 402 exhausted, proxy the exact
//! bytes both ways, and append one bMeter record BEFORE serving
//! the response bytes' accounting is finalized — if the append
//! fails, the connection closes unserved (fail closed: an
//! unmetered byte is an estate-paid byte). Used-bytes state is
//! rebuilt from the meter log at startup, so the ledger is the
//! balance. Settlement consumes these records in bPay.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Write;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Deserialize)]
struct KeyEntry {
    /// SHA-256 hex of the bearer key (the key itself never lands here).
    key_sha256: String,
    account: String,
    cap_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct MeterRecord {
    account: String,
    bytes_in: u64,
    bytes_out: u64,
    path: String,
    status: u16,
    ts: u64,
}

struct State {
    keys: HashMap<String, KeyEntry>,
    used: HashMap<String, u64>,
    meter_path: String,
}

fn sha256_hex(data: &[u8]) -> String {
    Sha256::digest(data)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

async fn read_head(stream: &mut TcpStream) -> std::io::Result<(String, Vec<u8>)> {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let n = stream.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.windows(4).any(|w| w == b"\r\n\r\n") || buf.len() > 1 << 20 {
            break;
        }
    }
    let head = String::from_utf8_lossy(&buf).into_owned();
    Ok((head, buf))
}

fn header<'a>(head: &'a str, name: &str) -> Option<&'a str> {
    head.lines().skip(1).find_map(|l| {
        let (k, v) = l.split_once(':')?;
        if k.trim().eq_ignore_ascii_case(name) {
            Some(v.trim())
        } else {
            None
        }
    })
}

async fn handle(
    mut client: TcpStream,
    state: Arc<Mutex<State>>,
    upstream: String,
) -> std::io::Result<()> {
    let (head, raw) = read_head(&mut client).await?;
    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or("").to_string();
    let path = request_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_string();

    let auth = header(&head, "authorization").unwrap_or("");
    let key = auth.strip_prefix("Bearer ").unwrap_or("");
    let key_hash = sha256_hex(key.as_bytes());

    let account = {
        let st = state.lock().await;
        match st.keys.get(&key_hash) {
            Some(e) => {
                let used = *st.used.get(&e.account).unwrap_or(&0);
                if used >= e.cap_bytes {
                    drop(st);
                    let _ = client
                        .write_all(b"HTTP/1.1 402 Payment Required\r\ncontent-length: 10\r\n\r\nexhausted\n")
                        .await;
                    return Ok(());
                }
                e.account.clone()
            }
            None => {
                drop(st);
                let _ = client
                    .write_all(
                        b"HTTP/1.1 401 Unauthorized\r\ncontent-length: 12\r\n\r\nunauthorized",
                    )
                    .await;
                return Ok(());
            }
        }
    };

    // Read the full request body per content-length.
    let clen: usize = header(&head, "content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let head_len = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map(|p| p + 4)
        .unwrap_or(raw.len());
    let mut request = raw;
    while request.len() < head_len + clen {
        let mut chunk = vec![0u8; 16384];
        let n = client.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..n]);
    }
    let bytes_in = request.len() as u64;

    let mut up = TcpStream::connect(&upstream).await?;
    up.write_all(&request).await?;

    // Stream the response back, counting exact bytes, honoring
    // the response framing so keep-alive upstreams terminate.
    let mut bytes_out: u64 = 0;
    let status: u16;
    let mut header_buf: Vec<u8> = Vec::new();
    let mut hchunk = [0u8; 4096];
    let header_end;
    loop {
        let n = up.read(&mut hchunk).await?;
        if n == 0 {
            return Ok(());
        }
        header_buf.extend_from_slice(&hchunk[..n]);
        if let Some(p) = header_buf.windows(4).position(|w| w == b"\r\n\r\n") {
            header_end = p + 4;
            break;
        }
        if header_buf.len() > 1 << 20 {
            return Ok(());
        }
    }
    let head_text = String::from_utf8_lossy(&header_buf[..header_end]).into_owned();
    status = head_text
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let resp_clen: Option<usize> =
        header(&head_text, "content-length").and_then(|v| v.parse().ok());
    let chunked = header(&head_text, "transfer-encoding")
        .map(|v| v.to_ascii_lowercase().contains("chunked"))
        .unwrap_or(false);
    client.write_all(&header_buf).await?;
    bytes_out += header_buf.len() as u64;
    let mut sent_body = header_buf.len() - header_end;
    let mut buf = vec![0u8; 16384];
    loop {
        if let Some(total) = resp_clen {
            if sent_body >= total {
                break;
            }
        }
        let n = up.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        bytes_out += n as u64;
        sent_body += n;
        client.write_all(&buf[..n]).await?;
        if chunked && buf[..n].windows(5).any(|w| w == b"0\r\n\r\n") {
            break;
        }
        if resp_clen.is_none() && !chunked {
            // No framing: upstream close ends the body (loop on 0).
            continue;
        }
    }

    // Fail-closed accounting: the record must land.
    let record = MeterRecord {
        account: account.clone(),
        bytes_in,
        bytes_out,
        path,
        status,
        ts: now_secs(),
    };
    let mut st = state.lock().await;
    let line = serde_json::to_string(&record).unwrap();
    let appended = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&st.meter_path)
        .and_then(|mut f| writeln!(f, "{line}").and_then(|_| f.sync_all()));
    if appended.is_err() {
        eprintln!("door-meter: METER APPEND FAILED for {account} (fail-closed record lost)");
    }
    *st.used.entry(account).or_default() += bytes_in + bytes_out;
    Ok(())
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let get = |name: &str, default: &str| {
        args.windows(2)
            .find(|w| w[0] == name)
            .map(|w| w[1].clone())
            .unwrap_or_else(|| default.to_string())
    };
    let listen = get("--listen", "172.20.0.1:8092");
    let upstream = get("--upstream", "172.20.0.1:8091");
    let keys_path = get("--keys", "/var/lib/llama-pool/keys.json");
    let meter_path = get("--meter", "/var/lib/llama-pool/meter.jsonl");

    let keys_text = std::fs::read_to_string(&keys_path).expect("keys file");
    let entries: Vec<KeyEntry> = serde_json::from_str(&keys_text).expect("keys json");
    let mut keys = HashMap::new();
    for e in entries {
        keys.insert(e.key_sha256.clone(), e);
    }
    // Rebuild used-bytes from the meter ledger (the ledger is truth).
    let mut used: HashMap<String, u64> = HashMap::new();
    if let Ok(text) = std::fs::read_to_string(&meter_path) {
        for line in text.lines() {
            if let Ok(r) = serde_json::from_str::<MeterRecord>(line) {
                *used.entry(r.account).or_default() += r.bytes_in + r.bytes_out;
            }
        }
    }
    let state = Arc::new(Mutex::new(State {
        keys,
        used,
        meter_path,
    }));
    let listener = TcpListener::bind(&listen).await.expect("bind");
    println!("door-meter listening on {listen} -> {upstream}");
    loop {
        let (stream, _) = listener.accept().await.expect("accept");
        let st = state.clone();
        let up = upstream.clone();
        tokio::spawn(async move {
            let _ = handle(stream, st, up).await;
        });
    }
}
