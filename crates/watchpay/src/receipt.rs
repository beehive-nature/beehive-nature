//! Strict receipt validation: receipt → recorded transaction → THIS batch.
//! NO FALLBACK PATHS.
//!
//! A batch counts as paid ONLY when a transaction receipt shows:
//! - status 1, `to` = the plan vault, `from` = the expected payer, chain
//!   per the plan — all also bound to the RECORDED signed transaction by
//!   hash and by its decoded calldata (byte-equality with the composed
//!   batch calldata);
//! - EXACTLY ONE `MerklePaymentMade` log emitted by the vault address,
//!   whose `depth` and `merklePaymentTimestamp` match the batch, whose
//!   `winnerPoolHash` is one of THIS batch's committed pool hashes (a
//!   different batch with identical depth/timestamp is REFUSED — the
//!   ordered commitments differ), and whose `totalAmount` equals the
//!   pinned pricing rule `median16(winner pool) << depth` recomputed
//!   locally (under- and over-payment both refused);
//! - a `getCompletedMerklePayment(winner)` read-back matching the event's
//!   depth+timestamp.
//!
//! Missing event, wrong contract, malformed/ambiguous logs, or multiple
//! candidate events ⇒ REFUSE. The transaction hash is NEVER accepted as
//! "the winner" (the member-pay.mjs defect class — a tx-hash fallback is
//! forbidden by construction: nothing in this module reads a winner from
//! anywhere but the decoded event).
//!
//! EVIDENCE ASSUMPTIONS (stated, not proven): every field of
//! [`SyntheticReceipt`] and [`CompletedReadback`] is EXTERNALLY SUPPLIED by
//! an RPC the caller chose. RPC responses are evidence, not independent
//! cryptographic proof of chain finality — `confirmations` is recorded as
//! reported and this module enforces no finality policy. A compromised RPC
//! can forge every field checked here; the defense against that is outside
//! this slice (multi-source receipt cross-check / waited finality, later).

use crate::calldata::{decode_merkle_payment_made, decode_payment_already_exists, SyntheticLog};
use crate::error::{Error, Result};
use crate::plan::ValidatedPlan;
use crate::pricing::charge_for_pool;
use crate::tx::DecodedTransaction;
use crate::types::{Atto, EthAddr, Hex32};

fn refuse(field: &'static str, reason: impl Into<String>) -> Error {
    Error::field(field, reason)
}

/// As-reported chain context for an RPC-served receipt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainEvidence {
    pub chain_id: u64,
    pub confirmations: u64,
}

/// A synthetic/externally-served transaction receipt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyntheticReceipt {
    pub tx_hash: Hex32,
    /// Chain as reported by the serving RPC context.
    pub chain_id: u64,
    /// 1 = success, 0 = reverted.
    pub status: u8,
    pub from: EthAddr,
    pub to: EthAddr,
    pub logs: Vec<SyntheticLog>,
    /// From an eth_call/trace re-run of the reverted tx — NOT part of
    /// `eth_getTransactionReceipt`; optional.
    pub revert_data: Option<Vec<u8>>,
    pub evidence: ChainEvidence,
}

/// Result shape of `getCompletedMerklePayment(winner)` (depth/timestamp
/// fields; the paid-node list is out of scope for binding here).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompletedReadback {
    pub depth: u8,
    pub merkle_payment_timestamp: u64,
}

/// A validated payment: the receipt, its tx, and the batch are now one fact.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedPayment {
    pub batch_index: usize,
    pub batch_id: Hex32,
    pub tx_hash: Hex32,
    pub winner_pool_hash: Hex32,
    /// Equal to `charge_for_pool(winner)`, recomputed and required.
    pub total_amount: Atto,
    pub confirmations: u64,
}

/// A reverted outcome, classified where possible.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RevertedOutcome {
    pub tx_hash: Hex32,
    /// `Some(winner)` when revert_data decodes as
    /// `PaymentAlreadyExists(bytes32)` (the vault's double-payment fence).
    pub payment_already_exists_winner: Option<Hex32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReceiptOutcome {
    Paid(ValidatedPayment),
    Reverted(RevertedOutcome),
}

/// Validate a receipt against the plan, the batch, the recorded signed
/// transaction's hash, and that transaction's decoded calldata.
pub fn validate_receipt(
    vp: &ValidatedPlan,
    batch_index: usize,
    signed_tx: &DecodedTransaction,
    receipt: &SyntheticReceipt,
    readback: Option<&CompletedReadback>,
) -> Result<ReceiptOutcome> {
    let plan = &vp.plan;
    let batch = plan
        .batches
        .get(batch_index)
        .ok_or_else(|| refuse("batch_index", "no such batch in the plan"))?;

    if receipt.chain_id != plan.network.chain_id {
        return Err(refuse(
            "chain",
            format!(
                "receipt chain {} (as reported) != plan chain {}",
                receipt.chain_id, plan.network.chain_id
            ),
        ));
    }
    if receipt.tx_hash != signed_tx.tx_hash {
        return Err(refuse(
            "tx_hash",
            format!(
                "receipt binds tx {} but the recorded signed transaction is {} — \
                 altered or foreign transaction refused",
                receipt.tx_hash, signed_tx.tx_hash
            ),
        ));
    }
    // Re-bind the recorded transaction's calldata to THIS batch (the
    // receipt is worthless if the recorded tx paid something else).
    {
        let want = crate::calldata::pay_for_merkle_tree_calldata(
            batch.depth,
            &batch.commitments,
            batch.merkle_payment_timestamp,
        )?;
        if signed_tx.input != want {
            return Err(refuse(
                "calldata",
                "the recorded transaction's calldata does not match this batch — \
                 receipt-to-transaction-to-batch binding broken",
            ));
        }
    }
    if receipt.from != plan.expected_payer {
        return Err(refuse(
            "payer",
            format!("receipt from {} != expected payer {}", receipt.from, plan.expected_payer),
        ));
    }
    if receipt.to != plan.network.payment_vault {
        return Err(refuse(
            "contract",
            format!("receipt to {} != plan vault {}", receipt.to, plan.network.payment_vault),
        ));
    }

    if receipt.status != 1 {
        let winner = match &receipt.revert_data {
            Some(data) => decode_payment_already_exists(data).ok(),
            None => None,
        };
        return Ok(ReceiptOutcome::Reverted(RevertedOutcome {
            tx_hash: receipt.tx_hash,
            payment_already_exists_winner: winner,
        }));
    }

    // Exactly one matching event from the vault, decoded strictly.
    let topic0 = crate::abi::merkle_payment_made_topic0();
    let mut matches = receipt
        .logs
        .iter()
        .filter(|l| l.address == plan.network.payment_vault && l.topics.first().map(|t| t.0) == Some(topic0))
        .collect::<Vec<_>>();
    match matches.len() {
        0 => {
            return Err(refuse(
                "logs",
                "no MerklePaymentMade event from the vault in a status-1 receipt — \
                 REFUSED, no tx-hash fallback exists",
            ))
        }
        1 => {}
        n => {
            return Err(refuse(
                "logs",
                format!("{n} matching MerklePaymentMade events — ambiguous, refused"),
            ))
        }
    }
    let event = decode_merkle_payment_made(matches.remove(0))?;

    if event.depth != batch.depth {
        return Err(refuse(
            "depth",
            format!("event depth {} != batch depth {}", event.depth, batch.depth),
        ));
    }
    if event.merkle_payment_timestamp != batch.merkle_payment_timestamp {
        return Err(refuse(
            "merklePaymentTimestamp",
            format!(
                "event timestamp {} != batch timestamp {}",
                event.merkle_payment_timestamp, batch.merkle_payment_timestamp
            ),
        ));
    }
    let winner_pool = batch
        .commitments
        .iter()
        .find(|p| p.pool_hash == event.winner_pool_hash)
        .ok_or_else(|| {
            refuse(
                "winnerPoolHash",
                format!(
                    "event winner {} is not among this batch's committed pools — a different \
                     batch with identical depth/timestamp is REFUSED",
                    event.winner_pool_hash
                ),
            )
        })?;
    // Validate the winner against the pinned pricing rule: the amount must
    // equal median16(winner pool) << depth, recomputed here.
    let want_amount = charge_for_pool(batch.depth, winner_pool)?;
    if event.total_amount != want_amount {
        return Err(refuse(
            "totalAmount",
            format!(
                "event totalAmount {} != pricing-rule recompute {} \
                 (median16(winner)<<depth)",
                event.total_amount, want_amount
            ),
        ));
    }
    // Belt: also under the declared ceiling (implied by the recompute, but
    // asserted as its own named refusal).
    if event.total_amount > batch.batch_amount_ceiling {
        return Err(refuse(
            "totalAmount",
            format!(
                "event totalAmount {} above batch ceiling {}",
                event.total_amount, batch.batch_amount_ceiling
            ),
        ));
    }

    // Read-back cross-check (getCompletedMerklePayment), when supplied.
    if let Some(rb) = readback {
        if rb.depth != event.depth || rb.merkle_payment_timestamp != event.merkle_payment_timestamp {
            return Err(refuse(
                "getCompletedMerklePayment",
                format!(
                    "read-back depth/ts ({}/{}) != event ({}/{})",
                    rb.depth,
                    rb.merkle_payment_timestamp,
                    event.depth,
                    event.merkle_payment_timestamp
                ),
            ));
        }
    }

    Ok(ReceiptOutcome::Paid(ValidatedPayment {
        batch_index,
        batch_id: batch.batch_id,
        tx_hash: receipt.tx_hash,
        winner_pool_hash: event.winner_pool_hash,
        total_amount: event.total_amount,
        confirmations: receipt.evidence.confirmations,
    }))
}

/// Convenience for fixtures/tests: build a receipt whose single log is a
/// well-formed MerklePaymentMade from `emitter` with the given fields.
pub fn synth_receipt_with_event(
    signed_tx: &DecodedTransaction,
    chain_id: u64,
    from: EthAddr,
    to: EthAddr,
    event: &crate::calldata::MerklePaymentMadeEvent,
    confirmations: u64,
) -> SyntheticReceipt {
    SyntheticReceipt {
        tx_hash: signed_tx.tx_hash,
        chain_id,
        status: 1,
        from,
        to,
        logs: vec![crate::calldata::synth_merkle_payment_made_log(to, event)],
        revert_data: None,
        evidence: ChainEvidence { chain_id, confirmations },
    }
}
