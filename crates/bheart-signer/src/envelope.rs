//! ENVELOPES — where the crypto-agility law becomes visible.
//!
//! Nothing cryptographic leaves this organ as a bare blob. A signature
//! travels as a JSON envelope that names: the signature algorithm, the
//! content hash and ITS algorithm, the key id, and the byte count of what
//! was signed. A verifier 500 years from now reads the ids first, dispatches
//! on what it read, and refuses what it cannot name. Migration = new id in
//! the registry + new arm in the dispatch; the envelope shape never changes.

use serde_json::{json, Value};
use sha3::{Digest, Sha3_256};

use crate::alg::{HashAlg, SigAlg};
use crate::b64::{b64u, sha3_256_b64u};
use crate::pq;

/// SHA3-256 with the algorithm id riding next to it — the only hash form
/// this organ writes. (Hash impl: RustCrypto `sha3` 0.10, workspace pin.)
pub fn digest_envelope(msg: &[u8]) -> Value {
    json!({
        "alg": HashAlg::Sha3256.id(),
        "b64u": sha3_256_b64u(msg),
        "bytes": msg.len(),
    })
}

fn sha3_256(msg: &[u8]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    h.update(msg);
    h.finalize().into()
}

/// Sign `msg` into a bheart.signature/1 envelope. `seed` is zeroized by the
/// caller's Zeroizing; it is copied into the ML-DSA key here and never
/// stored, logged, or echoed.
pub fn sign_envelope(
    alg: SigAlg,
    key_id: &str,
    seed: &[u8; 32],
    msg: &[u8],
) -> Result<Value, String> {
    let sig = pq::dsa_sign(alg, seed, msg)?;
    let (_iso, ms) = crate::keys::now_iso();
    Ok(json!({
        "type": "bheart.signature/1",
        "alg": alg.id(),
        "key_id": key_id,
        "content": {
            "bytes": msg.len(),
            "digest": digest_envelope(msg),
        },
        "signature": {
            "alg": alg.id(),
            "b64u": b64u(&sig),
            "bytes": sig.len(),
        },
        "signed_at_ms": ms,
        "agility": "verify dispatches on the alg fields above; unknown ids are refused, never defaulted",
    }))
}

/// Verify a bheart.signature/1 envelope against `verifying_key`.
/// Dispatches on the ALGORITHM IDS THE ENVELOPE CARRIES, recomputes the
/// digest with the id the envelope names, and fails closed on any mismatch.
pub fn verify_envelope(envelope: &Value, verifying_key: &[u8], msg: &[u8]) -> Result<(), String> {
    if envelope.get("type").and_then(|t| t.as_str()) != Some("bheart.signature/1") {
        return Err("not a bheart.signature/1 envelope".into());
    }
    let sig_alg_id = envelope
        .pointer("/signature/alg")
        .and_then(|a| a.as_str())
        .ok_or("envelope signature carries no algorithm id — refused (crypto-agility law)")?;
    let sig_alg = SigAlg::parse(sig_alg_id)?;
    let env_alg = envelope
        .get("alg")
        .and_then(|a| a.as_str())
        .ok_or("envelope carries no top-level algorithm id")?;
    if env_alg != sig_alg.id() {
        return Err(format!(
            "top-level alg {env_alg:?} disagrees with signature alg {sig_alg_id:?}"
        ));
    }
    // digest: recompute with the NAMED algorithm, compare
    let digest_alg_id = envelope
        .pointer("/content/digest/alg")
        .and_then(|a| a.as_str())
        .ok_or("digest carries no algorithm id")?;
    let digest_alg = HashAlg::parse(digest_alg_id)?;
    let claimed = envelope
        .pointer("/content/digest/b64u")
        .and_then(|d| d.as_str())
        .ok_or("digest value missing")?;
    let actual = match digest_alg {
        HashAlg::Sha3256 => b64u(&sha3_256(msg)),
    };
    if claimed != actual {
        return Err("content digest mismatch — the signed bytes are not these bytes".into());
    }
    let claimed_len = envelope
        .pointer("/content/bytes")
        .and_then(|b| b.as_u64())
        .unwrap_or(0);
    if claimed_len != msg.len() as u64 {
        return Err(format!(
            "content byte count {} != {}",
            claimed_len,
            msg.len()
        ));
    }
    // signature bytes
    let sig_b64 = envelope
        .pointer("/signature/b64u")
        .and_then(|s| s.as_str())
        .ok_or("signature value missing")?;
    let sig = b64_decode(sig_b64).ok_or("signature b64u undecodable")?;
    match pq::dsa_verify(sig_alg, verifying_key, msg, &sig)? {
        true => Ok(()),
        false => Err("signature does not verify".into()),
    }
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4 + 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for c in s.chars() {
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '-' => 62,
            '_' => 63,
            _ => return None,
        };
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pq::dsa_generate;
    use zeroize::Zeroizing;

    fn dev_key(alg: SigAlg) -> (Zeroizing<[u8; 32]>, Vec<u8>, String) {
        let g = dsa_generate(alg);
        (Zeroizing::new(g.seed), g.verifying_key, "test-key".into())
    }

    #[test]
    fn roundtrip_and_tamper() {
        let (seed, vk, kid) = dev_key(SigAlg::MlDsa65);
        let msg = b"the estate's deciding organ, milestone 1";
        let env = sign_envelope(SigAlg::MlDsa65, &kid, &seed, msg).unwrap();
        assert!(verify_envelope(&env, &vk, msg).is_ok());
        assert!(
            verify_envelope(&env, &vk, b"different bytes").is_err(),
            "message tamper"
        );
        let mut forged = env.clone();
        forged["signature"]["b64u"] = json!("AAAA");
        assert!(
            verify_envelope(&forged, &vk, msg).is_err(),
            "signature tamper"
        );
    }

    #[test]
    fn envelope_names_its_algorithms_everywhere() {
        let (seed, vk, kid) = dev_key(SigAlg::MlDsa44);
        let env = sign_envelope(SigAlg::MlDsa44, &kid, &seed, b"x").unwrap();
        assert_eq!(env["alg"], "ml-dsa-44");
        assert_eq!(env["signature"]["alg"], "ml-dsa-44");
        assert_eq!(env["content"]["digest"]["alg"], "sha3-256");
        assert!(
            env["signature"]["b64u"].as_str().unwrap().len() > 3000,
            "44 sig is ~2420 bytes b64"
        );
        assert!(verify_envelope(&env, &vk, b"x").is_ok());
    }

    #[test]
    fn future_algorithm_id_is_refused_not_defaulted() {
        let (seed, _, kid) = dev_key(SigAlg::MlDsa65);
        let mut env = sign_envelope(SigAlg::MlDsa65, &kid, &seed, b"x").unwrap();
        // a migrator 200 years out writes a new id; THIS build must refuse it
        env["signature"]["alg"] = json!("ml-dsa-65-hedged-2265");
        env["alg"] = json!("ml-dsa-65-hedged-2265");
        let err = verify_envelope(&env, b"", b"x").unwrap_err();
        assert!(err.contains("unknown signature algorithm"), "{err}");
    }

    #[test]
    fn hash_id_mismatch_is_refused() {
        let (seed, vk, kid) = dev_key(SigAlg::MlDsa65);
        let mut env = sign_envelope(SigAlg::MlDsa65, &kid, &seed, b"x").unwrap();
        env["content"]["digest"]["alg"] = json!("sha3-512"); // not in registry yet
        assert!(verify_envelope(&env, &vk, b"x").is_err());
    }

    #[test]
    fn seed_never_appears_in_the_envelope() {
        let (seed, _vk, kid) = dev_key(SigAlg::MlDsa65);
        let env = sign_envelope(SigAlg::MlDsa65, &kid, &seed, b"x").unwrap();
        let text = env.to_string();
        assert!(
            !text.contains(&b64u(seed.as_slice())),
            "private seed leaked into the envelope"
        );
    }
}
