//! MCP protocol over stdio: newline-delimited JSON-RPC 2.0. Handles the
//! handshake, tools, progress notifications, and cancellation.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::sync::Mutex as AsyncMutex;

use crate::pixellab::Transport;
use crate::tools::{self, Budget};
use crate::ServerConfig;

pub const PROTOCOL_VERSION_DEFAULT: &str = "2024-11-05";
pub const SERVER_NAME: &str = "adapter-pixellab";
pub const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

type WriterRef<W> = Arc<AsyncMutex<BufWriter<W>>>;
type CancelMap = Arc<Mutex<HashMap<String, CancelSet>>>;

/// A cooperative cancel signal. `watch` keeps the value, so a cancel that
/// lands before the await is still observed — no missed-wakeup window.
#[derive(Clone)]
struct CancelSet {
    tx: tokio::sync::watch::Sender<bool>,
    rx: tokio::sync::watch::Receiver<bool>,
}

impl CancelSet {
    fn new() -> Self {
        let (tx, rx) = tokio::sync::watch::channel(false);
        Self { tx, rx }
    }

    fn cancel(&self) {
        let _ = self.tx.send(true);
    }

    async fn cancelled(&self) {
        let mut rx = self.rx.clone();
        while !*rx.borrow() {
            if rx.changed().await.is_err() {
                return;
            }
        }
    }
}

pub async fn serve<T, R, W>(
    transport: Arc<T>,
    config: Arc<ServerConfig>,
    stdin: R,
    stdout: W,
) -> Result<(), String>
where
    T: Transport,
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let budget = Arc::new(Budget::new(config.max_spend_usd));
    let writer: WriterRef<W> = Arc::new(AsyncMutex::new(BufWriter::new(stdout)));
    let cancels: CancelMap = Arc::new(Mutex::new(HashMap::new()));

    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .await
            .map_err(|e| format!("stdin read: {e}"))?;
        if n == 0 {
            // Client went away. In-flight work aborts with the runtime.
            return Ok(());
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let msg: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                write_json(
                    &writer,
                    &json!({
                        "jsonrpc": "2.0", "id": null,
                        "error": { "code": -32700, "message": "parse error" }
                    }),
                )
                .await;
                continue;
            }
        };
        handle(
            transport.clone(),
            config.clone(),
            budget.clone(),
            writer.clone(),
            cancels.clone(),
            msg,
        )
        .await;
    }
}

async fn write_json<W: tokio::io::AsyncWrite + Unpin>(writer: &WriterRef<W>, v: &Value) {
    let s = serde_json::to_string(v).unwrap_or_else(|_| "{}".into());
    let mut g = writer.lock().await;
    let _ = g.write_all(s.as_bytes()).await;
    let _ = g.write_all(b"\n").await;
    let _ = g.flush().await;
}

async fn notify_progress<W: tokio::io::AsyncWrite + Unpin>(
    writer: &WriterRef<W>,
    token: &Value,
    progress: f64,
    message: &str,
) {
    write_json(
        writer,
        &json!({
            "jsonrpc": "2.0",
            "method": "notifications/progress",
            "params": { "progressToken": token, "progress": progress, "message": message }
        }),
    )
    .await;
}

async fn handle<T: Transport, W: tokio::io::AsyncWrite + Unpin + Send + 'static>(
    transport: Arc<T>,
    config: Arc<ServerConfig>,
    budget: Arc<Budget>,
    writer: WriterRef<W>,
    cancels: CancelMap,
    msg: Value,
) {
    let id = msg.get("id").cloned();
    let method = msg
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    if id.is_none() {
        // Notifications get no response. Cancellation is the one we act on.
        if method == "notifications/cancelled" {
            if let Some(rid) = msg.pointer("/params/requestId") {
                if let Some(ct) = cancels.lock().unwrap().remove(&rid.to_string()) {
                    ct.cancel();
                }
            }
        }
        return;
    }
    let id = id.unwrap();
    let params = msg.get("params").cloned().unwrap_or(Value::Null);

    match method.as_str() {
        "initialize" => {
            let pv = params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(PROTOCOL_VERSION_DEFAULT);
            write_json(
                &writer,
                &json!({
                    "jsonrpc": "2.0", "id": id, "result": {
                        "protocolVersion": pv,
                        "capabilities": { "tools": { "listChanged": false } },
                        "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION }
                    }
                }),
            )
            .await;
        }
        "ping" => {
            write_json(
                &writer,
                &json!({ "jsonrpc": "2.0", "id": id, "result": {} }),
            )
            .await;
        }
        "tools/list" => {
            write_json(
                &writer,
                &json!({ "jsonrpc": "2.0", "id": id, "result": { "tools": tools::tools_json() } }),
            )
            .await;
        }
        "tools/call" => {
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if name != "generate_image" && name != "get_balance" {
                write_json(
                    &writer,
                    &json!({
                        "jsonrpc": "2.0", "id": id,
                        "error": { "code": -32602, "message": format!("unknown tool: {name}") }
                    }),
                )
                .await;
                return;
            }
            let arguments = params.get("arguments").cloned().unwrap_or(json!({}));
            let ptoken = params
                .pointer("/_meta/progressToken")
                .cloned()
                .filter(|v| !v.is_null());

            let ct = CancelSet::new();
            cancels.lock().unwrap().insert(id.to_string(), ct.clone());
            if let Some(t) = &ptoken {
                notify_progress(&writer, t, 0.0, "dispatching").await;
            }

            let t2 = transport;
            let c2 = config;
            let b2 = budget;
            let w2 = writer;
            let idc = id.clone();
            let cancels2 = cancels;
            tokio::spawn(async move {
                let outcome = tokio::select! {
                    r = tools::execute(&t2, &c2, &b2, &name, &arguments) => r,
                    _ = ct.cancelled() => Err("request cancelled".to_string()),
                };
                if let Some(t) = &ptoken {
                    notify_progress(&w2, t, 1.0, "done").await;
                }
                let resp = match outcome {
                    Ok(v) => json!({
                        "jsonrpc": "2.0", "id": idc, "result": {
                            "content": [ { "type": "text", "text": v.to_string() } ],
                            "isError": false
                        }
                    }),
                    Err(e) if e == "request cancelled" => json!({
                        "jsonrpc": "2.0", "id": idc,
                        "error": { "code": -32800, "message": "request cancelled" }
                    }),
                    Err(e) => json!({
                        "jsonrpc": "2.0", "id": idc, "result": {
                            "content": [ { "type": "text", "text": e } ],
                            "isError": true
                        }
                    }),
                };
                write_json(&w2, &resp).await;
                cancels2.lock().unwrap().remove(&idc.to_string());
            });
        }
        _ => {
            write_json(
                &writer,
                &json!({
                    "jsonrpc": "2.0", "id": id,
                    "error": { "code": -32601, "message": format!("method not found: {method}") }
                }),
            )
            .await;
        }
    }
}
