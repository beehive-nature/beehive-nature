//! E1-CONCURRENCY-001 — minimal reproducer for the limiter wedge.
//!
//! Drives the patched LeafEgressLimiter the way the rig's 9-node mesh
//! does, OUTSIDE any daemon: concurrent reserve_protected (the
//! key-cache flusher / DM path), try_reserve_data (eager relayed
//! frames), try_reserve_recovery (the waiter lane), and snapshot()
//! (the diagnostics route). A watchdog thread tracks per-op heartbeats;
//! a stall with a live process is THE wedge. Runs 60 s by default.
//!
//! Not a #[test]: run with `cargo test --lib e1_concurrency_repro --
//! --nocapture --ignored` style gating via E1_REPRO env, or as a test
//! with a hard 90s bound so CI never hangs.

use super::*;
use std::sync::atomic::AtomicBool;

const OPS: [&str; 4] = ["protected", "data", "recovery", "snapshot"];

#[test]
fn e1_concurrency_reproduces_the_wedge() {
    let share: u16 = std::env::var("E1_REPRO_SHARE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(250);
    let seconds: u64 = std::env::var("E1_REPRO_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);
    let limiter = Arc::new(LeafEgressLimiter::disabled());
    assert!(limiter.configure(Some(LeafEgressConfig {
        soft_bytes_per_second: 65_536,
        hard_bytes_per_second: 131_072,
        burst_bytes: 4 * 1024 * 1024,
        max_serialized_frame_bytes: 4 * 1024 * 1024 - 1,
        policy: BytePolicy::ShedNormal,
        reserved_share_permille: share,
        reserved_peer_permille: 500,
    })));
    if share > 0 {
        // Two reserved scopes (verified-store stand-ins) + a swarm of
        // ordinary scopes, exactly like the rig's topic mix.
        let mut scopes = BTreeSet::new();
        scopes.insert([7_u8; 32]);
        scopes.insert([8_u8; 32]);
        limiter.set_reserved_scopes(scopes);
    }
    let stop = Arc::new(AtomicBool::new(false));
    let heartbeat: Vec<Arc<std::sync::atomic::AtomicU64>> = (0..OPS.len())
        .map(|_| Arc::new(std::sync::atomic::AtomicU64::new(0)))
        .collect();
    let mut handles = Vec::new();
    // 6 protected drivers (key-cache flusher + DM lane shape)
    for t in 0..6_u64 {
        let limiter = Arc::clone(&limiter);
        let stop = Arc::clone(&stop);
        let beat = Arc::clone(&heartbeat[0]);
        handles.push(std::thread::spawn(move || {
            let mut i: u64 = 0;
            while !stop.load(Ordering::Relaxed) {
                i += 1;
                let key = fair_repro_key(t, i, [1_u8; 32]);
                let _ = limiter.reserve_protected(key, (400 + (i % 7) * 100) as usize, true);
                beat.fetch_add(1, Ordering::Relaxed);
                std::thread::sleep(std::time::Duration::from_micros(300));
            }
        }));
    }
    // 6 data drivers (eager relayed frames, mixed scopes)
    for t in 0..6_u64 {
        let limiter = Arc::clone(&limiter);
        let stop = Arc::clone(&stop);
        let beat = Arc::clone(&heartbeat[1]);
        handles.push(std::thread::spawn(move || {
            let mut i: u64 = 0;
            while !stop.load(Ordering::Relaxed) {
                i += 1;
                let scope = if i % 3 == 0 { [7_u8; 32] } else { [9_u8; 32] };
                let key = fair_repro_key(t, i, scope);
                let _ = limiter.try_reserve_data(key, (500 + (i % 5) * 250) as usize, true);
                beat.fetch_add(1, Ordering::Relaxed);
                std::thread::sleep(std::time::Duration::from_micros(200));
            }
        }));
    }
    // 3 recovery drivers (the waiter lane, ordinary + critical)
    for t in 0..3_u64 {
        let limiter = Arc::clone(&limiter);
        let stop = Arc::clone(&stop);
        let beat = Arc::clone(&heartbeat[2]);
        handles.push(std::thread::spawn(move || {
            let mut i: u64 = 0;
            while !stop.load(Ordering::Relaxed) {
                i += 1;
                let key = fair_repro_key(100 + t, i, [9_u8; 32]);
                let _ = limiter.try_reserve_recovery(key, (1_000 + (i % 4) * 500) as usize);
                beat.fetch_add(1, Ordering::Relaxed);
                std::thread::sleep(std::time::Duration::from_micros(500));
            }
        }));
    }
    // 2 snapshot drivers (the diagnostics route cadence)
    for _ in 0..2 {
        let limiter = Arc::clone(&limiter);
        let stop = Arc::clone(&stop);
        let beat = Arc::clone(&heartbeat[3]);
        handles.push(std::thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                let _ = limiter.snapshot();
                beat.fetch_add(1, Ordering::Relaxed);
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }));
    }
    // Watchdog: any op class stalling > 10s while others still beat
    // (or all stalling with the process alive) is the wedge.
    let mut last: Vec<u64> = heartbeat.iter().map(|h| h.load(Ordering::Relaxed)).collect();
    let mut stalled_for_secs = 0_u64;
    let mut wedged = false;
    for tick in 0..seconds {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let now: Vec<u64> = heartbeat.iter().map(|h| h.load(Ordering::Relaxed)).collect();
        let all_stalled = now.iter().zip(&last).all(|(n, l)| n == l);
        let any_stalled = now.iter().zip(&last).any(|(n, l)| n == l);
        if all_stalled || (any_stalled && tick > 5) {
            stalled_for_secs += 1;
        } else {
            stalled_for_secs = 0;
        }
        if stalled_for_secs >= 10 {
            wedged = true;
            eprintln!(
                "WEDGE: ops stalled 10s; counts {:?} -> {:?}",
                last, now
            );
            // Dump every thread's userspace stack via gdb attach: the
            // stuck threads identify the holder and the waiters. The
            // debugger itself runs under an external `timeout` (review
            // correction 3) — a wedged gdb must not stall the failure
            // exit that follows it.
            let pid = std::process::id().to_string();
            let out = std::process::Command::new("timeout")
                .args(["10", "gdb", "-p", &pid, "-batch",
                       "-ex", "set pagination off",
                       "-ex", "thread apply all bt 8"])
                .output();
            if let Ok(out) = out {
                eprintln!("{}", String::from_utf8_lossy(&out.stderr));
                eprintln!("{}", String::from_utf8_lossy(&out.stdout));
            }
            // Bounded failure (independent review finding 1): the wedged
            // workers may never observe `stop`, so joining them can hang
            // forever before the assertion runs. Exit the PROCESS with a
            // nonzero status instead — the test binary's exit code is the
            // reliable, externally-bounded failure signal for CI.
            eprintln!(
                "E1-CONCURRENCY-001 reproduced: {:?} stalled 10s at share={}; exiting nonzero",
                OPS, share
            );
            std::process::exit(1);
        }
        last = now;
    }
    stop.store(true, Ordering::Relaxed);
    // Only non-wedged runs reach here; a generous join bound still guards
    // against unrelated slow shutdowns so the test stays CI-bounded.
    for h in handles {
        let _ = h.join();
    }
    let final_counts: Vec<u64> =
        heartbeat.iter().map(|h| h.load(Ordering::Relaxed)).collect();
    eprintln!("final op counts {:?} (share={}): {:?}", OPS, share, final_counts);
    assert!(
        !wedged,
        "E1-CONCURRENCY-001 reproduced: {:?} stalled 10s at share={}",
        OPS, share
    );
}

fn fair_repro_key(thread: u64, seq: u64, scope: [u8; 32]) -> RecoveryIntentKey {
    let mut identity = [0_u8; 32];
    identity[..8].copy_from_slice(&(thread.wrapping_mul(1_000_003) ^ seq).to_le_bytes());
    let mut operation = [0_u8; 32];
    operation[..8].copy_from_slice(&seq.to_le_bytes());
    RecoveryIntentKey {
        peer: identity,
        scope,
        family: identity,
        operation,
    }
}
