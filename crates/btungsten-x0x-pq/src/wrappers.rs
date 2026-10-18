//! Drive the unmodified Saorsa public API that x0x imports.
//! Randomized signing/encapsulation are DIFFERENTIAL, not byte-for-byte KAT.
use btungsten_pq::{acvp::Case, mldsa, mlkem, report::Report};
use saorsa_pqc::api::{
    kem::{self, MlKemCiphertext, MlKemPublicKey, MlKemSecretKey, MlKemVariant},
    sig::{self, MlDsaPublicKey, MlDsaSecretKey, MlDsaSignature, MlDsaVariant},
};

const K: MlKemVariant = MlKemVariant::MlKem768;
const D: MlDsaVariant = MlDsaVariant::MlDsa65;
const IMP: &str = "saorsa-pqc";

fn changed(bytes: &[u8]) -> Vec<u8> {
    let mut bytes = bytes.to_vec();
    if let Some(last) = bytes.last_mut() {
        *last ^= 1;
    } else {
        bytes.push(1);
    }
    bytes
}

pub fn kem_vectors(r: &mut Report, rev: &str, cases: &[Case]) {
    let kem = kem::ml_kem_768();
    for c in cases {
        let f = c.group_str("function").unwrap_or("keyGen");
        let fmt = c
            .group_str("keyFormat")
            .map(|f| format!(", {f}"))
            .unwrap_or_default();
        let row = format!("ML-KEM-768 {f} ({rev}{fmt}) KAT");
        let ok = match f {
            "keyGen" => {
                let (pk, sk) = kem.generate_keypair_from_seed(
                    &c.hex("d").try_into().unwrap(),
                    &c.hex("z").try_into().unwrap(),
                );
                pk.to_bytes() == c.hex("ek") && sk.to_bytes() == c.hex("dk")
            }
            "decapsulation" => {
                let sk = if c.group_str("keyFormat") == Some("seed") {
                    kem.generate_keypair_from_seed(
                        &c.hex("d").try_into().unwrap(),
                        &c.hex("z").try_into().unwrap(),
                    )
                    .1
                    .to_bytes()
                } else {
                    c.hex("dk")
                };
                match (
                    MlKemSecretKey::from_bytes(K, &sk),
                    MlKemCiphertext::from_bytes(K, &c.hex("c")),
                ) {
                    (Ok(sk), Ok(ct)) => kem
                        .decapsulate(&sk, &ct)
                        .map(|ss| c.hex("k") == ss.to_bytes())
                        .unwrap_or(false),
                    _ => false,
                }
            }
            "encapsulationKeyCheck" => {
                MlKemPublicKey::from_bytes(K, &c.hex("ek")).is_ok() == c.passed()
            }
            "decapsulationKeyCheck" => {
                MlKemSecretKey::from_bytes(K, &c.hex("dk")).is_ok() == c.passed()
            }
            "encapsulation" => {
                r.not_run("ML-KEM-768 encapsulation [saorsa-pqc] KAT", "wrapper fixes OsRng; deterministic encapsulation KAT runs on fips203; randomized wrapper tested separately");
                continue;
            }
            other => panic!("unknown KEM function {other}"),
        };
        r.record(&row, IMP, c.tc, ok);
    }
}

pub fn dsa_vectors(r: &mut Report, rev: &str, mode: &str, cases: &[Case]) {
    let dsa = sig::ml_dsa_65();
    for c in cases {
        if mode == "keyGen" {
            let (pk, sk) = dsa.generate_keypair_from_seed(&c.hex("seed").try_into().unwrap());
            r.record(
                &format!("ML-DSA-65 keyGen ({rev}) KAT"),
                IMP,
                c.tc,
                pk.to_bytes() == c.hex("pk") && sk.to_bytes() == c.hex("sk"),
            );
            continue;
        }
        if c.group_str("signatureInterface") != Some("external")
            || c.group_str("preHash") == Some("preHash")
        {
            r.not_run("ML-DSA-65 internal/mu/prehash [saorsa-pqc]", "not exercised through x0x's pure external wrapper path; fips204 internal cases have their own result");
            continue;
        }
        let m = c.hex("message");
        let ctx = c.hex("context");
        if mode == "sigVer" {
            let got = match (
                MlDsaPublicKey::from_bytes(D, &c.hex("pk")),
                MlDsaSignature::from_bytes(D, &c.hex("signature")),
            ) {
                (Ok(pk), Ok(sig)) => dsa
                    .verify_with_context(&pk, &m, &sig, &ctx)
                    .unwrap_or(false),
                _ => false,
            };
            r.record(
                &format!("ML-DSA-65 sigVer ext-pure ({rev}) KAT"),
                IMP,
                c.tc,
                got == c.passed(),
            );
        } else {
            let sk = if c.group_str("keyFormat") == Some("seed") {
                dsa.generate_keypair_from_seed(&c.hex("seed").try_into().unwrap())
                    .1
                    .to_bytes()
            } else {
                c.hex("sk")
            };
            // Derive the public key from the official secret key using the pinned
            // implementation, then check the wrapper's signature independently.
            use fips204::traits::{SerDes, Signer};
            let pk =
                fips204::ml_dsa_65::PrivateKey::try_from_bytes(sk.as_slice().try_into().unwrap())
                    .map(|sk| sk.get_public_key().into_bytes().to_vec())
                    .unwrap();
            let signed = MlDsaSecretKey::from_bytes(D, &sk)
                .ok()
                .and_then(|sk| dsa.sign_with_context(&sk, &m, &ctx).ok());
            let ok = signed
                .map(|sig| {
                    mldsa::impls("ML-DSA-65")
                        .into_iter()
                        .all(|i| (i.verify_ext)(&pk, &m, &ctx, &sig.to_bytes()))
                })
                .unwrap_or(false);
            r.record(
                &format!("ML-DSA-65 sigGen ext-pure ({rev}) DIFFERENTIAL"),
                IMP,
                c.tc,
                ok,
            );
            r.not_run("ML-DSA-65 sigGen [saorsa-pqc] KAT", "wrapper fixes OsRng; supplied-randomness KAT runs on fips204; wrapper signatures checked by RustCrypto and libcrux");
        }
    }
}

/// Actual OsRng entry points, cross-implementation checks and last-byte teeth.
/// These observations do not establish entropy quality or RNG validation.
pub fn composition(r: &mut Report) -> Result<(), String> {
    let kem = kem::ml_kem_768();
    let dsa = sig::ml_dsa_65();
    let (kpk, ksk) = kem.generate_keypair().map_err(|e| e.to_string())?;
    let (dpk, dsk) = dsa.generate_keypair().map_err(|e| e.to_string())?;
    let (_, other_dsk) = dsa.generate_keypair().map_err(|e| e.to_string())?;
    // Deliberately non-canonical coefficients, then a corrupted stored H(ek).
    // An arbitrary public-key bit flip is not necessarily an invalid key.
    let mut invalid_pk = kpk.to_bytes();
    invalid_pk[..3].fill(255);
    let mut invalid_sk = ksk.to_bytes();
    invalid_sk[2400 - 64] ^= 1;
    r.record(
        "ML-KEM-768 TEETH encapsulation key check",
        IMP,
        0,
        MlKemPublicKey::from_bytes(K, &invalid_pk).is_err(),
    );
    r.record(
        "ML-KEM-768 TEETH decapsulation key check",
        IMP,
        0,
        MlKemSecretKey::from_bytes(K, &invalid_sk).is_err(),
    );
    let backend = crate::backends::kem();
    r.record(
        "ML-KEM-768 TEETH encapsulation key check",
        backend.name,
        0,
        !(backend.ek_check)(&invalid_pk),
    );
    r.record(
        "ML-KEM-768 TEETH decapsulation key check",
        backend.name,
        0,
        !(backend.dk_check)(&invalid_sk),
    );
    for (tc, len) in [0, 1, 63, 64, 65, 135, 136, 137, 255, 256, 257, 4096]
        .into_iter()
        .enumerate()
    {
        let tc = tc as u64;
        let message = vec![0x42; len];
        let signature = dsa.sign(&dsk, &message).map_err(|e| e.to_string())?;
        let bad_signature = dsa.sign(&other_dsk, &message).map_err(|e| e.to_string())?;
        let (ss, ct) = kem.encapsulate(&kpk).map_err(|e| e.to_string())?;
        for i in mldsa::impls("ML-DSA-65") {
            r.record(
                "ML-DSA-65 OsRng keyGen/sign DIFFERENTIAL",
                i.name,
                tc,
                (i.verify_ext)(&dpk.to_bytes(), &message, b"", &signature.to_bytes()),
            );
        }
        for i in mlkem::impls("ML-KEM-768") {
            r.record(
                "ML-KEM-768 OsRng keyGen/encapsulation DIFFERENTIAL",
                i.name,
                tc,
                (i.decaps_expanded)(&ksk.to_bytes(), &ct.to_bytes())
                    == Some(ss.to_bytes().to_vec()),
            );
            let (other_ct, other_ss) = (i.encaps)(&kpk.to_bytes(), &[tc as u8; 32])
                .ok_or("independent encapsulation failed")?;
            let imported = MlKemCiphertext::from_bytes(K, &other_ct).map_err(|e| e.to_string())?;
            r.record(
                "ML-KEM-768 independent encapsulation/wrapper decapsulation DIFFERENTIAL",
                i.name,
                tc,
                kem.decapsulate(&ksk, &imported)
                    .map(|ss| other_ss == ss.to_bytes())
                    .unwrap_or(false),
            );
        }
        r.record(
            "ML-DSA-65 TEETH last message byte",
            IMP,
            tc,
            !dsa.verify(&dpk, &changed(&message), &signature)
                .unwrap_or(false),
        );
        r.record(
            "ML-DSA-65 TEETH wrong signer",
            IMP,
            tc,
            !dsa.verify(&dpk, &message, &bad_signature).unwrap_or(false),
        );
        let bent = MlDsaSignature::from_bytes(D, &changed(&signature.to_bytes()));
        r.record(
            "ML-DSA-65 TEETH last signature byte",
            IMP,
            tc,
            bent.map(|s| !dsa.verify(&dpk, &message, &s).unwrap_or(false))
                .unwrap_or(true),
        );
        let bent_ct =
            MlKemCiphertext::from_bytes(K, &changed(&ct.to_bytes())).map_err(|e| e.to_string())?;
        r.record(
            "ML-KEM-768 TEETH changed ciphertext (implicit rejection)",
            IMP,
            tc,
            kem.decapsulate(&ksk, &bent_ct)
                .map(|got| got.to_bytes() != ss.to_bytes())
                .unwrap_or(false),
        );
    }
    r.record(
        "T-VACUOUS malformed imports TEETH",
        IMP,
        0,
        MlDsaSignature::from_bytes(D, &[]).is_err()
            && MlDsaPublicKey::from_bytes(D, &[]).is_err()
            && MlDsaSecretKey::from_bytes(D, &[]).is_err()
            && MlKemCiphertext::from_bytes(K, &[]).is_err()
            && MlKemPublicKey::from_bytes(K, &[]).is_err()
            && MlKemSecretKey::from_bytes(K, &[]).is_err(),
    );
    // The legacy trait wrapper is the additional path ant-quic uses.
    use saorsa_pqc::pqc::{MlDsa65, MlDsaOperations};
    let legacy = MlDsa65::new();
    let (pk, sk) = legacy.generate_keypair().map_err(|e| e.to_string())?;
    let signature = legacy
        .sign(&sk, b"btungsten/x0x/legacy")
        .map_err(|e| e.to_string())?;
    for i in mldsa::impls("ML-DSA-65") {
        r.record(
            "ML-DSA-65 legacy wrapper DIFFERENTIAL",
            i.name,
            0,
            (i.verify_ext)(
                pk.as_bytes(),
                b"btungsten/x0x/legacy",
                b"",
                signature.as_bytes(),
            ),
        );
    }
    r.record(
        "ML-DSA-65 legacy wrapper TEETH message",
        IMP,
        0,
        !legacy
            .verify(&pk, b"btungsten/x0x/changed", &signature)
            .map_err(|e| e.to_string())?,
    );
    Ok(())
}
