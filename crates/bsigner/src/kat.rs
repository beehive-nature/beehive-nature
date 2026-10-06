//! NIST ACVP KNOWN-ANSWER VECTORS — ML-DSA-65 (FIPS 204) and ML-KEM-768
//! (FIPS 203), checked against the RustCrypto crates this organ signs and
//! seals with. Test-only: main.rs declares this module under `#[cfg(test)]`.
//!
//! The vectors are `surfaces/pq-kat.json`, a small named subset of
//! github.com/usnistgov/ACVP-Server `gen-val/json-files/` at the commit that
//! file records (built by `scripts/build-pq-kat.mjs`). The same file is
//! checked by @noble/post-quantum 0.7.1 in `e2e/pq-kat.test.mjs`: two
//! implementations, NIST's answers.
//!
//! # What runs, and through which door (cited at source)
//!
//! - ML-DSA-65 keyGen, tgId 2: `SigningKey::from_seed` — `ml-dsa` 0.1.1
//!   signing.rs:51-55 ("reflects the `ML-DSA.KeyGen_internal` algorithm from
//!   FIPS 204 (Algorithm 6)") — then `VerifyingKey::encode` (verifying.rs:158).
//!   Then the estate path: `pq::dsa_sign` from the ACVP seed, `pq::dsa_verify`
//!   against the ACVP public key.
//! - ML-DSA-65 sigVer, tgId 3 (external interface, pure, given context):
//!   `VerifyingKey::verify_with_context` — verifying.rs:130-131
//!   ("Implementation of Algorithm 3: `ML-DSA.Verify` from FIPS 204"). A
//!   signature that does not decode (`TryFrom<&[u8]>`, lib.rs:130-136, which
//!   runs sigDecode and the z bound, lib.rs:115-127) counts as refused. The
//!   cases with an empty context also run `pq::dsa_verify`, the estate path
//!   (`Verifier::verify`, empty context, verifying.rs:195-205).
//! - ML-KEM-768 keyGen, tgId 2: `DecapsulationKey::from_seed(d || z)` —
//!   `ml-kem` 0.3.2 decapsulation_key.rs:51, the constructor pq.rs and
//!   bpq.rs:173 (inside X-Wing) use — then the encapsulation key
//!   (`KeyExport::to_bytes`, encapsulation_key.rs:91) and the expanded
//!   decapsulation key (`ExpandedKeyEncoding::to_expanded_bytes`,
//!   decapsulation_key.rs:276). Then the estate path: `pq::kem_encapsulate`
//!   to the ACVP ek, `pq::kem_decapsulate` with the 64-byte seed d || z.
//! - ML-KEM-768 decapsulation, tgId 5: ACVP publishes only the expanded
//!   2400-byte dk for this function, so the key is read with
//!   `DecapsulationKey::from_expanded` (decapsulation_key.rs:63-64) and
//!   decapsulated with `Decapsulate::decapsulate` (decapsulation_key.rs:168-178).
//!   The estate never holds an expanded key (it keeps the seed), so these
//!   cases check the crate's Decaps, not the estate's key storage.
//!
//! `ml-kem` 0.3.2 marks the expanded form deprecated (decapsulation_key.rs:63
//! and :250). Both uses below (`to_expanded_bytes`, `from_expanded`) are
//! deliberate. `cargo test` prints three deprecation warnings for them (the
//! trait import, its method, `from_expanded`); they are left standing,
//! because they are true.
//!
//! What does NOT run is listed under `notIncluded` in surfaces/pq-kat.json.

use ml_dsa::{EncodedVerifyingKey, Keypair, MlDsa65, Signature, SigningKey, VerifyingKey};
use ml_kem::kem::{Decapsulate, KeyExport};
use ml_kem::{
    Ciphertext, DecapsulationKey, ExpandedDecapsulationKey, ExpandedKeyEncoding, MlKem768,
};
use serde_json::Value;

use crate::alg::{KemAlg, SigAlg};
use crate::b64::{b64u, b64u_decode};
use crate::pq;

const KAT: &str = include_str!("../../../surfaces/pq-kat.json");

fn kat() -> Value {
    serde_json::from_str(KAT).expect("pq-kat.json parses")
}

/// The cases of one section, after checking each carries the group's tgId.
fn cases<'a>(v: &'a Value, alg: &str, section: &str) -> &'a [Value] {
    let s = &v[alg][section];
    let list = s["cases"]
        .as_array()
        .unwrap_or_else(|| panic!("{alg}.{section}.cases"));
    assert!(list.len() >= 3, "{alg}.{section}: at least 3 cases");
    for c in list {
        assert_eq!(c["tgId"], s["tgId"], "{alg}.{section} tcId {}", c["tcId"]);
        assert!(
            c["tcId"].is_u64(),
            "{alg}.{section}: every case names its tcId"
        );
    }
    list
}

fn bytes(case: &Value, field: &str) -> Vec<u8> {
    let s = case[field]
        .as_str()
        .unwrap_or_else(|| panic!("tcId {}: no {field}", case["tcId"]));
    b64u_decode(s).unwrap_or_else(|| panic!("tcId {}: {field} is not base64url", case["tcId"]))
}

fn flipped(b: &[u8]) -> Vec<u8> {
    let mut c = b.to_vec();
    c[0] ^= 1;
    c
}

fn dsa65_public_key(seed: [u8; 32]) -> Vec<u8> {
    let seed: ml_dsa::Seed = seed.into();
    SigningKey::<MlDsa65>::from_seed(&seed) // signing.rs:55
        .verifying_key()
        .encode() // verifying.rs:158
        .to_vec()
}

/// ML-DSA.Verify with a context string; a signature that does not decode is a refusal.
fn dsa65_verify_with_context(pk: &[u8], msg: &[u8], ctx: &[u8], sig: &[u8]) -> bool {
    let enc = EncodedVerifyingKey::<MlDsa65>::try_from(pk).expect("1952-byte public key");
    let vk = VerifyingKey::<MlDsa65>::decode(&enc); // verifying.rs:165
    match Signature::<MlDsa65>::try_from(sig) {
        // lib.rs:130-136
        Ok(sig) => vk.verify_with_context(msg, ctx, &sig), // verifying.rs:131
        Err(e) => {
            assert_eq!(
                sig.len(),
                3309,
                "a wrong-length signature is a bad vector: {e}"
            );
            false
        }
    }
}

#[test]
fn kat_file_names_its_nist_source() {
    let v = kat();
    assert_eq!(v["kat"], 1);
    assert_eq!(
        v["source"]["repo"],
        "https://github.com/usnistgov/ACVP-Server"
    );
    let commit = v["source"]["commit"].as_str().unwrap();
    assert!(commit.len() == 40 && commit.bytes().all(|b| b.is_ascii_hexdigit()));
    for f in v["source"]["files"].as_array().unwrap() {
        assert!(f["url"].as_str().unwrap().contains(commit), "{}", f["path"]);
    }
    let sv = &v["mlDsa65"]["sigVer"];
    assert_eq!(sv["parameterSet"], "ML-DSA-65");
    assert_eq!(sv["signatureInterface"], "external");
    assert_eq!(sv["preHash"], "pure");
    assert_eq!(sv["externalMu"], false);
    assert_eq!(v["mlDsa65"]["keyGen"]["parameterSet"], "ML-DSA-65");
    assert_eq!(v["mlKem768"]["keyGen"]["parameterSet"], "ML-KEM-768");
    assert_eq!(v["mlKem768"]["decapsulation"]["parameterSet"], "ML-KEM-768");
    assert_eq!(v["mlKem768"]["decapsulation"]["function"], "decapsulation");
}

#[test]
fn kat_ml_dsa_65_keygen_seed_to_public_key() {
    let v = kat();
    for c in cases(&v, "mlDsa65", "keyGen") {
        let seed: [u8; 32] = bytes(c, "seed").try_into().expect("32-byte seed");
        let pk = bytes(c, "pk");
        assert_eq!(
            b64u(&dsa65_public_key(seed)),
            b64u(&pk),
            "tcId {}",
            c["tcId"]
        );

        // the estate path: pq.rs signs from NIST's seed; NIST's key verifies it
        let msg = b"pq-kat: estate path from an ACVP seed";
        let sig = pq::dsa_sign(SigAlg::MlDsa65, &seed, msg).unwrap();
        assert_eq!(
            pq::dsa_verify(SigAlg::MlDsa65, &pk, msg, &sig),
            Ok(true),
            "tcId {} estate path",
            c["tcId"]
        );

        // control: a different seed must not land on the same key
        let mut other = seed;
        other[0] ^= 1;
        assert_ne!(dsa65_public_key(other), pk, "tcId {} control", c["tcId"]);
    }
}

#[test]
fn kat_ml_dsa_65_sigver_external_pure() {
    let v = kat();
    let (mut accepted, mut refused, mut estate_path) = (0, 0, 0);
    for c in cases(&v, "mlDsa65", "sigVer") {
        let expected = c["testPassed"].as_bool().expect("testPassed");
        let (pk, msg, ctx, sig) = (
            bytes(c, "pk"),
            bytes(c, "message"),
            bytes(c, "context"),
            bytes(c, "signature"),
        );
        assert_eq!(
            dsa65_verify_with_context(&pk, &msg, &ctx, &sig),
            expected,
            "tcId {}: {}",
            c["tcId"],
            c["reason"]
        );
        if expected {
            accepted += 1;
            // control: the same signature over a changed message or context is refused
            assert!(!dsa65_verify_with_context(&pk, &flipped(&msg), &ctx, &sig));
            assert!(!dsa65_verify_with_context(&pk, &msg, &flipped(&ctx), &sig));
        } else {
            refused += 1;
        }
        if ctx.is_empty() {
            estate_path += 1;
            match pq::dsa_verify(SigAlg::MlDsa65, &pk, &msg, &sig) {
                Ok(ok) => assert_eq!(ok, expected, "tcId {} estate path", c["tcId"]),
                Err(e) => assert!(
                    !expected,
                    "tcId {} estate path refused a good signature: {e}",
                    c["tcId"]
                ),
            }
        }
    }
    assert!(accepted >= 1 && refused >= 1, "both verdicts are exercised");
    assert!(
        estate_path >= 1,
        "at least one empty-context case runs pq::dsa_verify"
    );
}

#[test]
fn kat_ml_kem_768_keygen_seed_to_keys() {
    let v = kat();
    for c in cases(&v, "mlKem768", "keyGen") {
        let (d, z, ek) = (bytes(c, "d"), bytes(c, "z"), bytes(c, "ek"));
        let mut seed = [0u8; 64];
        seed[..32].copy_from_slice(&d);
        seed[32..].copy_from_slice(&z);
        let key = DecapsulationKey::<MlKem768>::from_seed(seed.into()); // decapsulation_key.rs:51
        assert_eq!(
            b64u(&key.encapsulation_key().to_bytes()),
            c["ek"].as_str().unwrap(),
            "tcId {} ek",
            c["tcId"]
        );
        // deprecated trait (decapsulation_key.rs:250), used on purpose: ACVP's dk is the expanded form
        assert_eq!(
            b64u(&key.to_expanded_bytes()),
            c["dk"].as_str().unwrap(),
            "tcId {} dk",
            c["tcId"]
        );

        // the estate path: encapsulate to NIST's ek, open with the d || z seed
        let (ct, ss) = pq::kem_encapsulate(KemAlg::MlKem768, &ek).unwrap();
        assert_eq!(
            pq::kem_decapsulate(KemAlg::MlKem768, &seed, &ct).unwrap(),
            ss,
            "tcId {} estate path",
            c["tcId"]
        );

        // control: a different d must not land on the same ek
        seed[0] ^= 1;
        let other = DecapsulationKey::<MlKem768>::from_seed(seed.into());
        assert_ne!(
            other.encapsulation_key().to_bytes().to_vec(),
            ek,
            "tcId {} control",
            c["tcId"]
        );
    }
}

#[test]
fn kat_ml_kem_768_decapsulation_expanded_key() {
    let v = kat();
    for c in cases(&v, "mlKem768", "decapsulation") {
        let (dk, ct) = (bytes(c, "dk"), bytes(c, "c"));
        let dk =
            ExpandedDecapsulationKey::<MlKem768>::try_from(dk.as_slice()).expect("2400-byte dk");
        // deprecated (decapsulation_key.rs:63-64), used on purpose: ACVP gives no seed here
        let key =
            DecapsulationKey::<MlKem768>::from_expanded(&dk).expect("dk passes its H(ek) check");
        let ct_arr = Ciphertext::<MlKem768>::try_from(ct.as_slice()).expect("1088-byte c");
        assert_eq!(
            b64u(&key.decapsulate(&ct_arr)), // decapsulation_key.rs:172
            c["k"].as_str().unwrap(),
            "tcId {}: {}",
            c["tcId"],
            c["reason"]
        );

        // control: one flipped ciphertext bit yields a different key
        let bad = Ciphertext::<MlKem768>::try_from(flipped(&ct).as_slice()).unwrap();
        assert_ne!(
            b64u(&key.decapsulate(&bad)),
            c["k"].as_str().unwrap(),
            "tcId {} control",
            c["tcId"]
        );
    }
}
