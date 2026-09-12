//! Executable regressions for the z2.b negative review (2026-09-12,
//! review of d435de93). The first three probes are the reviewer's
//! verbatim shapes with healthy controls added; the fourth is the
//! reviewer's scenario with the assertion moved to the CORRECT
//! enforcement boundary: with per-attempt worst-case reservations, the
//! budget must refuse a new intent as soon as the plan-wide projection
//! exceeds the declared ceiling — which happens EARLIER than the 11th
//! attempt. All offline, synthetic data only.

use watchpay::calldata::pay_for_merkle_tree_calldata;
use watchpay::calldata::MerklePaymentMadeEvent;
use watchpay::ledger::Ledger;
use watchpay::plan::validate_plan;
use watchpay::receipt::{synth_receipt_with_event, CompletedReadback};
use watchpay::test_support::*;
use watchpay::tx::{DecodedTransaction, TxEnvelope};
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

// ── P1 probe 1: changed plan under a previously recorded intent ────────

#[test]
fn review_refuse_changed_plan_after_intent() {
    let ledger = Ledger::open(&tmp_root("review-plan")).unwrap();
    let a = vp();
    ledger.write_intent(&a, 0, 7, SYNTH_NOW).unwrap();
    let mut p = base_plan();
    p.network.payment_vault = watchpay::types::EthAddr([0x99; 20]);
    p.batches[0].batch_id =
        watchpay::canonical::batch_id(p.network.chain_id, &p.network.payment_vault, &p.batches[0]);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let b = validate_plan(&p, SYNTH_NOW).unwrap();
    let mut tx = signed_tx(7, 0x5a);
    tx.to = p.network.payment_vault;
    let err = ledger
        .record_signed(&b, 0, &tx, SYNTH_NOW + 1)
        .expect_err("changed vault/plan accepted under old persisted intent");
    assert!(err.to_string().contains("plan identity changed"), "{err}");

    // HEALTHY CONTROL: the ORIGINAL plan's transaction still records fine
    // under the original intent.
    let good = signed_tx(7, 0x5b);
    ledger.record_signed(&a, 0, &good, SYNTH_NOW + 1).unwrap();
}

// ── P1 probe 2: cached validation cannot outlive expiry ────────────────

#[test]
fn review_refuse_expired_cached_plan() {
    let ledger = Ledger::open(&tmp_root("review-expiry")).unwrap();
    let v = vp();
    let err = ledger
        .write_intent(&v, 0, 7, v.plan().expires_unix + 1)
        .expect_err("expired cached plan starts new signing intent");
    assert!(err.to_string().contains("expired"), "{err}");

    // HEALTHY CONTROL: an intent before expiry works…
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5a);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW + 1).unwrap();
    // …and AFTER expiry the already-submitted payment still reconciles
    // (expiry blocks new signing, not old evidence):
    let mut receipt = good_receipt(&tx);
    receipt.status = 0;
    receipt.logs.clear();
    ledger
        .record_outcome(&v, 0, &receipt, None, v.plan().expires_unix + 10)
        .unwrap();
    // while a NEW intent after expiry stays refused even after the
    // reverted (retryable) terminal state:
    let e2 = ledger
        .write_intent(&v, 0, 8, v.plan().expires_unix + 11)
        .expect_err("expired plan must refuse new signing attempts");
    assert!(e2.to_string().contains("expired"), "{e2}");
}

// ── P1 probe 3: paid requires the completed-payment read-back ──────────

#[test]
fn review_require_readback() {
    let v = vp();
    let tx = signed_tx(7, 0x5a);
    let receipt = good_receipt(&tx);
    let err = watchpay::receipt::validate_receipt(&v, 0, &tx, &receipt, None)
        .expect_err("paid accepted without required readback");
    assert_eq!(err.field_name(), Some("getCompletedMerklePayment"), "{err}");

    // HEALTHY CONTROL: the same receipt WITH the read-back validates Paid.
    let rb = CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS };
    assert!(matches!(
        watchpay::receipt::validate_receipt(&v, 0, &tx, &receipt, Some(&rb)).unwrap(),
        watchpay::receipt::ReceiptOutcome::Paid(_)
    ));
}

// ── P1 probe 4: cumulative fee budget governs retries ──────────────────
//
// The reviewer's original loop unwrapped ten reverted attempts and
// asserted the eleventh is refused. Under the corrected reservation
// semantics the refusal MUST come earlier: each attempt durably reserves
// its worst case, a reverted attempt without fee evidence frees nothing,
// so the plan-wide projection crosses the declared ceiling after two
// retained attempts (0.036 x2 retained + 0.05 next-intent reservation =
// 0.122 > the base plan's 0.1 ETH ceiling). Letting ten attempts
// accumulate 0.36 ETH of exposure under a 0.1 ETH ceiling is exactly the
// finding; this regression pins the boundary where enforcement bites.

#[test]
fn review_refuse_retry_fee_overrun() {
    let ledger = Ledger::open(&tmp_root("review-fees")).unwrap();
    let v = vp();

    let mut allowed = 0u32;
    loop {
        match ledger.write_intent(&v, 0, allowed as u64, SYNTH_NOW) {
            Ok(_) => {}
            Err(e) => {
                assert!(e.to_string().contains("fee budget exhausted"), "{e}");
                break;
            }
        }
        let tx = signed_tx(allowed as u64, 0x60 + allowed as u8);
        ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();
        let mut receipt = good_receipt(&tx);
        receipt.status = 0;
        receipt.logs.clear();
        ledger.record_outcome(&v, 0, &receipt, None, SYNTH_NOW).unwrap();
        allowed += 1;
    }
    // The fence is not a blanket refusal (more than one attempt fit —
    // healthy control) and it bites far before an eleventh attempt.
    assert!(
        (2..=10).contains(&allowed),
        "expected refusal after 2..=10 attempts (budget-bound), got {allowed}"
    );
    // The exact arithmetic under the base plan: post-signing reservations
    // are 0.036 ETH each (400k gas x 90 gwei), intents reserve the plan
    // per-tx worst case 0.05 ETH, ceiling 0.1 ETH -> attempt 3 refused.
    assert_eq!(allowed, 2);
}

#[test]
fn review_fee_evidence_reconciles_reservations() {
    // With fee evidence (gasUsed x effectiveGasPrice) reservations
    // reconcile DOWN — more attempts fit the same ceiling than the
    // no-evidence path would allow once retained exposure shrinks.
    let ledger = Ledger::open(&tmp_root("review-fees-ev")).unwrap();
    let v = vp();
    let mut allowed = 0u32;
    loop {
        match ledger.write_intent(&v, 0, allowed as u64, SYNTH_NOW) {
            Ok(_) => {}
            Err(e) => {
                assert!(e.to_string().contains("fee budget exhausted"), "{e}");
                break;
            }
        }
        let tx = signed_tx(allowed as u64, 0x70 + allowed as u8);
        ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();
        let mut receipt = good_receipt(&tx);
        receipt.status = 0;
        receipt.logs.clear();
        receipt.gas_used = Some(60_000);
        receipt.effective_gas_price_wei = Some(90_000_000_000);
        ledger.record_outcome(&v, 0, &receipt, None, SYNTH_NOW).unwrap();
        allowed += 1;
    }
    // retained 0.0054/attempt after evidence; the next intent's own
    // 0.05 worst-case reservation is what the ceiling must cover:
    // 0.0054 + 0.05 = 0.0554 <= 0.1 (attempt 2 ok); 0.0108 + 0.05 <= 0.1
    // (attempt 3 ok); 0.0162 + 0.05 = 0.0662 <= 0.1 … attempts continue
    // until retained + 0.05 > 0.1, i.e. retained > 0.05: attempt 11.
    assert_eq!(allowed, 10);
    let records = ledger.attempts(&v.plan().job_id, 0).unwrap();
    let total: Atto = records
        .iter()
        .fold(Atto::ZERO, |a, r| a.checked_add(r.reserved_fee_wei).unwrap());
    // 10 evidence-backed attempts retained at actuals
    assert_eq!(total, Atto::from_u64(10 * 60_000 * 90_000_000_000u64));
    // evidence can never RAISE a reservation above the tx's own worst
    // case (forged-evidence clamp)
    for r in &records {
        assert!(r.reserved_fee_wei <= Atto::from_u64(400_000 * 90_000_000_000u64));
    }
}
