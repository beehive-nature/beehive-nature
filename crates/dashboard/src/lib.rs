//! `dashboard` — the read-only analytics surface (sprint v1). It **composes what the kernel
//! already measures** — Respect standings, `b` supply & minted-to-date, collateral positions &
//! floor headroom — and **states its absences honestly** rather than waiting for completeness. A
//! dashboard that waits to be complete ships nothing; this ships now.
//!
//! Two panels the tree cannot yet honestly measure are [`Panel::Absent`] **with their reason** —
//! the same discipline as a `NotMeasured` that carries its basis (Law 1d at dashboard scope: an
//! absence that cannot say why is indistinguishable from a zero):
//! - **Circle activity** is Absent because the circle-outcome lexicon has not landed. But that
//!   lexicon gates circle *outcomes crossing the seam*, not a read — so v1 ships the panel Absent
//!   and the lexicon becomes an **upgrade, not a gate**.
//! - **Souls / spirit supply and the 420-per-soul law** are Absent because `SPIRIT-1` is undefined
//!   in-tree (CD-29 §U-11): the number is carried on dispatch authority, not measured. Shown
//!   NotMeasured, **never as a fact** — land `SPIRIT-1` or the panel stays Absent.
//!
//! **Read-only by construction.** Every input is a shared reference; this crate writes no state,
//! moves no `b`, and sets no status. The data model builds and tests on any host; the COSMIC
//! rendering is the shell's Linux view.

#![forbid(unsafe_code)]

use b_token::{Amount, BLedger};
use capability::Did;
use reputation_engine::ReputationScore;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use treasury_t0::{LienBook, MaturationParams, ThreadStanding};

/// A panel value: **measured** from a named, tested source, or honestly **absent with its reason**
/// — never a fabricated number. This is the whole ethic of the surface in one type.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Panel<T> {
    /// Measured from a real source.
    Measured(T),
    /// Not shown, and here is why.
    Absent { reason: String },
}

impl<T> Panel<T> {
    pub fn is_measured(&self) -> bool {
        matches!(self, Panel::Measured(_))
    }
    /// The reason this panel is absent, if it is.
    pub fn reason(&self) -> Option<&str> {
        match self {
            Panel::Absent { reason } => Some(reason.as_str()),
            Panel::Measured(_) => None,
        }
    }
}

/// One party's emergent Respect standing (reputation-engine's deterministic projection).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RespectStanding {
    pub did: String,
    pub score: u64,
}

/// Standing under the 80% function floor — and crucially, a **breach** of the floor is a distinct
/// arm from being *at* the cap, because on the dashboard the two must not look alike.
///
/// The floor is enforced at [`treasury_t0::LienBook::lock`], so `Breach` is unreachable while the
/// kernel invariant holds. That is exactly why it must be its own loud arm and never a saturated
/// `0`: **the dashboard is the surface where an impossible state must be unmissable.** A violation
/// and a boundary must not render alike — the same family as `<LOQ` ≠ `0` and a stale gauge ≠ a
/// number. If `Breach` ever renders, a floor-law invariant in the kernel has broken.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Headroom {
    /// `n` more `b` may be collateralized before the floor.
    Available(Amount),
    /// Collateralization exactly equals the floor bound — legitimately no room left.
    AtCap,
    /// Collateralization **exceeds** the floor by `n` `b`. Unreachable if the kernel holds; if it
    /// renders, the floor law failed and the surface must show it unmissably — never as "0".
    Breach(Amount),
}

impl Headroom {
    /// Classify collateralization against the floor bound. `collateralized > floor_bound` is the
    /// breach — **surfaced, not saturated away.** Carries the overage so the alarm is quantified.
    pub fn classify(floor_bound: Amount, collateralized: Amount) -> Headroom {
        match collateralized.cmp(&floor_bound) {
            Ordering::Less => Headroom::Available(floor_bound - collateralized),
            Ordering::Equal => Headroom::AtCap,
            Ordering::Greater => Headroom::Breach(collateralized - floor_bound),
        }
    }

    /// Is the floor law breached? A dashboard renderer keys its alarm off this.
    pub fn is_breach(&self) -> bool {
        matches!(self, Headroom::Breach(_))
    }
}

/// A thread's `b` position — everything read from the ledger and the lien book, none fabricated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ThreadPosition {
    pub did: Did,
    pub balance: Amount,
    pub spendable: Amount,
    pub minted_to_date: Amount,
    /// `b` currently collateralized by active liens.
    pub collateralized: Amount,
    /// The eternal 80% function-floor bound at this thread's derived age.
    pub floor_bound: Amount,
    /// Standing under the floor: room left, at the cap, or a (should-be-impossible) breach — the
    /// three distinguished, never collapsed to a number. Carries its inputs (`floor_bound` and
    /// `collateralized` are right here) so a reader re-derives it.
    pub headroom: Headroom,
}

/// What a circle-activity panel WOULD carry once the lexicon lands (v1 renders none).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CircleActivity {
    pub completed_rounds: u64,
}

/// What a spirit-supply panel WOULD carry once `SPIRIT-1` is landed in-tree (v1 renders none).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpiritSupply {
    pub souls: u64,
    pub per_soul_unlock: Amount,
}

/// The composed dashboard. Measured panels trace to real sources; `circle` and `spirit` are
/// honestly [`Panel::Absent`] with their reasons.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Dashboard {
    /// The observation time this view was composed at — carried, not ambient (determinism, and so
    /// a rendered figure always has a time it was true).
    pub as_of_unix: i64,
    pub respect: Vec<RespectStanding>,
    /// Total `b` in existence — the ledger's own sum.
    pub b_supply: Amount,
    pub threads: Vec<ThreadPosition>,
    pub circle: Panel<CircleActivity>,
    pub spirit: Panel<SpiritSupply>,
}

impl Dashboard {
    /// Compose the dashboard from live, tested sources. `standings` are computed
    /// [`ReputationScore`]s; `ledger` and `liens` are the kernel's own state; `threads` are the
    /// DIDs to show positions for; `now` derives each thread's age for its floor bound.
    ///
    /// **Read-only:** all inputs are shared references. Nothing here mutates state, moves `b`, or
    /// sets status — a dashboard reads.
    pub fn build(
        as_of_unix: i64,
        standings: &[ReputationScore],
        ledger: &BLedger,
        liens: &LienBook,
        threads: &[Did],
        maturation: &MaturationParams,
    ) -> Dashboard {
        let _ = maturation; // the floor bound is maturation-independent; kept for the age-derived seam
        let respect = standings
            .iter()
            .map(|s| RespectStanding {
                did: s.did.clone(),
                score: s.score,
            })
            .collect();

        let positions = threads
            .iter()
            .map(|did| {
                let standing = ThreadStanding::from_ledger(ledger, did, as_of_unix);
                let collateralized = liens.collateralized_of(did);
                let floor_bound = standing.floor_bound();
                ThreadPosition {
                    did: did.clone(),
                    balance: ledger.balance_of(did),
                    spendable: ledger.spendable_of(did),
                    minted_to_date: ledger.minted_to_date_of(did),
                    collateralized,
                    floor_bound,
                    // Not a saturated difference: a breach must not read as "0 headroom". The floor
                    // is enforced at lock(), so Breach should be unreachable — and the dashboard is
                    // exactly where that impossible state must be loud if it ever occurs.
                    headroom: Headroom::classify(floor_bound, collateralized),
                }
            })
            .collect();

        Dashboard {
            as_of_unix,
            respect,
            b_supply: ledger.supply(),
            threads: positions,
            circle: Panel::Absent {
                reason: "circle-outcome lexicon not yet landed (BIND-1 §4): circle OUTCOMES cannot \
                         cross the seam until it does. A read-only analytics panel does not need it — \
                         this ships Absent now and the lexicon becomes an upgrade, not a gate."
                    .to_string(),
            },
            spirit: Panel::Absent {
                reason: "SPIRIT-1 is undefined in-tree (CD-29 §U-11): the 420-per-soul supply is \
                         carried on dispatch authority, not measured. Shown NotMeasured, never as a \
                         fact — land SPIRIT-1 or this panel stays Absent."
                    .to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use b_token::{AcceptNonEmptyProof, ResourceProof};
    use reputation_engine::{compute, ReputationInput};

    const NOW: i64 = 2_000_000_000;
    const YEAR: i64 = 365 * 24 * 3600;

    fn did(s: &str) -> Did {
        Did::new(s)
    }
    /// Mint `amt` to `who` at a genesis giving age 8 (mature) as of NOW.
    fn funded(who: &Did, amt: Amount) -> BLedger {
        let mut l = BLedger::new();
        l.mint(
            who,
            amt,
            &ResourceProof {
                evidence_ref: "seed".into(),
            },
            &AcceptNonEmptyProof,
            NOW - 8 * YEAR,
        )
        .unwrap();
        l
    }
    fn standing(did_str: &str, completed: u64) -> ReputationScore {
        compute(&ReputationInput {
            did: did_str.to_string(),
            completed_escrows: completed,
            disputed_escrows: 0,
            resolved_favorable: 0,
            evidence_submitted: vec![],
            attestations_received: vec![],
            as_of_unix: NOW,
        })
    }

    fn sample() -> (BLedger, LienBook, Vec<Did>) {
        let a = did("did:example:a");
        let mut led = funded(&a, 1000);
        let mut liens = LienBook::new();
        // a mature thread locks 300 of its 1000 (well under the 800 floor).
        liens
            .lock(&mut led, &a, 300, NOW, &MaturationParams::default())
            .unwrap();
        (led, liens, vec![a])
    }

    #[test]
    fn measured_panels_trace_to_the_real_sources() {
        let (led, liens, threads) = sample();
        let rs = vec![standing("did:example:a", 2)]; // 2 completed escrows → score 50
        let d = Dashboard::build(
            NOW,
            &rs,
            &led,
            &liens,
            &threads,
            &MaturationParams::default(),
        );
        assert_eq!(d.b_supply, led.supply(), "b supply is the ledger's own sum");
        assert_eq!(
            d.respect[0].score, 50,
            "Respect standing is reputation-engine's projection"
        );
        let p = &d.threads[0];
        assert_eq!(p.balance, 1000);
        assert_eq!(p.minted_to_date, 1000);
        assert_eq!(p.collateralized, 300);
        assert_eq!(p.spendable, 700, "reserved b is not spendable");
        assert_eq!(p.floor_bound, 800, "80% of minted-to-date");
        assert_eq!(
            p.headroom,
            Headroom::Available(500),
            "800 floor − 300 collateralized, carrying its inputs"
        );
    }

    #[test]
    fn circle_panel_is_honest_empty_with_its_reason() {
        let (led, liens, threads) = sample();
        let d = Dashboard::build(
            NOW,
            &[],
            &led,
            &liens,
            &threads,
            &MaturationParams::default(),
        );
        assert!(
            !d.circle.is_measured(),
            "circle activity is not shown as a fact in v1"
        );
        let reason = d
            .circle
            .reason()
            .expect("an absent panel must carry its reason");
        assert!(
            reason.contains("lexicon"),
            "the reason names why it is absent"
        );
        assert!(!reason.is_empty());
    }

    #[test]
    fn spirit_panel_is_notmeasured_never_a_fabricated_number() {
        // SPIRIT-1 is undefined in-tree; the panel must be Absent with its reason, and there must
        // be no path in build() that renders a souls count or the 420 law as Measured.
        let (led, liens, threads) = sample();
        let d = Dashboard::build(
            NOW,
            &[],
            &led,
            &liens,
            &threads,
            &MaturationParams::default(),
        );
        assert!(
            !d.spirit.is_measured(),
            "SPIRIT-1 is dispatch-carried, not measured — never shown as a fact"
        );
        let reason = d.spirit.reason().unwrap();
        assert!(
            reason.contains("SPIRIT-1"),
            "the reason names the undefined register"
        );
    }

    #[test]
    fn at_the_cap_reads_atcap_not_a_number() {
        // A thread collateralized to exactly the floor is AtCap — a legitimate boundary, and a
        // DISTINCT arm from a breach. It must never render as a bare "0" that a breach could also
        // wear.
        let a = did("did:example:a");
        let mut led = funded(&a, 1000);
        let mut liens = LienBook::new();
        liens
            .lock(&mut led, &a, 800, NOW, &MaturationParams::default())
            .unwrap(); // exactly the 80% floor
        let d = Dashboard::build(NOW, &[], &led, &liens, &[a], &MaturationParams::default());
        assert_eq!(d.threads[0].collateralized, 800);
        assert_eq!(
            d.threads[0].headroom,
            Headroom::AtCap,
            "at the cap is AtCap, not a number"
        );
        assert!(!d.threads[0].headroom.is_breach());
    }

    #[test]
    fn a_floor_breach_is_loud_not_a_quiet_zero() {
        // Positive control for the alarm. lock() enforces the floor, so this state is unreachable
        // through the real API — but an alarm never shown to fire isn't an alarm. If
        // collateralization ever exceeds the floor, the classifier must surface Breach(overage),
        // never AtCap and never a saturated 0. And the boundary and the breach must be
        // distinguishable — that is the whole finding.
        assert_eq!(
            Headroom::classify(800, 950),
            Headroom::Breach(150),
            "a breach surfaces its overage, not a saturated 0"
        );
        assert!(Headroom::classify(800, 950).is_breach());
        assert_eq!(Headroom::classify(800, 800), Headroom::AtCap);
        assert_ne!(
            Headroom::classify(800, 800),
            Headroom::classify(800, 801),
            "at-cap and one-over must not look alike"
        );
    }

    #[test]
    fn build_is_read_only_it_mutates_no_state() {
        let (led, liens, threads) = sample();
        let supply_before = led.supply();
        let reserved_before = led.reserved_of(&threads[0]);
        let _ = Dashboard::build(
            NOW,
            &[],
            &led,
            &liens,
            &threads,
            &MaturationParams::default(),
        );
        // build took shared references; nothing moved.
        assert_eq!(led.supply(), supply_before);
        assert_eq!(led.reserved_of(&threads[0]), reserved_before);
    }
}
