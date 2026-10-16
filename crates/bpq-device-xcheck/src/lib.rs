//! bsigner's bpq module, compiled from its own file by `#[path]`, so that the
//! Safe 7 emulator cross-check (the private fork's `crypto/bpq/emu_xcheck.py`)
//! can verify a device's card, binding and detached signature against the
//! exact `crates/bsigner/src/bpq.rs` of a named public revision.
//!
//! Why `#[path]` into a sibling crate: bsigner is a binary with no library
//! target, and its command set is frozen (`crates/bsigner/CONTRACT.md`), so
//! an oracle may neither depend on it nor be added to it. Nothing is copied
//! and no line is stripped; `b64`, `bip39`, `pq` and `alg` are included only
//! because `bpq.rs` and its tests reach them through `crate::`.
//!
//! This crate is an oracle, not a signer. It holds no keys, reads no key file,
//! and no product crate may depend on it.
#[path = "../../bsigner/src/alg.rs"]
pub mod alg;
#[path = "../../bsigner/src/b64.rs"]
pub mod b64;
#[path = "../../bsigner/src/bip39.rs"]
pub mod bip39;
#[path = "../../bsigner/src/bpq.rs"]
pub mod bpq;
#[path = "../../bsigner/src/pq.rs"]
pub mod pq;

/// The file `bpq` is compiled from, relative to the beehive-nature root.
pub const BPQ_RS: &str = "crates/bsigner/src/bpq.rs";

/// The bytes of that file at the revision this crate was built from, so a
/// receipt can carry the sha256 of the exact oracle source.
pub const BPQ_RS_BYTES: &[u8] = include_bytes!("../../bsigner/src/bpq.rs");
