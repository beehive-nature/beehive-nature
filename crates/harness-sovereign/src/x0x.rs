//! x0x transport adapter — the SECOND adapter behind
//! [`crate::transport::Transport`] (CONSTITUTION Art. III).
//!
//! The kernel's event bus is primary; Nostr ([`crate::nostr`]) and x0x
//! are both dumb pipes under it, selected by `HARNESS_TRANSPORT`. The
//! harness declares the same intents (`publish_raw`, `query_raw`) and
//! never names x0x wire details outside this module.
//!
//! Wire: the local `x0xd` loopback API (ops/x0x/x0xd.toml:
//! `api_address = "127.0.0.1:12700"`, saorsa-labs/x0x v0.45):
//! - `GET /health` — node liveness (no auth).
//! - `POST /publish {"topic", "payload"}` (base64 payload, `Bearer`
//!   token from the node's `api-token` file) — gossip fanout.
//! - `POST /subscribe {"topic"}` -> `{"subscription_id"}`; events then
//!   arrive on `GET /events` (SSE), each `data:` line a JSON object with
//!   `topic` and base64 `payload`.
//!
//! Semantics vs the Nostr adapter (honest): gossip has no stored history,
//! so `query_raw` opens the SSE stream and collects for a bounded window
//! (default 500 ms); `kinds`/`since` are applied client-side to the
//! collected payloads. A dead node yields a failed `RelayResult` / empty
//! query — never an error (the trait's §3.5 contract).

use std::time::Duration;

use async_trait::async_trait;
use base64::Engine as _;
use futures_util::StreamExt as _;
use serde_json::{json, Value};

use crate::nostr::NostrBusBridge;
use crate::transport::{dedupe_by_id, RelayResult, Transport};

/// Default local x0xd API endpoint (loopback only, per ops/x0x).
pub const DEFAULT_API: &str = "http://127.0.0.1:12700";
/// The one gossip topic the harness rides on x0x.
pub const EVENTS_TOPIC: &str = "harness.events";

const B64: base64::engine::general_purpose::GeneralPurpose =
    base64::engine::general_purpose::STANDARD;

/// Transport over the local x0xd loopback API. See module docs.
pub struct X0xTransport {
    api: String,
    token: Option<String>,
    client: reqwest::Client,
    query_window: Duration,
}

impl X0xTransport {
    pub fn new(api: impl Into<String>, token: Option<String>) -> Self {
        Self {
            api: api.into().trim_end_matches('/').to_string(),
            token,
            client: reqwest::Client::new(),
            query_window: Duration::from_millis(500),
        }
    }

    /// From the operator env: `X0X_API_URL` (default [`DEFAULT_API`]),
    /// `X0X_API_TOKEN` (the node's `api-token`, env-delivered like every
    /// other estate secret; never logged).
    pub fn from_env() -> Self {
        let api = std::env::var("X0X_API_URL").unwrap_or_else(|_| DEFAULT_API.to_string());
        let token = std::env::var("X0X_API_TOKEN")
            .ok()
            .filter(|t| !t.is_empty());
        Self::new(api, token)
    }

    /// Override the SSE collection window (tests keep it short).
    pub fn with_query_window(mut self, window: Duration) -> Self {
        self.query_window = window;
        self
    }

    pub fn api(&self) -> &str {
        &self.api
    }

    /// Cheap liveness: `GET /health` answers 200 when the node is up.
    pub async fn health(&self) -> bool {
        self.client
            .get(format!("{}/health", self.api))
            .send()
            .await
            .map(|resp| resp.status().is_success())
            .unwrap_or(false)
    }

    fn authed(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.token {
            Some(token) => req.bearer_auth(token),
            None => req,
        }
    }
}

#[async_trait]
impl Transport for X0xTransport {
    fn name(&self) -> &str {
        "x0x"
    }

    async fn publish_raw(&self, payload: &[u8]) -> Vec<RelayResult> {
        let body = json!({"topic": EVENTS_TOPIC, "payload": B64.encode(payload)});
        let result = self
            .authed(self.client.post(format!("{}/publish", self.api)))
            .json(&body)
            .send()
            .await;
        let (ok, message) = match result {
            Ok(resp) if resp.status().is_success() => (true, "published".to_string()),
            Ok(resp) => (false, format!("x0x publish HTTP {}", resp.status())),
            Err(err) => (false, format!("x0x unreachable: {err}")),
        };
        vec![RelayResult {
            relay: self.api.clone(),
            ok,
            message,
        }]
    }

    async fn query_raw(&self, kinds: &[u32], since: Option<i64>) -> Vec<Value> {
        // Subscribe, then read the SSE stream for the bounded window.
        let sub = self
            .authed(self.client.post(format!("{}/subscribe", self.api)))
            .json(&json!({"topic": EVENTS_TOPIC}))
            .send()
            .await;
        let Ok(sub) = sub else {
            return Vec::new();
        };
        if !sub.status().is_success() {
            return Vec::new();
        }
        let events = self
            .authed(
                self.client
                    .get(format!("{}/events", self.api))
                    .header("accept", "text/event-stream"),
            )
            .send()
            .await;
        let Ok(events) = events else {
            return Vec::new();
        };

        let mut collected: Vec<Value> = Vec::new();
        let mut stream = events.bytes_stream();
        let mut buffer = String::new();
        let _ = tokio::time::timeout(self.query_window, async {
            while let Some(chunk) = stream.next().await {
                let Ok(chunk) = chunk else { break };
                buffer.push_str(&String::from_utf8_lossy(&chunk));
                while let Some(nl) = buffer.find('\n') {
                    let line: String = buffer.drain(..=nl).collect();
                    let Some(data) = line.trim().strip_prefix("data:") else {
                        continue;
                    };
                    let Ok(msg) = serde_json::from_str::<Value>(data.trim()) else {
                        continue;
                    };
                    if msg.get("topic").and_then(Value::as_str) != Some(EVENTS_TOPIC) {
                        continue;
                    }
                    let Some(payload) = msg.get("payload").and_then(Value::as_str) else {
                        continue;
                    };
                    let Ok(bytes) = B64.decode(payload) else {
                        continue;
                    };
                    if let Ok(event) = serde_json::from_slice::<Value>(&bytes) {
                        collected.push(event);
                    }
                }
            }
        })
        .await;

        // kinds/since are client-side filters on gossip (docs above).
        let filtered = collected
            .into_iter()
            .filter(|event| {
                let kind_ok = kinds.is_empty()
                    || event
                        .get("kind")
                        .and_then(Value::as_u64)
                        .map(|k| kinds.contains(&(k as u32)))
                        .unwrap_or(true);
                let since_ok = since
                    .map(|t| event.get("created_at").and_then(Value::as_i64).unwrap_or(0) >= t)
                    .unwrap_or(true);
                kind_ok && since_ok
            })
            .collect();
        dedupe_by_id(filtered)
    }
}

/// Bus -> x0x bridge, mirroring [`crate::nostr::NostrBusBridge`]: the
/// same translated lifecycle bytes ride a different pipe. The harness
/// (and the switch above it) cannot tell which transport carried them.
pub struct X0xBusBridge {
    adapter: X0xTransport,
}

impl X0xBusBridge {
    pub fn new(adapter: X0xTransport) -> Self {
        X0xBusBridge { adapter }
    }

    /// Forward loop: bus -> x0x. Returns when the bus closes.
    pub async fn forward_loop(
        self,
        mut rx: tokio::sync::broadcast::Receiver<shared_types::CanonicalEvent>,
        secret: [u8; 32],
        clock: impl Fn() -> i64,
    ) {
        let secp = crate::nostr::NostrAdapter::secp();
        loop {
            let event = match rx.recv().await {
                Ok(event) => event,
                Err(_) => return,
            };
            if let Some(wire) = NostrBusBridge::translate(&secp, &secret, &event, clock()) {
                let bytes = serde_json::to_vec(&wire).unwrap_or_default();
                self.adapter.publish_raw(&bytes).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read as _, Write as _};

    /// Minimal fake x0xd: serves scripted responses, captures requests.
    fn fake_x0d(
        publishes: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
        events_body: &'static str,
    ) -> String {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || loop {
            let Ok((mut stream, _)) = listener.accept() else {
                break;
            };
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            publishes.lock().unwrap().push(req.clone());
            let (status, ctype, body) = if req.starts_with("GET /health") {
                ("200 OK", "application/json", "{\"status\":\"ok\"}")
            } else if req.starts_with("POST /subscribe") {
                (
                    "200 OK",
                    "application/json",
                    "{\"subscription_id\":\"sub-1\"}",
                )
            } else if req.starts_with("GET /events") {
                ("200 OK", "text/event-stream", events_body)
            } else {
                ("200 OK", "application/json", "{\"ok\":true}")
            };
            let _ = stream.write_all(
                format!(
                    "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len(),
                )
                .as_bytes(),
            );
            let _ = stream.flush();
        });
        format!("http://{addr}")
    }

    #[tokio::test]
    async fn publish_posts_base64_payload_with_bearer() {
        let captured = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let api = fake_x0d(captured.clone(), "");
        let transport = X0xTransport::new(api, Some("tok-123".to_string()));
        let results = transport.publish_raw(b"hello x0x").await;
        assert_eq!(results.len(), 1);
        assert!(results[0].ok, "publish must succeed: {:?}", results[0]);

        let reqs = captured.lock().unwrap();
        let publish = reqs
            .iter()
            .find(|r| r.starts_with("POST /publish"))
            .expect("publish request captured");
        assert!(
            publish.contains("authorization: Bearer tok-123")
                || publish.contains("Authorization: Bearer tok-123"),
            "bearer header missing: {publish}"
        );
        // base64("hello x0x") = aGVsbG8geDB4
        assert!(
            publish.contains("\"topic\":\"harness.events\""),
            "topic missing: {publish}"
        );
        assert!(
            publish.contains("\"payload\":\"aGVsbG8geDB4\""),
            "payload missing: {publish}"
        );
    }

    #[tokio::test]
    async fn publish_to_dead_node_reports_failure_not_error() {
        let transport = X0xTransport::new("http://127.0.0.1:9", None);
        let results = transport.publish_raw(b"x").await;
        assert_eq!(results.len(), 1);
        assert!(!results[0].ok);
        assert!(!transport.health().await);
    }

    #[tokio::test]
    async fn query_collects_decodes_and_filters_sse_events() {
        let event = json!({"id": "evt-1", "kind": 31337, "created_at": 100, "content": "{}"});
        let encoded = B64.encode(serde_json::to_vec(&event).unwrap());
        let sse: &'static str = Box::leak(
            format!(
                "event: message\ndata: {{\"topic\":\"harness.events\",\"payload\":\"{encoded}\"}}\n\nevent: message\ndata: {{\"topic\":\"other\",\"payload\":\"{encoded}\"}}\n\n"
            )
            .into_boxed_str(),
        );
        let captured = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let api = fake_x0d(captured, sse);
        let transport = X0xTransport::new(api, None).with_query_window(Duration::from_millis(400));
        let events = transport.query_raw(&[31337], None).await;
        assert_eq!(
            events.len(),
            1,
            "only the harness topic returns: {events:?}"
        );
        assert_eq!(events[0]["id"], json!("evt-1"));

        // kind filter excludes it on a second call
        let none = transport.query_raw(&[31340], None).await;
        assert!(none.is_empty(), "kind filter must exclude: {none:?}");
    }
}
