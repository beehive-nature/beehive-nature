//! SPEC-BTUNGSTEN-PQ-1 PQ02 — the SHA-3 sponge as sha3 0.11.0 runs it on
//! keccak 0.2.2 (ml-kem 0.3.2's and slh-dsa's), at the shapes ML-KEM-768
//! hashes at, for SAW (`../pq02-saw/sponge022.saw`). The lengths are fixed
//! so each buffer runs one control path; the bytes are symbolic.
//!
//! Not here: shake 0.1.0, ml-dsa's SHAKE. Its sponge-cursor absorbs by
//! reading the `[u64; 25]` state as bytes through a pointer cast
//! (u64_le_utils.rs:40), which SAW's MIR memory model cannot read
//! ("attempted to read empty mux tree"); ML-DSA's SHAKE stays covered by
//! PQ01's ACVP vectors.

#![no_std]
#![forbid(unsafe_code)]

use sha3::Digest;
use sha3::digest::{ExtendableOutput, Update, XofReader};

/// SHA3-256 of 1184 bytes: ML-KEM-768's H(ek).
pub fn sha3_256_1184(m: &[u8; 1184]) -> [u8; 32] {
    sha3::Sha3_256::digest(m).into()
}

/// SHA3-512 of 33 bytes: ML-KEM's G(d ‖ k).
pub fn sha3_512_33(m: &[u8; 33]) -> [u8; 64] {
    sha3::Sha3_512::digest(m).into()
}

/// SHAKE256 (sha3 0.11) of 1120 bytes, 32 out: ML-KEM-768's J(z ‖ c).
pub fn shake256_1120_32(m: &[u8; 1120]) -> [u8; 32] {
    let mut x = sha3::Shake256::default();
    x.update(m);
    let mut out = [0u8; 32];
    x.finalize_xof().read(&mut out);
    out
}

/// SHAKE256 (sha3 0.11) of 33 bytes, 128 out: ML-KEM's PRF at eta = 2.
pub fn shake256_33_128(m: &[u8; 33]) -> [u8; 128] {
    let mut x = sha3::Shake256::default();
    x.update(m);
    let mut out = [0u8; 128];
    x.finalize_xof().read(&mut out);
    out
}

/// SHAKE128 (sha3 0.11) of 34 bytes, 504 out, read in three 168-byte
/// blocks as SampleNTT reads it.
pub fn shake128_34_504(m: &[u8; 34]) -> [u8; 504] {
    let mut x = sha3::Shake128::default();
    x.update(m);
    let mut r = x.finalize_xof();
    let mut out = [0u8; 504];
    r.read(&mut out[..168]);
    r.read(&mut out[168..336]);
    r.read(&mut out[336..]);
    out
}
