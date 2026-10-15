//! Who may say what: the trust root and envelope verification.
//!
//! Two kinds of statement enter the controller from outside its process:
//! the sovereign's promotion POLICY and an agent's candidate PROPOSAL. Each
//! arrives as bytes plus a bsigner `bheart.signature/1` envelope
//! (crates/bsigner/src/envelope.rs). The envelope is verified here with the
//! same `ml-dsa` crate and the same call bsigner's `dsa_verify` makes, so an
//! envelope written by `bsigner sign` verifies here unchanged.
//!
//! A valid signature is evidence of AUTHORSHIP and BYTE INTEGRITY. It is never
//! evidence that the signed claim is true: an agent's signed proposal saying
//! "every test passes" is a signed claim, and the verifier ignores it.
//!
//! This module verifies only. No signing function exists in this crate.

use ml_dsa::{EncodedVerifyingKey, MlDsa44, MlDsa65, MlDsa87, Signature, Verifier, VerifyingKey};
use serde_json::Value;

use crate::digest::{b64u, b64u_decode, sha3_plain};
use crate::Refusal;

/// The roles a key can hold. A key holds exactly one.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Role {
    /// Writes the promotion policy. Never a candidate's author.
    Sovereign,
    /// Proposes candidates. Cannot write policy, verdicts or decisions.
    Agent,
}

impl Role {
    pub fn name(self) -> &'static str {
        match self {
            Role::Sovereign => "sovereign",
            Role::Agent => "agent",
        }
    }
}

/// The signature algorithms bsigner's registry names (crates/bsigner/src/alg.rs).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SigAlg {
    MlDsa44,
    MlDsa65,
    MlDsa87,
}

impl SigAlg {
    pub fn id(self) -> &'static str {
        match self {
            SigAlg::MlDsa44 => "ml-dsa-44",
            SigAlg::MlDsa65 => "ml-dsa-65",
            SigAlg::MlDsa87 => "ml-dsa-87",
        }
    }
    /// Unknown ids are refused, never defaulted (bsigner's agility law).
    pub fn parse(id: &str) -> Result<Self, Refusal> {
        match id {
            "ml-dsa-44" => Ok(SigAlg::MlDsa44),
            "ml-dsa-65" => Ok(SigAlg::MlDsa65),
            "ml-dsa-87" => Ok(SigAlg::MlDsa87),
            other => Err(Refusal::Attest(format!(
                "unknown signature algorithm id {other:?}"
            ))),
        }
    }
}

/// One public key and the single role it holds.
#[derive(Clone, Debug)]
pub struct RoleKey {
    pub role: Role,
    pub key_id: String,
    pub alg: SigAlg,
    pub verifying_key: Vec<u8>,
}

/// The keys the controller trusts, fixed when it opens. It is supplied by
/// whoever runs the controller, from outside any candidate's writable tree;
/// nothing a candidate or an agent submits can add to it.
#[derive(Clone, Debug)]
pub struct TrustRoot {
    keys: Vec<RoleKey>,
}

impl TrustRoot {
    /// Refuses a key id listed twice and a key (by bytes) listed under two
    /// roles: an agent key that is also a sovereign key would let a candidate's
    /// author write the policy that judges it.
    pub fn new(keys: Vec<RoleKey>) -> Result<Self, Refusal> {
        for (i, a) in keys.iter().enumerate() {
            for b in &keys[i + 1..] {
                if a.key_id == b.key_id {
                    return Err(Refusal::Attest(format!(
                        "trust root lists key id {:?} twice",
                        a.key_id
                    )));
                }
                if a.verifying_key == b.verifying_key {
                    return Err(Refusal::Attest(format!(
                        "one key holds two roles ({} and {})",
                        a.role.name(),
                        b.role.name()
                    )));
                }
            }
        }
        if !keys.iter().any(|k| k.role == Role::Sovereign) {
            return Err(Refusal::Attest(
                "trust root names no sovereign key".to_string(),
            ));
        }
        Ok(TrustRoot { keys })
    }

    /// One key per line: `<sovereign|agent> <key_id> <alg> <verifying_key_b64u>`
    /// — the `key_id` and `verifying_key_b64u` that `bsigner keygen` prints.
    pub fn parse(text: &str) -> Result<Self, Refusal> {
        let mut keys = Vec::new();
        for (i, line) in text.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let f: Vec<&str> = line.split_whitespace().collect();
            let [role, key_id, alg, vk] = f.as_slice() else {
                return Err(Refusal::Attest(format!(
                    "trust line {} needs 4 fields",
                    i + 1
                )));
            };
            let role = match *role {
                "sovereign" => Role::Sovereign,
                "agent" => Role::Agent,
                other => return Err(Refusal::Attest(format!("unknown role {other:?}"))),
            };
            keys.push(RoleKey {
                role,
                key_id: key_id.to_string(),
                alg: SigAlg::parse(alg)?,
                verifying_key: b64u_decode(vk).ok_or_else(|| {
                    Refusal::Attest(format!("trust line {}: key is not base64url", i + 1))
                })?,
            });
        }
        TrustRoot::new(keys)
    }

    pub fn keys(&self) -> &[RoleKey] {
        &self.keys
    }

    /// Verify `envelope_json` over exactly `msg`, signed by a key that holds
    /// `role`. Returns the key id that signed.
    pub fn verify(&self, envelope_json: &str, msg: &[u8], role: Role) -> Result<String, Refusal> {
        let env: Value = serde_json::from_str(envelope_json)
            .map_err(|e| Refusal::Attest(format!("envelope is not JSON: {e}")))?;
        let key_id = env
            .get("key_id")
            .and_then(Value::as_str)
            .ok_or_else(|| Refusal::Attest("envelope names no key_id".into()))?;
        let key = self
            .keys
            .iter()
            .find(|k| k.key_id == key_id)
            .ok_or_else(|| Refusal::Attest(format!("key {key_id:?} is not in the trust root")))?;
        if key.role != role {
            return Err(Refusal::Role {
                needed: role.name(),
                signed_by: key.role.name(),
            });
        }
        verify_envelope(&env, key, msg)?;
        Ok(key_id.to_string())
    }
}

/// Mirrors bsigner `envelope::verify_envelope`: dispatch on the ids the
/// envelope carries, recompute the digest with the named algorithm, check the
/// byte count, then the signature. Additionally the algorithm must be the one
/// the trust root registered for this key.
fn verify_envelope(env: &Value, key: &RoleKey, msg: &[u8]) -> Result<(), Refusal> {
    let bad = |m: &str| Refusal::Attest(m.to_string());
    if env.get("type").and_then(Value::as_str) != Some("bheart.signature/1") {
        return Err(bad("not a bheart.signature/1 envelope"));
    }
    let sig_alg = SigAlg::parse(
        env.pointer("/signature/alg")
            .and_then(Value::as_str)
            .ok_or_else(|| bad("signature carries no algorithm id"))?,
    )?;
    if env.get("alg").and_then(Value::as_str) != Some(sig_alg.id()) {
        return Err(bad("top-level alg disagrees with the signature alg"));
    }
    if sig_alg != key.alg {
        return Err(bad(
            "envelope algorithm is not the one registered for this key",
        ));
    }
    if env.pointer("/content/digest/alg").and_then(Value::as_str) != Some("sha3-256") {
        return Err(bad("unknown or missing content digest algorithm"));
    }
    let claimed = env
        .pointer("/content/digest/b64u")
        .and_then(Value::as_str)
        .ok_or_else(|| bad("content digest missing"))?;
    if claimed != b64u(&sha3_plain(msg)) {
        return Err(bad(
            "content digest mismatch: the signed bytes are not these bytes",
        ));
    }
    if env.pointer("/content/bytes").and_then(Value::as_u64) != Some(msg.len() as u64) {
        return Err(bad("content byte count mismatch"));
    }
    let sig = b64u_decode(
        env.pointer("/signature/b64u")
            .and_then(Value::as_str)
            .ok_or_else(|| bad("signature value missing"))?,
    )
    .ok_or_else(|| bad("signature is not base64url"))?;
    let ok = match sig_alg {
        SigAlg::MlDsa44 => dsa_verify::<MlDsa44>(&key.verifying_key, msg, &sig)?,
        SigAlg::MlDsa65 => dsa_verify::<MlDsa65>(&key.verifying_key, msg, &sig)?,
        SigAlg::MlDsa87 => dsa_verify::<MlDsa87>(&key.verifying_key, msg, &sig)?,
    };
    if ok {
        Ok(())
    } else {
        Err(bad("signature does not verify"))
    }
}

fn dsa_verify<P: ml_dsa::MlDsaParams>(vk: &[u8], msg: &[u8], sig: &[u8]) -> Result<bool, Refusal> {
    let enc = EncodedVerifyingKey::<P>::try_from(vk)
        .map_err(|_| Refusal::Attest("verifying key has the wrong length".into()))?;
    let vk = VerifyingKey::<P>::decode(&enc);
    let sig = match Signature::<P>::try_from(sig) {
        Ok(s) => s,
        Err(_) => return Ok(false),
    };
    Ok(vk.verify(msg, &sig).is_ok())
}
