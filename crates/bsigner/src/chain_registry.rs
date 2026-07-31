//! BNR-owned chain registry (C1b).
//!
//! The point of this module is that the chain list is **ours**. Trezor Suite
//! ships a closed EVM network list, which is why exSat could not be added and
//! why the founder was pushed through MetaMask as a forced intermediary
//! (SPEC_KEYRING-1 §2.7). Adding a rail here is a registry entry, never a
//! vendor request.
//!
//! # The chain-id law, enforced by the type system
//!
//! Standing build law: *pin the chain id in config and verify `eth_chainId`
//! before signing — never trust the RPC URL alone.* A comment saying so is not
//! enforcement. Here the law is structural:
//!
//! - [`EvmChain`] is a **pinned expectation**. It cannot be used to authorise
//!   anything.
//! - [`VerifiedEvmChain`] is the only type a future signing path will accept,
//!   and the *only* way to obtain one is [`EvmChain::verify_chain_id`] with an
//!   `eth_chainId` reading that matches the pin.
//!
//! So "someone forgot to verify" is a compile error rather than a lost
//! transaction. This mirrors the pattern already in `chain-exsat-evm`
//! (`IndexerConfig::verify_observed_chain_id`); the difference is that there
//! the caller *may* forget, and here they cannot.

use core::fmt;

/// How a chain is named across the ecosystem.
///
/// CAIP-2 where a registered identifier exists, SLIP-44 coin type otherwise.
/// This is the same key set the `.b` resolver uses (SPEC_KEYRING-1 §9) — one
/// registry powers both signing and resolution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChainKey {
    /// CAIP-2, e.g. `eip155:7200`, `antelope:aca376f2…`.
    Caip2(&'static str),
    /// SLIP-44 coin type for rails without a registered CAIP-2 namespace.
    Slip44(u32),
}

impl fmt::Display for ChainKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChainKey::Caip2(s) => write!(f, "{s}"),
            ChainKey::Slip44(c) => write!(f, "slip44:{c}"),
        }
    }
}

/// Whether a pinned value was confirmed against a live endpoint, and when.
///
/// The receipt rule applies to our own constants: an unverified pin is marked
/// and stopped, never quietly shipped as fact.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provenance {
    /// Confirmed against a live endpoint on the given ISO date.
    VerifiedLive(&'static str),
    /// Not confirmed. Carries the reason. Callers must treat as unusable.
    Unverified(&'static str),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ChainError {
    #[error("chain-id mismatch for {chain}: pinned {pinned}, endpoint reported {observed} — refusing to proceed")]
    ChainIdMismatch { chain: &'static str, pinned: u64, observed: u64 },

    #[error("chain {chain} is UNVERIFIED ({reason}) — cannot be used until a live reading confirms it")]
    Unverified { chain: &'static str, reason: &'static str },
}

/// A pinned EVM chain. **Cannot authorise anything on its own.**
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvmChain {
    pub name: &'static str,
    pub chain_key: ChainKey,
    pub chain_id: u64,
    pub provenance: Provenance,
}

/// An EVM chain whose `eth_chainId` has been confirmed to match the pin.
///
/// Obtainable only through [`EvmChain::verify_chain_id`]. When the signing
/// rail is built (a later order — C1 signs nothing), it will accept this type
/// and not [`EvmChain`], which is what makes the verification unskippable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedEvmChain {
    inner: EvmChain,
    observed_chain_id: u64,
}

impl VerifiedEvmChain {
    pub fn chain(&self) -> &EvmChain {
        &self.inner
    }
    pub fn chain_id(&self) -> u64 {
        self.observed_chain_id
    }
}

impl EvmChain {
    /// Compare a live `eth_chainId` reading against the pin.
    ///
    /// `observed` must come from an actual RPC call made against the endpoint
    /// about to be used — not from config, and not from this struct.
    pub fn verify_chain_id(&self, observed: u64) -> Result<VerifiedEvmChain, ChainError> {
        if let Provenance::Unverified(reason) = self.provenance {
            return Err(ChainError::Unverified { chain: self.name, reason });
        }
        if observed != self.chain_id {
            return Err(ChainError::ChainIdMismatch {
                chain: self.name,
                pinned: self.chain_id,
                observed,
            });
        }
        Ok(VerifiedEvmChain { inner: self.clone(), observed_chain_id: observed })
    }
}

/// A pinned Antelope chain (Vaulta and relatives). Identity is the 32-byte
/// chain id, not a numeric id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AntelopeChain {
    pub name: &'static str,
    pub chain_key: ChainKey,
    pub chain_id_hex: &'static str,
    pub provenance: Provenance,
}

// ── The pinned set ───────────────────────────────────────────────────────
//
// Every value below was read from a live endpoint on 2026-07-30 by the build
// seat, not recalled. The one that could not be reached is marked Unverified
// and is refused by `verify_chain_id` until someone confirms it.

/// Vaulta mainnet — `get_info.chain_id`, read live 2026-07-30.
pub const VAULTA_MAINNET: AntelopeChain = AntelopeChain {
    name: "Vaulta mainnet",
    chain_key: ChainKey::Caip2("antelope:aca376f206b8fc25a6ed44dbdc66547c"),
    chain_id_hex: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906", // PUBLIC-CONSTANT
    provenance: Provenance::VerifiedLive("2026-07-30"),
};

/// exSat mainnet — `eth_chainId` → `0x1c20` (7200), read live 2026-07-30.
/// Matches the pin already held in `chain-exsat-evm::EXSAT_MAINNET_CHAIN_ID`.
pub const EXSAT_MAINNET: EvmChain = EvmChain {
    name: "exSat mainnet",
    chain_key: ChainKey::Caip2("eip155:7200"),
    chain_id: 7200,
    provenance: Provenance::VerifiedLive("2026-07-30"),
};

/// exSat testnet — **UNVERIFIED.** `https://evm-tst3.exsat.network` did not
/// respond to `eth_chainId` on 2026-07-30, so no id is pinned here. Guessing
/// one would violate the standing law (UNVERIFIED marked and stopped, never
/// inferred), and a wrong testnet id is exactly the wrong-network loss class
/// this registry exists to prevent. `verify_chain_id` refuses this entry.
pub const EXSAT_TESTNET: EvmChain = EvmChain {
    name: "exSat testnet",
    chain_key: ChainKey::Caip2("eip155:UNVERIFIED"),
    chain_id: 0,
    provenance: Provenance::Unverified(
        "evm-tst3.exsat.network did not answer eth_chainId on 2026-07-30; id not sourced",
    ),
};

/// Arbitrum One — `eth_chainId` → `0xa4b1` (42161), read live 2026-07-30.
/// The ANT rail (SPEC_KEYRING-1 §2.1).
pub const ARBITRUM_ONE: EvmChain = EvmChain {
    name: "Arbitrum One",
    chain_key: ChainKey::Caip2("eip155:42161"),
    chain_id: 42161,
    provenance: Provenance::VerifiedLive("2026-07-30"),
};

/// Every EVM rail the signer knows about.
pub const EVM_CHAINS: &[EvmChain] = &[EXSAT_MAINNET, EXSAT_TESTNET, ARBITRUM_ONE];

/// Every Antelope rail the signer knows about.
pub const ANTELOPE_CHAINS: &[AntelopeChain] = &[VAULTA_MAINNET];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinned_ids_match_the_live_readings_of_2026_07_30() {
        assert_eq!(EXSAT_MAINNET.chain_id, 7200, "exSat mainnet: eth_chainId 0x1c20");
        assert_eq!(ARBITRUM_ONE.chain_id, 42161, "Arbitrum One: eth_chainId 0xa4b1");
        assert_eq!(
            VAULTA_MAINNET.chain_id_hex,
            "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906", // PUBLIC-CONSTANT
            "Vaulta mainnet get_info.chain_id"
        );
    }

    #[test]
    fn matching_chain_id_verifies() {
        let v = EXSAT_MAINNET.verify_chain_id(7200).expect("7200 matches the pin");
        assert_eq!(v.chain_id(), 7200);
        assert_eq!(v.chain().name, "exSat mainnet");
    }

    #[test]
    fn wrong_chain_id_is_refused() {
        // The real failure this prevents: an RPC URL that looks like exSat but
        // answers as something else.
        let err = EXSAT_MAINNET.verify_chain_id(1).unwrap_err();
        assert_eq!(
            err,
            ChainError::ChainIdMismatch { chain: "exSat mainnet", pinned: 7200, observed: 1 }
        );
    }

    #[test]
    fn arbitrum_does_not_verify_as_exsat() {
        assert!(EXSAT_MAINNET.verify_chain_id(42161).is_err());
        assert!(ARBITRUM_ONE.verify_chain_id(7200).is_err());
    }

    #[test]
    fn unverified_chain_refuses_even_a_plausible_reading() {
        // exSat testnet has no sourced id, so nothing verifies it — not even a
        // value that happens to be correct. It must be sourced first.
        let err = EXSAT_TESTNET.verify_chain_id(839999).unwrap_err();
        assert!(matches!(err, ChainError::Unverified { chain: "exSat testnet", .. }));
    }

    #[test]
    fn every_pinned_chain_declares_its_provenance() {
        for c in EVM_CHAINS {
            match c.provenance {
                Provenance::VerifiedLive(d) => assert!(!d.is_empty()),
                Provenance::Unverified(r) => assert!(!r.is_empty(), "must say why"),
            }
        }
    }
}
