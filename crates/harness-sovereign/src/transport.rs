//! Transport capability (CONSTITUTION Art. III.5).
//!
//! The harness declares what it needs — publish bytes to every relay,
//! query events back with dedupe — and the kernel resolves the
//! technology at runtime. Nostr ([`crate::nostr`]) is one adapter; x0x
//! is another. The harness never names a wire protocol outside an
//! adapter module.

use async_trait::async_trait;
use serde_json::Value;

/// Per-relay outcome, mirroring the Python fanout's `{url: (ok, msg)}`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayResult {
    pub relay: String,
    pub ok: bool,
    pub message: String,
}

/// Cross-machine transport. Implementations fan out to every configured
/// relay; a dead relay is a failed result, never an error — the agent
/// loop must not stop because a pipe broke (§3.5).
#[async_trait]
pub trait Transport: Send + Sync {
    fn name(&self) -> &str;

    /// Publish one payload to all relays. Never fails overall; each
    /// relay reports its own outcome.
    async fn publish_raw(&self, payload: &[u8]) -> Vec<RelayResult>;

    /// Query raw events back (dedupe by id, oldest first).
    async fn query_raw(&self, kinds: &[u32], since: Option<i64>) -> Vec<Value>;
}

/// Merge event lists, dedupe by id, order by `created_at` (Python `query`
/// tail: `sorted(by_id.values(), key=created_at)`).
pub fn dedupe_by_id(events: Vec<Value>) -> Vec<Value> {
    let mut by_id = std::collections::BTreeMap::new();
    for event in events {
        if let Some(id) = event.get("id").and_then(|id| id.as_str()) {
            by_id.entry(id.to_string()).or_insert(event);
        }
    }
    let mut merged: Vec<Value> = by_id.into_values().collect();
    merged.sort_by_key(|event| {
        event
            .get("created_at")
            .and_then(|ts| ts.as_i64())
            .unwrap_or(0)
    });
    merged
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dedupe_keeps_first_and_orders_by_time() {
        let events = vec![
            json!({"id": "b", "created_at": 20}),
            json!({"id": "a", "created_at": 10}),
            json!({"id": "b", "created_at": 20}),
            json!({"no-id": true}),
        ];
        let merged = dedupe_by_id(events);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0]["id"], json!("a"));
        assert_eq!(merged[1]["id"], json!("b"));
    }
}
