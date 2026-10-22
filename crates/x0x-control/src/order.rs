//! Order, policy and receipt shapes. Pure data; no IO lives here.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// One scoped command order. `argv` is executed without a shell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub scope: String,
    pub argv: Vec<String>,
    #[serde(default)]
    pub stdin: Option<String>,
    pub issued_by: String,
    pub nonce: String,
    /// Execution timeout in seconds; 0 selects the 30s default.
    /// Probes share the same bound. No order runs unbounded.
    #[serde(default)]
    pub timeout_secs: u64,
    /// Unix seconds; orders at or past this instant are refused.
    pub expires_at: u64,
    #[serde(default)]
    pub pre: Vec<Probe>,
    #[serde(default)]
    pub post: Vec<Probe>,
}

/// A state probe: run argv, require the exit code, optionally require
/// a substring in stdout. Probe stdout is fingerprinted into the
/// receipt so before/after state is comparable byte-for-byte.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Probe {
    pub argv: Vec<String>,
    #[serde(default)]
    pub expect_exit: i32,
    #[serde(default)]
    pub stdout_contains: Option<String>,
}

/// One allowed command shape inside a scope. Matching is exact on
/// argv[0]; every later argument must start with one of
/// `arg_prefixes` (empty list = any arguments, still capped).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRule {
    pub argv0: String,
    #[serde(default)]
    pub max_args: usize,
    #[serde(default)]
    pub arg_prefixes: Vec<String>,
}

impl CommandRule {
    pub fn allows(&self, argv: &[String]) -> bool {
        if argv.is_empty() || argv[0] != self.argv0 {
            return false;
        }
        let args = &argv[1..];
        if args.len() > self.max_args {
            return false;
        }
        if self.arg_prefixes.is_empty() {
            return true;
        }
        args.iter()
            .all(|a| self.arg_prefixes.iter().any(|p| a.starts_with(p.as_str())))
    }
}

/// Scope policy, loaded from JSON. Unknown scope means deny.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Policy {
    pub scopes: BTreeMap<String, Vec<CommandRule>>,
}

impl Policy {
    pub fn allows(&self, scope: &str, argv: &[String]) -> bool {
        match self.scopes.get(scope) {
            Some(rules) => rules.iter().any(|r| r.allows(argv)),
            None => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeResult {
    pub argv: Vec<String>,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    /// SHA3-256 hex of the exact stdout bytes.
    pub stdout_sha3: String,
    /// True when stdout exceeded the capture cap and was truncated.
    #[serde(default)]
    pub stdout_truncated: bool,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub argv: Vec<String>,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    /// True when the command was killed at the order timeout.
    #[serde(default)]
    pub timed_out: bool,
    #[serde(default)]
    pub stdout_truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Completed,
    RefusedScope,
    RefusedExpired,
    RefusedMalformed,
    PreStateFailed,
    PostStateFailed,
}

/// The full verbatim receipt returned for every order, refused or run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    pub order_id: String,
    pub scope: String,
    pub verdict: Verdict,
    pub detail: String,
    pub pre_state: Vec<ProbeResult>,
    pub exec: Option<ExecResult>,
    pub post_state: Vec<ProbeResult>,
    /// SHA3-256 hex of the KEM ciphertext that carried this order.
    pub envelope_sha3: String,
    pub served_at: u64,
}
