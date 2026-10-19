//! harness-sovereign demo binary: the §3 task topology.
//!
//! Parallel tokio tasks per concern, one shared [`EventBus`]:
//! backends (sense adapters) + switch coordinator (the agent loop) +
//! identity + settlement lane + Nostr bridge. A slow subscriber lags and
//! skips — it never blocks the publisher.
//!
//! Configuration is env + flags (keys never argv, never committed):
//! `MODEL_API_KEY`, `TOGETHER_API_KEY`.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use harness_sovereign::backend::OpenAiCompatBackend;
use harness_sovereign::identity::IdentityHook;
use harness_sovereign::nostr::{ensure_demo_key, NostrAdapter, NostrBusBridge};
use harness_sovereign::relay::LocalRelay;
use harness_sovereign::settle::{NostrSettleSink, SettlementLane};
use harness_sovereign::switch::{BusPublisher, RunOutcome, SessionStore, SwitchCoordinator};
use harness_sovereign::tools::Toolset;

use event_bus::EventBus;

fn flag_value(args: &[String], name: &str, default: &str) -> String {
    args.windows(2)
        .find(|pair| pair[0] == name)
        .map(|pair| pair[1].clone())
        .unwrap_or_else(|| default.to_string())
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let workdir = PathBuf::from(flag_value(&args, "--workdir", "runs/demo"));
    let session_id = flag_value(&args, "--session", "demo-1");
    let max_turns: u32 = flag_value(&args, "--max-turns", "12").parse().unwrap_or(12);
    let goal_text = flag_value(
        &args,
        "--goal",
        "Demonstrate provider failover without losing context.",
    );

    let bus = EventBus::new(1024);

    // Sense: three backends, one struct, three configs (spec §4).
    let primary = Arc::new(OpenAiCompatBackend::new(
        "spark-primary",
        "muse-spark-1.3",
        "https://api.meta.ai/v1",
        "MODEL_API_KEY",
    ));
    let secondary = Arc::new(OpenAiCompatBackend::new(
        "openweights-secondary",
        "meta-models/Muse-Spark-Open-816B-A42B",
        "https://api.together.xyz/v1",
        "TOGETHER_API_KEY",
    ));
    let tertiary = Arc::new(OpenAiCompatBackend::new(
        "spark-11-tertiary",
        "muse-spark-1.1",
        "https://api.meta.ai/v1",
        "MODEL_API_KEY",
    ));

    // Identity: F4 boot gate — the signer proves itself before the demo.
    let keys_dir = workdir.join("keys");
    std::fs::create_dir_all(&keys_dir).expect("keys dir");
    let identity = IdentityHook::genesis(&keys_dir).expect("genesis");
    if !identity.selftest() {
        eprintln!("F4 boot gate: bsigner selftest failed — refusing to start");
        std::process::exit(1);
    }
    eprintln!("agent: {}", identity.did());

    // Transport: two local relays (kill one on stage; the bus survives)
    // plus any external relays from --relay (repeatable).
    let relay_a = LocalRelay::bind("127.0.0.1", 0).await.expect("relay r1");
    let relay_b = LocalRelay::bind("127.0.0.1", 0).await.expect("relay r2");
    let mut relay_urls = vec![relay_a.url().to_string(), relay_b.url().to_string()];
    relay_urls.extend(
        args.windows(2)
            .filter(|pair| pair[0] == "--relay")
            .map(|pair| pair[1].clone()),
    );
    eprintln!("relays: {relay_urls:?}");

    // Bridge: bus lifecycle events → Nostr, lag-tolerant.
    let demo_secret = ensure_demo_key(&workdir.join("nostr-keys")).expect("demo key");
    let bridge_rx = bus.subscribe();
    let bridge = NostrBusBridge::new(NostrAdapter::new(
        relay_urls.clone(),
        demo_secret,
        Duration::from_secs(5),
    ));
    tokio::spawn(async move {
        bridge.forward_loop(bridge_rx, demo_secret, unix_secs).await;
    });

    // Settlement lane (R6), receipts fanning out over the same relays.
    let sandbox_dir = workdir.join("sandbox");
    let price_list = workdir.join("prices.json");
    if !price_list.exists() {
        std::fs::write(&price_list, br#"{"demo-task": 500}"#).expect("seed prices");
    }
    let receipt_sink: Arc<dyn harness_sovereign::settle::SettleSink> = Arc::new(
        NostrSettleSink::new(relay_urls, demo_secret, Duration::from_secs(5)),
    );
    let settle = SettlementLane::new(
        &price_list,
        &workdir.join("settle"),
        &session_id,
        identity.clone(),
        10_000,
        "demo-counterparty",
    )
    .expect("settlement lane")
    .with_sink(receipt_sink);
    let toolset = Toolset::new(&sandbox_dir)
        .expect("sandbox")
        .with_settle_lane(settle);

    // The agent loop itself: the switch coordinator.
    let store = SessionStore::new(&workdir, &session_id).expect("session store");
    let publisher = Arc::new(BusPublisher::new(bus, identity.did()));
    let goal = serde_json::json!({
        "objective": goal_text,
        "task_id": session_id,
    });
    let mut coordinator = SwitchCoordinator::new(
        vec![primary, secondary, tertiary],
        store,
        toolset,
        Some(publisher),
        Some(identity),
        goal,
        max_turns,
    );

    let cancel = tokio_util::sync::CancellationToken::new();
    match coordinator.run(cancel).await {
        Ok(RunOutcome::EndTurn) => eprintln!("demo complete: end_turn"),
        Ok(other) => eprintln!("demo complete: {other:?}"),
        Err(error) => {
            eprintln!("demo aborted: {error}");
            std::process::exit(2);
        }
    }
}

fn unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
