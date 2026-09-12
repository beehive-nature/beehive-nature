//! Calldata composition (keyless) and strict event decoding.
//!
//! Composition implements the pinned ABI exactly
//! (`abi/IPaymentVault.json` @ evmlib v0.9.1):
//! `payForMerkleTree(uint8,(bytes32,(address,uint256)[16])[],uint64)`:
//!
//! ```text
//! selector(4) ‖ depth(32 BE) ‖ offset=0x60(32 BE) ‖ timestamp(32 BE)
//!            ‖ array_len(32 BE) ‖ pool[0] ‖ … ‖ pool[n-1]
//! pool = pool_hash(32) ‖ (address(32, right-aligned) ‖ amount(32 BE)) × 16
//! ```
//!
//! Byte-equality against evmlib v0.9.1's own
//! `external_signer::pay_for_merkle_tree_calldata` output is pinned in
//! `tests/parity_calldata.rs`; the vectors' generator is checked in at
//! `dev/gen-parity-vectors/`.
//!
//! The approval composed here is ALWAYS the plan-derived bounded ceiling —
//! never `Amount::MAX` (evmlib's helper returns MAX as its default because
//! winner selection depends on block entropy; this module's ceilings are
//! the answer to that, per the pinned pricing rules).

use crate::abi::{
    approve_selector, get_completed_selector, merkle_payment_made_topic0,
    pay_for_merkle_tree_selector,
};
use crate::error::{Error, Result};
use crate::plan_model::PoolCommitment;
use crate::pricing::{check_depth, expected_reward_pools};
use crate::types::{Atto, EthAddr, Hex32};

fn word_be32(out: &mut Vec<u8>, bytes: &[u8]) {
    // Right-align into a 32-byte big-endian word (ABI static head).
    debug_assert!(bytes.len() <= 32);
    out.extend_from_slice(&[0u8; 32][..32 - bytes.len()]);
    out.extend_from_slice(bytes);
}

/// Compose `payForMerkleTree` calldata. Pool count is validated against
/// `expected_reward_pools(depth)` — this composes a LAWFUL batch only.
pub fn pay_for_merkle_tree_calldata(
    depth: u8,
    commitments: &[PoolCommitment],
    merkle_payment_timestamp: u64,
) -> Result<Vec<u8>> {
    check_depth(depth)?;
    if commitments.len() != expected_reward_pools(depth) {
        return Err(Error::field(
            "commitments",
            format!(
                "depth {depth} requires {} pools, got {} (2^ceil(depth/2))",
                expected_reward_pools(depth),
                commitments.len()
            ),
        ));
    }
    let mut out = Vec::with_capacity(4 + 96 + 32 + commitments.len() * (32 + 16 * 64));
    out.extend_from_slice(&pay_for_merkle_tree_selector());
    word_be32(&mut out, &[depth]);
    // offset of the dynamic array, relative to the start of the args block
    word_be32(&mut out, &0x60u64.to_be_bytes());
    word_be32(&mut out, &merkle_payment_timestamp.to_be_bytes());
    word_be32(&mut out, &(commitments.len() as u64).to_be_bytes());
    for pool in commitments {
        out.extend_from_slice(pool.pool_hash.as_bytes());
        for c in &pool.candidates {
            word_be32(&mut out, c.rewards_address.as_bytes());
            out.extend_from_slice(&c.amount.0.to_big_endian());
        }
    }
    Ok(out)
}

/// Compose `approve(spender, amount)` on the payment token. Callers pass
/// the plan-derived `approve_ceiling_total`; `Atto::MAX` is refused
/// explicitly (belt over the derivation law).
pub fn approve_calldata(spender: EthAddr, amount: Atto) -> Result<Vec<u8>> {
    if amount == Atto::MAX {
        return Err(Error::field(
            "approve_ceiling_total",
            "refusing to compose approve(…, 2^256-1) — bounded approvals only (the E7 law)",
        ));
    }
    let mut out = Vec::with_capacity(4 + 64);
    out.extend_from_slice(&approve_selector());
    word_be32(&mut out, spender.as_bytes());
    out.extend_from_slice(&amount.0.to_big_endian());
    Ok(out)
}

/// Compose `getCompletedMerklePayment(winnerHash)` (the read-back shape).
pub fn get_completed_merkle_payment_calldata(winner: Hex32) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + 32);
    out.extend_from_slice(&get_completed_selector());
    out.extend_from_slice(winner.as_bytes());
    out
}

/// A synthetic EVM log (address, indexed topics, non-indexed data).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyntheticLog {
    pub address: EthAddr,
    pub topics: Vec<Hex32>,
    pub data: Vec<u8>,
}

/// Strictly decoded `MerklePaymentMade`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MerklePaymentMadeEvent {
    /// topic[1] — the indexed winner pool hash.
    pub winner_pool_hash: Hex32,
    pub depth: u8,
    pub total_amount: Atto,
    pub merkle_payment_timestamp: u64,
}

fn word_to_u64(w: &[u8], field: &'static str) -> Result<u64> {
    if w.len() != 32 || w[..24].iter().any(|&b| b != 0) {
        return Err(Error::field(field, "word not a canonical right-aligned u64"));
    }
    let mut v = [0u8; 8];
    v.copy_from_slice(&w[24..]);
    Ok(u64::from_be_bytes(v))
}

/// Strict decode: topic0 must equal the pinned event topic; exactly one
/// indexed topic (winner); data exactly 96 bytes; uint8/uint64 words
/// canonically zero-padded. Anything else is a named refusal.
pub fn decode_merkle_payment_made(log: &SyntheticLog) -> Result<MerklePaymentMadeEvent> {
    if log.topics.is_empty() || log.topics[0].0 != merkle_payment_made_topic0() {
        return Err(Error::field(
            "topics[0]",
            "log is not a MerklePaymentMade event (topic0 mismatch)",
        ));
    }
    if log.topics.len() != 2 {
        return Err(Error::field(
            "topics",
            format!(
                "MerklePaymentMade has exactly one indexed topic (winnerPoolHash), got {}",
                log.topics.len() - 1
            ),
        ));
    }
    if log.data.len() != 96 {
        return Err(Error::field(
            "data",
            format!("event data must be exactly 96 bytes (uint8,uint256,uint64), got {}", log.data.len()),
        ));
    }
    let dw = &log.data[0..32];
    if dw[..31].iter().any(|&b| b != 0) {
        return Err(Error::field("depth", "uint8 word not canonically zero-padded"));
    }
    let depth = dw[31];
    let mut amt = [0u8; 32];
    amt.copy_from_slice(&log.data[32..64]);
    let total_amount = Atto(primitive_types::U256::from_big_endian(&amt));
    let ts = word_to_u64(&log.data[64..96], "merklePaymentTimestamp")?;
    Ok(MerklePaymentMadeEvent {
        winner_pool_hash: log.topics[1],
        depth,
        total_amount,
        merkle_payment_timestamp: ts,
    })
}

/// Build a synthetic `MerklePaymentMade` log (tests/fixtures only — never
/// presented as chain evidence).
pub fn synth_merkle_payment_made_log(
    emitter: EthAddr,
    ev: &MerklePaymentMadeEvent,
) -> SyntheticLog {
    let mut data = Vec::with_capacity(96);
    data.extend_from_slice(&[0u8; 31]);
    data.push(ev.depth);
    data.extend_from_slice(&ev.total_amount.0.to_big_endian());
    data.extend_from_slice(&[0u8; 24]);
    data.extend_from_slice(&ev.merkle_payment_timestamp.to_be_bytes());
    SyntheticLog {
        address: emitter,
        topics: vec![Hex32(merkle_payment_made_topic0()), ev.winner_pool_hash],
        data,
    }
}

/// `PaymentAlreadyExists(bytes32)` revert-data classifier (from an
/// eth_call/trace re-run — NOT part of eth_getTransactionReceipt).
pub fn decode_payment_already_exists(revert_data: &[u8]) -> Result<Hex32> {
    let sel = crate::abi::payment_already_exists_selector();
    if revert_data.len() != 4 + 32 || revert_data[0..4] != sel {
        return Err(Error::field(
            "revert_data",
            "not a PaymentAlreadyExists(bytes32) payload",
        ));
    }
    let mut h = [0u8; 32];
    h.copy_from_slice(&revert_data[4..]);
    Ok(Hex32(h))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::*;

    #[test]
    fn composed_shape_matches_abi_layout() {
        let cd = pay_for_merkle_tree_calldata(2, &base_batch().commitments, SYNTH_TS).unwrap();
        assert_eq!(&cd[0..4], &pay_for_merkle_tree_selector());
        // args: depth word, offset word (0x60), timestamp word
        assert_eq!(cd[4 + 31], 2);
        assert_eq!(u64::from_be_bytes(cd[60..68].try_into().unwrap()), 0x60);
        assert_eq!(u64::from_be_bytes(cd[92..100].try_into().unwrap()), SYNTH_TS);
        // array length then pools; each pool = 32 + 16*64 = 1056 bytes
        assert_eq!(u64::from_be_bytes(cd[124..132].try_into().unwrap()), 2);
        assert_eq!(
            cd.len(),
            4 + 96 + 32 + 2 * (32 + crate::abi::CANDIDATES_PER_POOL * 64)
        );
    }

    #[test]
    fn wrong_pool_count_refused_at_composition() {
        // depth 1 requires 2 pools; one pool is refused.
        let one = base_batch().commitments[..1].to_vec();
        let e = pay_for_merkle_tree_calldata(1, &one, SYNTH_TS).unwrap_err();
        assert_eq!(e.field_name(), Some("commitments"));
        // depth 3 requires 4 pools; base batch's 2 pools are refused.
        let e2 = pay_for_merkle_tree_calldata(3, &base_batch().commitments, SYNTH_TS).unwrap_err();
        assert_eq!(e2.field_name(), Some("commitments"));
    }

    #[test]
    fn approve_is_bounded() {
        let cd = approve_calldata(SYNTH_VAULT_ADDR, Atto::from_u64(36)).unwrap();
        assert_eq!(&cd[0..4], &approve_selector());
        assert!(approve_calldata(SYNTH_VAULT_ADDR, Atto::MAX).is_err());
    }

    #[test]
    fn event_decode_strictness() {
        let ev = MerklePaymentMadeEvent {
            winner_pool_hash: synth_hash(2),
            depth: 2,
            total_amount: Atto::from_u64(4),
            merkle_payment_timestamp: SYNTH_TS,
        };
        let log = synth_merkle_payment_made_log(SYNTH_VAULT_ADDR, &ev);
        assert_eq!(decode_merkle_payment_made(&log).unwrap(), ev);

        // topic count: an extra indexed topic
        let mut bad = log.clone();
        bad.topics.push(synth_hash(0xCC));
        assert!(decode_merkle_payment_made(&bad).is_err());
        // zero indexed topics
        let mut none = log.clone();
        none.topics.truncate(1);
        assert!(decode_merkle_payment_made(&none).is_err());
        // data length
        let mut short = log.clone();
        short.data.truncate(95);
        assert!(decode_merkle_payment_made(&short).is_err());
        // non-canonical uint8 word
        let mut dirty = log.clone();
        dirty.data[0] = 1;
        assert!(decode_merkle_payment_made(&dirty).is_err());
        // wrong topic0
        let mut other = log;
        other.topics[0] = synth_hash(0xAB);
        assert!(decode_merkle_payment_made(&other).is_err());
    }
}
