//! ML-KEM (FIPS 203), all three parameter sets bsigner exposes
//! (`crates/bsigner/src/alg.rs:52-61`), every ACVP function, on the shipped
//! implementation (RustCrypto `ml-kem` 0.3.2, the version bsigner links) and
//! an independent one (libcrux-ml-kem 0.0.11).

use crate::acvp::Case;
use crate::report::Report;

/// The answers one implementation gives for one parameter set.
pub struct Kem {
    pub name: &'static str,
    pub keygen: fn(&[u8], &[u8]) -> (Vec<u8>, Vec<u8>),
    pub encaps: fn(&[u8], &[u8]) -> Option<(Vec<u8>, Vec<u8>)>,
    pub decaps_expanded: fn(&[u8], &[u8]) -> Option<Vec<u8>>,
    pub decaps_seed: fn(&[u8], &[u8], &[u8]) -> Option<Vec<u8>>,
    pub ek_check: fn(&[u8]) -> bool,
    pub dk_check: fn(&[u8]) -> bool,
}

pub const SETS: [&str; 3] = ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"];
pub const FUNCTIONS: [&str; 5] = [
    "keyGen",
    "encapsulation",
    "decapsulation",
    "encapsulationKeyCheck",
    "decapsulationKeyCheck",
];

fn seed64(d: &[u8], z: &[u8]) -> [u8; 64] {
    let mut s = [0u8; 64];
    s[..32].copy_from_slice(d);
    s[32..].copy_from_slice(z);
    s
}

mod rustcrypto {
    #![allow(deprecated)] // the ACVP answers are the expanded dk; bsigner keeps the seed
    use ml_kem::kem::{Decapsulate, KeyExport};
    use ml_kem::ExpandedKeyEncoding;

    macro_rules! kem {
        ($f:ident, $m:ident) => {
            pub fn $f() -> super::Kem {
                use ml_kem::$m::{
                    Ciphertext, DecapsulationKey, EncapsulationKey, ExpandedDecapsulationKey,
                };
                super::Kem {
                    name: "rustcrypto",
                    keygen: |d, z| {
                        let dk = DecapsulationKey::from_seed(super::seed64(d, z).into());
                        (
                            dk.encapsulation_key().to_bytes().to_vec(),
                            dk.to_expanded_bytes().to_vec(),
                        )
                    },
                    encaps: |ek, m| {
                        let ek = EncapsulationKey::new(&ek.try_into().ok()?).ok()?;
                        let (c, k) = ek.encapsulate_deterministic(&m.try_into().ok()?);
                        Some((c.to_vec(), k.to_vec()))
                    },
                    decaps_expanded: |dk, c| {
                        let dk = DecapsulationKey::from_expanded(
                            &ExpandedDecapsulationKey::try_from(dk).ok()?,
                        )
                        .ok()?;
                        Some(dk.decapsulate(&Ciphertext::try_from(c).ok()?).to_vec())
                    },
                    decaps_seed: |d, z, c| {
                        let dk = DecapsulationKey::from_seed(super::seed64(d, z).into());
                        Some(dk.decapsulate(&Ciphertext::try_from(c).ok()?).to_vec())
                    },
                    ek_check: |ek| match ek.try_into() {
                        Ok(k) => EncapsulationKey::new(&k).is_ok(),
                        Err(_) => false,
                    },
                    dk_check: |dk| match ExpandedDecapsulationKey::try_from(dk) {
                        Ok(k) => DecapsulationKey::from_expanded(&k).is_ok(),
                        Err(_) => false,
                    },
                }
            }
        };
    }
    kem!(ml_kem_512, ml_kem_512);
    kem!(ml_kem_768, ml_kem_768);
    kem!(ml_kem_1024, ml_kem_1024);
}

mod libcrux {
    macro_rules! kem {
        ($f:ident, $m:ident, $pk:ident, $sk:ident, $ct:ident) => {
            pub fn $f() -> super::Kem {
                use libcrux_ml_kem::$m::{self as k, $ct, $pk, $sk};
                super::Kem {
                    name: "libcrux",
                    keygen: |d, z| {
                        let kp = k::generate_key_pair(super::seed64(d, z));
                        (kp.pk().to_vec(), kp.sk().to_vec())
                    },
                    encaps: |ek, m| {
                        let pk = $pk::try_from(ek).ok()?;
                        let (c, s) = k::encapsulate(&pk, m.try_into().ok()?);
                        Some((c.as_ref().to_vec(), s.to_vec()))
                    },
                    decaps_expanded: |dk, c| {
                        let (sk, ct) = ($sk::try_from(dk).ok()?, $ct::try_from(c).ok()?);
                        Some(k::decapsulate(&sk, &ct).to_vec())
                    },
                    decaps_seed: |d, z, c| {
                        let kp = k::generate_key_pair(super::seed64(d, z));
                        Some(k::decapsulate(kp.private_key(), &$ct::try_from(c).ok()?).to_vec())
                    },
                    ek_check: |ek| {
                        $pk::try_from(ek).map_or(false, |pk| k::validate_public_key(&pk))
                    },
                    dk_check: |dk| {
                        $sk::try_from(dk)
                            .map_or(false, |sk| k::portable::validate_private_key_only(&sk))
                    },
                }
            }
        };
    }
    kem!(
        ml_kem_512,
        mlkem512,
        MlKem512PublicKey,
        MlKem512PrivateKey,
        MlKem512Ciphertext
    );
    kem!(
        ml_kem_768,
        mlkem768,
        MlKem768PublicKey,
        MlKem768PrivateKey,
        MlKem768Ciphertext
    );
    kem!(
        ml_kem_1024,
        mlkem1024,
        MlKem1024PublicKey,
        MlKem1024PrivateKey,
        MlKem1024Ciphertext
    );
}

/// Both implementations of `set`.
pub fn impls(set: &str) -> [Kem; 2] {
    match set {
        "ML-KEM-512" => [rustcrypto::ml_kem_512(), libcrux::ml_kem_512()],
        "ML-KEM-768" => [rustcrypto::ml_kem_768(), libcrux::ml_kem_768()],
        "ML-KEM-1024" => [rustcrypto::ml_kem_1024(), libcrux::ml_kem_1024()],
        other => panic!("ACVP names a parameter set this runner does not know: {other}"),
    }
}

fn flip(b: &[u8]) -> Vec<u8> {
    let mut v = b.to_vec();
    v[0] ^= 1;
    v
}

/// Every case of a keyGen or encapDecap vector set (`rev` names the file).
pub fn run(r: &mut Report, rev: &str, cases: &[Case]) {
    let mut first = std::collections::BTreeSet::new();
    for c in cases {
        let set = c.group_str("parameterSet").expect("parameterSet");
        let function = c.group_str("function").unwrap_or("keyGen");
        let fmt = c
            .group_str("keyFormat")
            .map(|f| format!(", {f}"))
            .unwrap_or_default();
        let key = format!("{set} {function} ({rev}{fmt})");
        let teeth = first.insert(key.clone());
        for imp in impls(set) {
            let (ok, control) = match function {
                "keyGen" => {
                    let (d, z) = (c.hex("d"), c.hex("z"));
                    let want = (c.hex("ek"), c.hex("dk"));
                    let ok = (imp.keygen)(&d, &z) == want;
                    (ok, teeth.then(|| (imp.keygen)(&flip(&d), &z) != want))
                }
                "encapsulation" => {
                    let (ek, m) = (c.hex("ek"), c.hex("m"));
                    let want = Some((c.hex("c"), c.hex("k")));
                    let ok = (imp.encaps)(&ek, &m) == want;
                    (ok, teeth.then(|| (imp.encaps)(&ek, &flip(&m)) != want))
                }
                "decapsulation" => {
                    let (ct, want) = (c.hex("c"), Some(c.hex("k")));
                    let dec = |ct: &[u8]| match c.group_str("keyFormat") {
                        Some("seed") => (imp.decaps_seed)(&c.hex("d"), &c.hex("z"), ct),
                        _ => (imp.decaps_expanded)(&c.hex("dk"), ct),
                    };
                    (dec(&ct) == want, teeth.then(|| dec(&flip(&ct)) != want))
                }
                "encapsulationKeyCheck" => ((imp.ek_check)(&c.hex("ek")) == c.passed(), None),
                "decapsulationKeyCheck" => ((imp.dk_check)(&c.hex("dk")) == c.passed(), None),
                other => panic!("ACVP names an ML-KEM function this runner does not know: {other}"),
            };
            r.record(&key, imp.name, c.tc, ok);
            if let Some(differs) = control {
                r.record(
                    &format!("{key} TEETH one input byte flipped"),
                    imp.name,
                    c.tc,
                    differs,
                );
            }
        }
    }
}
