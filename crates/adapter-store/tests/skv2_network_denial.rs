//! SKV-2 + NO-SERVER-DB outbound leg: local reads, writes and recovery
//! function WITHOUT network connectivity, and the working process opens no
//! sockets of ANY kind (TCP+UDP, every state) — observed, not assumed (L5).
//!
//! Denial runs a mechanism LADDER, and the receipt names what actually ran:
//! 1. `unshare -rn` — kernel-level: rootless user+network namespace, the
//!    strongest leg. Spawns but dies with EPERM on hosts that restrict
//!    unprivileged user namespaces (GitHub runners:
//!    kernel.apparmor_restrict_unprivileged_userns=1) — the captured reason
//!    lands in the receipt and the ladder falls through.
//! 2. LD_PRELOAD socket-blocker — libc-level: `socket()` for AF_INET/AF_INET6
//!    fails ENETUNREACH in the workload child. An ACTIVE CONTROL proves the
//!    shim is live before the leg counts: a bash /dev/tcp connect under the
//!    shim must fail "unreachable" (a "refused" would mean the shim is
//!    inert and the leg FAILS, not falls through). Boundary named: raw
//!    syscalls or a statically-linked libc bypass this boundary.
//! 3. Observation only (non-Linux hosts): no denial mechanism claimed; the
//!    all-state socket observation + exact replay still must pass.
//!
//! The recovery oracle is the exact deterministic replay of the full op
//! sequence (SKV-1 model; sequential uniquely-identifiable ops, named).

use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
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

/// The active control for the LD_PRELOAD leg: bash's /dev/tcp uses the
/// libc socket() path, so under a live shim the connect must fail
/// "unreachable". A "refused" (or success) means the shim is inert.
fn preload_shim_is_live() -> Result<(), String> {
    let lib = match option_env!("SKV_PRELOAD_BLOCKER") {
        Some(p) => p,
        None => return Err("shim not compiled for this target".into()),
    };
    let out = Command::new("bash")
        .arg("-c")
        .arg("exec 3<>/dev/tcp/127.0.0.1/1")
        .env("LD_PRELOAD", lib)
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("control spawn failed: {e}"))?;
    let mut err = String::from_utf8_lossy(&out.stderr).into_owned();
    if err.len() > 160 {
        err = err.split_off(err.len() - 160);
    }
    if out.status.success() {
        return Err(format!("control CONNECTED (shim inert): {err}"));
    }
    if err.contains("unreachable") {
        Ok(())
    } else {
        Err(format!(
            "control failed without ENETUNREACH (shim inert?): {err}"
        ))
    }
}

struct WorkloadOutcome {
    exited_clean: bool,
    samples: Vec<usize>,
    max_sockets: usize,
    stderr_tail: String,
}

fn run_workload(
    engine: &str,
    dir: &std::path::Path,
    unshare: bool,
    preload: Option<&str>,
) -> WorkloadOutcome {
    let child_path = child_binary();
    let mut cmd = if unshare {
        let mut c = Command::new("unshare");
        c.arg("-rn").arg(&child_path);
        c
    } else {
        Command::new(&child_path)
    };
    cmd.args([
        engine.to_string(),
        dir.to_string_lossy().into_owned(),
        OPS.to_string(),
    ])
    .stderr(Stdio::piped());
    if let Some(lib) = preload {
        cmd.env("LD_PRELOAD", lib);
    }
    let mut child = cmd.spawn().expect("spawn workload child");
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
    let mut stderr_buf = String::new();
    if let Some(mut s) = child.stderr.take() {
        let _ = s.read_to_string(&mut stderr_buf);
    }
    let status = child.wait().expect("wait");
    if stderr_buf.len() > 200 {
        stderr_buf = stderr_buf.split_off(stderr_buf.len() - 200);
    }
    WorkloadOutcome {
        exited_clean: status.success(),
        samples,
        max_sockets,
        stderr_tail: stderr_buf,
    }
}

fn verify(engine: &str, dir: &std::path::Path) -> bool {
    let store = open_named(engine, &dir.join("store")).expect("reopen");
    store.integrity_check().expect("integrity");
    let scanned: HashMap<Vec<u8>, Vec<u8>> = store
        .scan_prefix(b"key-")
        .expect("scan")
        .into_iter()
        .collect();
    scanned == replay_all()
}

fn network_denial(engine: &str) {
    let mut attempts: Vec<String> = Vec::new();
    let blocker = option_env!("SKV_PRELOAD_BLOCKER");

    #[derive(Clone, Copy, Debug)]
    enum Leg {
        KernelNetns,
        LibcPreload,
    }

    let legs: &[Leg] = if cfg!(target_os = "linux") {
        &[Leg::KernelNetns, Leg::LibcPreload]
    } else {
        &[]
    };

    for leg in legs {
        let dir = adapter_store::temp_dir(&format!("skv2-{engine}-{leg:?}"));
        match leg {
            Leg::KernelNetns => {
                let out = run_workload(engine, &dir, true, None);
                if out.exited_clean {
                    finish(engine, &dir, "unshare -rn (kernel netns)", &attempts, out);
                    return;
                }
                attempts.push(format!(
                    "unshare-rn unavailable: {}",
                    out.stderr_tail.trim()
                ));
                let _ = std::fs::remove_dir_all(&dir);
            }
            Leg::LibcPreload => {
                if let Some(lib) = blocker {
                    if let Err(reason) = preload_shim_is_live() {
                        // An inert shim is a harness defect, not a
                        // fall-through: the mechanism was claimed.
                        panic!("SKV2-RECEIPT engine={engine} mechanism=LD_PRELOAD control=INERT ({reason}) verdict=FAIL");
                    }
                    let out = run_workload(engine, &dir, false, Some(lib));
                    if out.exited_clean {
                        finish(
                            engine,
                            &dir,
                            "LD_PRELOAD socket-blocker (libc, AF_INET/AF_INET6 denied; control=active)",
                            &attempts,
                            out,
                        );
                        return;
                    }
                    attempts.push(format!("preload workload died: {}", out.stderr_tail.trim()));
                    let _ = std::fs::remove_dir_all(&dir);
                } else {
                    attempts.push("preload shim not compiled".into());
                }
            }
        }
    }

    // No denial mechanism available (or all unavailable): the observation
    // leg still runs, and the receipt names every failed attempt.
    let dir = adapter_store::temp_dir(&format!("skv2-{engine}-obs"));
    let out = run_workload(engine, &dir, false, None);
    let label = if attempts.is_empty() {
        "none-available (observation only)".to_string()
    } else {
        format!(
            "denial leg NOT RUN [{}]; observation only",
            attempts.join("; ")
        )
    };
    finish(engine, &dir, &label, &attempts, out);
}

fn finish(
    engine: &str,
    dir: &std::path::Path,
    denial: &str,
    attempts: &[String],
    out: WorkloadOutcome,
) {
    let exact = verify(engine, dir);
    let verdict = out.exited_clean && out.max_sockets == 0 && !out.samples.is_empty() && exact;
    println!(
        "SKV2-RECEIPT engine={engine} denial={denial} ops={OPS} exited_clean={} samples={:?} max_sockets_any_state={} exact_replay={} attempts={:?} verdict={}",
        out.exited_clean,
        out.samples,
        out.max_sockets,
        exact,
        attempts,
        if verdict { "PASS" } else { "FAIL" }
    );
    assert!(
        out.exited_clean,
        "workload must complete under network denial"
    );
    assert_eq!(out.max_sockets, 0, "sockets opened by the working child");
    assert!(
        !out.samples.is_empty(),
        "child never observed alive — observation vacuous"
    );
    assert!(
        exact,
        "recovered state differs from the full deterministic replay"
    );
    let _ = std::fs::remove_dir_all(dir);
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
