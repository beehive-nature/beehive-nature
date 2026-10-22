//! SKV-1 (autonomous recovery), first executable receipt: hard-kill a child
//! process mid-write, reopen its store, and prove from observations —
//! every acknowledged commit is present with its exact value; no value is
//! torn; the engine reopens and passes its structural check.
//!
//! TAM boundary, named: this exercises PROCESS DEATH. Power-loss durability
//! is a different slice — NOT RUN, not claimed. Extra un-acked keys beyond
//! the acknowledged set are LEGAL (a batch may commit before the ack fsync),
//! but any present key must carry its exact deterministic value.
//!
//! Zero-commit repair (2026-10-15, routed on #422): the oracle used to
//! collapse an EMPTY history into "operation 0" (`max().unwrap_or(0)`) and
//! then demand op 0's key — a kill that landed before the first commit read
//! as a lost commit (`acked=0 present=0 expected=1`, CI run 38728617952).
//! "No operation" and "operation 0" are now different values (`None` vs
//! `Some(0)`), the oracle is one pure function the crash runs and the
//! regressions below share, and three kill modes keep the evidence honest:
//! the timed runs (unchanged), a deterministic pre-first-commit kill, and a
//! kill only after acknowledged commits exist (never vacuous). A child that
//! exits on its own before the kill is a failure, never crash evidence.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

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

/// The last committed op, revealed by the data itself: every op PUTS its own
/// key, so the largest present-or-acked index IS the last committed op. The
/// unacked tail is legal state (a batch may commit before its ack fsync), and
/// its tombstone may LEGALLY delete a key an acked-only replay expects live —
/// the first Linux CI run convicted exactly that (acked=224 present=204
/// missing=1: the unacked op 224 put key 224 and deleted key 160). `None`
/// means nothing at all was observed: no op is invented.
fn committed_prefix(scanned: &HashMap<Vec<u8>, Vec<u8>>, acked: &[u64]) -> Option<u64> {
    scanned
        .keys()
        .filter_map(|k| key_index(k))
        .chain(acked.iter().copied())
        .max()
}

/// The exact state the committed prefix implies: empty for no prefix,
/// otherwise the inclusive replay of ops 0..=n.
fn expected_state(committed: Option<u64>) -> HashMap<Vec<u8>, Vec<u8>> {
    match committed {
        None => HashMap::new(),
        Some(n) => replay_ops(n),
    }
}

/// The oracle's reading of one recovered state.
#[derive(Debug)]
struct Judgement {
    committed: Option<u64>,
    expected: usize,
    torn: usize,
    missing: usize,
    exact: bool,
}

impl Judgement {
    fn pass(&self) -> bool {
        self.torn == 0 && self.exact
    }
}

fn judge(scanned: &HashMap<Vec<u8>, Vec<u8>>, acked: &[u64]) -> Judgement {
    let committed = committed_prefix(scanned, acked);
    let expected = expected_state(committed);
    // Torn-value detection: every present key must carry the exact
    // deterministic value for its index (subsumed by the exact compare;
    // counted separately for the receipt).
    let mut torn = 0usize;
    for (k, v) in scanned {
        match key_index(k) {
            Some(idx) if *v == corpus_value(idx) => {}
            _ => torn += 1, // wrong value, or a key not from this corpus at all
        }
    }
    Judgement {
        committed,
        expected: expected.len(),
        torn,
        missing: expected
            .keys()
            .filter(|k| !scanned.contains_key(*k))
            .count(),
        exact: *scanned == expected,
    }
}

/// When the parent kills the child.
#[derive(Clone, Copy, Debug)]
enum Kill {
    /// After a fixed delay: wherever the child happens to be (the original
    /// runs; an empty history here is legal and is labelled as such).
    Timed(u64),
    /// Once the child has opened its store and holds before its first commit
    /// (handshake on its `ready` marker): deterministic zero-commit state.
    BeforeFirstCommit,
    /// Once at least this many commits are acknowledged (handshake on the ack
    /// log): recovery that is never vacuous.
    AfterAcks(usize),
}

const HANDSHAKE_DEADLINE: Duration = Duration::from_secs(120);

fn wait_until(what: &str, mut done: impl FnMut() -> bool) {
    let t0 = Instant::now();
    while !done() {
        assert!(
            t0.elapsed() < HANDSHAKE_DEADLINE,
            "handshake never completed: {what}"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn crash_and_verify(engine: &str, kill: Kill) {
    let tag = match kill {
        Kill::Timed(ms) => format!("t{ms}"),
        Kill::BeforeFirstCommit => "pre".into(),
        Kill::AfterAcks(n) => format!("a{n}"),
    };
    let dir = adapter_store::temp_dir(&format!("skv1-{engine}-{tag}"));
    let mut args = vec![
        engine.to_string(),
        dir.to_string_lossy().into_owned(),
        "50000".to_string(),
    ];
    if matches!(kill, Kill::BeforeFirstCommit) {
        args.push("hold-before-first-commit".into());
    }
    let mut child = Command::new(child_binary())
        .args(&args)
        .spawn()
        .expect("spawn skv-child");
    match kill {
        Kill::Timed(ms) => std::thread::sleep(Duration::from_millis(ms)),
        Kill::BeforeFirstCommit => wait_until("child ready before its first commit", || {
            dir.join("ready").exists()
        }),
        Kill::AfterAcks(n) => wait_until(&format!("{n} acknowledged commits"), || {
            parse_acked(&dir.join("acks.log")).len() >= n
        }),
    }
    // The kill must be OURS: a child that already exited (panic, open
    // failure, finished early) is not crash evidence.
    if let Some(status) = child.try_wait().expect("try_wait") {
        panic!("skv-child exited on its own before the kill ({status}): not crash evidence");
    }
    child.kill().expect("hard kill"); // no graceful path
    let status = child.wait().expect("reap after kill");
    assert!(
        !status.success(),
        "the killed child reported success ({status}): the kill did not land"
    );

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
    let j = judge(&scanned, &acked);
    let verdict = if j.pass() { "PASS" } else { "FAIL" };
    let (prefix, recovery) = match j.committed {
        None => (
            "none".to_string(),
            "empty-startup (no commit observed; NOT evidence that committed data survived)",
        ),
        Some(n) => (n.to_string(), "post-commit"),
    };
    println!(
        "SKV1-RECEIPT engine={engine} kill={kill:?} child_exit={status} acked={} committed_prefix={prefix} recovery={recovery} present={} expected={} torn={} missing={} exact={} integrity=ok verdict={verdict}",
        acked.len(),
        scanned.len(),
        j.expected,
        j.torn,
        j.missing,
        j.exact,
    );
    match kill {
        Kill::BeforeFirstCommit => {
            assert!(
                j.committed.is_none() && acked.is_empty(),
                "the held child committed nothing, yet the store shows a history"
            );
        }
        Kill::AfterAcks(n) => {
            assert!(
                acked.len() >= n,
                "acknowledged commits vanished from the ack log"
            );
            assert!(
                j.committed.is_some_and(|c| c + 1 >= n as u64),
                "post-commit run recovered no committed prefix"
            );
        }
        Kill::Timed(_) => {}
    }
    assert_eq!(j.torn, 0, "torn values after crash");
    assert!(
        j.exact,
        "recovered state differs from the deterministic replay of the committed prefix ({prefix})"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

fn crash_runs(engine: &str) {
    crash_and_verify(engine, Kill::BeforeFirstCommit);
    for delay_ms in [150u64, 400, 800] {
        crash_and_verify(engine, Kill::Timed(delay_ms));
    }
    // past op 64, so recovered state includes the tombstone path
    crash_and_verify(engine, Kill::AfterAcks(96));
}

#[test]
fn skv1_sqlite_crash_recovery() {
    crash_runs("sqlite");
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv1_surrealkv_crash_recovery() {
    crash_runs("surrealkv");
}

// ---- the oracle's own regressions (red-first against the old oracle) ----

fn state(pairs: impl IntoIterator<Item = u64>) -> HashMap<Vec<u8>, Vec<u8>> {
    pairs
        .into_iter()
        .map(|i| (corpus_key(i), corpus_value(i)))
        .collect()
}

#[test]
fn oracle_empty_history_expects_an_empty_store() {
    let j = judge(&HashMap::new(), &[]);
    assert_eq!(j.committed, None, "no operation is invented");
    assert_eq!(j.expected, 0);
    assert!(j.pass(), "{j:?}");
}

#[test]
fn oracle_op0_recovered_without_ack_is_accepted() {
    let j = judge(&state([0]), &[]);
    assert_eq!(j.committed, Some(0));
    assert!(j.pass(), "{j:?}");
}

#[test]
fn oracle_op0_acknowledged_but_missing_fails() {
    let j = judge(&HashMap::new(), &[0]);
    assert_eq!(j.committed, Some(0));
    assert_eq!(j.missing, 1);
    assert!(
        !j.pass(),
        "an acknowledged write lost across the crash must fail"
    );
}

#[test]
fn oracle_unacked_committed_tail_with_tombstone_replays_exactly() {
    // op 64 committed but never acknowledged: it put key 64 AND deleted key 0
    let recovered = replay_ops(64);
    assert!(
        !recovered.contains_key(&corpus_key(0)),
        "the tombstone applied"
    );
    let acked: Vec<u64> = (0..=60).collect();
    let j = judge(&recovered, &acked);
    assert_eq!(j.committed, Some(64));
    assert!(j.pass(), "{j:?}");
}

#[test]
fn oracle_missing_interior_key_fails() {
    let mut recovered = replay_ops(10);
    recovered.remove(&corpus_key(5));
    let acked: Vec<u64> = (0..=10).collect();
    let j = judge(&recovered, &acked);
    assert_eq!(j.missing, 1);
    assert!(!j.pass());
}

#[test]
fn oracle_corrupted_value_fails() {
    let mut recovered = replay_ops(10);
    recovered.insert(corpus_key(3), b"torn".to_vec());
    let j = judge(&recovered, &[]);
    assert_eq!(j.torn, 1);
    assert!(!j.pass());
}
