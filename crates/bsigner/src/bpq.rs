//! BPQ — the Rust twin of `surfaces/bpq.js`: derives the same PQ keys from a
//! bzDiD master PRK and opens and verifies the same sealed objects, cards and
//! bindings. Spec of record: `docs/specs/SPEC-BPQ-1.md`.
//!
//! Two independent implementations (RustCrypto here, @noble/post-quantum in
//! the browser) must agree on `surfaces/bpq-vectors.json`; the tests below
//! read that file at compile time, so CI fails if either side drifts.
//!
//! # Primitives, cited at source
//!
//! - ML-DSA-65 key from a 32-byte seed: `ml-dsa` 0.1.1 `signing.rs:55`
//!   (`from_seed`); verify `verifying.rs:195` (see pq.rs).
//! - X-Wing (draft-connolly-cfrg-xwing-kem): the seed is expanded with
//!   SHAKE-256 to 96 bytes; bytes 0..64 are the ML-KEM-768 seed d||z
//!   (`ml-kem` 0.3.2 `decapsulation_key.rs:51` `from_seed`), bytes 64..96 the
//!   X25519 secret. Shared secret = SHA3-256(ss_M || ss_X || ct_X || pk_X ||
//!   "\.//^\"), the same combiner as @noble/post-quantum 0.7.1
//!   `src/hybrid.ts:842-852`.
//! - AES-256-GCM (`aes-gcm` 0.10), HKDF-SHA-256 (`hkdf` 0.12), SHA3-256.
//!
//! What this file does not do: seal. Sealing happens where the plaintext is,
//! in the browser; this twin exists so a sealed object stays openable and
//! verifiable without any browser at all.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use bech32::{FromBase32, ToBase32, Variant};
use hkdf::Hkdf;
use ml_dsa::{
    EncodedVerifyingKey, Keypair, MlDsa65, Signature, SigningKey, Verifier, VerifyingKey,
};
use ml_kem::kem::{Decapsulate, KeyExport};
use ml_kem::MlKem768;
use serde_json::Value;
use sha2::Sha256;
use sha3::digest::{ExtendableOutput, Update, XofReader};
use sha3::{Digest, Sha3_256, Shake256};
use x25519_dalek::{PublicKey as XPublic, StaticSecret};
use zeroize::{Zeroize, Zeroizing};

use crate::b64;

// FROZEN v1 BYTE CONSTANTS — identical to surfaces/bpq.js.
pub const LABEL_DSA: &str = "BDID-v1/ml-dsa-65-record-key";
pub const LABEL_KEM: &str = "BDID-v1/x-wing-kem-key";
pub const LABEL_VAULT: &str = "BDID-v1/vault-key";
const DOM_ID: &[u8] = b"bpq1/id";
const DOM_CARD: &[u8] = b"bpq1/card";
const DOM_BIND: &[u8] = b"bpq1/bind";
const DOM_DETACHED: &[u8] = b"bpq1/detached";
const DOM_KC: &[u8] = b"bpq1/key-commit";
const DOM_SEAL: &[u8] = b"bpq1/seal";
const DOM_WRAP_SELF: &[u8] = b"bpq1/wrap/self";
const DOM_WRAP_XWING: &[u8] = b"bpq1/wrap/x-wing";
const MAGIC: [u8; 8] = [0x89, 0x42, 0x50, 0x51, 0x31, 0x0d, 0x0a, 0x1a];
const XWING_LABEL: &[u8] = b"\\.//^\\";
const ID_HRP: &str = "bzpq";
const SEG_MIN: u64 = 1024;
const SEG_MAX: u64 = 16_777_216;
const FLAG_MORE: u32 = 0;
const FLAG_FINAL: u32 = 1;
const FLAG_META: u32 = 2;
const FLAG_SEAL: u32 = 3;
const DSA_PK_LEN: usize = 1952;
const XWING_PK_LEN: usize = 1216;
const XWING_CT_LEN: usize = 1120;

fn sha3(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    for p in parts {
        Digest::update(&mut h, p);
    }
    h.finalize().into()
}

fn expand_label(master_prk: &[u8; 32], label: &str, context: &str, out: &mut [u8]) {
    let hk =
        Hkdf::<Sha256>::from_prk(master_prk).expect("a 32-byte PRK is a valid HKDF-SHA256 PRK");
    let info = [label.as_bytes(), context.as_bytes()].concat();
    hk.expand(&info, out)
        .expect("output lengths used here are far below the HKDF limit");
}

fn hkdf32(ikm: &[u8], salt: &[u8], info: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut out = Zeroizing::new([0u8; 32]);
    Hkdf::<Sha256>::new(Some(salt), ikm)
        .expand(info, out.as_mut())
        .expect("32 bytes is within the HKDF limit");
    out
}

fn nonce(flag: u32, index: u64) -> [u8; 12] {
    let mut n = [0u8; 12];
    n[..4].copy_from_slice(&flag.to_be_bytes());
    n[4..].copy_from_slice(&index.to_be_bytes());
    n
}

fn gcm_open(key: &[u8; 32], nonce_bytes: &[u8; 12], sealed: &[u8], aad: &[u8]) -> Option<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    cipher
        .decrypt(Nonce::from_slice(nonce_bytes), Payload { msg: sealed, aad })
        .ok()
}

fn unb64(s: &Value) -> Result<Vec<u8>, BpqError> {
    s.as_str()
        .and_then(b64::b64u_decode)
        .ok_or(BpqError::Format("bad base64url field"))
}

#[derive(Debug, PartialEq, Eq)]
pub enum BpqError {
    Format(&'static str),
    NoKey,
    Auth(&'static str),
}

impl std::fmt::Display for BpqError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BpqError::Format(w) => write!(f, "not a valid bpq1 object: {w}"),
            BpqError::NoKey => write!(f, "none of the keys you hold opens this object"),
            BpqError::Auth(w) => write!(f, "{w} failed authentication"),
        }
    }
}

/// The PQ keys a bzDiD root derives for one context. Secret halves are
/// zeroed on drop.
pub struct PqKeys {
    pub dsa_public: Vec<u8>,
    pub kem_public: Vec<u8>,
    kem_seed: Zeroizing<[u8; 32]>,
    vault: Zeroizing<[u8; 32]>,
}

impl PqKeys {
    pub fn vault(&self) -> &[u8; 32] {
        &self.vault
    }

    fn xwing_parts(&self) -> (ml_kem::DecapsulationKey<MlKem768>, StaticSecret, XPublic) {
        xwing_expand(&self.kem_seed)
    }

    fn xwing_decapsulate(&self, ct: &[u8]) -> Option<Zeroizing<[u8; 32]>> {
        if ct.len() != XWING_CT_LEN {
            return None;
        }
        let (dk, x_sk, x_pk) = self.xwing_parts();
        let ct_m = ml_kem::Ciphertext::<MlKem768>::try_from(&ct[..1088]).ok()?;
        let ss_m = dk.decapsulate(&ct_m);
        let mut ct_x = [0u8; 32];
        ct_x.copy_from_slice(&ct[1088..]);
        let ss_x = x_sk.diffie_hellman(&XPublic::from(ct_x));
        Some(Zeroizing::new(sha3(&[
            ss_m.as_slice(),
            ss_x.as_bytes(),
            &ct_x,
            x_pk.as_bytes(),
            XWING_LABEL,
        ])))
    }
}

fn xwing_expand(seed: &[u8; 32]) -> (ml_kem::DecapsulationKey<MlKem768>, StaticSecret, XPublic) {
    let mut x = Shake256::default();
    x.update(seed);
    let mut wide = Zeroizing::new([0u8; 96]);
    x.finalize_xof().read(wide.as_mut());
    let mut d_z = [0u8; 64];
    d_z.copy_from_slice(&wide[..64]);
    let dk = ml_kem::DecapsulationKey::<MlKem768>::from_seed(d_z.into());
    d_z.zeroize();
    let mut xs = [0u8; 32];
    xs.copy_from_slice(&wide[64..]);
    let x_sk = StaticSecret::from(xs);
    xs.zeroize();
    let x_pk = XPublic::from(&x_sk);
    (dk, x_sk, x_pk)
}

/// Derive the ML-DSA-65 and X-Wing public keys and the vault key for one
/// context. (The SLH-DSA succession key is derived in the browser; here its
/// commitment is an input wherever the id is checked.)
pub fn keys(master_prk: &[u8; 32], context: &str) -> PqKeys {
    let mut dsa_seed = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, LABEL_DSA, context, dsa_seed.as_mut());
    let mut kem_seed = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, LABEL_KEM, context, kem_seed.as_mut());
    let mut vault = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, LABEL_VAULT, context, vault.as_mut());
    let seed: ml_dsa::Seed = (*dsa_seed).into();
    let sk = SigningKey::<MlDsa65>::from_seed(&seed);
    let dsa_public = sk.verifying_key().encode().to_vec();
    let (dk, _x_sk, x_pk) = xwing_expand(&kem_seed);
    let mut kem_public = dk.encapsulation_key().to_bytes().to_vec();
    kem_public.extend_from_slice(x_pk.as_bytes());
    PqKeys {
        dsa_public,
        kem_public,
        kem_seed,
        vault,
    }
}

/// The self-certifying id: bech32m("bzpq", SHA3-256("bpq1/id" || ML-DSA-65
/// public key || succession commitment)).
pub fn id_from(dsa_public: &[u8], succession_commit: &[u8]) -> Option<String> {
    if dsa_public.len() != DSA_PK_LEN || succession_commit.len() != 32 {
        return None;
    }
    let d = sha3(&[DOM_ID, dsa_public, succession_commit]);
    bech32::encode(ID_HRP, d.to_base32(), Variant::Bech32m).ok()
}

fn dsa_verify(public: &[u8], msg: &[u8], sig: &[u8]) -> bool {
    let Ok(enc) = EncodedVerifyingKey::<MlDsa65>::try_from(public) else {
        return false;
    };
    let vk = VerifyingKey::<MlDsa65>::decode(&enc);
    let Ok(sig) = Signature::<MlDsa65>::try_from(sig) else {
        return false;
    };
    vk.verify(msg, &sig).is_ok()
}

/// A public key card: id, ML-DSA-65 key, X-Wing key, succession commitment,
/// signed by the ML-DSA-65 key.
pub fn verify_card(card: &Value) -> bool {
    let (Ok(dsa), Ok(kem), Ok(succ), Ok(sig)) = (
        unb64(&card["dsa"]),
        unb64(&card["kem"]),
        unb64(&card["succ"]),
        unb64(&card["sig"]),
    ) else {
        return false;
    };
    if kem.len() != XWING_PK_LEN || id_from(&dsa, &succ).as_deref() != card["id"].as_str() {
        return false;
    }
    dsa_verify(&dsa, &[DOM_CARD, &dsa, &kem, &succ].concat(), &sig)
}

/// A binding statement: the PQ id vouching for classical accounts, signed
/// over "id\nat\nkind=value\n…" with kinds sorted.
pub fn verify_bind(b: &Value) -> bool {
    let (Ok(dsa), Ok(succ), Ok(sig)) = (unb64(&b["dsa"]), unb64(&b["succ"]), unb64(&b["sig"]))
    else {
        return false;
    };
    let (Some(id), Some(at), Some(claims)) =
        (b["id"].as_str(), b["at"].as_str(), b["claims"].as_object())
    else {
        return false;
    };
    if id_from(&dsa, &succ).as_deref() != Some(id) {
        return false;
    }
    let mut kinds: Vec<&String> = claims.keys().collect();
    kinds.sort();
    let mut lines = String::new();
    for k in kinds {
        let Some(v) = claims[k].as_str() else {
            return false;
        };
        if v.is_empty() || v.contains('\n') || v.contains('\r') {
            return false;
        }
        lines.push_str(&format!("{k}={v}\n"));
    }
    let digest = sha3(&[format!("{id}\n{at}\n{lines}").as_bytes()]);
    dsa_verify(&dsa, &[DOM_BIND, &digest].concat(), &sig)
}

/// A detached file signature: ML-DSA-65 over "bpq1/detached" || SHA3-256(file)
/// || SHA3-256("id\nat\nsize"), never over the file name. Returns the signer id
/// when the id, the file and the signature all match.
pub fn verify_detached(d: &Value, file: &[u8]) -> Option<String> {
    if d["kind"] != "detached" || d["bpq"].as_u64() != Some(1) {
        return None;
    }
    let (Ok(dsa), Ok(succ), Ok(sig), Ok(want)) = (
        unb64(&d["dsa"]),
        unb64(&d["succ"]),
        unb64(&d["sig"]),
        unb64(&d["file"]["sha3"]),
    ) else {
        return None;
    };
    let (Some(id), Some(at), Some(size)) = (
        d["id"].as_str(),
        d["at"].as_str(),
        d["file"]["size"].as_u64(),
    ) else {
        return None;
    };
    let fh = sha3(&[file]);
    if id_from(&dsa, &succ).as_deref() != Some(id)
        || size != file.len() as u64
        || fh.as_slice() != want.as_slice()
    {
        return None;
    }
    let meta = sha3(&[format!("{id}\n{at}\n{size}").as_bytes()]);
    dsa_verify(&dsa, &[DOM_DETACHED, &fh, &meta].concat(), &sig).then(|| id.to_string())
}

/// The 32-byte master PRK from a `bdidrec1…` recovery code (bech32m; payload
/// = version 0x01 || PRK), the same encoding as onboarding/bzdid-key.js
/// `encodeRecoveryCode`.
pub fn master_prk_from_recovery_code(code: &str) -> Result<Zeroizing<[u8; 32]>, BpqError> {
    let (hrp, data, variant) =
        bech32::decode(code.trim()).map_err(|_| BpqError::Format("not a bdidrec code"))?;
    if hrp != "bdidrec" || variant != Variant::Bech32m {
        return Err(BpqError::Format("not a bdidrec code"));
    }
    let bytes = Zeroizing::new(
        Vec::<u8>::from_base32(&data).map_err(|_| BpqError::Format("bdidrec payload"))?,
    );
    if bytes.len() != 33 || bytes[0] != 1 {
        return Err(BpqError::Format("bdidrec version or length"));
    }
    let mut prk = Zeroizing::new([0u8; 32]);
    prk.copy_from_slice(&bytes[1..]);
    Ok(prk)
}

/// Who can read: the holder of a vault key ("only me"), or the holder of an
/// X-Wing secret ("selected people").
pub enum Reader<'a> {
    SelfVault(&'a [u8; 32]),
    XWing(&'a PqKeys),
}

pub struct SealedBy {
    pub ok: bool,
    pub id: Option<String>,
    pub public_key: Vec<u8>,
}

pub struct Opened {
    pub bytes: Vec<u8>,
    pub meta: Option<Value>,
    pub sealed_by: Option<SealedBy>,
}

fn read_u32(b: &[u8], o: usize) -> Result<usize, BpqError> {
    let s = b.get(o..o + 4).ok_or(BpqError::Format("truncated"))?;
    Ok(u32::from_be_bytes([s[0], s[1], s[2], s[3]]) as usize)
}

fn take<'a>(b: &'a [u8], o: &mut usize, n: usize) -> Result<&'a [u8], BpqError> {
    let s = b.get(*o..*o + n).ok_or(BpqError::Format("truncated"))?;
    *o += n;
    Ok(s)
}

pub fn open(obj: &[u8], reader: &Reader) -> Result<Opened, BpqError> {
    if obj.get(..8) != Some(&MAGIC[..]) {
        return Err(BpqError::Format("magic"));
    }
    let mut o = 8;
    let c = read_u32(obj, o)?;
    o += 4;
    let core_b = take(obj, &mut o, c)?;
    let k = read_u32(obj, o)?;
    o += 4;
    let keys_b = take(obj, &mut o, k)?;
    let m = read_u32(obj, o)?;
    o += 4;
    let meta_b = take(obj, &mut o, m)?;
    let core: Value = serde_json::from_slice(core_b).map_err(|_| BpqError::Format("CORE json"))?;
    let slots: Value = serde_json::from_slice(keys_b).map_err(|_| BpqError::Format("KEYS json"))?;
    if core["bpq"].as_u64() != Some(1) || core["aead"].as_str() != Some("aes-256-gcm") {
        return Err(BpqError::Format("version or aead"));
    }
    let seg = core["seg"].as_u64().ok_or(BpqError::Format("seg"))?;
    let len = core["len"].as_u64().ok_or(BpqError::Format("len"))?;
    if !(SEG_MIN..=SEG_MAX).contains(&seg) {
        return Err(BpqError::Format("seg range"));
    }
    let oid = unb64(&core["oid"])?;
    let kc = unb64(&core["kc"])?;
    let aad = sha3(&[core_b]);
    let n = if len == 0 { 1 } else { len.div_ceil(seg) };
    let body_len = (len + 16 * n) as usize;
    let body = take(obj, &mut o, body_len)?;
    let s = read_u32(obj, o)?;
    o += 4;
    let seal_b = take(obj, &mut o, s)?;
    if o != obj.len() {
        return Err(BpqError::Format("trailing bytes"));
    }

    let mut file_key: Option<Zeroizing<[u8; 32]>> = None;
    for slot in slots.as_array().ok_or(BpqError::Format("KEYS array"))? {
        let kw = match (slot["to"].as_str(), reader) {
            (Some("self"), Reader::SelfVault(v)) => hkdf32(&v[..], &oid, DOM_WRAP_SELF),
            (Some("x-wing"), Reader::XWing(keys)) => {
                match keys.xwing_decapsulate(&unb64(&slot["ct"])?) {
                    Some(ss) => hkdf32(&ss[..], &oid, DOM_WRAP_XWING),
                    None => continue,
                }
            }
            _ => continue,
        };
        let Some(got) = gcm_open(&kw, &[0u8; 12], &unb64(&slot["w"])?, &aad) else {
            continue;
        };
        if got.len() == 32 && sha3(&[DOM_KC, &oid, &got]).as_slice() == kc.as_slice() {
            let mut fk = Zeroizing::new([0u8; 32]);
            fk.copy_from_slice(&got);
            file_key = Some(fk);
            break;
        }
    }
    let fk = file_key.ok_or(BpqError::NoKey)?;

    let mut bytes = Vec::with_capacity(len as usize);
    let mut off = 0usize;
    for i in 0..n {
        let plain_len = (if i == n - 1 { len - i * seg } else { seg }) as usize;
        let part = &body[off..off + plain_len + 16];
        off += plain_len + 16;
        let flag = if i == n - 1 { FLAG_FINAL } else { FLAG_MORE };
        let p = gcm_open(&fk, &nonce(flag, i), part, &aad).ok_or(BpqError::Auth("segment"))?;
        bytes.extend_from_slice(&p);
    }
    let meta = if meta_b.is_empty() {
        None
    } else {
        let p = gcm_open(&fk, &nonce(FLAG_META, 0), meta_b, &aad).ok_or(BpqError::Auth("meta"))?;
        Some(serde_json::from_slice(&p).map_err(|_| BpqError::Format("meta json"))?)
    };
    let sealed_by = if seal_b.is_empty() {
        None
    } else {
        let p = gcm_open(&fk, &nonce(FLAG_SEAL, 0), seal_b, &aad).ok_or(BpqError::Auth("seal"))?;
        let rec: Value = serde_json::from_slice(&p).map_err(|_| BpqError::Format("seal json"))?;
        let pk = unb64(&rec["pk"])?;
        let msg = [
            DOM_SEAL,
            &aad,
            &sha3(&[keys_b]),
            &sha3(&[meta_b]),
            &sha3(&[body]),
        ]
        .concat();
        let sig_ok =
            rec["alg"].as_str() == Some("ml-dsa-65") && dsa_verify(&pk, &msg, &unb64(&rec["sig"])?);
        let id = rec["id"].as_str().map(str::to_string);
        let id_ok = match &id {
            Some(id) => id_from(&pk, &unb64(&rec["succ"])?).as_deref() == Some(id.as_str()),
            None => true,
        };
        Some(SealedBy {
            ok: sig_ok && id_ok,
            id,
            public_key: pk,
        })
    };
    Ok(Opened {
        bytes,
        meta,
        sealed_by,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const VECTORS: &str = include_str!("../../../surfaces/bpq-vectors.json");

    fn root(sentence: &str) -> [u8; 32] {
        Sha256::digest(sentence.as_bytes()).into()
    }

    fn vectors() -> Value {
        serde_json::from_str(VECTORS).expect("bpq-vectors.json parses")
    }

    fn keys_named(v: &Value, name: &str) -> PqKeys {
        let row = v["keys"]
            .as_array()
            .unwrap()
            .iter()
            .find(|r| r["name"] == name)
            .unwrap();
        keys(
            &root(row["rootFrom"].as_str().unwrap()),
            row["context"].as_str().unwrap(),
        )
    }

    #[test]
    fn derivation_matches_the_browser() {
        let v = vectors();
        for row in v["keys"].as_array().unwrap() {
            let k = keys(
                &root(row["rootFrom"].as_str().unwrap()),
                row["context"].as_str().unwrap(),
            );
            assert_eq!(
                b64::b64u(&k.dsa_public),
                row["dsaPublicKey"],
                "ML-DSA-65 key {}",
                row["name"]
            );
            assert_eq!(
                b64::b64u(&k.kem_public),
                row["kemPublicKey"],
                "X-Wing key {}",
                row["name"]
            );
            assert_eq!(
                b64::b64u(&sha3(&[k.vault()])),
                row["vaultKeySha3"],
                "vault key {}",
                row["name"]
            );
            let succ = unb64(&row["successionCommit"]).unwrap();
            assert_eq!(
                id_from(&k.dsa_public, &succ).as_deref(),
                row["id"].as_str(),
                "id {}",
                row["name"]
            );
        }
    }

    #[test]
    fn sealed_objects_open_for_their_readers_only() {
        let v = vectors();
        for o in v["objects"].as_array().unwrap() {
            let obj = unb64(&o["object"]).unwrap();
            for who in o["opens"].as_array().unwrap() {
                let (name, how) = who.as_str().unwrap().split_once(':').unwrap();
                let k = keys_named(&v, name);
                let r = match how {
                    "self" => open(&obj, &Reader::SelfVault(k.vault())),
                    _ => open(&obj, &Reader::XWing(&k)),
                }
                .unwrap_or_else(|e| panic!("{} {who}: {e}", o["name"]));
                assert_eq!(
                    b64::b64u(&sha3(&[&r.bytes])),
                    o["plaintextSha3"],
                    "{} {who}",
                    o["name"]
                );
                assert_eq!(
                    r.meta.unwrap_or(Value::Null),
                    o["meta"],
                    "{} {who} meta",
                    o["name"]
                );
                match o["sealedBy"].as_str() {
                    Some(id) => {
                        let s = r.sealed_by.expect("signed object carries a seal");
                        assert!(s.ok, "{} seal verifies", o["name"]);
                        assert_eq!(s.id.as_deref(), Some(id));
                    }
                    None => assert!(r.sealed_by.is_none()),
                }
            }
            for who in o["refuses"].as_array().unwrap() {
                let (name, how) = who.as_str().unwrap().split_once(':').unwrap();
                let k = keys_named(&v, name);
                let r = match how {
                    "self" => open(&obj, &Reader::SelfVault(k.vault())),
                    _ => open(&obj, &Reader::XWing(&k)),
                };
                assert_eq!(
                    r.err(),
                    Some(BpqError::NoKey),
                    "{} must refuse {who}",
                    o["name"]
                );
            }
        }
    }

    #[test]
    fn recovery_code_decodes_to_the_root() {
        let v = vectors();
        for row in v["keys"].as_array().unwrap() {
            let prk = master_prk_from_recovery_code(row["recoveryCode"].as_str().unwrap()).unwrap();
            assert_eq!(
                *prk,
                root(row["rootFrom"].as_str().unwrap()),
                "{}",
                row["name"]
            );
        }
        assert!(master_prk_from_recovery_code("bzpq1qqqqqq").is_err());
    }

    #[test]
    fn detached_signature_verifies_for_its_file_only() {
        let v = vectors();
        let file: Vec<u8> = (0..4096u32).map(|i| ((i * 31 + 7) & 255) as u8).collect();
        let d = &v["detached"]["signature"];
        assert_eq!(verify_detached(d, &file).as_deref(), d["id"].as_str());
        assert!(verify_detached(d, &file[..4095]).is_none());
        let mut other = file.clone();
        other[7] ^= 1;
        assert!(verify_detached(d, &other).is_none());
        let mut moved = d.clone();
        moved["at"] = Value::from("2026-10-05T00:00:00Z");
        assert!(verify_detached(&moved, &file).is_none());
    }

    #[test]
    fn tampering_is_refused() {
        let v = vectors();
        let o = &v["objects"][0];
        let k = keys_named(&v, "A");
        let mut obj = unb64(&o["object"]).unwrap();
        let last = obj.len() - 40;
        obj[last] ^= 1;
        assert!(open(&obj, &Reader::SelfVault(k.vault())).is_err());
    }

    #[test]
    fn card_and_binding_verify_and_tampering_fails() {
        let v = vectors();
        assert!(verify_card(&v["card"]));
        assert!(verify_bind(&v["bind"]));
        let mut c = v["card"].clone();
        c["kem"] = v["keys"][1]["kemPublicKey"].clone();
        assert!(!verify_card(&c));
        let mut b = v["bind"].clone();
        b["claims"]["vaulta"] = Value::from("someone.else");
        assert!(!verify_bind(&b));
    }
}
