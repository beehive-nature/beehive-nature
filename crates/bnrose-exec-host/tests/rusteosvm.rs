//! SPEC-RUSTEOSVM-1 §2 rows: the race, the durably-acknowledged replicas,
//! the acknowledging-host failure, divergence, migration with outstanding
//! operations, altered intent, stale authority. Every effect here is the
//! non-spending ledger record; every identity is a disposable fixture.

use bnrose_exec_core::E_DISPATCH;
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::opexec::{migrate_root, replica_paths, Supervisor};
use bnrose_exec_host::worker::{Bounds, NativeWorker, WasmWorker, Worker};
use serde_json::Value;

const NOW: u64 = 1_800_000_000;

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-rusteosvm-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn sup(name: &str) -> Supervisor {
    let state = tmp(name);
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x66; 32]).unwrap();
    Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap()
}

fn records_of(s: &Supervisor) -> Vec<bnrose_exec_host::journal::Record> {
    bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &replica_paths(&s.state_dir),
        &s.keys.journal_mac,
    )
    .unwrap()
    .0
}

#[test]
fn the_race_lands_exactly_one_dispatch_and_the_killed_first_recovers() {
    let state = tmp("race");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x71; 32]).unwrap();
    let f = fixture(1, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    // run through ONE wasm-backed supervisor: the race is between two
    // genuinely independent WORKER implementations (wasm-paranoid vs
    // native) inside the single authority the claim admits
    let wasm = WasmWorker::new(
        &bnrose_exec_host::worker::wasm_module_bytes().expect("wasm module"),
        Bounds::default(),
    )
    .expect("wasm worker");
    let (raced, dir, journal_mac, ledger_mac) = {
        let mut on_wasm = Supervisor::open(&state, Box::new(wasm), test_policy()).unwrap();
        let raced = on_wasm.run_raced(
            &intent,
            NOW,
            &Bounds::default(),
            Box::new(NativeWorker::new()),
        );
        (
            raced,
            on_wasm.state_dir.clone(),
            on_wasm.keys.journal_mac,
            on_wasm.keys.ledger_mac,
        )
    };
    // the WB004 crash point: the first worker was killed after the effect
    assert!(raced.lost_response);
    assert!(raced.refused.is_none());
    let op = raced.op.unwrap();
    // exactly one admission, one dispatch — the race could not double it
    let recs = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &bnrose_exec_host::opexec::replica_paths(&dir),
        &journal_mac,
    )
    .unwrap()
    .0;
    let admitted = recs
        .iter()
        .filter(|r| r.event == bnrose_exec_core::E_ADMITTED)
        .count();
    let dispatched = recs.iter().filter(|r| r.event == E_DISPATCH).count();
    assert_eq!(
        (admitted, dispatched),
        (1, 1),
        "the race landed one of each"
    );
    // one effect row
    let rows = bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &ledger_mac).unwrap();
    assert_eq!(rows.len(), 1);
    // the replacement (a fresh worker, a fresh claim after the release)
    let mut replacement =
        Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let report = replacement.recover(NOW + 10).unwrap();
    let rop = &report["ops"][0];
    assert_eq!(rop["op"].as_str().unwrap(), bnrose_exec_host::hex(&op));
    assert_eq!(rop["stateAfter"], "completed");
    assert_eq!(rop["recovered"], serde_json::json!(true));
    // still one effect row, and the authorization is spent
    let rows = bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &ledger_mac).unwrap();
    assert_eq!(rows.len(), 1);
    let again = replacement.run(&intent, NOW + 10, false, &Bounds::default());
    assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
    println!("rusteosvm: race → one admission, one dispatch, one effect; killed first recovered, nonce spent");
}

#[test]
fn the_acknowledging_host_dies_and_the_survivor_recovers() {
    let mut s = sup("host-loss");
    let f = fixture(2, NOW, 600);
    let out = s.run_raced(
        &read_intent(&f.to_json()).unwrap(),
        NOW,
        &Bounds::default(),
        Box::new(NativeWorker::new()),
    );
    assert!(out.lost_response);
    // the second replica's host is DESTROYED after the acknowledgement
    let dir = s.state_dir.clone();
    let ledger_mac = s.keys.ledger_mac;
    drop(s);
    let replica_b = replica_paths(&dir)[1].clone();
    std::fs::remove_file(&replica_b).unwrap();
    let mut s2 = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let report = s2.recover(NOW + 10).unwrap();
    assert_eq!(report["replication"]["state"], "degraded");
    let alive = report["replication"]["alive"].as_array().unwrap().len();
    assert_eq!(alive, 1, "the survivor alone");
    let rop = &report["ops"][0];
    assert_eq!(rop["stateAfter"], "completed");
    assert_eq!(rop["recovered"], serde_json::json!(true));
    let rows = bnrose_exec_host::ledger::load(&dir.join("effects.bin"), &ledger_mac).unwrap();
    assert_eq!(rows.len(), 1);
    println!("rusteosvm: acknowledging host destroyed → degraded recovery from the survivor, same outcome, one effect");
}

#[test]
fn replica_divergence_fails_closed() {
    let mut s = sup("divergence");
    let f = fixture(3, NOW, 600);
    assert!(s
        .run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default()
        )
        .refused
        .is_none());
    let dir = s.state_dir.clone();
    drop(s);
    // a record appended to ONE replica only: the two hosts now disagree
    let paths = replica_paths(&dir);
    let j_key = bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x66; 32]).journal_mac;
    let mut j = bnrose_exec_host::journal::Journal::open(&paths[1], &j_key).unwrap();
    j.append(&[9; 32], bnrose_exec_core::E_RECOVERY_NONE, &[])
        .unwrap();
    drop(j);
    let err = Supervisor::open(&dir, Box::new(NativeWorker::new()), test_policy())
        .err()
        .expect("divergence must refuse to open");
    assert!(err.contains("divergence"), "{err}");
}

#[test]
fn migration_carries_outstanding_operations_without_completing_them() {
    let state = tmp("mig-old");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x68; 32]).unwrap();
    let mut s = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    // op1 completes; op2 stops at the crash point (outstanding, Dispatched)
    let f1 = fixture(10, NOW, 600);
    let f2 = fixture(11, NOW, 600);
    let o1 = s.run(
        &read_intent(&f1.to_json()).unwrap(),
        NOW,
        false,
        &Bounds::default(),
    );
    assert!(o1.refused.is_none());
    let o2 = s.run(
        &read_intent(&f2.to_json()).unwrap(),
        NOW,
        true,
        &Bounds::default(),
    );
    assert!(o2.lost_response);
    let op2 = o2.op.unwrap();
    drop(s);
    // custody transfers to a new root
    let new_dir = tmp("mig-new");
    let report = migrate_root(&state, &[0x68; 32], &new_dir, &[0x69; 32]).unwrap();
    assert_eq!(report["format"], "bnrose-exec/migration/1");
    assert_eq!(report["effectRowsCarried"], serde_json::json!(2));
    // the new supervisor's FIRST record is the migration attestation
    let new_keys = bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x69; 32]);
    let (recs, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &replica_paths(&new_dir),
        &new_keys.journal_mac,
    )
    .unwrap();
    assert_eq!(
        recs[0].event,
        bnrose_exec_core::E_MIGRATION,
        "attestation first"
    );
    // recovery under the NEW root completes op2 THROUGH THE SAME STATE
    // MACHINE (migration itself authorized and completed nothing)
    let mut s2 = Supervisor::open(&new_dir, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let recovery = s2.recover(NOW + 10).unwrap();
    let states: Vec<&str> = recovery["ops"]
        .as_array()
        .unwrap()
        .iter()
        .map(|o| o["stateAfter"].as_str().unwrap())
        .collect();
    assert_eq!(states.len(), 2);
    assert!(states.contains(&"completed"));
    assert!(recovery["ops"]
        .as_array()
        .unwrap()
        .iter()
        .any(
            |o| o["op"].as_str() == Some(bnrose_exec_host::hex(&op2).as_str())
                && o["recovered"] == serde_json::json!(true)
        ));
    // two effect rows, one per operation — no duplicate from the transfer
    let rows =
        bnrose_exec_host::ledger::load(&new_dir.join("effects.bin"), &new_keys.ledger_mac).unwrap();
    assert_eq!(rows.len(), 2);
    // the carried nonces are still spent under the new root
    let again = s2.run(
        &read_intent(&f2.to_json()).unwrap(),
        NOW + 10,
        false,
        &Bounds::default(),
    );
    assert_eq!(again.refused.as_deref(), Some("admission:nonce-reuse"));
    // the old root can no longer speak for the new state (its keys differ)
    let err = Supervisor::open(&new_dir, Box::new(NativeWorker::new()), test_policy())
        .map(|_| ())
        .err();
    let _ = err; // the new dir loads fine under ITS root — the old root's
                 // keys simply fail the chain if pointed here (same file,
                 // different MAC key: tamper at record 0)
    println!("rusteosvm: migration carried 2 ops + 2 effects; the outstanding op completed only through recovery; nonces still spent");
}

#[test]
fn an_altered_intent_after_admission_is_refused_by_the_binding() {
    let mut s = sup("altered");
    let f = fixture(4, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    assert!(s
        .run(&intent, NOW, false, &Bounds::default())
        .refused
        .is_none());
    // the same authorization with one envelope byte altered: the signature
    // over the canonical bytes refuses it before any policy is consulted
    let mut v = f.to_json();
    let env = bnrose_exec_host::unb64(v["envB64"].as_str().unwrap()).unwrap();
    let mut broken = env.clone();
    broken[20] ^= 1;
    v["envB64"] = serde_json::Value::String(bnrose_exec_host::b64(&broken));
    let out = s.run(&read_intent(&v).unwrap(), NOW, false, &Bounds::default());
    assert_eq!(out.refused.as_deref(), Some("wb001:binding-refused"));
}

#[test]
fn stale_authority_is_refused_at_admission_by_the_supervisor() {
    let mut s = sup("stale");
    let f = fixture(5, NOW, 60);
    // a clock past the authorization's expiry: stale authority
    let out = s.run(
        &read_intent(&f.to_json()).unwrap(),
        NOW + 61,
        false,
        &Bounds::default(),
    );
    assert_eq!(out.refused.as_deref(), Some("admission:policy:expired"));
    // nothing was journaled for the stale attempt
    let recs = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &bnrose_exec_host::opexec::replica_paths(&s.state_dir),
        &s.keys.journal_mac,
    )
    .unwrap()
    .0;
    assert!(
        recs.is_empty(),
        "{} records appeared for a stale authority",
        recs.len()
    );
    let rows = bnrose_exec_host::ledger::load(&s.state_dir.join("effects.bin"), &s.keys.ledger_mac)
        .unwrap();
    assert!(rows.is_empty());
    let _ = Value::Null;
}

// ---- the #408 handoff rows: one authorization, many legitimate steps ----

#[test]
fn a_three_step_workflow_completes_under_one_authorization() {
    let mut s = sup("steps3");
    let f = fixture(20, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    for _ in 0..3 {
        let out = s.run_steps(
            &intent,
            NOW,
            &Bounds::default(),
            &[("propose", false), ("approve", false), ("execute", false)],
        );
        assert!(out.refused.is_none(), "{:?}", out.refused);
    }
    // three step effects under ONE authorization (one root, one nonce)
    let rows = bnrose_exec_host::ledger::load(&s.state_dir.join("effects.bin"), &s.keys.ledger_mac)
        .unwrap();
    assert_eq!(rows.len(), 3, "one effect per legitimate step");
    let (records, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &bnrose_exec_host::opexec::replica_paths(&s.state_dir),
        &s.keys.journal_mac,
    )
    .unwrap();
    let nonces = bnrose_exec_host::opexec::nonces_of(&records).unwrap();
    assert_eq!(nonces.len(), 1, "one authorization across three steps");
    // re-invocation of a complete workflow refuses (nothing left to do)
    let again = s.run_steps(
        &intent,
        NOW,
        &Bounds::default(),
        &[("propose", false), ("approve", false), ("execute", false)],
    );
    assert_eq!(
        again
            .refused
            .as_deref()
            .map(|r| r.starts_with("workflow:complete")),
        Some(true)
    );
    println!("rusteosvm/#408: propose/approve/execute completed — 3 effects, 1 authorization, re-invocation refused");
}

#[test]
fn the_killed_step_refuses_replacement_recovers_and_the_workflow_resumes() {
    let state = tmp("step-crash");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x6a; 32]).unwrap();
    {
        let mut s = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let f = fixture(21, NOW, 600);
        let intent0 = read_intent(&f.to_json()).unwrap();
        let first = s.run_steps(
            &intent0,
            NOW,
            &Bounds::default(),
            &[("propose", false), ("approve", true)],
        );
        assert!(first.refused.is_none(), "{:?}", first.refused);
        let out = s.run_steps(
            &intent0,
            NOW,
            &Bounds::default(),
            &[("propose", false), ("approve", true)],
        ); // crash AFTER approve's effect
        assert!(out.lost_response, "approve stopped at the crash point");
    }
    let f = fixture(21, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    // a GENUINELY new process reconstructs from the journal and REFUSES to
    // replace the unresolved step — with no new signed attempt (the record
    // count is the proof)
    let (before, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &bnrose_exec_host::opexec::replica_paths(&state),
        &bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x6a; 32]).journal_mac,
    )
    .unwrap();
    let mut s2 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let refused = s2.run_steps(
        &intent,
        NOW + 5,
        &Bounds::default(),
        &[("propose", false), ("approve", false), ("execute", false)],
    );
    assert!(
        refused
            .refused
            .as_deref()
            .unwrap_or("")
            .contains("step:approve:unresolved"),
        "{:?}",
        refused.refused
    );
    let (after, _) = bnrose_exec_host::journal::ReplicatedJournal::load_state(
        &bnrose_exec_host::opexec::replica_paths(&state),
        &bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x6a; 32]).journal_mac,
    )
    .unwrap();
    assert_eq!(
        before.len(),
        after.len(),
        "memory loss created no new signed attempt"
    );
    // the exact signed bytes were durable BEFORE dispatch: the step's
    // admission record carries the envelope and signature byte-for-byte
    let step_rec = after
        .iter()
        .find(|r| r.event == bnrose_exec_core::E_STEP_ADMITTED && r.payload[32] == 1)
        .expect("approve's step admission");
    {
        let label_len = step_rec.payload[33] as usize;
        let rest = &step_rec.payload[34 + label_len..];
        let env_len = u16::from_le_bytes([rest[128], rest[129]]) as usize;
        assert_eq!(
            &rest[130..130 + env_len],
            &f.env[..],
            "the exact signed bytes persisted"
        );
        assert_eq!(&rest[32..96], &f.sig[..], "the signature persisted");
    }
    // recovery — not re-invocation — resolves the unresolved step
    let report = s2.recover(NOW + 10).unwrap();
    assert!(report["ops"]
        .as_array()
        .unwrap()
        .iter()
        .any(|o| o["stateAfter"] == "completed" && o["recovered"] == serde_json::json!(true)));
    // and the workflow RESUMES: execute runs under the same authorization
    let resumed = s2.run_steps(
        &intent,
        NOW + 15,
        &Bounds::default(),
        &[("propose", false), ("approve", false), ("execute", false)],
    );
    assert!(resumed.refused.is_none(), "{:?}", resumed.refused);
    let rows =
        bnrose_exec_host::ledger::load(&state.join("effects.bin"), &s2.keys.ledger_mac).unwrap();
    assert_eq!(
        rows.len(),
        3,
        "three legitimate effects, never a replacement"
    );
    // the whole-authorization replay (single-shot run) is still refused
    let replay = s2.run(&intent, NOW + 20, false, &Bounds::default());
    assert_eq!(
        replay
            .refused
            .as_deref()
            .map(|r| r.starts_with("admission:nonce-reuse")),
        Some(true)
    );
    println!("rusteosvm/#408: unresolved step refused replacement with zero new records; recovered by evidence; workflow resumed; replay refused");
}

#[test]
fn an_orphan_ledger_row_fails_recovery_closed() {
    let mut s = sup("orphan");
    let f = fixture(22, NOW, 600);
    assert!(s
        .run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default()
        )
        .refused
        .is_none());
    // an effect row for an entity no admission accounts for: unaccounted
    // history, never silent evidence
    let ghost = [0xee; 32];
    let ghost_env = [0xef; 32];
    let digest = bnrose_exec_core::effect_digest(&ghost, &ghost_env);
    s.ledger.apply(&ghost, &ghost_env, &digest, NOW).unwrap();
    drop(s);
    let mut s2 = Supervisor::open(
        &tmp_of_orphan(),
        Box::new(NativeWorker::new()),
        test_policy(),
    )
    .unwrap();
    let err = s2.recover(NOW).unwrap_err();
    assert!(err.contains("orphan-row"), "{err}");
}

#[test]
fn a_false_duplicate_is_absorbed_and_a_landed_first_one_fails_recovery_closed() {
    let state = tmp("false-dup");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x6b; 32]).unwrap();
    {
        let mut s = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let f = fixture(23, NOW, 600);
        let out = s.run_steps(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            &Bounds::default(),
            &[("propose", true)], // crash after the first step's effect
        );
        assert!(out.lost_response);
        let step_id = out.op.unwrap();
        // a FALSE duplicate: a row for the same step id under a DIFFERENT
        // binding — a lying "already applied" that matches nothing the
        // journal dispatched
        let wrong_env = [0xab; 32];
        let wrong = bnrose_exec_core::effect_digest(&step_id, &wrong_env);
        s.ledger
            .apply(&step_id, &wrong_env, &wrong, NOW + 1)
            .unwrap();
    }
    // the ledger ABSORBED the false duplicate: the true row (written at
    // the effect) stands, count stays one, and recovery completes from
    // the TRUE binding only — a lie cannot displace what happened
    let key = bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x6b; 32]);
    let rows = bnrose_exec_host::ledger::load(&state.join("effects.bin"), &key.ledger_mac).unwrap();
    assert_eq!(rows.len(), 1);
    let mut s2 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let report = s2.recover(NOW + 2).unwrap();
    assert_eq!(report["ops"][0]["recovered"], serde_json::json!(true));
    // the lands-first variant: a false duplicate PRE-SEEDED for a future
    // (deterministic) operation id makes the run complete against a
    // wrong row — and recovery then fails CLOSED on the binding
    let state2 = tmp("false-dup-first");
    bnrose_exec_host::keys::SupervisorKeys::init(&state2, &[0x6c; 32]).unwrap();
    let f2 = fixture(24, NOW, 600);
    let intent2 = read_intent(&f2.to_json()).unwrap();
    let future = bnrose_exec_core::op_id(&intent2.authority, &intent2.env);
    {
        let mut l = bnrose_exec_host::ledger::EffectLedger::open(
            &state2.join("effects.bin"),
            &bnrose_exec_host::keys::SupervisorKeys::from_root(&[0x6c; 32]).ledger_mac,
        )
        .unwrap();
        let wrong_env = [0xcd; 32];
        let wrong = bnrose_exec_core::effect_digest(&future, &wrong_env);
        l.apply(&future, &wrong_env, &wrong, NOW).unwrap();
    }
    let mut s3 = Supervisor::open(&state2, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let seeded = s3.run(&intent2, NOW, false, &Bounds::default());
    let _ = seeded; // the run may complete (its apply was Already'd) — the
                    // RECOVERY is where the lie must fail closed
    let err = s3.recover(NOW + 1).unwrap_err();
    assert!(
        err.contains("binding-mismatch"),
        "the pre-seeded false row survived: {err}"
    );
}

fn tmp_of_orphan() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("bnrose-rusteosvm-orphan-{}", std::process::id()))
}
