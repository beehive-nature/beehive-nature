//! The door orchestrator: the reserve→settle wrapper around a facilitator.
//!
//! The facilitator seam is OURS (JSON in/out) so the door can be pointed at
//! ANY facilitator implementation — the live `FacilitatorLocal` adapter
//! (main.rs) or a test double — without touching the door's laws. This is
//! the R5 replaceability mechanism at the code level.
//!
//! FLOW (verify): float gate → budget gate (journal.reserve) → facilitator
//! verification. A facilitator refusal AFTER reservation keeps the
//! reservation as `FailedKeep` (no free without evidence of non-settlement;
//! the reservation is released only at expiry with an on-chain check).
//!
//! FLOW (settle): journal idempotency pre-check → facilitator settle →
//! evidence-gated reconcile | no-evidence failure (keep) | ambiguous
//! (Unknown, never auto-retried).

use crate::journal::{HumanGate, Journal, LegKey, SettleEvidence};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// The door's facilitator seam. Implementations: the live adapter over
/// `x402_facilitator_local::FacilitatorLocal` (see main.rs) and the test
/// double (tests/acceptance.rs). `request` is the verbatim x402 verify/
/// settle request JSON.
pub trait SettlementFacilitator: Send + Sync {
    fn verify(&self, request: &serde_json::Value) -> Result<(), String>;
    fn settle(&self, request: &serde_json::Value) -> FacilitatorSettle;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FacilitatorSettle {
    Success {
        payer: String,
        transaction: String,
        network: String,
        #[serde(default)]
        actual_amount: Option<String>,
        #[serde(default)]
        gas_actual_wei: Option<u64>,
    },
    /// Definitive on-chain/protocol failure — safe to keep the reservation.
    Error { reason: String, network: String },
    /// Transport/unknown outcome — the request MAY have landed. Unknown.
    Ambiguous { reason: String },
}

#[derive(Debug, thiserror::Error)]
pub enum DoorError {
    #[error("door/journal: {0}")]
    Journal(#[from] crate::journal::JournalError),
    #[error("door/facilitator verify: {0}")]
    VerifyRefused(String),
    #[error("door/settle: {0}")]
    SettleRefused(String),
    /// The refusal text names cap/float/exposure — surfaced verbatim.
    #[error("door: {0}")]
    Law(String),
}

/// Gas estimate for a settlement class (wei). Kept as a supplied constant
/// per scheme — the door does not query gas prices (that is the live
/// adapter's concern; here the budget law needs a bound, not a quote).
#[derive(Debug, Clone)]
pub struct DoorConfig {
    pub reserved_gas_wei: u64,
    pub ops_float_available_wei: u64,
}

pub struct Door<F: SettlementFacilitator> {
    pub journal: Arc<Journal>,
    pub facilitator: Arc<F>,
    pub config: DoorConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum VerifyOutcome {
    Valid,
    /// Already settled — idempotent replay of the stored evidence.
    AlreadySettled {
        tx_hash: String,
        actual_amount: String,
    },
}

impl<F: SettlementFacilitator> Door<F> {
    pub fn new(journal: Arc<Journal>, facilitator: Arc<F>, config: DoorConfig) -> Self {
        Door {
            journal,
            facilitator,
            config,
        }
    }

    pub fn verify(
        &self,
        leg: &LegKey,
        request: &serde_json::Value,
    ) -> Result<VerifyOutcome, DoorError> {
        // Idempotency first: an already-settled nonce replays its evidence.
        if let Some(rec) = self.journal.get(leg)? {
            if let crate::journal::ReservationState::Settled {
                actual_amount,
                tx_hash,
                ..
            } = rec.state
            {
                return Ok(VerifyOutcome::AlreadySettled {
                    tx_hash,
                    actual_amount,
                });
            }
        }
        // Reserve (float + budget gates live inside; refusals name numbers).
        self.journal
            .reserve(
                leg,
                self.config.reserved_gas_wei,
                self.config.ops_float_available_wei,
            )
            .map_err(|e| DoorError::Law(e.to_string()))?;
        // Facilitator verification AFTER reservation: a refusal keeps the
        // reservation (FailedKeep) — the nonce is spent client-side intent
        // and the window governs release, not a verify error.
        match self.facilitator.verify(request) {
            Ok(()) => Ok(VerifyOutcome::Valid),
            Err(reason) => {
                let _ = self
                    .journal
                    .settle_failed_no_evidence(leg, &format!("verify refused: {reason}"));
                Err(DoorError::VerifyRefused(reason))
            }
        }
    }

    pub fn settle(
        &self,
        leg: &LegKey,
        request: &serde_json::Value,
    ) -> Result<FacilitatorSettle, DoorError> {
        match self.journal.begin_settle(leg)? {
            // Idempotent: never re-execute a settled nonce.
            Some(ev) => Ok(FacilitatorSettle::Success {
                payer: leg.payer.clone(),
                transaction: ev.tx_hash.clone(),
                network: leg.chain.clone(),
                actual_amount: Some(ev.actual_amount.clone()),
                gas_actual_wei: Some(ev.gas_actual_wei),
            }),
            None => match self.facilitator.settle(request) {
                FacilitatorSettle::Success {
                    payer,
                    transaction,
                    network,
                    actual_amount,
                    gas_actual_wei,
                } => {
                    let ev = SettleEvidence {
                        actual_amount: actual_amount
                            .clone()
                            .unwrap_or_else(|| leg.amount_authorized.clone()),
                        tx_hash: transaction.clone(),
                        gas_actual_wei: gas_actual_wei.unwrap_or(self.config.reserved_gas_wei),
                    };
                    if let Err(e) = self.journal.settle_with_evidence(leg, &ev) {
                        // Evidence refused (e.g. actual > authorized): the
                        // on-chain truth is now uncertain -- park as Unknown
                        // for the human gate, never overwrite silently.
                        let _ = self
                            .journal
                            .settle_unknown(leg, &format!("evidence refused: {e}"));
                        return Err(DoorError::SettleRefused(e.to_string()));
                    }
                    Ok(FacilitatorSettle::Success {
                        payer,
                        transaction,
                        network,
                        actual_amount: Some(ev.actual_amount),
                        gas_actual_wei: Some(ev.gas_actual_wei),
                    })
                }
                FacilitatorSettle::Error { reason, network } => {
                    self.journal.settle_failed_no_evidence(leg, &reason)?;
                    Ok(FacilitatorSettle::Error { reason, network })
                }
                FacilitatorSettle::Ambiguous { reason } => {
                    self.journal.settle_unknown(leg, &reason)?;
                    Ok(FacilitatorSettle::Ambiguous { reason })
                }
            },
        }
    }

    /// Expiry release with an on-chain non-settlement check.
    pub fn expire(&self, leg: &LegKey, chain_says_unspent: bool) -> Result<(), DoorError> {
        self.journal
            .expire_released(leg, chain_says_unspent)
            .map_err(|e| DoorError::Law(e.to_string()))
    }

    /// Human-gated Unknown resolution.
    pub fn resolve_unknown(
        &self,
        leg: &LegKey,
        gate: HumanGate,
        ev: &SettleEvidence,
    ) -> Result<(), DoorError> {
        self.journal
            .resolve_unknown(leg, gate, ev)
            .map_err(|e| DoorError::Law(e.to_string()))
    }
}
