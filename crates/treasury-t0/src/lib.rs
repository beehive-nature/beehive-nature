//! `treasury-t0` — the Treasury smartCONTRACT (T-0): `b` as collateral, lock-and-burn.
//!
//! **TYPES + CONSTITUTIONAL CONTROLS. Live rails wait on counsel; the controls do not.**
//!
//! This is the ONE treasury leg that touches `b`, which is why it is **kernel-side**
//! (SPIRIT-1: `b` is accounted kernel-side, never bridged) and not in the permissive accord
//! `treasury` crate (T-1..T-5, which hold no `b`). Per **RELAY_08 lock-and-burn**: T-0 places
//! a **lien on the thread's OWN `b` balance**; a forfeit **BURNS** the locked `b`; there is
//! **no pool purse** — T-0 custodies no `b` in a pot, so it cannot absorb cost.
//!
//! # The three conditions, encoded as pre-compile negative controls (RELAY_09 §5)
//!
//! - **C-i (GOV-1):** a lien confers **zero** governance effect — no Respect, no weight, no
//!   priority, no queue position. This type touches no `RespectBook` and exposes no ordering
//!   or weight; the control `c_i_lock_confers_no_respect_or_unlock_change` proves it.
//! - **C-ii (Art V §1 + Art IV):** non-absorption. T-0 holds no `b`; a forfeit burns only the
//!   debtor's own reserved `b`. Under RELAY_16 the "drain below the lien" case is now
//!   **impossible**, not merely refused — the ledger's reservation cannot be spent
//!   (`c_ii_reserved_b_cannot_be_drained_so_forfeit_never_shortfalls`).
//! - **C-iii (BIND-1 §6, R-004):** release and forfeit require a [`SettlementAuthorization`]
//!   constructible **only** from `ViewGrade::Settlement` with **≥2 independent sources** —
//!   mirroring `dro-signer`'s R-004 boundary.
//!
//! # Phase 2 — the protective constraints (RELAY_15), the half that guards the human
//!
//! The caps are **unconditional** — [`LienBook::lock`] cannot be called without the thread's
//! age, and it reads the collateral base ([`ThreadStanding`]) from the ledger, so neither the
//! base nor the caps can be bypassed. Stronger than a feature gate: they cannot be compiled out.
//!
//! - **The 20% function floor (LAW, RELAY_05 §T-0):** 20% of minted-to-date can **never** be
//!   collateralized — no one can be liquidated out of operating their own OSe. 80% ceiling,
//!   forever; the check is **cumulative** (RELAY_08 §3). Not DAO-tunable.
//! - **The maturation schedule (anti-predation):** base = minted-to-date; 10% year one, +10
//!   points/year, 80% ceiling. A day-one onboardee **cannot** lock their whole grant. Increments
//!   DAO-tunable ([`MaturationParams`]); the schedule's existence is not.
//! - **The one-room law:** [`assert_no_b_custody`] refuses any `b`-holding contract (decoy-tested).
//! - **No oracle / price-feed / market dependency:** [`dependency::forbidden_findings`], with a
//!   positive control that watches it fail first.
//!
//! # RELAY_16 — the authoritative number lives where the fact is created
//!
//! Two holes were closed by moving the number **down** to `b-token`, never inverting the
//! dependency edge (Article III Rule 4):
//!
//! - **The lien-enforcement seam is now structural, not remembered.** `lock`/`release`/`forfeit`
//!   call [`b_token::BLedger::reserve`]/`unreserve`; the ledger enforces `spendable = balance −
//!   reserved` on every spend, so reserved `b` **cannot be spent out from under a lien — from any
//!   crate.** Bypass is *impossible*, not *forbidden-by-lint*: the guarded-spend wrappers and the
//!   source lint of phase 2 are **deleted**, because there is no unguarded path left to guard.
//! - **The collateral base is read from the ledger, never passed.** [`ThreadStanding::from_ledger`]
//!   reads `minted_to_date` from `b-token` (monotonic, minted-only), so a caller cannot inflate
//!   their own cap. The one number still supplied by the caller — thread age — is the next
//!   anchoring dependency (it should come from the identity root's genesis Event).

#![forbid(unsafe_code)]

use std::collections::BTreeSet;

use b_token::{Amount, BLedger, LedgerError};
use capability::Did;
use serde::{Deserialize, Serialize};
use shared_types::{Evidence, ViewGrade};

/// Every refusal here is a fail-closed control — T-0 declines rather than performing the
/// money-adjacent action when a condition is unmet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum T0Refusal {
    /// A lock cannot reserve more than the debtor can currently spend (the ledger refused the hold).
    InsufficientSpendable { spendable: Amount, need: Amount },
    /// No lien with that id.
    NoSuchLien,
    /// The lien is already released or forfeited; resolution is one-shot.
    AlreadyResolved,
    // ── C-iii ──
    /// An Evidence item below Settlement grade tried to reach a T-0 path.
    BelowSettlementGrade { got: ViewGrade },
    /// A single source (or none) cannot trigger a money-adjacent action (R-004).
    LoneSource { distinct_sources: usize },
    /// Law 1a: a verdict over zero evidence is not a pass.
    NoEvidence,
    // ── C-ii ──
    /// Defensive: a forfeit's burn failed. Unreachable while the ledger's reserved invariant
    /// holds (reserved `b` is unspendable, so a solvent lien can always burn), kept fail-closed.
    CollateralShortfall { locked: Amount, present: Amount },
    // ── phase 2 · protective constraints (RELAY_15) ──
    /// The 20% function floor (LAW): the resulting total collateralized would exceed 80% of
    /// minted-to-date. 20% can never be collateralized — no one is liquidated out of their OSe.
    BreachesFunctionFloor {
        would_lock: Amount,
        floor_bound: Amount,
    },
    /// The maturation schedule for this thread's age would be exceeded (anti-predation).
    ExceedsMaturationLimit {
        would_lock: Amount,
        limit: Amount,
        age_years: u32,
    },
    /// The one-room law: a contract other than the non-custodial facility holds `b` (a pool).
    SecondRoomHoldsB { address: String },
}

/// Authorization to release or forfeit a lien. **Constructible ONLY from Settlement-grade,
/// multi-sourced Evidence (C-iii).** Its fields are private and there is no other constructor,
/// and it derives no `Deserialize`, so a caller cannot fabricate one and no sub-Settlement or
/// lone-source path can produce it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementAuthorization {
    grade: ViewGrade,
    source_count: usize,
}

impl SettlementAuthorization {
    /// The only way to obtain an authorization. Refuses an empty set (Law 1a), any item below
    /// `ViewGrade::Settlement` (C-iii(a)), and fewer than two **independent** sources (C-iii(b) /
    /// R-004). Independence is counted by distinct [`Evidence::source_ref`].
    pub fn from_evidence(items: &[Evidence]) -> Result<Self, T0Refusal> {
        if items.is_empty() {
            return Err(T0Refusal::NoEvidence);
        }
        for e in items {
            if e.view_grade < ViewGrade::Settlement {
                return Err(T0Refusal::BelowSettlementGrade { got: e.view_grade });
            }
        }
        let sources: BTreeSet<&str> = items
            .iter()
            .filter_map(|e| e.source_ref.as_deref())
            .collect();
        if sources.len() < 2 {
            return Err(T0Refusal::LoneSource {
                distinct_sources: sources.len(),
            });
        }
        Ok(SettlementAuthorization {
            grade: ViewGrade::Settlement,
            source_count: sources.len(),
        })
    }

    pub fn source_count(&self) -> usize {
        self.source_count
    }
    pub fn grade(&self) -> ViewGrade {
        self.grade
    }
}

// ── phase 2 · the protective caps (RELAY_15 §4) ─────────────────────────────────

/// LAW (RELAY_05 §T-0): this percent of minted-to-date can **never** be collateralized. Not
/// DAO-tunable — the guarantee that no one is liquidated out of operating their own OSe.
pub const UNCOLLATERALIZABLE_FLOOR_PCT: u32 = 20;

/// A thread's standing for the collateral caps. **Built from the ledger, never passed**
/// (RELAY_16): `minted_to_date` is read from `b-token`, so a thread cannot inflate its own cap.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ThreadStanding {
    /// Total `b` ever minted to this thread — the BASE for both caps. Read from the ledger's
    /// monotonic mint history; **not** the current balance (spending down never shrinks it).
    minted_to_date: Amount,
    /// Whole years the thread has been in the system. Day one is `0` (still in year one).
    age_years: u32,
}

impl ThreadStanding {
    /// Read the collateral base from the ledger (RELAY_16). The only constructor: the base is
    /// the ledger's authoritative `minted_to_date`, not a caller-supplied number. `age_years`
    /// is still a parameter — the next anchoring dependency (identity-root genesis Event).
    pub fn from_ledger(ledger: &BLedger, who: &Did, age_years: u32) -> Self {
        ThreadStanding {
            minted_to_date: ledger.minted_to_date_of(who),
            age_years,
        }
    }

    pub fn minted_to_date(&self) -> Amount {
        self.minted_to_date
    }
    pub fn age_years(&self) -> u32 {
        self.age_years
    }

    /// The eternal 80% ceiling (the 20% floor is LAW): the most `b` that may ever be collateralized.
    pub fn floor_bound(&self) -> Amount {
        let collateralizable = 100u128.saturating_sub(UNCOLLATERALIZABLE_FLOOR_PCT as u128);
        self.minted_to_date.saturating_mul(collateralizable) / 100
    }

    /// The maturation percent for this age: `min(ceiling, year_one + age·per_year)`.
    pub fn maturation_pct(&self, p: &MaturationParams) -> u32 {
        p.year_one_pct
            .saturating_add(self.age_years.saturating_mul(p.per_year_points))
            .min(p.ceiling_pct)
    }

    /// The time-based cap in `b` for this age.
    pub fn maturation_bound(&self, p: &MaturationParams) -> Amount {
        self.minted_to_date
            .saturating_mul(self.maturation_pct(p) as u128)
            / 100
    }

    /// The effective cap: the tighter of the maturation curve and the eternal floor.
    pub fn collateral_cap(&self, p: &MaturationParams) -> Amount {
        self.floor_bound().min(self.maturation_bound(p))
    }
}

/// DAO-tunable maturation increments. The schedule's **existence** is law; the numbers tune.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaturationParams {
    /// Percent collateralizable in year one (day one included).
    pub year_one_pct: u32,
    /// Points added per subsequent whole year.
    pub per_year_points: u32,
    /// Hard ceiling percent — the floor clamps it regardless (see [`ThreadStanding::collateral_cap`]).
    pub ceiling_pct: u32,
}

impl Default for MaturationParams {
    /// 10% year one, +10 points/year, 80% ceiling (RELAY_15 §4.2). Founder-ratified shape.
    fn default() -> Self {
        MaturationParams {
            year_one_pct: 10,
            per_year_points: 10,
            ceiling_pct: 80,
        }
    }
}

// ── phase 2 · the one-room law (RELAY_15 §4.4) ──────────────────────────────────

/// A reference to a contract that may or may not custody `b`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractRef {
    pub address: String,
    pub holds_b: bool,
}

/// The one-room law: T-0 is **non-custodial** — `b` stays with the human until burned, so **no
/// contract may hold `b`**. A contract that does is a second room (a pool), exactly what
/// forfeit-burn exists to avoid. Refuses if ANY contract in the set holds `b`.
pub fn assert_no_b_custody(contracts: &[ContractRef]) -> Result<(), T0Refusal> {
    for c in contracts {
        if c.holds_b {
            return Err(T0Refusal::SecondRoomHoldsB {
                address: c.address.clone(),
            });
        }
    }
    Ok(())
}

// ── the liens ───────────────────────────────────────────────────────────────────

/// A handle to a lien.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct LienId(pub u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LienStatus {
    Active,
    Released,
    Forfeited,
}

/// A single collateral lien: an amount of the debtor's OWN `b` reserved against a condition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Lien {
    pub debtor: Did,
    pub amount: Amount,
    pub status: LienStatus,
}

/// The lien book. It records **why** `b` is held (the liens); the ledger records **that** it is
/// held (`reserved`). One fact, one home (RELAY_16) — there is no parallel `locked` map the
/// ledger cannot see.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LienBook {
    liens: std::collections::BTreeMap<LienId, Lien>,
    next: u64,
}

impl LienBook {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn lien(&self, id: LienId) -> Option<&Lien> {
        self.liens.get(&id)
    }

    /// `b` currently collateralized by this book's ACTIVE liens for `who` — the base for the
    /// cumulative floor/maturation caps. (The ledger's `reserved_of` is the same figure when
    /// T-0 is the only reserver; this sums T-0's own collateral regardless.)
    pub fn collateralized_of(&self, who: &Did) -> Amount {
        self.liens
            .values()
            .filter(|l| l.status == LienStatus::Active && &l.debtor == who)
            .fold(0u128, |acc, l| acc.saturating_add(l.amount))
    }

    fn active_lien(&self, id: LienId) -> Result<(Did, Amount), T0Refusal> {
        let l = self.liens.get(&id).ok_or(T0Refusal::NoSuchLien)?;
        if l.status != LienStatus::Active {
            return Err(T0Refusal::AlreadyResolved);
        }
        Ok((l.debtor.clone(), l.amount))
    }

    /// Place a lien on the debtor's own `b`. Touches **no Respect** and confers no governance
    /// effect (C-i). Three gates, all fail-closed; the caps compose to `min(maturation, floor)`
    /// and are **cumulative** so stepwise evasion fails on the crossing step:
    /// 1. **Caps (floor + maturation)** against the debtor's total collateral, from a
    ///    [`ThreadStanding`] read from the ledger (RELAY_16 — base not caller-supplied).
    /// 2. **Spendable** — the ledger's [`reserve`](b_token::BLedger::reserve) refuses a hold
    ///    above `balance − reserved`, so the collateral is genuinely locked from any spend path.
    ///
    /// `thread_age` is the one caller-supplied number (the next anchoring dependency).
    pub fn lock(
        &mut self,
        ledger: &mut BLedger,
        debtor: &Did,
        amount: Amount,
        thread_age: u32,
        maturation: &MaturationParams,
    ) -> Result<LienId, T0Refusal> {
        let standing = ThreadStanding::from_ledger(ledger, debtor, thread_age);
        // caps first (no ledger mutation) — report the binding one.
        let would_lock = self.collateralized_of(debtor).saturating_add(amount);
        let floor_bound = standing.floor_bound();
        let maturation_bound = standing.maturation_bound(maturation);
        if would_lock > floor_bound.min(maturation_bound) {
            return Err(if maturation_bound <= floor_bound {
                T0Refusal::ExceedsMaturationLimit {
                    would_lock,
                    limit: maturation_bound,
                    age_years: standing.age_years,
                }
            } else {
                T0Refusal::BreachesFunctionFloor {
                    would_lock,
                    floor_bound,
                }
            });
        }
        // spendable gate = the ledger's structural hold. It refuses above spendable.
        if let Err(e) = ledger.reserve(debtor, amount) {
            let (spendable, need) = match e {
                LedgerError::InsufficientBalance { have, need } => (have, need),
                _ => (0, amount),
            };
            return Err(T0Refusal::InsufficientSpendable { spendable, need });
        }
        let id = LienId(self.next);
        self.next += 1;
        self.liens.insert(
            id,
            Lien {
                debtor: debtor.clone(),
                amount,
                status: LienStatus::Active,
            },
        );
        Ok(id)
    }

    /// Release a lien (resolved in the debtor's favour): the ledger hold is lifted and the `b`
    /// becomes spendable again. **No burn.** Requires a [`SettlementAuthorization`] (C-iii).
    pub fn release(
        &mut self,
        ledger: &mut BLedger,
        id: LienId,
        _auth: &SettlementAuthorization,
    ) -> Result<(), T0Refusal> {
        let (debtor, amount) = self.active_lien(id)?;
        // the amount was reserved at lock; unreserving exactly it cannot fail for an active lien.
        ledger
            .unreserve(&debtor, amount)
            .map_err(|_| T0Refusal::NoSuchLien)?;
        self.liens.get_mut(&id).unwrap().status = LienStatus::Released;
        Ok(())
    }

    /// Forfeit a lien: **burn** the reserved `b` from the debtor's own balance. Lock-and-burn —
    /// no pool receives it; the `b` leaves the supply. Requires a [`SettlementAuthorization`]
    /// (C-iii). Unreserve then burn: after the hold is lifted the `b` is spendable and, because
    /// reserved `b` could never be spent away, the balance always covers it — no shortfall is
    /// reachable. The `CollateralShortfall` path is kept fail-closed but is dead while the
    /// ledger's invariant holds. Status flips to `Forfeited` only after the burn succeeds.
    pub fn forfeit(
        &mut self,
        ledger: &mut BLedger,
        id: LienId,
        _auth: &SettlementAuthorization,
    ) -> Result<Amount, T0Refusal> {
        let (debtor, amount) = self.active_lien(id)?;
        ledger
            .unreserve(&debtor, amount)
            .map_err(|_| T0Refusal::NoSuchLien)?;
        match ledger.burn(&debtor, amount) {
            Ok(()) => {
                self.liens.get_mut(&id).unwrap().status = LienStatus::Forfeited;
                Ok(amount)
            }
            Err(_) => {
                // Unreachable while the reserved invariant holds; re-hold and fail closed.
                let present = ledger.balance_of(&debtor);
                let _ = ledger.reserve(&debtor, amount);
                Err(T0Refusal::CollateralShortfall {
                    locked: amount,
                    present,
                })
            }
        }
    }
}

// ── phase 2 · dependency lint (RELAY_15 §4.5) ───────────────────────────────────

/// A build-time guard, run as a test with a positive control — an unwatched lint is a
/// decoration. A `b`-facility must not import a price/oracle/market signal.
///
/// (The phase-2 unguarded-spend source lint is **gone**: RELAY_16 moved reservation into the
/// ledger, so `burn`/`transfer` cannot touch held `b` from any crate — there is no unguarded
/// path left to scan for. Its regression is now the structural cross-crate test in `tests`.)
pub mod dependency {
    /// Substrings forbidden in a `b`-facility's dependency or import names (RELAY_05 §T-0). A
    /// facility that reads a market can be steered to liquidate; T-0 reads none.
    pub const FORBIDDEN: &[&str] = &[
        "oracle",
        "price",
        "pricefeed",
        "chainlink",
        "pyth",
        "band-protocol",
        "market",
        "ticker",
        "quote",
        "amm",
        "dex",
    ];

    /// Scan a Cargo manifest's dependency sections and a source's import lines for a forbidden
    /// name. Scoped to dependency/`use` lines so prose and this list do not self-trip.
    pub fn forbidden_findings(manifest: &str, source: &str) -> Vec<String> {
        let mut hits = Vec::new();
        let mut in_deps = false;
        for line in manifest.lines() {
            let t = line.trim();
            if let Some(section) = t.strip_prefix('[') {
                in_deps = section.contains("dependencies");
                continue;
            }
            if in_deps && !t.is_empty() && !t.starts_with('#') {
                let name = t
                    .split(['=', ' ', '.'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_lowercase();
                if FORBIDDEN.iter().any(|f| name.contains(f)) {
                    hits.push(format!("dep:{name}"));
                }
            }
        }
        for line in source.lines() {
            let t = line.trim();
            if t.starts_with("use ") || t.contains("extern crate ") {
                let l = t.to_lowercase();
                if FORBIDDEN.iter().any(|f| l.contains(f)) {
                    hits.push(format!("import:{t}"));
                }
            }
        }
        hits
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use b_token::{AcceptNonEmptyProof, ResourceProof, RespectBook, UnlockParams};
    use shared_types::Provenance;

    fn did(s: &str) -> Did {
        Did::new(s)
    }
    fn proof() -> ResourceProof {
        ResourceProof {
            evidence_ref: "seed".into(),
        }
    }
    /// phase-1 funding: liquid balance `bal`, with minted-to-date drawn far above it, so the
    /// caps do not bind and these tests exercise the spendable gate (their original intent).
    fn funded(who: &Did, bal: Amount) -> BLedger {
        let mut l = BLedger::new();
        let minted = bal.saturating_mul(100).max(100);
        l.mint(who, minted, &proof(), &AcceptNonEmptyProof).unwrap();
        l.burn(who, minted - bal).unwrap();
        l
    }
    /// phase-2 funding: minted exactly `amt` (== balance), to exercise the caps against a
    /// known base.
    fn minted_exact(who: &Did, amt: Amount) -> BLedger {
        let mut l = BLedger::new();
        l.mint(who, amt, &proof(), &AcceptNonEmptyProof).unwrap();
        l
    }
    fn ev(source: &str, grade: ViewGrade) -> Evidence {
        Evidence {
            provenance: Provenance::ChainProof,
            confidence: 1.0,
            signed: true,
            verified: true,
            payload_hash: [0u8; 32],
            subject_did: None,
            source_ref: Some(source.to_string()),
            validator_digest: None,
            view_grade: grade,
        }
    }
    fn settle_auth(sources: &[&str]) -> SettlementAuthorization {
        let items: Vec<Evidence> = sources
            .iter()
            .map(|s| ev(s, ViewGrade::Settlement))
            .collect();
        SettlementAuthorization::from_evidence(&items).unwrap()
    }
    fn mat() -> MaturationParams {
        MaturationParams::default()
    }

    // ── functional ─────────────────────────────────────────────────────────

    #[test]
    fn lock_reserves_and_release_frees() {
        let a = did("did:example:alice");
        let mut led = funded(&a, 1000);
        let mut book = LienBook::new();
        assert_eq!(led.spendable_of(&a), 1000);
        let id = book.lock(&mut led, &a, 300, 8, &mat()).unwrap();
        assert_eq!(led.reserved_of(&a), 300);
        assert_eq!(led.spendable_of(&a), 700, "locked b is not spendable");
        book.release(&mut led, id, &settle_auth(&["lab-x", "lab-y"]))
            .unwrap();
        assert_eq!(
            led.spendable_of(&a),
            1000,
            "release returns b to spendable, unburned"
        );
        assert_eq!(led.supply(), 1000, "release burns nothing");
    }

    #[test]
    fn lock_cannot_exceed_spendable() {
        let a = did("a");
        let mut led = funded(&a, 100);
        let mut book = LienBook::new();
        book.lock(&mut led, &a, 60, 8, &mat()).unwrap();
        // a second lien can only take what is still spendable (40), never the reserved 60.
        assert_eq!(
            book.lock(&mut led, &a, 50, 8, &mat()),
            Err(T0Refusal::InsufficientSpendable {
                spendable: 40,
                need: 50
            })
        );
        book.lock(&mut led, &a, 40, 8, &mat()).unwrap();
        assert_eq!(led.spendable_of(&a), 0);
    }

    #[test]
    fn resolution_is_one_shot() {
        let a = did("a");
        let mut led = funded(&a, 100);
        let mut book = LienBook::new();
        let id = book.lock(&mut led, &a, 10, 8, &mat()).unwrap();
        book.release(&mut led, id, &settle_auth(&["s1", "s2"]))
            .unwrap();
        assert_eq!(
            book.release(&mut led, id, &settle_auth(&["s1", "s2"])),
            Err(T0Refusal::AlreadyResolved)
        );
    }

    // ── C-i · a lien confers ZERO governance effect (GOV-1) ──────────────────

    #[test]
    fn c_i_lock_confers_no_respect_or_unlock_change() {
        let a = did("a");
        let mut led = funded(&a, 1000);
        let mut respect = RespectBook::new();
        respect.award(&a, 42);
        let params = UnlockParams::default();
        let before_standing = respect.standing_of(&a);
        let before_rate = respect.unlock_rate(&a, &params);

        let mut book = LienBook::new();
        let id = book.lock(&mut led, &a, 500, 8, &mat()).unwrap();
        assert_eq!(
            respect.standing_of(&a),
            before_standing,
            "a lock awards no Respect"
        );
        assert_eq!(
            respect.unlock_rate(&a, &params),
            before_rate,
            "a lock does not change the unlock rate"
        );

        let _ = book
            .forfeit(&mut led, id, &settle_auth(&["s1", "s2"]))
            .unwrap();
        assert_eq!(
            respect.standing_of(&a),
            before_standing,
            "a forfeit awards/removes no Respect"
        );
        assert_eq!(
            respect.unlock_rate(&a, &params),
            before_rate,
            "a forfeit does not change the unlock rate"
        );
    }

    // ── C-ii · non-absorption; the drain is now impossible (RELAY_16) ────────

    #[test]
    fn c_ii_reserved_b_cannot_be_drained_so_forfeit_never_shortfalls() {
        // FINDING (RELAY_16): the phase-1 control refused a forfeit when the debtor had drained
        // below the lien. With the ledger's reserved invariant, that drain is now IMPOSSIBLE —
        // the ledger refuses it — so C-ii strengthens from "refuse the shortfall" to "no
        // shortfall can occur." (This is a control changing to pass = a finding, per §4.)
        let a = did("a");
        let mut led = minted_exact(&a, 100); // balance 100, minted 100
        let mut book = LienBook::new();
        let id = book.lock(&mut led, &a, 80, 8, &mat()).unwrap(); // 80% floor at age 8
        assert_eq!(led.reserved_of(&a), 80);
        assert_eq!(led.spendable_of(&a), 20);
        // the debtor CANNOT drain into the reserved 80 — the ledger refuses (structural, cross-crate).
        assert_eq!(
            led.burn(&a, 21),
            Err(LedgerError::InsufficientBalance { have: 20, need: 21 })
        );
        led.burn(&a, 20).unwrap(); // only the free 20 is spendable
        assert_eq!(
            led.reserved_of(&a),
            80,
            "a spend cannot touch the collateral"
        );
        // forfeit now always succeeds — no shortfall is reachable.
        let supply_before = led.supply();
        assert_eq!(
            book.forfeit(&mut led, id, &settle_auth(&["s1", "s2"]))
                .unwrap(),
            80
        );
        assert_eq!(
            led.supply(),
            supply_before - 80,
            "forfeit burns the collateral, deflating supply"
        );
        assert_eq!(led.balance_of(&a), 0);
    }

    #[test]
    fn c_ii_forfeit_burns_exactly_and_deflates() {
        let a = did("a");
        let mut led = funded(&a, 1000);
        let mut book = LienBook::new();
        let id = book.lock(&mut led, &a, 300, 8, &mat()).unwrap();
        let burned = book
            .forfeit(&mut led, id, &settle_auth(&["s1", "s2"]))
            .unwrap();
        assert_eq!(burned, 300);
        assert_eq!(led.balance_of(&a), 700, "the burned b leaves the debtor");
        assert_eq!(
            led.supply(),
            700,
            "supply drops by exactly the burn — no pool received it"
        );
        assert_eq!(led.reserved_of(&a), 0, "the hold is cleared");
        assert_eq!(book.lien(id).unwrap().status, LienStatus::Forfeited);
    }

    // ── C-iii · Settlement grade + no lone trigger (BIND-1 §6, R-004) ────────

    #[test]
    fn c_iii_sub_settlement_grade_refused() {
        let items = vec![
            ev("s1", ViewGrade::Settlement),
            ev("s2", ViewGrade::Confirmed),
        ];
        assert_eq!(
            SettlementAuthorization::from_evidence(&items),
            Err(T0Refusal::BelowSettlementGrade {
                got: ViewGrade::Confirmed
            })
        );
    }

    #[test]
    fn c_iii_lone_source_refused() {
        let one = vec![ev("only-lab", ViewGrade::Settlement)];
        assert_eq!(
            SettlementAuthorization::from_evidence(&one),
            Err(T0Refusal::LoneSource {
                distinct_sources: 1
            })
        );
        let same = vec![
            ev("lab-x", ViewGrade::Settlement),
            ev("lab-x", ViewGrade::Settlement),
        ];
        assert_eq!(
            SettlementAuthorization::from_evidence(&same),
            Err(T0Refusal::LoneSource {
                distinct_sources: 1
            })
        );
    }

    #[test]
    fn c_iii_empty_evidence_refused() {
        assert_eq!(
            SettlementAuthorization::from_evidence(&[]),
            Err(T0Refusal::NoEvidence)
        );
    }

    #[test]
    fn c_iii_settlement_multisource_authorizes_and_forfeit_proceeds() {
        let auth = SettlementAuthorization::from_evidence(&[
            ev("lab-x", ViewGrade::Settlement),
            ev("lab-y", ViewGrade::Settlement),
        ])
        .unwrap();
        assert_eq!(auth.source_count(), 2);
        assert_eq!(auth.grade(), ViewGrade::Settlement);

        let a = did("a");
        let mut led = funded(&a, 500);
        let mut book = LienBook::new();
        let id = book.lock(&mut led, &a, 200, 8, &mat()).unwrap();
        assert_eq!(book.forfeit(&mut led, id, &auth).unwrap(), 200);
        assert_eq!(led.balance_of(&a), 300);
    }

    // ── phase 2 · the protective constraints (RELAY_15 §4, §7) ───────────────

    #[test]
    fn p2_maturation_limit_caps_by_age() {
        // a 2-year thread: 10% + 2·10% = 30% of minted 1000 = 300 collateralizable.
        let a = did("a");
        let mut led = minted_exact(&a, 1000);
        let mut book = LienBook::new();
        book.lock(&mut led, &a, 300, 2, &mat()).unwrap(); // positive: within the cap
        assert_eq!(
            book.lock(&mut led, &a, 1, 2, &mat()), // cumulative — 300 already
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 301,
                limit: 300,
                age_years: 2
            })
        );
    }

    #[test]
    fn p2_function_floor_is_law_even_when_maturation_mis_tuned() {
        let a = did("a");
        let mut led = minted_exact(&a, 1000);
        let wide_open = MaturationParams {
            year_one_pct: 100,
            per_year_points: 0,
            ceiling_pct: 100,
        };
        let mut book = LienBook::new();
        book.lock(&mut led, &a, 800, 8, &wide_open).unwrap(); // positive: exactly the 80% floor
        assert_eq!(
            book.lock(&mut led, &a, 1, 8, &wide_open),
            Err(T0Refusal::BreachesFunctionFloor {
                would_lock: 801,
                floor_bound: 800
            })
        );
    }

    #[test]
    fn p2_cumulative_locks_cannot_step_over_the_floor() {
        let a = did("a");
        let mut led = minted_exact(&a, 1000);
        let wide_open = MaturationParams {
            year_one_pct: 100,
            per_year_points: 0,
            ceiling_pct: 100,
        };
        let mut book = LienBook::new();
        book.lock(&mut led, &a, 500, 8, &wide_open).unwrap();
        book.lock(&mut led, &a, 300, 8, &wide_open).unwrap(); // total 800 = floor
        assert_eq!(
            book.lock(&mut led, &a, 1, 8, &wide_open),
            Err(T0Refusal::BreachesFunctionFloor {
                would_lock: 801,
                floor_bound: 800
            })
        );
    }

    #[test]
    fn p2_day_one_thread_cannot_lock_its_whole_grant() {
        // THE anti-predation case (RELAY_15 §2b): a day-one 2-b grant → 10% of 2 rounds to 0.
        let a = did("newcomer");
        let mut led = minted_exact(&a, 2);
        let mut book = LienBook::new();
        assert_eq!(
            book.lock(&mut led, &a, 2, 0, &mat()),
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 2,
                limit: 0,
                age_years: 0
            })
        );
        // positive control: a day-one thread with a larger grant can lock within its 10%, not past.
        let b = did("bigger");
        let mut led2 = minted_exact(&b, 100);
        let mut book2 = LienBook::new();
        book2.lock(&mut led2, &b, 10, 0, &mat()).unwrap();
        assert_eq!(
            book2.lock(&mut led2, &b, 1, 0, &mat()),
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 11,
                limit: 10,
                age_years: 0
            })
        );
    }

    #[test]
    fn p2_one_room_rejects_a_b_holding_contract() {
        assert!(assert_no_b_custody(&[ContractRef {
            address: "t0-facility".into(),
            holds_b: false,
        }])
        .is_ok());
        assert_eq!(
            assert_no_b_custody(&[
                ContractRef {
                    address: "t0-facility".into(),
                    holds_b: false,
                },
                ContractRef {
                    address: "decoy-pool".into(),
                    holds_b: true,
                },
            ]),
            Err(T0Refusal::SecondRoomHoldsB {
                address: "decoy-pool".into()
            })
        );
    }

    #[test]
    fn p2_reserved_b_is_unspendable_across_the_crate_boundary() {
        // RELAY_16 §4.1: the negative control that replaces the deleted source lint. A lien's
        // reservation lives in the ledger, so a burn or transfer of the held b FAILS — from this
        // crate, which depends on b-token. Bypass is impossible, not forbidden-by-lint.
        let a = did("a");
        let b = did("b");
        let mut led = minted_exact(&a, 100);
        let mut book = LienBook::new();
        book.lock(&mut led, &a, 80, 8, &mat()).unwrap();
        assert!(led.burn(&a, 21).is_err(), "burn cannot touch reserved b");
        assert!(
            led.transfer(&a, &b, 21).is_err(),
            "transfer cannot touch reserved b"
        );
        assert!(led.burn(&a, 20).is_ok(), "the free 20 is spendable");
    }

    #[test]
    fn p2_base_is_read_from_the_ledger_not_forgeable() {
        // RELAY_16: the base is the ledger's monotonic minted-to-date. Spending down does not
        // shrink it, so future capacity is preserved; a caller cannot inflate it.
        let a = did("a");
        let mut led = minted_exact(&a, 1000); // minted 1000
        led.burn(&a, 900).unwrap(); // balance 100, minted still 1000
        let s = ThreadStanding::from_ledger(&led, &a, 8);
        assert_eq!(
            s.minted_to_date(),
            1000,
            "base is minted-to-date, not the drawn-down balance"
        );
        assert_eq!(s.floor_bound(), 800);
        // so a mature thread may still collateralize up to 80% of what it ever minted — but only
        // as far as it can actually reserve (spendable 100), the ledger being the harder gate here.
        let mut book = LienBook::new();
        assert_eq!(
            book.lock(&mut led, &a, 200, 8, &mat()),
            Err(T0Refusal::InsufficientSpendable {
                spendable: 100,
                need: 200
            })
        );
    }

    #[test]
    fn p2_oracle_lint_bites_and_real_crate_is_clean() {
        use dependency::forbidden_findings;
        let decoy_manifest =
            "[dependencies]\nchainlink = \"1\"\ncapability = { path = \"../capability\" }\n";
        assert!(
            !forbidden_findings(decoy_manifest, "").is_empty(),
            "the lint must catch an oracle dependency"
        );
        assert!(
            !forbidden_findings("", "use pyth_client::Price;").is_empty(),
            "the lint must catch an oracle import"
        );
        let manifest = include_str!("../Cargo.toml");
        let source = include_str!("lib.rs");
        assert_eq!(
            forbidden_findings(manifest, source),
            Vec::<String>::new(),
            "this crate imports no market/oracle/price feed"
        );
    }
}
