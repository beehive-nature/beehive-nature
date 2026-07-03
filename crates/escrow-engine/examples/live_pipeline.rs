//! Live item-4 proof: connect to a real SHIP endpoint, ingest real blocks,
//! and drive a registered escrow through `Created → Funded` from a real
//! on-chain `zano::transfer` action.
//!
//! Run (WSL, next to the nodeos from the runbook):
//!   SHIP_WS_URL=ws://127.0.0.1:8080 cargo run -p escrow-engine --example live_pipeline
//! then push the funding action (see docs/runbooks/local-ship-node.md §4b).
//! Exits 0 the moment the escrow reaches `Funded`; exits 1 after 90s.

use chain_eos::abi::Abi;
use chain_eos::{extract_actions, stream_ship, StreamEvent};
use escrow_core::{Escrow, EscrowState, PublicKey, FEE_BUFFER};
use escrow_engine::EscrowEngine;
use event_bus::EventBus;
use normalizer::{normalize, RawChainAction};
use shared_types::SourceChain;

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

#[tokio::main]
async fn main() {
    let url = std::env::var("SHIP_WS_URL").unwrap_or_else(|_| "ws://127.0.0.1:8080".into());
    let abi = Abi::from_json(ZANO_TRANSFER_ABI).expect("static ABI parses");
    let bus = EventBus::new(64);

    // The consumer: an engine holding the order we expect to see funded.
    let mut rx = bus.subscribe();
    let (done_tx, done_rx) = tokio::sync::oneshot::channel::<()>();
    let consumer = tokio::spawn(async move {
        let mut engine = EscrowEngine::new();
        engine.register(Escrow::new(
            "order-live",
            "msig-live",
            PublicKey([1; 32]),
            PublicKey([2; 32]),
            PublicKey([3; 32]),
            5_000_000,
            Some("fusd-asset-id".into()),
            FEE_BUFFER,
            time::OffsetDateTime::UNIX_EPOCH, // demo escrow; timeouts unused here
        ));
        let mut done = Some(done_tx);
        while let Ok(event) = rx.recv().await {
            eprintln!(
                "bus: {} ({:?}) from {}",
                event.event_id, event.event_type, event.source_ref
            );
            if let Some(applied) = engine.apply(&event) {
                println!("ESCROW {}: {:?}", applied.order_id, applied.result);
                if applied.result == Ok(EscrowState::Funded) {
                    if let Some(tx) = done.take() {
                        let _ = tx.send(());
                    }
                }
            }
        }
    });

    // The ingest: real SHIP stream → extract → decode → normalize → bus.
    let ingest = async {
        let bus = bus.clone();
        let abi = &abi;
        stream_ship(&url, None, move |ev| match ev {
            StreamEvent::AbiReceived { bytes } => eprintln!("ship: ABI ({bytes} bytes)"),
            StreamEvent::Head { block_num } => eprintln!("ship: streaming from {block_num}"),
            StreamEvent::Block { block_num, block } => {
                let Some(bytes) = block else { return };
                let Ok(actions) = extract_actions(&bytes) else {
                    eprintln!("block {block_num}: extract error");
                    return;
                };
                for action in actions {
                    if action.account != "zano" {
                        continue;
                    }
                    match abi.decode_action(&action.name, &action.data) {
                        Ok(data) => {
                            let raw = RawChainAction {
                                source_chain: SourceChain::Zano,
                                contract: action.account.clone(),
                                action_name: action.name.clone(),
                                data,
                                block_num: u64::from(block_num),
                                tx_id: action.tx_id.clone(),
                            };
                            match normalize(raw) {
                                Ok(Some(event)) => {
                                    eprintln!("block {block_num}: normalized {}", event.event_id);
                                    let _ = bus.publish(event);
                                }
                                Ok(None) => {}
                                Err(e) => eprintln!("block {block_num}: normalizer: {e}"),
                            }
                        }
                        Err(e) => eprintln!("block {block_num}: abi: {e}"),
                    }
                }
            }
        })
        .await
    };

    tokio::select! {
        r = ingest => {
            eprintln!("stream ended: {r:?}");
            std::process::exit(1);
        }
        _ = done_rx => {
            println!("LIVE PROOF: real chain bytes drove Created -> Funded. Item 4 complete.");
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(90)) => {
            eprintln!("timed out waiting for the funding action");
            std::process::exit(1);
        }
    }
    consumer.abort();
}
