//! Local experiment only. No wallet, RPC, real authorization or payment.
#![forbid(unsafe_code)]

use ark_bn254::{Bn254, Fr};
use ark_ff::PrimeField;
use ark_groth16::{prepare_verifying_key, Groth16, ProvingKey};
use ark_relations::{
    gr1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError, Variable},
    lc,
};
use groth16_convert::{arkworks, wire::public_inputs_flat, OnChainKey, OnChainProof};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub type Result<T> = std::result::Result<T, &'static str>;

/// All amounts are integer fixture units, not SOL, A, b, or an exchange rate.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Job {
    pub domain: String,
    pub job_id: String,
    pub authorization_id: String,
    pub nonce: u64,
    pub recipient: String,
    pub asset: String,
    pub amount: u64,
    pub fee_asset: String,
    pub fee: u64,
    pub input: u32,
}

/// Created by the local fixture owner, never deserialized from transport.
/// A production implementation must obtain this from authenticated bPay authority.
#[derive(Clone)]
pub struct LocalGrant {
    pub job: Job,
    pub max_amount: u64,
    pub max_fee: u64,
    pub expires_at: u64,
    pub allowed_rails: Vec<Rail>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Rail {
    SolanaDryRun,
    VaultaDryRun,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Packet {
    pub job: Job,
    pub output: u64,
    pub proof: Vec<u8>,
}

/// Fixed v1 struct serialization, domain-separated. Not a cross-language standard.
pub fn commitment(job: &Job) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(b"bnr-solana-tungsten/job/v1\0");
    hash.update(serde_json::to_vec(job).expect("fixed job serialization"));
    hash.finalize().into()
}

fn inputs(job: &Job, output: u64) -> [Fr; 4] {
    let digest = commitment(job);
    // Two 128-bit limbs preserve all 256 bits; no reduction of a full hash mod r.
    [
        Fr::from(job.input as u64),
        Fr::from(output),
        Fr::from_be_bytes_mod_order(&digest[..16]),
        Fr::from_be_bytes_mod_order(&digest[16..]),
    ]
}

#[derive(Clone)]
struct SquareJob {
    public: [Fr; 4],
}

impl ConstraintSynthesizer<Fr> for SquareJob {
    fn generate_constraints(
        self,
        cs: ConstraintSystemRef<Fr>,
    ) -> std::result::Result<(), SynthesisError> {
        let x = cs.new_input_variable(|| Ok(self.public[0]))?;
        let y = cs.new_input_variable(|| Ok(self.public[1]))?;
        cs.enforce_r1cs_constraint(|| lc!() + x, || lc!() + x, || lc!() + y)?;
        // Bind both context limbs into this proof via witness-copy constraints.
        // The host recomputes the digest from the trusted job. This circuit does
        // NOT authenticate grants or implement SHA256 inside the circuit.
        for value in &self.public[2..] {
            let public = cs.new_input_variable(|| Ok(*value))?;
            let copy = cs.new_witness_variable(|| Ok(*value))?;
            cs.enforce_r1cs_constraint(
                || lc!() + public,
                || lc!() + Variable::One,
                || lc!() + copy,
            )?;
        }
        Ok(())
    }
}

pub struct Worker {
    proving_key: ProvingKey<Bn254>,
}

impl Worker {
    /// Fresh single-party setup for this run, held in memory only. No ceremony claim.
    pub fn new() -> Self {
        let proving_key = Groth16::<Bn254>::generate_random_parameters_with_reduction(
            SquareJob {
                public: [Fr::from(0u64); 4],
            },
            &mut OsRng,
        )
        .expect("local setup");
        Self { proving_key }
    }

    pub fn key(&self) -> OnChainKey {
        arkworks::key(&self.proving_key.vk).expect("convert generated key")
    }

    pub fn prove(&self, job: Job) -> Packet {
        let output = u64::from(job.input) * u64::from(job.input);
        let proof = Groth16::<Bn254>::create_random_proof_with_reduction(
            SquareJob {
                public: inputs(&job, output),
            },
            &self.proving_key,
            &mut OsRng,
        )
        .expect("prove square job");
        Packet {
            job,
            output,
            proof: arkworks::proof(&proof).0.to_vec(),
        }
    }
}

impl Default for Worker {
    fn default() -> Self {
        Self::new()
    }
}

pub trait VerifyProof {
    fn name(&self) -> &'static str;
    fn key_hash(&self) -> [u8; 32];
    fn verify(&self, packet: &Packet) -> Result<()>;
}

pub struct SolanaHost {
    key: OnChainKey,
}
impl SolanaHost {
    pub fn new(key: OnChainKey) -> Result<Self> {
        key.validate_for_publish()
            .map_err(|_| "invalid verifying key")?;
        Ok(Self { key })
    }

    pub fn key_address(&self) -> String {
        let (address, _) = solana_groth16_verify::instruction::find_key_address(
            &solana_groth16_verify::instruction::ID,
            &self.key.hash(),
        );
        address.to_string()
    }
}
impl VerifyProof for SolanaHost {
    fn name(&self) -> &'static str {
        "solana-groth16-host"
    }
    fn key_hash(&self) -> [u8; 32] {
        self.key.hash()
    }
    fn verify(&self, packet: &Packet) -> Result<()> {
        let key = solana_groth16_verify::VerifyingKey::from_body(self.key.body())
            .map_err(|_| "invalid verifying key")?;
        let proof = solana_groth16_verify::Proof::from_bytes(&packet.proof)
            .map_err(|_| "invalid proof encoding")?;
        solana_groth16_verify::verify(
            &key,
            &proof,
            &public_inputs_flat(&inputs(&packet.job, packet.output)),
        )
        .map_err(|_| "proof rejected")
    }
}

/// A second real host verifier, explicitly NOT the Vaulta PLONK adapter.
pub struct ArkworksHost {
    key: OnChainKey,
}
impl ArkworksHost {
    pub fn new(key: OnChainKey) -> Result<Self> {
        key.validate_for_publish()
            .map_err(|_| "invalid verifying key")?;
        Ok(Self { key })
    }
}
impl VerifyProof for ArkworksHost {
    fn name(&self) -> &'static str {
        "arkworks-groth16-reference"
    }
    fn key_hash(&self) -> [u8; 32] {
        self.key.hash()
    }
    fn verify(&self, packet: &Packet) -> Result<()> {
        let wire = OnChainProof(
            packet
                .proof
                .as_slice()
                .try_into()
                .map_err(|_| "invalid proof encoding")?,
        );
        let proof = arkworks::proof_from_on_chain(&wire).map_err(|_| "invalid proof encoding")?;
        let vk = arkworks::key_from_on_chain(&self.key).map_err(|_| "invalid verifying key")?;
        match Groth16::<Bn254>::verify_proof(
            &prepare_verifying_key(&vk),
            &proof,
            &inputs(&packet.job, packet.output),
        ) {
            Ok(true) => Ok(()),
            _ => Err("proof rejected"),
        }
    }
}

/// Existing Vaulta circuit is payment.circom/PLONK, not SquareJob/Groth16.
pub struct VaultaUnsupported;
impl VerifyProof for VaultaUnsupported {
    fn name(&self) -> &'static str {
        "vaulta-plonk-unsupported-square-job"
    }
    fn key_hash(&self) -> [u8; 32] {
        [0; 32]
    }
    fn verify(&self, _: &Packet) -> Result<()> {
        Err("Vaulta same-job proof adapter not implemented")
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Observation {
    pub schema: &'static str,
    pub mode: &'static str,
    pub job: Job,
    pub job_commitment: [u8; 32],
    pub verifying_key_hash: [u8; 32],
    pub output: u64,
    pub proof_adapter: &'static str,
    pub settlement_adapter: Rail,
    pub proof_status: &'static str,
    pub settlement_status: &'static str,
    pub value_observed: &'static str,
    pub transaction_reference: Option<String>,
}

/// Pure local model; consumption is process-local, not crash-safe or distributed.
/// One gate instance models one authority ledger ACROSS all allowed rails.
pub struct LocalGate {
    grant: LocalGrant,
    key_hash: [u8; 32],
    consumed: HashSet<(String, u64)>,
}

impl LocalGate {
    pub fn new(grant: LocalGrant, key_hash: [u8; 32]) -> Self {
        Self {
            grant,
            key_hash,
            consumed: HashSet::new(),
        }
    }

    pub fn plan(
        &mut self,
        packet: &Packet,
        verifier: &impl VerifyProof,
        rail: Rail,
        now: u64,
    ) -> Result<Observation> {
        if now >= self.grant.expires_at {
            return Err("expired authorization");
        }
        if packet.job != self.grant.job {
            return Err("job differs from local authorization");
        }
        if packet.job.amount > self.grant.max_amount {
            return Err("amount exceeds ceiling");
        }
        if packet.job.fee > self.grant.max_fee {
            return Err("fee exceeds ceiling");
        }
        if !self.grant.allowed_rails.contains(&rail) {
            return Err("rail not authorized");
        }
        if verifier.key_hash() != self.key_hash {
            return Err("untrusted verifying key");
        }
        let replay_key = (packet.job.authorization_id.clone(), packet.job.nonce);
        if self.consumed.contains(&replay_key) {
            return Err("authorization already consumed");
        }
        verifier.verify(packet)?;
        self.consumed.insert(replay_key);
        Ok(Observation {
            schema: "bnr.solana-tungsten-observation/1",
            mode: "local-fixture-only",
            job: packet.job.clone(),
            job_commitment: commitment(&packet.job),
            verifying_key_hash: self.key_hash,
            output: packet.output,
            proof_adapter: verifier.name(),
            settlement_adapter: rail,
            proof_status: "host-verified",
            settlement_status: "dry-run-plan-only",
            value_observed: "none",
            transaction_reference: None,
        })
    }
}

pub fn fixture() -> LocalGrant {
    LocalGrant {
        job: Job {
            domain: "bnr:tungsten:local:v1".into(),
            job_id: "square-7".into(),
            authorization_id: "fixture-grant-1".into(),
            nonce: 1,
            recipient: "fixture-worker".into(),
            asset: "TEST-UNIT".into(),
            amount: 7,
            fee_asset: "TEST-FEE".into(),
            fee: 1,
            input: 7,
        },
        max_amount: 7,
        max_fee: 1,
        expires_at: 100,
        allowed_rails: vec![Rail::SolanaDryRun, Rail::VaultaDryRun],
    }
}
