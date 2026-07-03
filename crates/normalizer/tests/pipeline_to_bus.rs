//! End-to-end nervous-system test: a raw chain action is normalized into a
//! `CanonicalEvent` and fanned out over the event bus to multiple consumers.
//!
//! This is the §6 stretch goal ("prove the bus end-to-end") over the crates
//! that exist today. The action arrives here as-if-ABI-decoded (JSON); the
//! binary-ABI decoding step between `chain_eos::extract_actions` and this
//! input is the one remaining unglued seam, tracked in STATUS.

use event_bus::EventBus;
use normalizer::{normalize, RawChainAction};
use serde_json::json;
use shared_types::{EventPayload, EventType, SourceChain};

fn addlisting_action() -> RawChainAction {
    RawChainAction {
        source_chain: SourceChain::Vaulta,
        contract: "lovismarket".into(),
        action_name: "addlisting".into(),
        data: json!({
            "listing_id": "listing-42",
            "seller_did": "did:plc:seller",
            "category": "hemp-seeds",
            "amount": 5_000_000u64,
            "asset_id": "fusd-asset-id",
            "timestamp": 1_782_000_000i64,
        }),
        block_num: 500,
        tx_id: "abc123".into(),
    }
}

#[tokio::test]
async fn raw_action_reaches_every_bus_consumer_as_canonical_event() {
    let bus = EventBus::new(16);
    let mut dro = bus.subscribe();
    let mut reputation = bus.subscribe();

    // Ingest side: normalize and publish.
    let event = normalize(addlisting_action())
        .expect("well-formed action")
        .expect("mapped action");
    bus.publish(event.clone()).expect("in-memory publish");

    // Consumer side: both independent subscribers get the same fact.
    let seen_by_dro = dro.recv().await.expect("dro receives");
    let seen_by_reputation = reputation.recv().await.expect("reputation receives");

    assert_eq!(seen_by_dro, event);
    assert_eq!(seen_by_reputation, event);
    assert_eq!(seen_by_dro.event_type, EventType::ProductListed);
    assert_eq!(seen_by_dro.event_id, "vaulta-abc123-addlisting");
    assert_eq!(seen_by_dro.source_ref, "500:abc123");
    let EventPayload::Product(p) = &seen_by_dro.payload else {
        panic!("expected Product payload");
    };
    assert_eq!(p.seller_did, "did:plc:seller");
}

#[tokio::test]
async fn unmapped_chain_noise_never_reaches_the_bus() {
    let bus = EventBus::new(16);
    let mut consumer = bus.subscribe();

    let noise = RawChainAction {
        source_chain: SourceChain::Eos,
        contract: "eosio.token".into(),
        action_name: "transfer".into(),
        data: json!({"from": "a", "to": "b"}),
        block_num: 1,
        tx_id: "t".into(),
    };
    // The ingest loop publishes only Some(event) — noise maps to None.
    if let Some(event) = normalize(noise).expect("no malformed fields") {
        bus.publish(event).unwrap();
    }
    // Publish a real event afterwards; it must be the FIRST thing consumers
    // see, proving the noise never entered the bus.
    let real = normalize(addlisting_action()).unwrap().unwrap();
    bus.publish(real.clone()).unwrap();

    assert_eq!(consumer.recv().await.unwrap(), real);
}
