//! BPQ — the Rust twin of `surfaces/bpq.js`: derives the same PQ keys from a
//! bzDiD master PRK and opens and verifies the same sealed objects, cards and
//! bindings. Spec of record: `docs/specs/SPEC-BPQ-1.md`.
//!
//! Two independent implementations (RustCrypto here, @noble/post-quantum in
//! the browser) must agree on `surfaces/bpq-vectors.json`; the tests below
//! read that file at compile time, so CI fails if either side drifts.
//!
//! Not cross-checked: the SLH-DSA-SHAKE-256f succession key. This twin never
//! derives it; the vectors' `slhPublicKey` and the commitment over it come
//! from the browser library alone and are re-checked only by the JS side, and
//! no SLH-DSA known-answer vectors are carried (surfaces/pq-kat.json lists it
//! under `notIncluded`). Here the commitment is an input to `id_from`.
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

/// `at` has the shape `YYYY-MM-DDTHH:MM:SS[.f{1,9}]Z` (the shape only: field
/// ranges are not checked), the same pattern as bpq.js `AT_RE`. The signed
/// bytes are "id\nat\nlines", so an
/// `at` carrying a newline could move a claim line out of `claims`.
fn is_utc_timestamp(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() < 20 {
        return false;
    }
    let digits = |r: std::ops::Range<usize>| b[r].iter().all(u8::is_ascii_digit);
    let head = digits(0..4)
        && b[4] == b'-'
        && digits(5..7)
        && b[7] == b'-'
        && digits(8..10)
        && b[10] == b'T'
        && digits(11..13)
        && b[13] == b':'
        && digits(14..16)
        && b[16] == b':'
        && digits(17..19);
    let tail = &b[19..];
    head && match tail {
        [b'Z'] => true,
        [b'.', frac @ .., b'Z'] => {
            (1..=9).contains(&frac.len()) && frac.iter().all(u8::is_ascii_digit)
        }
        _ => false,
    }
}

/// A claim kind: `[a-z0-9][a-z0-9._-]{0,31}`, the same pattern as bpq.js
/// `KIND_RE`. No '=' and no newline, so "kind=value" splits one way.
fn is_claim_kind(k: &str) -> bool {
    let b = k.as_bytes();
    !b.is_empty()
        && b.len() <= 32
        && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit())
        && b[1..].iter().all(|c| {
            c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, b'.' | b'_' | b'-')
        })
}

/// A whole number read by value, as JavaScript reads it: `1`, `1.0` and `1e0`
/// are the same number to `JSON.parse`, so the verifiers accept them alike.
/// (The sealed-object CORE is stricter: see `plain_integers`.)
fn whole(v: &Value) -> Option<u64> {
    v.as_u64().or_else(|| {
        v.as_f64()
            .filter(|f| f.fract() == 0.0 && (0.0..=9_007_199_254_740_991.0).contains(f))
            .map(|f| f as u64)
    })
}

/// CORE number tokens must be plain digits: no sign, fraction or exponent,
/// the same scan as bpq.js `plainIntegers`. Scans the text outside strings.
fn plain_integers(text: &[u8]) -> bool {
    let (mut in_str, mut esc, mut prev_digit) = (false, false, false);
    for &c in text {
        if in_str {
            if esc {
                esc = false;
            } else if c == b'\\' {
                esc = true;
            } else if c == b'"' {
                in_str = false;
            }
            continue;
        }
        match c {
            b'"' => in_str = true,
            b'-' | b'.' | b'+' => return false,
            b'e' | b'E' if prev_digit => return false,
            _ => {}
        }
        prev_digit = c.is_ascii_digit();
    }
    true
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
    ReservedContext,
}

impl std::fmt::Display for BpqError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BpqError::Format(w) => write!(f, "not a valid bpq1 object: {w}"),
            BpqError::NoKey => write!(f, "none of the keys you hold opens this object"),
            BpqError::Auth(w) => write!(f, "{w} failed authentication"),
            BpqError::ReservedContext => write!(
                f,
                "context \"root\" is reserved for the phrase-only vault; omit --context to use it"
            ),
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
/// commitment is an input wherever the id is checked.) The reserved context
/// `root` is refused: it belongs to the phrase-only vault, reached only through
/// `root_vault`, and never names a signing or X-Wing key.
pub fn keys(master_prk: &[u8; 32], context: &str) -> Result<PqKeys, BpqError> {
    if context == ROOT_CONTEXT {
        return Err(BpqError::ReservedContext);
    }
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
    Ok(PqKeys {
        dsa_public,
        kem_public,
        kem_seed,
        vault,
    })
}

/// The reserved context of the phrase-only vault key. Wallet persona contexts
/// always start `pq:`, so this never equals one (SPEC-BPQ-1 §2).
pub const ROOT_CONTEXT: &str = "root";

/// The "only me" vault key that opens from the phrase alone: the frozen vault
/// label under the reserved context `root` (founder ruling 2026-10-04). The
/// twin of `BPQ.rootVault` in surfaces/bpq.js.
pub fn root_vault(master_prk: &[u8; 32]) -> Zeroizing<[u8; 32]> {
    let mut vault = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, LABEL_VAULT, ROOT_CONTEXT, vault.as_mut());
    vault
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
/// signed by the ML-DSA-65 key. A card carries no `kind` (SPEC-BPQ-1 §3).
pub fn verify_card(card: &Value) -> bool {
    if whole(&card["bpq"]) != Some(1) || card.get("kind").is_some() {
        return false;
    }
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
    if whole(&b["bpq"]) != Some(1) || b["kind"] != "binding" {
        return false;
    }
    let (Ok(dsa), Ok(succ), Ok(sig)) = (unb64(&b["dsa"]), unb64(&b["succ"]), unb64(&b["sig"]))
    else {
        return false;
    };
    let (Some(id), Some(at), Some(claims)) =
        (b["id"].as_str(), b["at"].as_str(), b["claims"].as_object())
    else {
        return false;
    };
    if !is_utc_timestamp(at) || id_from(&dsa, &succ).as_deref() != Some(id) {
        return false;
    }
    let mut kinds: Vec<&String> = claims.keys().collect();
    kinds.sort();
    let mut lines = String::new();
    for k in kinds {
        let Some(v) = claims[k].as_str() else {
            return false;
        };
        if !is_claim_kind(k) || v.is_empty() || v.contains('\n') || v.contains('\r') {
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
    if d["kind"] != "detached" || whole(&d["bpq"]) != Some(1) {
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
        whole(&d["file"]["size"]),
    ) else {
        return None;
    };
    let fh = sha3(&[file]);
    if !is_utc_timestamp(at)
        || id_from(&dsa, &succ).as_deref() != Some(id)
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
    let end = o.checked_add(n).ok_or(BpqError::Format("truncated"))?;
    let s = b.get(*o..end).ok_or(BpqError::Format("truncated"))?;
    *o = end;
    Ok(s)
}

/// Who sealed the object, from the decrypted SEAL (`None` = it failed
/// authentication). The SEAL answers only that question; the bytes are
/// authenticated segment by segment. Every SEAL that fails (altered bytes, a
/// malformed record, an unknown alg, an id without its succession commitment,
/// a signature or id that does not match) reads as `ok: false` with no id,
/// never `ok: true`, and never fails the open: the same line as bpq.js
/// `sealedBy`.
fn seal_record(plain: Option<&[u8]>, msg: &[u8]) -> SealedBy {
    let no = || SealedBy {
        ok: false,
        id: None,
        public_key: Vec::new(),
    };
    let Some(rec) = plain.and_then(|p| serde_json::from_slice::<Value>(p).ok()) else {
        return no();
    };
    if !rec.is_object() || rec["alg"].as_str() != Some("ml-dsa-65") {
        return no();
    }
    let id = match rec.get("id") {
        None | Some(Value::Null) => None,
        Some(Value::String(id)) => Some(id.clone()),
        Some(_) => return no(),
    };
    let (Ok(pk), Ok(sig)) = (unb64(&rec["pk"]), unb64(&rec["sig"])) else {
        return no();
    };
    let id_ok = match &id {
        None => true,
        Some(id) => match unb64(&rec["succ"]) {
            Ok(succ) => id_from(&pk, &succ).as_deref() == Some(id.as_str()),
            Err(_) => return no(),
        },
    };
    let ok = dsa_verify(&pk, msg, &sig) && id_ok;
    // an id is reported only when ok: `bsigner bpq-open` never prints a
    // claimed sealer that did not verify
    SealedBy {
        ok,
        id: id.filter(|_| ok),
        public_key: pk,
    }
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
    if !core.is_object() {
        return Err(BpqError::Format("CORE json"));
    }
    if !plain_integers(core_b) {
        return Err(BpqError::Format(
            "CORE numbers must be plain non-negative integers",
        ));
    }
    if core["bpq"].as_u64() != Some(1) || core["aead"].as_str() != Some("aes-256-gcm") {
        return Err(BpqError::Format("version or aead"));
    }
    let seg = core["seg"].as_u64().ok_or(BpqError::Format("seg"))?;
    let len = core["len"].as_u64().ok_or(BpqError::Format("len"))?;
    if !(SEG_MIN..=SEG_MAX).contains(&seg) {
        return Err(BpqError::Format("seg range"));
    }
    // SPEC-BPQ-1 §6: an unknown slot `to` is refused, not skipped.
    let slots = slots.as_array().ok_or(BpqError::Format("KEYS array"))?;
    for slot in slots {
        if !matches!(slot["to"].as_str(), Some("self" | "x-wing")) {
            return Err(BpqError::Format("unknown reader slot"));
        }
    }
    let oid = unb64(&core["oid"])?;
    let kc = unb64(&core["kc"])?;
    let aad = sha3(&[core_b]);
    let n = if len == 0 { 1 } else { len.div_ceil(seg) };
    // A crafted len must not wrap: the body length is checked arithmetic and
    // must fit inside the object before anything is allocated for it.
    let body_len = n
        .checked_mul(16)
        .and_then(|t| t.checked_add(len))
        .and_then(|b| usize::try_from(b).ok())
        .filter(|&b| b <= obj.len().saturating_sub(o))
        .ok_or(BpqError::Format("len does not fit the object"))?;
    let body = take(obj, &mut o, body_len)?;
    let s = read_u32(obj, o)?;
    o += 4;
    let seal_b = take(obj, &mut o, s)?;
    if o != obj.len() {
        return Err(BpqError::Format("trailing bytes"));
    }

    let mut file_key: Option<Zeroizing<[u8; 32]>> = None;
    for slot in slots {
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
        let p = gcm_open(&fk, &nonce(FLAG_SEAL, 0), seal_b, &aad);
        let msg = [
            DOM_SEAL,
            &aad,
            &sha3(&[keys_b]),
            &sha3(&[meta_b]),
            &sha3(&[body]),
        ]
        .concat();
        Some(seal_record(p.as_deref(), &msg))
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
    use serde_json::json;

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
        .unwrap()
    }

    #[test]
    fn derivation_matches_the_browser() {
        let v = vectors();
        for row in v["keys"].as_array().unwrap() {
            let k = keys(
                &root(row["rootFrom"].as_str().unwrap()),
                row["context"].as_str().unwrap(),
            )
            .unwrap();
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

    /// Founder ruling 2026-10-04: "only me" opens from the phrase alone. The
    /// browser's `BPQ.rootVault` and this `root_vault` derive the same key, and
    /// objects the browser sealed under it open here for the same readers.
    #[test]
    fn root_vault_matches_the_browser_and_opens_its_objects() {
        let v = vectors();
        let rv = &v["rootVault"];
        assert_eq!(rv["context"], ROOT_CONTEXT);
        assert_eq!(rv["label"], LABEL_VAULT);
        for row in rv["keys"].as_array().unwrap() {
            let prk = root(row["rootFrom"].as_str().unwrap());
            let k = root_vault(&prk);
            assert_eq!(
                b64::b64u(&sha3(&[&k[..]])),
                row["rootVaultKeySha3"],
                "root vault {}",
                row["name"]
            );
            assert_ne!(&k[..], &keys(&prk, "pq:vector").unwrap().vault()[..]);
            // "root" is reserved: no signing or X-Wing key is ever derived under it
            assert_eq!(
                keys(&prk, ROOT_CONTEXT).err(),
                Some(BpqError::ReservedContext)
            );
        }
        let open_as = |obj: &[u8], who: &str| {
            let (name, how) = who.split_once(':').unwrap();
            let k = keys_named(&v, name);
            match how {
                "root" => {
                    let row = v["keys"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .find(|r| r["name"] == name)
                        .unwrap();
                    let r = root_vault(&root(row["rootFrom"].as_str().unwrap()));
                    open(obj, &Reader::SelfVault(&r))
                }
                "self" => open(obj, &Reader::SelfVault(k.vault())),
                _ => open(obj, &Reader::XWing(&k)),
            }
        };
        for o in rv["objects"].as_array().unwrap() {
            let obj = unb64(&o["object"]).unwrap();
            for who in o["opens"].as_array().unwrap() {
                let who = who.as_str().unwrap();
                let r = open_as(&obj, who).unwrap_or_else(|e| panic!("{} {who}: {e}", o["name"]));
                assert_eq!(b64::b64u(&sha3(&[&r.bytes])), o["plaintextSha3"]);
                assert_eq!(r.meta.unwrap_or(Value::Null), o["meta"]);
                match o["sealedBy"].as_str() {
                    Some(id) => {
                        let s = r.sealed_by.expect("signed object carries a seal");
                        assert!(s.ok && s.id.as_deref() == Some(id), "{} seal", o["name"]);
                    }
                    None => assert!(r.sealed_by.is_none()),
                }
            }
            for who in o["refuses"].as_array().unwrap() {
                let who = who.as_str().unwrap();
                assert_eq!(
                    open_as(&obj, who).err(),
                    Some(BpqError::NoKey),
                    "{} must refuse {who}",
                    o["name"]
                );
            }
        }
    }

    #[test]
    fn root_context_is_reserved_for_the_vault() {
        let prk = root("bpq1 test vector root A");
        assert_eq!(keys(&prk, "root").err(), Some(BpqError::ReservedContext));
        // a persona named root is still an ordinary pq: context
        assert!(keys(&prk, "pq:root").is_ok());
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
    fn a_flipped_seal_byte_is_never_ok() {
        let v = vectors();
        let o = &v["objects"][0];
        let k = keys_named(&v, "A");
        let mut obj = unb64(&o["object"]).unwrap();
        let last = obj.len() - 40; // inside SEAL
        obj[last] ^= 1;
        let s = open(&obj, &Reader::SelfVault(k.vault()))
            .expect("SEAL never fails the open")
            .sealed_by
            .expect("the object is still signed");
        assert!(!s.ok && s.id.is_none());
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

    // ── negatives mirrored from e2e/bpq.test.mjs ──────────────────────────

    /// ML-DSA-65 signature by vector key A (seed derived as `keys` does).
    fn sign_as_a(v: &Value, msg: &[u8]) -> String {
        let row = &v["keys"][0];
        let mut seed = [0u8; 32];
        expand_label(
            &root(row["rootFrom"].as_str().unwrap()),
            LABEL_DSA,
            row["context"].as_str().unwrap(),
            &mut seed,
        );
        let sig = crate::pq::dsa_sign(crate::alg::SigAlg::MlDsa65, &seed, msg).unwrap();
        b64::b64u(&sig)
    }

    fn bind_msg(id: &str, at: &str, lines: &str) -> Vec<u8> {
        [
            DOM_BIND,
            &sha3(&[format!("{id}\n{at}\n{lines}").as_bytes()]),
        ]
        .concat()
    }

    /// The exact string a binding signs, rebuilt naively from its fields.
    fn signed_text(b: &Value) -> String {
        let claims = b["claims"].as_object().unwrap();
        let mut ks: Vec<&String> = claims.keys().collect();
        ks.sort();
        let lines: String = ks
            .iter()
            .map(|k| format!("{k}={}\n", claims[*k].as_str().unwrap()))
            .collect();
        format!(
            "{}\n{}\n{lines}",
            b["id"].as_str().unwrap(),
            b["at"].as_str().unwrap()
        )
    }

    #[test]
    fn binding_claim_stripping_version_kind_and_shape_are_refused() {
        let v = vectors();
        let b = &v["bind"];
        assert!(verify_bind(b), "control");
        // Move the first claim line into `at`: the signed bytes do not change.
        let mut stripped = b.clone();
        let ed = b["claims"]["ed25519"].as_str().unwrap();
        stripped["at"] = Value::from(format!("{}\ned25519={ed}", b["at"].as_str().unwrap()));
        stripped["claims"]
            .as_object_mut()
            .unwrap()
            .remove("ed25519");
        assert_eq!(
            signed_text(&stripped),
            signed_text(b),
            "the attack keeps the signed bytes"
        );
        assert!(
            !verify_bind(&stripped),
            "a claim moved into `at` is refused"
        );
        for (field, val) in [
            ("bpq", Value::from(2)),
            ("kind", Value::from("detached")),
            ("kind", Value::Null),
        ] {
            let mut x = b.clone();
            x[field] = val;
            assert!(!verify_bind(&x), "{field}");
        }
        let mut no_kind = b.clone();
        no_kind.as_object_mut().unwrap().remove("kind");
        assert!(!verify_bind(&no_kind));

        let id = b["id"].as_str().unwrap();
        let at = b["at"].as_str().unwrap();
        // fractional seconds, as toISOString writes them, are lawful
        let mut frac = b.clone();
        frac["at"] = Value::from("2026-10-04T12:34:56.789Z");
        frac["claims"] = json!({ "evm": "0x1" });
        frac["sig"] = Value::from(sign_as_a(
            &v,
            &bind_msg(id, "2026-10-04T12:34:56.789Z", "evm=0x1\n"),
        ));
        assert!(verify_bind(&frac), "control: a fresh signature verifies");
        // {a: "b=c"} and {"a=b": "c"} sign the same line; only the first is lawful
        let mut eqv = b.clone();
        eqv["claims"] = json!({ "a": "b=c" });
        eqv["sig"] = Value::from(sign_as_a(&v, &bind_msg(id, at, "a=b=c\n")));
        assert!(verify_bind(&eqv), "control");
        eqv["claims"] = json!({ "a=b": "c" });
        assert!(!verify_bind(&eqv), "'=' in a claim kind is refused");
        // validly signed over "A=b=c\n": only the kind pattern refuses it
        eqv["claims"] = json!({ "A": "b=c" });
        eqv["sig"] = Value::from(sign_as_a(&v, &bind_msg(id, at, "A=b=c\n")));
        assert!(!verify_bind(&eqv), "an uppercase kind is refused");
        // {"0": "x"} and ["x"] sign the same line; only the object is lawful
        let mut arr = b.clone();
        arr["claims"] = json!({ "0": "x" });
        arr["sig"] = Value::from(sign_as_a(&v, &bind_msg(id, at, "0=x\n")));
        assert!(verify_bind(&arr), "control");
        arr["claims"] = json!(["x"]);
        assert!(!verify_bind(&arr), "array claims are refused");
    }

    #[test]
    fn utc_timestamps_are_strict() {
        for ok in [
            "2026-10-04T00:00:00Z",
            "2026-10-04T12:34:56.789Z",
            "2026-10-04T12:34:56.123456789Z",
        ] {
            assert!(is_utc_timestamp(ok), "{ok}");
        }
        for bad in [
            "2026-10-04",
            "2026-10-04T00:00:00",
            "2026-10-04T00:00:00+00:00",
            "2026-10-04T00:00:00Z\n",
            "2026-10-04T00:00:00Z\ned25519=x",
            " 2026-10-04T00:00:00Z",
            "2026-10-04T00:00:00.Z",
            "2026-10-04T00:00:00.1234567890Z",
            "2026-10-04T00:00:00\r\nZ",
        ] {
            assert!(!is_utc_timestamp(bad), "{bad:?}");
        }
    }

    #[test]
    fn card_version_and_kind_are_refused() {
        let v = vectors();
        let c = &v["card"];
        assert!(verify_card(c), "control");
        let mut x = c.clone();
        x["bpq"] = Value::from(2);
        assert!(!verify_card(&x));
        let mut x = c.clone();
        x["kind"] = Value::from("binding");
        assert!(!verify_card(&x));
        let mut x = c.clone();
        x.as_object_mut().unwrap().remove("bpq");
        assert!(!verify_card(&x));
    }

    #[test]
    fn detached_at_version_and_kind_are_refused() {
        let v = vectors();
        let file: Vec<u8> = (0..4096u32).map(|i| ((i * 31 + 7) & 255) as u8).collect();
        let d = &v["detached"]["signature"];
        let id = d["id"].as_str().unwrap();
        let fh = sha3(&[&file]);
        let resign = |at: &str| {
            let meta = sha3(&[format!("{id}\n{at}\n4096").as_bytes()]);
            let mut x = d.clone();
            x["at"] = Value::from(at);
            x["sig"] = Value::from(sign_as_a(&v, &[DOM_DETACHED, &fh, &meta].concat()));
            x
        };
        assert!(
            verify_detached(&resign("2026-10-04T01:02:03.5Z"), &file).is_some(),
            "control"
        );
        assert!(verify_detached(&resign("2026-10-04T00:00:00Z\nx"), &file).is_none());
        assert!(verify_detached(&resign("yesterday"), &file).is_none());
        let mut x = d.clone();
        x["bpq"] = Value::from(2);
        assert!(verify_detached(&x, &file).is_none());
        let mut x = d.clone();
        x["kind"] = Value::from("binding");
        assert!(verify_detached(&x, &file).is_none());
    }

    // ── a shared, signed vector object: every region is covered ───────────

    struct Regions {
        keys: std::ops::Range<usize>,
        meta: std::ops::Range<usize>,
        body: std::ops::Range<usize>,
        seal: std::ops::Range<usize>,
        seg: usize,
    }

    fn regions(obj: &[u8]) -> Regions {
        let mut o = 8;
        let c = read_u32(obj, o).unwrap();
        let core: Value = serde_json::from_slice(&obj[o + 4..o + 4 + c]).unwrap();
        o += 4 + c;
        let k = read_u32(obj, o).unwrap();
        let keys = o + 4..o + 4 + k;
        o = keys.end;
        let m = read_u32(obj, o).unwrap();
        let meta = o + 4..o + 4 + m;
        let (len, seg) = (core["len"].as_u64().unwrap(), core["seg"].as_u64().unwrap());
        let n = if len == 0 { 1 } else { len.div_ceil(seg) };
        let body = meta.end..meta.end + (len + 16 * n) as usize;
        let seal = body.end + 4..obj.len();
        Regions {
            keys,
            meta,
            body,
            seal,
            seg: seg as usize,
        }
    }

    /// Change the base64url character `after` bytes past `needle` in `r`.
    fn change_b64(obj: &mut [u8], r: &std::ops::Range<usize>, needle: &[u8], after: usize) {
        let at = r.start
            + obj[r.clone()]
                .windows(needle.len())
                .position(|w| w == needle)
                .unwrap()
            + needle.len()
            + after;
        obj[at] = if obj[at] == b'A' { b'B' } else { b'A' };
    }

    #[test]
    fn signed_shared_object_tampering_in_every_region_never_passes() {
        let v = vectors();
        let o = &v["objects"][0];
        assert_eq!(o["name"], "self-and-x-wing-signed");
        let a = keys_named(&v, "A");
        let me = Reader::SelfVault(a.vault());
        let obj = unb64(&o["object"]).unwrap();
        let r = regions(&obj);
        let ok = open(&obj, &me).unwrap();
        assert!(ok.sealed_by.unwrap().ok, "control");

        // KEYS is not under the AEAD: the seal signature covers it.
        let mut x = obj.clone();
        change_b64(&mut x, &r.keys, b"\"ct\":\"", 40);
        let got = open(&x, &me).expect("A's own slot is untouched");
        assert!(
            !got.sealed_by.unwrap().ok,
            "a changed KEYS byte breaks the seal"
        );
        let mut x = obj.clone();
        change_b64(&mut x, &r.keys, b"\"w\":\"", 20);
        assert_eq!(
            open(&x, &me).err(),
            Some(BpqError::NoKey),
            "A's slot changed"
        );

        let mut x = obj.clone();
        x[r.meta.start + 5] ^= 1;
        assert_eq!(open(&x, &me).err(), Some(BpqError::Auth("meta")));

        // altered SEAL bytes: the open stands (segments authenticate the
        // bytes), the sealer is never reported ok
        let mut x = obj.clone();
        x[r.seal.start + 5] ^= 1;
        let s = open(&x, &me).unwrap().sealed_by.unwrap();
        assert!(!s.ok && s.id.is_none());

        let mut x = obj.clone();
        x[r.body.start + 1500] ^= 1;
        assert_eq!(open(&x, &me).err(), Some(BpqError::Auth("segment")));

        // swap segments 0 and 1 (both full length)
        let s = r.seg + 16;
        let mut x = obj.clone();
        let (s0, s1) = (r.body.start, r.body.start + s);
        let first = x[s0..s0 + s].to_vec();
        x.copy_within(s1..s1 + s, s0);
        x[s1..s1 + s].copy_from_slice(&first);
        assert_eq!(open(&x, &me).err(), Some(BpqError::Auth("segment")));

        // truncate the final segment by one byte: the head no longer matches
        let mut x = obj.clone();
        x.remove(r.body.end - 1);
        assert!(open(&x, &me).is_err());

        // append a copy of segment 0 after the body: refused by length
        let mut x = obj[..r.body.end].to_vec();
        x.extend_from_slice(&obj[r.body.start..r.body.start + s]);
        x.extend_from_slice(&obj[r.body.end..]);
        assert!(open(&x, &me).is_err());
    }

    // ── crafted objects: built here, independently of bpq.js ─────────────

    const CORE_OK: &str =
        r#"{"bpq":1,"aead":"aes-256-gcm","seg":1024,"len":{len},"oid":"{oid}","kc":"{kc}"}"#;

    fn gcm_seal(key: &[u8; 32], n: &[u8; 12], msg: &[u8], aad: &[u8]) -> Vec<u8> {
        Aes256Gcm::new_from_slice(key)
            .unwrap()
            .encrypt(Nonce::from_slice(n), Payload { msg, aad })
            .unwrap()
    }

    /// One "self" slot under `vault`, a fixed file key, one segment, an
    /// optional SEAL record and optional extra slots.
    fn craft(vault: &[u8; 32], core: &str, extra: &[Value], seal: Option<&Value>) -> Vec<u8> {
        craft_with(vault, core, extra, |_| {
            seal.map(|r| serde_json::to_vec(r).unwrap())
        })
    }

    /// As `craft`, but the SEAL plaintext comes from `seal`, which is handed
    /// the exact message a sealer signs.
    fn craft_with(
        vault: &[u8; 32],
        core: &str,
        extra: &[Value],
        seal: impl Fn(&[u8]) -> Option<Vec<u8>>,
    ) -> Vec<u8> {
        let (fk, oid, plain) = ([7u8; 32], [9u8; 16], b"crafted");
        let core = core
            .replace("{len}", &plain.len().to_string())
            .replace("{oid}", &b64::b64u(&oid))
            .replace("{kc}", &b64::b64u(&sha3(&[DOM_KC, &oid, &fk])));
        let aad = sha3(&[core.as_bytes()]);
        let kw = hkdf32(vault, &oid, DOM_WRAP_SELF);
        let mut slots =
            vec![json!({ "to": "self", "w": b64::b64u(&gcm_seal(&kw, &[0; 12], &fk, &aad)) })];
        slots.extend_from_slice(extra);
        let keys_b = serde_json::to_vec(&slots).unwrap();
        let body = gcm_seal(&fk, &nonce(FLAG_FINAL, 0), plain, &aad);
        let msg = [
            DOM_SEAL,
            &aad,
            &sha3(&[keys_b.as_slice()]),
            &sha3(&[&[][..]]),
            &sha3(&[body.as_slice()]),
        ]
        .concat();
        let seal_b = seal(&msg).map_or(Vec::new(), |r| {
            gcm_seal(&fk, &nonce(FLAG_SEAL, 0), &r, &aad)
        });
        let mut o = MAGIC.to_vec();
        for part in [core.as_bytes(), keys_b.as_slice(), &[][..]] {
            o.extend_from_slice(&(part.len() as u32).to_be_bytes());
            o.extend_from_slice(part);
        }
        o.extend_from_slice(&body);
        o.extend_from_slice(&(seal_b.len() as u32).to_be_bytes());
        o.extend_from_slice(&seal_b);
        o
    }

    #[test]
    fn crafted_objects_unknown_slots_numbers_and_seal_records() {
        let v = vectors();
        let a = keys_named(&v, "A");
        let me = Reader::SelfVault(a.vault());
        let control = open(&craft(a.vault(), CORE_OK, &[], None), &me).unwrap();
        assert_eq!(control.bytes, b"crafted", "control");
        assert!(control.sealed_by.is_none());

        // SPEC-BPQ-1 §6: an unknown slot `to` is refused, even after one that opens
        for extra in [
            json!({ "to": "hqc", "w": "AA" }),
            json!({ "w": "AA" }),
            json!("self"),
        ] {
            assert_eq!(
                open(
                    &craft(a.vault(), CORE_OK, std::slice::from_ref(&extra), None),
                    &me
                )
                .err(),
                Some(BpqError::Format("unknown reader slot")),
                "{extra}"
            );
        }
        // CORE numbers are plain digits in both implementations; the scan
        // itself refuses these (as_u64 would refuse the first two later)
        for bad in [
            r#""seg":1024.0"#,
            r#""seg":1.024e3"#,
            r#""seg":1024,"x":-1"#,
        ] {
            let core = CORE_OK.replace(r#""seg":1024"#, bad);
            assert_eq!(
                open(&craft(a.vault(), &core, &[], None), &me).err(),
                Some(BpqError::Format(
                    "CORE numbers must be plain non-negative integers"
                )),
                "{bad}"
            );
        }
        // a crafted len neither wraps nor allocates: refused before the body is read
        for len in [
            "18446744073709551615",
            "9223372036854775808",
            "9007199254740993",
            "9007199254740991",
        ] {
            let core = CORE_OK.replace("{len}", len);
            assert_eq!(
                open(&craft(a.vault(), &core, &[], None), &me).err(),
                Some(BpqError::Format("len does not fit the object")),
                "{len}"
            );
        }

        // Seal records. Every SEAL that fails reads as ok: false with no id
        // and never fails the open (the same line as bpq.js sealedBy). An id
        // is reported only when ok.
        let pk = b64::b64u(&a.dsa_public);
        let id = v["keys"][0]["id"].clone();
        let succ = v["keys"][0]["successionCommit"].clone();
        let signed = |claimed_id: &Value, bom: bool| {
            let bytes = craft_with(a.vault(), CORE_OK, &[], |msg| {
                let rec = json!({ "alg": "ml-dsa-65", "pk": pk, "sig": sign_as_a(&v, msg),
                                  "id": claimed_id, "succ": succ });
                let mut b = if bom {
                    vec![0xef, 0xbb, 0xbf]
                } else {
                    Vec::new()
                };
                b.extend_from_slice(&serde_json::to_vec(&rec).unwrap());
                Some(b)
            });
            open(&bytes, &me)
                .expect("SEAL never fails the open")
                .sealed_by
                .expect("signed")
        };
        let s = signed(&id, false);
        assert!(s.ok, "control: a valid seal verifies");
        assert_eq!(s.id.as_deref(), id.as_str(), "control: the id is read");
        // a BOM before the record: serde_json refuses it, and so does bpq.js
        let s = signed(&id, true);
        assert!(!s.ok && s.id.is_none(), "BOM-prefixed record");
        // a valid signature by A claiming B's id: never reported as B
        let s = signed(&v["keys"][1]["id"], false);
        assert!(!s.ok && s.id.is_none(), "an id that does not match its key");

        let sealer = |rec: &Value| {
            open(&craft(a.vault(), CORE_OK, &[], Some(rec)), &me)
                .expect("SEAL never fails the open")
                .sealed_by
                .expect("signed")
        };
        for rec in [
            json!({ "alg": "ml-dsa-65", "pk": pk, "sig": "AAAA", "id": id, "succ": succ }),
            json!({ "alg": "ml-dsa-65", "pk": pk, "sig": "AAAA", "id": id }),
            json!({ "alg": "ml-dsa-65", "pk": pk, "sig": "AAAA", "id": 5, "succ": succ }),
            json!({ "alg": "ml-dsa-65", "sig": "AAAA" }),
            json!([1, 2]),
            json!({ "alg": "slh-dsa-shake-256f", "pk": "AA" }),
        ] {
            let s = sealer(&rec);
            assert!(!s.ok && s.id.is_none(), "{rec}");
        }
    }
}
