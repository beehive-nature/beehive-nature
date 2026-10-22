//! File/stdin-only operator bench. No key, device, network or broadcast API.
use serde::Deserialize;
use serde_json::Value;
use settle_solana::{prepare, reconcile, verify_signature, BlockhashObservation, EvaluationIntent};
use std::io::{self, Read};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    intent: EvaluationIntent,
    observation: BlockhashObservation,
    signature_hex: Option<String>,
    current_genesis: Option<String>,
    current_block_height: Option<u64>,
    fee_lamports: Option<u64>,
    evidence: Option<Evidence>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Evidence {
    genesis_hash: String,
    requested_signature: String,
    status: Value,
    transaction: Value,
}
fn run() -> Result<Value, String> {
    let command = std::env::args()
        .nth(1)
        .ok_or("Usage: settle-solana prepare|verify|reconcile < public-input.json")?;
    let mut text = String::new();
    io::stdin()
        .take(65_537)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    if text.len() > 65_536 {
        return Err("Input too large".into());
    }
    let input: Input = serde_json::from_str(&text)
        .map_err(|_| "Invalid evaluation input schema (no unknown fields permitted)")?;
    let prepared = prepare(input.intent, input.observation)?;
    if command == "prepare" {
        return Ok(prepared.summary());
    }
    if command != "verify" && command != "reconcile" {
        return Err("Unknown command".into());
    }
    let signed = verify_signature(
        prepared,
        &input.signature_hex.ok_or("Missing signature_hex")?,
        &input.current_genesis.ok_or("Missing current_genesis")?,
        input
            .current_block_height
            .ok_or("Missing current_block_height")?,
        input.fee_lamports.ok_or("Missing fee_lamports")?,
    )?;
    if command == "verify" {
        return Ok(signed.summary());
    }
    let evidence = input.evidence.ok_or("Missing finalized RPC evidence")?;
    reconcile(
        &signed,
        &evidence.genesis_hash,
        &evidence.requested_signature,
        &evidence.status,
        &evidence.transaction,
    )
}
fn main() {
    match run() {
        Ok(value) => println!("{}", serde_json::to_string_pretty(&value).unwrap()),
        Err(error) => {
            eprintln!("Refused: {error}");
            std::process::exit(1);
        }
    }
}
