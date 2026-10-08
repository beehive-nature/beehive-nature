//! bTunGsTeN WB001 — the intent-binding model (Rust-first: no twin beside it).
//!
//! The WB001 model: byte-for-byte the pinned envelope, the strict decoder, the
//! refusal codes. The encoder is `btungsten_wb001_core::encode`, proven equal to the
//! Cryptol `wire` by SAW for every valid intent. Signatures are Ed25519 from
//! `libcrux-ed25519` (HACL*-verified), over the full envelope bytes.

pub use btungsten_wb001_core as core;
use btungsten_wb001_core::{
    encode, valid_intent, well_formed_utf8_128, well_formed_utf8_64, Intent, HEAD8, MAX_ENV,
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

#[derive(Clone, Copy)]
enum Kind {
    Utf8,
    Bytes32,
    U64,
    Raw,
}

const FIELDS: [(u8, Kind, u32, u32); 10] = [
    (0x01, Kind::Utf8, 1, 64),
    (0x02, Kind::Bytes32, 32, 32),
    (0x03, Kind::U64, 8, 8),
    (0x04, Kind::Bytes32, 32, 32),
    (0x05, Kind::Utf8, 1, 128),
    (0x06, Kind::Utf8, 1, 64),
    (0x07, Kind::U64, 8, 8),
    (0x08, Kind::U64, 8, 8),
    (0x09, Kind::Utf8, 1, 128),
    (0x0a, Kind::Raw, 0, 4096),
];

fn padded<const CAP: usize>(v: &[u8]) -> [u8; CAP] {
    let mut a = [0u8; CAP];
    a[..v.len()].copy_from_slice(v);
    a
}

/// Strict decode: magic, version, ascending tags, exact bounds, exact
/// consumption, well-formed UTF-8 (through the SAW-proven DFA). The same
/// checks in the order the pinned vectors record, so the same refusal code.
pub fn decode(env: &[u8]) -> Result<Box<Intent>, Refusal> {
    if env.len() < 8 {
        return Err(Refusal::Short);
    }
    if env[..7] != HEAD8[..7] {
        return Err(Refusal::Magic);
    }
    if env[7] != HEAD8[7] {
        return Err(Refusal::Version);
    }
    let mut at = 8usize;
    let mut vals: Vec<&[u8]> = Vec::with_capacity(10);
    for &(tag, kind, min, max) in FIELDS.iter() {
        if at + 5 > env.len() {
            return Err(Refusal::Short);
        }
        if env[at] != tag {
            return Err(Refusal::TagOrder);
        }
        let len = u32::from_be_bytes([env[at + 1], env[at + 2], env[at + 3], env[at + 4]]);
        if len < min || len > max {
            return Err(Refusal::Length);
        }
        let len = len as usize;
        if at + 5 + len > env.len() {
            return Err(Refusal::Short);
        }
        let v = &env[at + 5..at + 5 + len];
        if let Kind::Utf8 = kind {
            let ok = if max == 64 {
                well_formed_utf8_64(&padded::<64>(v))
            } else {
                well_formed_utf8_128(&padded::<128>(v))
            };
            if !ok {
                return Err(Refusal::Utf8);
            }
        }
        vals.push(v);
        at += 5 + len;
    }
    if at != env.len() {
        return Err(Refusal::Trailing);
    }
    let u64be = |v: &[u8]| u64::from_be_bytes(v.try_into().expect("length checked: 8"));
    let i = Box::new(Intent {
        domain_len: vals[0].len() as u32,
        domain: padded(vals[0]),
        nonce_len: 32,
        nonce: padded(vals[1]),
        epoch: u64be(vals[2]),
        action_len: 32,
        action: padded(vals[3]),
        destination_len: vals[4].len() as u32,
        destination: padded(vals[4]),
        capability_len: vals[5].len() as u32,
        capability: padded(vals[5]),
        amount: u64be(vals[6]),
        expiry: u64be(vals[7]),
        payer_len: vals[8].len() as u32,
        payer: padded(vals[8]),
        payload_len: vals[9].len() as u32,
        payload: padded(vals[9]),
    });
    Ok(i)
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
