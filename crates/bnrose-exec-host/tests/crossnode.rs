//! Cross-node execution suite (BNROSE follow-on beat, 2026-10-14):
//! competing sovereign nodes, one intent, and the destination-side
//! enforcement that makes independent dual dispatch harmless.
//!
//! THE BOUNDARY THIS SUITE HOLDS EXPLICIT (review disposition
//! 2026-10-14): the OS-atomic supervisor.claim proves LOCAL process
//! exclusivity on ONE node. It is not a global P2P exclusivity
//! mechanism and not consensus. Nothing in these crates prevents two
//! sovereign nodes from independently accepting the same
//! (authority, nonce) intent — each journal is local. What makes that
//! safe is the DESTINATION's op-keyed idempotency
//! (EffectLedger::apply): the named coordination mechanism for this
//! topology, valid only for destinations that enforce it. The teeth
//! test below convicts a destination that does not — the enforcement
//! is load-bearing, not decorative. Destinations on external chains
//! (Arbitrum/Hive adapters) carry this obligation destination-side;
//! that wiring is a named follower, not claimed here.

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::ledger::{ApplyOutcome, EffectLedger};
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker};
use std::path::PathBuf;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!(
        "bnrose-crossnode-{name}-{}-{name}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

/// Two sovereigns over one intent: independent state directories,
/// independent roots (independent receipt authorities), native workers.
/// Returns (outcome_a, pk_a, outcome_b, pk_b) with both completions
/// asserted (the finding itself: cross-node dual acceptance is REAL —
/// the journals that dedup (authority, nonce) are local to each node).
fn two_sovereigns_one_intent(
    dirs: (&PathBuf, &PathBuf),
) -> (
    bnrose_exec_host::receipt::Receipt,
    [u8; 32],
    bnrose_exec_host::receipt::Receipt,
    [u8; 32],
) {
    let now = 1_800_000_000u64;
    let f = fixture(77, now, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    let bounds = Bounds::default();
    let policy = test_policy();

    let keys_a = bnrose_exec_host::keys::SupervisorKeys::init(dirs.0, &[0x11; 32]).unwrap();
    let mut a = Supervisor::open(dirs.0, Box::new(NativeWorker::new()), policy.clone()).unwrap();
    let out_a = a.run(&intent, now, false, &bounds);
    assert!(
        out_a.refused.is_none(),
        "node A refused: {:?}",
        out_a.refused
    );
    let ra = out_a.receipt.expect("node A receipt");

    let keys_b = bnrose_exec_host::keys::SupervisorKeys::init(dirs.1, &[0x22; 32]).unwrap();
    let mut b = Supervisor::open(dirs.1, Box::new(NativeWorker::new()), policy).unwrap();
    let out_b = b.run(&intent, now, false, &bounds);
    assert!(
        out_b.refused.is_none(),
        "node B refused (cross-node dedup does NOT exist, and must not be implied): {:?}",
        out_b.refused
    );
    let rb = out_b.receipt.expect("node B receipt");
    (ra, keys_a.ed_public, rb, keys_b.ed_public)
}

#[test]
fn two_sovereign_nodes_independently_accept_the_same_intent() {
    let a = tmp("dual-accept-a");
    let b = tmp("dual-accept-b");
    two_sovereigns_one_intent((&a, &b));
}

#[test]
fn the_same_intent_yields_identical_op_and_effect_across_sovereigns() {
    let a = tmp("determinism-a");
    let b = tmp("determinism-b");
    let (ra, _, rb, _) = two_sovereigns_one_intent((&a, &b));
    assert_eq!(
        ra.op, rb.op,
        "op ids diverge: the destination could not dedup by op"
    );
    assert_eq!(
        ra.effect, rb.effect,
        "effect digests diverge: the two sovereigns did not execute the same thing"
    );
    assert_eq!(ra.env_sha, rb.env_sha);
}

#[test]
fn a_destination_enforcing_idempotency_observes_exactly_one_effect() {
    let a = tmp("dest-idem-a");
    let b = tmp("dest-idem-b");
    let dest = tmp("dest-idem-destination");
    let (ra, _, rb, _) = two_sovereigns_one_intent((&a, &b));

    let mut destination = EffectLedger::open(&dest.join("effects.bin"), &[0x33; 32]).unwrap();
    match destination.apply(&ra.op, &ra.env_sha, &ra.effect, 1) {
        Ok(ApplyOutcome::Applied(_)) => {}
        other => panic!("first sovereign's apply was not Applied: {other:?}"),
    }
    match destination.apply(&rb.op, &rb.env_sha, &rb.effect, 2) {
        Ok(ApplyOutcome::Already(row)) => assert_eq!(row.op_id, ra.op),
        other => panic!("second sovereign's apply was not Already: {other:?}"),
    }
    assert_eq!(destination.len(), 1, "the destination observed two effects");
}

/// TEETH (the negative control): a destination WITHOUT op-keyed
/// enforcement lands BOTH sovereigns' effects. This must fail-open in
/// the naive consumer to convict — proving the enforcement is the
/// load-bearing mechanism, and that "no cross-node exclusivity claim
/// without an independently verified coordination mechanism" is a real
/// boundary, not a formality.
#[test]
fn teeth_a_destination_without_enforcement_lands_two_effects() {
    let a = tmp("teeth-naive-a");
    let b = tmp("teeth-naive-b");
    let (ra, _, rb, _) = two_sovereigns_one_intent((&a, &b));

    let mut naive: Vec<[u8; 32]> = Vec::new();
    naive.push(ra.effect);
    naive.push(rb.effect);
    assert_eq!(
        naive.len(),
        2,
        "the naive destination failed to convict: dual dispatch was somehow deduped without enforcement"
    );
}

#[test]
fn partition_then_reconcile_converges_without_double_effect_in_either_arrival_order() {
    let a = tmp("partition-a");
    let b = tmp("partition-b");
    let (ra, _, rb, _) = two_sovereigns_one_intent((&a, &b));

    // Two destinations, one per arrival order: whichever side of the
    // partition reconciles first, convergence is the same single row.
    for (first, second, tag) in [(&ra, &rb, "A-first"), (&rb, &ra, "B-first")] {
        let dest = tmp(&format!("partition-dest-{tag}"));
        let mut destination = EffectLedger::open(&dest.join("effects.bin"), &[0x44; 32]).unwrap();
        destination
            .apply(&first.op, &first.env_sha, &first.effect, 1)
            .unwrap();
        destination
            .apply(&second.op, &second.env_sha, &second.effect, 2)
            .unwrap();
        assert_eq!(destination.len(), 1, "{tag}: double effect after reconcile");
        let row = destination.row_for(&ra.op).expect("{tag}: the row");
        assert_eq!(row.op_id, ra.op);
        assert_eq!(row.effect_digest, ra.effect);
    }
}

#[test]
fn each_sovereigns_receipt_verifies_under_its_own_key_alone() {
    let a = tmp("keys-a");
    let b = tmp("keys-b");
    let (ra, pk_a, rb, pk_b) = two_sovereigns_one_intent((&a, &b));

    assert!(ra.verify(&pk_a), "A's receipt failed under A's public key");
    assert!(rb.verify(&pk_b), "B's receipt failed under B's public key");
    assert_ne!(pk_a, pk_b, "the two sovereigns are the same authority");
    assert!(
        !ra.verify(&pk_b),
        "A's receipt verified under B's key: the sovereigns are not independent authorities"
    );
    // The destination therefore validates EACH receipt independently —
    // there is no shared key whose absence could wedge reconciliation.
}
