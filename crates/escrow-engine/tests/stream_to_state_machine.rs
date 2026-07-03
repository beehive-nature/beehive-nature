//! Sequence item 4, proven end-to-end: SHIP wire bytes drive the escrow
//! state machine. Every stage is production code:
//!
//!   mock SHIP server → stream_ship → extract_actions → ABI decode →
//!     RawChainAction → normalize → EventBus → EscrowEngine →
//!       escrow_core::transition  (Created → Funded)
//!
//! Two orders ride the same block: one fully funded (asset + fee buffer →
//! `Funded`), one with no fee buffer observed (§9.2 partial funding →
//! rejected, stays `Created`). The state machine, not the pipeline, is
//! what accepts or refuses — the pipeline just delivers facts.

use chain_eos::abi::Abi;
use chain_eos::blobs::{
    blocks_result_blob, packed_trx_named, put_receipt_for, signed_block, status_result_blob,
};
use chain_eos::{extract_actions, stream_ship, StreamEvent};
use escrow_core::{Escrow, EscrowState, PublicKey, FEE_BUFFER};
use escrow_engine::EscrowEngine;
use event_bus::EventBus;
use futures_util::{SinkExt, StreamExt};
use normalizer::{normalize, RawChainAction};
use shared_types::SourceChain;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

const HEAD: u32 = 9_000;
const AMOUNT: u64 = 5_000_000;

/// ABI for the zano-watcher-shaped `transfer` action (§9.3 OrderFunded).
const ZANO_TRANSFER_ABI: &str = r#"{
    "version": "eosio::abi/1.2",
    "structs": [
        {"name": "transfer", "base": "", "fields": [
            {"name": "order_id", "type": "string"},
            {"name": "buyer_did", "type": "string"},
            {"name": "seller_did", "type": "string"},
            {"name": "amount", "type": "uint64"},
            {"name": "asset_id", "type": "string"},
            {"name": "fee_buffer_zano", "type": "uint64?"},
            {"name": "multisig_address", "type": "string"},
            {"name": "timestamp", "type": "time_point_sec"}
        ]}
    ],
    "actions": [{"name": "transfer", "type": "transfer"}]
}"#;

fn put_str(out: &mut Vec<u8>, s: &str) {
    assert!(s.len() < 128);
    out.push(s.len() as u8);
    out.extend_from_slice(s.as_bytes());
}

/// ABI-encoded funding payload; `fee_buffer` None = watcher saw no native
/// balance (optional absent on the wire).
fn transfer_data(order_id: &str, fee_buffer: Option<u64>) -> Vec<u8> {
    let mut d = Vec::new();
    put_str(&mut d, order_id);
    put_str(&mut d, "did:plc:buyer");
    put_str(&mut d, "did:plc:seller");
    d.extend_from_slice(&AMOUNT.to_le_bytes());
    put_str(&mut d, "fusd-asset-id");
    match fee_buffer {
        Some(v) => {
            d.push(1);
            d.extend_from_slice(&v.to_le_bytes());
        }
        None => d.push(0),
    }
    put_str(&mut d, "msig-addr-1");
    d.extend_from_slice(&1_782_000_100u32.to_le_bytes());
    d
}

fn funding_block() -> Vec<u8> {
    let trx = packed_trx_named(&[
        (
            "zano",
            "transfer",
            &transfer_data("order-full", Some(FEE_BUFFER)),
        ),
        ("zano", "transfer", &transfer_data("order-partial", None)),
    ]);
    let mut receipt = Vec::new();
    put_receipt_for(&mut receipt, &trx, 0);
    signed_block(HEAD, &[receipt])
}

async fn mock_ship_server(listener: TcpListener) {
    let (stream, _) = listener.accept().await.unwrap();
    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
    ws.send(Message::Text(
        r#"{"version":"eosio::state_history"}"#.into(),
    ))
    .await
    .unwrap();
    let _status_req = ws.next().await.unwrap().unwrap();
    ws.send(Message::Binary(status_result_blob(HEAD, HEAD - 1).into()))
        .await
        .unwrap();
    let _blocks_req = ws.next().await.unwrap().unwrap();
    ws.send(Message::Binary(
        blocks_result_blob(HEAD, Some(&funding_block())).into(),
    ))
    .await
    .unwrap();
    ws.close(None).await.unwrap();
}

fn escrow(order_id: &str) -> Escrow {
    Escrow::new(
        order_id,
        "msig-addr-1",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        AMOUNT,
        Some("fusd-asset-id".into()),
        FEE_BUFFER,
        time::OffsetDateTime::from_unix_timestamp(1_782_000_000).unwrap(),
    )
}

#[tokio::test]
async fn ship_bytes_drive_the_escrow_state_machine() {
    // --- the world -------------------------------------------------------
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(mock_ship_server(listener));

    // --- the kernel ------------------------------------------------------
    let abi = Abi::from_json(ZANO_TRANSFER_ABI).unwrap();
    let bus = EventBus::new(16);
    let mut engine_rx = bus.subscribe();
    let mut engine = EscrowEngine::new();
    engine.register(escrow("order-full"));
    engine.register(escrow("order-partial"));

    // --- ingest: stream real-shaped wire bytes and publish facts ---------
    let mut blocks = Vec::new();
    stream_ship(&format!("ws://{addr}"), None, |e| {
        if let StreamEvent::Block {
            block_num,
            block: Some(bytes),
        } = e
        {
            blocks.push((block_num, bytes));
        }
    })
    .await
    .unwrap();
    server.await.unwrap();

    for (block_num, bytes) in &blocks {
        for action in extract_actions(bytes).unwrap() {
            let data = abi.decode_action(&action.name, &action.data).unwrap();
            let raw = RawChainAction {
                source_chain: SourceChain::Zano,
                contract: action.account.clone(),
                action_name: action.name.clone(),
                data,
                block_num: u64::from(*block_num),
                tx_id: action.tx_id.clone(),
            };
            if let Some(event) = normalize(raw).unwrap() {
                bus.publish(event).unwrap();
            }
        }
    }

    // --- consume: the engine replays facts into state machines -----------
    let mut applied = Vec::new();
    while let Ok(event) = engine_rx.try_recv() {
        if let Some(a) = engine.apply(&event) {
            applied.push(a);
        }
    }

    // --- the verdicts ----------------------------------------------------
    assert_eq!(applied.len(), 2, "both funding events reached the engine");
    assert_eq!(applied[0].order_id, "order-full");
    assert_eq!(applied[0].result, Ok(EscrowState::Funded));
    assert_eq!(applied[1].order_id, "order-partial");
    assert!(
        applied[1].result.is_err(),
        "partial funding must be refused"
    );

    assert_eq!(engine.get("order-full").unwrap().state, EscrowState::Funded);
    assert_eq!(
        engine.get("order-partial").unwrap().state,
        EscrowState::Created,
        "rejected funding leaves the escrow untouched"
    );
    // Funding timestamp came off the wire, through the whole pipeline:
    assert_eq!(
        engine.get("order-full").unwrap().funded_at,
        Some(time::OffsetDateTime::from_unix_timestamp(1_782_000_100).unwrap())
    );
}
