//! R4 — Nostr transport adapter (port of Python B4).
//!
//! One implementation of the [`crate::transport::Transport`] capability:
//! signed NIP-01 events (kinds 31337–31340, demo-scoped) fanned out to
//! every configured relay; subscribers REQ from all and dedupe by event
//! id, so any relay may die without breaking the demo. x0x arrives as a
//! second adapter behind the same trait — the harness never hardcodes
//! Nostr outside this module.
//!
//! Key custody (Appendix B): the demo agent publishes under its OWN
//! ephemeral key (`demo-nsec.hex` in the harness keys dir, generated on
//! first run). A personal `~/.nostr/nsec` is never read, never copied,
//! never committed.

use std::path::Path;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use secp256k1::{Keypair, Message, Secp256k1, SecretKey, XOnlyPublicKey};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio_tungstenite::tungstenite::Message as WsMessage;

use crate::transport::{RelayResult, Transport};

/// Demo-scoped Nostr kinds (a production registry would request a NIP
/// allocation).
pub const KIND_AGENT_STATUS: u32 = 31337;
pub const KIND_AGENT_CHECKPOINT: u32 = 31338;
pub const KIND_SETTLE_RECEIPT: u32 = 31339;
pub const KIND_IDENTITY_PROOF: u32 = 31340;

/// Load the demo agent key, generating it on first run. File creation is
/// exclusive (no clobber); 0600 is best-effort on Windows, where the file
/// lives inside the harness workdir either way.
pub fn ensure_demo_key(keys_dir: &Path) -> Result<[u8; 32], String> {
    std::fs::create_dir_all(keys_dir).map_err(|e| format!("keys dir: {e}"))?;
    let path = keys_dir.join("demo-nsec.hex");
    if let Ok(text) = std::fs::read_to_string(&path) {
        return hex_to_32(text.trim()).ok_or_else(|| "demo key is malformed".to_string());
    }
    let mut secret = [0u8; 32];
    getrandom::getrandom(&mut secret).map_err(|e| format!("randomness: {e}"))?;
    if secret == [0u8; 32] {
        return Err("refusing zero demo key".to_string());
    }
    let hex = hex_encode(&secret);
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .and_then(|mut file| {
            use std::io::Write;
            file.write_all(hex.as_bytes())
        })
        .map_err(|e| format!("demo key write: {e}"))?;
    Ok(secret)
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 15) as usize] as char);
    }
    out
}

fn hex_to_32(text: &str) -> Option<[u8; 32]> {
    if text.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for (index, chunk) in text.as_bytes().chunks(2).enumerate() {
        out[index] = u8::from_str_radix(std::str::from_utf8(chunk).ok()?, 16).ok()?;
    }
    Some(out)
}

fn xonly_of(secp: &Secp256k1<secp256k1::All>, secret: &[u8; 32]) -> Result<XOnlyPublicKey, String> {
    let sk = SecretKey::from_slice(&secret[..]).map_err(|e| format!("secret: {e}"))?;
    let keypair = Keypair::from_secret_key(secp, &sk);
    Ok(XOnlyPublicKey::from_keypair(&keypair).0)
}

/// Canonical NIP-01 serialization: `[0, pubkey, created_at, kind, tags,
/// content]`, compact separators, non-ASCII unescaped.
fn canonical_array(
    pubkey: &str,
    created_at: i64,
    kind: u32,
    tags: &Value,
    content: &str,
) -> String {
    serde_json::to_string(&json!([0, pubkey, created_at, kind, tags, content]))
        .expect("Nostr array serializes")
}

/// Build and schnorr-sign a NIP-01 event. `content` is stored as a JSON
/// string when it is not already one (Python `build_event` parity).
pub fn build_event(
    secp: &Secp256k1<secp256k1::All>,
    secret: &[u8; 32],
    kind: u32,
    content: &Value,
    tags: Vec<Vec<String>>,
    created_at: i64,
) -> Result<Value, String> {
    let pubkey = hex_encode(&xonly_of(secp, secret)?.serialize());
    let content_str = match content {
        Value::String(text) => text.clone(),
        other => serde_json::to_string(other).map_err(|e| format!("content JSON: {e}"))?,
    };
    let tags_value = Value::Array(tags.into_iter().map(|row| json!(row)).collect());
    let serialized =
        canonical_array(&pubkey, created_at, kind, &tags_value, &content_str).into_bytes();
    let mut id = [0u8; 32];
    id.copy_from_slice(&Sha256::digest(&serialized));
    let sk = SecretKey::from_slice(&secret[..]).map_err(|e| format!("secret: {e}"))?;
    let keypair = Keypair::from_secret_key(secp, &sk);
    let message = Message::from_digest(id);
    let signature = secp.sign_schnorr_no_aux_rand(&message, &keypair);
    Ok(json!({
        "id": hex_encode(&id),
        "pubkey": pubkey,
        "created_at": created_at,
        "kind": kind,
        "tags": tags_value,
        "content": content_str,
        "sig": hex_encode(&signature.serialize()),
    }))
}

/// Recompute the id: true only when the event is intact.
pub fn verify_event_id(event: &Value) -> bool {
    let (Some(pubkey), Some(created_at), Some(kind), Some(tags), Some(content), Some(id)) = (
        event.get("pubkey").and_then(Value::as_str),
        event.get("created_at").and_then(Value::as_i64),
        event.get("kind").and_then(Value::as_u64),
        event.get("tags"),
        event.get("content").and_then(Value::as_str),
        event.get("id").and_then(Value::as_str),
    ) else {
        return false;
    };
    let serialized = canonical_array(pubkey, created_at, kind as u32, tags, content).into_bytes();
    let mut recomputed = [0u8; 32];
    recomputed.copy_from_slice(&Sha256::digest(&serialized));
    hex_encode(&recomputed) == id
}

/// Verify the schnorr signature against the claimed pubkey.
pub fn verify_event_sig(secp: &Secp256k1<secp256k1::All>, event: &Value) -> bool {
    let (Some(pubkey_hex), Some(id_hex), Some(sig_hex)) = (
        event.get("pubkey").and_then(Value::as_str),
        event.get("id").and_then(Value::as_str),
        event.get("sig").and_then(Value::as_str),
    ) else {
        return false;
    };
    let (Some(pubkey_bytes), Some(id_bytes), Some(sig_bytes)) = (
        hex_to_32_str(pubkey_hex),
        hex_to_32_str(id_hex),
        hex_to_64_str(sig_hex),
    ) else {
        return false;
    };
    let Ok(xonly) = XOnlyPublicKey::from_slice(&pubkey_bytes[..]) else {
        return false;
    };
    let message = Message::from_digest(id_bytes);
    let Ok(signature) = secp256k1::schnorr::Signature::from_slice(&sig_bytes[..]) else {
        return false;
    };
    secp.verify_schnorr(&signature, &message, &xonly).is_ok()
}

fn hex_to_32_str(text: &str) -> Option<[u8; 32]> {
    hex_to_32(text)
}

fn hex_to_64_str(text: &str) -> Option<[u8; 64]> {
    if text.len() != 128 {
        return None;
    }
    let mut out = [0u8; 64];
    for (index, chunk) in text.as_bytes().chunks(2).enumerate() {
        out[index] = u8::from_str_radix(std::str::from_utf8(chunk).ok()?, 16).ok()?;
    }
    Some(out)
}

/// Demo event builders (B4 `agent_status` / `agent_checkpoint` /
/// `settle_receipt` / `identity_proof` shapes, tags included).
pub fn agent_status_content(
    session: &str,
    task_id: &str,
    turn: u64,
    backend: &str,
    state: &str,
) -> (Value, Vec<Vec<String>>) {
    (
        json!({"session": session, "task_id": task_id, "turn": turn,
               "backend": backend, "state": state}),
        vec![
            vec!["d".to_string(), session.to_string()],
            vec!["t".to_string(), task_id.to_string()],
        ],
    )
}

pub fn agent_checkpoint_content(
    session: &str,
    phase: &str,
    transcript_sha256: &str,
    envelope: Option<Value>,
) -> (Value, Vec<Vec<String>>) {
    let mut content = serde_json::json!({"session": session, "phase": phase,
                                         "transcript_sha256": transcript_sha256});
    if let Some(envelope) = envelope {
        content["bsigner_envelope"] = envelope;
    }
    (
        content,
        vec![
            vec!["d".to_string(), session.to_string()],
            vec!["phase".to_string(), phase.to_string()],
        ],
    )
}

/// Nostr transport adapter: one relay set behind the capability.
pub struct NostrAdapter {
    relays: Vec<String>,
    secret: [u8; 32],
    timeout: Duration,
}

impl NostrAdapter {
    pub fn new(relays: Vec<String>, secret: [u8; 32], timeout: Duration) -> Self {
        NostrAdapter {
            relays,
            secret,
            timeout,
        }
    }

    pub fn secp() -> Secp256k1<secp256k1::All> {
        Secp256k1::new()
    }

    async fn send_recv(&self, url: &str, send: &str, want: &str, id: &str) -> (bool, String) {
        let socket =
            tokio::time::timeout(self.timeout, tokio_tungstenite::connect_async(url)).await;
        let Ok(Ok((mut socket, _))) = socket else {
            return (false, "connect failed".to_string());
        };
        if socket
            .send(WsMessage::Text(send.to_string().into()))
            .await
            .is_err()
        {
            return (false, "send failed".to_string());
        }
        let deadline = tokio::time::Instant::now() + self.timeout;
        loop {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                return (false, "no OK before timeout".to_string());
            }
            let next = tokio::time::timeout(remaining, socket.next()).await;
            let Ok(Some(Ok(WsMessage::Text(line)))) = next else {
                continue;
            };
            let Ok(arr) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if arr.get(0).and_then(Value::as_str) == Some(want)
                && arr.get(1).and_then(Value::as_str) == Some(id)
            {
                if want == "OK" {
                    let ok = arr.get(2).and_then(Value::as_bool).unwrap_or(false);
                    let message = arr.get(3).and_then(Value::as_str).unwrap_or("").to_string();
                    return (ok, message);
                }
                return (true, String::new());
            }
            if arr.get(0).and_then(Value::as_str) == Some("EOSE")
                && arr.get(1).and_then(Value::as_str) == Some(id)
            {
                return (true, "eose".to_string());
            }
        }
    }
}

#[async_trait]
impl Transport for NostrAdapter {
    fn name(&self) -> &str {
        "nostr"
    }

    async fn publish_raw(&self, payload: &[u8]) -> Vec<RelayResult> {
        let text = String::from_utf8_lossy(payload).into_owned();
        let id = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|event| event.get("id").and_then(Value::as_str).map(str::to_string))
            .unwrap_or_default();
        let envelope = serde_json::to_string(&json!([
            "EVENT",
            serde_json::from_str::<Value>(&text).unwrap_or(Value::Null)
        ]))
        .unwrap_or_default();
        let mut results = Vec::new();
        for url in &self.relays {
            // A relay down must never stop the agent: per-relay outcome.
            let (ok, message) = self.send_recv(url, &envelope, "OK", &id).await;
            if !ok {
                let _ = message;
            }
            results.push(RelayResult {
                relay: url.clone(),
                ok,
                message,
            });
        }
        results
    }

    async fn query_raw(&self, kinds: &[u32], since: Option<i64>) -> Vec<Value> {
        use std::collections::BTreeMap;
        let mut by_id: BTreeMap<String, Value> = BTreeMap::new();
        let sub: String = (0..16).map(|_| fastrand_hex()).collect::<Vec<_>>().concat();
        let mut filters = json!({"kinds": kinds});
        if let Some(since) = since {
            filters["since"] = json!(since);
        }
        let request = serde_json::to_string(&json!(["REQ", sub, filters])).unwrap_or_default();
        for url in &self.relays {
            let socket =
                tokio::time::timeout(self.timeout, tokio_tungstenite::connect_async(url)).await;
            let Ok(Ok((mut socket, _))) = socket else {
                continue;
            };
            if socket
                .send(WsMessage::Text(request.clone().into()))
                .await
                .is_err()
            {
                continue;
            }
            let deadline = tokio::time::Instant::now() + self.timeout;
            loop {
                let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                if remaining.is_zero() {
                    break;
                }
                let next = tokio::time::timeout(remaining, socket.next()).await;
                let Ok(Some(Ok(WsMessage::Text(line)))) = next else {
                    continue;
                };
                let Ok(arr) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if arr.get(0).and_then(Value::as_str) == Some("EVENT")
                    && arr
                        .get(1)
                        .and_then(Value::as_str)
                        .map(|s| s == sub)
                        .unwrap_or(false)
                {
                    if let Some(event) = arr.get(2) {
                        if let Some(id) = event.get("id").and_then(Value::as_str) {
                            by_id.entry(id.to_string()).or_insert_with(|| event.clone());
                        }
                    }
                } else if arr.get(0).and_then(Value::as_str) == Some("EOSE") {
                    break;
                }
            }
            let close = serde_json::to_string(&json!(["CLOSE", sub])).unwrap_or_default();
            let _ = socket.send(WsMessage::Text(close.into())).await;
        }
        let mut merged: Vec<Value> = by_id.into_values().collect();
        merged.sort_by_key(|event| event.get("created_at").and_then(Value::as_i64).unwrap_or(0));
        merged
    }
}

/// Placeholder randomness for subscription ids (not key material).
fn fastrand_hex() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.subsec_nanos())
        .unwrap_or(0);
    format!("{:x}", nanos % 16)
}

/// Bus bridge: subscribes to the bus and forwards harness lifecycle
/// events over this adapter. The bus stays primary; the adapter lags
/// and skips like any subscriber.
pub struct NostrBusBridge {
    adapter: NostrAdapter,
}

impl NostrBusBridge {
    pub fn new(adapter: NostrAdapter) -> Self {
        NostrBusBridge { adapter }
    }

    /// Translate one bus event to its Nostr wire form, if it is a
    /// harness lifecycle event. Returns the signed Nostr event JSON.
    pub fn translate(
        secp: &Secp256k1<secp256k1::All>,
        secret: &[u8; 32],
        event: &shared_types::CanonicalEvent,
        created_at: i64,
    ) -> Option<Value> {
        use shared_types::{EventPayload, EventType};
        let shared_types::EventPayload::Agent(agent) = &event.payload else {
            return None;
        };
        let (kind, content, tags) = match event.event_type {
            EventType::AgentStatus => {
                let (content, tags) = agent_status_content(
                    &agent.session_id,
                    agent.task_id.as_deref().unwrap_or("task"),
                    agent.turn.unwrap_or(0),
                    agent.backend.as_deref().unwrap_or(""),
                    agent.state.as_deref().unwrap_or(""),
                );
                (KIND_AGENT_STATUS, content, tags)
            }
            EventType::AgentCheckpoint => {
                let envelope = agent.signature_b64u.as_ref().map(|sig| {
                    json!({"signature_b64u": sig,
                           "transcript_sha256": agent.transcript_sha256,
                           "did": agent.agent_did})
                });
                let (content, tags) = agent_checkpoint_content(
                    &agent.session_id,
                    agent.phase.as_deref().unwrap_or(""),
                    agent.transcript_sha256.as_deref().unwrap_or(""),
                    envelope,
                );
                (KIND_AGENT_CHECKPOINT, content, tags)
            }
            _ => return None,
        };
        build_event(secp, secret, kind, &content, tags, created_at).ok()
    }

    /// Forward loop: bus → Nostr. Returns when the bus closes.
    pub async fn forward_loop(
        self,
        mut rx: tokio::sync::broadcast::Receiver<shared_types::CanonicalEvent>,
        secret: [u8; 32],
        clock: impl Fn() -> i64,
    ) {
        let secp = NostrAdapter::secp();
        loop {
            let event = match rx.recv().await {
                Ok(event) => event,
                Err(_) => return,
            };
            if let Some(nostr) = Self::translate(&secp, &secret, &event, clock()) {
                let bytes = serde_json::to_vec(&nostr).unwrap_or_default();
                self.adapter.publish_raw(&bytes).await;
            }
        }
    }
}

/// Reverse translation: a Nostr lifecycle event back into a bus-native
/// `CanonicalEvent` (inbound leg of the bridge).
pub fn from_nostr_event(event: &Value, agent_did: &str) -> Option<shared_types::CanonicalEvent> {
    use shared_types::{AgentEvent, EventPayload, EventType, SourceChain};
    if !verify_event_id(event) {
        return None;
    }
    let kind = event.get("kind").and_then(Value::as_u64)? as u32;
    let content: Value = serde_json::from_str(event.get("content")?.as_str()?).ok()?;
    let session = content.get("session")?.as_str()?.to_string();
    let (event_type, detail, payload) = match kind {
        KIND_AGENT_STATUS => (
            EventType::AgentStatus,
            content
                .get("state")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            AgentEvent {
                agent_did: agent_did.to_string(),
                session_id: session.clone(),
                task_id: content
                    .get("task_id")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                turn: content.get("turn").and_then(Value::as_u64),
                backend: content
                    .get("backend")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                state: content
                    .get("state")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                phase: None,
                transcript_sha256: None,
                turn_count: None,
                signature_b64u: None,
            },
        ),
        KIND_AGENT_CHECKPOINT => (
            EventType::AgentCheckpoint,
            content
                .get("phase")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            AgentEvent {
                agent_did: agent_did.to_string(),
                session_id: session.clone(),
                task_id: None,
                turn: None,
                backend: None,
                state: None,
                phase: content
                    .get("phase")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                transcript_sha256: content
                    .get("transcript_sha256")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                turn_count: None,
                signature_b64u: content
                    .get("bsigner_envelope")
                    .and_then(|env| env.get("signature_b64u"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
            },
        ),
        _ => return None,
    };
    Some(shared_types::CanonicalEvent {
        event_id: format!("{session}-nostr-{detail}"),
        event_type,
        timestamp: event.get("created_at").and_then(Value::as_i64).unwrap_or(0),
        source_chain: SourceChain::Harness,
        source_ref: format!("harness:{session}:nostr-{detail}"),
        payload: EventPayload::Agent(payload),
        canonicalized_by: "harness-sovereign".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_secret() -> [u8; 32] {
        // Fixed test vector key — never a production secret.
        [7u8; 32]
    }

    #[test]
    fn build_and_verify_roundtrip() {
        let secp = NostrAdapter::secp();
        let (content, tags) =
            agent_status_content("sess-1", "T-001", 3, "spark-primary", "responded");
        let event = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_STATUS,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("build");
        assert!(verify_event_id(&event));
        assert!(verify_event_sig(&secp, &event));
        assert_eq!(event["kind"], json!(KIND_AGENT_STATUS));
    }

    #[test]
    fn tampered_content_fails_id_check() {
        let secp = NostrAdapter::secp();
        let (content, tags) =
            agent_status_content("sess-1", "T-001", 3, "spark-primary", "responded");
        let mut event = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_STATUS,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("build");
        event["content"] = json!("{\"session\":\"sess-1\", \"tampered\": true}");
        // The id no longer matches the content: the event is refused.
        assert!(!verify_event_id(&event));
        // The signature still matches the *claimed* id — which is exactly
        // why verifiers must check the id first, then the signature.
        assert!(verify_event_sig(&secp, &event));
    }

    #[test]
    fn flipped_signature_is_refused() {
        let secp = NostrAdapter::secp();
        let (content, tags) =
            agent_status_content("sess-1", "T-001", 3, "spark-primary", "responded");
        let mut event = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_STATUS,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("build");
        let mut sig = event["sig"].as_str().unwrap().to_string();
        sig.replace_range(0..1, if sig.starts_with('0') { "1" } else { "0" });
        event["sig"] = Value::String(sig);
        assert!(!verify_event_sig(&secp, &event));
    }

    #[test]
    fn checkpoint_shape_carries_envelope_and_tags() {
        let secp = NostrAdapter::secp();
        let (content, tags) = agent_checkpoint_content(
            "sess-9",
            "pre-switch",
            "abc123",
            Some(json!({"did": "did:b:x", "signature_b64u": "sig"})),
        );
        let event = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_CHECKPOINT,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("build");
        assert!(verify_event_id(&event));
        let parsed: Value = serde_json::from_str(event["content"].as_str().unwrap()).unwrap();
        assert_eq!(parsed["bsigner_envelope"]["did"], json!("did:b:x"));
        assert_eq!(
            event["tags"],
            json!([["d", "sess-9"], ["phase", "pre-switch"]])
        );
    }

    #[test]
    fn demo_key_persists_and_never_regenerates() {
        let dir = std::env::temp_dir().join(format!("harness-nostr-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let first = ensure_demo_key(&dir).expect("generate");
        let second = ensure_demo_key(&dir).expect("reload");
        assert_eq!(first, second);
        assert!(dir.join("demo-nsec.hex").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn inbound_translation_maps_both_kinds() {
        let secp = NostrAdapter::secp();
        let (content, tags) = agent_status_content("sess-2", "T-002", 1, "b", "thinking");
        let wire = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_STATUS,
            &content,
            tags,
            1_800_000_000,
        )
        .expect("build");
        let canonical = from_nostr_event(&wire, "did:b:agent").expect("translate");
        assert!(matches!(
            canonical.event_type,
            shared_types::EventType::AgentStatus
        ));
        assert_eq!(canonical.source_ref, "harness:sess-2:nostr-thinking");

        let (content, tags) = agent_checkpoint_content("sess-2", "post-switch", "sha", None);
        let wire = build_event(
            &secp,
            &test_secret(),
            KIND_AGENT_CHECKPOINT,
            &content,
            tags,
            1_800_000_001,
        )
        .expect("build");
        let canonical = from_nostr_event(&wire, "did:b:agent").expect("translate");
        assert!(matches!(
            canonical.event_type,
            shared_types::EventType::AgentCheckpoint
        ));

        let mut other = wire.clone();
        other["kind"] = json!(99999u32);
        assert!(from_nostr_event(&other, "did:b:agent").is_none());
    }
}
