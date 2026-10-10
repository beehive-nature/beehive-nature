//! SLH-DSA-SHAKE-256f (FIPS 205), the SPEC-BPQ-1 succession key, on two
//! independent Rust implementations: RustCrypto `slh-dsa` 0.2.0-rc.5 (0.1.0 needs a pre-release `signature` 2.3 that cannot share this workspace with ed25519-dalek's `signature` 2.2) and
//! integritychain `fips205` 0.4.1. No Rust SLH-DSA ships yet (the browser
//! derives the key, SPEC-BPQ-1 §6); SPEC-BTUNGSTEN-PQ-1 §PQ07 picks one.
//!
//! The other eleven SLH-DSA parameter sets in the ACVP files are not used by
//! the estate; HashSLH-DSA (pre-hash) is not used either. Both are reported
//! NOT RUN, never passed.

use crate::acvp::Case;
use crate::report::Report;

pub const SET: &str = "SLH-DSA-SHAKE-256f";

#[derive(Clone, Copy)]
pub struct Slh {
    pub name: &'static str,
    /// (skSeed, skPrf, pkSeed) -> (pk, sk)
    pub keygen: fn(&[u8], &[u8], &[u8]) -> Option<(Vec<u8>, Vec<u8>)>,
    /// (sk, message, context, additionalRandomness or None for deterministic)
    pub sign_ext: fn(&[u8], &[u8], &[u8], Option<&[u8]>) -> Option<Vec<u8>>,
    /// (sk, M', additionalRandomness or None)
    pub sign_int: fn(&[u8], &[u8], Option<&[u8]>) -> Option<Vec<u8>>,
    pub verify_ext: fn(&[u8], &[u8], &[u8], &[u8]) -> bool,
    pub verify_int: fn(&[u8], &[u8], &[u8]) -> bool,
}

fn rustcrypto() -> Slh {
    use slh_dsa::{Shake256f as P, Signature, SigningKey, VerifyingKey};
    fn sk(b: &[u8]) -> Option<SigningKey<P>> {
        SigningKey::<P>::try_from(b).ok()
    }
    fn vk_sig(pk: &[u8], s: &[u8]) -> Option<(VerifyingKey<P>, Signature<P>)> {
        Some((
            VerifyingKey::<P>::try_from(pk).ok()?,
            Signature::<P>::try_from(s).ok()?,
        ))
    }
    Slh {
        name: "rustcrypto",
        keygen: |s, p, q| {
            let k = SigningKey::<P>::slh_keygen_internal(s, p, q);
            let vk: &VerifyingKey<P> = k.as_ref();
            Some((vk.to_bytes().to_vec(), k.to_bytes().to_vec()))
        },
        sign_ext: |b, m, ctx, rnd| {
            Some(
                sk(b)?
                    .try_sign_with_context(m, ctx, rnd)
                    .ok()?
                    .to_bytes()
                    .to_vec(),
            )
        },
        sign_int: |b, m, rnd| Some(sk(b)?.slh_sign_internal(&[m], rnd).to_bytes().to_vec()),
        verify_ext: |pk, m, ctx, s| {
            vk_sig(pk, s).is_some_and(|(k, s)| k.try_verify_with_context(m, ctx, &s).is_ok())
        },
        verify_int: |pk, m, s| {
            vk_sig(pk, s).is_some_and(|(k, s)| k.slh_verify_internal(&[m], &s).is_ok())
        },
    }
}

/// Serves exactly the supplied bytes to the one `fill_bytes` call FIPS 205
/// hedged signing makes, and refuses anything else.
struct Supplied<'a>(&'a [u8]);

impl rand_core::RngCore for Supplied<'_> {
    fn next_u32(&mut self) -> u32 {
        panic!("the supplied-randomness RNG serves only fill_bytes")
    }
    fn next_u64(&mut self) -> u64 {
        panic!("the supplied-randomness RNG serves only fill_bytes")
    }
    fn fill_bytes(&mut self, out: &mut [u8]) {
        self.try_fill_bytes(out)
            .expect("supplied randomness has the requested length")
    }
    fn try_fill_bytes(&mut self, out: &mut [u8]) -> Result<(), rand_core::Error> {
        if out.len() != self.0.len() {
            return Err(rand_core::Error::from(
                core::num::NonZeroU32::new(rand_core::Error::CUSTOM_START).unwrap(),
            ));
        }
        out.copy_from_slice(self.0);
        Ok(())
    }
}

impl rand_core::CryptoRng for Supplied<'_> {}

fn fips205() -> Slh {
    #![allow(deprecated)] // fips205 names its internal-interface entry points for vector testing only
    use fips205::slh_dsa_shake_256f as s;
    use fips205::traits::{KeyGen, SerDes, Signer, Verifier};
    fn arr<const N: usize>(b: &[u8]) -> Option<[u8; N]> {
        b.try_into().ok()
    }
    Slh {
        name: "fips205",
        keygen: |a, b, c| {
            let (pk, sk) = s::KG::keygen_with_seeds(&arr::<32>(a)?, &arr::<32>(b)?, &arr::<32>(c)?);
            Some((pk.into_bytes().to_vec(), sk.into_bytes().to_vec()))
        },
        sign_ext: |b, m, ctx, rnd| {
            let sk = s::PrivateKey::try_from_bytes(&arr(b)?).ok()?;
            let sig = sk
                .try_sign_with_rng(&mut Supplied(rnd.unwrap_or(&[])), m, ctx, rnd.is_some())
                .ok()?;
            Some(sig.to_vec())
        },
        sign_int: |b, m, rnd| {
            let sk = s::PrivateKey::try_from_bytes(&arr(b)?).ok()?;
            let sig = sk
                ._test_only_raw_sign(&mut Supplied(rnd.unwrap_or(&[])), m, rnd.is_some())
                .ok()?;
            Some(sig.to_vec())
        },
        verify_ext: |pk, m, ctx, sig| match (
            arr(pk).and_then(|p| s::PublicKey::try_from_bytes(&p).ok()),
            arr(sig),
        ) {
            (Some(pk), Some(sig)) => pk.verify(m, &sig, ctx),
            _ => false,
        },
        verify_int: |pk, m, sig| match (
            arr(pk).and_then(|p| s::PublicKey::try_from_bytes(&p).ok()),
            arr(sig),
        ) {
            (Some(pk), Some(sig)) => pk._test_only_raw_verify(m, &sig).unwrap_or(false),
            _ => false,
        },
    }
}

pub fn impls() -> [Slh; 2] {
    [rustcrypto(), fips205()]
}

fn flip(b: &[u8]) -> Vec<u8> {
    let mut v = b.to_vec();
    match v.first_mut() {
        Some(x) => *x ^= 1,
        None => v.push(1),
    }
    v
}

fn shape(c: &Case) -> String {
    let iface = match (c.group_str("signatureInterface"), c.group_str("preHash")) {
        (Some("external"), Some("preHash")) => "ext-prehash",
        (Some("external"), _) => "ext-pure",
        (Some("internal"), _) => "internal",
        other => panic!("tcId {}: unknown SLH-DSA interface {other:?}", c.tc),
    };
    match c.group_bool("deterministic") {
        Some(true) => format!("{iface} det"),
        Some(false) => format!("{iface} hedged"),
        None => iface.to_string(),
    }
}

pub fn run(r: &mut Report, rev: &str, mode: &str, cases: &[Case]) {
    let mut first = std::collections::BTreeSet::new();
    let mut other_sets = std::collections::BTreeSet::new();
    for c in cases {
        let set = c.group_str("parameterSet").expect("parameterSet");
        if set != SET {
            other_sets.insert(set.to_string());
            continue;
        }
        let sh = if mode == "keyGen" {
            String::new()
        } else {
            format!(" {}", shape(c))
        };
        let key = format!("{set} {mode}{sh} ({rev})");
        if sh.contains("prehash") {
            r.not_run(
                &key,
                "HashSLH-DSA (pre-hash) is not used anywhere in the estate",
            );
            continue;
        }
        let teeth = first.insert(key.clone());
        for imp in impls() {
            let (ok, control) = match mode {
                "keyGen" => {
                    let (a, b, p) = (c.hex("skSeed"), c.hex("skPrf"), c.hex("pkSeed"));
                    let want = Some((c.hex("pk"), c.hex("sk")));
                    (
                        (imp.keygen)(&a, &b, &p) == want,
                        teeth.then(|| (imp.keygen)(&flip(&a), &b, &p) != want),
                    )
                }
                "sigGen" => {
                    let (sk, m) = (c.hex("sk"), c.hex("message"));
                    let rnd = (c.group_bool("deterministic") == Some(false))
                        .then(|| c.hex("additionalRandomness"));
                    let want = Some(c.hex("signature"));
                    let sign = |m: &[u8]| {
                        if sh.contains("internal") {
                            (imp.sign_int)(&sk, m, rnd.as_deref())
                        } else {
                            (imp.sign_ext)(&sk, m, &c.hex("context"), rnd.as_deref())
                        }
                    };
                    (sign(&m) == want, teeth.then(|| sign(&flip(&m)) != want))
                }
                "sigVer" => {
                    let (pk, m, s) = (c.hex("pk"), c.hex("message"), c.hex("signature"));
                    let want = c.passed();
                    let verify = |m: &[u8]| {
                        if sh.contains("internal") {
                            (imp.verify_int)(&pk, m, &s)
                        } else {
                            (imp.verify_ext)(&pk, m, &c.hex("context"), &s)
                        }
                    };
                    (
                        verify(&m) == want,
                        (teeth && want).then(|| !verify(&flip(&m))),
                    )
                }
                other => panic!("unknown SLH-DSA mode {other}"),
            };
            r.record(&key, imp.name, c.tc, ok);
            if let Some(refused) = control {
                r.record(
                    &format!("{key} TEETH one input byte flipped"),
                    imp.name,
                    c.tc,
                    refused,
                );
            }
        }
    }
    if !other_sets.is_empty() {
        let list: Vec<_> = other_sets.into_iter().collect();
        r.not_run(
            &format!("SLH-DSA {mode} ({rev}) other parameter sets"),
            &format!("not used by the estate: {}", list.join(", ")),
        );
    }
}
