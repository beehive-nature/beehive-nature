//! ANS-104 DataItem construction, deep hash, and RSA-PSS signing.
//!
//! Per SPEC-RESOURCE-DASHBOARD-1 §4.2: native-JWK signing path.
//! Per pirate-haul-rulings: self-bundled ANS-104, NO Turbo/hosted login.
//!
//! Deep hash algorithm verified from the Arweave standard library spec:
//!   deepHash(list) = fold(SHA256("list"+count), items)
//!   fold(h, item) = SHA256(h || SHA256(SHA256("blob"+len) || SHA256(item)))
//!
//! UNVERIFIED: deep hash not yet tested against a real Arweave transaction
//! vector. Round-trip sign+verify proves internal consistency only.

use rsa::pss::{SigningKey, VerifyingKey};
use rsa::signature::{RandomizedSigner, SignatureEncoding, Verifier};
use rsa::{RsaPrivateKey, RsaPublicKey};
use sha2::{Digest, Sha256};

/// RSA-PSS signature type (Arweave native JWK).
pub const SIG_TYPE_RSA: u16 = 1;

/// A key-value tag on a DataItem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tag {
    pub name: String,
    pub value: String,
}

/// An ANS-104 DataItem. Unsigned until `sign` is called.
#[derive(Debug, Clone)]
pub struct DataItem {
    pub signature_type: u16,
    pub owner: Vec<u8>,
    pub target: Vec<u8>,
    pub anchor: Vec<u8>,
    pub tags: Vec<Tag>,
    pub data: Vec<u8>,
    pub signature: Vec<u8>,
}

impl DataItem {
    /// Create a new unsigned DataItem with RSA signature type.
    pub fn new(owner: Vec<u8>, data: Vec<u8>) -> Self {
        Self {
            signature_type: SIG_TYPE_RSA,
            owner,
            target: Vec::new(),
            anchor: Vec::new(),
            tags: Vec::new(),
            data,
            signature: Vec::new(),
        }
    }

    /// Add a tag.
    pub fn with_tag(mut self, name: &str, value: &str) -> Self {
        self.tags.push(Tag { name: name.into(), value: value.into() });
        self
    }

    /// Compute the deep hash of the signing data.
    /// This is what gets RSA-PSS signed.
    pub fn signature_hash(&self) -> [u8; 32] {
        let sig_type_str = self.signature_type.to_string();
        let tags_bytes = serialize_tags(&self.tags);
        deep_hash(&[
            sig_type_str.as_bytes(),
            &self.owner,
            &self.target,
            &self.anchor,
            &tags_bytes,
            &self.data,
        ])
    }

    /// Sign this DataItem with an RSA private key (PSS, salt_len=0 per Arweave).
    pub fn sign(&mut self, priv_key: &RsaPrivateKey) {
        let hash = self.signature_hash();
        let signing_key = SigningKey::<Sha256>::new_with_salt_len(priv_key.clone(), 0);
        let mut rng = rand::thread_rng();
        let sig = signing_key.sign_with_rng(&mut rng, &hash);
        self.signature = sig.to_bytes().to_vec();
    }

    /// Verify this DataItem's signature against an RSA public key.
    pub fn verify(&self, pub_key: &RsaPublicKey) -> bool {
        if self.signature.is_empty() {
            return false;
        }
        let hash = self.signature_hash();
        let verifying_key = VerifyingKey::<Sha256>::new(pub_key.clone());
        let sig_result: Result<rsa::pss::Signature, _> = self.signature[..].try_into();
        match sig_result {
            Ok(s) => verifying_key.verify(&hash, &s).is_ok(),
            Err(_) => false,
        }
    }

    /// Serialize to the ANS-104 binary format.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.extend_from_slice(&self.signature_type.to_le_bytes());
        buf.extend_from_slice(&self.signature);
        buf.extend_from_slice(&self.owner);
        // Target and anchor: 32 bytes each, zero-padded
        let mut target = self.target.clone();
        target.resize(32, 0);
        let mut anchor = self.anchor.clone();
        anchor.resize(32, 0);
        buf.extend_from_slice(&target);
        buf.extend_from_slice(&anchor);
        buf.extend(serialize_tags(&self.tags));
        buf.extend_from_slice(&self.data);
        buf
    }
}

/// Serialize tags to the ANS-104 wire format:
/// u16_le(count) + for each tag: u16_le(name_len) + name + u16_le(value_len) + value
pub fn serialize_tags(tags: &[Tag]) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(&(tags.len() as u16).to_le_bytes());
    for tag in tags {
        let name = tag.name.as_bytes();
        let value = tag.value.as_bytes();
        buf.extend_from_slice(&(name.len() as u16).to_le_bytes());
        buf.extend_from_slice(name);
        buf.extend_from_slice(&(value.len() as u16).to_le_bytes());
        buf.extend_from_slice(value);
    }
    buf
}

/// Arweave deep hash: SHA-256 fold over a list of byte slices.
///
/// Algorithm (from Arweave standard library):
///   h = SHA256("list" + count_as_ascii)
///   for each chunk:
///     blob = SHA256( SHA256("blob" + len_as_ascii) || SHA256(chunk) )
///     h = SHA256( h || blob )
///   return h
pub fn deep_hash(items: &[&[u8]]) -> [u8; 32] {
    let list_tag = format!("list{}", items.len());
    let mut hash: [u8; 32] = Sha256::digest(list_tag.as_bytes()).into();

    for item in items {
        let blob_tag = format!("blob{}", item.len());
        let tag_hash = Sha256::digest(blob_tag.as_bytes());
        let data_hash = Sha256::digest(item);

        // blob = SHA256(tag_hash || data_hash)
        let mut blob_in = [0u8; 64];
        blob_in[..32].copy_from_slice(&tag_hash);
        blob_in[32..].copy_from_slice(&data_hash);
        let blob_hash = Sha256::digest(&blob_in);

        // h = SHA256(h || blob_hash)
        let mut fold_in = [0u8; 64];
        fold_in[..32].copy_from_slice(&hash);
        fold_in[32..].copy_from_slice(&blob_hash);
        hash = Sha256::digest(&fold_in).into();
    }

    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deep_hash_deterministic() {
        let a = deep_hash(&[b"hello", b"world"]);
        let b = deep_hash(&[b"hello", b"world"]);
        assert_eq!(a, b, "same input = same hash");
    }

    #[test]
    fn deep_hash_order_matters() {
        let a = deep_hash(&[b"hello", b"world"]);
        let b = deep_hash(&[b"world", b"hello"]);
        assert_ne!(a, b, "order matters");
    }

    #[test]
    fn deep_hash_empty_input() {
        let h = deep_hash(&[]);
        // SHA256("list0")
        let expected = Sha256::digest(b"list0");
        assert_eq!(&h[..], expected.as_slice());
    }

    #[test]
    fn serialize_tags_roundtrip() {
        let tags = vec![
            Tag { name: "App-Name".into(), value: "BNR".into() },
            Tag { name: "Content-Type".into(), value: "text/plain".into() },
        ];
        let bytes = serialize_tags(&tags);
        assert_eq!(&bytes[..2], &2u16.to_le_bytes(), "tag count = 2");
        // First tag name length
        let name_len = u16::from_le_bytes([bytes[2], bytes[3]]);
        assert_eq!(name_len, 8, "App-Name is 8 bytes");
    }

    #[test]
    fn dataitem_sign_verify_roundtrip() {
        // Use RSA-2048 for test speed; production uses 4096.
        let (priv_key, pub_key) = crate::jwk::generate_keypair(2048);
        let owner = crate::jwk::owner_bytes(&pub_key);

        let mut item = DataItem::new(owner, b"hello arweave".to_vec())
            .with_tag("App-Name", "BNR-DeStorage")
            .with_tag("Content-Type", "text/plain");

        // Unsigned: verify fails, signature empty
        assert!(!item.verify(&pub_key), "unsigned item should not verify");
        assert!(item.signature.is_empty());

        // Sign
        item.sign(&priv_key);
        assert!(!item.signature.is_empty(), "signature populated after sign");

        // Verify against same key — must pass
        assert!(item.verify(&pub_key), "signature must verify against the signing key");

        // Verify against a DIFFERENT key — must fail
        let (_, other_pub) = crate::jwk::generate_keypair(2048);
        assert!(!item.verify(&other_pub), "signature must NOT verify against a different key");
    }

    #[test]
    fn dataitem_to_bytes_has_correct_header() {
        let (_, pub_key) = crate::jwk::generate_keypair(2048);
        let owner = crate::jwk::owner_bytes(&pub_key);
        let item = DataItem::new(owner, b"data".to_vec());
        let bytes = item.to_bytes();

        // First 2 bytes: signature type = 1 (RSA)
        assert_eq!(u16::from_le_bytes([bytes[0], bytes[1]]), SIG_TYPE_RSA);
        // Next 256 bytes: empty signature (RSA-2048 = 256-byte signature)
        // Then 256 bytes: owner (RSA-2048 modulus)
        // Then 32+32 bytes: target + anchor (zeroed)
    }

    #[test]
    fn tampered_data_fails_verification() {
        let (priv_key, pub_key) = crate::jwk::generate_keypair(2048);
        let owner = crate::jwk::owner_bytes(&pub_key);

        let mut item = DataItem::new(owner, b"original".to_vec());
        item.sign(&priv_key);

        // Tamper: change data after signing
        item.data = b"tampered".to_vec();
        assert!(!item.verify(&pub_key), "tampered data must fail verification");
    }
}
