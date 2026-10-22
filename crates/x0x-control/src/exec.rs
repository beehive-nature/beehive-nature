//! Scoped execution with before/after state verification.
//! Nothing here spawns a shell: argv goes straight to the OS.

use sha3::{Digest, Sha3_256};
use std::collections::HashSet;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::envelope::SealedEnvelope;
use crate::order::{ExecResult, Order, Policy, Probe, ProbeResult, Receipt, Verdict};

pub struct ExecOutcome {
    pub receipt: Receipt,
    /// 0 completed, 2 refused, 3 state-probe failure.
    pub exit_code: i32,
}

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

fn run_argv(
    argv: &[String],
    stdin: Option<&str>,
) -> Result<(Option<i32>, Vec<u8>, Vec<u8>), String> {
    if argv.is_empty() {
        return Err("empty argv".to_string());
    }
    let mut cmd = Command::new(&argv[0]);
    cmd.args(&argv[1..])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if stdin.is_some() {
        cmd.stdin(Stdio::piped());
    }
    let mut child = cmd.spawn().map_err(|e| format!("spawn {}: {e}", argv[0]))?;
    if let Some(text) = stdin {
        if let Some(mut pipe) = child.stdin.take() {
            let _ = pipe.write_all(text.as_bytes());
        }
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    Ok((out.status.code(), out.stdout, out.stderr))
}

fn run_probe(p: &Probe) -> ProbeResult {
    match run_argv(&p.argv, None) {
        Ok((code, stdout, stderr)) => {
            let text = String::from_utf8_lossy(&stdout).into_owned();
            let passed = code == Some(p.expect_exit)
                && p.stdout_contains
                    .as_ref()
                    .map(|needle| text.contains(needle.as_str()))
                    .unwrap_or(true);
            ProbeResult {
                argv: p.argv.clone(),
                exit_code: code,
                stdout_sha3: sha3_hex(&stdout),
                stdout: text,
                stderr: String::from_utf8_lossy(&stderr).into_owned(),
                passed,
            }
        }
        Err(e) => ProbeResult {
            argv: p.argv.clone(),
            exit_code: None,
            stdout: String::new(),
            stderr: e,
            stdout_sha3: sha3_hex(&[]),
            passed: false,
        },
    }
}

/// Execute one opened order under policy. `seen_nonces` is the
/// caller's replay ledger; a nonce already present refuses the order.
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
            receipt: base(Verdict::RefusedMalformed, "nonce already served (replay)"),
            exit_code: 2,
        };
    }
    if !policy.allows(&order.scope, &order.argv) {
        return ExecOutcome {
            receipt: base(Verdict::RefusedScope, "argv not allowed in scope"),
            exit_code: 2,
        };
    }
    seen_nonces.insert(order.nonce.clone());

    let pre_state: Vec<ProbeResult> = order.pre.iter().map(run_probe).collect();
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

    let exec = match run_argv(&order.argv, order.stdin.as_deref()) {
        Ok((code, stdout, stderr)) => ExecResult {
            argv: order.argv.clone(),
            exit_code: code,
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
        },
        Err(e) => ExecResult {
            argv: order.argv.clone(),
            exit_code: None,
            stdout: String::new(),
            stderr: e,
        },
    };

    let post_state: Vec<ProbeResult> = order.post.iter().map(run_probe).collect();
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
