//! Acceptance battery (BNROSE-RUST-001): valid inputs are ACCEPTED, and
//! the acceptance is verified INDEPENDENTLY — a second Ed25519
//! implementation (ed25519-dalek, the same differential the WB001 battery
//! uses), a recomputation of every receipt field from the raw envelope,
//! and journal/ledger consistency counts printed by the run itself.

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::worker::{
    wasm_module_bytes, Bounds, NativeWorker, ParanoidWorker, WasmWorker,
};
use bnrose_exec_host::{hex, opexec::Supervisor};
use sha2::{Digest, Sha256};

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!(
        "bnrose-acceptance-{name}-{}-{}",
        std::process::id(),
        name
    ));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn paranoid() -> ParanoidWorker {
    ParanoidWorker::around(Box::new(
        WasmWorker::new(
            &wasm_module_bytes().expect("wasm module"),
            Bounds::default(),
        )
        .expect("worker"),
    ))
}

fn dalek_verify(pk: &[u8; 32], stmt: &[u8], sig: &[u8; 64]) -> bool {
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};
    let Ok(vk) = VerifyingKey::from_bytes(pk) else {
        return false;
    };
    let s = Signature::from_bytes(sig);
    vk.verify(stmt, &s).is_ok()
}

#[test]
fn valid_intents_complete_and_their_receipts_verify_independently() {
    let state = tmp("lifecycle");
    SupervisorKeys_init(&state);
    let mut sup = Supervisor::open(&state, Box::new(paranoid()), test_policy()).unwrap();
    let now = 1_800_000_000u64;
    let mut ops = Vec::new();
    for index in 0..8u64 {
        let f = fixture(index, now, 600);
        let intent = read_intent(&f.to_json()).unwrap();
        let out = sup.run(&intent, now, false, &Bounds::default());
        assert!(
            out.refused.is_none(),
            "fixture {index} refused: {:?}",
            out.refused
        );
        let receipt = out.receipt.expect("receipt");
        assert_eq!(crate_state(receipt.state), "completed");
        assert_eq!(receipt.recovered, 0);
        ops.push((receipt, f));
    }
    // independent layer 1: dalek re-verifies every statement
    let mut pk_bytes = [0u8; 32];
    libcrux_ed25519::secret_to_public(&mut pk_bytes, &sup.keys.ed_seed);
    for (r, _) in &ops {
        assert!(
            dalek_verify(&pk_bytes, &r.statement(), &r.sig),
            "dalek refuses {}",
            hex(&r.op)
        );
        assert!(r.verify(&pk_bytes));
    }
    // independent layer 2: every field recomputed from the raw envelope
    for (r, f) in &ops {
        assert_eq!(r.env_sha, sha256_tagged(b"bnrose-exec/env/1", &[&f.env]));
        assert_eq!(
            r.op,
            sha256_tagged(b"bnrose-exec/op-id/1", &[&f.authority, &f.env])
        );
        assert_eq!(r.effect, sha256_taged_effect(&r.op, &r.env_sha));
    }
    // independent layer 3: durable counts, one row per op, no extras
    let records =
        bnrose_exec_host::journal::load(&state.join("journal.bin"), &sup.keys.journal_mac).unwrap();
    assert_eq!(records.len(), 8 * 4, "4 records per completed op");
    let rows =
        bnrose_exec_host::ledger::load(&state.join("effects.bin"), &sup.keys.ledger_mac).unwrap();
    assert_eq!(rows.len(), 8);
    let unique: std::collections::BTreeSet<[u8; 32]> = rows.iter().map(|r| r.op_id).collect();
    assert_eq!(unique.len(), 8);
    // every row binds the envelope hash the receipt names
    for (r, _) in &ops {
        let row = rows.iter().find(|row| row.op_id == r.op).expect("row");
        assert_eq!(row.env_sha, r.env_sha);
        assert_eq!(row.effect_digest, r.effect);
    }
    println!(
        "acceptance: 8 fixtures completed under the paranoid dual-run; {} receipts verified by libcrux AND dalek; every field recomputed from raw envelopes; {} journal records, {} effect rows, one per op",
        ops.len(),
        records.len(),
        rows.len()
    );
    let _ = NativeWorker::new(); // the native face is linked in every battery run
}

#[test]
fn the_native_face_and_the_wasm_face_answer_the_whole_valid_corpus_identically() {
    // a full byte-identity sweep lives in agreement.rs; here the corpus is
    // the acceptance corpus, run through both faces at the supervisor
    // level. The receipts' SIGNATURES differ by construction (the journal
    // records which worker ran, so the chains and heads differ); what must
    // be identical is the identity: the same operation, the same envelope
    // hash, the same effect, both verifying under their own supervisor.
    let now = 1_800_000_000u64;
    let mut triples_a = Vec::new();
    {
        let state = tmp("faces");
        SupervisorKeys_init(&state);
        let mut a = Supervisor::open(&state, Box::new(paranoid()), test_policy()).unwrap();
        for index in 0..4u64 {
            let f = fixture(index, now, 600);
            let out = a.run(
                &read_intent(&f.to_json()).unwrap(),
                now,
                false,
                &Bounds::default(),
            );
            assert!(out.refused.is_none());
            let r = out.receipt.unwrap();
            assert!(r.verify(&a.keys.ed_public));
            triples_a.push((r.op, r.env_sha, r.effect));
        }
    }
    let state_b = tmp("faces-b");
    SupervisorKeys_init(&state_b);
    let mut b = Supervisor::open(&state_b, Box::new(NativeWorker::new()), test_policy()).unwrap();
    for (index, want) in triples_a.iter().enumerate() {
        let f = fixture(index as u64, now, 600);
        let out = b.run(
            &read_intent(&f.to_json()).unwrap(),
            now,
            false,
            &Bounds::default(),
        );
        assert!(out.refused.is_none());
        let r = out.receipt.unwrap();
        assert!(r.verify(&b.keys.ed_public));
        assert_eq!(
            (r.op, r.env_sha, r.effect),
            *want,
            "fixture {index}: native-only and paranoid identities differ"
        );
    }
}

fn crate_state(s: u8) -> &'static str {
    bnrose_exec_host::receipt::state_word(s)
}

fn SupervisorKeys_init(state: &std::path::Path) {
    bnrose_exec_host::keys::SupervisorKeys::init(state, &[0x11; 32]).expect("init");
}

fn sha256_tagged(tag: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(tag);
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

fn sha256_taged_effect(op: &[u8; 32], env: &[u8; 32]) -> [u8; 32] {
    sha256_tagged(b"bnrose-exec/effect/1", &[op, env])
}
