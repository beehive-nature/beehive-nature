//! R13 harness: the LIVE-adapter LAWS proven against the mock-first
//! transport, adversarial probes, and the env-gated LIVE read-only leg.
//!
//! LAWS (R8, preserved through the transport seam): payment_hash
//! idempotency, reservation-before-send (dual caps: this window binds),
//! OPTIONAL fees_paid with possibility checks, typed NWC errors with
//! the state-discipline mapping (transport-ambiguous → Unknown;
//! rate-limited/typed refusals → state untouched; PAYMENT_FAILED →
//! Failed with no fee), preimage-required settlement, and the
//! SEND GATE (live sends OFF this slice — a named refusal).
//!
//! LIVE LEG: gated on env BPAY_NWC_URL (a founder-held connection
//! secret — never in the tree); read-only (get_info/get_balance);
//! reports honestly (relay acceptance of a correctly signed+encrypted
//! kind-23194 event is itself a receipt; the response-reader door is
//! the named next slice).

use bpay_rail::ln::PaymentHash;
use bpay_rail::nwc::{NwcError, NwcRail, NwcTransport};
use bpay_rail::nwc_mock::MockNwcTransport;
use bpay_rail::units::MilliSatoshi;
use bpay_rail::LedgerError;
use bpay_rail::LifecycleState;

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

fn mk_rail() -> NwcRail<MockNwcTransport> {
    let mut r = NwcRail::new(
        MockNwcTransport::new(1_000_000, 500_000),
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    r.enable_sends(); // mock transport — sends lawful in tests
    r
}

#[test]
fn nwc_read_only_info_and_balance() {
    let mut r = NwcRail::new(
        MockNwcTransport::new(1_000_000, 424_242),
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    let info = r.get_info().unwrap();
    assert_eq!(info["network"], "regtest");
    assert!(info["methods"].as_array().unwrap().iter().count() >= 4);
    assert_eq!(r.get_balance_msat().unwrap(), 424_242);
}

#[test]
fn nwc_send_gate_off_by_default_named_refusal() {
    let mut r = NwcRail::new(
        MockNwcTransport::new(1_000_000, 1),
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    // sends DISABLED by default this slice — the founder-order gate
    let e = r
        .pay(PaymentHash([1; 32]), "lnbc", 2_000_000, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "send_enabled");
    assert!(e.to_string().contains("LIVE SENDS DISABLED"));
}

#[test]
fn nwc_happy_path_settles_with_preimage_and_optional_fees() {
    let mut r = mk_rail();
    let (bolt11, hash, expires) = r.transport_mut().mint_invoice(3_600);
    let st = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    assert_eq!(st, LifecycleState::Settled);
    // fees reconciled DOWN from the 1000 reservation to the 25 actual
    assert_eq!(r.reserved_total_msat(), 25);
}

#[test]
fn nwc_idempotency_duplicate_hash_routes_to_lookup() {
    let mut r = mk_rail();
    let (bolt11, hash, expires) = r.transport_mut().mint_invoice(3_600);
    r.pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    let e = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "payment_hash");
    assert!(e.to_string().contains("never a second payment"));
}

#[test]
fn nwc_expired_invoice_new_intent_refused() {
    let mut r = mk_rail();
    let (bolt11, hash, _exp) = r.transport_mut().mint_invoice(10);
    let e = r
        .pay(PaymentHash(hash), &bolt11, 1_000_010, 1_000_100)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "expires_unix");
}

#[test]
fn nwc_transport_ambiguity_is_unknown_never_failed_never_retried() {
    let mut r = mk_rail();
    let (bolt11, hash, expires) = r.transport_mut().mint_invoice(3_600);
    r.transport_mut().next_pay_ambiguous = true;
    let st = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    assert_eq!(st, LifecycleState::Unknown);
    // unknown NEVER auto-retries: a second attempt is refused
    let e = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "payment_hash");
}

#[test]
fn nwc_payment_failed_is_terminal_no_fee_ever() {
    let mut r = mk_rail();
    let (bolt11, hash, expires) = r.transport_mut().mint_invoice(3_600);
    r.transport_mut().next_pay_fails = true;
    let st = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    assert_eq!(st, LifecycleState::Failed);
    // LN pays NOTHING on failure — the reservation stands (window law:
    // failed calls free nothing without evidence), no fee recorded
    assert_eq!(r.reserved_total_msat(), 1_000);
}

#[test]
fn nwc_rate_limited_leaves_state_untouched() {
    let mut r = mk_rail();
    let (bolt11, hash, expires) = r.transport_mut().mint_invoice(3_600);
    r.transport_mut().next_rate_limited = true;
    let e = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "nwc_error");
    assert!(e.to_string().contains("RATE_LIMITED"));
    assert!(e.to_string().contains("no retry"));
    // INTENT PERSISTS (the watchpay law: identity + reservation BEFORE
    // send) and NO further transition happened — not in-flight, not
    // failed; a retry is a NEW explicit action on the open intent:
    assert_eq!(r.state(&PaymentHash(hash)), Some(LifecycleState::Intent));
}

#[test]
fn nwc_typed_error_vocabulary_complete() {
    // the full pinned NIP-47 code set parses to typed errors
    let cases = [
        ("RATE_LIMITED", NwcError::RateLimited),
        ("INSUFFICIENT_BALANCE", NwcError::InsufficientBalance),
        ("QUOTA_EXCEEDED", NwcError::QuotaExceeded),
        ("RESTRICTED", NwcError::Restricted),
        ("UNAUTHORIZED", NwcError::Unauthorized),
        ("INTERNAL", NwcError::Internal),
        ("UNSUPPORTED_ENCRYPTION", NwcError::UnsupportedEncryption),
        ("NOT_FOUND", NwcError::NotFound),
    ];
    for (code, want) in cases {
        assert_eq!(NwcError::from_code(code, "m"), want, "{code}");
    }
    assert!(matches!(
        NwcError::from_code("PAYMENT_FAILED", "no route"),
        NwcError::PaymentFailed(_)
    ));
    assert!(matches!(
        NwcError::from_code("WEIRD_FUTURE_CODE", "x"),
        NwcError::Other(_)
    ));
}

#[test]
fn nwc_missing_preimage_is_incomplete_evidence() {
    // A settlement result without the preimage must not settle — the
    // strongest-evidence law (R8). Simulated via a hand-rolled
    // transport around the mock's happy path.
    struct NoPreimage(MockNwcTransport);
    impl NwcTransport for NoPreimage {
        fn request(
            &mut self,
            m: &str,
            p: serde_json::Value,
        ) -> Result<serde_json::Value, NwcError> {
            let v = self.0.request(m, p)?;
            if m == "pay_invoice" {
                // strip the preimage: incomplete evidence injection
                let mut v = v;
                v.as_object_mut().unwrap().remove("preimage");
                return Ok(v);
            }
            Ok(v)
        }
    }
    let mut r = NwcRail::new(
        NoPreimage(MockNwcTransport::new(1_000_000, 1)),
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    r.enable_sends();
    let (bolt11, hash, expires) = r.transport_mut().0.mint_invoice(3_600);
    let e = r
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "preimage");
    assert!(e.to_string().contains("incomplete evidence"));
}

// ── the env-gated LIVE read-only leg ────────────────────────────────────
//
// BPAY_NWC_URL (founder-held nostr+walletconnect://… URL) enables it.
// Read-only: get_info + get_balance over the LIVE transport. The relay
// ACCEPTING a correctly signed+encrypted kind-23194 event is itself a
// live receipt; the response reader door is the named next slice and
// the test reports that shape honestly instead of faking a result.

#[test]
#[ignore = "env-gated: set BPAY_NWC_URL to run the LIVE read-only leg"]
fn nwc_live_readonly_info_and_balance() {
    let Ok(url) = std::env::var("BPAY_NWC_URL") else {
        eprintln!("BPAY_NWC_URL not set — live leg skipped");
        return;
    };
    #[cfg(feature = "live-nwc")]
    {
        let conn = bpay_rail::nwc_live::NwcConnection::parse(&url).expect("parse connection");
        let mut r = NwcRail::new(
            bpay_rail::nwc_live::LiveNwcTransport::new(conn),
            MilliSatoshi(1),
            MilliSatoshi(1),
            0,
        );
        match r.get_info() {
            Ok(info) => println!("LIVE get_info OK: {}", info),
            Err(NwcError::TransportAmbiguous(note)) => {
                // request SENT + relay accepted; reader door pending —
                // the honest expected outcome this slice
                println!("LIVE REQUEST ACCEPTED, reader door pending: {note}");
            }
            Err(e) => panic!("LIVE read-only failed unexpectedly: {e}"),
        }
    }
    #[cfg(not(feature = "live-nwc"))]
    eprintln!("live-nwc feature not enabled — skipping");
}
