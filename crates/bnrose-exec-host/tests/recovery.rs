//! Recovery battery (BNROSE-RUST-001): every crash point, every tamper,
//! and the two laws — UNKNOWN is preserved, and a missing response never
//! authorizes a replacement.

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker, TrapKind, Worker, WorkerError};

const NOW: u64 = 1_800_000_000;

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-recovery-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn sup(name: &str) -> Supervisor {
    let state = tmp(name);
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x33; 32]).unwrap();
    Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap()
}

#[test]
fn crash_after_effect_recovers_the_same_operation_from_ledger_evidence() {
    let mut s = sup("after-effect");
    let f = fixture(1, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    // the WB004 retry crash point: dispatched, effect applied, response lost
    let out = s.run(&intent, NOW, true, &Bounds::default());
    assert!(out.lost_response);
    let op = out.op.unwrap();
    let rows_before =
        bnrose_exec_host::ledger::load(&s.state_dir.join("effects.bin"), &s.keys.ledger_mac)
            .unwrap();
    assert_eq!(rows_before.len(), 1);
    // a clean replacement supervisor (new process would be the same thing:
    // nothing in memory survives) recovers from the records alone — under
    // the claim law the crashed holder's authority releases first
    let dir = s.state_dir.clone();
    let ledger_mac = s.keys.ledger_mac;
    drop(s);
    let mut s2 = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let report = s2.recover(NOW + 10).unwrap();
    assert_eq!(report["ops"].as_array().unwrap().len(), 1);
    let rop = &report["ops"][0];
    assert_eq!(rop["stateBefore"], "dispatched");
    assert_eq!(rop["stateAfter"], "completed");
    assert_eq!(rop["recovered"], serde_json::json!(true));
    assert_eq!(rop["invariantReverified"], serde_json::json!(true));
    assert!(report["unknownsPreserved"].as_array().unwrap().is_empty());
    // still exactly one effect row, and the same operation
    let rows_after = bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &ledger_mac).unwrap();
    assert_eq!(rows_after.len(), 1);
    assert_eq!(rows_after[0].op_id, op);
    // the recovered receipt verifies and says recovered
    let receipt = std::fs::read_to_string(
        dir.join("receipts")
            .join(format!("op-{}.json", bnrose_exec_host::hex(&op))),
    )
    .unwrap();
    let v: serde_json::Value = serde_json::from_str(&receipt).unwrap();
    assert_eq!(v["recovered"], serde_json::json!(true));
    let r = bnrose_exec_host::receipt::Receipt::from_json(&v).unwrap();
    assert!(r.verify(&s2.keys.ed_public));
    // and a re-run of the same intent is still refused (nonce spent once)
    let again = s2.run(&intent, NOW, false, &Bounds::default());
    assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
}

#[test]
fn lost_durable_evidence_preserves_unknown_and_never_replaces() {
    // the adversarial sibling: the dispatch happened, the response was
    // lost, AND the ledger cannot prove the effect (the durable evidence
    // is gone). Recovery must fail safe: UNKNOWN, preserved across as many
    // restarts as you like, no re-dispatch, no replacement admitted.
    let mut s = sup("unknown");
    let f = fixture(2, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    let out = s.run(&intent, NOW, true, &Bounds::default());
    assert!(out.lost_response);
    let op = out.op.unwrap();
    let dir = s.state_dir.clone();
    drop(s);
    // "the ledger lost the row" — outside the system's own operations, the
    // honest name for this run
    std::fs::remove_file(dir.join("effects.bin")).unwrap();
    for round in 0..3 {
        let mut s2 = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let report = s2.recover(NOW + 10).unwrap();
        let unknowns = report["unknownsPreserved"].as_array().unwrap();
        assert_eq!(unknowns.len(), 1, "round {round}: the unknown must survive");
        assert_eq!(unknowns[0], serde_json::json!(bnrose_exec_host::hex(&op)));
        let rop = &report["ops"][0];
        assert_eq!(rop["stateAfter"], "unknown", "round {round}");
        // the unknown op's receipt states UNKNOWN and verifies
        let rop_receipt = &rop["receipt"];
        assert_eq!(rop_receipt["stateWord"], "unknown");
        // a replacement operation with the same authorization is refused
        let again = s2.run(&intent, NOW + 10, false, &Bounds::default());
        assert_eq!(
            again.refused.as_deref(),
            Some("admission:nonce-reuse"),
            "round {round}: a missing response must not authorize a replacement"
        );
    }
}

/// A worker that dies at dispatch: the operation is left Reserved, no
/// effect, no dispatch record — recovery reports it stale and invents
/// nothing.
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
                message: "simulated worker death at dispatch".into(),
            });
        }
        self.native.step(req)
    }
}

#[test]
fn crash_before_dispatch_is_reported_stale_and_invents_nothing() {
    let state = tmp("pre-dispatch");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x34; 32]).unwrap();
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
        let f = fixture(3, NOW, 600);
        let out = s.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert!(
            out.refused.is_some(),
            "the run must fail: {:?}",
            out.refused
        );
    }
    let mut s2 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let report = s2.recover(NOW).unwrap();
    // the worker's death at dispatch is now JOURNALED as a bounded failure:
    // the operation reconstructs conclusively FAILED (never executed)
    // instead of lingering stale
    assert_eq!(report["ops"][0]["stateAfter"], "failed");
    assert!(report["stale"].as_array().unwrap().is_empty());
    assert!(report["unknownsPreserved"].as_array().unwrap().is_empty());
    // no effect row exists, and nothing completed
    let ledger_mac = s2.keys.ledger_mac;
    drop(s2);
    let rows = bnrose_exec_host::ledger::load(&state.join("effects.bin"), &ledger_mac).unwrap();
    assert!(rows.is_empty());
    // a FRESH intent (new nonce) through a healthy worker completes —
    // recovery of the stale one is a human/epoch decision, not forced
    let mut s3 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let f2 = fixture(31, NOW, 600);
    let out = s3.run(
        &read_intent(&f2.to_json()).unwrap(),
        NOW,
        false,
        &Bounds::default(),
    );
    assert!(out.refused.is_none());
}

#[test]
fn journal_tamper_fails_recovery_closed_before_any_decision() {
    let mut s = sup("journal-tamper");
    let f = fixture(4, NOW, 600);
    assert!(s
        .run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default()
        )
        .refused
        .is_none());
    let keys = s.keys.clone();
    drop(s);
    let mut bytes = std::fs::read(tmp_of("journal-tamper").join("journal.bin")).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 1;
    std::fs::write(tmp_of("journal-tamper").join("journal.bin"), &bytes).unwrap();
    // the tamper is caught at OPEN (the chain verifies before the journal's
    // tail continues) — fail-closed before any decision, and certainly
    // before recovery could act on a damaged record
    let err = Supervisor::open(
        &tmp_of("journal-tamper"),
        Box::new(NativeWorker::new()),
        test_policy(),
    )
    .err()
    .expect("the tampered journal must refuse to open");
    assert!(err.starts_with("journal"), "{err}");
    // and the ledger is untouched by the failed recovery
    let rows = bnrose_exec_host::ledger::load(
        &tmp_of("journal-tamper").join("effects.bin"),
        &keys.ledger_mac,
    )
    .unwrap();
    assert_eq!(rows.len(), 1);
}

#[test]
fn ledger_tamper_fails_recovery_closed() {
    let mut s = sup("ledger-tamper");
    let f = fixture(5, NOW, 600);
    assert!(s
        .run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default()
        )
        .refused
        .is_none());
    drop(s);
    let mut bytes = std::fs::read(tmp_of("ledger-tamper").join("effects.bin")).unwrap();
    bytes[40] ^= 1;
    std::fs::write(tmp_of("ledger-tamper").join("effects.bin"), &bytes).unwrap();
    // the ledger's own chain refuses at load: recovery aborts, nothing
    // completes, nothing is written
    let err = Supervisor::open(
        &tmp_of("ledger-tamper"),
        Box::new(NativeWorker::new()),
        test_policy(),
    )
    .err()
    .expect("the tampered ledger must refuse to open");
    assert!(err.starts_with("ledger"), "{err}");
}

#[test]
fn a_duplicate_admission_in_the_journal_is_an_alarm_not_a_fact() {
    use bnrose_exec_core::E_ADMITTED;
    let state = tmp("dup");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x35; 32]).unwrap();
    let f = fixture(6, NOW, 600);
    {
        // write the duplicate records to BOTH replicas (a single-replica
        // write would be divergence, a different and also-fatal alarm)
        let paths = bnrose_exec_host::opexec::replica_paths(&state);
        std::fs::create_dir_all(paths[1].parent().unwrap()).unwrap();
        for p in &paths {
            let mut j = bnrose_exec_host::journal::Journal::open(
                p,
                &bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x35; 32]).journal_mac,
            )
            .unwrap();
            // the same admitted record twice, chain-valid (written by the
            // journal itself): the REPLAY layer must still refuse the world
            // where one authorization lives in two operations
            let payload = {
                let mut p = Vec::new();
                p.extend_from_slice(&f.authority);
                let sig = f.sig;
                p.extend_from_slice(&sig);
                let pd = bnrose_exec_core::policy_digest(&test_policy().wire());
                p.extend_from_slice(&pd);
                p.extend_from_slice(&(f.env.len() as u16).to_le_bytes());
                p.extend_from_slice(&f.env);
                p
            };
            j.append(&[1; 32], E_ADMITTED, &payload).unwrap();
            j.append(&[2; 32], E_ADMITTED, &payload).unwrap();
        }
    }
    let mut s = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let err = s.recover(NOW).unwrap_err();
    assert!(err.contains("nonce-duplicate"), "{err}");
}

fn tmp_of(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("bnrose-recovery-{name}-{}", std::process::id()))
}
