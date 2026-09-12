//! Ledger lifecycle: happy path, double-payment fence, unknown-never-
//! auto-re-signs, cancellation, crash/torn-file fail-closed behavior, and
//! precisely-what-survives assertions for each defined crash point.
//!
//! Crash points (per the ledger module docs), and what survives each:
//! C1 crash after the intent's atomic write returns -> intent fully
//!    durable; no signed record exists; a new attempt is possible only
//!    after explicit cancel (open-intent refusal in between).
//! C2 crash between content-fsync and rename of a SIGNED record -> the
//!    pre-crash state (intent) survives; a stray .tmp is ignored by the
//!    loader; nothing half-written is ever parsed as state.
//! C3 crash after the signed record is durable -> the signed tx is bound
//!    on disk; write_intent REFUSES (never auto-re-sign); only outcome
//!    reconciliation moves the state on.
//! C4 crash after a mined outcome is durable -> the batch refuses new
//!    intents forever (local double-payment fence).
//! A TORN attempt file (simulating a hypothetical fs/rename failure mode
//! beyond our fsync discipline) makes the loader fail CLOSED naming the
//! file — it can never silently downgrade to "never signed".

use watchpay::calldata::pay_for_merkle_tree_calldata;
use watchpay::ledger::{AttemptState, HumanGate, Ledger};
use watchpay::plan::validate_plan;
use watchpay::receipt::{
    synth_receipt_with_event, CompletedReadback, ReceiptOutcome,
};
use watchpay::calldata::MerklePaymentMadeEvent;
use watchpay::test_support::*;
use watchpay::tx::{DecodedTransaction, TxEnvelope};
use watchpay::types::{Atto, Hex32};

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "watchpay-ledger-{}-{}",
        tag,
        std::process::id()
    ));
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
        v.plan.expected_payer,
        v.plan.network.payment_vault,
        &good_event(),
        10,
    )
}

#[test]
fn happy_path_intent_signed_mined() {
    let root = tmp_root("happy");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();

    let seq = ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    assert_eq!(seq, 1);
    let tx = signed_tx(7, 0x5A);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW + 10).unwrap();

    let outcome = ledger
        .record_outcome(
            &v,
            0,
            &good_receipt(&tx),
            Some(&CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS }),
            SYNTH_NOW + 20,
        )
        .unwrap();
    match outcome {
        ReceiptOutcome::Paid(p) => {
            assert_eq!(p.winner_pool_hash, synth_hash(2));
            assert_eq!(p.total_amount, Atto::from_u64(4));
        }
        _ => panic!("expected Paid"),
    }

    // C4: after a durable Mined record, a new intent is refused forever.
    let e = ledger.write_intent(&v, 0, 8, SYNTH_NOW + 30).unwrap_err();
    assert!(e.to_string().contains("already paid"), "{e}");

    // the record on disk is Mined with the winner bound
    let attempts = ledger.attempts(&v.plan.job_id, 0).unwrap();
    assert_eq!(attempts.len(), 1);
    assert!(matches!(attempts[0].state, AttemptState::Mined { .. }));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn signed_state_blocks_new_intents_never_auto_resigns() {
    let root = tmp_root("signed-blocks");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5A);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();

    // C3: while a signed tx exists, no automatic new attempt
    let e = ledger.write_intent(&v, 0, 8, SYNTH_NOW).unwrap_err();
    assert!(e.to_string().contains("never auto-re-sign"), "{e}");

    // evidence goes missing -> Unknown (synthetic trigger in this slice)
    ledger.record_unknown(&v, 0, SYNTH_NOW + 5, "rpc unreachable after broadcast attempt").unwrap();

    // Unknown NEVER auto-re-signs
    let e = ledger.write_intent(&v, 0, 9, SYNTH_NOW + 6).unwrap_err();
    assert!(e.to_string().contains("UNKNOWN"), "{e}");
    assert!(e.to_string().contains("human"), "{e}");

    // human gate resolves it with evidence
    let gate = HumanGate::explicit_human_approval();
    let outcome = ledger
        .resolve_unknown(
            &gate,
            &v,
            0,
            &good_receipt(&tx),
            Some(&CompletedReadback { depth: 2, merkle_payment_timestamp: SYNTH_TS }),
            SYNTH_NOW + 60,
        )
        .unwrap();
    assert!(matches!(outcome, ReceiptOutcome::Paid(_)));

    // after human-confirmed Mined, still no new attempts
    let e = ledger.write_intent(&v, 0, 10, SYNTH_NOW + 61).unwrap_err();
    assert!(e.to_string().contains("already paid"));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn unknown_abandon_is_human_and_records_the_choice() {
    let root = tmp_root("abandon");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5A);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();
    ledger.record_unknown(&v, 0, SYNTH_NOW + 5, "evidence ambiguous").unwrap();

    let gate = HumanGate::explicit_human_approval();
    ledger
        .abandon_unknown(&gate, &v, 0, SYNTH_NOW + 90, "founder chose to walk away")
        .unwrap();
    let attempts = ledger.attempts(&v.plan.job_id, 0).unwrap();
    match &attempts[0].state {
        AttemptState::Cancelled { reason } => {
            assert!(reason.contains("human abandon"), "{reason}");
        }
        other => panic!("expected Cancelled, got {:?}", other.kind()),
    }
    // a NEW attempt is allowed after the human abandon (risk accepted on
    // the record) — this is the only path from Unknown to a new attempt.
    let seq = ledger.write_intent(&v, 0, 11, SYNTH_NOW + 91).unwrap();
    assert_eq!(seq, 2);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn open_intent_requires_explicit_cancel_before_new_attempt() {
    let root = tmp_root("cancel");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    // second intent while the first is open: refused
    let e = ledger.write_intent(&v, 0, 8, SYNTH_NOW).unwrap_err();
    assert!(e.to_string().contains("open intent"), "{e}");
    // explicit cancel, then a new attempt with a new nonce
    ledger.cancel_intent(&v, 0, SYNTH_NOW + 1, "composer re-ran, nonce bumped").unwrap();
    let seq = ledger.write_intent(&v, 0, 8, SYNTH_NOW + 2).unwrap();
    assert_eq!(seq, 2);

    // a Signed attempt cannot be cancelled outright
    let tx = signed_tx(8, 0x5B);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW + 3).unwrap();
    let e = ledger.cancel_intent(&v, 0, SYNTH_NOW + 4, "nope").unwrap_err();
    assert!(e.to_string().contains("reconciled first"), "{e}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn duplicate_tx_hash_refused_across_plan() {
    let root = tmp_root("dup");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5A);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();
    // revert it, then retry — the SAME tx hash (e.g. re-signing identical
    // bytes) is refused even from a fresh attempt
    let mut reverted = good_receipt(&tx);
    reverted.status = 0;
    reverted.logs.clear();
    ledger.record_outcome(&v, 0, &reverted, None, SYNTH_NOW + 5).unwrap();
    ledger.write_intent(&v, 0, 8, SYNTH_NOW + 6).unwrap();
    let same_hash = signed_tx(8, 0x5A);
    let e = ledger.record_signed(&v, 0, &same_hash, SYNTH_NOW + 7).unwrap_err();
    assert!(e.to_string().contains("already recorded"), "{e}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn nonce_policy_binds_tx_to_its_attempt() {
    let root = tmp_root("nonce");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    // a tx with a different nonce than the persisted attempt: refused
    let wrong = signed_tx(99, 0x5C);
    let e = ledger.record_signed(&v, 0, &wrong, SYNTH_NOW).unwrap_err();
    assert!(e.to_string().contains("nonce"), "{e}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn torn_attempt_file_fails_closed() {
    let root = tmp_root("torn");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = signed_tx(7, 0x5A);
    ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();

    // simulate a torn write: truncate the attempt file mid-JSON
    let dir = root.join(&v.plan.job_id).join("0");
    let path = dir.join("attempt-0001.json");
    let raw = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, &raw[..raw.len() / 2]).unwrap();

    let reopened = Ledger::open(&root).unwrap();
    let e = reopened.attempts(&v.plan.job_id, 0).unwrap_err();
    assert!(e.to_string().contains("corrupt/torn"), "{e}");
    assert!(e.to_string().contains("refusing to guess state"), "{e}");
    // the fail-closed refusal also blocks new intents (write_intent reads
    // attempts first and propagates the refusal)
    let e2 = reopened.write_intent(&v, 0, 9, SYNTH_NOW).unwrap_err();
    assert!(e2.to_string().contains("corrupt/torn"), "{e2}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn unknown_state_name_fails_closed() {
    let root = tmp_root("badstate");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let dir = root.join(&v.plan.job_id).join("0");
    std::fs::write(
        dir.join("attempt-0002.json"),
        r#"{"record_version":1,"job_id":"synthetic-job-001","plan_hash":"0x00","batch_index":0,"batch_id":"0x00","attempt_seq":2,"nonce":8,"state":"teleported","updated_unix":0}"#,
    )
    .unwrap();
    let e = ledger.attempts(&v.plan.job_id, 0).unwrap_err();
    assert!(e.to_string().contains("corrupt/torn") || e.to_string().contains("unknown variant"));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn stray_tmp_files_ignored() {
    let root = tmp_root("tmp");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let dir = root.join(&v.plan.job_id).join("0");
    std::fs::write(dir.join(".attempt-0001.json.tmp9999"), b"garbage").unwrap();
    std::fs::write(dir.join("notes.txt"), b"not an attempt").unwrap();
    let attempts = ledger.attempts(&v.plan.job_id, 0).unwrap();
    assert_eq!(attempts.len(), 1);
    let _ = std::fs::remove_dir_all(&root);
}

/// C1/C2/C3 durability semantics stated as executable facts: records that
/// returned from their writes are readable from a FRESH Ledger instance
/// (simulating process death + relaunch).
#[test]
fn written_states_survive_process_relaunch() {
    let root = tmp_root("relaunch");
    let v = vp();
    {
        let ledger = Ledger::open(&root).unwrap();
        ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    }
    {
        // C1: crash after intent write — intent survives relaunch
        let ledger = Ledger::open(&root).unwrap();
        let attempts = ledger.attempts(&v.plan.job_id, 0).unwrap();
        assert_eq!(attempts.len(), 1);
        assert_eq!(attempts[0].state, AttemptState::Intent);
        assert_eq!(attempts[0].nonce, 7);
        // open-intent refusal still applies after relaunch
        let e = ledger.write_intent(&v, 0, 8, SYNTH_NOW).unwrap_err();
        assert!(e.to_string().contains("open intent"));
    }
    {
        // C3: sign, crash; the signed record survives and blocks re-sign
        let ledger = Ledger::open(&root).unwrap();
        let tx = signed_tx(7, 0x5A);
        ledger.record_signed(&v, 0, &tx, SYNTH_NOW).unwrap();
    }
    {
        let ledger = Ledger::open(&root).unwrap();
        let attempts = ledger.attempts(&v.plan.job_id, 0).unwrap();
        match &attempts[0].state {
            AttemptState::Signed { tx } => assert_eq!(tx.nonce, 7),
            other => panic!("expected Signed, got {}", other.kind()),
        }
        let e = ledger.write_intent(&v, 0, 8, SYNTH_NOW).unwrap_err();
        assert!(e.to_string().contains("never auto-re-sign"));
    }
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn job_id_traversal_refused_at_ledger_boundary() {
    let root = tmp_root("traversal");
    let ledger = Ledger::open(&root).unwrap();
    let mut v = vp();
    v.plan.job_id = "..\\evil".to_string();
    let e = ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap_err();
    assert!(e.to_string().contains("job_id"), "{e}");
    // nothing was created outside the root
    assert!(!root.join("..").join("evil").exists());
    let _ = std::fs::remove_dir_all(&root);
    let _ = Hex32::ZERO;
}
