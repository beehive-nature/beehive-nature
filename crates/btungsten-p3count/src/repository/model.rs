//! Repository-specific private transcript. Full acceptance/ML-DSA verification
//! stays in contract.mjs::acceptUpdate; this relation proves its BOUND RECEIPTS
//! form a contiguous chain. It never treats a claimed accepted bit as authority.
use crate::statement::{Digest, F, Hasher, node_input};
use p3_field::PrimeCharacteristicRing;

pub const BLOCKS: usize = 18;
pub const DOMAIN: u32 = 0x5250;
pub const VERSION: u32 = 1;
pub type Hash = [u16; 16];
#[derive(Clone, Debug)]
pub struct Record {
    pub previous: Hash,
    pub next: Hash,
    pub proposal: Hash,
    pub policy: Hash,
    pub manifest: Hash,
    pub qualification: Hash,
    pub salt: Hash,
    pub scope: Hash,
    pub before: u64,
    pub after: u64,
    pub active: bool,
}
pub fn sequence(n: u64) -> [F; 4] {
    core::array::from_fn(|k| F::from_u16((n >> (16 * k)) as u16))
}
impl Record {
    pub fn blocks(&self, index: usize) -> Vec<[F; 8]> {
        let mut data = Vec::with_capacity(BLOCKS * 8);
        for h in [
            &self.previous,
            &self.next,
            &self.proposal,
            &self.policy,
            &self.manifest,
            &self.qualification,
            &self.salt,
            &self.scope,
        ] {
            data.extend(h.iter().map(|&x| F::from_u16(x)));
        }
        data.extend(sequence(self.before));
        data.extend(sequence(self.after));
        data.extend([
            F::from_bool(self.active),
            F::from_usize(index),
            F::from_u32(DOMAIN),
            F::ZERO,
            F::ZERO,
            F::ZERO,
            F::ZERO,
            F::ZERO,
        ]);
        data.chunks_exact(8)
            .map(|c| c.try_into().unwrap())
            .collect()
    }
}
pub fn prelude(context: &Hash, bucket: usize) -> [[F; 8]; 3] {
    [
        core::array::from_fn(|k| F::from_u16(context[k])),
        core::array::from_fn(|k| F::from_u16(context[8 + k])),
        [
            F::from_u32(DOMAIN),
            F::from_u32(VERSION),
            F::from_usize(bucket),
            F::ZERO,
            F::ZERO,
            F::ZERO,
            F::ZERO,
            F::ZERO,
        ],
    ]
}
pub fn root(context: &Hash, records: &[Record]) -> Digest {
    let h = Hasher::default();
    let mut acc = [F::ZERO; 8];
    for chunk in prelude(context, records.len())
        .into_iter()
        .chain(records.iter().enumerate().flat_map(|(i, r)| r.blocks(i)))
    {
        acc = h.compress(node_input(&acc, &chunk));
    }
    acc
}
pub fn validate(records: &[Record]) -> Result<(), String> {
    let n = records.len();
    if ![8, 16, 32, 64].contains(&n) {
        return Err("bucket must be 8,16,32 or 64".into());
    }
    if !records[0].active {
        return Err("empty batch".into());
    }
    for (i, r) in records.iter().enumerate() {
        if r.policy != records[0].policy || r.scope != records[0].scope {
            return Err("scope/policy changed".into());
        }
        if r.before.checked_add(r.active as u64) != Some(r.after) {
            return Err("sequence transition".into());
        }
        if !r.active
            && (r.previous != r.next
                || r.proposal != [0; 16]
                || r.manifest != [0; 16]
                || r.qualification != [0; 16])
        {
            return Err("non-neutral pad".into());
        }
        if i > 0 {
            let p = &records[i - 1];
            if r.previous != p.next || r.before != p.after || (!p.active && r.active) {
                return Err("noncontiguous chain".into());
            }
        }
    }
    Ok(())
}
