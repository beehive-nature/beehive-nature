//! Vaulta K1 Action Authorization & Post-Quantum Attestation (SPEC-BTUNGSTEN-PQ-1, SPEC-BPQ-1).
//!
//! LAW (Grok adversarial review & canon ruling):
//! An ML-DSA signature over the action is an attestation alongside K1, not quantum resistance,
//! because the Vaulta blockchain consensus only verifies the secp256k1 K1 signature.
//! It is strictly codified as "PQ attestation for K1 actions" until Vaulta consensus
//! supports native post-quantum key types.
//!
//! TEETH LAW:
//! A Vaulta K1 action requested WITHOUT a matching, verified bpq1/intent is 100% REFUSED
//! by the signer.

use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultaAction {
    pub account: String,
    pub name: String,
    pub actor: String,
    pub permission: String,
    pub data: Vec<u8>,
    pub chain_id: [u8; 32],
}

impl VaultaAction {
    /// Compute the exact canonical action digest for Vaulta/EOSIO action.
    pub fn digest(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(&self.chain_id);
        h.update(self.account.as_bytes());
        h.update(self.name.as_bytes());
        h.update(self.actor.as_bytes());
        h.update(self.permission.as_bytes());
        h.update(&self.data);
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
    pub action: VaultaAction,
    pub k1_signature: String,
    pub k1_public_key: String,
    pub pq_attestation: PqAttestation,
}

/// Sign a Vaulta K1 action with required post-quantum attestation.
///
/// If `pq_intent_authorization` is absent or invalid, the signer strictly REFUSES
/// the transaction (teeth test).
pub fn authorize_vaulta_k1_action(
    action: &VaultaAction,
    k1_seed: &[u8; 32],
    pq_intent_authorization: Option<&str>,
    pinned_authority: &str,
) -> Result<VaultaAuthorizedAction, String> {
    // 1. TEETH CHECK: missing PQ attestation is refused immediately
    let Some(auth_str) = pq_intent_authorization else {
        return Err("vaulta:missing-pq-attestation — Vaulta K1 actions require a matching bpq1/intent attestation".into());
    };

    let auth_val: serde_json::Value = serde_json::from_str(auth_str)
        .map_err(|e| format!("vaulta:invalid-pq-attestation — invalid JSON: {e}"))?;

    // 2. Verify PQ intent authorization
    let Some((id, env_bytes)) = crate::bpq::verify_intent(&auth_val) else {
        return Err("vaulta:invalid-pq-attestation — bpq1/intent signature failed verification".into());
    };
    if id != pinned_authority {
        return Err(format!("vaulta:authority-mismatch — authorized by {id}, expected {pinned_authority}"));
    }

    // 3. Verify WB001 envelope parameters
    let decoded = btungsten_wb001::decode(&env_bytes)
        .map_err(|e| format!("vaulta:wb001-decode-error: {:?}", e))?;
    let domain = String::from_utf8_lossy(&decoded.domain[..decoded.domain_len as usize]);
    if domain != "vaulta:mainnet" && domain != "vaulta:testnet" {
        return Err(format!("vaulta:domain-mismatch — {domain} is not a valid Vaulta domain"));
    }
    let cap = String::from_utf8_lossy(&decoded.capability[..decoded.capability_len as usize]);
    if cap != "vaulta/action-v1" {
        return Err(format!("vaulta:capability-mismatch — expected vaulta/action-v1, got {cap}"));
    }

    // 4. Verify action digest matches intent action field
    let expected_digest = action.digest();
    if decoded.action != expected_digest {
        return Err("vaulta:action-mismatch — intent action does not match Vaulta action digest".into());
    }

    // 5. Produce K1 secp256k1 signature via bnr-keys
    let payload65 = bnr_keys::sign_digest65(k1_seed, &expected_digest)
        .map_err(|e| format!("vaulta:k1-sign-error: {e}"))?;
    let sig_k1 = bnr_keys::sig_k1_string(&payload65);
    let pub_k1 = bnr_keys::pub_k1_string(k1_seed)
        .map_err(|e| format!("vaulta:k1-pub-error: {e}"))?;

    Ok(VaultaAuthorizedAction {
        action: action.clone(),
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

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SEED: [u8; 32] = [0x33; 32];

    fn sample_action() -> VaultaAction {
        VaultaAction {
            account: "eosio.token".into(),
            name: "transfer".into(),
            actor: "alice".into(),
            permission: "active".into(),
            data: vec![0xaa, 0xbb, 0xcc, 0xdd],
            chain_id: [0x55; 32],
        }
    }

    #[test]
    fn test_k1_action_without_bpq_attestation_is_refused_teeth() {
        let action = sample_action();
        let authority = "bzpq1testauthority";

        // Requesting K1 action authorization without matching bpq1/intent MUST FAIL (teeth test)
        let res = authorize_vaulta_k1_action(&action, &TEST_SEED, None, authority);
        assert!(res.is_err());
        let err = res.err().unwrap();
        assert!(
            err.contains("vaulta:missing-pq-attestation"),
            "must name missing-pq-attestation: {err}"
        );
        println!("vaulta: PASS - teeth test confirmed: K1 action without PQ attestation is refused");
    }
}
