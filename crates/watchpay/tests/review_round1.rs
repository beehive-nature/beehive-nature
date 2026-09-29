//! Executable regressions for the z2.b R1 re-review (review of f70a4b2d,
//! 2026-09-12). Both probes were reproduced failing 0/2 at f70a4b2d.
//!
//! Probe 1 (`v.approve_ceiling = …` on a live handle) no longer COMPILES
//! after the fix: the reviewer sanctioned compile-time immutability as
//! the fix form ("make validated state and derived fields private,
//! exposing immutable getters … compile-time immutability is acceptable
//! if the mutation API is eliminated"). The shipped regression below
//! asserts the semantic consequence the probe was after — an excessive
//! approval composed outside the seal is refused by the transaction
//! validator — beside healthy approval controls.
//!
//! Probe 2 is verbatim in semantics (helpers adapted to the immutable
//! getters): impossible fee evidence (gasUsed above the signed gas
//! limit) must refuse the outcome recording, never release the
//! reservation.

use watchpay::calldata::pay_for_merkle_tree_calldata;
use watchpay::calldata::MerklePaymentMadeEvent;
use watchpay::ledger::AttemptState;
use watchpay::ledger::Ledger;
use watchpay::plan::validate_plan;
use watchpay::receipt::synth_receipt_with_event;
use watchpay::test_support::*;
use watchpay::tx::{validate_transaction, DecodedTransaction, TxDestination, TxEnvelope};
use watchpay::types::Atto;

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("watchpay-ledger-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn vp() -> watchpay::plan::ValidatedPlan {
    validate_plan(&base_plan(), SYNTH_NOW).unwrap()
}

fn signed_tx(nonce: u64, hash_tag: u8) -> DecodedTransaction {
    let plan = base_plan();
    let b = &plan.batches[0];
    DecodedTransaction {
        envelope: TxEnvelope::Eip1559,
        chain_id: plan.network.chain_id,
        from: plan.expected_payer,
        to: plan.network.payment_vault,
        value_wei: Atto::ZERO,
        nonce,
        gas_limit: 400_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 900_000_000,
        input: pay_for_merkle_tree_calldata(b.depth, &b.commitments, b.merkle_payment_timestamp)
            .unwrap(),
        tx_hash: synth_hash(hash_tag),
    }
}

/// A zero-priority EIP-1559 shape (the legitimate zero-effective-price
/// class: zero basefee + zero priority test networks).
fn signed_tx_zero_priority(nonce: u64, hash_tag: u8) -> DecodedTransaction {
    let mut tx = signed_tx(nonce, hash_tag);
    tx.max_priority_fee_wei = 0;
    tx
}

fn good_event() -> MerklePaymentMadeEvent {
    MerklePaymentMadeEvent {
        winner_pool_hash: synth_hash(2),
        depth: 2,
        total_amount: Atto::from_u64(4),
        merkle_payment_timestamp: SYNTH_TS,
    }
}

fn good_receipt(tx: &DecodedTransaction) -> watchpay::receipt::SyntheticReceipt {
    let v = vp();
    synth_receipt_with_event(
        tx,
        42161,
        v.plan().expected_payer,
        v.plan().network.payment_vault,
        &good_event(),
        10,
    )
}

fn approve_tx(v: &watchpay::plan::ValidatedPlan, amount: Atto, nonce: u64) -> DecodedTransaction {
    DecodedTransaction {
        envelope: TxEnvelope::Legacy,
        chain_id: v.plan().network.chain_id,
        from: v.plan().expected_payer,
        to: v.plan().network.payment_token,
        value_wei: Atto::ZERO,
        nonce,
        gas_limit: 60_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 0,
        input: watchpay::calldata::approve_calldata(v.plan().network.payment_vault, amount)
            .unwrap(),
        tx_hash: synth_hash(0x6C),
    }
}

// ── R1 probe 1: derived approval cannot bypass the seal ────────────────

#[test]
fn review_derived_approval_cannot_bypass_seal() {
    let v = vp();

    // The R1 probe's shape — `v.approve_ceiling = Atto::from_u64(1_000_000)`
    // on the live handle — NO LONGER COMPILES: every field of
    // `ValidatedPlan` is private behind immutable getters. The semantic
    // consequence the probe asserted, restated against the sealed value:
    let sealed_ceiling = v.approve_ceiling();
    assert_eq!(
        sealed_ceiling,
        Atto::from_u64(36),
        "sealed base-plan approval is 36 atto"
    );

    // An approval composed OUTSIDE the handle for 1,000,000 atto — the
    // mutated-derived-amount shape — is refused by the validator, which
    // derives the lawful amount from the sealed plan, never from any
    // caller-supplied figure.
    let excessive = approve_tx(&v, Atto::from_u64(1_000_000), 6);
    let err = validate_transaction(&v, TxDestination::Approve, &excessive, 6)
        .expect_err("mutated derived approval bypasses seal and accepts excessive approval");
    assert_eq!(err.field_name(), Some("input"), "{err}");

    // HEALTHY CONTROL: the approval at exactly the sealed ceiling — the
    // only lawful amount — is accepted.
    let lawful = approve_tx(&v, sealed_ceiling, 6);
    validate_transaction(&v, TxDestination::Approve, &lawful, 6).unwrap();

    // And Amount::MAX approvals stay refused regardless of composition.
    let mut maxd = lawful.clone();
    maxd.input = {
        let mut bytes =
            watchpay::calldata::approve_calldata(v.plan().network.payment_vault, Atto::from_u64(1))
                .unwrap();
        bytes[4 + 32..4 + 64].copy_from_slice(&Atto::MAX.0.to_big_endian());
        bytes
    };
    let e2 = validate_transaction(&v, TxDestination::Approve, &maxd, 6).unwrap_err();
    assert_eq!(e2.field_name(), Some("input"), "{e2}");

    // The handle's derived state cannot drift: consistency + revalidation
    // still succeed and re-derive the same sealed figures.
    assert!(v.is_internally_consistent());
    let fresh = v.revalidate(SYNTH_NOW).unwrap();
    assert_eq!(fresh.approve_ceiling(), sealed_ceiling);
}

// ── R1 probe 2: impossible fee evidence must not free the budget ───────

#[test]
fn review_impossible_fee_evidence_must_not_free_budget() {
    let ledger = Ledger::open(&tmp_root("review-r1-fee")).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5a);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();

    // IMPOSSIBLE evidence: gasUsed above the signed gas limit, zero price
    // (product zero — the reservation-erasure shape). The whole outcome
    // recording is refused; nothing is mutated.
    let mut r = good_receipt(&tx);
    r.status = 0;
    r.logs.clear();
    r.gas_used = Some(tx.gas_limit + 1);
    r.effective_gas_price_wei = Some(0);
    let err = ledger
        .record_outcome(&v, 0, &r, None, SYNTH_NOW)
        .expect_err(
            "gasUsed exceeds transaction limit but accepted and reservation shrunk to zero",
        );
    let msg = err.to_string();
    assert!(
        msg.contains("gas_used") && msg.contains("impossible"),
        "{msg}"
    );

    // The reservation on disk is untouched (still the tx's worst case)
    // and the attempt is still in the signed state.
    let records = ledger.attempts(&v.plan().job_id, 0).unwrap();
    match &records[0].state {
        AttemptState::Signed { .. } => {}
        other => panic!("state must still be signed, got {}", other.kind()),
    }
    assert_eq!(
        records[0].reserved_fee_wei,
        Atto::from_u64(400_000 * 90_000_000_000u64)
    );

    // HEALTHY CONTROL — legitimate evidence reconciles: gas within the
    // limit, price inside the envelope bounds shrinks the reservation to
    // the actual product.
    let mut ok = good_receipt(&tx);
    ok.status = 0;
    ok.logs.clear();
    ok.gas_used = Some(150_000);
    ok.effective_gas_price_wei = Some(90_000_000_000);
    ledger
        .record_outcome(&v, 0, &ok, None, SYNTH_NOW + 1)
        .unwrap();
    let records = ledger.attempts(&v.plan().job_id, 0).unwrap();
    assert_eq!(
        records[0].reserved_fee_wei,
        Atto::from_u64(150_000 * 90_000_000_000u64)
    );

    // IMPOSSIBLE variant — price above the tx's own cap (1559 envelope:
    // effective must sit within [priority, maxFee]):
    let ledger2 = Ledger::open(&tmp_root("review-r1-fee-hi")).unwrap();
    ledger2.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx2 = signed_tx(7, 0x5b);
    ledger2.record_signed(&v, 0, &tx2, SYNTH_NOW).unwrap();
    let mut hi = good_receipt(&tx2);
    hi.status = 0;
    hi.logs.clear();
    hi.gas_used = Some(1_000);
    hi.effective_gas_price_wei = Some(90_000_000_001); // above maxFeePerGas
    let e2 = ledger2
        .record_outcome(&v, 0, &hi, None, SYNTH_NOW)
        .expect_err("effective price above the signed cap must be refused");
    assert!(e2.to_string().contains("effective"), "{e2}");

    // IMPOSSIBLE variant — incomplete pair (gas without price) is refused
    // as contradictory, never silently ignored:
    let ledger3 = Ledger::open(&tmp_root("review-r1-fee-half")).unwrap();
    ledger3.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx3 = signed_tx(7, 0x5c);
    ledger3.record_signed(&v, 0, &tx3, SYNTH_NOW).unwrap();
    let mut half = good_receipt(&tx3);
    half.status = 0;
    half.logs.clear();
    half.gas_used = Some(1_000);
    let e3 = ledger3
        .record_outcome(&v, 0, &half, None, SYNTH_NOW)
        .expect_err("incomplete fee-evidence pair must be refused");
    assert!(e3.to_string().contains("incomplete"), "{e3}");
}

#[test]
fn review_zero_price_testnet_behavior_stays_lawful() {
    // Zero effective price is LEGITIMATE only when the envelope itself
    // allows it (zero basefee + zero priority). On a priority>0 envelope
    // it is contradictory and refused.
    let ledger = Ledger::open(&tmp_root("review-r1-zero")).unwrap();
    let v = vp();

    // zero-priority envelope: zero price + within-limit gas reconciles
    // the reservation to zero LAWFULLY (a real zero-price testnet shape)
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let zp = signed_tx_zero_priority(7, 0x5d);
    ledger.record_signed(&v, 0, &zp, SYNTH_NOW).unwrap();
    let mut zr = good_receipt(&zp);
    zr.status = 0;
    zr.logs.clear();
    zr.gas_used = Some(120_000);
    zr.effective_gas_price_wei = Some(0);
    ledger.record_outcome(&v, 0, &zr, None, SYNTH_NOW).unwrap();
    let records = ledger.attempts(&v.plan().job_id, 0).unwrap();
    assert_eq!(records[0].reserved_fee_wei, Atto::ZERO);

    // boundary control: gas_used exactly == gas_limit is possible and
    // accepted (the impossible class is strictly ABOVE the limit)
    ledger.write_intent(&v, 0, 8, SYNTH_NOW + 1).unwrap();
    let lim = signed_tx_zero_priority(8, 0x5e);
    ledger.record_signed(&v, 0, &lim, SYNTH_NOW + 1).unwrap();
    let mut br = good_receipt(&lim);
    br.status = 0;
    br.logs.clear();
    br.gas_used = Some(lim.gas_limit); // exactly the limit
    br.effective_gas_price_wei = Some(0);
    ledger
        .record_outcome(&v, 0, &br, None, SYNTH_NOW + 2)
        .unwrap();

    // but zero price on the priority-900Mwei envelope is impossible
    // (1559: effective >= priority) and refused:
    let ledger2 = Ledger::open(&tmp_root("review-r1-zero-bad")).unwrap();
    ledger2.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let std = signed_tx(7, 0x5f);
    ledger2.record_signed(&v, 0, &std, SYNTH_NOW).unwrap();
    let mut bad = good_receipt(&std);
    bad.status = 0;
    bad.logs.clear();
    bad.gas_used = Some(1_000);
    bad.effective_gas_price_wei = Some(0);
    let e = ledger2
        .record_outcome(&v, 0, &bad, None, SYNTH_NOW)
        .expect_err("zero effective price contradicts the signed priority floor");
    assert!(e.to_string().contains("effective"), "{e}");
}

#[test]
fn review_status_domain_enforced() {
    // A receipt status outside {0,1} is malformed evidence and refused
    // outright (previously any status != 1 silently classified as
    // reverted).
    let v = vp();
    let tx = signed_tx(7, 0x5a);
    let mut r = good_receipt(&tx);
    r.status = 2;
    let e = watchpay::receipt::validate_receipt(&v, 0, &tx, &r, None).unwrap_err();
    assert_eq!(e.field_name(), Some("status"), "{e}");
}
