//! The kind-2315 response reader door — Nostr subscription semantics,
//! NO REST shortcut. Two layers:
//!
//! 1. A PURE correlation engine (`process_message`) deciding, for each
//!    relay message, whether it is OUR response — enforcing: duplicate
//!    events deduped by id; STALE events (created_at before our
//!    request) ignored; wrong-`p`-tag events ignored (not addressed to
//!    us); payloads that fail NIP-44 MAC treated as "not ours"
//!    (ignorable, never a crash); request correlation via the NIP-47
//!    envelope's `result_type` ("<method>_response" or
//!    "error_response").
//! 2. A read loop over any [`WsSocket`] with a bounded reconnect
//!    policy (relay disconnect → reconnect → re-REQ → keep reading;
//!    exhausted budget → TransportAmbiguous, payment state untouched).
//!
//! Everything here is DEFAULT-build (network-free): the adversarial
//! suite drives [`MockWsSocket`] sequences; the live tungstenite
//! socket lives behind the `live-nwc` feature.

use std::collections::HashSet;

use crate::nwc::NwcError;
use crate::nwc_crypto::nip44_decrypt;

/// Transport-agnostic WebSocket text-frame stream (send/recv/close).
pub trait WsSocket {
    fn send_text(&mut self, text: &str) -> Result<(), WsError>;
    /// Ok(None) = orderly close (relay hung up).
    fn recv_text(&mut self) -> Result<Option<String>, WsError>;
}

/// LT-1: relay ACK truth — a structural parse of the ["OK", id, bool, msg"]
/// frame. Rejected ≠ ambiguous: an OK-false means the event NEVER entered
/// the network (a typed pre-ledger refusal), while OK-true-then-close is
/// genuinely in-flight (TransportAmbiguous through the read loop).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AckVerdict {
    Accepted,
    /// OK for a different event id (a concurrent request's ack).
    NotOurs,
    /// The relay REFUSED our event — typed, the reason surfaced.
    Rejected(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AckError {
    pub reason: String,
}

impl std::fmt::Display for AckError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "unknown frame: {}", self.reason)
    }
}

/// LT-1: STRUCTURAL frame parse — never substrings.
pub fn process_ack_frame(frame: &str, our_event_id: &str) -> Result<AckVerdict, AckError> {
    let v: serde_json::Value = serde_json::from_str(frame).map_err(|e| AckError {
        reason: format!("not JSON: {e}"),
    })?;
    let arr = v.as_array().ok_or_else(|| AckError {
        reason: "not an array frame".into(),
    })?;
    match arr.first().and_then(|t| t.as_str()) {
        Some("OK") => {
            let id = arr.get(1).and_then(|i| i.as_str()).unwrap_or("");
            if id != our_event_id {
                return Ok(AckVerdict::NotOurs);
            }
            match arr.get(2).and_then(|b| b.as_bool()) {
                Some(true) => Ok(AckVerdict::Accepted),
                Some(false) => {
                    let msg = arr
                        .get(3)
                        .and_then(|m| m.as_str())
                        .unwrap_or("no reason given");
                    Ok(AckVerdict::Rejected(msg.to_string()))
                }
                None => Err(AckError {
                    reason: "OK frame with non-bool third element".into(),
                }),
            }
        }
        Some("EVENT") | Some("EOSE") | Some("NOTICE") | Some("CLOSED") => Ok(AckVerdict::NotOurs),
        _ => Err(AckError {
            reason: format!(
                "unknown frame type: {}",
                arr.first().and_then(|t| t.as_str()).unwrap_or("?")
            ),
        }),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WsError {
    /// Connection lost mid-operation — the reconnect policy's trigger.
    Disconnected(String),
    /// Unrecoverable (TLS, DNS, protocol) — surfaced as ambiguous.
    Fatal(String),
}

/// What the correlation engine concluded about one relay message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    /// Not an EVENT / notice / EOSE — keep reading.
    Ignored(&'static str),
    /// EVENT that is not ours (wrong kind, wrong p tag, stale,
    /// duplicate id, MAC failure) — keep reading, counted by class.
    NotOurs(&'static str),
    /// OUR response, decrypted and envelope-parsed.
    Response(serde_json::Value),
}

/// Everything the engine needs to decide ownership of a message.
pub struct RequestCtx {
    pub client_pubkey_hex: String,
    pub wallet_pubkey_hex: String,
    pub client_secret: [u8; 32],
    /// Requests are only answered by events created after this.
    pub since_unix: u64,
    /// LT-6.3: DECLARED clock-skew tolerance (seconds). Responses whose
    /// `created_at` exceeds `since_unix + max_future_skew_secs` are
    /// from a misaligned clock — typed as clock-skew, never silently
    /// accepted. The bound is per-deployment policy, not guessed.
    pub max_future_skew_secs: u64,
    /// LT-8: the request-dispatch time, INJECTED (not system-clocked).
    /// Freshness checks use this; the live transport supplies the
    /// wall clock at its edge, tests supply deterministic time.
    pub now_unix: u64,
    /// The NIP-47 method we called (correlation via result_type).
    pub method: String,
}

/// Default skew tolerance (300s = 5 minutes; NIP-47's own request
/// expiration is 60s, so 5 min covers relay/network latency generously).
pub const DEFAULT_MAX_SKEW_SECS: u64 = 300;

/// Process one relay message against the request context.
/// `seen` dedupes event ids (duplicate responses collapse).
pub fn process_message(ctx: &RequestCtx, msg: &str, seen: &mut HashSet<String>) -> Verdict {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(msg) else {
        return Verdict::Ignored("unparseable");
    };
    let Some(arr) = v.as_array() else {
        return Verdict::Ignored("not an array");
    };
    match arr.first().and_then(|t| t.as_str()) {
        Some("EVENT") => {
            let Some(ev) = arr.get(2) else {
                return Verdict::Ignored("EVENT without body");
            };
            // kind must be 23195
            if ev.get("kind").and_then(|k| k.as_u64()) != Some(23195) {
                return Verdict::NotOurs("wrong kind");
            }
            // p-tag must address the client
            let tagged_to_us = ev
                .get("tags")
                .and_then(|t| t.as_array())
                .map(|tags| {
                    tags.iter().any(|t| {
                        t.as_array().map(|t| {
                            t.first().and_then(|k| k.as_str()) == Some("p")
                                && t.get(1).and_then(|p| p.as_str()) == Some(&ctx.client_pubkey_hex)
                        }) == Some(true)
                    })
                })
                .unwrap_or(false);
            if !tagged_to_us {
                return Verdict::NotOurs("wrong p tag");
            }
            // freshness: stale responses predate our request
            let created = ev.get("created_at").and_then(|c| c.as_u64()).unwrap_or(0);
            if created < ctx.since_unix {
                return Verdict::NotOurs("stale");
            }
            // LT-6.3: clock-skew — a response dated BEYOND our
            // tolerance into the future is from a misaligned clock;
            // typed, never silently accepted at arbitrary skew.
            if created > ctx.now_unix.saturating_add(ctx.max_future_skew_secs) {
                return Verdict::NotOurs("clock skew (future-dated beyond tolerance)");
            }
            // duplicates collapse by event id
            let id = ev
                .get("id")
                .and_then(|i| i.as_str())
                .unwrap_or_default()
                .to_string();
            if !seen.insert(id) {
                return Verdict::NotOurs("duplicate");
            }
            // LT-4.1: sender authentication — the event pubkey must be the wallet
            let sender = ev
                .get("pubkey")
                .and_then(|p| p.as_str())
                .unwrap_or_default();
            if sender != ctx.wallet_pubkey_hex {
                return Verdict::NotOurs("wrong sender pubkey");
            }
            // LT-4.2: schnorr signature verification over the event id
            {
                let sig_hex = ev.get("sig").and_then(|s| s.as_str()).unwrap_or_default();
                let sig_bytes = match hex::decode(sig_hex) {
                    Ok(b) if b.len() == 64 => b,
                    _ => return Verdict::NotOurs("bad signature (malformed)"),
                };
                let sig = match <k256::schnorr::Signature as TryFrom<&[u8]>>::try_from(
                    sig_bytes.as_slice(),
                ) {
                    Ok(s) => s,
                    Err(_) => return Verdict::NotOurs("bad signature (parse)"),
                };
                let id_hex = ev.get("id").and_then(|i| i.as_str()).unwrap_or_default();
                let id_bytes = match hex::decode(id_hex) {
                    Ok(b) if b.len() == 32 => b,
                    _ => return Verdict::NotOurs("bad signature (event id malformed)"),
                };
                let sender_bytes = match hex::decode(&ctx.wallet_pubkey_hex) {
                    Ok(b) if b.len() == 32 => b,
                    _ => return Verdict::NotOurs("bad signature (sender malformed)"),
                };
                let vk = match k256::schnorr::VerifyingKey::from_bytes(&sender_bytes) {
                    Ok(v) => v,
                    Err(_) => return Verdict::NotOurs("bad signature (sender key)"),
                };
                let id_arr: [u8; 32] = id_bytes.try_into().expect("len checked");
                if vk.verify_raw(&id_arr, &sig).is_err() {
                    return Verdict::NotOurs("bad signature (verify failed)");
                }
            }
            // ownership: NIP-44 MAC must verify against OUR key
            let content = ev
                .get("content")
                .and_then(|c| c.as_str())
                .unwrap_or_default();
            let plain = match nip44_decrypt(&ctx.client_secret, &ctx.wallet_pubkey_hex, content) {
                Ok(p) => p,
                Err(_) => return Verdict::NotOurs("mac failure (not addressed to us)"),
            };
            let Ok(envelope) = serde_json::from_str::<serde_json::Value>(&plain) else {
                return Verdict::NotOurs("undecryptable envelope");
            };
            // request correlation: result_type must answer OUR method
            let rt = envelope
                .get("result_type")
                .and_then(|r| r.as_str())
                .unwrap_or_default();
            let expected = format!("{}_response", ctx.method);
            if rt != expected && rt != "error_response" {
                return Verdict::NotOurs("wrong correlation (other request's response)");
            }
            Verdict::Response(envelope)
        }
        Some("EOSE") | Some("NOTICE") | Some("OK") => Verdict::Ignored("relay control"),
        _ => Verdict::Ignored("unknown message type"),
    }
}

/// Bounded reconnect policy for the read loop.
#[derive(Debug, Clone)]
pub struct ReadPolicy {
    pub max_messages: usize,
    pub reconnect_attempts: usize,
}

impl Default for ReadPolicy {
    fn default() -> Self {
        ReadPolicy {
            max_messages: 200,
            reconnect_attempts: 2,
        }
    }
}

/// The read loop: subscribe (REQ) over the socket, process messages
/// with the correlation engine until OUR response arrives; on
/// disconnect, reconnect via `reopen` (which must re-establish the
/// socket AND re-send the REQ — `req_frame` is provided for that) up
/// to the policy budget. Budget exhausted → TransportAmbiguous.
pub fn read_response<S, F>(
    socket: &mut S,
    reopen: F,
    req_frame: &str,
    policy: &ReadPolicy,
    ctx: &RequestCtx,
) -> Result<serde_json::Value, NwcError>
where
    S: WsSocket,
    F: Fn(usize) -> Result<S, WsError>,
{
    fn recover<S2: WsSocket, F2: Fn(usize) -> Result<S2, WsError>>(
        socket: &mut S2,
        reopen: &F2,
        req_frame: &str,
        policy: &ReadPolicy,
        reconnects: &mut usize,
        why: &str,
    ) -> Result<(), NwcError> {
        if *reconnects >= policy.reconnect_attempts {
            return Err(NwcError::TransportAmbiguous(format!(
                "relay lost ({why}) and reconnect budget ({}) exhausted",
                policy.reconnect_attempts
            )));
        }
        *reconnects += 1;
        let mut next = reopen(*reconnects)
            .map_err(|e| NwcError::TransportAmbiguous(format!("reconnect failed: {e:?}")))?;
        next.send_text(req_frame)
            .map_err(|e| NwcError::TransportAmbiguous(format!("re-REQ failed: {e:?}")))?;
        *socket = next;
        Ok(())
    }
    let mut seen = HashSet::new();
    let mut processed = 0usize;
    let mut reconnects = 0usize;
    loop {
        match socket.recv_text() {
            Ok(Some(msg)) => {
                processed += 1;
                if processed > policy.max_messages {
                    return Err(NwcError::TransportAmbiguous(
                        "response window exhausted before our answer arrived (no state touched)"
                            .into(),
                    ));
                }
                match process_message(ctx, &msg, &mut seen) {
                    Verdict::Response(env) => return Ok(env),
                    Verdict::NotOurs(_) | Verdict::Ignored(_) => continue,
                }
            }
            Ok(None) => {
                let why = "relay closed".to_string();
                recover(socket, &reopen, req_frame, policy, &mut reconnects, &why)?;
            }
            Err(WsError::Disconnected(why)) => {
                recover(socket, &reopen, req_frame, policy, &mut reconnects, &why)?;
            }
            Err(WsError::Fatal(why)) => {
                return Err(NwcError::TransportAmbiguous(format!(
                    "fatal ws error: {why}"
                )));
            }
        }
    }
}
