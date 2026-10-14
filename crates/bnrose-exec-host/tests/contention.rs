//! Contention and durable-ack boundary battery (the founder's 2026-10-13
//! order): two genuinely independent supervisors from the same
//! pre-dispatch durable state; the crash matrix exactly around the
//! acknowledged persistence boundary; and the replacement policy's exact
//! law. Non-spending fixtures throughout.

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::opexec::{replica_paths, Claim, StepOptions, Supervisor};
use bnrose_exec_host::worker::{Bounds, NativeWorker, TrapKind, Worker, WorkerError};
use std::process::Command;

const NOW: u64 = 1_800_000_000;

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-contention-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn open(name: &str, root: u8) -> Supervisor {
    let state = tmp(name);
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[root; 32]).unwrap();
    Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap()
}

#[test]
fn a_second_live_supervisor_is_refused_and_adoption_is_explicit() {
    let state = tmp("claim");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x81; 32]).unwrap();
    let a = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    // the second supervisor — same process or any other — refuses BEFORE
    // it can admit, sign, or dispatch anything
    let err = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy())
        .err()
        .expect("the second supervisor must refuse");
    assert!(err.contains("already-claimed"), "{err}");
    drop(a);
    // release lets the next supervisor in
    let b = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy());
    assert!(b.is_ok());
    drop(b);
    // a crashed holder leaves the claim stale; adoption is EXPLICIT
    let leaked = Claim::acquire(&state).unwrap();
    std::mem::forget(leaked);
    assert!(Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).is_err());
    let adopted = Supervisor::open_with(&state, Box::new(NativeWorker::new()), test_policy(), true)
        .expect("explicit adoption works");
    drop(adopted);
}

#[test]
fn two_independent_processes_race_and_exactly_one_gains_authority() {
    // the decisive contention row: two OS PROCESSES starting concurrently
    // from the same pre-dispatch durable state. One acquires the claim and
    // completes the operation; the other is refused BEFORE it can produce
    // a signed attempt — not absorbed after the fact by ledger idempotency.
    let state = tmp("process-race");
    let bin = env!("CARGO_BIN_EXE_bnrose-exec-host");
    let root = "99".repeat(32);
    Command::new(bin)
        .args([
            "init",
            "--state",
            state.to_str().unwrap(),
            "--root-hex",
            &root,
        ])
        .env("BNROSE_EXEC_WASM", "")
        .output()
        .expect("init");
    let intent = state.join("intent.json");
    Command::new(bin)
        .args([
            "make-fixture",
            "--index",
            "30",
            "--now",
            &NOW.to_string(),
            "--ttl",
            "3600",
            "--out",
            intent.to_str().unwrap(),
        ])
        .output()
        .expect("fixture");
    let args = [
        "run-op".to_string(),
        "--state".into(),
        state.display().to_string(),
        "--intent".into(),
        intent.display().to_string(),
        "--clock".into(),
        NOW.to_string(),
        "--worker".into(),
        "native".into(),
    ];
    let mut a = Command::new(bin).args(&args).spawn().expect("spawn A");
    let mut b = Command::new(bin).args(&args).spawn().expect("spawn B");
    let ra = a.wait().expect("A").code();
    let rb = b.wait().expect("B").code();
    let codes = vec![ra, rb];
    assert_eq!(
        codes.iter().filter(|c| **c == Some(0)).count(),
        1,
        "exactly one supervisor completed: A={ra:?} B={rb:?}"
    );
    assert_eq!(
        codes.iter().filter(|c| **c == Some(1)).count(),
        1,
        "exactly one was refused: A={ra:?} B={rb:?}"
    );
    // exactly one admission, one effect — the loser never signed anything
    let keys = bnrose_exec_host::keys::SupervisorKeys::from_root(
        &<[u8; 32]>::try_from(bnrose_exec_host::unhex(&root).unwrap()).unwrap(),
    );
    let (records, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &replica_paths(&state),
        &keys.journal_mac,
    )
    .unwrap();
    assert_eq!(
        records
            .iter()
            .filter(|r| r.event == bnrose_exec_core::E_ADMITTED)
            .count(),
        1
    );
    let rows =
        bnrose_exec_host::ledger::load(&state.join("effects.bin"), &keys.ledger_mac).unwrap();
    assert_eq!(rows.len(), 1);
    println!("contention: two processes raced — one exit 0, one exit 1 (already-claimed); one admission, one effect, no second signed attempt");
}

/// A worker that dies exactly at dispatch (call #2): the step is left
/// Admitted+Reserved with a BoundedFail — conclusively never executed.
struct DeadAtDispatch {
    native: NativeWorker,
    calls: usize,
}

impl Worker for DeadAtDispatch {
    fn name(&self) -> &'static str {
        "dead-at-dispatch"
    }
    fn last_fuel(&self) -> u64 {
        0
    }
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.native.admit(req)
    }
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.calls += 1;
        if self.calls >= 2 {
            return Err(WorkerError::Trap {
                kind: TrapKind::Other,
                message: "simulated death at dispatch".into(),
            });
        }
        self.native.step(req)
    }
}

#[test]
fn the_durable_ack_boundary_matrix() {
    // B1: crash BEFORE durable admission — nothing exists; a first attempt
    // may proceed (its signature would be the first)
    {
        let mut s = open("b1", 0x82);
        let (records, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&s.state_dir),
            &s.keys.journal_mac,
        )
        .unwrap();
        assert!(records.is_empty(), "nothing was admitted");
        let report = s.recover(NOW).unwrap();
        assert_eq!(report["ops"].as_array().unwrap().len(), 0);
        let f = fixture(41, NOW, 600);
        let out = s.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert!(
            out.refused.is_none(),
            "the first attempt proceeds: {:?}",
            out.refused
        );
        let rows =
            bnrose_exec_host::ledger::load(&s.state_dir.join("effects.bin"), &s.keys.ledger_mac)
                .unwrap();
        assert_eq!(rows.len(), 1);
    }
    // B2: admission durable, crash BEFORE dispatch — reconstruct Reserved+
    // (stale); dispatch NOT permitted; no effect possible; the
    // authorization's one admission is spent, so no new signed attempt
    {
        let state = tmp("b2");
        bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x83; 32]).unwrap();
        let f = fixture(42, NOW, 600);
        {
            let mut s = Supervisor::open(
                &state,
                Box::new(DeadAtDispatch {
                    native: NativeWorker::new(),
                    calls: 0,
                }),
                test_policy(),
            )
            .unwrap();
            let out = s.run(
                &read_intent(&f.to_json()).unwrap(),
                NOW,
                false,
                &Bounds::default(),
            );
            assert!(out.refused.is_some(), "the run died at dispatch");
        }
        let mut s2 =
            Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let report = s2.recover(NOW).unwrap();
        // the worker's death was journaled as a bounded failure: the step
        // reconstructs as conclusively FAILED (never executed), not stale,
        // not unresolved
        assert_eq!(report["ops"][0]["stateAfter"], "failed");
        assert!(report["stale"].as_array().unwrap().is_empty());
        assert!(report["unknownsPreserved"].as_array().unwrap().is_empty());
        // dispatch is not permitted: re-running the same authorization refuses
        let again = s2.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
        let rows = bnrose_exec_host::ledger::load(&state.join("effects.bin"), &s2.keys.ledger_mac)
            .unwrap();
        assert!(rows.is_empty(), "no effect can exist before dispatch");
    }
    // B3: crash AFTER the external effect, BEFORE the local completion
    // record — reconstruct Dispatched; dispatch-again NOT permitted; the
    // record count freezes across re-submissions; recovery completes
    {
        let mut s = open("b3", 0x84);
        let f = fixture(43, NOW, 600);
        let out = s.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            true,
            &Bounds::default(),
        );
        assert!(out.lost_response);
        let dir = s.state_dir.clone();
        let journal_mac = s.keys.journal_mac;
        drop(s);
        let (before, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&dir),
            &journal_mac,
        )
        .unwrap();
        let mut s2 = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let again = s2.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
        let report = s2.recover(NOW + 1).unwrap();
        assert_eq!(report["ops"][0]["stateBefore"], "dispatched");
        assert_eq!(report["ops"][0]["stateAfter"], "completed");
        let (after, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&dir),
            &journal_mac,
        )
        .unwrap();
        assert!(
            after.len() > before.len(),
            "only the recovery records were added"
        );
        let rows =
            bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &s2.keys.ledger_mac).unwrap();
        assert_eq!(rows.len(), 1, "still one effect");
    }
    // B4: crash AFTER the completion record — reconstruct Completed;
    // recovery is idempotent; nothing new may occur
    {
        let mut s = open("b4", 0x85);
        let f = fixture(44, NOW, 600);
        let out = s.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert!(out.refused.is_none());
        let dir = s.state_dir.clone();
        let journal_mac = s.keys.journal_mac;
        drop(s);
        let (before, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&dir),
            &journal_mac,
        )
        .unwrap();
        let mut s2 = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let report = s2.recover(NOW + 1).unwrap();
        assert_eq!(report["ops"][0]["stateAfter"], "completed");
        let (after, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&dir),
            &journal_mac,
        )
        .unwrap();
        assert_eq!(before.len(), after.len(), "recovery invented nothing");
        let again = s2.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW + 1,
            false,
            &Bounds::default(),
        );
        assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
        let rows =
            bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &s2.keys.ledger_mac).unwrap();
        assert_eq!(rows.len(), 1);
    }
    println!("contention: the durable-ack boundary matrix holds at all four boundaries");
}

#[test]
fn step_replacement_follows_the_exact_policy_law() {
    // arrange a step that FAILS conclusively-before-execution (dies at
    // dispatch: admitted+reserved, bounded-failed, no effect row)
    let state = tmp("policy");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x86; 32]).unwrap();
    let f = fixture(45, NOW, 600);
    {
        let mut s = Supervisor::open(
            &state,
            Box::new(DeadAtDispatch {
                native: NativeWorker::new(),
                calls: 0,
            }),
            test_policy(),
        )
        .unwrap();
        let out = s.run_steps(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            &Bounds::default(),
            &[("propose", false)],
        );
        assert!(out.refused.is_some(), "the step died at dispatch");
    }
    // DEFAULT policy: replacement refused even though the attempt never
    // executed — one admitted attempt per step, no exceptions by default
    let mut s2 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let refused = s2.run_steps(
        &read_intent(&f.to_json()).unwrap(),
        NOW,
        &Bounds::default(),
        &[("propose", false)],
    );
    assert!(
        refused
            .refused
            .as_deref()
            .unwrap_or("")
            .contains("step:propose:failed — replacement not permitted by policy"),
        "{:?}",
        refused.refused
    );
    // EXPLICIT policy: the never-executed attempt is replaced by a NEW
    // attempt (the old records stand), and the workflow completes
    let done = s2.run_steps_opt(
        &read_intent(&f.to_json()).unwrap(),
        NOW,
        &Bounds::default(),
        &[("propose", false)],
        &StepOptions {
            replace_never_executed_failed_steps: true,
        },
    );
    assert!(done.refused.is_none(), "{:?}", done.refused);
    // both attempts are journaled (reconstructions never erased); ONE
    // effect exists (the failed attempt never executed)
    let (records, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &replica_paths(&state),
        &s2.keys.journal_mac,
    )
    .unwrap();
    let attempts = records
        .iter()
        .filter(|r| r.event == bnrose_exec_core::E_STEP_ADMITTED)
        .count();
    assert_eq!(
        attempts, 2,
        "the failed attempt and its policy-gated replacement"
    );
    let encoded_attempts: Vec<u8> = records
        .iter()
        .filter(|r| r.event == bnrose_exec_core::E_STEP_ADMITTED)
        .map(|r| r.payload[32] >> 4)
        .collect();
    assert_eq!(
        encoded_attempts,
        vec![0, 1],
        "attempt 0 preserved, attempt 1 the replacement"
    );
    let rows =
        bnrose_exec_host::ledger::load(&state.join("effects.bin"), &s2.keys.ledger_mac).unwrap();
    assert_eq!(
        rows.len(),
        1,
        "only the executed attempt produced an effect"
    );
    println!("contention: default policy refused the replacement; the explicit policy replaced the never-executed attempt as a new journaled attempt, one effect");
}
