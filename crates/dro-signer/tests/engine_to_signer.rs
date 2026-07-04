//! Full-circle orchestration: CanonicalEvents drive the EscrowEngine, and
//! every applied transition is offered to the DRO. The signer must
//! receive exactly the fund-moving intents and nothing else — the escrow
//! lifecycle's quiet steps (funded, shipped, delivered) settle nothing.

use dro_signer::{settle_transition, MockChainView, MockSigner, Party};
use escrow_core::{Escrow, PublicKey, FEE_BUFFER};
use escrow_engine::EscrowEngine;
use shared_types::{CanonicalEvent, EventPayload, EventType, OrderEvent, SourceChain};

const AMOUNT: u64 = 8_000_000;

fn escrow(order_id: &str) -> Escrow {
    Escrow::new(
        order_id,
        "msig-e2e",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        AMOUNT,
        Some("fusd-asset-id".into()),
        FEE_BUFFER,
        time::OffsetDateTime::from_unix_timestamp(1_782_000_000).unwrap(),
    )
}

fn order_event(order_id: &str, event_type: EventType, ts: i64) -> CanonicalEvent {
    CanonicalEvent {
        event_id: format!("evt-{order_id}-{ts}"),
        event_type,
        timestamp: ts,
        source_chain: SourceChain::Zano,
        source_ref: format!("0:{ts}"),
        payload: EventPayload::Order(OrderEvent {
            order_id: order_id.into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            amount: AMOUNT,
            asset_id: "fusd-asset-id".into(),
            fee_buffer_zano: Some(FEE_BUFFER),
            escrow_wallet_id: Some("msig-e2e".into()),
            tracking: Some("1Z".into()),
            carrier: Some("UPS".into()),
        }),
        canonicalized_by: "normalizer".into(),
    }
}

#[test]
fn happy_path_yields_exactly_one_settlement_release_to_seller() {
    let mut engine = EscrowEngine::new();
    engine.register(escrow("order-e2e"));
    let mut signer = MockSigner::new();
    let view = MockChainView::solvent();

    let lifecycle = [
        (EventType::OrderFunded, 1_782_000_100),
        (EventType::OrderShipped, 1_782_000_200),
        (EventType::OrderDelivered, 1_782_000_300),
        (EventType::OrderCompleted, 1_782_000_400),
    ];

    for (ty, ts) in lifecycle {
        let applied = engine
            .apply(&order_event("order-e2e", ty, ts))
            .expect("registered order");
        // Every applied transition is offered to the DRO; it decides.
        let escrow = engine.get("order-e2e").unwrap().clone();
        settle_transition(&escrow, &applied.result, &view, &mut signer);
    }

    // Four transitions happened; exactly ONE moved funds.
    assert_eq!(signer.signed.len(), 1, "only Completed settles");
    let intent = &signer.signed[0];
    assert_eq!(intent.order_id, "order-e2e");
    assert_eq!(intent.payouts.len(), 1);
    assert_eq!(intent.payouts[0].to, Party::Seller);
    assert_eq!(intent.payouts[0].amount, AMOUNT);
}

#[test]
fn rejected_partial_funding_never_reaches_the_signer() {
    let mut engine = EscrowEngine::new();
    engine.register(escrow("order-partial"));
    let mut signer = MockSigner::new();
    let view = MockChainView::solvent();

    // No fee buffer observed → engine applies, state machine refuses.
    let mut ev = order_event("order-partial", EventType::OrderFunded, 1_782_000_100);
    if let EventPayload::Order(o) = &mut ev.payload {
        o.fee_buffer_zano = None;
    }
    let applied = engine.apply(&ev).expect("registered order");
    assert!(applied.result.is_err(), "partial funding is refused");

    let escrow = engine.get("order-partial").unwrap().clone();
    assert!(settle_transition(&escrow, &applied.result, &view, &mut signer).is_none());
    assert!(signer.signed.is_empty(), "refusals never settle");
}
