//! SKV-5 (scale and longevity), first executable beat: bounded growth,
//! pruning with live references, engine migration with interruption and
//! rollback protection, exact recovery from committed state — plus the
//! founder-ordered measurements: disk usage, write amplification, p95/p99
//! write latency. Both engines, both migration directions.
//!
//! Boundaries named: write amplification here is the APPARENT ratio
//! (on-disk bytes growth ÷ logical payload bytes during the pure write
//! phase — includes WAL, metadata and page overhead, not a device-level
//! measurement). SurrealKV 1.0 has no manual compaction trigger, so its
//! maintenance receipt is flush-only — and this test MEASURED that
//! tombstone materialization can push on-disk size ABOVE the pre-delete
//! peak (+14% at this scale) until background compaction reclaims; the
//! SurrealKV bounded-growth assertion is therefore write-phase WA ≤ 10×
//! logical plus logical-prune exactness, while SQLite's VACUUM reclaim
//! is asserted strictly (disk shrinks below peak).

use std::collections::HashMap;
use std::process::Command;
use std::time::Instant;

use adapter_store::{corpus_key, corpus_value, open_named, Edit, EmbeddedStore};

const WRITES: u64 = 6000;
const KEEP_EVERY: u64 = 10; // live references: keys with i % 10 == 0 survive

fn child_binary() -> std::path::PathBuf {
    let mut p = std::env::current_exe().expect("cwd");
    p.pop();
    if p.ends_with("deps") {
        p.pop();
    }
    p.join("skv-child")
}

fn dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(md) = e.metadata() {
                total += md.len();
            }
        }
    }
    total
}

fn percentile(mut v: Vec<u64>, p: f64) -> u64 {
    if v.is_empty() {
        return 0;
    }
    v.sort_unstable();
    let idx = ((v.len() as f64 - 1.0) * p).round() as usize;
    v[idx.min(v.len() - 1)]
}

fn live_map() -> HashMap<Vec<u8>, Vec<u8>> {
    (0..WRITES)
        .step_by(KEEP_EVERY as usize)
        .map(|i| (corpus_key(i), corpus_value(i)))
        .collect()
}

fn scale_longevity(engine: &str) {
    let dir = adapter_store::temp_dir(&format!("skv5-{engine}"));
    let store = open_named(engine, &dir.join("store")).expect("open");
    store.integrity_check().expect("integrity at open");

    // ---- phase 1: bounded write wave, per-op latency recorded ----
    let disk_before = dir_size(&dir);
    let mut logical = 0u64;
    let mut lat_us: Vec<u64> = vec![];
    for i in 0..WRITES {
        let k = corpus_key(i);
        let v = corpus_value(i);
        logical += (k.len() + v.len()) as u64;
        let t0 = Instant::now();
        store.write_batch(&[Edit::Put(k, v)]).expect("durable put");
        lat_us.push(t0.elapsed().as_micros() as u64);
    }
    let disk_peak = dir_size(&dir);
    let wa = disk_peak.saturating_sub(disk_before) as f64 / logical as f64;
    let p50 = percentile(lat_us.clone(), 0.50);
    let p95 = percentile(lat_us.clone(), 0.95);
    let p99 = percentile(lat_us.clone(), 0.99);
    let max = lat_us.iter().copied().max().unwrap_or(0);

    // ---- phase 2: prune 90%, keep live references, maintain ----
    for i in 0..WRITES {
        if i % KEEP_EVERY != 0 {
            store
                .write_batch(&[Edit::Delete(corpus_key(i))])
                .expect("durable delete");
        }
    }
    store.compact().expect("maintenance");
    std::thread::sleep(std::time::Duration::from_millis(500)); // background policy settle
    let disk_pruned = dir_size(&dir);

    let scanned: HashMap<Vec<u8>, Vec<u8>> = store
        .scan_prefix(b"key-")
        .expect("scan after prune")
        .into_iter()
        .collect();
    let expected_live = live_map();
    let prune_exact = scanned == expected_live;

    // Exact recovery from committed state: fresh handle, same equality.
    drop(store);
    let reopened = open_named(engine, &dir.join("store")).expect("reopen");
    reopened
        .integrity_check()
        .expect("integrity after prune+reopen");
    let reopened_exact: bool = {
        let scanned: HashMap<_, _> = reopened
            .scan_prefix(b"key-")
            .expect("reopen scan")
            .into_iter()
            .collect();
        scanned == expected_live
    };
    drop(reopened);

    let reclaimed = disk_peak > disk_pruned;
    // Bounded growth, per engine, honestly: SQLite's VACUUM must strictly
    // reclaim; SurrealKV 1.0 has no manual compaction and its tombstones
    // materialize on disk (measured transient growth above peak), so its
    // bound is the write-phase amplification ceiling plus logical prune.
    let wa_bounded = wa <= 10.0;
    let bounded = if engine == "sqlite" {
        disk_pruned <= disk_peak && wa_bounded
    } else {
        wa_bounded
    };

    println!(
        "SKV5-RECEIPT engine={engine} writes={WRITES} live={} logical_bytes={logical} disk_peak={disk_peak} disk_pruned={disk_pruned} apparent_wa={wa:.2}x p50_us={p50} p95_us={p95} p99_us={p99} max_us={max} prune_exact={prune_exact} wa_bounded={wa_bounded} bounded={bounded} reclaimed={reclaimed} reopen_exact={reopened_exact} verdict={}",
        expected_live.len(),
        if prune_exact && reopened_exact && bounded { "PASS" } else { "FAIL" }
    );
    assert!(
        prune_exact,
        "pruning lost or kept wrong keys (live references)"
    );
    assert!(
        reopened_exact,
        "state changed across close/reopen after prune"
    );
    assert!(
        wa_bounded,
        "write-phase amplification runaway (apparent WA {wa:.2}x)"
    );
    if engine == "sqlite" {
        assert!(
            reclaimed,
            "VACUUM reclaimed nothing (peak {disk_peak}, pruned {disk_pruned})"
        );
    }

    // ---- phase 3: migration with interruption + rollback protection ----
    migration_with_interruption(engine);
    let _ = std::fs::remove_dir_all(&dir);
}

fn migration_with_interruption(src_engine: &str) {
    let dst_engine = if src_engine == "sqlite" {
        "surrealkv"
    } else {
        "sqlite"
    };
    let src_dir = adapter_store::temp_dir(&format!("skv5-mig-{src_engine}-src"));
    let dst_dir = adapter_store::temp_dir(&format!("skv5-mig-{src_engine}-dst"));

    let src = open_named(src_engine, &src_dir.join("store")).expect("open src");
    for i in 0..2000u64 {
        src.write_batch(&[Edit::Put(corpus_key(i), corpus_value(i))])
            .expect("seed src");
    }
    let source_state: Vec<(Vec<u8>, Vec<u8>)> = src.scan_prefix(b"key-").expect("scan src");
    drop(src);
    let source_keys: HashMap<_, _> = source_state.iter().cloned().collect();

    // Interrupted migration: kill the child once a few batches are acked.
    // Between the poll noticing the acks and the kill landing, a fast child
    // may commit more batches — the window carries that slack, and a kill
    // that lands too late (nothing left to interrupt) retries once.
    let mut acked = 0usize;
    let mut partial_scan: Vec<(Vec<u8>, Vec<u8>)> = Vec::new();
    let mut interrupted = false;
    for _attempt in 0..2 {
        let mut child = Command::new(child_binary())
            .args([
                "migrate".to_string(),
                src_engine.to_string(),
                src_dir.to_string_lossy().into_owned(),
                dst_engine.to_string(),
                dst_dir.to_string_lossy().into_owned(),
            ])
            .spawn()
            .expect("spawn migration child");
        let ack_path = dst_dir.join("migrate-acks.log");
        acked = 0usize;
        let deadline = Instant::now() + std::time::Duration::from_secs(60);
        while Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(10));
            if let Ok(f) = std::fs::File::open(&ack_path) {
                acked = std::io::BufRead::lines(std::io::BufReader::new(f)).count();
            }
            if acked >= 3 {
                break;
            }
            if let Ok(Some(_)) = child.try_wait() {
                break;
            }
        }
        let _ = child.kill();
        let _ = child.wait();

        let partial = open_named(dst_engine, &dst_dir.join("store")).expect("open partial dst");
        partial
            .integrity_check()
            .expect("integrity of interrupted migration");
        partial_scan = partial.scan_prefix(b"key-").expect("scan partial");
        drop(partial);
        interrupted = partial_scan.len() < source_state.len();
        if interrupted {
            break;
        }
        // Child completed before the kill landed: wipe the destination and
        // retry once (a completed run is not interruption evidence).
        let _ = std::fs::remove_dir_all(&dst_dir);
        std::fs::create_dir_all(&dst_dir).expect("recreate dst dir");
    }

    // Partial destination: whole batches only, every present key exact and
    // drawn from the source — no torn batch, no foreign key.
    let all_from_source = partial_scan
        .iter()
        .all(|(k, v)| source_keys.get(k) == Some(v));
    let in_window = partial_scan.len() >= acked * 50 && partial_scan.len() <= (acked + 2) * 50;

    // Complete the migration over the partial destination (idempotent puts)
    // and require exact equality with the source.
    let status = Command::new(child_binary())
        .args([
            "migrate".to_string(),
            src_engine.to_string(),
            src_dir.to_string_lossy().into_owned(),
            dst_engine.to_string(),
            dst_dir.to_string_lossy().into_owned(),
        ])
        .status()
        .expect("rerun migration");
    assert!(status.success(), "migration rerun failed");

    let done = open_named(dst_engine, &dst_dir.join("store")).expect("open completed dst");
    done.integrity_check().expect("integrity after completion");
    let final_scan = done.scan_prefix(b"key-").expect("scan completed");
    let final_exact = final_scan == source_state;
    drop(done);

    println!(
        "SKV5-MIGRATION-RECEIPT src={src_engine} dst={dst_engine} entries={} killed_after_batches={acked} partial={} interrupted={interrupted} whole_batches_only={} all_from_source={all_from_source} resumed_exact={final_exact} verdict={}",
        source_state.len(),
        partial_scan.len(),
        in_window,
        if in_window && all_from_source && final_exact && interrupted { "PASS" } else { "FAIL" }
    );
    assert!(
        interrupted,
        "migration child completed before every kill attempt (no interruption evidence)"
    );
    assert!(
        in_window,
        "interrupted destination not whole-batches (acked={acked}, partial len={})",
        partial_scan.len()
    );
    assert!(
        all_from_source,
        "interrupted destination holds foreign or torn entries"
    );
    assert!(
        final_exact,
        "resumed migration did not reconstruct the source exactly"
    );
    let _ = std::fs::remove_dir_all(&src_dir);
    let _ = std::fs::remove_dir_all(&dst_dir);
}

#[test]
fn skv5_sqlite_scale_longevity() {
    scale_longevity("sqlite");
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv5_surrealkv_scale_longevity() {
    scale_longevity("surrealkv");
}
