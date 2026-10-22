//! bTunGsTeN WB001 — the intent-binding model (Rust-first: no twin beside it).
//!
//! The WB001 model: byte-for-byte the pinned envelope, the strict decoder, the
//! refusal codes. The encoder is `btungsten_wb001_core::encode`, proven equal to the
//! Cryptol `wire` by SAW for every valid intent. Signatures are Ed25519 from
//! `libcrux-ed25519` (HACL*-verified), over the full envelope bytes.

pub use btungsten_wb001_core as core;
use btungsten_wb001_core::{
    decode_core, encode, valid_intent, well_formed_utf8_128, well_formed_utf8_64, Intent, D_LENGTH,
    D_MAGIC, D_OK, D_SHORT, D_TAG_ORDER, D_TRAILING, D_UTF8, D_VERSION, MAX_ENV,
};

/// A typed refusal. `code()` is the exact string the pinned vectors carry.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Refusal {
    Type,
    Utf16,
    Utf8,
    Bounds,
    Short,
    Magic,
    Version,
    TagOrder,
    Length,
    Trailing,
    /// An `Intent` assembled by hand that `valid_intent` rejects. Unreachable
    /// through [`IntentIn::build`] or [`decode`]; the pinned vectors have no such row.
    Invalid,
}

impl Refusal {
    pub fn code(self) -> &'static str {
        match self {
            Refusal::Type => "bt-wb01:type",
            Refusal::Utf16 => "bt-wb01:utf16",
            Refusal::Utf8 => "bt-wb01:utf8",
            Refusal::Bounds => "bt-wb01:bounds",
            Refusal::Short => "bt-wb01:short",
            Refusal::Magic => "bt-wb01:magic",
            Refusal::Version => "bt-wb01:version",
            Refusal::TagOrder => "bt-wb01:tag-order",
            Refusal::Length => "bt-wb01:length",
            Refusal::Trailing => "bt-wb01:trailing",
            Refusal::Invalid => "bt-wb01:invalid",
        }
    }
}

/// A text field as it arrives. UTF-16 input (JS strings) may carry unpaired
/// surrogates, which are refused (`bt-wb01:utf16`), never replaced.
#[derive(Clone, Debug)]
pub enum Text {
    Str(String),
    Utf16(Vec<u16>),
}

impl Text {
    fn utf8(&self) -> Result<Vec<u8>, Refusal> {
        match self {
            Text::Str(s) => Ok(s.as_bytes().to_vec()),
            Text::Utf16(u) => String::from_utf16(u)
                .map(String::into_bytes)
                .map_err(|_| Refusal::Utf16),
        }
    }
}

/// An intent in its natural types, before the formal shape.
#[derive(Clone, Debug)]
pub struct IntentIn {
    pub domain: Text,
    pub nonce: Vec<u8>,
    pub epoch: u64,
    pub action: Vec<u8>,
    pub destination: Text,
    pub capability: Text,
    pub amount: u64,
    pub expiry: u64,
    pub payer: Text,
    pub payload: Vec<u8>,
}

fn text_field<const CAP: usize>(
    t: &Text,
    min: usize,
    wf: fn(&[u8; CAP]) -> bool,
) -> Result<(u32, [u8; CAP]), Refusal> {
    let b = t.utf8()?;
    if b.len() < min || b.len() > CAP {
        return Err(Refusal::Bounds);
    }
    let mut a = [0u8; CAP];
    a[..b.len()].copy_from_slice(&b);
    if !wf(&a) {
        return Err(Refusal::Utf8);
    }
    Ok((b.len() as u32, a))
}

fn bytes32(v: &[u8]) -> Result<[u8; 32], Refusal> {
    v.try_into().map_err(|_| Refusal::Type)
}

impl IntentIn {
    /// Field by field in canonical order, refusing with the codes the
    /// pinned vectors record.
    pub fn build(&self) -> Result<Box<Intent>, Refusal> {
        let (domain_len, domain) = text_field::<64>(&self.domain, 1, well_formed_utf8_64)?;
        let nonce = bytes32(&self.nonce)?;
        let action = bytes32(&self.action)?;
        let (destination_len, destination) =
            text_field::<128>(&self.destination, 1, well_formed_utf8_128)?;
        let (capability_len, capability) =
            text_field::<64>(&self.capability, 1, well_formed_utf8_64)?;
        let (payer_len, payer) = text_field::<128>(&self.payer, 1, well_formed_utf8_128)?;
        if self.payload.len() > 4096 {
            return Err(Refusal::Bounds);
        }
        let mut i = Box::new(Intent {
            domain_len,
            domain,
            nonce_len: 32,
            nonce,
            epoch: self.epoch,
            action_len: 32,
            action,
            destination_len,
            destination,
            capability_len,
            capability,
            amount: self.amount,
            expiry: self.expiry,
            payer_len,
            payer,
            payload_len: self.payload.len() as u32,
            payload: [0u8; 4096],
        });
        i.payload[..self.payload.len()].copy_from_slice(&self.payload);
        if !valid_intent(&i) {
            return Err(Refusal::Invalid);
        }
        Ok(i)
    }
}

/// The canonical envelope: exactly `envLen` bytes of the SAW-proven encoder.
pub fn canonical(i: &Intent) -> Result<Vec<u8>, Refusal> {
    if !valid_intent(i) {
        return Err(Refusal::Invalid);
    }
    let mut out = Box::new([0u8; MAX_ENV]);
    let n = encode(i, &mut out) as usize;
    Ok(out[..n].to_vec())
}

/// Strict decode: magic, version, ascending tags, exact bounds, exact
/// consumption, well-formed UTF-8 (through the SAW-proven DFA). The same
/// checks in the order the pinned vectors record, so the same refusal code.
///
/// The decision is [`decode_core`], proven equal to the Cryptol `decodeSpec`
/// for every buffer and every length (`scripts/btungsten/wb001-saw/decode.saw`).
/// It reads the first `MAX_ENV` input bytes and the true length; this wrapper
/// supplies exactly those, zero filled past the input's end.
pub fn decode(env: &[u8]) -> Result<Box<Intent>, Refusal> {
    let mut buf = Box::new([0u8; MAX_ENV]);
    let k = env.len().min(MAX_ENV);
    buf[..k].copy_from_slice(&env[..k]);
    let mut i = Box::new(Intent::ZERO);
    match decode_core(&buf, env.len() as u64, &mut i) {
        D_OK => Ok(i),
        D_SHORT => Err(Refusal::Short),
        D_MAGIC => Err(Refusal::Magic),
        D_VERSION => Err(Refusal::Version),
        D_TAG_ORDER => Err(Refusal::TagOrder),
        D_LENGTH => Err(Refusal::Length),
        D_UTF8 => Err(Refusal::Utf8),
        D_TRAILING => Err(Refusal::Trailing),
        v => unreachable!("decode_core verdict {v}: decodeSpec has only D_OK..=D_TRAILING"),
    }
}

/// The reference decode implementation calling `btungsten_wb001_core::decode_core`.
/// Ported from `antigravity/btungsten-repro-2026-10-17` so the
/// `btungsten-qeval` differential tests can pin the optimized `decode`
/// against this direct core wrapper.
pub fn decode_reference(env: &[u8]) -> Result<Box<Intent>, Refusal> {
    let mut buf = Box::new([0u8; MAX_ENV]);
    let k = env.len().min(MAX_ENV);
    buf[..k].copy_from_slice(&env[..k]);
    let mut i = Box::new(Intent::ZERO);
    match decode_core(&buf, env.len() as u64, &mut i) {
        D_OK => Ok(i),
        D_SHORT => Err(Refusal::Short),
        D_MAGIC => Err(Refusal::Magic),
        D_VERSION => Err(Refusal::Version),
        D_TAG_ORDER => Err(Refusal::TagOrder),
        D_LENGTH => Err(Refusal::Length),
        D_UTF8 => Err(Refusal::Utf8),
        D_TRAILING => Err(Refusal::Trailing),
        v => unreachable!("decode_core verdict {v}: decodeSpec has only D_OK..=D_TRAILING"),
    }
}

/// Ed25519 public key for a 32-byte seed (RFC 8032 secret key).
pub fn public_key(seed: &[u8; 32]) -> [u8; 32] {
    let mut pk = [0u8; 32];
    libcrux_ed25519::secret_to_public(&mut pk, seed);
    pk
}

/// Sign the canonical envelope of `i`. Domain separation is inside the bytes.
pub fn sign(seed: &[u8; 32], i: &Intent) -> Result<[u8; 64], Refusal> {
    let env = canonical(i)?;
    libcrux_ed25519::sign(&env, seed).map_err(|_| Refusal::Length)
}

/// The binding verifier: structural truth (strict decode) AND cryptographic
/// truth. Never panics; any malformed envelope is `false`.
pub fn verify_envelope(pk: &[u8; 32], env: &[u8], sig: &[u8; 64]) -> bool {
    decode(env).is_ok() && libcrux_ed25519::verify(env, pk, sig).is_ok()
}

pub fn verify(pk: &[u8; 32], i: &Intent, sig: &[u8; 64]) -> bool {
    match canonical(i) {
        Ok(env) => verify_envelope(pk, &env, sig),
        Err(_) => false,
    }
}
