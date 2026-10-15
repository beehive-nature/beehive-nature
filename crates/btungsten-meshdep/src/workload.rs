//! The workload engine: every operation class the battery injects, each
//! one a canonical WB001 Intent whose envelope bytes ARE the payload.
//!
//! Delivery observation is recipient-side evidence only: SSE frames on
//! subscribed topics, durable DM ACKs, store reads that return the value,
//! group message listings that contain the id, and observer-side
//! `/identity/revocations` entries for revocations. A "ready" peer is
//! never delivery evidence.
//!
//! Retry law (the WB004 handoff at transport level): the only retry under
//! an UNKNOWN outcome reuses the logical id and the IDENTICAL bytes
//! (rebroadcast-identical-only). A fresh identity under UNKNOWN is
//! executed only as a CONVICTION row — recorded as unsafe, never counted
//! as service.

use crate::client::{b64, NodeClient};
use crate::identity::{envelope_bytes, intent, op_digest, OpClass};
use crate::ledger::{Event, Ledger, OperationRecord, RetryVerdict};
use crate::rig::Rig;

fn record_store_put_result(
    ledger: &mut Ledger,
    op_id: &str,
    result: Result<(u16, String), String>,
) -> Result<(), String> {
    let at_ms = crate::client::now_ms();
    let (status, response, response_truncated, response_digest, error) = match &result {
        Ok((s, body)) => (
            Some(*s),
            Some(body.chars().take(512).collect()),
            body.chars().count() > 512,
            Some(op_digest(body.as_bytes())),
            None,
        ),
        Err(e) => (None, None, false, None, Some(e.clone())),
    };
    ledger.record(Event::StorePutResult {
        op_id: op_id.into(),
        at_ms,
        status,
        response,
        response_truncated,
        response_digest,
        error,
    });
    // The pinned x0x put_kv_value route returns 200 {ok:true} only after
    // publication. 202 persists locally but may still attempt direct delivery.
    // A malformed or contradictory success body is not publication evidence.
    let reason = match &result {
        Ok((200, body))
            if serde_json::from_str::<serde_json::Value>(body)
                .ok()
                .is_some_and(|v| v["ok"] == true && v["published"] != false) =>
        {
            ledger.record(Event::Published {
                op_id: op_id.into(),
                at_ms,
            });
            return Ok(());
        }
        Ok((202, _)) => "HTTP 202: local persistence reported, publication unconfirmed".into(),
        Ok((200, _)) => "HTTP 200: malformed or contradictory acceptance body".into(),
        Ok((s, _)) => {
            format!("HTTP {s}: store API did not acknowledge acceptance; propagation unproven")
        }
        Err(_) => "no complete HTTP response: store acceptance and propagation unknown".into(),
    };
    ledger.record(Event::Unresolved {
        op_id: op_id.into(),
        at_ms,
        reason: reason.clone(),
    });
    if status == Some(202) {
        Ok(())
    } else {
        Err(reason)
    }
}

pub struct WorkloadCtx<'a> {
    pub rig: &'a Rig,
    pub epoch: u64,
    pub deadline_ms: u64,
    seq: u64,
}

impl<'a> WorkloadCtx<'a> {
    pub fn new(rig: &'a Rig, epoch: u64, deadline_ms: u64) -> Self {
        WorkloadCtx {
            rig,
            epoch,
            deadline_ms,
            seq: 0,
        }
    }

    fn next_seed(&mut self, tag: &str) -> String {
        self.seq += 1;
        format!("{}/seq-{}/{}", self.rig.spec.run_id, self.seq, tag)
    }

    fn build_op(
        &mut self,
        class: OpClass,
        destination: &str,
        payload: &[u8],
    ) -> (OperationRecord, Vec<u8>) {
        let seed = self.next_seed(&format!("{class:?}"));
        let expiry_unix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() + 3600)
            .unwrap_or(0);
        let i = intent(
            class,
            destination,
            payload,
            seed.as_bytes(),
            self.epoch,
            expiry_unix,
        );
        let env = envelope_bytes(&i);
        assert!(!env.is_empty(), "workload intent must be valid");
        let op_id = op_digest(&env);
        // The DM logical_id charset is lowercase-only [a-z0-9._:-]; the
        // class Debug spelling has uppercase — use a lowercase slug.
        let logical_id = format!(
            "btmd:{}:{}:{}",
            class.slug(),
            self.rig.spec.run_id,
            self.seq
        );
        (
            OperationRecord {
                op_id: op_id.clone(),
                logical_id,
                class,
                sender: String::new(),
                destination: destination.to_string(),
                intended: Vec::new(),
                payload_bytes: payload.len(),
                envelope_b64: b64::encode(&env),
                published_at_ms: crate::client::now_ms(),
                deadline_ms: crate::client::now_ms() + self.deadline_ms,
            },
            env,
        )
    }

    fn client(&self, label: &str) -> Result<NodeClient, String> {
        self.rig.node(label)?.client()
    }

    /// Subscribe a node to a gossip topic. The subscription set is part of
    /// the profile being measured (unsubscribed topics are always
    /// LazyForward upstream — #674 C2).
    pub fn subscribe(&self, node: &str, topic: &str) -> Result<(), String> {
        let c = self.client(node)?;
        let (s, b) = c.post_json("/subscribe", &format!("{{\"topic\":\"{topic}\"}}"))?;
        if s != 200 {
            return Err(format!("subscribe {node}->{topic} -> {s}: {b}"));
        }
        Ok(())
    }

    /// A class-probe publish: synthetic traffic on a real topic name, from
    /// the daemon's own authenticated identity. The payload is the
    /// canonical envelope; observers identify the op by digest.
    pub fn publish(
        &mut self,
        ledger: &mut Ledger,
        node: &str,
        topic: &str,
        class: OpClass,
        size_hint: usize,
        intended: &[&str],
    ) -> Result<String, String> {
        let payload = vec![b'p'; size_hint];
        let (mut op, env) = self.build_op(class, topic, &payload);
        op.sender = node.to_string();
        op.intended = intended.iter().map(|s| s.to_string()).collect();
        let op_id = op.op_id.clone();
        ledger.record_op(op);
        let c = self.client(node)?;
        let body = serde_json::json!({"topic": topic, "payload": b64::encode(&env)});
        let (s, b) = c.post_json("/publish", &body.to_string())?;
        ledger.record(Event::Published {
            op_id: op_id.clone(),
            at_ms: crate::client::now_ms(),
        });
        if s != 200 {
            return Err(format!("publish {node}->{topic} -> {s}: {b}"));
        }
        Ok(op_id)
    }

    /// A targeted DM with durable-ACK semantics. Terminal evidence per the
    /// upstream contract: 200 = recipient durably committed + dispatched;
    /// 504 = "may or may not have arrived" (UNKNOWN, preserved); 409
    /// idempotency_conflict on a retry = reconciliation evidence that the
    /// original landed.
    pub fn dm(
        &mut self,
        ledger: &mut Ledger,
        from: &str,
        to_agent: &str,
        to_label: &str,
        size_hint: usize,
    ) -> Result<String, String> {
        let payload = vec![b'd'; size_hint];
        let (mut op, env) = self.build_op(OpClass::TargetedDm, to_label, &payload);
        op.sender = from.to_string();
        op.intended = vec![to_label.to_string()];
        let op_id = op.op_id.clone();
        let logical = op.logical_id.clone();
        ledger.record_op(op);
        let c = self.client(from)?;
        let body = serde_json::json!({
            "agent_id": to_agent,
            "payload": b64::encode(&env),
            "logical_id": logical,
        });
        let (s, b) = c.post_json("/direct/send", &body.to_string())?;
        match s {
            200 => {
                ledger.record(Event::Acked {
                    op_id: op_id.clone(),
                    node: to_label.to_string(),
                    at_ms: crate::client::now_ms(),
                });
            }
            504 => {
                ledger.record(Event::Unresolved {
                    op_id: op_id.clone(),
                    at_ms: crate::client::now_ms(),
                    reason: format!("dm 504 timeout: may or may not have arrived — {b}"),
                });
            }
            409 if b.contains("idempotency_conflict") => {
                ledger.record(Event::Acked {
                    op_id: op_id.clone(),
                    node: to_label.to_string(),
                    at_ms: crate::client::now_ms(),
                });
            }
            other => {
                ledger.record(Event::Unresolved {
                    op_id: op_id.clone(),
                    at_ms: crate::client::now_ms(),
                    reason: format!("dm refusal {other}: {b}"),
                });
                return Err(format!("dm {from}->{to_label} refused {other}: {b}"));
            }
        }
        Ok(op_id)
    }

    /// The SAFE retry: same logical id, byte-identical envelope — the only
    /// retry shape permitted under UNKNOWN.
    pub fn dm_retry_identical(
        &mut self,
        ledger: &mut Ledger,
        from: &str,
        to_agent: &str,
        to_label: &str,
        original_op: &str,
    ) -> Result<String, String> {
        let Some(orig) = ledger.ops.iter().find(|o| o.op_id == original_op) else {
            return Err("original op unknown".into());
        };
        let logical = orig.logical_id.clone();
        let env = b64::decode(&orig.envelope_b64)
            .map_err(|e| format!("original op envelope undecodable: {e}"))?;
        ledger.record_retry(RetryVerdict {
            original_op: original_op.to_string(),
            retry_op: original_op.to_string(),
            logical_id_reused: true,
            unsafe_fresh_identity: false,
        });
        let c = self.client(from)?;
        let body = serde_json::json!({
            "agent_id": to_agent,
            "payload": b64::encode(&env),
            "logical_id": logical,
        });
        let (s, b) = c.post_json("/direct/send", &body.to_string())?;
        if s == 200 || (s == 409 && b.contains("idempotency_conflict")) {
            ledger.record(Event::Acked {
                op_id: original_op.to_string(),
                node: to_label.to_string(),
                at_ms: crate::client::now_ms(),
            });
        } else if s == 504 {
            ledger.record(Event::Unresolved {
                op_id: original_op.to_string(),
                at_ms: crate::client::now_ms(),
                reason: format!("identical retry still 504: {b}"),
            });
        } else {
            return Err(format!("identical retry {from}->{to_label} -> {s}: {b}"));
        }
        Ok(original_op.to_string())
    }

    /// The UNSAFE retry, executed only to CONVICT it in the receipt (the
    /// WB004 defect shape): fresh logical id, same logical step. Counted,
    /// never accepted as service.
    pub fn dm_retry_fresh_identity_conviction(
        &mut self,
        ledger: &mut Ledger,
        from: &str,
        to_agent: &str,
        to_label: &str,
        original_op: &str,
    ) -> Result<String, String> {
        if !ledger.ops.iter().any(|o| o.op_id == original_op) {
            return Err("original op unknown".into());
        }
        let payload = vec![b'd'; 64];
        let (mut op, env) = self.build_op(OpClass::TargetedDm, to_label, &payload);
        op.sender = from.to_string();
        op.intended = vec![to_label.to_string()];
        let new_id = op.op_id.clone();
        ledger.record_op(op);
        ledger.record_retry(RetryVerdict {
            original_op: original_op.to_string(),
            retry_op: new_id.clone(),
            logical_id_reused: false,
            unsafe_fresh_identity: true,
        });
        let c = self.client(from)?;
        let body = serde_json::json!({"agent_id": to_agent, "payload": b64::encode(&env)});
        let _ = c.post_json("/direct/send", &body.to_string())?;
        Ok(new_id)
    }

    /// Create a KV store at `node` (state-sync class). Returns the HEX
    /// `store_id` — the URL-safe id for join/put/get paths (`id` is the
    /// topic string, which carries slashes and cannot ride a path).
    pub fn store_create(&mut self, node: &str, name: &str, topic: &str) -> Result<String, String> {
        let c = self.client(node)?;
        let body = serde_json::json!({"name": name, "topic": topic, "policy": "signed"});
        let (s, b) = c.post_json("/stores", &body.to_string())?;
        if s != 200 && s != 201 {
            return Err(format!("store create {node} -> {s}: {b}"));
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        v.get("store_id")
            .or_else(|| v.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| format!("store create: no id in {b}"))
    }

    /// URL-encode a store id for a path segment: store ids are topic
    /// strings carrying `/` — they must ride percent-encoded or the
    /// router never sees the join route (convicted live).
    fn store_seg(store_id: &str) -> String {
        store_id.replace('/', "%2F")
    }

    /// Join an existing store at `node` (owner-anchored).
    pub fn store_join(&self, node: &str, store_id: &str, owner_hex: &str) -> Result<(), String> {
        let c = self.client(node)?;
        let body = serde_json::json!({"expected_owner": owner_hex});
        let (s, b) = c.post_json(
            &format!("/stores/{}/join", Self::store_seg(store_id)),
            &body.to_string(),
        )?;
        if s != 200 && s != 201 {
            return Err(format!("store join {node} -> {s}: {b}"));
        }
        Ok(())
    }

    /// A state-sync put. 200 published:true = announced; 202
    /// published:false = LOCAL-ONLY (UNKNOWN propagation: "the delta is
    /// NOT queued anywhere" — re-put identical is the safe retry).
    pub fn store_put(
        &mut self,
        ledger: &mut Ledger,
        node: &str,
        store_id: &str,
        key: &str,
        value: &[u8],
        intended: &[&str],
    ) -> Result<String, String> {
        let (mut op, env) = self.build_op(OpClass::StateSync, &format!("store:{key}"), value);
        op.sender = node.to_string();
        op.intended = intended.iter().map(|s| s.to_string()).collect();
        let op_id = op.op_id.clone();
        ledger.record_op(op);
        let body = serde_json::json!({"value": b64::encode(&env), "content_type": "application/octet-stream"});
        let result = self.client(node).and_then(|c| {
            c.put_json(
                &format!("/stores/{}/{}", Self::store_seg(store_id), key),
                &body.to_string(),
            )
        });
        record_store_put_result(ledger, &op_id, result)?;
        Ok(op_id)
    }

    pub fn store_observe_recorded(
        &self,
        ledger: &mut Ledger,
        node: &str,
        store_id: &str,
        key: &str,
        op_id: &str,
    ) -> bool {
        let result = self
            .client(node)
            .and_then(|c| c.get(&format!("/stores/{}/{}", Self::store_seg(store_id), key)));
        let (status, matches, error) = match result {
            Ok((s, b)) => {
                let parsed = if s == 200 {
                    serde_json::from_str::<serde_json::Value>(&b)
                        .map_err(|e| e.to_string())
                        .and_then(|v| {
                            v.get("value")
                                .and_then(|v| v.as_str())
                                .ok_or_else(|| "missing value".to_string())
                                .and_then(b64::decode)
                        })
                        .map(|bytes| op_digest(&bytes) == op_id)
                } else {
                    Ok(false)
                };
                (
                    Some(s),
                    parsed.as_ref().copied().unwrap_or(false),
                    parsed.err(),
                )
            }
            Err(e) => (None, false, Some(e)),
        };
        ledger.record(Event::StoreReadResult {
            op_id: op_id.into(),
            node: node.into(),
            at_ms: crate::client::now_ms(),
            status,
            matches,
            error,
        });
        matches
    }

    /// Observe a store value at a node: DELIVERED evidence when the exact
    /// envelope bytes are readable there.
    pub fn store_observe(
        &self,
        node: &str,
        store_id: &str,
        key: &str,
        op_id: &str,
    ) -> Result<bool, String> {
        let c = self.client(node)?;
        let (s, b) = c.get(&format!("/stores/{}/{}", Self::store_seg(store_id), key))?;
        if s != 200 {
            return Ok(false);
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        let got = v.get("value").and_then(|x| x.as_str()).unwrap_or("");
        let bytes = b64::decode(got).unwrap_or_default();
        Ok(op_digest(&bytes) == op_id)
    }

    /// Create a named group at `node`. `public_open` preset = SignedPublic
    /// (Phase-E public messaging carries on it; the default
    /// `private_secure` creates an MLS-encrypted group instead).
    pub fn group_create(&mut self, node: &str, name: &str) -> Result<String, String> {
        let c = self.client(node)?;
        let (s, b) = c.post_json(
            "/groups",
            &format!("{{\"name\":\"{name}\",\"preset\":\"public_open\"}}"),
        )?;
        if s != 200 && s != 201 {
            return Err(format!("group create -> {s}: {b}"));
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        v.get("group_id")
            .or_else(|| v.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| format!("group create: no id in {b}"))
    }

    /// Mint a signed invite for `node` (an admin of the group).
    pub fn group_invite(&self, node: &str, group_id: &str) -> Result<String, String> {
        let c = self.client(node)?;
        let body = serde_json::json!({"expiry_secs": 900});
        let (s, b) = c.post_json(&format!("/groups/{group_id}/invite"), &body.to_string())?;
        if s != 200 && s != 201 {
            return Err(format!("group invite -> {s}: {b}"));
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        v.get("invite")
            .or_else(|| v.get("invite_link"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| format!("group invite: no invite in {b}"))
    }

    /// Join a group via invite at `node`.
    pub fn group_join(&self, node: &str, invite: &str) -> Result<(), String> {
        let c = self.client(node)?;
        let body = serde_json::json!({"invite": invite, "display_name": node});
        let (s, b) = c.post_json("/groups/join", &body.to_string())?;
        if s != 200 {
            return Err(format!("group join {node} -> {s}: {b}"));
        }
        Ok(())
    }

    /// A Phase-E public-group message. Returns the message id.
    pub fn group_send(
        &mut self,
        ledger: &mut Ledger,
        node: &str,
        group_id: &str,
        intended: &[&str],
    ) -> Result<(String, String), String> {
        let payload = vec![b'g'; 96];
        let (mut op, env) = self.build_op(OpClass::GroupOp, &format!("group:{group_id}"), &payload);
        op.sender = node.to_string();
        op.intended = intended.iter().map(|s| s.to_string()).collect();
        let op_id = op.op_id.clone();
        ledger.record_op(op);
        let c = self.client(node)?;
        let body = serde_json::json!({"body": b64::encode(&env), "kind": "chat"});
        let (s, b) = c.post_json(&format!("/groups/{group_id}/send"), &body.to_string())?;
        ledger.record(Event::Published {
            op_id: op_id.clone(),
            at_ms: crate::client::now_ms(),
        });
        if s != 200 && s != 201 {
            return Err(format!("group send -> {s}: {b}"));
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        let msg_id = v
            .get("message_id")
            .or_else(|| v.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();
        Ok((op_id, msg_id))
    }

    /// Observe a group message at a node (DELIVERED evidence).
    pub fn group_observe(&self, node: &str, group_id: &str, op_id: &str) -> Result<bool, String> {
        let c = self.client(node)?;
        let (s, b) = c.get(&format!("/groups/{group_id}/messages"))?;
        if s != 200 {
            return Ok(false);
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        let Some(list) = v
            .as_array()
            .or_else(|| v.get("messages").and_then(|m| m.as_array()))
        else {
            return Ok(false);
        };
        for m in list {
            let body_b64 = m
                .get("body")
                .or_else(|| m.get("payload"))
                .and_then(|x| x.as_str())
                .unwrap_or("");
            if let Ok(bytes) = b64::decode(body_b64) {
                if op_digest(&bytes) == op_id {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }

    /// A revocation: the sacrificial node self-revokes its AGENT identity
    /// (self-revocation is always allowed; a self MACHINE-key revocation
    /// is refused 403 — convicted live). The node's identity is spent by
    /// this drill; that is what makes it sacrificial. Observer evidence =
    /// the revocation appears in the observer's `/identity/revocations`.
    pub fn revoke_agent(
        &mut self,
        ledger: &mut Ledger,
        node: &str,
        agent_id: &str,
        intended: &[&str],
    ) -> Result<String, String> {
        let payload = agent_id.as_bytes().to_vec();
        let (mut op, env) = self.build_op(OpClass::Revocation, node, &payload);
        op.sender = node.to_string();
        op.intended = intended.iter().map(|s| s.to_string()).collect();
        let op_id = op.op_id.clone();
        ledger.record_op(op);
        let c = self.client(node)?;
        let body = serde_json::json!({"agent_id": agent_id, "reason": "btmd rig revocation drill"});
        let (s, b) = c.post_json("/identity/revoke", &body.to_string())?;
        ledger.record(Event::Published {
            op_id: op_id.clone(),
            at_ms: crate::client::now_ms(),
        });
        if s != 200 && s != 201 {
            return Err(format!("identity revoke -> {s}: {b}"));
        }
        Ok(op_id)
    }

    /// Observer-side revocation visibility (matched by the revoked id).
    pub fn revocation_observe(&self, node: &str, revoked_id: &str) -> Result<bool, String> {
        let c = self.client(node)?;
        let v = c.get_json("/identity/revocations")?;
        let s = v.to_string();
        Ok(s.contains(revoked_id))
    }

    /// A discovery browse (the workload, not just a health check).
    pub fn discovery_browse(
        &mut self,
        ledger: &mut Ledger,
        node: &str,
        intended: &[&str],
    ) -> Result<String, String> {
        let payload = vec![b'x'; 16];
        let (mut op, _env) = self.build_op(OpClass::Discovery, node, &payload);
        op.sender = node.to_string();
        op.intended = intended.iter().map(|s| s.to_string()).collect();
        let op_id = op.op_id.clone();
        ledger.record_op(op);
        let c = self.client(node)?;
        let (s, b) = c.get("/agents/discovered")?;
        ledger.record(Event::Published {
            op_id: op_id.clone(),
            at_ms: crate::client::now_ms(),
        });
        if s != 200 {
            return Err(format!("discovery browse -> {s}"));
        }
        let v: serde_json::Value = serde_json::from_str(&b).map_err(|e| e.to_string())?;
        let n = v.as_array().map(|a| a.len()).unwrap_or(0);
        // The browse op's "delivery" is the response itself.
        ledger.record(Event::Delivered {
            op_id: op_id.clone(),
            node: node.to_string(),
            at_ms: crate::client::now_ms(),
        });
        let _ = n;
        Ok(op_id)
    }

    /// The node's agent id (64-hex) — held in memory only; never emitted
    /// into sanitized receipts.
    pub fn agent_id(&self, node: &str) -> Result<String, String> {
        let v = self.client(node)?.get_json("/agent")?;
        v.get("agent_id")
            .or_else(|| v.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "no agent_id in /agent".to_string())
    }

    pub fn machine_id(&self, node: &str) -> Result<String, String> {
        let v = self.client(node)?.get_json("/agent")?;
        v.get("machine_id")
            .and_then(|i| i.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "no machine_id in /agent".to_string())
    }
}

#[cfg(test)]
mod store_result_tests {
    use super::*;
    use crate::ledger::RecipientVerdict;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn http_put_receipts_distinguish_acceptance_refusal_and_no_response() {
        for (status, body, published) in [
            (200, r#"{"ok":true,"evicted_keys":[]}"#, true),
            (
                202,
                r#"{"ok":true,"published":false,"direct_attempted":2}"#,
                false,
            ),
            (403, r#"{"ok":false,"error":"unauthorized"}"#, false),
            (500, r#"{"ok":false,"error":"persistence failed"}"#, false),
            (200, r#"{"ok":true,"published":false}"#, false),
            (200, "bad json", false),
            (0, "", false),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = Vec::new();
                let mut byte = [0];
                while !request.ends_with(b"\r\n\r\n") {
                    stream.read_exact(&mut byte).unwrap();
                    request.push(byte[0]);
                }
                let mut payload = [0; 2];
                stream.read_exact(&mut payload).unwrap();
                assert!(request.starts_with(b"PUT /stores/test/key HTTP/1.1"));
                if status != 0 {
                    write!(stream, "HTTP/1.1 {status} Result\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
                }
            });
            let mut ledger = Ledger::default();
            ledger.record_op(OperationRecord {
                op_id: "op".into(),
                logical_id: "key".into(),
                class: OpClass::StateSync,
                sender: "seed".into(),
                destination: "store:key".into(),
                intended: vec!["n1".into()],
                payload_bytes: 2,
                envelope_b64: String::new(),
                published_at_ms: 0,
                deadline_ms: u64::MAX,
            });
            let result = NodeClient::new(&addr.to_string(), "").put_json("/stores/test/key", "{}");
            let _ = record_store_put_result(&mut ledger, "op", result);
            server.join().unwrap();
            assert!(
                matches!(&ledger.events[0], Event::StorePutResult { status: s, .. }
                if *s == if status == 0 { None } else { Some(status) })
            );
            assert_eq!(
                ledger
                    .events
                    .iter()
                    .any(|e| matches!(e, Event::Published { .. })),
                published
            );
            assert_eq!(
                matches!(
                    ledger.classify_for("op", "n1"),
                    RecipientVerdict::Unknown { .. }
                ),
                !published
            );
            // A 202/direct fallback or even a lost response may still deliver.
            ledger.record(Event::Delivered {
                op_id: "op".into(),
                node: "n1".into(),
                at_ms: 1,
            });
            assert!(matches!(
                ledger.classify_for("op", "n1"),
                RecipientVerdict::Delivered { .. }
            ));
            let encoded = serde_json::to_string(&ledger.events).unwrap();
            let restored =
                Ledger::from_journal(ledger.ops.clone(), serde_json::from_str(&encoded).unwrap());
            assert_eq!(
                restored.classify_for("op", "n1"),
                ledger.classify_for("op", "n1")
            );
        }
    }

    #[test]
    fn response_excerpt_is_unicode_safe_and_marks_truncation() {
        let body = "é".repeat(600);
        let mut ledger = Ledger::default();
        assert!(record_store_put_result(&mut ledger, "op", Ok((403, body.clone()))).is_err());
        match &ledger.events[0] {
            Event::StorePutResult {
                response: Some(s),
                response_truncated,
                response_digest: Some(d),
                ..
            } => {
                assert_eq!(s.chars().count(), 512);
                assert!(*response_truncated);
                assert_eq!(*d, op_digest(body.as_bytes()));
            }
            _ => panic!("missing response receipt"),
        }
    }
}
