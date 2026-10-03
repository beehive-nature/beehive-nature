//! Solana devnet evaluation boundary. `prepare` uses Anza's message and system
//! instruction constructors; `verify_signature` uses dalek's strict Ed25519
//! verifier. `reconcile` binds RPC evidence to those exact transaction bytes.
//!
//! Authorization/proof references are opaque evaluation labels, NOT verified
//! capabilities or Groth16 proofs. This module does not authorize spending,
//! implement production bPay, contact an RPC, hold a key or broadcast. RPC
//! finality is an assertion of the evidence provider, not a consensus proof.
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use solana_hash::Hash;
use solana_instruction::Instruction;
use solana_message::Message;
use solana_pubkey::Pubkey;
use std::str::FromStr;

pub const DEVNET_GENESIS: &str = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // PUBLIC-CONSTANT
const MEMO: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"; // PUBLIC-CONSTANT
pub type Result<T> = std::result::Result<T, String>;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvaluationIntent {
    pub job_id: String,
    pub authorization_ref: String,
    pub proof_ref: String,
    pub payer: String,
    pub recipient: String,
    pub lamports: u64,
    pub max_lamports: u64,
    pub max_fee_lamports: u64,
    pub path: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BlockhashObservation {
    pub genesis_hash: String,
    pub blockhash: String,
    pub last_valid_block_height: u64,
    pub observed_block_height: u64,
}

/// Fields are private: callers must rebuild and revalidate a prepared intent.
pub struct Prepared {
    intent: EvaluationIntent,
    observation: BlockhashObservation,
    message: Vec<u8>,
    intent_hash: String,
}

pub struct SignatureVerified {
    prepared: Prepared,
    signature: String,
    transaction: Vec<u8>,
}

fn require(condition: bool, reason: &str) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(reason.into())
    }
}

fn address(value: &str) -> Result<Pubkey> {
    require(value.len() <= 44, "Address too long")?;
    Pubkey::from_str(value).map_err(|_| "Invalid public address".into())
}

pub fn prepare(intent: EvaluationIntent, observation: BlockhashObservation) -> Result<Prepared> {
    require(
        observation.genesis_hash == DEVNET_GENESIS,
        "Only Solana devnet is admitted",
    )?;
    require(
        observation.observed_block_height <= observation.last_valid_block_height,
        "Blockhash observation is already expired",
    )?;
    require(
        intent.lamports > 0 && intent.lamports <= intent.max_lamports,
        "Amount exceeds the evaluation bound or is zero",
    )?;
    require(
        intent.max_fee_lamports > 0
            && intent
                .lamports
                .checked_add(intent.max_fee_lamports)
                .is_some(),
        "Invalid total cost bound",
    )?;
    for label in [&intent.job_id, &intent.authorization_ref, &intent.proof_ref] {
        require(
            !label.is_empty() && label.len() <= 128 && label.bytes().all(|c| c.is_ascii_graphic()),
            "Use nonempty ASCII reference labels up to 128 bytes",
        )?;
    }
    // Account paths supported by the stock Solana firmware. No arbitrary path.
    let rest = intent
        .path
        .strip_prefix("m/44'/501'/")
        .ok_or("Unsupported Solana derivation path")?;
    let account = rest
        .strip_suffix("'/0'")
        .or_else(|| rest.strip_suffix('\''))
        .ok_or("Unsupported Solana derivation path")?;
    require(
        !account.is_empty()
            && account.bytes().all(|c| c.is_ascii_digit())
            && account.parse::<u32>().is_ok_and(|v| v < 100)
            && (account == "0" || !account.starts_with('0')),
        "Unsupported Solana account index",
    )?;
    let payer = address(&intent.payer)?;
    let recipient = address(&intent.recipient)?;
    let memo = address(MEMO)?;
    require(
        payer != recipient
            && payer != Pubkey::default()
            && recipient != Pubkey::default()
            && payer != memo
            && recipient != memo,
        "Payer and recipient must be distinct ordinary addresses",
    )?;
    require(observation.blockhash.len() <= 44, "Blockhash too long")?;
    let blockhash = Hash::from_str(&observation.blockhash).map_err(|_| "Invalid blockhash")?;
    // Fixed struct field order and a versioned domain; no unordered maps.
    let encoded = serde_json::to_vec(&intent).map_err(|e| e.to_string())?;
    let intent_hash = hex::encode(Sha256::digest(
        [b"bnr:solana:evaluation:v1:".as_slice(), &encoded].concat(),
    ));
    let instructions = [
        solana_system_interface::instruction::transfer(&payer, &recipient, intent.lamports),
        Instruction {
            program_id: memo,
            accounts: vec![],
            data: format!("bnr:settle-eval:v1:{intent_hash}").into_bytes(),
        },
    ];
    let message = Message::new_with_blockhash(&instructions, Some(&payer), &blockhash).serialize();
    Ok(Prepared {
        intent,
        observation,
        message,
        intent_hash,
    })
}

impl Prepared {
    pub fn message(&self) -> &[u8] {
        &self.message
    }

    /// The Connect Solana method calls its serialized MESSAGE `serializedTx`.
    /// This is not a serialized transaction (which includes signature slots).
    pub fn connect_request(&self) -> Value {
        json!({"method":"solanaSignTransaction","params":{
            "path":self.intent.path,"serializedTx":hex::encode(&self.message),
            "isDevnet":true,"serialize":false
        }})
    }

    pub fn summary(&self) -> Value {
        json!({"state":"prepared_evaluation","authority_verified":false,"proof_verified":false,
            "intent":self.intent,"intent_hash":self.intent_hash,"observation":self.observation,
            "message_base64":BASE64.encode(&self.message),"connect":self.connect_request()})
    }
}

/// Recheck expiry/fee immediately before accepting a device result. The
/// observation is caller-supplied RPC evidence, not an authenticated authority.
pub fn verify_signature(
    prepared: Prepared,
    signature_hex: &str,
    observed_genesis: &str,
    current_block_height: u64,
    fee_lamports: u64,
) -> Result<SignatureVerified> {
    require(observed_genesis == DEVNET_GENESIS, "Wrong observed network")?;
    require(
        current_block_height >= prepared.observation.observed_block_height
            && current_block_height <= prepared.observation.last_valid_block_height,
        "Blockhash expired or observation went backwards",
    )?;
    require(
        fee_lamports > 0 && fee_lamports <= prepared.intent.max_fee_lamports,
        "Fee exceeds the evaluation bound or is unavailable",
    )?;
    require(
        signature_hex.len() == 128,
        "Expected a 64-byte hex signature",
    )?;
    let bytes = hex::decode(signature_hex).map_err(|_| "Malformed signature")?;
    let sig = Signature::from_slice(&bytes).map_err(|_| "Malformed signature")?;
    let payer = address(&prepared.intent.payer)?;
    let key =
        VerifyingKey::from_bytes(payer.as_array()).map_err(|_| "Invalid Ed25519 public key")?;
    key.verify_strict(&prepared.message, &sig)
        .map_err(|_| "Signature does not match the exact prepared message and payer")?;
    // Legacy transaction with exactly one signature: canonical shortvec length 1.
    let mut transaction = vec![1];
    transaction.extend_from_slice(&bytes);
    transaction.extend_from_slice(&prepared.message);
    Ok(SignatureVerified {
        prepared,
        signature: bs58::encode(bytes).into_string(),
        transaction,
    })
}

impl SignatureVerified {
    pub fn signature(&self) -> &str {
        &self.signature
    }
    pub fn transaction_base64(&self) -> String {
        BASE64.encode(&self.transaction)
    }
    pub fn summary(&self) -> Value {
        json!({"state":"signature_verified_evaluation","authority_verified":false,"proof_verified":false,
            "intent_hash":self.prepared.intent_hash,"signature":self.signature,"transaction_base64":self.transaction_base64(),
            "settlement_observed":false})
    }
}

/// Evidence payloads are JSON-RPC `result` values, with a requested signature
/// explicitly bound by the collector. Missing err fields are NOT successes.
/// No `settled` result for a submitted signature or a merely confirmed block.
pub fn reconcile(
    signed: &SignatureVerified,
    observed_genesis: &str,
    requested_signature: &str,
    status: &Value,
    transaction: &Value,
) -> Result<Value> {
    require(observed_genesis == DEVNET_GENESIS, "Wrong observed network")?;
    require(
        requested_signature == signed.signature,
        "Evidence requested for another signature",
    )?;
    require(
        status.get("confirmationStatus").and_then(Value::as_str) == Some("finalized")
            && status.get("err") == Some(&Value::Null),
        "Signature is not finalized successfully",
    )?;
    let slot = status
        .get("slot")
        .and_then(Value::as_u64)
        .filter(|v| *v > 0)
        .ok_or("Missing finalized slot")?;
    require(
        transaction.get("slot").and_then(Value::as_u64) == Some(slot),
        "Transaction slot differs from finalized status",
    )?;
    let meta = transaction
        .get("meta")
        .filter(|v| v.is_object())
        .ok_or("Missing transaction metadata")?;
    require(
        meta.get("err") == Some(&Value::Null),
        "Transaction failed or has no execution status",
    )?;
    let fee = meta
        .get("fee")
        .and_then(Value::as_u64)
        .ok_or("Missing fee")?;
    require(
        fee > 0 && fee <= signed.prepared.intent.max_fee_lamports,
        "Final fee exceeds evaluation bound",
    )?;
    let encoded = transaction
        .get("transaction")
        .and_then(Value::as_array)
        .ok_or("Request base64 transaction evidence")?;
    require(
        encoded.len() == 2 && encoded[1].as_str() == Some("base64"),
        "Request base64 transaction evidence",
    )?;
    let wire = encoded[0]
        .as_str()
        .filter(|v| v.len() <= 1644)
        .ok_or("Missing or oversized transaction bytes")?;
    require(
        BASE64
            .decode(wire)
            .map_err(|_| "Invalid base64 transaction")?
            == signed.transaction,
        "RPC transaction bytes differ from the signed intent",
    )?;
    Ok(
        json!({"schema":"bnr.solana.evaluation.v1","state":"rpc_finalized_evaluation",
        "settlement_adapter":"solana-devnet","authority_verified":false,"proof_verified":false,
        "job_id":signed.prepared.intent.job_id,"authorization_ref":signed.prepared.intent.authorization_ref,
        "proof_ref":signed.prepared.intent.proof_ref,"intent_hash":signed.prepared.intent_hash,
        "payer":signed.prepared.intent.payer,"recipient":signed.prepared.intent.recipient,
        "lamports":signed.prepared.intent.lamports,"fee_lamports":fee,"signature":signed.signature,"slot":slot,
        "evidence":"caller-supplied RPC observations; not a consensus proof"}),
    )
}
