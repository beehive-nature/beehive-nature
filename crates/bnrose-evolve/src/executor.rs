//! The executor's process discipline: one bounded child, owned until it is
//! observed dead.
//!
//! - The child runs with the artifact as its working directory and in
//!   `BNROSE_EVOLVE_ARTIFACT`, stdin closed, stdout and stderr captured
//!   whole up to a cap.
//! - `on_spawned` runs right after spawn (the caller journals the pid).
//! - On timeout, `on_cancel` runs BEFORE the kill (the caller journals the
//!   cancellation intent), then the child is killed and REAPED. This function
//!   returns only after `wait` has returned: a result never exists while its
//!   worker might still be running.
//!
//! Spawn failure is returned as an error; the caller records NOT_RUN.

use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::Refusal;

/// The most bytes of one stream kept as evidence. Past it the stream is still
/// drained (so the child never blocks on a full pipe) but the run is marked
/// as overflowing, which the caller records as DEGRADED, never as PASS.
pub const OUTPUT_CAP: usize = 8 << 20;

pub struct RunOutcome {
    pub pid: u64,
    /// The child's own exit code; `None` when it was killed or died by signal.
    pub code: Option<i64>,
    pub killed: bool,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub overflow: bool,
    pub elapsed_ms: u64,
}

fn drain(mut r: impl Read + Send + 'static) -> std::thread::JoinHandle<(Vec<u8>, bool)> {
    std::thread::spawn(move || {
        let mut kept = Vec::new();
        let mut overflow = false;
        let mut buf = [0u8; 16 << 10];
        loop {
            match r.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let room = OUTPUT_CAP.saturating_sub(kept.len());
                    if n > room {
                        overflow = true;
                    }
                    kept.extend_from_slice(&buf[..n.min(room)]);
                }
            }
        }
        (kept, overflow)
    })
}

pub fn run_bounded(
    program: &Path,
    args: &[String],
    artifact: &Path,
    timeout: Duration,
    on_spawned: &mut dyn FnMut(u64) -> Result<(), Refusal>,
    on_cancel: &mut dyn FnMut() -> Result<(), Refusal>,
) -> Result<RunOutcome, std::io::Error> {
    let started = Instant::now();
    let mut child = Command::new(program)
        .args(args)
        .current_dir(artifact)
        .env("BNROSE_EVOLVE_ARTIFACT", artifact)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let pid = child.id() as u64;
    let out = drain(child.stdout.take().expect("piped stdout"));
    let err = drain(child.stderr.take().expect("piped stderr"));

    // The pid is journaled before anything else may happen. If that write
    // fails the child is still ours: kill and reap it before reporting.
    if let Err(e) = on_spawned(pid) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(std::io::Error::other(format!("journal after spawn: {e}")));
    }

    let mut killed = false;
    let mut nap = Duration::from_millis(1);
    let status = loop {
        if let Some(s) = child.try_wait()? {
            break s;
        }
        if started.elapsed() >= timeout {
            // the intent is durable before the kill; a failed intent write
            // still kills, because an unbounded worker is worse than a gap
            // the recovery report will name
            let intent = on_cancel();
            let _ = child.kill();
            let s = child.wait()?;
            killed = true;
            if let Err(e) = intent {
                return Err(std::io::Error::other(format!("cancel intent: {e}")));
            }
            break s;
        }
        std::thread::sleep(nap);
        nap = (nap * 2).min(Duration::from_millis(20));
    };
    let (stdout, o1) = out.join().unwrap_or_default();
    let (stderr, o2) = err.join().unwrap_or_default();
    Ok(RunOutcome {
        pid,
        code: if killed {
            None
        } else {
            status.code().map(i64::from)
        },
        killed,
        stdout,
        stderr,
        overflow: o1 || o2,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}
