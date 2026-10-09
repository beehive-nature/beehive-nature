//! Content identities. Every digest is written the way
//! `crates/btungsten-pq/kat-manifest.json` writes them, `sha256:` + base64url
//! without padding, so no receipt carries a 64-character hex run.

use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

pub fn b64url(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = chunk.iter().fold(0u32, |a, &b| (a << 8) | b as u32) << (8 * (3 - chunk.len()));
        for i in 0..=chunk.len() {
            s.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    s
}

pub fn sha256_tag(bytes: &[u8]) -> String {
    format!("sha256:{}", b64url(&Sha256::digest(bytes)))
}

/// A file's digest and length, streamed (binaries and logs can be large).
pub fn file_tag(path: &Path) -> std::io::Result<(String, u64)> {
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut len = 0u64;
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
        len += n as u64;
    }
    Ok((format!("sha256:{}", b64url(&h.finalize())), len))
}

/// One digest over a set of files: each relative path and its file digest,
/// in sorted path order. Used for a directory of sources whose individual
/// digests are also recorded.
pub fn tree_tag(entries: &[(String, String)]) -> String {
    let mut sorted: Vec<&(String, String)> = entries.iter().collect();
    sorted.sort();
    let mut h = Sha256::new();
    for (path, tag) in sorted {
        h.update(path.as_bytes());
        h.update([0]);
        h.update(tag.as_bytes());
        h.update([b'\n']);
    }
    format!("sha256:{}", b64url(&h.finalize()))
}

/// An upstream SHA-256 published in hex (a release asset, a CI artifact, an
/// image) in this crate's tag form, so receipts never carry the hex run.
pub fn hex_to_tag(hex: &str) -> String {
    let bytes: Vec<u8> = (0..hex.len() / 2)
        .filter_map(|i| u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).ok())
        .collect();
    format!("sha256:{}", b64url(&bytes))
}

/// Lower-case hex for short identifiers (session ids); never used for
/// digests, which use `sha256_tag`.
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Fresh bytes from the operating system's random source.
pub fn os_random(n: usize) -> std::io::Result<Vec<u8>> {
    let mut out = vec![0u8; n];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut out)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digest_tag_matches_the_pq_manifest_form() {
        // RFC 4648 §10 base64 vectors, URL alphabet, no padding.
        assert_eq!(b64url(b""), "");
        assert_eq!(b64url(b"f"), "Zg");
        assert_eq!(b64url(b"fo"), "Zm8");
        assert_eq!(b64url(b"foo"), "Zm9v");
        assert_eq!(b64url(b"foobar"), "Zm9vYmFy");
        assert_eq!(b64url(&[0xfb, 0xff]), "-_8");
        // SHA-256("abc"), FIPS 180-2 B.1, in the tag form.
        assert_eq!(
            sha256_tag(b"abc"),
            "sha256:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
        );
    }

    #[test]
    fn tree_tag_is_order_independent_and_content_bound() {
        let a = vec![
            ("a".to_string(), "x".to_string()),
            ("b".to_string(), "y".to_string()),
        ];
        let b = vec![
            ("b".to_string(), "y".to_string()),
            ("a".to_string(), "x".to_string()),
        ];
        assert_eq!(tree_tag(&a), tree_tag(&b));
        let c = vec![
            ("a".to_string(), "x".to_string()),
            ("b".to_string(), "z".to_string()),
        ];
        assert_ne!(tree_tag(&a), tree_tag(&c));
    }
}
