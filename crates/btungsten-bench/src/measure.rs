//! Measured subprocesses.
//!
//! Each run starts the child in its own process group, sends its stdout and
//! stderr to files (kept as evidence), and reaps it with `wait4`, which
//! returns the child's resource usage: user and system CPU time and peak
//! resident set size, for the child and every descendant it waited for (a
//! `cargo` build includes its `rustc` processes). Wall time is measured
//! around spawn and reap with a monotonic clock.
//!
//! Peak memory has a floor. Linux carries the spawning process's own peak
//! resident set into each child at exec (`exec_mmap` folds the old address
//! space's high-water mark into the child's `maxrss`), so `ru_maxrss` is at
//! least this harness's own peak at the moment of the spawn: a 300 MB
//! parent's `/bin/true` reports about 300 MB (fork+exec and `posix_spawn`
//! alike, measured 2026-10-09). The harness reads its own high-water mark
//! right after each spawn returns; a child's peak is reported only when
//! `ru_maxrss` exceeds it, and is otherwise recorded as unresolved, with
//! both numbers, rather than as the harness's peak under the child's name.
//!
//! A run that outlives its budget is killed with its whole process group and
//! reported as `Exit::Budget`, never as a result. A run given a memory
//! budget has its process group's resident memory sampled every 250 ms (the
//! sampled peak is recorded) and is killed as `Exit::Memory` when the group
//! exceeds it: a runaway verifier is stopped with its reason recorded,
//! instead of exhausting the host. Off Unix there is no `wait4`; CPU time
//! and peak memory are then recorded as unavailable.

use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

#[derive(Clone, Debug)]
pub struct Spec {
    pub argv: Vec<String>,
    pub cwd: PathBuf,
    pub env: Vec<(String, String)>,
    pub budget: Duration,
    pub stdout: PathBuf,
    pub stderr: PathBuf,
    /// Resident-memory budget for the whole process group, in KiB.
    pub mem_limit_kib: Option<u64>,
}

impl Spec {
    pub fn new(argv: &[&str], cwd: &Path, budget: Duration, log_stem: &Path) -> Spec {
        Spec {
            argv: argv.iter().map(|s| s.to_string()).collect(),
            cwd: cwd.to_path_buf(),
            env: Vec::new(),
            budget,
            stdout: log_stem.with_extension("stdout"),
            stderr: log_stem.with_extension("stderr"),
            mem_limit_kib: None,
        }
    }

    pub fn mem_limit_gib(mut self, gib: u64) -> Spec {
        self.mem_limit_kib = Some(gib * 1024 * 1024);
        self
    }

    pub fn env(mut self, k: &str, v: &str) -> Spec {
        self.env.push((k.to_string(), v.to_string()));
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Exit {
    Code(i32),
    Signal(i32),
    /// Killed by this harness after the budget ran out.
    Budget,
    /// Killed by this harness when its process group's resident memory
    /// passed the memory budget (the sampled group total, KiB).
    Memory(u64),
}

impl Exit {
    pub fn json(&self) -> Value {
        match self {
            Exit::Code(c) => json!({ "code": c }),
            Exit::Signal(s) => json!({ "signal": s }),
            Exit::Budget => json!({ "killed": "budget exhausted" }),
            Exit::Memory(kib) => {
                json!({ "killed": "memory budget exceeded", "group_rss_kib": kib })
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct Obs {
    pub argv: Vec<String>,
    pub wall_ns: u64,
    pub user_us: Option<u64>,
    pub sys_us: Option<u64>,
    /// The child tree's peak resident memory, only when `ru_maxrss` exceeds
    /// the harness's own peak at the spawn (see the module notes).
    pub max_rss_kib: Option<u64>,
    /// `ru_maxrss` from `wait4` as the kernel reported it (Linux only).
    pub ru_maxrss_kib: Option<u64>,
    /// This harness's own peak resident memory, read right after the spawn
    /// returned: a floor under `ru_maxrss_kib` (Linux only).
    pub rss_floor_kib: Option<u64>,
    /// Peak resident memory of the process group, sampled every 250 ms;
    /// only for runs with a memory budget.
    pub group_rss_peak_kib: Option<u64>,
    pub budget_ms: u64,
    pub exit: Exit,
    pub stdout: PathBuf,
    pub stderr: PathBuf,
}

impl Obs {
    pub fn ok(&self) -> bool {
        self.exit == Exit::Code(0)
    }

    pub fn stdout_text(&self) -> String {
        String::from_utf8_lossy(&std::fs::read(&self.stdout).unwrap_or_default()).into_owned()
    }

    pub fn stderr_text(&self) -> String {
        String::from_utf8_lossy(&std::fs::read(&self.stderr).unwrap_or_default()).into_owned()
    }

    /// The observation as a receipt row; log paths are relative to `base`.
    pub fn json(&self, base: &Path) -> Value {
        let rel = |p: &Path| p.strip_prefix(base).unwrap_or(p).display().to_string();
        let na = |v: Option<u64>| v.map_or(json!("unavailable"), |x| json!(x));
        let peak = match (self.max_rss_kib, self.ru_maxrss_kib, self.rss_floor_kib) {
            (Some(v), _, _) => json!(v),
            (None, Some(raw), Some(floor)) => json!(format!(
                "unresolved: at most {raw} KiB (ru_maxrss {raw} KiB does not exceed this harness's own peak, {floor} KiB, which Linux carries into each child at exec)"
            )),
            _ => json!("unavailable"),
        };
        json!({
            "argv": self.argv,
            "wall_ns": self.wall_ns,
            "user_cpu_us": na(self.user_us),
            "sys_cpu_us": na(self.sys_us),
            "max_rss_kib": peak,
            "ru_maxrss_kib": na(self.ru_maxrss_kib),
            "harness_rss_hwm_kib_after_spawn": na(self.rss_floor_kib),
            "group_rss_peak_kib_sampled": self.group_rss_peak_kib,
            "budget_ms": self.budget_ms,
            "exit": self.exit.json(),
            "stdout": rel(&self.stdout),
            "stderr": rel(&self.stderr),
        })
    }
}

/// A started child: reap it with `wait`, or kill its group first with `kill`.
pub struct Running {
    pid: u32,
    started: Instant,
    budget: Duration,
    spec: Spec,
    rss_floor_kib: Option<u64>,
    #[cfg(unix)]
    rx: std::sync::mpsc::Receiver<(i32, libc::rusage, Instant)>,
    #[cfg(not(unix))]
    child: std::process::Child,
}

pub fn spawn(spec: &Spec) -> std::io::Result<Running> {
    let (prog, args) = spec.argv.split_first().expect("argv is never empty");
    let mut cmd = Command::new(prog);
    cmd.args(args)
        .current_dir(&spec.cwd)
        .stdin(Stdio::null())
        .stdout(File::create(&spec.stdout)?)
        .stderr(File::create(&spec.stderr)?)
        // logs are evidence: no colour escapes in them (a Spec may override)
        .env("CARGO_TERM_COLOR", "never");
    for (k, v) in &spec.env {
        cmd.env(k, v);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    let started = Instant::now();
    let child = cmd.spawn().map_err(|e| {
        std::io::Error::new(
            e.kind(),
            format!(
                "cannot start `{}` in {}: {e}",
                spec.argv.join(" "),
                spec.cwd.display()
            ),
        )
    })?;
    let pid = child.id();
    // `spawn` returns once the child has exec'd, and a high-water mark only
    // rises, so this bounds the peak the kernel carried into the child
    let rss_floor_kib = own_peak_rss_kib();
    #[cfg(unix)]
    {
        // `child` is never waited on through std: the reaper thread owns it.
        drop(child);
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut status = 0;
            // SAFETY: rusage is plain old data; wait4 fills it.
            let mut ru: libc::rusage = unsafe { std::mem::zeroed() };
            loop {
                // SAFETY: pid is our own child; status and ru are valid pointers.
                let r = unsafe { libc::wait4(pid as libc::pid_t, &mut status, 0, &mut ru) };
                if r == pid as libc::pid_t {
                    break;
                }
                if r == -1
                    && std::io::Error::last_os_error().kind() == std::io::ErrorKind::Interrupted
                {
                    continue;
                }
                status = -1;
                break;
            }
            let _ = tx.send((status, ru, Instant::now()));
        });
        Ok(Running {
            pid,
            started,
            budget: spec.budget,
            spec: spec.clone(),
            rss_floor_kib,
            rx,
        })
    }
    #[cfg(not(unix))]
    {
        Ok(Running {
            pid,
            started,
            budget: spec.budget,
            spec: spec.clone(),
            rss_floor_kib,
            child,
        })
    }
}

impl Running {
    pub fn pid(&self) -> u32 {
        self.pid
    }

    /// Kill the child's whole process group now (an injected fault).
    pub fn kill(&mut self) {
        #[cfg(unix)]
        {
            // SAFETY: a negative pid names the process group this child leads.
            unsafe {
                libc::kill(-(self.pid as libc::pid_t), libc::SIGKILL);
                // and the child itself, in case it left its group
                libc::kill(self.pid as libc::pid_t, libc::SIGKILL);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = self.child.kill();
        }
    }

    #[cfg(unix)]
    pub fn wait(self) -> Obs {
        let deadline = self.started + self.budget;
        let limit = self.spec.mem_limit_kib;
        let mut peak: Option<u64> = None;
        let mut killed: Option<Exit> = None;
        let (status, ru, ended) = loop {
            let left = deadline.saturating_duration_since(Instant::now());
            let tick = if limit.is_some() {
                left.min(Duration::from_millis(250))
            } else {
                left
            };
            match self.rx.recv_timeout(tick) {
                Ok(r) => break r,
                Err(_) => {
                    if let Some(lim) = limit {
                        let now = group_rss_kib(self.pid);
                        peak = Some(peak.unwrap_or(0).max(now));
                        if now > lim {
                            killed = Some(Exit::Memory(now));
                        }
                    }
                    if killed.is_none() && Instant::now() >= deadline {
                        killed = Some(Exit::Budget);
                    }
                    if killed.is_some() {
                        // SAFETY: as in `kill`.
                        unsafe {
                            libc::kill(-(self.pid as libc::pid_t), libc::SIGKILL);
                            // and the child itself, in case it left its group
                            libc::kill(self.pid as libc::pid_t, libc::SIGKILL);
                        }
                        break self.rx.recv().expect("the reaper always reports");
                    }
                }
            }
        };
        // Anything the child left running in its group goes with it.
        // SAFETY: as in `kill`; ESRCH (no such group) is the normal case.
        unsafe {
            libc::kill(-(self.pid as libc::pid_t), libc::SIGKILL);
        }
        let tv = |t: libc::timeval| (t.tv_sec as u64) * 1_000_000 + t.tv_usec as u64;
        // ru_maxrss is KiB on Linux only (macOS reports bytes)
        let ru_maxrss_kib = cfg!(target_os = "linux").then_some(ru.ru_maxrss as u64);
        let exit = if let Some(k) = killed {
            k
        } else if libc::WIFEXITED(status) {
            Exit::Code(libc::WEXITSTATUS(status))
        } else if libc::WIFSIGNALED(status) {
            Exit::Signal(libc::WTERMSIG(status))
        } else {
            Exit::Code(-1)
        };
        Obs {
            argv: self.spec.argv.clone(),
            wall_ns: ended.duration_since(self.started).as_nanos() as u64,
            user_us: Some(tv(ru.ru_utime)),
            sys_us: Some(tv(ru.ru_stime)),
            max_rss_kib: resolved_peak(ru_maxrss_kib, self.rss_floor_kib),
            ru_maxrss_kib,
            rss_floor_kib: self.rss_floor_kib,
            group_rss_peak_kib: peak,
            budget_ms: self.budget.as_millis() as u64,
            exit,
            stdout: self.spec.stdout.clone(),
            stderr: self.spec.stderr.clone(),
        }
    }

    #[cfg(not(unix))]
    pub fn wait(mut self) -> Obs {
        let deadline = self.started + self.budget;
        let exit = loop {
            match self.child.try_wait() {
                Ok(Some(s)) => break Exit::Code(s.code().unwrap_or(-1)),
                Ok(None) if Instant::now() >= deadline => {
                    let _ = self.child.kill();
                    let _ = self.child.wait();
                    break Exit::Budget;
                }
                Ok(None) => std::thread::sleep(Duration::from_millis(2)),
                Err(_) => break Exit::Code(-1),
            }
        };
        Obs {
            argv: self.spec.argv.clone(),
            wall_ns: self.started.elapsed().as_nanos() as u64,
            user_us: None,
            sys_us: None,
            max_rss_kib: None,
            ru_maxrss_kib: None,
            rss_floor_kib: self.rss_floor_kib,
            group_rss_peak_kib: None,
            budget_ms: self.budget.as_millis() as u64,
            exit,
            stdout: self.spec.stdout.clone(),
            stderr: self.spec.stderr.clone(),
        }
    }
}

/// Resident memory of every process in process group `pgid`, in KiB, from
/// /proc/<pid>/stat (field 5 is the group, field 24 the resident pages).
#[cfg(unix)]
fn group_rss_kib(pgid: u32) -> u64 {
    // SAFETY: sysconf has no preconditions.
    let page = unsafe { libc::sysconf(libc::_SC_PAGESIZE) }.max(4096) as u64;
    let mut total = 0;
    for e in std::fs::read_dir("/proc").into_iter().flatten().flatten() {
        let Ok(stat) = std::fs::read_to_string(e.path().join("stat")) else {
            continue;
        };
        // the fields after the parenthesized command name, which may hold spaces
        let Some((_, rest)) = stat.rsplit_once(')') else {
            continue;
        };
        let f: Vec<&str> = rest.split_whitespace().collect();
        if f.get(2).and_then(|g| g.parse::<u32>().ok()) == Some(pgid) {
            total += f.get(21).and_then(|r| r.parse::<u64>().ok()).unwrap_or(0) * page / 1024;
        }
    }
    total
}

/// This process's own peak resident memory (`VmHWM`), KiB; Linux only.
fn own_peak_rss_kib() -> Option<u64> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let status = std::fs::read_to_string("/proc/self/status").ok()?;
    let line = status.lines().find(|l| l.starts_with("VmHWM:"))?;
    line.split_whitespace().nth(1)?.parse().ok()
}

/// A child's `ru_maxrss` names the child's own peak only above the floor the
/// kernel carried in from this harness.
fn resolved_peak(ru_maxrss_kib: Option<u64>, floor_kib: Option<u64>) -> Option<u64> {
    match (ru_maxrss_kib, floor_kib) {
        (Some(raw), Some(floor)) if raw > floor => Some(raw),
        _ => None,
    }
}

/// Peak-memory summary over a set of runs: the resolved peaks, and how many
/// runs left theirs unresolved under the harness's own peak.
pub fn rss_summary<'a>(runs: impl IntoIterator<Item = &'a Obs>) -> Value {
    let runs: Vec<&Obs> = runs.into_iter().collect();
    let mut v = crate::stats::summary(
        &runs
            .iter()
            .filter_map(|o| o.max_rss_kib)
            .collect::<Vec<_>>(),
    );
    let unresolved = runs
        .iter()
        .filter(|o| o.max_rss_kib.is_none() && o.ru_maxrss_kib.is_some())
        .count();
    if unresolved > 0 {
        v["unresolved_runs"] = json!(unresolved);
        v["unresolved_note"] = json!("ru_maxrss did not exceed this harness's own peak; each run's record keeps both numbers");
    }
    v
}

pub fn run(spec: &Spec) -> std::io::Result<Obs> {
    Ok(spawn(spec)?.wait())
}

/// Run a command for its output only (identity queries such as `rustc -vV`);
/// not measured. `None` if it could not start or did not exit 0.
pub fn output(argv: &[&str], cwd: &Path) -> Option<String> {
    output_env(argv, cwd, &[])
}

/// As `output`, with extra environment: SAW refuses to start, even for
/// `--version`, without z3 on its PATH, so a bundle's identity is read with
/// the bundle's PATH.
pub fn output_env(argv: &[&str], cwd: &Path, env: &[(&str, &str)]) -> Option<String> {
    let (prog, args) = argv.split_first()?;
    let mut cmd = Command::new(prog);
    cmd.args(args).current_dir(cwd).stdin(Stdio::null());
    for (k, v) in env {
        cmd.env(k, v);
    }
    // no query may hang the harness: ten minutes, then the child is killed
    // and the query answers None
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let (mut so, mut se) = (child.stdout.take()?, child.stderr.take()?);
    let reader_o = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = std::io::Read::read_to_end(&mut so, &mut b);
        b
    });
    let reader_e = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = std::io::Read::read_to_end(&mut se, &mut b);
        b
    });
    let deadline = Instant::now() + Duration::from_secs(600);
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    };
    let out = reader_o.join().unwrap_or_default();
    let err = reader_e.join().unwrap_or_default();
    // `saw --version` writes to stderr; an identity query reads whichever
    // stream carries the text
    let text = if out.is_empty() { &err } else { &out };
    status
        .success()
        .then(|| String::from_utf8_lossy(text).into_owned())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("rbench-measure-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn exit_codes_cpu_and_logs_are_observed() {
        let d = tmp("exit");
        let o = run(&Spec::new(
            &["sh", "-c", "echo out; echo err >&2; exit 3"],
            &d,
            Duration::from_secs(10),
            &d.join("a"),
        ))
        .unwrap();
        assert_eq!(o.exit, Exit::Code(3));
        assert_eq!(o.stdout_text(), "out\n");
        assert_eq!(o.stderr_text(), "err\n");
        assert!(o.user_us.is_some() && o.ru_maxrss_kib.unwrap() > 0);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn a_child_smaller_than_the_harness_has_no_peak_reported_under_its_name() {
        let d = tmp("floor");
        // this process now peaks above 64 MiB; a shell that exits at once
        // peaks at a few MiB, but the kernel reports at least our peak
        let ballast = vec![1u8; 64 << 20];
        let o = run(&Spec::new(
            &["sh", "-c", "exit 0"],
            &d,
            Duration::from_secs(10),
            &d.join("f"),
        ))
        .unwrap();
        std::hint::black_box(&ballast);
        let floor = o.rss_floor_kib.unwrap();
        assert!(floor >= 64 * 1024, "{floor}");
        assert!(
            o.ru_maxrss_kib.unwrap() >= 60 * 1024,
            "{:?}",
            o.ru_maxrss_kib
        );
        assert_eq!(o.max_rss_kib, None);
        assert!(o.json(&d)["max_rss_kib"]
            .as_str()
            .unwrap()
            .starts_with("unresolved: at most"));
        assert_eq!(rss_summary([&o])["unresolved_runs"], 1);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn a_child_larger_than_the_harness_has_its_own_peak_reported() {
        let d = tmp("peak");
        // ~300 MB held in a shell variable: above anything this test binary holds
        let o = run(&Spec::new(
            &[
                "sh",
                "-c",
                "x=$(head -c 300000000 /dev/zero | tr '\\0' a); echo ${#x}",
            ],
            &d,
            Duration::from_secs(60),
            &d.join("p"),
        ))
        .unwrap();
        assert!(o.ok());
        let peak = o.max_rss_kib.unwrap();
        assert!(
            peak > 250 * 1024 && peak > o.rss_floor_kib.unwrap(),
            "{peak}"
        );
        assert_eq!(o.json(&d)["max_rss_kib"], peak);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn a_run_past_its_budget_is_killed_with_its_group_and_never_a_result() {
        let d = tmp("budget");
        // the grandchild sleep would outlive a kill of the shell alone
        let t = Instant::now();
        let o = run(&Spec::new(
            &["sh", "-c", "sleep 30 & wait"],
            &d,
            Duration::from_millis(300),
            &d.join("b"),
        ))
        .unwrap();
        assert_eq!(o.exit, Exit::Budget);
        assert!(t.elapsed() < Duration::from_secs(10));
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn a_group_past_its_memory_budget_is_killed_and_says_so() {
        let d = tmp("memory");
        // a shell that keeps ~200 MB in a variable through the whole sleep, so
        // the 250 ms sampler cannot miss it (a head|tail pipeline that held its
        // bytes only for a moment passed unseen on a fast CI runner)
        let mut spec = Spec::new(
            &[
                "sh",
                "-c",
                "x=$(head -c 200000000 /dev/zero | tr '\\0' a); sleep 30; echo ${#x}",
            ],
            &d,
            Duration::from_secs(60),
            &d.join("m"),
        );
        spec.mem_limit_kib = Some(100 * 1024);
        let o = run(&spec).unwrap();
        assert!(
            matches!(o.exit, Exit::Memory(k) if k > 100 * 1024),
            "{:?}",
            o.exit
        );
        assert!(o.group_rss_peak_kib.unwrap() > 100 * 1024);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn a_signal_death_is_reported_as_a_signal() {
        let d = tmp("signal");
        let o = run(&Spec::new(
            &["sh", "-c", "kill -9 $$"],
            &d,
            Duration::from_secs(10),
            &d.join("c"),
        ))
        .unwrap();
        assert_eq!(o.exit, Exit::Signal(9));
        let _ = std::fs::remove_dir_all(&d);
    }
}
