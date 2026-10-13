//! BNROSE-RUST-001 benchmarks — measured AFTER correctness, as ordered.
//!
//! Every row carries its workload and this binary's own hardware label;
//! nothing here extrapolates a local benchmark into achieved
//! ten-billion-user capacity (the label is the fence around the claim).
//!
//! Rows:
//! - wasmColdMs: fresh Wasmtime engine + module compile + instantiation +
//!   ABI handshake + first admit (the cold path a replacement worker pays)
//! - wasmWarmAdmitUs / wasmWarmStepUs: per-call warm medians
//! - nativeAdmitUs: the native face's median (the agreement baseline)
//! - paranoidAdmitUs: the dual-run's median (native + wasm + compare)
//! - fullLifecycleOpsPerSec: END-TO-END operations per second through the
//!   supervisor — admission, journal (fsync), dispatch, effect ledger
//!   (fsync), response, receipt — the honest number, fsyncs included
//! - wasmConcurrentAdmitsPerSec: 4 threads, one WasmWorker (own store) each
//! - wasmAdmitTail: p50/p99/max over 1000 warm admits
//! - recoveryMs: chain-verify + replay + reconcile a journal of 200
//!   completed operations on a fresh supervisor
//! - wasmPeakLinearMemoryBytes / wasmFuelPerAdmit: the bounded worker's
//!   own consumption

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{
    wasm_module_bytes, Bounds, NativeWorker, ParanoidWorker, WasmWorker, Worker, WASMTIME_PIN,
};
use serde_json::json;
use std::time::{Duration, Instant};

fn tmp(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-bench-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn now_ns() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos()
}

fn median(mut v: Vec<u128>) -> u128 {
    v.sort_unstable();
    v[v.len() / 2]
}

fn pct(v: &[u128], p: f64) -> u128 {
    v[(v.len() as f64 * p).clamp(0.0, (v.len() - 1) as f64) as usize]
}

fn main() {
    let now = 1_800_000_000u64;
    let module = wasm_module_bytes().expect("wasm module (build it or set BNROSE_EXEC_WASM)");
    let bounds = Bounds::default();
    let policy = test_policy();
    let mut out = serde_json::Map::new();

    let hw = std::env::var("BNROSE_BENCH_HW").unwrap_or_else(|_| {
        format!(
            "{} / {} / {} logical cores (set BNROSE_BENCH_HW for the full CPU label)",
            std::env::consts::OS,
            std::env::consts::ARCH,
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(0),
        )
    });
    out.insert("hardware".into(), json!(hw));
    out.insert("wasmtime".into(), json!(WASMTIME_PIN));
    out.insert(
        "workload".into(),
        json!("WB001-shaped slice operations: 238-byte canonical envelopes, paranoid admission, journal+ledger fsyncs, Ed25519 receipts"),
    );

    // ---- cold path
    let t0 = Instant::now();
    let mut cold = WasmWorker::new(&module, bounds).expect("cold instantiation");
    let f0 = fixture(0, now, 600);
    let req0 = bnrose_exec_host::admit_request(now, &f0.authority, &policy, &f0.env);
    cold.admit(&req0).expect("cold admit");
    out.insert("wasmColdMs".into(), json!(t0.elapsed().as_millis() as u64));

    // ---- warm admits + tail
    const N: usize = 1000;
    let mut lat = Vec::with_capacity(N);
    let mut fuel_per = 0;
    for i in 0..N {
        let f = fixture((i % 50) as u64, now, 600);
        let req = bnrose_exec_host::admit_request(now, &f.authority, &policy, &f.env);
        let t = Instant::now();
        cold.admit(&req).expect("warm admit");
        lat.push(t.elapsed().as_nanos());
    }
    fuel_per = cold.last_fuel();
    let mut sorted = lat.clone();
    sorted.sort_unstable();
    out.insert("wasmWarmAdmitUs".into(), json!(median(lat) as f64 / 1000.0));
    out.insert(
        "wasmAdmitTailP50Us".into(),
        json!(pct(&sorted, 0.50) as f64 / 1000.0),
    );
    out.insert(
        "wasmAdmitTailP99Us".into(),
        json!(pct(&sorted, 0.99) as f64 / 1000.0),
    );
    out.insert(
        "wasmAdmitTailMaxUs".into(),
        json!(*sorted.last().unwrap() as f64 / 1000.0),
    );
    out.insert(
        "wasmPeakLinearMemoryBytes".into(),
        json!(cold.peak_memory()),
    );
    out.insert("wasmFuelPerAdmit".into(), json!(fuel_per));

    // ---- warm steps
    let st = bnrose_exec_core::OpState {
        state: bnrose_exec_core::S_RESERVED,
        recovered: 0,
        fail: 0,
        bound_effect: [7; 32],
        seq: 2,
    };
    let step_req = bnrose_exec_host::step_request(
        &[1; 32],
        &[2; 32],
        &st,
        bnrose_exec_core::E_DISPATCH,
        &[7; 32],
        now,
        u64::MAX,
    );
    let mut slat = Vec::new();
    for _ in 0..N {
        let t = Instant::now();
        cold.step(&step_req).expect("warm step");
        slat.push(t.elapsed().as_nanos());
    }
    out.insert("wasmWarmStepUs".into(), json!(median(slat) as f64 / 1000.0));

    // ---- native + paranoid baselines
    let mut native = NativeWorker::new();
    let mut nlat = Vec::new();
    for i in 0..200 {
        let f = fixture((i % 50) as u64, now, 600);
        let req = bnrose_exec_host::admit_request(now, &f.authority, &policy, &f.env);
        let t = Instant::now();
        native.admit(&req).unwrap();
        nlat.push(t.elapsed().as_nanos());
    }
    out.insert("nativeAdmitUs".into(), json!(median(nlat) as f64 / 1000.0));

    let mut paranoid = ParanoidWorker::around(Box::new(
        WasmWorker::new(&module, bounds).expect("paranoid wasm"),
    ));
    let mut plat = Vec::new();
    for i in 0..200 {
        let f = fixture((i % 50) as u64, now, 600);
        let req = bnrose_exec_host::admit_request(now, &f.authority, &policy, &f.env);
        let t = Instant::now();
        paranoid.admit(&req).unwrap();
        plat.push(t.elapsed().as_nanos());
    }
    out.insert(
        "paranoidAdmitUs".into(),
        json!(median(plat) as f64 / 1000.0),
    );

    // ---- full lifecycle (the honest number: fsyncs included)
    let state = tmp("lifecycle");
    bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x77; 32]).unwrap();
    let mut sup = Supervisor::open(
        &state,
        Box::new(ParanoidWorker::around(Box::new(
            WasmWorker::new(&module, bounds).expect("lifecycle wasm"),
        ))),
        policy.clone(),
    )
    .unwrap();
    const OPS: usize = 100;
    let t = Instant::now();
    for i in 0..OPS {
        let f = fixture(1000 + i as u64, now, 600);
        let o = sup.run(&read_intent(&f.to_json()).unwrap(), now, false, &bounds);
        assert!(o.refused.is_none(), "bench op {i}: {:?}", o.refused);
    }
    let life = t.elapsed();
    out.insert(
        "fullLifecycleOpsPerSec".into(),
        json!((OPS as f64 / life.as_secs_f64()).round()),
    );

    // ---- concurrency: 4 threads, one store each
    const THREADS: usize = 4;
    let each = 250usize;
    let module_arc = std::sync::Arc::new(module.clone());
    let t = Instant::now();
    let mut handles = Vec::new();
    for w in 0..THREADS {
        let module_arc = module_arc.clone();
        handles.push(std::thread::spawn(move || {
            let mut wk = WasmWorker::new(&module_arc, bounds).expect("concurrent worker");
            let start = (w * 100) as u64;
            for i in 0..each {
                let f = fixture(start + i as u64, now, 600);
                let req =
                    bnrose_exec_host::admit_request(now, &f.authority, &test_policy(), &f.env);
                wk.admit(&req).expect("concurrent admit");
            }
        }));
    }
    for h in handles {
        h.join().expect("thread");
    }
    let conc = t.elapsed();
    out.insert(
        "wasmConcurrentAdmitsPerSec".into(),
        json!(((THREADS * each) as f64 / conc.as_secs_f64()).round()),
    );

    // ---- recovery cost over the 100-op journal built above
    let state2 = tmp("recover-none");
    drop(state2);
    let t = Instant::now();
    let mut sup2 = Supervisor::open(&state, Box::new(NativeWorker::new()), policy).unwrap();
    let report = sup2.recover(now).expect("recovery");
    let rec = t.elapsed();
    let ops_recovered = report["ops"].as_array().map(|a| a.len()).unwrap_or(0);
    out.insert("recoveryMs".into(), json!(rec.as_millis() as u64));
    out.insert("recoveryOps".into(), json!(ops_recovered));
    out.insert(
        "journalRecordsRecovered".into(),
        json!(report["records"].clone()),
    );

    out.insert("measuredAtUnixNs".into(), json!(now_ns()));
    let v = serde_json::Value::Object(out);
    if let Some(path) = std::env::args().nth(1) {
        std::fs::write(&path, serde_json::to_string_pretty(&v).unwrap()).expect("write receipt");
    }
    println!("{}", serde_json::to_string_pretty(&v).unwrap());
    let _ = Duration::from_secs(0);
}
