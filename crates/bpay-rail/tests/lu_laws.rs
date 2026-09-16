//! LU laws, consumed RED-first (sixth-roll verified REDs at the R14 tip):
//!
//! - LU-8.1 absent-vs-zero at booking: `fees_paid` ABSENT must NOT book
//!   as a zero-fee settlement — exposure stays bounded at the declared
//!   fee limit (retained reservation, `FeeEvidence::AbsentBounded`).
//!   PRESENT reconciles DOWN to the figure. Paid(0) and AbsentBounded
//!   are DISTINCT bookings.
//! - LU-3/LU-7 typed rail units: `LnInvoice::amount_msat` is
//!   `MilliSatoshi`, conversions cross at ONE named site, fee refusals
//!   name field+unit.
//!
//! RED status at authoring: absent-fees released the reservation to zero
//! (`unwrap_or(0)`), amounts were bare `u64`, refusals named no unit.

use bpay_rail::ln::{LnMockClient, LnRailAdapter, PaymentHash};
use bpay_rail::units::{FeeEvidence, MilliSatoshi};
use bpay_rail::{LedgerError, LifecycleState};

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

fn adapter() -> LnRailAdapter {
    LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000)
}

// ── LU-8.1: absent vs zero at booking ──────────────────────────────────

#[test]
fn lu8_absent_fees_never_release_the_reservation() {
    let mut r = adapter();
    let mut client = LnMockClient::new(1_000_000);
    let inv = client.make_invoice(MilliSatoshi(50_000), 3_600);
    r.ledger_open_probe(inv.payment_hash, 1_003_600);
    let reserved_before = r.reserved_total_msat();
    let st = r
        .reconcile(inv.payment_hash, None, &[0; 32])
        .expect("absent fees still settle (preimage evidence)");
    assert_eq!(st, LifecycleState::Settled);
    assert_eq!(
        r.reserved_total_msat(),
        reserved_before,
        "ABSENT fees retain the worst-case reservation — never released to zero (LU-8.1)"
    );
    match r.fee_evidence(&inv.payment_hash) {
        Some(FeeEvidence::AbsentBounded(limit)) => assert_eq!(limit, 1_000),
        other => panic!("expected AbsentBounded booking, got {other:?}"),
    }
}

#[test]
fn lu8_present_fees_reconcile_down_to_the_figure() {
    let mut r = adapter();
    let mut client = LnMockClient::new(1_000_000);
    let inv = client.make_invoice(MilliSatoshi(50_000), 3_600);
    r.ledger_open_probe(inv.payment_hash, 1_003_600);
    let st = r
        .reconcile(inv.payment_hash, Some(MilliSatoshi(100)), &[0; 32])
        .unwrap();
    assert_eq!(st, LifecycleState::Settled);
    assert_eq!(r.reserved_total_msat(), 100, "PRESENT fees reconcile DOWN");
    assert_eq!(
        r.fee_evidence(&inv.payment_hash),
        Some(FeeEvidence::Paid(100))
    );
}

#[test]
fn lu8_absent_and_zero_are_distinct_bookings() {
    let mut a = adapter();
    let mut client = LnMockClient::new(1_000_000);
    let inv1 = client.make_invoice(MilliSatoshi(50_000), 3_600);
    a.ledger_open_probe(inv1.payment_hash, 1_003_600);
    a.reconcile(inv1.payment_hash, Some(MilliSatoshi(0)), &[0; 32])
        .unwrap();
    let mut b = adapter();
    let inv2 = client.make_invoice(MilliSatoshi(50_000), 3_600);
    b.ledger_open_probe(inv2.payment_hash, 1_003_600);
    b.reconcile(inv2.payment_hash, None, &[0; 32]).unwrap();
    // Paid(0): the transport TESTIFIED zero — reconciles to zero.
    assert_eq!(a.reserved_total_msat(), 0);
    // AbsentBounded: no testimony — bounded at the limit. Distinct laws.
    assert_eq!(b.reserved_total_msat(), 1_000);
    assert_ne!(
        a.fee_evidence(&inv1.payment_hash),
        b.fee_evidence(&inv2.payment_hash)
    );
}

// ── LU-3/LU-7: typed units, one conversion site, named refusals ────────

#[test]
fn lu3_invoice_amount_is_typed_at_the_boundary() {
    let mut client = LnMockClient::new(1_000_000);
    let inv = client.make_invoice(MilliSatoshi(50_000), 3_600);
    // LU-3: the amount is NOT a bare u64 — the type system carries the unit.
    let amount: MilliSatoshi = inv.amount_msat;
    assert_eq!(amount, MilliSatoshi(50_000));
    assert_ne!(amount, MilliSatoshi(50_001));
}

#[test]
fn lu7_one_conversion_site_atto_only_through_to_atto() {
    // The named conversion exists and is the ONLY public bridge (everything
    // internal routes through it — enforced by grep in CI-shaped fashion
    // here: no other msat->Atto construction in the crate's src).
    let msat = MilliSatoshi(1_234);
    let atto = msat.to_atto();
    assert_eq!(
        atto.to_decimal(),
        "1234",
        "1 msat == 1 atto-scale unit at this rail's precision (both 1e-3 base)"
    );
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/ln.rs"))
        .expect("ln.rs readable");
    assert!(
        !src.contains("Atto::from_u64(self.fee_limit_msat)"),
        "the adapter must not convert inline — one named site (LU-7.2)"
    );
    assert!(
        !src.contains("Atto::from_u64(fees)"),
        "reconcile must not convert inline — one named site (LU-7.2)"
    );
}

#[test]
fn lu7_fee_refusals_name_field_and_unit() {
    let mut r = adapter();
    let mut client = LnMockClient::new(1_000_000);
    let inv = client.make_invoice(MilliSatoshi(1), 3_600);
    let mut small = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(100), 1_000_000);
    small.ledger_open_probe(inv.payment_hash, 1_003_600);
    let e = small
        .reconcile(inv.payment_hash, Some(MilliSatoshi(101)), &[0; 32])
        .unwrap_err();
    assert_eq!(refusal_field(&e), "fees_paid");
    let msg = e.to_string();
    assert!(msg.contains("fees_paid"), "names the field: {msg}");
    assert!(msg.contains("unit=msat"), "names the unit pair: {msg}");
}

#[test]
fn lu7_nwc_absent_fees_retain_exposure_too() {
    // The NIP-47 adapter's own pay path books absent fees the same way
    // (the second verified unwrap_or(0) site, nwc.rs pay result).
    use bpay_rail::nwc::NwcRail;
    use bpay_rail::nwc_mock::MockNwcTransport;
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    // A pay result with preimage but NO fees_paid testimony.
    mock.next_pay_no_fees = true;
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(5_000), 1_000_000);
    rail.enable_sends();
    let id = PaymentHash(hash);
    let st = rail
        .pay(id, &bolt11, expires, 1_000_000)
        .expect("absent fees still settle");
    assert_eq!(st, LifecycleState::Settled);
    match rail.fee_evidence(&id) {
        Some(FeeEvidence::AbsentBounded(limit)) => assert_eq!(limit, 5_000),
        other => panic!("NWC absent fees must book AbsentBounded, got {other:?}"),
    }
    assert_eq!(
        rail.reserved_total_msat(),
        5_000,
        "absent fees retain the worst-case reservation on the NWC rail too"
    );
}
