//! SKV-1 (autonomous recovery), first executable receipt: hard-kill a child
//! process mid-write, reopen its store, and prove from observations —
//! every acknowledged commit is present with its exact value; no value is
//! torn; the engine reopens and passes its structural check.
//!
//! TAM boundary, named: this exercises PROCESS DEATH. Power-loss durability
//! is a different slice — NOT RUN, not claimed. Extra un-acked keys beyond
//! the acknowledged set are LEGAL (a batch may commit before the ack fsync),
//! but any present key must carry its exact deterministic value.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use adapter_store::{corpus_key, corpus_value, open_named};

fn child_binary() -> std::path::PathBuf {
    // Tests run with CWD = the crate root; the bin lands in target/debug.
    let mut p = std::env::current_exe().expect("cwd");
    p.pop(); // deps/ or ./
    if p.ends_with("deps") {
        p.pop();
    }
    p.join("skv-child")
}

fn parse_acked(path: &Path) -> Vec<u64> {
    // A kill in the first microseconds can land before the ack file exists:
    // that is the empty-acknowledged crash state, not a harness failure.
    let Ok(f) = std::fs::File::open(path) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for line in BufReader::new(f).lines() {
        // A hard kill can leave a partial trailing line; only complete
        // integers count as acknowledged.
        if let Ok(n) = line.expect("line").trim().parse::<u64>() {
            out.push(n);
        }
    }
    out
}

fn replay_expected(acked: &[u64]) -> HashMap<Vec<u8>, Vec<u8>> {
    let mut state = HashMap::new();
    for &i in acked {
        state.insert(corpus_key(i), corpus_value(i));
        if i >= 64 && i % 8 == 0 {
            state.remove(&corpus_key(i - 64));
        }
    }
    state
}

fn crash_and_verify(engine: &str, delay_ms: u64) {
    let dir = adapter_store::temp_dir(&format!("skv1-{engine}-{delay_ms}"));
    let mut child = Command::new(child_binary())
        .args([
            engine.to_string(),
            dir.to_string_lossy().into_owned(),
            "50000".to_string(),
        ])
        .spawn()
        .expect("spawn skv-child");
    std::thread::sleep(Duration::from_millis(delay_ms));
    let killed = child.kill().is_ok(); // hard terminate, no graceful path
    let _ = child.wait_with_output();

    let store = open_named(engine, &dir.join("store")).expect("reopen after kill");
    store
        .integrity_check()
        .expect("structural check after kill");

    let scanned: HashMap<Vec<u8>, Vec<u8>> = store
        .scan_prefix(b"key-")
        .expect("scan after kill")
        .into_iter()
        .collect();

    let acked = parse_acked(&dir.join("acks.log"));
    let expected = replay_expected(&acked);

    // 1. Torn-value detection: every PRESENT key must carry the exact
    //    deterministic value for its index.
    let mut torn = 0usize;
    for (k, v) in &scanned {
        let idx: u64 = std::str::from_utf8(&k[4..])
            .expect("key index")
            .parse()
            .expect("key index u64");
        if *v != corpus_value(idx) {
            torn += 1;
        }
    }
    // 2. Acknowledged commits must all be present with exact values.
    let mut missing = 0usize;
    for (k, v) in &expected {
        match scanned.get(k) {
            Some(present) if present == v => {}
            _ => missing += 1,
        }
    }
    let extras = scanned.len().saturating_sub(expected.len());
    let verdict = if torn == 0 && missing == 0 {
        "PASS"
    } else {
        "FAIL"
    };

    println!(
        "SKV1-RECEIPT engine={engine} killed={killed} delay_ms={delay_ms} acked={} present={} expected={} extras_unacked={extras} torn={torn} missing={missing} integrity=ok verdict={verdict}",
        acked.len(),
        scanned.len(),
        expected.len(),
    );
    assert_eq!(torn, 0, "torn values after crash");
    assert_eq!(missing, 0, "acknowledged commits lost after crash");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn skv1_sqlite_crash_recovery() {
    for delay_ms in [150u64, 400, 800] {
        crash_and_verify("sqlite", delay_ms);
    }
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv1_surrealkv_crash_recovery() {
    for delay_ms in [150u64, 400, 800] {
        crash_and_verify("surrealkv", delay_ms);
    }
}
