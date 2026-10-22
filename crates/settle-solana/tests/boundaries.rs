//! All keys and chain responses here are synthetic. No RPC or device access.
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use serde_json::{json, Value};
use settle_solana::*;

fn fixture() -> (EvaluationIntent, BlockhashObservation, SigningKey) {
    let key = SigningKey::from_bytes(&[7; 32]); // TESTNET-ONLY: public deterministic test key
    let intent = EvaluationIntent {
        job_id: "job-fixture-1".into(),
        authorization_ref: "unverified-fixture-bound".into(),
        proof_ref: "unverified-fixture-proof".into(),
        payer: bs58::encode(key.verifying_key().as_bytes()).into_string(),
        recipient: bs58::encode([8; 32]).into_string(),
        lamports: 1000,
        max_lamports: 1000,
        max_fee_lamports: 5000,
        path: "m/44'/501'/0'".into(),
    };
    let observation = BlockhashObservation {
        genesis_hash: DEVNET_GENESIS.into(),
        blockhash: bs58::encode([9; 32]).into_string(),
        last_valid_block_height: 200,
        observed_block_height: 100,
    };
    (intent, observation, key)
}
fn signed() -> SignatureVerified {
    let (intent, observation, key) = fixture();
    let p = prepare(intent, observation).unwrap();
    let sig = hex::encode(key.sign(p.message()).to_bytes());
    verify_signature(p, &sig, DEVNET_GENESIS, 101, 5000).unwrap()
}
fn evidence(s: &SignatureVerified) -> (Value, Value) {
    (
        json!({"confirmationStatus":"finalized","err":null,"slot":500}),
        json!({"slot":500,"meta":{"err":null,"fee":5000},"transaction":[s.transaction_base64(),"base64"]}),
    )
}

#[test]
fn message_is_bound_to_job_proof_recipient_amount_and_account_path() {
    let (intent, obs, key) = fixture();
    let p = prepare(intent.clone(), obs.clone()).unwrap();
    let sig = hex::encode(key.sign(p.message()).to_bytes());
    for change in 0..6 {
        let mut altered = intent.clone();
        match change {
            0 => altered.job_id.push('2'),
            1 => altered.proof_ref.push('2'),
            2 => altered.recipient = bs58::encode([10; 32]).into_string(),
            3 => altered.lamports -= 1,
            4 => altered.path = "m/44'/501'/1'".into(),
            _ => altered.authorization_ref.push('2'),
        }
        assert!(verify_signature(
            prepare(altered, obs.clone()).unwrap(),
            &sig,
            DEVNET_GENESIS,
            101,
            5000
        )
        .is_err());
    }
}
#[test]
fn wrong_key_and_corrupted_signatures_are_refused() {
    let (intent, obs, _) = fixture();
    let p = prepare(intent.clone(), obs.clone()).unwrap();
    let wrong = SigningKey::from_bytes(&[11; 32]); // TESTNET-ONLY
    let sig = hex::encode(wrong.sign(p.message()).to_bytes());
    assert!(verify_signature(p, &sig, DEVNET_GENESIS, 101, 5000).is_err());
    for malformed in ["00".repeat(64), "g".repeat(128), "".into(), "0".repeat(130)] {
        assert!(verify_signature(
            prepare(intent.clone(), obs.clone()).unwrap(),
            &malformed,
            DEVNET_GENESIS,
            101,
            5000
        )
        .is_err());
    }
}
#[test]
fn invalid_network_bounds_expiry_and_paths_are_refused_before_signing() {
    let (intent, obs, _) = fixture();
    let mut mainnet = obs.clone();
    mainnet.genesis_hash = "mainnet".into();
    assert!(prepare(intent.clone(), mainnet).is_err());
    let mut expired = obs.clone();
    expired.observed_block_height = 201;
    assert!(prepare(intent.clone(), expired).is_err());
    for path in [
        "m/44'/501'/0",
        "m/44'/60'/0'",
        "m/44'/501'/100'",
        "m/44'/501'/00'",
        "m/44'/501'/0'/1'",
    ] {
        let mut i = intent.clone();
        i.path = path.into();
        assert!(prepare(i, obs.clone()).is_err());
    }
    for amount in [0, 1001, u64::MAX] {
        let mut i = intent.clone();
        i.lamports = amount;
        assert!(prepare(i, obs.clone()).is_err());
    }
    let mut i = intent.clone();
    i.max_fee_lamports = u64::MAX;
    assert!(prepare(i, obs.clone()).is_err());
    let mut i = intent;
    i.path = "m/44'/501'/0'/0'".into();
    assert!(prepare(i, obs).is_ok());
}
#[test]
fn signing_return_rechecks_network_expiry_and_fee() {
    let (intent, obs, key) = fixture();
    let p = prepare(intent.clone(), obs.clone()).unwrap();
    let sig = hex::encode(key.sign(p.message()).to_bytes());
    for (network, height, fee) in [
        ("wrong", 101, 5000),
        (DEVNET_GENESIS, 99, 5000),
        (DEVNET_GENESIS, 201, 5000),
        (DEVNET_GENESIS, 101, 5001),
        (DEVNET_GENESIS, 101, 0),
    ] {
        assert!(verify_signature(
            prepare(intent.clone(), obs.clone()).unwrap(),
            &sig,
            network,
            height,
            fee
        )
        .is_err());
    }
}
#[test]
fn valid_signature_is_never_a_settlement_or_authorization() {
    let s = signed().summary();
    assert_eq!(s["state"], "signature_verified_evaluation");
    assert_eq!(s["settlement_observed"], false);
    assert_eq!(s["authority_verified"], false);
    assert_eq!(s["proof_verified"], false);
}
#[test]
fn receipt_requires_finality_success_slot_and_exact_transaction_bytes() {
    let s = signed();
    let (status, tx) = evidence(&s);
    let receipt = reconcile(&s, DEVNET_GENESIS, s.signature(), &status, &tx).unwrap();
    assert_eq!(receipt["state"], "rpc_finalized_evaluation");
    assert_eq!(receipt["proof_verified"], false);
    for confirmation in ["processed", "confirmed", "", "rooted"] {
        let mut v = status.clone();
        v["confirmationStatus"] = json!(confirmation);
        assert!(reconcile(&s, DEVNET_GENESIS, s.signature(), &v, &tx).is_err());
    }
    for failure in [
        json!({"InstructionError":[0,"InvalidArgument"]}),
        json!("error"),
    ] {
        let mut v = status.clone();
        v["err"] = failure.clone();
        assert!(reconcile(&s, DEVNET_GENESIS, s.signature(), &v, &tx).is_err());
        let mut v = tx.clone();
        v["meta"]["err"] = failure;
        assert!(reconcile(&s, DEVNET_GENESIS, s.signature(), &status, &v).is_err());
    }
    for mutation in 0..7 {
        let mut v = tx.clone();
        match mutation {
            0 => v["slot"] = json!(501),
            1 => {
                v["meta"].as_object_mut().unwrap().remove("err");
            }
            2 => v["meta"]["fee"] = json!(5001),
            3 => v["meta"] = Value::Null,
            4 => v["transaction"][1] = json!("base58"),
            5 => v["transaction"][0] = json!("broken"),
            _ => {
                let mut bytes = BASE64.decode(s.transaction_base64()).unwrap();
                bytes[90] ^= 1;
                v["transaction"][0] = json!(BASE64.encode(bytes));
            }
        }
        assert!(reconcile(&s, DEVNET_GENESIS, s.signature(), &status, &v).is_err());
    }
    assert!(reconcile(&s, "mainnet", s.signature(), &status, &tx).is_err());
    assert!(reconcile(&s, DEVNET_GENESIS, "another signature", &status, &tx).is_err());
    let mut no_err = status;
    no_err.as_object_mut().unwrap().remove("err");
    assert!(reconcile(&s, DEVNET_GENESIS, s.signature(), &no_err, &tx).is_err());
}
#[test]
fn input_schema_does_not_accept_private_material_or_extra_transaction_fields() {
    let (intent, _, _) = fixture();
    let mut value = serde_json::to_value(intent).unwrap();
    value["private_key"] = json!("DO-NOT-ACCEPT");
    assert!(serde_json::from_value::<EvaluationIntent>(value).is_err());
}
#[test]
fn connect_request_is_message_hex_not_a_signature_prefixed_transaction() {
    let (intent, obs, _) = fixture();
    let p = prepare(intent, obs).unwrap();
    let request = p.connect_request();
    assert_eq!(request["params"]["serializedTx"], hex::encode(p.message()));
    assert_eq!(request["params"]["isDevnet"], true);
    assert_eq!(request["params"]["serialize"], false);
    assert_eq!(p.message()[..3], [1, 0, 2]); // one payer, two readonly programs
}
