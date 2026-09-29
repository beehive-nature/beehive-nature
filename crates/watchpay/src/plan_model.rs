//! The versioned, bounded, Merkle-only plan envelope (`watch-pay-plan/1`).
//!
//! STRUCTURAL PRIVACY LAW: every struct below is
//! `#[serde(deny_unknown_fields)]`. The envelope carries PUBLIC payment
//! inputs ONLY — DataMaps, decryption capabilities, chunk bodies, and any
//! private-retrieval material have no field to live in and cannot be added
//! without changing this crate (which changes the schema string). The
//! `data_map_address` is the PUBLIC address of an already-public upload —
//! a reference, not a capability.
//!
//! ARM LAW: this slice is Merkle-only. `arm` must be `"merkle"`. A `wave`
//! arm is REFUSED here (wave/payForQuotes would be its own reviewed slice;
//! evmlib's prepare can still return a wave batch even when merkle was
//! requested — the caller must re-plan, never silently switch arms).

use crate::types::{Atto, EthAddr, Hex32};
use serde::{Deserialize, Serialize};

pub const SCHEMA: &str = "watch-pay-plan/1";
pub const ARM_MERKLE: &str = "merkle";
pub const VISIBILITY_PUBLIC: &str = "public";

/// Maximum job_id length (the app generates it; immutable once in a plan).
pub const MAX_JOB_ID_LEN: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NetworkBinding {
    /// EIP-155 chain id the payment is bound to (e.g. 42161 Arbitrum One).
    pub chain_id: u64,
    /// Advisory display hint only. NEVER used for validation or sending —
    /// the authoritative addresses are the two fields below.
    pub rpc_hint: String,
    /// ERC-20 payment token (ANT on the referenced networks).
    pub payment_token: EthAddr,
    /// The PaymentVaultV2-shaped vault.
    pub payment_vault: EthAddr,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct UploadBinding {
    /// Must be `"public"` — this slice pays for public uploads only.
    pub visibility: String,
    /// The PUBLIC address (32 bytes) of the uploaded data map. A public
    /// reference only: nothing here can decrypt or fetch private material.
    pub data_map_address: Hex32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Candidate {
    pub rewards_address: EthAddr,
    /// Node's quoted price in atto payment-token units.
    pub amount: Atto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PoolCommitment {
    /// Commitment to the full candidate pool (the plan treats it as opaque).
    pub pool_hash: Hex32,
    /// Exactly 16 candidates — the contract's fixed `CANDIDATES_PER_POOL`.
    pub candidates: [Candidate; crate::abi::CANDIDATES_PER_POOL],
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Batch {
    /// 0-based, contiguous, ascending across the plan.
    pub batch_index: u32,
    /// 1..=12 (contract MAX_MERKLE_DEPTH; see `abi::MAX_MERKLE_DEPTH` note).
    pub depth: u8,
    /// The timestamp all candidate nodes signed their quotes under.
    pub merkle_payment_timestamp: u64,
    /// Exactly `2^ceil(depth/2)` pools (MerklePaymentLib.expectedRewardPools).
    pub commitments: Vec<PoolCommitment>,
    /// DECLARED per-batch charge ceiling. The validator RE-DERIVES it as
    /// `max over pools of median16(pool) << depth` and refuses a mismatch —
    /// a sum-of-candidates figure is NOT a bound (see `pricing` docs and the
    /// depth-12 counterexample tests).
    pub batch_amount_ceiling: Atto,
    /// DECLARED per-batch identity; re-derived by `canonical::batch_id`.
    pub batch_id: Hex32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct GasCeilings {
    /// Per-transaction gas limit the payer accepts (>= 21_000).
    pub per_tx_gas_limit: u64,
    /// Declared cumulative gas ceiling; the validator requires it to cover
    /// `per_tx_gas_limit * planned_tx_count` (batches + one approval).
    pub max_total_gas: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NativeFeeCeilings {
    /// Worst-case fee-per-gas (wei). For EIP-1559 this is maxFeePerGas;
    /// for legacy this is gasPrice. Gas UNITS are not a native fee cap —
    /// this field is. Bounded to u64 (≈18.4 ETH per gas unit) — far beyond
    /// any lawful fee; larger values are out of policy and refused.
    pub per_tx_max_fee_per_gas_wei: u64,
    /// EIP-1559 maxPriorityFeePerGas (wei); 0 for legacy. Must be <=
    /// `per_tx_max_fee_per_gas_wei`.
    pub per_tx_max_priority_fee_wei: u64,
    /// Declared cumulative worst-case NATIVE fee. The validator derives
    /// `per_tx_gas_limit * per_tx_max_fee_per_gas_wei * planned_tx_count`
    /// and refuses a declared total that cannot cover it.
    pub max_total_native_fee_wei: Atto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub schema: String,
    /// App-generated, immutable, filesystem-safe job identifier.
    pub job_id: String,
    pub created_unix: u64,
    /// <= created_unix + MERKLE_PAYMENT_EXPIRATION_SECS; expired plans are
    /// refused everywhere.
    pub expires_unix: u64,
    pub network: NetworkBinding,
    /// REQUIRED and bound: `payForMerkleTree` pulls funds from `msg.sender`
    /// (PaymentVaultV2.sol `antToken.safeTransferFrom(msg.sender, ...)`), so
    /// a plan is payer-bound by construction.
    pub expected_payer: EthAddr,
    pub upload: UploadBinding,
    /// Must be `"merkle"` — wave is rejected in this slice.
    pub arm: String,
    /// Non-empty, ordered.
    pub batches: Vec<Batch>,
    /// The ONLY amount the payer may ever approve to the vault for this
    /// plan = sum of batch ceilings. Derivation is re-checked; it must
    /// NEVER be 2^256-1 (the E7 law — evmlib v0.9.1's own helper returns
    /// `Amount::MAX` there, which this module refuses by design).
    pub approve_ceiling_total: Atto,
    pub gas_ceilings: GasCeilings,
    pub native_fee_ceilings: NativeFeeCeilings,
    /// keccak256 over the canonical serialization of everything above
    /// (see `canonical::plan_hash`). Tampering with any field breaks it.
    pub plan_hash: Hex32,
}
