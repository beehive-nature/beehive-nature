//! The two accepted release-signature profiles, verified in-process with
//! the integritychain `fips204` crate: the first of the two ML-DSA-65
//! implementations rule 2 requires (the second is the frozen bsigner CLI,
//! RustCrypto ml-dsa, see verify.rs).
//!
//! - SPEC-BPQ-1 §3b detached signatures. The id derivation and the signed
//!   message are reproduced from crates/bsigner/src/bpq.rs (`id_from`,
//!   `succession_commit`, `verify_detached`) and surfaces/bpq.js (`idFrom`,
//!   `detachedMsg`, `AT_RE`).
//! - `bheart.signature/1`, what `bsigner sign` emits (crates/bsigner/src/
//!   envelope.rs), with the verifying key carried in the envelope's `vk`
//!   and the signer id `mldsa65:` + base64url(SHA3-256(vk)).

use bech32::{FromBase32, ToBase32, Variant};
use fips204::ml_dsa_65;
use fips204::traits::{SerDes, Verifier};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};

use crate::b64::{b64u, unb64u, unb64u32};
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

// ---------------------------------------------------------------------------
// The second profile: `bheart.signature/1`, as the frozen `bsigner sign`
// writes it (crates/bsigner/src/envelope.rs `sign_envelope`): ML-DSA-65 over
// the RAW record bytes, empty context, no domain prefix. `signed_at_ms` and
// `agility` are NOT covered by the signature. The envelope carries the
// verifying key beside it (`vk`), and the signer id is
// `mldsa65:` + base64url(SHA3-256(verifying key)).

pub const BHEART_TYPE: &str = "bheart.signature/1";
pub const BHEART_ALG: &str = "ml-dsa-65";
pub const BHEART_DIGEST: &str = "sha3-256";
pub const MLDSA65_PREFIX: &str = "mldsa65:";

/// The signer id of the bheart profile: `mldsa65:` + base64url without
/// padding of SHA3-256(verifying key bytes), 43 characters after the prefix.
pub fn mldsa65_id(vk: &[u8]) -> Option<String> {
    (vk.len() == DSA_PK_LEN).then(|| format!("{MLDSA65_PREFIX}{}", b64u(&sha3(&[vk]))))
}

/// A well-formed `mldsa65:` id: the prefix and a strict 32-byte base64url digest.
pub fn is_mldsa65_id(s: &str) -> bool {
    s.strip_prefix(MLDSA65_PREFIX)
        .is_some_and(|d| d.len() == 43 && unb64u32(d).is_some())
}

/// A signer id of either accepted profile (record.signers, genesis_signers).
pub fn is_signer_id(s: &str) -> bool {
    is_bzpq_id(s) || is_mldsa65_id(s)
}

/// bsigner's key id (crates/bsigner/src/keys.rs `derive_key_id`):
/// `bheart-` + the first 16 characters of base64url(SHA3-256(UTF-8(alg) || key)).
pub fn bheart_key_id(vk: &[u8]) -> String {
    let d = b64u(&sha3(&[BHEART_ALG.as_bytes(), vk]));
    format!("bheart-{}", &d[..16])
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BheartDigest {
    pub alg: String,
    pub b64u: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BheartContent {
    pub bytes: u64,
    pub digest: BheartDigest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BheartSignature {
    pub alg: String,
    pub b64u: String,
    pub bytes: u64,
}

/// `bheart.signature/1`, the exact field set bsigner writes and nothing else
/// (fields in bytewise order, so the serialization is canonical).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BheartSig {
    pub agility: String,
    pub alg: String,
    pub content: BheartContent,
    pub key_id: String,
    pub signature: BheartSignature,
    pub signed_at_ms: u64,
    #[serde(rename = "type")]
    pub kind: String,
}

/// An envelope's `sig`: a SPEC-BPQ-1 §3b detached signature, or a
/// `bheart.signature/1`. An object with a `type` field is read as the
/// second, anything else as the first; each is then parsed strictly
/// (deny_unknown_fields), so no object is both.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum Sig {
    Bpq(DetachedSig),
    Bheart(BheartSig),
}

impl<'de> Deserialize<'de> for Sig {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let v = serde_json::Value::deserialize(d)?;
        let bheart = v.as_object().is_some_and(|o| o.contains_key("type"));
        let out = if bheart {
            serde_json::from_value(v).map(Sig::Bheart)
        } else {
            serde_json::from_value(v).map(Sig::Bpq)
        };
        out.map_err(|e| D::Error::custom(e.to_string()))
    }
}

/// Every check of a `bheart.signature/1` that is not the lattice
/// arithmetic, against the envelope's `vk` and the record bytes: the type,
/// both algorithm ids, the key id bsigner derives from `vk`, the content
/// size and SHA3-256, the signature length. The message is the record bytes
/// themselves; the id is the `mldsa65:` id of `vk`.
pub fn precheck_bheart(b: &BheartSig, vk: &str, file: &[u8]) -> Result<Pre, Refusal> {
    if b.kind != BHEART_TYPE {
        return Err(Refusal::Field("sig.type (bheart.signature/1)"));
    }
    if b.alg != BHEART_ALG || b.signature.alg != BHEART_ALG {
        return Err(Refusal::Field("sig.alg and sig.signature.alg (ml-dsa-65)"));
    }
    if b.content.digest.alg != BHEART_DIGEST {
        return Err(Refusal::Field("sig.content.digest.alg (sha3-256)"));
    }
    if b.agility.is_empty()
        || b.agility.len() > 256
        || !b.agility.bytes().all(|c| (0x20..=0x7e).contains(&c))
    {
        return Err(Refusal::Field("sig.agility"));
    }
    if b.signed_at_ms > crate::record::MAX_SAFE {
        return Err(Refusal::Field("sig.signed_at_ms"));
    }
    let dsa = unb64u(vk)
        .filter(|k| k.len() == DSA_PK_LEN)
        .ok_or(Refusal::Field(
            "vk (base64url of a 1952-byte ML-DSA-65 key)",
        ))?;
    let sig = unb64u(&b.signature.b64u)
        .filter(|s| s.len() == DSA_SIG_LEN && b.signature.bytes == DSA_SIG_LEN as u64)
        .ok_or(Refusal::Field("sig.signature (3309 bytes)"))?;
    if b.key_id != bheart_key_id(&dsa) {
        return Err(Refusal::IdMismatch);
    }
    let n = file.len() as u64;
    if b.content.bytes != n
        || b.content.digest.bytes != n
        || b.content.digest.b64u != b64u(&sha3(&[file]))
    {
        return Err(Refusal::FileMismatch);
    }
    Ok(Pre {
        id: mldsa65_id(&dsa).expect("a 1952-byte key"),
        dsa,
        sig,
        message: file.to_vec(),
    })
}

/// The precheck of either profile. `vk` is REQUIRED with a
/// bheart.signature/1 and FORBIDDEN with a §3b signature (which carries its
/// own key and commits to it in its id).
pub fn precheck_sig(s: &Sig, vk: Option<&str>, file: &[u8]) -> Result<Pre, Refusal> {
    match (s, vk) {
        (Sig::Bpq(d), None) => precheck(d, file),
        (Sig::Bpq(_), Some(_)) => Err(Refusal::Field("vk (forbidden with a §3b signature)")),
        (Sig::Bheart(b), Some(vk)) => precheck_bheart(b, vk, file),
        (Sig::Bheart(_), None) => Err(Refusal::Field("vk (required with bheart.signature/1)")),
    }
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
