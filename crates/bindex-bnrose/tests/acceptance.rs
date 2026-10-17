//! The acceptance matrix: every claim the index makes is a row that can go
//! red. State directories are REAL: the supervisor is driven with fixture
//! roots (TESTNET-ONLY, deterministic, non-spending) and then indexed
//! keyless with the receipt PUBLIC key the test hands over, exactly as an
//! operator would hand it. The tests hold the root; the crate never does.

use bindex_bnrose::ingest::{ingest, IngestOptions};
use bindex_bnrose::query;
use bindex_bnrose::store::Store;
use bindex_bnrose::{hex, Error};
use bnrose_exec_core::{E_ADMITTED, E_RESERVE, E_RESPONSE, S_COMPLETED, S_DISPATCHED};
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::keys::SupervisorKeys;
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker};
use serde_json::Value;
use std::path::{Path, PathBuf};

const NOW: u64 = 1_800_000_000;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("bindex-bnrose-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

struct Lab {
    state: PathBuf,
    db: PathBuf,
    /// the receipt PUBLIC key, read by the TEST from the fixture root and
    /// handed to the index the way an operator hands it
    pk: [u8; 32],
}

fn lab(name: &str, root_byte: u8) -> Lab {
    let dir = tmp(name);
    let state = dir.join("state");
    std::fs::create_dir_all(&state).unwrap();
    SupervisorKeys::init(&state, &[root_byte; 32]).unwrap();
    let pk = SupervisorKeys::load(&state).unwrap().ed_public;
    Lab {
        state,
        db: dir.join("index.db"),
        pk,
    }
}

/// Run `n` fixture operations; the last one loses its response when asked.
fn run_ops(lab: &Lab, n: u64, lose_last: bool) -> Vec<[u8; 32]> {
    let mut sup =
        Supervisor::open(&lab.state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    let mut ids = Vec::new();
    for i in 0..n {
        let f = fixture(i, NOW, 600);
        let intent = read_intent(&f.to_json()).unwrap();
        let lose = lose_last && i == n - 1;
        let out = sup.run(&intent, NOW, lose, &Bounds::default());
        assert!(
            out.refused.is_none(),
            "fixture {i} refused: {:?}",
            out.refused
        );
        ids.push(bnrose_exec_core::op_id(&f.authority, &f.env));
    }
    ids
}

fn index(
    lab: &Lab,
    pk: &[u8; 32],
    allow_single: bool,
) -> Result<(Store, bindex_bnrose::ingest::IngestReport), Error> {
    let mut store = Store::open(&lab.db)?;
    let rep = ingest(
        &mut store,
        &lab.state,
        pk,
        &IngestOptions {
            allow_single_replica: allow_single,
        },
    )?;
    Ok((store, rep))
}

fn entity_json(store: &Store, id: &[u8; 32]) -> Value {
    let v = query::entity(store, id).unwrap();
    assert_eq!(
        v["found"],
        Value::Bool(true),
        "entity {} not indexed",
        hex(id)
    );
    v["entity"].clone()
}

/// Frame walker for the tamper rows: (body_start, body_len) per record.
fn frames(bytes: &[u8]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i + 4 <= bytes.len() {
        let len = u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap()) as usize;
        out.push((i + 4, len - 32));
        i += 4 + len;
    }
    out
}

fn replica_files(state: &Path) -> [PathBuf; 2] {
    [
        state.join("journal.bin"),
        state.join("replica").join("journal.bin"),
    ]
}

/// Flip one byte inside the payload of the first record with `event`, at
/// `payload_offset`, in every listed file.
fn flip_payload_byte(files: &[PathBuf], event: u8, payload_offset: usize) {
    for f in files {
        let mut bytes = std::fs::read(f).unwrap();
        let (bs, _) = frames(&bytes)
            .into_iter()
            .find(|(bs, _)| bytes[*bs + 41] == event)
            .expect("a record with that event");
        bytes[bs + 46 + payload_offset] ^= 0x01;
        std::fs::write(f, bytes).unwrap();
    }
}

/// Drop the last frame of every listed file.
fn drop_last_frame(files: &[PathBuf]) {
    for f in files {
        let bytes = std::fs::read(f).unwrap();
        let fr = frames(&bytes);
        let (bs, _) = *fr.last().unwrap();
        std::fs::write(f, &bytes[..bs - 4]).unwrap();
    }
}

// ---- the happy path, with every rung of the ladder asserted ---------------

/// Every file of the state directory, by content, so a test can prove the
/// index wrote nothing there.
fn state_snapshot(state: &Path) -> Vec<(String, Vec<u8>)> {
    fn walk(dir: &Path, base: &Path, out: &mut Vec<(String, Vec<u8>)>) {
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(&p, base, out);
            } else {
                let rel = p.strip_prefix(base).unwrap().display().to_string();
                out.push((rel, std::fs::read(&p).unwrap()));
            }
        }
    }
    let mut out = Vec::new();
    walk(state, state, &mut out);
    out.sort();
    out
}

#[test]
fn a_real_state_directory_indexes_keyless_and_every_entity_is_attested() {
    let lab = lab("happy", 0x11);
    let ids = run_ops(&lab, 4, false);
    let before = state_snapshot(&lab.state);
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(
        state_snapshot(&lab.state),
        before,
        "the index wrote into the state directory"
    );
    assert!(
        before.iter().any(|(p, _)| p.ends_with("supervisor.root")),
        "the root is there; the index never read it (tests/keyless.rs)"
    );
    assert_eq!(rep.entities, 4);
    assert_eq!(rep.receipts_present, 4);
    assert_eq!(rep.receipts_verified, 4);
    assert_eq!(rep.entities_attested, 4);
    assert_eq!(rep.effect_rows, 4);
    assert!(rep.agreement.starts_with("agree:2"), "{}", rep.agreement);
    assert!(!rep.single_replica);
    for id in &ids {
        let e = entity_json(&store, id);
        assert_eq!(e["identity"]["idRecomputed"], true);
        assert_eq!(e["identity"]["wb001BindingVerified"], true);
        assert_eq!(e["identity"]["decoded"], true);
        assert_eq!(e["replay"]["state"], S_COMPLETED);
        assert_eq!(e["replay"]["refusal"], Value::Null);
        assert_eq!(e["receipt"]["verifiedUnderReceiptKey"], true);
        assert_eq!(e["receipt"]["headBound"], true);
        assert_eq!(e["receipt"]["coversEntity"], true);
        assert_eq!(e["receipt"]["mismatches"].as_array().unwrap().len(), 0);
        assert_eq!(e["effectRow"]["present"], true);
        assert_eq!(e["effectRow"]["digestMatches"], true);
        assert_eq!(e["effectRow"]["tagVerified"], false);
        assert_eq!(e["evidence"]["attested"]["value"], true);
        assert_eq!(e["evidence"]["submitted"]["value"], true);
        assert_eq!(e["evidence"]["observedLocal"]["value"], true);
        assert_eq!(e["evidence"]["recovered"]["value"], false);
        assert_eq!(e["evidence"]["included"], Value::Null);
        assert_eq!(e["evidence"]["executed"], Value::Null);
        assert_eq!(e["evidence"]["final"], Value::Null);
        assert_eq!(e["evidence"]["chainTags"]["verified"], false);
    }
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["entitiesAttested"], 4);
    assert_eq!(st["counts"]["receiptsUnverified"], 0);
    assert_eq!(st["counts"]["divergences"], 0);
    assert!(st["keyless"].as_str().unwrap().starts_with("true"));
    assert_eq!(st["coverage"]["singleReplica"], false);
    assert_eq!(st["coverage"]["coveredThroughSeq"], rep.covered_through_seq);
}

#[test]
fn a_recovered_operation_carries_the_recovered_class_and_still_attests() {
    let lab = lab("recovered", 0x12);
    let ids = run_ops(&lab, 2, true);
    // the supervisor recovers the lost response from its own evidence
    {
        let mut sup =
            Supervisor::open(&lab.state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let report = sup.recover(NOW).unwrap();
        assert!(report.is_object(), "{report}");
    }
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep.entities, 2);
    let e = entity_json(&store, &ids[1]);
    assert_eq!(e["replay"]["state"], S_COMPLETED);
    assert_eq!(e["replay"]["recovered"], true);
    assert_eq!(e["evidence"]["recovered"]["value"], true);
    assert_eq!(e["evidence"]["attested"]["value"], true, "{e}");
    let first = entity_json(&store, &ids[0]);
    assert_eq!(first["evidence"]["recovered"]["value"], false);
}

// ---- receipts under the wrong key are marked, never dropped ---------------

#[test]
fn a_receipt_that_does_not_verify_under_the_handed_key_is_marked_not_dropped() {
    let lab = lab("wrongkey", 0x13);
    let ids = run_ops(&lab, 2, false);
    let (store, rep) = index(&lab, &[7u8; 32], false).unwrap();
    assert_eq!(rep.receipts_present, 2);
    assert_eq!(rep.receipts_verified, 0);
    assert_eq!(rep.entities_attested, 0);
    let e = entity_json(&store, &ids[0]);
    assert_eq!(e["receipt"]["present"], true);
    assert_eq!(e["receipt"]["verifiedUnderReceiptKey"], false);
    assert_eq!(
        e["receipt"]["mismatches"].as_array().unwrap().len(),
        0,
        "the fields still agree; only the key does not"
    );
    assert_eq!(e["evidence"]["attested"]["value"], false);
    assert_eq!(
        e["identity"]["idRecomputed"], true,
        "identity does not depend on the receipt key"
    );
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["receiptsUnverified"], 2);
}

// ---- planted lies: convicted keyless ---------------------------------------

#[test]
fn teeth_a_flipped_admitted_envelope_byte_is_convicted_by_identity_recomputation() {
    let lab = lab("teeth-env", 0x14);
    let ids = run_ops(&lab, 1, false);
    // inside the envelope (after authority 32 | sig 64 | policy 32 | len 2)
    flip_payload_byte(&replica_files(&lab.state), E_ADMITTED, 130 + 20);
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep.entities_attested, 0);
    let e = entity_json(&store, &ids[0]);
    assert_eq!(e["identity"]["idRecomputed"], false);
    assert_eq!(e["identity"]["wb001BindingVerified"], false);
    assert!(e["receipt"]["mismatches"]
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m.as_str().unwrap().starts_with("envSha256")));
    assert_eq!(e["evidence"]["attested"]["value"], false);
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["entitiesIdentityOrBindingFailed"], 1);
}

#[test]
fn teeth_a_flipped_response_verdict_is_convicted_by_replay_against_the_receipt() {
    let lab = lab("teeth-resp", 0x15);
    let ids = run_ops(&lab, 1, false);
    // the Response payload is one byte: ok(1); flipped to 0 after dispatch
    // the core refuses the transition (a failure claim after dispatch is
    // not trusted as terminal)
    flip_payload_byte(&replica_files(&lab.state), E_RESPONSE, 0);
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep.entities_attested, 0);
    let e = entity_json(&store, &ids[0]);
    assert!(e["replay"]["refusal"].is_string(), "{e}");
    assert_eq!(e["replay"]["state"], S_DISPATCHED);
    assert!(e["receipt"]["mismatches"]
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m.as_str().unwrap().starts_with("state")));
    assert_eq!(e["evidence"]["attested"]["value"], false);
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["entitiesReplayRefused"], 1);
}

#[test]
fn teeth_a_dropped_last_record_leaves_the_receipt_unbound_and_the_entity_unattested() {
    let lab = lab("teeth-drop", 0x16);
    let ids = run_ops(&lab, 1, false);
    drop_last_frame(&replica_files(&lab.state));
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep.entities_attested, 0);
    let e = entity_json(&store, &ids[0]);
    assert_eq!(
        e["receipt"]["headBound"],
        Value::Null,
        "seq_head is past the served records"
    );
    assert_eq!(e["evidence"]["attested"]["value"], false);
}

#[test]
fn teeth_a_dropped_middle_record_is_malformed_on_both_replicas_and_refuses() {
    let lab = lab("teeth-gap", 0x17);
    run_ops(&lab, 2, false);
    for f in replica_files(&lab.state) {
        let bytes = std::fs::read(&f).unwrap();
        let fr = frames(&bytes);
        let (bs, blen) = fr[2];
        let mut cut = bytes[..bs - 4].to_vec();
        cut.extend_from_slice(&bytes[bs + blen + 32..]);
        std::fs::write(&f, cut).unwrap();
    }
    let err = index(&lab, &lab.pk, false).err().expect("refused");
    assert!(matches!(err, Error::Refused(_)), "{err}");
    assert!(
        err.to_string().contains("no journal replica could be read"),
        "{err}"
    );
}

#[test]
fn teeth_replica_divergence_is_refused_and_recorded_nothing_merged() {
    let lab = lab("teeth-diverge", 0x18);
    run_ops(&lab, 2, false);
    flip_payload_byte(
        &[lab.state.join("replica").join("journal.bin")],
        E_ADMITTED,
        130 + 3,
    );
    let err = index(&lab, &lab.pk, false).err().expect("refused");
    assert!(err.to_string().contains("divergence"), "{err}");
    let store = Store::open(&lab.db).unwrap();
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["divergences"], 1);
    assert_eq!(st["counts"]["entities"], 0);
    assert_eq!(st["ingests"][0]["outcome"], "refused:diverge");
}

#[test]
fn limitation_a_flipped_reservation_byte_is_invisible_keyless_until_a_public_chain_head_exists() {
    // The receipt binds op, envelope, state, effect and the HMAC head; it
    // does not bind the Reserve payload. The supervisor's own loader
    // catches this flip through the HMAC chain; a keyless reader cannot.
    // This row pins the gap so that it is a named fact, not a surprise. If
    // the owner of bnrose-exec-core ever binds a public record-digest head
    // into the receipt, this row flips and the crate gains the rung.
    let lab = lab("limit-reserve", 0x19);
    let ids = run_ops(&lab, 1, false);
    flip_payload_byte(&replica_files(&lab.state), E_RESERVE, 0);
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    let e = entity_json(&store, &ids[0]);
    assert_eq!(e["evidence"]["attested"]["value"], true, "the gap, pinned");
    assert_eq!(e["evidence"]["chainTags"]["verified"], false);
    assert_eq!(rep.entities_attested, 1);
}

// ---- replicas: single, lagging; idempotence; forks ---------------------------

#[test]
fn a_single_readable_replica_is_refused_by_default_and_marked_when_allowed() {
    let lab = lab("single", 0x1a);
    let ids = run_ops(&lab, 2, false);
    std::fs::remove_file(lab.state.join("replica").join("journal.bin")).unwrap();
    let err = index(&lab, &lab.pk, false).err().expect("refused");
    assert!(
        err.to_string().contains("only one journal replica"),
        "{err}"
    );
    let (store, rep) = index(&lab, &lab.pk, true).unwrap();
    assert!(rep.single_replica);
    assert_eq!(rep.entities_attested, 2);
    let st = query::status(&store).unwrap();
    assert_eq!(st["coverage"]["singleReplica"], true);
    assert_eq!(
        entity_json(&store, &ids[0])["evidence"]["attested"]["value"],
        true
    );
}

#[test]
fn a_lagging_replica_yields_the_common_prefix_marked_as_prefix() {
    let lab = lab("lag", 0x1b);
    run_ops(&lab, 2, false);
    drop_last_frame(&[lab.state.join("replica").join("journal.bin")]);
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert!(
        rep.agreement.starts_with("prefix:2:common="),
        "{}",
        rep.agreement
    );
    assert!(!rep.single_replica);
    let st = query::status(&store).unwrap();
    assert_eq!(st["counts"]["records"], rep.covered_through_seq);
}

#[test]
fn re_ingest_is_idempotent_and_a_rewritten_prefix_is_a_fork() {
    let lab = lab("fork", 0x1c);
    let ids = run_ops(&lab, 2, false);
    let (store, rep1) = index(&lab, &lab.pk, false).unwrap();
    drop(store);
    let (store, rep2) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep1.index_head, rep2.index_head);
    assert_eq!(rep1.covered_through_seq, rep2.covered_through_seq);
    assert_eq!(
        query::status(&store).unwrap()["counts"]["records"],
        rep1.covered_through_seq
    );
    drop(store);
    // the journal grows: a longer prefix-consistent journal extends the index
    {
        let mut sup =
            Supervisor::open(&lab.state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let f = fixture(9, NOW, 600);
        let out = sup.run(
            &read_intent(&f.to_json()).unwrap(),
            NOW,
            false,
            &Bounds::default(),
        );
        assert!(out.refused.is_none());
    }
    let (store, rep3) = index(&lab, &lab.pk, false).unwrap();
    assert!(rep3.covered_through_seq > rep2.covered_through_seq);
    assert_eq!(rep3.entities, 3);
    drop(store);
    // the prefix is rewritten in place on both replicas: the store's own
    // commitment no longer matches; refused, recorded, nothing merged
    flip_payload_byte(&replica_files(&lab.state), E_ADMITTED, 130 + 7);
    let err = index(&lab, &lab.pk, false).err().expect("fork refused");
    assert!(err.to_string().contains("fork"), "{err}");
    let store = Store::open(&lab.db).unwrap();
    let st = query::status(&store).unwrap();
    assert_eq!(st["ingests"][0]["outcome"], "refused:fork");
    assert_eq!(
        entity_json(&store, &ids[0])["evidence"]["attested"]["value"],
        true,
        "the earlier, consistent index stands"
    );
}

// ---- queries are bounded and carry coverage ---------------------------------

#[test]
fn queries_are_bounded_and_every_answer_carries_coverage_and_freshness() {
    let lab = lab("queries", 0x1d);
    let ids = run_ops(&lab, 3, false);
    let (store, _) = index(&lab, &lab.pk, false).unwrap();
    let f0 = fixture(0, NOW, 600);
    let v = query::by_authority(&store, &f0.authority, None, 5000).unwrap();
    assert_eq!(v["query"]["limit"], query::MAX_LIMIT);
    assert_eq!(v["entities"].as_array().unwrap().len(), 1);
    assert_eq!(v["entities"][0]["entityId"], hex(&ids[0]));
    assert_eq!(v["truncated"], false);
    assert!(v["coverage"]["readAtUnix"].as_u64().unwrap() > 0);
    assert!(v["coverage"]["staleByConstruction"].is_string());
    let after = query::by_authority(&store, &f0.authority, Some(1_000_000), 10).unwrap();
    assert_eq!(after["entities"].as_array().unwrap().len(), 0);
    let missing = query::entity(&store, &[0xee; 32]).unwrap();
    assert_eq!(missing["found"], false);
    assert!(missing["coverage"]["indexHead"].is_string());
    let e = entity_json(&store, &ids[2]);
    assert_eq!(e["kind"], "root");
    assert_eq!(
        e["identity"]["domain"],
        bnrose_exec_host::fixtures::TEST_DOMAIN
    );
}

#[test]
fn step_entities_index_under_their_root_and_answer_the_steps_query() {
    let lab = lab("steps", 0x1e);
    let f = fixture(0, NOW, 600);
    let root = bnrose_exec_core::op_id(&f.authority, &f.env);
    // the host runs ONE fresh step per invocation (a terminal step is
    // skipped, an unresolved one refuses the whole call); the flag is
    // "lose the response", false here
    let plan: [(&str, bool); 3] = [("propose", false), ("approve", false), ("execute", false)];
    {
        let mut sup =
            Supervisor::open(&lab.state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        for _ in 0..plan.len() {
            let out = sup.run_steps(
                &read_intent(&f.to_json()).unwrap(),
                NOW,
                &Bounds::default(),
                &plan,
            );
            assert!(out.refused.is_none(), "{:?}", out.refused);
        }
    }
    let (store, rep) = index(&lab, &lab.pk, false).unwrap();
    assert_eq!(rep.entities, 3, "{}", rep.entities);
    assert_eq!(rep.entities_attested, 3);
    let v = query::steps(&store, &root).unwrap();
    let steps = v["steps"].as_array().unwrap();
    assert_eq!(steps.len(), 3, "{v}");
    for (i, s) in steps.iter().enumerate() {
        assert_eq!(s["kind"], "step");
        assert_eq!(s["root"], hex(&root));
        assert_eq!(s["step"], i as u64);
        assert_eq!(s["attempt"], 0);
        assert_eq!(s["label"], plan[i].0);
        assert_eq!(s["identity"]["idRecomputed"], true, "{s}");
        assert_eq!(s["identity"]["wb001BindingVerified"], true);
        assert_eq!(s["replay"]["state"], S_COMPLETED, "{s}");
    }
}
