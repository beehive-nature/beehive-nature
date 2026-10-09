//! bTunGsTeN PQ battery (docs/specs/SPEC-BTUNGSTEN-PQ-1.md).
//!
//! PQ01: official NIST ACVP vectors for every parameter set and every
//! function the estate exposes, on the shipped implementation and an
//! independent one. The runner is `src/bin/pq-kat.rs`; it fetches the
//! vector files at the pinned ACVP-Server commit and refuses any file whose
//! size or SHA-256 differs from `kat-manifest.json`.

pub mod acvp;
pub mod mldsa;
pub mod mlkem;
pub mod report;
pub mod slhdsa;
