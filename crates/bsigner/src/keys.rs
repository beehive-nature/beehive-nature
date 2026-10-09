//! KEYS — on-device, never leaving, never printed, sealed at rest.
//!
//! The laws, and how each is held:
//!
//! - KEYS NEVER LEAVE: generation uses OS entropy on THIS device
//!   (crypto-common generate.rs:43 for ML-DSA; kem lib.rs:126 for ML-KEM);
//!   storage is a key file under the install home (~/.bheartwallet/
//!   bsigner/keys); no network code exists in this crate at all.
//! - NEVER PRINTED: every function that touches a seed returns/prints only
//!   key ids, algorithm ids, and public material. The test
//!   `keygen_output_carries_no_seed` holds the law mechanically.
//! - SEALED AT REST (SPEC-BTUNGSTEN-PQ-1 §PQ09): the seed reaches disk only
//!   inside a SPEC-BPQ-1 sealed object for "only me": one `self` slot under
//!   the root vault key of the owner's recovery words (`bpq::root_vault`), so
//!   the at-rest format is the one the sealed-object decoder already reads,
//!   with no public-key step. A key file is `bheart.keyset/2`. A
//!   `bheart.keyset/1` file (plaintext seed, written before 2026-10-08) is
//!   refused everywhere except `bsigner keys-seal`, which reseals it. The test
//!   `no_seed_byte_reaches_disk` scans every written file.
//! - ZEROIZED: seeds live in `Zeroizing` buffers on the way in and out.
//!   Rewriting a file does not erase the disk blocks its old bytes sat in.
//!
//! Key files are JSON with base64url bodies (never bare hex — beehive
//! pre-commit hex law) and a standing `law` field so the file explains
//! itself wherever it lands.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use zeroize::Zeroizing;

use crate::alg::{KemAlg, SigAlg};
use crate::b64::{b64u, sha3_256_b64u};
use crate::{bpq, pq};

const KEYSET_SEALED: &str = "bheart.keyset/2";
const KEYSET_PLAINTEXT: &str = "bheart.keyset/1";
const LAW: &str = "keys never leave this device; never printed; the seed is on disk only inside the sealed object";
const AT_REST: &str = "bpq1 sealed object (SPEC-BPQ-1 §4), one self slot under the root vault of the owner's recovery words (SPEC-BTUNGSTEN-PQ-1 §PQ09)";

/// The root vault key of the owner's recovery words: the only key that
/// opens a sealed key file.
pub struct Vault(Zeroizing<[u8; 32]>);

impl Vault {
    /// From a `bdidrec1…` recovery code.
    pub fn from_recovery_code(code: &str) -> Result<Self, String> {
        let prk = bpq::master_prk_from_recovery_code(code).map_err(|e| e.to_string())?;
        Ok(Self(bpq::root_vault(&prk)))
    }

    /// From the recovery code in the environment variable `var` (never
    /// from argv, never printed: the `--rec-env` convention of bpq-open).
    pub fn from_env(var: &str) -> Result<Self, String> {
        let code = Zeroizing::new(
            std::env::var(var).map_err(|_| format!("environment variable {var} is not set"))?,
        );
        Self::from_recovery_code(&code)
    }

    pub fn key(&self) -> &[u8; 32] {
        &self.0
    }

    #[cfg(test)]
    pub fn for_tests(byte: u8) -> Self {
        Self(Zeroizing::new([byte; 32]))
    }
}

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

/// Write a file whole or not at all: a temporary file, then a rename.
fn write_atomically(path: &Path, text: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| format!("write keyset: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("write keyset: {e}"))
}

/// The sealed key file: public material in clear, the seed only sealed.
fn sealed_keyset(
    kind: &str,
    alg: &str,
    key_id: &str,
    public_field: &str,
    public: &[u8],
    seed: &[u8],
    vault: &Vault,
) -> Value {
    let sealed = bpq::seal_self(seed, vault.key());
    let mut v = json!({
        "type": KEYSET_SEALED,
        "kind": kind,
        "alg": alg,
        "key_id": key_id,
        "created_ms": now_ms(),
        "sealed_b64u": b64u(&sealed),
        "secret": true,
        "law": LAW,
        "at_rest": AT_REST,
    });
    v[public_field] = Value::String(b64u(public));
    v
}

/// Generate + persist an ML-DSA identity. Returns PUBLIC info + key_id only.
pub fn keygen_dsa(alg: SigAlg, dir: Option<PathBuf>, vault: &Vault) -> Result<Value, String> {
    let g = pq::dsa_generate(alg);
    let key_id = derive_key_id(alg.id(), &g.verifying_key);
    let dir = dir.unwrap_or_else(keys_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("keys dir: {e}"))?;
    let file = sealed_keyset(
        "signature",
        alg.id(),
        &key_id,
        "verifying_key_b64u",
        &g.verifying_key,
        &g.seed,
        vault,
    );
    write_atomically(&dir.join(format!("{key_id}.json")), &file.to_string())?;
    Ok(json!({
        "key_id": key_id,
        "kind": "signature",
        "alg": alg.id(),
        "verifying_key_b64u": b64u(&g.verifying_key),
        "verifying_key_bytes": g.verifying_key.len(),
        "keys_dir": dir.display().to_string(),
        "at_rest": AT_REST,
    }))
}

/// Generate + persist an ML-KEM pair. Same laws.
pub fn keygen_kem(alg: KemAlg, dir: Option<PathBuf>, vault: &Vault) -> Result<Value, String> {
    let g = pq::kem_generate(alg)?;
    let key_id = derive_key_id(alg.id(), &g.encapsulation_key);
    let dir = dir.unwrap_or_else(keys_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("keys dir: {e}"))?;
    let file = sealed_keyset(
        "kem",
        alg.id(),
        &key_id,
        "encapsulation_key_b64u",
        &g.encapsulation_key,
        &g.seed,
        vault,
    );
    write_atomically(&dir.join(format!("{key_id}.json")), &file.to_string())?;
    Ok(json!({
        "key_id": key_id,
        "kind": "kem",
        "alg": alg.id(),
        "encapsulation_key_b64u": b64u(&g.encapsulation_key),
        "encapsulation_key_bytes": g.encapsulation_key.len(),
        "keys_dir": dir.display().to_string(),
        "at_rest": AT_REST,
    }))
}

fn read_keyset(key_id: &str, dir: &Path, kind: &str) -> Result<Value, String> {
    let text = fs::read_to_string(dir.join(format!("{key_id}.json")))
        .map_err(|_| format!("no key {key_id} in {}", dir.display()))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("keyset parse: {e}"))?;
    if v.get("kind").and_then(|k| k.as_str()) != Some(kind) {
        return Err(format!("{key_id} is not a {kind} key"));
    }
    match v.get("type").and_then(|t| t.as_str()) {
        Some(KEYSET_SEALED) => Ok(v),
        Some(KEYSET_PLAINTEXT) => Err(format!(
            "{key_id} is a plaintext key file ({KEYSET_PLAINTEXT}); seal it first: bsigner keys-seal --key-id {key_id} --rec-env VAR"
        )),
        other => Err(format!("{key_id}: unknown keyset type {other:?}, refused rather than guessed")),
    }
}

fn public_bytes(v: &Value, field: &str) -> Result<Vec<u8>, String> {
    let s = v
        .get(field)
        .and_then(|s| s.as_str())
        .ok_or_else(|| format!("keyset has no {field}"))?;
    b64_decode(s).ok_or_else(|| format!("{field} undecodable"))
}

fn open_seed<const N: usize>(v: &Value, vault: &Vault) -> Result<Zeroizing<[u8; N]>, String> {
    let s = v
        .get("sealed_b64u")
        .and_then(|s| s.as_str())
        .ok_or("keyset has no sealed seed")?;
    let obj = b64_decode(s).ok_or("sealed seed undecodable")?;
    let opened = bpq::open(&obj, &bpq::Reader::SelfVault(vault.key()))
        .map_err(|_| "these recovery words do not open this key".to_string())?;
    let bytes = Zeroizing::new(opened.bytes);
    if bytes.len() != N {
        return Err(format!(
            "sealed seed is {} bytes, expected {N}",
            bytes.len()
        ));
    }
    let mut seed = Zeroizing::new([0u8; N]);
    seed.copy_from_slice(&bytes);
    Ok(seed)
}

/// Load a signature key: (alg, Zeroizing seed, verifying key bytes).
pub fn load_dsa(
    key_id: &str,
    dir: Option<PathBuf>,
    vault: &Vault,
) -> Result<(SigAlg, Zeroizing<[u8; 32]>, Vec<u8>), String> {
    let v = read_keyset(key_id, &dir.unwrap_or_else(keys_dir), "signature")?;
    let alg = SigAlg::parse(
        v.get("alg")
            .and_then(|a| a.as_str())
            .ok_or("keyset has no alg")?,
    )?;
    Ok((
        alg,
        open_seed(&v, vault)?,
        public_bytes(&v, "verifying_key_b64u")?,
    ))
}

/// The public half of a signature key, without unlocking anything.
pub fn load_dsa_public(key_id: &str, dir: Option<PathBuf>) -> Result<(SigAlg, Vec<u8>), String> {
    let v = read_keyset(key_id, &dir.unwrap_or_else(keys_dir), "signature")?;
    let alg = SigAlg::parse(
        v.get("alg")
            .and_then(|a| a.as_str())
            .ok_or("keyset has no alg")?,
    )?;
    Ok((alg, public_bytes(&v, "verifying_key_b64u")?))
}

/// Load a KEM key: (alg, Zeroizing decapsulation seed, encapsulation key).
pub fn load_kem(
    key_id: &str,
    dir: Option<PathBuf>,
    vault: &Vault,
) -> Result<(KemAlg, Zeroizing<[u8; 64]>, Vec<u8>), String> {
    let v = read_keyset(key_id, &dir.unwrap_or_else(keys_dir), "kem")?;
    let alg = KemAlg::parse(
        v.get("alg")
            .and_then(|a| a.as_str())
            .ok_or("keyset has no alg")?,
    )?;
    Ok((
        alg,
        open_seed(&v, vault)?,
        public_bytes(&v, "encapsulation_key_b64u")?,
    ))
}

/// Reseal a `bheart.keyset/1` plaintext file as `bheart.keyset/2`, in
/// place. The one path that reads a plaintext seed.
pub fn seal_plaintext(key_id: &str, dir: Option<PathBuf>, vault: &Vault) -> Result<Value, String> {
    let dir = dir.unwrap_or_else(keys_dir);
    let path = dir.join(format!("{key_id}.json"));
    let text = Zeroizing::new(
        fs::read_to_string(&path).map_err(|_| format!("no key {key_id} in {}", dir.display()))?,
    );
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("keyset parse: {e}"))?;
    if v.get("type").and_then(|t| t.as_str()) != Some(KEYSET_PLAINTEXT) {
        return Err(format!(
            "{key_id} is not a plaintext key file; nothing to seal"
        ));
    }
    let seed = Zeroizing::new(
        b64_decode(
            v.get("seed_b64u")
                .and_then(|s| s.as_str())
                .ok_or("keyset has no seed")?,
        )
        .ok_or("seed undecodable")?,
    );
    let kind = v
        .get("kind")
        .and_then(|k| k.as_str())
        .ok_or("keyset has no kind")?;
    let alg = v
        .get("alg")
        .and_then(|a| a.as_str())
        .ok_or("keyset has no alg")?;
    let public_field = match kind {
        "signature" => "verifying_key_b64u",
        "kem" => "encapsulation_key_b64u",
        other => return Err(format!("unknown kind {other:?}")),
    };
    let public = public_bytes(&v, public_field)?;
    let mut sealed = sealed_keyset(kind, alg, key_id, public_field, &public, &seed, vault);
    if let Some(c) = v.get("created_ms") {
        sealed["created_ms"] = c.clone();
    }
    write_atomically(&path, &sealed.to_string())?;
    Ok(json!({ "key_id": key_id, "kind": kind, "alg": alg, "sealed": true, "at_rest": AT_REST }))
}

/// List keysets: ids, kinds, algorithms, and whether each is sealed. Never
/// any secret material.
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
                            "sealed": v.get("type").and_then(|t| t.as_str()) == Some(KEYSET_SEALED),
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

    fn contains(hay: &[u8], needle: &[u8]) -> bool {
        hay.windows(needle.len()).any(|w| w == needle)
    }

    #[test]
    fn keygen_output_carries_no_seed() {
        let dir = temp_dir("no-seed");
        let vault = Vault::for_tests(0x11);
        let out = keygen_dsa(SigAlg::MlDsa65, Some(dir.clone()), &vault).unwrap();
        let kid = out["key_id"].as_str().unwrap();
        let (_, seed, _) = load_dsa(kid, Some(dir.clone()), &vault).unwrap();
        let printed = out.to_string();
        assert!(
            !printed.contains(&b64u(&seed[..])),
            "NEVER PRINTED law broken: seed in keygen output"
        );
        assert!(
            out["verifying_key_b64u"].is_string(),
            "public key should be printed"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    // TEETH of the at-rest law: every byte written under the key dir is
    // scanned for the seed in raw, base64url and hex form.
    #[test]
    fn no_seed_byte_reaches_disk() {
        let dir = temp_dir("at-rest");
        let vault = Vault::for_tests(0x22);
        let dsa = keygen_dsa(SigAlg::MlDsa87, Some(dir.clone()), &vault).unwrap();
        let kem = keygen_kem(KemAlg::MlKem1024, Some(dir.clone()), &vault).unwrap();
        let (_, s1, _) =
            load_dsa(dsa["key_id"].as_str().unwrap(), Some(dir.clone()), &vault).unwrap();
        let (_, s2, _) =
            load_kem(kem["key_id"].as_str().unwrap(), Some(dir.clone()), &vault).unwrap();
        let hex = |b: &[u8]| b.iter().map(|x| format!("{x:02x}")).collect::<String>();
        let mut scanned = 0;
        for e in fs::read_dir(&dir).unwrap().flatten() {
            let bytes = fs::read(e.path()).unwrap();
            for seed in [&s1[..], &s2[..]] {
                assert!(
                    !contains(&bytes, seed),
                    "raw seed on disk in {:?}",
                    e.path()
                );
                assert!(
                    !contains(&bytes, b64u(seed).as_bytes()),
                    "base64url seed on disk"
                );
                assert!(!contains(&bytes, hex(seed).as_bytes()), "hex seed on disk");
            }
            scanned += 1;
        }
        assert_eq!(
            scanned, 2,
            "both key files scanned, and no stray temporary file"
        );
        // the scan sees a plaintext file: a keyset/1 written the old way is caught
        let legacy = dir.join("legacy.json");
        fs::write(
            &legacy,
            json!({"type": KEYSET_PLAINTEXT, "seed_b64u": b64u(&s1[..])}).to_string(),
        )
        .unwrap();
        assert!(
            contains(&fs::read(&legacy).unwrap(), b64u(&s1[..]).as_bytes()),
            "the scan would convict a plaintext write"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sign_with_generated_key_via_disk() {
        let dir = temp_dir("roundtrip");
        let vault = Vault::for_tests(0x33);
        let out = keygen_dsa(SigAlg::MlDsa65, Some(dir.clone()), &vault).unwrap();
        let kid = out["key_id"].as_str().unwrap().to_string();
        let (alg, seed, vk) = load_dsa(&kid, Some(dir.clone()), &vault).unwrap();
        assert_eq!(alg, SigAlg::MlDsa65);
        let env =
            crate::envelope::sign_envelope(alg, &kid, &seed, b"hello from the deciding organ")
                .unwrap();
        assert!(
            crate::envelope::verify_envelope(&env, &vk, b"hello from the deciding organ").is_ok()
        );
        let (alg2, vk2) = load_dsa_public(&kid, Some(dir.clone())).unwrap();
        assert_eq!((alg2, vk2), (alg, vk), "the public half needs no unlock");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_wrong_words_or_a_tampered_file_open_nothing() {
        let dir = temp_dir("wrong");
        let vault = Vault::for_tests(0x44);
        let out = keygen_dsa(SigAlg::MlDsa44, Some(dir.clone()), &vault).unwrap();
        let kid = out["key_id"].as_str().unwrap().to_string();
        let err = load_dsa(&kid, Some(dir.clone()), &Vault::for_tests(0x45)).unwrap_err();
        assert!(err.contains("do not open"), "{err}");
        let path = dir.join(format!("{kid}.json"));
        let mut v: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        let mut sealed = b64_decode(v["sealed_b64u"].as_str().unwrap()).unwrap();
        let last = sealed.len() - 6; // inside the body's tag
        sealed[last] ^= 1;
        v["sealed_b64u"] = Value::String(b64u(&sealed));
        fs::write(&path, v.to_string()).unwrap();
        assert!(
            load_dsa(&kid, Some(dir.clone()), &vault).is_err(),
            "a tampered sealed seed must not open"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn kem_keygen_roundtrip_via_disk() {
        let dir = temp_dir("kem");
        let vault = Vault::for_tests(0x55);
        let out = keygen_kem(KemAlg::MlKem768, Some(dir.clone()), &vault).unwrap();
        let kid = out["key_id"].as_str().unwrap().to_string();
        let (alg, seed, ek) = load_kem(&kid, Some(dir.clone()), &vault).unwrap();
        assert_eq!(alg, KemAlg::MlKem768);
        let (ct, ss1) = pq::kem_encapsulate(alg, &ek).unwrap();
        let ss2 = pq::kem_decapsulate(alg, &seed, &ct).unwrap();
        assert_eq!(ss1, ss2);
        assert!(!out.to_string().contains(&b64u(&seed[..])));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_plaintext_key_file_is_refused_until_resealed() {
        let dir = temp_dir("legacy");
        fs::create_dir_all(&dir).unwrap();
        let vault = Vault::for_tests(0x66);
        let g = pq::dsa_generate(SigAlg::MlDsa65);
        let kid = derive_key_id("ml-dsa-65", &g.verifying_key);
        let v1 = json!({
            "type": KEYSET_PLAINTEXT, "kind": "signature", "alg": "ml-dsa-65", "key_id": kid,
            "created_ms": 1u64, "seed_b64u": b64u(&g.seed), "verifying_key_b64u": b64u(&g.verifying_key),
        });
        fs::write(dir.join(format!("{kid}.json")), v1.to_string()).unwrap();
        let err = load_dsa(&kid, Some(dir.clone()), &vault).unwrap_err();
        assert!(err.contains("keys-seal"), "{err}");
        assert!(
            load_dsa_public(&kid, Some(dir.clone())).is_err(),
            "refused everywhere, not only for signing"
        );
        let out = seal_plaintext(&kid, Some(dir.clone()), &vault).unwrap();
        assert_eq!(out["sealed"], true);
        let disk = fs::read(dir.join(format!("{kid}.json"))).unwrap();
        assert!(
            !contains(&disk, b64u(&g.seed).as_bytes()),
            "the resealed file carries no plaintext seed"
        );
        let (_, seed, vk) = load_dsa(&kid, Some(dir.clone()), &vault).unwrap();
        assert_eq!((&seed[..], vk), (&g.seed[..], g.verifying_key.clone()));
        assert!(
            seal_plaintext(&kid, Some(dir.clone()), &vault).is_err(),
            "nothing left to seal"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn listing_shows_no_secrets() {
        let dir = temp_dir("list");
        let vault = Vault::for_tests(0x77);
        keygen_dsa(SigAlg::MlDsa44, Some(dir.clone()), &vault).unwrap();
        keygen_kem(KemAlg::MlKem512, Some(dir.clone()), &vault).unwrap();
        let l = list_keys(Some(dir.clone())).to_string();
        assert!(!l.contains("seed") && !l.contains("sealed_b64u"));
        assert!(l.contains("ml-dsa-44") && l.contains("ml-kem-512"));
        assert!(l.contains("\"sealed\":true"));
        let _ = fs::remove_dir_all(&dir);
    }
}
