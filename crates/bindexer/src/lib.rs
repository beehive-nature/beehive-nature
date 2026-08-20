//! bindexer — SPEC-BINDEXER-0: the read-only chain indexer (Rust + SQLite),
//! written against blockbook's v2 API surface as prior art.
//!
//! # The three laws this crate exists to keep
//!
//! 1. **Keyless by construction** — no sendtx, no wallet, no key material.
//!    Enforced by a source-scan test in CI, not by policy.
//! 2. **The two-oracle law is schema-level** — every response carries `sources`;
//!    a single-source answer is marked and surfaces render the mark.
//! 3. **Append-mostly honesty** — reorgs append a `reorgs` row; history is
//!    never silently rewritten; status confesses row counts, WAL lag, and
//!    last-block time rather than saying "OK".

pub mod api;
pub mod ingest;
pub mod oracle;
pub mod serve;
pub mod store;
