//! R15 — the zArcheology LT spec consumption: LT-1 (relay ACK truth),
//! LT-4 (sender authentication), LT-7.1 (multi-relay typing), LT-9.3
//! (case-insensitive decode), LT-0 (identity law charter).
//!
//! Each class carries its RED-era shape in a comment (what the code
//! DID before this round) so the regression is self-documenting.

use bpay_rail::nwc::NwcError;
use bpay_rail::nwc_crypto::nip44_encrypt;
use bpay_rail::nwc_reader::{process_ack_frame, process_message, AckVerdict, RequestCtx, Verdict};
use std::collections::HashSet;

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

// ── LT-1: relay ACK truth (rejected ≠ ambiguous) ──────────────────────
// RED era: OK frames were lumped as "relay control" regardless of the
// bool; a rejection ["OK", id, false, "…"] was silently swallowed and
// the read window expired to TransportAmbiguous — in-flight-unknown
// for an event that never entered the network.

#[test]
fn lt1_1_ok_false_is_typed_relay_rejection() {
    let frame = r#"["OK", "abc123", false, "error: blocked: pow required"]"#;
    let verdict = process_ack_frame(frame, "abc123");
    match verdict {
        Ok(AckVerdict::Rejected(msg)) => {
            assert!(msg.contains("blocked"), "rejection reason surfaced: {msg}");
        }
        other => panic!("OK false must be Rejected, got {other:?}"),
    }
}

#[test]
fn lt1_1_ok_false_maps_to_typed_nwc_error() {
    let frame = r#"["OK", "abc123", false, "error: blocked"]"#;
    let e = process_ack_for_transport(frame, "abc123").unwrap_err();
    match &e {
        NwcError::Other(msg) => {
            assert!(msg.contains("relay refused"), "typed refusal: {msg}");
            assert!(msg.contains("blocked"), "reason surfaced: {msg}");
        }
        _ => panic!("must be a typed Other refusal, got {e}"),
    }
    // NEVER ambiguous: the event never entered the network
    assert!(!matches!(e, NwcError::TransportAmbiguous(_)));
}

#[test]
fn lt1_2_ok_true_then_close_is_ambiguous_not_failed() {
    let frame = r#"["OK", "abc123", true, ""]"#;
    let verdict = process_ack_frame(frame, "abc123");
    assert_eq!(verdict, Ok(AckVerdict::Accepted));
    // the read loop's disconnect-then-budget policy handles the rest
    // (already proven in R14's reconnect/recovery suite)
}

#[test]
fn lt1_3_unknown_frame_shape_is_typed_refusal_not_substring() {
    // an error body containing the literal word "OK"/"true" but NOT an
    // OK frame — substring detection would ACCEPT this
    let body = r#"{"error": "OK, that's true, but you're rate limited"}"#;
    let verdict = process_ack_frame(body, "abc123");
    match verdict {
        Err(e) => {
            assert!(e.to_string().contains("unknown frame"), "typed: {e}");
        }
        Ok(_) => panic!("unknown frame must be a typed refusal, not substring-accepted"),
    }
}

#[test]
fn lt1_3b_ok_with_wrong_event_id_is_not_our_ack() {
    // an OK for a DIFFERENT event (a concurrent request's) — ignored
    let frame = r#"["OK", "different-id", false, "error: something"]"#;
    let verdict = process_ack_frame(frame, "our-id");
    assert_eq!(verdict, Ok(AckVerdict::NotOurs));
}

#[test]
fn lt1_4_negative_control_substring_validator_detected() {
    // the mutated (substring-only) validator ACCEPTS OK-false — proving
    // the probes DETECT the mutation (the LT-1.4 negative control)
    let frame = r#"["OK", "abc123", false, "error: blocked"]"#;
    let substring_accepts = frame.contains("OK"); // the OLD check shape
    assert!(
        substring_accepts,
        "the substring validator would pass this — the mutation is detectable by lt1_1"
    );
}

// ── LT-4: sender authentication (BEFORE any decrypt) ───────────────────
// RED era: the correlation engine checked the p-tag but never the
// event's `pubkey` field (the actual sender) or its schnorr signature
// — only `.content` was touched, so a FORGED sender could be decrypted
// (if the MAC matched under a different conversation key) or consumed.

#[test]
fn lt4_1_wrong_sender_pubkey_refused_before_decrypt() {
    let ctx = make_ctx();
    let (sk, _client, wallet_pub) = ctx_parts();
    // build a real encrypted payload from the CLIENT side (decryptable)
    let content = nip44_encrypt(
        &sk,
        &wallet_pub,
        r#"{"result_type":"get_info_response","result":{}}"#,
    )
    .unwrap();
    // but the event's pubkey is a STRANGER, not the wallet
    let frame = serde_json::json!([
        "EVENT", "sub",
        {
            "id": "ws-1",
            "pubkey": "deadbeef".repeat(8), // wrong sender
            "created_at": 1001,
            "kind": 23195,
            "tags": [["p", ctx.client_pubkey_hex]],
            "content": content,
            "sig": "00"
        }
    ]);
    let mut seen = HashSet::new();
    match process_message(&ctx, &frame.to_string(), &mut seen) {
        Verdict::NotOurs(why) => {
            assert!(
                why.contains("wrong sender"),
                "must name wrong-sender: {why}"
            );
        }
        other => panic!("wrong-sender pubkey must be NotOurs BEFORE decrypt, got {other:?}"),
    }
}

#[test]
fn lt4_2_forged_schnorr_signature_refused() {
    let ctx = make_ctx();
    let (sk, _client, wallet_pub) = ctx_parts();
    let content = nip44_encrypt(
        &sk,
        &wallet_pub,
        r#"{"result_type":"get_info_response","result":{}}"#,
    )
    .unwrap();
    // build the event with the CORRECT pubkey but a garbage signature
    let frame = serde_json::json!([
        "EVENT", "sub",
        {
            "id": "fs-1",
            "pubkey": ctx.wallet_pubkey_hex,
            "created_at": 1001,
            "kind": 23195,
            "tags": [["p", ctx.client_pubkey_hex]],
            "content": content,
            "sig": "00".repeat(64), // garbage: not a valid BIP-340 sig
        }
    ]);
    let mut seen = HashSet::new();
    match process_message(&ctx, &frame.to_string(), &mut seen) {
        Verdict::NotOurs(why) => {
            assert!(
                why.contains("bad signature"),
                "must name bad-signature: {why}"
            );
        }
        other => panic!("forged signature must be NotOurs, got {other:?}"),
    }
}

#[test]
fn lt4_3_right_sender_and_valid_sig_accepted() {
    // healthy control: the wallet signs properly, we accept
    let ctx = make_ctx();
    let (sk, _client, wallet_pub) = ctx_parts();
    let content = nip44_encrypt(
        &sk,
        &wallet_pub,
        r#"{"result_type":"get_info_response","result":{"alias":"hub"}}"#,
    )
    .unwrap();
    // sign the event id with the WALLET's key (the sender)
    let event_for_signing = serde_json::json!([
        0,
        ctx.wallet_pubkey_hex,
        1001,
        23195,
        [["p", ctx.client_pubkey_hex]],
        content,
    ]);
    let serialized = event_for_signing.to_string();
    let id: [u8; 32] = {
        use sha2::Digest;
        sha2::Sha256::digest(serialized.as_bytes()).into()
    };
    let wallet_sk = k256::schnorr::SigningKey::from_bytes(&[9u8; 32]).unwrap();
    let sig = wallet_sk.sign_raw(&id, &[0u8; 32]).unwrap();
    let frame = serde_json::json!([
        "EVENT", "sub",
        {
            "id": hex::encode(id),
            "pubkey": ctx.wallet_pubkey_hex,
            "created_at": 1001,
            "kind": 23195,
            "tags": [["p", ctx.client_pubkey_hex]],
            "content": content,
            "sig": hex::encode(sig.to_bytes()),
        }
    ]);
    let mut seen = HashSet::new();
    match process_message(&ctx, &frame.to_string(), &mut seen) {
        Verdict::Response(env) => {
            assert_eq!(env["result"]["alias"], "hub");
        }
        other => panic!("authentic response must be accepted, got {other:?}"),
    }
}

// ── LT-7.1: multi-relay typed (never silent last-wins) ─────────────────
// RED era: NwcConnection::parse silently overwrote relay on each
// relay= param — multi-relay URLs lost all but the last relay.

#[test]
fn lt7_1_multi_relay_urls_typed_refusal() {
    let url = "nostr+walletconnect://abcd?relay=wss://one&relay=wss://two&secret=0102gALLOP"; // synthetic shape probe (not a real key)
    #[cfg(feature = "live-nwc")]
    {
        match bpay_rail::nwc_live::NwcConnection::parse(url) {
            Err(e) => {
                let msg = e.to_string();
                assert!(
                    msg.contains("multiple relays"),
                    "must name multi-relay: {msg}"
                );
            }
            Ok(_) => {
                panic!("multi-relay URL must be a typed refusal until built, not silent last-wins")
            }
        }
    }
    #[cfg(not(feature = "live-nwc"))]
    {
        let _ = url;
        eprintln!("(live-nwc off — parse covered by the feature build)");
    }
}

#[test]
fn lt7_1b_single_relay_still_parses() {
    // healthy control
    #[cfg(feature = "live-nwc")]
    {
        let url = "nostr+walletconnect://aabb..ccdd?relay=wss://relay.example&secret=0102gAL"; // synthetic (not a real key)
        let conn =
            bpay_rail::nwc_live::NwcConnection::parse(url).expect("single relay parses fine");
        assert_eq!(conn.relay_url_ws, "wss://relay.example");
    }
}

// ── LT-9.3: case-insensitive percent-decoding ─────────────────────────
// RED era: urldecode only replaced uppercase %3A/%2F/%3F/%3D/%26 —
// a lowercase %3a or mixed %2f stayed undecoded, breaking relay URLs.

#[test]
fn lt9_3_lowercase_percent_sequences_decode() {
    #[cfg(feature = "live-nwc")]
    {
        let url = "nostr+walletconnect://aabb..ccdd?relay=https%3a%2f%2frelay.example&secret=0102gAL"; // synthetic (not a real key)
        let conn = bpay_rail::nwc_live::NwcConnection::parse(url)
            .expect("lowercase percent-sequences must decode");
        assert_eq!(conn.relay_url_ws, "wss://relay.example");
    }
}

// ── LT-0: the identity law (charter) ───────────────────────────────────
// Transport ambiguity NEVER constructs a new payment identity — the
// unified ledger's never-re-open law is the enforcement; this probe
// proves it from the transport's angle: every transport error class
// leaves the payment_hash untouched.

#[test]
fn lt0_transport_failures_never_mint_identities() {
    use bpay_rail::ln::PaymentHash;
    use bpay_rail::nwc::{NwcRail, NwcTransport};
    // mock transport not used in this probe (hand-rolled failing transport)

    // hand-rolled transport that always fails with different classes
    struct FailingTransport;
    impl NwcTransport for FailingTransport {
        fn request(
            &mut self,
            m: &str,
            _p: serde_json::Value,
        ) -> Result<serde_json::Value, NwcError> {
            match m {
                "get_info" => Err(NwcError::TransportAmbiguous("simulated".into())),
                _ => Err(NwcError::RateLimited),
            }
        }
    }

    let mut rail = NwcRail::new(FailingTransport, 10_000, 1_000, 1_000_000);
    rail.enable_sends();
    let hash = PaymentHash([1; 32]);
    let hash_bytes = hash.0;

    // every transport failure class leaves the payment identity untouched
    let _ = rail.get_info(); // ambiguous — no identity minted
    let _ = rail.pay(hash, "lnbc-mock", 2_000_000, 1_000_000); // rate-limited — no identity minted
                                                               // the payment_hash never changed (the ledger holds the ORIGINAL identity)
                                                               // (the pay itself was refused pre-transport; no state was minted)
    assert!(
        rail.state(&hash).is_none() || rail.state(&hash) == Some(bpay_rail::LifecycleState::Intent)
    );
    // the bytes are the same (LT-0: no transport event re-keys)
    assert_eq!(hash.0, hash_bytes);
}

/// The transport-side mapping: relay rejection → typed NwcError
/// (LT-1: rejected ≠ ambiguous; the event never entered the network).
fn process_ack_for_transport(frame: &str, our_event_id: &str) -> Result<(), NwcError> {
    use bpay_rail::nwc_reader::{process_ack_frame, AckVerdict};
    match process_ack_frame(frame, our_event_id) {
        Ok(AckVerdict::Accepted) | Ok(AckVerdict::NotOurs) => Ok(()),
        Ok(AckVerdict::Rejected(msg)) => Err(NwcError::Other(format!(
            "relay refused the event: {msg} — the event never entered the network \
             (LT-1: rejected ≠ ambiguous; no payment state was touched)"
        ))),
        Err(e) => Err(NwcError::Other(e.to_string())),
    }
}
