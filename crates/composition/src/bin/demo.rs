//! bNature escrow-lifecycle demo — one deterministic run of the full order
//! lifecycle over the SAME crates the workspace ships and the SAME in-memory
//! mocks the test suite already exercises. No chain, no network, no new
//! adapters: versioned `CanonicalEvent`s flow across the real `event-bus`,
//! drive the real `escrow-engine` (→ the `escrow-core` state machine), and
//! settlement is produced by the real `dro-signer` against its
//! `MockChainView` / `MockSigner`.
//!
//! Lifecycle (build brief §9.1 state machine, §9.2 fee buffer):
//!   intent → funding (dual-balance §9.2) → evidence attach (ship/deliver)
//!   → settlement/release (Completed → DRO release-to-seller, R-004-gated).
//!
//! Prints a human-readable trace of each versioned `CanonicalEvent`
//! (shared-types §9.3 — the kernel's versioned interface) as it flows.
//! Exits 0 only on a clean full lifecycle; nonzero on any invariant failure.
//!
//!   cargo run -p composition --bin demo

use dro_signer::{settle_transition, MockChainView, MockSigner, Party};
use escrow_core::{Escrow, EscrowError, EscrowState, PublicKey, FEE_BUFFER};
use escrow_engine::EscrowEngine;
use event_bus::EventBus;
use shared_types::{CanonicalEvent, EventPayload, EventType, OrderEvent, SourceChain};
use time::OffsetDateTime;

const ORDER_ID: &str = "demo-order-1";
const WALLET: &str = "demo-msig";
const ASSET: &str = "fusd-asset-id";
const AMOUNT: u64 = 5_000_000;
const BASE_TS: i64 = 1_782_000_000;

/// An Order-family `CanonicalEvent` for the demo order — the shape the
/// normalizer emits and every consumer reads (brief §9.3).
fn order_event(event_type: EventType, ts: i64, fee_buffer_zano: Option<u64>) -> CanonicalEvent {
    CanonicalEvent {
        event_id: format!("evt-{ORDER_ID}-{ts}"),
        event_type,
        timestamp: ts,
        source_chain: SourceChain::Zano,
        source_ref: format!("demo:{ts}"),
        payload: EventPayload::Order(OrderEvent {
            order_id: ORDER_ID.into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            amount: AMOUNT,
            asset_id: ASSET.into(),
            fee_buffer_zano,
            escrow_wallet_id: Some(WALLET.into()),
            tracking: Some("1Z999-DEMO".into()),
            carrier: Some("UPS".into()),
        }),
        canonicalized_by: "demo".into(),
    }
}

/// The escrow the marketplace order flow would register (Created state).
fn demo_escrow() -> Escrow {
    Escrow::new(
        ORDER_ID,
        WALLET,
        PublicKey([0x11; 32]),
        PublicKey([0x22; 32]),
        PublicKey([0x33; 32]),
        AMOUNT,
        Some(ASSET.into()),
        FEE_BUFFER,
        OffsetDateTime::from_unix_timestamp(BASE_TS).expect("valid base timestamp"),
    )
}

/// Trace one versioned `CanonicalEvent` as it flows over the bus.
fn trace(stage: &str, ev: &CanonicalEvent, outcome: &str) {
    println!(
        "[{stage:<10}] CanonicalEvent{{{:?}}}  id={}  src={:?}  ->  {outcome}",
        ev.event_type, ev.event_id, ev.source_chain
    );
}

/// A failed invariant: report and hand back the nonzero exit code.
fn fail(msg: &str) -> i32 {
    eprintln!("\nx INVARIANT FAILED - {msg}");
    eprintln!("lifecycle aborted - exit 1");
    1
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    std::process::exit(run().await);
}

/// Drive the lifecycle. Returns a process exit code: 0 = clean lifecycle,
/// 1 = an invariant failed.
async fn run() -> i32 {
    println!("-- bNature escrow lifecycle demo --------------------------------");
    println!("schema: shared-types §9.3 CanonicalEvent (versioned) · machine: brief §9.1/§9.2\n");

    let bus = EventBus::default();
    let mut rx = bus.subscribe(); // subscribe before publishing (broadcast semantics)
    let mut engine = EscrowEngine::new();

    // ---- intent -----------------------------------------------------------
    // The order exists (registered by marketplace order flow); OrderPlaced is
    // the intent fact on the bus. The engine ignores it (no transition).
    engine.register(demo_escrow());
    let placed = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderPlaced, BASE_TS, None),
    )
    .await;
    if engine.apply(&placed).is_some() {
        return fail("intent: OrderPlaced must not drive a transition");
    }
    match engine.get(ORDER_ID).map(|e| e.state) {
        Some(EscrowState::Created) => {
            trace("intent", &placed, "order registered · escrow @ Created")
        }
        other => return fail(&format!("intent: escrow not Created ({other:?})")),
    }

    // ---- funding guard: §9.2 dual-balance is respected --------------------
    // Partial funding (no observed fee buffer -> native balance 0) is REFUSED,
    // and a rejected transition leaves the escrow untouched.
    let partial = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderFunded, BASE_TS + 100, None),
    )
    .await;
    match engine.apply(&partial).map(|a| a.result) {
        Some(Err(EscrowError::InsufficientFunding { .. })) => trace(
            "guard",
            &partial,
            "partial funding REFUSED (no fee buffer) · escrow stays Created ✓",
        ),
        other => return fail(&format!("guard: partial funding not refused ({other:?})")),
    }
    if engine.get(ORDER_ID).map(|e| e.state) != Some(EscrowState::Created) {
        return fail("guard: a rejected funding must leave the escrow Created");
    }

    // ---- funding: both balances present -> Funded -------------------------
    let funded = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderFunded, BASE_TS + 110, Some(FEE_BUFFER)),
    )
    .await;
    match engine.apply(&funded).map(|a| a.result) {
        Some(Ok(EscrowState::Funded)) => trace(
            "funding",
            &funded,
            &format!("Created->Funded ✓  (§9.2: asset {AMOUNT} ✓, fee_buffer {FEE_BUFFER} ✓)"),
        ),
        other => return fail(&format!("funding: expected Funded ({other:?})")),
    }

    // ---- evidence attach: shipment + delivery -----------------------------
    let shipped = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderShipped, BASE_TS + 200, None),
    )
    .await;
    match engine.apply(&shipped).map(|a| a.result) {
        Some(Ok(EscrowState::Shipped)) => trace(
            "evidence",
            &shipped,
            "Funded->Shipped ✓  (tracking + carrier attached)",
        ),
        other => return fail(&format!("evidence: expected Shipped ({other:?})")),
    }
    let delivered = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderDelivered, BASE_TS + 300, None),
    )
    .await;
    match engine.apply(&delivered).map(|a| a.result) {
        Some(Ok(EscrowState::Delivered)) => trace(
            "evidence",
            &delivered,
            "Shipped->Delivered ✓  (carrier scan)",
        ),
        other => return fail(&format!("evidence: expected Delivered ({other:?})")),
    }

    // ---- settlement / release ---------------------------------------------
    let completed = flow(
        &bus,
        &mut rx,
        order_event(EventType::OrderCompleted, BASE_TS + 400, None),
    )
    .await;
    let completed_result = match engine.apply(&completed) {
        Some(a) if a.result == Ok(EscrowState::Completed) => {
            trace(
                "complete",
                &completed,
                "Delivered->Completed ✓  (buyer release)",
            );
            a.result
        }
        other => return fail(&format!("complete: expected Completed ({other:?})")),
    };

    // The DRO settles the release. R-004: it signs only against a balance it
    // independently confirmed — here the in-memory `MockChainView::solvent()`.
    let escrow = engine.get(ORDER_ID).expect("registered");
    let view = MockChainView::solvent();
    let mut signer = MockSigner::new();
    match settle_transition(escrow, &completed_result, &view, &mut signer) {
        Some(Ok(signed)) => {
            let intent = signer.signed.first().expect("one settlement recorded");
            let payout = intent.payouts.first().expect("a payout leg");
            if intent.payouts.len() != 1 || payout.to != Party::Seller || payout.amount != AMOUNT {
                return fail(&format!(
                    "settlement: expected sole release of {AMOUNT} to Seller, got {:?}",
                    intent.payouts
                ));
            }
            println!(
                "[{:<10}] DRO settle  ->  release {} to {:?}  signed_by={}  (R-004: confirmed vs independent chain view) ✓",
                "settlement", payout.amount, payout.to, signed.signed_by
            );
        }
        other => {
            return fail(&format!(
                "settlement: DRO did not sign a release ({other:?})"
            ))
        }
    }

    println!("\nlifecycle complete - every versioned CanonicalEvent flowed clean - exit 0");
    0
}

/// Publish an event and receive it back off the bus, proving it flowed
/// through the real transport before a consumer sees it.
async fn flow(
    bus: &EventBus,
    rx: &mut event_bus::Receiver<CanonicalEvent>,
    ev: CanonicalEvent,
) -> CanonicalEvent {
    let _ = bus.publish(ev);
    rx.recv().await.expect("bus delivers to a live subscriber")
}
