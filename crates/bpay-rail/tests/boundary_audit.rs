//! BOUNDARY AUDIT — default-configuration battery (pure engine + rail
//! level). The provenance law: uncertainty begins only after an
//! irreversible external boundary has actually been crossed; a local
//! failure leaves the existing intent open and cannot manufacture
//! Unknown.
//!
//! Boundaries: LOCAL/PRE-SEND → SUBMITTED/UNACKNOWLEDGED →
//! RELAY-ACKNOWLEDGED → COUNTERPARTY-OBSERVED → SETTLEMENT-EVIDENCED.

use bpay_rail::ln::{LnMockClient, LnRailAdapter, PaymentHash};
use bpay_rail::nwc::{LedgerEffect, NwcError, NwcRail};
use bpay_rail::nwc_mock::MockNwcTransport;
use bpay_rail::nwc_reader::{read_response, ReadPolicy, RequestCtx, WsError, WsSocket};
use bpay_rail::units::MilliSatoshi;
use bpay_rail::{LedgerError, LifecycleState};

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

// ── THE LAW, executable: every variant's boundary vs its effect ────────

/// The mutant mapper (negative control): simulates the R17-class bug —
/// one pre-send failure promoted to Unknown. The law checker MUST
/// reject it; the live battery caught its real-world twin RED.
fn mutant_ledger_effect(e: &NwcError) -> LedgerEffect {
    match e {
        // THE MUTATION: connect failure (pre-send) promoted to Unknown.
        NwcError::ConnectFailed(_) => LedgerEffect::MarkUnknownHumanGate,
        other => other.ledger_effect(),
    }
}

#[test]
fn ba_law_local_failures_cannot_manufacture_unknown() {
    let locals = [
        NwcError::ClockUnavailable("probe".into()),
        NwcError::ConnectFailed("dns dead".into()),
        NwcError::LocalConstruction("csprng exhausted".into()),
        NwcError::RelayRejected("duplicate/evicted".into()),
    ];
    for e in &locals {
        assert_eq!(
            e.boundary(),
            bpay_rail::nwc::FailureBoundary::LocalPreSend,
            "{e}: classified local"
        );
        assert_eq!(
            e.ledger_effect(),
            LedgerEffect::LeaveOpenAtIntent,
            "{e}: local ⇒ intent open (the provenance law)"
        );
    }
}

#[test]
fn ba_mutation_control_pre_send_to_unknown_is_caught() {
    // The deliberately broken implementation: one pre-send failure
    // mapped to Unknown. The law checker flags it by construction.
    let connect_fail = NwcError::ConnectFailed("dns dead".into());
    let mutant = mutant_ledger_effect(&connect_fail);
    assert_eq!(
        mutant,
        LedgerEffect::MarkUnknownHumanGate,
        "the mutant really is broken (sanity)"
    );
    // THE CATCH: boundary says local, effect says Unknown → violation.
    let violation = connect_fail.boundary() == bpay_rail::nwc::FailureBoundary::LocalPreSend
        && mutant != LedgerEffect::LeaveOpenAtIntent;
    assert!(
        violation,
        "the battery's law checker catches the pre-send→Unknown mutation"
    );
}

#[test]
fn ba_every_variant_has_a_boundary_and_the_law_holds_for_all() {
    // Exhaustive over the vocabulary: boundary and effect stay
    // consistent — no variant may demand stronger evidence than the
    // boundary it crossed.
    let all = [
        NwcError::RateLimited,
        NwcError::NotImplemented("p".into()),
        NwcError::InsufficientBalance,
        NwcError::QuotaExceeded,
        NwcError::Restricted,
        NwcError::Unauthorized,
        NwcError::Internal,
        NwcError::UnsupportedEncryption,
        NwcError::PaymentFailed("p".into()),
        NwcError::NotFound,
        NwcError::ClockUnavailable("p".into()),
        NwcError::ConnectFailed("p".into()),
        NwcError::LocalConstruction("p".into()),
        NwcError::RelayRejected("p".into()),
        NwcError::Other("p".into()),
        NwcError::TransportAmbiguous("p".into()),
    ];
    for e in &all {
        let b = e.boundary();
        let eff = e.ledger_effect();
        if b == bpay_rail::nwc::FailureBoundary::LocalPreSend {
            assert_eq!(eff, LedgerEffect::LeaveOpenAtIntent, "{e}: law");
        }
        // Post-boundary uncertain classes must NOT claim local openness.
        if matches!(
            b,
            bpay_rail::nwc::FailureBoundary::SubmittedUnacknowledged
                | bpay_rail::nwc::FailureBoundary::RelayAcknowledged
        ) {
            assert_eq!(
                eff,
                LedgerEffect::MarkUnknownHumanGate,
                "{e}: post-boundary uncertainty is Unknown"
            );
        }
    }
}

// ── RELAY OK=false: definitive refusal, never ambiguity ────────────────

fn audit_ctx() -> RequestCtx {
    let sk = [7u8; 32];
    let signing = k256::schnorr::SigningKey::from_bytes(&sk).expect("any");
    let client_pub = hex::encode(signing.verifying_key().to_bytes());
    let wallet = [9u8; 32];
    let ws = k256::schnorr::SigningKey::from_bytes(&wallet).expect("any");
    let wallet_pub = hex::encode(ws.verifying_key().to_bytes());
    RequestCtx {
        client_pubkey_hex: client_pub,
        wallet_pubkey_hex: wallet_pub,
        client_secret: sk,
        since_unix: 1_000,
        max_future_skew_secs: bpay_rail::nwc_reader::DEFAULT_MAX_SKEW_SECS,
        now_unix: 1_000,
        method: "get_info".into(),
    }
}

/// Scripted socket for the pure-engine disconnect arms.
struct ScriptSocket {
    frames: Vec<Result<Option<String>, WsError>>,
    pos: usize,
    sends: usize,
}
impl WsSocket for ScriptSocket {
    fn send_text(&mut self, _t: &str) -> Result<(), WsError> {
        self.sends += 1;
        Ok(())
    }
    fn recv_text(&mut self) -> Result<Option<String>, WsError> {
        if self.pos < self.frames.len() {
            let f = self.frames[self.pos].clone();
            self.pos += 1;
            f
        } else {
            Ok(None) // orderly close once the script ends
        }
    }
}

#[test]
fn ba_relay_ok_false_for_our_id_is_definitive_refusal_not_ambiguity() {
    // The relay REFUSED our event: it never entered the network. The
    // read loop must surface RelayRejected (LeaveOpen), not sit until
    // window exhaustion and report ambiguity.
    let ctx = audit_ctx();
    let our_id = "ab".repeat(32); // PUBLIC-CONSTANT: synthetic event id
    let ok_false = format!(r#"["OK","{our_id}",false,"blocked: duplicate"]"#);
    let mut sock = ScriptSocket {
        frames: vec![Ok(Some(ok_false))],
        pos: 0,
        sends: 0,
    };
    let reopen = |_a: usize| -> Result<ScriptSocket, WsError> {
        Err(WsError::Fatal("no reopen in this probe".into()))
    };
    let e = read_response(
        &mut sock,
        reopen,
        r#"["REQ","probe",{}]"#,
        &ReadPolicy {
            max_messages: 50,
            reconnect_attempts: 0,
        },
        &ctx,
        &our_id,
    )
    .unwrap_err();
    assert!(
        matches!(e, NwcError::RelayRejected(_)),
        "OK=false for our id is a definitive refusal: {e}"
    );
    assert_eq!(e.ledger_effect(), LedgerEffect::LeaveOpenAtIntent);
}

#[test]
fn ba_disconnect_before_ack_budget_zero_is_unknown_not_open() {
    // Bytes were sent, no OK seen, disconnect, no reconnect budget:
    // SUBMITTED/UNACKNOWLEDGED → Unknown is the LAWFUL class.
    let ctx = audit_ctx();
    let our_id = "cd".repeat(32); // PUBLIC-CONSTANT: synthetic event id
    let mut sock = ScriptSocket {
        frames: vec![],
        pos: 0,
        sends: 0,
    };
    let reopen =
        |_a: usize| -> Result<ScriptSocket, WsError> { Err(WsError::Fatal("no reconnect".into())) };
    let e = read_response(
        &mut sock,
        reopen,
        r#"["REQ","p2",{}]"#,
        &ReadPolicy {
            max_messages: 10,
            reconnect_attempts: 0,
        },
        &ctx,
        &our_id,
    )
    .unwrap_err();
    assert!(matches!(e, NwcError::TransportAmbiguous(_)));
    assert_eq!(e.ledger_effect(), LedgerEffect::MarkUnknownHumanGate);
}

#[test]
fn ba_disconnect_after_ack_is_unknown_not_open() {
    // Relay ACKED our event, then dropped before the response:
    // RELAY-ACKNOWLEDGED → Unknown (the obligation escaped us).
    let ctx = audit_ctx();
    let our_id = "ef".repeat(32); // PUBLIC-CONSTANT: synthetic event id
    let ok_true = format!(r#"["OK","{our_id}",true]"#);
    let mut sock = ScriptSocket {
        frames: vec![Ok(Some(ok_true)), Ok(None)],
        pos: 0,
        sends: 0,
    };
    let reopen =
        |_a: usize| -> Result<ScriptSocket, WsError> { Err(WsError::Fatal("no reconnect".into())) };
    let e = read_response(
        &mut sock,
        reopen,
        r#"["REQ","p3",{}]"#,
        &ReadPolicy {
            max_messages: 10,
            reconnect_attempts: 0,
        },
        &ctx,
        &our_id,
    )
    .unwrap_err();
    assert!(matches!(e, NwcError::TransportAmbiguous(_)));
    assert_eq!(e.ledger_effect(), LedgerEffect::MarkUnknownHumanGate);
}

// ── Rail level: relay-rejected leaves the intent open ──────────────────

#[test]
fn ba_rail_relay_rejected_leaves_intent_open() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_relay_rejected = true;
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    rail.enable_sends();
    let id = PaymentHash(hash);
    let e = rail.pay(id, &bolt11, expires, 1_000_000).unwrap_err();
    assert!(
        e.to_string().contains("relay") || e.to_string().contains("Relay"),
        "names the class: {e}"
    );
    assert_eq!(
        rail.state(&id),
        Some(LifecycleState::Intent),
        "the event never entered the network — intent open"
    );
}

// ── SETTLEMENT-EVIDENCED after Unknown: evidence resolves, never resets ─

#[test]
fn ba_settlement_evidence_after_unknown_resolves_the_same_identity() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    let mut client = LnMockClient::new(1_000_000);
    let inv = client.make_invoice(MilliSatoshi(5_000), 3_600);
    r.client.outage_next_pay = true;
    let st = r.pay(&inv).unwrap();
    assert_eq!(st, LifecycleState::Unknown, "submitted-then-ambiguous");
    // Late evidence: reconcile resolves the SAME identity to Settled —
    // Unknown is resolvable by evidence, and never auto-retried first.
    let e_retry = r.pay(&inv).unwrap_err();
    assert_eq!(refusal_field(&e_retry), "payment_hash");
    let st2 = r
        .reconcile(inv.payment_hash, Some(MilliSatoshi(100)), &[0; 32])
        .unwrap();
    assert_eq!(st2, LifecycleState::Settled);
}
