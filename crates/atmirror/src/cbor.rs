//! Strict DAG-CBOR reader — exactly the subset AT Protocol repos use, and
//! nothing wider. Definite lengths only; text-only map keys; duplicate keys
//! rejected; the only tag is 42 (IPLD link) and its payload must be a
//! multibase-identity-prefixed binary CID.
//!
//! Why hand-rolled: this crate is a *verifier*. Its CID checks hash the raw
//! block bytes (never a re-encoding), and its one re-encoding need — the
//! unsigned commit — is met by [`strip_sig`], a surgical byte splice that
//! copies every retained entry verbatim from the signed bytes. No encoder
//! exists here, so no encoder can disagree with the PDS's encoder. (The
//! signature verification in `commit.rs` is the oracle that keeps this
//! honest: a wrong splice fails against real repos immediately.)

use crate::cid::{Cid, CidError};

/// A decoded DAG-CBOR value (repo-subset).
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Int(i128),
    Bytes(Vec<u8>),
    Text(String),
    Bool(bool),
    Null,
    Float(f64),
    Array(Vec<Value>),
    /// Entries in encoded order; keys are unique (enforced).
    Map(Vec<(String, Value)>),
    Link(Cid),
}

impl Value {
    pub fn as_map(&self) -> Option<&[(String, Value)]> {
        match self {
            Value::Map(m) => Some(m),
            _ => None,
        }
    }

    /// Look up a key in a map value.
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.as_map()?
            .iter()
            .find_map(|(k, v)| (k == key).then_some(v))
    }

    pub fn as_text(&self) -> Option<&str> {
        match self {
            Value::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_int(&self) -> Option<i128> {
        match self {
            Value::Int(i) => Some(*i),
            _ => None,
        }
    }

    pub fn as_bytes(&self) -> Option<&[u8]> {
        match self {
            Value::Bytes(b) => Some(b),
            _ => None,
        }
    }

    pub fn as_link(&self) -> Option<&Cid> {
        match self {
            Value::Link(c) => Some(c),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum CborError {
    Truncated,
    /// Indefinite-length item — forbidden in DAG-CBOR.
    Indefinite,
    /// Reserved/malformed additional-info bits.
    BadHeader(u8),
    /// A tag other than 42.
    BadTag(u64),
    /// Tag-42 payload that is not a 0x00-prefixed binary CID.
    BadLink(String),
    NonTextKey,
    DuplicateKey(String),
    InvalidUtf8,
    TooDeep,
    /// Bytes remain after the single top-level item.
    TrailingBytes(usize),
    /// Simple value / float form outside the accepted subset.
    BadSimple(u8),
}

impl std::fmt::Display for CborError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CborError::Truncated => write!(f, "cbor truncated"),
            CborError::Indefinite => write!(f, "indefinite-length item (forbidden in DAG-CBOR)"),
            CborError::BadHeader(b) => write!(f, "malformed cbor header byte {b:#04x}"),
            CborError::BadTag(t) => write!(f, "tag {t} (only 42 permitted)"),
            CborError::BadLink(e) => write!(f, "malformed IPLD link: {e}"),
            CborError::NonTextKey => write!(f, "map key is not a text string"),
            CborError::DuplicateKey(k) => write!(f, "duplicate map key {k:?}"),
            CborError::InvalidUtf8 => write!(f, "text is not valid UTF-8"),
            CborError::TooDeep => write!(f, "nesting exceeds depth limit"),
            CborError::TrailingBytes(n) => write!(f, "{n} bytes after top-level item"),
            CborError::BadSimple(v) => write!(f, "simple/float form {v} outside subset"),
        }
    }
}

impl std::error::Error for CborError {}

impl From<CidError> for CborError {
    fn from(e: CidError) -> Self {
        CborError::BadLink(e.to_string())
    }
}

const MAX_DEPTH: u32 = 128;

/// Decode a complete DAG-CBOR buffer into one [`Value`]. Trailing bytes are
/// an error.
pub fn decode(buf: &[u8]) -> Result<Value, CborError> {
    let mut r = Reader { buf, pos: 0 };
    let v = r.item(0)?;
    if r.pos != buf.len() {
        return Err(CborError::TrailingBytes(buf.len() - r.pos));
    }
    Ok(v)
}

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn byte(&mut self) -> Result<u8, CborError> {
        let b = *self.buf.get(self.pos).ok_or(CborError::Truncated)?;
        self.pos += 1;
        Ok(b)
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], CborError> {
        let end = self.pos.checked_add(n).ok_or(CborError::Truncated)?;
        if end > self.buf.len() {
            return Err(CborError::Truncated);
        }
        let s = &self.buf[self.pos..end];
        self.pos = end;
        Ok(s)
    }

    /// Read a header byte's argument. Rejects indefinite (31) and
    /// reserved (28–30) forms.
    fn arg(&mut self, initial: u8) -> Result<u64, CborError> {
        let ai = initial & 0x1f;
        match ai {
            0..=23 => Ok(u64::from(ai)),
            24 => Ok(u64::from(self.byte()?)),
            25 => {
                let b = self.take(2)?;
                Ok(u64::from(u16::from_be_bytes([b[0], b[1]])))
            }
            26 => {
                let b = self.take(4)?;
                Ok(u64::from(u32::from_be_bytes([b[0], b[1], b[2], b[3]])))
            }
            27 => {
                let b = self.take(8)?;
                Ok(u64::from_be_bytes([
                    b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
                ]))
            }
            28..=30 => Err(CborError::BadHeader(initial)),
            _ => Err(CborError::Indefinite),
        }
    }

    fn item(&mut self, depth: u32) -> Result<Value, CborError> {
        if depth > MAX_DEPTH {
            return Err(CborError::TooDeep);
        }
        let initial = self.byte()?;
        match initial >> 5 {
            0 => Ok(Value::Int(i128::from(self.arg(initial)?))),
            1 => Ok(Value::Int(-1 - i128::from(self.arg(initial)?))),
            2 => {
                let len = self.arg(initial)? as usize;
                Ok(Value::Bytes(self.take(len)?.to_vec()))
            }
            3 => {
                let len = self.arg(initial)? as usize;
                let raw = self.take(len)?;
                let s = std::str::from_utf8(raw).map_err(|_| CborError::InvalidUtf8)?;
                Ok(Value::Text(s.to_owned()))
            }
            4 => {
                let len = self.arg(initial)? as usize;
                let mut items = Vec::new();
                for _ in 0..len {
                    items.push(self.item(depth + 1)?);
                }
                Ok(Value::Array(items))
            }
            5 => {
                let len = self.arg(initial)? as usize;
                let mut entries: Vec<(String, Value)> = Vec::new();
                for _ in 0..len {
                    let key = match self.item(depth + 1)? {
                        Value::Text(s) => s,
                        _ => return Err(CborError::NonTextKey),
                    };
                    if entries.iter().any(|(k, _)| *k == key) {
                        return Err(CborError::DuplicateKey(key));
                    }
                    let value = self.item(depth + 1)?;
                    entries.push((key, value));
                }
                Ok(Value::Map(entries))
            }
            6 => {
                let tag = self.arg(initial)?;
                if tag != 42 {
                    return Err(CborError::BadTag(tag));
                }
                let inner = self.byte()?;
                if inner >> 5 != 2 {
                    return Err(CborError::BadLink("tag 42 payload is not bytes".into()));
                }
                let len = self.arg(inner)? as usize;
                let raw = self.take(len)?;
                if raw.first() != Some(&0x00) {
                    return Err(CborError::BadLink(
                        "link missing multibase identity prefix".into(),
                    ));
                }
                Ok(Value::Link(Cid::from_bytes(&raw[1..])?))
            }
            7 => match initial & 0x1f {
                20 => Ok(Value::Bool(false)),
                21 => Ok(Value::Bool(true)),
                22 => Ok(Value::Null),
                27 => {
                    let b = self.take(8)?;
                    Ok(Value::Float(f64::from_be_bytes([
                        b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
                    ])))
                }
                other => Err(CborError::BadSimple(other)),
            },
            _ => unreachable!("3-bit major type"),
        }
    }

    /// Walk one item without materializing it; used for byte-span surgery.
    fn skip(&mut self, depth: u32) -> Result<(), CborError> {
        if depth > MAX_DEPTH {
            return Err(CborError::TooDeep);
        }
        let initial = self.byte()?;
        match initial >> 5 {
            0 | 1 => {
                self.arg(initial)?;
            }
            2 | 3 => {
                let len = self.arg(initial)? as usize;
                self.take(len)?;
            }
            4 => {
                let len = self.arg(initial)? as usize;
                for _ in 0..len {
                    self.skip(depth + 1)?;
                }
            }
            5 => {
                let len = self.arg(initial)? as usize;
                for _ in 0..len {
                    self.skip(depth + 1)?;
                    self.skip(depth + 1)?;
                }
            }
            6 => {
                self.arg(initial)?;
                self.skip(depth + 1)?;
            }
            7 => match initial & 0x1f {
                20 | 21 | 22 => {}
                25 => {
                    self.take(2)?;
                }
                26 => {
                    self.take(4)?;
                }
                27 => {
                    self.take(8)?;
                }
                other => return Err(CborError::BadSimple(other)),
            },
            _ => unreachable!(),
        }
        Ok(())
    }
}

/// Errors specific to unsigned-commit extraction.
#[derive(Debug, Clone, PartialEq)]
pub enum StripError {
    Cbor(CborError),
    /// Top-level item is not a definite map.
    NotAMap,
    /// No `sig` entry found to remove.
    NoSig,
    /// The map is too large to re-header inline (never true for commits).
    TooManyEntries(u64),
}

impl std::fmt::Display for StripError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StripError::Cbor(e) => write!(f, "{e}"),
            StripError::NotAMap => write!(f, "signed commit is not a cbor map"),
            StripError::NoSig => write!(f, "signed commit has no `sig` entry"),
            StripError::TooManyEntries(n) => write!(f, "commit map has {n} entries"),
        }
    }
}

impl std::error::Error for StripError {}

impl From<CborError> for StripError {
    fn from(e: CborError) -> Self {
        StripError::Cbor(e)
    }
}

/// Produce the unsigned-commit bytes from signed-commit bytes by removing
/// the `sig` entry — **copying every other entry byte-for-byte** from the
/// original encoding. Because the PDS inserted `sig` into the same
/// canonically-ordered map it signed, removing it restores the exact bytes
/// the signature was computed over, independent of any key-ordering or
/// integer-width convention this crate might otherwise have to re-implement.
pub fn strip_sig(signed: &[u8]) -> Result<Vec<u8>, StripError> {
    let mut r = Reader {
        buf: signed,
        pos: 0,
    };
    let initial = r.byte()?;
    if initial >> 5 != 5 {
        return Err(StripError::NotAMap);
    }
    let count = r.arg(initial)?;
    if count == 0 || count > 23 {
        // Commits are 6-entry maps; anything above the inline-header range
        // is not a commit. Refuse rather than re-encode a wider header.
        return Err(StripError::TooManyEntries(count));
    }
    let mut retained: Vec<(usize, usize)> = Vec::with_capacity(count as usize);
    let mut dropped = 0u32;
    for _ in 0..count {
        let entry_start = r.pos;
        let key = match r.item(1)? {
            Value::Text(s) => s,
            _ => return Err(StripError::Cbor(CborError::NonTextKey)),
        };
        r.skip(1)?;
        let entry_end = r.pos;
        if key == "sig" {
            dropped += 1;
        } else {
            retained.push((entry_start, entry_end));
        }
    }
    if r.pos != signed.len() {
        return Err(StripError::Cbor(CborError::TrailingBytes(
            signed.len() - r.pos,
        )));
    }
    if dropped == 0 {
        return Err(StripError::NoSig);
    }
    let new_count = count - u64::from(dropped);
    let mut out = Vec::with_capacity(signed.len());
    out.push(0xa0 | (new_count as u8));
    for (start, end) in retained {
        out.extend_from_slice(&signed[start..end]);
    }
    Ok(out)
}

#[cfg(test)]
pub(crate) mod testenc {
    //! A tiny **test-only** DAG-CBOR encoder, used to build fixtures. The
    //! shipped verifier never encodes (see module docs); tests need to,
    //! so the suite's oracle stays the decoder + live signatures, not this.
    use crate::cid::Cid;

    pub fn uint(out: &mut Vec<u8>, major: u8, v: u64) {
        let m = major << 5;
        match v {
            0..=23 => out.push(m | v as u8),
            24..=255 => {
                out.push(m | 24);
                out.push(v as u8);
            }
            256..=65535 => {
                out.push(m | 25);
                out.extend_from_slice(&(v as u16).to_be_bytes());
            }
            65536..=4294967295 => {
                out.push(m | 26);
                out.extend_from_slice(&(v as u32).to_be_bytes());
            }
            _ => {
                out.push(m | 27);
                out.extend_from_slice(&v.to_be_bytes());
            }
        }
    }

    pub fn text(out: &mut Vec<u8>, s: &str) {
        uint(out, 3, s.len() as u64);
        out.extend_from_slice(s.as_bytes());
    }

    pub fn bytes(out: &mut Vec<u8>, b: &[u8]) {
        uint(out, 2, b.len() as u64);
        out.extend_from_slice(b);
    }

    pub fn null(out: &mut Vec<u8>) {
        out.push(0xf6);
    }

    pub fn link(out: &mut Vec<u8>, cid: &Cid) {
        uint(out, 6, 42);
        let raw = cid.to_bytes();
        uint(out, 2, raw.len() as u64 + 1);
        out.push(0x00);
        out.extend_from_slice(&raw);
    }

    pub fn map_header(out: &mut Vec<u8>, n: u64) {
        uint(out, 5, n);
    }

    pub fn array_header(out: &mut Vec<u8>, n: u64) {
        uint(out, 4, n);
    }
}

#[cfg(test)]
mod tests {
    use super::testenc::*;
    use super::*;
    use crate::cid::{Cid, CODEC_DAG_CBOR};

    fn sample_cid(seed: u8) -> Cid {
        Cid {
            codec: CODEC_DAG_CBOR,
            digest: [seed; 32],
        }
    }

    #[test]
    fn decodes_the_repo_subset() {
        let mut buf = Vec::new();
        map_header(&mut buf, 4);
        text(&mut buf, "a");
        uint(&mut buf, 0, 3);
        text(&mut buf, "b");
        null(&mut buf);
        text(&mut buf, "c");
        link(&mut buf, &sample_cid(7));
        text(&mut buf, "d");
        array_header(&mut buf, 1);
        bytes(&mut buf, b"xy");

        let v = decode(&buf).unwrap();
        assert_eq!(v.get("a").unwrap().as_int(), Some(3));
        assert_eq!(v.get("b"), Some(&Value::Null));
        assert_eq!(v.get("c").unwrap().as_link(), Some(&sample_cid(7)));
        assert_eq!(
            v.get("d"),
            Some(&Value::Array(vec![Value::Bytes(b"xy".to_vec())]))
        );
    }

    #[test]
    fn rejects_indefinite_and_foreign_tags() {
        assert_eq!(decode(&[0x9f, 0xff]), Err(CborError::Indefinite));
        // tag 43
        let mut buf = Vec::new();
        uint(&mut buf, 6, 43);
        uint(&mut buf, 0, 1);
        assert_eq!(decode(&buf), Err(CborError::BadTag(43)));
    }

    #[test]
    fn rejects_duplicate_keys() {
        let mut buf = Vec::new();
        map_header(&mut buf, 2);
        text(&mut buf, "k");
        uint(&mut buf, 0, 1);
        text(&mut buf, "k");
        uint(&mut buf, 0, 2);
        assert_eq!(decode(&buf), Err(CborError::DuplicateKey("k".into())));
    }

    #[test]
    fn strip_sig_removes_exactly_the_sig_entry() {
        // signed = {did, rev, sig, data, prev, version} in some fixed order;
        // unsigned must be the same bytes minus the sig entry, count 5.
        let data_cid = sample_cid(9);
        let mut signed = Vec::new();
        map_header(&mut signed, 6);
        text(&mut signed, "did");
        text(&mut signed, "did:plc:abc");
        text(&mut signed, "rev");
        text(&mut signed, "3k");
        text(&mut signed, "sig");
        bytes(&mut signed, &[0xAA; 64]);
        text(&mut signed, "data");
        link(&mut signed, &data_cid);
        text(&mut signed, "prev");
        null(&mut signed);
        text(&mut signed, "version");
        uint(&mut signed, 0, 3);

        let mut expected = Vec::new();
        map_header(&mut expected, 5);
        text(&mut expected, "did");
        text(&mut expected, "did:plc:abc");
        text(&mut expected, "rev");
        text(&mut expected, "3k");
        text(&mut expected, "data");
        link(&mut expected, &data_cid);
        text(&mut expected, "prev");
        null(&mut expected);
        text(&mut expected, "version");
        uint(&mut expected, 0, 3);

        assert_eq!(strip_sig(&signed).unwrap(), expected);
    }

    #[test]
    fn strip_sig_refuses_when_no_sig() {
        let mut buf = Vec::new();
        map_header(&mut buf, 1);
        text(&mut buf, "did");
        text(&mut buf, "did:plc:abc");
        assert_eq!(strip_sig(&buf), Err(StripError::NoSig));
    }
}
