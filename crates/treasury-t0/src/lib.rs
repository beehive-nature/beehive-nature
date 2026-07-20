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
//! **Open seam (documented, not hidden):** enforcing that reserved `b` cannot be spent out
//! from under a lien belongs to the spend path consulting [`LienBook::spendable`] — the same
//! way `dro-signer` left node-disjointness a deployment contract. T-0's non-absorption
//! guarantee holds regardless: on a drained debtor it refuses, never covers.

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
    /// **no Respect** and confers no governance effect (C-i). Refuses if the debtor cannot
    /// currently spend that much (balance already spoken for by other liens).
    pub fn lock(
        &mut self,
        ledger: &BLedger,
        debtor: &Did,
        amount: Amount,
    ) -> Result<LienId, T0Refusal> {
        let spendable = self.spendable(ledger, debtor);
        if spendable < amount {
            return Err(T0Refusal::InsufficientSpendable {
                spendable,
                need: amount,
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

    // ── functional ─────────────────────────────────────────────────────────

    #[test]
    fn lock_reserves_and_release_frees() {
        let a = did("did:example:alice");
        let led = funded(&a, 1000);
        let mut book = LienBook::new();
        assert_eq!(book.spendable(&led, &a), 1000);
        let id = book.lock(&led, &a, 300).unwrap();
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
        book.lock(&led, &a, 60).unwrap();
        // a second lien can only take what is still spendable (40), never the locked 60.
        assert_eq!(
            book.lock(&led, &a, 50),
            Err(T0Refusal::InsufficientSpendable {
                spendable: 40,
                need: 50
            })
        );
        book.lock(&led, &a, 40).unwrap();
        assert_eq!(book.spendable(&led, &a), 0);
    }

    #[test]
    fn resolution_is_one_shot() {
        let a = did("a");
        let led = funded(&a, 100);
        let mut book = LienBook::new();
        let id = book.lock(&led, &a, 10).unwrap();
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
        let id = book.lock(&led, &a, 500).unwrap();
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
        let id = book.lock(&led, &a, 100).unwrap();
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
        let id = book.lock(&led, &a, 300).unwrap();
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
        let id = book.lock(&led, &a, 200).unwrap();
        assert_eq!(book.forfeit(&mut led, id, &auth).unwrap(), 200);
        assert_eq!(led.supply(), 300);
    }
}
