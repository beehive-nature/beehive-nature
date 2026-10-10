//! SPEC-BTUNGSTEN-PQ-1 PQ02 — the SHA-3 sponge as sha3 0.10.9 runs it, at the
//! shapes bsigner uses, for SAW (`../pq02-saw/sponge.saw`).
//!
//! Each function is sha3's public API as bsigner calls it: `Sha3_256` fed in
//! one `update` or, as `bpq::sha3(parts)` does, in two; `Shake256` absorbing
//! a 32-byte seed and reading 96 bytes (`xwing_expand`). The lengths are
//! fixed so the block buffer's control flow is too; the bytes are symbolic.

#![no_std]
#![forbid(unsafe_code)]

use sha3::digest::{ExtendableOutput, Update, XofReader};
use sha3::{Digest, Sha3_256, Shake256};

/// SHA3-256 of 32 bytes: one block.
pub fn sha3_256_32(m: &[u8; 32]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    Digest::update(&mut h, m);
    h.finalize().into()
}

/// SHA3-256 of 200 bytes: two blocks (the rate is 136).
pub fn sha3_256_200(m: &[u8; 200]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    Digest::update(&mut h, m);
    h.finalize().into()
}

/// SHA3-256 of 8 then 192 bytes in two updates, as `bpq::sha3(parts)` feeds
/// its parts: the block buffer joins them across the 136-byte boundary.
pub fn sha3_256_parts(a: &[u8; 8], b: &[u8; 192]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    Digest::update(&mut h, a);
    Digest::update(&mut h, b);
    h.finalize().into()
}

/// SHAKE256 of a 32-byte seed, 96 bytes out (`bpq::xwing_expand`).
pub fn shake256_32_96(seed: &[u8; 32]) -> [u8; 96] {
    let mut x = Shake256::default();
    x.update(seed);
    let mut out = [0u8; 96];
    x.finalize_xof().read(&mut out);
    out
}
