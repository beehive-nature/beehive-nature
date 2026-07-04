//! The composition runtime: wires the proven crates into one process.
//!
//! ```text
//!  SHIP ws ──ingest──▶ extract ─▶ ABI decode ─▶ normalize ─▶ EventBus
//!                                                              │
//!                     ┌────────────────────────────────────────┤
//!                escrow task                             reputation task
//!            (engine.apply per event)                (accumulate → compute)
//!                     │ Applied
//!                 DRO task
//!        (settlement_intent → MockSigner)
//! ```
//!
//! Everything here is *wiring*; every decision lives in the crate that
//! owns it. The pipeline is a library function ([`run`]) so the
//! integration tests drive the whole daemon in-process against a mock
//! SHIP server; `main.rs` adds only env, Ctrl-C, and printing.
//!
//! Shutdown discipline: a shutdown signal stops ingest, then consumers
//! **drain** the bus before exiting — in-flight events are processed,
//! never silently dropped — and the [`PipelineReport`] carries the
//! counts that prove it (`published == escrow_seen == reputation_seen`).
//!
//! v1 boundaries (named, not faked): the ingest decodes `zano::transfer`
//! actions with the embedded ABI below (runtime ABI *fetching* gates on
//! the real-endpoint milestone); the DRO signs with `MockSigner`
//! (firmware gate); reputation's v1 accumulator counts completions and
//! dispute participation for both parties and leaves `resolved_favorable`
//! at 0 (verdict *direction* attribution arrives with the dispute-engine
//! composition — the OrderResolved event does not say who won).

#![forbid(unsafe_code)]

use chain_eos::abi::Abi;
use chain_eos::{extract_actions, stream_ship, StreamEvent};
use dro_signer::{settle_transition, MockChainView, MockSigner, SettlementIntent};
use escrow_core::Escrow;
use escrow_engine::{Applied, EscrowEngine};
use event_bus::EventBus;
use normalizer::{normalize, RawChainAction};
use reputation_engine::{compute, ReputationInput, ReputationScore};
use shared_types::{CanonicalEvent, EventPayload, EventType, SourceChain};
use std::collections::BTreeMap;
use tokio::sync::{mpsc, watch};

/// The same watcher-shaped transfer ABI proven live in item 4 (escrow
/// funding through the real dev chain). Embedded: ABI fetching is a
/// named gate, not an accident.
pub const ZANO_TRANSFER_ABI: &str = r#"{
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

#[derive(Debug, Clone)]
pub struct PipelineConfig {
    pub ship_url: String,
    /// Escrows to track (order flow integration is future work; the
    /// binary starts empty, tests register what they expect).
    pub escrows: Vec<Escrow>,
    pub bus_capacity: usize,
    /// Optional second sense organ: the Zano view-only wallet scanner.
    pub zano: Option<ZanoIngestConfig>,
}

impl PipelineConfig {
    pub fn new(ship_url: impl Into<String>) -> Self {
        PipelineConfig {
            ship_url: ship_url.into(),
            escrows: Vec::new(),
            bus_capacity: 1024,
            zano: None,
        }
    }
}

/// Zano ingest configuration. Deviation from the prompt, API-forced: no
/// `view_key` field — the view key belongs to the wallet-RPC process
/// that opened the view-only wallet, not to this HTTP client; config
/// carries exactly what `ZanoWatcher::observe_funding` consumes.
#[derive(Debug, Clone)]
pub struct ZanoIngestConfig {
    /// Wallet RPC endpoint, e.g. `http://127.0.0.1:12233/json_rpc`.
    pub rpc_url: String,
    pub poll_interval_secs: u64,
    /// Escrow asset id (hex) the watched orders are denominated in.
    pub asset_id: String,
    /// Orders to watch (the order, not the chain, knows identities —
    /// see zano-watcher's module docs).
    pub watch: Vec<ZanoWatchTarget>,
}

#[derive(Debug, Clone)]
pub struct ZanoWatchTarget {
    pub order_id: String,
    pub buyer_did: String,
    pub seller_did: String,
    pub multisig_address: String,
}

/// What one pipeline run saw and decided — the daemon's exit summary and
/// the tests' assertion surface.
#[derive(Debug, Default)]
pub struct PipelineReport {
    pub blocks_seen: u64,
    /// Zano wallet-RPC polls performed (success or failure).
    pub zano_scans: u64,
    pub events_published: u64,
    /// Every event the escrow task consumed (drain proof: == published).
    pub escrow_events_seen: u64,
    pub applied: Vec<Applied>,
    pub settlement_intents: Vec<SettlementIntent>,
    pub reputation_events_seen: u64,
    pub reputation: Vec<ReputationScore>,
    /// True iff the run ended via the shutdown signal (vs stream end).
    pub shutdown_requested: bool,
}

/// Run the wired pipeline until the SHIP stream ends or `shutdown`
/// flips to `true`; then drain consumers and report.
pub async fn run(config: PipelineConfig, mut shutdown: watch::Receiver<bool>) -> PipelineReport {
    let bus = EventBus::new(config.bus_capacity);
    let abi = Abi::from_json(ZANO_TRANSFER_ABI).expect("embedded ABI parses");

    // Internal stop: flipped when ingest finishes for any reason, so
    // consumers know to drain and exit.
    let (stop_tx, stop_rx) = watch::channel(false);
    // Escrow verdicts flow to the DRO task on their own channel: the bus
    // carries facts, this carries decisions.
    let (applied_tx, applied_rx) = mpsc::unbounded_channel::<(Escrow, Applied)>();

    let escrow_task = tokio::spawn(escrow_loop(
        bus.subscribe(),
        config.escrows.clone(),
        applied_tx,
        stop_rx.clone(),
    ));
    let dro_task = tokio::spawn(dro_loop(applied_rx));
    let reputation_task = tokio::spawn(reputation_loop(bus.subscribe(), stop_rx.clone()));

    // Second sense organ: the Zano poll task (both organs feed the same
    // bus; consumers never learn which chain produced an event).
    let zano_task = config
        .zano
        .clone()
        .map(|zc| tokio::spawn(zano_loop(zc, bus.clone(), stop_rx.clone())));

    // ---- ingest (this task) ---------------------------------------------
    let mut blocks_seen = 0u64;
    let mut events_published = 0u64;
    let shutdown_requested;
    {
        let bus = bus.clone();
        let ingest = stream_ship(&config.ship_url, None, |ev| {
            if let StreamEvent::Block {
                block_num,
                block: Some(bytes),
            } = ev
            {
                blocks_seen += 1;
                events_published += publish_block(&bus, &abi, block_num, &bytes);
            }
        });
        tokio::pin!(ingest);
        shutdown_requested = tokio::select! {
            r = &mut ingest => {
                if let Err(e) = r {
                    eprintln!("composition: ingest ended: {e}");
                }
                false
            }
            _ = shutdown.changed() => true,
        };
    }
    // Ingest is done (or abandoned): tell consumers to drain, drop our
    // bus handle so receiver counts fall as consumers finish.
    let _ = stop_tx.send(true);
    drop(bus);

    let (zano_scans, zano_published) = match zano_task {
        Some(task) => task.await.expect("zano task"),
        None => (0, 0),
    };
    let (escrow_events_seen, applied) = escrow_task.await.expect("escrow task");
    let settlement_intents = dro_task.await.expect("dro task");
    let (reputation_events_seen, reputation) = reputation_task.await.expect("reputation task");

    PipelineReport {
        blocks_seen,
        zano_scans,
        events_published: events_published + zano_published,
        escrow_events_seen,
        applied,
        settlement_intents,
        reputation_events_seen,
        reputation,
        shutdown_requested,
    }
}

/// Zano sense organ: poll the view-only wallet RPC per target; a funding
/// observation becomes a canonical event on the same bus the EOS path
/// feeds. Each order emits at most once per run (balance observation is
/// level- not edge-triggered; the state machine would reject duplicates
/// anyway, this just keeps the bus quiet). RPC outages are logged and
/// retried on the next tick — a Zano outage never stops the EOS path.
/// Returns (scans_performed, events_published).
async fn zano_loop(
    config: ZanoIngestConfig,
    bus: EventBus,
    mut stop: watch::Receiver<bool>,
) -> (u64, u64) {
    use std::sync::Arc;
    let watcher = Arc::new(zano_watcher::ZanoWatcher::new(&config.rpc_url));
    let mut emitted: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    let mut scans = 0u64;
    let mut published = 0u64;
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(
        config.poll_interval_secs.max(1),
    ));

    loop {
        tokio::select! {
            _ = tick.tick() => {
                for target in &config.watch {
                    if emitted.contains(&target.order_id) {
                        continue;
                    }
                    scans += 1;
                    let ctx = zano_watcher::OrderContext {
                        order_id: target.order_id.clone(),
                        buyer_did: target.buyer_did.clone(),
                        seller_did: target.seller_did.clone(),
                        multisig_address: target.multisig_address.clone(),
                        asset_id: config.asset_id.clone(),
                    };
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    // ureq is blocking; keep the runtime threads free.
                    let w = Arc::clone(&watcher);
                    let observed = tokio::task::spawn_blocking(move || {
                        w.observe_funding(&ctx, now)
                    })
                    .await
                    .expect("watcher poll task");
                    match observed {
                        Ok(Some(raw)) => match normalize(raw) {
                            Ok(Some(event)) => {
                                println!(
                                    "composition: {} ({:?}) [zano]",
                                    event.event_id, event.event_type
                                );
                                let _ = bus.publish(event);
                                emitted.insert(target.order_id.clone());
                                published += 1;
                            }
                            Ok(None) => {}
                            Err(e) => eprintln!("composition: zano normalizer: {e}"),
                        },
                        Ok(None) => {}
                        Err(e) => eprintln!("composition: zano rpc: {e} (will retry)"),
                    }
                }
            }
            _ = stop.changed() => break,
        }
    }
    (scans, published)
}

/// Decode a block's zano::transfer actions and publish their canonical
/// events. Returns how many events were published.
fn publish_block(bus: &EventBus, abi: &Abi, block_num: u32, bytes: &[u8]) -> u64 {
    let actions = match extract_actions(bytes) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("composition: block {block_num}: extract error: {e}");
            return 0;
        }
    };
    let mut published = 0;
    for action in actions {
        if action.account != "zano" {
            continue; // other contracts gate on their ABIs (lovismarket TBD)
        }
        let data = match abi.decode_action(&action.name, &action.data) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("composition: block {block_num}: abi: {e}");
                continue;
            }
        };
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
                println!("composition: {} ({:?})", event.event_id, event.event_type);
                let _ = bus.publish(event);
                published += 1;
            }
            Ok(None) => {}
            Err(e) => eprintln!("composition: block {block_num}: normalizer: {e}"),
        }
    }
    published
}

/// Escrow consumer: apply every bus event; forward transitions to the DRO.
async fn escrow_loop(
    mut rx: event_bus::Receiver<CanonicalEvent>,
    escrows: Vec<Escrow>,
    applied_tx: mpsc::UnboundedSender<(Escrow, Applied)>,
    mut stop: watch::Receiver<bool>,
) -> (u64, Vec<Applied>) {
    let mut engine = EscrowEngine::new();
    for escrow in escrows {
        engine.register(escrow);
    }
    let mut seen = 0u64;
    let mut applied_log = Vec::new();

    let mut handle = |event: CanonicalEvent, engine: &mut EscrowEngine| {
        seen += 1;
        if let Some(applied) = engine.apply(&event) {
            println!(
                "composition: escrow {} -> {:?}",
                applied.order_id, applied.result
            );
            if let Some(escrow) = engine.get(&applied.order_id) {
                let _ = applied_tx.send((escrow.clone(), applied.clone()));
            }
            applied_log.push(applied);
        }
    };

    loop {
        tokio::select! {
            received = rx.recv() => match received {
                Ok(event) => handle(event, &mut engine),
                Err(_) => break, // closed or lagged-out; drain below
            },
            _ = stop.changed() => break,
        }
    }
    // Drain: nothing in flight is dropped silently.
    while let Ok(event) = rx.try_recv() {
        handle(event, &mut engine);
    }
    (seen, applied_log)
}

/// DRO consumer: fund-moving transitions become settlement intents, each
/// confirmed against an independent chain view before signing (R-004).
/// v1 uses `MockChainView` + `MockSigner` — the firmware/indexer gate.
async fn dro_loop(
    mut applied_rx: mpsc::UnboundedReceiver<(Escrow, Applied)>,
) -> Vec<SettlementIntent> {
    let mut signer = MockSigner::new();
    // v1 stub view (firmware/indexer gate): proves the R-004 seam, not
    // independence — a real view queries nodes disjoint from the ingest path.
    let view = MockChainView::solvent();
    while let Some((escrow, applied)) = applied_rx.recv().await {
        if let Some(outcome) = settle_transition(&escrow, &applied.result, &view, &mut signer) {
            match outcome {
                Ok(signed) => println!(
                    "composition: DRO settlement for {} signed_by={}",
                    applied.order_id, signed.signed_by
                ),
                Err(e) => eprintln!("composition: DRO signer error: {e}"),
            }
        }
    }
    signer.signed
}

/// Reputation consumer: accumulate per-DID inputs, compute at drain.
async fn reputation_loop(
    mut rx: event_bus::Receiver<CanonicalEvent>,
    mut stop: watch::Receiver<bool>,
) -> (u64, Vec<ReputationScore>) {
    #[derive(Default)]
    struct Acc {
        completed: u64,
        disputed: u64,
    }
    let mut accounts: BTreeMap<String, Acc> = BTreeMap::new();
    let mut seen = 0u64;
    let mut last_ts = 0i64;

    let mut handle = |event: CanonicalEvent, accounts: &mut BTreeMap<String, Acc>| {
        seen += 1;
        last_ts = last_ts.max(event.timestamp);
        let EventPayload::Order(order) = &event.payload else {
            return;
        };
        match event.event_type {
            EventType::OrderCompleted => {
                accounts
                    .entry(order.buyer_did.clone())
                    .or_default()
                    .completed += 1;
                accounts
                    .entry(order.seller_did.clone())
                    .or_default()
                    .completed += 1;
            }
            EventType::OrderDisputed | EventType::OrderRefunded | EventType::OrderResolved => {
                accounts
                    .entry(order.buyer_did.clone())
                    .or_default()
                    .disputed += 1;
                accounts
                    .entry(order.seller_did.clone())
                    .or_default()
                    .disputed += 1;
            }
            _ => {}
        }
    };

    loop {
        tokio::select! {
            received = rx.recv() => match received {
                Ok(event) => handle(event, &mut accounts),
                Err(_) => break,
            },
            _ = stop.changed() => break,
        }
    }
    while let Ok(event) = rx.try_recv() {
        handle(event, &mut accounts);
    }

    let reputation = accounts
        .into_iter()
        .map(|(did, acc)| {
            let score = compute(&ReputationInput {
                did,
                completed_escrows: acc.completed,
                disputed_escrows: acc.disputed,
                resolved_favorable: 0, // verdict direction gates on dispute composition
                evidence_submitted: Vec::new(),
                attestations_received: Vec::new(),
                as_of_unix: last_ts,
            });
            println!(
                "composition: reputation {} = {} ({} components)",
                score.did,
                score.score,
                score.components.len()
            );
            score
        })
        .collect();
    (seen, reputation)
}
