//! FIPS adapters to the existing ACVP gates. These are test adapters,
//! not a replacement implementation or a proof of x0x composition.
#![allow(deprecated)] // fips204's ACVP-only internal interface, pinned here

use btungsten_pq::{mldsa::Dsa, mlkem::Kem};
use fips203::{
    ml_kem_768 as k,
    traits::{Decaps, Encaps, KeyGen, SerDes},
};
use fips204::{
    ml_dsa_65 as d,
    traits::{KeyGen as DsaKeyGen, SerDes as DsaSerDes, Signer, Verifier},
};

pub fn kem() -> Kem {
    Kem {
        name: "fips203",
        keygen: |seed, z| {
            let (pk, sk) = k::KG::keygen_from_seed(seed.try_into().unwrap(), z.try_into().unwrap());
            (pk.into_bytes().to_vec(), sk.into_bytes().to_vec())
        },
        encaps: |pk, seed| {
            let pk = k::EncapsKey::try_from_bytes(pk.try_into().ok()?).ok()?;
            let (ss, ct) = pk.encaps_from_seed(&seed.try_into().ok()?);
            Some((ct.into_bytes().to_vec(), ss.into_bytes().to_vec()))
        },
        decaps_expanded: |sk, ct| {
            let sk = k::DecapsKey::try_from_bytes(sk.try_into().ok()?).ok()?;
            let ct = k::CipherText::try_from_bytes(ct.try_into().ok()?).ok()?;
            Some(sk.try_decaps(&ct).ok()?.into_bytes().to_vec())
        },
        decaps_seed: |seed, z, ct| {
            let (_, sk) = k::KG::keygen_from_seed(seed.try_into().ok()?, z.try_into().ok()?);
            let ct = k::CipherText::try_from_bytes(ct.try_into().ok()?).ok()?;
            Some(sk.try_decaps(&ct).ok()?.into_bytes().to_vec())
        },
        ek_check: |pk| {
            pk.try_into()
                .ok()
                .and_then(|pk| k::EncapsKey::try_from_bytes(pk).ok())
                .is_some()
        },
        dk_check: |sk| {
            sk.try_into()
                .ok()
                .and_then(|sk| k::DecapsKey::try_from_bytes(sk).ok())
                .is_some()
        },
    }
}

pub fn dsa() -> Dsa {
    Dsa {
        name: "fips204",
        keygen: |seed| {
            let (pk, sk) = d::KG::keygen_from_seed(&seed.try_into().ok()?);
            Some((pk.into_bytes().to_vec(), sk.into_bytes().to_vec()))
        },
        sign_ext: |sk, m, ctx, rnd| {
            let sk = d::PrivateKey::try_from_bytes(sk.try_into().ok()?).ok()?;
            let rnd = rnd.map_or(Some([0; 32]), |r| r.try_into().ok())?;
            Some(sk.try_sign_with_seed(&rnd, m, ctx).ok()?.to_vec())
        },
        sign_int: |sk, m, rnd| {
            let sk = d::PrivateKey::try_from_bytes(sk.try_into().ok()?).ok()?;
            let rnd = rnd.map_or(Some([0; 32]), |r| r.try_into().ok())?;
            Some(d::_internal_sign(&sk, m, b"", rnd).ok()?.to_vec())
        },
        sign_mu_det: None,
        verify_ext: |pk, m, ctx, sig| match (
            pk.try_into()
                .ok()
                .and_then(|pk| d::PublicKey::try_from_bytes(pk).ok()),
            sig.try_into(),
        ) {
            (Some(pk), Ok(sig)) => pk.verify(m, &sig, ctx),
            _ => false,
        },
        verify_int: |pk, m, sig| match (
            pk.try_into()
                .ok()
                .and_then(|pk| d::PublicKey::try_from_bytes(pk).ok()),
            sig.try_into(),
        ) {
            (Some(pk), Ok(sig)) => d::_internal_verify(&pk, m, &sig, b""),
            _ => false,
        },
        verify_mu: None,
    }
}
