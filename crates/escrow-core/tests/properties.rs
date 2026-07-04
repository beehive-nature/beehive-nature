//! Property-based invariants over the escrow state machine (sprint item 3).
//!
//! Machine-generated event sequences are the adversary a century of manual
//! tests won't think of. These properties encode what must hold for *every*
//! deserializable `(Escrow, EscrowEvent)` pair, not just the curated ones:
//!
//! - **Totality** — `transition` returns a `Result`, never panics, for any
//!   forged escrow and any event with adversarial (near-ceiling) timestamps.
//!   This is the property that the C1/C2/C3 fixes make hold; before them a
//!   generated far-future or missing-anchor input would abort the run.
//! - **Legal edges** — every accepted transition follows the §9.1 graph; no
//!   crafted sequence reaches a state without a legal predecessor.
//! - **Terminal absorption** — the terminal states accept no event.
//! - **Error leaves the escrow unchanged** — a rejected event mutates nothing.
//! - **Replay determinism** — the same stream folds to a byte-identical
//!   escrow (all fields, not just `state`).
//! - **Funding is an arithmetic-free comparison** — no overflow/rounding seam.

use escrow_core::*;
use proptest::prelude::*;
use time::macros::datetime;
use time::OffsetDateTime;

// ---- strategies -----------------------------------------------------------

/// Timestamps spanning the representable range, weighted toward the ceilings
/// so deadline arithmetic and monotonicity are probed at the extremes.
fn any_time() -> impl Strategy<Value = OffsetDateTime> {
    prop_oneof![
        1 => Just(datetime!(9999-12-31 23:59:59 UTC)),
        1 => Just(datetime!(-9999-01-01 0:00 UTC)),
        1 => Just(datetime!(2026-07-02 12:00 UTC)),
        4 => any::<i64>().prop_map(|s| {
            OffsetDateTime::from_unix_timestamp(s).unwrap_or(OffsetDateTime::UNIX_EPOCH)
        }),
    ]
}

/// Amounts weighted toward the u64 extremes.
fn any_amount() -> impl Strategy<Value = u64> {
    prop_oneof![
        1 => Just(0u64),
        1 => Just(1u64),
        1 => Just(u64::MAX),
        4 => any::<u64>(),
    ]
}

fn any_state() -> impl Strategy<Value = EscrowState> {
    prop_oneof![
        Just(EscrowState::Created),
        Just(EscrowState::Funded),
        Just(EscrowState::Shipped),
        Just(EscrowState::Delivered),
        Just(EscrowState::Completed),
        Just(EscrowState::Refunded),
        Just(EscrowState::Disputed),
        Just(EscrowState::Resolved),
        Just(EscrowState::Expired),
    ]
}

fn any_event() -> impl Strategy<Value = EscrowEvent> {
    prop_oneof![
        (any_amount(), any_amount(), any_time()).prop_map(|(asset_amount, zano_amount, at)| {
            EscrowEvent::BuyerFunded {
                asset_amount,
                zano_amount,
                at,
            }
        }),
        any_time().prop_map(|at| EscrowEvent::SellerShipped {
            tracking: "trk".into(),
            carrier: "car".into(),
            at,
        }),
        (
            any_time(),
            prop_oneof![
                Just(DeliverySource::CarrierScan),
                Just(DeliverySource::BuyerConfirm)
            ]
        )
            .prop_map(|(timestamp, source)| EscrowEvent::DeliveryConfirmed { timestamp, source }),
        any_time().prop_map(|at| EscrowEvent::BuyerReleased { at }),
        any_time().prop_map(|at| EscrowEvent::DisputeOpened {
            reason_hash: "h".into(),
            at,
        }),
        prop_oneof![
            Just(Verdict::RefundBuyer),
            Just(Verdict::ReleaseToSeller),
            Just(Verdict::Split)
        ]
        .prop_map(|verdict| EscrowEvent::DisputeResolved {
            verdict,
            resolution_id: "r".into(),
        }),
        any_time().prop_map(|now| EscrowEvent::Timeout { now }),
    ]
}

/// An arbitrary — possibly internally-inconsistent — escrow, exactly the
/// shape a replayed/forged CanonicalEvent record can take.
fn any_escrow() -> impl Strategy<Value = Escrow> {
    (
        any_state(),
        any_amount(),
        any_amount(),
        any_time(),
        proptest::option::of(any_time()),
        proptest::option::of(any_time()),
        proptest::option::of(any_time()),
        proptest::option::of(".*"),
    )
        .prop_map(
            |(state, amount, fee, created_at, funded_at, shipped_at, delivered_at, dispute_id)| {
                let mut e = Escrow::new(
                    "order",
                    "msig",
                    PublicKey([1; 32]),
                    PublicKey([2; 32]),
                    PublicKey([3; 32]),
                    amount,
                    Some("asset".into()),
                    fee,
                    created_at,
                );
                e.state = state;
                e.funded_at = funded_at;
                e.shipped_at = shipped_at;
                e.delivered_at = delivered_at;
                e.dispute_id = dispute_id;
                e
            },
        )
}

// ---- the §9.1 transition graph, as a predicate ----------------------------

fn is_legal_edge(prev: EscrowState, next: EscrowState) -> bool {
    use EscrowState::*;
    matches!(
        (prev, next),
        (Created, Funded)
            | (Created, Expired)
            | (Funded, Shipped)
            | (Funded, Expired)
            | (Shipped, Delivered)
            | (Shipped, Disputed)
            | (Delivered, Completed)
            | (Delivered, Disputed)
            | (Disputed, Refunded)
            | (Disputed, Completed)
            | (Disputed, Resolved)
    )
}

fn is_terminal(s: EscrowState) -> bool {
    use EscrowState::*;
    matches!(s, Completed | Refunded | Resolved | Expired)
}

fn fresh() -> Escrow {
    Escrow::new(
        "order",
        "msig",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        5_000_000,
        Some("asset".into()),
        FEE_BUFFER,
        datetime!(2026-07-02 12:00 UTC),
    )
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(2048))]

    /// Totality: no forged escrow + arbitrary event ever panics. (The mere
    /// absence of a panic across 2048 cases is the assertion; a panic fails
    /// the test.) This is the invariant C1/C2/C3 restored.
    #[test]
    fn transition_never_panics(mut e in any_escrow(), ev in any_event()) {
        let _ = e.transition(ev);
    }

    /// A rejected event leaves the escrow bit-for-bit unchanged.
    #[test]
    fn error_leaves_escrow_unchanged(mut e in any_escrow(), ev in any_event()) {
        let before = e.clone();
        if e.transition(ev).is_err() {
            prop_assert_eq!(e, before);
        }
    }

    /// Every accepted transition from a real (new()-built) escrow follows a
    /// §9.1 graph edge, and a terminal state accepts nothing.
    #[test]
    fn accepted_transitions_follow_the_graph(events in prop::collection::vec(any_event(), 0..24)) {
        let mut e = fresh();
        for ev in events {
            let prev = e.state;
            if let Ok(next) = e.transition(ev) {
                prop_assert!(
                    is_legal_edge(prev, next),
                    "illegal edge {:?} -> {:?}", prev, next
                );
                prop_assert!(
                    !is_terminal(prev),
                    "terminal state {:?} accepted an event", prev
                );
                prop_assert_eq!(e.state, next);
            } else {
                prop_assert_eq!(e.state, prev); // rejected → state pinned
            }
        }
    }

    /// Replaying an identical stream from a fresh escrow is deterministic:
    /// the two folds are byte-identical across every field, not just state.
    #[test]
    fn replay_is_deterministic(events in prop::collection::vec(any_event(), 0..24)) {
        let mut a = fresh();
        let mut b = fresh();
        for ev in &events {
            let _ = a.transition(ev.clone());
            let _ = b.transition(ev.clone());
        }
        prop_assert_eq!(&a, &b);
        prop_assert_eq!(
            serde_json::to_string(&a).unwrap(),
            serde_json::to_string(&b).unwrap()
        );
    }

    /// The dual-balance funding check is a pure comparison — no overflow or
    /// rounding seam. A Created escrow funds iff both balances meet their
    /// thresholds, for every u64 including the extremes, and never panics.
    #[test]
    fn funding_is_a_pure_comparison(
        amount in any_amount(),
        fee in any_amount(),
        asset in any_amount(),
        zano in any_amount(),
    ) {
        let mut e = Escrow::new(
            "order", "msig",
            PublicKey([1; 32]), PublicKey([2; 32]), PublicKey([3; 32]),
            amount, Some("asset".into()), fee,
            datetime!(2026-07-02 12:00 UTC),
        );
        let res = e.transition(EscrowEvent::BuyerFunded {
            asset_amount: asset,
            zano_amount: zano,
            at: datetime!(2026-07-02 13:00 UTC),
        });
        let sufficient = asset >= amount && zano >= fee;
        prop_assert_eq!(res.is_ok(), sufficient);
        prop_assert_eq!(e.state == EscrowState::Funded, sufficient);
    }

    /// Century durability: a DRO that persists an escrow mid-stream, restarts,
    /// and resumes must fold to the SAME state as one that never restarted.
    /// Replay to a random split, serialize→deserialize across the "crash",
    /// then finish — and demand equality with the uninterrupted fold. This
    /// proves `Escrow` is a lossless state snapshot: no field the machine
    /// depends on is dropped by serde, and the fold carries no state outside
    /// the struct. (The persistence boundary a 100-year system lives on.)
    #[test]
    fn snapshot_resumption_is_deterministic(
        events in prop::collection::vec(any_event(), 0..24),
        split in 0usize..24,
    ) {
        let mut uninterrupted = fresh();
        for ev in &events {
            let _ = uninterrupted.transition(ev.clone());
        }

        let cut = split.min(events.len());
        let mut resumed = fresh();
        for ev in &events[..cut] {
            let _ = resumed.transition(ev.clone());
        }
        // The "restart": persist and reload from bytes, then continue.
        let json = serde_json::to_string(&resumed).unwrap();
        let mut resumed: Escrow = serde_json::from_str(&json).unwrap();
        for ev in &events[cut..] {
            let _ = resumed.transition(ev.clone());
        }

        prop_assert_eq!(uninterrupted, resumed);
    }
}

// ---- explicit named guards for the directive's attack vectors -------------
//
// These make the specifically-named vectors legible as standalone regression
// tests. They PASS on arrival: the out-of-order vectors are already prevented
// by the (state, event) match + the property `accepted_transitions_follow_the_graph`,
// and the funding vectors by `funding_is_a_pure_comparison`. No red→green here —
// the machine was already correct; these pin the exact named cases so a future
// change cannot reopen them silently.

/// "Deliver before shipped": a delivery confirmation on a Funded (un-shipped)
/// escrow is rejected, and the escrow is left untouched.
#[test]
fn deliver_before_shipped_is_rejected() {
    let mut e = fresh();
    e.transition(EscrowEvent::BuyerFunded {
        asset_amount: 5_000_000,
        zano_amount: FEE_BUFFER,
        at: datetime!(2026-07-02 13:00 UTC),
    })
    .unwrap();
    assert_eq!(e.state, EscrowState::Funded);
    let before = e.clone();
    let r = e.transition(EscrowEvent::DeliveryConfirmed {
        timestamp: datetime!(2026-07-02 14:00 UTC),
        source: DeliverySource::CarrierScan,
    });
    assert!(matches!(r, Err(EscrowError::InvalidTransition { .. })));
    assert_eq!(e, before);
}

/// "Refund after completed": a dispute resolution against a terminal Completed
/// escrow is rejected — a settled order cannot be reopened to move money.
#[test]
fn refund_after_completed_is_rejected() {
    let mut e = fresh();
    e.transition(EscrowEvent::BuyerFunded {
        asset_amount: 5_000_000,
        zano_amount: FEE_BUFFER,
        at: datetime!(2026-07-02 13:00 UTC),
    })
    .unwrap();
    e.transition(EscrowEvent::SellerShipped {
        tracking: "t".into(),
        carrier: "c".into(),
        at: datetime!(2026-07-02 14:00 UTC),
    })
    .unwrap();
    e.transition(EscrowEvent::DeliveryConfirmed {
        timestamp: datetime!(2026-07-02 15:00 UTC),
        source: DeliverySource::CarrierScan,
    })
    .unwrap();
    e.transition(EscrowEvent::BuyerReleased {
        at: datetime!(2026-07-02 16:00 UTC),
    })
    .unwrap();
    assert_eq!(e.state, EscrowState::Completed);
    let before = e.clone();
    let r = e.transition(EscrowEvent::DisputeResolved {
        verdict: Verdict::RefundBuyer,
        resolution_id: "r".into(),
    });
    assert!(matches!(r, Err(EscrowError::InvalidTransition { .. })));
    assert_eq!(e, before); // terminal state is absorbing
}

/// Funding at the u64 ceiling for BOTH balances transitions cleanly — the
/// dual-balance check is a comparison, so there is nothing to overflow.
#[test]
fn funding_no_overflow_at_u64_max() {
    let mut e = Escrow::new(
        "o",
        "m",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        u64::MAX,
        Some("a".into()),
        u64::MAX,
        datetime!(2026-07-02 12:00 UTC),
    );
    let r = e.transition(EscrowEvent::BuyerFunded {
        asset_amount: u64::MAX,
        zano_amount: u64::MAX,
        at: datetime!(2026-07-02 13:00 UTC),
    });
    assert_eq!(r, Ok(EscrowState::Funded));
}

/// Logic-bypass probe: a wildly overfunded fee buffer must NOT let an
/// underfunded asset through. The two balances are independent thresholds —
/// no cross-subsidy — so one-short-on-asset is refused regardless of the fee.
#[test]
fn overfunded_fee_cannot_mask_underfunded_asset() {
    let mut e = fresh(); // amount 5_000_000, fee FEE_BUFFER
    let r = e.transition(EscrowEvent::BuyerFunded {
        asset_amount: 4_999_999, // one atomic unit short on the asset
        zano_amount: u64::MAX,   // fee buffer wildly overfunded
        at: datetime!(2026-07-02 13:00 UTC),
    });
    assert!(matches!(r, Err(EscrowError::InsufficientFunding { .. })));
    assert_eq!(e.state, EscrowState::Created);
}
