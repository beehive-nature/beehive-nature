//! Native/Wasm agreement battery (BNROSE-RUST-001): for every request in
//! the corpus — valid, policy-violating, envelope-mutated, wire-garbage,
//! and every event/state combination — the native face and the wasm module
//! under pinned Wasmtime must answer BYTE-IDENTICAL verdicts. And the
//! paranoid dual-run must TRAP when a worker lies.

use bnrose_exec_core::{
    OpState, E_BOUNDED_FAIL, E_DISPATCH, E_LOST_RESPONSE, E_RECOVERY_EVIDENCE, E_RECOVERY_NONE,
    E_RESERVE, E_RESPONSE, S_ADMITTED, S_COMPLETED, S_DISPATCHED, S_FAILED, S_RESERVED, S_UNKNOWN,
};
use bnrose_exec_host::fixtures::{fixture, test_policy};
use bnrose_exec_host::step_request;
use bnrose_exec_host::worker::{
    wasm_module_bytes, Bounds, NativeWorker, ParanoidWorker, TrapKind, WasmWorker, Worker,
    WorkerError,
};

const NOW: u64 = 1_800_000_000;

struct Faces {
    native: NativeWorker,
    wasm: WasmWorker,
}

fn faces() -> Faces {
    Faces {
        native: NativeWorker::new(),
        wasm: WasmWorker::new(
            &wasm_module_bytes().expect("wasm module"),
            Bounds::default(),
        )
        .expect("wasm worker"),
    }
}

fn agree_admit(f: &mut Faces, req: &[u8]) {
    let a = f.native.admit(req).expect("native never traps");
    let b = f
        .wasm
        .admit(req)
        .expect("wasm must not trap on this corpus");
    assert_eq!(a, b, "admit disagreement ({} bytes)", req.len());
}

fn agree_step(f: &mut Faces, req: &[u8]) {
    let a = f.native.step(req).expect("native never traps");
    let b = f.wasm.step(req).expect("wasm must not trap on this corpus");
    assert_eq!(a, b, "step disagreement");
}

#[test]
fn every_admission_request_agrees_byte_for_byte() {
    let mut f = faces();
    let policy = test_policy();
    let base = fixture(0, NOW, 600);
    // the valid corpus
    for index in 0..12u64 {
        let fx = fixture(index, NOW, 600);
        agree_admit(
            &mut f,
            &bnrose_exec_host::admit_request(NOW, &fx.authority, &policy, &fx.env),
        );
    }
    // the full single-byte mutation sweep of one envelope
    let n = base.env.len();
    for k in 0..n {
        let mut env = base.env.clone();
        env[k] ^= 0x01;
        agree_admit(
            &mut f,
            &bnrose_exec_host::admit_request(NOW, &base.authority, &policy, &env),
        );
    }
    // clocks at the boundaries that matter
    for clock in [
        0u64,
        1,
        NOW - 1,
        NOW,
        base.expiry,
        base.expiry + 1,
        u64::MAX - 1,
    ] {
        agree_admit(
            &mut f,
            &bnrose_exec_host::admit_request(clock, &base.authority, &policy, &base.env),
        );
    }
    // wire garbage (deterministic xorshift)
    let mut rng = 0xdead_beef_cafe_f00du64;
    for len in [0usize, 1, 2, 3, 8, 41, 130, 540, 542, 700, 4626] {
        let mut req = Vec::with_capacity(len);
        for _ in 0..len {
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            req.push((rng >> 33) as u8);
        }
        agree_admit(&mut f, &req);
    }
    println!("agreement: {} valid + {} mutated + {} clock boundaries + {} garbage admission requests answered identically", 12, n, 7, 11);
}

#[test]
fn every_event_against_every_state_agrees_byte_for_byte() {
    let mut f = faces();
    let op = [0xab; 32];
    let env_sha = [0xcd; 32];
    let states = [
        OpState {
            state: S_ADMITTED,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 1,
        },
        OpState {
            state: S_RESERVED,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 2,
        },
        OpState {
            state: S_DISPATCHED,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 3,
        },
        OpState {
            state: S_UNKNOWN,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 4,
        },
        OpState {
            state: S_COMPLETED,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 5,
        },
        OpState {
            state: S_FAILED,
            recovered: 0,
            fail: 9,
            bound_effect: [7; 32],
            seq: 6,
        },
    ];
    let reserve = {
        let mut b = [0u8; 16];
        b[..8].copy_from_slice(&1000u64.to_le_bytes());
        b
    };
    let events: Vec<(u8, Vec<u8>)> = vec![
        (E_RESERVE, reserve.to_vec()),
        (E_DISPATCH, vec![7; 32]),
        (E_RESPONSE, vec![1]),
        (E_RESPONSE, vec![0, 5, 0, 0, 0]),
        (E_BOUNDED_FAIL, vec![5, 0, 0, 0]),
        (E_LOST_RESPONSE, vec![]),
        (E_RECOVERY_EVIDENCE, vec![7; 32]),
        (E_RECOVERY_EVIDENCE, vec![8; 32]),
        (E_RECOVERY_NONE, vec![]),
        (99, vec![]),
    ];
    let mut pairs = 0;
    for st in &states {
        for (ev, payload) in &events {
            for (clock, expiry) in [(0u64, u64::MAX), (NOW, NOW + 600), (500, 499)] {
                let req = step_request(&op, &env_sha, st, *ev, payload, clock, expiry);
                agree_step(&mut f, &req);
                pairs += 1;
            }
        }
    }
    println!("agreement: {pairs} (state, event, clock) step combinations answered identically");
}

/// A worker that lies: returns a verdict that is not what the core says.
struct Liar {
    native: NativeWorker,
}

impl Worker for Liar {
    fn name(&self) -> &'static str {
        "liar"
    }
    fn last_fuel(&self) -> u64 {
        0
    }
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        let mut v = self.native.admit(req).unwrap();
        if v.len() == 97 {
            v[97 - 1] ^= 0x01; // corrupt the effect digest: a parseable lie
        }
        Ok(v)
    }
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.native.step(req)
    }
}

#[test]
fn the_paranoid_dual_run_traps_a_lying_worker() {
    let mut p = ParanoidWorker::around(Box::new(Liar {
        native: NativeWorker::new(),
    }));
    let f = fixture(5, NOW, 600);
    let req = bnrose_exec_host::admit_request(NOW, &f.authority, &test_policy(), &f.env);
    match p.admit(&req) {
        Err(WorkerError::Disagreement { .. }) => {}
        other => panic!("the liar was not caught: {other:?}"),
    }
}

/// A worker that loops forever: fuel must exhaust, the trap named.
struct Looper;

impl Worker for Looper {
    fn name(&self) -> &'static str {
        "looper"
    }
    fn last_fuel(&self) -> u64 {
        0
    }
    fn admit(&mut self, _req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        loop {
            std::hint::spin_loop();
        }
    }
    fn step(&mut self, _req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        loop {
            std::hint::spin_loop();
        }
    }
}

#[test]
fn fuel_bounds_the_wasm_worker_and_names_the_trap() {
    let bytes = wasm_module_bytes().expect("wasm module");
    let f = fixture(6, NOW, 600);
    let req = bnrose_exec_host::admit_request(NOW, &f.authority, &test_policy(), &f.env);
    // calibrate: what the honest admission actually costs
    let mut probe = WasmWorker::new(&bytes, Bounds::default()).unwrap();
    probe.admit(&req).expect("full budget admits");
    let need = probe.last_fuel();
    assert!(need > 1000, "implausible fuel accounting: {need}");
    // half the need: the same request must exhaust and be NAMED
    let mut w = WasmWorker::new(
        &bytes,
        Bounds {
            fuel: need / 2,
            ..Default::default()
        },
    )
    .unwrap();
    match w.admit(&req) {
        Err(WorkerError::Trap {
            kind: TrapKind::FuelExhausted,
            ..
        }) => {}
        other => panic!("expected fuel exhaustion, got {other:?}"),
    }
    assert!(
        w.last_fuel() >= need / 2,
        "fuel accounting must show exhaustion"
    );
    // the native face of the same request still answers (the bound is the
    // worker's, not the core's)
    let mut n = NativeWorker::new();
    assert!(n.admit(&req).is_ok());
    println!("agreement: an honest admission costs {need} fuel; half of it traps as FuelExhausted");
    // the Looper at the TRAIT level documents why the trait cannot be the
    // boundary: only the wasm engine can bound execution; a native liar is
    // caught by disagreement, a native looper by the OS. The wasm worker is
    // where "bounded" is a property this system enforces itself.
    let _ = Looper;
}
