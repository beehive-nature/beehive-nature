//! Deterministic signed WB001 intents for the battery and the demos
//! (BNROSE-RUST-001). No entropy anywhere: the authority seed, the nonce
//! and the times are all functions of the fixture index, so every run of
//! the same fixture is the same bytes — which is what a receipt that says
//! "this exact envelope" needs.

use crate::{b64, hex};
use btungsten_wb001::{IntentIn, Text};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const TEST_DOMAIN: &str = "test/bnrose";
pub const TEST_CAPABILITY: &str = "test/exec";
pub const TEST_DESTINATION: &str = "bnrose:test-destination";
pub const TEST_PAYER: &str = "bnrose:test-payer";

/// The battery's action label (the envelope's action field is its hash).
pub const TEST_ACTION_LABEL: &str = "bnrose-exec/test-action/1";

/// The policy the fixtures are built to satisfy.
pub fn test_policy() -> bnrose_exec_core::Policy {
    let slot = |s: &str| {
        let mut a = [0u8; 64];
        a[..s.len()].copy_from_slice(s.as_bytes());
        (a, s.len() as u32)
    };
    bnrose_exec_core::Policy {
        domains: [slot(TEST_DOMAIN), slot(""), slot(""), slot("")],
        capabilities: [slot(TEST_CAPABILITY), slot(""), slot(""), slot("")],
        max_amount: 1_000_000,
        min_lead: 10,
        max_payload: 4096,
    }
}

fn sha256(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

/// One deterministic intent: everything derives from `index`.
#[derive(Clone, Debug)]
pub struct Fixture {
    pub env: Vec<u8>,
    pub sig: [u8; 64],
    pub authority: [u8; 32],
    /// The signing seed (TEST FIXTURE ONLY — deterministic by design so the
    /// battery can re-sign edited envelopes and attack the policy layer
    /// behind a valid WB001 binding).
    pub seed: [u8; 32],
    pub nonce: [u8; 32],
    pub expiry: u64,
    pub epoch: u64,
    pub amount: u64,
}

pub fn fixture(index: u64, now: u64, ttl: u64) -> Fixture {
    let idx = index.to_le_bytes();
    let seed = sha256(&[b"bnrose-fixture/authority-seed/1", &idx]);
    let mut authority = [0u8; 32];
    libcrux_ed25519::secret_to_public(&mut authority, &seed);
    let nonce = sha256(&[b"bnrose-fixture/nonce/1", &idx]);
    let action = sha256(&[TEST_ACTION_LABEL.as_bytes()]);
    let payload = sha256(&[b"bnrose-fixture/payload/1", &idx]).to_vec();
    let epoch = now;
    let expiry = now + ttl;
    let amount = 42 + (index % 1000);
    let intent = IntentIn {
        domain: Text::Str(TEST_DOMAIN.into()),
        nonce: nonce.to_vec(),
        epoch,
        action: action.to_vec(),
        destination: Text::Str(TEST_DESTINATION.into()),
        capability: Text::Str(TEST_CAPABILITY.into()),
        amount,
        expiry,
        payer: Text::Str(TEST_PAYER.into()),
        payload,
    }
    .build()
    .expect("the fixture is a valid intent");
    let env = btungsten_wb001::canonical(&intent).expect("canonical");
    let sig = btungsten_wb001::sign(&seed, &intent).expect("sign");
    Fixture {
        env,
        sig,
        authority,
        seed,
        nonce,
        expiry,
        epoch,
        amount,
    }
}

impl Fixture {
    /// The intent-file JSON the CLI consumes.
    pub fn to_json(&self) -> Value {
        json!({
            "format": "bnrose-exec/intent/1",
            "envB64": b64(&self.env),
            "sigB64": b64(&self.sig),
            "authorityHex": hex(&self.authority),
            "nonceHex": hex(&self.nonce),
            "epoch": self.epoch,
            "expiry": self.expiry,
            "amount": self.amount,
        })
    }

    /// The fixture's own signature over its own envelope (for the
    /// battery's negative controls: one flipped byte must fail it).
    pub fn binding_holds(&self) -> bool {
        btungsten_wb001::verify_envelope(&self.authority, &self.env, &self.sig)
    }
}

/// Read an intent file (what the CLI's `run-op` consumes).
#[derive(Clone)]
pub struct IntentFile {
    pub env: Vec<u8>,
    pub sig: [u8; 64],
    pub authority: [u8; 32],
}

pub fn read_intent(v: &Value) -> Result<IntentFile, String> {
    let s = |k: &str| -> Result<&str, String> {
        v.get(k)
            .and_then(Value::as_str)
            .ok_or(format!("missing {k}"))
    };
    Ok(IntentFile {
        env: crate::unb64(s("envB64")?)?,
        sig: crate::unb64(s("sigB64")?)?
            .try_into()
            .map_err(|_| "sig must be 64 bytes")?,
        authority: crate::unhex(s("authorityHex")?)?
            .try_into()
            .map_err(|_| "authority must be 32 bytes")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixtures_are_deterministic_and_bind() {
        let a = fixture(1, 1_000_000, 600);
        let b = fixture(1, 1_000_000, 600);
        let c = fixture(2, 1_000_000, 600);
        assert_eq!(a.env, b.env, "same index, same envelope");
        assert_ne!(a.env, c.env, "another index, another envelope");
        assert!(a.binding_holds());
        let mut broken = a.clone();
        broken.env[10] ^= 1;
        assert!(
            !broken.binding_holds(),
            "one flipped envelope byte breaks the binding"
        );
        // the JSON round trip is what the CLI reads
        let f = read_intent(&a.to_json()).unwrap();
        assert_eq!(f.env, a.env);
        assert_eq!(f.sig, a.sig);
        assert_eq!(f.authority, a.authority);
    }
}
