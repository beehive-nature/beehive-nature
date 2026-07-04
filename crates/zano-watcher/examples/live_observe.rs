//! Live zano-watcher proof: observe a REAL testnet wallet's fUSD + native
//! balances over the wallet RPC, map to RawChainAction, normalize, and
//! drive escrow-core to `Funded` — the Zano side of the sense loop, on
//! real chain state.
//!
//! Run (WSL, wallet RPC serving the funded buyer wallet):
//!   WALLET_RPC_URL=http://127.0.0.1:12233/json_rpc \
//!     cargo run -p zano-watcher --example live_observe

use escrow_core::{Escrow, EscrowState, PublicKey};
use escrow_engine::EscrowEngine;
use normalizer::normalize;
use zano_watcher::{OrderContext, ZanoWatcher};

const TESTNET_FUSD: &str = "625829188fa787fb71153aa09d251c162be072eaf5402888032d014d7ad4bf9e"; // TESTNET-ONLY public asset id

fn main() {
    let url = std::env::var("WALLET_RPC_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:12233/json_rpc".into());
    let watcher = ZanoWatcher::new(&url);
    let ctx = OrderContext {
        order_id: "order-live-zano".into(),
        buyer_did: "did:plc:buyer".into(),
        seller_did: "did:plc:seller".into(),
        multisig_address: "tn-buyer-standin".into(),
        asset_id: TESTNET_FUSD.into(),
    };

    // Poll until the wallet has refreshed and the asset is visible.
    let mut raw = None;
    for attempt in 1..=30 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        match watcher.observe_funding(&ctx, now) {
            Ok(Some(r)) => {
                raw = Some(r);
                break;
            }
            Ok(None) => eprintln!("attempt {attempt}: wallet visible, asset not yet observed"),
            Err(e) => eprintln!("attempt {attempt}: {e}"),
        }
        std::thread::sleep(std::time::Duration::from_secs(3));
    }
    let Some(raw) = raw else {
        eprintln!("no observation within budget");
        std::process::exit(1);
    };

    println!("OBSERVED (real testnet, via wallet RPC):");
    println!("  amount (atomic):        {}", raw.data["amount"]);
    println!("  fee_buffer_zano:        {}", raw.data["fee_buffer_zano"]);
    println!("  asset_id:               {}", raw.data["asset_id"]);

    let event = normalize(raw).expect("well-formed").expect("mapped");
    println!("NORMALIZED: {} ({:?})", event.event_id, event.event_type);

    // The escrow demands exactly what the order was for; the observation
    // must satisfy it through the ordinary dual-balance funding check.
    let asset_amount = event_amount(&event);
    let mut engine = EscrowEngine::new();
    engine.register(Escrow::new(
        "order-live-zano",
        "tn-buyer-standin",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        asset_amount,
        Some(TESTNET_FUSD.into()),
        escrow_core::FEE_BUFFER,
        time::OffsetDateTime::UNIX_EPOCH,
    ));

    match engine.apply(&event) {
        Some(applied) if applied.result == Ok(EscrowState::Funded) => {
            println!("ESCROW {}: Ok(Funded)", applied.order_id);
            println!("LIVE PROOF: real Zano testnet balances drove Created -> Funded.");
        }
        other => {
            eprintln!("unexpected engine outcome: {other:?}");
            std::process::exit(1);
        }
    }
}

fn event_amount(event: &shared_types::CanonicalEvent) -> u64 {
    match &event.payload {
        shared_types::EventPayload::Order(o) => o.amount,
        _ => unreachable!("OrderFunded carries an Order payload"),
    }
}
