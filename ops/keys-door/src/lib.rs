//! keys-door — the keychain edge for keys.skaists.dev (contract: the
//! keychain release + edge contract of 2026-10-12, §1-§4 and §7 A1).
//!
//! A keyless resolver, verifier and server. It holds no key and signs
//! nothing. It serves only bytes named by a `bnr.keychain-release/1` record
//! that two independent ML-DSA-65 verifiers accept, that chains from the
//! pinned genesis one seq at a time, and that is at or above the persisted
//! floor. Every source (state, inbox, peer edges, ANT doors, Arweave) is
//! untrusted; bytes are accepted by hash only. What this gives is sound by
//! construction against the rules above; it says nothing about the signer's
//! key custody, which is outside this crate.
//!
//! Modules: [`canon`] canonical JSON · [`record`] the record and envelope ·
//! [`pq`] SPEC-BPQ-1 §3b in-process (fips204) · [`verify`] the two-verifier
//! gate (fips204 + `bsigner bpq-verify`) · [`chain`] rules 3 and 5 ·
//! [`store`] serve state and floor · [`sources`] the rails · [`door`] one
//! poll · [`server`] the HTTP surface and health.

pub mod b64;
pub mod canon;
pub mod chain;
pub mod config;
pub mod door;
pub mod pq;
pub mod record;
pub mod server;
pub mod sources;
pub mod store;
pub mod verify;

/// `keys-door --version`: the crate version and the git commit the binary
/// was built from, as `KEYS_DOOR_COMMIT` named it at build time ("unknown"
/// when it was unset or empty: nothing here guesses a commit).
pub fn version() -> String {
    version_line(option_env!("KEYS_DOOR_COMMIT"))
}

/// The `--version` line for the commit a build was given.
fn version_line(commit: Option<&str>) -> String {
    let commit = commit.filter(|c| !c.is_empty()).unwrap_or("unknown");
    format!("keys-door {} (commit {commit})", env!("CARGO_PKG_VERSION"))
}

#[cfg(test)]
mod tests;
