//! The signed repo commit — parse, and verify its signature against the
//! account's signing key. K-4 step 1, done on real bytes.
//!
//! atproto commits are dag-cbor maps `{did, version: 3, data, rev, prev,
//! sig}`; the signature is a 64-byte compact ECDSA signature (r ‖ s) over
//! `sha256(dag-cbor(commit minus sig))`, on secp256k1 (ES256K) or NIST
//! P-256 (ES256). Low-S is mandatory: a high-S signature is **rejected**,
//! per the atproto cryptography spec's malleability rule.

use k256::ecdsa::signature::DigestVerifier;
use sha2::{Digest, Sha256};

use crate::cbor::{self, Value};
use crate::cid::{Cid, CidError};

/// An account signing key, as published in the DID document
/// (`publicKeyMultibase`, multicodec-prefixed compressed point).
#[derive(Debug, Clone)]
pub enum SigningKey {
    Secp256k1(k256::ecdsa::VerifyingKey),
    P256(p256::ecdsa::VerifyingKey),
}

impl SigningKey {
    /// Parse a `z…` multibase multicodec key: base58btc, then a varint
    /// multicodec prefix — `0xe7` (secp256k1-pub, bytes `e7 01`) or
    /// `0x1200` (p256-pub, bytes `80 24`) — then the 33-byte compressed
    /// SEC1 point.
    pub fn from_multibase(s: &str) -> Result<SigningKey, KeyError> {
        let rest = s.strip_prefix('z').ok_or(KeyError::NotBase58Multibase)?;
        let bytes = crate::cid::base58btc_decode(rest).map_err(KeyError::Base58)?;
        match bytes.as_slice() {
            [0xe7, 0x01, point @ ..] if point.len() == 33 => {
                k256::ecdsa::VerifyingKey::from_sec1_bytes(point)
                    .map(SigningKey::Secp256k1)
                    .map_err(|_| KeyError::BadPoint("secp256k1"))
            }
            [0x80, 0x24, point @ ..] if point.len() == 33 => {
                p256::ecdsa::VerifyingKey::from_sec1_bytes(point)
                    .map(SigningKey::P256)
                    .map_err(|_| KeyError::BadPoint("p256"))
            }
            _ => Err(KeyError::UnknownMulticodec),
        }
    }

    pub fn curve_name(&self) -> &'static str {
        match self {
            SigningKey::Secp256k1(_) => "secp256k1",
            SigningKey::P256(_) => "p256",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum KeyError {
    NotBase58Multibase,
    Base58(CidError),
    UnknownMulticodec,
    BadPoint(&'static str),
}

impl std::fmt::Display for KeyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeyError::NotBase58Multibase => write!(f, "key is not z-multibase"),
            KeyError::Base58(e) => write!(f, "key base58: {e}"),
            KeyError::UnknownMulticodec => {
                write!(f, "key multicodec is neither secp256k1-pub nor p256-pub")
            }
            KeyError::BadPoint(curve) => write!(f, "invalid {curve} compressed point"),
        }
    }
}

impl std::error::Error for KeyError {}

/// A parsed signed commit, still carrying its exact raw bytes.
#[derive(Debug, Clone)]
pub struct SignedCommit {
    pub cid: Cid,
    pub did: String,
    pub version: i128,
    pub data: Cid,
    pub rev: String,
    pub prev: Option<Cid>,
    pub sig: Vec<u8>,
    pub raw: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CommitError {
    Cbor(String),
    /// A required field is absent or of the wrong kind.
    Shape(&'static str),
    /// `version` is not 3.
    BadVersion(i128),
    /// Signature is not 64 bytes r‖s.
    BadSigLength(usize),
    /// Signature failed to parse as (r, s) scalars.
    BadSigEncoding,
    /// s is in the upper half-order — forbidden (malleability rule).
    HighS,
    /// The signature does not verify over the unsigned commit bytes.
    BadSignature,
    /// Commit `did` differs from the account being mirrored.
    WrongDid {
        commit: String,
        expected: String,
    },
}

impl std::fmt::Display for CommitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommitError::Cbor(e) => write!(f, "commit cbor: {e}"),
            CommitError::Shape(field) => write!(f, "commit field {field} missing or mistyped"),
            CommitError::BadVersion(v) => write!(f, "commit version {v} (want 3)"),
            CommitError::BadSigLength(n) => write!(f, "signature is {n} bytes (want 64)"),
            CommitError::BadSigEncoding => write!(f, "signature scalars out of range"),
            CommitError::HighS => write!(f, "high-S signature refused (malleability rule)"),
            CommitError::BadSignature => write!(f, "signature does not verify"),
            CommitError::WrongDid { commit, expected } => {
                write!(f, "commit did {commit} != expected {expected}")
            }
        }
    }
}

impl std::error::Error for CommitError {}

impl SignedCommit {
    pub fn parse(cid: Cid, raw: &[u8]) -> Result<SignedCommit, CommitError> {
        let v = cbor::decode(raw).map_err(|e| CommitError::Cbor(e.to_string()))?;
        let did = v
            .get("did")
            .and_then(Value::as_text)
            .ok_or(CommitError::Shape("did"))?
            .to_owned();
        let version = v
            .get("version")
            .and_then(Value::as_int)
            .ok_or(CommitError::Shape("version"))?;
        if version != 3 {
            return Err(CommitError::BadVersion(version));
        }
        let data = v
            .get("data")
            .and_then(Value::as_link)
            .cloned()
            .ok_or(CommitError::Shape("data"))?;
        let rev = v
            .get("rev")
            .and_then(Value::as_text)
            .ok_or(CommitError::Shape("rev"))?
            .to_owned();
        let prev = match v.get("prev") {
            None | Some(Value::Null) => None,
            Some(Value::Link(c)) => Some(c.clone()),
            Some(_) => return Err(CommitError::Shape("prev")),
        };
        let sig = v
            .get("sig")
            .and_then(Value::as_bytes)
            .ok_or(CommitError::Shape("sig"))?
            .to_vec();
        Ok(SignedCommit {
            cid,
            did,
            version,
            data,
            rev,
            prev,
            sig,
            raw: raw.to_vec(),
        })
    }

    /// Verify the commit signature against `key`. Enforces 64-byte compact
    /// form and low-S. The unsigned bytes are produced by the surgical
    /// splice in [`cbor::strip_sig`] — never by re-encoding.
    pub fn verify_signature(&self, key: &SigningKey) -> Result<(), CommitError> {
        if self.sig.len() != 64 {
            return Err(CommitError::BadSigLength(self.sig.len()));
        }
        let unsigned = cbor::strip_sig(&self.raw).map_err(|e| CommitError::Cbor(e.to_string()))?;
        let digest = Sha256::new_with_prefix(&unsigned);
        match key {
            SigningKey::Secp256k1(vk) => {
                let sig = k256::ecdsa::Signature::from_slice(&self.sig)
                    .map_err(|_| CommitError::BadSigEncoding)?;
                if sig.normalize_s().is_some() {
                    return Err(CommitError::HighS);
                }
                vk.verify_digest(digest, &sig)
                    .map_err(|_| CommitError::BadSignature)
            }
            SigningKey::P256(vk) => {
                let sig = p256::ecdsa::Signature::from_slice(&self.sig)
                    .map_err(|_| CommitError::BadSigEncoding)?;
                if sig.normalize_s().is_some() {
                    return Err(CommitError::HighS);
                }
                vk.verify_digest(digest, &sig)
                    .map_err(|_| CommitError::BadSignature)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cbor::testenc::*;
    use crate::cid::CODEC_DAG_CBOR;
    use k256::ecdsa::signature::hazmat::PrehashSigner;

    fn sample_cid(seed: u8) -> Cid {
        Cid {
            codec: CODEC_DAG_CBOR,
            digest: [seed; 32],
        }
    }

    /// Build a signed commit exactly the way a PDS does: encode the
    /// unsigned map, sign sha256 of it, then re-emit with `sig` inserted.
    fn build_signed_commit(
        sk: &k256::ecdsa::SigningKey,
        mutate_sig: impl FnOnce(&mut Vec<u8>),
    ) -> (Cid, Vec<u8>) {
        let data_cid = sample_cid(5);
        let mut unsigned = Vec::new();
        map_header(&mut unsigned, 5);
        text(&mut unsigned, "did");
        text(&mut unsigned, "did:plc:w4x5t3u2v1");
        text(&mut unsigned, "rev");
        text(&mut unsigned, "3lcabc");
        text(&mut unsigned, "data");
        link(&mut unsigned, &data_cid);
        text(&mut unsigned, "prev");
        null(&mut unsigned);
        text(&mut unsigned, "version");
        uint(&mut unsigned, 0, 3);

        let digest: [u8; 32] = Sha256::digest(&unsigned).into();
        let s: k256::ecdsa::Signature = sk.sign_prehash(&digest).unwrap();
        let s = s.normalize_s().unwrap_or(s);
        let mut sig = s.to_bytes().to_vec();
        mutate_sig(&mut sig);

        // Signed form: same entries, same order, sig appended as an entry.
        let mut signed = Vec::new();
        map_header(&mut signed, 6);
        text(&mut signed, "did");
        text(&mut signed, "did:plc:w4x5t3u2v1");
        text(&mut signed, "rev");
        text(&mut signed, "3lcabc");
        text(&mut signed, "data");
        link(&mut signed, &data_cid);
        text(&mut signed, "prev");
        null(&mut signed);
        text(&mut signed, "version");
        uint(&mut signed, 0, 3);
        text(&mut signed, "sig");
        bytes(&mut signed, &sig);

        let cid = Cid {
            codec: CODEC_DAG_CBOR,
            digest: Sha256::digest(&signed).into(),
        };
        (cid, signed)
    }

    #[test]
    fn valid_signature_verifies() {
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let key = SigningKey::Secp256k1(*sk.verifying_key());
        let (cid, raw) = build_signed_commit(&sk, |_| {});
        let commit = SignedCommit::parse(cid, &raw).unwrap();
        assert_eq!(commit.did, "did:plc:w4x5t3u2v1");
        commit.verify_signature(&key).unwrap();
    }

    #[test]
    fn tampered_signature_fails() {
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let key = SigningKey::Secp256k1(*sk.verifying_key());
        let (cid, raw) = build_signed_commit(&sk, |sig| sig[10] ^= 0x01);
        let commit = SignedCommit::parse(cid, &raw).unwrap();
        assert!(matches!(
            commit.verify_signature(&key),
            Err(CommitError::BadSignature) | Err(CommitError::BadSigEncoding)
        ));
    }

    #[test]
    fn high_s_is_refused_even_when_mathematically_valid() {
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let key = SigningKey::Secp256k1(*sk.verifying_key());
        // Flip s to its high form: s' = n - s. The (r, s') pair still
        // satisfies ECDSA math; the low-S rule must reject it anyway.
        let (cid, raw) = build_signed_commit(&sk, |sig| {
            let parsed = k256::ecdsa::Signature::from_slice(sig).unwrap();
            let high = negate_s(&parsed);
            sig.copy_from_slice(&high);
        });
        let commit = SignedCommit::parse(cid, &raw).unwrap();
        assert_eq!(commit.verify_signature(&key), Err(CommitError::HighS));
    }

    /// n - s for secp256k1, big-endian 64-byte compact form.
    fn negate_s(sig: &k256::ecdsa::Signature) -> [u8; 64] {
        use k256::elliptic_curve::PrimeField;
        let bytes = sig.to_bytes();
        let (r, s) = bytes.split_at(32);
        let s_scalar: k256::Scalar =
            Option::from(k256::Scalar::from_repr(*k256::FieldBytes::from_slice(s)))
                .expect("s is a valid scalar");
        let neg = -s_scalar;
        let mut out = [0u8; 64];
        out[..32].copy_from_slice(r);
        out[32..].copy_from_slice(&neg.to_bytes());
        out
    }

    #[test]
    fn wrong_key_fails() {
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let other = k256::ecdsa::SigningKey::from_slice(&[9u8; 32]).unwrap();
        let key = SigningKey::Secp256k1(*other.verifying_key());
        let (cid, raw) = build_signed_commit(&sk, |_| {});
        let commit = SignedCommit::parse(cid, &raw).unwrap();
        assert_eq!(
            commit.verify_signature(&key),
            Err(CommitError::BadSignature)
        );
    }

    #[test]
    fn multibase_key_parsing_round_trips_through_sec1() {
        // Build the multibase form of a known secp256k1 key by hand:
        // e7 01 ‖ compressed point, base58btc, 'z' prefix.
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let point = sk.verifying_key().to_encoded_point(true);
        let mut payload = vec![0xe7, 0x01];
        payload.extend_from_slice(point.as_bytes());
        let encoded = format!("z{}", base58btc_encode(&payload));
        match SigningKey::from_multibase(&encoded).unwrap() {
            SigningKey::Secp256k1(vk) => assert_eq!(&vk, sk.verifying_key()),
            other => panic!("wrong curve: {}", other.curve_name()),
        }
    }

    /// Test-only base58btc encoder (the shipped code only decodes).
    fn base58btc_encode(data: &[u8]) -> String {
        const ALPHA: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let mut digits: Vec<u8> = Vec::new();
        for &byte in data {
            let mut carry = byte as u32;
            for d in digits.iter_mut() {
                let v = (*d as u32) * 256 + carry;
                *d = (v % 58) as u8;
                carry = v / 58;
            }
            while carry > 0 {
                digits.push((carry % 58) as u8);
                carry /= 58;
            }
        }
        let mut s: String = data.iter().take_while(|&&b| b == 0).map(|_| '1').collect();
        for &d in digits.iter().rev() {
            s.push(ALPHA[d as usize] as char);
        }
        s
    }
}
