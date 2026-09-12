//! Decoded-transaction validation — everything checked BEFORE any signed
//! result is accepted, and again before any future broadcast (later slice).
//!
//! This slice is OFFLINE: [`DecodedTransaction`] is the decoded shape a
//! signer/bridge RETURNS (synthetic in tests). Signature verification and
//! hash re-derivation from an RLP serialization are NOT performed here —
//! the recorded `tx_hash` is an externally supplied value that the ledger
//! binds by persistence, and receipt validation later requires the receipt
//! to reference exactly it. (Re-deriving the hash needs the signed
//! serialization; flagged for the later signing/broadcast slice.)
//!
//! EVIDENCE NOTE (per the z2.a review): a transaction hash does not exist
//! before signing. The lifecycle this module serves is: persist intent +
//! nonce FIRST (ledger), THEN accept a validated signed result, THEN (a
//! later slice) broadcast. A zero/placeholder hash is refused.

use crate::calldata;
use crate::error::{Error, Result};
use crate::plan::ValidatedPlan;
use crate::types::{Atto, EthAddr, Hex32};
use serde::{Deserialize, Serialize};

/// Supported transaction envelope types in this slice. Anything else is
/// refused by [`TxEnvelope::parse_type`] — blob (3) and 7702 (4) txs are
/// not lawful carriers for these payments, and unknown future types fail
/// closed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxEnvelope {
    Legacy,
    Eip1559,
}

impl TxEnvelope {
    pub fn parse_type(byte: u8) -> Result<Self> {
        match byte {
            0x00 => Ok(TxEnvelope::Legacy),
            0x02 => Ok(TxEnvelope::Eip1559),
            other => Err(Error::field(
                "tx_type",
                format!(
                    "unsupported transaction type 0x{other:02x} — only legacy (0x00) and \
                     EIP-1559 (0x02) are accepted; blob/7702/unknown types are refused"
                ),
            )),
        }
    }
}

/// Which plan-bound payload this transaction is supposed to carry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TxDestination {
    /// `payForMerkleTree` for exactly this batch (by plan batch index).
    BatchPayment { batch_index: usize },
    /// The single bounded `approve` covering the whole plan.
    Approve,
}

/// A decoded (unsigned-content) transaction as returned by a signer/bridge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecodedTransaction {
    pub envelope: TxEnvelope,
    pub chain_id: u64,
    pub from: EthAddr,
    pub to: EthAddr,
    /// Native value in wei — MUST be zero for these contract calls.
    pub value_wei: Atto,
    pub nonce: u64,
    pub gas_limit: u64,
    /// Legacy: gasPrice. EIP-1559: maxFeePerGas. Wei, u64-bounded (≈18.4
    /// ETH per gas unit — beyond any lawful fee; out-of-policy by construction).
    pub max_fee_per_gas_wei: u64,
    /// EIP-1559: maxPriorityFeePerGas. Must be 0 for legacy.
    pub max_priority_fee_wei: u64,
    pub input: Vec<u8>,
    /// Externally supplied (the signed tx's hash). Not re-derived here.
    pub tx_hash: Hex32,
}

fn refuse(field: &'static str, reason: impl Into<String>) -> Error {
    Error::field(field, reason)
}

/// Validate a decoded transaction against a validated plan.
///
/// `expected_nonce` is the nonce persisted with the attempt intent — the
/// nonce policy is: a transaction is only accepted for the exact attempt
/// (job, batch, attempt sequence) it was composed for. Replacement policy
/// (same nonce, higher fee) is a LEDGER decision requiring explicit human
/// action on an Unknown outcome — never automatic here.
pub fn validate_transaction(
    vp: &ValidatedPlan,
    dest: TxDestination,
    tx: &DecodedTransaction,
    expected_nonce: u64,
) -> Result<()> {
    let plan = &vp.plan();
    if tx.chain_id != plan.network.chain_id {
        return Err(refuse(
            "chain_id",
            format!("tx chain {} != plan chain {}", tx.chain_id, plan.network.chain_id),
        ));
    }
    if tx.from != plan.expected_payer {
        return Err(refuse(
            "from",
            format!("payer {} != plan expected_payer {}", tx.from, plan.expected_payer),
        ));
    }
    if tx.nonce != expected_nonce {
        return Err(refuse(
            "nonce",
            format!(
                "tx nonce {} does not match the persisted attempt nonce {expected_nonce} — \
                 a pending nonce per attempt is NOT an idempotency guard",
                tx.nonce
            ),
        ));
    }
    if tx.tx_hash.is_zero() {
        return Err(refuse(
            "tx_hash",
            "zero/placeholder hash — the signed transaction hash is unavailable before \
             signing; refuse to record an unsigned marker as a signed result",
        ));
    }
    if tx.value_wei != Atto::ZERO {
        return Err(refuse(
            "value",
            format!(
                "native value {} wei — these contract calls carry zero native value",
                tx.value_wei
            ),
        ));
    }
    if tx.gas_limit > plan.gas_ceilings.per_tx_gas_limit {
        return Err(refuse(
            "gas_limit",
            format!(
                "gas limit {} above plan per-tx ceiling {}",
                tx.gas_limit, plan.gas_ceilings.per_tx_gas_limit
            ),
        ));
    }
    if tx.max_fee_per_gas_wei > plan.native_fee_ceilings.per_tx_max_fee_per_gas_wei {
        return Err(refuse(
            "max_fee_per_gas_wei",
            format!(
                "fee cap {} above plan ceiling {}",
                tx.max_fee_per_gas_wei, plan.native_fee_ceilings.per_tx_max_fee_per_gas_wei
            ),
        ));
    }
    match tx.envelope {
        TxEnvelope::Legacy => {
            if tx.max_priority_fee_wei != 0 {
                return Err(refuse(
                    "max_priority_fee_wei",
                    "legacy transactions carry no priority fee field",
                ));
            }
        }
        TxEnvelope::Eip1559 => {
            if tx.max_priority_fee_wei > tx.max_fee_per_gas_wei {
                return Err(refuse(
                    "max_priority_fee_wei",
                    "priority fee above the tx's own max fee",
                ));
            }
            if tx.max_priority_fee_wei > plan.native_fee_ceilings.per_tx_max_priority_fee_wei {
                return Err(refuse(
                    "max_priority_fee_wei",
                    format!(
                        "priority fee {} above plan ceiling {}",
                        tx.max_priority_fee_wei,
                        plan.native_fee_ceilings.per_tx_max_priority_fee_wei
                    ),
                ));
            }
        }
    }

    match dest {
        TxDestination::BatchPayment { batch_index } => {
            let batch = plan
                .batches
                .get(batch_index)
                .ok_or_else(|| refuse("batch_index", "no such batch in the plan"))?;
            if tx.to != plan.network.payment_vault {
                return Err(refuse(
                    "to",
                    format!("payment tx destination {} != plan vault {}", tx.to, plan.network.payment_vault),
                ));
            }
            let want = calldata::pay_for_merkle_tree_calldata(
                batch.depth,
                &batch.commitments,
                batch.merkle_payment_timestamp,
            )?;
            if tx.input != want {
                return Err(refuse(
                    "input",
                    format!(
                        "calldata not byte-identical to the plan-derived calldata for batch \
                         {batch_index} — a different batch (or altered commitments) is refused"
                    ),
                ));
            }
        }
        TxDestination::Approve => {
            if tx.to != plan.network.payment_token {
                return Err(refuse(
                    "to",
                    format!(
                        "approve tx destination {} != plan token {}",
                        tx.to, plan.network.payment_token
                    ),
                ));
            }
            let want = calldata::approve_calldata(plan.network.payment_vault, vp.approve_ceiling())?;
            if tx.input != want {
                return Err(refuse(
                    "input",
                    "approve calldata differs from the derived bounded approval \
                     (spender/amount) — Amount::MAX approvals are refused",
                ));
            }
        }
    }
    Ok(())
}
