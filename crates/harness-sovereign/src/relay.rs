//! R5 — minimal local Nostr relay (port of Python B5).
//!
//! Exists so the demo survives a relay dying — and so the "kill a relay
//! on stage" beat is safe. Just enough NIP-01 over WebSocket (via
//! `tokio-tungstenite` instead of hand-rolled frames):
//!
//! - client `["EVENT", ev]` → id-validated store, `["OK", id, …]`
//! - client `["REQ", sub, filters]` → replay matches + `EOSE`, then live push
//! - client `["CLOSE", sub]` → forget the subscription
//! - relay `["EVENT", sub, ev]` / `["EOSE", sub]` / `["OK", id, ok, msg]`
//!
//! Filter support: ids/authors (prefix), kinds, since, until, limit,
//! single-char tag filters (`#d`, `#e`, …). Honest scope, kept from the
//! Python: event ids are validated (sha256 over the canonical NIP-01
//! serialization) but signatures are NOT verified — NIP-01 allows a relay
//! to accept events without checking sigs, and this relay is demo-scoped
//! on a loopback interface. Documented deviation: no 120 s idle-socket
//! kill (connections close cleanly on client close or relay stop).

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::nostr::verify_event_id;

/// One stored event plus the subscriptions of one connection.
type Filters = Vec<Value>;

struct Subscriber {
    subs: HashMap<String, Filters>,
    tx: mpsc::UnboundedSender<String>,
}

struct RelayState {
    events: HashMap<String, Value>,
    subscribers: HashMap<u64, Subscriber>,
    next_conn_id: AtomicU64,
}

impl RelayState {
    fn add(&mut self, event: Value) -> bool {
        let id = event
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if self.events.contains_key(&id) {
            return false;
        }
        self.events.insert(id, event);
        true
    }

    fn query(&self, filters: &[Value]) -> Vec<Value> {
        let mut matched: Vec<Value> = self
            .events
            .values()
            .filter(|event| filters.iter().any(|filter| event_matches(event, filter)))
            .cloned()
            .collect();
        matched.sort_by_key(|event| {
            std::cmp::Reverse(event.get("created_at").and_then(Value::as_i64).unwrap_or(0))
        });
        let limit = filters
            .iter()
            .filter_map(|filter| filter.get("limit"))
            .filter_map(Value::as_u64)
            .filter(|limit| *limit > 0)
            .min()
            .unwrap_or(0);
        if limit > 0 {
            matched.truncate(limit as usize);
        }
        matched.reverse(); // oldest-first replay, per NIP-01 convention
        matched
    }
}

/// NIP-01 filter matching, ported clause-for-clause from the Python.
fn event_matches(event: &Value, filter: &Value) -> bool {
    let id = event.get("id").and_then(Value::as_str).unwrap_or_default();
    let pubkey = event
        .get("pubkey")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if let Some(ids) = filter.get("ids").and_then(Value::as_array) {
        if !ids
            .iter()
            .filter_map(Value::as_str)
            .any(|prefix| id.starts_with(prefix))
        {
            return false;
        }
    }
    if let Some(authors) = filter.get("authors").and_then(Value::as_array) {
        if !authors
            .iter()
            .filter_map(Value::as_str)
            .any(|prefix| pubkey.starts_with(prefix))
        {
            return false;
        }
    }
    if let Some(kinds) = filter.get("kinds").and_then(Value::as_array) {
        let kind = event
            .get("kind")
            .and_then(Value::as_u64)
            .unwrap_or(u64::MAX);
        if !kinds
            .iter()
            .filter_map(Value::as_u64)
            .any(|wanted| wanted == kind)
        {
            return false;
        }
    }
    let created_at = event.get("created_at").and_then(Value::as_i64).unwrap_or(0);
    if let Some(since) = filter.get("since").and_then(Value::as_i64) {
        if created_at <= since {
            return false;
        }
    }
    if let Some(until) = filter.get("until").and_then(Value::as_i64) {
        if created_at >= until {
            return false;
        }
    }
    if let Some(object) = filter.as_object() {
        for (key, wanted) in object {
            if key.len() == 2 && key.starts_with('#') {
                let tag_letter = &key[1..2];
                let wanted: HashSet<&str> = wanted
                    .as_array()
                    .map(|list| list.iter().filter_map(Value::as_str).collect())
                    .unwrap_or_default();
                let have: HashSet<&str> = event
                    .get("tags")
                    .and_then(Value::as_array)
                    .map(|tags| {
                        tags.iter()
                            .filter_map(|tag| tag.as_array())
                            .filter(|tag| tag.len() > 1 && tag[0].as_str() == Some(tag_letter))
                            .filter_map(|tag| tag[1].as_str())
                            .collect()
                    })
                    .unwrap_or_default();
                if have.intersection(&wanted).next().is_none() {
                    return false;
                }
            }
        }
    }
    true
}

fn send_json(text: String) -> Message {
    Message::Text(text.into())
}

/// A running relay instance.
pub struct LocalRelay {
    url: String,
    port: u16,
    state: Arc<Mutex<RelayState>>,
    stop_flag: Arc<AtomicBool>,
    task: Option<tokio::task::JoinHandle<()>>,
}

impl LocalRelay {
    /// Bind (port 0 picks an ephemeral port) and start accepting.
    /// Loopback-only in practice: callers pass `127.0.0.1`.
    pub async fn bind(host: &str, port: u16) -> std::io::Result<Self> {
        let listener = TcpListener::bind((host, port)).await?;
        let addr = listener.local_addr()?;
        let state = Arc::new(Mutex::new(RelayState {
            events: HashMap::new(),
            subscribers: HashMap::new(),
            next_conn_id: AtomicU64::new(1),
        }));
        let stop_flag = Arc::new(AtomicBool::new(false));
        let task_state = state.clone();
        let task_stop = stop_flag.clone();
        let task = tokio::spawn(async move {
            accept_loop(listener, task_state, task_stop).await;
        });
        Ok(LocalRelay {
            url: format!("ws://{addr}"),
            port: addr.port(),
            state,
            stop_flag,
            task: Some(task),
        })
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn event_count(&self) -> usize {
        self.state.lock().expect("state").events.len()
    }

    /// Stop accepting; in-flight connections drain on client close.
    pub async fn stop(mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        if let Some(task) = self.task.take() {
            // Wake the accept loop with a throwaway connection.
            let _ = TcpStream::connect(("127.0.0.1", self.port)).await;
            let _ = task.await;
        }
    }
}

async fn accept_loop(listener: TcpListener, state: Arc<Mutex<RelayState>>, stop: Arc<AtomicBool>) {
    loop {
        if stop.load(Ordering::SeqCst) {
            return;
        }
        let Ok((stream, _)) = listener.accept().await else {
            if stop.load(Ordering::SeqCst) {
                return;
            }
            continue;
        };
        let conn_id = state
            .lock()
            .expect("state")
            .next_conn_id
            .fetch_add(1, Ordering::SeqCst);
        let task_state = state.clone();
        tokio::spawn(async move {
            serve_conn(stream, conn_id, task_state).await;
        });
    }
}

async fn serve_conn(stream: TcpStream, conn_id: u64, state: Arc<Mutex<RelayState>>) {
    // Default config: tungstenite's built-in frame limits apply (the
    // Python's 1 MiB cap is a documented deviation — this relay stays
    // demo-scoped on loopback either way).
    let Ok(mut socket) = tokio_tungstenite::accept_async(stream).await else {
        // Non-websocket probe (e.g. the stop wakeup): leave quietly.
        return;
    };
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    {
        state.lock().expect("state").subscribers.insert(
            conn_id,
            Subscriber {
                subs: HashMap::new(),
                tx,
            },
        );
    }
    let (mut sink, mut stream) = socket.split();
    loop {
        tokio::select! {
            outgoing = rx.recv() => {
                let Some(text) = outgoing else { break };
                if sink.send(send_json(text)).await.is_err() {
                    break;
                }
            }
            incoming = stream.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if !handle_command(&text.to_string(), conn_id, &state, &mut sink).await {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
    state.lock().expect("state").subscribers.remove(&conn_id);
}

/// Handle one client message. Returns false when the connection ends.
async fn handle_command<S>(
    text: &str,
    conn_id: u64,
    state: &Arc<Mutex<RelayState>>,
    sink: &mut S,
) -> bool
where
    S: futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let send = |object: Value| serde_json::to_string(&object).expect("relay reply serializes");
    let Ok(message) = serde_json::from_str::<Value>(text) else {
        let _ = sink
            .send(send_json(send(json!([
                "NOTICE",
                "bad: unparseable command"
            ]))))
            .await;
        return true;
    };
    let Some(command) = message.get(0).and_then(Value::as_str) else {
        let _ = sink
            .send(send_json(send(json!([
                "NOTICE",
                "bad: unparseable command"
            ]))))
            .await;
        return true;
    };
    match command {
        "EVENT" => {
            let Some(event) = message.get(1).cloned() else {
                return true;
            };
            let event_id = event
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if !verify_event_id(&event) {
                let _ = sink
                    .send(send_json(send(json!([
                        "OK",
                        event_id,
                        false,
                        "invalid: event id does not match"
                    ]))))
                    .await;
                return true;
            }
            let fresh = state.lock().expect("state").add(event.clone());
            let note = if fresh {
                ""
            } else {
                "duplicate: already have this event"
            };
            let _ = sink
                .send(send_json(send(json!(["OK", event_id, true, note]))))
                .await;
            if fresh {
                broadcast(&event, conn_id, state);
            }
            true
        }
        "REQ" => {
            let sub = message
                .get(1)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let filters: Vec<Value> = message
                .as_array()
                .map(|array| array.iter().skip(2).cloned().collect())
                .unwrap_or_default();
            let replay = state.lock().expect("state").query(&filters);
            {
                if let Some(subscriber) = state.lock().expect("state").subscribers.get_mut(&conn_id)
                {
                    subscriber.subs.insert(sub.clone(), filters);
                }
            }
            for event in replay {
                let _ = sink
                    .send(send_json(send(json!(["EVENT", sub, event]))))
                    .await;
            }
            let _ = sink.send(send_json(send(json!(["EOSE", sub])))).await;
            true
        }
        "CLOSE" => {
            let sub = message.get(1).and_then(Value::as_str).unwrap_or_default();
            if let Some(subscriber) = state.lock().expect("state").subscribers.get_mut(&conn_id) {
                subscriber.subs.remove(sub);
            }
            true
        }
        _ => {
            let _ = sink
                .send(send_json(send(json!([
                    "NOTICE",
                    "bad: unparseable command"
                ]))))
                .await;
            true
        }
    }
}

fn broadcast(event: &Value, skip_conn: u64, state: &Arc<Mutex<RelayState>>) {
    let locked = state.lock().expect("state");
    for (conn_id, subscriber) in locked.subscribers.iter() {
        if *conn_id == skip_conn {
            continue;
        }
        for (sub, filters) in subscriber.subs.iter() {
            if filters.iter().any(|filter| event_matches(event, filter)) {
                let line = serde_json::to_string(&json!(["EVENT", sub, event]))
                    .expect("broadcast serializes");
                let _ = subscriber.tx.send(line);
                break;
            }
        }
    }
}

/// Resolve a loopback address string for tests.
#[allow(dead_code)]
fn loopback() -> SocketAddr {
    "127.0.0.1:0".parse().expect("loopback parses")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nostr::{agent_status_content, build_event, NostrAdapter, KIND_AGENT_STATUS};
    use crate::transport::Transport;
    use secp256k1::Secp256k1;
    use std::time::Duration;

    fn test_secret() -> [u8; 32] {
        [7u8; 32]
    }

    fn signed_status(session: &str) -> Value {
        let secp = Secp256k1::new();
        let (content, tags) =
            agent_status_content(session, "T-001", 1, "spark-primary", "thinking");
        build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_STATUS,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("sign")
    }

    #[tokio::test]
    async fn publish_roundtrip_and_duplicate_ok() {
        let relay = LocalRelay::bind("127.0.0.1", 0).await.expect("bind");
        let adapter = NostrAdapter::new(
            vec![relay.url().to_string()],
            test_secret(),
            Duration::from_secs(10),
        );
        let event = signed_status("sess-relay");
        let results = adapter
            .publish_raw(&serde_json::to_vec(&event).expect("bytes"))
            .await;
        assert_eq!(results.len(), 1);
        assert!(results[0].ok, "publish must be accepted: {:?}", results[0]);
        assert_eq!(relay.event_count(), 1);

        let again = adapter
            .publish_raw(&serde_json::to_vec(&event).expect("bytes"))
            .await;
        assert!(again[0].ok);
        assert!(again[0].message.contains("duplicate"));
        assert_eq!(relay.event_count(), 1);

        let found = adapter.query_raw(&[KIND_AGENT_STATUS], None).await;
        assert_eq!(found.len(), 1);
        assert_eq!(found[0]["id"], event["id"]);
        relay.stop().await;
    }

    #[tokio::test]
    async fn tampered_event_is_rejected() {
        let relay = LocalRelay::bind("127.0.0.1", 0).await.expect("bind");
        let adapter = NostrAdapter::new(
            vec![relay.url().to_string()],
            test_secret(),
            Duration::from_secs(10),
        );
        let mut event = signed_status("sess-tamper");
        event["content"] = json!("{\"tampered\": true}");
        let results = adapter
            .publish_raw(&serde_json::to_vec(&event).expect("bytes"))
            .await;
        assert!(!results[0].ok);
        assert!(results[0].message.contains("invalid"));
        assert_eq!(relay.event_count(), 0);
        relay.stop().await;
    }

    #[tokio::test]
    async fn dead_relay_is_a_failed_result_not_a_crash() {
        // Nothing listens on this port: the adapter must report, not throw.
        let adapter = NostrAdapter::new(
            vec!["ws://127.0.0.1:1".to_string()],
            test_secret(),
            Duration::from_secs(2),
        );
        let event = signed_status("sess-dead");
        let results = adapter
            .publish_raw(&serde_json::to_vec(&event).expect("bytes"))
            .await;
        assert_eq!(results.len(), 1);
        assert!(!results[0].ok);
    }

    #[test]
    fn filter_matching_mirrors_python_clauses() {
        let event = json!({
            "id": "abcdef123",
            "pubkey": "deadbeef",
            "created_at": 100,
            "kind": KIND_AGENT_STATUS,
            "tags": [["d", "sess-1"], ["t", "T-001"]],
            "content": "{}",
        });
        assert!(event_matches(&event, &json!({"ids": ["abc"]})));
        assert!(!event_matches(&event, &json!({"ids": ["zzz"]})));
        assert!(event_matches(&event, &json!({"authors": ["dead"]})));
        assert!(event_matches(
            &event,
            &json!({"kinds": [KIND_AGENT_STATUS]})
        ));
        assert!(!event_matches(&event, &json!({"kinds": [1]})));
        assert!(event_matches(&event, &json!({"since": 50})));
        assert!(!event_matches(&event, &json!({"since": 100})));
        assert!(!event_matches(&event, &json!({"until": 100})));
        assert!(event_matches(&event, &json!({"#d": ["sess-1"]})));
        assert!(!event_matches(&event, &json!({"#d": ["other"]})));
        assert!(event_matches(&event, &json!({})));
    }
}
