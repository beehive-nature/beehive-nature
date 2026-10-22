//! Scoped execution with before/after state verification.
//! Nothing here spawns a shell: argv goes straight to the OS.
//!
//! Hardening (self-review, 2026-10-20):
//! - Probe argv is scope-checked exactly like the order argv. A probe
//!   is code execution; unchecked probes would be a scope escape.
//! - Every run is time-bounded (order timeout, 30s default) and
//!   output-capped; truncation is flagged in the receipt, and the
//!   SHA3 fingerprint covers the full captured stream pre-truncation
//!   is NOT claimed — it covers what the receipt carries, stated so.

use sha3::{Digest, Sha3_256};
use std::collections::HashSet;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::envelope::SealedEnvelope;
use crate::order::{ExecResult, Order, Policy, Probe, ProbeResult, Receipt, Verdict};

pub struct ExecOutcome {
    pub receipt: Receipt,
    /// 0 completed, 2 refused, 3 state-probe failure.
    pub exit_code: i32,
}

/// Per-stream capture cap. Receipts are verbatim within it; beyond
/// it the stream truncates and the receipt flags the truncation.
pub const MAX_CAPTURE: usize = 1 << 20;
pub const MAX_STDIN: usize = 64 << 10;
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;

pub fn sha3_hex(data: &[u8]) -> String {
    let mut h = Sha3_256::new();
    h.update(data);
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

struct RunOut {
    code: Option<i32>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    stdout_truncated: bool,
    timed_out: bool,
}

fn capped(mut data: Vec<u8>) -> (Vec<u8>, bool) {
    if data.len() > MAX_CAPTURE {
        data.truncate(MAX_CAPTURE);
        (data, true)
    } else {
        (data, false)
    }
}

fn run_argv(argv: &[String], stdin: Option<&str>, timeout_secs: u64) -> Result<RunOut, String> {
    if argv.is_empty() {
        return Err("empty argv".to_string());
    }
    if let Some(text) = stdin {
        if text.len() > MAX_STDIN {
            return Err("stdin exceeds capture cap".to_string());
        }
    }
    let timeout = if timeout_secs == 0 {
        DEFAULT_TIMEOUT_SECS
    } else {
        timeout_secs
    };
    let mut cmd = Command::new(&argv[0]);
    cmd.args(&argv[1..])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if stdin.is_some() {
        cmd.stdin(Stdio::piped());
    } else {
        // Never inherit the agent's stdin: a scoped child must not
        // consume the control channel or block on the operator tty.
        cmd.stdin(Stdio::null());
    }
    let mut child = cmd.spawn().map_err(|e| format!("spawn {}: {e}", argv[0]))?;
    if let Some(text) = stdin {
        if let Some(mut pipe) = child.stdin.take() {
            let _ = pipe.write_all(text.as_bytes());
        }
    }
    let deadline = Instant::now() + std::time::Duration::from_secs(timeout);
    let mut timed_out = false;
    let code = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s.code(),
            Ok(None) => {
                if Instant::now() >= deadline {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break None;
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Err(e) => return Err(e.to_string()),
        }
    };
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    if let Some(mut p) = child.stdout.take() {
        let _ = p.read_to_end(&mut stdout);
    }
    if let Some(mut p) = child.stderr.take() {
        let _ = p.read_to_end(&mut stderr);
    }
    let (stdout, stdout_truncated) = capped(stdout);
    let (stderr, _) = capped(stderr);
    Ok(RunOut {
        code,
        stdout,
        stderr,
        stdout_truncated,
        timed_out,
    })
}

fn run_probe(p: &Probe, timeout_secs: u64) -> ProbeResult {
    match run_argv(&p.argv, None, timeout_secs) {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout).into_owned();
            let passed = !out.timed_out
                && out.code == Some(p.expect_exit)
                && p.stdout_contains
                    .as_ref()
                    .map(|needle| text.contains(needle.as_str()))
                    .unwrap_or(true);
            ProbeResult {
                argv: p.argv.clone(),
                exit_code: out.code,
                stdout_sha3: sha3_hex(&out.stdout),
                stdout: text,
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                stdout_truncated: out.stdout_truncated,
                passed,
            }
        }
        Err(e) => ProbeResult {
            argv: p.argv.clone(),
            exit_code: None,
            stdout: String::new(),
            stderr: e,
            stdout_sha3: sha3_hex(&[]),
            stdout_truncated: false,
            passed: false,
        },
    }
}

/// Execute one opened order under policy. `seen_nonces` is the
/// caller's replay ledger; a nonce already present refuses the order.
/// Callers that persist the ledger must write the nonce BEFORE
/// calling (write-ahead), so a crash cannot re-serve an order.
pub fn execute_order(
    order: &Order,
    policy: &Policy,
    envelope: &SealedEnvelope,
    seen_nonces: &mut HashSet<String>,
) -> ExecOutcome {
    let envelope_sha3 = sha3_hex(envelope.cipher_b64.as_bytes());
    let base = |verdict: Verdict, detail: &str| Receipt {
        order_id: order.id.clone(),
        scope: order.scope.clone(),
        verdict,
        detail: detail.to_string(),
        pre_state: Vec::new(),
        exec: None,
        post_state: Vec::new(),
        envelope_sha3: envelope_sha3.clone(),
        served_at: now_secs(),
    };

    if now_secs() >= order.expires_at {
        return ExecOutcome {
            receipt: base(Verdict::RefusedExpired, "order expired before service"),
            exit_code: 2,
        };
    }
    if seen_nonces.contains(&order.nonce) {
        return ExecOutcome {
            receipt: base(Verdict::RefusedReplay, "nonce already served (replay)"),
            exit_code: 2,
        };
    }
    if !policy.allows(&order.scope, &order.argv) {
        return ExecOutcome {
            receipt: base(Verdict::RefusedScope, "argv not allowed in scope"),
            exit_code: 2,
        };
    }
    // Probes execute too: every probe argv must be inside the scope.
    let probes_scoped = order
        .pre
        .iter()
        .chain(order.post.iter())
        .all(|p| policy.allows(&order.scope, &p.argv));
    if !probes_scoped {
        return ExecOutcome {
            receipt: base(Verdict::RefusedScope, "probe argv not allowed in scope"),
            exit_code: 2,
        };
    }
    seen_nonces.insert(order.nonce.clone());

    let pre_state: Vec<ProbeResult> = order
        .pre
        .iter()
        .map(|p| run_probe(p, order.timeout_secs))
        .collect();
    if pre_state.iter().any(|p| !p.passed) {
        let mut r = base(
            Verdict::PreStateFailed,
            "pre-state probe failed; order not run",
        );
        r.pre_state = pre_state;
        return ExecOutcome {
            receipt: r,
            exit_code: 3,
        };
    }

    let exec = match run_argv(&order.argv, order.stdin.as_deref(), order.timeout_secs) {
        Ok(out) => ExecResult {
            argv: order.argv.clone(),
            exit_code: out.code,
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
            timed_out: out.timed_out,
            stdout_truncated: out.stdout_truncated,
        },
        Err(e) => ExecResult {
            argv: order.argv.clone(),
            exit_code: None,
            stdout: String::new(),
            stderr: e,
            timed_out: false,
            stdout_truncated: false,
        },
    };

    let post_state: Vec<ProbeResult> = order
        .post
        .iter()
        .map(|p| run_probe(p, order.timeout_secs))
        .collect();
    let post_ok = post_state.iter().all(|p| p.passed);
    let mut r = base(
        if post_ok {
            Verdict::Completed
        } else {
            Verdict::PostStateFailed
        },
        if post_ok {
            "executed; post-state verified"
        } else {
            "executed; post-state probe failed"
        },
    );
    r.pre_state = pre_state;
    r.exec = Some(exec);
    r.post_state = post_state;
    ExecOutcome {
        receipt: r,
        exit_code: if post_ok { 0 } else { 3 },
    }
}
