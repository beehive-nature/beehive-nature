//! Deterministic canonical binary encoding for hashing.
//!
//! JSON is the storage/display form; IDENTITIES (`batch_id`, `plan_hash`)
//! hash a fixed-field-order binary encoding defined ONLY here:
//! - integers: little-endian fixed width (u32/u64/u128), u8 raw
//! - `Atto`: 32 bytes big-endian
//! - `EthAddr`: 20 raw bytes; `Hex32`: 32 raw bytes
//! - strings/vectors: u32-LE byte-length prefix then content, in the field
//!   order written below. No ambiguity, no separators, no dependencies on
//!   serde map ordering.
//!
//! `batch_id = keccak256(chain_id ‖ vault ‖ depth ‖ timestamp ‖
//! keccak256(commitments_encoding))` per the plan contract §5.1: the batch
//! identity binds chain, vault, depth, timestamp AND the ordered pool
//! commitments — two batches with identical depth/timestamp but different
//! commitments get different ids, which is what lets the receipt validator
//! refuse "a different batch with the same depth/timestamp".

use crate::abi::keccak256;
use crate::plan_model::{Batch, Plan};
use crate::types::{Atto, EthAddr, Hex32};

fn u32le(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn u64le(out: &mut Vec<u8>, v: u64) {
    out.extend_from_slice(&v.to_le_bytes());
}

#[allow(dead_code)]
fn u128le(out: &mut Vec<u8>, v: u128) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn u8raw(out: &mut Vec<u8>, v: u8) {
    out.push(v);
}

fn blob(out: &mut Vec<u8>, bytes: &[u8]) {
    u32le(out, bytes.len() as u32);
    out.extend_from_slice(bytes);
}

fn atto_be(out: &mut Vec<u8>, v: &Atto) {
    out.extend_from_slice(&v.0.to_big_endian());
}

/// The ordered commitments encoding shared by `batch_id` and `plan_hash`:
/// per pool in order: `pool_hash ‖ (rewards_address ‖ amount_be) × 16`.
pub fn commitments_encoding(batch: &Batch) -> Vec<u8> {
    let mut out = Vec::new();
    for pool in &batch.commitments {
        out.extend_from_slice(pool.pool_hash.as_bytes());
        for c in &pool.candidates {
            out.extend_from_slice(c.rewards_address.as_bytes());
            atto_be(&mut out, &c.amount);
        }
    }
    out
}

pub fn batch_id(chain_id: u64, vault: &EthAddr, batch: &Batch) -> Hex32 {
    let inner = keccak256(&commitments_encoding(batch));
    let mut buf = Vec::with_capacity(8 + 20 + 1 + 8 + 32);
    u64le(&mut buf, chain_id);
    buf.extend_from_slice(vault.as_bytes());
    u8raw(&mut buf, batch.depth);
    u64le(&mut buf, batch.merkle_payment_timestamp);
    buf.extend_from_slice(&inner);
    Hex32(keccak256(&buf))
}

/// Canonical serialization of the ENTIRE plan EXCEPT `plan_hash` itself.
pub fn plan_encoding(plan: &Plan) -> Vec<u8> {
    let mut out = Vec::new();
    blob(&mut out, plan.schema.as_bytes());
    blob(&mut out, plan.job_id.as_bytes());
    u64le(&mut out, plan.created_unix);
    u64le(&mut out, plan.expires_unix);
    u64le(&mut out, plan.network.chain_id);
    blob(&mut out, plan.network.rpc_hint.as_bytes());
    out.extend_from_slice(plan.network.payment_token.as_bytes());
    out.extend_from_slice(plan.network.payment_vault.as_bytes());
    out.extend_from_slice(plan.expected_payer.as_bytes());
    blob(&mut out, plan.upload.visibility.as_bytes());
    out.extend_from_slice(plan.upload.data_map_address.as_bytes());
    blob(&mut out, plan.arm.as_bytes());
    u32le(&mut out, plan.batches.len() as u32);
    for b in &plan.batches {
        u32le(&mut out, b.batch_index);
        u8raw(&mut out, b.depth);
        u64le(&mut out, b.merkle_payment_timestamp);
        let ce = commitments_encoding(b);
        blob(&mut out, &ce);
        atto_be(&mut out, &b.batch_amount_ceiling);
        out.extend_from_slice(b.batch_id.as_bytes());
    }
    atto_be(&mut out, &plan.approve_ceiling_total);
    u64le(&mut out, plan.gas_ceilings.per_tx_gas_limit);
    u64le(&mut out, plan.gas_ceilings.max_total_gas);
    u64le(&mut out, plan.native_fee_ceilings.per_tx_max_fee_per_gas_wei);
    u64le(&mut out, plan.native_fee_ceilings.per_tx_max_priority_fee_wei);
    atto_be(&mut out, &plan.native_fee_ceilings.max_total_native_fee_wei);
    out
}

pub fn plan_hash(plan: &Plan) -> Hex32 {
    Hex32(keccak256(&plan_encoding(plan)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{base_plan, plan_variants};

    #[test]
    fn encoding_is_deterministic_and_field_sensitive() {
        let plan = base_plan();
        let h1 = plan_hash(&plan);
        let h2 = plan_hash(&plan);
        assert_eq!(h1, h2, "same plan must hash identically");

        for (name, mutated) in plan_variants(&plan) {
            let hm = plan_hash(&mutated(&plan));
            assert_ne!(h1, hm, "mutating {name} must change plan_hash");
        }

        // batch_id binds ordered commitments: same depth+timestamp,
        // different commitments -> different batch_id (the receipt-binding
        // identity law).
        let a = base_plan();
        let mut b = a.batches[0].clone();
        b.commitments[0].candidates[0].amount = b
            .commitments[0]
            .candidates[0]
            .amount
            .checked_add(Atto::from_u64(1))
            .unwrap();
        let id_a = batch_id(a.network.chain_id, &a.network.payment_vault, &a.batches[0]);
        let id_b = batch_id(a.network.chain_id, &a.network.payment_vault, &b);
        assert_ne!(id_a, id_b);

        // pool ORDER is part of the identity: swapping pools changes the id
        let mut c = a.batches[0].clone();
        c.commitments.swap(0, 1);
        let id_c = batch_id(a.network.chain_id, &a.network.payment_vault, &c);
        assert_ne!(id_a, id_c);
        assert_ne!(id_b, id_c);
    }
}
