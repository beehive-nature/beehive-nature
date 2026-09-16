//! R12 harness extensions: L1Surcharge probes + the x402 door probes.
//!
//! Surcharge probes (founder-specified): missing bound, underestimated
//! bound, receipt exceeding declared possibility, UNKNOWN/reconciliation
//! — every refusal names its field, every refusal has a healthy control.
//! x402 probes: the bsigner gate laws (inseparability, per-signature
//! cap, window), and the one-signature split's natural idempotency
//! (duplicate offer -> duplicate identity -> route-to-lookup refusal).

use bpay_rail::evm::{EvmPaymentId, EvmRailAdapter, OpStackReceiptFee};
use bpay_rail::x402::{compose_from_offer, gate, offer_id, AllowEntry, OfferPolicy, PinnedOffer};
use bpay_rail::{LedgerError, LifecycleState};
use watchpay::types::Atto;

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

fn evm() -> EvmRailAdapter {
    let plan = watchpay::plan::validate_plan(
        &watchpay::test_support::base_plan(),
        watchpay::test_support::SYNTH_NOW,
    )
    .unwrap();
    EvmRailAdapter::new(plan, watchpay::test_support::SYNTH_NOW)
}

fn receipt(l1_fee_wei: u64) -> OpStackReceiptFee {
    OpStackReceiptFee {
        l1_gas_used: 2_100,
        l1_gas_price: 20_000_000_000,
        l1_fee_wei: Atto::from_u64(l1_fee_wei),
        l1_fee_scalar_hex: "0x68656c6c6f".into(), // versioned scalar shape (post-Ecotone)
    }
}

const EXP: u64 = watchpay::test_support::SYNTH_NOW + 60_000;

// ── L1Surcharge probes ──────────────────────────────────────────────────

#[test]
fn surcharge_missing_bound_refused() {
    let r = evm();
    // no declared surcharge at all -> the base_gate law
    let e = r.base_gate(None).unwrap_err();
    assert_eq!(refusal_field(&e), "L1Surcharge");
    // healthy control: a declared bound passes the gate
    assert_eq!(
        r.base_gate(Some(Atto::from_u64(1_000))).unwrap().class,
        bpay_rail::FeeClass::L1Surcharge
    );
}

#[test]
fn surcharge_underestimated_bound_refused_before_mutation() {
    let mut r = evm();
    let id = EvmPaymentId {
        nonce: 1,
        tx_hash_hex: "ab".repeat(32),
    };
    // declare a surcharge bound of 100 wei; the receipt carries 101
    r.open_base_intent(id.clone(), Atto::from_u64(100), EXP)
        .unwrap();
    r.stage_base_inflight(&id).unwrap();
    let e = r
        .reconcile_base(&id, &receipt(101), Atto::ZERO)
        .unwrap_err();
    assert_eq!(refusal_field(&e), "L1Surcharge");
    assert!(
        e.to_string().contains("UNDERESTIMATED L1 SURCHARGE BOUND"),
        "{e}"
    );
    // refused BEFORE mutation: state unchanged, reservation unchanged
    assert_eq!(r.state(&id), Some(LifecycleState::InFlight));
    // reservation UNTOUCHED by the refused evidence (still the combined worst case)
    assert!(r.reservation(&id).is_some());
    // healthy control: l1_fee within the bound settles and reconciles DOWN
    let out = r.reconcile_base(&id, &receipt(100), Atto::ZERO).unwrap();
    assert_eq!(out, LifecycleState::Settled);
}

#[test]
fn surcharge_gas_component_possibility_enforced() {
    let mut r = evm();
    let id = EvmPaymentId {
        nonce: 2,
        tx_hash_hex: "cd".repeat(32),
    };
    r.open_base_intent(id.clone(), Atto::from_u64(1_000), EXP)
        .unwrap();
    r.stage_base_inflight(&id).unwrap();
    // gas component beyond the plan's per-tx worst case -> named refusal
    let gas_worst = r.fee_reservation(false).worst_case;
    let e = r
        .reconcile_base(
            &id,
            &receipt(1),
            gas_worst.checked_add(Atto::from_u64(1)).unwrap(),
        )
        .unwrap_err();
    assert_eq!(refusal_field(&e), "gas_paid");
    assert!(e.to_string().contains("impossible gas evidence"));
    // healthy control at exactly the bound (boundary, not above)
    r.reconcile_base(&id, &receipt(0), gas_worst).unwrap();
    assert_eq!(r.state(&id), Some(LifecycleState::Settled));
}

#[test]
fn surcharge_unknown_then_reconciliation_settles() {
    let mut r = evm();
    let id = EvmPaymentId {
        nonce: 3,
        tx_hash_hex: "ef".repeat(32),
    };
    r.open_base_intent(id.clone(), Atto::from_u64(10_000), EXP)
        .unwrap();
    r.stage_base_inflight(&id).unwrap();
    // result unavailable -> Unknown (human gate; NEVER auto-retry)
    r.mark_base_unknown(&id, "rpc outage after submission")
        .unwrap();
    assert_eq!(r.state(&id), Some(LifecycleState::Unknown));
    // evidence arrives later: Unknown -> Settled through the evidence
    // path (expiry blocks NEW intents, never old evidence)
    let out = r
        .reconcile_base(&id, &receipt(1_500), Atto::from_u64(1_000))
        .unwrap();
    assert_eq!(out, LifecycleState::Settled);
    // terminal immutable: further evidence refused by the lifecycle guard
    let e = r.reconcile_base(&id, &receipt(1), Atto::ZERO).unwrap_err();
    assert_eq!(refusal_field(&e), "lifecycle");
    assert!(e.to_string().contains("terminal states immutable"), "{e}");
}

// ── x402 door probes ────────────────────────────────────────────────────

fn policy() -> OfferPolicy {
    OfferPolicy {
        per_signature_cap: Atto::from_u64(10_000),
        window_amount_ceiling: Atto::from_u64(50_000),
        allowlist: vec![AllowEntry {
            pay_to: "0xpayee-1".into(),
            rail: Some("base".into()),
            seller_key_id: "seller-key-A".into(),
        }],
    }
}

fn offer(pay_to: &str, seller: &str, amount: u64) -> PinnedOffer {
    PinnedOffer {
        canonical_bytes: format!("offer:{pay_to}:{seller}:{amount}").into_bytes(),
        pay_to: pay_to.into(),
        seller_key_id: seller.into(),
        amount: Atto::from_u64(amount),
        asset: "USDC".into(),
    }
}

#[test]
fn x402_stranger_signature_under_pinned_destination_refused() {
    // the inseparability law: allowlisted destination + stranger key
    let e = gate(&policy(), &offer("0xpayee-1", "stranger-key", 100)).unwrap_err();
    assert_eq!(refusal_field(&e), "allowlist");
    assert!(e.to_string().contains("inseparable"));
    // healthy control: the pinned pair passes
    gate(&policy(), &offer("0xpayee-1", "seller-key-A", 100)).unwrap();
}

#[test]
fn x402_per_signature_cap_refused_before_signing() {
    let e = gate(&policy(), &offer("0xpayee-1", "seller-key-A", 10_001)).unwrap_err();
    assert_eq!(refusal_field(&e), "per_signature_cap");
    assert!(e.to_string().contains("BEFORE signing"));
    // boundary control: exactly the cap passes
    gate(&policy(), &offer("0xpayee-1", "seller-key-A", 10_000)).unwrap();
}

#[test]
fn x402_window_amount_ceiling_refused() {
    // raise the per-sig cap so only the window binds
    let mut p = policy();
    p.per_signature_cap = Atto::from_u64(1_000_000);
    let e = gate(&p, &offer("0xpayee-1", "seller-key-A", 60_000)).unwrap_err();
    assert_eq!(refusal_field(&e), "window_amount_ceiling");
    assert!(e.to_string().contains("member's hand"));
}

#[test]
fn x402_duplicate_offer_routes_to_lookup_never_recompose() {
    // the ONE-SIGNATURE SPLIT's natural idempotency: same offer bytes
    // -> same identity -> the ledger's idempotency law
    let mut adapter = evm();
    let off = offer("0xpayee-1", "seller-key-A", 500);
    let id1 = compose_from_offer(&mut adapter, &policy(), &off, EXP).unwrap();
    assert_eq!(adapter.state(&id1), Some(LifecycleState::Intent));
    // double submission of the SAME signed body
    let id2 = compose_from_offer(&mut adapter, &policy(), &off, EXP).unwrap_err();
    assert_eq!(refusal_field(&id2), "payment_id");
    assert!(id2.to_string().contains("never re-open"));
    // and the identity is the offer hash — deterministic
    assert_eq!(offer_id(&off), id1);
    // a DIFFERENT offer (different bytes) composes cleanly beside it
    let other = offer("0xpayee-1", "seller-key-A", 600);
    compose_from_offer(&mut adapter, &policy(), &other, EXP).unwrap();
}

#[test]
fn x402_ungated_offer_never_reaches_compose() {
    let mut adapter = evm();
    let bad = offer("0xunknown-dest", "seller-key-A", 1);
    // the gate refuses; compose never opens a ledger intent
    let e = compose_from_offer(&mut adapter, &policy(), &bad, EXP).unwrap_err();
    assert_eq!(refusal_field(&e), "allowlist");
    // no state was created for the refused offer
    assert_eq!(adapter.state(&offer_id(&bad)), None);
}
