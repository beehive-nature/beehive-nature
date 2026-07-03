//! The whole ingestion pipeline in one test, every stage production code:
//!
//!   SHIP block bytes → extract_actions → ABI decode → RawChainAction
//!     → normalize → EventBus → consumer sees the CanonicalEvent
//!
//! Until today the ABI decoder was the pipeline's one unglued seam; this
//! test is the glue proof. The assertions at the end trace specific field
//! values (seller DID, amount, listing id) all the way back to the binary
//! action data at the top.

use chain_eos::abi::Abi;
use chain_eos::blobs::{packed_trx_named, put_receipt_for, signed_block};
use chain_eos::extract_actions;
use event_bus::EventBus;
use normalizer::{normalize, RawChainAction};
use shared_types::{EventPayload, EventType, SourceChain};

const BLOCK_NUM: u32 = 7_777;

/// ABI for the subset of `addlisting` the §9.3 mapping consumes.
const LOVISMARKET_ABI: &str = r#"{
    "version": "eosio::abi/1.2",
    "structs": [
        {"name": "addlisting", "base": "", "fields": [
            {"name": "listing_id", "type": "string"},
            {"name": "seller_did", "type": "string"},
            {"name": "category", "type": "string?"},
            {"name": "amount", "type": "uint64"},
            {"name": "asset_id", "type": "string"},
            {"name": "timestamp", "type": "time_point_sec"}
        ]}
    ],
    "actions": [{"name": "addlisting", "type": "addlisting"}]
}"#;

fn put_string(out: &mut Vec<u8>, s: &str) {
    // varuint32 length (all test strings are < 128 bytes) + utf8
    assert!(s.len() < 128);
    out.push(s.len() as u8);
    out.extend_from_slice(s.as_bytes());
}

/// Binary ABI-encoded addlisting payload — the "bytes on chain".
fn addlisting_data() -> Vec<u8> {
    let mut d = Vec::new();
    put_string(&mut d, "listing-42");
    put_string(&mut d, "did:plc:seller");
    d.push(1); // category present
    put_string(&mut d, "hemp-seeds");
    d.extend_from_slice(&5_000_000u64.to_le_bytes());
    put_string(&mut d, "fusd-asset-id");
    d.extend_from_slice(&1_782_000_000u32.to_le_bytes());
    d
}

#[tokio::test]
async fn chain_bytes_reach_a_bus_consumer_as_a_canonical_event() {
    // ---- on-chain reality (synthetic): a block carrying the action ------
    let trx = packed_trx_named(&[("lovismarket", "addlisting", &addlisting_data())]);
    let mut receipt = Vec::new();
    put_receipt_for(&mut receipt, &trx, 0);
    let block = signed_block(BLOCK_NUM, &[receipt]);

    // ---- sense organ: extract the action from block bytes ---------------
    let actions = extract_actions(&block).unwrap();
    assert_eq!(actions.len(), 1);
    let action = &actions[0];
    assert_eq!(action.account, "lovismarket");

    // ---- ABI decode: binary payload → JSON fields ------------------------
    let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
    let data = abi.decode_action(&action.name, &action.data).unwrap();

    // ---- bridge: the adapter's output becomes the normalizer's input ----
    let raw = RawChainAction {
        source_chain: SourceChain::Vaulta,
        contract: action.account.clone(),
        action_name: action.name.clone(),
        data,
        block_num: u64::from(BLOCK_NUM),
        tx_id: action.tx_id.clone(),
    };

    // ---- nervous system: normalize and fan out over the bus -------------
    let bus = EventBus::new(16);
    let mut consumer = bus.subscribe();
    let event = normalize(raw).expect("well-formed").expect("mapped");
    bus.publish(event.clone()).unwrap();

    // ---- consumer: the fact that arrives is the fact that was on chain --
    let seen = consumer.recv().await.unwrap();
    assert_eq!(seen, event);
    assert_eq!(seen.event_type, EventType::ProductListed);
    assert_eq!(seen.source_chain, SourceChain::Vaulta);
    assert_eq!(seen.source_ref, format!("{BLOCK_NUM}:{}", action.tx_id));
    assert_eq!(seen.timestamp, 1_782_000_000);
    let EventPayload::Product(p) = &seen.payload else {
        panic!("expected Product payload");
    };
    assert_eq!(p.listing_id, "listing-42");
    assert_eq!(p.seller_did, "did:plc:seller");
    assert_eq!(p.category.as_deref(), Some("hemp-seeds"));
    assert_eq!(p.amount, Some(5_000_000));
    assert_eq!(p.asset_id.as_deref(), Some("fusd-asset-id"));
}
