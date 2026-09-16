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

/// OP-stack receipt fee evidence (fields pinned: op-geth extends
/// types.Receipt with L1GasUsed/L1GasPrice/L1Fee/L1FeeScalar; JSON
/// l1_gas_used/l1_gas_price/l1_fee/l1_fee_scalar, hex quantities,
/// OP-stack-only). l1_fee is the TOTAL L1 data fee — the surcharge
/// outside the EIP-1559 bid (R11).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpStackReceiptFee {
    pub l1_gas_used: u128,
    pub l1_gas_price: u128,
    pub l1_fee_wei: Atto,
    pub l1_fee_scalar_hex: String,
}

pub struct EvmRailAdapter {
    ledger: RailLedger<EvmPaymentId>,
    /// The sealed plan this adapter serves (identity-bound per R1 law;
    /// the watchpay Ledger enforces that at its own boundary).
    plan: ValidatedPlan,
    /// Per-payment Base/OP-stack split bounds: (gas_worst, surcharge_worst).
    /// The ledger reserves the COMBINED worst case (class L1Surcharge);
    /// the adapter validates the split at evidence time (R12).
    base_bounds: std::collections::HashMap<EvmPaymentId, (Atto, Atto)>,
}

impl EvmRailAdapter {
    /// Ceiling for the adapter's fee window: the plan's own
    /// worst-case total native fee (declared == derived, watchpay law).
    pub fn new(plan: ValidatedPlan, now_unix: u64) -> Self {
        let ceiling = plan.worst_case_total_native_fee_wei();
        EvmRailAdapter {
            ledger: RailLedger::new(ceiling, now_unix),
            plan,
            base_bounds: std::collections::HashMap::new(),
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
    pub fn reservation(&self, id: &EvmPaymentId) -> Option<&crate::fee::FeeReservation> {
        self.ledger.reservation(id)
    }

    /// Open a Base/OP-stack payment intent: REQUIRES a declared L1
    /// surcharge worst case (the R11 gate — missing bound refused),
    /// reserves the COMBINED gas+surcharge worst case, keeps the split.
    pub fn open_base_intent(
        &mut self,
        id: EvmPaymentId,
        surcharge_worst: Atto,
        expires_unix: u64,
    ) -> Result<(), LedgerError> {
        let surcharge = self.base_gate(Some(surcharge_worst))?;
        let gas_worst = self.fee_reservation(false).worst_case;
        let combined =
            gas_worst
                .checked_add(surcharge.worst_case)
                .ok_or_else(|| LedgerError::Refusal {
                    field: "L1Surcharge",
                    reason: "combined gas+surcharge worst case overflows".into(),
                })?;
        self.ledger.open_intent(
            id.clone(),
            FeeReservation {
                class: FeeClass::L1Surcharge,
                worst_case: combined,
            },
            expires_unix,
        )?;
        self.base_bounds.insert(id, (gas_worst, surcharge_worst));
        Ok(())
    }

    /// Stage a Base intent in-flight (submitted to mempool).
    pub fn stage_base_inflight(&mut self, id: &EvmPaymentId) -> Result<(), LedgerError> {
        self.ledger.transition(id, LifecycleState::InFlight)
    }

    /// Evidence-path unknown (R10-P6/P7 class): result unavailable —
    /// human gate; reconciliation stays possible afterward.
    pub fn mark_base_unknown(&mut self, id: &EvmPaymentId, note: &str) -> Result<(), LedgerError> {
        self.ledger.mark_unknown(id, note)
    }

    /// Reconcile a Base payment with SPLIT evidence: validates each
    /// component against its declared bound BEFORE any mutation
    /// (underestimated surcharge bound => named refusal), then hands
    /// the combined actual to the unified ledger (which re-checks
    /// possibility against the combined worst case and reconciles DOWN).
    pub fn reconcile_base(
        &mut self,
        id: &EvmPaymentId,
        receipt: &OpStackReceiptFee,
        gas_paid: Atto,
    ) -> Result<LifecycleState, LedgerError> {
        let (gas_worst, surcharge_worst) =
            self.base_bounds
                .get(id)
                .cloned()
                .ok_or_else(|| LedgerError::Refusal {
                    field: "payment_id",
                    reason: "no Base split bounds on record — was this a Base intent?".into(),
                })?;
        if gas_paid > gas_worst {
            return Err(LedgerError::Refusal {
                field: "gas_paid",
                reason: format!(
                    "impossible gas evidence: {} exceeds the declared gas worst case {} (R12)",
                    gas_paid, gas_worst
                ),
            });
        }
        if receipt.l1_fee_wei > surcharge_worst {
            return Err(LedgerError::Refusal {
                field: "L1Surcharge",
                reason: format!(
                    "UNDERESTIMATED L1 SURCHARGE BOUND: receipt l1Fee {} exceeds the declared worst case {} — the OP-stack surcharge is outside the EIP-1559 bid, so only this declared bound protects the window (R11/R12)",
                    receipt.l1_fee_wei, surcharge_worst
                ),
            });
        }
        let combined_actual =
            gas_paid
                .checked_add(receipt.l1_fee_wei)
                .ok_or_else(|| LedgerError::Refusal {
                    field: "evidence",
                    reason: "combined actuals overflow".into(),
                })?;
        let out = self
            .ledger
            .reconcile_with_evidence(id, combined_actual, true)?;
        Ok(out.state)
    }
}
