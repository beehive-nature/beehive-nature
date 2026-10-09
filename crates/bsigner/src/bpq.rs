//! BPQ — the Rust twin of `surfaces/bpq.js`: derives the same PQ keys from a
//! bzDiD master PRK and opens and verifies the same sealed objects, cards and
//! bindings. Spec of record: `docs/specs/SPEC-BPQ-1.md`.
//!
//! Two independent implementations (RustCrypto here, @noble/post-quantum in
//! the browser) must agree on `surfaces/bpq-vectors.json`; the tests below
//! read that file at compile time, so CI fails if either side drifts.
//!
//! The SLH-DSA-SHAKE-256f succession key is derived here too
//! ([`succession_keys`], fips205 0.4.1) and must reproduce the browser's
//! commitment and id on every vector row; its ACVP cases run in
//! crates/btungsten-pq (SPEC-BTUNGSTEN-PQ-1 §PQ01, §PQ07).
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
//! It seals in one case only: "only me" (one `self` slot, no META, no SEAL),
//! which is how bsigner keeps its own keys at rest ([`seal_self`],
//! SPEC-BTUNGSTEN-PQ-1 §PQ09). Objects shared with readers are sealed where
//! the plaintext is, in the browser; this twin keeps every sealed object
//! openable and verifiable without any browser at all.

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
use bpq_core::layout::{self, nonce, FLAG_FINAL, FLAG_META, FLAG_MORE, FLAG_SEAL};

/// A bpq1/ domain label, from bpq-core's proven table.
fn dom(d: u8) -> &'static [u8] {
    layout::domain(d)
}

// FROZEN v1 BYTE CONSTANTS — identical to surfaces/bpq.js. The derivation
// labels (`bpq_core::LABEL_STR`) and the bpq1/ domain labels, nonces, segment
// lengths and binding validators (`bpq_core::layout`) live in bpq-core, where
// SAW proves them (SPEC-BTUNGSTEN-PQ-1 PQ03, PQ04).
const MAGIC: [u8; 8] = [0x89, 0x42, 0x50, 0x51, 0x31, 0x0d, 0x0a, 0x1a];
const ID_HRP: &str = "bzpq";
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

/// `HKDF-Expand(SHA-256, masterPrk, label ‖ context, out.len())`. The info
/// string comes from bpq-core, so a context outside its rule (1 to 64
/// printable ASCII bytes) is refused before any key exists.
fn expand_label(
    master_prk: &[u8; 32],
    label: u8,
    context: &str,
    out: &mut [u8],
) -> Result<(), BpqError> {
    let info = bpq_core::info_for(label, context, 0).ok_or(BpqError::Context)?;
    let hk =
        Hkdf::<Sha256>::from_prk(master_prk).expect("a 32-byte PRK is a valid HKDF-SHA256 PRK");
    hk.expand(info.as_bytes(), out)
        .expect("output lengths used here are far below the HKDF limit");
    Ok(())
}

fn hkdf32(ikm: &[u8], salt: &[u8], info: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut out = Zeroizing::new([0u8; 32]);
    Hkdf::<Sha256>::new(Some(salt), ikm)
        .expand(info, out.as_mut())
        .expect("32 bytes is within the HKDF limit");
    out
}

fn gcm_seal(key: &[u8; 32], nonce_bytes: &[u8; 12], plain: &[u8], aad: &[u8]) -> Vec<u8> {
    Aes256Gcm::new_from_slice(key)
        .expect("a 32-byte key")
        .encrypt(Nonce::from_slice(nonce_bytes), Payload { msg: plain, aad })
        .expect("AES-256-GCM seals every length used here")
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
/// `at` carrying a newline could move a claim line out of `claims`. The check
/// is bpq-core's `utc_timestamp`, SAW-proven equal to that pattern (PQ04).
fn is_utc_timestamp(s: &str) -> bool {
    layout::Text::new(s.as_bytes()).is_some_and(|t| layout::utc_timestamp(&t))
}

/// A claim kind: `[a-z0-9][a-z0-9._-]{0,31}`, the same pattern as bpq.js
/// `KIND_RE`. No '=' and no newline, so "kind=value" splits one way.
fn is_claim_kind(k: &str) -> bool {
    layout::Text::new(k.as_bytes()).is_some_and(|t| layout::claim_kind(&t))
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
    Context,
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
            BpqError::Context => write!(
                f,
                "a context is 1 to 64 printable ASCII characters (SPEC-BPQ-1 §2)"
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
        let ss_m: [u8; 32] = ss_m
            .as_slice()
            .try_into()
            .expect("ML-KEM-768 shared secrets are 32 bytes");
        // the combiner input from bpq-core (SAW: equal to the draft, combinerBinds)
        let input = Zeroizing::new(bpq_core::xwing::combiner_input(
            &ss_m,
            ss_x.as_bytes(),
            &ct_x,
            x_pk.as_bytes(),
        ));
        Some(Zeroizing::new(sha3(&[&input[..]])))
    }
}

fn xwing_expand(seed: &[u8; 32]) -> (ml_kem::DecapsulationKey<MlKem768>, StaticSecret, XPublic) {
    let mut x = Shake256::default();
    x.update(seed);
    let mut wide = Zeroizing::new([0u8; 96]);
    x.finalize_xof().read(wide.as_mut());
    // the draft's split (bpq-core, SAW-proven): d ‖ z, then the X25519 secret
    let (mut d_z, mut xs) = bpq_core::xwing::split_seed(&wide);
    let dk = ml_kem::DecapsulationKey::<MlKem768>::from_seed(d_z.into());
    d_z.zeroize();
    let x_sk = StaticSecret::from(xs);
    xs.zeroize();
    let x_pk = XPublic::from(&x_sk);
    (dk, x_sk, x_pk)
}

/// Derive the ML-DSA-65 and X-Wing public keys and the vault key for one
/// context. (The SLH-DSA succession key is [`succession_keys`], derived only
/// when a card or a handover needs it.) The reserved context `root` is
/// refused: it belongs to the phrase-only vault, reached only through
/// `root_vault`, and never names a signing or X-Wing key.
pub fn keys(master_prk: &[u8; 32], context: &str) -> Result<PqKeys, BpqError> {
    if context == ROOT_CONTEXT {
        return Err(BpqError::ReservedContext);
    }
    let mut dsa_seed = Zeroizing::new([0u8; 32]);
    expand_label(
        master_prk,
        bpq_core::ML_DSA_65_RECORD,
        context,
        dsa_seed.as_mut(),
    )?;
    let mut kem_seed = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, bpq_core::X_WING_KEM, context, kem_seed.as_mut())?;
    let mut vault = Zeroizing::new([0u8; 32]);
    expand_label(master_prk, bpq_core::VAULT, context, vault.as_mut())?;
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
    expand_label(master_prk, bpq_core::VAULT, ROOT_CONTEXT, vault.as_mut())
        .expect("\"root\" is an admitted context");
    vault
}

pub type SuccessionPublic = fips205::slh_dsa_shake_256f::PublicKey;
pub type SuccessionSecret = fips205::slh_dsa_shake_256f::PrivateKey;

/// The SLH-DSA-SHAKE-256f succession key of one context (SPEC-BPQ-1 §2,
/// §5): `expand` of the frozen succession label (`bpq_core::SLH_DSA_SUCCESSION`,
/// VOCABULARY carve-out 1) to 96 bytes, split as (SK.seed, SK.prf, PK.seed), FIPS
/// 205 `slh_keygen_internal`, through fips205 0.4.1 `keygen_with_seeds`.
/// Derived on demand and never stored; the reserved context `root` is
/// refused, as in [`keys`].
pub fn succession_keys(
    master_prk: &[u8; 32],
    context: &str,
) -> Result<(SuccessionPublic, SuccessionSecret), BpqError> {
    use fips205::traits::KeyGen;
    if context == ROOT_CONTEXT {
        return Err(BpqError::ReservedContext);
    }
    let mut seed = Zeroizing::new([0u8; 96]);
    expand_label(
        master_prk,
        bpq_core::SLH_DSA_SUCCESSION,
        context,
        seed.as_mut(),
    )?;
    let part = |i: usize| -> [u8; 32] { seed[32 * i..32 * (i + 1)].try_into().expect("32 of 96") };
    let (sk_seed, sk_prf, pk_seed) = (Zeroizing::new(part(0)), Zeroizing::new(part(1)), part(2));
    Ok(fips205::slh_dsa_shake_256f::KG::keygen_with_seeds(
        &sk_seed, &sk_prf, &pk_seed,
    ))
}

/// `successionCommit = SHA3-256("bpq1/succession" || SLH-DSA public key)`.
pub fn succession_commit(slh_public: &[u8]) -> [u8; 32] {
    sha3(&[dom(layout::SUCCESSION), slh_public])
}

/// The self-certifying id: bech32m("bzpq", SHA3-256("bpq1/id" || ML-DSA-65
/// public key || succession commitment)).
pub fn id_from(dsa_public: &[u8], succession_commit: &[u8]) -> Option<String> {
    if dsa_public.len() != DSA_PK_LEN || succession_commit.len() != 32 {
        return None;
    }
    let d = sha3(&[dom(layout::ID), dsa_public, succession_commit]);
    bech32::encode(ID_HRP, d.to_base32(), Variant::Bech32m).ok()
}

/// The ML-DSA-65 signing key of one context (deterministic signing, empty
/// context string, as every bsigner statement signs).
fn dsa_signing_key(master_prk: &[u8; 32], context: &str) -> Result<SigningKey<MlDsa65>, BpqError> {
    let mut dsa_seed = Zeroizing::new([0u8; 32]);
    expand_label(
        master_prk,
        bpq_core::ML_DSA_65_RECORD,
        context,
        dsa_seed.as_mut(),
    )?;
    Ok(SigningKey::<MlDsa65>::from_seed(&(*dsa_seed).into()))
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
    dsa_verify(&dsa, &[dom(layout::CARD), &dsa, &kem, &succ].concat(), &sig)
}

/// The public card of one context (SPEC-BPQ-1 §3): `{bpq:1, id, dsa, kem,
/// succ, sig}`, `sig` = ML-DSA-65 over "bpq1/card" || dsa || kem || succ.
/// The twin of `BPQ.card` in surfaces/bpq.js.
pub fn card(master_prk: &[u8; 32], context: &str) -> Result<Value, BpqError> {
    use fips205::traits::SerDes;
    use ml_dsa::signature::Signer;
    let k = keys(master_prk, context)?;
    let (slh, _) = succession_keys(master_prk, context)?;
    let succ = succession_commit(&slh.into_bytes());
    let sk = dsa_signing_key(master_prk, context)?;
    let sig: Signature<MlDsa65> =
        sk.sign(&[dom(layout::CARD), &k.dsa_public, &k.kem_public, &succ].concat());
    Ok(serde_json::json!({
        "bpq": 1,
        "id": id_from(&k.dsa_public, &succ).expect("lengths are fixed"),
        "dsa": b64::b64u(&k.dsa_public),
        "kem": b64::b64u(&k.kem_public),
        "succ": b64::b64u(&succ),
        "sig": b64::b64u(&sig.encode()),
    }))
}

const SLH_PK_LEN: usize = 64;

fn handover_message(from: &str, to: &str, at: &str) -> Vec<u8> {
    [
        dom(layout::HANDOVER),
        &sha3(&[format!("{from}\n{to}\n{at}").as_bytes()]),
    ]
    .concat()
}

/// The succession handover v1 (SPEC-BPQ-1 §5): the owner of `from_context`
/// reveals its SLH-DSA-SHAKE-256f public key and signs with it, hedged, pure,
/// empty context, the statement retiring the `from` id for the `to` id of
/// `to_context`'s card (which carries its own next succession commitment).
pub fn handover(
    master_prk: &[u8; 32],
    from_context: &str,
    to_context: &str,
    at: &str,
) -> Result<Value, BpqError> {
    use fips205::traits::{SerDes, Signer};
    if !is_utc_timestamp(at) {
        return Err(BpqError::Format("at is not YYYY-MM-DDTHH:MM:SS[.f]Z"));
    }
    let old = keys(master_prk, from_context)?;
    let (slh_pk, slh_sk) = succession_keys(master_prk, from_context)?;
    let slh = slh_pk.into_bytes();
    let from = id_from(&old.dsa_public, &succession_commit(&slh)).expect("lengths are fixed");
    let new_card = card(master_prk, to_context)?;
    let to = new_card["id"]
        .as_str()
        .expect("a card has an id")
        .to_string();
    let sig = slh_sk
        .try_sign(&handover_message(&from, &to, at), &[], true)
        .map_err(|_| BpqError::Format("SLH-DSA signing failed"))?;
    Ok(serde_json::json!({
        "bpq": 1,
        "kind": "handover",
        "from": from,
        "to": to,
        "at": at,
        "dsa": b64::b64u(&old.dsa_public),
        "slh": b64::b64u(&slh),
        "card": new_card,
        "sig": b64::b64u(&sig),
    }))
}

/// Verify a handover: `from` recomputes from `dsa` and the revealed `slh`
/// key's commitment, the new card verifies and is `to`, `at` has the shape,
/// and the SLH-DSA signature holds over "bpq1/handover" || SHA3-256(from \n
/// to \n at). Returns the new id. A holder of only the old ML-DSA key cannot
/// make one: the succession key was never published before this reveal.
pub fn verify_handover(h: &Value) -> Option<String> {
    use fips205::traits::{SerDes, Verifier};
    if whole(&h["bpq"]) != Some(1) || h["kind"] != "handover" {
        return None;
    }
    let (from, to, at) = (h["from"].as_str()?, h["to"].as_str()?, h["at"].as_str()?);
    let (dsa, slh, sig) = (
        unb64(&h["dsa"]).ok()?,
        unb64(&h["slh"]).ok()?,
        unb64(&h["sig"]).ok()?,
    );
    if !is_utc_timestamp(at) || slh.len() != SLH_PK_LEN {
        return None;
    }
    if id_from(&dsa, &succession_commit(&slh)).as_deref() != Some(from) {
        return None;
    }
    if !verify_card(&h["card"]) || h["card"]["id"].as_str() != Some(to) || to == from {
        return None;
    }
    let pk = SuccessionPublic::try_from_bytes(&slh.try_into().ok()?).ok()?;
    let sig: [u8; fips205::slh_dsa_shake_256f::SIG_LEN] = sig.try_into().ok()?;
    pk.verify(&handover_message(from, to, at), &sig, &[])
        .then(|| to.to_string())
}

/// A Nostr event id: 64 lowercase hex characters (NIP-01).
fn nostr_event_id(hex: &str) -> Option<[u8; 32]> {
    let ok = hex.len() == 64
        && hex
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    if !ok {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).ok()?;
    }
    Some(out)
}

fn nostr_message(event: &[u8; 32]) -> Vec<u8> {
    [dom(layout::NOSTR_EVENT), &event[..]].concat()
}

/// The Nostr event attestation v1 (SPEC-BPQ-1 §5b): the bzpq1 key of
/// `context` vouches for one Nostr event id with ML-DSA-65 over
/// "bpq1/nostr-event" || the 32 id bytes. Buzz and every relay keep checking
/// the event's secp256k1 Schnorr signature; this statement stands beside it.
/// The twin of `BPQ.attestNostr` in surfaces/bpq.js.
pub fn attest_nostr(master_prk: &[u8; 32], context: &str, event: &str) -> Result<Value, BpqError> {
    use fips205::traits::SerDes;
    use ml_dsa::signature::Signer;
    let ev = nostr_event_id(event).ok_or(BpqError::Format(
        "a Nostr event id is 64 lowercase hex characters",
    ))?;
    let k = keys(master_prk, context)?;
    let (slh, _) = succession_keys(master_prk, context)?;
    let succ = succession_commit(&slh.into_bytes());
    let sig: Signature<MlDsa65> = dsa_signing_key(master_prk, context)?.sign(&nostr_message(&ev));
    Ok(serde_json::json!({
        "bpq": 1,
        "kind": "nostr-event",
        "id": id_from(&k.dsa_public, &succ).expect("lengths are fixed"),
        "event": event,
        "dsa": b64::b64u(&k.dsa_public),
        "succ": b64::b64u(&succ),
        "sig": b64::b64u(&sig.encode()),
    }))
}

/// Verify a Nostr event attestation: the id recomputes from `dsa` and
/// `succ`, `event` is a Nostr event id, and the signature holds over it.
/// Returns (id, event).
pub fn verify_nostr(a: &Value) -> Option<(String, String)> {
    if whole(&a["bpq"]) != Some(1) || a["kind"] != "nostr-event" {
        return None;
    }
    let (id, event) = (a["id"].as_str()?, a["event"].as_str()?);
    let ev = nostr_event_id(event)?;
    let (dsa, succ, sig) = (
        unb64(&a["dsa"]).ok()?,
        unb64(&a["succ"]).ok()?,
        unb64(&a["sig"]).ok()?,
    );
    if id_from(&dsa, &succ).as_deref() != Some(id) {
        return None;
    }
    dsa_verify(&dsa, &nostr_message(&ev), &sig).then(|| (id.to_string(), event.to_string()))
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
    dsa_verify(&dsa, &[dom(layout::BIND), &digest].concat(), &sig)
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
    dsa_verify(&dsa, &[dom(layout::DETACHED), &fh, &meta].concat(), &sig).then(|| id.to_string())
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

/// The `bdidrec1…` recovery code of a master PRK: the inverse of
/// [`master_prk_from_recovery_code`] (bech32m, payload version 0x01 || PRK).
pub fn recovery_code(master_prk: &[u8; 32]) -> String {
    let mut payload = Zeroizing::new(Vec::with_capacity(33));
    payload.push(1);
    payload.extend_from_slice(master_prk);
    bech32::encode("bdidrec", payload.to_base32(), Variant::Bech32m)
        .expect("bdidrec is a valid hrp")
}

/// The CORE `rosetta` text, identical to surfaces/bpq.js `ROSETTA`.
const ROSETTA: &str = "bpq1 sealed object: CORE json, KEYS json (file key wrapped per reader: self = AES-256-GCM under HKDF-SHA256(vault key), x-wing = ML-KEM-768+X25519), META, BODY = AES-256-GCM segments (nonce = u32 flag || u64 index, AAD = SHA3-256(CORE)), SEAL = ML-DSA-65 record, itself AES-256-GCM under the file key. Spec: SPEC-BPQ-1.";
const SEG_DEFAULT: usize = 65536;

/// Seal `plain` for "only me" (SPEC-BPQ-1 §4): a fresh file key and oid
/// from OS entropy, one `self` slot wrapping the file key under
/// HKDF-SHA256(IKM = `vault`, salt = oid, info = "bpq1/wrap/self"), no META,
/// no SEAL. [`open`] with `Reader::SelfVault(vault)` reads it back, and so
/// does surfaces/bpq.js.
pub fn seal_self(plain: &[u8], vault: &[u8; 32]) -> Vec<u8> {
    let mut file_key = Zeroizing::new([0u8; 32]);
    let mut oid = [0u8; 16];
    getrandom::getrandom(file_key.as_mut()).expect("OS entropy");
    getrandom::getrandom(&mut oid).expect("OS entropy");
    let kc = sha3(&[dom(layout::KEY_COMMIT), &oid, file_key.as_ref()]);
    let core = format!(
        r#"{{"bpq":1,"aead":"aes-256-gcm","seg":{SEG_DEFAULT},"len":{},"oid":"{}","kc":"{}","rosetta":"{ROSETTA}"}}"#,
        plain.len(),
        b64::b64u(&oid),
        b64::b64u(&kc)
    );
    let aad = sha3(&[core.as_bytes()]);
    let kw = hkdf32(vault, &oid, dom(layout::WRAP_SELF));
    let w = gcm_seal(&kw, &[0u8; 12], file_key.as_ref(), &aad);
    let keys = format!(r#"[{{"to":"self","w":"{}"}}]"#, b64::b64u(&w));
    // the same segment arithmetic open() reads with (bpq-core, PQ04)
    let (len, seg) = (plain.len() as u64, SEG_DEFAULT as u64);
    let n = layout::segment_count(len, seg);
    let mut out =
        Vec::with_capacity(8 + 12 + core.len() + keys.len() + plain.len() + 16 * n as usize);
    out.extend_from_slice(&MAGIC);
    out.extend_from_slice(&(core.len() as u32).to_be_bytes());
    out.extend_from_slice(core.as_bytes());
    out.extend_from_slice(&(keys.len() as u32).to_be_bytes());
    out.extend_from_slice(keys.as_bytes());
    out.extend_from_slice(&0u32.to_be_bytes()); // META: none
    let mut off = 0usize;
    for i in 0..n {
        let plain_len = layout::segment_plain_len(i, n, len, seg) as usize;
        let chunk = &plain[off..off + plain_len];
        off += plain_len;
        let flag = if i == n - 1 { FLAG_FINAL } else { FLAG_MORE };
        out.extend_from_slice(&gcm_seal(&file_key, &nonce(flag, i), chunk, &aad));
    }
    out.extend_from_slice(&0u32.to_be_bytes()); // SEAL: none
    out
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
    if !layout::seg_ok(seg) {
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
    let n = layout::segment_count(len, seg);
    // A crafted len must not wrap: the body length is checked arithmetic and
    // must fit inside the object before anything is allocated for it
    // (bpq-core body_len; SAW proves bodyExact over it, PQ04).
    let body_len = layout::body_len(len, seg, obj.len().saturating_sub(o) as u64)
        .and_then(|b| usize::try_from(b).ok())
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
            (Some("self"), Reader::SelfVault(v)) => hkdf32(&v[..], &oid, dom(layout::WRAP_SELF)),
            (Some("x-wing"), Reader::XWing(keys)) => {
                match keys.xwing_decapsulate(&unb64(&slot["ct"])?) {
                    Some(ss) => hkdf32(&ss[..], &oid, dom(layout::WRAP_XWING)),
                    None => continue,
                }
            }
            _ => continue,
        };
        let Some(got) = gcm_open(&kw, &[0u8; 12], &unb64(&slot["w"])?, &aad) else {
            continue;
        };
        if got.len() == 32
            && sha3(&[dom(layout::KEY_COMMIT), &oid, &got]).as_slice() == kc.as_slice()
        {
            let mut fk = Zeroizing::new([0u8; 32]);
            fk.copy_from_slice(&got);
            file_key = Some(fk);
            break;
        }
    }
    let fk = file_key.ok_or(BpqError::NoKey)?;

    // Every part is taken with a checked range, so no length can make the
    // parser panic; segmentsTile (PQ04, over the integers that u64 / and %
    // compute) is why an accepted object's parts tile its BODY exactly, so
    // neither refusal below fires for one.
    let mut bytes = Vec::with_capacity(len as usize);
    let mut off = 0usize;
    for i in 0..n {
        let plain_len = layout::segment_plain_len(i, n, len, seg) as usize;
        let part = take(body, &mut off, plain_len + 16)?;
        let flag = if i == n - 1 { FLAG_FINAL } else { FLAG_MORE };
        let p = gcm_open(&fk, &nonce(flag, i), part, &aad).ok_or(BpqError::Auth("segment"))?;
        bytes.extend_from_slice(&p);
    }
    if off != body.len() {
        return Err(BpqError::Format("segments do not tile the body"));
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
            dom(layout::SEAL),
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

    // Every bzDiD derivation label, through bpq-core's info string and HKDF
    // here, gives the bytes the browser's own functions give
    // (surfaces/bzdid-derive-vectors.json, SPEC-BTUNGSTEN-PQ-1 PQ03).
    #[test]
    fn every_derivation_label_matches_the_browser() {
        let v: Value =
            serde_json::from_str(include_str!("../../../surfaces/bzdid-derive-vectors.json"))
                .expect("bzdid-derive-vectors.json parses");
        let prk = root(v["rootFrom"].as_str().unwrap());
        let rows = v["rows"].as_array().unwrap();
        let mut seen = [false; bpq_core::LABEL_COUNT as usize];
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let id = bpq_core::LABEL_STR
                .iter()
                .position(|l| *l == label)
                .unwrap_or_else(|| panic!("{label} is not a bpq-core label"));
            seen[id] = true;
            let mut okm = vec![0u8; row["length"].as_u64().unwrap() as usize];
            expand_label(&prk, id as u8, row["context"].as_str().unwrap(), &mut okm).unwrap();
            assert_eq!(
                b64::b64u(&okm),
                row["okm"].as_str().unwrap(),
                "{label} {}",
                row["context"]
            );
        }
        assert!(seen.iter().all(|&s| s), "a label has no vector row");
        // the browser's 24 words for this root read back to it here (PQ11)
        assert_eq!(
            *crate::bip39::master_prk_from_phrase(v["phrase"].as_str().unwrap()).unwrap(),
            prk
        );
    }

    #[test]
    fn contexts_outside_the_rule_derive_nothing() {
        let prk = root("x");
        for bad in ["", "pq:\u{1}", "pq:\u{7f}", "pq:p\u{e9}", &"x".repeat(65)] {
            assert!(matches!(keys(&prk, bad), Err(BpqError::Context)), "{bad:?}");
            assert!(
                matches!(succession_keys(&prk, bad), Err(BpqError::Context)),
                "{bad:?}"
            );
        }
        assert!(keys(&prk, &"x".repeat(64)).is_ok());
    }

    // The Nostr event attestation (SPEC-BPQ-1 §5b, PQ13): made here it
    // verifies; made by bpq.js it verifies here; every forgery is refused.
    #[test]
    fn nostr_attestations_verify_and_their_forgeries_do_not() {
        let v = vectors();
        let rows = v["keys"].as_array().unwrap();
        let row = rows.iter().find(|r| r["name"] == "A").unwrap();
        let prk = root(row["rootFrom"].as_str().unwrap());
        let ctx = row["context"].as_str().unwrap();
        let event = "ab".repeat(32);
        let a = attest_nostr(&prk, ctx, &event).unwrap();
        let round: Value = serde_json::from_str(&a.to_string()).unwrap();
        assert_eq!(
            verify_nostr(&round),
            Some((row["id"].as_str().unwrap().to_string(), event.clone()))
        );
        let refused = |edit: &dyn Fn(&mut Value)| {
            let mut x = round.clone();
            edit(&mut x);
            verify_nostr(&x).is_none()
        };
        assert!(
            refused(&|x| x["event"] = Value::from("ac".repeat(32))),
            "another event"
        );
        assert!(
            refused(&|x| x["event"] = Value::from("AB".repeat(32))),
            "uppercase hex"
        );
        assert!(
            refused(&|x| x["event"] = Value::from("ab".repeat(31))),
            "short id"
        );
        assert!(
            refused(&|x| x["kind"] = Value::from("binding")),
            "another kind"
        );
        assert!(refused(&|x| x["bpq"] = Value::from(2)), "another version");
        let b_id = rows.iter().find(|r| r["name"] == "B").unwrap()["id"].clone();
        assert!(refused(&|x| x["id"] = b_id.clone()), "another id");
        assert!(refused(&|x| x["sig"] = Value::from("")), "empty signature");
        // another key signing for the same event cannot claim this id
        let other = attest_nostr(&prk, "pq:other", &event).unwrap();
        assert!(
            refused(&|x| x["sig"] = other["sig"].clone()),
            "another key's signature"
        );
        assert!(attest_nostr(&prk, ctx, "zz").is_err(), "not an event id");
        assert!(matches!(
            attest_nostr(&prk, ROOT_CONTEXT, &event),
            Err(BpqError::ReservedContext)
        ));
        // made by the browser
        let js: Value =
            serde_json::from_str(include_str!("../../../surfaces/bpq-nostr-vector.json")).unwrap();
        let (id, ev) = verify_nostr(&js["attestation"]).expect("the bpq.js attestation verifies");
        assert_eq!(id, row["id"].as_str().unwrap());
        assert_eq!(
            unhex(&ev),
            Sha256::digest(js["eventFrom"].as_str().unwrap().as_bytes()).to_vec()
        );
    }

    // HKDF-SHA256 as expand_label and hkdf32 call it, on RFC 5869's three
    // SHA-256 cases (A.1-A.3): extract gives the RFC's PRK, and expand from
    // that PRK (the expand_label path) gives its OKM.
    fn unhex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn hkdf_sha256_passes_rfc5869_a1_to_a3() {
        let run = |from: u8, to: u8| (from..=to).collect::<Vec<u8>>();
        let cases: [(Vec<u8>, Vec<u8>, Vec<u8>, &str, &str); 3] = [
            (
                vec![0x0b; 22],
                run(0x00, 0x0c),
                run(0xf0, 0xf9),
                "077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5", // PUBLIC-CONSTANT: RFC 5869 A.1 PRK
                "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865", // PUBLIC-CONSTANT: RFC 5869 A.1 OKM
            ),
            (
                run(0x00, 0x4f),
                run(0x60, 0xaf),
                run(0xb0, 0xff),
                "06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244", // PUBLIC-CONSTANT: RFC 5869 A.2 PRK
                "b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87", // PUBLIC-CONSTANT: RFC 5869 A.2 OKM
            ),
            (
                vec![0x0b; 22],
                vec![],
                vec![],
                "19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04", // PUBLIC-CONSTANT: RFC 5869 A.3 PRK
                "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8", // PUBLIC-CONSTANT: RFC 5869 A.3 OKM
            ),
        ];
        for (n, (ikm, salt, info, prk, okm)) in cases.iter().enumerate() {
            let (got_prk, _) = Hkdf::<Sha256>::extract(Some(salt), ikm);
            assert_eq!(got_prk.to_vec(), unhex(prk), "A.{} PRK", n + 1);
            let want = unhex(okm);
            let mut got = vec![0u8; want.len()];
            Hkdf::<Sha256>::from_prk(&got_prk)
                .unwrap()
                .expand(info, &mut got)
                .unwrap();
            assert_eq!(got, want, "A.{} OKM", n + 1);
        }
    }

    /// Appendix C of draft-connolly-cfrg-xwing-kem: one map of field name to
    /// hex per vector. Page headers and footers split the hex blocks; a field
    /// runs until the next field name. The same reading as
    /// scripts/btungsten/pq05-xwing-draft.mjs.
    fn xwing_draft_vectors(text: &str) -> Vec<std::collections::BTreeMap<String, String>> {
        let start = text
            .find("\nAppendix C.  Test vectors")
            .expect("Appendix C");
        let end = start + 1 + text[start + 1..].find("\nAppendix D.").expect("Appendix D");
        let mut out: Vec<std::collections::BTreeMap<String, String>> = Vec::new();
        let mut field: Option<String> = None;
        for line in text[start..end].lines().skip(1).map(str::trim) {
            let (head, rest) = line.split_once(char::is_whitespace).unwrap_or((line, ""));
            let rest = rest.trim();
            let is_hex = |s: &str| {
                s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            };
            if ["seed", "sk", "pk", "eseed", "ct", "ss"].contains(&head) && is_hex(rest) {
                if head == "seed" {
                    out.push(Default::default());
                }
                let v = out.last_mut().expect("a field before any seed");
                v.insert(head.to_string(), rest.to_string());
                field = Some(head.to_string());
            } else if let (Some(f), false) = (&field, line.is_empty()) {
                if is_hex(line) {
                    out.last_mut().unwrap().get_mut(f).unwrap().push_str(line);
                }
            }
        }
        out
    }

    // X-Wing as bsigner runs it (the key from the seed, decapsulation) on the
    // test vectors of draft-connolly-cfrg-xwing-kem Appendix C, at the
    // revision scripts/btungsten/pq05-xwing-draft.json pins (SPEC-BTUNGSTEN-PQ-1
    // PQ05). Ignored by default because the draft is fetched, never committed:
    // CI runs it with BPQ_XWING_DRAFT naming the fetched, pin-checked file.
    #[test]
    #[ignore = "needs BPQ_XWING_DRAFT, the draft text CI fetches"]
    fn xwing_matches_the_draft_vectors() {
        let path = std::env::var("BPQ_XWING_DRAFT").expect("BPQ_XWING_DRAFT names the draft text");
        let vectors = xwing_draft_vectors(&std::fs::read_to_string(path).unwrap());
        assert!(
            !vectors.is_empty(),
            "the draft yielded no vectors (T-VACUOUS)"
        );
        for (i, v) in vectors.iter().enumerate() {
            let seed: [u8; 32] = unhex(&v["seed"]).try_into().expect("a 32-byte seed");
            let (dk, _, x_pk) = xwing_expand(&seed);
            let mut pk = dk.encapsulation_key().to_bytes().to_vec();
            pk.extend_from_slice(x_pk.as_bytes());
            assert_eq!(pk, unhex(&v["pk"]), "vector {} public key", i + 1);
            let keys = PqKeys {
                dsa_public: Vec::new(),
                kem_public: pk,
                kem_seed: Zeroizing::new(seed),
                vault: Zeroizing::new([0u8; 32]),
            };
            let ct = unhex(&v["ct"]);
            let ss = keys.xwing_decapsulate(&ct).expect("a 1120-byte ciphertext");
            assert_eq!(
                ss.to_vec(),
                unhex(&v["ss"]),
                "vector {} shared secret",
                i + 1
            );
            // TEETH: one ciphertext byte changed gives another secret
            let mut bent = ct.clone();
            bent[0] ^= 1;
            assert_ne!(
                keys.xwing_decapsulate(&bent).unwrap().to_vec(),
                unhex(&v["ss"]),
                "vector {}: a changed ciphertext kept the secret",
                i + 1
            );
        }
        println!(
            "PQ05-XWING bsigner: {} of {} vectors pass (keygen, decapsulate, one changed ciphertext refused)",
            vectors.len(),
            vectors.len()
        );
    }

    // The succession key, derived here and in the browser, must give the
    // commitment and the id bpq.js wrote into every vector row: the cross-check
    // SPEC-BPQ-1 §6 listed as missing.
    #[test]
    fn succession_keys_match_the_browser_on_every_vector_row() {
        use fips205::traits::SerDes;
        let v = vectors();
        let rows = v["keys"].as_array().unwrap();
        assert!(!rows.is_empty());
        for row in rows {
            let prk = root(row["rootFrom"].as_str().unwrap());
            let (pk, _sk) = succession_keys(&prk, row["context"].as_str().unwrap()).unwrap();
            let pk = pk.into_bytes();
            let commit = succession_commit(&pk);
            assert_eq!(
                b64::b64u(&commit),
                row["successionCommit"].as_str().unwrap(),
                "row {}",
                row["name"]
            );
            if let Some(slh) = row.get("slhPublicKey").and_then(Value::as_str) {
                assert_eq!(b64::b64u(&pk), slh, "row {} public key", row["name"]);
            }
            let dsa = unb64(&row["dsaPublicKey"]).unwrap();
            assert_eq!(
                id_from(&dsa, &commit).as_deref(),
                row["id"].as_str(),
                "row {} id",
                row["name"]
            );
        }
        assert!(matches!(
            succession_keys(&root("x"), ROOT_CONTEXT),
            Err(BpqError::ReservedContext)
        ));
    }

    #[test]
    fn a_card_made_here_verifies_and_matches_the_vector_row() {
        let v = vectors();
        let row = &v["keys"][0];
        let c = card(
            &root(row["rootFrom"].as_str().unwrap()),
            row["context"].as_str().unwrap(),
        )
        .unwrap();
        assert!(verify_card(&c));
        assert_eq!(c["id"], row["id"]);
        assert_eq!(c["dsa"], row["dsaPublicKey"]);
    }

    // SPEC-BPQ-1 §5 handover v1, and the forgeries it must refuse
    // (SPEC-BTUNGSTEN-PQ-1 §PQ07).
    #[test]
    fn a_handover_verifies_and_its_forgeries_do_not() {
        let v = vectors();
        let row = &v["keys"][0];
        let prk = root(row["rootFrom"].as_str().unwrap());
        let ctx = row["context"].as_str().unwrap();
        let next = format!("{ctx}/2");
        let at = "2026-10-08T12:00:00Z";
        let h = handover(&prk, ctx, &next, at).unwrap();
        assert_eq!(
            h["from"], row["id"],
            "the retired id is the vector row's id"
        );
        let reparsed: Value = serde_json::from_str(&h.to_string()).unwrap();
        let to = verify_handover(&reparsed)
            .expect("the honest handover verifies after a JSON round trip");
        assert_eq!(Some(to.as_str()), card(&prk, &next).unwrap()["id"].as_str());

        let refused =
            |f: Value, why: &str| assert!(verify_handover(&f).is_none(), "{why} was accepted");
        // a forger holding only the old ML-DSA key signs with its own SLH key
        let atk = handover(&root("an attacker"), "pq:x", "pq:x/2", at).unwrap();
        let mut f = atk.clone();
        f["from"] = h["from"].clone();
        f["dsa"] = h["dsa"].clone();
        refused(f, "an attacker's SLH key under the victim's id");
        // the signature is kept, the new key set swapped
        let mut f = h.clone();
        f["card"] = atk["card"].clone();
        f["to"] = atk["to"].clone();
        refused(f, "a swapped new card");
        // the signature replayed onto another id of the same owner
        let other = handover(&prk, "pq:other", &next, at).unwrap();
        let mut f = h.clone();
        for k in ["from", "dsa", "slh"] {
            f[k] = other[k].clone();
        }
        refused(f, "a handover replayed onto another id");
        // the timestamp: a moved instant, and a smuggled line
        let mut f = h.clone();
        f["at"] = json!("2026-10-08T12:00:01Z");
        refused(f, "a moved at");
        let mut f = h.clone();
        f["at"] = json!("2026-10-08T12:00:00Z\nx=y");
        refused(f, "a newline in at");
        // T-VACUOUS: the empty shapes
        for (k, val) in [
            ("card", Value::Null),
            ("slh", json!("")),
            ("sig", json!("")),
            ("to", json!("")),
        ] {
            let mut f = h.clone();
            f[k] = val;
            refused(f, &format!("an empty {k}"));
        }
        // a handover to itself, and the reserved context
        assert!(
            verify_handover(&handover(&prk, ctx, ctx, at).unwrap()).is_none(),
            "a handover to itself"
        );
        assert!(handover(&prk, ROOT_CONTEXT, &next, at).is_err());
        assert!(handover(&prk, ctx, &next, "yesterday").is_err());
    }

    const RUST_SEALED_VAULT: &str = "bpq rust sealer, TEST-ONLY vault";

    #[test]
    fn seal_self_round_trips_at_every_segment_edge_and_refuses_the_wrong_vault() {
        let vault = root(RUST_SEALED_VAULT);
        for len in [0usize, 1, 65_535, 65_536, 65_537, 200_000] {
            let plain: Vec<u8> = (0..len).map(|i| (i * 7 + 3) as u8).collect();
            let obj = seal_self(&plain, &vault);
            let o = open(&obj, &Reader::SelfVault(&vault)).expect("opens");
            assert_eq!(o.bytes, plain, "len {len}");
            assert!(o.meta.is_none() && o.sealed_by.is_none());
            assert!(
                open(&obj, &Reader::SelfVault(&root("another vault"))).is_err(),
                "len {len}"
            );
        }
        assert_ne!(
            seal_self(b"same", &vault),
            seal_self(b"same", &vault),
            "a fresh file key and oid every time"
        );
    }

    #[test]
    fn recovery_code_round_trips() {
        let prk = root("recovery code round trip");
        let code = recovery_code(&prk);
        assert!(code.starts_with("bdidrec1"), "{code}");
        assert_eq!(*master_prk_from_recovery_code(&code).unwrap(), prk);
    }

    // The pinned object sealed by `seal_self` (surfaces/bpq-rust-sealed.json)
    // opens here and in surfaces/bpq.js (e2e/bpq.test.mjs): the browser checks
    // the Rust sealer. BPQ_WRITE_RUST_SEALED=1 rewrites the file (a mode).
    #[test]
    fn the_pinned_rust_sealed_object_opens() {
        let vault = root(RUST_SEALED_VAULT);
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../surfaces/bpq-rust-sealed.json"
        );
        if std::env::var("BPQ_WRITE_RUST_SEALED").is_ok() {
            let plain = b"sealed by crates/bsigner bpq::seal_self, opened by surfaces/bpq.js";
            let doc = json!({
                "about": "A bpq1 object sealed by crates/bsigner bpq::seal_self (SPEC-BTUNGSTEN-PQ-1 PQ09) under a TEST-ONLY vault key = SHA-256(vaultFrom). Both implementations must open it: cargo test -p bsigner bpq, node --test e2e/bpq.test.mjs. Public test data.",
                "vaultFrom": RUST_SEALED_VAULT,
                "plain_b64u": b64::b64u(plain),
                "object_b64u": b64::b64u(&seal_self(plain, &vault)),
            });
            std::fs::write(path, serde_json::to_string_pretty(&doc).unwrap() + "\n").unwrap();
        }
        let v: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(v["vaultFrom"], RUST_SEALED_VAULT);
        let obj = b64::b64u_decode(v["object_b64u"].as_str().unwrap()).unwrap();
        let o = open(&obj, &Reader::SelfVault(&vault)).unwrap();
        assert_eq!(b64::b64u(&o.bytes), v["plain_b64u"].as_str().unwrap());
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
        assert_eq!(rv["label"], bpq_core::LABEL_STR[bpq_core::VAULT as usize]);
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
            bpq_core::ML_DSA_65_RECORD,
            row["context"].as_str().unwrap(),
            &mut seed,
        )
        .unwrap();
        let sig = crate::pq::dsa_sign(crate::alg::SigAlg::MlDsa65, &seed, msg).unwrap();
        b64::b64u(&sig)
    }

    fn bind_msg(id: &str, at: &str, lines: &str) -> Vec<u8> {
        [
            dom(layout::BIND),
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
            x["sig"] = Value::from(sign_as_a(&v, &[dom(layout::DETACHED), &fh, &meta].concat()));
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
            .replace(
                "{kc}",
                &b64::b64u(&sha3(&[dom(layout::KEY_COMMIT), &oid, &fk])),
            );
        let aad = sha3(&[core.as_bytes()]);
        let kw = hkdf32(vault, &oid, dom(layout::WRAP_SELF));
        let mut slots =
            vec![json!({ "to": "self", "w": b64::b64u(&gcm_seal(&kw, &[0; 12], &fk, &aad)) })];
        slots.extend_from_slice(extra);
        let keys_b = serde_json::to_vec(&slots).unwrap();
        let body = gcm_seal(&fk, &nonce(FLAG_FINAL, 0), plain, &aad);
        let msg = [
            dom(layout::SEAL),
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
