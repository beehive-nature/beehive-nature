//! Canonical DAG-CBOR for the genesis op — the exact subset the identity
//! needs, encoded and decoded under the canonical rules, nothing wider.
//!
//! Why hand-rolled and minimal: the bzDiD is `hash(genesis op)`, so ONE
//! byte of encoding ambiguity is a DIFFERENT IDENTITY. The subset is
//! closed: maps with text keys, arrays, text strings, byte strings, and
//! u64 integers. No tags, no floats, no negative ints, no indefinite
//! lengths — anything else is refused, and a value this crate cannot name
//! never reaches a hash.
//!
//! Canonical rules enforced on BOTH sides (encoder and decoder):
//! - map keys sorted length-first, then bytewise (RFC 7049 §3.9 canonical
//!   order — the IPLD dag-cbor law);
//! - every integer and every length uses its SHORTEST head (a decoder that
//!   accepted `0x18 0x05` for `5` would let two byte strings be "the same
//!   op" — that is a forgery vector, not an encoding nicety);
//! - duplicate map keys refused (last-write-wins is a mutation, not a read).

/// The value subset the genesis op is built from.
#[derive(Debug, Clone)]
pub enum DagValue {
    UInt(u64),
    Bytes(Vec<u8>),
    Text(String),
    Array(Vec<DagValue>),
    /// Entries are held CANONICALLY SORTED by the encoder; the decoder
    /// accepts any order (it is a reader of handed bytes) and refuses
    /// duplicates.
    Map(Vec<(String, DagValue)>),
}

/// Map equality is ORDER-INSENSITIVE — a map is a map, not a list of pairs.
/// An order-sensitive eq would make "the same op" depend on how its holder
/// serialized it, which is exactly the ambiguity the canonical encoder
/// exists to remove.
impl PartialEq for DagValue {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (DagValue::Map(a), DagValue::Map(b)) => {
                a.len() == b.len()
                    && a.iter()
                        .all(|(k, v)| b.iter().any(|(k2, v2)| k == k2 && v == v2))
            }
            (DagValue::UInt(a), DagValue::UInt(b)) => a == b,
            (DagValue::Bytes(a), DagValue::Bytes(b)) => a == b,
            (DagValue::Text(a), DagValue::Text(b)) => a == b,
            (DagValue::Array(a), DagValue::Array(b)) => a == b,
            _ => false,
        }
    }
}

impl Eq for DagValue {}

impl DagValue {
    pub fn text(s: &str) -> DagValue {
        DagValue::Text(s.into())
    }
}

fn head(major: u8, val: u64, out: &mut Vec<u8>) {
    let m = major << 5;
    match val {
        0..=23 => out.push(m | val as u8),
        24..=0xff => {
            out.push(m | 24);
            out.push(val as u8);
        }
        0x100..=0xffff => {
            out.push(m | 25);
            out.extend_from_slice(&(val as u16).to_be_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            out.push(m | 26);
            out.extend_from_slice(&(val as u32).to_be_bytes());
        }
        _ => {
            out.push(m | 27);
            out.extend_from_slice(&val.to_be_bytes());
        }
    }
}

/// Canonical order: length-first, then bytewise — the RFC 7049 canonical
/// map-key rule the IPLD dag-cbor spec carries. UTF-8 bytewise order is
/// code-point order, so no locale can disagree.
fn canon_key_sort(entries: &mut [(String, DagValue)]) {
    entries.sort_by(|a, b| (a.0.len(), a.0.as_bytes()).cmp(&(b.0.len(), b.0.as_bytes())));
}

pub fn encode(v: &DagValue) -> Vec<u8> {
    let mut out = Vec::new();
    encode_into(v, &mut out);
    out
}

fn encode_into(v: &DagValue, out: &mut Vec<u8>) {
    match v {
        DagValue::UInt(n) => head(0, *n, out),
        DagValue::Bytes(b) => {
            head(2, b.len() as u64, out);
            out.extend_from_slice(b);
        }
        DagValue::Text(s) => {
            let b = s.as_bytes();
            head(3, b.len() as u64, out);
            out.extend_from_slice(b);
        }
        DagValue::Array(items) => {
            head(4, items.len() as u64, out);
            for i in items {
                encode_into(i, out);
            }
        }
        DagValue::Map(entries) => {
            let mut sorted = entries.clone();
            canon_key_sort(&mut sorted);
            head(5, sorted.len() as u64, out);
            for (k, val) in &sorted {
                let kb = k.as_bytes();
                head(3, kb.len() as u64, out);
                out.extend_from_slice(kb);
                encode_into(val, out);
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CborError(pub String);

impl std::fmt::Display for CborError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "dag-cbor: {}", self.0)
    }
}

fn err<T>(why: &str) -> Result<T, CborError> {
    Err(CborError(why.into()))
}

struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], CborError> {
        if self.at + n > self.b.len() {
            return err("unexpected end of input");
        }
        let s = &self.b[self.at..self.at + n];
        self.at += n;
        Ok(s)
    }

    /// (major, argument) with the SHORTEST-head law enforced on read:
    /// a non-minimal encoding is refused, not normalized.
    fn head(&mut self) -> Result<(u8, u64), CborError> {
        let byte = self.take(1)?[0];
        let major = byte >> 5;
        let info = byte & 0x1f;
        let arg = match info {
            0..=23 => info as u64,
            24 => {
                let v = self.take(1)?[0] as u64;
                if v < 24 {
                    return err("non-minimal integer head (u8 head for a small value)");
                }
                v
            }
            25 => {
                let v = u16::from_be_bytes(self.take(2)?.try_into().unwrap()) as u64;
                if v <= 0xff {
                    return err("non-minimal integer head (u16 head for a u8 value)");
                }
                v
            }
            26 => {
                let v = u32::from_be_bytes(self.take(4)?.try_into().unwrap()) as u64;
                if v <= 0xffff {
                    return err("non-minimal integer head (u32 head for a u16 value)");
                }
                v
            }
            27 => {
                let v = u64::from_be_bytes(self.take(8)?.try_into().unwrap());
                if v <= 0xffff_ffff {
                    return err("non-minimal integer head (u64 head for a u32 value)");
                }
                v
            }
            28..=30 => return err("reserved additional-info (28..30) — refused"),
            31 => return err("indefinite length — canonical dag-cbor is definite only"),
            // info = byte & 0x1f, so 32..=u8::MAX is unreachable; named for
            // the compiler, which cannot see the mask
            _ => unreachable!("additional-info is masked to 0..=31"),
        };
        Ok((major, arg))
    }

    fn value(&mut self) -> Result<DagValue, CborError> {
        let (major, arg) = self.head()?;
        match major {
            0 => Ok(DagValue::UInt(arg)),
            1 => err("negative integers are outside the genesis-op subset"),
            2 => Ok(DagValue::Bytes(self.take(arg as usize)?.to_vec())),
            3 => {
                let raw = self.take(arg as usize)?;
                let s = std::str::from_utf8(raw)
                    .map_err(|_| CborError("text string is not UTF-8".into()))?;
                Ok(DagValue::Text(s.into()))
            }
            4 => {
                let mut items = Vec::with_capacity(arg.min(1024) as usize);
                for _ in 0..arg {
                    items.push(self.value()?);
                }
                Ok(DagValue::Array(items))
            }
            5 => {
                let mut entries: Vec<(String, DagValue)> =
                    Vec::with_capacity(arg.min(1024) as usize);
                for _ in 0..arg {
                    let (kmajor, karg) = self.head()?;
                    if kmajor != 3 {
                        return err("map key is not a text string — text-only keys");
                    }
                    let kraw = self.take(karg as usize)?;
                    let k = std::str::from_utf8(kraw)
                        .map_err(|_| CborError("map key is not UTF-8".into()))?
                        .to_string();
                    if entries.iter().any(|(ek, _)| *ek == k) {
                        return Err(CborError(format!("duplicate map key {k:?}")));
                    }
                    let v = self.value()?;
                    entries.push((k, v));
                }
                Ok(DagValue::Map(entries))
            }
            6 => err("tags are outside the genesis-op subset"),
            _ => err("simple/float values are outside the genesis-op subset"),
        }
    }
}

/// Decode EXACTLY one value; trailing bytes are refused (an op with a
/// suffix is not an op).
pub fn decode(buf: &[u8]) -> Result<DagValue, CborError> {
    let mut r = Reader { b: buf, at: 0 };
    let v = r.value()?;
    if r.at != buf.len() {
        return err("trailing bytes after the value — refused");
    }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc4648_style_roundtrips() {
        for v in [
            DagValue::UInt(0),
            DagValue::UInt(23),
            DagValue::UInt(24),
            DagValue::UInt(255),
            DagValue::UInt(256),
            DagValue::UInt(0xffff),
            DagValue::UInt(0x1_0000),
            DagValue::text(""),
            DagValue::text("b:genesis"),
            DagValue::Bytes(vec![0xde, 0xad]),
            DagValue::Array(vec![DagValue::text("a"), DagValue::UInt(7)]),
        ] {
            let enc = encode(&v);
            assert_eq!(decode(&enc).unwrap(), v, "roundtrip {v:?}");
        }
    }

    #[test]
    fn map_keys_are_sorted_length_first_then_bytewise() {
        let m = DagValue::Map(vec![
            ("rotationKeys".into(), DagValue::UInt(1)),
            ("type".into(), DagValue::text("b:genesis")),
            ("alsoKnownAs".into(), DagValue::Array(vec![])),
        ]);
        let enc = encode(&m);
        // "type"(4) < "alsoKnownAs"(11) < "rotationKeys"(13) in ENCODED order:
        // find each key text in the bytes and check their positions.
        let t = enc.windows(4).position(|w| w == b"type").unwrap();
        let a = enc.windows(11).position(|w| w == b"alsoKnownAs").unwrap();
        let r = enc.windows(12).position(|w| w == b"rotationKeys").unwrap();
        assert!(
            t < a && a < r,
            "canonical order length-first: {t} < {a} < {r}"
        );
        assert_eq!(
            decode(&enc).unwrap(),
            m,
            "map roundtrip (order-free compare)"
        );
    }

    #[test]
    fn non_minimal_heads_are_refused_not_normalized() {
        // 5 encoded as 0x18 0x05 (u8 head) must refuse; 0x05 must pass.
        assert!(decode(&[0x18, 0x05]).is_err());
        assert_eq!(decode(&[0x05]).unwrap(), DagValue::UInt(5));
        // 0x100 encoded with a u32 head must refuse.
        assert!(decode(&[0x1a, 0, 0, 0x01, 0x00]).is_err());
    }

    #[test]
    fn indefinite_lengths_duplicates_and_trailing_bytes_refused() {
        assert!(decode(&[0x5f]).is_err(), "indefinite map");
        assert!(decode(&[0x7f]).is_err(), "indefinite text");
        // hand-built map(2) { "k": 1, "k": 2 } — the duplicate the encoder
        // would never write, refused by the decoder that reads handed bytes
        let hand = [
            0xa2u8, // map, 2 entries
            0x61, b'k', 0x01, // "k": 1
            0x61, b'k', 0x02, // "k": 2  ← duplicate
        ];
        assert!(decode(&hand).is_err(), "duplicate key refused");
        let ok = [0xa1u8, 0x61, b'k', 0x01];
        assert!(decode(&ok).is_ok());
        let trailing = [ok.as_slice(), &[0xff][..]].concat();
        assert!(decode(&trailing).is_err(), "trailing byte refused");
    }
}
