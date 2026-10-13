//! Canonical operation identities — the WB001 `Intent` envelope, reused
//! unchanged from `btungsten-wb001-core` (SAW-proven codec), as ordered by
//! the lane's coordination record with BNROSE-RUST-001.
//!
//! Every workload operation the battery injects is a canonical Intent; the
//! delivery ledger keys on the envelope bytes and nonce. A retried logical
//! step under a FRESH nonce is a DIFFERENT operation identity — visible in
//! the receipts, never silent. The safe retry path (same logical id,
//! identical bytes) is the WB004 handoff law carried at transport level.

use btungsten_wb001_core::{encode, valid_intent, Intent, MAX_ENV};
use sha2::{Digest, Sha256};

/// The battery's domain string (fits the 64-byte domain field).
pub const DOMAIN: &str = "btmd-mesh";
/// The battery's capability string (fits the 64-byte capability field).
pub const CAPABILITY: &str = "meshdep-battery";
/// The battery's payer string (fits the 128-byte payer field).
pub const PAYER: &str = "btmd-rig";

/// The workload classes the battery distinguishes. Class names ride the
/// Intent action field (padded to its exact 32 bytes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpClass {
    IdlePresence,
    TargetedDm,
    Discovery,
    StateSync,
    Revocation,
    GroupOp,
    Reconnect,
    ClassProbe,
}

impl OpClass {
    /// The action-field spelling (<= 32 bytes; padded with zeros to exactly 32).
    pub fn action_bytes(self) -> [u8; 32] {
        let mut a = [0u8; 32];
        let s: &[u8] = match self {
            Self::IdlePresence => b"btmd:idle-presence",
            Self::TargetedDm => b"btmd:targeted-dm",
            Self::Discovery => b"btmd:discovery",
            Self::StateSync => b"btmd:state-sync",
            Self::Revocation => b"btmd:revocation",
            Self::GroupOp => b"btmd:group-op",
            Self::Reconnect => b"btmd:reconnect",
            Self::ClassProbe => b"btmd:class-probe",
        };
        a[..s.len()].copy_from_slice(s);
        a
    }
}

/// Build the canonical Intent for one battery operation.
///
/// `nonce_seed` mixes the run id and the operation sequence so nonces are
/// unique per run and per operation, deterministic for reproduction, and
/// never reused for a different logical step.
#[must_use]
pub fn intent(
    class: OpClass,
    destination: &str,
    payload: &[u8],
    nonce_seed: &[u8],
    epoch: u64,
    expiry_unix: u64,
) -> Intent {
    let mut nonce = [0u8; 32];
    let mut h = Sha256::new();
    h.update(nonce_seed);
    let d = h.finalize();
    nonce.copy_from_slice(&d);
    let mut i = Intent::ZERO;
    let dom = DOMAIN.as_bytes();
    i.domain_len = dom.len() as u32;
    i.domain[..dom.len()].copy_from_slice(dom);
    i.nonce_len = 32;
    i.nonce = nonce;
    i.epoch = epoch;
    i.action_len = 32;
    i.action = class.action_bytes();
    let dst = destination.as_bytes();
    i.destination_len = dst.len() as u32;
    i.destination[..dst.len()].copy_from_slice(dst);
    let cap = CAPABILITY.as_bytes();
    i.capability_len = cap.len() as u32;
    i.capability[..cap.len()].copy_from_slice(cap);
    i.amount = payload.len() as u64;
    i.expiry = expiry_unix;
    let pay = PAYER.as_bytes();
    i.payer_len = pay.len() as u32;
    i.payer[..pay.len()].copy_from_slice(pay);
    // An oversized payload records its true length (which fails the
    // valid_intent bound) and copies only what physically fits — the
    // refusal happens at encode, never a panic, never silent truncation.
    i.payload_len = payload.len() as u32;
    let fit = payload.len().min(i.payload.len());
    i.payload[..fit].copy_from_slice(&payload[..fit]);
    i
}

/// Encode an intent to its canonical wire bytes. Refuses (empty vec) if the
/// intent is not valid — never emits wrong bytes silently.
#[must_use]
pub fn envelope_bytes(i: &Intent) -> Vec<u8> {
    if !valid_intent(i) {
        return Vec::new();
    }
    let mut out = [0u8; MAX_ENV];
    let n = encode(i, &mut out);
    out[..n as usize].to_vec()
}

/// sha256 of the canonical envelope bytes — the operation identity used by
/// the ledger. Two logical steps under different nonces get different ids.
#[must_use]
pub fn op_digest(env: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(env);
    let d = h.finalize();
    let mut s = String::with_capacity(64);
    for b in d {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intents_encode_and_digest_deterministically() {
        let a = intent(
            OpClass::TargetedDm,
            "leaf-2",
            b"hello",
            b"run-1/seq-7",
            1,
            2,
        );
        let env = envelope_bytes(&a);
        assert!(!env.is_empty(), "valid intent must encode");
        let again = envelope_bytes(&intent(
            OpClass::TargetedDm,
            "leaf-2",
            b"hello",
            b"run-1/seq-7",
            1,
            2,
        ));
        assert_eq!(env, again, "same inputs, same canonical bytes");
        assert_eq!(op_digest(&env), op_digest(&again));
    }

    #[test]
    fn a_fresh_nonce_is_a_new_operation_identity_never_silent() {
        let one = envelope_bytes(&intent(
            OpClass::StateSync,
            "leaf-3",
            b"record",
            b"run-1/step-1/attempt-1",
            1,
            2,
        ));
        let two = envelope_bytes(&intent(
            OpClass::StateSync,
            "leaf-3",
            b"record",
            b"run-1/step-1/attempt-2",
            1,
            2,
        ));
        assert_ne!(
            op_digest(&one),
            op_digest(&two),
            "a retried step under a fresh nonce is a DIFFERENT identity — the WB004 defect shape, made visible"
        );
    }

    #[test]
    fn oversized_payloads_refuse_instead_of_encoding_wrong() {
        let big = vec![b'x'; 5000];
        let i = intent(OpClass::ClassProbe, "leaf-1", &big, b"n", 0, 0);
        assert!(envelope_bytes(&i).is_empty(), "invalid intent must refuse");
    }
}
