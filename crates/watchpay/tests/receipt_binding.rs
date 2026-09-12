//! The §5.2/§5.3 batteries: decoded-transaction validation and strict
//! receipt→transaction→batch binding. Every negative case asserts the
//! named field. All data is synthetic.

use watchpay::calldata::{
    pay_for_merkle_tree_calldata, synth_merkle_payment_made_log, MerklePaymentMadeEvent,
    SyntheticLog,
};
use watchpay::plan::validate_plan;
use watchpay::receipt::{
    synth_receipt_with_event, validate_receipt, ChainEvidence, CompletedReadback,
    ReceiptOutcome, SyntheticReceipt,
};
use watchpay::plan_model::Batch;
use watchpay::test_support::*;
use watchpay::tx::{validate_transaction, DecodedTransaction, TxDestination, TxEnvelope};
use watchpay::types::{Atto, Hex32};

fn vp() -> watchpay::plan::ValidatedPlan {
    validate_plan(&base_plan(), SYNTH_NOW).unwrap()
}

/// The synthetic "signed" transaction for batch 0 (nonce from the intent).
fn signed_batch_tx() -> DecodedTransaction {
    let plan = base_plan();
    let b = &plan.batches[0];
    DecodedTransaction {
        envelope: TxEnvelope::Eip1559,
        chain_id: plan.network.chain_id,
        from: plan.expected_payer,
        to: plan.network.payment_vault,
        value_wei: Atto::ZERO,
        nonce: 7,
        gas_limit: 400_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 900_000_000,
        input: pay_for_merkle_tree_calldata(b.depth, &b.commitments, b.merkle_payment_timestamp)
            .unwrap(),
        tx_hash: synth_hash(0x5A),
    }
}

fn winner_event(winner_tag: u8, amount: u64) -> MerklePaymentMadeEvent {
    MerklePaymentMadeEvent {
        winner_pool_hash: synth_hash(winner_tag),
        depth: 2,
        total_amount: Atto::from_u64(amount),
        merkle_payment_timestamp: SYNTH_TS,
    }
}

fn field_of(e: &watchpay::Error) -> &'static str {
    e.field_name().unwrap_or_else(|| panic!("refusal lacks a field name: {e}"))
}

#[test]
fn valid_payment_tx_accepted() {
    let v = vp();
    validate_transaction(&v, TxDestination::BatchPayment { batch_index: 0 }, &signed_batch_tx(), 7)
        .unwrap();
}

#[test]
fn valid_approve_tx_accepted() {
    let v = vp();
    let tx = DecodedTransaction {
        envelope: TxEnvelope::Legacy,
        chain_id: v.plan().network.chain_id,
        from: v.plan().expected_payer,
        to: v.plan().network.payment_token,
        value_wei: Atto::ZERO,
        nonce: 6,
        gas_limit: 60_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 0,
        input: watchpay::calldata::approve_calldata(v.plan().network.payment_vault, v.approve_ceiling())
            .unwrap(),
        tx_hash: synth_hash(0x6A),
    };
    validate_transaction(&v, TxDestination::Approve, &tx, 6).unwrap();
}

#[test]
fn tx_negative_battery() {
    let v = vp();
    let dest = TxDestination::BatchPayment { batch_index: 0 };
    let base = signed_batch_tx();

    // unsupported transaction types
    for bad_type in [1u8, 3, 4, 5, 0x7f] {
        let e = TxEnvelope::parse_type(bad_type).unwrap_err();
        assert_eq!(field_of(&e), "tx_type");
        assert!(e.to_string().contains("unsupported transaction type"));
    }
    assert_eq!(TxEnvelope::parse_type(0).unwrap(), TxEnvelope::Legacy);
    assert_eq!(TxEnvelope::parse_type(2).unwrap(), TxEnvelope::Eip1559);

    macro_rules! refuse {
        ($name:ident, $field:expr, $m:expr) => {{
            let mut t = base.clone();
            $m(&mut t);
            let e = validate_transaction(&v, dest, &t, 7).unwrap_err();
            assert_eq!(field_of(&e), $field, "case {} -> {}", stringify!($name), e);
        }};
    }
    refuse!(chain, "chain_id", |t: &mut DecodedTransaction| t.chain_id = 421614);
    refuse!(payer, "from", |t: &mut DecodedTransaction| t.from = synth_addr(0xEE));
    refuse!(nonce, "nonce", |t: &mut DecodedTransaction| t.nonce = 8);
    refuse!(value, "value", |t: &mut DecodedTransaction| t.value_wei = Atto::from_u64(1));
    refuse!(gas, "gas_limit", |t: &mut DecodedTransaction| t.gas_limit = 500_001);
    refuse!(fee, "max_fee_per_gas_wei", |t: &mut DecodedTransaction| t.max_fee_per_gas_wei = 100_000_000_001);
    refuse!(zero_hash, "tx_hash", |t: &mut DecodedTransaction| t.tx_hash = Hex32::ZERO);
    refuse!(dest_vault, "to", |t: &mut DecodedTransaction| t.to = synth_addr(0xDD));
    refuse!(calldata_tampered, "input", |t: &mut DecodedTransaction| t.input[10] ^= 1);
    // priority above the tx's own max fee
    let mut t = base.clone();
    t.max_priority_fee_wei = t.max_fee_per_gas_wei + 1;
    assert_eq!(field_of(&validate_transaction(&v, dest, &t, 7).unwrap_err()), "max_priority_fee_wei");
    // legacy with a priority fee
    let mut t = base.clone();
    t.envelope = TxEnvelope::Legacy;
    t.max_priority_fee_wei = 1;
    assert_eq!(field_of(&validate_transaction(&v, dest, &t, 7).unwrap_err()), "max_priority_fee_wei");

    // approve carrying Amount::MAX is refused even if a signer produced it:
    // the composer refuses MAX, so hand-encode the approve(…, MAX) bytes
    let mut ap = DecodedTransaction {
        envelope: TxEnvelope::Legacy,
        chain_id: v.plan().network.chain_id,
        from: v.plan().expected_payer,
        to: v.plan().network.payment_token,
        value_wei: Atto::ZERO,
        nonce: 6,
        gas_limit: 60_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 0,
        input: {
            let mut bytes =
                watchpay::calldata::approve_calldata(v.plan().network.payment_vault, Atto::from_u64(1))
                    .unwrap();
            bytes[4 + 32..4 + 64].copy_from_slice(&Atto::MAX.0.to_big_endian());
            bytes
        },
        tx_hash: synth_hash(0x6B),
    };
    let e = validate_transaction(&v, TxDestination::Approve, &ap, 6).unwrap_err();
    assert_eq!(field_of(&e), "input");
    assert!(e.to_string().contains("bounded approval"));
    ap.input = watchpay::calldata::approve_calldata(v.plan().network.payment_vault, v.approve_ceiling())
        .unwrap();
    validate_transaction(&v, TxDestination::Approve, &ap, 6).unwrap();

    // payment calldata for a DIFFERENT batch: build a second batch in the
    // plan and try to validate batch-0 destination against batch-1 calldata
    let mut two = base_plan();
    let mut second = Batch {
        batch_index: 1,
        depth: 2,
        merkle_payment_timestamp: SYNTH_TS,
        commitments: vec![pool(3, [2; 16]), pool(4, [3; 16])],
        batch_amount_ceiling: Atto::from_u64(12), // max(2<<2, 3<<2)
        batch_id: Hex32::ZERO,
    };
    second.batch_id = watchpay::canonical::batch_id(42161, &SYNTH_VAULT_ADDR, &second);
    two.batches.push(second);
    two.approve_ceiling_total = two
        .batches
        .iter()
        .fold(Atto::ZERO, |a, b| a.checked_add(b.batch_amount_ceiling).unwrap());
    two.gas_ceilings.max_total_gas = two.gas_ceilings.per_tx_gas_limit * 3;
    two.native_fee_ceilings.max_total_native_fee_wei = Atto::from_u64(750_000_000_000_000_000);
    two.plan_hash = watchpay::canonical::plan_hash(&two);
    let v2 = validate_plan(&two, SYNTH_NOW).unwrap();
    let wrong = DecodedTransaction {
        input: pay_for_merkle_tree_calldata(
            two.batches[1].depth,
            &two.batches[1].commitments,
            two.batches[1].merkle_payment_timestamp,
        )
        .unwrap(),
        ..signed_batch_tx()
    };
    let e = validate_transaction(&v2, TxDestination::BatchPayment { batch_index: 0 }, &wrong, 7)
        .unwrap_err();
    assert_eq!(field_of(&e), "input");
    assert!(e.to_string().contains("different batch"));
}

// ── receipt battery ────────────────────────────────────────────────────

#[test]
fn receipt_valid_both_winner_pools() {
    let v = vp();
    let tx = signed_batch_tx();
    // winner pool2 (tag 2, all-ones pool): median 1 << 2 = 4
    let ev = winner_event(2, 4);
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 12);
    let rb = CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS };
    match validate_receipt(&v, 0, &tx, &r, Some(&rb)).unwrap() {
        ReceiptOutcome::Paid(p) => {
            assert_eq!(p.winner_pool_hash, synth_hash(2));
            assert_eq!(p.total_amount, Atto::from_u64(4));
            assert_eq!(p.tx_hash, tx.tx_hash);
            assert_eq!(p.confirmations, 12);
        }
        _ => panic!("expected Paid"),
    }
    // winner pool1 (tag 1, 1..=16 pool): median 9 << 2 = 36 — readback now
    // REQUIRED for the paid state; with it supplied the payment validates.
    let ev = winner_event(1, 36);
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 12);
    match validate_receipt(&v, 0, &tx, &r, Some(&CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS })).unwrap() {
        ReceiptOutcome::Paid(p) => assert_eq!(p.total_amount, Atto::from_u64(36)),
        _ => panic!("expected Paid"),
    }
}

#[test]
fn receipt_wrong_batch_same_depth_and_timestamp() {
    // A receipt whose winner is a pool of a DIFFERENT batch that shares
    // depth AND timestamp: the winner is not among THIS batch's pools.
    let v = vp();
    let tx = signed_batch_tx();
    // forge: same depth/ts, foreign pool hash (tag 0x55 — not committed)
    let ev = winner_event(0x55, 36);
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    let e = validate_receipt(&v, 0, &tx, &r, None).unwrap_err();
    assert_eq!(field_of(&e), "winnerPoolHash");
    assert!(e.to_string().contains("different batch with identical depth/timestamp"));
}

#[test]
fn receipt_wrong_total_amount() {
    let v = vp();
    let tx = signed_batch_tx();
    // pool2's lawful charge is 4; claim 5 (or the other pool's 36)
    for amount in [5u64, 36, 3, 4096] {
        let ev = winner_event(2, amount);
        let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
        let e = validate_receipt(&v, 0, &tx, &r, None).unwrap_err();
        assert_eq!(field_of(&e), "totalAmount", "amount {amount}");
        assert!(e.to_string().contains("pricing-rule recompute"));
    }
}

#[test]
fn receipt_missing_event_no_fallback() {
    let v = vp();
    let tx = signed_batch_tx();
    let mut r = synth_receipt_with_event(
        &tx,
        42161,
        v.plan().expected_payer,
        v.plan().network.payment_vault,
        &winner_event(2, 4),
        1,
    );
    r.logs.clear();
    let e = validate_receipt(&v, 0, &tx, &r, None).unwrap_err();
    assert_eq!(field_of(&e), "logs");
    assert!(e.to_string().contains("no tx-hash fallback exists"), "{e}");
}

#[test]
fn receipt_duplicate_events_ambiguous() {
    let v = vp();
    let tx = signed_batch_tx();
    let ev = winner_event(2, 4);
    let mut r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    r.logs.push(synth_merkle_payment_made_log(v.plan().network.payment_vault, &ev));
    let e = validate_receipt(&v, 0, &tx, &r, None).unwrap_err();
    assert_eq!(field_of(&e), "logs");
    assert!(e.to_string().contains("ambiguous"));
}

#[test]
fn receipt_wrong_contract_emitter_and_fields() {
    let v = vp();
    let tx = signed_batch_tx();
    // event emitted by a DIFFERENT contract than the vault
    let ev = winner_event(2, 4);
    let mut r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    r.logs[0].address = synth_addr(0xE1);
    assert_eq!(field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()), "logs");
    // receipt.to wrong
    let mut r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    r.to = synth_addr(0xE2);
    assert_eq!(field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()), "contract");
    // payer wrong
    let r = synth_receipt_with_event(&tx, 42161, synth_addr(0xE3), v.plan().network.payment_vault, &ev, 1);
    assert_eq!(field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()), "payer");
    // chain wrong
    let r = synth_receipt_with_event(&tx, 421614, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    assert_eq!(field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()), "chain");
}

#[test]
fn receipt_altered_transaction() {
    let v = vp();
    let tx = signed_batch_tx();
    let ev = winner_event(2, 4);
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    // a receipt for a DIFFERENT tx hash than the recorded signed tx
    let mut foreign = r.clone();
    foreign.tx_hash = synth_hash(0x99);
    let e = validate_receipt(&v, 0, &tx, &foreign, None).unwrap_err();
    assert_eq!(field_of(&e), "tx_hash");
    assert!(e.to_string().contains("altered or foreign"));

    // the recorded tx's calldata binds a different batch than claimed:
    // validate batch 0 against a tx whose input is composed for a mutated
    // commitments set
    let mut tx2 = tx.clone();
    let mut mutated = base_plan().batches[0].clone();
    mutated.commitments[0].candidates[3].amount = Atto::from_u64(777);
    tx2.input =
        pay_for_merkle_tree_calldata(mutated.depth, &mutated.commitments, mutated.merkle_payment_timestamp)
            .unwrap();
    let e2 = validate_receipt(&v, 0, &tx2, &r, None).unwrap_err();
    assert_eq!(field_of(&e2), "calldata");
}

#[test]
fn receipt_reverted_and_payment_already_exists() {
    let v = vp();
    let tx = signed_batch_tx();
    // plain revert: status 0, no logs, no revert data
    let base_r = SyntheticReceipt {
        tx_hash: tx.tx_hash,
        chain_id: 42161,
        status: 0,
        from: v.plan().expected_payer,
        to: v.plan().network.payment_vault,
        logs: vec![],
        revert_data: None,
        gas_used: None,
        effective_gas_price_wei: None,
        evidence: ChainEvidence { chain_id: 42161, confirmations: 3 },
    };
    let r = base_r.clone();
    match validate_receipt(&v, 0, &tx, &r, None).unwrap() {
        ReceiptOutcome::Reverted(out) => {
            assert_eq!(out.tx_hash, tx.tx_hash);
            assert!(out.payment_already_exists_winner.is_none());
        }
        _ => panic!("expected Reverted"),
    }
    // PaymentAlreadyExists revert: selector + the already-paid winner
    let winner = synth_hash(1);
    let mut data = Vec::new();
    data.extend_from_slice(&watchpay::abi::payment_already_exists_selector());
    data.extend_from_slice(winner.as_bytes());
    let r2 = SyntheticReceipt { revert_data: Some(data), status: 0, ..base_r.clone() };
    match validate_receipt(&v, 0, &tx, &r2, None).unwrap() {
        ReceiptOutcome::Reverted(out) => {
            assert_eq!(out.payment_already_exists_winner, Some(winner));
        }
        _ => panic!("expected Reverted"),
    }
    // garbage revert data classifies as plain revert (not an error)
    let r3 = SyntheticReceipt { revert_data: Some(vec![1, 2, 3]), ..r };
    assert!(matches!(
        validate_receipt(&v, 0, &tx, &r3, None).unwrap(),
        ReceiptOutcome::Reverted(_)
    ));
}

#[test]
fn receipt_readback_mismatch() {
    let v = vp();
    let tx = signed_batch_tx();
    let ev = winner_event(2, 4);
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    for bad in [
        CompletedReadback { depth: 3, merkle_payment_timestamp: SYNTH_TS },
        CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS + 1 },
    ] {
        let e = validate_receipt(&v, 0, &tx, &r, Some(&bad)).unwrap_err();
        assert_eq!(field_of(&e), "getCompletedMerklePayment");
    }
}

#[test]
fn receipt_event_depth_or_timestamp_mismatch() {
    let v = vp();
    let tx = signed_batch_tx();
    // event depth differs from batch
    let mut ev = winner_event(2, 4);
    ev.depth = 3;
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    assert_eq!(field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()), "depth");
    // event timestamp differs from batch
    let mut ev = winner_event(2, 4);
    ev.merkle_payment_timestamp = SYNTH_TS + 2;
    let r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    assert_eq!(
        field_of(&validate_receipt(&v, 0, &tx, &r, None).unwrap_err()),
        "merklePaymentTimestamp"
    );
    // unrelated logs (other contracts/events) do not confuse the matcher
    let mut ev = winner_event(2, 4);
    ev.depth = 2;
    let mut r = synth_receipt_with_event(&tx, 42161, v.plan().expected_payer, v.plan().network.payment_vault, &ev, 1);
    let noise = SyntheticLog {
        address: synth_addr(0x0F),
        topics: vec![Hex32([9u8; 32])],
        data: vec![],
    };
    r.logs.push(noise);
    assert!(matches!(
        validate_receipt(
            &v,
            0,
            &tx,
            &r,
            Some(&CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS })
        )
        .unwrap(),
        ReceiptOutcome::Paid(_)
    ));
}
