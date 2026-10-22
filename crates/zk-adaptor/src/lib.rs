//! zkAdaptor — proof shapes behind one trait, scored, never trusted.
//!
//! Native plane (ours): Schnorr (BIP-340, bzDiD-bound) and ML-DSA-65
//! (PQ, via bsigner::pq — borrowed crypto, never reimplemented).
//! Interop seam: foreign shapes (SNARK/STARK/Groth16) arrive as
//! Poseidon-committed statements; the adaptor verifies what it can
//! and anchors verdicts — it does not implement foreign provers.
//!
//! Every shape reports the estate scoreboard: proof bytes on the
//! wire, verifier cost (relative units until Vaulta VM CPU/NET is
//! measured on testnet), prover time, setup class, PQ resistance.

use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use std::time::Instant;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Setup {
    None,
    Universal,
    Trusted,
    Transparent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreRow {
    pub shape: String,
    pub proof_bytes: usize,
    /// Verify wall time in microseconds (operator-side proxy for
    /// verifier CPU until Vaulta testnet CPU/NET is measured).
    pub verify_us: u128,
    pub prove_us: u128,
    pub setup: Setup,
    pub pq_resistant: bool,
}

/// A proof shape: prove a statement (bytes) under a key, verify it.
/// Statements here are receipt-chain commitments (SHA3-256 digests).
pub trait ProofShape {
    fn name(&self) -> &'static str;
    fn setup(&self) -> Setup;
    fn pq_resistant(&self) -> bool;
    fn prove(&mut self, statement: &[u8]) -> Result<Vec<u8>, String>;
    fn verify(&self, statement: &[u8], proof: &[u8]) -> Result<bool, String>;
    fn score(&mut self, statement: &[u8]) -> Result<ScoreRow, String> {
        let t0 = Instant::now();
        let proof = self.prove(statement)?;
        let prove_us = t0.elapsed().as_micros();
        let t1 = Instant::now();
        let ok = self.verify(statement, &proof)?;
        let verify_us = t1.elapsed().as_micros();
        if !ok {
            return Err(format!("{} failed self-verify", self.name()));
        }
        Ok(ScoreRow {
            shape: self.name().to_string(),
            proof_bytes: proof.len(),
            verify_us,
            prove_us,
            setup: self.setup(),
            pq_resistant: self.pq_resistant(),
        })
    }
}

/// Shape 1 (native): BIP-340 Schnorr over SHA3-256(statement),
/// bzDiD-style: the verifying key IS the identity commitment.
pub struct SchnorrShape {
    sign: Option<k256::schnorr::SigningKey>,
    verify_key: k256::schnorr::VerifyingKey,
}

impl SchnorrShape {
    pub fn generate() -> Self {
        let mut secret = [0u8; 32];
        getrandom::getrandom(&mut secret).expect("os rng");
        let sign = k256::schnorr::SigningKey::from_bytes(&secret)
            .expect("32-byte secret is a valid schnorr key");
        let verify_key = *sign.verifying_key();
        SchnorrShape {
            sign: Some(sign),
            verify_key,
        }
    }
    pub fn verifier(verify_key: k256::schnorr::VerifyingKey) -> Self {
        SchnorrShape {
            sign: None,
            verify_key,
        }
    }
    pub fn verifying_key(&self) -> k256::schnorr::VerifyingKey {
        self.verify_key
    }
}

impl ProofShape for SchnorrShape {
    fn name(&self) -> &'static str {
        "schnorr-bip340"
    }
    fn setup(&self) -> Setup {
        Setup::None
    }
    fn pq_resistant(&self) -> bool {
        false
    }
    fn prove(&mut self, statement: &[u8]) -> Result<Vec<u8>, String> {
        use k256::schnorr::signature::Signer;
        let sign = self.sign.as_ref().ok_or("verifier-only shape")?;
        let digest = Sha3_256::digest(statement);
        let sig: k256::schnorr::Signature = sign.sign(&digest);
        Ok(sig.to_bytes().to_vec())
    }
    fn verify(&self, statement: &[u8], proof: &[u8]) -> Result<bool, String> {
        use k256::schnorr::signature::Verifier;
        let digest = Sha3_256::digest(statement);
        let sig = k256::schnorr::Signature::try_from(proof).map_err(|e| e.to_string())?;
        Ok(self.verify_key.verify(&digest, &sig).is_ok())
    }
}

/// Shape 2 (native, PQ): ML-DSA-65 via bsigner::pq (FIPS 204).
pub struct MlDsaShape {
    seed: Option<[u8; 32]>,
    public: Vec<u8>,
}

impl MlDsaShape {
    pub fn generate() -> Result<Self, String> {
        let g = bsigner::pq::dsa_generate(bsigner::alg::SigAlg::MlDsa65);
        Ok(MlDsaShape {
            seed: Some(g.seed),
            public: g.verifying_key,
        })
    }
    pub fn verifier(public: Vec<u8>) -> Self {
        MlDsaShape {
            seed: None,
            public,
        }
    }
}

impl ProofShape for MlDsaShape {
    fn name(&self) -> &'static str {
        "ml-dsa-65"
    }
    fn setup(&self) -> Setup {
        Setup::None
    }
    fn pq_resistant(&self) -> bool {
        true
    }
    fn prove(&mut self, statement: &[u8]) -> Result<Vec<u8>, String> {
        let seed = self.seed.ok_or("verifier-only shape")?;
        bsigner::pq::dsa_sign(bsigner::alg::SigAlg::MlDsa65, &seed, statement)
    }
    fn verify(&self, statement: &[u8], proof: &[u8]) -> Result<bool, String> {
        bsigner::pq::dsa_verify(
            bsigner::alg::SigAlg::MlDsa65,
            &self.public,
            statement,
            proof,
        )
    }
}

/// Shape 3 (bTungsten evaluation-commitment): the prover runs the
/// GF(16) tower-field evaluation that `btungsten-qeval` synthesizes
/// as reversible circuits (Itoh-Tsujii inversion over the statement's
/// 16 nibble pairs) and commits to the transcript; the verifier
/// re-evaluates deterministically and compares the commitment.
///
/// HONEST BOUNDS: this is an evaluation commitment, NOT a signature
/// and NOT a ZK proof. There is no key and no identity binding;
/// security is exactly SHA3-256 binding plus byte-identical
/// re-evaluation, so verifier cost tracks prover cost. What the
/// bTungsten lane contributes is the measured tower-field evaluation
/// engine (gate counts on the bench) — the scoreboard shows the
/// trade instead of claiming it away. Authorization still comes
/// from the Schnorr/ML-DSA shapes; verdicts from this shape are
/// anchored (evanchor), never trusted alone.
pub struct BtungstenEvalShape {
    /// Circuit whose synthesis the evaluation follows.
    pub circuit_gates: usize,
    pub toffoli_gates: usize,
}

impl BtungstenEvalShape {
    pub fn new() -> Self {
        let circuit = btungsten_qeval::build_tower_bmp_circuit();
        let stats = btungsten_qeval::compute_circuit_stats(&circuit);
        BtungstenEvalShape {
            circuit_gates: stats.total_gates,
            toffoli_gates: stats.toffoli_count,
        }
    }

    fn transcript(statement: &[u8]) -> Vec<u8> {
        let digest = Sha3_256::digest(statement);
        let mut out = Vec::with_capacity(16);
        for i in 0..16 {
            let x = (digest[i] >> 4) & 0x0f;
            let y = digest[i] & 0x0f;
            let m = btungsten_qeval::gf_mul(x, y);
            // Itoh-Tsujii target operation: inversion in GF(16).
            out.push(btungsten_qeval::gf_inv(m));
        }
        out
    }

    fn commitment(&self, statement: &[u8]) -> Vec<u8> {
        let mut h = Sha3_256::new();
        h.update(statement);
        h.update(Self::transcript(statement));
        h.update((self.circuit_gates as u64).to_be_bytes());
        h.update((self.toffoli_gates as u64).to_be_bytes());
        h.finalize().to_vec()
    }
}

impl Default for BtungstenEvalShape {
    fn default() -> Self {
        Self::new()
    }
}

impl ProofShape for BtungstenEvalShape {
    fn name(&self) -> &'static str {
        "btungsten-gf16-eval"
    }
    fn setup(&self) -> Setup {
        Setup::None
    }
    fn pq_resistant(&self) -> bool {
        // No key to break; resistance is the hash's, stated as no.
        false
    }
    fn prove(&mut self, statement: &[u8]) -> Result<Vec<u8>, String> {
        // Validate the synthesized circuit stream once per proof, the
        // same gate the evaluator applies before any shot.
        let circuit = btungsten_qeval::build_tower_bmp_circuit();
        btungsten_qeval::validate_circuit_stream(&circuit).map_err(|e| format!("{e:?}"))?;
        Ok(self.commitment(statement))
    }
    fn verify(&self, statement: &[u8], proof: &[u8]) -> Result<bool, String> {
        Ok(proof == self.commitment(statement).as_slice())
    }
}

/// The receipt-chain statement: SHA3-256 over concatenated stage
/// hashes (input, output, chain), the B9 ordinal-0 statement.
pub fn receipt_statement(input_sha: &[u8], output_sha: &[u8], chain_sha: &[u8]) -> Vec<u8> {
    let mut h = Sha3_256::new();
    h.update(input_sha);
    h.update(output_sha);
    h.update(chain_sha);
    h.finalize().to_vec()
}
