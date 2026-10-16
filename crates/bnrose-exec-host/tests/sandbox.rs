//! Sandbox battery (BNROSE-RUST-001): the Wasmtime worker's boundary, on
//! hand-encoded wasm modules (the bytes below ARE the modules — no tool
//! chain needed to attack the host).
//!
//! - an EMPTY module is unusable (no exports)
//! - a module with an IMPORT is unusable at instantiation (the linker has
//!   nothing in it — the module's entire view of the host)
//! - a module that LOOPS FOREVER is bounded by fuel and named
//! - a module that RETURNS GARBAGE has its verdicts refused and NOTHING
//!   is journaled (no operation comes to exist)

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker, TrapKind, WasmWorker, Worker, WorkerError};

const NOW: u64 = 1_800_000_000;

/// Minimal wasm encoder: sections in order, LEB128 lengths. Every module
/// here exports the five ABI names plus memory; the bodies are the attack.
fn uleb(n: usize) -> Vec<u8> {
    let mut out = Vec::new();
    let mut n = n as u64;
    loop {
        let b = (n & 0x7f) as u8;
        n >>= 7;
        if n == 0 {
            out.push(b);
            break;
        }
        out.push(b | 0x80);
    }
    out
}

fn section(id: u8, body: &[u8]) -> Vec<u8> {
    let mut v = vec![id];
    v.extend(uleb(body.len()));
    v.extend_from_slice(body);
    v
}

/// Build a module with the five exports; `admit_body`/`step_body` are raw
/// code bytes (no locals). The other three bodies are honest one-liners so
/// the constructor's handshake passes and the attack body is what runs.
fn module(admit_body: &[u8], step_body: &[u8]) -> Vec<u8> {
    let mut m = b"\0asm\x01\0\0\0".to_vec();
    // types: [0] (i32 x4) -> i32, [1] () -> i32
    let types = [
        2u8, 0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f, 0x60, 0, 1, 0x7f,
    ];
    m.extend(section(1, &types));
    // funcs: admit=0 step=0 version=1 req=1 verdict=1
    m.extend(section(3, &[5u8, 0, 0, 1, 1, 1]));
    // memory: min 17 pages
    m.extend(section(5, &[1u8, 0x00, 17]));
    // exports: memory + the five functions (name lengths: admit 12, step 11,
    // abi_version 18, req_arena 16, verdict_arena 20)
    let mut ex = Vec::new();
    ex.push(6);
    ex.push(6);
    ex.extend(b"memory");
    ex.push(0x02);
    ex.push(0);
    ex.push(12);
    ex.extend(b"bnrose_admit");
    ex.push(0x00);
    ex.push(0);
    ex.push(11);
    ex.extend(b"bnrose_step");
    ex.push(0x00);
    ex.push(1);
    ex.push(18);
    ex.extend(b"bnrose_abi_version");
    ex.push(0x00);
    ex.push(2);
    ex.push(16);
    ex.extend(b"bnrose_req_arena");
    ex.push(0x00);
    ex.push(3);
    ex.push(20);
    ex.extend(b"bnrose_verdict_arena");
    ex.push(0x00);
    ex.push(4);
    m.extend(section(7, &ex));
    // code: the two attack bodies, then version=1 and the two arena
    // one-liners at offset 0 (the host writes the request wherever the
    // arena functions point; garbage bodies never read it)
    let mut bodies = Vec::new();
    for b in [
        admit_body,
        step_body,
        &[0x41, 0x01, 0x0b][..],
        &[0x41, 0x00, 0x0b][..],
        &[0x41, 0x00, 0x0b][..],
    ] {
        let mut body = vec![0u8]; // no locals
        body.extend_from_slice(b);
        bodies.extend(uleb(body.len()));
        bodies.extend_from_slice(&body);
    }
    let mut code = vec![5u8];
    code.extend(bodies);
    m.extend(section(10, &code));
    m
}

fn empty_module() -> Vec<u8> {
    b"\0asm\x01\0\0\0".to_vec()
}

fn importing_module() -> Vec<u8> {
    let mut m = b"\0asm\x01\0\0\0".to_vec();
    let types = [1u8, 0x60, 0, 1, 0x7f];
    m.extend(section(1, &types));
    // import "env" "sneaky" func type 0
    let mut im = Vec::new();
    im.push(1);
    im.push(3);
    im.extend(b"env");
    im.push(6);
    im.extend(b"sneaky");
    im.push(0x00);
    im.push(0);
    m.extend(section(2, &im));
    m
}

// bodies: loop { br 0 } then i32.const 0 ; and a plain i32.const 3
const LOOP_BODY: &[u8] = &[0x03, 0x40, 0x0c, 0x00, 0x0b, 0x41, 0x00, 0x0b];
const GARBAGE_BODY: &[u8] = &[0x41, 0x03, 0x0b];

#[test]
fn the_boundary_refuses_what_is_not_declared() {
    // empty: unusable
    match WasmWorker::new(&empty_module(), Bounds::default()) {
        Err(WorkerError::Trap { .. }) | Err(WorkerError::Disagreement { .. }) => {
            unreachable!("constructor traps are not this test")
        }
        Err(WorkerError::Unusable(w)) => assert!(
            w.contains("memory") || w.contains("bnrose_abi_version"),
            "{w}"
        ),
        Ok(_) => panic!("empty module accepted"),
    }
    // an undeclared import: refused AT INSTANTIATION — the linker is empty
    match WasmWorker::new(&importing_module(), Bounds::default()) {
        Err(WorkerError::Trap { .. }) | Err(WorkerError::Disagreement { .. }) => {
            unreachable!("constructor traps are not this test")
        }
        Err(WorkerError::Unusable(w)) => assert!(w.contains("instantiate"), "{w}"),
        Ok(_) => panic!("importing module accepted"),
    }
    println!("sandbox: empty and importing modules refused before any code ran");
}

#[test]
fn a_looping_module_is_bounded_by_fuel_and_named() {
    let bytes = module(LOOP_BODY, GARBAGE_BODY);
    let mut w = WasmWorker::new(
        &bytes,
        Bounds {
            fuel: 1_000_000,
            ..Default::default()
        },
    )
    .unwrap();
    let f = fixture(9, NOW, 600);
    let req = bnrose_exec_host::admit_request(NOW, &f.authority, &test_policy(), &f.env);
    match w.admit(&req) {
        Err(WorkerError::Trap {
            kind: TrapKind::FuelExhausted,
            ..
        }) => {}
        other => panic!("the loop was not bounded: {other:?}"),
    }
    println!("sandbox: infinite loop trapped as fuel exhaustion");
}

#[test]
fn a_garbage_module_journals_nothing() {
    let state = std::env::temp_dir().join(format!("bnrose-sandbox-garbage-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&state);
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x45; 32]).unwrap();
    let bytes = module(GARBAGE_BODY, GARBAGE_BODY);
    let worker = WasmWorker::new(&bytes, Bounds::default())
        .map_err(|e| e.to_string())
        .unwrap();
    let mut s = Supervisor::open(&state, Box::new(worker), test_policy()).unwrap();
    let f = fixture(10, NOW, 600);
    let out = s.run(
        &read_intent(&f.to_json()).unwrap(),
        NOW,
        false,
        &Bounds::default(),
    );
    assert!(
        out.refused.is_some(),
        "garbage verdicts must refuse the run"
    );
    assert!(out.op.is_none(), "no operation may exist");
    // the journal is EMPTY: no admission was recorded for a lying worker
    let records =
        bnrose_exec_host::journal::load(&state.join("journal.bin"), &s.keys.journal_mac).unwrap();
    assert!(
        records.is_empty(),
        "{} records appeared from a garbage module",
        records.len()
    );
    let rows =
        bnrose_exec_host::ledger::load(&state.join("effects.bin"), &s.keys.ledger_mac).unwrap();
    assert!(rows.is_empty());
    let _ = NativeWorker::new();
    println!("sandbox: garbage-verdict module refused, zero journal records, zero effects");
}
