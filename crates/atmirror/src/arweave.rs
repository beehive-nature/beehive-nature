//! Arweave rail — ANS-104 DataItems, signed **client-side** with an RSA-4096
//! JWK that never leaves this process (SPEC_LEXICON-1 A8: no key custody by
//! any third party), posted to a Turbo-compatible bundler, retrieved
//! through ordinary gateways.
//!
//! Hash-at-the-source discipline: the DataItem id is `sha256(signature)`,
//! computed **locally before upload**. The bundler's response must agree
//! with the locally computed id or the upload is refused — a receipt is
//! never keyed to an address this process did not derive itself.
//!
//! Wallet posture:
//! - `--wallet <jwk.json>`: the caller's own Arweave key, loaded read-only.
//! - ephemeral: a fresh throwaway key generated in-process. Permanence on
//!   Arweave is bound to content, not to signer reputation, so an
//!   ephemeral signer is sufficient for free-tier-sized uploads; the
//!   manifest's own sha256/CID chain carries all verification weight.

use rsa::traits::PublicKeyParts;
use sha2::{Digest, Sha256, Sha384};

use crate::rail::{Rail, RailError};

pub const DEFAULT_BUNDLER: &str = "https://upload.ardrive.io";
pub const DEFAULT_GATEWAYS: &[&str] = &["https://arweave.net", "https://permagate.io"];

/// An Arweave JWK wallet (RSA-4096). Only the fields signing needs.
#[derive(serde::Deserialize)]
struct Jwk {
    kty: String,
    n: String,
    e: String,
    d: String,
    p: String,
    q: String,
}

pub struct ArweaveRail {
    /// Absent in read-only mode (restore/verify need no signer).
    key: Option<rsa::RsaPrivateKey>,
    /// 512-byte big-endian modulus — the ANS-104 `owner` field.
    owner: Vec<u8>,
    bundler: String,
    gateways: Vec<String>,
    agent: ureq::Agent,
    /// True when the signer was generated in-process this run (reported —
    /// a reader of the receipt trail deserves to know).
    pub ephemeral: bool,
}

impl ArweaveRail {
    pub fn from_jwk_file(
        path: &str,
        bundler: &str,
        gateways: &[String],
    ) -> Result<Self, RailError> {
        let raw = std::fs::read(path).map_err(|e| RailError::Local(format!("{path}: {e}")))?;
        let jwk: Jwk =
            serde_json::from_slice(&raw).map_err(|e| RailError::Local(format!("{path}: {e}")))?;
        if jwk.kty != "RSA" {
            return Err(RailError::Local(format!(
                "{path}: kty {:?}, want RSA",
                jwk.kty
            )));
        }
        let b64 = |s: &str, field: &str| -> Result<rsa::BigUint, RailError> {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(s)
                .map_err(|e| RailError::Local(format!("jwk field {field}: {e}")))?;
            Ok(rsa::BigUint::from_bytes_be(&bytes))
        };
        let key = rsa::RsaPrivateKey::from_components(
            b64(&jwk.n, "n")?,
            b64(&jwk.e, "e")?,
            b64(&jwk.d, "d")?,
            vec![b64(&jwk.p, "p")?, b64(&jwk.q, "q")?],
        )
        .map_err(|e| RailError::Local(format!("jwk: {e}")))?;
        Self::from_key(key, false, bundler, gateways)
    }

    /// Generate a throwaway RSA-4096 signer in-process.
    pub fn ephemeral(bundler: &str, gateways: &[String]) -> Result<Self, RailError> {
        let mut rng = rand::rngs::OsRng;
        let key = rsa::RsaPrivateKey::new(&mut rng, 4096)
            .map_err(|e| RailError::Local(format!("rsa keygen: {e}")))?;
        Self::from_key(key, true, bundler, gateways)
    }

    /// Gateway-only construction: `get`/`probe` work, `put` refuses.
    pub fn read_only(gateways: &[String]) -> ArweaveRail {
        let gateways = if gateways.is_empty() {
            DEFAULT_GATEWAYS.iter().map(|s| s.to_string()).collect()
        } else {
            gateways.to_vec()
        };
        ArweaveRail {
            key: None,
            owner: Vec::new(),
            bundler: DEFAULT_BUNDLER.to_string(),
            gateways,
            agent: ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(30))
                .build(),
            ephemeral: false,
        }
    }

    fn from_key(
        key: rsa::RsaPrivateKey,
        ephemeral: bool,
        bundler: &str,
        gateways: &[String],
    ) -> Result<Self, RailError> {
        let owner = key.to_public_key().n().to_bytes_be();
        if owner.len() != 512 {
            return Err(RailError::Local(format!(
                "modulus is {} bytes; ANS-104 arweave signer requires RSA-4096 (512)",
                owner.len()
            )));
        }
        let gateways = if gateways.is_empty() {
            DEFAULT_GATEWAYS.iter().map(|s| s.to_string()).collect()
        } else {
            gateways.to_vec()
        };
        Ok(ArweaveRail {
            key: Some(key),
            owner,
            bundler: bundler.trim_end_matches('/').to_string(),
            gateways,
            agent: ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(30))
                .build(),
            ephemeral,
        })
    }

    /// Build + sign one ANS-104 DataItem. Returns `(id, bytes)`.
    fn data_item(
        &self,
        data: &[u8],
        tags: &[(String, String)],
    ) -> Result<(String, Vec<u8>), RailError> {
        let key = self.key.as_ref().ok_or(RailError::Local(
            "no wallet loaded (read-only rail); pass --wallet or --ephemeral-key".to_string(),
        ))?;
        let tag_bytes = avro_tags(tags);

        // deepHash(["dataitem", "1", "1", owner, target, anchor, tags, data])
        let msg = deep_hash(&DeepHashItem::List(vec![
            DeepHashItem::Blob(b"dataitem".to_vec()),
            DeepHashItem::Blob(b"1".to_vec()),
            DeepHashItem::Blob(b"1".to_vec()), // signature type 1 = arweave RSA-PSS
            DeepHashItem::Blob(self.owner.clone()),
            DeepHashItem::Blob(Vec::new()), // no target
            DeepHashItem::Blob(Vec::new()), // no anchor
            DeepHashItem::Blob(tag_bytes.clone()),
            DeepHashItem::Blob(data.to_vec()),
        ]));

        let digest: [u8; 32] = Sha256::digest(msg).into();
        let mut rng = rand::rngs::OsRng;
        let sig = key
            .sign_with_rng(&mut rng, rsa::Pss::new_with_salt::<Sha256>(32), &digest)
            .map_err(|e| RailError::Local(format!("rsa-pss sign: {e}")))?;
        if sig.len() != 512 {
            return Err(RailError::Local(format!("signature {} bytes", sig.len())));
        }

        let id = b64url_nopad(&Sha256::digest(&sig));

        let mut item = Vec::with_capacity(2 + 512 + 512 + 2 + 16 + tag_bytes.len() + data.len());
        item.extend_from_slice(&1u16.to_le_bytes()); // signature type
        item.extend_from_slice(&sig);
        item.extend_from_slice(&self.owner);
        item.push(0); // target absent
        item.push(0); // anchor absent
        item.extend_from_slice(&(tags.len() as u64).to_le_bytes());
        item.extend_from_slice(&(tag_bytes.len() as u64).to_le_bytes());
        item.extend_from_slice(&tag_bytes);
        item.extend_from_slice(data);
        Ok((id, item))
    }
}

impl Rail for ArweaveRail {
    fn scheme(&self) -> &'static str {
        "ar"
    }

    fn put(&mut self, bytes: &[u8], tags: &[(String, String)]) -> Result<String, RailError> {
        let (local_id, item) = self.data_item(bytes, tags)?;
        let url = format!("{}/v1/tx", self.bundler);
        let resp = self
            .agent
            .post(&url)
            .set("Content-Type", "application/octet-stream")
            .send_bytes(&item);
        match resp {
            Ok(r) => {
                let body: serde_json::Value = r
                    .into_json()
                    .map_err(|e| RailError::Unparseable(format!("bundler response: {e}")))?;
                let remote_id = body
                    .get("id")
                    .and_then(serde_json::Value::as_str)
                    .ok_or_else(|| RailError::Unparseable(body.to_string()))?;
                if remote_id != local_id {
                    return Err(RailError::AddressMismatch {
                        local: local_id,
                        remote: remote_id.to_string(),
                    });
                }
                Ok(local_id)
            }
            Err(ureq::Error::Status(status, r)) => {
                let body = r.into_string().unwrap_or_default();
                let body = body.chars().take(300).collect();
                Err(RailError::Rejected { status, body })
            }
            Err(e) => Err(RailError::Transport(e.to_string())),
        }
    }

    fn get(&self, address: &str) -> Result<Vec<u8>, RailError> {
        use std::io::Read;
        let mut last = RailError::Missing(address.to_string());
        for gw in &self.gateways {
            let gw = gw.trim_end_matches('/');
            for path in [format!("{gw}/{address}"), format!("{gw}/raw/{address}")] {
                match self.agent.get(&path).call() {
                    Ok(resp) => {
                        let mut buf = Vec::new();
                        let cap: u64 = 2 * 1024 * 1024 * 1024;
                        match resp.into_reader().take(cap).read_to_end(&mut buf) {
                            Ok(_) if !buf.is_empty() => return Ok(buf),
                            Ok(_) => last = RailError::Missing(format!("{path}: empty body")),
                            Err(e) => last = RailError::Transport(format!("{path}: {e}")),
                        }
                    }
                    Err(ureq::Error::Status(status, _)) => {
                        last = RailError::Missing(format!("{path}: HTTP {status}"));
                    }
                    Err(e) => last = RailError::Transport(format!("{path}: {e}")),
                }
            }
        }
        Err(last)
    }

    fn probe(&self, address: &str) -> Result<bool, RailError> {
        for gw in &self.gateways {
            let gw = gw.trim_end_matches('/');
            match self.agent.head(&format!("{gw}/{address}")).call() {
                Ok(_) => return Ok(true),
                Err(ureq::Error::Status(404, _)) => continue,
                Err(ureq::Error::Status(_, _)) => continue,
                Err(_) => continue,
            }
        }
        Ok(false)
    }
}

// ─── ANS-104 encoding helpers ────────────────────────────────────────────

/// Avro `array<{name: bytes, value: bytes}>` encoding used for tags:
/// zigzag-varint count, each field as zigzag-varint length + bytes, then a
/// zero terminator block.
fn avro_tags(tags: &[(String, String)]) -> Vec<u8> {
    if tags.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    zigzag(&mut out, tags.len() as i64);
    for (name, value) in tags {
        zigzag(&mut out, name.len() as i64);
        out.extend_from_slice(name.as_bytes());
        zigzag(&mut out, value.len() as i64);
        out.extend_from_slice(value.as_bytes());
    }
    out.push(0);
    out
}

fn zigzag(out: &mut Vec<u8>, v: i64) {
    let mut z = ((v << 1) ^ (v >> 63)) as u64;
    loop {
        let mut b = (z & 0x7f) as u8;
        z >>= 7;
        if z != 0 {
            b |= 0x80;
        }
        out.push(b);
        if z == 0 {
            break;
        }
    }
}

enum DeepHashItem {
    Blob(Vec<u8>),
    List(Vec<DeepHashItem>),
}

/// Arweave deep-hash: SHA-384 over tagged, length-annotated chunks.
fn deep_hash(item: &DeepHashItem) -> [u8; 48] {
    match item {
        DeepHashItem::Blob(data) => {
            let tag = format!("blob{}", data.len());
            let tag_hash: [u8; 48] = Sha384::digest(tag.as_bytes()).into();
            let data_hash: [u8; 48] = Sha384::digest(data).into();
            let mut both = Vec::with_capacity(96);
            both.extend_from_slice(&tag_hash);
            both.extend_from_slice(&data_hash);
            Sha384::digest(&both).into()
        }
        DeepHashItem::List(items) => {
            let tag = format!("list{}", items.len());
            let mut acc: [u8; 48] = Sha384::digest(tag.as_bytes()).into();
            for it in items {
                let mut pair = Vec::with_capacity(96);
                pair.extend_from_slice(&acc);
                pair.extend_from_slice(&deep_hash(it));
                acc = Sha384::digest(&pair).into();
            }
            acc
        }
    }
}

fn b64url_nopad(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avro_tags_golden_bytes() {
        // One tag {"a": "b"}: count zigzag(1)=0x02, len 1 = 0x02, 'a',
        // len 1 = 0x02, 'b', terminator 0x00.
        assert_eq!(
            avro_tags(&[("a".into(), "b".into())]),
            vec![0x02, 0x02, b'a', 0x02, b'b', 0x00]
        );
        assert!(avro_tags(&[]).is_empty());
    }

    #[test]
    fn zigzag_matches_avro_spec_vectors() {
        // Avro spec: 0→0, -1→1, 1→2, -2→3, 2→4.
        let enc = |v: i64| {
            let mut b = Vec::new();
            zigzag(&mut b, v);
            b
        };
        assert_eq!(enc(0), vec![0x00]);
        assert_eq!(enc(-1), vec![0x01]);
        assert_eq!(enc(1), vec![0x02]);
        assert_eq!(enc(-2), vec![0x03]);
        assert_eq!(enc(2), vec![0x04]);
        assert_eq!(enc(64), vec![0x80, 0x01]);
    }

    #[test]
    fn deep_hash_distinguishes_structure() {
        // ["ab"] vs ["a","b"] must differ — the length-tagged tree sees
        // structure, not just concatenated bytes.
        let one = deep_hash(&DeepHashItem::List(vec![DeepHashItem::Blob(
            b"ab".to_vec(),
        )]));
        let two = deep_hash(&DeepHashItem::List(vec![
            DeepHashItem::Blob(b"a".to_vec()),
            DeepHashItem::Blob(b"b".to_vec()),
        ]));
        assert_ne!(one, two);
        // Deterministic.
        let again = deep_hash(&DeepHashItem::List(vec![DeepHashItem::Blob(
            b"ab".to_vec(),
        )]));
        assert_eq!(one, again);
    }
}
