//! R14 adversarial suite — the reader door under attack, offline.
//!
//! Every sequence drives the PURE correlation engine and the
//! reconnect-policy read loop through a scripted [`MockWsSocket`]:
//! reconnect, duplicate response, stale response, wrong `p` tag,
//! wrong request correlation, relay disconnect/recovery — plus the
//! budget-exhaustion law (TransportAmbiguous, never a false Failed).

use bpay_rail::nwc::NwcError;
use bpay_rail::nwc_crypto::{nip44_decrypt, nip44_encrypt};
use bpay_rail::nwc_reader::{
    process_message, read_response, ReadPolicy, RequestCtx, Verdict, WsError, WsSocket,
};
use std::collections::HashSet;

// A fixed client keypair for deterministic envelopes.
fn ctx_parts() -> ([u8; 32], String, String) {
    let sk = [7u8; 32];
    let signing = k256::schnorr::SigningKey::from_bytes(&sk).expect("any");
    let client_pub = hex::encode(signing.verifying_key().to_bytes());
    let wallet = [9u8; 32];
    let wallet_signing = k256::schnorr::SigningKey::from_bytes(&wallet).expect("any");
    let wallet_pub = hex::encode(wallet_signing.verifying_key().to_bytes());
    (sk, client_pub, wallet_pub)
}

fn make_ctx() -> RequestCtx {
    let (sk, client_pub, wallet_pub) = ctx_parts();
    RequestCtx {
        client_pubkey_hex: client_pub,
        wallet_pubkey_hex: wallet_pub,
        client_secret: sk,
        since_unix: 1_000,
        method: "get_info".into(),
    }
}

/// Build a kind-23195 EVENT frame addressed (or misaddressed) at will.
fn response_frame(
    ctx: &RequestCtx,
    id: &str,
    created_at: u64,
    p_tag: Option<&str>, // None = use the right p tag
    method_answered: &str,
) -> String {
    let (sk, _client, wallet_pub) = ctx_parts();
    // NIP-44 conversation is symmetric: encrypt with the CLIENT secret
    // against the WALLET pubkey — decryptable by the client side.
    let envelope = serde_json::json!({
        "result_type": format!("{method_answered}_response"),
        "result": { "alias": "hub" },
    });
    let content = nip44_encrypt(&sk, &wallet_pub, &envelope.to_string()).unwrap();
    let p = p_tag
        .map(|s| s.to_string())
        .unwrap_or(ctx.client_pubkey_hex.clone());
    serde_json::json!([
        "EVENT", "sub",
        {
            "id": id,
            "pubkey": ctx.wallet_pubkey_hex,
            "created_at": created_at,
            "kind": 23195,
            "tags": [["p", p]],
            "content": content,
            "sig": "00"
        }
    ])
    .to_string()
}

/// Scripted socket: feeds messages; can drop/reject on cue.
struct MockWsSocket {
    script: Vec<Step>,
    pos: usize,
}

#[derive(Clone)]
#[allow(dead_code)]
enum Step {
    Msg(String),
    Drop,  // simulate a mid-stream disconnect
    Close, // orderly close
}

fn response_frame_default() -> String {
    let ctx = make_ctx();
    response_frame(&ctx, "the-answer", 1_001, None, "get_info")
}

impl WsSocket for MockWsSocket {
    fn send_text(&mut self, _t: &str) -> Result<(), WsError> {
        Ok(())
    }
    fn recv_text(&mut self) -> Result<Option<String>, WsError> {
        if self.pos >= self.script.len() {
            return Ok(None); // idle close after script
        }
        match self.script[self.pos].clone() {
            Step::Msg(m) => {
                self.pos += 1;
                Ok(Some(m))
            }
            Step::Drop => {
                self.pos += 1;
                Err(WsError::Disconnected("scripted drop".into()))
            }
            Step::Close => {
                self.pos += 1;
                Ok(None)
            }
        }
    }
}

fn verdicts_for(messages: &[String]) -> Vec<Verdict> {
    let ctx = make_ctx();
    let mut seen = HashSet::new();
    messages
        .iter()
        .map(|m| process_message(&ctx, m, &mut seen))
        .collect()
}

// ── the six attack classes ─────────────────────────────────────────────

#[test]
fn attack_duplicate_response_collapses_by_id() {
    let ctx = make_ctx();
    let m = response_frame(&ctx, "dup-1", 1_001, None, "get_info");
    // first is OUR response; the replayed frame is NotOurs(duplicate)
    let v = verdicts_for(&[m.clone(), m]);
    assert!(matches!(v[0], Verdict::Response(_)));
    assert_eq!(v[1], Verdict::NotOurs("duplicate"));
}

#[test]
fn attack_stale_response_ignored() {
    let ctx = make_ctx();
    let stale = response_frame(&ctx, "stale-1", 999, None, "get_info"); // < since 1000
    let v = verdicts_for(&[stale]);
    assert_eq!(v[0], Verdict::NotOurs("stale"));
}

#[test]
fn attack_wrong_p_tag_ignored() {
    let ctx = make_ctx();
    let wrong_p = response_frame(&ctx, "wp-1", 1_001, Some("deadbeef"), "get_info");
    let v = verdicts_for(&[wrong_p]);
    assert_eq!(v[0], Verdict::NotOurs("wrong p tag"));
}

#[test]
fn attack_wrong_correlation_ignored() {
    let ctx = make_ctx();
    // decrypts fine, addressed to us, fresh — but answers ANOTHER call
    let other = response_frame(&ctx, "oc-1", 1_001, None, "pay_invoice");
    let v = verdicts_for(&[other]);
    assert_eq!(
        v[0],
        Verdict::NotOurs("wrong correlation (other request's response)")
    );
}

#[test]
fn attack_mac_failure_ignored_never_crashes() {
    let ctx = make_ctx();
    let mut frame: serde_json::Value =
        serde_json::from_str(&response_frame(&ctx, "mf-1", 1_001, None, "get_info")).unwrap();
    // corrupt the ciphertext (keeps frame shape; MAC cannot verify)
    frame[2]["content"] = "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==".into(); // PUBLIC-CONSTANT: synthetic base64 tamper fixture (not hex, not key material)
    let v = verdicts_for(&[frame.to_string()]);
    assert!(matches!(v[0], Verdict::NotOurs(_)));
}

#[test]
fn attack_relay_disconnect_then_recovery_succeeds() {
    // script: drop → (reconnect delivers) the answer
    let mut sock = MockWsSocket {
        script: vec![Step::Drop, Step::Msg(response_frame_default())],
        pos: 0,
    };
    let policy = ReadPolicy {
        max_messages: 10,
        reconnect_attempts: 2,
    };
    let ctx = make_ctx();
    let reopen = |_a: usize| {
        Ok(MockWsSocket {
            script: vec![Step::Msg(response_frame_default())],
            pos: 0,
        })
    };
    let out = read_response(&mut sock, reopen, "REQ", &policy, &ctx).unwrap();
    assert_eq!(out["result"]["alias"], "hub");
}

#[test]
fn attack_reconnect_budget_exhaustion_is_ambiguous_not_failed() {
    // the reopened socket ALSO drops — budget 2 → ambiguity, never Failed
    let mut sock = MockWsSocket {
        script: vec![Step::Drop],
        pos: 0,
    };
    let policy = ReadPolicy {
        max_messages: 10,
        reconnect_attempts: 2,
    };
    let ctx = make_ctx();
    let reopen = |_a: usize| {
        Ok(MockWsSocket {
            script: vec![Step::Drop],
            pos: 0,
        })
    };
    let e = read_response(&mut sock, reopen, "REQ", &policy, &ctx).unwrap_err();
    match e {
        NwcError::TransportAmbiguous(why) => {
            assert!(why.contains("exhausted"), "{why}");
        }
        other => panic!("must be ambiguous, got {other}"),
    }
}

#[test]
fn attack_noise_before_the_answer() {
    // wrong-p + stale + duplicate + control frames, THEN the answer
    let ctx = make_ctx();
    let answer = response_frame(&ctx, "ans", 1_001, None, "get_info");
    let msgs = vec![
        response_frame(&ctx, "s1", 900, None, "get_info"), // stale
        response_frame(&ctx, "w1", 1_001, Some("nope"), "get_info"), // wrong p
        serde_json::json!(["EOSE", "sub"]).to_string(),    // control
        answer.clone(),
        answer, // duplicate after
    ];
    let v = verdicts_for(&msgs);
    assert_eq!(v[0], Verdict::NotOurs("stale"));
    assert_eq!(v[1], Verdict::NotOurs("wrong p tag"));
    assert_eq!(v[2], Verdict::Ignored("relay control"));
    assert!(matches!(v[3], Verdict::Response(_)));
    assert_eq!(v[4], Verdict::NotOurs("duplicate"));
}

#[test]
fn attack_error_envelope_is_typed_not_ambiguous() {
    // the error-response path: an error envelope addressed to us,
    // fresh, correlated — carries a typed NIP-47 error
    let (sk, client_pub, wallet_pub) = ctx_parts();
    let ctx = make_ctx();
    let envelope = serde_json::json!({
        "result_type": "error_response",
        "error": { "code": "QUOTA_EXCEEDED", "message": "budget" },
    });
    let content = nip44_encrypt(&sk, &wallet_pub, &envelope.to_string()).unwrap();
    let frame = serde_json::json!([
        "EVENT", "sub",
        { "id": "err-1", "pubkey": wallet_pub, "created_at": 1001, "kind": 23195,
          "tags": [["p", client_pub]], "content": content, "sig": "00" }
    ])
    .to_string();
    let mut seen = HashSet::new();
    match process_message(&ctx, &frame, &mut seen) {
        Verdict::Response(env) => {
            assert_eq!(env["error"]["code"], "QUOTA_EXCEEDED");
        }
        other => panic!("error envelope must be OURS: {other:?}"),
    }
    let _ = nip44_decrypt; // silence unused when feature-off
}

#[test]
fn attack_window_exhaustion_is_ambiguous() {
    // an endless stream of not-ours must never spin forever: the
    // message budget fires → ambiguous, no state touched
    let ctx = make_ctx();
    let noise: Vec<Step> = (0..300)
        .map(|i| {
            Step::Msg(response_frame(
                &ctx,
                &format!("n{i}"),
                1_001,
                Some("x"),
                "get_info",
            ))
        })
        .collect();
    let mut sock = MockWsSocket {
        script: noise,
        pos: 0,
    };
    let policy = ReadPolicy {
        max_messages: 50,
        reconnect_attempts: 1,
    };
    let reopen = |_a: usize| {
        Ok(MockWsSocket {
            script: vec![],
            pos: 0,
        })
    };
    let e = read_response(&mut sock, reopen, "REQ", &policy, &ctx).unwrap_err();
    assert!(matches!(e, NwcError::TransportAmbiguous(_)));
}
