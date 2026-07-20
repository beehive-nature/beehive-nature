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
//!   priority, no queue position. GOV-1 enumerates *locked* precisely to rule that locking is
//!   governance-neutral. This type touches no `RespectBook` and exposes no ordering or weight;
//!   the control `c_i_lock_confers_no_respect_or_unlock_change` proves a lock and a forfeit
//!   leave Respect and the Respect-driven unlock rate untouched.
//! - **C-ii (Art V §1 + Art IV):** non-absorption **proven by test on a drained fixture**.
//!   T-0 holds no `b` of its own; a forfeit burns only what the debtor still holds — never
//!   more — and on a shortfall it **refuses rather than covering it**. The control
//!   `c_ii_drained_debtor_forfeit_refuses_never_absorbs` shows T-0 invents no `b`.
//! - **C-iii (BIND-1 §6, R-004):** no Evidence below **Settlement** grade reaches a T-0 path,
//!   and **no single source triggers**. Release and forfeit require a [`SettlementAuthorization`]
//!   constructible **only** from `ViewGrade::Settlement` with **≥2 independent sources** — a
//!   caller cannot fabricate one, mirroring `dro-signer`'s R-004 boundary. Controls
//!   `c_iii_sub_settlement_grade_refused` and `c_iii_lone_source_refused`.
//!
//! `b` custody is never BNR's: T-0 never takes possession of the debtor's `b`; it records a
//! reservation against the debtor's own ledger balance and, on forfeit, destroys it.
//!
//! # Phase 2 — the protective constraints (RELAY_15), the half that guards the human
//!
//! Phase 1 is correct custody machinery and was **unsafe as a user-facing facility** until
//! these landed, because the constraints that protect the person were the ones missing. They
//! are now **unconditional** — [`LienBook::lock`] cannot be called without a [`ThreadStanding`],
//! so the caps below are always enforced. That is stronger than a feature gate: they cannot be
//! compiled out.
//!
//! - **The 20% function floor (LAW, RELAY_05 §T-0):** 20% of minted-to-date can **never** be
//!   collateralized — no one can be liquidated out of operating their own OSe. So the absolute
//!   ceiling is 80% of minted-to-date, forever, and the check is **cumulative**: stepwise locks
//!   that would cross it fail on the crossing step (RELAY_08 §3). Not DAO-tunable.
//! - **The maturation schedule (anti-predation):** the base is **minted-to-date**; the cap is
//!   10% in year one, +10 points/year, 80% ceiling. A day-one onboardee **cannot** lock their
//!   whole grant — their `b` is simply not collateralizable yet. Increments are DAO-tunable
//!   ([`MaturationParams`]); the schedule's existence is not. The effective cap is
//!   `min(maturation_bound, floor_bound)`.
//! - **The one-room law:** T-0 is non-custodial — **no contract may hold `b`**; a second
//!   contract that does is a pool, exactly what forfeit-burn exists to avoid. [`assert_no_b_custody`]
//!   refuses any `b`-holding contract (tested against a decoy).
//! - **No oracle / price-feed / market dependency:** [`dependency::forbidden_findings`] fails a
//!   forbidden import, with a positive control that watches it fail first.
//!
//! **The lien-enforcement seam — corrected.** Phase 1 called this "a deployment contract like
//! `dro-signer`'s node-disjointness." That was wrong: node-disjointness is a tunable parameter,
//! sound at any setting; **this is the enforcement of the lien itself.** A spend path that does
//! not consult [`LienBook::spendable`] makes every lien advisory — the debtor spends the
//! collateral, forfeit hits `CollateralShortfall`, and the pool depletes by attrition (Art V §1
//! absorption with extra steps). So the fix is **structural, not remembered**: the sanctioned
//! spend path lives in-crate ([`LienBook::guarded_burn`] / [`LienBook::guarded_transfer`], which
//! consult `spendable` before touching the ledger), and a source lint
//! ([`dependency::unguarded_spend_findings`], positive-controlled) forbids any unguarded
//! `BLedger` spend in this crate. Making the raw `BLedger` spend methods unreachable
//! crate-**externally** is a `b-token` change — offered as the seam ruling in RELAY_15 §3/§4.6.

#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};

use b_token::{Amount, BLedger};
use capability::Did;
use serde::{Deserialize, Serialize};
use shared_types::{Evidence, ViewGrade};

/// Every refusal here is a fail-closed control — T-0 declines rather than performing the
/// money-adjacent action when a condition is unmet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum T0Refusal {
    /// A lock cannot reserve more than the debtor can currently spend (balance − already-locked).
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
    /// The debtor's present balance is below the lien; T-0 refuses rather than absorbing the
    /// shortfall (it holds no pool and mints no `b`).
    CollateralShortfall { locked: Amount, present: Amount },
    // ── phase 2 · protective constraints (RELAY_15) ──
    /// The 20% function floor (LAW): the resulting total locked would exceed 80% of
    /// minted-to-date. 20% can never be collateralized — no one is liquidated out of their OSe.
    BreachesFunctionFloor {
        would_lock: Amount,
        floor_bound: Amount,
    },
    /// The maturation schedule for this thread's age would be exceeded. A young thread's `b` is
    /// not yet fully collateralizable (anti-predation); the cap rises with time-in-system.
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
    /// The only way to obtain an authorization. Refuses:
    /// - an empty evidence set (Law 1a),
    /// - any item below `ViewGrade::Settlement` (C-iii(a): nothing sub-Settlement reaches T-0),
    /// - fewer than two **independent** sources (C-iii(b) / R-004: never a lone trigger).
    ///
    /// Independence is counted by distinct [`Evidence::source_ref`]; an item with no
    /// `source_ref` cannot establish independent provenance and is not counted as a source.
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
/// DAO-tunable — it is the guarantee that no one is liquidated out of operating their own OSe.
pub const UNCOLLATERALIZABLE_FLOOR_PCT: u32 = 20;

/// A thread's standing for the collateral caps. **Not caller-asserted in production** — the
/// authoritative source of `minted_to_date` is the mint ledger and of `age_years` the
/// enrollment record; a thread cannot inflate its own cap by claiming a larger base.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ThreadStanding {
    /// Total `b` ever minted to this thread — the BASE for both caps (RELAY_15 §4). It is
    /// **not** the current balance: burning `b` does not shrink the base, so the floor cannot
    /// be gamed by spending down and re-minting.
    pub minted_to_date: Amount,
    /// Whole years the thread has been in the system. Day one is `0` (still in year one).
    pub age_years: u32,
}

/// DAO-tunable maturation increments. The schedule's **existence** is law; the numbers tune.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaturationParams {
    /// Percent collateralizable in year one (day one included).
    pub year_one_pct: u32,
    /// Points added per subsequent whole year.
    pub per_year_points: u32,
    /// Hard ceiling percent — must not exceed the function floor's 80% (enforced by the
    /// `min` in [`ThreadStanding::collateral_cap`], so a mis-tuned ceiling still cannot breach it).
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

impl ThreadStanding {
    /// The eternal 80% ceiling (the 20% floor is LAW): the most `b` that may **ever** be
    /// collateralized, regardless of age.
    pub fn floor_bound(&self) -> Amount {
        let collateralizable = 100u128.saturating_sub(UNCOLLATERALIZABLE_FLOOR_PCT as u128);
        self.minted_to_date.saturating_mul(collateralizable) / 100
    }

    /// The maturation percent for this thread's age: `min(ceiling, year_one + age·per_year)`.
    pub fn maturation_pct(&self, p: &MaturationParams) -> u32 {
        p.year_one_pct
            .saturating_add(self.age_years.saturating_mul(p.per_year_points))
            .min(p.ceiling_pct)
    }

    /// The time-based cap in `b` for this thread's age.
    pub fn maturation_bound(&self, p: &MaturationParams) -> Amount {
        self.minted_to_date
            .saturating_mul(self.maturation_pct(p) as u128)
            / 100
    }

    /// The effective cap: the tighter of the maturation curve and the eternal floor. Neither
    /// can be breached, and a mis-tuned maturation ceiling above 80% is still clamped by the floor.
    pub fn collateral_cap(&self, p: &MaturationParams) -> Amount {
        self.floor_bound().min(self.maturation_bound(p))
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

/// The lien table. **Holds no `b`.** It records how much of each debtor's own balance is
/// reserved; spendable = ledger balance − locked. There is no pool, no purse, nothing T-0
/// could owe (C-ii).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LienBook {
    locked: BTreeMap<Did, Amount>,
    liens: BTreeMap<LienId, Lien>,
    next: u64,
}

impl LienBook {
    pub fn new() -> Self {
        Self::default()
    }

    /// `b` the debtor currently has reserved across all active liens.
    pub fn locked_of(&self, who: &Did) -> Amount {
        self.locked.get(who).copied().unwrap_or(0)
    }

    /// `b` the debtor may still spend or lock: ledger balance minus what is already locked.
    pub fn spendable(&self, ledger: &BLedger, who: &Did) -> Amount {
        ledger.balance_of(who).saturating_sub(self.locked_of(who))
    }

    pub fn lien(&self, id: LienId) -> Option<&Lien> {
        self.liens.get(&id)
    }

    /// Place a lien on the debtor's own `b`. The debtor commits their **own** collateral —
    /// there is no evidence gate on locking (it takes only your own balance), and it touches
    /// **no Respect** and confers no governance effect (C-i).
    ///
    /// Three gates, all fail-closed (RELAY_15 §4.3). They **compose**; the effective cap is
    /// `min(maturation_bound, floor_bound)`:
    /// 1. **Spendable** — you cannot lock `b` you do not hold or have already locked.
    /// 2. **Function floor (LAW)** — total locked may never exceed 80% of minted-to-date.
    /// 3. **Maturation** — total locked may not exceed the age-based cap.
    ///
    /// Gates 2 and 3 are **cumulative** (they bound `locked_of + amount`), so a series of
    /// small locks that together reach a cap fails on the step that would cross it — the
    /// stepwise-evasion path is closed, not just the single-shot one.
    ///
    /// Requiring [`ThreadStanding`] is deliberate: there is no way to lock without the data the
    /// caps need, so the protections cannot be bypassed by an integrator forgetting to pass them.
    pub fn lock(
        &mut self,
        ledger: &BLedger,
        debtor: &Did,
        amount: Amount,
        standing: &ThreadStanding,
        maturation: &MaturationParams,
    ) -> Result<LienId, T0Refusal> {
        // gate 1 — you can only lock `b` you actually hold and have not already locked.
        let spendable = self.spendable(ledger, debtor);
        if spendable < amount {
            return Err(T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
            });
        }
        // gates 2 & 3 bound the CUMULATIVE locked total, not just this lock (RELAY_08 §3).
        let would_lock = self.locked_of(debtor).saturating_add(amount);
        // They compose: the effective cap is the TIGHTER of the eternal floor and the age-based
        // maturation curve. When it is exceeded, report the binding one so the refusal names the
        // real limit — for a young thread that is maturation; for a mis-tuned ceiling, the floor.
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
        let id = LienId(self.next);
        self.next += 1;
        let e = self.locked.entry(debtor.clone()).or_insert(0);
        *e = e.saturating_add(amount);
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

    /// Release a lien (the condition resolved in the debtor's favour): the reservation is
    /// lifted and the `b` becomes spendable again. **No burn.** Requires a
    /// [`SettlementAuthorization`] — release is money-adjacent, so it is gated by
    /// Settlement-grade, multi-sourced Evidence (C-iii).
    pub fn release(
        &mut self,
        id: LienId,
        _auth: &SettlementAuthorization,
    ) -> Result<(), T0Refusal> {
        let (debtor, amount) = {
            let lien = self.liens.get_mut(&id).ok_or(T0Refusal::NoSuchLien)?;
            if lien.status != LienStatus::Active {
                return Err(T0Refusal::AlreadyResolved);
            }
            lien.status = LienStatus::Released;
            (lien.debtor.clone(), lien.amount)
        };
        let e = self.locked.entry(debtor).or_insert(0);
        *e = e.saturating_sub(amount);
        Ok(())
    }

    /// Forfeit a lien: **burn** the reserved `b` from the debtor's own balance. Lock-and-burn
    /// — no pool receives it; the `b` leaves the supply. Requires a [`SettlementAuthorization`]
    /// (C-iii). If the debtor's present balance is below the lien (they spent it elsewhere),
    /// T-0 **refuses** rather than covering the shortfall — it holds no pool and mints no `b`
    /// (C-ii, Art V §1). The status is set to `Forfeited` only after the burn succeeds, so a
    /// refused forfeit leaves the lien active and retryable. Returns the amount burned.
    pub fn forfeit(
        &mut self,
        ledger: &mut BLedger,
        id: LienId,
        _auth: &SettlementAuthorization,
    ) -> Result<Amount, T0Refusal> {
        let (debtor, amount) = {
            let lien = self.liens.get_mut(&id).ok_or(T0Refusal::NoSuchLien)?;
            if lien.status != LienStatus::Active {
                return Err(T0Refusal::AlreadyResolved);
            }
            (lien.debtor.clone(), lien.amount)
        };
        // C-ii — never absorb. Burn only what is actually there; on a shortfall, refuse.
        let present = ledger.balance_of(&debtor);
        if present < amount {
            return Err(T0Refusal::CollateralShortfall {
                locked: amount,
                present,
            });
        }
        ledger
            .burn(&debtor, amount)
            .map_err(|_| T0Refusal::CollateralShortfall {
                locked: amount,
                present,
            })?;
        if let Some(lien) = self.liens.get_mut(&id) {
            lien.status = LienStatus::Forfeited;
        }
        let e = self.locked.entry(debtor).or_insert(0);
        *e = e.saturating_sub(amount);
        Ok(amount)
    }

    /// The sanctioned burn path for a thread that may bear liens (RELAY_15 §3/§4.6). It
    /// **consults [`spendable`](Self::spendable) before touching the ledger**, so reserved `b`
    /// cannot be spent out from under a lien — the lien is *enforced*, not merely advised. Any
    /// `b`-spend for a lien-bearing thread must route through here; the source lint
    /// [`dependency::unguarded_spend_findings`] forbids an unguarded `BLedger` spend in-crate.
    pub fn guarded_burn(
        &self,
        ledger: &mut BLedger,
        who: &Did,
        amount: Amount,
    ) -> Result<(), T0Refusal> {
        let spendable = self.spendable(ledger, who);
        if amount > spendable {
            return Err(T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
            });
        }
        ledger
            .burn(who, amount)
            .map_err(|_| T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
            })
    }

    /// The sanctioned transfer path — same lien enforcement as [`guarded_burn`](Self::guarded_burn):
    /// a thread may never transfer reserved `b` away, so a lien cannot be emptied out from under.
    pub fn guarded_transfer(
        &self,
        ledger: &mut BLedger,
        from: &Did,
        to: &Did,
        amount: Amount,
    ) -> Result<(), T0Refusal> {
        let spendable = self.spendable(ledger, from);
        if amount > spendable {
            return Err(T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
            });
        }
        ledger
            .transfer(from, to, amount)
            .map_err(|_| T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
            })
    }
}

// ── phase 2 · dependency + source lints (RELAY_15 §4.5, §4.6) ────────────────────

/// Build-time guards, run as tests with a positive control apiece — an unwatched lint is a
/// decoration. A `b`-facility must not import a price/oracle/market signal, and must not spend
/// `b` through a path that skips the lien check.
pub mod dependency {
    /// Substrings forbidden in a `b`-facility's dependency or import names: anything that would
    /// pull in an external price, oracle, or market signal (RELAY_05 §T-0). A facility that
    /// reads a market can be steered to liquidate; T-0 reads none.
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
    /// name. Deliberately scoped to dependency/`use` lines so prose and this list itself do not
    /// self-trip. Returns every hit (empty = clean).
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

    /// Scan library source for a `b`-spend (`BLedger::burn`/`transfer`) that lives outside a
    /// sanctioned, lien-consulting function. Any hit means a spend path could empty a lien
    /// without checking `spendable` — fail-open (RELAY_15 §3). Needles are assembled at runtime
    /// so this scanner's own detection literals do not self-trip.
    pub fn unguarded_spend_findings(lib_source: &str) -> Vec<String> {
        const SANCTIONED: &[&str] = &["guarded_burn", "guarded_transfer", "forfeit"];
        // Needles assembled at runtime and matched on the METHOD-CALL form (`.burn(`), which
        // survives rustfmt wrapping `ledger` and `.burn(` onto separate lines — matching the
        // joined `ledger.burn(` would silently never fire and pass vacuously.
        let burn = [".", "burn("].concat();
        let xfer = [".", "transfer("].concat();
        let mut cur = String::new();
        let mut hits = Vec::new();
        for line in lib_source.lines() {
            let t = line.trim();
            if t.starts_with("//") {
                continue; // prose/doc lines are not code — skip so `BLedger::burn` in a comment cannot trip this
            }
            if let Some(rest) = t.strip_prefix("pub fn ").or_else(|| t.strip_prefix("fn ")) {
                cur = rest.split(['(', '<', ' ']).next().unwrap_or("").to_string();
            }
            if (t.contains(&burn) || t.contains(&xfer)) && !SANCTIONED.contains(&cur.as_str()) {
                hits.push(format!("{cur}: {t}"));
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
    fn funded(who: &Did, amt: Amount) -> BLedger {
        let mut l = BLedger::new();
        l.mint(
            who,
            amt,
            &ResourceProof {
                evidence_ref: "seed".into(),
            },
            &AcceptNonEmptyProof,
        )
        .unwrap();
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
    /// A mature, well-minted thread whose caps do not bind for the small phase-1 balances — so
    /// the phase-1 tests keep exercising the spendable gate, and the caps get their own tests.
    fn mature() -> ThreadStanding {
        ThreadStanding {
            minted_to_date: 1_000_000,
            age_years: 8,
        }
    }
    fn mat() -> MaturationParams {
        MaturationParams::default()
    }

    // ── functional ─────────────────────────────────────────────────────────

    #[test]
    fn lock_reserves_and_release_frees() {
        let a = did("did:example:alice");
        let led = funded(&a, 1000);
        let mut book = LienBook::new();
        assert_eq!(book.spendable(&led, &a), 1000);
        let id = book.lock(&led, &a, 300, &mature(), &mat()).unwrap();
        assert_eq!(book.locked_of(&a), 300);
        assert_eq!(book.spendable(&led, &a), 700, "locked b is not spendable");
        book.release(id, &settle_auth(&["lab-x", "lab-y"])).unwrap();
        assert_eq!(
            book.spendable(&led, &a),
            1000,
            "release returns b to spendable, unburned"
        );
        assert_eq!(led.supply(), 1000, "release burns nothing");
    }

    #[test]
    fn lock_cannot_exceed_spendable() {
        let a = did("a");
        let led = funded(&a, 100);
        let mut book = LienBook::new();
        book.lock(&led, &a, 60, &mature(), &mat()).unwrap();
        // a second lien can only take what is still spendable (40), never the locked 60.
        assert_eq!(
            book.lock(&led, &a, 50, &mature(), &mat()),
            Err(T0Refusal::InsufficientSpendable {
                spendable: 40,
                need: 50
            })
        );
        book.lock(&led, &a, 40, &mature(), &mat()).unwrap();
        assert_eq!(book.spendable(&led, &a), 0);
    }

    #[test]
    fn resolution_is_one_shot() {
        let a = did("a");
        let led = funded(&a, 100);
        let mut book = LienBook::new();
        let id = book.lock(&led, &a, 10, &mature(), &mat()).unwrap();
        book.release(id, &settle_auth(&["s1", "s2"])).unwrap();
        assert_eq!(
            book.release(id, &settle_auth(&["s1", "s2"])),
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
        let id = book.lock(&led, &a, 500, &mature(), &mat()).unwrap();
        // locking touched no Respect and no governance-weight surface (T-0 has none).
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
        // even burning the collateral changes no governance standing — b never conferred weight.
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

    // ── C-ii · non-absorption, proven on a drained fixture (Art V §1) ────────

    #[test]
    fn c_ii_drained_debtor_forfeit_refuses_never_absorbs() {
        let a = did("a");
        let mut led = funded(&a, 100);
        let mut book = LienBook::new();
        let id = book.lock(&led, &a, 100, &mature(), &mat()).unwrap();
        // the debtor drains their balance below the lien through some other path (spend/burn).
        led.burn(&a, 40).unwrap();
        let supply_before = led.supply();
        // forfeit must REFUSE — T-0 has no pool and mints no b to cover the 40 shortfall.
        assert_eq!(
            book.forfeit(&mut led, id, &settle_auth(&["s1", "s2"])),
            Err(T0Refusal::CollateralShortfall {
                locked: 100,
                present: 60
            })
        );
        assert_eq!(
            led.supply(),
            supply_before,
            "a refused forfeit invents no b and burns none"
        );
        // and the lien is still active (fail-closed, retryable), not silently consumed.
        assert_eq!(book.lien(id).unwrap().status, LienStatus::Active);
    }

    #[test]
    fn c_ii_forfeit_burns_exactly_and_deflates() {
        let a = did("a");
        let mut led = funded(&a, 1000);
        let mut book = LienBook::new();
        let id = book.lock(&led, &a, 300, &mature(), &mat()).unwrap();
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
        assert_eq!(book.locked_of(&a), 0, "the lien is cleared");
        assert_eq!(book.lien(id).unwrap().status, LienStatus::Forfeited);
    }

    // ── C-iii · Settlement grade + no lone trigger (BIND-1 §6, R-004) ────────

    #[test]
    fn c_iii_sub_settlement_grade_refused() {
        // one Confirmed item taints the set: nothing below Settlement reaches a T-0 path.
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
        // a single Settlement source cannot trigger (R-004: never a lone trigger).
        let one = vec![ev("only-lab", ViewGrade::Settlement)];
        assert_eq!(
            SettlementAuthorization::from_evidence(&one),
            Err(T0Refusal::LoneSource {
                distinct_sources: 1
            })
        );
        // two items from the SAME source are still one source — not independent.
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
        // positive control: two independent Settlement sources DO authorize, and the gated
        // forfeit then runs. Without this, the negatives above could pass vacuously.
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
        let id = book.lock(&led, &a, 200, &mature(), &mat()).unwrap();
        assert_eq!(book.forfeit(&mut led, id, &auth).unwrap(), 200);
        assert_eq!(led.supply(), 300);
    }

    // ── phase 2 · the protective constraints (RELAY_15 §4, §7) ───────────────

    #[test]
    fn p2_maturation_limit_caps_by_age() {
        // a 2-year thread: 10% + 2·10% = 30% of minted 1000 = 300 collateralizable.
        let a = did("a");
        let led = funded(&a, 1000);
        let standing = ThreadStanding {
            minted_to_date: 1000,
            age_years: 2,
        };
        let mut book = LienBook::new();
        // positive control: within the maturation cap, a lock succeeds.
        book.lock(&led, &a, 300, &standing, &mat()).unwrap();
        // negative: one unit past the cap refuses (cumulative — 300 already locked).
        assert_eq!(
            book.lock(&led, &a, 1, &standing, &mat()),
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 301,
                limit: 300,
                age_years: 2
            })
        );
    }

    #[test]
    fn p2_function_floor_is_law_even_when_maturation_mis_tuned() {
        // a mis-tuned maturation that would permit 100% must still be clamped to the 80% floor.
        let a = did("a");
        let led = funded(&a, 1000);
        let standing = ThreadStanding {
            minted_to_date: 1000,
            age_years: 8,
        };
        let wide_open = MaturationParams {
            year_one_pct: 100,
            per_year_points: 0,
            ceiling_pct: 100,
        };
        let mut book = LienBook::new();
        // positive: exactly the 80% floor bound is allowed.
        book.lock(&led, &a, 800, &standing, &wide_open).unwrap();
        // negative: one past 80% breaches the eternal floor, though maturation would permit it.
        assert_eq!(
            book.lock(&led, &a, 1, &standing, &wide_open),
            Err(T0Refusal::BreachesFunctionFloor {
                would_lock: 801,
                floor_bound: 800
            })
        );
    }

    #[test]
    fn p2_cumulative_locks_cannot_step_over_the_floor() {
        // stepwise evasion is closed: small locks that together reach the floor fail on the step.
        let a = did("a");
        let led = funded(&a, 1000);
        let standing = ThreadStanding {
            minted_to_date: 1000,
            age_years: 8,
        };
        let wide_open = MaturationParams {
            year_one_pct: 100,
            per_year_points: 0,
            ceiling_pct: 100,
        };
        let mut book = LienBook::new();
        book.lock(&led, &a, 500, &standing, &wide_open).unwrap();
        book.lock(&led, &a, 300, &standing, &wide_open).unwrap(); // total 800 = floor
        assert_eq!(
            book.lock(&led, &a, 1, &standing, &wide_open),
            Err(T0Refusal::BreachesFunctionFloor {
                would_lock: 801,
                floor_bound: 800
            })
        );
    }

    #[test]
    fn p2_day_one_thread_cannot_lock_its_whole_grant() {
        // THE anti-predation case, explicit (RELAY_15 §2b). A day-one onboardee with a 2-b grant
        // can lock none of it — 10% of 2 rounds to 0 — so locking the whole grant refuses.
        let a = did("newcomer");
        let led = funded(&a, 2);
        let day_one = ThreadStanding {
            minted_to_date: 2,
            age_years: 0,
        };
        let mut book = LienBook::new();
        assert_eq!(
            book.lock(&led, &a, 2, &day_one, &mat()),
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 2,
                limit: 0,
                age_years: 0
            })
        );
        // positive control: a day-one thread with a larger grant can lock within its 10%, not past.
        let b = did("bigger");
        let led2 = funded(&b, 100);
        let d1 = ThreadStanding {
            minted_to_date: 100,
            age_years: 0,
        };
        book.lock(&led2, &b, 10, &d1, &mat()).unwrap(); // 10% of 100 = 10, ok
        assert_eq!(
            book.lock(&led2, &b, 1, &d1, &mat()), // 11 > 10 → refuse
            Err(T0Refusal::ExceedsMaturationLimit {
                would_lock: 11,
                limit: 10,
                age_years: 0
            })
        );
    }

    #[test]
    fn p2_one_room_rejects_a_b_holding_contract() {
        // positive control: a non-custodial set passes (T-0 holds no b; b stays with humans).
        assert!(assert_no_b_custody(&[ContractRef {
            address: "t0-facility".into(),
            holds_b: false,
        }])
        .is_ok());
        // negative: a decoy second contract that holds b is a forbidden pool.
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
    fn p2_oracle_lint_bites_and_real_crate_is_clean() {
        use dependency::forbidden_findings;
        // positive control: the lint must FAIL on a deliberately-added oracle dep/import first.
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
        // real crate: clean — no market/oracle dep or import.
        let manifest = include_str!("../Cargo.toml");
        let source = include_str!("lib.rs");
        assert_eq!(
            forbidden_findings(manifest, source),
            Vec::<String>::new(),
            "this crate imports no market/oracle/price feed"
        );
    }

    #[test]
    fn p2_unguarded_spend_lint_bites_and_real_library_is_clean() {
        use dependency::unguarded_spend_findings;
        // positive control: an unguarded ledger spend outside a sanctioned fn must be caught.
        let decoy = "pub fn sneaky(&self) {\n    ledger.burn(who, amt).unwrap();\n}\n";
        assert!(
            !unguarded_spend_findings(decoy).is_empty(),
            "an unguarded b-spend must be flagged"
        );
        // real library (tests excluded): every ledger spend sits inside a sanctioned fn.
        let src = include_str!("lib.rs");
        let lib = src.split("#[cfg(test)]").next().unwrap();
        assert_eq!(
            unguarded_spend_findings(lib),
            Vec::<String>::new(),
            "no unguarded b-spend path exists in the library"
        );
    }
}
