//! Rejection battery (BNROSE-RUST-001): every named refusal is convicted
//! by a vector, at the layer that owns it.
//!
//! Layer 1 — the WB001 binding: every single-byte mutation of a valid
//! envelope must be refused by the supervisor (the signature over the
//! canonical bytes; the frozen contract's own law).
//! Layer 2 — admission policy: envelopes that RE-SIGN an edited intent
//! (so the binding holds and the attack moves behind it) refuse on the
//! named policy/clock code.
//! Layer 3 — the wire: malformed requests are answered with refusal
//! verdicts, never traps.

use bnrose_exec_core::{Policy, Refusal};
use bnrose_exec_host::admit_request;
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy, IntentFile};
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{wasm_module_bytes, Bounds, NativeWorker, WasmWorker, Worker};
use bnrose_exec_host::{parse_admit_verdict, AdmitVerdict};
use btungsten_wb001::Text;

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-rejection-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn sup(name: &str) -> Supervisor {
    let state = tmp(name);
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x22; 32]).unwrap();
    Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap()
}

const NOW: u64 = 1_800_000_000;

/// Re-sign an edited intent with the fixture's own seed: the WB001 binding
/// holds, the attack moves to whatever the edit changed.
fn resigned_with(edit: impl FnOnce(&mut btungsten_wb001::IntentIn)) -> IntentFile {
    let f = fixture(42, NOW, 600);
    let i = btungsten_wb001::decode(&f.env).unwrap();
    let field = |b: &[u8], n: u32| String::from_utf8(b[..n as usize].to_vec()).unwrap();
    let mut x = btungsten_wb001::IntentIn {
        domain: Text::Str(field(&i.domain, i.domain_len)),
        nonce: i.nonce.to_vec(),
        epoch: i.epoch,
        action: i.action.to_vec(),
        destination: Text::Str(field(&i.destination, i.destination_len)),
        capability: Text::Str(field(&i.capability, i.capability_len)),
        amount: i.amount,
        expiry: i.expiry,
        payer: Text::Str(field(&i.payer, i.payer_len)),
        payload: i.payload[..i.payload_len as usize].to_vec(),
    };
    edit(&mut x);
    let built = x.build().unwrap();
    let env = btungsten_wb001::canonical(&built).unwrap();
    let sig = btungsten_wb001::sign(&f.seed, &built).unwrap();
    IntentFile {
        env,
        sig,
        authority: f.authority,
    }
}

fn admission_of(intent: &IntentFile, policy: &Policy, clock: u64) -> AdmitVerdict {
    let req = admit_request(clock, &intent.authority, policy, &intent.env);
    let mut worker = NativeWorker::new();
    let v = worker.admit(&req).unwrap();
    parse_admit_verdict(&v).unwrap()
}

#[test]
fn every_envelope_byte_mutation_is_refused_by_the_binding() {
    let mut s = sup("binding");
    let f = fixture(1, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    // the control passes
    let ok = s.run(&intent, NOW, false, &Bounds::default());
    assert!(ok.refused.is_none());
    // every single-byte mutation of the envelope is refused
    let n = f.env.len();
    for k in 0..n {
        let mut broken = intent.clone();
        broken.env = f.env.clone();
        broken.env[k] ^= 0x01;
        let out = sup_run_fresh(&broken);
        assert!(
            out.refused.as_deref() == Some("wb001:binding-refused")
                || out.refused.as_deref() == Some("wb001:undecodable"),
            "byte {k} of {n} was not refused: {:?}",
            out.refused
        );
    }
    println!("rejection: all {n} single-byte envelope mutations refused by the WB001 binding");
}

fn sup_run_fresh(intent: &IntentFile) -> bnrose_exec_host::opexec::RunOutcome {
    let state = tmp("binding-fresh");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x23; 32]).unwrap();
    let mut s = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
    s.run(intent, NOW, false, &Bounds::default())
}

#[test]
fn every_policy_refusal_is_convicted_behind_a_valid_binding() {
    let p = test_policy();
    let cases: Vec<(
        &str,
        Box<dyn FnOnce(&mut btungsten_wb001::IntentIn)>,
        Refusal,
    )> = vec![
        (
            "another domain",
            Box::new(|x| x.domain = Text::Str("test/other".into())),
            Refusal::PolicyDomain,
        ),
        (
            "another capability",
            Box::new(|x| x.capability = Text::Str("test/other".into())),
            Refusal::PolicyCapability,
        ),
        (
            "over the amount ceiling",
            Box::new(|x| x.amount = 1_000_001),
            Refusal::PolicyAmount,
        ),
        (
            "too little lead",
            Box::new(|x| x.expiry = NOW + 5),
            Refusal::PolicyMinLead,
        ),
        (
            "authorized in the future",
            Box::new(|x| x.epoch = NOW + 1),
            Refusal::PolicyEpochFuture,
        ),
    ];
    for (name, edit, want) in cases {
        let intent = resigned_with(edit);
        // binding holds on the edited envelope
        assert!(
            btungsten_wb001::verify_envelope(&intent.authority, &intent.env, &intent.sig),
            "{name}: the edited envelope must still bind (the attack is behind the signature)"
        );
        match admission_of(&intent, &p, NOW) {
            AdmitVerdict::Refused(r) => assert_eq!(r, want, "{name} refused with the wrong code"),
            AdmitVerdict::Admitted { .. } => panic!("{name} was admitted"),
        }
    }
    // expiry: a clock past it, on an otherwise valid intent
    let intent = resigned_with(|x| x.expiry = NOW + 60);
    match admission_of(&intent, &p, NOW + 61) {
        AdmitVerdict::Refused(r) => assert_eq!(r, Refusal::PolicyExpired),
        AdmitVerdict::Admitted { .. } => panic!("expired intent admitted"),
    }
    // payload ceiling: the WB001 builder itself refuses payloads past
    // 4096 (its own bound, convicted at build), so the POLICY's tighter
    // ceiling is what admission can be convicted on
    let tight = {
        let mut q = test_policy();
        q.max_payload = 16;
        q
    };
    let intent = resigned_with(|x| x.payload = vec![9u8; 32]);
    match admission_of(&intent, &tight, NOW) {
        AdmitVerdict::Refused(r) => assert_eq!(r, Refusal::PolicyPayload),
        AdmitVerdict::Admitted { .. } => panic!("oversize payload admitted"),
    }
    // and the WB001 layer's own payload bound refuses at BUILD time
    let mut wild = btungsten_wb001::IntentIn {
        domain: btungsten_wb001::Text::Str("test/bnrose".into()),
        nonce: vec![0; 32],
        epoch: NOW,
        action: vec![0; 32],
        destination: btungsten_wb001::Text::Str("d".into()),
        capability: btungsten_wb001::Text::Str("test/exec".into()),
        amount: 1,
        expiry: NOW + 600,
        payer: btungsten_wb001::Text::Str("p".into()),
        payload: vec![9u8; 4097],
    };
    assert!(
        wild.build().is_err(),
        "the envelope builder refuses the 4097-byte payload itself"
    );
    // the u32 time horizon the WB004 specimen dies on is not ours: an
    // expiry past 2106-02-07 is representable and refused only when the
    // policy says so (min lead), never by representation
    let far = 4_294_967_296u64 + 600; // one second past the u32 ceiling
    let intent = resigned_with(|x| x.expiry = far);
    match admission_of(&intent, &p, NOW) {
        AdmitVerdict::Admitted { .. } => {}
        AdmitVerdict::Refused(r) => panic!("the far-future expiry was refused: {}", r.word()),
    }
    println!("rejection: 8 policy refusals convicted behind valid bindings (incl. the post-2106 expiry accepted)");
}

#[test]
fn decode_refusals_map_to_their_named_codes_through_admission() {
    let p = test_policy();
    let f = fixture(2, NOW, 600);
    let mut cases: Vec<(Vec<u8>, Refusal)> = vec![
        (Vec::new(), Refusal::DecodeShort),
        (vec![0u8; 7], Refusal::DecodeShort),
    ];
    let mut bad_magic = f.env.clone();
    bad_magic[6] = b'9';
    cases.push((bad_magic, Refusal::DecodeMagic));
    let mut bad_version = f.env.clone();
    bad_version[7] ^= 1;
    cases.push((bad_version, Refusal::DecodeVersion));
    let mut trailing = f.env.clone();
    trailing.push(0);
    cases.push((trailing, Refusal::DecodeTrailing));
    let mut oversize = vec![0u8; bnrose_exec_core::MAX_ENV + 1];
    oversize[..f.env.len()].copy_from_slice(&f.env);
    cases.push((oversize, Refusal::EnvOversize));
    let authority = f.authority;
    for (env, want) in cases {
        let req = admit_request(NOW, &authority, &p, &env);
        let mut worker = NativeWorker::new();
        let v = worker.admit(&req).unwrap();
        match parse_admit_verdict(&v).unwrap() {
            AdmitVerdict::Refused(r) => assert_eq!(r, want),
            AdmitVerdict::Admitted { .. } => panic!("malformed envelope admitted"),
        }
    }
    println!("rejection: decode refusals (short, magic, version, trailing, oversize) convicted through admission");
}

#[test]
fn nonce_replay_is_refused_and_leaves_no_second_operation() {
    let mut s = sup("replay");
    let f = fixture(3, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();
    let first = s.run(&intent, NOW, false, &Bounds::default());
    assert!(first.refused.is_none());
    let second = s.run(&intent, NOW, false, &Bounds::default());
    assert_eq!(second.refused.as_deref(), Some("admission:nonce-reuse"));
    let records =
        bnrose_exec_host::journal::load(&s.state_dir.join("journal.bin"), &s.keys.journal_mac)
            .unwrap();
    let admitted = records
        .iter()
        .filter(|r| r.event == bnrose_exec_core::E_ADMITTED)
        .count();
    assert_eq!(admitted, 1, "exactly one admitted operation");
    let rows = bnrose_exec_host::ledger::load(&s.state_dir.join("effects.bin"), &s.keys.ledger_mac)
        .unwrap();
    assert_eq!(rows.len(), 1);
}

#[test]
fn the_wire_refuses_malformed_requests_without_ever_trapping() {
    let bytes = wasm_module_bytes().expect("wasm module");
    let mut w = WasmWorker::new(&bytes, Bounds::default()).unwrap();
    let mut rng = 0x1234_5678_9abc_def0u64;
    let mut refused = 0;
    for len in [0usize, 1, 2, 3, 7, 40, 130, 600] {
        let mut req = Vec::with_capacity(len);
        for _ in 0..len {
            // xorshift: deterministic garbage
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            req.push((rng >> 33) as u8);
        }
        let v = w.admit(&req).expect("no trap on garbage");
        assert_eq!(v.len(), 5, "a refusal verdict, 5 bytes");
        assert_eq!(v[0], 2);
        refused += 1;
    }
    // a valid prefix with a bogus kind
    let f = fixture(4, NOW, 600);
    let mut req = admit_request(NOW, &f.authority, &test_policy(), &f.env);
    req[1] = 9;
    let v = w.admit(&req).unwrap();
    assert_eq!(v[0], 2);
    println!("rejection: {refused} garbage requests + 1 unknown kind answered with refusal verdicts, zero traps");
}
