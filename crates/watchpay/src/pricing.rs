//! Pinned pricing and selection rules, ported from the pinned vault source.
//!
//! Sources (WithAutonomi/evmlib tag `v0.9.1`, read 2026-09-12):
//! - `contracts/MerklePaymentLib.sol`:
//!   - `expectedRewardPools(depth) = 2^ceil(depth/2)`
//!   - `selectWinnerPool(poolCount, sender, timestamp)` — seed is
//!     `keccak256(abi.encodePacked(block.prevrandao, block.timestamp,
//!     sender, timestamp))`, winner index `= uint256(seed) % poolCount`
//!   - `median16` — quickselect returning the element at sorted index 8
//!     (the 9th smallest of 16, i.e. the upper median; NOT an average)
//! - `contracts/PaymentVaultV2.sol` `payForMerkleTree`:
//!   `totalAmount = median16(winnerPool.candidates.amount) * (1 << depth)`
//!
//! WHY ONLY A CEILING IS DERIVABLE AT PLAN TIME (this corrects the audited
//! sum-of-candidates bound): the winner pool index depends on
//! `block.prevrandao` and `block.timestamp` — values that do not exist
//! before the paying block is built. The EXACT charge is therefore
//! unknowable at signing time; what IS knowable is the worst case over the
//! plan's own pools: `max over pools of median16(pool) << depth`. That is
//! this module's ceiling derivation. The receipt validator later REQUIRES
//! `totalAmount == median16(event's winner pool) << depth`, recomputed
//! locally — so under-payment and over-payment are both refused.
//!
//! The depth-12 counterexample from the z2.a review, as a law: with depth
//! 12 there are 2^6 = 64 pools; if every candidate amount is 1, the sum of
//! all candidates is 64 * 16 = 1_024 — but any pool's charge is
//! median16 << 12 = 4_096. The sum is neither the charge nor a bound for
//! it. (`tests/plan_validation.rs::depth_12_unit_price_counterexample`.)

use crate::abi::{CANDIDATES_PER_POOL, MAX_MERKLE_DEPTH, MIN_MERKLE_DEPTH};
use crate::error::{Error, Result};
use crate::plan_model::{Batch, PoolCommitment};
use crate::types::Atto;

/// `2^ceil(depth/2)` — MerklePaymentLib.expectedRewardPools.
pub fn expected_reward_pools(depth: u8) -> usize {
    1usize << (depth as usize).div_ceil(2)
}

/// Reference `median16`: the element at sorted index 8 (9th smallest).
///
/// The Solidity `median16` quickselect (MerklePaymentLib.sol lines 65-100,
/// `k = 8`) terminates with `a[k]` in its sorted position, so a full sort
/// and index 8 yields the same VALUE. `median16_contract_port` below is a
/// literal port of the Solidity body; the tests cross-check the two on
/// adversarial inputs so the equivalence claim is tested, not asserted.
pub fn median16(values: &[Atto; CANDIDATES_PER_POOL]) -> Atto {
    let mut v = *values;
    v.sort();
    v[8]
}

/// Literal port of the Solidity quickselect body (for cross-checks only;
/// `median16` is the production path).
pub fn median16_contract_port(values: &mut [Atto; CANDIDATES_PER_POOL]) -> Atto {
    let a = values;
    let mut left: usize = 0;
    let mut right: usize = 15;
    let k: usize = 8;
    loop {
        let pivot = a[(left + right) >> 1];
        let mut i = left;
        let mut j = right;
        while i <= j {
            while a[i] < pivot {
                i += 1;
            }
            while pivot < a[j] {
                j -= 1;
            }
            if i <= j {
                a.swap(i, j);
                i += 1;
                if j == 0 {
                    // Solidity `unchecked { j-- }` on j==0 wraps to 2^256;
                    // with k<=j guards below it exits. Mirror as break-out.
                    j = usize::MAX;
                    break;
                }
                j -= 1;
            }
        }
        if k <= j {
            right = j;
        } else if i <= k {
            left = i;
        } else {
            return a[k];
        }
    }
}

/// Charge for one pool at `depth`: `median16(pool) << depth`, overflow-checked.
pub fn charge_for_pool(depth: u8, pool: &PoolCommitment) -> Result<Atto> {
    let amounts: [Atto; CANDIDATES_PER_POOL] = core::array::from_fn(|i| pool.candidates[i].amount);
    let m = median16(&amounts);
    m.checked_shl(depth as u32).ok_or_else(|| {
        Error::field(
            "amount",
            format!("median16={} << depth={} overflows u256", m, depth),
        )
    })
}

/// The plan-time WORST-CASE charge for a batch: max over its own pools.
/// This — never the sum of candidates — is the lawful batch ceiling.
pub fn batch_worst_case_charge(batch: &Batch) -> Result<Atto> {
    let mut max: Option<Atto> = None;
    for pool in &batch.commitments {
        let c = charge_for_pool(batch.depth, pool)?;
        max = Some(match max {
            None => c,
            Some(m) if c > m => c,
            Some(m) => m,
        });
    }
    max.ok_or_else(|| Error::field("commitments", "batch has no commitments"))
}

/// Sum of ALL candidate amounts across a batch. Exposed ONLY so callers and
/// tests can demonstrate it is NOT a bound (see module docs); production
/// code must not use it as a ceiling.
pub fn batch_sum_candidates(batch: &Batch) -> Result<Atto> {
    let mut sum = Atto::ZERO;
    for pool in &batch.commitments {
        for c in &pool.candidates {
            sum = sum.checked_add(c.amount).ok_or_else(|| {
                Error::field("amount", "sum of candidate amounts overflows u256")
            })?;
        }
    }
    Ok(sum)
}

/// Depth bounds check shared by plan and calldata validation.
pub fn check_depth(depth: u8) -> Result<()> {
    if !(MIN_MERKLE_DEPTH..=MAX_MERKLE_DEPTH).contains(&depth) {
        return Err(Error::field(
            "depth",
            format!(
                "depth {depth} outside contract bounds [{MIN_MERKLE_DEPTH},{MAX_MERKLE_DEPTH}] \
                 (PaymentVaultV2.sol MAX_MERKLE_DEPTH; depth 0 reverts — totalAmount/depth)"
            ),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use primitive_types::U256;

    fn at(i: u64) -> Atto {
        Atto::from_u64(i)
    }

    fn arr(v: [u64; 16]) -> [Atto; 16] {
        core::array::from_fn(|i| at(v[i]))
    }

    #[test]
    fn expected_pool_counts() {
        // 2^ceil(depth/2) — MerklePaymentLib.expectedRewardPools.
        assert_eq!(expected_reward_pools(1), 2);
        assert_eq!(expected_reward_pools(2), 2);
        assert_eq!(expected_reward_pools(3), 4);
        assert_eq!(expected_reward_pools(12), 64);
    }

    #[test]
    fn median_is_upper_median_index_8() {
        // 1..=16 sorted: index 8 (0-based) = 9.
        let mut v = arr(core::array::from_fn(|i| (i + 1) as u64));
        assert_eq!(median16(&v), at(9));
        v.reverse();
        assert_eq!(median16(&v), at(9));
        // all ones -> 1
        assert_eq!(median16(&arr([1; 16])), at(1));
        // duplicates straddling the median
        assert_eq!(median16(&arr([5, 5, 5, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 7, 7])), at(7));
        assert_eq!(median16(&arr([0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 9])), at(2));
    }

    #[test]
    fn median_contract_port_matches_reference_on_adversarial_inputs() {
        let cases: Vec<[u64; 16]> = vec![
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
            [7; 16],
            [1; 16],
            [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
            [9, 0, 5, 5, 5, 1, 2, 100, 4, 4, 4, 4, 4, 3, 3, 3],
            [u64::MAX; 8].iter().copied().chain([1; 8]).collect::<Vec<_>>().try_into().unwrap(),
        ];
        for case in cases {
            let mut port_input = arr(case);
            let reference = median16(&arr(case));
            let ported = median16_contract_port(&mut port_input);
            assert_eq!(reference, ported, "case {case:?}: reference {reference} vs port {ported}");
        }
    }

    #[test]
    fn charge_and_overflow() {
        let pool = PoolCommitment {
            pool_hash: crate::types::Hex32([1; 32]),
            candidates: core::array::from_fn(|i| crate::plan_model::Candidate {
                rewards_address: crate::types::EthAddr([i as u8; 20]),
                amount: at((i + 1) as u64),
            }),
        };
        // median16 = 9; depth 2 -> 36.
        assert_eq!(charge_for_pool(2, &pool).unwrap(), at(36));
        // median 2^255 << 12 overflows -> refused with field `amount`.
        let mut big = pool.clone();
        for (i, c) in big.candidates.iter_mut().enumerate() {
            c.amount = Atto(U256::one() << 255);
            let _ = i;
        }
        assert!(charge_for_pool(12, &big).is_err());
    }
}
