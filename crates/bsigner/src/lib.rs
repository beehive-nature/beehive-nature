//! bsigner as a library.
//!
//! The CLI (`main.rs`) is the same organ's hands; this root exposes the
//! modules so kernel citizens (notably `harness-sovereign`) link signing
//! as function calls — no subprocess, no JSON over stdio. Module-level
//! laws (KEYS NEVER LEAVE, NEVER PRINTED, independence from `banchor`)
//! hold identically behind this root.

pub mod alg;
pub mod b64;
pub mod bpq;
pub mod envelope;
pub mod kat;
pub mod keys;
pub mod pq;
pub mod x402;
