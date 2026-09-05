//! The no-script leg: the Zano side, as key algebra over ed25519
//! (curve25519-dalek).
//!
//! **Why no script here (cited):** docs/raids/SWAP-SORT-2026-09-02.md §4 —
//! the Zano HTLC output type does not exist at HEAD (A64; the variant tag
//! is commented out in `currency_basic.h`, consensus refuses the container
//! HF4+), and the raid's consequence row says the Zano leg of any swap is
//! the **adaptor-signature / no-script side** — "exactly the surface the
//! frozen CLSAG proto already signs". DO NOT add an HTLC to Zano
//! (standing order). The lock is a **combined-key lock** (SWAP-SORT §1
//! row 3: "combined-key lock on the NO-SCRIPT coin"): the output is
//! spendable only with `P = (a + b)·B`'s secret — the SUM of both
//! parties' shares.
//!
//! **The binding:** the swap secret `t` (the same 32 bytes that unlock the
//! BTC adaptor) IS the leader's Zano share. When the leader completes and
//! publishes the BTC claim, the follower extracts `t` off the chain and
//! derives the full spend secret `t + b` — one signer, one signature,
//! produced by the frozen proto (`messages-zano.proto` v0.3; the estate's
//! Zano key authority in-tree is `crates/chain-zano/src/keys.rs`,
//! SLIP-0010 `m/44'/1018'` — `ZANO_SLIP44_COIN_TYPE` there). This crate
//! derives and recovers keys; the CLSAG signing itself is the signer
//! lane's — "swap = one more thing the signer signs, not a new signer"
//! (SWAP-SORT §5, z2.1 row).
//!
//! **Scalar mapping, labeled:** a Zano/CryptoNote secret is an ed25519
//! scalar (mod `l`); the BTC adaptor secret is a secp256k1 scalar
//! (mod `n`). The same 32 bytes enter both reductions (`dalek`'s
//! `from_bytes_mod_order` for the Zano side, k256's
//! `from_bytes_mod_order` for the BTC side). Reusing one secret across
//! both curves is the pivot of this swap class; the exact canonical
//! mapping BasicSwap uses for its XMR leg is UNVERIFIED at this seat.

use crate::adaptor;
use crate::{Error, Result, SwapSecret};
use curve25519_dalek::constants::ED25519_BASEPOINT_POINT;
use curve25519_dalek::edwards::{CompressedEdwardsY, EdwardsPoint};
use curve25519_dalek::scalar::Scalar;
use k256::ecdsa::VerifyingKey;

/// One party's share of the combined Zano lock key (ed25519 scalar mod l).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LockShare(pub Scalar);

impl LockShare {
    /// Interpret 32 bytes as the share (mod l). Callers keep these bytes
    /// secret — this type is the fence marker for that duty.
    pub fn from_bytes32(b: &SwapSecret) -> Self {
        LockShare(Scalar::from_bytes_mod_order(*b))
    }

    /// Fresh share material from 32 bytes (alias with intent-revealing name).
    pub fn from_secret_bytes(b: &SwapSecret) -> Self {
        Self::from_bytes32(b)
    }

    /// The share's public point `share·B` (what each party reveals).
    pub fn public(&self) -> EdwardsPoint {
        self.0 * ED25519_BASEPOINT_POINT
    }
}

/// The combined-key lock: `P = (a + b)·B`. The Zano output paying to this
/// point is spendable only with the summed secret (SWAP-SORT §1 row 3).
pub fn combined_lock(a: &LockShare, b: &LockShare) -> EdwardsPoint {
    (a.0 + b.0) * ED25519_BASEPOINT_POINT
}

/// The BTC-side adaptor point for the leader's share — THE BINDING: the
/// same 32 bytes are the leader's Zano share AND the secret that completes
/// the BTC pre-signature (`T = t·G_secp256k1`).
pub fn adaptor_pubkey(leader_share: &SwapSecret) -> Result<VerifyingKey> {
    adaptor::adaptor_point(leader_share)
}

/// The follower's post-claim derivation: having extracted `t` from the
/// published BTC signature, the full Zano spend secret of the combined
/// lock is `t + b` (mod l). Hand the result to the signer lane — it never
/// needs the leader's share separately.
pub fn sweep_secret(extracted_t: &SwapSecret, follower_share: &LockShare) -> LockShare {
    LockShare(LockShare::from_bytes32(extracted_t).0 + follower_share.0)
}

/// Verify a derived sweep secret against the combined lock point — the
/// follower's pre-flight check before handing the secret to the signer:
/// `sweep·B == combined_lock`.
pub fn sweep_matches(sweep: &LockShare, lock: &EdwardsPoint) -> bool {
    sweep.0 * ED25519_BASEPOINT_POINT == *lock
}

/// Compressed form for traveling in messages.
pub fn compress(p: &EdwardsPoint) -> [u8; 32] {
    p.compress().to_bytes()
}

/// Decompress a lock point received over the wire.
pub fn decompress(b: &[u8; 32]) -> Result<EdwardsPoint> {
    CompressedEdwardsY::from_slice(b)
        .map_err(|_| Error::Malformed("edwards point slice"))?
        .decompress()
        .ok_or(Error::Malformed("edwards point"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combined_lock_is_the_sum() {
        let a = LockShare::from_bytes32(&[1u8; 32]);
        let b = LockShare::from_bytes32(&[2u8; 32]);
        let lock = combined_lock(&a, &b);
        // (a+b)·B == a·B + b·B
        assert_eq!(lock, a.public() + b.public());
    }

    #[test]
    fn sweep_recovers_the_leader_share_sum() {
        let leader_t: SwapSecret = [0x77; 32];
        let follower = LockShare::from_bytes32(&[0x42; 32]);
        let leader = LockShare::from_bytes32(&leader_t);
        let lock = combined_lock(&leader, &follower);
        let sweep = sweep_secret(&leader_t, &follower);
        assert!(
            sweep_matches(&sweep, &lock),
            "sweep key must open the combined lock"
        );
        // and a WRONG extraction must not open it
        let wrong = sweep_secret(&[0x99; 32], &follower);
        assert!(!sweep_matches(&wrong, &lock));
    }

    #[test]
    fn same_bytes_both_curves() {
        // the pivot: one 32-byte secret yields BOTH the ed25519 share
        // point and the secp256k1 adaptor point
        let t: SwapSecret = [0xEE; 32];
        let share = LockShare::from_bytes32(&t);
        let adaptor = adaptor_pubkey(&t).unwrap();
        assert_ne!(compress(&share.public()), [0u8; 32]);
        assert_eq!(adaptor.to_encoded_point(true).as_bytes().len(), 33);
        // deterministic: same t, same points
        assert_eq!(adaptor_pubkey(&t).unwrap(), adaptor);
    }

    #[test]
    fn compress_round_trip() {
        let a = LockShare::from_bytes32(&[5u8; 32]);
        let b = LockShare::from_bytes32(&[6u8; 32]);
        let lock = combined_lock(&a, &b);
        let back = decompress(&compress(&lock)).unwrap();
        assert_eq!(back, lock);
    }
}
