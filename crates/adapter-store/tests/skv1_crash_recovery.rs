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

/// Replay ops 0..=upto of the child's deterministic sequence (put key i;
/// every 8th op from i>=64 also deletes key i-64).
fn replay_ops(upto: u64) -> HashMap<Vec<u8>, Vec<u8>> {
    let mut state = HashMap::new();
    for i in 0..=upto {
        state.insert(corpus_key(i), corpus_value(i));
        if i >= 64 && i % 8 == 0 {
            state.remove(&corpus_key(i - 64));
        }
    }
    state
}

fn key_index(k: &[u8]) -> Option<u64> {
    std::str::from_utf8(&k[4..]).ok()?.parse().ok()
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

    // The committed prefix is revealed by the data itself: every op PUTS
    // its own key, so the largest present-or-acked index IS the last
    // committed op. The unacked tail is legal state (a batch may commit
    // before its ack fsync), and its tombstone may LEGALLY delete a key
    // the acked-only replay expects live — the first Linux CI run
    // convicted exactly that (acked=224 present=204 missing=1: the
    // unacked op 224 put key 224 and deleted key 160). The expectation
    // therefore replays ops 0..=committed, then compares EXACTLY.
    let committed = scanned
        .keys()
        .filter_map(|k| key_index(k))
        .chain(acked.iter().copied())
        .max()
        .unwrap_or(0);
    let expected = replay_ops(committed);

    // Torn-value detection: every present key must carry the exact
    // deterministic value for its index (subsumed by the exact compare;
    // counted separately for the receipt).
    let mut torn = 0usize;
    for (k, v) in &scanned {
        if let Some(idx) = key_index(k) {
            if *v != corpus_value(idx) {
                torn += 1;
            }
        } else {
            torn += 1; // unparseable key: not from this corpus at all
        }
    }
    let equal = scanned == expected;
    let missing = expected
        .iter()
        .filter(|(k, _)| !scanned.contains_key(*k))
        .count();
    let verdict = if torn == 0 && equal { "PASS" } else { "FAIL" };

    println!(
        "SKV1-RECEIPT engine={engine} killed={killed} delay_ms={delay_ms} acked={} committed_prefix={committed} present={} expected={} torn={torn} missing={missing} exact={equal} integrity=ok verdict={verdict}",
        acked.len(),
        scanned.len(),
        expected.len(),
    );
    assert_eq!(torn, 0, "torn values after crash");
    assert!(
        equal,
        "recovered state differs from the deterministic replay of ops 0..={committed}"
    );
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
