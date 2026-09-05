//! # bswap — adaptor-signature atomic swap (SWAP-LOCK)
//!
//! One secret moves both legs. The **script side is BTC (testnet-first)**:
//! a P2WSH 2-of-2-with-CSV-refund lock whose happy-path spend carries an
//! **ECDSA adaptor (pre-)signature** — a signature "encrypted" under the
//! adaptor point `T = t·G`, completable only by the holder of `t`, and
//! extractable from the completed on-chain signature by the counterparty.
//! The **no-script side is the Zano leg the frozen CLSAG proto already
//! signs** (docs/raids/SWAP-SORT-2026-09-02.md §4: Zano's HTLC output type
//! does not exist at HEAD — A64 — so the Zano leg of ANY atomic swap is the
//! adaptor/no-script side, exactly the surface `messages-zano.proto` v0.3
//! signs; SWAP-SORT §5, z2.1 row: "swap = one more thing the signer signs,
//! not a new signer"). The same 32 bytes of `t` are the leader's Zano key
//! share and the BTC adaptor secret — when the leader completes the BTC
//! signature to claim, the follower extracts `t` off the chain, derives the
//! combined Zano spend key, and sweeps. Isolated by design.
//!
//! ## Modules
//! - [`adaptor`] — ECDSA adaptor signatures over secp256k1 (k256): sign,
//!   verify, complete, extract.
//! - [`script`] — the BTC testnet side: the P2WSH swap script, its bech32
//!   address, and the two witness shapes.
//! - [`zano`] — the no-script leg key algebra over ed25519 (dalek):
//!   shares, the combined-key lock, adaptor binding, sweep-key recovery.
//! - [`protocol`] — phase guards, the refund-before-lock invariant, and
//!   the timelock law.
//!
//! ## Scope fences (read before claiming anything about this crate)
//! - **No transaction builder.** The crate signs 32-byte message DIGESTS
//!   and constructs script/address artifacts. Sighash computation, tx
//!   assembly and broadcast are the wallet lane's work. On-chain
//!   broadcast: UNVERIFIED at this seat (no funded BTC testnet node here).
//! - **No CLSAG implementation.** The Zano spend signature is produced by
//!   the frozen proto / signer lane (chain-zano's key derivation,
//!   `crates/chain-zano/src/keys.rs`, is the in-tree authority for Zano
//!   keys; SLIP-0010 `m/44'/1018'` verified there). This crate derives
//!   and recovers the KEYS; it does not sign Zano transactions.
//! - **Pattern provenance.** The pattern source is BasicSwap's XMR path
//!   as sorted in docs/raids/SWAP-SORT-2026-09-02.md (§1 row 3:
//!   "OtVES / 2-of-2 lock on the SCRIPT coin + combined-key lock on the
//!   NO-SCRIPT coin"; §5 z2.1 row). The basicswap repo is NOT present at
//!   this seat: byte-for-byte correspondence with its
//!   `protocols/xmr_swap_1.py` / `doc/protocols/adaptor_sig.md` is
//!   UNVERIFIED and is not claimed. What is claimed is proven by the
//!   tests in this crate, over the construction in [`adaptor`].
//! - **Language ceiling (standing law):** sound by construction /
//!   isolated by design — never stronger.
//! - **No price feed, ever** (SWAP-SORT §5: "the escrow contract never
//!   consumes an external price"): the swap logic in this crate reads no
//!   prices. There is no price-reading code in it, and that absence is
//!   the fence.

pub mod adaptor;
pub mod protocol;
pub mod script;
pub mod zano;

/// The swap's shared 32-byte secret. On the BTC side it is a secp256k1
/// scalar (mod n); on the Zano side it enters ed25519 scalar arithmetic
/// (mod l) as the leader's key share. The same bytes on both curves is the
/// cross-curve pivot of this swap class (BasicSwap's XMR path per
/// SWAP-SORT §1 row 3; exact mechanics there UNVERIFIED at this seat —
/// ours are proven by the tests in [`adaptor`] and [`zano`]).
pub type SwapSecret = [u8; 32];

pub const CRATE_ALG_IDS: &[&str] = &[
    "ecdsa-adaptor-secp256k1-mult-v1", // adaptor.rs
    "btc-p2wsh-2of2-csv-v1",           // script.rs
    "ed25519-combined-lock-v1",        // zano.rs
];

/// Hand-rolled error (no thiserror: keeps the dependency fence tight).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// A provided artifact failed verification — refuse and stop that line.
    VerifyFailed(&'static str),
    /// Malformed input bytes (point decode, length, ...).
    Malformed(&'static str),
    /// A protocol-order invariant was violated.
    Phase(&'static str),
    /// Timelock law violated (protocol::validate).
    Timelock(&'static str),
    /// Degenerate scalar encountered (retry with a fresh nonce).
    Degenerate,
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::VerifyFailed(w) => write!(f, "verify failed: {w}"),
            Error::Malformed(w) => write!(f, "malformed: {w}"),
            Error::Phase(w) => write!(f, "phase violation: {w}"),
            Error::Timelock(w) => write!(f, "timelock law: {w}"),
            Error::Degenerate => write!(f, "degenerate scalar (zero nonce/inverse) — retry"),
        }
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alg_ids_unique() {
        let mut v = CRATE_ALG_IDS.to_vec();
        v.sort();
        v.dedup();
        assert_eq!(
            v.len(),
            CRATE_ALG_IDS.len(),
            "algorithm ids must stay unique"
        );
    }
}
