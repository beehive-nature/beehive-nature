//! Runtime lifecycle (founder directive, beat 4): the adapter's private
//! Tokio runtime and both engines must behave in a LONG-LIVED shape, not
//! just short tests — concurrent access, idle periods (background tasks
//! must not starve later commits), orderly closure, and resource cleanup
//! proven by a clean reopen + EXACT deterministic verification.
//!
//! Model: WRITERS threads own disjoint key ranges and run deterministic
//! op sequences (put key; every 8th op from i>=64 also deletes key i-64 —
//! the SKV-1 op shape, per-thread). Readers concurrently get/scan and
//! must never observe a non-exact value. After the wave: 2s idle, a
//! post-idle commit (starvation probe), drop (orderly close), fresh
//! reopen, and exact comparison against the full per-thread replay.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use std::time::Duration;

use adapter_store::{corpus_key, corpus_value, open_named, Edit, EmbeddedStore};

const WRITERS: u64 = 4;
const OPS: u64 = 1500;
const STRIDE: u64 = 100_000;
const IDLE_MS: u64 = 2000;

fn thread_key(t: u64, i: u64) -> Vec<u8> {
    corpus_key(t * STRIDE + i)
}

fn plan_thread(t: u64) -> Vec<Edit> {
    let mut ops = Vec::new();
    for i in 0..OPS {
        ops.push(Edit::Put(thread_key(t, i), corpus_value(t * STRIDE + i)));
        if i >= 64 && i % 8 == 0 {
            ops.push(Edit::Delete(thread_key(t, i - 64)));
        }
    }
    ops
}

fn replay_all_threads() -> HashMap<Vec<u8>, Vec<u8>> {
    let mut state = HashMap::new();
    for t in 0..WRITERS {
        for edit in plan_thread(t) {
            match edit {
                Edit::Put(k, v) => {
                    state.insert(k, v);
                }
                Edit::Delete(k) => {
                    state.remove(&k);
                }
            }
        }
    }
    state
}

fn life_cycle(engine: &str) {
    let dir = adapter_store::temp_dir(&format!("skvlife-{engine}"));
    let store: Arc<dyn EmbeddedStore> =
        Arc::from(open_named(engine, &dir.join("store")).expect("open"));

    let barrier = Arc::new(Barrier::new(WRITERS as usize));
    let finished = Arc::new(AtomicUsize::new(0));
    let stop_readers = Arc::new(AtomicBool::new(false));
    let torn: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    let mut writers = Vec::new();
    for t in 0..WRITERS {
        let store = Arc::clone(&store);
        let barrier = Arc::clone(&barrier);
        let finished = Arc::clone(&finished);
        let plan = plan_thread(t);
        writers.push(std::thread::spawn(move || {
            barrier.wait();
            for chunk in plan.chunks(50) {
                store.write_batch(chunk).expect("concurrent durable batch");
            }
            finished.fetch_add(1, Ordering::SeqCst);
        }));
    }

    let mut readers = Vec::new();
    for r in 0..2u64 {
        let store = Arc::clone(&store);
        let stop = Arc::clone(&stop_readers);
        let torn = Arc::clone(&torn);
        readers.push(std::thread::spawn(move || {
            while !stop.load(Ordering::SeqCst) {
                // Read a rotating slice of every thread's range; any PRESENT
                // value must be exact (torn detection under concurrency).
                for t in 0..WRITERS {
                    let i = (std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .subsec_millis() as u64
                        + r)
                        % OPS;
                    let k = thread_key(t, i);
                    if let Ok(Some(v)) = store.get(&k) {
                        if v != corpus_value(t * STRIDE + i) {
                            torn.lock().unwrap().push(format!("t{t}i{i}"));
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(5));
            }
        }));
    }

    for w in writers {
        w.join().expect("writer join");
    }
    stop_readers.store(true, Ordering::SeqCst);
    for rd in readers {
        rd.join().expect("reader join");
    }
    let torn_count = torn.lock().unwrap().len();

    // Idle period: no ops. Background tasks get no block_on windows — the
    // post-idle commit probes starvation.
    std::thread::sleep(Duration::from_millis(IDLE_MS));
    let post_idle_key = b"key-post-idle".to_vec();
    let post_idle_val = b"commits-after-idle".to_vec();
    store
        .write_batch(&[Edit::Put(post_idle_key.clone(), post_idle_val.clone())])
        .expect("post-idle commit (starvation probe)");
    let read_back = store.get(&post_idle_key).expect("post-idle read");
    let post_idle_ok = read_back.as_deref() == Some(&post_idle_val[..]);

    // Orderly closure: drop the last Arc (SurrealKV Drop runs tree.close()).
    drop(store);

    // Resource cleanup proven by a fresh handle over the same path.
    let reopened = open_named(engine, &dir.join("store")).expect("reopen after close");
    reopened
        .integrity_check()
        .expect("integrity after close+reopen");
    let scanned: HashMap<Vec<u8>, Vec<u8>> = reopened
        .scan_prefix(b"key-")
        .expect("scan")
        .into_iter()
        .collect();
    let mut expected = replay_all_threads();
    expected.insert(post_idle_key, post_idle_val);
    let exact = scanned == expected;
    let counts_match = scanned.len() == expected.len();

    println!(
        "SKVLIFE-RECEIPT engine={engine} writers={WRITERS}x{OPS}ops readers=2 torn_under_concurrency={torn_count} idle_ms={IDLE_MS} post_idle_commit={post_idle_ok} close=orderly reopen=clean exact_replay={exact} counts_match={counts_match} verdict={}",
        if torn_count == 0 && post_idle_ok && exact { "PASS" } else { "FAIL" }
    );
    assert_eq!(torn_count, 0, "torn values observed under concurrency");
    assert!(post_idle_ok, "post-idle commit starved");
    assert!(
        exact,
        "state after close+reopen differs from the deterministic replay (counts_match={counts_match})"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn life_sqlite() {
    life_cycle("sqlite");
}

#[cfg(feature = "surrealkv")]
#[test]
fn life_surrealkv() {
    life_cycle("surrealkv");
}
