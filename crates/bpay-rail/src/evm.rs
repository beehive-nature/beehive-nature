//! The first concrete member: the EVM rail adapter, COMPOSING the
//! proven watchpay engine (identity binding, fee ceilings, receipt
//! validation, unknown-gate) rather than reimplementing any of it.
//!
//! The adapter contributes the unified-trait mapping only:
//! watchpay attempt states → lifecycle states; the plan's native fee
//! ceilings → FeeReservations; x402 stays the EVM first-line door at
//! the DESIGN level (bsigner's pre-signature gate feeds compose; not
//! built here).
//!
//! ARBITRUM vs BASE (R6/R11): this member carries the L2Gas/
//! L1FoldedGas classes (single-product ceilings — watchpay law). A
//! Base-bound EVM member would additionally REQUIRE an L1Surcharge
//! reservation (`FeeClass::L1Surcharge`) because OP-stack's L1 data
//! fee is a surcharge outside the EIP-1559 bid (their docs: "not
//! possible to limit"); `EvmRailAdapter::base_gate` enforces that a
//! Base-targeted plan declares one.

use crate::fee::{FeeClass, FeeReservation};
use crate::ledger::{LedgerError, LifecycleState, RailLedger};
use watchpay::plan::ValidatedPlan;
use watchpay::types::Atto;

/// EVM payment identity: CONSTRUCTED idempotency (payer, nonce) +
/// tx_hash — EVM has no native payment hash (the explicit R9
/// asymmetry).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct EvmPaymentId {
    pub nonce: u64,
    pub tx_hash_hex: String,
}

pub struct EvmRailAdapter {
    ledger: RailLedger<EvmPaymentId>,
    /// The sealed plan this adapter serves (identity-bound per R1 law;
    /// the watchpay Ledger enforces that at its own boundary).
    plan: ValidatedPlan,
}

impl EvmRailAdapter {
    /// Ceiling for the adapter's fee window: the plan's own
    /// worst-case total native fee (declared == derived, watchpay law).
    pub fn new(plan: ValidatedPlan, now_unix: u64) -> Self {
        let ceiling = plan.worst_case_total_native_fee_wei();
        EvmRailAdapter {
            ledger: RailLedger::new(ceiling, now_unix),
            plan,
        }
    }

    /// THE BASE GATE (R11): a Base/OP-stack-bound plan MUST declare an
    /// L1Surcharge reservation — the single-product ceiling does not
    /// bound Base spend (OP-stack docs, own words: the L1 data fee is
    /// outside the EIP-1559 bid and "not possible to limit").
    pub fn base_gate(&self, surcharge: Option<Atto>) -> Result<FeeReservation, LedgerError> {
        match surcharge {
            Some(worst_case) => Ok(FeeReservation {
                class: FeeClass::L1Surcharge,
                worst_case,
            }),
            None => Err(LedgerError::Refusal {
                field: "L1Surcharge",
                reason: "Base/OP-stack rail requires a declared L1-surcharge worst case — \
                         the gas×price product does NOT bound L1 data fees there (R11 gate)"
                    .into(),
            }),
        }
    }

    /// Map a watchpay attempt state onto the unified lifecycle.
    pub fn map_state(ws: &watchpay::ledger::AttemptState) -> LifecycleState {
        match ws {
            watchpay::ledger::AttemptState::Intent => LifecycleState::Intent,
            watchpay::ledger::AttemptState::Signed { .. } => LifecycleState::Staged,
            watchpay::ledger::AttemptState::Mined { .. } => LifecycleState::Settled,
            watchpay::ledger::AttemptState::Reverted { .. } => LifecycleState::Failed,
            watchpay::ledger::AttemptState::Unknown { .. } => LifecycleState::Unknown,
            watchpay::ledger::AttemptState::Cancelled { .. } => LifecycleState::Failed,
        }
    }

    /// The EVM fee reservation for one attempt: the plan's per-tx
    /// worst case (L2Gas; L1FoldedGas on Arbitrum-shaped chains with
    /// the headroom hint — no new math).
    pub fn fee_reservation(&self, folded_l1: bool) -> FeeReservation {
        let per_tx = Atto::from_u64(self.plan.plan().gas_ceilings.per_tx_gas_limit)
            .checked_mul(Atto::from_u64(
                self.plan
                    .plan()
                    .native_fee_ceilings
                    .per_tx_max_fee_per_gas_wei,
            ))
            .expect("plan validation bounds this product");
        FeeReservation {
            class: if folded_l1 {
                FeeClass::L1FoldedGas
            } else {
                FeeClass::L2Gas
            },
            worst_case: per_tx,
        }
    }

    /// Open an intent in the unified ledger (the watchpay Ledger
    /// remains the durable authority; this window mirrors it).
    pub fn open_intent(
        &mut self,
        id: EvmPaymentId,
        folded_l1: bool,
        expires_unix: u64,
    ) -> Result<(), LedgerError> {
        self.ledger
            .open_intent(id, self.fee_reservation(folded_l1), expires_unix)
    }

    pub fn state(&self, id: &EvmPaymentId) -> Option<LifecycleState> {
        self.ledger.state(id)
    }
    pub fn reserved_total(&self) -> Atto {
        self.ledger.reserved_total()
    }
}
