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
    // The decision is a function of the escrow's OWN state, never a caller
    // label decoupled from it: a mismatched `new_state` must never mint a
    // payout for a state the machine is not actually in.
    if new_state != escrow.state {
        return None;
    }
    // Every fund-moving terminal state is only reachable after funding.
    // A record that claims one without `funded_at` is forged/corrupt — never
    // pay out unfunded money. (Belt to the R-004 balance check's suspenders:
    // this refuses to even build the intent; `reconcile` then refuses to sign
    // anything the chain doesn't back.)
    let funded = escrow.funded_at.is_some();
    let payouts = match new_state {
        EscrowState::Completed => {
            if !funded {
                return None;
            }
            vec![Payout {
                to: Party::Seller,
                amount: escrow.amount,
            }]
        }
        EscrowState::Refunded => {
            if !funded {
                return None;
            }
            vec![Payout {
                to: Party::Buyer,
                amount: escrow.amount,
            }]
        }
        // Table row "Funded –72h→ Expired → Refunded (DRO co-signs)":
        // expiry obligates a refund only if funding actually happened.
        EscrowState::Expired => {
            if funded {
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
            if !funded {
                return None;
            }
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
    // Same guards as `settlement_intent`: only a genuinely-Resolved, funded
    // escrow splits — never a caller-labelled or unfunded one.
    if escrow.state != EscrowState::Resolved || escrow.funded_at.is_none() {
        return None;
    }
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

/// Multisig context a real signer needs to construct the transaction, and
/// the DRO's independent chain view needs to query the right balance: the
/// wallet binding plus the asset whose balance backs the settlement.
/// Input/ring enumeration arrives via a `zano-watcher` extension together
/// with the first real signer — those fields are added when something real
/// consumes them, not before.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultisigContext {
    pub multisig_wallet_id: String,
    /// `None` = native ZANO; `Some` = asset id. The view confirms the
    /// balance of *this* asset, so it must match the intent's asset.
    pub asset_id: Option<String>,
}

// ---------------------------------------------------------------------------
// R-004: the DRO's independent eye (Kelp DAO class, Apr 2026)
// ---------------------------------------------------------------------------

/// The DRO must confirm the multisig's settlement-relevant balance through
/// its **own** chain access — access that shares no node infrastructure with
/// the event pipeline that produced the intent — before it co-signs. This
/// trait is that independent eye, deliberately a **separate seam** from
/// `zano-watcher` / the event bus. See `docs/risk-register.md` R-004: a
/// correct signature over a *forged view* (poisoned RPC + DDoS'd failover
/// behind a 1-of-1 verifier) is how ~$290M left Kelp DAO.
///
/// **What the type system enforces here, and what it cannot.** A
/// [`ConfirmedMultisigState`] is unforgeable outside this module (private
/// fields; the only constructor is the sealed [`confirm`](Self::confirm)
/// wrapper), and [`ZanoSigner::sign_settlement`] *requires* one — so a
/// settlement can never be signed off the escrow's self-reported fields or
/// the indexed view alone. The type system **cannot** enforce that the
/// view's nodes actually share no infrastructure with the pipeline; that is
/// a deployment property, and it is the R-004 contract in the risk register,
/// not a compile-time guarantee. Honesty about that boundary is the point.
pub trait IndependentChainView {
    /// Read the multisig's confirmed balance of `ctx.asset_id` directly from
    /// chain. Implementations MUST use infrastructure disjoint from the event
    /// pipeline (see the trait docs); this is the one place that obligation
    /// lives.
    fn observe_balance(&self, ctx: &MultisigContext) -> Result<u64, ChainViewError>;

    /// Sealed: binds an observation to its wallet+asset as the token the
    /// signer requires. Not meaningfully overridable — `ConfirmedMultisigState`
    /// has no accessible constructor, so this is the sole way to obtain one.
    fn confirm(&self, ctx: &MultisigContext) -> Result<ConfirmedMultisigState, ChainViewError> {
        let balance = self.observe_balance(ctx)?;
        Ok(ConfirmedMultisigState {
            multisig_wallet_id: ctx.multisig_wallet_id.clone(),
            asset_id: ctx.asset_id.clone(),
            balance,
        })
    }
}

/// Proof that a multisig's balance was confirmed through an
/// [`IndependentChainView`]. Fields are private and there is no public
/// constructor, so the only way to hold one is to have gone through a view —
/// which is exactly what makes "sign without independent confirmation"
/// unrepresentable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfirmedMultisigState {
    multisig_wallet_id: String,
    asset_id: Option<String>,
    balance: u64,
}

impl ConfirmedMultisigState {
    pub fn multisig_wallet_id(&self) -> &str {
        &self.multisig_wallet_id
    }
    pub fn asset_id(&self) -> Option<&str> {
        self.asset_id.as_deref()
    }
    pub fn balance(&self) -> u64 {
        self.balance
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChainViewError {
    /// The independent view could not reach chain (fail closed: do NOT sign).
    Unavailable(String),
}

impl fmt::Display for ChainViewError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChainViewError::Unavailable(why) => {
                write!(f, "independent chain view unavailable: {why}")
            }
        }
    }
}

impl std::error::Error for ChainViewError {}

/// v1 stub view — proves the seam, NOT independence. Like `MockSigner`, it
/// invents no crypto and reaches no chain; it returns a configured balance
/// so orchestration is testable. A real view (firmware/indexer track) queries
/// disjoint nodes. `solvent()` covers any conserving payout; `with_balance`
/// lets a test starve the settlement and prove the DRO refuses it.
#[derive(Debug, Clone)]
pub struct MockChainView {
    balance: u64,
}

impl MockChainView {
    pub fn solvent() -> Self {
        Self { balance: u64::MAX }
    }
    pub fn with_balance(balance: u64) -> Self {
        Self { balance }
    }
}

impl IndependentChainView for MockChainView {
    fn observe_balance(&self, _ctx: &MultisigContext) -> Result<u64, ChainViewError> {
        Ok(self.balance)
    }
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
    /// The confirmed state is for a different wallet than the intent.
    WrongWallet { expected: String, got: String },
    /// The confirmed balance is for a different asset than the intent pays.
    AssetMismatch {
        confirmed: Option<String>,
        intent: Option<String>,
    },
    /// R-004: the independently-confirmed on-chain balance does not cover the
    /// payouts. The DRO refuses to co-sign a settlement the chain can't back —
    /// this is the check that turns "trust the indexed view" into "verify".
    UnbackedSettlement {
        required: u64,
        confirmed_balance: u64,
    },
    /// The payout amounts overflow `u64` when summed (a forged intent).
    PayoutOverflow,
    /// The signer's backing device/key refused or is unavailable.
    Unavailable(String),
}

impl fmt::Display for SignerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SignerError::WrongWallet { expected, got } => {
                write!(
                    f,
                    "confirmed state is for wallet {expected}, intent settles {got}"
                )
            }
            SignerError::AssetMismatch { confirmed, intent } => write!(
                f,
                "confirmed balance is asset {confirmed:?}, intent pays asset {intent:?}"
            ),
            SignerError::UnbackedSettlement {
                required,
                confirmed_balance,
            } => write!(
                f,
                "settlement needs {required} but the confirmed on-chain balance is only {confirmed_balance}"
            ),
            SignerError::PayoutOverflow => write!(f, "payout amounts overflow u64"),
            SignerError::Unavailable(why) => write!(f, "signer unavailable: {why}"),
        }
    }
}

impl std::error::Error for SignerError {}

/// The typed seam. Real implementations (`SoftwareSigner` Tier 1,
/// `TrezorSigner` Tier 2) drive the frozen `messages-zano.proto` v0.3
/// coordinator path and land with the firmware crypto track.
///
/// Signing REQUIRES a [`ConfirmedMultisigState`] (R-004): the type makes it
/// impossible to co-sign without an independently-confirmed on-chain balance.
pub trait ZanoSigner {
    fn sign_settlement(
        &mut self,
        intent: &SettlementIntent,
        confirmed: &ConfirmedMultisigState,
    ) -> Result<SignedSettlement, SignerError>;
}

/// The R-004 reconciliation every signer must pass before producing bytes:
/// the confirmed state must be for the intent's wallet and asset, and the
/// independently-observed balance must cover the payouts. Shared so no signer
/// implementation can forget it.
pub fn reconcile(
    intent: &SettlementIntent,
    confirmed: &ConfirmedMultisigState,
) -> Result<(), SignerError> {
    if confirmed.multisig_wallet_id() != intent.multisig_wallet_id {
        return Err(SignerError::WrongWallet {
            expected: confirmed.multisig_wallet_id().to_string(),
            got: intent.multisig_wallet_id.clone(),
        });
    }
    if confirmed.asset_id() != intent.asset_id.as_deref() {
        return Err(SignerError::AssetMismatch {
            confirmed: confirmed.asset_id().map(str::to_string),
            intent: intent.asset_id.clone(),
        });
    }
    let required = intent
        .payouts
        .iter()
        .try_fold(0u64, |acc, p| acc.checked_add(p.amount))
        .ok_or(SignerError::PayoutOverflow)?;
    if required > confirmed.balance() {
        return Err(SignerError::UnbackedSettlement {
            required,
            confirmed_balance: confirmed.balance(),
        });
    }
    Ok(())
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
        confirmed: &ConfirmedMultisigState,
    ) -> Result<SignedSettlement, SignerError> {
        // R-004 gate: refuse anything the independent view doesn't back.
        reconcile(intent, confirmed)?;
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
///
/// R-004: before signing, the escrow's multisig balance is confirmed through
/// the caller's [`IndependentChainView`]. If that view can't reach chain the
/// settlement fails **closed** (`Some(Err(Unavailable))`), never signs blind.
pub fn settle_transition(
    escrow: &Escrow,
    transition_result: &Result<EscrowState, escrow_core::EscrowError>,
    view: &impl IndependentChainView,
    signer: &mut impl ZanoSigner,
) -> Option<Result<SignedSettlement, SignerError>> {
    let new_state = (*transition_result).as_ref().ok()?;
    let intent = settlement_intent(escrow, *new_state)?;
    let ctx = MultisigContext {
        multisig_wallet_id: escrow.multisig_wallet_id.clone(),
        asset_id: escrow.asset_id.clone(),
    };
    let confirmed = match view.confirm(&ctx) {
        Ok(c) => c,
        // Fail closed: could not independently verify → do not sign.
        Err(e) => return Some(Err(SignerError::Unavailable(e.to_string()))),
    };
    Some(signer.sign_settlement(&intent, &confirmed))
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

    // ---- the decision must track the escrow's own state + funding --------

    #[test]
    fn settlement_intent_refuses_state_decoupled_from_escrow() {
        // The escrow is still Funded; a caller passing Completed must not
        // mint a seller payout the machine never actually authorized.
        let e = funded_escrow();
        assert_eq!(settlement_intent(&e, EscrowState::Completed), None);
        assert_eq!(settlement_intent(&e, EscrowState::Refunded), None);
    }

    #[test]
    fn settlement_intent_refuses_unfunded_terminal_state() {
        // A forged/deserialized terminal escrow with no funding must never
        // pay out (reachable only off-graph, but the DRO replays records).
        for state in [
            EscrowState::Completed,
            EscrowState::Refunded,
            EscrowState::Resolved,
        ] {
            let mut e = escrow();
            e.state = state;
            e.funded_at = None;
            assert_eq!(settlement_intent(&e, state), None, "unfunded {state:?}");
        }
    }

    // ---- orchestration through the seam ---------------------------------

    /// Confirm a wallet+asset at a chosen balance through the independent view.
    fn confirm(wallet: &str, asset: Option<&str>, balance: u64) -> ConfirmedMultisigState {
        MockChainView::with_balance(balance)
            .confirm(&MultisigContext {
                multisig_wallet_id: wallet.into(),
                asset_id: asset.map(str::to_string),
            })
            .expect("mock view confirms")
    }

    #[test]
    fn settle_transition_signs_exactly_the_fund_moving_outcomes() {
        let mut signer = MockSigner::new();
        let view = MockChainView::solvent();

        // A rejected transition never settles.
        let e = funded_escrow();
        let rejected: Result<EscrowState, EscrowError> = Err(EscrowError::TimeoutNotReached {
            state: EscrowState::Funded,
        });
        assert!(settle_transition(&e, &rejected, &view, &mut signer).is_none());

        // A non-fund transition never settles.
        let ok_shipped: Result<EscrowState, EscrowError> = Ok(EscrowState::Shipped);
        assert!(settle_transition(&e, &ok_shipped, &view, &mut signer).is_none());
        assert!(signer.signed.is_empty());

        // A fund-moving transition reaches the signer with the right intent.
        let e = escrow_in(EscrowState::Completed);
        let outcome = settle_transition(&e, &Ok(EscrowState::Completed), &view, &mut signer)
            .expect("fund-moving")
            .expect("mock signs");
        assert_eq!(outcome.signed_by, "MockSigner");
        assert!(String::from_utf8_lossy(&outcome.tx_bytes)
            .starts_with("MOCK-UNSIGNED-PLACEHOLDER:order-dro"));
        assert_eq!(signer.signed.len(), 1);
        assert_eq!(signer.signed[0].payouts[0].to, Party::Seller);
    }

    #[test]
    fn signer_refuses_foreign_wallet() {
        let e = escrow_in(EscrowState::Completed);
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        let mut signer = MockSigner::new();
        let confirmed = confirm("someone-elses-msig", Some("fusd-asset-id"), u64::MAX);
        assert!(matches!(
            signer.sign_settlement(&intent, &confirmed),
            Err(SignerError::WrongWallet { .. })
        ));
        assert!(signer.signed.is_empty());
    }

    // ---- R-004: the DRO never signs what the chain doesn't back ----------

    #[test]
    fn signer_refuses_unbacked_settlement() {
        // The independent view sees LESS on-chain than the payout — refuse.
        // This is the Kelp-DAO-class guard: a valid signature over a balance
        // that isn't there is exactly what we will not produce.
        let e = escrow_in(EscrowState::Completed); // owes AMOUNT to seller
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        let mut signer = MockSigner::new();
        let confirmed = confirm("msig-dro", Some("fusd-asset-id"), AMOUNT - 1);
        assert!(matches!(
            signer.sign_settlement(&intent, &confirmed),
            Err(SignerError::UnbackedSettlement { required, confirmed_balance })
                if required == AMOUNT && confirmed_balance == AMOUNT - 1
        ));
        assert!(signer.signed.is_empty());
    }

    #[test]
    fn exactly_backed_settlement_signs() {
        let e = escrow_in(EscrowState::Completed);
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        let mut signer = MockSigner::new();
        let confirmed = confirm("msig-dro", Some("fusd-asset-id"), AMOUNT); // exact
        assert!(signer.sign_settlement(&intent, &confirmed).is_ok());
    }

    #[test]
    fn signer_refuses_asset_mismatch() {
        let e = escrow_in(EscrowState::Completed);
        let intent = settlement_intent(&e, EscrowState::Completed).unwrap();
        let mut signer = MockSigner::new();
        let confirmed = confirm("msig-dro", Some("a-different-asset"), u64::MAX);
        assert!(matches!(
            signer.sign_settlement(&intent, &confirmed),
            Err(SignerError::AssetMismatch { .. })
        ));
    }

    #[test]
    fn settle_transition_fails_closed_when_view_unavailable() {
        // If the DRO cannot independently confirm chain state, it must NOT
        // sign blind — it fails closed with the intent unfulfilled.
        struct BlindView;
        impl IndependentChainView for BlindView {
            fn observe_balance(&self, _ctx: &MultisigContext) -> Result<u64, ChainViewError> {
                Err(ChainViewError::Unavailable("nodes unreachable".into()))
            }
        }
        let e = escrow_in(EscrowState::Completed);
        let mut signer = MockSigner::new();
        let outcome = settle_transition(&e, &Ok(EscrowState::Completed), &BlindView, &mut signer);
        assert!(matches!(outcome, Some(Err(SignerError::Unavailable(_)))));
        assert!(
            signer.signed.is_empty(),
            "no blind signing when unverifiable"
        );
    }

    /// GAP, pinned (risk-register R-005): overfunding is accepted but only the
    /// agreed `amount` is ever settled. The surplus the buyer deposited is not
    /// refunded and is recorded nowhere. This is a founder ECONOMIC decision
    /// (record observed balance / refund surplus / reject overfunding), not a
    /// mechanism bug — pinned here so the behavior is visible and any change is
    /// deliberate, never accidental.
    #[test]
    fn overfunding_excess_is_not_settled_documented_gap() {
        let mut e = escrow(); // agreed amount = AMOUNT
        e.transition(EscrowEvent::BuyerFunded {
            asset_amount: AMOUNT + 1_000, // buyer over-deposits
            zano_amount: FEE_BUFFER,
            at: t0() + Duration::hours(1),
        })
        .unwrap();
        e.transition(EscrowEvent::Timeout {
            now: t0() + Duration::hours(1) + escrow_core::FUNDED_TIMEOUT,
        })
        .unwrap();
        assert_eq!(e.state, EscrowState::Expired);
        let intent = settlement_intent(&e, EscrowState::Expired).unwrap();
        // Refund is the agreed amount — the surplus 1_000 is stranded.
        assert_eq!(intent.payouts[0].amount, AMOUNT);
    }
}
