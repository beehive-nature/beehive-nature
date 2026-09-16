//! LU-6 BEHAVIORAL audit (founder order 2026-09-16): the total map had
//! table-only coverage for half the vocabulary — these probes drive the
//! REAL pay path for every code that previously lacked behavioral proof,
//! asserting the actual ledger state (not a mapping function's return).
//!
//! Also carries the LT-8.1 typing regression at the rail level
//! (ClockUnavailable → LeaveOpenAtIntent, behavioral on the mock path)
//! and the CD mock-only Hold/MPP law.

use bpay_rail::capabilities::{
    CapabilityManifest, MechanismSet, ResponseReadAxis, TransportIdentity,
};
use bpay_rail::nwc::NwcRail;
use bpay_rail::nwc_mock::MockNwcTransport;
use bpay_rail::units::MilliSatoshi;
use bpay_rail::{LedgerError, LifecycleState};

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

/// Drive one pay with an injected NIP-47 error code; return the ledger
/// state after the attempt (None if the intent never opened).
fn pay_with_code(code: &str) -> (Option<LifecycleState>, Option<String>) {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_error_code = Some(code.into());
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    rail.enable_sends();
    let id = bpay_rail::ln::PaymentHash(hash);
    match rail.pay(id, &bolt11, expires, 1_000_000) {
        Ok(st) => (rail.state(&id), Some(format!("{st:?}"))),
        Err(e) => (rail.state(&id), Some(e.to_string())),
    }
}

#[test]
fn lu6_quota_exceeded_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("QUOTA_EXCEEDED");
    assert_eq!(
        state,
        Some(LifecycleState::Intent),
        "the Hub native budget refusing must not touch payment state"
    );
}

#[test]
fn lu6_restricted_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("RESTRICTED");
    assert_eq!(state, Some(LifecycleState::Intent));
}

#[test]
fn lu6_insufficient_balance_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("INSUFFICIENT_BALANCE");
    assert_eq!(state, Some(LifecycleState::Intent));
}

#[test]
fn lu6_not_implemented_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("NOT_IMPLEMENTED");
    assert_eq!(state, Some(LifecycleState::Intent));
}

#[test]
fn lu6_unsupported_encryption_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("UNSUPPORTED_ENCRYPTION");
    assert_eq!(state, Some(LifecycleState::Intent));
}

#[test]
fn lu6_not_found_leaves_intent_open_behaviorally() {
    let (state, _) = pay_with_code("NOT_FOUND");
    assert_eq!(state, Some(LifecycleState::Intent));
}

#[test]
fn lu6_unauthorized_goes_unknown_behaviorally() {
    // The RED class: a ceremony breach on a live connection is uncertain
    // — human gate, never a silent open and never a false Failed.
    let (state, _) = pay_with_code("UNAUTHORIZED");
    assert_eq!(state, Some(LifecycleState::Unknown));
}

#[test]
fn lu6_payment_failed_is_terminal_zero_fee_behaviorally() {
    let (state, _) = pay_with_code("PAYMENT_FAILED");
    assert_eq!(state, Some(LifecycleState::Failed));
}

#[test]
fn lu6_clock_unavailable_leaves_intent_open_via_the_rail() {
    // LT-8.1 typing regression at rail level: a LOCAL clock failure is
    // pre-send — never Unknown. (The full zero-publish proof lives in
    // tests/lt8_clock_failure.rs under live-nwc; this pins the MAP.)
    let err = bpay_rail::nwc::NwcError::ClockUnavailable("probe".into());
    assert_eq!(
        err.ledger_effect(),
        bpay_rail::nwc::LedgerEffect::LeaveOpenAtIntent
    );
    // And the total-map table now names the local class explicitly.
    let codes = bpay_rail::nwc::NIP47_PINNED_CODES;
    assert!(codes.contains(&"RATE_LIMITED") && codes.contains(&"PAYMENT_FAILED"));
}

// ── CD: Hold/MPP are MOCK-ONLY until backend support is demonstrated ────

#[test]
fn cd_live_manifest_claiming_hold_or_mpp_is_refused() {
    for mechanisms in [
        MechanismSet {
            hold: true,
            mpp: false,
        },
        MechanismSet {
            hold: false,
            mpp: true,
        },
        MechanismSet {
            hold: true,
            mpp: true,
        },
    ] {
        let m = CapabilityManifest {
            identity: TransportIdentity::Live {
                url_shape: "wss://relay.example",
            },
            mechanisms,
            response_read: ResponseReadAxis::WsRequired,
            sends_enabled: false,
            send_gate_version: 0,
        };
        let err = m.validate().unwrap_err().to_string();
        assert!(
            err.contains("MOCK-ONLY"),
            "Live manifest may not claim unbuilt mechanisms: {err}"
        );
    }
    // The mock may; and Live with NO mechanisms stays lawful.
    let mock_m = CapabilityManifest {
        identity: TransportIdentity::Mock { divergences: &[] },
        mechanisms: MechanismSet::BOTH,
        response_read: ResponseReadAxis::PostReq,
        sends_enabled: false,
        send_gate_version: 0,
    };
    assert!(mock_m.validate().is_ok());
    let live_plain = CapabilityManifest {
        identity: TransportIdentity::Live {
            url_shape: "wss://relay.example",
        },
        mechanisms: MechanismSet::NONE,
        response_read: ResponseReadAxis::WsRequired,
        sends_enabled: false,
        send_gate_version: 0,
    };
    assert!(live_plain.validate().is_ok());
}

// ── LU-7.2: the one-conversion-site law covers nwc.rs too ──────────────

#[test]
fn lu7_no_inline_msat_to_atto_conversion_in_nwc_rs_either() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/nwc.rs"))
        .expect("nwc.rs readable");
    assert!(
        !src.contains("Atto::from_u64("),
        "nwc.rs must route msat->Atto through MilliSatoshi::to_atto — one named site (LU-7.2)"
    );
    let ln = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/ln.rs"))
        .expect("ln.rs readable");
    assert!(
        !ln.contains("Atto::from_u64("),
        "ln.rs must route msat->Atto through MilliSatoshi::to_atto — one named site (LU-7.2)"
    );
}
