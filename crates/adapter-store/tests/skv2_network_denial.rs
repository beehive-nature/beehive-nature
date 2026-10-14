//! SKV-2 + NO-SERVER-DB outbound leg: local reads, writes and recovery
//! function WITHOUT network connectivity, and the working process opens no
//! sockets of ANY kind (listening, established or outbound) — observed, not
//! assumed (L5).
//!
//! Denial method is named per platform:
//! - Linux: the child runs under `unshare -rn` — a rootless user+network
//!   namespace whose only interface is a DOWN loopback. There is no network
//!   to reach; the workload must still complete and verify.
//! - Elsewhere (or when unshare is unavailable): the DENIAL leg is NOT RUN
//!   and the receipt says so; the ALL-STATE socket observation leg still
//!   runs and must observe zero sockets attributable to the child.
//!
//! The recovery oracle is the exact deterministic replay of the full,
//! bounded op sequence (the SKV-1 model: sequential, uniquely identifiable
//! ops — the assumption is named, and holds for this child).

use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;

use adapter_store::{corpus_key, corpus_value, open_named};

const OPS: u64 = 2000;

fn child_binary() -> std::path::PathBuf {
    let mut p = std::env::current_exe().expect("cwd");
    p.pop();
    if p.ends_with("deps") {
        p.pop();
    }
    p.join("skv-child")
}

/// All sockets of ANY state (TCP established/listening/time-wait… plus UDP)
/// attributable to `pid`, from the OS's own tables.
fn all_sockets_for(pid: u32) -> usize {
    if cfg!(windows) {
        let mut count = 0usize;
        for proto in ["TCP", "UDP"] {
            if let Ok(out) = Command::new("netstat").args(["-ano", "-p", proto]).output() {
                let text = String::from_utf8_lossy(&out.stdout);
                count += text
                    .lines()
                    .filter(|l| {
                        let cols: Vec<&str> = l.split_whitespace().collect();
                        cols.len() >= 5 && cols[4].parse::<u32>() == Ok(pid)
                    })
                    .count();
            }
        }
        count
    } else if cfg!(target_os = "linux") {
        let mut socket_inodes = std::collections::HashSet::new();
        for table in [
            "/proc/net/tcp",
            "/proc/net/tcp6",
            "/proc/net/udp",
            "/proc/net/udp6",
        ] {
            if let Ok(text) = std::fs::read_to_string(table) {
                for line in text.lines().skip(1) {
                    let cols: Vec<&str> = line.split_whitespace().collect();
                    if cols.len() > 9 {
                        socket_inodes.insert(cols[9].to_string());
                    }
                }
            }
        }
        let fd_dir = format!("/proc/{pid}/fd");
        let mut own = std::collections::HashSet::new();
        if let Ok(entries) = std::fs::read_dir(&fd_dir) {
            for e in entries.flatten() {
                if let Ok(target) = std::fs::read_link(e.path()) {
                    let s = target.to_string_lossy().into_owned();
                    if let Some(inode) =
                        s.strip_prefix("socket:[").and_then(|r| r.strip_suffix(']'))
                    {
                        own.insert(inode.to_string());
                    }
                }
            }
        } else {
            panic!("SKV2-RECEIPT method=/proc pid={pid} verdict=UNOBSERVABLE (fd table unreadable; a skipped observation is not a pass)");
        }
        socket_inodes.intersection(&own).count()
    } else {
        panic!("SKV2-RECEIPT verdict=UNOBSERVABLE on this OS (a skipped observation is not a pass)")
    }
}

fn replay_all() -> HashMap<Vec<u8>, Vec<u8>> {
    let mut state = HashMap::new();
    for i in 0..OPS {
        state.insert(corpus_key(i), corpus_value(i));
        if i >= 64 && i % 8 == 0 {
            state.remove(&corpus_key(i - 64));
        }
    }
    state
}

fn network_denial(engine: &str) {
    let dir = adapter_store::temp_dir(&format!("skv2-{engine}"));

    let child_path = child_binary();
    let mut denial = "none-available";
    let mut cmd = if cfg!(target_os = "linux") {
        let mut c = Command::new("unshare");
        c.arg("-rn").arg(&child_path);
        denial = "unshare -rn (rootless netns, loopback down)";
        c
    } else {
        Command::new(&child_path)
    };
    cmd.args([
        engine.to_string(),
        dir.to_string_lossy().into_owned(),
        OPS.to_string(),
    ]);

    let spawned = cmd.spawn();
    let mut child = match spawned {
        Ok(c) => c,
        Err(_) if cfg!(target_os = "linux") => {
            // unshare unavailable/denied — fall back to a plain child and
            // say so: the denial leg is NOT RUN on this host.
            denial = "unshare-unavailable (denial leg NOT RUN; observation only)";
            Command::new(&child_path)
                .args([
                    engine.to_string(),
                    dir.to_string_lossy().into_owned(),
                    OPS.to_string(),
                ])
                .spawn()
                .expect("plain spawn")
        }
        Err(e) => panic!("spawn failed: {e}"),
    };
    let pid = child.id();

    let mut samples = Vec::new();
    let mut max_sockets = 0usize;
    loop {
        std::thread::sleep(Duration::from_millis(120));
        match child.try_wait().expect("try_wait") {
            Some(_) => break,
            None => {
                let n = all_sockets_for(pid);
                max_sockets = max_sockets.max(n);
                samples.push(n);
            }
        }
    }
    let status = child.wait().expect("wait");
    let exited_clean = status.success();

    let store = open_named(engine, &dir.join("store")).expect("reopen");
    store.integrity_check().expect("integrity");
    let scanned: HashMap<Vec<u8>, Vec<u8>> = store
        .scan_prefix(b"key-")
        .expect("scan")
        .into_iter()
        .collect();
    let expected = replay_all();
    let exact = scanned == expected;

    println!(
        "SKV2-RECEIPT engine={engine} denial={denial} ops={OPS} exited_clean={exited_clean} samples={:?} max_sockets_any_state={max_sockets} exact_replay={exact} integrity=ok verdict={}",
        samples,
        if exact && exited_clean && max_sockets == 0 && !samples.is_empty() {
            "PASS"
        } else {
            "FAIL"
        }
    );
    assert!(exited_clean, "workload must complete under network denial");
    assert_eq!(max_sockets, 0, "sockets opened by the working child");
    assert!(
        !samples.is_empty(),
        "child never observed alive — observation vacuous"
    );
    assert!(
        exact,
        "recovered state differs from the full deterministic replay"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn skv2_sqlite_network_denial() {
    network_denial("sqlite");
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv2_surrealkv_network_denial() {
    network_denial("surrealkv");
}
