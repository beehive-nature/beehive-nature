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
    /// Burn/transfer/reserve would exceed the holder's **spendable** balance
    /// (`balance − reserved`). `have` is the spendable amount available.
    InsufficientBalance { have: Amount, need: Amount },
    /// Unreserve would release more than is currently reserved.
    InsufficientReserved { reserved: Amount, need: Amount },
    /// A proof of resource contribution did not verify (mint refused).
    UnprovenMint,
    /// The emission witness time precedes one this ledger has already accepted.
    /// Genesis is the anchor a higher crate derives "time in system" from, so a
    /// mint that moves it earlier manufactures tenure. Refused, never clamped.
    BackdatedMint { at: i64, watermark: i64 },
}

impl std::fmt::Display for LedgerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LedgerError::InsufficientBalance { have, need } => {
                write!(f, "insufficient spendable b: have {have}, need {need}")
            }
            LedgerError::InsufficientReserved { reserved, need } => {
                write!(f, "cannot unreserve {need}: only {reserved} reserved")
            }
            LedgerError::UnprovenMint => write!(f, "resource proof did not verify; mint refused"),
            LedgerError::BackdatedMint { at, watermark } => write!(
                f,
                "mint witness time {at} precedes the ledger watermark {watermark}; \
                 genesis is not backdatable"
            ),
        }
    }
}

impl std::error::Error for LedgerError {}

/// The `b` balance ledger — transferable, spendable energy.
///
/// **Holds (`reserved`) and the mint history (`minted_to_date`) live here because the
/// authoritative number lives where the fact is created, not where it is consumed (RELAY_16).**
/// The ledger enforces its own `spendable = balance − reserved` invariant on every spend, so a
/// hold placed by a higher crate (e.g. a `treasury-t0` lien) cannot be spent out from under —
/// from any crate, present or future. `reserved` is **purpose-blind**: the ledger records *that*
/// `b` is held, never *why*. The dependency edge stays downward (Article III Rule 4).
/// The proof gate is **ledger state chosen at construction, not a call argument**, so it
/// shows up in a diff at one greppable place and a caller cannot hand in a permissive one
/// at the point of minting. It defaults to [`MintGate::Refuse`], so a ledger built without
/// an explicit decision — including one deserialised from bytes that omit the field —
/// mints nothing.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BLedger {
    balances: BTreeMap<Did, Amount>,
    /// Held `b`: not spendable, not moved, still the holder's. Generic — no lien/treasury.
    #[serde(default)]
    reserved: BTreeMap<Did, Amount>,
    /// Total `b` ever minted to a DID. **Monotonic — incremented at mint, never decremented.**
    /// Burning or forfeiting `b` does not shrink your future capacity; gifted `b` never raises
    /// the recipient's base. It is the honest base for any minted-to-date policy.
    #[serde(default)]
    minted_to_date: BTreeMap<Did, Amount>,
    /// The witness time (unix seconds) of a DID's **first** mint — its `EmissionMinted` genesis
    /// on the bus. **Write-once: the first accepted mint sets it and nothing moves it.** This is
    /// the immutable anchor a higher crate derives "time in system" from (RELAY_16): the thread
    /// supplies no age. It previously settled to the *minimum* `at` seen, which is how one extra
    /// mint of one atomic unit could manufacture twenty years of tenure.
    #[serde(default)]
    first_minted_at: BTreeMap<Did, i64>,
    /// Highest emission witness time this ledger has ever accepted. `mint` refuses any
    /// `at` below it, so genesis moves forward with the bus and never backwards.
    #[serde(default)]
    genesis_watermark: Option<i64>,
    /// The proof gate. Absent from older serialised ledgers, so it defaults to `Refuse`.
    #[serde(default)]
    gate: MintGate,
}

impl BLedger {
    /// A ledger that mints nothing. Choosing a gate is [`BLedger::with_gate`] — an
    /// explicit, greppable act, not a default anyone inherits by accident.
    pub fn new() -> Self {
        Self::default()
    }

    /// Build a ledger with `gate` as its proof gate for its whole life.
    pub fn with_gate(gate: MintGate) -> Self {
        BLedger {
            gate,
            ..Self::default()
        }
    }

    /// The gate this ledger mints under.
    pub fn gate(&self) -> MintGate {
        self.gate
    }

    /// The highest emission witness time accepted so far, if any mint has landed.
    pub fn genesis_watermark(&self) -> Option<i64> {
        self.genesis_watermark
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

    /// Mint `amount` of `b` to `who` on a verified ResourceProof (mint-on-ResourceProof), at the
    /// emission's witness time `at` (unix seconds — the `EmissionMinted` event's timestamp).
    /// Verification is the verifier's job; this refuses to mint on an unverified proof.
    pub fn mint(
        &mut self,
        who: &Did,
        amount: Amount,
        proof: &ResourceProof,
        at: i64,
    ) -> Result<(), LedgerError> {
        // The gate is the ledger's own, fixed at construction. There is no parameter
        // here for a caller to satisfy it with.
        if !self.gate.admits(proof) {
            return Err(LedgerError::UnprovenMint);
        }
        // Genesis moves forward with the bus, never backwards. Refused, not clamped:
        // silently taking the minimum is what let a later mint rewrite tenure. Founder
        // ruling 2026-08-05 (World A): time never moves backward here, so an earlier `at`
        // is a violation of the bTiMeLiNe keystone rather than a replay to accommodate.
        // There is deliberately no legitimate-replay lane — see the test for the wording.
        if let Some(w) = self.genesis_watermark {
            if at < w {
                return Err(LedgerError::BackdatedMint { at, watermark: w });
            }
        }
        self.genesis_watermark = Some(at);
        let e = self.balances.entry(who.clone()).or_insert(0);
        *e = e.saturating_add(amount);
        // EmissionMinted is settlement-class; the per-DID mint total is its cache. Monotonic:
        // this is the ONLY place minted-to-date rises, and nothing lowers it.
        let m = self.minted_to_date.entry(who.clone()).or_insert(0);
        *m = m.saturating_add(amount);
        // The genesis anchor: WRITE-ONCE. The previous `.and_modify(|t| *t = (*t).min(at))`
        // meant any later mint carrying an earlier `at` rewrote it, so one extra mint of a
        // single atomic unit could move a DID's "time in system" back two decades.
        self.first_minted_at.entry(who.clone()).or_insert(at);
        Ok(())
    }

    /// `b` held (reserved) against `who`'s balance — not spendable, still theirs.
    pub fn reserved_of(&self, who: &Did) -> Amount {
        self.reserved.get(who).copied().unwrap_or(0)
    }

    /// The witness time of `who`'s first mint (their `EmissionMinted` genesis), if any. The
    /// immutable anchor for "time in system" — a higher crate derives age from `now − this`.
    pub fn first_minted_at_of(&self, who: &Did) -> Option<i64> {
        self.first_minted_at.get(who).copied()
    }

    /// `b` `who` may actually spend: balance minus what is held. Every spend checks this.
    pub fn spendable_of(&self, who: &Did) -> Amount {
        self.balance_of(who).saturating_sub(self.reserved_of(who))
    }

    /// Total `b` ever minted to `who` (monotonic base for minted-to-date policies).
    pub fn minted_to_date_of(&self, who: &Did) -> Amount {
        self.minted_to_date.get(who).copied().unwrap_or(0)
    }

    /// Place a hold on `who`'s `b`. Refuses above **spendable** (a hold cannot exceed what is
    /// free after existing holds). Purpose-blind: the ledger records the hold, never why.
    pub fn reserve(&mut self, who: &Did, amount: Amount) -> Result<(), LedgerError> {
        let spendable = self.spendable_of(who);
        if spendable < amount {
            return Err(LedgerError::InsufficientBalance {
                have: spendable,
                need: amount,
            });
        }
        let e = self.reserved.entry(who.clone()).or_insert(0);
        *e = e.saturating_add(amount);
        Ok(())
    }

    /// Release a hold, making that `b` spendable again. Refuses releasing more than is held.
    pub fn unreserve(&mut self, who: &Did, amount: Amount) -> Result<(), LedgerError> {
        let reserved = self.reserved_of(who);
        if reserved < amount {
            return Err(LedgerError::InsufficientReserved {
                reserved,
                need: amount,
            });
        }
        let e = self.reserved.entry(who.clone()).or_insert(0);
        *e -= amount;
        Ok(())
    }

    /// Burn `amount` of `b` from `who` (burn-on-use). Checks **spendable**, never raw balance —
    /// held `b` cannot be burned out from under a reservation.
    pub fn burn(&mut self, who: &Did, amount: Amount) -> Result<(), LedgerError> {
        let have = self.spendable_of(who);
        if have < amount {
            return Err(LedgerError::InsufficientBalance { have, need: amount });
        }
        let e = self.balances.entry(who.clone()).or_insert(0);
        *e -= amount;
        Ok(())
    }

    /// Transfer `amount` of `b` from `from` to `to` — `b` is transferable. Checks **spendable**,
    /// so reserved `b` can never be transferred away.
    pub fn transfer(&mut self, from: &Did, to: &Did, amount: Amount) -> Result<(), LedgerError> {
        let have = self.spendable_of(from);
        if have < amount {
            return Err(LedgerError::InsufficientBalance { have, need: amount });
        }
        if from == to {
            return Ok(()); // no-op self-transfer, already covered by spendable check
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

/// Which proof gate a [`BLedger`] mints under — **its own state, set once at
/// construction.** A closed enum rather than an injected trait object, so the set of
/// gates that exist anywhere is enumerable at a glance and a caller has no argument
/// position through which to supply one.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum MintGate {
    /// Refuses every proof. The default, including for a ledger deserialised from
    /// bytes that predate this field.
    #[default]
    Refuse,
    /// Dev/test gate: admits any non-empty evidence reference. NOT production —
    /// reaching it requires writing `BLedger::with_gate(MintGate::AcceptNonEmptyEvidence)`,
    /// one greppable line where the ledger is built.
    AcceptNonEmptyEvidence,
}

impl MintGate {
    fn admits(self, proof: &ResourceProof) -> bool {
        match self {
            MintGate::Refuse => RefusingVerifier.verify(proof),
            MintGate::AcceptNonEmptyEvidence => AcceptNonEmptyProof.verify(proof),
        }
    }
}

/// The verifier behind [`MintGate::Refuse`]: refuses every proof. Real verification is
/// adapter work and lands as its own `ProofVerifier` plus a `MintGate` variant.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RefusingVerifier;

impl ProofVerifier for RefusingVerifier {
    fn verify(&self, _proof: &ResourceProof) -> bool {
        false
    }
}

/// Test/dev verifier that accepts any non-empty evidence reference. NOT for
/// production — a real verifier checks the evidence against the kernel.
///
/// Deliberately **not** `#[cfg]`-gated: gating it would break three dependent crates,
/// which is outside the GO order's scope fence. Reaching it now requires writing
/// `BLedger::with_gate(MintGate::AcceptNonEmptyEvidence)` — one greppable line at construction,
/// which is what the fix is for. Gating it is a candidate for its own dispatch.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
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

    /// A fixed mint witness time for tests not concerned with genesis timing.
    const AT: i64 = 1_700_000_000;

    /// A ledger whose gate accepts non-empty evidence — the shape most tests want.
    fn dev_ledger() -> BLedger {
        BLedger::with_gate(MintGate::AcceptNonEmptyEvidence)
    }

    // ── GO_ORDER_THREE_BUGS_2026-08-07 · guards ──────────────────────────────
    // Each replaces an exploit test that PASSED against the pre-fix code. The
    // exploit output is in the receipt; these are what stand watch now.

    #[test]
    fn genesis_cannot_be_backdated() {
        // BUG 2. Was: `first_minted_at` took `(*t).min(at)`, so ANY later mint with an
        // earlier `at` rewrote genesis — one extra mint of a single atomic unit moved a
        // DID's "time in system" back twenty years. Now: refused at the watermark, and
        // the anchor is write-once so it could not move even if the mint were allowed.
        let mut l = dev_ledger();
        let a = did("did:autonomi:a");
        const TWENTY_YEARS: i64 = 20 * 365 * 24 * 3600;

        l.mint(&a, 1, &proof("honest"), AT).unwrap();
        assert_eq!(l.first_minted_at_of(&a), Some(AT));

        assert_eq!(
            l.mint(&a, 1, &proof("backdated"), AT - TWENTY_YEARS),
            Err(LedgerError::BackdatedMint {
                at: AT - TWENTY_YEARS,
                watermark: AT
            })
        );
        assert_eq!(l.first_minted_at_of(&a), Some(AT), "anchor did not move");
        assert_eq!(l.balance_of(&a), 1, "the backdated mint did not land either");

        // Forward is fine, and does not disturb the anchor.
        l.mint(&a, 1, &proof("later"), AT + 60).unwrap();
        assert_eq!(l.first_minted_at_of(&a), Some(AT));
        assert_eq!(l.genesis_watermark(), Some(AT + 60));
    }

    #[test]
    fn mint_gate_is_not_caller_supplied() {
        // BUG 3. Was: `mint` took `verifier: &dyn ProofVerifier` from the caller, so the
        // calling crate supplied the invariant meant to constrain it — pass anything that
        // returns true and mint 420e18 against empty evidence. Now the gate is a type
        // parameter fixed at construction; there is no argument to satisfy it with.
        let mut l = BLedger::new(); // default gate
        let a = did("did:autonomi:a");
        assert_eq!(
            l.mint(&a, 420_000_000_000_000_000_000, &proof("looks-fine"), AT),
            Err(LedgerError::UnprovenMint),
            "a ledger built without an explicit gate mints nothing"
        );
        assert_eq!(l.balance_of(&a), 0);

        // A ledger deserialised from bytes that predate the gate field comes back
        // refusing, not permissive — `#[serde(default)]` over `MintGate::Refuse`. An
        // older ledger restored into newer code does not silently acquire a gate.
        let legacy = r#"{"balances":{"did:autonomi:a":10},"reserved":{},
                         "minted_to_date":{"did:autonomi:a":10},
                         "first_minted_at":{"did:autonomi:a":1700000000}}"#;
        let mut restored: BLedger = serde_json::from_str(legacy).unwrap();
        assert_eq!(restored.balance_of(&a), 10, "balances survive");
        assert_eq!(restored.gate(), MintGate::Refuse, "and the gate fails closed");
        assert_eq!(
            restored.mint(&a, 1, &proof("e"), AT + 1),
            Err(LedgerError::UnprovenMint)
        );
    }

    #[test]
    fn b_mints_only_on_a_verified_proof() {
        let mut l = dev_ledger();
        // empty evidence → unproven → refused
        assert_eq!(
            l.mint(&did("did:autonomi:a"), 500, &proof(""), AT),
            Err(LedgerError::UnprovenMint)
        );
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 0);
        // valid proof → minted
        l.mint(&did("did:autonomi:a"), 500, &proof("evidence-1"), AT)
            .unwrap();
        assert_eq!(l.balance_of(&did("did:autonomi:a")), 500);
    }

    #[test]
    fn b_burns_on_use_and_guards_balance() {
        let mut l = dev_ledger();
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), AT)
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
        let mut l = dev_ledger();
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), AT)
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
        let mut l = dev_ledger();
        l.mint(&did("did:autonomi:a"), 100, &proof("e"), AT)
            .unwrap();
        let json = serde_json::to_string(&l).unwrap();
        // The gate rides along as ordinary state; what matters for this test is that the
        // accounting fields survive intact.
        let back: BLedger = serde_json::from_str(&json).unwrap();
        assert_eq!(l, back);
    }

    // ── RELAY_16 · reserved holds + monotonic minted-to-date ─────────────────

    #[test]
    fn reserved_b_is_held_and_no_spend_can_touch_it() {
        let mut l = dev_ledger();
        let a = did("did:autonomi:a");
        let b = did("did:autonomi:b");
        l.mint(&a, 100, &proof("e"), AT).unwrap();
        l.reserve(&a, 60).unwrap();
        assert_eq!(l.spendable_of(&a), 40);
        assert_eq!(
            l.balance_of(&a),
            100,
            "a hold moves no b — it is still theirs"
        );
        // cannot reserve, burn, or transfer into the held 60.
        assert_eq!(
            l.reserve(&a, 41),
            Err(LedgerError::InsufficientBalance { have: 40, need: 41 })
        );
        assert_eq!(
            l.burn(&a, 41),
            Err(LedgerError::InsufficientBalance { have: 40, need: 41 })
        );
        assert_eq!(
            l.transfer(&a, &b, 41),
            Err(LedgerError::InsufficientBalance { have: 40, need: 41 })
        );
        // within spendable, both work; the held 60 stays put.
        l.burn(&a, 20).unwrap();
        l.transfer(&a, &b, 20).unwrap();
        assert_eq!(l.balance_of(&a), 60);
        assert_eq!(l.spendable_of(&a), 0, "all remaining b is held");
        // unreserve frees it; over-unreserve refuses.
        assert_eq!(
            l.unreserve(&a, 61),
            Err(LedgerError::InsufficientReserved {
                reserved: 60,
                need: 61
            })
        );
        l.unreserve(&a, 60).unwrap();
        assert_eq!(l.spendable_of(&a), 60);
    }

    #[test]
    fn minted_to_date_is_monotonic_and_equals_emission_replay() {
        // minted_to_date is the per-DID cache of EmissionMinted; the log here is the mint
        // sequence. The counter must equal the replay-sum and never fall — burning, transferring,
        // reserving, or an unproven mint must not change it.
        let mut l = dev_ledger();
        let a = did("did:autonomi:a");
        let b = did("did:autonomi:b");
        let log = [(&a, 100u128), (&b, 50), (&a, 25), (&a, 75), (&b, 10)];
        let mut replay: BTreeMap<Did, Amount> = BTreeMap::new();
        for (who, amt) in log {
            l.mint(who, amt, &proof("e"), AT).unwrap();
            *replay.entry((*who).clone()).or_insert(0) += amt;
        }
        // counter == replay-sum, per DID.
        assert_eq!(l.minted_to_date_of(&a), replay[&a]);
        assert_eq!(l.minted_to_date_of(&b), replay[&b]);
        assert_eq!(l.minted_to_date_of(&a), 200);
        // spending down must NOT lower the base (this is why the base is minted, not held).
        l.burn(&a, 150).unwrap();
        l.transfer(&a, &b, 20).unwrap();
        l.reserve(&a, 10).unwrap();
        assert_eq!(
            l.minted_to_date_of(&a),
            200,
            "burn/transfer/reserve never lower minted-to-date"
        );
        assert!(
            l.balance_of(&a) < l.minted_to_date_of(&a),
            "balance fell; the base did not"
        );
        // gifted b raises the recipient's balance but never their base.
        let before = l.minted_to_date_of(&b);
        l.transfer(&a, &b, 5).unwrap();
        assert_eq!(
            l.minted_to_date_of(&b),
            before,
            "a gift raises balance, never the base"
        );
        // an unproven mint raises nothing.
        let _ = l.mint(&a, 999, &proof(""), AT);
        assert_eq!(
            l.minted_to_date_of(&a),
            200,
            "an unproven mint raises no base"
        );
    }

    #[test]
    fn first_minted_at_is_write_once_and_nothing_moves_it() {
        // The genesis anchor: the DID's FIRST EmissionMinted witness time, WRITE-ONCE.
        //
        // CHANGED by GO_ORDER_THREE_BUGS_2026-08-07. This test previously asserted that
        // "an EARLIER mint (out-of-order replay) settles it back to the true earliest"
        // and that "genesis is the minimum, not the first call". That rule and the
        // backdating vector are the SAME mechanism: taking the minimum is exactly how a
        // caller manufactures twenty years of tenure with one extra mint of one atomic
        // unit. The old rule is recorded here rather than deleted.
        //
        // FOUNDER RULING 2026-08-05 (World A, chronological) — the escalation this seat
        // raised is CLOSED: "b records identity tenure chronologically, forward-only; time
        // never moves backward. An EmissionMinted claiming an earlier start than what is
        // recorded is refused, always — it is not a legitimate replay, it is a violation of
        // the bTiMeLiNe keystone. No replay lane is built; building one would put a door in
        // the one wall that must have none."
        //
        // So backdating and "out-of-order arrival" are the same thing wearing different
        // clothes, and both are what an eternally-forward runtime must reject. The refusal
        // is not a conservative default awaiting a better answer — it enforces the keystone.
        let mut l = dev_ledger();
        let a = did("did:autonomi:a");
        assert_eq!(l.first_minted_at_of(&a), None, "no mint, no genesis");
        l.mint(&a, 100, &proof("e"), 5_000).unwrap();
        assert_eq!(l.first_minted_at_of(&a), Some(5_000));
        // a later mint does not move the genesis forward.
        l.mint(&a, 50, &proof("e"), 9_000).unwrap();
        assert_eq!(
            l.first_minted_at_of(&a),
            Some(5_000),
            "a later mint never moves genesis"
        );
        // an EARLIER mint is now REFUSED rather than silently rewriting the anchor.
        assert_eq!(
            l.mint(&a, 10, &proof("e"), 2_000),
            Err(LedgerError::BackdatedMint {
                at: 2_000,
                watermark: 9_000
            })
        );
        assert_eq!(
            l.first_minted_at_of(&a),
            Some(5_000),
            "genesis is the first call, and it did not move"
        );
        // spending does not touch it.
        l.burn(&a, 20).unwrap();
        assert_eq!(
            l.first_minted_at_of(&a),
            Some(5_000),
            "burning never moves genesis"
        );
    }
}
