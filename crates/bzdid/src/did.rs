//! The did:b: string — 256 bits of sha256 digest in lowercase RFC 4648
//! base32, no padding: 52 chars. The full 256 bits are the architecture's
//! own correction (128-bit truncation admits a Bitcoin-class adversarial
//! birthday collision — docs/bzdid-architecture-decision.md §1).

use sha2::{Digest, Sha256};

/// RFC 4648 base32, LOWERCASE, no padding — the v1 canon. Uppercase is a
/// different string and a different identity; '=' padding is refused.
pub const B32_ALPHABET: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";

pub const DID_PREFIX: &str = "did:b:";
/// sha256 → 32 bytes → ceil(256/5) = 52 base32 chars, unpadded.
pub const DID_BODY_LEN: usize = 52;

pub fn encode_base32(bytes: &[u8]) -> String {
    let mut out = String::new();
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for b in bytes {
        acc = (acc << 8) | *b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(B32_ALPHABET[((acc >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(B32_ALPHABET[((acc << (5 - bits)) & 31) as usize] as char);
    }
    out
}

pub fn decode_base32(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for c in s.chars() {
        let v = B32_ALPHABET.iter().position(|a| *a as char == c)? as u32;
        acc = (acc << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    // trailing bits must be zero (canonical encoding) and fewer than 8
    if bits > 0 && (acc & ((1 << bits) - 1)) != 0 {
        return None;
    }
    Some(out)
}

/// A validated did:b: identity string.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BzDid(String);

impl BzDid {
    /// Validate a handed did string. Fail closed on: wrong method, wrong
    /// length, non-alphabet characters (uppercase included), padding, or a
    /// body that does not decode to 32 bytes.
    pub fn parse(s: &str) -> Result<BzDid, String> {
        let body = s
            .strip_prefix(DID_PREFIX)
            .ok_or_else(|| format!("not a {DID_PREFIX} did"))?;
        if body.len() != DID_BODY_LEN {
            return Err(format!(
                "did body must be {DID_BODY_LEN} chars, got {}",
                body.len()
            ));
        }
        if !body.bytes().all(|b| B32_ALPHABET.contains(&b)) {
            return Err("did body carries characters outside the lowercase base32 alphabet".into());
        }
        if decode_base32(body).map(|v| v.len()) != Some(32) {
            return Err("did body does not decode to 32 bytes".into());
        }
        Ok(BzDid(s.to_string()))
    }

    /// Derive the identity of EXACTLY these bytes — the self-certifying
    /// root: no issuer, no registry, no ordering. Whoever holds the op
    /// holds the identity; whoever is handed the op can verify it.
    pub fn derive(op_bytes: &[u8]) -> BzDid {
        let d = Sha256::digest(op_bytes);
        BzDid(format!("{DID_PREFIX}{}", encode_base32(&d)))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The 32 digest bytes the string carries.
    pub fn to_bytes(&self) -> [u8; 32] {
        let body = &self.0[DID_PREFIX.len()..];
        let v = decode_base32(body).expect("validated at parse/derive");
        let mut out = [0u8; 32];
        out.copy_from_slice(&v);
        out
    }
}

impl std::fmt::Display for BzDid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc4648_section10_vectors() {
        // the RFC's own test vectors (lowercase alphabet, padding stripped —
        // data chars only: ceil(bits/5))
        for (raw, b32) in [
            (b"" as &[u8], ""),
            (b"f", "my"),
            (b"fo", "mzxq"),
            (b"foo", "mzxw6"),
            (b"foob", "mzxw6yq"),
            (b"fooba", "mzxw6ytb"),
            (b"foobar", "mzxw6ytboi"),
        ] {
            assert_eq!(encode_base32(raw), b32, "encode {raw:?}");
            assert_eq!(decode_base32(b32).unwrap(), raw, "decode {b32}");
        }
    }

    #[test]
    fn a_digest_is_52_chars_and_round_trips_through_the_did_body() {
        let did = BzDid::derive(b"the estate's identity root, first light");
        assert_eq!(did.as_str().len(), DID_PREFIX.len() + 52);
        let body = &did.as_str()[DID_PREFIX.len()..];
        let back = decode_base32(body).unwrap();
        let expect = Sha256::digest(b"the estate's identity root, first light");
        assert_eq!(back.as_slice(), expect.as_slice());
    }

    #[test]
    fn parse_refuses_everything_but_the_canon_shape() {
        let good = BzDid::derive(b"x");
        assert!(BzDid::parse(good.as_str()).is_ok());
        assert!(BzDid::parse("did:key:z6Mk").is_err(), "another method");
        assert!(BzDid::parse("did:b:abc").is_err(), "too short");
        // uppercase is a different string, not the same identity
        let upper = format!("did:b:{}", good.as_str()[6..].to_uppercase());
        assert!(BzDid::parse(&upper).is_err(), "uppercase refused");
        let padded = format!("{},,", good.as_str());
        assert!(BzDid::parse(&padded).is_err(), "padding refused");
        // one mutated char still parses as a SHAPE (it is someone else's
        // 256-bit space) — mismatch is the VERIFIER's job, not the parser's
        let chars: Vec<char> = good.as_str().chars().collect();
        let mut mutated = chars.clone();
        mutated[DID_PREFIX.len() + 3] = if mutated[DID_PREFIX.len() + 3] == 'a' {
            'b'
        } else {
            'a'
        };
        assert!(BzDid::parse(&mutated.into_iter().collect::<String>()).is_ok());
    }
}
