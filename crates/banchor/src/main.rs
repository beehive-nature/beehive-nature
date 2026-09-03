//! banchor — bHEartWALLet's SERVING organ.
//!
//! One install, two organs: this one serves (browser, resolution, cache,
//! replay). The deciding organ lives in crates/bheart-signer and NEVER
//! depends on this crate — the wallet works fully with the anchor off.
//!
//! BINARIES:
//!   banchor serve [--http 127.0.0.1:8767] [--stdio]   — the MCP daemon
//!   banchor milestone1 [--url …] [--rich …]           — the walking-skeleton
//!       receipt: drive system Chromium, snapshot a real page, click one
//!       element, save the replay, print the snapshot's TOKEN COUNT
//!   banchor resolve <bnr://name.b | buzz://hive>      — scheme resolution
//!   banchor version
//!
//! MILESTONE 1 DEFAULTS: https://example.com/ (canonical minimal real page)
//! plus https://en.wikipedia.org/wiki/Chromium_(web_browser) as the rich
//! second data point for the local-model question. The receipt replay lands
//! in crates/banchor/replays/ — that file is the acceptance.

mod approval;
mod axtree;
mod b64;
mod browser;
mod cache;
mod cdp;
mod mcp;
mod page;
mod replay;
mod resolve;
mod seat;
mod tokens;
mod untrusted;
mod visibility;

use std::sync::{Arc, Mutex};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("serve") => serve(&args[1..]),
        Some("milestone1") => milestone1(&args[1..]),
        Some("resolve") => resolve_cmd(&args[1..]),
        Some("version") | None => {
            println!(
                "banchor {} — the serving organ of bHEartWALLet",
                env!("CARGO_PKG_VERSION")
            );
            println!("laws: untrusted-data delimiters · strip-hidden · plan-then-approve · no-screenshot durable path · bsigner-independence");
        }
        Some(other) => {
            eprintln!("unknown command {other:?} — serve | milestone1 | resolve | version");
            std::process::exit(2);
        }
    }
}

fn serve(args: &[String]) {
    let state = Arc::new(Mutex::new(seat::SeatState::new()));
    if args.iter().any(|a| a == "--stdio") {
        mcp::serve_stdio(state);
        return;
    }
    let addr = args
        .iter()
        .position(|a| a == "--http")
        .and_then(|i| args.get(i + 1))
        .cloned()
        .unwrap_or_else(|| mcp::DEFAULT_ADDR.to_string());
    if let Err(e) = mcp::serve_http(&addr, state) {
        eprintln!("banchor serve failed on {addr}: {e}");
        std::process::exit(1);
    }
}

fn milestone1(args: &[String]) {
    let mut url = "https://example.com/".to_string();
    let mut rich: Option<String> =
        Some("https://en.wikipedia.org/wiki/Chromium_(web_browser)".to_string());
    let mut replay_dir: Option<String> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--url" if i + 1 < args.len() => {
                url = args[i + 1].clone();
                i += 2;
            }
            "--rich" if i + 1 < args.len() => {
                rich = Some(args[i + 1].clone());
                i += 2;
            }
            "--no-rich" => {
                rich = None;
                i += 1;
            }
            "--replay-dir" if i + 1 < args.len() => {
                replay_dir = Some(args[i + 1].clone());
                i += 2;
            }
            other => {
                eprintln!("milestone1: unknown flag {other:?}");
                std::process::exit(2);
            }
        }
    }
    // receipt replays belong to the tree (committed); runtime sessions to the install home
    let dir = replay_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("replays"));

    match seat::SeatState::milestone1(&url, rich.as_deref(), &dir) {
        Ok(receipt) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&receipt).unwrap_or_default()
            );
            // THE number, said out loud:
            if let Some(n) = receipt
                .pointer("/page/counts/tokens/1/n")
                .and_then(|v| v.as_u64())
            {
                eprintln!(
                    "[milestone1] snapshot token count (cl100k_base): {n} — replay: {}",
                    receipt["replay"].as_str().unwrap_or("?")
                );
            }
        }
        Err(e) => {
            eprintln!("milestone1 FAILED: {e}");
            std::process::exit(1);
        }
    }
}

fn resolve_cmd(args: &[String]) {
    let Some(url) = args.first() else {
        eprintln!("resolve: need a url — bnr://name.b or buzz://hive");
        std::process::exit(2);
    };
    match resolve::resolve_any(url) {
        Ok(record) => println!(
            "{}",
            serde_json::to_string_pretty(&record).unwrap_or_default()
        ),
        Err(e) => {
            eprintln!("resolve FAILED: {e}");
            std::process::exit(1);
        }
    }
}
