//! bpq-core — the SPEC-BPQ-1 byte layer that SAW proves.
//!
//! SPEC-BTUNGSTEN-PQ-1 PQ03. Every key the bzDiD root derives is
//! `HKDF-Expand(SHA-256, masterPrk, info, L)` with `info = label ‖ context`,
//! and for the secp256k1 record key only `info = label ‖ context ‖ counter`
//! when its retry counter is above 0. This crate builds that `info` and
//! nothing else; bsigner hands it to HKDF. The functions here are the model:
//! `scripts/btungsten/pq03-saw/derive.saw` proves each one equal to the
//! Cryptol spec `scripts/btungsten/pq03-cryptol/BpqDerive.cry`, and
//! `injective.saw` proves in that spec that two different (label, context,
//! counter) triples never give the same info string (`deriveInjective`).
//!
//! The context rule: 1 to 64 bytes, each printable ASCII (0x20 to 0x7e).
//! Without it, label ‖ "a" ‖ 0x01 (counter 1) is label ‖ "a\x01" (counter
//! 0): two derivations, one key. The counter cap: at most 31, so the
//! counter byte is never a printable byte. An honest derivation needs
//! counter 1 with probability below 2^-127 (the secp256k1 order is that
//! close to 2^256), so the cap refuses nothing that will ever happen; it
//! makes the proven domain the whole domain.
//!
//! Capacities, not lengths: a context is `{len, bytes}` with zero padding
//! past `len` (`context_ok` requires it), the layout the WB001 model uses.
//!
//! PQ04, in [`layout`]: the `bpq1/` domain labels, the sealed-object nonce
//! and segment arithmetic, and the binding validators.

#![no_std]
#![forbid(unsafe_code)]

pub mod bip39;
pub mod layout;

/// `BDID-v1/ed25519-record-key`
pub const ED25519_RECORD: u8 = 0;
/// `BDID-v1/secp256k1-record-key`, the one label with a retry counter
pub const SECP256K1_RECORD: u8 = 1;
/// `BDID-v1/persona-nullifier`
pub const PERSONA_NULLIFIER: u8 = 2;
/// `BDID-v1/ml-dsa-65-record-key`
pub const ML_DSA_65_RECORD: u8 = 3;
/// `BDID-v1/x-wing-kem-key`
pub const X_WING_KEM: u8 = 4;
/// `BDID-v1/vault-key`
pub const VAULT: u8 = 5;
/// `BDID-v1/slh-dsa-shake-256f-succession`
pub const SLH_DSA_SUCCESSION: u8 = 6;
/// Label ids are `0 .. LABEL_COUNT`.
pub const LABEL_COUNT: u8 = 7;

pub const LABEL_CAP: usize = 40;
pub const CTX_CAP: usize = 64;
pub const INFO_CAP: usize = LABEL_CAP + CTX_CAP + 1;
pub const K1_COUNTER_MAX: u8 = 31;

/// Every label HKDF-Expand takes from the masterPrk, frozen v1 byte
/// constants (SPEC-BPQ-1 §2 and `surfaces/onboarding/bzdid-key.js`); the
/// index is the label id. `BDID-v1/master-prk`, `BDID-v1/prf-input/identity`
/// and `BDID-v1/fingerprint` are not here: they are an extract salt and two
/// SHA-256 prefixes, never HKDF-Expand info from the masterPrk.
pub const LABEL_STR: [&str; 7] = [
    "BDID-v1/ed25519-record-key",
    "BDID-v1/secp256k1-record-key",
    "BDID-v1/persona-nullifier",
    "BDID-v1/ml-dsa-65-record-key",
    "BDID-v1/x-wing-kem-key",
    "BDID-v1/vault-key",
    "BDID-v1/slh-dsa-shake-256f-succession",
];

const fn pad(s: &str) -> [u8; LABEL_CAP] {
    let b = s.as_bytes();
    assert!(b.len() <= LABEL_CAP);
    let mut out = [0u8; LABEL_CAP];
    let mut i = 0;
    while i < b.len() {
        out[i] = b[i];
        i += 1;
    }
    out
}

/// The label bytes, zero-padded to `LABEL_CAP`.
pub const LABEL_BYTES: [[u8; LABEL_CAP]; 7] = [
    pad(LABEL_STR[0]),
    pad(LABEL_STR[1]),
    pad(LABEL_STR[2]),
    pad(LABEL_STR[3]),
    pad(LABEL_STR[4]),
    pad(LABEL_STR[5]),
    pad(LABEL_STR[6]),
];

/// The label lengths in bytes.
pub const LABEL_LEN: [u32; 7] = [
    LABEL_STR[0].len() as u32,
    LABEL_STR[1].len() as u32,
    LABEL_STR[2].len() as u32,
    LABEL_STR[3].len() as u32,
    LABEL_STR[4].len() as u32,
    LABEL_STR[5].len() as u32,
    LABEL_STR[6].len() as u32,
];

/// A context string: `len` bytes, zero-padded to `CTX_CAP`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Context {
    pub len: u32,
    pub bytes: [u8; CTX_CAP],
}

impl Context {
    /// The context `s` as a padded value, or `None` if it is longer than
    /// `CTX_CAP` bytes. Whether it is admitted is `context_ok`'s question.
    pub fn new(s: &str) -> Option<Context> {
        let b = s.as_bytes();
        if b.len() > CTX_CAP {
            return None;
        }
        let mut bytes = [0u8; CTX_CAP];
        bytes[..b.len()].copy_from_slice(b);
        Some(Context {
            len: b.len() as u32,
            bytes,
        })
    }
}

/// Cryptol `contextOk`: 1 to 64 bytes, each printable ASCII, zero padding
/// past `len`. Branch-free (`&` and `|` on bools), one term per byte.
pub fn context_ok(c: &Context) -> bool {
    let mut ok = (c.len >= 1) & (c.len <= CTX_CAP as u32);
    let mut i = 0;
    while i < CTX_CAP {
        let b = c.bytes[i];
        let inside = (i as u32) < c.len;
        ok &= (inside & (0x20..=0x7e).contains(&b)) | (!inside & (b == 0));
        i += 1;
    }
    ok
}

/// Cryptol `argsOk`: a known label, an admitted context, and a counter only
/// on the secp256k1 label, at most `K1_COUNTER_MAX`.
pub fn args_ok(label: u8, c: &Context, counter: u8) -> bool {
    (label < LABEL_COUNT)
        & context_ok(c)
        & ((counter == 0) | ((label == SECP256K1_RECORD) & (counter <= K1_COUNTER_MAX)))
}

/// Cryptol `infoLen`. `label` must be a known label.
pub fn info_len(label: u8, c: &Context, counter: u8) -> u32 {
    LABEL_LEN[label as usize]
        .wrapping_add(c.len)
        .wrapping_add((counter != 0) as u32)
}

/// Byte `k` of the info string, zero past its end. `args_ok` must hold.
pub fn info_byte(label: u8, c: &Context, counter: u8, k: u32) -> u8 {
    let ll = LABEL_LEN[label as usize];
    let end = ll.wrapping_add(c.len);
    if k < ll {
        LABEL_BYTES[label as usize][k as usize]
    } else if k < end {
        c.bytes[(k - ll) as usize]
    } else if k == end {
        counter
    } else {
        0
    }
}

/// Cryptol `info`: writes the zero-padded info string into `out` and returns
/// its length; refused arguments write zeros and return 0 (no admitted info
/// string is empty). The HKDF info is `out[..len]`.
pub fn info(label: u8, c: &Context, counter: u8, out: &mut [u8; INFO_CAP]) -> u32 {
    if !args_ok(label, c, counter) {
        *out = [0u8; INFO_CAP];
        return 0;
    }
    let mut k = 0;
    while k < INFO_CAP {
        out[k] = info_byte(label, c, counter, k as u32);
        k += 1;
    }
    info_len(label, c, counter)
}

/// An info string built by `info`.
#[derive(Clone, Copy)]
pub struct Info {
    bytes: [u8; INFO_CAP],
    len: u32,
}

impl Info {
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[..self.len as usize]
    }
}

/// `info` for a context given as text: `None` when the context is not
/// admitted or the arguments are refused.
pub fn info_for(label: u8, context: &str, counter: u8) -> Option<Info> {
    let c = Context::new(context)?;
    let mut bytes = [0u8; INFO_CAP];
    let len = info(label, &c, counter, &mut bytes);
    if len == 0 {
        return None;
    }
    Some(Info { bytes, len })
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use std::vec::Vec;

    fn concat(label: u8, context: &str, counter: u8) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(LABEL_STR[label as usize].as_bytes());
        v.extend_from_slice(context.as_bytes());
        if counter != 0 {
            v.push(counter);
        }
        v
    }

    #[test]
    fn padded_labels_agree_with_the_strings() {
        for (l, s) in LABEL_STR.iter().enumerate() {
            let s = s.as_bytes();
            assert_eq!(LABEL_LEN[l] as usize, s.len());
            assert_eq!(&LABEL_BYTES[l][..s.len()], s);
            assert!(LABEL_BYTES[l][s.len()..].iter().all(|&b| b == 0));
        }
    }

    #[test]
    fn no_label_is_a_prefix_of_another() {
        for (a, la) in LABEL_STR.iter().enumerate() {
            for (b, lb) in LABEL_STR.iter().enumerate() {
                if a != b {
                    assert!(!lb.starts_with(la), "{a} prefixes {b}");
                }
            }
        }
    }

    #[test]
    fn info_is_label_then_context_then_counter() {
        for l in 0..LABEL_COUNT {
            for ctx in ["pq:vector", "root", "a", " ~", "btc-spend:kingbee"] {
                assert_eq!(
                    info_for(l, ctx, 0).unwrap().as_bytes(),
                    &concat(l, ctx, 0)[..]
                );
            }
        }
        let max = "x".repeat(CTX_CAP);
        assert_eq!(
            info_for(VAULT, &max, 0).unwrap().as_bytes(),
            &concat(VAULT, &max, 0)[..]
        );
        for k in 1..=K1_COUNTER_MAX {
            assert_eq!(
                info_for(SECP256K1_RECORD, "nostr:bnr-devices", k)
                    .unwrap()
                    .as_bytes(),
                &concat(SECP256K1_RECORD, "nostr:bnr-devices", k)[..]
            );
        }
    }

    #[test]
    fn refusals() {
        assert!(info_for(VAULT, "", 0).is_none(), "empty context");
        assert!(
            info_for(VAULT, &"x".repeat(CTX_CAP + 1), 0).is_none(),
            "65 bytes"
        );
        assert!(info_for(VAULT, "a\u{1}", 0).is_none(), "control byte");
        assert!(info_for(VAULT, "a\u{7f}", 0).is_none(), "DEL");
        assert!(info_for(VAULT, "p\u{e9}", 0).is_none(), "non-ASCII");
        assert!(info_for(LABEL_COUNT, "a", 0).is_none(), "unknown label");
        assert!(
            info_for(VAULT, "a", 1).is_none(),
            "counter on a counter-free label"
        );
        assert!(
            info_for(SECP256K1_RECORD, "a", K1_COUNTER_MAX + 1).is_none(),
            "counter past the cap"
        );
        let mut c = Context::new("ab").unwrap();
        c.bytes[5] = b'z';
        assert!(!context_ok(&c), "nonzero padding");
        let mut out = [0xffu8; INFO_CAP];
        assert_eq!(info(VAULT, &c, 0, &mut out), 0);
        assert!(out.iter().all(|&b| b == 0), "a refusal writes zeros");
    }

    #[test]
    fn the_collision_the_rule_closes() {
        // label ‖ "a" ‖ 0x01 would equal label ‖ "a\x01": the second context
        // is not admitted, so only one of the two derivations exists
        let one = info_for(SECP256K1_RECORD, "a", 1).unwrap();
        assert_eq!(one.as_bytes(), &concat(SECP256K1_RECORD, "a\u{1}", 0)[..]);
        assert!(info_for(SECP256K1_RECORD, "a\u{1}", 0).is_none());
    }
}
