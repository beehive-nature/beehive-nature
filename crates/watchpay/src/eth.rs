//! EVM signature cryptography for the Connect adapter — recovery only.
//!
//! This module NEVER signs. It exists so [`crate::connect`] can derive the
//! signer of a bridge-returned transaction cryptographically (k256
//! `VerifyingKey::recover_from_prehash`) instead of trusting any
//! bridge-supplied identity, and so the EIP-2 low-s law is one named,
//! testable check instead of folklore.
//!
//! Library pin: `k256 = 0.13` (RustCrypto; the same family the workspace
//! already uses in `bnr-keys`/`bswap`). Address derivation:
//! `keccak256(pubkey_uncompressed[1..65])[12..32]` (EIP-55's underlying
//! identity function; checksums are a display concern, not ours).

use crate::abi::keccak256;
use crate::error::{Error, Result};
use crate::types::EthAddr;
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

/// secp256k1 group order n (EIP-2 arithmetic base; the low-s bound is n/2). // PUBLIC-CONSTANT: secp256k1 group order, public curve parameter
const N_HALF_BE: [u8; 32] = [
    0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0x5d, 0x57, 0x6e, 0x73, 0x57, 0xa4, 0x50, 0x1d, 0xdf, 0xe9, 0x2f, 0x46, 0x68, 0x1b, 0x20, 0xa0,
];

/// s must be in the lower half of the order (EIP-2). Big-endian compare
/// against n/2; equal is lawful (s == n/2 exactly is on the bound).
pub fn is_low_s(s: &[u8; 32]) -> bool {
    s[..] <= N_HALF_BE[..]
}

/// r and s must be in [1, n-1] — zero is never a lawful scalar, and the
/// range check proper belongs to the k256 `Signature` parse (it rejects
/// out-of-range scalars); the zero check is ours and explicit.
pub fn signature_scalars_nonzero(r: &[u8; 32], s: &[u8; 32]) -> bool {
    r[..] != [0u8; 32] && s[..] != [0u8; 32]
}

/// Recover the signer address from a 32-byte preimage hash and a
/// compact (r‖s) signature with recovery id 0/1.
///
/// Failures (all field-named `signature`): bad scalar encodings
/// (k256 rejects r/s outside [1, n-1]), recid outside {0,1}, or a point
/// that does not recover (k256 returns None-equivalent as an error).
pub fn recover_signer(
    prehash: &[u8; 32],
    r: &[u8; 32],
    s: &[u8; 32],
    recid: u8,
) -> Result<EthAddr> {
    let mut compact = [0u8; 64];
    compact[..32].copy_from_slice(r);
    compact[32..].copy_from_slice(s);
    let sig = Signature::from_slice(&compact).map_err(|e| {
        Error::field(
            "signature",
            format!("r/s are not valid secp256k1 scalars ({e})"),
        )
    })?;
    let rid = RecoveryId::from_byte(recid)
        .ok_or_else(|| Error::field("signature", format!("recovery id {recid} outside {{0,1}}")))?;
    let vk = VerifyingKey::recover_from_prehash(prehash, &sig, rid).map_err(|e| {
        Error::field(
            "signature",
            format!("signature does not recover against this preimage ({e})"),
        )
    })?;
    let point = vk.to_encoded_point(false);
    let bytes = point.as_bytes(); // 0x04 ‖ X ‖ Y
    debug_assert_eq!(bytes.len(), 65);
    let pubkey_hash = keccak256(&bytes[1..65]);
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&pubkey_hash[12..32]);
    Ok(EthAddr(addr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn low_s_bound_arithmetic() {
        // n/2 itself is on the bound (lawful); n/2 + 1 is high-s (refused).
        assert!(is_low_s(&N_HALF_BE));
        let mut high = N_HALF_BE;
        high[31] += 1;
        assert!(!is_low_s(&high));
        // The all-ones s (2^256-1, > n) must also read as high.
        assert!(!is_low_s(&[0xff; 32]));
        assert!(is_low_s(&[0u8; 32]));
        assert!(!signature_scalars_nonzero(&[0u8; 32], &[1; 32]));
        assert!(!signature_scalars_nonzero(&[1; 32], &[0u8; 32]));
    }

    #[test]
    fn recovery_rejects_garbage() {
        let h = [0x11u8; 32];
        let r = [0x02u8; 32];
        let s = [0x03u8; 32];
        // recid out of domain
        assert!(recover_signer(&h, &r, &s, 2).is_err());
        // r/s = 0 is not a scalar
        assert!(recover_signer(&h, &[0u8; 32], &s, 0).is_err());
        // r/s >= n is not a scalar (k256 range check)
        let over = [0xffu8; 32];
        assert!(recover_signer(&h, &over, &s, 0).is_err());
    }
}
