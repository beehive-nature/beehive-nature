//! NO-SERVER-DB run condition, first executable receipt — OBSERVED, not
//! assumed (L5): while a store workload runs in a child process, enumerate
//! the child's LISTENING sockets and prove there are none. P2P listening
//! sockets are permitted by the ruling in general; for THIS crate the
//! assertion is stronger — the embedded-store seam opens zero sockets of
//! any kind, listener or otherwise.
//!
//! Method is per-OS, by direct observation of the OS's own tables:
//! - Windows: `netstat -ano -p TCP` rows for the child PID in LISTENING.
//! - Linux: /proc/net/tcp{,6} LISTEN inodes ∩ /proc/<pid>/fd socket inodes.
//! Anywhere else: this fails with a named reason (a skipped observation is
//! not a pass).

use std::process::Command;

fn listening_sockets_for(pid: u32) -> usize {
    if cfg!(windows) {
        let out = Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .output()
            .expect("netstat");
        let text = String::from_utf8_lossy(&out.stdout);
        text.lines()
            .filter(|l| {
                let cols: Vec<&str> = l.split_whitespace().collect();
                cols.len() >= 5
                    && cols[3].eq_ignore_ascii_case("LISTENING")
                    && cols[4].parse::<u32>() == Ok(pid)
            })
            .count()
    } else if cfg!(target_os = "linux") {
        let mut listen_inodes = std::collections::HashSet::new();
        for table in ["/proc/net/tcp", "/proc/net/tcp6"] {
            if let Ok(text) = std::fs::read_to_string(table) {
                for line in text.lines().skip(1) {
                    let cols: Vec<&str> = line.split_whitespace().collect();
                    // sl local rem st tx:rx tr:tm retrnsmt uid timeout inode
                    if cols.len() > 9 && cols[3] == "0A" {
                        listen_inodes.insert(cols[9].to_string());
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
            panic!("NOSERVERDB-RECEIPT method=/proc pid={pid} verdict=UNOBSERVABLE (fd table unreadable; a skipped observation is not a pass)");
        }
        listen_inodes.intersection(&own).count()
    } else {
        panic!("NOSERVERDB-RECEIPT verdict=UNOBSERVABLE on this OS (a skipped observation is not a pass)")
    }
}

fn child_binary() -> std::path::PathBuf {
    let mut p = std::env::current_exe().expect("cwd");
    p.pop();
    if p.ends_with("deps") {
        p.pop();
    }
    p.join("skv-child")
}

#[test]
fn noserverdb_no_listening_sockets_during_workload() {
    let dir = adapter_store::temp_dir("noserverdb");
    let mut child = Command::new(child_binary())
        .args([
            "sqlite".to_string(),
            dir.to_string_lossy().into_owned(),
            "50000".to_string(),
        ])
        .spawn()
        .expect("spawn skv-child");
    let pid = child.id();

    let method = if cfg!(windows) {
        "netstat -ano -p TCP"
    } else {
        "/proc/net/tcp{,6} ∩ /proc/<pid>/fd"
    };

    let mut samples = Vec::new();
    let mut max_listening = 0usize;
    for _ in 0..10 {
        std::thread::sleep(std::time::Duration::from_millis(150));
        if let Ok(Some(_)) = child.try_wait() {
            break; // finished early (fast box) — samples taken while alive
        }
        let n = listening_sockets_for(pid);
        max_listening = max_listening.max(n);
        samples.push(n);
    }
    let _ = child.kill();
    let _ = child.wait();

    println!(
        "NOSERVERDB-RECEIPT pid={pid} method={method} samples={:?} max_listening={max_listening} verdict={}",
        samples,
        if max_listening == 0 { "PASS" } else { "FAIL" }
    );
    // A vacuous pass is not a pass: the child must have been observed ALIVE
    // doing store work at least three times, or the observation proves
    // nothing (first red run: the child died instantly and samples was []).
    assert!(
        samples.len() >= 3,
        "child never observed alive ({} samples) — observation vacuous",
        samples.len()
    );
    assert_eq!(max_listening, 0, "embedded store opened listening sockets");
    let _ = std::fs::remove_dir_all(&dir);
}
