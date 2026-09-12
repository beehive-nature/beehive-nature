//! Plan validation: every field strictly bounded, every derived figure
//! re-derived (declared values that disagree with derivation are refused),
//! expiry enforced including the payment timestamp.

use crate::abi::MERKLE_PAYMENT_EXPIRATION_SECS;
use crate::canonical;
use crate::error::{Error, Result};
use crate::plan_model::*;
use crate::pricing::{batch_worst_case_charge, check_depth, expected_reward_pools};
use crate::types::Atto;

pub const MIN_GAS_LIMIT: u64 = 21_000;
pub const MAX_RPC_HINT_LEN: usize = 256;

/// A fully validated plan plus everything derived from it. The derived
/// figures are the ONLY lawful amounts/gas/fee bases downstream (approve
/// composition, tx validation, receipt ceilings).
#[derive(Debug, Clone)]
pub struct ValidatedPlan {
    pub plan: Plan,
    /// Per batch: derived worst-case charge (max over pools of
    /// median16<<depth). Index-aligned with `plan.batches`.
    pub batch_worst_case: Vec<Atto>,
    /// Sum of batch ceilings = the only lawful approval amount.
    pub approve_ceiling: Atto,
    /// Batches + one approval transaction.
    pub planned_tx_count: u64,
    /// per_tx_gas_limit * per_tx_max_fee_per_gas_wei * planned_tx_count.
    pub worst_case_total_native_fee_wei: Atto,
}

fn refuse(field: &'static str, reason: impl Into<String>) -> Error {
    Error::field(field, reason)
}

pub fn validate_plan(plan: &Plan, now_unix: u64) -> Result<ValidatedPlan> {
    if plan.schema != SCHEMA {
        return Err(refuse(
            "schema",
            format!("expected {SCHEMA:?}, got {:?} — wrong or future schema", plan.schema),
        ));
    }
    if plan.arm != ARM_MERKLE {
        return Err(refuse(
            "arm",
            format!(
                "arm {:?} refused — this slice is Merkle-only (a wave batch returned by \
                 prepare requires a new plan, never an arm switch)",
                plan.arm
            ),
        ));
    }
    validate_job_id(&plan.job_id)?;

    if plan.created_unix > now_unix {
        return Err(refuse(
            "created_unix",
            format!("created_unix {} is in the future (now {now_unix})", plan.created_unix),
        ));
    }
    if plan.expires_unix < plan.created_unix {
        return Err(refuse(
            "expires_unix",
            format!("expires_unix {} before created_unix {}", plan.expires_unix, plan.created_unix),
        ));
    }
    if plan.expires_unix - plan.created_unix > MERKLE_PAYMENT_EXPIRATION_SECS {
        return Err(refuse(
            "expires_unix",
            format!(
                "window {}s exceeds MERKLE_PAYMENT_EXPIRATION {}s (evmlib v0.9.1 \
                 merkle_tree.rs:28)",
                plan.expires_unix - plan.created_unix,
                MERKLE_PAYMENT_EXPIRATION_SECS
            ),
        ));
    }
    if plan.expires_unix <= now_unix {
        return Err(refuse(
            "expires_unix",
            format!("plan expired at {} (now {now_unix}) — expired plans are refused everywhere", plan.expires_unix),
        ));
    }

    // Network binding.
    if plan.network.chain_id == 0 {
        return Err(refuse("chain_id", "chain_id must be nonzero (EIP-155)"));
    }
    if plan.network.rpc_hint.len() > MAX_RPC_HINT_LEN {
        return Err(refuse(
            "rpc_hint",
            format!("advisory rpc_hint longer than {MAX_RPC_HINT_LEN} chars"),
        ));
    }
    if plan.network.payment_token.is_zero() || plan.network.payment_vault.is_zero() {
        return Err(refuse("payment_vault", "token and vault addresses must be nonzero"));
    }
    if plan.network.payment_token == plan.network.payment_vault {
        return Err(refuse("payment_vault", "token and vault addresses must differ"));
    }
    if plan.expected_payer.is_zero() {
        return Err(refuse("expected_payer", "expected_payer must be nonzero"));
    }
    if plan.upload.visibility != VISIBILITY_PUBLIC {
        return Err(refuse(
            "visibility",
            format!("visibility {:?} refused — this slice pays for public uploads only", plan.upload.visibility),
        ));
    }

    // Batches.
    if plan.batches.is_empty() {
        return Err(refuse("batches", "plan has no batches"));
    }
    let mut batch_worst = Vec::with_capacity(plan.batches.len());
    let mut approve_sum = Atto::ZERO;
    for (i, b) in plan.batches.iter().enumerate() {
        if b.batch_index != i as u32 {
            return Err(refuse(
                "batch_index",
                format!("batch {} has batch_index {} — indices must be 0-based contiguous", i, b.batch_index),
            ));
        }
        check_depth(b.depth)?;
        let want_pools = expected_reward_pools(b.depth);
        if b.commitments.len() != want_pools {
            return Err(refuse(
                "commitments",
                format!(
                    "depth {} requires exactly {} pools (2^ceil(depth/2)), got {}",
                    b.depth,
                    want_pools,
                    b.commitments.len()
                ),
            ));
        }
        let mut seen = std::collections::HashSet::with_capacity(want_pools);
        for pool in &b.commitments {
            if !seen.insert(pool.pool_hash) {
                return Err(refuse(
                    "pool_hash",
                    format!("duplicate pool_hash {} — ambiguous winner identity", pool.pool_hash),
                ));
            }
            for c in &pool.candidates {
                if c.rewards_address.is_zero() {
                    return Err(refuse(
                        "rewards_address",
                        format!("zero rewards_address in pool {} (strictness beyond the contract: refuse)", pool.pool_hash),
                    ));
                }
            }
        }
        // Payment-timestamp expiry (client-side law at the pin).
        if b.merkle_payment_timestamp > now_unix {
            return Err(refuse(
                "merkle_payment_timestamp",
                format!("timestamp {} is in the future (now {now_unix})", b.merkle_payment_timestamp),
            ));
        }
        let age = now_unix - b.merkle_payment_timestamp;
        if age > MERKLE_PAYMENT_EXPIRATION_SECS {
            return Err(refuse(
                "merkle_payment_timestamp",
                format!(
                    "timestamp age {age}s exceeds MERKLE_PAYMENT_EXPIRATION {}s",
                    MERKLE_PAYMENT_EXPIRATION_SECS
                ),
            ));
        }

        // Declared vs derived figures.
        let derived_ceiling = batch_worst_case_charge(b)?;
        if b.batch_amount_ceiling != derived_ceiling {
            return Err(refuse(
                "batch_amount_ceiling",
                format!(
                    "declared {} but derived worst-case {} (max over pools of median16<<depth; \
                     a candidate-sum figure is not a bound — see the depth-12 counterexample)",
                    b.batch_amount_ceiling, derived_ceiling
                ),
            ));
        }
        let derived_id = canonical::batch_id(plan.network.chain_id, &plan.network.payment_vault, b);
        if b.batch_id != derived_id {
            return Err(refuse(
                "batch_id",
                format!("declared {} but derived {} — mis-derived or tampered", b.batch_id, derived_id),
            ));
        }
        batch_worst.push(derived_ceiling);
        approve_sum = approve_sum.checked_add(b.batch_amount_ceiling).ok_or_else(|| {
            refuse("approve_ceiling_total", "sum of batch ceilings overflows u256")
        })?;
    }

    // Approval law.
    if plan.approve_ceiling_total != approve_sum {
        return Err(refuse(
            "approve_ceiling_total",
            format!(
                "declared {} but sum of batch ceilings is {}",
                plan.approve_ceiling_total, approve_sum
            ),
        ));
    }
    if plan.approve_ceiling_total == Atto::MAX {
        // Unreachable via the derived path above (a derived sum equal to
        // 2^256-1 requires overflowing first) — the check is the LAW, kept
        // explicit: evmlib v0.9.1's helper returns Amount::MAX here and
        // this module must refuse that shape wherever it appears.
        return Err(refuse(
            "approve_ceiling_total",
            "approval must NEVER be 2^256-1 (Amount::MAX) — bounded approvals only (the E7 law)",
        ));
    }

    // Gas + native-fee ceilings.
    let g = &plan.gas_ceilings;
    if g.per_tx_gas_limit < MIN_GAS_LIMIT {
        return Err(refuse(
            "per_tx_gas_limit",
            format!("gas limit {} below the intrinsic minimum {MIN_GAS_LIMIT}", g.per_tx_gas_limit),
        ));
    }
    let planned_tx_count = plan.batches.len() as u64 + 1; // batches + one approve
    let derived_total_gas = g
        .per_tx_gas_limit
        .checked_mul(planned_tx_count)
        .ok_or_else(|| refuse("max_total_gas", "per_tx_gas_limit * tx count overflows u64"))?;
    if g.max_total_gas < derived_total_gas {
        return Err(refuse(
            "max_total_gas",
            format!("declared {} but the plan needs {} (per_tx * {planned_tx_count} txs)", g.max_total_gas, derived_total_gas),
        ));
    }

    let f = &plan.native_fee_ceilings;
    if f.per_tx_max_fee_per_gas_wei == 0 {
        return Err(refuse("per_tx_max_fee_per_gas_wei", "zero fee cap is not a plan"));
    }
    if f.per_tx_max_priority_fee_wei > f.per_tx_max_fee_per_gas_wei {
        return Err(refuse(
            "per_tx_max_priority_fee_wei",
            "priority fee above the total fee cap",
        ));
    }
    // Worst-case native fee per tx = gas_limit * maxFeePerGas (EIP-1559's
    // maxFeePerGas bounds gasPrice+priority together; legacy gasPrice is
    // validated against the same cap at tx-validation time).
    let per_tx_worst = Atto::from_u64(g.per_tx_gas_limit)
        .checked_mul(Atto::from_u64(f.per_tx_max_fee_per_gas_wei))
        .ok_or_else(|| refuse("max_total_native_fee_wei", "per-tx worst-case fee overflow"))?;
    let derived_total_fee = per_tx_worst
        .checked_mul(Atto::from_u64(planned_tx_count))
        .ok_or_else(|| refuse("max_total_native_fee_wei", "total worst-case fee overflow"))?;
    if f.max_total_native_fee_wei < derived_total_fee {
        return Err(refuse(
            "max_total_native_fee_wei",
            format!(
                "declared {} but worst-case is {} (per_tx_gas * fee_cap * {planned_tx_count} txs) \
                 — gas units alone are not a native fee cap",
                f.max_total_native_fee_wei, derived_total_fee
            ),
        ));
    }

    // Plan-hash binding: recompute over everything above.
    let derived_hash = canonical::plan_hash(plan);
    if plan.plan_hash != derived_hash {
        return Err(refuse(
            "plan_hash",
            format!("declared {} but derived {} — tampered envelope", plan.plan_hash, derived_hash),
        ));
    }

    Ok(ValidatedPlan {
        plan: plan.clone(),
        batch_worst_case: batch_worst,
        approve_ceiling: approve_sum,
        planned_tx_count,
        worst_case_total_native_fee_wei: derived_total_fee,
    })
}

/// job_id doubles as a ledger directory name — enforce filesystem safety
/// here AND again at the ledger boundary.
pub fn validate_job_id(job_id: &str) -> Result<()> {
    if job_id.is_empty() || job_id.len() > MAX_JOB_ID_LEN {
        return Err(refuse(
            "job_id",
            format!("length {} outside 1..={MAX_JOB_ID_LEN}", job_id.len()),
        ));
    }
    if !job_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_' || b == b'-') {
        return Err(refuse(
            "job_id",
            "only [A-Za-z0-9._-] allowed (the id becomes a ledger directory name)",
        ));
    }
    if job_id.contains("..") {
        return Err(refuse("job_id", "'..' forbidden (path traversal)"));
    }
    Ok(())
}

/// Round-trip a plan through canonical JSON (storage form). Refuses unknown
/// fields via the model's serde configuration — this is the structural
/// no-private-material gate for anything re-loading a plan from disk.
pub fn plan_from_json(json: &str) -> Result<Plan> {
    serde_json::from_str(json)
        .map_err(|e| Error::Malformed(format!("plan JSON: {e}")))
}

pub fn plan_to_json(plan: &Plan) -> Result<String> {
    serde_json::to_string(plan).map_err(|e| Error::Malformed(format!("plan JSON: {e}")))
}

/// Convenience: does the declared plan_hash match a recomputation (used by
/// the ledger when reloading a plan by identity).
pub fn plan_hash_matches(plan: &Plan) -> bool {
    plan.plan_hash == canonical::plan_hash(plan)
}
