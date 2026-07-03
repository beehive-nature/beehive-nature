//! chain-eos Phase 1 binary: connect to a SHIP WebSocket, stream blocks,
//! print `Block Number: [N], Action Count: [M]` (plus extracted action
//! names). The protocol engine lives in the library (`stream_ship`) where
//! the mock-server integration test exercises it; this binary owns only
//! endpoint selection, retry policy, and printing.
//!
//! Endpoint: `SHIP_WS_URL` env var, else `ws://127.0.0.1:8080` (the nodeos
//! `state-history-endpoint` default). No public jungle4 SHIP endpoint
//! exists (see STATUS) — the expected first real target is a local
//! single-node chain.
//!
//! Watermark (§6 stretch): the last processed block number is persisted to
//! `SHIP_WATERMARK_FILE` (default `chain-eos.watermark`); on restart the
//! stream resumes from watermark + 1 instead of re-asking for head.

use std::path::PathBuf;
use std::time::Duration;

use chain_eos::{extract_actions, stream_ship, summarize_signed_block, StreamEvent};

const DEFAULT_WS_URL: &str = "ws://127.0.0.1:8080";
const MAX_BACKOFF: Duration = Duration::from_secs(60);

fn watermark_path() -> PathBuf {
    std::env::var("SHIP_WATERMARK_FILE")
        .unwrap_or_else(|_| "chain-eos.watermark".to_string())
        .into()
}

fn load_watermark(path: &PathBuf) -> Option<u32> {
    std::fs::read_to_string(path)
        .ok()?
        .trim()
        .parse::<u32>()
        .ok()
}

#[tokio::main]
async fn main() {
    let url = std::env::var("SHIP_WS_URL").unwrap_or_else(|_| DEFAULT_WS_URL.to_string());
    let watermark = watermark_path();
    let mut backoff = Duration::from_secs(1);

    loop {
        let resume_from = load_watermark(&watermark).map(|n| n + 1);
        match resume_from {
            Some(n) => eprintln!("chain-eos: connecting to {url}, resuming from block {n}"),
            None => eprintln!("chain-eos: connecting to {url}, starting from head"),
        }
        let wm = watermark.clone();
        let result = stream_ship(&url, resume_from, |event| {
            if let StreamEvent::Block { block_num, .. } = &event {
                // Best-effort checkpoint; a torn write costs one re-read block.
                let _ = std::fs::write(&wm, block_num.to_string());
            }
            print_event(event);
        })
        .await;
        match result {
            Ok(()) => {
                eprintln!("chain-eos: stream ended cleanly; reconnecting");
                backoff = Duration::from_secs(1);
            }
            Err(e) => {
                eprintln!("chain-eos: error: {e}; retrying in {backoff:?}");
            }
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

fn print_event(event: StreamEvent) {
    match event {
        StreamEvent::AbiReceived { bytes } => {
            eprintln!("chain-eos: received SHIP ABI ({bytes} bytes)");
        }
        StreamEvent::Head { block_num } => {
            eprintln!("chain-eos: streaming from head block {block_num}");
        }
        StreamEvent::Block { block_num, block } => match block.as_deref() {
            Some(bytes) => match summarize_signed_block(bytes) {
                Ok(summary) => {
                    println!(
                        "Block Number: {}, Action Count: {}",
                        block_num, summary.action_count
                    );
                    if summary.action_count > 0 {
                        if let Ok(actions) = extract_actions(bytes) {
                            let shown: Vec<String> = actions
                                .iter()
                                .take(3)
                                .map(|a| format!("{}::{}", a.account, a.name))
                                .collect();
                            let more = if actions.len() > 3 { ", …" } else { "" };
                            eprintln!("  actions: {}{more}", shown.join(", "));
                        }
                    }
                }
                Err(e) => eprintln!("chain-eos: block {block_num} decode error: {e}"),
            },
            None => println!("Block Number: {block_num}, Action Count: [block body not sent]"),
        },
    }
}
