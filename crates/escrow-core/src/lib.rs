//! bNature escrow state machine — build brief §9.1 (transition table) and
//! §9.2 (ZANO fee-buffer amendment).
//!
//! Pure logic: no chain I/O and no ambient clock. Time enters only through
//! events (`Timeout { now }`, per-event timestamps), which is what makes the
//! machine deterministic and the tests hermetic. The DRO reconstructs state
//! by replaying the same events off the CanonicalEvent stream.
//!
//! ```text
//! Created ──BuyerFunded──▶ Funded ──SellerShipped──▶ Shipped ──DeliveryConfirmed──▶ Delivered ──BuyerReleased──▶ Completed
//!    │ 24h                   │ 72h                     │ 14d                          │ 7d ──────────────────────▶ Completed (auto)
//!    ▼                       ▼                         ▼                              ├──DisputeOpened──▶ Disputed
//! Expired                 Expired*                  Disputed (auto)                   │                     │ DisputeResolved
//!                                                                                     ▼                     ▼
//!                                                                              (window: < 7d)   Refunded / Completed / Resolved
//! ```
//!
//! *Expiry from `Funded` obligates a DRO-co-signed refund of the held funds
//! (table: "Expired → Refunded (DRO co-signs)"). That refund is a settlement
//! action outside this crate; the machine records the terminal `Expired`.
//!
//! Deviations from the §9.2 struct, both deliberate and minimal:
//! - `funded_at` field added: the 72h Funded timeout is measured from the
//!   funding moment, which the spec struct had no way to know.
//! - `dispute_id` is set from `DisputeOpened.reason_hash` (the only dispute
//!   identifier that exists at open time). A timeout-auto-dispute has no
//!   opener, so it leaves `dispute_id` as `None`.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};

/// Timeout windows from the §9.1 transition table.
pub const CREATED_TIMEOUT: Duration = Duration::hours(24);
pub const FUNDED_TIMEOUT: Duration = Duration::hours(72);
pub const SHIPPED_TIMEOUT: Duration = Duration::days(14);
pub const DELIVERED_TIMEOUT: Duration = Duration::days(7);

/// §9.2 reference fee buffer: 10_000_000 atomic units = 0.1 ZANO. A network
/// constant callers may use when constructing escrows; the machine enforces
/// whatever `fee_buffer_zano` the escrow was created with.
pub const FEE_BUFFER: u64 = 10_000_000;

/// 32-byte public key (buyer/seller are hardware-wallet identities, the DRO
/// is the `bnature.dro` contract signer). Opaque bytes here — no curve math
/// in this crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicKey(pub [u8; 32]);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EscrowState {
    Created,
    Funded,
    Shipped,
    Delivered,
    Completed,
    Refunded,
    Disputed,
    Resolved,
    Expired,
}

/// How a delivery was confirmed (table: "carrier scan / buyer confirm").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeliverySource {
    CarrierScan,
    BuyerConfirm,
}

/// DRO verdict on a dispute (§5 `DisputeRecommendation.verdict`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Verdict {
    RefundBuyer,
    ReleaseToSeller,
    Split,
}

/// Driving events (§9.1). All carry the wall-time they occurred at where the
/// machine needs it — there is no other source of time.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum EscrowEvent {
    /// Observed multisig balances at funding time. Both the asset amount and
    /// the native-ZANO fee buffer must be present to transition (§9.2).
    BuyerFunded {
        asset_amount: u64,
        zano_amount: u64,
        at: OffsetDateTime,
    },
    SellerShipped {
        tracking: String,
        carrier: String,
        at: OffsetDateTime,
    },
    DeliveryConfirmed {
        timestamp: OffsetDateTime,
        source: DeliverySource,
    },
    BuyerReleased {
        at: OffsetDateTime,
    },
    DisputeOpened {
        reason_hash: String,
        at: OffsetDateTime,
    },
    DisputeResolved {
        verdict: Verdict,
        resolution_id: String,
    },
    /// Timer tick. The machine decides whether the current state's window
    /// has actually elapsed; an early tick is an error, not a no-op.
    Timeout {
        now: OffsetDateTime,
    },
}

impl EscrowEvent {
    pub fn name(&self) -> &'static str {
        match self {
            EscrowEvent::BuyerFunded { .. } => "BuyerFunded",
            EscrowEvent::SellerShipped { .. } => "SellerShipped",
            EscrowEvent::DeliveryConfirmed { .. } => "DeliveryConfirmed",
            EscrowEvent::BuyerReleased { .. } => "BuyerReleased",
            EscrowEvent::DisputeOpened { .. } => "DisputeOpened",
            EscrowEvent::DisputeResolved { .. } => "DisputeResolved",
            EscrowEvent::Timeout { .. } => "Timeout",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EscrowError {
    /// The event is not legal in the current state.
    InvalidTransition {
        state: EscrowState,
        event: &'static str,
    },
    /// §9.2 funding check failed: partial funding does not transition.
    InsufficientFunding {
        asset_provided: u64,
        asset_required: u64,
        zano_provided: u64,
        zano_required: u64,
    },
    /// A `Timeout` tick arrived before the current state's window elapsed.
    TimeoutNotReached { state: EscrowState },
    /// "Disputes must open before timeout or auto-action proceeds" (§9.1).
    DisputeWindowClosed {
        opened_at: OffsetDateTime,
        deadline: OffsetDateTime,
    },
    /// A deadline (`anchor + window`) would fall outside the representable
    /// `OffsetDateTime` range. Reachable from an adversarial far-future
    /// timestamp (crafted event or a deserialized/replayed escrow). The
    /// machine must return this, never panic on the arithmetic.
    DeadlineOverflow { state: EscrowState },
    /// The escrow's state requires an anchor timestamp that is absent — an
    /// internally-inconsistent record. `new()` + `transition` can never
    /// produce this, but `Escrow` derives `Deserialize` with public fields,
    /// so a replayed/forged escrow (e.g. `state = Funded, funded_at = None`)
    /// can. The machine returns this instead of panicking on the missing
    /// anchor; callers replaying untrusted streams should treat it as a
    /// corrupt record.
    InconsistentState { state: EscrowState },
    /// A lifecycle event's timestamp precedes the anchor it must follow
    /// (shipping before funding, delivery before shipping, a dispute before
    /// delivery). These stored timestamps must be non-decreasing; a backwards
    /// stamp is rejected so it cannot relocate a timeout/dispute window into
    /// the past. (Funding is exempt — `created_at` is record bookkeeping, not
    /// a lifecycle event, so on-chain funding may predate it. And the machine
    /// is clock-free, so it cannot bound a timestamp's *future* — that
    /// plausibility check belongs to the ingestion layer, which has a clock.)
    NonMonotonicTime {
        event: &'static str,
        at: OffsetDateTime,
        not_before: OffsetDateTime,
    },
    /// The escrow's denominated `amount` is zero — a valueless record. The
    /// §9.2 funding check `asset_amount >= self.amount` is trivially satisfied
    /// by an `amount == 0` escrow for ANY `asset_amount` (including 0), so
    /// without this guard an empty escrow reads as Funded. `new()` stays a
    /// total constructor; funding refuses a zero-amount escrow here so the
    /// degenerate record can never hold or move value.
    ZeroAmountEscrow,
}

impl std::fmt::Display for EscrowError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EscrowError::InvalidTransition { state, event } => {
                write!(f, "event {event} is not valid in state {state:?}")
            }
            EscrowError::InsufficientFunding {
                asset_provided,
                asset_required,
                zano_provided,
                zano_required,
            } => write!(
                f,
                "partial funding: asset {asset_provided}/{asset_required}, \
                 zano fee buffer {zano_provided}/{zano_required}"
            ),
            EscrowError::TimeoutNotReached { state } => {
                write!(f, "timeout window for state {state:?} has not elapsed")
            }
            EscrowError::DisputeWindowClosed {
                opened_at,
                deadline,
            } => {
                write!(f, "dispute opened at {opened_at} after deadline {deadline}")
            }
            EscrowError::DeadlineOverflow { state } => {
                write!(
                    f,
                    "deadline for state {state:?} overflows the representable time range"
                )
            }
            EscrowError::InconsistentState { state } => {
                write!(
                    f,
                    "state {state:?} is missing a required anchor timestamp (corrupt escrow)"
                )
            }
            EscrowError::NonMonotonicTime {
                event,
                at,
                not_before,
            } => write!(
                f,
                "event {event} timestamp {at} precedes the anchor it must follow ({not_before})"
            ),
            EscrowError::ZeroAmountEscrow => {
                write!(
                    f,
                    "escrow amount is zero: a valueless escrow cannot be funded"
                )
            }
        }
    }
}

impl std::error::Error for EscrowError {}

/// §9.2 amended escrow record (plus `funded_at`, see module docs).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Escrow {
    pub order_id: String,
    pub multisig_wallet_id: String,
    pub buyer: PublicKey,
    pub seller: PublicKey,
    pub dro_public_key: PublicKey,
    pub state: EscrowState,
    /// Denominated asset (fUSD), atomic units.
    pub amount: u64,
    /// fUSD asset id (full hex id in brief §1; kept out of code on purpose).
    pub asset_id: Option<String>,
    /// Native ZANO for the tx fee, funded by the buyer (§9.2). The multisig
    /// pays its own fee; the DRO never needs a ZANO balance.
    pub fee_buffer_zano: u64,
    pub created_at: OffsetDateTime,
    pub funded_at: Option<OffsetDateTime>,
    pub shipped_at: Option<OffsetDateTime>,
    pub delivered_at: Option<OffsetDateTime>,
    pub dispute_id: Option<String>,
}

impl Escrow {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        order_id: impl Into<String>,
        multisig_wallet_id: impl Into<String>,
        buyer: PublicKey,
        seller: PublicKey,
        dro_public_key: PublicKey,
        amount: u64,
        asset_id: Option<String>,
        fee_buffer_zano: u64,
        created_at: OffsetDateTime,
    ) -> Self {
        Escrow {
            order_id: order_id.into(),
            multisig_wallet_id: multisig_wallet_id.into(),
            buyer,
            seller,
            dro_public_key,
            state: EscrowState::Created,
            amount,
            asset_id,
            fee_buffer_zano,
            created_at,
            funded_at: None,
            shipped_at: None,
            delivered_at: None,
            dispute_id: None,
        }
    }

    /// Apply one event. On `Ok` the state (and any timestamps the event
    /// carries) are updated and the new state is returned. On `Err` the
    /// escrow is left completely unchanged.
    pub fn transition(&mut self, event: EscrowEvent) -> Result<EscrowState, EscrowError> {
        use EscrowState::*;

        let next = match (self.state, event) {
            // Created --buyer funds multisig--> Funded (24h else Expired)
            (
                Created,
                EscrowEvent::BuyerFunded {
                    asset_amount,
                    zano_amount,
                    at,
                },
            ) => {
                // A zero-amount escrow is valueless: the §9.2 comparison below
                // (`asset_amount >= self.amount`) would be trivially satisfied
                // for any asset_amount, including 0, funding an empty escrow.
                // Refuse it before the comparison so the degenerate record can
                // never reach Funded.
                if self.amount == 0 {
                    return Err(EscrowError::ZeroAmountEscrow);
                }
                // NOTE: funding is deliberately NOT required to follow
                // `created_at`. `created_at` is when the escrow *record* was
                // created (the daemon's bookkeeping); the funding `at` is the
                // observed on-chain confirmation time, which legitimately
                // predates the record when the daemon catches up on / replays
                // history. Monotonicity applies to the lifecycle events that
                // drive windows (ship/deliver/dispute), not to this seam.
                if asset_amount >= self.amount && zano_amount >= self.fee_buffer_zano {
                    self.funded_at = Some(at);
                    Funded
                } else {
                    return Err(EscrowError::InsufficientFunding {
                        asset_provided: asset_amount,
                        asset_required: self.amount,
                        zano_provided: zano_amount,
                        zano_required: self.fee_buffer_zano,
                    });
                }
            }
            (Created, EscrowEvent::Timeout { now }) => {
                let deadline = Self::deadline(self.created_at, CREATED_TIMEOUT, Created)?;
                self.check_deadline(Created, now, deadline)?;
                Expired
            }

            // Funded --seller marks shipped--> Shipped (72h else Expired,
            // which obligates a DRO-co-signed refund — see module docs)
            (Funded, EscrowEvent::SellerShipped { at, .. }) => {
                let funded_at = Self::require(self.funded_at, Funded)?;
                Self::require_monotonic(at, funded_at, "SellerShipped")?;
                self.shipped_at = Some(at);
                Shipped
            }
            (Funded, EscrowEvent::Timeout { now }) => {
                let funded_at = Self::require(self.funded_at, Funded)?;
                let deadline = Self::deadline(funded_at, FUNDED_TIMEOUT, Funded)?;
                self.check_deadline(Funded, now, deadline)?;
                Expired
            }

            // Shipped --carrier scan / buyer confirm--> Delivered
            // (14d else auto-Disputed; AI monitors tracking)
            (Shipped, EscrowEvent::DeliveryConfirmed { timestamp, .. }) => {
                let shipped_at = Self::require(self.shipped_at, Shipped)?;
                Self::require_monotonic(timestamp, shipped_at, "DeliveryConfirmed")?;
                self.delivered_at = Some(timestamp);
                Delivered
            }
            (Shipped, EscrowEvent::Timeout { now }) => {
                let shipped_at = Self::require(self.shipped_at, Shipped)?;
                let deadline = Self::deadline(shipped_at, SHIPPED_TIMEOUT, Shipped)?;
                self.check_deadline(Shipped, now, deadline)?;
                Disputed // auto-dispute: no opener, dispute_id stays None
            }

            // Delivered --buyer releases--> Completed (7d auto-release)
            (Delivered, EscrowEvent::BuyerReleased { .. }) => Completed,
            (Delivered, EscrowEvent::Timeout { now }) => {
                let delivered_at = Self::require(self.delivered_at, Delivered)?;
                let deadline = Self::deadline(delivered_at, DELIVERED_TIMEOUT, Delivered)?;
                self.check_deadline(Delivered, now, deadline)?;
                Completed // auto-release (DRO co-signs)
            }
            // Delivered --buyer disputes--> Disputed, only before the
            // auto-release deadline ("disputes must open before timeout")
            (Delivered, EscrowEvent::DisputeOpened { reason_hash, at }) => {
                let delivered_at = Self::require(self.delivered_at, Delivered)?;
                Self::require_monotonic(at, delivered_at, "DisputeOpened")?;
                let deadline = Self::deadline(delivered_at, DELIVERED_TIMEOUT, Delivered)?;
                if at >= deadline {
                    return Err(EscrowError::DisputeWindowClosed {
                        opened_at: at,
                        deadline,
                    });
                }
                self.dispute_id = Some(reason_hash);
                Disputed
            }

            // Disputed --DRO verdict--> Refunded / Completed / Resolved(split)
            (Disputed, EscrowEvent::DisputeResolved { verdict, .. }) => match verdict {
                Verdict::RefundBuyer => Refunded,
                Verdict::ReleaseToSeller => Completed,
                Verdict::Split => Resolved,
            },

            // Everything else — including any event in the terminal states
            // Completed / Refunded / Resolved / Expired — is invalid.
            (state, event) => {
                return Err(EscrowError::InvalidTransition {
                    state,
                    event: event.name(),
                })
            }
        };

        self.state = next;
        Ok(next)
    }

    /// Timeout fires at `now >= deadline`; an earlier tick is rejected.
    fn check_deadline(
        &self,
        state: EscrowState,
        now: OffsetDateTime,
        deadline: OffsetDateTime,
    ) -> Result<(), EscrowError> {
        if now >= deadline {
            Ok(())
        } else {
            Err(EscrowError::TimeoutNotReached { state })
        }
    }

    /// `anchor + window`, but total: an out-of-range result is a typed error,
    /// never the panic that `OffsetDateTime`'s `Add` produces. Every deadline
    /// in the machine goes through here so no crafted timestamp can panic.
    fn deadline(
        anchor: OffsetDateTime,
        window: Duration,
        state: EscrowState,
    ) -> Result<OffsetDateTime, EscrowError> {
        anchor
            .checked_add(window)
            .ok_or(EscrowError::DeadlineOverflow { state })
    }

    /// The anchor a state relies on, or `InconsistentState` if a forged/
    /// deserialized record left it absent. Replaces the `.expect()` that a
    /// `new()`-built escrow could never trip but a replayed one can.
    fn require(
        anchor: Option<OffsetDateTime>,
        state: EscrowState,
    ) -> Result<OffsetDateTime, EscrowError> {
        anchor.ok_or(EscrowError::InconsistentState { state })
    }

    /// Reject an event timestamp that precedes the anchor it must follow, so
    /// no stored timestamp can move a window into the past.
    fn require_monotonic(
        at: OffsetDateTime,
        not_before: OffsetDateTime,
        event: &'static str,
    ) -> Result<(), EscrowError> {
        if at >= not_before {
            Ok(())
        } else {
            Err(EscrowError::NonMonotonicTime {
                event,
                at,
                not_before,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::macros::datetime;

    const AMOUNT: u64 = 5_000_000; // 5 fUSD atomic
    fn t0() -> OffsetDateTime {
        datetime!(2026-07-02 12:00 UTC)
    }
    fn fund_at() -> OffsetDateTime {
        t0() + Duration::hours(1)
    }
    fn ship_at() -> OffsetDateTime {
        t0() + Duration::hours(2)
    }
    fn deliver_at() -> OffsetDateTime {
        t0() + Duration::hours(3)
    }

    fn escrow() -> Escrow {
        Escrow::new(
            "order-1",
            "msig-1",
            PublicKey([0x01; 32]),
            PublicKey([0x02; 32]),
            PublicKey([0x03; 32]),
            AMOUNT,
            Some("fusd-asset-id".into()),
            FEE_BUFFER,
            t0(),
        )
    }

    fn full_funding(at: OffsetDateTime) -> EscrowEvent {
        EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT,
            zano_amount: FEE_BUFFER,
            at,
        }
    }
    fn shipped(at: OffsetDateTime) -> EscrowEvent {
        EscrowEvent::SellerShipped {
            tracking: "1Z999".into(),
            carrier: "UPS".into(),
            at,
        }
    }
    fn delivered(timestamp: OffsetDateTime) -> EscrowEvent {
        EscrowEvent::DeliveryConfirmed {
            timestamp,
            source: DeliverySource::CarrierScan,
        }
    }
    fn disputed(at: OffsetDateTime) -> EscrowEvent {
        EscrowEvent::DisputeOpened {
            reason_hash: "reason-hash-1".into(),
            at,
        }
    }
    fn resolved(verdict: Verdict) -> EscrowEvent {
        EscrowEvent::DisputeResolved {
            verdict,
            resolution_id: "res-1".into(),
        }
    }

    #[test]
    fn zero_amount_escrow_cannot_be_funded() {
        // A zero-amount escrow is degenerate — it holds no value. Because the
        // §9.2 check is `asset_amount >= self.amount`, an `amount == 0` escrow
        // would satisfy funding for ANY asset_amount (including 0), reading an
        // empty escrow as Funded. Funding must refuse it and leave it Created.
        let mut zero = Escrow::new(
            "order-zero",
            "msig-zero",
            PublicKey([0x01; 32]),
            PublicKey([0x02; 32]),
            PublicKey([0x03; 32]),
            0,
            Some("fusd-asset-id".into()),
            FEE_BUFFER,
            t0(),
        );

        // The trivial-satisfy case: zero asset against a zero requirement.
        let empty = EscrowEvent::BuyerFunded {
            asset_amount: 0,
            zano_amount: FEE_BUFFER,
            at: fund_at(),
        };
        assert_eq!(
            zero.transition(empty),
            Err(EscrowError::ZeroAmountEscrow),
            "amount==0 must not fund on asset_amount 0"
        );
        assert_eq!(
            zero.state,
            EscrowState::Created,
            "a refused funding leaves the escrow Created"
        );

        // And a positive asset amount cannot bring a valueless escrow to life.
        let overfunded = EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT,
            zano_amount: FEE_BUFFER,
            at: fund_at(),
        };
        assert_eq!(
            zero.transition(overfunded),
            Err(EscrowError::ZeroAmountEscrow),
            "amount==0 must not fund even on a positive asset_amount"
        );
        assert_eq!(zero.state, EscrowState::Created);
    }

    /// Drive a fresh escrow into `state` through real transitions only.
    fn escrow_in(state: EscrowState) -> Escrow {
        use EscrowState::*;
        let mut e = escrow();
        let path: &[EscrowEvent] = match state {
            Created => &[],
            Funded => &[full_funding(fund_at())],
            Shipped => &[full_funding(fund_at()), shipped(ship_at())],
            Delivered => &[
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
            ],
            Completed => &[
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
                EscrowEvent::BuyerReleased {
                    at: deliver_at() + Duration::hours(1),
                },
            ],
            Disputed => &[
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
                disputed(deliver_at() + Duration::hours(1)),
            ],
            Refunded => &[
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
                disputed(deliver_at() + Duration::hours(1)),
                resolved(Verdict::RefundBuyer),
            ],
            Resolved => &[
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
                disputed(deliver_at() + Duration::hours(1)),
                resolved(Verdict::Split),
            ],
            Expired => &[EscrowEvent::Timeout {
                now: t0() + CREATED_TIMEOUT,
            }],
        };
        for ev in path {
            e.transition(ev.clone()).expect("path event must be valid");
        }
        assert_eq!(e.state, state, "helper must land in requested state");
        e
    }

    // ---- valid transitions, one by one --------------------------------

    #[test]
    fn created_funds_to_funded_and_stamps_funded_at() {
        let mut e = escrow();
        assert_eq!(
            e.transition(full_funding(fund_at())),
            Ok(EscrowState::Funded)
        );
        assert_eq!(e.funded_at, Some(fund_at()));
    }

    #[test]
    fn created_overfunding_is_accepted() {
        let mut e = escrow();
        let ev = EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT + 1,
            zano_amount: FEE_BUFFER + 1,
            at: fund_at(),
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Funded));
    }

    #[test]
    fn funded_ships_and_stamps_shipped_at() {
        let mut e = escrow_in(EscrowState::Funded);
        assert_eq!(e.transition(shipped(ship_at())), Ok(EscrowState::Shipped));
        assert_eq!(e.shipped_at, Some(ship_at()));
    }

    #[test]
    fn shipped_delivers_via_carrier_scan_and_stamps_delivered_at() {
        let mut e = escrow_in(EscrowState::Shipped);
        assert_eq!(
            e.transition(delivered(deliver_at())),
            Ok(EscrowState::Delivered)
        );
        assert_eq!(e.delivered_at, Some(deliver_at()));
    }

    #[test]
    fn shipped_delivers_via_buyer_confirm() {
        let mut e = escrow_in(EscrowState::Shipped);
        let ev = EscrowEvent::DeliveryConfirmed {
            timestamp: deliver_at(),
            source: DeliverySource::BuyerConfirm,
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Delivered));
    }

    #[test]
    fn delivered_buyer_release_completes() {
        let mut e = escrow_in(EscrowState::Delivered);
        let ev = EscrowEvent::BuyerReleased {
            at: deliver_at() + Duration::hours(1),
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Completed));
    }

    #[test]
    fn delivered_dispute_within_window_and_sets_dispute_id() {
        let mut e = escrow_in(EscrowState::Delivered);
        assert_eq!(
            e.transition(disputed(deliver_at() + Duration::hours(1))),
            Ok(EscrowState::Disputed)
        );
        assert_eq!(e.dispute_id, Some("reason-hash-1".into()));
    }

    #[test]
    fn disputed_resolves_refund_buyer() {
        let mut e = escrow_in(EscrowState::Disputed);
        assert_eq!(
            e.transition(resolved(Verdict::RefundBuyer)),
            Ok(EscrowState::Refunded)
        );
    }

    #[test]
    fn disputed_resolves_release_to_seller() {
        let mut e = escrow_in(EscrowState::Disputed);
        assert_eq!(
            e.transition(resolved(Verdict::ReleaseToSeller)),
            Ok(EscrowState::Completed)
        );
    }

    #[test]
    fn disputed_resolves_split() {
        let mut e = escrow_in(EscrowState::Disputed);
        assert_eq!(
            e.transition(resolved(Verdict::Split)),
            Ok(EscrowState::Resolved)
        );
    }

    // ---- funding check (§9.2): partial funding does not transition -----

    #[test]
    fn partial_funding_asset_short_rejected() {
        let mut e = escrow();
        let ev = EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT - 1,
            zano_amount: FEE_BUFFER,
            at: fund_at(),
        };
        assert!(matches!(
            e.transition(ev),
            Err(EscrowError::InsufficientFunding { .. })
        ));
        assert_eq!(e.state, EscrowState::Created);
        assert_eq!(e.funded_at, None);
    }

    #[test]
    fn partial_funding_fee_buffer_short_rejected() {
        let mut e = escrow();
        let ev = EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT,
            zano_amount: FEE_BUFFER - 1,
            at: fund_at(),
        };
        assert!(matches!(
            e.transition(ev),
            Err(EscrowError::InsufficientFunding { .. })
        ));
        assert_eq!(e.state, EscrowState::Created);
    }

    #[test]
    fn partial_funding_both_short_rejected() {
        let mut e = escrow();
        let ev = EscrowEvent::BuyerFunded {
            asset_amount: 0,
            zano_amount: 0,
            at: fund_at(),
        };
        let err = e.transition(ev).unwrap_err();
        assert_eq!(
            err,
            EscrowError::InsufficientFunding {
                asset_provided: 0,
                asset_required: AMOUNT,
                zano_provided: 0,
                zano_required: FEE_BUFFER,
            }
        );
        assert_eq!(e.state, EscrowState::Created);
    }

    // ---- timeouts: early tick rejected, boundary fires ------------------

    #[test]
    fn created_timeout_early_is_rejected() {
        let mut e = escrow();
        let ev = EscrowEvent::Timeout {
            now: t0() + CREATED_TIMEOUT - Duration::seconds(1),
        };
        assert_eq!(
            e.transition(ev),
            Err(EscrowError::TimeoutNotReached {
                state: EscrowState::Created
            })
        );
        assert_eq!(e.state, EscrowState::Created);
    }

    #[test]
    fn created_times_out_to_expired_at_exact_boundary() {
        let mut e = escrow();
        let ev = EscrowEvent::Timeout {
            now: t0() + CREATED_TIMEOUT,
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Expired));
    }

    #[test]
    fn funded_timeout_early_is_rejected() {
        let mut e = escrow_in(EscrowState::Funded);
        let ev = EscrowEvent::Timeout {
            now: fund_at() + FUNDED_TIMEOUT - Duration::seconds(1),
        };
        assert_eq!(
            e.transition(ev),
            Err(EscrowError::TimeoutNotReached {
                state: EscrowState::Funded
            })
        );
    }

    #[test]
    fn funded_times_out_to_expired_measured_from_funded_at() {
        let mut e = escrow_in(EscrowState::Funded);
        // One second before funded_at + 72h but AFTER created_at + 72h:
        // proves the window is measured from funding, not creation.
        let ev = EscrowEvent::Timeout {
            now: t0() + FUNDED_TIMEOUT + Duration::minutes(30),
        };
        assert_eq!(
            e.transition(ev),
            Err(EscrowError::TimeoutNotReached {
                state: EscrowState::Funded
            })
        );
        let ev = EscrowEvent::Timeout {
            now: fund_at() + FUNDED_TIMEOUT,
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Expired));
    }

    #[test]
    fn shipped_timeout_early_is_rejected() {
        let mut e = escrow_in(EscrowState::Shipped);
        let ev = EscrowEvent::Timeout {
            now: ship_at() + SHIPPED_TIMEOUT - Duration::seconds(1),
        };
        assert_eq!(
            e.transition(ev),
            Err(EscrowError::TimeoutNotReached {
                state: EscrowState::Shipped
            })
        );
    }

    #[test]
    fn shipped_times_out_to_auto_dispute_with_no_dispute_id() {
        let mut e = escrow_in(EscrowState::Shipped);
        let ev = EscrowEvent::Timeout {
            now: ship_at() + SHIPPED_TIMEOUT,
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Disputed));
        assert_eq!(e.dispute_id, None); // system-opened, no opener
    }

    #[test]
    fn auto_dispute_still_resolvable_by_dro() {
        let mut e = escrow_in(EscrowState::Shipped);
        e.transition(EscrowEvent::Timeout {
            now: ship_at() + SHIPPED_TIMEOUT,
        })
        .unwrap();
        assert_eq!(
            e.transition(resolved(Verdict::RefundBuyer)),
            Ok(EscrowState::Refunded)
        );
    }

    #[test]
    fn delivered_timeout_early_is_rejected() {
        let mut e = escrow_in(EscrowState::Delivered);
        let ev = EscrowEvent::Timeout {
            now: deliver_at() + DELIVERED_TIMEOUT - Duration::seconds(1),
        };
        assert_eq!(
            e.transition(ev),
            Err(EscrowError::TimeoutNotReached {
                state: EscrowState::Delivered
            })
        );
    }

    #[test]
    fn delivered_times_out_to_auto_release_completed() {
        let mut e = escrow_in(EscrowState::Delivered);
        let ev = EscrowEvent::Timeout {
            now: deliver_at() + DELIVERED_TIMEOUT,
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Completed));
    }

    // ---- dispute window: must open strictly before the auto-release ----

    #[test]
    fn dispute_one_second_before_deadline_is_accepted() {
        let mut e = escrow_in(EscrowState::Delivered);
        let ev = disputed(deliver_at() + DELIVERED_TIMEOUT - Duration::seconds(1));
        assert_eq!(e.transition(ev), Ok(EscrowState::Disputed));
    }

    #[test]
    fn dispute_at_deadline_is_rejected_auto_action_proceeds() {
        let mut e = escrow_in(EscrowState::Delivered);
        let at = deliver_at() + DELIVERED_TIMEOUT;
        assert_eq!(
            e.transition(disputed(at)),
            Err(EscrowError::DisputeWindowClosed {
                opened_at: at,
                deadline: deliver_at() + DELIVERED_TIMEOUT,
            })
        );
        assert_eq!(e.state, EscrowState::Delivered);
        // ...and the auto-action does proceed:
        assert_eq!(
            e.transition(EscrowEvent::Timeout { now: at }),
            Ok(EscrowState::Completed)
        );
    }

    // ---- exhaustive matrix: every (state, event) pair ------------------

    /// Every state × every event kind. The valid set is spelled out; every
    /// other pair must error AND leave the escrow bit-for-bit unchanged.
    #[test]
    fn exhaustive_state_event_matrix() {
        use EscrowState::*;
        let far_future = t0() + Duration::days(365);
        let all_states = [
            Created, Funded, Shipped, Delivered, Completed, Refunded, Disputed, Resolved, Expired,
        ];

        for state in all_states {
            // Representative event of each kind, timestamped so it WOULD be
            // valid wherever that kind is legal (far-future timeout, dispute
            // within window, full funding).
            let events: Vec<EscrowEvent> = vec![
                full_funding(fund_at()),
                shipped(ship_at()),
                delivered(deliver_at()),
                EscrowEvent::BuyerReleased {
                    at: deliver_at() + Duration::hours(1),
                },
                disputed(deliver_at() + Duration::hours(1)),
                resolved(Verdict::Split),
                EscrowEvent::Timeout { now: far_future },
            ];

            for event in events {
                let expected: Option<EscrowState> = match (state, event.name()) {
                    (Created, "BuyerFunded") => Some(Funded),
                    (Created, "Timeout") => Some(Expired),
                    (Funded, "SellerShipped") => Some(Shipped),
                    (Funded, "Timeout") => Some(Expired),
                    (Shipped, "DeliveryConfirmed") => Some(Delivered),
                    (Shipped, "Timeout") => Some(Disputed),
                    (Delivered, "BuyerReleased") => Some(Completed),
                    (Delivered, "DisputeOpened") => Some(Disputed),
                    (Delivered, "Timeout") => Some(Completed),
                    (Disputed, "DisputeResolved") => Some(Resolved), // Split verdict
                    _ => None,
                };

                let mut e = escrow_in(state);
                let before = e.clone();
                let result = e.transition(event.clone());

                match expected {
                    Some(next) => {
                        assert_eq!(
                            result,
                            Ok(next),
                            "expected {state:?} --{}--> {next:?}",
                            event.name()
                        );
                        assert_eq!(e.state, next);
                    }
                    None => {
                        assert!(
                            result.is_err(),
                            "{state:?} --{}--> must be rejected",
                            event.name()
                        );
                        assert_eq!(
                            e,
                            before,
                            "escrow must be unchanged after rejected {} in {state:?}",
                            event.name()
                        );
                    }
                }
            }
        }
    }

    // ---- serde ----------------------------------------------------------

    #[test]
    fn escrow_serde_roundtrip() {
        let e = escrow_in(EscrowState::Disputed);
        let json = serde_json::to_string(&e).unwrap();
        let back: Escrow = serde_json::from_str(&json).unwrap();
        assert_eq!(e, back);
    }

    #[test]
    fn state_serde_roundtrip_all_variants() {
        use EscrowState::*;
        for s in [
            Created, Funded, Shipped, Delivered, Completed, Refunded, Disputed, Resolved, Expired,
        ] {
            let json = serde_json::to_string(&s).unwrap();
            let back: EscrowState = serde_json::from_str(&json).unwrap();
            assert_eq!(s, back);
        }
    }

    // ---- adversarial: deadline arithmetic must never panic (C1) ----------
    //
    // `OffsetDateTime + Duration` panics on overflow. A far-future anchor —
    // crafted event timestamp or a deserialized/replayed escrow — must yield
    // a typed `DeadlineOverflow`, never abort the DRO's replay by panicking.
    // (Pre-fix behavior confirmed to PANIC via the red-team harness.)

    /// One second inside the representable ceiling: any window overflows.
    fn near_time_max() -> OffsetDateTime {
        datetime!(9999-12-31 23:59:59 UTC)
    }

    #[test]
    fn created_timeout_overflow_is_err_not_panic() {
        let mut e = escrow();
        e.created_at = near_time_max();
        assert_eq!(
            e.transition(EscrowEvent::Timeout {
                now: near_time_max()
            }),
            Err(EscrowError::DeadlineOverflow {
                state: EscrowState::Created
            })
        );
        assert_eq!(e.state, EscrowState::Created); // unchanged on Err
    }

    #[test]
    fn funded_timeout_overflow_is_err_not_panic() {
        let mut e = escrow();
        e.state = EscrowState::Funded;
        e.funded_at = Some(near_time_max());
        assert_eq!(
            e.transition(EscrowEvent::Timeout {
                now: near_time_max()
            }),
            Err(EscrowError::DeadlineOverflow {
                state: EscrowState::Funded
            })
        );
    }

    #[test]
    fn shipped_timeout_overflow_is_err_not_panic() {
        let mut e = escrow();
        e.state = EscrowState::Shipped;
        e.shipped_at = Some(near_time_max());
        assert_eq!(
            e.transition(EscrowEvent::Timeout {
                now: near_time_max()
            }),
            Err(EscrowError::DeadlineOverflow {
                state: EscrowState::Shipped
            })
        );
    }

    #[test]
    fn delivered_timeout_overflow_is_err_not_panic() {
        let mut e = escrow();
        e.state = EscrowState::Delivered;
        e.delivered_at = Some(near_time_max());
        assert_eq!(
            e.transition(EscrowEvent::Timeout {
                now: near_time_max()
            }),
            Err(EscrowError::DeadlineOverflow {
                state: EscrowState::Delivered
            })
        );
    }

    #[test]
    fn delivered_dispute_overflow_is_err_not_panic() {
        // With a monotonic `at` (>= delivered_at, so the C3 floor passes) the
        // deadline `delivered_at + DELIVERED_TIMEOUT` is computed before the
        // window check and must surface DeadlineOverflow, never panic.
        let mut e = escrow();
        e.state = EscrowState::Delivered;
        e.delivered_at = Some(near_time_max());
        assert_eq!(
            e.transition(EscrowEvent::DisputeOpened {
                reason_hash: "h".into(),
                at: near_time_max(),
            }),
            Err(EscrowError::DeadlineOverflow {
                state: EscrowState::Delivered
            })
        );
    }

    // ---- adversarial: a forged/deserialized escrow must not panic (C2) ---
    //
    // `Escrow` derives `Deserialize` with public fields, so the DRO replaying
    // a stream can hold `state = Funded, funded_at = None` etc. — a
    // combination `new()` + `transition` never produces. The missing anchor
    // must surface `InconsistentState`, never the `.expect()` panic.
    // (Pre-fix behavior confirmed to PANIC via the red-team harness.)

    /// Build an escrow directly in `state` with the matching anchor absent,
    /// exactly as `serde_json::from_value` of a forged record would.
    fn forged_missing_anchor(state: EscrowState) -> Escrow {
        let mut e = escrow();
        e.state = state;
        e.funded_at = None;
        e.shipped_at = None;
        e.delivered_at = None;
        // Round-trip through serde to prove this is a genuinely deserializable
        // value, not just a hand-poked struct.
        let json = serde_json::to_string(&e).unwrap();
        serde_json::from_str(&json).unwrap()
    }

    #[test]
    fn forged_funded_without_funded_at_timeout_is_err_not_panic() {
        let mut e = forged_missing_anchor(EscrowState::Funded);
        assert_eq!(
            e.transition(EscrowEvent::Timeout { now: t0() }),
            Err(EscrowError::InconsistentState {
                state: EscrowState::Funded
            })
        );
    }

    #[test]
    fn forged_shipped_without_shipped_at_timeout_is_err_not_panic() {
        let mut e = forged_missing_anchor(EscrowState::Shipped);
        assert_eq!(
            e.transition(EscrowEvent::Timeout { now: t0() }),
            Err(EscrowError::InconsistentState {
                state: EscrowState::Shipped
            })
        );
    }

    #[test]
    fn forged_delivered_without_delivered_at_timeout_is_err_not_panic() {
        let mut e = forged_missing_anchor(EscrowState::Delivered);
        assert_eq!(
            e.transition(EscrowEvent::Timeout { now: t0() }),
            Err(EscrowError::InconsistentState {
                state: EscrowState::Delivered
            })
        );
    }

    #[test]
    fn forged_delivered_without_delivered_at_dispute_is_err_not_panic() {
        let mut e = forged_missing_anchor(EscrowState::Delivered);
        assert_eq!(
            e.transition(EscrowEvent::DisputeOpened {
                reason_hash: "h".into(),
                at: t0(),
            }),
            Err(EscrowError::InconsistentState {
                state: EscrowState::Delivered
            })
        );
    }

    // ---- adversarial: stored timestamps must be non-decreasing (C3) ------
    //
    // A stored anchor set backwards relocates a timeout/dispute window into
    // the past — e.g. a delivery stamped before shipping, or a dispute
    // stamped before delivery. Each storing arm rejects a backwards stamp.

    /// Funding is exempt from the monotonic floor: `created_at` is the
    /// record's bookkeeping timestamp, but the funding `at` is the observed
    /// on-chain confirmation, which legitimately predates the record when the
    /// daemon replays/catches up on history (the composition pipeline does
    /// exactly this — created_at = observed-now, funded_at = earlier chain
    /// time). So funding BEFORE created_at must still succeed.
    #[test]
    fn funding_may_predate_record_creation() {
        let mut e = escrow(); // created_at = t0()
        let ev = EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT,
            zano_amount: FEE_BUFFER,
            at: t0() - Duration::days(10),
        };
        assert_eq!(e.transition(ev), Ok(EscrowState::Funded));
        assert_eq!(e.funded_at, Some(t0() - Duration::days(10)));
    }

    #[test]
    fn shipping_before_funding_is_rejected() {
        let mut e = escrow_in(EscrowState::Funded); // funded_at = fund_at()
        let ev = EscrowEvent::SellerShipped {
            tracking: "t".into(),
            carrier: "c".into(),
            at: fund_at() - Duration::seconds(1),
        };
        assert!(matches!(
            e.transition(ev),
            Err(EscrowError::NonMonotonicTime {
                event: "SellerShipped",
                ..
            })
        ));
        assert_eq!(e.state, EscrowState::Funded);
        assert_eq!(e.shipped_at, None);
    }

    #[test]
    fn delivery_before_shipping_is_rejected() {
        let mut e = escrow_in(EscrowState::Shipped); // shipped_at = ship_at()
        let ev = EscrowEvent::DeliveryConfirmed {
            timestamp: ship_at() - Duration::seconds(1),
            source: DeliverySource::CarrierScan,
        };
        assert!(matches!(
            e.transition(ev),
            Err(EscrowError::NonMonotonicTime {
                event: "DeliveryConfirmed",
                ..
            })
        ));
        assert_eq!(e.state, EscrowState::Shipped);
        assert_eq!(e.delivered_at, None);
    }

    #[test]
    fn dispute_before_delivery_is_rejected() {
        let mut e = escrow_in(EscrowState::Delivered); // delivered_at = deliver_at()
        let ev = EscrowEvent::DisputeOpened {
            reason_hash: "h".into(),
            at: deliver_at() - Duration::seconds(1),
        };
        assert!(matches!(
            e.transition(ev),
            Err(EscrowError::NonMonotonicTime {
                event: "DisputeOpened",
                ..
            })
        ));
        assert_eq!(e.state, EscrowState::Delivered);
        assert_eq!(e.dispute_id, None);
    }

    /// The window-relocation attack (delivery stamped far in the future to
    /// keep the dispute window "open" for a past date): a delivery at year
    /// 2999 is monotonic w.r.t. shipping, so it is accepted, but a dispute
    /// filed at a *realistic* (earlier) date is now rejected as non-monotonic
    /// — the buyer can no longer dispute "before" the relocated delivery.
    /// (The residual — a far-future delivery freezes the escrow's clock —
    /// is inherent to the clock-free machine and is bounded at the ingestion
    /// layer, not here; see the NonMonotonicTime docs.)
    #[test]
    fn future_delivery_cannot_admit_an_earlier_dispute() {
        let mut e = escrow_in(EscrowState::Shipped);
        e.transition(EscrowEvent::DeliveryConfirmed {
            timestamp: datetime!(2999-01-01 0:00 UTC),
            source: DeliverySource::CarrierScan,
        })
        .unwrap();
        assert!(matches!(
            e.transition(EscrowEvent::DisputeOpened {
                reason_hash: "h".into(),
                at: datetime!(2027-01-01 0:00 UTC),
            }),
            Err(EscrowError::NonMonotonicTime { .. })
        ));
    }

    // ---- canonical parse: closed schema (C4) ----------------------------
    //
    // The event stream is replayed by independent DROs; an unknown field
    // must not be silently dropped (a canonicalization hazard across JSON
    // libraries). `deny_unknown_fields` makes the schema closed.

    #[test]
    fn escrow_rejects_unknown_fields() {
        let e = escrow();
        let mut v: serde_json::Value = serde_json::to_value(&e).unwrap();
        v["totally_unknown_field"] = serde_json::json!(1);
        assert!(serde_json::from_value::<Escrow>(v).is_err());
    }

    #[test]
    fn event_rejects_unknown_fields() {
        let ev = full_funding(fund_at());
        let mut v: serde_json::Value = serde_json::to_value(&ev).unwrap();
        v["BuyerFunded"]["totally_unknown_field"] = serde_json::json!(1);
        assert!(serde_json::from_value::<EscrowEvent>(v).is_err());
    }
}
