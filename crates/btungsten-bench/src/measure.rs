//! Measured subprocesses.
//!
//! Each run starts the child in its own process group, sends its stdout and
//! stderr to files (kept as evidence), and reaps it with `wait4`, which
//! returns the child's resource usage: user and system CPU time and peak
//! resident set size, for the child and every descendant it waited for (a
//! `cargo` build includes its `rustc` processes). Wall time is measured
//! around spawn and reap with a monotonic clock.
//!
//! A run that outlives its budget is killed with its whole process group and
//! reported as `Exit::Budget`, never as a result. Off Unix there is no
//! `wait4`; CPU time and peak memory are then recorded as unavailable.

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
        }
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
}

impl Exit {
    pub fn json(&self) -> Value {
        match self {
            Exit::Code(c) => json!({ "code": c }),
            Exit::Signal(s) => json!({ "signal": s }),
            Exit::Budget => json!({ "killed": "budget exhausted" }),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Obs {
    pub argv: Vec<String>,
    pub wall_ns: u64,
    pub user_us: Option<u64>,
    pub sys_us: Option<u64>,
    pub max_rss_kib: Option<u64>,
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
        json!({
            "argv": self.argv,
            "wall_ns": self.wall_ns,
            "user_cpu_us": na(self.user_us),
            "sys_cpu_us": na(self.sys_us),
            "max_rss_kib": na(self.max_rss_kib),
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
        let left = deadline.saturating_duration_since(Instant::now());
        let (status, ru, ended, killed) = match self.rx.recv_timeout(left) {
            Ok((s, ru, t)) => (s, ru, t, false),
            Err(_) => {
                // SAFETY: as in `kill`.
                unsafe {
                    libc::kill(-(self.pid as libc::pid_t), libc::SIGKILL);
                }
                let (s, ru, t) = self.rx.recv().expect("the reaper always reports");
                (s, ru, t, true)
            }
        };
        // Anything the child left running in its group goes with it.
        // SAFETY: as in `kill`; ESRCH (no such group) is the normal case.
        unsafe {
            libc::kill(-(self.pid as libc::pid_t), libc::SIGKILL);
        }
        let tv = |t: libc::timeval| (t.tv_sec as u64) * 1_000_000 + t.tv_usec as u64;
        let exit = if killed {
            Exit::Budget
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
            max_rss_kib: Some(ru.ru_maxrss as u64),
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
            budget_ms: self.budget.as_millis() as u64,
            exit,
            stdout: self.spec.stdout.clone(),
            stderr: self.spec.stderr.clone(),
        }
    }
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
    let out = cmd.output().ok()?;
    // `saw --version` writes to stderr; an identity query reads whichever
    // stream carries the text
    let text = if out.stdout.is_empty() {
        &out.stderr
    } else {
        &out.stdout
    };
    out.status
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
        assert!(o.user_us.is_some() && o.max_rss_kib.unwrap() > 0);
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
