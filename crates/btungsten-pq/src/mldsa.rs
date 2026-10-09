//! ML-DSA (FIPS 204), all three parameter sets bsigner exposes
//! (`crates/bsigner/src/alg.rs:34-43`), on the shipped implementation
//! (RustCrypto `ml-dsa` 0.1.1, the version bsigner links) and an independent
//! one (libcrux-ml-dsa 0.0.11, with its `acvp` feature for the internal
//! interface).
//!
//! HashML-DSA (the `preHash` groups) is not used anywhere in the estate and
//! is reported NOT RUN. The external-μ groups run where an implementation
//! exposes μ-signing; libcrux does not, and that is reported too.

use crate::acvp::Case;
use crate::report::Report;

#[derive(Clone, Copy)]
pub struct Dsa {
    pub name: &'static str,
    /// seed -> (pk, expanded sk)
    pub keygen: fn(&[u8]) -> Option<(Vec<u8>, Vec<u8>)>,
    /// (expanded sk, message, context, rnd or None for deterministic)
    pub sign_ext: fn(&[u8], &[u8], &[u8], Option<&[u8]>) -> Option<Vec<u8>>,
    /// (expanded sk, M', rnd or None)
    pub sign_int: fn(&[u8], &[u8], Option<&[u8]>) -> Option<Vec<u8>>,
    /// (expanded sk, mu), deterministic only; None where not exposed
    pub sign_mu_det: Option<fn(&[u8], &[u8]) -> Option<Vec<u8>>>,
    pub verify_ext: fn(&[u8], &[u8], &[u8], &[u8]) -> bool,
    pub verify_int: fn(&[u8], &[u8], &[u8]) -> bool,
    pub verify_mu: Option<fn(&[u8], &[u8], &[u8]) -> bool>,
}

pub const SETS: [&str; 3] = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"];

mod rustcrypto {
    #![allow(deprecated)] // ACVP hands out expanded signing keys; bsigner keeps the seed
    use ml_dsa::signature::Keypair;

    macro_rules! dsa {
        ($f:ident, $P:ty) => {
            pub fn $f() -> super::Dsa {
                use ml_dsa::{
                    EncodedVerifyingKey, ExpandedSigningKey, Signature, SigningKey, VerifyingKey,
                };
                type P = $P;
                fn esk(sk: &[u8]) -> Option<ExpandedSigningKey<P>> {
                    Some(ExpandedSigningKey::<P>::from_expanded(&sk.try_into().ok()?))
                }
                fn vk(pk: &[u8]) -> Option<VerifyingKey<P>> {
                    Some(VerifyingKey::<P>::decode(
                        &EncodedVerifyingKey::<P>::try_from(pk).ok()?,
                    ))
                }
                fn sig(s: &[u8]) -> Option<Signature<P>> {
                    Signature::<P>::try_from(s).ok()
                }
                super::Dsa {
                    name: "rustcrypto",
                    keygen: |seed| {
                        let sk = SigningKey::<P>::from_seed(&seed.try_into().ok()?);
                        Some((
                            sk.verifying_key().encode().to_vec(),
                            sk.expanded_key().to_expanded().to_vec(),
                        ))
                    },
                    sign_ext: |sk, m, ctx, rnd| {
                        let k = esk(sk)?;
                        let s = match rnd {
                            // the public deterministic API: the one bsigner's Signer::try_sign takes
                            None => k.sign_deterministic(m, ctx).ok()?,
                            // FIPS 204 Algorithm 2 with the supplied rnd: M' = 0 ‖ |ctx| ‖ ctx ‖ M
                            Some(rnd) => {
                                let n = u8::try_from(ctx.len()).ok()?;
                                k.sign_internal(
                                    &[&[0u8][..], &[n][..], ctx, m],
                                    &rnd.try_into().ok()?,
                                )
                            }
                        };
                        Some(s.encode().to_vec())
                    },
                    sign_int: |sk, m, rnd| {
                        let rnd = rnd.map_or(Some(Default::default()), |r| r.try_into().ok())?;
                        Some(esk(sk)?.sign_internal(&[m], &rnd).encode().to_vec())
                    },
                    sign_mu_det: Some(|sk, mu| {
                        Some(
                            esk(sk)?
                                .sign_mu_deterministic(&mu.try_into().ok()?)
                                .encode()
                                .to_vec(),
                        )
                    }),
                    verify_ext: |pk, m, ctx, s| match (vk(pk), sig(s)) {
                        (Some(k), Some(s)) => k.verify_with_context(m, ctx, &s),
                        _ => false,
                    },
                    verify_int: |pk, m, s| match (vk(pk), sig(s)) {
                        (Some(k), Some(s)) => k.verify_internal(m, &s),
                        _ => false,
                    },
                    verify_mu: Some(|pk, mu, s| match (vk(pk), sig(s), mu.try_into().ok()) {
                        (Some(k), Some(s), Some(mu)) => k.verify_mu(&mu, &s),
                        _ => false,
                    }),
                }
            }
        };
    }
    dsa!(ml_dsa_44, ml_dsa::MlDsa44);
    dsa!(ml_dsa_65, ml_dsa::MlDsa65);
    dsa!(ml_dsa_87, ml_dsa::MlDsa87);
}

mod libcrux {
    fn arr<const N: usize>(s: &[u8]) -> Option<[u8; N]> {
        s.try_into().ok()
    }

    macro_rules! dsa {
        ($f:ident, $m:ident, $sk:ident, $vk:ident, $sig:ident) => {
            pub fn $f() -> super::Dsa {
                use libcrux_ml_dsa::$m::{self as d, $sig, $sk, $vk};
                super::Dsa {
                    name: "libcrux",
                    keygen: |seed| {
                        let kp = d::generate_key_pair(arr(seed)?);
                        Some((
                            kp.verification_key.as_slice().to_vec(),
                            kp.signing_key.as_slice().to_vec(),
                        ))
                    },
                    sign_ext: |sk, m, ctx, rnd| {
                        let rnd = rnd.map_or(Some([0u8; 32]), arr)?;
                        Some(
                            d::sign(&$sk::new(arr(sk)?), m, ctx, rnd)
                                .ok()?
                                .as_slice()
                                .to_vec(),
                        )
                    },
                    sign_int: |sk, m, rnd| {
                        let rnd = rnd.map_or(Some([0u8; 32]), arr)?;
                        Some(
                            d::sign_internal(&$sk::new(arr(sk)?), m, rnd)
                                .ok()?
                                .as_slice()
                                .to_vec(),
                        )
                    },
                    sign_mu_det: None,
                    verify_ext: |pk, m, ctx, s| match (arr(pk), arr(s)) {
                        (Some(pk), Some(s)) => {
                            d::verify(&$vk::new(pk), m, ctx, &$sig::new(s)).is_ok()
                        }
                        _ => false,
                    },
                    verify_int: |pk, m, s| match (arr(pk), arr(s)) {
                        (Some(pk), Some(s)) => {
                            d::verify_internal(&$vk::new(pk), m, &$sig::new(s)).is_ok()
                        }
                        _ => false,
                    },
                    verify_mu: None,
                }
            }
        };
    }
    dsa!(
        ml_dsa_44,
        ml_dsa_44,
        MLDSA44SigningKey,
        MLDSA44VerificationKey,
        MLDSA44Signature
    );
    dsa!(
        ml_dsa_65,
        ml_dsa_65,
        MLDSA65SigningKey,
        MLDSA65VerificationKey,
        MLDSA65Signature
    );
    dsa!(
        ml_dsa_87,
        ml_dsa_87,
        MLDSA87SigningKey,
        MLDSA87VerificationKey,
        MLDSA87Signature
    );
}

pub fn impls(set: &str) -> [Dsa; 2] {
    match set {
        "ML-DSA-44" => [rustcrypto::ml_dsa_44(), libcrux::ml_dsa_44()],
        "ML-DSA-65" => [rustcrypto::ml_dsa_65(), libcrux::ml_dsa_65()],
        "ML-DSA-87" => [rustcrypto::ml_dsa_87(), libcrux::ml_dsa_87()],
        other => panic!("ACVP names a parameter set this runner does not know: {other}"),
    }
}

fn flip(b: &[u8]) -> Vec<u8> {
    let mut v = b.to_vec();
    match v.first_mut() {
        Some(x) => *x ^= 1,
        None => v.push(1),
    }
    v
}

/// The group's shape as a key fragment, e.g. `ext-pure det` or `internal-mu hedged`.
fn shape(c: &Case) -> String {
    let iface = match (
        c.group_str("signatureInterface"),
        c.group_str("preHash"),
        c.group_bool("externalMu"),
    ) {
        (Some("external"), Some("preHash"), _) => "ext-prehash",
        (Some("external"), _, _) => "ext-pure",
        (Some("internal"), _, Some(true)) => "internal-mu",
        (Some("internal"), _, _) => "internal",
        other => panic!("tcId {}: unknown ML-DSA interface {other:?}", c.tc),
    };
    match c.group_bool("deterministic") {
        Some(true) => format!("{iface} det"),
        Some(false) => format!("{iface} hedged"),
        None => iface.to_string(),
    }
}

pub fn run(r: &mut Report, rev: &str, mode: &str, cases: &[Case]) {
    let mut first = std::collections::BTreeSet::new();
    for c in cases {
        let set = c.group_str("parameterSet").expect("parameterSet");
        let fmt = c
            .group_str("keyFormat")
            .map(|f| format!(", {f}"))
            .unwrap_or_default();
        let sh = if mode == "keyGen" {
            String::new()
        } else {
            format!(" {}", shape(c))
        };
        let key = format!("{set} {mode}{sh} ({rev}{fmt})");
        if sh.contains("prehash") {
            r.not_run(
                &key,
                "HashML-DSA (pre-hash) is not used anywhere in the estate",
            );
            continue;
        }
        let teeth = first.insert(key.clone());
        for imp in impls(set) {
            let outcome: Option<(bool, Option<bool>)> = match mode {
                "keyGen" => {
                    let seed = c.hex("seed");
                    let want = Some((c.hex("pk"), c.hex("sk")));
                    Some((
                        (imp.keygen)(&seed) == want,
                        teeth.then(|| (imp.keygen)(&flip(&seed)) != want),
                    ))
                }
                "sigGen" => {
                    let sk = match c.group_str("keyFormat") {
                        Some("seed") => match (imp.keygen)(&c.hex("seed")) {
                            Some((_, sk)) => sk,
                            None => {
                                r.record(&key, imp.name, c.tc, false);
                                continue;
                            }
                        },
                        _ => c.hex("sk"),
                    };
                    let rnd = (c.group_bool("deterministic") == Some(false)).then(|| c.hex("rnd"));
                    let want = Some(c.hex("signature"));
                    let sign: Option<Box<dyn Fn(&[u8]) -> Option<Vec<u8>>>> =
                        if sh.contains("internal-mu") {
                            match (imp.sign_mu_det, rnd.is_none()) {
                                (Some(f), true) => Some(Box::new(move |mu: &[u8]| f(&sk, mu))),
                                _ => None,
                            }
                        } else if sh.contains("internal") {
                            let rnd = rnd.clone();
                            Some(Box::new(move |m: &[u8]| {
                                (imp.sign_int)(&sk, m, rnd.as_deref())
                            }))
                        } else {
                            let (ctx, rnd) = (c.hex("context"), rnd.clone());
                            Some(Box::new(move |m: &[u8]| {
                                (imp.sign_ext)(&sk, m, &ctx, rnd.as_deref())
                            }))
                        };
                    let field = if sh.contains("internal-mu") {
                        "mu"
                    } else {
                        "message"
                    };
                    sign.map(|f| {
                        let m = c.hex(field);
                        (f(&m) == want, teeth.then(|| f(&flip(&m)) != want))
                    })
                }
                "sigVer" => {
                    let (pk, s) = (c.hex("pk"), c.hex("signature"));
                    let want = c.passed();
                    let verify: Option<Box<dyn Fn(&[u8]) -> bool>> = if sh.contains("internal-mu") {
                        imp.verify_mu.map(|f| {
                            Box::new(move |mu: &[u8]| f(&pk, mu, &s)) as Box<dyn Fn(&[u8]) -> bool>
                        })
                    } else if sh.contains("internal") {
                        Some(Box::new(move |m: &[u8]| (imp.verify_int)(&pk, m, &s)))
                    } else {
                        let ctx = c.hex("context");
                        Some(Box::new(move |m: &[u8]| (imp.verify_ext)(&pk, m, &ctx, &s)))
                    };
                    let field = if sh.contains("internal-mu") {
                        "mu"
                    } else {
                        "message"
                    };
                    verify.map(|f| {
                        let m = c.hex(field);
                        // a changed message must never verify, whatever the case expects
                        (f(&m) == want, (teeth && want).then(|| !f(&flip(&m))))
                    })
                }
                other => panic!("unknown ML-DSA mode {other}"),
            };
            match outcome {
                Some((ok, control)) => {
                    r.record(&key, imp.name, c.tc, ok);
                    if let Some(refused) = control {
                        r.record(&format!("{key} TEETH one input byte flipped"), imp.name, c.tc, refused);
                    }
                }
                None => r.not_run(
                    &format!("{key} [{}]", imp.name),
                    if imp.sign_mu_det.is_none() {
                        "this implementation exposes no external-μ interface; the estate never signs or verifies μ"
                    } else {
                        "this implementation takes μ-signing randomness only from an RNG, not as supplied bytes; the estate never signs μ"
                    },
                ),
            }
        }
    }
}
