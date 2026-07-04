//! The bNature runtime daemon. All wiring lives in the library ([`composition`]);
//! this binary adds environment, Ctrl-C, and the exit report.
//!
//! Run (WSL, next to the runbook's nodeos):
//!   SHIP_WS_URL=ws://127.0.0.1:8080 cargo run -p composition

use composition::{run, PipelineConfig};

#[tokio::main]
async fn main() {
    let ship_url =
        std::env::var("SHIP_WS_URL").unwrap_or_else(|_| "ws://127.0.0.1:8080".to_string());
    eprintln!("composition: starting against {ship_url} (Ctrl-C for graceful shutdown)");
    eprintln!("composition: no escrows registered (order-flow integration is future work)");
    eprintln!(
        "composition: zano ingest idle - watch targets come from order flow (tests exercise it)"
    );

    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            eprintln!("composition: shutdown requested, draining…");
            let _ = shutdown_tx.send(true);
        }
    });

    let report = run(PipelineConfig::new(ship_url), shutdown_rx).await;

    eprintln!("composition: ---- exit report ----");
    eprintln!("composition: blocks seen          {}", report.blocks_seen);
    eprintln!("composition: zano scans           {}", report.zano_scans);
    eprintln!(
        "composition: events published     {}",
        report.events_published
    );
    eprintln!(
        "composition: escrow events seen   {}",
        report.escrow_events_seen
    );
    eprintln!("composition: transitions applied  {}", report.applied.len());
    eprintln!(
        "composition: settlement intents   {}",
        report.settlement_intents.len()
    );
    eprintln!(
        "composition: reputation scores    {}",
        report.reputation.len()
    );
    eprintln!(
        "composition: clean {} shutdown, nothing dropped: {}",
        if report.shutdown_requested {
            "signal"
        } else {
            "stream-end"
        },
        report.events_published == report.escrow_events_seen
            && report.events_published == report.reputation_events_seen
    );
}
