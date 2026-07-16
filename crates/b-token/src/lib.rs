//! `resource.accounting` core (Phase 3 scaffold) — the `b` / Respect model.
//!
//! Two tokens, deliberately different **types** so the distinction the founder
//! insisted on is enforced by the compiler, not by convention:
//!
//! - **`b`** is transferable, Vaulta-native **energy**: the fuel required to
//!   generate a new state in the BNR kernel. Minted on a ResourceProof, burned
//!   on use, and freely spendable/transferable. Modeled here as a balance
//!   [`BLedger`] with `mint` / `burn` / `transfer`.
//! - **Respect** is **non-transferable** standing bound to a unique human
//!   (Sybil-resistance). It is NOT a cash balance; it *modulates the rate at
//!   which `b` unlocks* for that human. Modeled as [`RespectBook`], which
//!   exposes `award` but — by design — **no transfer method exists**. You
//!   cannot move Respect between DIDs because the type offers no way to.
//!
//! Scope of this scaffold (compile-safe, fully tested): the accounting core —
//! balances, transfers, standing, and the Respect→unlock-rate function. What is
//! pending: ResourceProof *verification* (behind [`ProofVerifier`]) and the
//! paymaster basket that acquires external resources (Vaulta RAM/CPU/NET, ZANO,
//! AR, ANT) — those are adapter work, gated behind traits, never a panic.
//!
//! `b` is accounted kernel-side (SPIRIT-1). It is never an EVM token, never
//! bridged, never gas — that is BNRi, a separate EVM-layer artifact.

#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use capability::Did;
use serde::{Deserialize, Serialize};

/// `b` amount in atomic units (u128 headroom for a 10-billion-user economy).
pub type Amount = u128;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LedgerError {
    /// Burn/transfer would exceed the holder's balance.
    InsufficientBalance { have: Amount, need: Amount },
    /// A proof of resource contribution did not verify (mint refused).
    UnprovenMint,
}

impl std::fmt::Display for LedgerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LedgerError::InsufficientBalance { have, need } => {
                write!(f, "insufficient b: have {have}, need {need}")
            }
            LedgerError::UnprovenMint => write!(f, "resource proof did not verify; mint refused"),
        }
    }
}

impl std::error::Error for LedgerError {}

/// The `b` balance ledger — transferable, spendable energy.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BLedger {
    balances: BTreeMap<Did, Amount>,
}

impl BLedger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn balance_of(&self, who: &Did) -> Amount {
        self.balances.get(who).copied().unwrap_or(0)
    }

    /// Total `b` in existence (sum of balances) — saturating.
    pub fn supply(&self) -> Amount {
        self.balances
            .values()
            .fold(0u128, |acc, v| acc.saturating_add(*v))
    }

    /// Mint `amount` of `b` to `who` on a verified ResourceProof (mint-on-
    /// ResourceProof). Verification is the verifier's job; this refuses to mint
    /// on an unverified proof.
    pub fn mint(
        &mut self,
        who: &Did,
        amount: Amount,
        proof: &ResourceProof,
        verifier: &dyn ProofVerifier,
    ) -> Result<(), LedgerError> {
        if !verifier.verify(proof) {
            return Err(LedgerError::UnprovenMint);
        }
        let e = self.balances.entry(who.clone()).or_insert(0);
        *e = e.saturating_add(amount);
        Ok(())
    }

    /// Burn `amount` of `b` from `who` (burn-on-use — a kernel state transition
    /// consumed this energy).
    pub fn burn(&mut self, who: &Did, amount: Amount) -> Result<(), LedgerError> {
        let have = self.balance_of(who);
        if have < amount {
            return Err(LedgerError::InsufficientBalance { have, need: amount });
        }
        let e = self.balances.entry(who.clone()).or_insert(0);
        *e -= amount;
        Ok(())
    }

    /// Transfer `amount` of `b` from `from` to `to` — `b` is transferable.
    pub fn transfer(&mut self, from: &Did, to: &Did, amount: Amount) -> Result<(), LedgerError> {
        let have = self.balance_of(from);
        if have < amount {
            return Err(LedgerError::InsufficientBalance { have, need: amount });
        }
        if from == to {
            return Ok(()); // no-op self-transfer, already covered by balance check
        }
        *self.balances.entry(from.clone()).or_insert(0) -= amount;
        let e = self.balances.entry(to.clone()).or_insert(0);
        *e = e.saturating_add(amount);
        Ok(())
    }
}

/// Non-transferable standing bound to a unique human (Sybil-resistance).
///
/// The whole point of this type is what it does **not** offer: there is no
/// `transfer`, no way to move a score from one DID to another. Respect can only
/// be `award`ed to (and read from) the human who earned it. It is not cash.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RespectBook {
    standing: BTreeMap<Did, u64>,
}

impl RespectBook {
    pub fn new() -> Self {
        Self::default()
    }

    /// Read a human's Respect standing (0 if none).
    pub fn standing_of(&self, who: &Did) -> u64 {
        self.standing.get(who).copied().unwrap_or(0)
    }

    /// Award Respect to the human who earned it (contribution, fractally
    /// lineage). Saturating. There is intentionally no counterpart that moves
    /// Respect *between* DIDs.
    pub fn award(&mut self, who: &Did, amount: u64) {
        let e = self.standing.entry(who.clone()).or_insert(0);
        *e = e.saturating_add(amount);
    }

    /// The `b`-unlock rate this human's standing grants — Respect *modulates
    /// the rate at which `b` unlocks*. A base rate everyone gets, plus a bonus
    /// scaled by Respect. Pure and monotonic: more Respect never lowers the
    /// rate. Units are "b atomic units per unlock period" — the period and the
    /// exact curve are governance parameters (see [`UnlockParams`]).
    pub fn unlock_rate(&self, who: &Did, params: &UnlockParams) -> Amount {
        let respect = self.standing_of(who) as u128;
        params
            .base_rate
            .saturating_add(respect.saturating_mul(params.respect_multiplier))
    }
}

/// Governance-set parameters for the Respect→b-unlock curve. Kept explicit (not
/// hardcoded constants) because these are Article-VI-class knobs, not magic
/// numbers baked into the accounting core.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnlockParams {
    /// `b` per period every human unlocks regardless of Respect.
    pub base_rate: Amount,
    /// Additional `b` per period per unit of Respect.
    pub respect_multiplier: Amount,
}

impl Default for UnlockParams {
    fn default() -> Self {
        // Placeholder curve — the real values are a governance decision. Chosen
        // only so the type has a usable default in tests; not an endorsement.
        UnlockParams {
            base_rate: 100,
            respect_multiplier: 10,
        }
    }
}

/// Opaque evidence that a real resource contribution occurred (the thing that
/// justifies minting `b`). Its fields are deliberately minimal here; the real
/// proof shape and its verification land with the paymaster/adapter work.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceProof {
    /// Opaque reference to the contribution evidence (e.g. an Evidence hash).
    pub evidence_ref: String,
}

/// Verifies a [`ResourceProof`] before `b` is minted. The pending step (real
/// proof checking) lives behind this trait, never in a shipped panic path.
pub trait ProofVerifier {
    fn verify(&self, proof: &ResourceProof) -> bool;
}

/// Test/dev verifier that accepts any non-empty evidence reference. NOT for
/// production — a real verifier checks the evidence against the kernel.
#[derive(Debug, Default)]
pub struct AcceptNonEmptyProof;

impl ProofVerifier for AcceptNonEmptyProof {
    fn verify(&self, proof: &ResourceProof) -> bool {
        !proof.evidence_ref.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn did(s: &str) -> Did {
        Did::new(s)
    }

    fn proof(r: &str) -> ResourceProof {
        ResourceProof {
            evidence_ref: r.into(),
        }
    }

    #[test]
    fn b_mints_only_on_a_verified_proof() {
        let mut l = BLedger::new();
        let v = AcceptNonEmptyProof;
        // empty evidence → unproven → refused
        assert_eq!(
            l.mint(&did("did:autonomi:a"), 500, &proof(""), &v),
            Err(LedgerError::UnprovenMint)
        );
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 0);
        // valid proof → minted
        l.mint(&did("did:autonomi:a"), 500, &proof("evidence-1"), &v)
            .unwrap();
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 500);
    }

    #[test]
    fn b_burns_on_use_and_guards_balance() {
        let mut l = BLedger::new();
        let v = AcceptNonEmptyProof;
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), &v)
            .unwrap();
        l.burn(&did("did:autonomi:a"), 40).unwrap();
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 60);
        assert_eq!(
            l.burn(&did("did:autonomi:a"), 61),
            Err(LedgerError::InsufficientBalance { have: 60, need: 61 })
        );
    }

    #[test]
    fn b_is_transferable() {
        let mut l = BLedger::new();
        let v = AcceptNonEmptyProof;
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), &v)
            .unwrap();
        l.transfer(&did("did:autonomi:a"), &did("did:autonomi:b"), 30)
            .unwrap();
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 70);
        assert_eq!(l.balance_of(&did("did:autonomi:b")), 30);
        // supply is conserved by a transfer
        assert_eq!(l.supply(), 100);
    }

    #[test]
    fn transfer_guards_insufficient_balance() {
        let mut l = BLedger::new();
        assert_eq!(
            l.transfer(&did("did:autonomi:a"), &did("did:autonomi:b"), 1),
            Err(LedgerError::InsufficientBalance { have: 0, need: 1 })
        );
    }

    #[test]
    fn respect_is_awarded_not_transferred() {
        // The compiler enforces non-transferability: RespectBook has no
        // transfer method. This test documents the property and exercises award.
        let mut r = RespectBook::new();
        r.award(&did("did:autonomi:a"), 5);
        r.award(&did("did:autonomi:a"), 3);
        assert_eq!(r.standing_of(&did("did:autonomi:a")), 8);
        assert_eq!(r.standing_of(&did("did:autonomi:b")), 0);
    }

    #[test]
    fn respect_modulates_the_b_unlock_rate() {
        let mut r = RespectBook::new();
        let params = UnlockParams::default(); // base 100, mult 10
        let a = did("did:autonomi:a");
        let b = did("did:autonomi:b");
        // no respect → base rate only
        assert_eq!(r.unlock_rate(&a, &params), 100);
        // award respect → rate rises monotonically
        r.award(&a, 4);
        assert_eq!(r.unlock_rate(&a, &params), 100 + 4 * 10);
        // someone with more respect unlocks b faster
        r.award(&b, 10);
        assert!(r.unlock_rate(&b, &params) > r.unlock_rate(&a, &params));
    }

    #[test]
    fn ledger_roundtrips_through_json() {
        let mut l = BLedger::new();
        let v = AcceptNonEmptyProof;
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), &v)
            .unwrap();
        let json = serde_json::to_string(&l).unwrap();
        let back: BLedger = serde_json::from_str(&json).unwrap();
        assert_eq!(l, back);
    }
}
