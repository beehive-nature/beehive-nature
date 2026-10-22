//! Hiding repository receipt-chain proof, a PRIVATE acceptance consumer.
//! It does not put Git, SHA-256 or ML-DSA execution inside the AIR. Authorized
//! replicas MUST run the existing full acceptance contract and recompute this
//! exact transcript root before using the proof to advance any checkpoint.
pub mod air;
pub mod model;
pub mod trace;
use crate::{
    config::{self, HidingConfig, Params},
    security::{Figure, figure_for_air},
    statement::{Digest, F},
};
use air::RepositoryAir;
use model::{BLOCKS, Hash, Record};
use p3_field::PrimeCharacteristicRing;
use p3_uni_stark::{
    PreprocessedProverData, PreprocessedVerifierKey, Proof, prove_with_preprocessed,
    setup_preprocessed, verify_with_preprocessed,
};
pub const PROFILE: &str = "bnr.repository-hiding-stark/1";
pub const PARAMS: Params = Params {
    log_blowup: 3,
    num_queries: 128,
    query_pow_bits: 16,
};
pub const TARGET_BITS: usize = 100;
pub struct Setup {
    pub air: RepositoryAir,
    pp: PreprocessedProverData<HidingConfig>,
    vk: PreprocessedVerifierKey<HidingConfig>,
    cfg: HidingConfig,
}
pub fn label(bucket: usize) -> Vec<u8> {
    format!("bnr/repository/private-receipt-chain/v1/{bucket}/18x16-bit/p128-b3-pow16").into_bytes()
}
pub fn setup(bucket: usize) -> Result<Setup, String> {
    if ![8, 16, 32, 64].contains(&bucket) {
        return Err("bucket".into());
    }
    let height = (3 + BLOCKS * bucket + 1)
        .max(2 * (PARAMS.num_queries + 12) + 1)
        .next_power_of_two();
    let air = RepositoryAir::new(bucket, height);
    // Only the PUBLIC schedule commitment is reproducible. Secret main-trace
    // blinding and MMCS salts always use a separate OS-random config.
    let public_cfg = config::public_preprocessing(PARAMS, label(bucket));
    let (pp, vk) = setup_preprocessed(&public_cfg, &air, height.trailing_zeros() as usize)
        .map_err(|_| "public preprocessing")?
        .ok_or("missing public schedule")?;
    let cfg = config::hiding_labeled(PARAMS, label(bucket));
    let s = Setup { air, pp, vk, cfg };
    if s.security().proven < TARGET_BITS {
        return Err("security figure below pinned target".into());
    }
    Ok(s)
}
impl Setup {
    pub fn security(&self) -> Figure {
        figure_for_air(&self.air, self.air.height, PARAMS)
    }
    pub fn public(context: &Hash, root: &Digest) -> Vec<F> {
        context
            .iter()
            .map(|&x| F::from_u16(x))
            .chain(root.iter().copied())
            .collect()
    }
    pub fn prove(&self, context: &Hash, records: &[Record]) -> Result<(Digest, Vec<u8>), String> {
        model::validate(records)?;
        if records.len() != self.air.bucket {
            return Err("bucket mismatch".into());
        }
        let root = model::root(context, records);
        let trace = trace::generate(&self.air, context, records);
        let proof = prove_with_preprocessed(
            &self.cfg,
            &self.air,
            trace,
            &Self::public(context, &root),
            Some(&self.pp),
        )
        .map_err(|_| "cannot prove receipt chain")?;
        let bytes = postcard::to_allocvec(&proof).map_err(|_| "proof encoding")?;
        Ok((root, bytes))
    }
    pub fn verify(&self, context: &Hash, root: &Digest, bytes: &[u8]) -> Result<(), String> {
        if bytes.len() > 4 * 1024 * 1024 {
            return Err("proof limit".into());
        }
        let (proof, rest): (Proof<HidingConfig>, _) =
            postcard::take_from_bytes(bytes).map_err(|_| "proof encoding")?;
        if !rest.is_empty() {
            return Err("trailing proof bytes".into());
        }
        verify_with_preprocessed(
            &self.cfg,
            &self.air,
            &proof,
            &Self::public(context, root),
            Some(&self.vk),
        )
        .map_err(|_| "proof refused".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn records() -> Vec<Record> {
        (0..8)
            .map(|i| {
                let active = i < 2;
                let before = i.min(2) as u64;
                Record {
                    previous: [(before + 1) as u16; 16],
                    next: [(before + 1 + active as u64) as u16; 16],
                    proposal: if active { [11 + i as u16; 16] } else { [0; 16] },
                    policy: [4; 16],
                    manifest: if active { [20; 16] } else { [0; 16] },
                    qualification: if active { [21; 16] } else { [0; 16] },
                    salt: [30 + i as u16; 16],
                    scope: [5; 16],
                    before,
                    after: before + active as u64,
                    active,
                }
            })
            .collect()
    }
    #[test]
    fn repository_hiding_proof_survives_a_fresh_verifier_and_refuses_public_mutations() {
        let s = setup(8).unwrap();
        let context = [9; 16];
        let rs = records();
        let (root, proof) = s.prove(&context, &rs).unwrap();
        let other = setup(8).unwrap();
        other.verify(&context, &root, &proof).unwrap();
        let mut bad = context;
        bad[0] ^= 1;
        assert!(other.verify(&bad, &root, &proof).is_err());
        let mut bad = root;
        bad[0] += F::ONE;
        assert!(other.verify(&context, &bad, &proof).is_err());
        let mut bad = proof.clone();
        bad.push(0);
        assert!(other.verify(&context, &root, &bad).is_err());
        let mut bad = proof.clone();
        let at = bad.len() / 2;
        bad[at] ^= 1;
        assert!(other.verify(&context, &root, &bad).is_err());
        assert!(setup(16).unwrap().verify(&context, &root, &proof).is_err());
        let (_, second) = s.prove(&context, &rs).unwrap();
        assert_ne!(proof, second, "private main-trace blinding must be fresh");
        println!(
            "repository STARK bucket8: proof_bytes={} proven_bits={} conjectured_bits={}",
            proof.len(),
            s.security().proven,
            s.security().conjectured
        );
    }
    #[test]
    fn repository_air_refuses_bad_private_chains_without_trusting_the_host_model() {
        let s = setup(8).unwrap();
        let context = [9; 16];
        let mut mutations = Vec::new();
        let mut rs = records();
        rs[1].previous[0] ^= 1;
        mutations.push(("state gap", rs));
        let mut rs = records();
        rs[1].before += 1;
        rs[1].after += 1;
        mutations.push(("sequence gap", rs));
        let mut rs = records();
        rs[1].policy[0] ^= 1;
        mutations.push(("policy substitution", rs));
        let mut rs = records();
        rs[3].active = true;
        rs[3].after += 1;
        mutations.push(("padding hole", rs));
        let mut rs = records();
        rs[2].proposal[0] = 1;
        mutations.push(("non-neutral pad", rs));
        let mut rs = records();
        rs[0].before = u64::MAX;
        rs[0].after = 0;
        mutations.push(("sequence overflow", rs));
        let mut rs = records();
        rs[0].active = false;
        rs[0].next = rs[0].previous;
        rs[0].after = rs[0].before;
        mutations.push(("empty first slot", rs));
        for (name, rs) in mutations {
            // Bypass model::validate: only AIR constraints can refuse these.
            let trace = trace::generate(&s.air, &context, &rs);
            let root = model::root(&context, &rs);
            let public = Setup::public(&context, &root);
            let attempt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                prove_with_preprocessed(&s.cfg, &s.air, trace, &public, Some(&s.pp))
            }));
            let accepted = attempt.ok().and_then(Result::ok).is_some_and(|p| {
                verify_with_preprocessed(&s.cfg, &s.air, &p, &public, Some(&s.vk)).is_ok()
            });
            assert!(!accepted, "accepted {name}");
        }
    }
    #[test]
    fn repository_security_target_covers_every_supported_bucket() {
        for bucket in [8, 16, 32, 64] {
            let s = setup(bucket).unwrap();
            assert!(s.security().proven >= TARGET_BITS);
            let mut rs = records();
            rs.resize(bucket, rs.last().unwrap().clone());
            let started = std::time::Instant::now();
            let (root, bytes) = s.prove(&[9; 16], &rs).unwrap();
            let prove_ms = started.elapsed().as_millis();
            let started = std::time::Instant::now();
            s.verify(&[9; 16], &root, &bytes).unwrap();
            println!(
                "repository bucket={bucket} proof_bytes={} prove_ms={prove_ms} verify_us={} proven_bits={} conjectured_bits={}",
                bytes.len(),
                started.elapsed().as_micros(),
                s.security().proven,
                s.security().conjectured
            );
        }
    }
}
