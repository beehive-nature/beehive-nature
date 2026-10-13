//! keys-door — the keychain edge for keys.skaists.dev (contract: the
//! keychain release + edge contract of 2026-10-12, §1-§4).
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

#[cfg(test)]
mod tests;
