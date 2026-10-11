//! The genesis op — the one document a bzDiD IS the hash of.
//!
//! Shape (docs/bzdid-architecture-decision.md §3.1, byte-level v1 canon
//! fixed here — "BDID-GENESIS-V1"; changing any byte of this encoding is a
//! v2 ceremony, never an edit):
//!
//! ```text
//! genesis_op = dag-cbor({
//!   "type":         "b:genesis",            // the one literal
//!   "rotationKeys": [ {alg, key} × 1..8 ],  // priority order, no duplicates
//!   "signingKey":   {alg, key},             // the op-signing key, exactly one
//!   "services":     [ text × 0..16 ],       // service hints (ar://, https://…)
//!   "alsoKnownAs":  [ text × 0..16 ],       // bound personas/handles
//!   "validUntil":   uint                    // unix seconds, nonzero
//! })
//! bzDiD = "did:b:" || base32(sha256(genesis_op))   // 52 chars
//! ```
//!
//! Each key is a card `{alg: text, key: bytes}` — the algorithm id rides
//! WITH the bytes (the estate's agility law: nothing hardcoded; unknown ids
//! are refused, never defaulted). Succession/rotation signing is the NEXT
//! increment (the founder's order); this one is the root and its verifier,
//! and it deliberately does not yet verify any signature — the root is
//! self-certifying by HASH, not by signature.
//!
//! THE STORED-BYTES LAW (voucher-escrow rule 3, same wound avoided): the
//! verifier hashes the bytes it was HANDED and never re-encodes a parsed
//! value to compare. Structure is checked so the op means something; the
//! hash is over the handed bytes, so no serialiser can ever get a second
//! opinion about what an identity was.

use crate::dagcbor::{decode, encode, DagValue};
use crate::did::BzDid;
use crate::BzDidError;

/// The key algorithms the v1 genesis op carries. An unlisted id is added BY
/// RULING, never by a caller (the closed-enum law). Byte lengths are the
/// FIPS/standard public-key lengths; `ml-dsa-65` public keys are 1952 bytes
/// (FIPS 204; the same length bsigner's PQ registry carries).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyAlg {
    Ed25519,
    MlDsa65,
}

impl KeyAlg {
    pub fn id(self) -> &'static str {
        match self {
            KeyAlg::Ed25519 => "ed25519",
            KeyAlg::MlDsa65 => "ml-dsa-65",
        }
    }
    pub fn parse(id: &str) -> Result<KeyAlg, BzDidError> {
        match id {
            "ed25519" => Ok(KeyAlg::Ed25519),
            "ml-dsa-65" => Ok(KeyAlg::MlDsa65),
            other => Err(BzDidError::UnknownAlg(other.into())),
        }
    }
    pub fn key_len(self) -> usize {
        match self {
            KeyAlg::Ed25519 => 32,
            KeyAlg::MlDsa65 => 1952,
        }
    }
}

/// A public key card — the algorithm id rides with the bytes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyCard {
    pub alg: KeyAlg,
    pub key: Vec<u8>,
}

impl KeyCard {
    pub fn new(alg: KeyAlg, key: Vec<u8>) -> Result<KeyCard, BzDidError> {
        if key.len() != alg.key_len() {
            return Err(BzDidError::BadKeyLen {
                alg: alg.id().into(),
                expected: alg.key_len(),
                got: key.len(),
            });
        }
        Ok(KeyCard { alg, key })
    }
}

pub const MAX_ROTATION_KEYS: usize = 8;
pub const MAX_STRINGS: usize = 16;
pub const MAX_STRING_BYTES: usize = 256;

/// The genesis op, typed. Build it, hash it, hand it to anyone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenesisOp {
    /// Rotation keys in PRIORITY order (r0 highest). Signed succession is
    /// the next increment; the root only commits them.
    pub rotation_keys: Vec<KeyCard>,
    pub signing_key: KeyCard,
    pub services: Vec<String>,
    pub also_known_as: Vec<String>,
    /// Unix seconds. `valid_at(now)` is `now < valid_until` — the boundary
    /// refuses (fail closed, the estate's inclusive-edge law).
    pub valid_until: u64,
}

fn card_to_value(c: &KeyCard) -> DagValue {
    DagValue::Map(vec![
        ("alg".into(), DagValue::text(c.alg.id())),
        ("key".into(), DagValue::Bytes(c.key.clone())),
    ])
}

fn card_from_value(v: &DagValue) -> Result<KeyCard, BzDidError> {
    let m = v
        .as_map()
        .ok_or_else(|| BzDidError::NotAGenesisOp("a key card is not a map".into()))?;
    if m.len() != 2 {
        return Err(BzDidError::NotAGenesisOp(
            "a key card must be exactly {alg, key}".into(),
        ));
    }
    let alg = m
        .iter()
        .find(|(k, _)| k == "alg")
        .and_then(|(_, v)| v.as_text())
        .ok_or_else(|| BzDidError::NotAGenesisOp("key card has no alg text".into()))?;
    let key = m
        .iter()
        .find(|(k, _)| k == "key")
        .and_then(|(_, v)| v.as_bytes())
        .ok_or_else(|| BzDidError::NotAGenesisOp("key card has no key bytes".into()))?;
    KeyCard::new(KeyAlg::parse(alg)?, key.to_vec())
}

fn strings_from_value(v: &DagValue, what: &str) -> Result<Vec<String>, BzDidError> {
    let arr = v
        .as_array()
        .ok_or_else(|| BzDidError::NotAGenesisOp(format!("{what} is not an array")))?;
    if arr.len() > MAX_STRINGS {
        return Err(BzDidError::NotAGenesisOp(format!(
            "{what} carries more than {MAX_STRINGS} entries"
        )));
    }
    let mut out = Vec::with_capacity(arr.len());
    for item in arr {
        let s = item
            .as_text()
            .ok_or_else(|| BzDidError::NotAGenesisOp(format!("{what} entry is not text")))?;
        if s.is_empty() || s.len() > MAX_STRING_BYTES {
            return Err(BzDidError::NotAGenesisOp(format!(
                "{what} entry must be 1..={MAX_STRING_BYTES} bytes"
            )));
        }
        out.push(s.to_string());
    }
    Ok(out)
}

impl DagValue {
    fn as_map(&self) -> Option<&[(String, DagValue)]> {
        match self {
            DagValue::Map(m) => Some(m),
            _ => None,
        }
    }
    fn as_array(&self) -> Option<&[DagValue]> {
        match self {
            DagValue::Array(a) => Some(a),
            _ => None,
        }
    }
    fn as_text(&self) -> Option<&str> {
        match self {
            DagValue::Text(s) => Some(s),
            _ => None,
        }
    }
    fn as_bytes(&self) -> Option<&[u8]> {
        match self {
            DagValue::Bytes(b) => Some(b),
            _ => None,
        }
    }
    fn as_u64(&self) -> Option<u64> {
        match self {
            DagValue::UInt(n) => Some(*n),
            _ => None,
        }
    }
}

impl GenesisOp {
    /// Structural validation BEFORE any encoding — malformed ops never
    /// reach a hash. Key lengths are re-checked HERE, not only in
    /// `KeyCard::new`, because a hand-built struct must not be able to
    /// smuggle a wrong-length key past the constructor.
    pub fn validate(&self) -> Result<(), BzDidError> {
        if self.rotation_keys.is_empty() || self.rotation_keys.len() > MAX_ROTATION_KEYS {
            return Err(BzDidError::BadRotationCount(self.rotation_keys.len()));
        }
        for card in self
            .rotation_keys
            .iter()
            .chain(std::iter::once(&self.signing_key))
        {
            if card.key.len() != card.alg.key_len() {
                return Err(BzDidError::BadKeyLen {
                    alg: card.alg.id().into(),
                    expected: card.alg.key_len(),
                    got: card.key.len(),
                });
            }
        }
        for (i, a) in self.rotation_keys.iter().enumerate() {
            if self.rotation_keys[i + 1..].iter().any(|b| a == b) {
                return Err(BzDidError::DuplicateRotationKey);
            }
        }
        if self.valid_until == 0 {
            return Err(BzDidError::BadValidUntil(0));
        }
        for (list, what) in [
            (&self.services, "services"),
            (&self.also_known_as, "alsoKnownAs"),
        ] {
            if list.len() > MAX_STRINGS {
                return Err(BzDidError::NotAGenesisOp(format!(
                    "{what} carries more than {MAX_STRINGS} entries"
                )));
            }
            for s in list {
                if s.is_empty() || s.len() > MAX_STRING_BYTES {
                    return Err(BzDidError::NotAGenesisOp(format!(
                        "{what} entry must be 1..={MAX_STRING_BYTES} bytes"
                    )));
                }
            }
        }
        Ok(())
    }

    /// Canonical dag-cbor bytes — the exact bytes the identity hashes.
    pub fn build(&self) -> Result<Vec<u8>, BzDidError> {
        self.validate()?;
        Ok(encode(&DagValue::Map(vec![
            ("type".into(), DagValue::text("b:genesis")),
            (
                "rotationKeys".into(),
                DagValue::Array(self.rotation_keys.iter().map(card_to_value).collect()),
            ),
            ("signingKey".into(), card_to_value(&self.signing_key)),
            (
                "services".into(),
                DagValue::Array(self.services.iter().map(|s| DagValue::text(s)).collect()),
            ),
            (
                "alsoKnownAs".into(),
                DagValue::Array(
                    self.also_known_as
                        .iter()
                        .map(|s| DagValue::text(s))
                        .collect(),
                ),
            ),
            ("validUntil".into(), DagValue::UInt(self.valid_until)),
        ])))
    }

    /// The identity of exactly this op.
    pub fn did(&self) -> Result<BzDid, BzDidError> {
        Ok(BzDid::derive(&self.build()?))
    }

    /// Parse handed bytes into a typed op: strict dag-cbor, then the
    /// structural laws. The BYTES are what gets hashed later — nothing is
    /// re-encoded.
    pub fn parse(bytes: &[u8]) -> Result<GenesisOp, BzDidError> {
        let v = decode(bytes).map_err(BzDidError::Cbor)?;
        let m = v
            .as_map()
            .ok_or_else(|| BzDidError::NotAGenesisOp("the op is not a map".into()))?;
        let field = |k: &str| m.iter().find(|(ek, _)| ek == k).map(|(_, v)| v);
        if m.len() != 6 {
            return Err(BzDidError::NotAGenesisOp(format!(
                "the op must carry exactly the six v1 fields, got {}",
                m.len()
            )));
        }
        let ty = field("type")
            .and_then(DagValue::as_text)
            .ok_or_else(|| BzDidError::NotAGenesisOp("no type text".into()))?;
        if ty != "b:genesis" {
            return Err(BzDidError::NotAGenesisOp(format!(
                "type is {ty:?}, not \"b:genesis\""
            )));
        }
        let rot = field("rotationKeys")
            .and_then(DagValue::as_array)
            .ok_or_else(|| BzDidError::NotAGenesisOp("no rotationKeys array".into()))?;
        if rot.is_empty() || rot.len() > MAX_ROTATION_KEYS {
            return Err(BzDidError::BadRotationCount(rot.len()));
        }
        let mut rotation_keys = Vec::with_capacity(rot.len());
        for rv in rot {
            rotation_keys.push(card_from_value(rv)?);
        }
        let signing =
            field("signingKey").ok_or_else(|| BzDidError::NotAGenesisOp("no signingKey".into()))?;
        let signing_key = card_from_value(signing)?;
        let services = strings_from_value(
            field("services").ok_or_else(|| BzDidError::NotAGenesisOp("no services".into()))?,
            "services",
        )?;
        let also_known_as = strings_from_value(
            field("alsoKnownAs")
                .ok_or_else(|| BzDidError::NotAGenesisOp("no alsoKnownAs".into()))?,
            "alsoKnownAs",
        )?;
        let valid_until = field("validUntil")
            .and_then(DagValue::as_u64)
            .ok_or_else(|| BzDidError::NotAGenesisOp("no validUntil uint".into()))?;
        let op = GenesisOp {
            rotation_keys,
            signing_key,
            services,
            also_known_as,
            valid_until,
        };
        op.validate()?;
        Ok(op)
    }

    /// Validity at a moment: `now < valid_until`. The boundary refuses —
    /// an identity at its expiry second is expired, and a wallet that
    /// cannot decide refuses to send (rule 10 of §3.4).
    pub fn valid_at(&self, now: u64) -> bool {
        now < self.valid_until
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn demo_op() -> GenesisOp {
        GenesisOp {
            rotation_keys: vec![
                KeyCard::new(KeyAlg::Ed25519, vec![0xA1; 32]).unwrap(),
                KeyCard::new(KeyAlg::Ed25519, vec![0xB2; 32]).unwrap(),
                KeyCard::new(KeyAlg::Ed25519, vec![0xC3; 32]).unwrap(),
            ],
            signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5D; 32]).unwrap(),
            services: vec!["ar://demo-hint".into(), "https://demo.example".into()],
            also_known_as: vec!["did:web:demo.example".into()],
            valid_until: 4_102_444_800, // 2100-01-01T00:00:00Z
        }
    }

    #[test]
    fn build_is_deterministic_and_parses_back() {
        let a = demo_op();
        let b = demo_op();
        assert_eq!(a.build().unwrap(), b.build().unwrap());
        let bytes = a.build().unwrap();
        assert_eq!(GenesisOp::parse(&bytes).unwrap(), a);
    }

    #[test]
    fn structural_refusals() {
        let mut op = demo_op();
        op.rotation_keys.clear();
        assert!(matches!(op.build(), Err(BzDidError::BadRotationCount(0))));

        let mut op = demo_op();
        op.rotation_keys.push(op.rotation_keys[0].clone());
        assert!(matches!(op.build(), Err(BzDidError::DuplicateRotationKey)));

        let mut op = demo_op();
        op.valid_until = 0;
        assert!(matches!(op.build(), Err(BzDidError::BadValidUntil(0))));

        let mut op = demo_op();
        op.signing_key = KeyCard::new(KeyAlg::MlDsa65, vec![0x77; 1952]).unwrap();
        assert!(
            op.build().is_ok(),
            "ml-dsa-65 keys at exactly 1952 bytes pass"
        );

        let mut op = demo_op();
        op.signing_key = KeyCard {
            alg: KeyAlg::Ed25519,
            key: vec![0x99; 31],
        };
        assert!(
            matches!(op.build(), Err(BzDidError::BadKeyLen { .. })),
            "wrong-length key refused at build"
        );
    }

    #[test]
    fn unknown_alg_and_wrong_key_len_refused() {
        assert!(matches!(
            KeyAlg::parse("ml-dsa-65-hedged-2265"),
            Err(BzDidError::UnknownAlg(_))
        ));
        assert!(matches!(
            KeyCard::new(KeyAlg::Ed25519, vec![0; 31]),
            Err(BzDidError::BadKeyLen { .. })
        ));
    }

    #[test]
    fn parse_refuses_wrong_shapes() {
        let mut bytes = demo_op().build().unwrap();
        // type mutated to another literal
        let ty_at = bytes.windows(9).position(|w| w == b"b:genesis").unwrap();
        bytes[ty_at] = b'x';
        assert!(matches!(
            GenesisOp::parse(&bytes),
            Err(BzDidError::NotAGenesisOp(_))
        ));

        // an op that decodes but is not a map
        assert!(matches!(
            GenesisOp::parse(&[0x01]),
            Err(BzDidError::NotAGenesisOp(_))
        ));
    }

    #[test]
    fn validity_boundary_is_inclusive_refusal() {
        let op = demo_op();
        assert!(op.valid_at(op.valid_until - 1));
        assert!(
            !op.valid_at(op.valid_until),
            "the expiry second itself refuses"
        );
        assert!(!op.valid_at(op.valid_until + 1));
    }
}
