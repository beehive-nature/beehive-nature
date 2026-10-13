//! SPEC-BPQ-1 §3b detached signatures, verified in-process with the
//! integritychain `fips204` crate: the first of the two ML-DSA-65
//! implementations rule 2 requires (the second is `bsigner bpq-verify`,
//! RustCrypto ml-dsa, see verify.rs). The id derivation and the signed
//! message are reproduced from crates/bsigner/src/bpq.rs (`id_from`,
//! `succession_commit`, `verify_detached`) and surfaces/bpq.js
//! (`idFrom`, `detachedMsg`, `AT_RE`).

use bech32::{FromBase32, ToBase32, Variant};
use fips204::ml_dsa_65;
use fips204::traits::{SerDes, Verifier};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};

use crate::b64::{unb64u, unb64u32};
use crate::record::Refusal;

const DOM_ID: &[u8] = b"bpq1/id";
const DOM_SUCCESSION: &[u8] = b"bpq1/succession";
const DOM_DETACHED: &[u8] = b"bpq1/detached";
const ID_HRP: &str = "bzpq";
pub const DSA_PK_LEN: usize = ml_dsa_65::PK_LEN; // 1952
pub const DSA_SIG_LEN: usize = ml_dsa_65::SIG_LEN; // 3309

pub fn sha3(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

/// `successionCommit = SHA3-256("bpq1/succession" || SLH-DSA public key)`.
pub fn succession_commit(slh_public: &[u8]) -> [u8; 32] {
    sha3(&[DOM_SUCCESSION, slh_public])
}

/// The self-certifying id: bech32m("bzpq", SHA3-256("bpq1/id" || ML-DSA-65
/// public key || succession commitment)), as bpq.rs `id_from`.
pub fn id_from(dsa_public: &[u8], succession_commit: &[u8]) -> Option<String> {
    if dsa_public.len() != DSA_PK_LEN || succession_commit.len() != 32 {
        return None;
    }
    let d = sha3(&[DOM_ID, dsa_public, succession_commit]);
    bech32::encode(ID_HRP, d.to_base32(), Variant::Bech32m).ok()
}

/// A well-formed bzpq1 id: bech32m, hrp `bzpq`, a 32-byte payload, written
/// exactly as [`id_from`] writes one (lowercase).
pub fn is_bzpq_id(s: &str) -> bool {
    let Ok((hrp, data, variant)) = bech32::decode(s) else {
        return false;
    };
    hrp == ID_HRP
        && variant == Variant::Bech32m
        && Vec::<u8>::from_base32(&data).is_ok_and(|d| d.len() == 32)
        && bech32::encode(&hrp, &data, Variant::Bech32m)
            .ok()
            .as_deref()
            == Some(s)
}

/// `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?Z$`, the shape only (bpq.js
/// `AT_RE`, bpq-core `utc_timestamp`).
pub fn is_at(s: &str) -> bool {
    let b = s.as_bytes();
    let n = b.len();
    if !(n == 20 || (22..=30).contains(&n)) {
        return false;
    }
    let d = |i: usize| b[i].is_ascii_digit();
    let head = (0..4).all(d)
        && b[4] == b'-'
        && d(5)
        && d(6)
        && b[7] == b'-'
        && d(8)
        && d(9)
        && b[10] == b'T'
        && d(11)
        && d(12)
        && b[13] == b':'
        && d(14)
        && d(15)
        && b[16] == b':'
        && d(17)
        && d(18);
    head && b[n - 1] == b'Z' && (n == 20 || (b[19] == b'.' && (20..n - 1).all(d)))
}

/// `"bpq1/detached" || SHA3-256(file) || SHA3-256(UTF-8(id "\n" at "\n" size))`.
pub fn detached_message(id: &str, at: &str, size: u64, file_hash: &[u8; 32]) -> Vec<u8> {
    let meta = sha3(&[format!("{id}\n{at}\n{size}").as_bytes()]);
    [DOM_DETACHED, &file_hash[..], &meta[..]].concat()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SigFile {
    pub sha3: String,
    pub size: u64,
}

/// `{bpq:1, kind:"detached", id, at, file:{size, sha3}, dsa, succ, sig}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DetachedSig {
    pub at: String,
    pub bpq: u64,
    pub dsa: String,
    pub file: SigFile,
    pub id: String,
    pub kind: String,
    pub sig: String,
    pub succ: String,
}

/// The decoded parts of a signature whose shape, id and file binding hold.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pre {
    pub id: String,
    pub dsa: Vec<u8>,
    pub sig: Vec<u8>,
    pub message: Vec<u8>,
}

/// Every check that is not the lattice arithmetic: kind, bpq, at, key and
/// signature lengths, the id from (dsa, succ), and that the signature names
/// exactly these bytes. Both verifiers run only on what passes here.
pub fn precheck(d: &DetachedSig, file: &[u8]) -> Result<Pre, Refusal> {
    if d.kind != "detached" || d.bpq != 1 {
        return Err(Refusal::Field("sig (kind detached, bpq 1)"));
    }
    if !is_at(&d.at) {
        return Err(Refusal::Field("sig.at"));
    }
    let dsa = unb64u(&d.dsa)
        .filter(|k| k.len() == DSA_PK_LEN)
        .ok_or(Refusal::Field("sig.dsa"))?;
    let succ = unb64u32(&d.succ).ok_or(Refusal::Field("sig.succ"))?;
    let sig = unb64u(&d.sig)
        .filter(|s| s.len() == DSA_SIG_LEN)
        .ok_or(Refusal::Field("sig.sig"))?;
    let want = unb64u32(&d.file.sha3).ok_or(Refusal::Field("sig.file.sha3"))?;
    if id_from(&dsa, &succ).as_deref() != Some(d.id.as_str()) {
        return Err(Refusal::IdMismatch);
    }
    let fh = sha3(&[file]);
    if d.file.size != file.len() as u64 || fh != want {
        return Err(Refusal::FileMismatch);
    }
    Ok(Pre {
        id: d.id.clone(),
        message: detached_message(&d.id, &d.at, d.file.size, &fh),
        dsa,
        sig,
    })
}

/// ML-DSA-65 (FIPS 204 Algorithm 3, empty context string, as bpq.js and
/// bsigner sign) by the fips204 crate.
pub fn fips204_ok(pre: &Pre) -> bool {
    let (Ok(pk), Ok(sig)) = (
        <[u8; DSA_PK_LEN]>::try_from(&pre.dsa[..]),
        <[u8; DSA_SIG_LEN]>::try_from(&pre.sig[..]),
    ) else {
        return false;
    };
    let Ok(pk) = ml_dsa_65::PublicKey::try_from_bytes(pk) else {
        return false;
    };
    pk.verify(&pre.message, &sig, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn at_shape_is_exactly_the_bpq_js_pattern() {
        for ok in [
            "2026-10-12T00:00:00Z",
            "2026-10-12T00:00:00.1Z",
            "2026-10-12T00:00:00.123456789Z",
            "9999-99-99T99:99:99Z",
        ] {
            assert!(is_at(ok), "{ok}");
        }
        for bad in [
            "2026-10-12T00:00:00",
            "2026-10-12T00:00:00.Z",
            "2026-10-12T00:00:00.1234567890Z",
            "2026-10-12 00:00:00Z",
            "2026-10-12T00:00:00Z\n",
            "2026-10-12T00:00:00z",
            "2026-1-12T00:00:00Z",
            "2026-10-12T00:00:00+00:00",
            "",
        ] {
            assert!(!is_at(bad), "{bad:?}");
        }
    }
}
