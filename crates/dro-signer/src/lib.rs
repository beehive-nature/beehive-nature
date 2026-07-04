//! DRO settlement authority — v1 of `dro-signer` per
//! `docs/architecture/dro-signer-brief.md` (Option 2, scoped at the
//! honest crypto seam).
//!
//! Two layers, deliberately separated:
//!
//! 1. **Decision** — [`settlement_intent`]: a pure function from an escrow
//!    (plus the state it just transitioned into) to *what must happen with
//!    the funds*. This is the DRO's actual authority — the logic that made
//!    the refuted `sign_multisig_proposal` RPC irrelevant — and it is
//!    fully buildable and testable today.
//! 2. **Execution** — the [`ZanoSigner`] trait: the typed seam behind
//!    which transaction construction lives (the frozen proto v0.3
//!    coordinator path: CLSAG_GGX, BP+ range proofs, tx-prefix
//!    serialization). Those are the firmware-track crypto bodies STATUS
//!    lists as unbuilt; v1 ships a [`MockSigner`] that records intents and
//!    returns labelled placeholders, so orchestration is proven without
//!    inventing crypto. **No `todo!()` in shipped paths** — the unbuilt
//!    work sits behind this trait, not behind a panic.
//!
//! Settlement policy encoded here (sources: §9.1 table, §9.2 amendment):
//! - `Completed` → release `amount` of `asset_id` to the **seller**.
//! - `Refunded`  → refund `amount` to the **buyer**.
//! - `Expired`   → refund the buyer **iff funds were present**
//!   (`funded_at` set — the table's "Expired → Refunded (DRO co-signs)"
//!   row); an escrow that expired unfunded settles nothing.
//! - `Resolved`  (split verdict) → 50/50; the §5 verdict carries no
//!   ratio, so v1 uses an even split with the odd atomic unit going to
//!   the **buyer** (customer-favorable, deterministic — revisit when the
//!   dispute engine emits ratios).
//! - The ZANO fee buffer is **not** a payout: §9.2 treats it as
//!   non-refundable network cost — the multisig pays its own tx fee from
//!   it. Intents therefore enumerate asset payouts only.
//! - Every other state (`Created/Funded/Shipped/Delivered/Disputed`)
//!   moves no funds: no intent.

#![forbid(unsafe_code)]

use std::fmt;

use escrow_core::{Escrow, EscrowState};

/// Which escrow party a payout goes to. The signer resolves the role to a
/// concrete Zano address from its own order context; the `Escrow` struct
/// carries party keys, not full `{S, V}` addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Party {
    Buyer,
    Seller,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Payout {
    pub to: Party,
    /// Atomic units of the escrow asset.
    pub amount: u64,
}

/// The DRO's decision: exactly what the settlement transaction must do.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementIntent {
    pub order_id: String,
    pub multisig_wallet_id: String,
    /// `None` = native ZANO (per the schema convention); `Some` = asset id.
    pub asset_id: Option<String>,
    /// Non-empty; amounts sum to the escrow `amount`.
    pub payouts: Vec<Payout>,
    /// The state that triggered settlement (for audit trails).
    pub triggered_by: EscrowState,
}

/// Pure decision function: escrow (already transitioned) + the new state
/// → what must happen with the funds, or `None` when nothing moves.
///
/// Callers pass the state returned by `escrow_core::transition` (or the
/// escrow's own `state` field — they are equal after an `Ok`).
pub fn settlement_intent(escrow: &Escrow, new_state: EscrowState) -> Option<SettlementIntent> {
    let payouts = match new_state {
        EscrowState::Completed => vec![Payout {
            to: Party::Seller,
            amount: escrow.amount,
        }],
        EscrowState::Refunded => vec![Payout {
            to: Party::Buyer,
            amount: escrow.amount,
        }],
        // Table row "Funded –72h→ Expired → Refunded (DRO co-signs)":
        // expiry obligates a refund only if funding actually happened.
        EscrowState::Expired => {
            if escrow.funded_at.is_some() {
                vec![Payout {
                    to: Party::Buyer,
                    amount: escrow.amount,
                }]
            } else {
                return None;
            }
        }
        // Split verdict: 50/50, odd atomic unit to the buyer (documented
        // deterministic rule until the dispute engine emits ratios).
        EscrowState::Resolved => {
            let seller = escrow.amount / 2;
            let buyer = escrow.amount - seller;
            vec![
                Payout {
                    to: Party::Buyer,
                    amount: buyer,
                },
                Payout {
                    to: Party::Seller,
                    amount: seller,
                },
            ]
        }
        // No funds move in any other state.
        _ => return None,
    };

    Some(SettlementIntent {
        order_id: escrow.order_id.clone(),
        multisig_wallet_id: escrow.multisig_wallet_id.clone(),
        asset_id: escrow.asset_id.clone(),
        payouts,
        triggered_by: new_state,
    })
}

/// Settlement for a `Resolved` escrow carrying a REAL adjudicated ratio
/// (the dispute engine's verdict), retiring this crate's documented
/// 50/50 default whenever a verdict exists. `split` is
/// `(buyer_amount, seller_amount)` in atomic units.
///
/// Conservation is non-negotiable: if the ratio does not sum exactly to
/// the escrow amount this returns `None` — money math is never
/// normalized or guessed on the DRO's behalf.
pub fn settlement_intent_for_split(escrow: &Escrow, split: (u64, u64)) -> Option<SettlementIntent> {
    let (buyer, seller) = split;
    if buyer.checked_add(seller)? != escrow.amount {
        return None;
    }
    Some(SettlementIntent {
        order_id: escrow.order_id.clone(),
        multisig_wallet_id: escrow.multisig_wallet_id.clone(),
        asset_id: escrow.asset_id.clone(),
        payouts: vec![
            Payout {
                to: Party::Buyer,
                amount: buyer,
            },
            Payout {
                to: Party::Seller,
                amount: seller,
            },
        ],
        triggered_by: EscrowState::Resolved,
    })
}

// ---------------------------------------------------------------------------
// The signer seam
// ---------------------------------------------------------------------------

/// Multisig context a real signer needs to construct the transaction.
/// v1 carries only the wallet binding; input/ring enumeration arrives via
/// a `zano-watcher` extension together with the first real signer — the
/// fields are added when something real consumes them, not before.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultisigContext {
    pub multisig_wallet_id: String,
}

/// A settlement transaction as produced by a signer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedSettlement {
    /// Raw transaction bytes (real signers) or a labelled placeholder
    /// (mock). Broadcasting is a separate step and lands with real bytes.
    pub tx_bytes: Vec<u8>,
    /// Which signer produced this (audit trail).
    pub signed_by: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignerError {
    /// The intent references a context the signer cannot serve.
    WrongWallet { expected: String, got: String },
    /// The signer's backing device/key refused or is unavailable.
    Unavailable(String),
}

impl fmt::Display for SignerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SignerError::WrongWallet { expected, got } => {
                write!(
                    f,
                    "signer bound to wallet {expected}, asked to sign for {got}"
                )
            }
            SignerError::Unavailable(why) => write!(f, "signer unavailable: {why}"),
        }
    }
}

impl std::error::Error for SignerError {}

/// The typed seam. Real implementations (`SoftwareSigner` Tier 1,
/// `TrezorSigner` Tier 2) drive the frozen `messages-zano.proto` v0.3
/// coordinator path and land with the firmware crypto track.
pub trait ZanoSigner {
    fn sign_settlement(
        &mut self,
        intent: &SettlementIntent,
        ctx: &MultisigContext,
    ) -> Result<SignedSettlement, SignerError>;
}

/// v1 mock: records every intent it is asked to sign and returns a
/// labelled placeholder. Exists to prove orchestration, not crypto —
/// the label makes the bytes impossible to mistake for a real tx.
#[derive(Debug, Default)]
pub struct MockSigner {
    pub signed: Vec<SettlementIntent>,
}

impl MockSigner {
    pub fn new() -> Self {
        Self::default()
    }
}

impl ZanoSigner for MockSigner {
    fn sign_settlement(
        &mut self,
        intent: &SettlementIntent,
        ctx: &MultisigContext,
    ) -> Result<SignedSettlement, SignerError> {
        if ctx.multisig_wallet_id != intent.multisig_wallet_id {
            return Err(SignerError::WrongWallet {
                expected: ctx.multisig_wallet_id.clone(),
                got: intent.multisig_wallet_id.clone(),
            });
        }
        self.signed.push(intent.clone());
        Ok(SignedSettlement {
            tx_bytes: format!("MOCK-UNSIGNED-PLACEHOLDER:{}", intent.order_id).into_bytes(),
            signed_by: "MockSigner".to_string(),
        })
    }
}

/// Orchestration: the outcome of an applied transition → signer, when and
/// only when funds must move. `None` = nothing to settle (non-fund state,
/// or the transition was rejected — a rejected transition NEVER settles).
pub fn settle_transition(
    escrow: &Escrow,
    transition_result: &Result<EscrowState, escrow_core::EscrowError>,
    signer: &mut impl ZanoSigner,
) -> Option<Result<SignedSettlement, SignerError>> {
    let new_state = (*transition_result).as_ref().ok()?;
    let intent = settlement_intent(escrow, *new_state)?;
    let ctx = MultisigContext {
        multisig_wallet_id: escrow.multisig_wallet_id.clone(),
    };
    Some(signer.sign_settlement(&intent, &ctx))
}

#[cfg(test)]
mod tests {
    use super::*;
    use escrow_core::{DeliverySource, EscrowError, EscrowEvent, PublicKey, Verdict, FEE_BUFFER};
    use time::macros::datetime;
    use time::{Duration, OffsetDateTime};

    const AMOUNT: u64 = 5_000_001; // odd on purpose: exercises the split rule

    fn t0() -> OffsetDateTime {
        datetime!(2026-07-03 12:00 UTC)
    }

    fn escrow() -> Escrow {
        Escrow::new(
            "order-dro",
            "msig-dro",
            PublicKey([1; 32]),
            PublicKey([2; 32]),
            PublicKey([3; 32]),
            AMOUNT,
            Some("fusd-asset-id".into()),
            FEE_BUFFER,
            t0(),
        )
    }

    fn funded_escrow() -> Escrow {
        let mut e = escrow();
        e.transition(EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT,
            zano_amount: FEE_BUFFER,
            at: t0() + Duration::hours(1),
        })
        .unwrap();
        e
    }

    /// Drive a funded escrow to any later state via real transitions.
    fn escrow_in(state: EscrowState) -> Escrow {
        let mut e = funded_escrow();
        let ship = EscrowEvent::SellerShipped {
            tracking: "t".into(),
            carrier: "c".into(),
            at: t0() + Duration::hours(2),
        };
        let deliver = EscrowEvent::DeliveryConfirmed {
            timestamp: t0() + Duration::hours(3),
            source: DeliverySource::CarrierScan,
        };
        let dispute = EscrowEvent::DisputeOpened {
            reason_hash: "r".into(),
            at: t0() + Duration::hours(4),
        };
        match state {
            EscrowState::Funded => {}
            EscrowState::Completed => {
                e.transition(ship).unwrap();
                e.transition(deliver).unwrap();
                e.transition(EscrowEvent::BuyerReleased {
                    at: t0() + Duration::hours(4),
                })
                .unwrap();
            }
            EscrowState::Refunded => {
                e.transition(ship).unwrap();
                e.transition(deliver).unwrap();
                e.transition(dispute).unwrap();
                e.transition(EscrowEvent::DisputeResolved {
                    verdict: Verdict::RefundBuyer,
                    resolution_id: "res".into(),
                })
                .unwrap();
            }
            EscrowState::Resolved => {
                e.transition(ship).unwrap();
                e.transition(deliver).unwrap();
                e.transition(dispute).unwrap();
                e.transition(EscrowEvent::DisputeResolved {
                    verdict: Verdict::Split,
                    resolution_id: "res".into(),
                })
                .unwrap();
            }
            EscrowState::Expired => {
                e.transition(EscrowEvent::Timeout {
                    now: t0() + Duration::hours(1) + escrow_core::FUNDED_TIMEOUT,
                })
                .unwrap();
            }
            other => panic!("helper does not build {other:?}"),
        }
        assert_eq!(e.state, state);
        e
    }

    // ---- the decision table, exhaustively -------------------------------

    #[test]
    fn completed_releases_full_amount_to_seller() {
        let e = escrow_in(EscrowState::Completed);
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        assert_eq!(
            intent.payouts,
            vec![Payout {
                to: Party::Seller,
                amount: AMOUNT
            }]
        );
        assert_eq!(intent.asset_id.as_deref(), Some("fusd-asset-id"));
        assert_eq!(intent.multisig_wallet_id, "msig-dro");
    }

    #[test]
    fn refunded_returns_full_amount_to_buyer() {
        let e = escrow_in(EscrowState::Refunded);
        let intent = settlement_intent(&e, EscrowState::Refunded).unwrap();
        assert_eq!(
            intent.payouts,
            vec![Payout {
                to: Party::Buyer,
                amount: AMOUNT
            }]
        );
    }

    #[test]
    fn funded_expiry_refunds_buyer() {
        let e = escrow_in(EscrowState::Expired);
        let intent = settlement_intent(&e, EscrowState::Expired).unwrap();
        assert_eq!(intent.payouts[0].to, Party::Buyer);
        assert_eq!(intent.triggered_by, EscrowState::Expired);
    }

    #[test]
    fn unfunded_expiry_settles_nothing() {
        let mut e = escrow(); // never funded
        e.transition(EscrowEvent::Timeout {
            now: t0() + escrow_core::CREATED_TIMEOUT,
        })
        .unwrap();
        assert_eq!(e.state, EscrowState::Expired);
        assert_eq!(settlement_intent(&e, EscrowState::Expired), None);
    }

    #[test]
    fn split_is_even_with_odd_unit_to_buyer_and_sums_exactly() {
        let e = escrow_in(EscrowState::Resolved);
        let intent = settlement_intent(&e, EscrowState::Resolved).unwrap();
        let buyer = intent
            .payouts
            .iter()
            .find(|p| p.to == Party::Buyer)
            .unwrap();
        let seller = intent
            .payouts
            .iter()
            .find(|p| p.to == Party::Seller)
            .unwrap();
        assert_eq!(buyer.amount, 2_500_001); // odd unit → buyer
        assert_eq!(seller.amount, 2_500_000);
        assert_eq!(buyer.amount + seller.amount, AMOUNT); // conservation
    }

    #[test]
    fn non_fund_states_produce_no_intent() {
        for state in [
            EscrowState::Created,
            EscrowState::Funded,
            EscrowState::Shipped,
            EscrowState::Delivered,
            EscrowState::Disputed,
        ] {
            let e = funded_escrow();
            assert_eq!(settlement_intent(&e, state), None, "state {state:?}");
        }
    }

    // ---- orchestration through the seam ---------------------------------

    #[test]
    fn settle_transition_signs_exactly_the_fund_moving_outcomes() {
        let mut signer = MockSigner::new();

        // A rejected transition never settles.
        let e = funded_escrow();
        let rejected: Result<EscrowState, EscrowError> = Err(EscrowError::TimeoutNotReached {
            state: EscrowState::Funded,
        });
        assert!(settle_transition(&e, &rejected, &mut signer).is_none());

        // A non-fund transition never settles.
        let ok_shipped: Result<EscrowState, EscrowError> = Ok(EscrowState::Shipped);
        assert!(settle_transition(&e, &ok_shipped, &mut signer).is_none());
        assert!(signer.signed.is_empty());

        // A fund-moving transition reaches the signer with the right intent.
        let e = escrow_in(EscrowState::Completed);
        let outcome = settle_transition(&e, &Ok(EscrowState::Completed), &mut signer)
            .expect("fund-moving")
            .expect("mock signs");
        assert_eq!(outcome.signed_by, "MockSigner");
        assert!(String::from_utf8_lossy(&outcome.tx_bytes)
            .starts_with("MOCK-UNSIGNED-PLACEHOLDER:order-dro"));
        assert_eq!(signer.signed.len(), 1);
        assert_eq!(signer.signed[0].payouts[0].to, Party::Seller);
    }

    #[test]
    fn signer_refuses_foreign_wallet_context() {
        let e = escrow_in(EscrowState::Completed);
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        let mut signer = MockSigner::new();
        let foreign = MultisigContext {
            multisig_wallet_id: "someone-elses-msig".into(),
        };
        assert!(matches!(
            signer.sign_settlement(&intent, &foreign),
            Err(SignerError::WrongWallet { .. })
        ));
        assert!(signer.signed.is_empty());
    }
}
