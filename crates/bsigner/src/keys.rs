//! KEYS — on-device, never leaving, never printed.
//!
//! The laws, and how each is held:
//!
//! - KEYS NEVER LEAVE: generation uses OS entropy on THIS device
//!   (crypto-common generate.rs:43 for ML-DSA; kem lib.rs:126 for ML-KEM);
//!   storage is a seed file under the install home (~/.bheartwallet/
//!   bsigner/keys); no network code exists in this crate at all.
//! - NEVER PRINTED: every function that touches a seed returns/prints only
//!   key ids, algorithm ids, and public material. The test
//!   `keygen_output_carries_no_seed` holds the law mechanically.
//! - ZEROIZED: seeds live in `Zeroizing` buffers on the way in and out; the
//!   on-disk bytes are the durable copy and are the file-permission story
//!   (user-profile ACL on Windows; documented as the current state —
//!   at-rest encryption is an OPEN follow-up, NOT done, NOT claimed).
//!
//! Key files are JSON with base64url bodies (never bare hex — beehive
//! pre-commit hex law) and a standing `law` field so the file explains
//! itself wherever it lands.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};
use zeroize::Zeroizing;

use crate::alg::{KemAlg, SigAlg};
use crate::b64::{b64u, sha3_256_b64u};
use crate::pq;

pub fn keys_dir() -> PathBuf {
    if let Ok(h) = std::env::var("BHEARTWALLET_HOME") {
        return PathBuf::from(h).join("bsigner").join("keys");
    }
    let user = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(user)
        .join(".bheartwallet")
        .join("bsigner")
        .join("keys")
}

/// Generate + persist an ML-DSA identity. Returns PUBLIC info + key_id only.
pub fn keygen_dsa(alg: SigAlg, dir: Option<PathBuf>) -> Result<Value, String> {
    let g = pq::dsa_generate(alg);
    let key_id = derive_key_id(alg.id(), &g.verifying_key);
    let dir = dir.unwrap_or_else(keys_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("keys dir: {e}"))?;
    let file = json!({
        "type": "bheart.keyset/1",
        "kind": "signature",
        "alg": alg.id(),
        "key_id": key_id,
        "created_ms": now_ms(),
        "seed_b64u": b64u(&g.seed),
        "verifying_key_b64u": b64u(&g.verifying_key),
        "secret": true,
        "law": "keys never leave this device; never printed; seed stays in this file",
        "at_rest_encryption": "NOT DONE — open follow-up; OS file permissions only today",
    });
    fs::write(dir.join(format!("{key_id}.json")), file.to_string())
        .map_err(|e| format!("write keyset: {e}"))?;
    Ok(json!({
        "key_id": key_id,
        "kind": "signature",
        "alg": alg.id(),
        "verifying_key_b64u": b64u(&g.verifying_key),
        "verifying_key_bytes": g.verifying_key.len(),
        "keys_dir": dir.display().to_string(),
    }))
}

/// Generate + persist an ML-KEM pair. Same laws.
pub fn keygen_kem(alg: KemAlg, dir: Option<PathBuf>) -> Result<Value, String> {
    let g = pq::kem_generate(alg)?;
    let key_id = derive_key_id(alg.id(), &g.encapsulation_key);
    let dir = dir.unwrap_or_else(keys_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("keys dir: {e}"))?;
    let file = json!({
        "type": "bheart.keyset/1",
        "kind": "kem",
        "alg": alg.id(),
        "key_id": key_id,
        "created_ms": now_ms(),
        "seed_b64u": b64u(&g.seed),
        "encapsulation_key_b64u": b64u(&g.encapsulation_key),
        "secret": true,
        "law": "keys never leave this device; never printed; seed stays in this file",
        "at_rest_encryption": "NOT DONE — open follow-up; OS file permissions only today",
    });
    fs::write(dir.join(format!("{key_id}.json")), file.to_string())
        .map_err(|e| format!("write keyset: {e}"))?;
    Ok(json!({
        "key_id": key_id,
        "kind": "kem",
        "alg": alg.id(),
        "encapsulation_key_b64u": b64u(&g.encapsulation_key),
        "encapsulation_key_bytes": g.encapsulation_key.len(),
        "keys_dir": dir.display().to_string(),
    }))
}

/// Load a signature key: (alg, Zeroizing seed, verifying key bytes).
pub fn load_dsa(
    key_id: &str,
    dir: Option<PathBuf>,
) -> Result<(SigAlg, Zeroizing<[u8; 32]>, Vec<u8>), String> {
    let dir = dir.unwrap_or_else(keys_dir);
    let text = fs::read_to_string(dir.join(format!("{key_id}.json")))
        .map_err(|_| format!("no key {key_id} in {}", dir.display()))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("keyset parse: {e}"))?;
    if v.get("kind").and_then(|k| k.as_str()) != Some("signature") {
        return Err(format!("{key_id} is not a signature key"));
    }
    let alg = SigAlg::parse(
        v.get("alg")
            .and_then(|a| a.as_str())
            .ok_or("keyset has no alg")?,
    )?;
    let seed_b64 = v
        .get("seed_b64u")
        .and_then(|s| s.as_str())
        .ok_or("keyset has no seed")?;
    let seed_vec = b64_decode(seed_b64).ok_or("seed undecodable")?;
    let mut seed = Zeroizing::new([0u8; 32]);
    seed.copy_from_slice(&seed_vec);
    let vk_b64 = v
        .get("verifying_key_b64u")
        .and_then(|s| s.as_str())
        .ok_or("keyset has no verifying key")?;
    let vk = b64_decode(vk_b64).ok_or("verifying key undecodable")?;
    Ok((alg, seed, vk))
}

/// Load a KEM key: (alg, Zeroizing decapsulation seed, encapsulation key).
pub fn load_kem(
    key_id: &str,
    dir: Option<PathBuf>,
) -> Result<(KemAlg, Zeroizing<[u8; 64]>, Vec<u8>), String> {
    let dir = dir.unwrap_or_else(keys_dir);
    let text = fs::read_to_string(dir.join(format!("{key_id}.json")))
        .map_err(|_| format!("no key {key_id} in {}", dir.display()))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("keyset parse: {e}"))?;
    if v.get("kind").and_then(|k| k.as_str()) != Some("kem") {
        return Err(format!("{key_id} is not a kem key"));
    }
    let alg = KemAlg::parse(
        v.get("alg")
            .and_then(|a| a.as_str())
            .ok_or("keyset has no alg")?,
    )?;
    let seed_b64 = v
        .get("seed_b64u")
        .and_then(|s| s.as_str())
        .ok_or("keyset has no seed")?;
    let seed_vec = b64_decode(seed_b64).ok_or("seed undecodable")?;
    let mut seed = Zeroizing::new([0u8; 64]);
    seed.copy_from_slice(&seed_vec);
    let ek_b64 = v
        .get("encapsulation_key_b64u")
        .and_then(|s| s.as_str())
        .ok_or("keyset has no encapsulation key")?;
    let ek = b64_decode(ek_b64).ok_or("encapsulation key undecodable")?;
    Ok((alg, seed, ek))
}

/// List keysets: ids, kinds, algorithms. Never any secret material.
pub fn list_keys(dir: Option<PathBuf>) -> Value {
    let dir = dir.unwrap_or_else(keys_dir);
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            if e.path().extension().and_then(|x| x.to_str()) == Some("json") {
                if let Ok(text) = fs::read_to_string(e.path()) {
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        out.push(json!({
                            "key_id": v.get("key_id").cloned().unwrap_or(Value::Null),
                            "kind": v.get("kind").cloned().unwrap_or(Value::Null),
                            "alg": v.get("alg").cloned().unwrap_or(Value::Null),
                        }));
                    }
                }
            }
        }
    }
    json!({ "keys": out, "dir": dir.display().to_string() })
}

pub fn derive_key_id(alg_id: &str, public_material: &[u8]) -> String {
    let d = sha3_256_b64u(&[alg_id.as_bytes(), public_material].concat());
    format!("bheart-{}", &d[..16])
}

pub fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn now_iso() -> (String, u128) {
    let secs = now_ms() as i64 / 1000;
    let days = secs.div_euclid(86_400);
    let sod = secs.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (
        format!(
            "{y:04}-{:02}-{d:02}T{:02}:{:02}:{:02}Z",
            m,
            sod / 3600,
            (sod % 3600) / 60,
            sod % 60
        ),
        now_ms(),
    )
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

    fn temp_dir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("bheart-keys-test-{tag}"));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn keygen_output_carries_no_seed() {
        let dir = temp_dir("no-seed");
        let out = keygen_dsa(SigAlg::MlDsa65, Some(dir.clone())).unwrap();
        // the printed/public output must not contain the on-disk secret
        let disk =
            fs::read_to_string(dir.join(format!("{}.json", out["key_id"].as_str().unwrap())))
                .unwrap();
        let disk: Value = serde_json::from_str(&disk).unwrap();
        let seed = disk["seed_b64u"].as_str().unwrap();
        let printed = out.to_string();
        assert!(
            !printed.contains(seed),
            "NEVER PRINTED law broken: seed in keygen output"
        );
        assert!(
            out["verifying_key_b64u"].is_string(),
            "public key should be printed"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sign_with_generated_key_via_disk() {
        let dir = temp_dir("roundtrip");
        let out = keygen_dsa(SigAlg::MlDsa65, Some(dir.clone())).unwrap();
        let kid = out["key_id"].as_str().unwrap().to_string();
        let (alg, seed, vk) = load_dsa(&kid, Some(dir.clone())).unwrap();
        assert_eq!(alg, SigAlg::MlDsa65);
        let env =
            crate::envelope::sign_envelope(alg, &kid, &seed, b"hello from the deciding organ")
                .unwrap();
        assert!(
            crate::envelope::verify_envelope(&env, &vk, b"hello from the deciding organ").is_ok()
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn kem_keygen_roundtrip_via_disk() {
        let dir = temp_dir("kem");
        let out = keygen_kem(KemAlg::MlKem768, Some(dir.clone())).unwrap();
        let kid = out["key_id"].as_str().unwrap().to_string();
        let (alg, seed, ek) = load_kem(&kid, Some(dir.clone())).unwrap();
        assert_eq!(alg, KemAlg::MlKem768);
        let (ct, ss1) = pq::kem_encapsulate(alg, &ek).unwrap();
        let ss2 = pq::kem_decapsulate(alg, &seed, &ct).unwrap();
        assert_eq!(ss1, ss2);
        // public output clean again
        let printed = out.to_string();
        let disk = fs::read_to_string(dir.join(format!("{kid}.json"))).unwrap();
        let disk: Value = serde_json::from_str(&disk).unwrap();
        assert!(!printed.contains(disk["seed_b64u"].as_str().unwrap()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn listing_shows_no_secrets() {
        let dir = temp_dir("list");
        keygen_dsa(SigAlg::MlDsa44, Some(dir.clone())).unwrap();
        keygen_kem(KemAlg::MlKem512, Some(dir.clone())).unwrap();
        let l = list_keys(Some(dir.clone())).to_string();
        assert!(!l.contains("seed"));
        assert!(l.contains("ml-dsa-44"));
        assert!(l.contains("ml-kem-512"));
        let _ = fs::remove_dir_all(&dir);
    }
}
