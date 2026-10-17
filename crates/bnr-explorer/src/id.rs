//! Content identity. Every hash carries its algorithm (the crypto-agility law
//! in `crates/README.md`): an object id is `(alg, digest)`, never a bare
//! digest, and an algorithm this kernel does not know is refused by name at
//! the wire rather than guessed.
//!
//! Only SHA-256 is admitted because only SHA-256 is what the estate's storage
//! records carry today (`atmirror` `MediaPointer.sha256`, `bnr-archive`
//! `BatchMember.sha256`, My Space's device index). Adding an algorithm is a
//! new variant plus its wire byte, never a reinterpretation of an old one.

use sha2::{Digest, Sha256};

/// A content-hash algorithm with a fixed wire byte.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum HashAlg {
    Sha256,
}

impl HashAlg {
    pub const fn wire(self) -> u8 {
        match self {
            HashAlg::Sha256 => 1,
        }
    }

    pub const fn from_wire(b: u8) -> Option<HashAlg> {
        match b {
            1 => Some(HashAlg::Sha256),
            _ => None,
        }
    }
}

/// A content address: what the bytes must hash to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct ObjectId {
    alg: HashAlg,
    digest: [u8; 32],
}

impl ObjectId {
    pub const fn new(alg: HashAlg, digest: [u8; 32]) -> ObjectId {
        ObjectId { alg, digest }
    }

    /// The id `bytes` actually have under `alg`.
    pub fn of(alg: HashAlg, bytes: &[u8]) -> ObjectId {
        let digest = match alg {
            HashAlg::Sha256 => Sha256::digest(bytes).into(),
        };
        ObjectId { alg, digest }
    }

    pub const fn alg(&self) -> HashAlg {
        self.alg
    }

    pub const fn digest(&self) -> &[u8; 32] {
        &self.digest
    }

    /// True when `bytes` hash to this id. The rail's word is never the check;
    /// this is.
    pub fn matches(&self, bytes: &[u8]) -> bool {
        ObjectId::of(self.alg, bytes) == *self
    }

    /// Parse 64 hex digits (either case) as a digest under `alg`. Anything
    /// else — wrong length, a `0x` prefix, a non-hex byte — is `None`.
    pub fn from_hex(alg: HashAlg, s: &str) -> Option<ObjectId> {
        let b = s.as_bytes();
        if b.len() != 64 {
            return None;
        }
        let mut digest = [0u8; 32];
        for (i, pair) in b.as_chunks::<2>().0.iter().enumerate() {
            digest[i] = (nibble(pair[0])? << 4) | nibble(pair[1])?;
        }
        Some(ObjectId { alg, digest })
    }
}

fn nibble(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // FIPS 180-2 appendix B.1, the one-block message "abc".
    const ABC: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // PUBLIC-CONSTANT FIPS 180-2 B.1

    #[test]
    fn the_published_vector_is_what_of_computes() {
        let want = ObjectId::from_hex(HashAlg::Sha256, ABC).unwrap();
        assert_eq!(ObjectId::of(HashAlg::Sha256, b"abc"), want);
        assert!(want.matches(b"abc"));
        assert!(!want.matches(b"abd"));
    }

    #[test]
    fn hex_parsing_refuses_every_near_miss() {
        assert!(ObjectId::from_hex(HashAlg::Sha256, &ABC.to_uppercase()).is_some());
        assert!(ObjectId::from_hex(HashAlg::Sha256, &ABC[..63]).is_none());
        let mut prefixed = std::string::String::from("0x");
        prefixed.push_str(&ABC[2..]);
        assert!(ObjectId::from_hex(HashAlg::Sha256, &prefixed).is_none());
        let mut bad = std::string::String::from(ABC);
        bad.replace_range(10..11, "g");
        assert!(ObjectId::from_hex(HashAlg::Sha256, &bad).is_none());
    }

    #[test]
    fn an_unknown_algorithm_byte_has_no_meaning() {
        assert_eq!(
            HashAlg::from_wire(HashAlg::Sha256.wire()),
            Some(HashAlg::Sha256)
        );
        for b in [0u8, 2, 0x12, 255] {
            assert_eq!(HashAlg::from_wire(b), None);
        }
    }
}
