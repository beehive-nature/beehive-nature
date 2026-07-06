//! bNature escrow-lifecycle demo — deterministic runs over the SAME crates the
//! workspace ships and the SAME in-memory mocks the test suite exercises. No
//! chain, no network, no new adapters.
//!
//! **Scenario 1 — happy path.** Versioned `CanonicalEvent`s (shared-types §9.3)
//! flow across the real `event-bus`, drive the real `escrow-engine` (→ the
//! `escrow-core` state machine), and settlement is produced by the real
//! `dro-signer` against `MockChainView` / `MockSigner`:
//!   intent → funding (dual-balance §9.2) → evidence (ship/deliver) →
//!   settlement/release (Completed → DRO release-to-seller, R-004-gated).
//!
//! **Scenario 2 — dispute branch.** Evidence assembled via `dispute-engine`'s
//! `MockProvider`; `adjudicate`/`resolve` produce a provenance-weighted
//! verdict; settlement flows through the R-004 gate honoring the verdict. Two
//! cases prove the invariants: a chain-proof verdict that AUTO-ENFORCES, and a
//! user-claim verdict that ESCALATES (user claims never auto-enforce; one
//! chain proof outranks a claim). This is the DRO/dispute lane — the
//! bus-consumer `escrow-engine` is happy-path-only by its own design, so the
//! dispute transitions drive `escrow-core` directly.
//!
//! **Scenario 3 — reputation (independent scenario).** The three lifecycle
//! outcomes are *modeled as inputs* here (not piped from scenarios 1–2) and
//! drive the real `reputation-engine`: reputation is EMERGENT (recomputed from
//! event-derived inputs via `recompute`/`MockStore`, never written), the
//! component vector is canonical (`score` is one projection of it), and
//! attestations are Sybil-deduplicated per attester (per-DID dedup;
//! distinct-identity rings are out of scope for this demo).
//!
//! Exits 0 only if ALL THREE scenarios complete clean; nonzero on any invariant
//! failure.  `cargo run -p composition --bin demo`

use dispute_engine::{adjudicate, Dispute, Evidence, MockProvider, Provenance, Side, VerdictType};
use dro_signer::{
    settle_transition, settlement_intent_for_split, IndependentChainView, MockChainView,
    MockSigner, MultisigContext, Party, ZanoSigner,
};
use escrow_core::{
    DeliverySource, Escrow, EscrowError, EscrowEvent, EscrowState, PublicKey, Verdict, FEE_BUFFER,
};
use escrow_engine::EscrowEngine;
use event_bus::EventBus;
use reputation_engine::{
    recompute, verify_attestations, Attestation, MockStore, MockVerifier, ReputationInput,
    SCORE_MAX,
};
use shared_types::{CanonicalEvent, EventPayload, EventType, OrderEvent, SourceChain};
use time::OffsetDateTime;

const WALLET: &str = "demo-msig";
const ASSET: &str = "fusd-asset-id";
const AMOUNT: u64 = 5_000_000;
const BASE_TS: i64 = 1_782_000_000;

fn ts(unix: i64) -> OffsetDateTime {
    OffsetDateTime::from_unix_timestamp(unix).expect("valid unix timestamp")
}

/// An Order-family `CanonicalEvent` — the shape the normalizer emits (§9.3).
/// `amount` is a parameter so the funding guard can drive the zero-asset case;
/// every other call site passes `AMOUNT`.
fn order_event(
    order_id: &str,
    event_type: EventType,
    ts_secs: i64,
    fee: Option<u64>,
    amount: u64,
) -> CanonicalEvent {
    CanonicalEvent {
        event_id: format!("evt-{order_id}-{ts_secs}"),
        event_type,
        timestamp: ts_secs,
        source_chain: SourceChain::Zano,
        source_ref: format!("demo:{ts_secs}"),
        payload: EventPayload::Order(OrderEvent {
            order_id: order_id.into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            amount,
            asset_id: ASSET.into(),
            fee_buffer_zano: fee,
            escrow_wallet_id: Some(WALLET.into()),
            tracking: Some("1Z999-DEMO".into()),
            carrier: Some("UPS".into()),
        }),
        canonicalized_by: "demo".into(),
    }
}

/// The escrow the marketplace order flow would register (Created state).
fn demo_escrow(order_id: &str) -> Escrow {
    Escrow::new(
        order_id,
        WALLET,
        PublicKey([0x11; 32]),
        PublicKey([0x22; 32]),
        PublicKey([0x33; 32]),
        AMOUNT,
        Some(ASSET.into()),
        FEE_BUFFER,
        ts(BASE_TS),
    )
}

fn trace(stage: &str, ev: &CanonicalEvent, outcome: &str) {
    println!(
        "[{stage:<10}] CanonicalEvent{{{:?}}}  id={}  src={:?}  ->  {outcome}",
        ev.event_type, ev.event_id, ev.source_chain
    );
}

fn fail(msg: &str) -> i32 {
    eprintln!("\nx INVARIANT FAILED - {msg}");
    eprintln!("demo aborted - exit 1");
    1
}

/// Publish an event and receive it back off the bus, proving it flowed through
/// the real transport before a consumer sees it.
async fn flow(
    bus: &EventBus,
    rx: &mut event_bus::Receiver<CanonicalEvent>,
    ev: CanonicalEvent,
) -> CanonicalEvent {
    let _ = bus.publish(ev);
    rx.recv().await.expect("bus delivers to a live subscriber")
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    std::process::exit(run().await);
}

async fn run() -> i32 {
    println!("-- bNature escrow lifecycle demo --------------------------------");
    println!("schema: shared-types §9.3 CanonicalEvent (versioned) · machine: brief §9.1/§9.2");

    println!("\n=== SCENARIO 1 — happy path (bus → engine → DRO release) ===");
    if let Err(e) = happy_path().await {
        return fail(&e);
    }

    println!("\n=== SCENARIO 2 — dispute branch (provenance-weighted adjudication) ===");
    if let Err(e) = dispute_branch() {
        return fail(&e);
    }

    println!("\n=== SCENARIO 3 — reputation (independent scenario: lifecycle outcomes modeled as inputs, not piped from 1–2 · emergent · Sybil-deduped) ===");
    if let Err(e) = reputation_flow() {
        return fail(&e);
    }

    println!("\nall three scenarios complete clean - exit 0");
    0
}

// ---------------------------------------------------------------------------
// Scenario 1 — happy path, driven through the event-bus + escrow-engine.
// ---------------------------------------------------------------------------
async fn happy_path() -> Result<(), String> {
    let order = "demo-order-1";
    let bus = EventBus::default();
    let mut rx = bus.subscribe();
    let mut engine = EscrowEngine::new();

    // intent: the order exists (registered by order flow); OrderPlaced is the
    // intent fact on the bus, which the engine ignores (no transition).
    engine.register(demo_escrow(order));
    let placed = flow(
        &bus,
        &mut rx,
        order_event(order, EventType::OrderPlaced, BASE_TS, None, AMOUNT),
    )
    .await;
    if engine.apply(&placed).is_some() {
        return Err("intent: OrderPlaced must not drive a transition".into());
    }
    if engine.get(order).map(|e| e.state) != Some(EscrowState::Created) {
        return Err("intent: escrow must be @ Created".into());
    }
    trace("intent", &placed, "order registered · escrow @ Created");

    // funding guard, half 1 — §9.2 dual-balance: fee buffer absent (native
    // ZANO 0) → refused, escrow untouched.
    let no_fee = flow(
        &bus,
        &mut rx,
        order_event(order, EventType::OrderFunded, BASE_TS + 100, None, AMOUNT),
    )
    .await;
    match engine.apply(&no_fee).map(|a| a.result) {
        Some(Err(EscrowError::InsufficientFunding { .. })) => trace(
            "guard",
            &no_fee,
            "no-fee funding REFUSED (native balance 0) · escrow stays Created ✓",
        ),
        other => return Err(format!("guard: no-fee funding not refused ({other:?})")),
    }
    if engine.get(order).map(|e| e.state) != Some(EscrowState::Created) {
        return Err("guard: a rejected funding must leave the escrow Created".into());
    }

    // funding guard, half 2 — the converse: asset amount 0 with fee present is
    // ALSO refused (the AND needs BOTH halves), proving the check isn't
    // one-sided.
    let no_asset = flow(
        &bus,
        &mut rx,
        order_event(
            order,
            EventType::OrderFunded,
            BASE_TS + 105,
            Some(FEE_BUFFER),
            0,
        ),
    )
    .await;
    match engine.apply(&no_asset).map(|a| a.result) {
        Some(Err(EscrowError::InsufficientFunding { .. })) => trace(
            "guard",
            &no_asset,
            "zero-asset funding REFUSED (asset amount 0) · escrow stays Created ✓",
        ),
        other => return Err(format!("guard: zero-asset funding not refused ({other:?})")),
    }
    if engine.get(order).map(|e| e.state) != Some(EscrowState::Created) {
        return Err("guard: a rejected zero-asset funding must leave the escrow Created".into());
    }

    // funding: both balances present -> Funded.
    let funded = flow(
        &bus,
        &mut rx,
        order_event(
            order,
            EventType::OrderFunded,
            BASE_TS + 110,
            Some(FEE_BUFFER),
            AMOUNT,
        ),
    )
    .await;
    match engine.apply(&funded).map(|a| a.result) {
        Some(Ok(EscrowState::Funded)) => trace(
            "funding",
            &funded,
            &format!("Created->Funded ✓  (§9.2: asset {AMOUNT} ✓, fee_buffer {FEE_BUFFER} ✓)"),
        ),
        other => return Err(format!("funding: expected Funded ({other:?})")),
    }

    // evidence attach: shipment + delivery.
    let shipped = flow(
        &bus,
        &mut rx,
        order_event(order, EventType::OrderShipped, BASE_TS + 200, None, AMOUNT),
    )
    .await;
    match engine.apply(&shipped).map(|a| a.result) {
        Some(Ok(EscrowState::Shipped)) => trace(
            "evidence",
            &shipped,
            "Funded->Shipped ✓  (tracking + carrier)",
        ),
        other => return Err(format!("evidence: expected Shipped ({other:?})")),
    }
    let delivered = flow(
        &bus,
        &mut rx,
        order_event(
            order,
            EventType::OrderDelivered,
            BASE_TS + 300,
            None,
            AMOUNT,
        ),
    )
    .await;
    match engine.apply(&delivered).map(|a| a.result) {
        Some(Ok(EscrowState::Delivered)) => trace(
            "evidence",
            &delivered,
            "Shipped->Delivered ✓  (carrier scan)",
        ),
        other => return Err(format!("evidence: expected Delivered ({other:?})")),
    }

    // settlement / release.
    let completed = flow(
        &bus,
        &mut rx,
        order_event(
            order,
            EventType::OrderCompleted,
            BASE_TS + 400,
            None,
            AMOUNT,
        ),
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
        other => return Err(format!("complete: expected Completed ({other:?})")),
    };

    let escrow = engine.get(order).ok_or("registered escrow missing")?;
    let view = MockChainView::solvent();
    let mut signer = MockSigner::new();
    match settle_transition(escrow, &completed_result, &view, &mut signer) {
        Some(Ok(signed)) => {
            let intent = signer.signed.first().ok_or("no settlement recorded")?;
            let payout = intent.payouts.first().ok_or("no payout leg")?;
            if intent.payouts.len() != 1 || payout.to != Party::Seller || payout.amount != AMOUNT {
                return Err(format!(
                    "settlement: expected sole release {AMOUNT} to Seller, got {:?}",
                    intent.payouts
                ));
            }
            println!(
                "[{:<10}] DRO settle  ->  release {} to {:?}  signed_by={}  (R-004: confirmed vs independent chain view) ✓",
                "settlement", payout.amount, payout.to, signed.signed_by
            );
        }
        other => {
            return Err(format!(
                "settlement: DRO did not sign a release ({other:?})"
            ))
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Scenario 2 — dispute branch: dispute-engine adjudicates, dro-signer settles.
// ---------------------------------------------------------------------------

/// An evidence item, matching dispute-engine's own test shape.
fn ev(provenance: Provenance, favors: Side, strong: bool) -> Evidence {
    Evidence {
        provenance,
        confidence: 1.0,
        signed: strong,
        verified: strong,
        payload_hash: [11; 32],
        favors,
    }
}

/// Drive a fresh escrow to `Disputed` through the real state machine. Returns
/// `Result` so a setup failure surfaces through the binary's one error contract
/// rather than a panic.
fn escrow_to_disputed(order_id: &str) -> Result<Escrow, String> {
    let mut e = demo_escrow(order_id);
    e.transition(EscrowEvent::BuyerFunded {
        asset_amount: AMOUNT,
        zano_amount: FEE_BUFFER,
        at: ts(BASE_TS + 100),
    })
    .map_err(|err| format!("fund: {err}"))?;
    e.transition(EscrowEvent::SellerShipped {
        tracking: "1Z999-DEMO".into(),
        carrier: "UPS".into(),
        at: ts(BASE_TS + 200),
    })
    .map_err(|err| format!("ship: {err}"))?;
    e.transition(EscrowEvent::DeliveryConfirmed {
        timestamp: ts(BASE_TS + 300),
        source: DeliverySource::CarrierScan,
    })
    .map_err(|err| format!("deliver: {err}"))?;
    e.transition(EscrowEvent::DisputeOpened {
        reason_hash: "damaged-goods".into(),
        at: ts(BASE_TS + 400),
    })
    .map_err(|err| format!("dispute open: {err}"))?;
    Ok(e)
}

fn dispute_for(order_id: &str) -> Dispute {
    Dispute {
        order_id: order_id.into(),
        buyer_did: "did:plc:buyer".into(),
        seller_did: "did:plc:seller".into(),
        amount: AMOUNT,
        asset_id: Some(ASSET.into()),
        opened_at: BASE_TS + 400,
        reason_hash: [7; 32],
        evidence_bucket_refs: vec!["autonomi://vault/demo".into()],
    }
}

fn to_escrow_verdict(v: VerdictType) -> Verdict {
    match v {
        VerdictType::RefundBuyer => Verdict::RefundBuyer,
        VerdictType::ReleaseToSeller => Verdict::ReleaseToSeller,
        VerdictType::Split => Verdict::Split,
    }
}

fn dispute_branch() -> Result<(), String> {
    // -- 2a: uncontested high-provenance buyer evidence -> RefundBuyer, AUTO-ENFORCES.
    {
        let order = "dispute-A";
        let mut e = escrow_to_disputed(order)?;
        let provider = MockProvider {
            evidence: vec![
                ev(Provenance::ChainProof, Side::Buyer, true),
                ev(Provenance::CarrierApi, Side::Buyer, true),
            ],
        };
        let verdict =
            adjudicate(&dispute_for(order), &provider).map_err(|e| format!("2a: provider: {e}"))?;
        if verdict.verdict != VerdictType::RefundBuyer || !verdict.auto_enforce {
            return Err(format!(
                "2a: expected auto-enforced RefundBuyer, got {:?} auto_enforce={}",
                verdict.verdict, verdict.auto_enforce
            ));
        }
        println!(
            "[dispute-2a] evidence: ChainProof + CarrierApi (buyer, high-provenance) -> verdict {:?}, confidence {:.3}",
            verdict.verdict, verdict.confidence
        );
        println!(
            "             AUTO-ENFORCED ✓  (confidence {:.3} > {} · winning side all high-provenance · no same-class conflict)",
            verdict.confidence, dispute_engine::AUTO_ENFORCE_THRESHOLD
        );

        let applied = e.transition(EscrowEvent::DisputeResolved {
            verdict: to_escrow_verdict(verdict.verdict),
            resolution_id: "res-A".into(),
        });
        if applied != Ok(EscrowState::Refunded) {
            return Err(format!("2a: escrow did not reach Refunded ({applied:?})"));
        }
        let view = MockChainView::solvent();
        let mut signer = MockSigner::new();
        match settle_transition(&e, &Ok(EscrowState::Refunded), &view, &mut signer) {
            Some(Ok(signed)) => {
                let intent = signer.signed.first().ok_or("2a: no settlement recorded")?;
                let payout = intent.payouts.first().ok_or("2a: no payout leg")?;
                if payout.to != Party::Buyer || payout.amount != AMOUNT {
                    return Err(format!(
                        "2a: expected full refund to Buyer, got {:?}",
                        intent.payouts
                    ));
                }
                println!(
                    "[dispute-2a] settle  ->  refund {} to {:?}  signed_by={}  (R-004 ✓)",
                    payout.amount, payout.to, signed.signed_by
                );
            }
            other => return Err(format!("2a: settlement failed ({other:?})")),
        }
    }

    // -- 2b: buyer device-attestation vs seller user-claim -> Split, ESCALATES.
    {
        let order = "dispute-B";
        let mut e = escrow_to_disputed(order)?;
        let provider = MockProvider {
            evidence: vec![
                ev(Provenance::DeviceAttestation, Side::Buyer, true),
                ev(Provenance::UserClaim, Side::Seller, false),
            ],
        };
        let verdict =
            adjudicate(&dispute_for(order), &provider).map_err(|e| format!("2b: provider: {e}"))?;
        if verdict.verdict != VerdictType::Split || verdict.auto_enforce {
            return Err(format!(
                "2b: expected escalated Split, got {:?} auto_enforce={}",
                verdict.verdict, verdict.auto_enforce
            ));
        }
        let (buyer_amt, seller_amt) = verdict
            .split_ratio
            .ok_or("2b: split verdict carries no ratio")?;
        println!(
            "[dispute-2b] evidence: DeviceAttestation(buyer) vs UserClaim(seller) -> verdict {:?}, confidence {:.3}",
            verdict.verdict, verdict.confidence
        );
        println!(
            "             ESCALATED to Tier-2 (auto_enforce=false)  (a Split always gets a human look; a UserClaim can never auto-enforce — the DeviceAttestation outweighs it {buyer_amt}:{seller_amt}, but the claim forces review, not auto-settlement)"
        );

        let applied = e.transition(EscrowEvent::DisputeResolved {
            verdict: to_escrow_verdict(verdict.verdict),
            resolution_id: "res-B".into(),
        });
        if applied != Ok(EscrowState::Resolved) {
            return Err(format!("2b: escrow did not reach Resolved ({applied:?})"));
        }

        // Settle the ADJUDICATED split (not the 50/50 default) through the R-004
        // gate: build the intent from the verdict's ratio, confirm the balance
        // via the independent chain view, then sign — `sign_settlement` runs the
        // shared `dro_signer::reconcile` check (wallet + asset + covering
        // balance) before it produces bytes. The error string stays literal: a
        // `None` here has several possible causes, so it does not assert one.
        let intent = settlement_intent_for_split(&e, (buyer_amt, seller_amt))
            .ok_or("2b: settlement_intent_for_split returned None")?;
        let ctx = MultisigContext {
            multisig_wallet_id: e.multisig_wallet_id.clone(),
            asset_id: e.asset_id.clone(),
        };
        let view = MockChainView::solvent();
        let confirmed = view
            .confirm(&ctx)
            .map_err(|err| format!("2b: chain view unavailable: {err}"))?;
        let mut signer = MockSigner::new();
        let signed = signer
            .sign_settlement(&intent, &confirmed)
            .map_err(|err| format!("2b: R-004 refused the settlement: {err}"))?;

        // Prove each payout leg matches the adjudicated verdict BEFORE the trace
        // is allowed to claim it: a 50/50 fallback that ignored the ratio would
        // fail here rather than print a false "honored the verdict".
        let total: u64 = intent.payouts.iter().map(|p| p.amount).sum();
        if total != AMOUNT {
            return Err(format!(
                "2b: split payouts sum {total} != escrow amount {AMOUNT}"
            ));
        }
        if intent.payouts.len() != 2 {
            return Err(format!(
                "2b: expected 2 payout legs, got {}",
                intent.payouts.len()
            ));
        }
        let buyer_payout = intent
            .payouts
            .iter()
            .find(|p| p.to == Party::Buyer)
            .ok_or("2b: no buyer payout leg")?;
        let seller_payout = intent
            .payouts
            .iter()
            .find(|p| p.to == Party::Seller)
            .ok_or("2b: no seller payout leg")?;
        if buyer_payout.amount != buyer_amt {
            return Err(format!(
                "2b: buyer payout {} != adjudicated buyer_amt {buyer_amt} — verdict ratio not honored",
                buyer_payout.amount
            ));
        }
        if seller_payout.amount != seller_amt {
            return Err(format!(
                "2b: seller payout {} != adjudicated seller_amt {seller_amt} — verdict ratio not honored",
                seller_payout.amount
            ));
        }

        println!(
            "[dispute-2b] settle  ->  adjudicated split {buyer_amt} buyer / {seller_amt} seller (sum {total} ✓)  signed_by={}  (R-004 ✓ · verdict ratio verified, not assumed)",
            signed.signed_by
        );
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Scenario 3 — reputation (independent scenario): the lifecycle outcomes are
// modeled as inputs here (not piped from scenarios 1–2) and drive the real
// reputation-engine. Reputation is EMERGENT (recomputed from event-derived
// inputs, never written), the component vector is canonical (`score` is one
// projection), and attestations are Sybil-deduplicated per attester (per-DID
// dedup; distinct-identity rings are out of scope for this demo).
// ---------------------------------------------------------------------------

/// A third-party attestation; `signature_valid` is left false and stamped by a
/// verifier below (the only sanctioned validity path), never hand-set here.
fn attestation(attester: &str, subject: &str) -> Attestation {
    Attestation {
        attester_did: attester.into(),
        attested_did: subject.into(),
        claim: "reliable-counterparty".into(),
        timestamp: BASE_TS + 500,
        signature_valid: false,
    }
}

fn reputation_flow() -> Result<(), String> {
    const AS_OF: i64 = BASE_TS + 1000;
    const SELLER: &str = "did:plc:seller";
    const BUYER: &str = "did:plc:buyer";

    // The b-indexer would replay each DID's CanonicalEvents into a
    // ReputationInput; here we load the inputs THIS demo's three lifecycle
    // outcomes produce, then drive the real engine. Attributing an escrow
    // outcome to a DID is an indexer/app-layer choice (the kernel's
    // reputation-engine is agnostic) — the demo's attribution is stated inline.

    // Seller: S1 completed (delivered -> released); 2a and 2b both went to
    // dispute and neither resolved in the seller's favor; the seller's only
    // evidence was a UserClaim in 2b.
    let seller_input = ReputationInput {
        did: SELLER.into(),
        completed_escrows: 1,
        disputed_escrows: 2,
        resolved_favorable: 0,
        evidence_submitted: vec![ev(Provenance::UserClaim, Side::Seller, false)],
        attestations_received: vec![],
        as_of_unix: AS_OF,
    };

    // Buyer: 2a resolved in the buyer's favor (RefundBuyer); high-provenance
    // evidence across 2a/2b. Plus a Sybil probe on the attestations: ten from
    // ONE attester DID and one from another — validity stamped by the verifier,
    // dedup enforced by compute.
    let verifier = MockVerifier {
        valid_attesters: vec!["did:plc:sybil-ring".into(), "did:plc:honest-peer".into()],
    };
    let mut raw_atts: Vec<Attestation> = (0..10)
        .map(|_| attestation("did:plc:sybil-ring", BUYER))
        .collect();
    raw_atts.push(attestation("did:plc:honest-peer", BUYER));
    let buyer_atts = verify_attestations(raw_atts, &verifier);

    let buyer_input = ReputationInput {
        did: BUYER.into(),
        completed_escrows: 0,
        disputed_escrows: 2,
        resolved_favorable: 1,
        evidence_submitted: vec![
            ev(Provenance::ChainProof, Side::Buyer, true),
            ev(Provenance::CarrierApi, Side::Buyer, true),
            ev(Provenance::DeviceAttestation, Side::Buyer, true),
        ],
        attestations_received: buyer_atts,
        as_of_unix: AS_OF,
    };

    // Reputation is RECOMPUTED from the store, never written into it.
    let store = MockStore {
        inputs: vec![seller_input, buyer_input],
    };
    let seller =
        recompute(SELLER, AS_OF, &store).map_err(|e| format!("3: seller recompute: {e}"))?;
    let buyer = recompute(BUYER, AS_OF, &store).map_err(|e| format!("3: buyer recompute: {e}"))?;

    // Stated once in the trace itself (not only in source): the hash-display
    // caveat and the Sybil-dedup scope boundary.
    println!(
        "[reputation] note: component hashes below are shown as the first 8 of 64 hex chars (display only — the transparency check asserts the full 64-hex commitment); Sybil dedup is per-DID, so distinct-identity rings are out of scope for this demo."
    );

    // Trace the emergent projections + their canonical component vectors.
    for who in [&seller, &buyer] {
        println!(
            "[reputation] {} -> score {} / {}  ({} components)",
            who.did,
            who.score,
            SCORE_MAX,
            who.components.len()
        );
        for c in &who.components {
            println!(
                "             {:<28} {:+}  (hash {}…)",
                c.source,
                c.contribution,
                &c.evidence_hash[..8]
            );
        }
    }

    // (1) Emergent + deterministic: recompute is bit-for-bit repeatable.
    let seller_again =
        recompute(SELLER, AS_OF, &store).map_err(|e| format!("3: seller recompute: {e}"))?;
    if seller_again != seller {
        return Err("3: reputation is not deterministic across recompute".into());
    }

    // (2) The score is exactly one projection: the clamped component sum.
    for who in [&seller, &buyer] {
        let sum: i64 = who.components.iter().map(|c| c.contribution).sum();
        let projected = sum.clamp(0, SCORE_MAX as i64) as u64;
        if who.score != projected {
            return Err(format!(
                "3: {} score {} != clamped component sum {}",
                who.did, who.score, projected
            ));
        }
    }

    // (3) Transparency: every point traces to a 64-hex commitment.
    for who in [&seller, &buyer] {
        for c in &who.components {
            if c.evidence_hash.len() != 64 {
                return Err(format!(
                    "3: {} component {} lacks a sha256 commitment",
                    who.did, c.source
                ));
            }
        }
    }

    // (4) Sybil resistance: ten attestations from one DID + one from another
    // yield exactly TWO attestation components (deduped per attester), not
    // eleven — a ring of one identity cannot manufacture reputation.
    let att_components = buyer
        .components
        .iter()
        .filter(|c| c.source.starts_with("attestation:"))
        .count();
    if att_components != 2 {
        return Err(format!(
            "3: expected 2 deduped attestation components, got {att_components}"
        ));
    }

    // (5) Never assigned: a DID with no history is zero, not fabricated.
    let ghost = recompute("did:plc:ghost", AS_OF, &store).map_err(|e| format!("3: {e}"))?;
    if ghost.score != 0 || !ghost.components.is_empty() {
        return Err("3: an unknown DID must be zero-history, not fabricated".into());
    }

    // The disputes sink the seller to the floor (25 - 80 + 2 -> clamped 0); the
    // buyer's favorable resolution + high-provenance evidence + two honest
    // attesters net positive (-80 + 30 + 40 + 40 = 30).
    if seller.score != 0 {
        return Err(format!(
            "3: expected seller floored at 0, got {}",
            seller.score
        ));
    }
    if buyer.score != 30 {
        return Err(format!("3: expected buyer 30, got {}", buyer.score));
    }
    println!(
        "[reputation] invariants ✓  (emergent · projection = clamped Σ · every point hashed · Sybil-deduped · unknown DID = 0)  seller floored {} / buyer {}",
        seller.score, buyer.score
    );

    Ok(())
}
