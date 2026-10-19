//! Digests and the one text form they travel in.
//!
//! Every digest is SHA3-256 over a domain-separated, length-prefixed input,
//! and is written `sha3-256:<base64url>` — the algorithm rides next to the
//! value (bsigner's crypto-agility law), and the estate's hex law keeps 32-byte
//! digests out of hex.

use sha3::{Digest as _, Sha3_256};

/// A SHA3-256 digest.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Digest32(pub [u8; 32]);

pub const ALG: &str = "sha3-256";

impl Digest32 {
    pub const ZERO: Digest32 = Digest32([0u8; 32]);

    /// `sha3-256:<b64u>`.
    pub fn text(&self) -> String {
        format!("{ALG}:{}", b64u(&self.0))
    }

    /// Parse the text form. Any other algorithm id is refused, never defaulted.
    pub fn parse(s: &str) -> Option<Digest32> {
        let rest = s.strip_prefix("sha3-256:")?;
        let bytes = b64u_decode(rest)?;
        let arr: [u8; 32] = bytes.try_into().ok()?;
        Some(Digest32(arr))
    }
}

impl std::fmt::Debug for Digest32 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.text())
    }
}

impl std::fmt::Display for Digest32 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.text())
    }
}

/// SHA3-256 over `domain` and each part, every one length-prefixed, so no two
/// distinct part lists can collide by concatenation.
pub fn hash(domain: &str, parts: &[&[u8]]) -> Digest32 {
    let mut h = Sha3_256::new();
    h.update((domain.len() as u64).to_be_bytes());
    h.update(domain.as_bytes());
    for p in parts {
        h.update((p.len() as u64).to_be_bytes());
        h.update(p);
    }
    Digest32(h.finalize().into())
}

/// Plain SHA3-256, the form bsigner's envelope digest uses.
pub fn sha3_plain(bytes: &[u8]) -> [u8; 32] {
    let mut h = Sha3_256::new();
    h.update(bytes);
    h.finalize().into()
}

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// base64url, no padding (bsigner's b64u).
pub fn b64u(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(ALPHABET[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(n >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[n as usize & 63] as char);
        }
    }
    out
}

/// Strict base64url decode: any character outside the alphabet, or a length
/// no encoder produces, is a refusal.
pub fn b64u_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 4 == 1 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() * 3 / 4 + 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return None,
        } as u32;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    // leftover bits must be zero padding, or two texts decode to one value
    if bits > 0 && acc & ((1 << bits) - 1) != 0 {
        return None;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b64u_roundtrip_and_strictness() {
        for n in 0..70usize {
            let v: Vec<u8> = (0..n as u8).map(|i| i.wrapping_mul(37)).collect();
            assert_eq!(b64u_decode(&b64u(&v)).unwrap(), v, "len {n}");
        }
        assert!(b64u_decode("A").is_none(), "impossible length");
        assert!(b64u_decode("AB=").is_none(), "padding refused");
        assert_eq!(b64u_decode("AQ"), Some(vec![1u8]));
        assert!(b64u_decode("AB").is_none(), "non-zero trailing bits");
    }

    #[test]
    fn domain_and_boundaries_separate() {
        assert_ne!(hash("a", &[b"bc"]), hash("ab", &[b"c"]));
        assert_ne!(hash("d", &[b"ab", b"c"]), hash("d", &[b"a", b"bc"]));
        let d = hash("d", &[b"x"]);
        assert_eq!(Digest32::parse(&d.text()), Some(d));
        assert_eq!(
            Digest32::parse(&d.text().replace("sha3-256", "sha2-256")),
            None
        );
    }
}
