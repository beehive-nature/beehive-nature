//! SPEC-BTUNGSTEN-PQ-1 PQ11: the classical algorithms the estate keeps by
//! design (A8 X25519, A10 ECDSA secp256k1, A11 BIP-340), on their official
//! vectors: bitcoin/bips bip-0340/test-vectors.csv and C2SP/wycheproof's
//! secp256k1 ECDSA and X25519 sets, pinned in `classic-manifest.json` by
//! commit, byte length and SHA-256, fetched, never committed.
//!
//! Implementations under test: k256 0.13.4 (bnr-keys and atmirror verify
//! secp256k1 ECDSA with it; it is the BIP-340 verifier the FROST backend of
//! PQ12 will run) and x25519-dalek 2.0.1 (bsigner's X-Wing classical half).

use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;

use crate::acvp::sha256_tag;
use crate::report::Report;

const MANIFEST: &str = include_str!("../classic-manifest.json");

/// A manifest file's bytes, from `cache` if they verify there, else fetched.
pub fn load(cache: &Path, name: &str) -> Result<Vec<u8>, String> {
    let m: Value = serde_json::from_str(MANIFEST).expect("classic-manifest.json parses");
    let e = m["files"]
        .as_array()
        .expect("files")
        .iter()
        .find(|f| f["name"] == name)
        .unwrap_or_else(|| panic!("{name} is not in classic-manifest.json"));
    let (url, want_len, want_sha) = (
        e["url"].as_str().expect("url"),
        e["bytes"].as_u64().expect("bytes") as usize,
        e["sha256"].as_str().expect("sha256"),
    );
    let check = |b: &[u8]| b.len() == want_len && sha256_tag(b) == want_sha;
    let path: PathBuf = cache.join("classic").join(name);
    if let Ok(b) = std::fs::read(&path) {
        if check(&b) {
            return Ok(b);
        }
    }
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("part");
    let st = Command::new("curl")
        .args(["-fsSL", "--retry", "3", "-o"])
        .arg(&tmp)
        .arg(url)
        .status()
        .map_err(|e| format!("curl {url}: {e}"))?;
    if !st.success() {
        return Err(format!("fetch failed: {url}"));
    }
    let b = std::fs::read(&tmp).map_err(|e| e.to_string())?;
    if !check(&b) {
        return Err(format!(
            "{name}: {} bytes {} does not match the manifest",
            b.len(),
            sha256_tag(&b)
        ));
    }
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(b)
}

fn unhex(s: &str) -> Vec<u8> {
    hex::decode(s).unwrap_or_else(|e| panic!("bad hex {s:?}: {e}"))
}

/// BIP-340 on k256: every row verifies as the CSV says; every row with a
/// secret key derives its public key and signs, with its aux_rand, to the
/// exact signature.
pub fn bip340(csv: &str, r: &mut Report) {
    use k256::schnorr::{Signature, SigningKey, VerifyingKey};
    let mut rows = 0;
    for line in csv.lines().skip(1).filter(|l| !l.trim().is_empty()) {
        let f: Vec<&str> = line.split(',').collect();
        let (idx, sk, pk, aux, msg, sig, want) =
            (f[0], f[1], f[2], f[3], f[4], f[5], f[6] == "TRUE");
        let tc: u64 = idx.parse().expect("index");
        rows += 1;
        let ok = VerifyingKey::from_bytes(&unhex(pk))
            .ok()
            .zip(Signature::try_from(unhex(sig).as_slice()).ok())
            .is_some_and(|(vk, s)| vk.verify_raw(&unhex(msg), &s).is_ok());
        r.record("BIP-340 verify", "k256", tc, ok == want);
        if !sk.is_empty() {
            let key = SigningKey::from_bytes(&unhex(sk)).expect("secret key");
            let aux: [u8; 32] = unhex(aux).try_into().expect("aux_rand");
            let made = key.sign_raw(&unhex(msg), &aux).expect("sign");
            let same = made.to_bytes().as_slice() == unhex(sig).as_slice()
                && key.verifying_key().to_bytes().as_slice() == unhex(pk).as_slice();
            r.record("BIP-340 sign", "k256", tc, same);
        }
    }
    assert!(rows > 0, "BIP-340 CSV yielded no rows (T-VACUOUS)");
}

/// Wycheproof ECDSA secp256k1 SHA-256 on k256's verifier. `valid` must
/// verify and `invalid` must not; `acceptable` is recorded either way.
/// Returns the tcIds where k256 refused a `valid` signature whose s is in
/// the upper half (the low-S policy k256 enforces), so the runner can say
/// so instead of counting them as plain failures.
pub fn ecdsa(doc: &Value, key: &str, r: &mut Report) -> Vec<u64> {
    use k256::ecdsa::signature::Verifier;
    use k256::ecdsa::{Signature, VerifyingKey};
    let mut high_s_refused = Vec::new();
    let mut n = 0;
    for g in doc["testGroups"].as_array().expect("testGroups") {
        let vk = VerifyingKey::from_sec1_bytes(&unhex(
            g["publicKey"]["uncompressed"].as_str().expect("key"),
        ));
        for t in g["tests"].as_array().expect("tests") {
            n += 1;
            let tc = t["tcId"].as_u64().unwrap();
            let result = t["result"].as_str().unwrap();
            let ok = vk.as_ref().ok().is_some_and(|vk| {
                Signature::from_der(&unhex(t["sig"].as_str().unwrap()))
                    .ok()
                    .is_some_and(|s| vk.verify(&unhex(t["msg"].as_str().unwrap()), &s).is_ok())
            });
            match result {
                "valid" if !ok => {
                    let high = Signature::from_der(&unhex(t["sig"].as_str().unwrap()))
                        .ok()
                        .is_some_and(|s| s.normalize_s().is_some());
                    if high {
                        high_s_refused.push(tc);
                        r.record(
                            &format!("{key} valid, high s (k256 low-S policy)"),
                            "k256",
                            tc,
                            true,
                        );
                    } else {
                        r.record(key, "k256", tc, false);
                    }
                }
                "valid" => r.record(key, "k256", tc, true),
                "invalid" => r.record(key, "k256", tc, !ok),
                _ => r.record(&format!("{key} acceptable"), "k256", tc, true),
            }
        }
    }
    assert!(n > 0, "{key}: no tests (T-VACUOUS)");
    high_s_refused
}

/// Wycheproof X25519 on x25519-dalek: every shared secret matches, including
/// the low-order points Wycheproof marks acceptable (dalek returns zeros).
pub fn x25519(doc: &Value, r: &mut Report) {
    use x25519_dalek::{PublicKey, StaticSecret};
    let mut n = 0;
    for g in doc["testGroups"].as_array().expect("testGroups") {
        for t in g["tests"].as_array().expect("tests") {
            n += 1;
            let tc = t["tcId"].as_u64().unwrap();
            let sk: [u8; 32] = unhex(t["private"].as_str().unwrap()).try_into().unwrap();
            let pk: [u8; 32] = unhex(t["public"].as_str().unwrap()).try_into().unwrap();
            let got = StaticSecret::from(sk).diffie_hellman(&PublicKey::from(pk));
            let same = got.as_bytes().as_slice() == unhex(t["shared"].as_str().unwrap()).as_slice();
            let key = match t["result"].as_str().unwrap() {
                "valid" => "X25519 valid",
                "acceptable" => "X25519 acceptable",
                other => panic!("X25519 tcId {tc}: result class {other} is not handled"),
            };
            r.record(key, "x25519-dalek", tc, same);
        }
    }
    assert!(n > 0, "X25519: no tests (T-VACUOUS)");
}
