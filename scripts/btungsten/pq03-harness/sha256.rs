//! SPEC-BTUNGSTEN-PQ-1 PQ03 — the proof harness for SHA-256 in sha2 0.10.9
//! (bsigner's HKDF-SHA256 and HMAC, BIP-340 tagged hashes, BIP-341 sighash).
//!
//! sha2 keeps its software compression (`sha256::soft`) private, so this
//! harness compiles the crate's own `src/consts.rs` and
//! `src/sha256/soft.rs` VERBATIM (from the `.crate` cargo ships, checked
//! against Cargo.lock by ../pq03-sha256-check.sh) as its modules; soft.rs
//! names nothing from its parent but `crate::consts`. On x86_64 sha2 0.10.9
//! runs SHA-NI intrinsics when the CPU has the SHA extensions and this soft
//! code otherwise (and on targets without its asm paths); the proof is about
//! this code. `../pq03-saw/sha256.saw` proves the two-round function and the
//! message schedule equal to FIPS 180-4 for every input, then the 64-round
//! block function composed from them, and the crate's tables equal to the
//! constants the spec derives.

#![no_std]
#![forbid(unsafe_code)]

#[path = "../../../target/saw-pq03-sha256/sha2-0.10.9/src/consts.rs"]
pub mod consts;
#[path = "../../../target/saw-pq03-sha256/sha2-0.10.9/src/sha256/soft.rs"]
pub mod soft;

/// The crate's round constants (consts::K32), as the SAW table check reads them.
pub fn k32() -> [u32; 64] {
    consts::K32
}

/// The crate's SHA-256 initial hash value (consts::H256_256).
pub fn h256() -> [u32; 8] {
    consts::H256_256
}

/// One block through the crate's soft `compress` (bytes to big-endian
/// words, then the block function).
pub fn compress1(state: &mut [u32; 8], block: &[u8; 64]) {
    soft::compress(state, &[*block]);
}
