//! Integration: a Tier-1 verdict drives the DRO's settlement — the
//! adjudicated split ratio flows into `dro_signer::settlement_intent_for_split`
//! and produces payouts that (a) conserve exactly and (b) differ from the
//! 50/50 default the ratio retires. Every stage is production code:
//! escrow-core transitions the state, dispute-engine adjudicates,
//! dro-signer decides the payouts.

use dispute_engine::{resolve, Dispute, Evidence, Provenance, Side, VerdictType, ViewGrade};
use dro_signer::{settlement_intent, settlement_intent_for_split, Party};
use escrow_core::{
    DeliverySource, Escrow, EscrowEvent, EscrowState, PublicKey, Verdict, FEE_BUFFER,
};
use time::macros::datetime;
use time::Duration;

const AMOUNT: u64 = 9_000_001; // odd: rounding must still conserve

fn resolved_escrow(verdict: Verdict) -> Escrow {
    let t0 = datetime!(2026-07-04 12:00 UTC);
    let mut e = Escrow::new(
        "order-int",
        "msig-int",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        AMOUNT,
        Some("fusd-asset-id".into()),
        FEE_BUFFER,
        t0,
    );
    e.transition(EscrowEvent::BuyerFunded {
        asset_amount: AMOUNT,
        zano_amount: FEE_BUFFER,
        at: t0 + Duration::hours(1),
    })
    .unwrap();
    e.transition(EscrowEvent::SellerShipped {
        tracking: "t".into(),
        carrier: "c".into(),
        at: t0 + Duration::hours(2),
    })
    .unwrap();
    e.transition(EscrowEvent::DeliveryConfirmed {
        timestamp: t0 + Duration::hours(3),
        source: DeliverySource::CarrierScan,
    })
    .unwrap();
    e.transition(EscrowEvent::DisputeOpened {
        reason_hash: "damaged-goods".into(),
        at: t0 + Duration::hours(4),
    })
    .unwrap();
    e.transition(EscrowEvent::DisputeResolved {
        verdict,
        resolution_id: "res-int".into(),
    })
    .unwrap();
    e
}

fn dispute() -> Dispute {
    Dispute {
        order_id: "order-int".into(),
        buyer_did: "did:plc:buyer".into(),
        seller_did: "did:plc:seller".into(),
        amount: AMOUNT,
        asset_id: Some("fusd-asset-id".into()),
        opened_at: 1_782_000_000,
        reason_hash: [9; 32],
        evidence_bucket_refs: vec!["autonomi://vault/order-int".into()],
    }
}

fn item(provenance: Provenance, favors: Side, strong: bool) -> Evidence {
    Evidence {
        provenance,
        confidence: 1.0,
        signed: strong,
        verified: strong,
        payload_hash: [11; 32],
        subject_did: None,
        source_ref: None,
        validator_digest: None,
        view_grade: ViewGrade::Informational,
        favors,
    }
}

#[test]
fn adjudicated_split_ratio_retires_the_fifty_fifty_default() {
    // Buyer-heavy evidence: device attestation vs a bare user claim.
    let verdict = resolve(
        &dispute(),
        &[
            item(Provenance::DeviceAttestation, Side::Buyer, true),
            item(Provenance::UserClaim, Side::Seller, false),
        ],
    );
    assert_eq!(verdict.verdict, VerdictType::Split);
    let ratio = verdict.split_ratio.unwrap();

    // The escrow reached Resolved through the real state machine.
    let escrow = resolved_escrow(Verdict::Split);
    assert_eq!(escrow.state, EscrowState::Resolved);

    // Verdict ratio → settlement.
    let intent = settlement_intent_for_split(&escrow, ratio).expect("conserving ratio");
    let buyer = intent
        .payouts
        .iter()
        .find(|p| p.to == Party::Buyer)
        .unwrap();
    let seller = intent
        .payouts
        .iter()
        .find(|p| p.to == Party::Seller)
        .unwrap();

    // (a) conservation, (b) genuinely different from the 50/50 default.
    assert_eq!(buyer.amount + seller.amount, AMOUNT);
    let default = settlement_intent(&escrow, EscrowState::Resolved).unwrap();
    assert_ne!(
        intent.payouts, default.payouts,
        "an adjudicated ratio must change the payouts"
    );
    assert!(
        buyer.amount > seller.amount,
        "buyer-heavy evidence, buyer-heavy split"
    );
}

#[test]
fn refund_verdict_flows_through_the_existing_state_machine_path() {
    // Uncontradicted high-provenance buyer evidence → RefundBuyer, which
    // maps onto escrow-core's verdict and the existing settlement path.
    let verdict = resolve(
        &dispute(),
        &[
            item(Provenance::CarrierApi, Side::Buyer, true),
            item(Provenance::ChainProof, Side::Buyer, true),
        ],
    );
    assert_eq!(verdict.verdict, VerdictType::RefundBuyer);
    assert!(
        verdict.auto_enforce,
        "clean high-provenance evidence auto-enforces"
    );

    let escrow = resolved_escrow(Verdict::RefundBuyer);
    assert_eq!(escrow.state, EscrowState::Refunded);
    let intent = settlement_intent(&escrow, EscrowState::Refunded).unwrap();
    assert_eq!(intent.payouts.len(), 1);
    assert_eq!(intent.payouts[0].to, Party::Buyer);
    assert_eq!(intent.payouts[0].amount, AMOUNT);
}

#[test]
fn non_conserving_ratio_is_refused_by_the_signer_side() {
    let escrow = resolved_escrow(Verdict::Split);
    assert_eq!(
        settlement_intent_for_split(&escrow, (1, 1)),
        None,
        "a ratio that does not sum to the escrow amount must be refused, never normalized"
    );
    assert_eq!(settlement_intent_for_split(&escrow, (u64::MAX, 2)), None);
}
