//! Zano key derivation for the `chain-zano` adapter (host-side).
//!
//! Implements Zano's *actual* key relationships, confirmed against
//! `hyle-team/zano/src/crypto/crypto.cpp`:
//!
//!   spend secret  s   : input (from the Trezor-derived SLIP-0010 leaf)
//!   view  secret  v   = Hs(s) = keccak256(s) reduced mod l   (`dependent_key`)
//!   spend public  S   = s * G
//!   view  public  V   = v * G
//!
//! This REPLACES the earlier prototype's `ecdh`-based view-key path, which
//! produced a view key != Hs(s) and was therefore incompatible with every
//! standard Zano wallet (could spend, could not correctly recognize its own
//! incoming outputs, would not restore into stock Zano software).
//!
//! Derivation path (SLIP-0010, Ed25519, all-hardened):
//!
//!   m / 44' / 1018' / account'
//!
//! WARNING: Coin type 1018 (ZANO) VERIFIED against the official SLIP-0044
//! registry (https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
//! before production use, to prevent fund lock-in. This file assumes the
//! spend secret `s` has already been derived at that path by the caller
//! (Trezor / SLIP-0010 layer); it does not perform BIP-32 derivation itself.
//!
//! HASH VARIANT (non-negotiable): Zano's `cn_fast_hash` is Keccak with
//! pre-NIST padding == `sha3::Keccak256`, NOT `sha3::Sha3_256`. Using
//! SHA3-256 here reproduces exactly the class of "looks fine, rejected
//! on-chain / incompatible wallet" failure this module exists to prevent.
//!
//! There is deliberately NO ECDH, key-agreement, or external-protocol code in
//! this file. It is pure, local, deterministic derivation.

use curve25519_dalek::constants::ED25519_BASEPOINT_TABLE;
use curve25519_dalek::scalar::Scalar;
use sha3::{Digest, Keccak256};

/// Zano's registered SLIP-0044 coin type. VERIFY before production (see file docs).
pub const ZANO_SLIP44_COIN_TYPE: u32 = 1018;

/// The all-hardened SLIP-0010 path template for account `a`: `m/44'/1018'/a'`.
/// (Informational: derivation of `s` at this path is done by the Trezor/
/// SLIP-0010 layer, not here.)
pub fn derivation_path(account: u32) -> [u32; 3] {
    const HARDENED: u32 = 0x8000_0000;
    [
        44 | HARDENED,
        ZANO_SLIP44_COIN_TYPE | HARDENED,
        account | HARDENED,
    ]
}

/// A Zano keypair set derived from a single spend secret.
#[derive(Clone)]
pub struct ZanoKeys {
    /// spend secret `s` (kept secret; on a real device this never leaves it)
    pub spend_secret: Scalar,
    /// view secret `v = Hs(s)` (shareable for watch-only scanning)
    pub view_secret: Scalar,
    /// spend public `S = s*G` (32-byte compressed Edwards point)
    pub spend_public: [u8; 32],
    /// view public `V = v*G` (32-byte compressed Edwards point)
    pub view_public: [u8; 32],
}

/// Derive Zano's deterministic view secret from the spend secret:
/// `v = keccak256(s) mod l`  (Zano `crypto_ops::dependent_key`).
///
/// `s_bytes` is the 32-byte spend secret scalar as stored/derived.
pub fn view_secret_from_spend(s_bytes: &[u8; 32]) -> Scalar {
    // cn_fast_hash == Keccak256 (pre-NIST padding). MUST NOT be Sha3_256.
    let mut hasher = Keccak256::new();
    hasher.update(s_bytes);
    let digest: [u8; 32] = hasher.finalize().into();

    // hash_to_scalar == reduce the 32-byte digest mod the group order l.
    Scalar::from_bytes_mod_order(digest)
}

/// Build the full Zano key set from a raw 32-byte spend secret.
///
/// The spend secret itself is taken mod `l` (Zano requires `sc_check(s) == 0`;
/// reducing guarantees a canonical in-range scalar). The caller is responsible
/// for having derived `s` deterministically from the seed at `m/44'/1018'/a'`.
pub fn derive_from_spend_secret(spend_secret_bytes: &[u8; 32]) -> ZanoKeys {
    let s = Scalar::from_bytes_mod_order(*spend_secret_bytes);
    let v = view_secret_from_spend(spend_secret_bytes);

    let spend_public = (&s * ED25519_BASEPOINT_TABLE).compress().to_bytes();
    let view_public = (&v * ED25519_BASEPOINT_TABLE).compress().to_bytes();

    ZanoKeys {
        spend_secret: s,
        view_secret: v,
        spend_public,
        view_public,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Determinism / self-consistency: same input -> same output, and the
    /// view key is a pure function of the spend key (never random / ECDH).
    #[test]
    fn view_key_is_deterministic_function_of_spend() {
        let s = [7u8; 32];
        let a = derive_from_spend_secret(&s);
        let b = derive_from_spend_secret(&s);
        assert_eq!(a.view_secret, b.view_secret);
        assert_eq!(a.view_public, b.view_public);
        // v must NOT equal s (that would indicate a no-op / wrong derivation)
        assert_ne!(a.view_secret, a.spend_secret);
    }

    /// Guards the exact bug this module fixes: SHA3-256 and Keccak-256 differ
    /// only in padding, so this asserts we produce the Keccak result, not SHA3.
    #[test]
    fn uses_keccak_not_sha3() {
        use sha3::Sha3_256;
        let s = [1u8; 32];

        let keccak = {
            let mut h = Keccak256::new();
            h.update(s);
            let d: [u8; 32] = h.finalize().into();
            d
        };
        let sha3 = {
            let mut h = Sha3_256::new();
            h.update(s);
            let d: [u8; 32] = h.finalize().into();
            d
        };
        // If these were ever equal, the padding assumption would be wrong.
        assert_ne!(keccak, sha3, "Keccak256 and Sha3_256 must differ");

        // Our derivation must be built on the Keccak branch.
        let expected_v = Scalar::from_bytes_mod_order(keccak);
        assert_eq!(view_secret_from_spend(&s), expected_v);
    }

    /// COMPATIBILITY REGRESSION TEST — the one that actually proves we match
    /// stock Zano. Vector provenance and the address decoder live in
    /// [`crate::testvec`] (generated 2026-07-03 with stock simplewallet
    /// v2.2.1.501, throwaway never-funded wallet, committed deliberately).
    ///
    /// What this proves, with zero circularity:
    /// - `v = keccak256(s) mod l` against the stock-exported view secret —
    ///   the exact `dependent_key` relation the split-brain bug got wrong.
    /// - `S = s*G`, `V = v*G` against the publics decoded from the stock
    ///   wallet's own address (CN-base58 + checksum), a path fully
    ///   independent of this module.
    #[test]
    fn matches_zano_reference_vector() {
        use crate::testvec;

        let keys = derive_from_spend_secret(&testvec::SPEND_SECRET);

        // The Zano-specific hash relation, against stock's own export:
        let expected_v = Option::<Scalar>::from(Scalar::from_canonical_bytes(testvec::VIEW_SECRET))
            .expect("stock view secret is a canonical scalar");
        assert_eq!(
            keys.view_secret, expected_v,
            "dependent_key mismatch vs stock Zano"
        );

        // The public keys, against the address payload:
        let (expected_spend_public, expected_view_public) = testvec::address_publics();
        assert_eq!(
            keys.spend_public, expected_spend_public,
            "S mismatch vs stock address"
        );
        assert_eq!(
            keys.view_public, expected_view_public,
            "V mismatch vs stock address"
        );
    }
}
