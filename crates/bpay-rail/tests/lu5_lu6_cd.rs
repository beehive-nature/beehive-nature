//! LU-5 / LU-6 / CD laws, consumed RED-first (founder queue order):
//!
//! - **LU-5:** hold-invoice/MPP upto modeled honestly — LN never silently
//!   turns a maximum into an exact charge: settle-on-release only, the
//!   released amount is REQUIRED evidence bounded by the authorized max,
//!   the booking carries BOTH figures, hold-timeout is terminal Failed
//!   with zero fee and no replacement.
//! - **LU-6:** the NIP-47 error → ledger-state TOTAL map — every pinned
//!   code has a declared effect; unmapped codes go Unknown (human gate),
//!   never silently open; rate-limited stays OPEN at Intent;
//!   send-disabled refusal leaves ZERO ledger residue.
//! - **CD:** capabilities explicit and bound BEFORE intent construction —
//!   blind sends refused at the manifest, upto mechanisms gate pay_upto
//!   pre-mutation, and the lying-mock negative control is caught by law.

use bpay_rail::capabilities::{
    CapabilityManifest, LnUptoMechanism, MechanismSet, ResponseReadAxis, TransportIdentity,
};
use bpay_rail::ln::{LnRailAdapter, PaymentHash};
use bpay_rail::nwc::{LedgerEffect, NwcRail};
use bpay_rail::nwc_mock::MockNwcTransport;
use bpay_rail::units::MilliSatoshi;
use bpay_rail::{LedgerError, LifecycleState};

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

fn mock_manifest(mechanisms: MechanismSet) -> CapabilityManifest {
    CapabilityManifest {
        identity: TransportIdentity::Mock {
            divergences: &[
                "synchronous request/response",
                "single relay",
                "no ws reconnect",
            ],
        },
        mechanisms,
        response_read: ResponseReadAxis::PostReq,
        sends_enabled: false,
        send_gate_version: 0,
    }
}

// ── LU-5: hold/MPP upto ────────────────────────────────────────────────

#[test]
fn lu5_upto_settles_on_release_bounded_with_both_figures_booked() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);

    let offer = r
        .client
        .make_hold_offer(MilliSatoshi(5_000), LnUptoMechanism::Hold, 3_600);
    // The payer releases LESS than the maximum.
    r.client
        .release_payment(&offer, MilliSatoshi(3_000))
        .unwrap();
    let st = r.pay_upto(&offer, LnUptoMechanism::Hold).unwrap();
    assert_eq!(st, LifecycleState::Settled);
    let booking = r
        .upto_booking(&offer.payment_hash)
        .expect("upto booking recorded");
    assert_eq!(booking.authorized, MilliSatoshi(5_000));
    assert_eq!(booking.released, MilliSatoshi(3_000));
    // The maximum was NEVER turned into an exact charge: both figures
    // survive in the books, distinct by construction.
    assert_ne!(booking.authorized, booking.released);
}

#[test]
fn lu5_released_above_authorized_is_refused_pre_mutation() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);

    let offer = r
        .client
        .make_hold_offer(MilliSatoshi(5_000), LnUptoMechanism::Hold, 3_600);
    // A lying release ABOVE the authorized maximum.
    r.client
        .release_payment(&offer, MilliSatoshi(5_001))
        .unwrap();
    let e = r.pay_upto(&offer, LnUptoMechanism::Hold).unwrap_err();
    assert_eq!(refusal_field(&e), "released_msat");
    let msg = e.to_string();
    assert!(
        msg.contains("5001") && msg.contains("5000"),
        "names both figures: {msg}"
    );
    assert!(
        r.upto_booking(&offer.payment_hash).is_none(),
        "no booking on refusal"
    );
}

#[test]
fn lu5_settle_on_release_only_unreleased_is_incomplete_evidence() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);

    let offer = r
        .client
        .make_hold_offer(MilliSatoshi(5_000), LnUptoMechanism::Hold, 3_600);
    // NO release — the offer is still open.
    let e = r.pay_upto(&offer, LnUptoMechanism::Hold).unwrap_err();
    assert_eq!(refusal_field(&e), "released_msat");
    assert!(
        e.to_string().contains("release"),
        "settle-on-release only: {e}"
    );
    assert!(r.upto_booking(&offer.payment_hash).is_none());
}

#[test]
fn lu5_hold_timeout_terminal_failed_zero_fee_no_replacement() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);

    let offer = r
        .client
        .make_hold_offer(MilliSatoshi(5_000), LnUptoMechanism::Hold, 3_600);
    r.ledger_open_probe(offer.payment_hash, 1_003_600);
    let st = r.fail_hold_timeout(offer.payment_hash).unwrap();
    assert_eq!(st, LifecycleState::Failed);
    // ZERO fee: no fee evidence may ever book for a hold timeout.
    assert_eq!(r.fee_evidence(&offer.payment_hash), None);
    // A late release cannot even REACH the rail: the timeout killed the
    // offer at the payee — the release itself is refused, and the ledger
    // stays terminally Failed (no-replacement at BOTH layers).
    let late = r.client.release_payment(&offer, MilliSatoshi(1_000));
    assert!(late.is_err(), "late release must be refused: {late:?}");
    assert_eq!(r.state(&offer.payment_hash), Some(LifecycleState::Failed));
    let e = r.pay_upto(&offer, LnUptoMechanism::Hold).unwrap_err();
    assert!(
        e.to_string().contains("terminal")
            || e.to_string().contains("Failed")
            || e.to_string().contains("duplicate"),
        "{e}"
    );
    // No replacement: the identity never re-opens.
    let e2 = r.pay_upto(&offer, LnUptoMechanism::Hold).unwrap_err();
    assert!(
        e2.to_string().contains("duplicate") || e2.to_string().contains("terminal"),
        "{e2}"
    );
}

#[test]
fn lu5_mpp_rides_the_same_evidence_law() {
    let mut r = LnRailAdapter::new(MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);

    let offer = r
        .client
        .make_hold_offer(MilliSatoshi(8_000), LnUptoMechanism::Mpp, 3_600);
    r.client
        .release_payment(&offer, MilliSatoshi(2_000))
        .unwrap();
    let st = r.pay_upto(&offer, LnUptoMechanism::Mpp).unwrap();
    assert_eq!(st, LifecycleState::Settled);
    assert_eq!(
        r.upto_booking(&offer.payment_hash),
        Some(bpay_rail::ln::UptoBooking {
            authorized: MilliSatoshi(8_000),
            released: MilliSatoshi(2_000),
        })
    );
}

// ── LU-6: the NIP-47 total map ─────────────────────────────────────────

#[test]
fn lu6_every_pinned_code_has_a_declared_effect_and_all_classes_reach() {
    let codes = bpay_rail::nwc::NIP47_PINNED_CODES;
    assert!(
        codes.len() >= 10,
        "the pinned vocabulary is complete: {codes:?}"
    );
    let mut classes = std::collections::HashSet::new();
    for code in codes {
        let err = bpay_rail::nwc::NwcError::from_code(code, "probe");
        classes.insert(err.ledger_effect());
    }
    assert!(classes.contains(&LedgerEffect::LeaveOpenAtIntent));
    assert!(classes.contains(&LedgerEffect::MarkUnknownHumanGate));
    assert!(classes.contains(&LedgerEffect::TerminalFailedNoFee));
}

#[test]
fn lu6_rate_limited_stays_open_at_intent() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_rate_limited = true;
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    rail.enable_sends();
    let e = rail
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert!(e.to_string().contains("remains open"), "{e}");
    assert_eq!(rail.state(&PaymentHash(hash)), Some(LifecycleState::Intent));
}

#[test]
fn lu6_unmapped_code_goes_unknown_never_silently_open() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_error_code = Some("WAT_9_TOKEN".into()); // not in the vocabulary
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    rail.enable_sends();
    let st = rail
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    assert_eq!(
        st,
        LifecycleState::Unknown,
        "an unmapped code is uncertain — human gate, never a silent open"
    );
}

#[test]
fn lu6_internal_error_goes_unknown() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_error_code = Some("INTERNAL".into());
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    rail.enable_sends();
    let st = rail
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap();
    assert_eq!(st, LifecycleState::Unknown);
}

#[test]
fn lu6_send_disabled_refusal_leaves_zero_ledger_residue() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    let mut rail = NwcRail::new(mock, MilliSatoshi(10_000), MilliSatoshi(1_000), 1_000_000);
    // sends NOT enabled
    let e = rail
        .pay(PaymentHash(hash), &bolt11, expires, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "send_enabled");
    assert_eq!(rail.state(&PaymentHash(hash)), None, "zero residue");
}

// ── CD: manifests bound before intent construction ──────────────────────

#[test]
fn cd_blind_send_manifest_refused_pre_construction() {
    let mut m = mock_manifest(MechanismSet::NONE);
    m.response_read = ResponseReadAxis::None;
    m.sends_enabled = true;
    let err = m.validate().unwrap_err();
    assert!(err.to_string().contains("send-then-blind"), "{err}");
    // The additive bump cannot create a blind send at any version.
    let mut m2 = mock_manifest(MechanismSet::NONE);
    m2.response_read = ResponseReadAxis::None;
    assert!(m2.enable_sends_bump().is_err());
    assert_eq!(m2.send_gate_version, 0, "no version bump on refusal");
}

#[test]
fn cd_pay_upto_requires_a_bound_mechanism_pre_mutation() {
    let mock = MockNwcTransport::new(1_000_000, 500_000);
    let mut manifest = mock_manifest(MechanismSet::NONE); // no upto mechanisms claimed
    manifest.enable_sends_bump().unwrap();
    let mut rail = NwcRail::new_with_manifest(
        mock,
        manifest,
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    let e = rail
        .pay_upto(
            PaymentHash([9; 32]),
            "lnbc-hold",
            MilliSatoshi(5_000),
            LnUptoMechanism::Hold,
            1_003_600,
            1_000_000,
        )
        .unwrap_err();
    assert_eq!(refusal_field(&e), "manifest");
    assert!(
        e.to_string().contains("Hold"),
        "names the missing mechanism: {e}"
    );
    assert_eq!(
        rail.state(&PaymentHash([9; 32])),
        None,
        "zero residue pre-construction"
    );
}

#[test]
fn cd_nwc_upto_settles_bounded_with_release_evidence() {
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_release_msat = Some(2_500); // released below the max
    let mut manifest = mock_manifest(MechanismSet {
        hold: true,
        mpp: false,
    });
    manifest.enable_sends_bump().unwrap();
    let mut rail = NwcRail::new_with_manifest(
        mock,
        manifest,
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    let id = PaymentHash(hash);
    let st = rail
        .pay_upto(
            id,
            &bolt11,
            MilliSatoshi(5_000),
            LnUptoMechanism::Hold,
            expires,
            1_000_000,
        )
        .unwrap();
    assert_eq!(st, LifecycleState::Settled);
    assert_eq!(
        rail.upto_booking(&id),
        Some(bpay_rail::ln::UptoBooking {
            authorized: MilliSatoshi(5_000),
            released: MilliSatoshi(2_500),
        })
    );
    // Missing release evidence on an upto pay is refused, never exact-booked.
    let mut mock2 = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11b, hashb, expiresb) = mock2.mint_invoice(3_600);
    // no next_pay_release_msat — no testimony
    let mut m2 = mock_manifest(MechanismSet {
        hold: true,
        mpp: false,
    });
    m2.enable_sends_bump().unwrap();
    let mut rail2 = NwcRail::new_with_manifest(
        mock2,
        m2,
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    let e = rail2
        .pay_upto(
            PaymentHash(hashb),
            &bolt11b,
            MilliSatoshi(5_000),
            LnUptoMechanism::Hold,
            expiresb,
            1_000_000,
        )
        .unwrap_err();
    assert_eq!(refusal_field(&e), "released_msat", "{e}");
}

#[test]
fn cd_lying_mock_negative_control_caught_by_law() {
    // A manifest CLAIMS Hold support; the mock's behavior never emits a
    // release. The lie must surface as a typed evidence refusal — never
    // as a silently exact-charged settlement.
    let mut mock = MockNwcTransport::new(1_000_000, 500_000);
    let (bolt11, hash, expires) = mock.mint_invoice(3_600);
    mock.next_pay_no_fees = false;
    // deliberately NOT setting next_pay_release_msat
    let mut manifest = mock_manifest(MechanismSet {
        hold: true,
        mpp: true,
    });
    manifest.enable_sends_bump().unwrap();
    let mut rail = NwcRail::new_with_manifest(
        mock,
        manifest,
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    let e = rail
        .pay_upto(
            PaymentHash(hash),
            &bolt11,
            MilliSatoshi(7_000),
            LnUptoMechanism::Hold,
            expires,
            1_000_000,
        )
        .unwrap_err();
    assert_eq!(
        refusal_field(&e),
        "released_msat",
        "the claim was a lie: {e}"
    );
}
