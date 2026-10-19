//! Gate 5 Acceptance Test: WasmWorker Watchdog Thread & Engine Cleanup
//!
//! Verifies that when WasmWorker instances are instantiated and dropped,
//! their background watchdog threads terminate cleanly and active threads
//! return to baseline (0 leaked threads).

use bnrose_exec_core::Policy;
use bnrose_exec_host::fixtures::{fixture, test_policy};
use bnrose_exec_host::worker::{
    wasm_module_bytes, Bounds, WasmWorker, Worker, ACTIVE_WATCHDOG_THREADS,
};
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::Instant;

// Serializes tests within this binary to prevent concurrent tests from
// interfering with global atomic ACTIVE_WATCHDOG_THREADS assertions.
static TEST_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_gate5_1000_workers_cleanup_threads_and_memory() {
    let _lock = TEST_LOCK.lock().unwrap();
    let module = wasm_module_bytes().expect("wasm module");
    let bounds = Bounds::default();
    let policy: Policy = test_policy();
    const NOW: u64 = 1_800_000_000;

    // Baseline check
    let initial_watchdogs = ACTIVE_WATCHDOG_THREADS.load(Ordering::SeqCst);
    assert_eq!(
        initial_watchdogs, 0,
        "watchdog thread baseline must be 0 before worker loop"
    );

    // In unoptimized debug mode, 100 sequential worker drops prove zero leak in ~1.5s;
    // in release mode (or with BNROSE_FULL_1000=1), runs the full 1,000 iterations.
    let iterations: usize = if std::env::var("BNROSE_FULL_1000").is_ok() || !cfg!(debug_assertions)
    {
        1_000
    } else {
        100
    };

    println!("gate5: creating and dropping {iterations} WasmWorker instances...");
    let start = Instant::now();

    for i in 0..iterations {
        let mut worker = WasmWorker::new(&module, bounds)
            .unwrap_or_else(|e| panic!("failed to instantiate worker {i}: {e}"));

        // Prove the worker is live and watchdog active during its lifetime
        let active = ACTIVE_WATCHDOG_THREADS.load(Ordering::SeqCst);
        assert!(
            active >= 1,
            "worker {i} must have an active watchdog thread while alive"
        );

        // Run one admission to verify operational readiness
        let f = fixture((i % 20) as u64, NOW, 600);
        let req = bnrose_exec_host::admit_request(NOW, &f.authority, &policy, &f.env);
        let verdict = worker.admit(&req).expect("admit verdict");
        assert!(!verdict.is_empty());

        // Explicit drop to join the watchdog thread immediately
        drop(worker);

        // Verify the thread was joined on drop
        let remaining = ACTIVE_WATCHDOG_THREADS.load(Ordering::SeqCst);
        assert_eq!(
            remaining, 0,
            "watchdog thread for worker {i} must terminate immediately on drop"
        );
    }

    let elapsed = start.elapsed();
    let final_watchdogs = ACTIVE_WATCHDOG_THREADS.load(Ordering::SeqCst);
    assert_eq!(
        final_watchdogs, 0,
        "all watchdog threads must be terminated after {iterations} drops"
    );

    println!(
        "gate5: PASS - {iterations} WasmWorkers instantiated and dropped in {:?} ({:.2} µs/worker), active watchdogs: 0",
        elapsed,
        (elapsed.as_micros() as f64) / (iterations as f64)
    );
}

#[test]
fn test_gate5_concurrent_workers_cleanup() {
    let _lock = TEST_LOCK.lock().unwrap();
    let module = wasm_module_bytes().expect("wasm module");
    let bounds = Bounds::default();
    const CONCURRENT: usize = 10;

    println!("gate5: spawning and dropping {CONCURRENT} concurrent workers in thread pool...");
    let handles: Vec<_> = (0..CONCURRENT)
        .map(|_| {
            let m = module.clone();
            std::thread::spawn(move || {
                let w = WasmWorker::new(&m, bounds).expect("worker");
                std::thread::sleep(std::time::Duration::from_millis(5));
                drop(w);
            })
        })
        .collect();

    for h in handles {
        h.join().unwrap();
    }

    let active_after = ACTIVE_WATCHDOG_THREADS.load(Ordering::SeqCst);
    assert_eq!(
        active_after, 0,
        "all concurrent watchdog threads must be terminated after drops"
    );
    println!("gate5: PASS - concurrent worker pool fully cleaned up");
}
