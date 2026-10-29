//! harness-sovereign demo binary: the §3 task topology, routed
//! through independent B9 acceptance.
//!
//! Parallel tokio tasks per concern, one shared [`EventBus`]:
//! backends (sense adapters) + switch coordinator (the agent loop) +
//! identity + settlement lane + Nostr bridge. A slow subscriber lags and
//! skips — it never blocks the publisher.
//!
//! Before any model executes, the run freezes its input bytes and
//! establishes the expected order and the public identity material
//! (one [`RunDefinition`]: saved goal, seeded task, order and verifier
//! expectations all derive from it). The agent produces its receipt
//! only through the bounded `b9_receipt` tool. After the run, the
//! executable exports the canonical transcript and checkpoint
//! evidence and accepts the task only via
//! [`harness_sovereign::b9::accept_completed_run`]: missing or invalid
//! evidence exits nonzero, and no receipt is ever generated after an
//! arbitrary `EndTurn`.
//!
//! `--verify-only` is the independent path: it re-checks a finished
//! run's artifacts (frozen manifest, `receipt.json`,
//! `public-material.json`, order) from disk, with no vault, no
//! keystore and no backends.
//!
//! Configuration is env + flags (keys never argv, never committed):
//! `MODEL_API_KEY`, `TOGETHER_API_KEY`.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use harness_sovereign::b9::{accept_completed_run, RunDefinition};
use harness_sovereign::backend::OpenAiCompatBackend;
use harness_sovereign::identity::IdentityHook;
use harness_sovereign::nostr::{ensure_demo_key, NostrAdapter, NostrBusBridge};
use harness_sovereign::relay::LocalRelay;
use harness_sovereign::settle::{NostrSettleSink, SettlementLane};
use harness_sovereign::switch::{
    canonical_messages, transcript_sha256, BusPublisher, SessionStore, SwitchCoordinator,
};
use harness_sovereign::tools::{B9Tool, Toolset};
use harness_sovereign::x0x::{X0xBusBridge, X0xTransport};

use event_bus::EventBus;

fn flag_value(args: &[String], name: &str, default: &str) -> String {
    args.windows(2)
        .find(|pair| pair[0] == name)
        .map(|pair| pair[1].clone())
        .unwrap_or_else(|| default.to_string())
}

fn flag_values(args: &[String], name: &str) -> Vec<String> {
    args.windows(2)
        .filter(|pair| pair[0] == name)
        .map(|pair| pair[1].clone())
        .collect()
}

fn has_flag(args: &[String], name: &str) -> bool {
    args.iter().any(|arg| arg == name)
}

fn write_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| format!("JSON: {e}"))?;
    std::fs::write(path, format!("{text}\n")).map_err(|e| format!("write {}: {e}", path.display()))
}

/// Complete independent verification of a finished saved run, from
/// its on-disk artifacts only. Needs no private keystore: canonical
/// public material, run definition, frozen manifest, saved goal,
/// session transcript, exported evidence, signed checkpoints and the
/// receipt are all checked for mutual agreement and independently
/// verified (see `verify_saved_run`).
fn run_verify_only(args: &[String]) -> Result<harness_sovereign::b9::B9Receipt, String> {
    let workdir = PathBuf::from(flag_value(args, "--workdir", "runs/demo"));
    let session_id = flag_value(args, "--session", "demo-1");
    let isolated = workdir.join("runs").join(&session_id);
    let run_dir = if isolated.is_dir() {
        isolated
    } else if !has_flag(args, "--session") {
        // No session named: discover the single isolated run, if any.
        let runs = workdir.join("runs");
        let mut found: Vec<PathBuf> = std::fs::read_dir(&runs)
            .map(|entries| {
                entries
                    .filter_map(|entry| entry.ok())
                    .map(|entry| entry.path())
                    .filter(|path| path.is_dir())
                    .collect()
            })
            .unwrap_or_default();
        if found.len() == 1 {
            found.pop().expect("one run dir")
        } else {
            workdir.clone()
        }
    } else {
        workdir.clone()
    };
    let expected_order = if has_flag(args, "--order-id") {
        Some(flag_value(args, "--order-id", ""))
    } else {
        None
    };
    let report =
        harness_sovereign::b9::verify_saved_run(&workdir, &run_dir, expected_order.as_deref())?;
    eprintln!(
        "saved-run evidence: checkpoints_verified={} same_actor={} transcript_sha256={}",
        report.checkpoint_signatures_verified, report.same_actor_verified, report.transcript_sha256
    );
    Ok(report.receipt)
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    let args: Vec<String> = std::env::args().collect();

    if has_flag(&args, "--verify-only") {
        match run_verify_only(&args) {
            Ok(receipt) => {
                eprintln!(
                    "B9 ACCEPTANCE PASS (verify-only): order={} input_sha256={} item_count={} did={}",
                    receipt.order_id, receipt.input_sha256, receipt.item_count, receipt.did
                );
            }
            Err(error) => {
                eprintln!("B9 ACCEPTANCE FAIL (verify-only): {error}");
                std::process::exit(3);
            }
        }
        return;
    }

    let workdir = PathBuf::from(flag_value(&args, "--workdir", "runs/demo"));
    let session_id = flag_value(&args, "--session", "demo-1");
    let max_turns: u32 = flag_value(&args, "--max-turns", "12").parse().unwrap_or(12);
    let order_id = flag_value(&args, "--order-id", "B9-DEMO-ORDER-1");

    // Freeze the input bytes and establish the run definition before
    // any model executes.
    let manifest_arg = flag_value(&args, "--manifest", "");
    if manifest_arg.is_empty() {
        eprintln!("B9 run refused: --manifest <path> is required (the frozen input)");
        std::process::exit(2);
    }
    let manifest_bytes = match std::fs::read(&manifest_arg) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("B9 run refused: cannot read manifest {manifest_arg}: {error}");
            std::process::exit(2);
        }
    };

    let bus = EventBus::new(1024);

    // Sense: backends are configuration, not code. `--backend-url`
    // (repeatable, in order) replaces the default three-config set —
    // loopback scripted backends for rehearsal, real endpoints for the
    // live run — through the backend seat's existing constructor.
    let backend_urls = flag_values(&args, "--backend-url");
    let backends: Vec<Arc<dyn harness_sovereign::backend::ModelBackend>> =
        if backend_urls.is_empty() {
            vec![
                Arc::new(OpenAiCompatBackend::new(
                    "spark-primary",
                    "muse-spark-1.3",
                    "https://api.meta.ai/v1",
                    "MODEL_API_KEY",
                )),
                Arc::new(OpenAiCompatBackend::new(
                    "openweights-secondary",
                    "meta-models/Muse-Spark-Open-816B-A42B",
                    "https://api.together.xyz/v1",
                    "TOGETHER_API_KEY",
                )),
                Arc::new(OpenAiCompatBackend::new(
                    "spark-11-tertiary",
                    "muse-spark-1.1",
                    "https://api.meta.ai/v1",
                    "MODEL_API_KEY",
                )),
            ]
        } else {
            let model = flag_value(&args, "--backend-model", "muse-spark-1.3");
            let key_env = flag_value(&args, "--backend-key-env", "MODEL_API_KEY");
            backend_urls
                .iter()
                .enumerate()
                .map(|(index, url)| {
                    Arc::new(OpenAiCompatBackend::new(
                        format!("backend-{}", index + 1),
                        model.clone(),
                        url.clone(),
                        key_env.clone(),
                    )) as Arc<dyn harness_sovereign::backend::ModelBackend>
                })
                .collect()
        };

    // Identity: F4 boot gate — the signer proves itself before the demo.
    let keys_dir = workdir.join("keys");
    std::fs::create_dir_all(&keys_dir).expect("keys dir");
    let vault = harness_sovereign::identity::Vault::from_env("HARNESS_VAULT_REC").unwrap_or_else(
        |error| {
            eprintln!("vault: {error} — set HARNESS_VAULT_REC to the demo recovery code; refusing to start");
            std::process::exit(1);
        },
    );
    let identity = IdentityHook::genesis(&keys_dir, vault).expect("genesis");
    if !identity.selftest() {
        eprintln!("F4 boot gate: bsigner selftest failed — refusing to start");
        std::process::exit(1);
    }
    eprintln!("agent: {}", identity.did());
    let public_material = identity.public_material().expect("public material");

    // One run definition: goal, seeded task, expected order and
    // verifier expectations all derive from these frozen facts.
    let definition =
        match RunDefinition::new(&order_id, &session_id, &manifest_bytes, &public_material) {
            Ok(definition) => definition,
            Err(error) => {
                eprintln!("B9 run refused: {error}");
                std::process::exit(2);
            }
        };
    // Isolated run evidence: every run artifact lives under
    // `runs/<session>/` inside the workdir, so runs sharing a workdir
    // never overwrite each other's definition, material or evidence.
    let run_dir = workdir.join("runs").join(&session_id);
    std::fs::create_dir_all(&run_dir).expect("run dir");
    std::fs::write(run_dir.join("frozen-manifest.bin"), &manifest_bytes).expect("freeze manifest");
    write_json(
        &run_dir.join("public-material.json"),
        &serde_json::to_value(&public_material).expect("material serializes"),
    )
    .expect("export public material");
    write_json(
        &run_dir.join("run-definition.json"),
        &serde_json::to_value(&definition).expect("definition serializes"),
    )
    .expect("write run definition");
    eprintln!(
        "run definition: order={} manifest sha256={} items={} did={}",
        definition.order_id, definition.manifest_sha256, definition.item_count, definition.did
    );

    // Transport: two local relays (kill one on stage; the bus survives)
    // plus any external relays from --relay (repeatable).
    let relay_a = LocalRelay::bind("127.0.0.1", 0).await.expect("relay r1");
    let relay_b = LocalRelay::bind("127.0.0.1", 0).await.expect("relay r2");
    let mut relay_urls = vec![relay_a.url().to_string(), relay_b.url().to_string()];
    relay_urls.extend(flag_values(&args, "--relay"));
    eprintln!("relays: {relay_urls:?}");

    // Bridge: bus lifecycle events -> transport, lag-tolerant. The
    // kernel resolves the technology here (Art. III.5); the harness
    // never names a wire protocol: HARNESS_TRANSPORT=nostr|x0x.
    let demo_secret = ensure_demo_key(&workdir.join("nostr-keys")).expect("demo key");
    let transport_choice =
        std::env::var("HARNESS_TRANSPORT").unwrap_or_else(|_| "nostr".to_string());
    if transport_choice.eq_ignore_ascii_case("x0x") {
        let x0x = X0xTransport::from_env();
        eprintln!("transport: x0x ({})", x0x.api());
        let bridge = X0xBusBridge::new(x0x);
        let bridge_rx = bus.subscribe();
        tokio::spawn(async move {
            bridge.forward_loop(bridge_rx, demo_secret, unix_secs).await;
        });
    } else {
        let bridge = NostrBusBridge::new(NostrAdapter::new(
            relay_urls.clone(),
            demo_secret,
            Duration::from_secs(5),
        ));
        let bridge_rx = bus.subscribe();
        tokio::spawn(async move {
            bridge.forward_loop(bridge_rx, demo_secret, unix_secs).await;
        });
    }

    // Settlement lane (R6), receipts fanning out over the same relays.
    // Settlement stays outside the required B9 demonstration.
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
    let receipt_path = run_dir.join("receipt.json");
    let _ = std::fs::remove_file(&receipt_path);
    let toolset = Toolset::new(&sandbox_dir)
        .expect("sandbox")
        .with_settle_lane(settle)
        .with_b9_tool(B9Tool::new(
            identity.clone(),
            manifest_bytes.clone(),
            definition.order_id.clone(),
            receipt_path.clone(),
        ));
    // The frozen manifest is the agent's input, byte-exact.
    std::fs::write(sandbox_dir.join("input.bin"), &manifest_bytes).expect("freeze sandbox input");

    // Backend health interface, integrated with a bounded wait: each
    // backend's `health()` is probed under a 3 s timeout before model
    // execution and the snapshot is exported as evidence. The probe
    // informs, it does not pre-empt the run — the coordinator's own
    // health monitor and the failover path still do their work, so a
    // primary that dies (or is killed) mid-task fails over with the
    // task and authority preserved.
    let evidence_dir = run_dir.join("evidence");
    std::fs::create_dir_all(&evidence_dir).expect("evidence dir");
    let mut health_snapshot = Vec::new();
    for backend in &backends {
        let healthy = matches!(
            tokio::time::timeout(Duration::from_secs(3), backend.health()).await,
            Ok(true)
        );
        health_snapshot.push(serde_json::json!({
            "backend": backend.name(),
            "model": backend.model_id(),
            "healthy": healthy,
            "probe_timeout_ms": 3000,
        }));
    }
    write_json(
        &evidence_dir.join("backend-health.json"),
        &serde_json::Value::Array(health_snapshot),
    )
    .expect("write backend health");

    // The agent loop itself: the switch coordinator. The saved goal
    // comes from the run definition, so the seeded B9 task (derived
    // from the goal's task_id) names the same order the verifier
    // expects.
    let store = SessionStore::new(&workdir, &session_id).expect("session store");
    let publisher = Arc::new(BusPublisher::new(bus, identity.did()));
    let mut coordinator = SwitchCoordinator::new(
        backends,
        store,
        toolset,
        Some(publisher),
        Some(identity),
        definition.goal(),
        max_turns,
    );

    let cancel = tokio_util::sync::CancellationToken::new();
    // Recovery/run durations are measured on a monotonic clock, never
    // by differencing wall-clock timestamps. The run itself is also a
    // bounded wait: `--run-timeout-secs` (default 900) caps it, and
    // exceeding the bound is an explicit failure, never a hang.
    let run_timeout_secs: u64 = flag_value(&args, "--run-timeout-secs", "900")
        .parse()
        .unwrap_or(900);
    let started = Instant::now();
    let run = match tokio::time::timeout(
        Duration::from_secs(run_timeout_secs),
        coordinator.run(cancel),
    )
    .await
    {
        Ok(run) => run,
        Err(_) => Err(harness_sovereign::switch::CoordError::Store(format!(
            "run exceeded its bounded wait of {run_timeout_secs}s"
        ))),
    };
    let duration_ms = started.elapsed().as_millis();

    // Export canonical transcript + checkpoint evidence: sufficient
    // for verification without the private keystore.
    std::fs::create_dir_all(&evidence_dir).expect("evidence dir");
    let messages = coordinator.store().messages();
    std::fs::write(
        evidence_dir.join("transcript.canonical.txt"),
        canonical_messages(&messages),
    )
    .expect("write transcript evidence");
    std::fs::write(
        evidence_dir.join("transcript.sha256"),
        format!("{}\n", transcript_sha256(&messages)),
    )
    .expect("write transcript hash");
    write_json(
        &evidence_dir.join("checkpoints.json"),
        &serde_json::Value::Array(coordinator.store().read_checkpoints()),
    )
    .expect("write checkpoint evidence");
    write_json(
        &evidence_dir.join("run-outcome.json"),
        &serde_json::json!({
            "order_id": definition.order_id,
            "session_id": definition.session_id,
            "manifest_sha256": definition.manifest_sha256,
            "item_count": definition.item_count,
            "did": definition.did,
            "duration_ms": duration_ms,
            "run": format!("{run:?}"),
        }),
    )
    .expect("write run outcome");

    // Independent B9 acceptance: the only path to a zero exit. No
    // receipt is generated here — the agent must have produced it
    // through the bounded tool during the run.
    match accept_completed_run(
        &run,
        &receipt_path,
        &manifest_bytes,
        &public_material,
        &definition.order_id,
    ) {
        Ok(receipt) => {
            eprintln!(
                "B9 ACCEPTANCE PASS: order={} input_sha256={} item_count={} did={} ({} ms)",
                receipt.order_id,
                receipt.input_sha256,
                receipt.item_count,
                receipt.did,
                duration_ms
            );
        }
        Err(error) => {
            eprintln!("B9 ACCEPTANCE FAIL: {error} (run: {run:?})");
            std::process::exit(3);
        }
    }
}

fn unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
