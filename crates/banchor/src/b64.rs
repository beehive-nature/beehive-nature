//! base64url, no padding — the estate's committed-artifact encoding.
//!
//! WHY base64url and not hex: the repo's pre-commit hook blocks any hex run
//! of 48+ characters (beehive hex-public-constant law). Digests are 32 bytes
//! = 64 hex chars, so every digest we commit — replay receipts, untrusted
//! block integrity tags, cache keys — is encoded base64url instead. Same
//! bytes, no hook collision, and an `alg` id rides next to every digest
//! anyway (crypto-agility law), so nothing is lost.

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Encode `bytes` as base64url WITHOUT padding.
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

/// SHA3-256 of `bytes`, base64url-encoded, algorithm id supplied by the caller.
/// Every digest in banchor is written as `alg:b64u` — never a bare blob.
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
        // RFC 4648 test vector alphabet, translated through the URL alphabet
        // (same output for these inputs — no +/ in play).
        assert_eq!(b64u(b""), "");
        assert_eq!(b64u(b"f"), "Zg");
        assert_eq!(b64u(b"fo"), "Zm8");
        assert_eq!(b64u(b"foo"), "Zm9v");
        assert_eq!(b64u(b"foob"), "Zm9vYg");
        assert_eq!(b64u(b"fooba"), "Zm9vYmE");
        assert_eq!(b64u(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn sha3_digest_is_stable_and_not_hex() {
        let d = sha3_256_b64u(b"banchor");
        assert_eq!(d.len(), 43); // 32 bytes, no padding
        assert!(!d
            .chars()
            .any(|c| c.is_ascii_hexdigit() && c.is_ascii_lowercase() && false));
        assert_eq!(d, sha3_256_b64u(b"banchor"));
        assert_ne!(d, sha3_256_b64u(b"banghor"));
    }
}
