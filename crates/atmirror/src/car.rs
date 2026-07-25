//! CARv1 reader for `com.atproto.sync.getRepo` exports, with block-level
//! re-hashing. A CAR is trusted only after every block's bytes re-hash to
//! that block's claimed CID — hash at the source, before transport, before
//! upload.

use std::collections::BTreeMap;

use sha2::{Digest, Sha256};

use crate::cbor::{self, Value};
use crate::cid::{Cid, CidError};
use crate::varint::{self, VarintError};

/// Hard ceiling on a single CAR section (CID + block bytes). atproto blocks
/// are ≤ ~1 MiB by protocol; 8 MiB leaves margin without letting a hostile
/// stream balloon memory.
const MAX_SECTION: u64 = 8 * 1024 * 1024;

/// A parsed, block-verified CAR.
#[derive(Debug, Clone)]
pub struct Car {
    /// The single root (atproto repo CARs carry exactly one: the commit).
    pub root: Cid,
    /// Block bytes by CID.
    blocks: BTreeMap<Cid, Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CarError {
    Varint(VarintError),
    Cid(CidError),
    Header(String),
    /// Section length zero, oversized, or past end of buffer.
    BadSection(u64),
    /// sha256(block bytes) != CID digest. The index is the section number.
    HashMismatch {
        section: usize,
        cid: String,
    },
    /// Same CID appears twice with different bytes (content-addressing
    /// violation — impossible from an honest encoder).
    ConflictingDuplicate(String),
    /// Root CID has no corresponding block.
    MissingRoot(String),
}

impl std::fmt::Display for CarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CarError::Varint(e) => write!(f, "car: {e}"),
            CarError::Cid(e) => write!(f, "car: {e}"),
            CarError::Header(e) => write!(f, "car header: {e}"),
            CarError::BadSection(n) => write!(f, "car section of {n} bytes refused"),
            CarError::HashMismatch { section, cid } => {
                write!(f, "block {section} does not re-hash to its CID {cid}")
            }
            CarError::ConflictingDuplicate(cid) => {
                write!(f, "CID {cid} appears twice with different bytes")
            }
            CarError::MissingRoot(cid) => write!(f, "root {cid} has no block in the CAR"),
        }
    }
}

impl std::error::Error for CarError {}

impl From<VarintError> for CarError {
    fn from(e: VarintError) -> Self {
        CarError::Varint(e)
    }
}

impl From<CidError> for CarError {
    fn from(e: CidError) -> Self {
        CarError::Cid(e)
    }
}

impl Car {
    /// Parse a CARv1 buffer and verify **every** block: multihash must be
    /// sha2-256/32, codec must be dag-cbor or raw, and the block bytes must
    /// re-hash to the CID digest. Exactly one root, and its block must be
    /// present.
    pub fn parse_and_verify(buf: &[u8]) -> Result<Car, CarError> {
        let mut pos = 0usize;

        // Header: varint length, then a dag-cbor map {version: 1, roots: [link]}.
        let hlen = varint::read(buf, &mut pos)?;
        if hlen == 0 || hlen > MAX_SECTION {
            return Err(CarError::BadSection(hlen));
        }
        let hend = pos
            .checked_add(hlen as usize)
            .filter(|&e| e <= buf.len())
            .ok_or(CarError::BadSection(hlen))?;
        let header = cbor::decode(&buf[pos..hend]).map_err(|e| CarError::Header(e.to_string()))?;
        pos = hend;

        match header.get("version").and_then(Value::as_int) {
            Some(1) => {}
            other => return Err(CarError::Header(format!("version {other:?}, want 1"))),
        }
        let roots = match header.get("roots") {
            Some(Value::Array(items)) => items
                .iter()
                .map(|v| v.as_link().cloned())
                .collect::<Option<Vec<Cid>>>()
                .ok_or_else(|| CarError::Header("roots entry is not a link".into()))?,
            _ => return Err(CarError::Header("missing roots array".into())),
        };
        if roots.len() != 1 {
            return Err(CarError::Header(format!(
                "{} roots (an atproto repo CAR has exactly 1)",
                roots.len()
            )));
        }
        let root = roots.into_iter().next().expect("len checked");

        // Blocks: varint length, CID, data.
        let mut blocks: BTreeMap<Cid, Vec<u8>> = BTreeMap::new();
        let mut section = 0usize;
        while pos < buf.len() {
            let slen = varint::read(buf, &mut pos)?;
            if slen == 0 || slen > MAX_SECTION {
                return Err(CarError::BadSection(slen));
            }
            let send = pos
                .checked_add(slen as usize)
                .filter(|&e| e <= buf.len())
                .ok_or(CarError::BadSection(slen))?;
            let mut cpos = pos;
            let cid = Cid::read(buf, &mut cpos)?;
            if cpos > send {
                return Err(CarError::BadSection(slen));
            }
            let data = &buf[cpos..send];
            let digest: [u8; 32] = Sha256::digest(data).into();
            if digest != cid.digest {
                return Err(CarError::HashMismatch {
                    section,
                    cid: cid.to_string_b32(),
                });
            }
            if let Some(existing) = blocks.get(&cid) {
                // Same CID ⇒ same digest ⇒ same bytes (both re-hashed above);
                // anything else cannot happen without a sha256 collision, but
                // check anyway — this is a verifier.
                if existing.as_slice() != data {
                    return Err(CarError::ConflictingDuplicate(cid.to_string_b32()));
                }
            } else {
                blocks.insert(cid, data.to_vec());
            }
            pos = send;
            section += 1;
        }

        if !blocks.contains_key(&root) {
            return Err(CarError::MissingRoot(root.to_string_b32()));
        }
        Ok(Car { root, blocks })
    }

    pub fn get(&self, cid: &Cid) -> Option<&[u8]> {
        self.blocks.get(cid).map(Vec::as_slice)
    }

    pub fn contains(&self, cid: &Cid) -> bool {
        self.blocks.contains_key(cid)
    }

    pub fn block_count(&self) -> usize {
        self.blocks.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cbor::testenc::*;
    use crate::cid::CODEC_DAG_CBOR;

    fn cid_of(data: &[u8]) -> Cid {
        Cid {
            codec: CODEC_DAG_CBOR,
            digest: Sha256::digest(data).into(),
        }
    }

    fn build_car(root: &Cid, blocks: &[(&Cid, &[u8])]) -> Vec<u8> {
        let mut header = Vec::new();
        map_header(&mut header, 2);
        text(&mut header, "roots");
        array_header(&mut header, 1);
        link(&mut header, root);
        text(&mut header, "version");
        uint(&mut header, 0, 1);

        let mut car = Vec::new();
        uint_varint(&mut car, header.len() as u64);
        car.extend_from_slice(&header);
        for (cid, data) in blocks {
            let cid_bytes = cid.to_bytes();
            uint_varint(&mut car, (cid_bytes.len() + data.len()) as u64);
            car.extend_from_slice(&cid_bytes);
            car.extend_from_slice(data);
        }
        car
    }

    fn uint_varint(out: &mut Vec<u8>, mut v: u64) {
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

    #[test]
    fn parses_and_verifies_a_wellformed_car() {
        let block: Vec<u8> = {
            let mut b = Vec::new();
            map_header(&mut b, 1);
            text(&mut b, "hello");
            uint(&mut b, 0, 1);
            b
        };
        let root = cid_of(&block);
        let car = build_car(&root, &[(&root, &block)]);
        let parsed = Car::parse_and_verify(&car).unwrap();
        assert_eq!(parsed.root, root);
        assert_eq!(parsed.get(&root), Some(block.as_slice()));
        assert_eq!(parsed.block_count(), 1);
    }

    #[test]
    fn refuses_a_tampered_block() {
        let block = b"\xa0".to_vec(); // {}
        let root = cid_of(&block);
        let mut car = build_car(&root, &[(&root, &block)]);
        let last = car.len() - 1;
        car[last] = 0xa1; // flip the block byte after hashing
        match Car::parse_and_verify(&car) {
            Err(CarError::HashMismatch { section: 0, .. }) => {}
            other => panic!("expected HashMismatch, got {other:?}"),
        }
    }

    #[test]
    fn refuses_a_missing_root() {
        let block = b"\xa0".to_vec();
        let present = cid_of(&block);
        let absent = cid_of(b"\xa1");
        let car = build_car(&absent, &[(&present, &block)]);
        assert!(matches!(
            Car::parse_and_verify(&car),
            Err(CarError::MissingRoot(_))
        ));
    }
}
