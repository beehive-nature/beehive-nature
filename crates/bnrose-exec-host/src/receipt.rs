//! The verifiable receipt (BNROSE-RUST-001).
//!
//! One Ed25519 signature by the supervisor over one statement: how a named
//! operation ended, under which envelope, which effect, and against which
//! journal prefix. Anyone holding the supervisor's PUBLIC key verifies a
//! receipt with [`verify`] — no journal, no ledger, no trusted anything
//! else. What the receipt is NOT: a claim that the effect is exactly-once
//! anywhere but through this supervisor's ledger, and a claim about any
//! intent other than the envelope hash it names (the WB001 binding stays
//! where it was earned: the signature over the envelope).

use crate::hex;
use bnrose_exec_core::{receipt_statement, STMT_LEN};
use serde_json::{json, Value};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub op: [u8; 32],
    pub env_sha: [u8; 32],
    pub state: u8,
    pub recovered: u8,
    pub fail: u32,
    pub effect: [u8; 32],
    pub journal_head: [u8; 32],
    pub completed_at: u64,
    pub seq_head: u64,
    pub sig: [u8; 64],
}

pub const RECEIPT_FORMAT: &str = "bnrose-exec/receipt/1";

impl Receipt {
    pub fn statement(&self) -> [u8; STMT_LEN] {
        let mut s = [0u8; STMT_LEN];
        receipt_statement(
            &self.op,
            &self.env_sha,
            self.state,
            self.recovered,
            self.fail,
            &self.effect,
            &self.journal_head,
            self.completed_at,
            self.seq_head,
            &mut s,
        );
        s
    }

    /// Sign a statement with the supervisor's Ed25519 seed.
    pub fn sign_statement(seed: &[u8; 32], stmt: &[u8]) -> [u8; 64] {
        libcrux_ed25519::sign(stmt, seed).expect("statement length is fixed")
    }

    /// The independent check: public key, receipt, done.
    pub fn verify(&self, pk: &[u8; 32]) -> bool {
        libcrux_ed25519::verify(&self.statement(), pk, &self.sig).is_ok()
    }

    pub fn to_json(&self) -> Value {
        json!({
            "format": RECEIPT_FORMAT,
            "op": hex(&self.op),
            "envSha256": hex(&self.env_sha),
            "state": self.state,
            "stateWord": state_word(self.state),
            "recovered": self.recovered == 1,
            "fail": self.fail,
            "failWord": if self.fail == 0 { String::new() } else { format!("code-{}", self.fail) },
            "effectDigest": hex(&self.effect),
            "journalHead": hex(&self.journal_head),
            "completedAt": self.completed_at,
            "journalSeqHead": self.seq_head,
            "sigEd25519": crate::b64(&self.sig),
        })
    }

    pub fn from_json(v: &Value) -> Result<Receipt, String> {
        let s = |k: &str| -> Result<&str, String> {
            v.get(k).and_then(Value::as_str).ok_or(format!("missing {k}"))
        };
        let u = |k: &str| -> Result<u64, String> {
            v.get(k).and_then(Value::as_u64).ok_or(format!("missing {k}"))
        };
        if s("format")? != RECEIPT_FORMAT {
            return Err(format!("unknown receipt format {}", s("format")?));
        }
        let arr32 = |k: &str| -> Result<[u8; 32], String> {
            crate::unhex(s(k)?)?
                .try_into()
                .map_err(|_| format!("{k} is not 32 bytes"))
        };
        Ok(Receipt {
            op: arr32("op")?,
            env_sha: arr32("envSha256")?,
            state: u("state")?.min(255) as u8,
            recovered: v
                .get("recovered")
                .and_then(Value::as_bool)
                .ok_or("missing recovered")? as u8,
            fail: u("fail")?.min(u32::MAX as u64) as u32,
            effect: arr32("effectDigest")?,
            journal_head: arr32("journalHead")?,
            completed_at: u("completedAt")?,
            seq_head: u("journalSeqHead")?,
            sig: crate::unb64(s("sigEd25519")?)?
                .try_into()
                .map_err(|_| "sig is not 64 bytes")?,
        })
    }
}

pub fn state_word(state: u8) -> &'static str {
    match state {
        bnrose_exec_core::S_COMPLETED => "completed",
        bnrose_exec_core::S_FAILED => "failed",
        bnrose_exec_core::S_UNKNOWN => "unknown",
        bnrose_exec_core::S_DISPATCHED => "dispatched",
        bnrose_exec_core::S_RESERVED => "reserved",
        bnrose_exec_core::S_ADMITTED => "admitted",
        _ => "unrecognized",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_receipt_verifies_with_the_public_key_and_json_round_trips() {
        let seed = [3u8; 32];
        let mut pk = [0u8; 32];
        libcrux_ed25519::secret_to_public(&mut pk, &seed);
        let r = Receipt {
            op: [1; 32],
            env_sha: [2; 32],
            state: bnrose_exec_core::S_COMPLETED,
            recovered: 1,
            fail: 0,
            effect: [4; 32],
            journal_head: [5; 32],
            completed_at: 123,
            seq_head: 9,
            sig: [0; 64],
        };
        let mut r = r;
        r.sig = Receipt::sign_statement(&seed, &r.statement());
        assert!(r.verify(&pk));
        // any field flip breaks it
        let mut bad = r.clone();
        bad.recovered = 0;
        assert!(!bad.verify(&pk));
        let mut bad = r.clone();
        bad.op[0] ^= 1;
        assert!(!bad.verify(&pk));
        // another key refuses it
        assert!(!r.verify(&[9; 32]));
        // JSON round trip preserves the verification
        let back = Receipt::from_json(&r.to_json()).unwrap();
        assert_eq!(back, r);
        assert!(back.verify(&pk));
    }
}
