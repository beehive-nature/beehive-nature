//! Zano account-key derivation, ported byte-for-byte from
//! `hyle-team/zano/src/crypto/crypto.cpp` (`keys_from_default`, `dependent_key`).
//!
//! PURPOSE: the VIEW-ONLY restore/scanning path. Given a Zano brain-wallet
//! seed (the 32-byte `keys_seed_binary`), reproduce the account exactly as
//! stock Zano does, so a Beehive node can scan the chain for the user's
//! incoming outputs.
//!
//! ============================ SECURITY BOUNDARY ============================
//! Trezor-native architecture, inviolable rule: the spend secret `s` NEVER
//! persists in host state. This module computes `s` transiently ONLY to derive
//! the public keys and the view secret `v` for scanning, then zeroizes it. It
//! deliberately does NOT return `s`. If you need to *sign*, that happens on the
//! device — not here. Do not add a getter that leaks `s`.
//! ==========================================================================
//!
//! Source-confirmed derivation (crypto.cpp):
//!   keys_from_default:  s   = sc_reduce( seed[0..32] )      // NOT a hash of the seed
//!                       S   = s * G
//!   dependent_key:      v   = keccak256(s) mod l            // Zano `cn_fast_hash`
//!                       V   = v * G
//!
//! NOTE on `cn_fast_hash`: it is Keccak (pre-NIST padding) == `sha3::Keccak256`,
//! NOT `sha3::Sha3_256`.
//!
//! NOTE on the mnemonic: turning a 25-word phrase into `seed[0..32]` requires
//! Zano's `mnemonic_encoding` decode (strip timestamp + auditable-flag words,
//! checksum-validate). That is plain encoding, lives in
//! `common/mnemonic-encoding.h`, and is NOT included here. This module starts
//! from the already-decoded 32-byte seed.

use curve25519_dalek::constants::ED25519_BASEPOINT_TABLE;
use curve25519_dalek::scalar::Scalar;
use sha3::{Digest, Keccak256};
use zeroize::Zeroize;

/// Public, scan-capable account material. Intentionally contains NO spend secret.
#[derive(Clone)]
pub struct ZanoViewAccount {
    /// view secret `v` — safe on host; can scan, cannot spend
    pub view_secret: Scalar,
    /// spend public `S = s*G`
    pub spend_public: [u8; 32],
    /// view public `V = v*G`
    pub view_public: [u8; 32],
    // DELIBERATELY ABSENT: spend_secret. It is not retained here.
}

/// Port of Zano `dependent_key`: `v = keccak256(s) mod l`.
/// Split out so the future firmware app and this host module share one definition.
pub fn dependent_view_secret(s: &Scalar) -> Scalar {
    let mut sb = s.to_bytes();
    let mut hasher = Keccak256::new(); // cn_fast_hash == Keccak256, NOT Sha3_256
    hasher.update(sb);
    let digest: [u8; 32] = hasher.finalize().into();
    sb.zeroize();
    Scalar::from_bytes_mod_order(digest)
}

/// Port of Zano `keys_from_default` for the VIEW-ONLY path.
///
/// Takes the 32-byte brain-wallet seed, derives `s = sc_reduce(seed)` transiently,
/// produces `{S, v, V}`, and zeroizes `s` before returning. `s` is never returned.
///
/// `seed32` is `keys_seed_binary[0..32]` (BRAINWALLET_DEFAULT_SEED_SIZE bytes).
pub fn view_account_from_seed(seed32: &[u8; 32]) -> ZanoViewAccount {
    // s = sc_reduce(seed[0..32])   (crypto.cpp: sc_reduce(tmp); memcpy(&sec, tmp, 32))
    let mut s = Scalar::from_bytes_mod_order(*seed32);

    // S = s*G
    let spend_public = (&s * ED25519_BASEPOINT_TABLE).compress().to_bytes();

    // v = keccak256(s) mod l ; V = v*G
    let v = dependent_view_secret(&s);
    let view_public = (&v * ED25519_BASEPOINT_TABLE).compress().to_bytes();

    // transient spend secret does not outlive this function
    s.zeroize();

    ZanoViewAccount { view_secret: v, spend_public, view_public }
}

/// Import an already-exported view secret `v` (hex) for scanning — the ONLY
/// key-import path that touches the host. Never accepts `s`.
pub fn view_account_from_view_secret_hex(v_hex: &str) -> Result<Scalar, &'static str> {
    let bytes = decode_hex_32(v_hex).ok_or("view secret must be 64 hex chars / 32 bytes")?;
    // Accept only a canonical, in-range scalar.
    Option::<Scalar>::from(Scalar::from_canonical_bytes(bytes))
        .ok_or("view secret is not a canonical scalar")
}

fn decode_hex_32(s: &str) -> Option<[u8; 32]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() != 64 { return None; }
    let mut out = [0u8; 32];
    for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
        let hi = (chunk[0] as char).to_digit(16)?;
        let lo = (chunk[1] as char).to_digit(16)?;
        out[i] = ((hi << 4) | lo) as u8;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_and_no_spend_secret_leaks() {
        let seed = [0x11u8; 32];
        let a = view_account_from_seed(&seed);
        let b = view_account_from_seed(&seed);
        assert_eq!(a.view_secret, b.view_secret);
        assert_eq!(a.spend_public, b.spend_public);
        assert_eq!(a.view_public, b.view_public);
        // Type-level guarantee: ZanoViewAccount has no spend_secret field.
    }

    #[test]
    fn dependent_key_uses_keccak_not_sha3() {
        use sha3::Sha3_256;
        let s = Scalar::from_bytes_mod_order([9u8; 32]);
        let keccak = {
            let mut h = Keccak256::new(); h.update(s.to_bytes());
            let d: [u8; 32] = h.finalize().into(); d
        };
        let sha3 = {
            let mut h = Sha3_256::new(); h.update(s.to_bytes());
            let d: [u8; 32] = h.finalize().into(); d
        };
        assert_ne!(keccak, sha3);
        assert_eq!(dependent_view_secret(&s), Scalar::from_bytes_mod_order(keccak));
    }

    /// COMPATIBILITY REGRESSION — #[ignore] until a real stock-Zano vector is
    /// inserted. A green test on a fabricated vector is the split-brain bug
    /// wearing a passing checkmark.
    ///
    /// TODO: from stock Zano, take a known `keys_seed_binary[0..32]` and its
    /// resulting spend_public + view_public, paste hex, remove #[ignore].
    #[test]
    #[ignore = "insert a verified stock-Zano (seed32 -> S,V) vector before enabling"]
    fn matches_stock_zano_vector() {
        // let seed32: [u8;32] = hex!("...");                 // TODO
        // let acct = view_account_from_seed(&seed32);
        // assert_eq!(acct.spend_public, hex!("..."));        // TODO expected S
        // assert_eq!(acct.view_public,  hex!("..."));        // TODO expected V
        todo!("insert verified stock-Zano reference vector");
    }
}
