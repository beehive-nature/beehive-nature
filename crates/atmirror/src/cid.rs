//! CIDs, exactly as AT Protocol constrains them: CIDv1, sha2-256 multihash
//! (0x12, 32 bytes), codec `dag-cbor` (0x71) for repo blocks or `raw` (0x55)
//! for blobs. Anything else is refused — a verifier that accepts what the
//! spec forbids is wider than the thing it verifies.
//!
//! String form is multibase base32-lower (`b…`), the only form atproto
//! emits. Multibase base58btc (`z…`) decoding is also provided because DID
//! documents carry signing keys in that base.

use crate::varint;

pub const CODEC_DAG_CBOR: u64 = 0x71;
pub const CODEC_RAW: u64 = 0x55;
pub const MH_SHA2_256: u64 = 0x12;

/// A parsed CIDv1 with a sha2-256 multihash — the only shape atproto allows.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Cid {
    pub codec: u64,
    pub digest: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CidError {
    Truncated,
    /// CIDv0 or any version other than 1.
    BadVersion(u64),
    /// A codec outside {dag-cbor, raw}.
    BadCodec(u64),
    /// A multihash other than sha2-256/32.
    BadMultihash {
        code: u64,
        size: u64,
    },
    BadMultibase(char),
    BadBaseChar(char),
}

impl std::fmt::Display for CidError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CidError::Truncated => write!(f, "cid truncated"),
            CidError::BadVersion(v) => write!(f, "cid version {v} (only CIDv1 allowed)"),
            CidError::BadCodec(c) => write!(f, "cid codec {c:#x} (only dag-cbor 0x71 / raw 0x55)"),
            CidError::BadMultihash { code, size } => {
                write!(f, "multihash {code:#x}/{size} (only sha2-256/32)")
            }
            CidError::BadMultibase(c) => write!(f, "multibase prefix {c:?} unsupported"),
            CidError::BadBaseChar(c) => write!(f, "invalid character {c:?} in base encoding"),
        }
    }
}

impl std::error::Error for CidError {}

impl Cid {
    /// Parse a binary CID starting at `*pos`, advancing `*pos` past it.
    pub fn read(buf: &[u8], pos: &mut usize) -> Result<Cid, CidError> {
        let version = varint::read(buf, pos).map_err(|_| CidError::Truncated)?;
        if version != 1 {
            return Err(CidError::BadVersion(version));
        }
        let codec = varint::read(buf, pos).map_err(|_| CidError::Truncated)?;
        if codec != CODEC_DAG_CBOR && codec != CODEC_RAW {
            return Err(CidError::BadCodec(codec));
        }
        let mh_code = varint::read(buf, pos).map_err(|_| CidError::Truncated)?;
        let mh_size = varint::read(buf, pos).map_err(|_| CidError::Truncated)?;
        if mh_code != MH_SHA2_256 || mh_size != 32 {
            return Err(CidError::BadMultihash {
                code: mh_code,
                size: mh_size,
            });
        }
        let end = pos.checked_add(32).ok_or(CidError::Truncated)?;
        if end > buf.len() {
            return Err(CidError::Truncated);
        }
        let mut digest = [0u8; 32];
        digest.copy_from_slice(&buf[*pos..end]);
        *pos = end;
        Ok(Cid { codec, digest })
    }

    /// Parse a binary CID that must occupy the whole buffer.
    pub fn from_bytes(buf: &[u8]) -> Result<Cid, CidError> {
        let mut pos = 0;
        let cid = Cid::read(buf, &mut pos)?;
        if pos != buf.len() {
            return Err(CidError::Truncated);
        }
        Ok(cid)
    }

    /// Binary form: 0x01, codec, 0x12, 0x20, digest.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(36);
        out.push(0x01);
        write_varint(&mut out, self.codec);
        out.push(0x12);
        out.push(0x20);
        out.extend_from_slice(&self.digest);
        out
    }

    /// Canonical string form: multibase base32-lower, `b…`.
    pub fn to_string_b32(&self) -> String {
        let mut s = String::with_capacity(60);
        s.push('b');
        base32_lower_encode(&self.to_bytes(), &mut s);
        s
    }

    /// Parse the string form. Only base32-lower (`b…`) is accepted — the
    /// only base atproto emits for CIDs.
    pub fn parse_str(s: &str) -> Result<Cid, CidError> {
        let mut chars = s.chars();
        match chars.next() {
            Some('b') => {}
            Some(other) => return Err(CidError::BadMultibase(other)),
            None => return Err(CidError::Truncated),
        }
        let bytes = base32_lower_decode(chars.as_str())?;
        Cid::from_bytes(&bytes)
    }
}

impl std::fmt::Display for Cid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_string_b32())
    }
}

fn write_varint(out: &mut Vec<u8>, mut v: u64) {
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
}

const B32_ALPHABET: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";

fn base32_lower_encode(data: &[u8], out: &mut String) {
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for &byte in data {
        acc = (acc << 8) | u32::from(byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(B32_ALPHABET[((acc >> bits) & 0x1f) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(B32_ALPHABET[((acc << (5 - bits)) & 0x1f) as usize] as char);
    }
}

fn base32_lower_decode(s: &str) -> Result<Vec<u8>, CidError> {
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut out = Vec::with_capacity(s.len() * 5 / 8 + 1);
    for c in s.chars() {
        let v = match c {
            'a'..='z' => c as u32 - 'a' as u32,
            '2'..='7' => c as u32 - '2' as u32 + 26,
            other => return Err(CidError::BadBaseChar(other)),
        };
        acc = (acc << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push(((acc >> bits) & 0xff) as u8);
        }
    }
    // Trailing bits must be zero padding only.
    if bits > 0 && (acc & ((1 << bits) - 1)) != 0 {
        return Err(CidError::Truncated);
    }
    Ok(out)
}

const B58_ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Decode base58btc (no multibase prefix). Used for DID-document
/// `publicKeyMultibase` values after stripping their leading `z`.
pub fn base58btc_decode(s: &str) -> Result<Vec<u8>, CidError> {
    let mut digits: Vec<u8> = Vec::with_capacity(s.len());
    let mut leading_zeros = 0usize;
    let mut seen_nonzero = false;
    for c in s.chars() {
        let idx = B58_ALPHABET
            .iter()
            .position(|&a| a as char == c)
            .ok_or(CidError::BadBaseChar(c))? as u32;
        if idx == 0 && !seen_nonzero {
            leading_zeros += 1;
            continue;
        }
        seen_nonzero = true;
        // digits = digits * 58 + idx, big-endian byte arithmetic.
        let mut carry = idx;
        for d in digits.iter_mut().rev() {
            let v = (*d as u32) * 58 + carry;
            *d = (v & 0xff) as u8;
            carry = v >> 8;
        }
        while carry > 0 {
            digits.insert(0, (carry & 0xff) as u8);
            carry >>= 8;
        }
    }
    let mut out = vec![0u8; leading_zeros];
    out.extend_from_slice(&digits);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    #[test]
    fn binary_and_string_round_trip() {
        let digest: [u8; 32] = Sha256::digest(b"atmirror test block").into();
        let cid = Cid {
            codec: CODEC_DAG_CBOR,
            digest,
        };
        let s = cid.to_string_b32();
        assert!(s.starts_with('b'));
        assert_eq!(Cid::parse_str(&s).unwrap(), cid);
        assert_eq!(Cid::from_bytes(&cid.to_bytes()).unwrap(), cid);
    }

    #[test]
    fn known_vector_matches_ipld() {
        // CIDv1 dag-cbor sha2-256 over the empty dag-cbor map {} (0xa0).
        // Independently checkable with any IPLD tool:
        //   bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua
        let digest: [u8; 32] = Sha256::digest([0xa0u8]).into();
        let cid = Cid {
            codec: CODEC_DAG_CBOR,
            digest,
        };
        assert_eq!(
            cid.to_string_b32(),
            "bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua"
        );
    }

    #[test]
    fn rejects_cidv0_and_foreign_codecs() {
        // Version 0 encodings and non-atproto codecs must not pass.
        assert!(matches!(
            Cid::parse_str("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
            Err(CidError::BadMultibase('Q'))
        ));
        let mut bytes = Cid {
            codec: CODEC_DAG_CBOR,
            digest: [0u8; 32],
        }
        .to_bytes();
        bytes[1] = 0x70; // dag-pb
        assert!(matches!(
            Cid::from_bytes(&bytes),
            Err(CidError::BadCodec(0x70))
        ));
    }

    #[test]
    fn base58_decodes_known_vector() {
        // "StV1DL6CwTryKyV" is base58 of "hello world" (classic vector).
        assert_eq!(
            base58btc_decode("StV1DL6CwTryKyV").unwrap(),
            b"hello world".to_vec()
        );
        // Leading '1's are leading zero bytes.
        assert_eq!(base58btc_decode("11").unwrap(), vec![0u8, 0u8]);
    }
}
