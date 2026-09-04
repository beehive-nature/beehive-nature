//! banchor — bHEartWALLet's SERVING organ.
//!
//! One install, two organs: this one serves (browser, resolution, cache,
//! replay). The deciding organ lives in crates/bsigner and NEVER
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
mod qwen;
mod replay;
mod resolve;
mod seat;
mod tokens;
mod untrusted;
mod visibility;
mod voice;

use std::sync::{Arc, Mutex};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("serve") => serve(&args[1..]),
        Some("milestone1") => milestone1(&args[1..]),
        Some("agentloop") => agentloop_cmd(&args[1..]),
        Some("qwen-count") => qwen_count_cmd(&args[1..]),
        Some("resolve") => resolve_cmd(&args[1..]),
        Some("version") | None => {
            println!(
                "banchor {} — the serving organ of bHEartWALLet",
                env!("CARGO_PKG_VERSION")
            );
            println!("laws: untrusted-data delimiters · strip-hidden · plan-then-approve · no-screenshot durable path · bsigner-independence");
        }
        Some(other) => {
            eprintln!("unknown command {other:?} — serve | milestone1 | agentloop | qwen-count | resolve | version");
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

/// M2 — count files with the compute lane's own Qwen2.5 tokenizer, beside
/// the local BPE bracket. THE ruler for the Agent-Mode question.
fn qwen_count_cmd(args: &[String]) {
    if args.is_empty() {
        eprintln!("qwen-count: need one or more snapshot text files");
        std::process::exit(2);
    }
    let model = match qwen::Qwen::from_env() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("qwen-count FAILED: {e}");
            std::process::exit(1);
        }
    };
    let mut rows = Vec::new();
    for f in args {
        let text = match std::fs::read_to_string(f) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("qwen-count FAILED: read {f}: {e}");
                std::process::exit(1);
            }
        };
        let local = tokens::count(&text);
        let q = match model.tokenize(&text) {
            Ok(n) => n,
            Err(e) => {
                eprintln!("qwen-count FAILED: {e}");
                std::process::exit(1);
            }
        };
        rows.push(json_row(f, &text, local, q));
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "tokenizer": {
                "alg": qwen::TOKENIZER_ALG,
                "served_model": model.alias,
                "artifact": model.model_path,
                "n_ctx": model.n_ctx,
                "source": "llama.cpp /tokenize on the compute node, via the Lane-M meter gate",
            },
            "files": rows,
        }))
        .unwrap_or_default()
    );
}

fn json_row(f: &str, text: &str, local: tokens::Counts, q: usize) -> serde_json::Value {
    let mut counts = local.to_json();
    if let Some(arr) = counts.get_mut("tokens").and_then(|t| t.as_array_mut()) {
        arr.push(serde_json::json!({ "alg": qwen::TOKENIZER_ALG, "n": q }));
    }
    let _ = text;
    serde_json::json!({ "file": f, "counts": counts })
}

/// M2 — the first real loop: snapshot → local qwen2.5-3b → one chosen
/// action → replay. Nothing spends; plan-then-approve stays in force.
fn agentloop_cmd(args: &[String]) {
    let mut url = "https://example.com/".to_string();
    let mut goal =
        "Click the link that leads to more information about example domains.".to_string();
    let mut max_turns: u32 = 3;
    let mut replay_dir: Option<String> = None;
    let mut expect_substr: Option<String> = None;
    let mut goal_audio: Option<String> = None;
    let mut capture_seconds: u32 = 5;
    let mut keep_audio = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--url" if i + 1 < args.len() => {
                url = args[i + 1].clone();
                i += 2;
            }
            "--goal" if i + 1 < args.len() => {
                goal = args[i + 1].clone();
                i += 2;
            }
            "--goal-audio" if i + 1 < args.len() => {
                goal_audio = Some(args[i + 1].clone());
                i += 2;
            }
            "--capture-seconds" if i + 1 < args.len() => {
                capture_seconds = args[i + 1].parse().unwrap_or(5);
                i += 2;
            }
            "--keep-audio" => {
                keep_audio = true;
                i += 1;
            }
            "--max-turns" if i + 1 < args.len() => {
                max_turns = args[i + 1].parse().unwrap_or(3);
                i += 2;
            }
            "--replay-dir" if i + 1 < args.len() => {
                replay_dir = Some(args[i + 1].clone());
                i += 2;
            }
            "--expect-substr" if i + 1 < args.len() => {
                expect_substr = Some(args[i + 1].clone());
                i += 2;
            }
            other => {
                eprintln!("agentloop: unknown flag {other:?}");
                std::process::exit(2);
            }
        }
    }
    // VOICE IN: a spoken goal (mic → wav → whisper.cpp on the estate's own
    // iron) replaces the typed goal; provenance rides every replay
    let mut goal_provenance: Option<serde_json::Value> = None;
    if let Some(ref audio) = goal_audio {
        let mic_capture = audio == "mic";
        let wav = if mic_capture {
            let tmp = std::env::temp_dir().join("banchor-voice-goal.wav");
            if let Err(e) = voice::capture_mic(&tmp, capture_seconds) {
                eprintln!("agentloop FAILED: {e}");
                std::process::exit(1);
            }
            tmp
        } else {
            std::path::PathBuf::from(audio)
        };
        // MIC HYGIENE: ambient captures are deleted after transcription
        // (transcript + digest stay in the receipt) unless --keep-audio
        let keep_raw = keep_audio || voice::hygiene_keep_raw(!mic_capture);
        match voice::goal_from_audio(&wav, keep_raw) {
            Ok((transcript, provenance)) => {
                eprintln!("[agentloop] voice goal: \"{transcript}\"");
                goal = transcript;
                goal_provenance = Some(provenance);
            }
            Err(e) => {
                eprintln!("agentloop FAILED: {e}");
                std::process::exit(1);
            }
        }
    }
    let dir = replay_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("replays"));
    match seat::agentloop(
        &url,
        &goal,
        max_turns,
        &dir,
        expect_substr.as_deref(),
        goal_provenance,
    ) {
        Ok(receipt) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&receipt).unwrap_or_default()
            );
            eprintln!(
                "[agentloop] right_ref={} executed={} turns={} — replay: {}",
                receipt["right_ref"],
                receipt["executed"],
                receipt["turns_taken"],
                receipt["replay"].as_str().unwrap_or("?")
            );
        }
        Err(e) => {
            eprintln!("agentloop FAILED: {e}");
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
