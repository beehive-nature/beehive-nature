//! Proof entry points call the actual candidate and pinned Saorsa methods.
//! No copied verifier, substituted arithmetic, or cryptographic claim lives here.
#![forbid(unsafe_code)]

#[path = "../../src/lib.rs"]
pub mod candidate;

use candidate::PreparedMlDsa65PublicKey;
use saorsa_pqc::{
    api::sig::{ml_dsa_65, MlDsaPublicKey, MlDsaSignature, MlDsaVariant},
    pqc::{self, MlDsa65, MlDsaOperations},
};

pub fn modern(pk: &[u8], m: &[u8], s: &[u8], ctx: &[u8]) -> bool {
    let Ok(pk) = MlDsaPublicKey::from_bytes(MlDsaVariant::MlDsa65, pk) else {
        return false;
    };
    let Ok(s) = MlDsaSignature::from_bytes(MlDsaVariant::MlDsa65, s) else {
        std::mem::forget(pk);
        return false;
    };
    let accepted = matches!(ml_dsa_65().verify_with_context(&pk, m, &s, ctx), Ok(true));
    // The proof observes the decision before the caller destroys its imported
    // public API objects. Their Vec zeroization uses unsupported MIR intrinsics.
    // This test-only adapter leaks those public objects until process exit;
    // Saorsa's own local expanded-key destructors still run. No erasure claim.
    std::mem::forget(pk);
    std::mem::forget(s);
    accepted
}

pub fn legacy(pk: &[u8], m: &[u8], s: &[u8]) -> bool {
    let Ok(pk) = pqc::types::MlDsaPublicKey::from_bytes(pk) else {
        return false;
    };
    let Ok(s) = pqc::types::MlDsaSignature::from_bytes(s) else {
        return false;
    };
    matches!(MlDsa65::new().verify(&pk, m, &s), Ok(true))
}

pub fn prepared(pk: &[u8], m: &[u8], s: &[u8], ctx: &[u8]) -> bool {
    let Ok(pk) = PreparedMlDsa65PublicKey::from_bytes(pk) else {
        return false;
    };
    pk.verify(m, s, ctx)
}

/// Two operations on one retained key; the second can have unrelated inputs.
pub fn reuse(
    pk: &[u8],
    m1: &[u8],
    s1: &[u8],
    c1: &[u8],
    m2: &[u8],
    s2: &[u8],
    c2: &[u8],
) -> (bool, bool) {
    let Ok(pk) = PreparedMlDsa65PublicKey::from_bytes(pk) else {
        return (false, false);
    };
    (pk.verify(m1, s1, c1), pk.verify(m2, s2, c2))
}

/// These deliberately defective wrappers are separate proof obligations.
pub fn accept_all(_: &[u8], _: &[u8], _: &[u8], _: &[u8]) -> bool {
    true
}

pub fn reject_all(_: &[u8], _: &[u8], _: &[u8], _: &[u8]) -> bool {
    false
}

pub fn truncate_message(pk: &[u8], m: &[u8], s: &[u8], ctx: &[u8]) -> bool {
    prepared(pk, &m[..m.len().min(256)], s, ctx)
}

pub fn drop_context(pk: &[u8], m: &[u8], s: &[u8], _: &[u8]) -> bool {
    prepared(pk, m, s, b"")
}

pub fn truncate_signature(pk: &[u8], m: &[u8], s: &[u8], ctx: &[u8]) -> bool {
    prepared(pk, m, &s[..s.len().min(3309)], ctx)
}

pub fn replace_key(_: &[u8], m: &[u8], s: &[u8], ctx: &[u8]) -> bool {
    prepared(&[0; 1952], m, s, ctx)
}

pub fn cached_result(
    pk: &[u8],
    m1: &[u8],
    s1: &[u8],
    c1: &[u8],
    _: &[u8],
    _: &[u8],
    _: &[u8],
) -> (bool, bool) {
    let first = prepared(pk, m1, s1, c1);
    (first, first)
}
