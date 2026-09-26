//! Exclusive-writer contract contention tests (z2.c R1 review P1).
//!
//! The ledger's lock (std `File::lock` on `<root>/.lock` — flock on Unix,
//! LockFileEx on Windows) is proven by DETERMINISTIC contention, not sleep
//! races: every test here either holds the OS lock from an independent
//! handle/process (so a broken lock fails immediately — the mutation would
//! finish in microseconds) or asserts order-independent lawful-outcome
//! invariants. Synthetic offline data only; no device, no signing, no
//! network.

use watchpay::calldata::pay_for_merkle_tree_calldata;
use watchpay::ledger::{AttemptState, Ledger};
use watchpay::plan::validate_plan;
use watchpay::test_support::*;
use watchpay::tx::{DecodedTransaction, TxEnvelope};
use watchpay::types::Atto;

fn vp() -> watchpay::plan::ValidatedPlan {
    validate_plan(&base_plan(), SYNTH_NOW).unwrap()
}

/// A validate_transaction-passing synthetic signed result for batch 0
/// (the z2.b offline shape — the LOCK is under test here, not the adapter
/// identity chain).
fn decoded_tx(nonce: u64, hash_tag: u8) -> DecodedTransaction {
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

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir =
        std::env::temp_dir().join(format!("watchpay-z2c-lock-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

#[test]
fn mutation_blocks_while_external_handle_holds_the_ledger_lock() {
    // Proves: a public mutation cannot make progress while an INDEPENDENT
    // file handle (not a Ledger instance) holds the OS lock — the
    // operation completes only after release. A broken lock fails this
    // immediately (the record would finish in microseconds and the
    // held-window assertion would fire).
    use std::sync::mpsc;
    use std::time::Duration;
    let root = tmp_root("external-handle");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = decoded_tx(7, 0xA1);
    // An external handle takes the exclusive lock on the contract file.
    let lock = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(root.join(".lock"))
        .unwrap();
    lock.lock().unwrap();
    let job = v.plan().job_id.clone();
    let (done_tx, done_rx) = mpsc::channel();
    let thread_root = root.clone();
    let t = std::thread::spawn(move || {
        // An independent handle — the contention crosses handles, not a
        // shared object.
        let ledger2 = Ledger::open(&thread_root).unwrap();
        let r = ledger2.record_signed_at_attempt(&v, 0, 1, &tx, SYNTH_NOW + 1);
        let _ = done_tx.send(r.is_ok());
    });
    assert!(
        done_rx.recv_timeout(Duration::from_millis(500)).is_err(),
        "mutation completed while an external handle held the lock"
    );
    drop(lock); // release
    let ok = done_rx
        .recv_timeout(Duration::from_secs(10))
        .expect("completes after release");
    assert!(ok, "the lawful transition wins after release");
    t.join().unwrap();
    let recs = ledger.attempts(&job, 0).unwrap();
    assert!(matches!(
        recs.last().unwrap().state,
        AttemptState::Signed { .. }
    ));
}

#[test]
fn read_blocks_while_external_handle_holds_the_ledger_lock_exclusive() {
    // Proves: even the SHARED-locked read participates — an exclusive
    // external holder blocks `attempts` until release (no lock-free read
    // path exists).
    use std::sync::mpsc;
    use std::time::Duration;
    let root = tmp_root("external-handle-read");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let lock = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(root.join(".lock"))
        .unwrap();
    lock.lock().unwrap();
    let (done_tx, done_rx) = mpsc::channel();
    let thread_root = root.clone();
    let job = v.plan().job_id.clone();
    let t = std::thread::spawn(move || {
        let ledger2 = Ledger::open(&thread_root).unwrap();
        let r = ledger2.attempts(&job, 0);
        let _ = done_tx.send(r.is_ok());
    });
    assert!(
        done_rx.recv_timeout(Duration::from_millis(300)).is_err(),
        "read completed while an exclusive external holder held the lock"
    );
    drop(lock);
    let ok = done_rx
        .recv_timeout(Duration::from_secs(10))
        .expect("read completes after release");
    assert!(ok);
    t.join().unwrap();
}

#[test]
fn cancellation_versus_signing_yields_only_lawful_outcomes() {
    // Proves (order-independent invariants): when an explicit cancellation
    // and the attempt-bound recording contend through TWO INDEPENDENT
    // ledger handles, the lock serializes them and EXACTLY ONE lawful
    // outcome wins — either the record lands and the cancel refuses
    // ("cannot cancel from signed"), or the cancel lands and the record
    // refuses ("requires intent"). Final state and reservation are
    // consistent in BOTH orders; nothing is lost or duplicated.
    use std::sync::mpsc;
    let root = tmp_root("cancel-vs-sign");
    let ledger_a = Ledger::open(&root).unwrap();
    let ledger_b = Ledger::open(&root).unwrap();
    let v = vp();
    ledger_a.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = decoded_tx(7, 0xB2);
    let (cancel_tx, cancel_rx) = mpsc::channel();
    let vb = vp();
    let cancel_thread = std::thread::spawn(move || {
        let r = ledger_b.cancel_intent(&vb, 0, SYNTH_NOW + 1, "concurrent cancel");
        let _ = cancel_tx.send(r.is_ok());
    });
    let record_ok = ledger_a
        .record_signed_at_attempt(&v, 0, 1, &tx, SYNTH_NOW + 1)
        .is_ok();
    let cancel_ok = cancel_rx.recv().unwrap();
    cancel_thread.join().unwrap();
    let recs = ledger_a.attempts(&v.plan().job_id, 0).unwrap();
    assert_eq!(recs.len(), 1, "exactly one attempt ever exists");
    match &recs[0].state {
        AttemptState::Signed { tx } => {
            assert!(record_ok, "signed state requires the record to have won");
            assert!(!cancel_ok, "cancellation must refuse from signed");
            let worst = Atto::from_u64(tx.gas_limit)
                .checked_mul(Atto::from_u64(tx.max_fee_per_gas_wei))
                .unwrap();
            assert_eq!(recs[0].reserved_fee_wei, worst);
        }
        AttemptState::Cancelled { .. } => {
            assert!(cancel_ok, "cancelled state requires the cancel to have won");
            assert!(!record_ok, "recording must refuse from cancelled");
            assert_eq!(recs[0].reserved_fee_wei, Atto::ZERO);
        }
        other => panic!("unlawful final state {}", other.kind()),
    }
}

/// Child arm of the cross-process contention proof: takes the OS lock on
/// the contract file, signals via a marker file, holds 3 seconds, exits.
/// Only ever run as a subprocess of
/// `cross_process_lock_holder_blocks_ledger_mutation`.
#[test]
#[ignore = "spawned by cross_process_lock_holder_blocks_ledger_mutation"]
fn child_lock_holder() {
    let root = std::path::PathBuf::from(std::env::var("Z2C_CHILD_LOCK_ROOT").unwrap());
    let lock = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(root.join(".lock"))
        .unwrap();
    lock.lock().unwrap();
    std::fs::write(root.join("CHILD-LOCKED"), b"1").unwrap();
    std::thread::sleep(std::time::Duration::from_secs(3));
}

#[test]
fn cross_process_lock_holder_blocks_ledger_mutation() {
    // Proves: a public mutation cannot progress while a SEPARATE PROCESS
    // holds the OS lock (this test binary re-executes itself as the
    // holder). Deterministic in the failing direction: a broken lock lets
    // the mutation finish in microseconds and the held-window assertion
    // fires immediately.
    use std::sync::mpsc;
    use std::time::Duration;
    let root = tmp_root("cross-process");
    let ledger = Ledger::open(&root).unwrap();
    let v = vp();
    ledger.write_intent(&v, 0, 7, SYNTH_NOW).unwrap();
    let tx = decoded_tx(7, 0xC3);
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["child_lock_holder", "--exact", "--ignored", "--nocapture"])
        .env("Z2C_CHILD_LOCK_ROOT", &root)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .expect("spawn child lock holder");
    let marker = root.join("CHILD-LOCKED");
    let mut signaled = false;
    for _ in 0..200 {
        if marker.exists() {
            signaled = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(signaled, "child never signaled it took the lock");
    let (done_tx, done_rx) = mpsc::channel();
    let thread_root = root.clone();
    let t = std::thread::spawn(move || {
        let ledger2 = Ledger::open(&thread_root).unwrap();
        let r = ledger2.record_signed_at_attempt(&v, 0, 1, &tx, SYNTH_NOW + 1);
        let _ = done_tx.send(r.is_ok());
    });
    assert!(
        done_rx.recv_timeout(Duration::from_millis(1200)).is_err(),
        "mutation completed while another PROCESS held the lock"
    );
    let _status = child.wait().expect("child exit");
    let ok = done_rx
        .recv_timeout(Duration::from_secs(15))
        .expect("completes after the child releases");
    assert!(ok, "the lawful transition wins after release");
    t.join().unwrap();
    let _ = std::fs::remove_file(&marker);
}
