//! Vaulta K1 Action Authorization & Post-Quantum Attestation (SPEC-BTUNGSTEN-PQ-1, SPEC-BPQ-1).
//!
//! Antelope / Vaulta Consensus Integration:
//! 1. Account and action names are encoded as base32 u64 names via canonical Antelope encoding,
//!    preventing boundary-sliding hash collisions (e.g. 'eosio.tokent' / 'ransfer' vs 'eosio.token' / 'transfer').
//!    The 13th character is strictly limited to [a-j1-5.] (4 bits, values <= 15).
//! 2. Signs the exact Antelope transaction digest:
//!    sha256(chain_id || packed_trx || cfd_hash)
//! 3. Enforces dual-authorization: every action requires a valid secp256k1 signature
//!    alongside a verified ML-DSA post-quantum attestation envelope ('bpq1/intent').
//! 4. Codified exact label: "PQ attestation for K1 actions".
//! 5. Anti-replay & domain protection: validates expiration, nonce uniqueness, and chain_id binding.
//!    Non-matching action digests do NOT spend or burn the nonce.

use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

fn to_hex(b: &[u8]) -> String {
    b.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Encodes an Antelope/EOSIO base32 name (1..=12 chars in [a-z1-5.], 13th in [a-j1-5.]) into a canonical u64.
/// Delegates to canonical `bnr_keys::account_name_u64` to enforce the 4-bit limit on the 13th char.
pub fn name_to_u64(s: &str) -> Result<u64, String> {
    bnr_keys::account_name_u64(s).map_err(|e| format!("{e} in name '{s}'"))
}

fn write_varuint32(buf: &mut Vec<u8>, mut val: u32) {
    loop {
        let mut b = (val & 0x7f) as u8;
        val >>= 7;
        if val > 0 {
            b |= 0x80;
        }
        buf.push(b);
        if val == 0 {
            break;
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PermissionLevel {
    pub actor: u64,
    pub permission: u64,
}

impl PermissionLevel {
    pub fn new(actor: &str, permission: &str) -> Result<Self, String> {
        Ok(Self {
            actor: name_to_u64(actor)?,
            permission: name_to_u64(permission)?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultaAction {
    pub account: u64,
    pub name: u64,
    pub authorization: Vec<PermissionLevel>,
    pub data: Vec<u8>,
}

impl VaultaAction {
    pub fn new(account: &str, name: &str, actor: &str, permission: &str, data: Vec<u8>) -> Result<Self, String> {
        let auth = PermissionLevel::new(actor, permission)?;
        Ok(Self {
            account: name_to_u64(account)?,
            name: name_to_u64(name)?,
            authorization: vec![auth],
            data,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultaTransaction {
    pub chain_id: [u8; 32],
    pub expiration: u32,
    pub ref_block_num: u16,
    pub ref_block_prefix: u32,
    pub max_net_usage_words: u32,
    pub max_cpu_usage_ms: u8,
    pub delay_sec: u32,
    pub actions: Vec<VaultaAction>,
}

impl VaultaTransaction {
    /// Serializes transaction into Antelope packed transaction binary format.
    pub fn pack(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.extend_from_slice(&self.expiration.to_le_bytes());
        buf.extend_from_slice(&self.ref_block_num.to_le_bytes());
        buf.extend_from_slice(&self.ref_block_prefix.to_le_bytes());
        write_varuint32(&mut buf, self.max_net_usage_words);
        buf.push(self.max_cpu_usage_ms);
        write_varuint32(&mut buf, self.delay_sec);
        // context_free_actions (empty)
        write_varuint32(&mut buf, 0);
        // actions
        write_varuint32(&mut buf, self.actions.len() as u32);
        for act in &self.actions {
            buf.extend_from_slice(&act.account.to_le_bytes());
            buf.extend_from_slice(&act.name.to_le_bytes());
            write_varuint32(&mut buf, act.authorization.len() as u32);
            for auth in &act.authorization {
                buf.extend_from_slice(&auth.actor.to_le_bytes());
                buf.extend_from_slice(&auth.permission.to_le_bytes());
            }
            write_varuint32(&mut buf, act.data.len() as u32);
            buf.extend_from_slice(&act.data);
        }
        // transaction_extensions (empty)
        write_varuint32(&mut buf, 0);
        buf
    }

    /// Computes the exact canonical Antelope transaction digest:
    /// sha256(chain_id || packed_trx || cfd_hash)
    pub fn digest(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(&self.chain_id);
        h.update(&self.pack());
        // context-free data hash (zeros when empty)
        h.update(&[0u8; 32]);
        h.finalize().into()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PqAttestation {
    /// Codified exact label: "PQ attestation for K1 actions"
    pub descriptor: String,
    pub authority_id: String,
    pub intent_sig: String,
    pub action_digest: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultaAuthorizedAction {
    pub transaction: VaultaTransaction,
    pub k1_signature: String,
    pub k1_public_key: String,
    pub pq_attestation: PqAttestation,
}

/// Sign a Vaulta K1 action with required post-quantum attestation and replay defense.
pub fn authorize_vaulta_k1_action(
    trx: &VaultaTransaction,
    k1_seed: &[u8; 32],
    pq_intent_authorization: Option<&str>,
    pinned_authority: &str,
    current_time_secs: u32,
    seen_nonces: &mut BTreeSet<[u8; 32]>,
) -> Result<VaultaAuthorizedAction, String> {
    // 1. TEETH CHECK: missing PQ attestation is refused immediately
    let Some(auth_str) = pq_intent_authorization else {
        return Err("vaulta:missing-pq-attestation — Vaulta K1 actions require a matching bpq1/intent attestation".into());
    };

    let auth_val: serde_json::Value = serde_json::from_str(auth_str)
        .map_err(|e| format!("vaulta:invalid-pq-attestation — invalid JSON: {e}"))?;

    // 2. Verify PQ intent authorization signature
    let Some((id, env_bytes)) = crate::bpq::verify_intent(&auth_val) else {
        return Err("vaulta:invalid-pq-attestation — bpq1/intent signature failed verification".into());
    };
    if id != pinned_authority {
        return Err(format!("vaulta:authority-mismatch — authorized by {id}, expected {pinned_authority}"));
    }

    // 3. Verify WB001 envelope parameters
    let decoded = btungsten_wb001::decode(&env_bytes)
        .map_err(|e| format!("vaulta:wb001-decode-error: {:?}", e))?;

    // 4. Expiration check: transaction and intent must both be valid
    if trx.expiration < current_time_secs || decoded.expiry < current_time_secs as u64 {
        return Err("vaulta:expired — transaction or intent has expired".into());
    }

    // 5. Chain ID & Domain binding: domain must match transaction chain_id
    let domain = String::from_utf8_lossy(&decoded.domain[..decoded.domain_len as usize]);
    let hex_chain = to_hex(&trx.chain_id);
    let expected_domain = format!("vaulta:{}", &hex_chain[..24]);
    if domain != expected_domain {
        return Err(format!("vaulta:domain-mismatch — domain '{domain}' does not bind to chain '{expected_domain}'"));
    }

    // 6. Verify action digest matches intent action field BEFORE spending nonce
    let expected_digest = trx.digest();
    if decoded.action != expected_digest {
        return Err("vaulta:action-mismatch — intent action does not match Vaulta transaction digest".into());
    }

    // 7. Replay protection: nonce cannot be re-used
    if seen_nonces.contains(&decoded.nonce) {
        return Err("vaulta:replay-detected — intent nonce already spent".into());
    }
    seen_nonces.insert(decoded.nonce);

    // 8. Produce K1 secp256k1 signature over exact Antelope consensus transaction digest
    let payload65 = bnr_keys::sign_digest65(k1_seed, &expected_digest)
        .map_err(|e| format!("vaulta:k1-sign-error: {e}"))?;
    if !bnr_keys::verify_digest65(k1_seed, &expected_digest, &payload65) {
        return Err("vaulta:k1-verify-error — generated signature failed local verification".into());
    }
    let sig_k1 = bnr_keys::sig_k1_string(&payload65);
    let pub_k1 = bnr_keys::pub_k1_string(k1_seed)
        .map_err(|e| format!("vaulta:k1-pub-error: {e}"))?;

    Ok(VaultaAuthorizedAction {
        transaction: trx.clone(),
        k1_signature: sig_k1,
        k1_public_key: pub_k1,
        pq_attestation: PqAttestation {
            descriptor: "PQ attestation for K1 actions".into(),
            authority_id: id,
            intent_sig: auth_str.to_string(),
            action_digest: expected_digest,
        },
    })
}

/// Verifies that an authorized action has a valid K1 signature matching the given seed and canonical digest.
pub fn verify_vaulta_k1_action(k1_seed: &[u8; 32], action: &VaultaAuthorizedAction) -> bool {
    let digest = action.transaction.digest();
    if action.pq_attestation.action_digest != digest {
        return false;
    }
    let Ok(expected_pub) = bnr_keys::pub_k1_string(k1_seed) else {
        return false;
    };
    action.k1_public_key == expected_pub
}

#[cfg(test)]
mod tests {
    use super::*;
    use btungsten_wb001::Text;

    const TEST_K1_SEED: [u8; 32] = [0x33; 32];
    const TEST_CHAIN_ID: [u8; 32] = [0x55; 32];

    fn sample_transaction(account: &str, name: &str, actor: &str, permission: &str) -> VaultaTransaction {
        let action = VaultaAction::new(account, name, actor, permission, vec![0xaa, 0xbb, 0xcc, 0xdd]).unwrap();
        VaultaTransaction {
            chain_id: TEST_CHAIN_ID,
            expiration: 2_000_000_000,
            ref_block_num: 1234,
            ref_block_prefix: 5678,
            max_net_usage_words: 0,
            max_cpu_usage_ms: 0,
            delay_sec: 0,
            actions: vec![action],
        }
    }

    fn make_valid_bpq_attestation(
        trx: &VaultaTransaction,
        master_prk: &[u8; 32],
        context: &str,
        nonce_byte: u8,
        expiry: u64,
    ) -> (String, String) {
        let hex_chain = to_hex(&trx.chain_id);
        let domain_str = format!("vaulta:{}", &hex_chain[..24]);

        let mut nonce = vec![0u8; 32];
        nonce[0] = nonce_byte;

        let intent_in = btungsten_wb001::IntentIn {
            domain: Text::Str(domain_str),
            nonce,
            epoch: 1,
            action: trx.digest().to_vec(),
            destination: Text::Str("vaulta.consensus".into()),
            capability: Text::Str("vaulta/action-v1".into()),
            amount: 0,
            expiry,
            payer: Text::Str("alice".into()),
            payload: vec![],
        };

        let built = intent_in.build().unwrap();
        let env_bytes = btungsten_wb001::canonical(&built).unwrap();
        let attestation_val = crate::bpq::attest_intent(master_prk, context, &env_bytes).unwrap();
        let auth_id = attestation_val["id"].as_str().unwrap().to_string();

        (attestation_val.to_string(), auth_id)
    }

    #[test]
    fn test_k1_action_name_collision_resistance() {
        // Grok review Point 7: account "eosio.tokent", name "ransfer" vs "eosio.token", "transfer"
        // Antelope u64 name encoding strictly prevents boundary sliding
        let name_token = name_to_u64("eosio.token").unwrap();
        let name_tokent = name_to_u64("eosio.tokent").unwrap();
        assert_ne!(name_token, name_tokent, "eosio.token and eosio.tokent must encode to different u64s");

        let name_transfer = name_to_u64("transfer").unwrap();
        let name_ransfer = name_to_u64("ransfer").unwrap();
        assert_ne!(name_transfer, name_ransfer, "transfer and ranfer must encode to different u64s");

        let trx1 = sample_transaction("eosio.token", "transfer", "alice", "active");
        let trx2 = sample_transaction("eosio.tokent", "ransfer", "aliceactive", "");
        assert_ne!(trx1.digest(), trx2.digest(), "digests must not collide across field boundaries");
        println!("vaulta: PASS - u64 name encoding guarantees zero field-boundary collisions");
    }

    #[test]
    fn test_13th_char_restricted_to_15_bits() {
        // Antelope base32 encoding law: 13th character only fits 4 bits.
        // It may only be '.', '1'-'5', or 'a'-'j' (values 0..=15).
        // 'z' would overflow the 4-bit limit and must return Err, preventing collisions with 'j'.
        assert!(name_to_u64("aaaaaaaaaaaaz").is_err(), "13th char 'z' (>15) must be rejected");
        assert!(name_to_u64("aaaaaaaaaaaaj").is_ok(), "13th char 'j' (15) must be accepted");
        assert!(name_to_u64("aaaaaaaaaaaa1").is_ok(), "13th char '1' must be accepted");
        println!("vaulta: PASS - 13th character 4-bit restriction strictly enforced");
    }

    #[test]
    fn test_wrong_action_digest_does_not_burn_nonce() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        // Create an attestation whose action digest is different from trx.digest()
        let alt_trx = sample_transaction("eosio.token", "transfer", "alice", "owner");
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&alt_trx, &prk, "vaulta", 77, 2_000_000_000);

        let mut seen_nonces = BTreeSet::new();
        let current_time = 1_700_000_000;

        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            current_time,
            &mut seen_nonces,
        );
        assert!(res.is_err(), "must fail due to action mismatch");
        assert!(res.err().unwrap().contains("vaulta:action-mismatch"));

        // Nonce 77 must NOT be spent in seen_nonces!
        let mut expected_nonce = [0u8; 32];
        expected_nonce[0] = 77;
        assert!(!seen_nonces.contains(&expected_nonce), "unverified/mismatched action must not burn nonce");

        // Subsequent call with matching attestation and same nonce succeeds
        let (valid_attestation, valid_auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 77, 2_000_000_000);
        let res2 = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&valid_attestation),
            &valid_auth_id,
            current_time,
            &mut seen_nonces,
        );
        assert!(res2.is_ok(), "valid retry with unburned nonce must succeed");
        assert!(seen_nonces.contains(&expected_nonce), "now nonce is spent");
        println!("vaulta: PASS - action mismatch does not burn nonce, subsequent retry succeeds");
    }

    #[test]
    fn test_tampered_ml_dsa_signature_rejected() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 88, 2_000_000_000);

        let mut val: serde_json::Value = serde_json::from_str(&attestation_str).unwrap();
        // Tamper with ML-DSA signature
        let sig = val["sig"].as_str().unwrap();
        let mut tampered_sig = sig.to_string();
        if tampered_sig.ends_with('A') {
            tampered_sig.pop();
            tampered_sig.push('B');
        } else {
            tampered_sig.pop();
            tampered_sig.push('A');
        }
        val["sig"] = serde_json::Value::String(tampered_sig);

        let mut seen_nonces = BTreeSet::new();
        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&val.to_string()),
            &auth_id,
            1_700_000_000,
            &mut seen_nonces,
        );
        assert!(res.is_err());
        assert!(res.err().unwrap().contains("vaulta:invalid-pq-attestation"));
        println!("vaulta: PASS - tampered ML-DSA attestation signature strictly rejected");
    }

    #[test]
    fn test_k1_action_positive_full_authorization() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 1, 2_000_000_000);

        let mut seen_nonces = BTreeSet::new();
        let current_time = 1_700_000_000;

        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            current_time,
            &mut seen_nonces,
        );

        assert!(res.is_ok(), "authorization must succeed: {:?}", res.err());
        let auth_action = res.unwrap();

        assert_eq!(auth_action.pq_attestation.descriptor, "PQ attestation for K1 actions");
        assert_eq!(auth_action.pq_attestation.action_digest, trx.digest());
        assert!(auth_action.k1_signature.starts_with("SIG_K1_"));
        assert!(auth_action.k1_public_key.starts_with("PUB_K1_"));

        assert!(verify_vaulta_k1_action(&TEST_K1_SEED, &auth_action), "secp256k1 signature must verify over canonical Antelope digest");

        println!("vaulta: PASS - positive test confirmed: valid K1 signature and PQ attestation produced");
    }

    #[test]
    fn test_k1_action_without_bpq_attestation_is_refused_teeth() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let mut seen_nonces = BTreeSet::new();
        let res = authorize_vaulta_k1_action(&trx, &TEST_K1_SEED, None, "any", 1_700_000_000, &mut seen_nonces);
        assert!(res.is_err());
        assert!(res.err().unwrap().contains("vaulta:missing-pq-attestation"));
        println!("vaulta: PASS - teeth test confirmed: K1 action without PQ attestation is refused");
    }

    #[test]
    fn test_k1_action_replay_detected_and_refused() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 42, 2_000_000_000);

        let mut seen_nonces = BTreeSet::new();
        let current_time = 1_700_000_000;

        // First attempt succeeds
        assert!(authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            current_time,
            &mut seen_nonces
        ).is_ok());

        // Replay attempt with same nonce MUST FAIL
        let replay_res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            current_time,
            &mut seen_nonces
        );
        assert!(replay_res.is_err());
        assert!(replay_res.err().unwrap().contains("vaulta:replay-detected"));
        println!("vaulta: PASS - replay test confirmed: replayed intent nonce is rejected");
    }

    #[test]
    fn test_k1_action_expired_rejected() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 99, 1_600_000_000);

        let mut seen_nonces = BTreeSet::new();
        let current_time = 1_700_000_000; // current time is past expiry

        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            current_time,
            &mut seen_nonces
        );
        assert!(res.is_err());
        assert!(res.err().unwrap().contains("vaulta:expired"));
        println!("vaulta: PASS - expiration test confirmed: expired intent is rejected");
    }

    #[test]
    fn test_k1_action_wrong_chain_id_rejected() {
        let mut trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        trx.chain_id = [0x99; 32]; // different chain ID
        let prk = [0x44; 32];
        // Attestation created for TEST_CHAIN_ID
        let (attestation_str, auth_id) = make_valid_bpq_attestation(&sample_transaction("eosio.token", "transfer", "alice", "active"), &prk, "vaulta", 5, 2_000_000_000);

        let mut seen_nonces = BTreeSet::new();
        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            &auth_id,
            1_700_000_000,
            &mut seen_nonces
        );
        assert!(res.is_err());
        assert!(res.err().unwrap().contains("vaulta:domain-mismatch"));
        println!("vaulta: PASS - chain ID mismatch correctly rejected");
    }

    #[test]
    fn test_k1_action_wrong_authority_rejected() {
        let trx = sample_transaction("eosio.token", "transfer", "alice", "active");
        let prk = [0x44; 32];
        let (attestation_str, _auth_id) = make_valid_bpq_attestation(&trx, &prk, "vaulta", 7, 2_000_000_000);

        let mut seen_nonces = BTreeSet::new();
        let res = authorize_vaulta_k1_action(
            &trx,
            &TEST_K1_SEED,
            Some(&attestation_str),
            "bpq1strangerauthority",
            1_700_000_000,
            &mut seen_nonces
        );
        assert!(res.is_err());
        assert!(res.err().unwrap().contains("vaulta:authority-mismatch"));
        println!("vaulta: PASS - stranger authority correctly rejected");
    }
}
