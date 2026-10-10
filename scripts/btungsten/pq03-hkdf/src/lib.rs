//! SPEC-BTUNGSTEN-PQ-1 PQ03 — HKDF-Expand(SHA-256) as hkdf 0.12.4 runs it,
//! called as bsigner's `bpq::expand_label` calls it (`Hkdf::<Sha256>::from_prk`
//! on the 32-byte masterPrk, then `expand` into 32 bytes), for SAW
//! (`../pq03-saw/hkdf.saw`).
//!
//! The info string is a label (17 to 37 bytes) and a context (1 to 64);
//! the lengths here are fixed so hmac's block buffer runs one control
//! path each, and the bytes are symbolic: 21 (`BDID-v1/vault-key` under the
//! `root` context), 55 (where the inner hash's padding spills into a block
//! of its own) and 101 (the longest label with a 64-byte context).

#![no_std]
#![forbid(unsafe_code)]

use hkdf::Hkdf;
use sha2::Sha256;

fn expand<const N: usize>(prk: &[u8; 32], info: &[u8; N]) -> [u8; 32] {
    let mut out = [0u8; 32];
    match Hkdf::<Sha256>::from_prk(prk) {
        Ok(hk) => {
            if hk.expand(info, &mut out).is_err() {
                out = [0u8; 32];
            }
        }
        Err(_) => {}
    }
    out
}

/// HKDF-Expand, 32 bytes out, info of 21 bytes.
pub fn expand_21(prk: &[u8; 32], info: &[u8; 21]) -> [u8; 32] {
    expand(prk, info)
}

/// HKDF-Expand, 32 bytes out, info of 55 bytes.
pub fn expand_55(prk: &[u8; 32], info: &[u8; 55]) -> [u8; 32] {
    expand(prk, info)
}

/// HKDF-Expand, 32 bytes out, info of 101 bytes.
pub fn expand_101(prk: &[u8; 32], info: &[u8; 101]) -> [u8; 32] {
    expand(prk, info)
}

// ---- the reference: RFC 5869 over sha2's own compression function ----------
//
// The shipped path hands sha2 its state and its block buffer as two fields
// of one struct, which a SAW specification standing in for the compression
// cannot take (its allocations must be disjoint). So the proof goes in two
// steps: `reference` (RFC 2104 and 5869 written out over `compress256`, every
// block a local of its own) is proven equal to the spec with the compression
// standing in, and `agree_*` proves the shipped `expand` equal to `reference`
// with nothing standing in: both run the same compression MIR on the same
// blocks.

use sha2::digest::generic_array::GenericArray;
use sha2::digest::typenum::U64;

const H0: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/// One block through sha2's `compress256`.
fn block(state: &mut [u32; 8], b: &[u8; 64]) {
    let ga = GenericArray::clone_from_slice(b);
    sha2::compress256(state, core::slice::from_ref(&ga));
}

/// The rest of a SHA-256 after `done` bytes already compressed: `msg`'s
/// whole blocks, then FIPS 180-4 §5.1.1 padding in one or two blocks.
fn finish(state: &mut [u32; 8], done: u64, msg: &[u8]) -> [u8; 32] {
    let full = msg.len() / 64;
    let mut i = 0;
    while i < full {
        let mut b = [0u8; 64];
        b.copy_from_slice(&msg[64 * i..64 * i + 64]);
        block(state, &b);
        i += 1;
    }
    let rem = msg.len() - 64 * full;
    let mut tail = [0u8; 128];
    tail[..rem].copy_from_slice(&msg[64 * full..]);
    tail[rem] = 0x80;
    let blocks = if rem + 9 <= 64 { 1 } else { 2 };
    let bits = (done + msg.len() as u64) * 8;
    tail[64 * blocks - 8..64 * blocks].copy_from_slice(&bits.to_be_bytes());
    let mut j = 0;
    while j < blocks {
        let mut b = [0u8; 64];
        b.copy_from_slice(&tail[64 * j..64 * j + 64]);
        block(state, &b);
        j += 1;
    }
    let mut out = [0u8; 32];
    let mut k = 0;
    while k < 8 {
        out[4 * k..4 * k + 4].copy_from_slice(&state[k].to_be_bytes());
        k += 1;
    }
    out
}

/// RFC 5869 HKDF-Expand, one block: HMAC-SHA-256(prk, info ‖ 0x01). The
/// pads are formed as hmac forms them (the key zero-padded in a 64-byte
/// GenericArray, XORed with 0x36 in place, compressed, then XORed with
/// 0x36 ^ 0x5c and compressed), so the agreement meets the same terms: a
/// plain-array reference holds the same values in terms SAW does not
/// identify. The spec proof checks the values.
fn reference<const N: usize>(prk: &[u8; 32], info: &[u8; N]) -> [u8; 32] {
    let mut pad = GenericArray::<u8, U64>::default();
    pad[..32].copy_from_slice(prk);
    for b in pad.iter_mut() {
        *b ^= 0x36;
    }
    let mut h = H0;
    sha2::compress256(&mut h, core::slice::from_ref(&pad));
    for b in pad.iter_mut() {
        *b ^= 0x36 ^ 0x5c;
    }
    let mut g = H0;
    sha2::compress256(&mut g, core::slice::from_ref(&pad));
    let mut msg = [0u8; 128];
    msg[..N].copy_from_slice(info);
    msg[N] = 0x01;
    let inner = finish(&mut h, 64, &msg[..N + 1]);
    finish(&mut g, 64, &inner)
}

fn same(a: &[u8; 32], b: &[u8; 32]) -> bool {
    let mut d = 0u8;
    let mut i = 0;
    while i < 32 {
        d |= a[i] ^ b[i];
        i += 1;
    }
    d == 0
}

/// The reference at the 21-byte shape.
pub fn reference_21(prk: &[u8; 32], info: &[u8; 21]) -> [u8; 32] {
    reference(prk, info)
}
/// The reference at the 55-byte shape.
pub fn reference_55(prk: &[u8; 32], info: &[u8; 55]) -> [u8; 32] {
    reference(prk, info)
}
/// The reference at the 101-byte shape.
pub fn reference_101(prk: &[u8; 32], info: &[u8; 101]) -> [u8; 32] {
    reference(prk, info)
}

/// The shipped expand and the reference agree (21 bytes of info).
pub fn agree_21(prk: &[u8; 32], info: &[u8; 21]) -> bool {
    same(&expand(prk, info), &reference(prk, info))
}
/// The shipped expand and the reference agree (55 bytes of info).
pub fn agree_55(prk: &[u8; 32], info: &[u8; 55]) -> bool {
    same(&expand(prk, info), &reference(prk, info))
}
/// The shipped expand and the reference agree (101 bytes of info).
pub fn agree_101(prk: &[u8; 32], info: &[u8; 101]) -> bool {
    same(&expand(prk, info), &reference(prk, info))
}

/// TOOTH: the shipped expand against the reference over info with its first
/// byte flipped; on the all-zero inputs it must return false.
pub fn agree_bent_21(prk: &[u8; 32], info: &[u8; 21]) -> bool {
    let mut bent = *info;
    bent[0] ^= 1;
    same(&expand(prk, info), &reference(prk, &bent))
}
