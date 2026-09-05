//! base64url, no padding + digest helper. (Same law as banchor's b64.rs —
//! digests are committed as `alg:b64u`, never bare hex: beehive pre-commit
//! hex law blocks 48+ hex runs, and 32-byte digests are 64 hex chars.)

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

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

/// Decode base64url no-padding (the x402 gate reads pinned public keys this
/// way). Returns None on any character outside the alphabet — malformed
/// input is a refusal, never a guess.
pub fn b64u_decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4 + 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for c in s.chars() {
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '-' => 62,
            '_' => 63,
            _ => return None,
        };
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    Some(out)
}

pub fn sha3_256_b64u(bytes: &[u8]) -> String {
    use sha3::{Digest, Sha3_256};
    let mut h = Sha3_256::new();
    h.update(bytes);
    b64u(&h.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_vectors() {
        assert_eq!(b64u(b""), "");
        assert_eq!(b64u(b"f"), "Zg");
        assert_eq!(b64u(b"fo"), "Zm8");
        assert_eq!(b64u(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn digest_stable() {
        assert_eq!(sha3_256_b64u(b"bheart"), sha3_256_b64u(b"bheart"));
        assert_eq!(sha3_256_b64u(b"bheart").len(), 43);
    }
}
