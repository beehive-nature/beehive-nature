//! bTunGsTeN WB002 — SimpleAssets-2021 as an extinct-infrastructure
//! specimen: the model, in Rust (Rust-first rule, 2026-10-08). The battery
//! (tests/wb002) and the WASM corpus harness (src/bin/wb002-wasm-equiv.rs)
//! drive this code; its sovereignty definition is the SAW-proven
//! `btungsten_wb002_core::sovereign`, and on the Adapter profile every
//! sovereignty-moving NFT action is replayed through the proven `step`.
//!
//! THE INVARIANT (founder wording): no change of implementation, network,
//! author, storage provider, cryptographic algorithm, or execution
//! environment may transfer sovereign authority without the currently
//! authorized sovereign action.
//!
//! EXCLUDED SURFACE (named): authorreg / authorupdate (display metadata),
//! md* more-data tables, updatever, the *log notification actions (their
//! payload rides this model's own anchored log), the backtoken call in burn
//! (SA.cpp:396), the IMPOSSIBLE_ID scope-warming dance (a RAM artifact), and
//! getid's md_id/defid split (single counter here). None moves sovereignty.

pub mod chain;
pub mod invariant;
pub mod lattice;
pub mod log;
pub mod ready;
