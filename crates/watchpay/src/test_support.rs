//! Shared synthetic fixtures for unit AND integration tests (doc-hidden;
//! not part of the stable API). Everything here is PUBLIC, synthetic data
//! constructed in code — no network, no chain, no secrets.

use crate::plan_model::*;
use crate::types::{Atto, EthAddr, Hex32};

pub const SYNTH_VAULT_HEX: &str = "0x00000000000000000000000000000000000000b2";
pub const SYNTH_TOKEN_HEX: &str = "0x00000000000000000000000000000000000000a1";
pub const SYNTH_PAYER_HEX: &str = "0x00000000000000000000000000000000000000c3";
pub const SYNTH_VAULT_ADDR: EthAddr = EthAddr([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xb2,
]);
pub const SYNTH_TOKEN_ADDR: EthAddr = EthAddr([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xa1,
]);
pub const SYNTH_PAYER_ADDR: EthAddr = EthAddr([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xc3,
]);

/// Fixed "now" for deterministic tests: 2026-09-13T02:31:12Z-ish synthetic.
pub const SYNTH_NOW: u64 = 1_757_718_000;
/// Payment timestamp used by the base batch: SYNTH_NOW - 600.
pub const SYNTH_TS: u64 = SYNTH_NOW - 600;

pub fn synth_addr(id: u16) -> EthAddr {
    let mut a = [0u8; 20];
    a[18] = (id >> 8) as u8;
    a[19] = (id & 0xff) as u8;
    EthAddr(a)
}

pub fn synth_hash(prefix: u8) -> Hex32 {
    let mut h = [0u8; 32];
    h[0] = prefix;
    Hex32(h)
}

/// Pool with byte-tagged rewards addresses and given amounts (atto).
pub fn pool(tag: u8, amounts: [u64; 16]) -> PoolCommitment {
    PoolCommitment {
        pool_hash: synth_hash(tag),
        candidates: core::array::from_fn(|j| Candidate {
            rewards_address: synth_addr(tag as u16 * 16 + j as u16),
            amount: Atto::from_u64(amounts[j]),
        }),
    }
}

pub fn amounts_1_to_16() -> [u64; 16] {
    core::array::from_fn(|i| (i + 1) as u64)
}

/// Depth-2 batch with 2 pools: pool1 = 1..=16 (median 9, charge 36),
/// pool2 = all 1s (median 1, charge 4). Derived ceiling = 36.
pub fn base_batch() -> Batch {
    let mut b = Batch {
        batch_index: 0,
        depth: 2,
        merkle_payment_timestamp: SYNTH_TS,
        commitments: vec![pool(1, amounts_1_to_16()), pool(2, [1; 16])],
        batch_amount_ceiling: Atto::from_u64(36),
        batch_id: Hex32::ZERO,
    };
    b.batch_id = crate::canonical::batch_id(42161, &SYNTH_VAULT_ADDR, &b);
    b
}

/// The depth-12 counterexample batch: 64 pools, every candidate amount 1.
/// Sum of all candidates = 64*16 = 1024; every pool's charge = 1<<12 = 4096.
pub fn depth12_counterexample_batch() -> Batch {
    let mut b = Batch {
        batch_index: 0,
        depth: 12,
        merkle_payment_timestamp: SYNTH_TS,
        commitments: (1..=64).map(|i| pool(i as u8, [1; 16])).collect(),
        batch_amount_ceiling: Atto::from_u64(4096),
        batch_id: Hex32::ZERO,
    };
    b.batch_id = crate::canonical::batch_id(42161, &SYNTH_VAULT_ADDR, &b);
    b
}

pub fn base_plan() -> Plan {
    let b = base_batch();
    let mut plan = Plan {
        schema: SCHEMA.to_string(),
        job_id: "synthetic-job-001".to_string(),
        created_unix: SYNTH_NOW - 900,
        expires_unix: SYNTH_NOW - 900 + 604_800,
        network: NetworkBinding {
            chain_id: 42161,
            rpc_hint: "advisory-only".to_string(),
            payment_token: SYNTH_TOKEN_ADDR,
            payment_vault: SYNTH_VAULT_ADDR,
        },
        expected_payer: SYNTH_PAYER_ADDR,
        upload: UploadBinding {
            visibility: VISIBILITY_PUBLIC.to_string(),
            data_map_address: synth_hash(0xEE),
        },
        arm: ARM_MERKLE.to_string(),
        approve_ceiling_total: b.batch_amount_ceiling,
        gas_ceilings: GasCeilings {
            per_tx_gas_limit: 500_000,
            max_total_gas: 1_500_000, // 2 txs (approve + batch) * 500k + headroom
        },
        native_fee_ceilings: NativeFeeCeilings {
            per_tx_max_fee_per_gas_wei: 100_000_000_000, // 100 gwei
            per_tx_max_priority_fee_wei: 1_000_000_000,  // 1 gwei
            max_total_native_fee_wei: Atto::from_u64(150_000_000_000_000_000),
        },
        batches: vec![b],
        plan_hash: Hex32::ZERO,
    };
    plan.approve_ceiling_total = plan.batches.iter().map(|b| b.batch_amount_ceiling).fold(
        Atto::ZERO,
        |acc, x| acc.checked_add(x).unwrap(),
    );
    plan.gas_ceilings.max_total_gas = plan.gas_ceilings.per_tx_gas_limit * 2;
    plan.native_fee_ceilings.max_total_native_fee_wei = Atto::from_u64(
        plan.gas_ceilings.per_tx_gas_limit
            * plan.native_fee_ceilings.per_tx_max_fee_per_gas_wei
            * 2,
    );
    plan.plan_hash = crate::canonical::plan_hash(&plan);
    plan
}

/// Mutation helpers for hash-sensitivity / tamper tests. Each returns a
/// copy of `p` with ONE field changed. plan_hash is NOT recomputed — the
/// caller decides whether the variant is meant to be valid (recompute) or
/// tampered (leave stale).
pub type PlanMutation = Box<dyn Fn(&Plan) -> Plan>;

pub fn plan_variants(_p: &Plan) -> Vec<(&'static str, PlanMutation)> {
    vec![
        ("job_id", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.job_id = "other".into();
            x
        })),
        ("created_unix", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.created_unix += 1;
            x
        })),
        ("expires_unix", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.expires_unix += 1;
            x
        })),
        ("chain_id", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.network.chain_id = 421614;
            x
        })),
        ("payment_vault", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.network.payment_vault = synth_addr(9);
            x
        })),
        ("expected_payer", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.expected_payer = synth_addr(8);
            x
        })),
        ("data_map_address", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.upload.data_map_address = synth_hash(0xDD);
            x
        })),
        ("arm", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.arm = "wave".into();
            x
        })),
        ("candidate_amount", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.batches[0].commitments[0].candidates[0].amount =
                Atto::from_u64(999);
            x
        })),
        ("batch_timestamp", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.batches[0].merkle_payment_timestamp += 1;
            x
        })),
        ("approve_ceiling_total", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.approve_ceiling_total = Atto::from_u64(1);
            x
        })),
        ("gas", Box::new(|p: &Plan| {
            let mut x = p.clone();
            x.gas_ceilings.per_tx_gas_limit += 1;
            x
        })),
    ]
}
