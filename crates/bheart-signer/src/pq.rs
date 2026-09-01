//! POST-QUANTUM PRIMITIVES — ML-DSA signatures and ML-KEM encapsulation.
//!
//! # CRYPTO CLAIMS, CITED AT SOURCE (the lane law)
//!
//! Every claim below is checked against the crate sources vendored by
//! Cargo.lock, at the paths given. Anything not cited here is not claimed.
//!
//! ## ML-DSA (FIPS 204)
//!
//! - Claim: this is ML-DSA "as described in the FIPS 204 (final)".
//!   Source: `ml-dsa` 0.1.1 README.md, "Pure Rust implementation of the
//!   Module-Lattice-Based Digital Signature Standard (ML-DSA) as described
//!   in the [FIPS 204] (final)."
//! - Claim: MlDsa65 is security category 3 (~192-bit).
//!   Source: `ml-dsa` 0.1.1 src/lib.rs:217-222 (`pub struct MlDsa65`).
//! - Keygen: `SigningKey::<P>::generate()` — blanket from
//!   `crypto-common` 0.2.2 src/generate.rs:43 (`fn generate()`), reached via
//!   the getrandom feature; OS entropy, on this device.
//! - Seed law: ML-DSA private keys serialize as a 32-byte seed.
//!   Source: `ml-dsa` 0.1.1 src/lib.rs ("ML-DSA seeds are signing (private)
//!   keys, which are consistently 32-bytes across all security levels, and
//!   are the preferred serialization"); `signing.rs:55` (`from_seed`),
//!   `signing.rs:102` (`as_seed`).
//! - Signing: `Signer::try_sign` — `ml-dsa` 0.1.1 src/signing.rs:184
//!   (`fn try_sign(&self, msg: &[u8])`). Randomized per FIPS 204 §5; the
//!   randomness is consumed inside the crate.
//! - Verifying: `Verifier::verify` — `ml-dsa` 0.1.1 src/verifying.rs:195
//!   (`fn verify(&self, msg, signature)`).
//!
//! ## ML-KEM (FIPS 203)
//!
//! - Claim: this is ML-KEM "as described in the FIPS 203 (final)"
//!   (formerly Kyber).
//!   Source: `ml-kem` 0.3.2 README.md, same wording.
//! - Keypair: `Kem::generate_keypair()` — `kem` 0.3 src/lib.rs:126.
//! - Decapsulation-key serialization: 64-byte seed.
//!   Source: `ml-kem` 0.3.2 src/decapsulation_key.rs:231 (`KeyExport::
//!   to_bytes -> Seed`), :51 (`from_seed`).
//! - Encapsulate: `Encapsulate::encapsulate() -> (Ciphertext, SharedKey)`
//!   — `kem` 0.3 src/lib.rs:248; the ml-kem side is
//!   `encapsulation_key.rs:78` (`encapsulate_with_rng`).
//! - Decapsulate: `Decapsulate::decapsulate() -> SharedKey`
//!   — `kem` 0.3 src/lib.rs:180.
//! - Encapsulation-key parse from bytes:
//!   `ml-kem` 0.3.2 src/encapsulation_key.rs:32 (`EncapsulationKey::new`).
//!
//! ## WARNINGS, CARRIED FORWARD VERBATIM FROM SOURCE
//!
//! - `ml-dsa` 0.1.1 README: "The implementation contained in this crate has
//!   never been independently audited! USE AT YOUR OWN RISK!"
//! - `ml-kem` 0.3.2 README: "The implementation contained in this crate has
//!   never been independently audited!" (same warning family)
//! - Neither claim above says anything about NIST ACVP known-answer
//!   vectors; those have NOT been run in this repo. UNVERIFIED.
//! - Key storage here is a seed file under the user profile with OS file
//!   permissions; at-rest encryption is a follow-up, NOT done. The laws that
//!   DO hold today: keys never leave the device, never printed, zeroized in
//!   memory after use.
//!
//! ## INDEPENDENCE (the binding law)
//!
//! This crate imports no banchor code, directly or transitively. The wallet
//! works fully with the anchor off. Grep this file's manifest: no `banchor`.

use ml_dsa::{
    Keypair, MlDsa44, MlDsa65, MlDsa87, Seed as DsaSeed, SignatureEncoding, SigningKey, Signer,
    Verifier,
};
use ml_kem::{
    kem::{Decapsulate, Encapsulate, Generate, KeyExport},
    MlKem512, MlKem768,
};

use crate::alg::{KemAlg, SigAlg};

/// A generated ML-DSA identity: 32-byte seed (SECRET) + encoded verifying key (PUBLIC).
pub struct DsaGenerated {
    pub seed: [u8; 32],
    pub verifying_key: Vec<u8>,
}

pub fn dsa_generate(alg: SigAlg) -> DsaGenerated {
    macro_rules! gen {
        ($params:ty) => {{
            // crypto-common 0.2.2 generate.rs:43 — OS entropy, on-device
            let sk = SigningKey::<$params>::generate();
            let mut seed = [0u8; 32];
            seed.copy_from_slice(sk.as_seed().as_slice()); // ml-dsa signing.rs:102
            let vk = sk.verifying_key().encode().to_vec(); // Keypair::verifying_key → verifying.rs:158 encode
            DsaGenerated { seed, verifying_key: vk }
        }};
    }
    match alg {
        SigAlg::MlDsa44 => gen!(MlDsa44),
        SigAlg::MlDsa65 => gen!(MlDsa65),
        SigAlg::MlDsa87 => gen!(MlDsa87),
    }
}

pub fn dsa_sign(alg: SigAlg, seed: &[u8; 32], msg: &[u8]) -> Result<Vec<u8>, String> {
    if seed.len() != 32 {
        return Err(format!("ml-dsa seed must be 32 bytes, got {}", seed.len()));
    }
    let seed_arr: DsaSeed = (*seed).into();
    macro_rules! sign {
        ($params:ty) => {{
            let sk = SigningKey::<$params>::from_seed(&seed_arr); // ml-dsa signing.rs:55
            let sig = sk.try_sign(msg).map_err(|e| format!("sign: {e}"))?; // signing.rs:184
            Ok(sig.to_bytes().to_vec()) // SignatureEncoding
        }};
    }
    match alg {
        SigAlg::MlDsa44 => sign!(MlDsa44),
        SigAlg::MlDsa65 => sign!(MlDsa65),
        SigAlg::MlDsa87 => sign!(MlDsa87),
    }
}

pub fn dsa_verify(alg: SigAlg, verifying_key: &[u8], msg: &[u8], sig: &[u8]) -> Result<bool, String> {
    macro_rules! ver {
        ($params:ty, $vk_len:expr, $sig_len:expr) => {{
            if verifying_key.len() != $vk_len {
                return Err(format!(
                    "{} verifying key must be {} bytes, got {}",
                    alg, $vk_len, verifying_key.len()
                ));
            }
            if sig.len() != $sig_len {
                return Err(format!("{} signature must be {} bytes, got {}", alg, $sig_len, sig.len()));
            }
            use ml_dsa::VerifyingKey;
            let enc = ml_dsa::EncodedVerifyingKey::<$params>::try_from(verifying_key)
                .map_err(|_| "vk bytes".to_string())?;
            let vk = VerifyingKey::<$params>::decode(&enc); // ml-dsa verifying.rs:165
            let sig = ml_dsa::Signature::<$params>::try_from(sig) // signature 3.0 encoding.rs:14 — TryFrom<&[u8]>
                .map_err(|e| format!("sig decode: {e}"))?;
            Ok(vk.verify(msg, &sig).is_ok()) // ml-dsa verifying.rs:195
        }};
    }
    match alg {
        // Encoded key/signature sizes per FIPS 204 parameter sets
        SigAlg::MlDsa44 => ver!(MlDsa44, 1312, 2420),
        SigAlg::MlDsa65 => ver!(MlDsa65, 1952, 3309),
        SigAlg::MlDsa87 => ver!(MlDsa87, 2592, 4627),
    }
}

/// A generated ML-KEM pair: 64-byte decapsulation seed (SECRET) +
/// encapsulation key bytes (PUBLIC).
pub struct KemGenerated {
    pub seed: [u8; 64],
    pub encapsulation_key: Vec<u8>,
}

pub fn kem_generate(alg: KemAlg) -> Result<KemGenerated, String> {
    macro_rules! gen {
        ($params:ty) => {{
            // kem 0.3 lib.rs:126 generate_keypair — OS entropy, on-device
            let (dk, ek) = <$params as ml_kem::kem::Kem>::generate_keypair();
            let mut seed = [0u8; 64];
            seed.copy_from_slice(dk.to_bytes().as_slice()); // ml-kem decapsulation_key.rs:231
            let ek_bytes = ek.to_bytes().to_vec(); // ml-kem encapsulation_key.rs:91
            Ok(KemGenerated { seed, encapsulation_key: ek_bytes })
        }};
    }
    match alg {
        KemAlg::MlKem512 => gen!(MlKem512),
        KemAlg::MlKem768 => gen!(MlKem768),
        KemAlg::MlKem1024 => gen!(ml_kem::MlKem1024),
    }
}

pub fn kem_encapsulate(alg: KemAlg, encapsulation_key: &[u8]) -> Result<(Vec<u8>, [u8; 32]), String> {
    macro_rules! enc {
        ($params:ty, $ek_len:expr, $ct_len:expr) => {{
            if encapsulation_key.len() != $ek_len {
                return Err(format!("{} encapsulation key must be {} bytes, got {}", alg, $ek_len, encapsulation_key.len()));
            }
            use ml_kem::EncapsulationKey;
            // Key<B> = Array<u8, B::KeySize> (crypto-common lib.rs:47) — parameterized by the KEY type
            let key = ml_kem::Key::<EncapsulationKey<$params>>::try_from(encapsulation_key)
                .map_err(|_| "ek bytes".to_string())?;
            let ek = EncapsulationKey::<$params>::new(&key).map_err(|e| format!("ek parse: {e}"))?; // encapsulation_key.rs:32
            let (ct, shared) = ek.encapsulate(); // kem lib.rs:248
            let ct_bytes = ct.to_vec();
            let mut ss = [0u8; 32];
            ss.copy_from_slice(shared.as_slice());
            Ok((ct_bytes, ss))
        }};
    }
    match alg {
        KemAlg::MlKem512 => enc!(MlKem512, 800, 768),
        KemAlg::MlKem768 => enc!(MlKem768, 1184, 1088),
        KemAlg::MlKem1024 => enc!(ml_kem::MlKem1024, 1568, 1568),
    }
}

pub fn kem_decapsulate(alg: KemAlg, seed: &[u8; 64], ct: &[u8]) -> Result<[u8; 32], String> {
    macro_rules! dec {
        ($params:ty, $ct_len:expr) => {{
            if ct.len() != $ct_len {
                return Err(format!("{} ciphertext must be {} bytes, got {}", alg, $ct_len, ct.len()));
            }
            let dk = ml_kem::DecapsulationKey::<$params>::from_seed((*seed).into()); // decapsulation_key.rs:51
            let ct_arr = ml_kem::Ciphertext::<$params>::try_from(ct).map_err(|_| "ct bytes".to_string())?;
            let shared = dk.decapsulate(&ct_arr); // kem lib.rs:180
            let mut ss = [0u8; 32];
            ss.copy_from_slice(shared.as_slice());
            Ok(ss)
        }};
    }
    match alg {
        KemAlg::MlKem512 => dec!(MlKem512, 768),
        KemAlg::MlKem768 => dec!(MlKem768, 1088),
        KemAlg::MlKem1024 => dec!(ml_kem::MlKem1024, 1568),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dsa_sign_verify_roundtrip_all_levels() {
        for alg in [SigAlg::MlDsa44, SigAlg::MlDsa65, SigAlg::MlDsa87] {
            let g = dsa_generate(alg);
            let sig = dsa_sign(alg, &g.seed, b"bheart milestone").unwrap();
            assert!(dsa_verify(alg, &g.verifying_key, b"bheart milestone", &sig).unwrap(), "{alg} roundtrip");
            assert!(!dsa_verify(alg, &g.verifying_key, b"tampered", &sig).unwrap(), "{alg} tamper must fail");
        }
    }

    #[test]
    fn dsa_cross_algorithm_is_rejected() {
        let g = dsa_generate(SigAlg::MlDsa65);
        let sig = dsa_sign(SigAlg::MlDsa65, &g.seed, b"x").unwrap();
        // 65-signature offered as 44: size gate catches it (2420 != 3309)
        assert!(dsa_verify(SigAlg::MlDsa44, &g.verifying_key, b"x", &sig).is_err());
    }

    #[test]
    fn kem_roundtrip_all_levels() {
        for alg in [KemAlg::MlKem512, KemAlg::MlKem768, KemAlg::MlKem1024] {
            let g = kem_generate(alg).unwrap();
            let (ct, ss1) = kem_encapsulate(alg, &g.encapsulation_key).unwrap();
            let ss2 = kem_decapsulate(alg, &g.seed, &ct).unwrap();
            assert_eq!(ss1, ss2, "{alg} shared secrets must agree");
            // tampered ciphertext decapsulates to a DIFFERENT key (implicit
            // rejection, FIPS 203 §7.2) — never an error, never the original
            let mut bad = ct.clone();
            bad[0] ^= 1;
            let ss3 = kem_decapsulate(alg, &g.seed, &bad).unwrap();
            assert_ne!(ss1, ss3, "{alg} implicit rejection must fork the secret");
        }
    }

    #[test]
    fn sizes_are_checked_not_trusted() {
        let g = kem_generate(KemAlg::MlKem768).unwrap();
        assert!(kem_encapsulate(KemAlg::MlKem768, &g.encapsulation_key[..100]).is_err());
    }
}
