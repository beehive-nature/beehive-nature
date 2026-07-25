//! Merkle Search Tree walk — K-4 step 3: prove the CAR is *complete*, i.e.
//! every tree node and every record the signed commit's `data` root
//! references is actually present, and collect the record set.
//!
//! Blob discovery also lives here, and deliberately does **not** trust the
//! PDS: references are extracted from the verified record bytes themselves
//! (`$type: "blob"` maps, legacy `{cid, mimeType}` maps, and bare raw-codec
//! links). `listBlobs` output is unioned in later — a host that lies by
//! omission cannot hide a blob a record actually references.

use std::collections::BTreeSet;

use crate::car::Car;
use crate::cbor::{self, Value};
use crate::cid::{Cid, CODEC_RAW};

/// One record reached from the MST: full key path (`collection/rkey`) and
/// the record block's CID.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordRef {
    pub path: String,
    pub cid: Cid,
}

/// One blob reference extracted from a verified record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlobRef {
    pub cid: Cid,
    pub mime_type: Option<String>,
    /// The size the record claims. Advisory — the fetched bytes are always
    /// re-hashed against the CID, which is the real check.
    pub declared_size: Option<u64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MstError {
    /// A referenced tree node is absent from the CAR.
    MissingNode(String),
    /// A referenced record block is absent from the CAR.
    MissingRecord {
        path: String,
        cid: String,
    },
    /// A node failed to decode or has an illegal shape.
    BadNode {
        cid: String,
        reason: String,
    },
    /// The same node CID reached twice — not a tree.
    Cycle(String),
    TooDeep,
    /// Record keys must be ASCII `collection/rkey`.
    BadKey(String),
}

impl std::fmt::Display for MstError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MstError::MissingNode(cid) => write!(f, "mst node {cid} missing from CAR"),
            MstError::MissingRecord { path, cid } => {
                write!(f, "record {path} ({cid}) missing from CAR")
            }
            MstError::BadNode { cid, reason } => write!(f, "mst node {cid}: {reason}"),
            MstError::Cycle(cid) => write!(f, "mst node {cid} reached twice"),
            MstError::TooDeep => write!(f, "mst deeper than limit"),
            MstError::BadKey(k) => write!(f, "malformed record key {k:?}"),
        }
    }
}

impl std::error::Error for MstError {}

const MAX_MST_DEPTH: u32 = 80;

/// Walk the tree rooted at `data`, proving completeness and returning every
/// record in key order.
pub fn walk(car: &Car, data: &Cid) -> Result<Vec<RecordRef>, MstError> {
    let mut records = Vec::new();
    let mut visited: BTreeSet<Cid> = BTreeSet::new();
    walk_node(car, data, 0, &mut visited, &mut records)?;
    Ok(records)
}

fn walk_node(
    car: &Car,
    node_cid: &Cid,
    depth: u32,
    visited: &mut BTreeSet<Cid>,
    out: &mut Vec<RecordRef>,
) -> Result<(), MstError> {
    if depth > MAX_MST_DEPTH {
        return Err(MstError::TooDeep);
    }
    if !visited.insert(node_cid.clone()) {
        return Err(MstError::Cycle(node_cid.to_string_b32()));
    }
    let bytes = car
        .get(node_cid)
        .ok_or_else(|| MstError::MissingNode(node_cid.to_string_b32()))?;
    let node = cbor::decode(bytes).map_err(|e| MstError::BadNode {
        cid: node_cid.to_string_b32(),
        reason: e.to_string(),
    })?;

    let bad = |reason: &str| MstError::BadNode {
        cid: node_cid.to_string_b32(),
        reason: reason.to_string(),
    };

    // Left subtree first (keys below every entry of this node).
    match node.get("l") {
        None | Some(Value::Null) => {}
        Some(Value::Link(left)) => {
            walk_node(car, left, depth + 1, visited, out)?;
        }
        Some(_) => return Err(bad("l is neither null nor link")),
    }

    let entries = match node.get("e") {
        Some(Value::Array(items)) => items,
        _ => return Err(bad("e missing or not an array")),
    };

    // Prefix compression is per-node: each entry's `p` counts bytes shared
    // with the PREVIOUS ENTRY OF THIS NODE (never with subtree keys).
    let mut prev_key: Vec<u8> = Vec::new();
    for entry in entries {
        let prefix_len = entry
            .get("p")
            .and_then(Value::as_int)
            .filter(|p| *p >= 0)
            .ok_or_else(|| bad("entry p missing or negative"))? as usize;
        let key_suffix = entry
            .get("k")
            .and_then(Value::as_bytes)
            .ok_or_else(|| bad("entry k missing or not bytes"))?;
        let value_cid = entry
            .get("v")
            .and_then(Value::as_link)
            .cloned()
            .ok_or_else(|| bad("entry v missing or not a link"))?;

        if prefix_len > prev_key.len() {
            return Err(bad("entry prefix length exceeds previous key in node"));
        }
        let mut key = Vec::with_capacity(prefix_len + key_suffix.len());
        key.extend_from_slice(&prev_key[..prefix_len]);
        key.extend_from_slice(key_suffix);
        if !prev_key.is_empty() && key <= prev_key {
            return Err(bad("entry keys not strictly ascending within node"));
        }

        let path = String::from_utf8(key.clone())
            .ok()
            .filter(|p| p.contains('/') && p.is_ascii())
            .ok_or_else(|| MstError::BadKey(format!("{:?}", String::from_utf8_lossy(&key))))?;
        prev_key = key;

        if !car.contains(&value_cid) {
            return Err(MstError::MissingRecord {
                path,
                cid: value_cid.to_string_b32(),
            });
        }
        out.push(RecordRef {
            path,
            cid: value_cid,
        });

        // Right subtree of this entry (keys between this entry and the next).
        match entry.get("t") {
            None | Some(Value::Null) => {}
            Some(Value::Link(right)) => {
                walk_node(car, right, depth + 1, visited, out)?;
            }
            Some(_) => return Err(bad("entry t is neither null nor link")),
        }
    }
    Ok(())
}

/// Extract every blob reference from one decoded record value.
///
/// Recognized forms, per the atproto data model:
/// - current: `{"$type": "blob", "ref": <link>, "mimeType": t, "size": n}`
/// - legacy: `{"cid": "<cid-string>", "mimeType": t}`
/// - defensive: any bare link whose codec is `raw` (a blob by construction —
///   repo blocks are all dag-cbor).
pub fn scan_blob_refs(record: &Value, out: &mut Vec<BlobRef>) {
    match record {
        Value::Map(entries) => {
            let type_is_blob = record.get("$type").and_then(Value::as_text) == Some("blob");
            if type_is_blob {
                if let Some(Value::Link(cid)) = record.get("ref") {
                    out.push(BlobRef {
                        cid: cid.clone(),
                        mime_type: record
                            .get("mimeType")
                            .and_then(Value::as_text)
                            .map(str::to_owned),
                        declared_size: record
                            .get("size")
                            .and_then(Value::as_int)
                            .and_then(|n| u64::try_from(n).ok()),
                    });
                    // A well-formed blob map's other fields hold nothing
                    // further; still recurse below for defense in depth.
                }
            } else if let (Some(cid_text), Some(mime)) = (
                record.get("cid").and_then(Value::as_text),
                record.get("mimeType").and_then(Value::as_text),
            ) {
                if let Ok(cid) = Cid::parse_str(cid_text) {
                    if cid.codec == CODEC_RAW {
                        out.push(BlobRef {
                            cid,
                            mime_type: Some(mime.to_owned()),
                            declared_size: None,
                        });
                    }
                }
            }
            for (_, v) in entries {
                scan_blob_refs(v, out);
            }
        }
        Value::Array(items) => {
            for v in items {
                scan_blob_refs(v, out);
            }
        }
        Value::Link(cid) if cid.codec == CODEC_RAW => out.push(BlobRef {
            cid: cid.clone(),
            mime_type: None,
            declared_size: None,
        }),
        _ => {}
    }
}

/// Deduplicate blob refs by CID, preferring entries that carry a mime type.
pub fn dedup_blob_refs(refs: Vec<BlobRef>) -> Vec<BlobRef> {
    let mut out: Vec<BlobRef> = Vec::new();
    for r in refs {
        if let Some(existing) = out.iter_mut().find(|e| e.cid == r.cid) {
            if existing.mime_type.is_none() {
                existing.mime_type = r.mime_type.clone();
            }
            if existing.declared_size.is_none() {
                existing.declared_size = r.declared_size;
            }
        } else {
            out.push(r);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::car::Car;
    use crate::cbor::testenc::*;
    use crate::cid::{CODEC_DAG_CBOR, CODEC_RAW};
    use sha2::{Digest, Sha256};

    fn cid_of(data: &[u8], codec: u64) -> Cid {
        Cid {
            codec,
            digest: Sha256::digest(data).into(),
        }
    }

    fn build_car(root: &Cid, blocks: &[(&Cid, &[u8])]) -> Car {
        let mut header = Vec::new();
        map_header(&mut header, 2);
        text(&mut header, "roots");
        array_header(&mut header, 1);
        link(&mut header, root);
        text(&mut header, "version");
        uint(&mut header, 0, 1);
        let mut car = Vec::new();
        varint_out(&mut car, header.len() as u64);
        car.extend_from_slice(&header);
        for (cid, data) in blocks {
            let cb = cid.to_bytes();
            varint_out(&mut car, (cb.len() + data.len()) as u64);
            car.extend_from_slice(&cb);
            car.extend_from_slice(data);
        }
        Car::parse_and_verify(&car).unwrap()
    }

    fn varint_out(out: &mut Vec<u8>, mut v: u64) {
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

    fn record_block() -> Vec<u8> {
        let mut b = Vec::new();
        map_header(&mut b, 1);
        text(&mut b, "$type");
        text(&mut b, "app.bsky.feed.post");
        b
    }

    /// One MST node with two entries (prefix-compressed) and no subtrees.
    fn mst_node(rec_cid: &Cid) -> Vec<u8> {
        let mut node = Vec::new();
        map_header(&mut node, 2);
        text(&mut node, "e");
        array_header(&mut node, 2);
        // entry 1: p=0, k="app.bsky.feed.post/aaa"
        map_header(&mut node, 4);
        text(&mut node, "k");
        bytes(&mut node, b"app.bsky.feed.post/aaa");
        text(&mut node, "p");
        uint(&mut node, 0, 0);
        text(&mut node, "t");
        null(&mut node);
        text(&mut node, "v");
        link(&mut node, rec_cid);
        // entry 2: p=19 (shares "app.bsky.feed.post/"), k="bbb"
        map_header(&mut node, 4);
        text(&mut node, "k");
        bytes(&mut node, b"bbb");
        text(&mut node, "p");
        uint(&mut node, 0, 19);
        text(&mut node, "t");
        null(&mut node);
        text(&mut node, "v");
        link(&mut node, rec_cid);
        // l: null
        text(&mut node, "l");
        null(&mut node);
        node
    }

    #[test]
    fn walks_and_reconstructs_prefixed_keys() {
        let rec = record_block();
        let rec_cid = cid_of(&rec, CODEC_DAG_CBOR);
        let node = mst_node(&rec_cid);
        let node_cid = cid_of(&node, CODEC_DAG_CBOR);
        let car = build_car(&node_cid, &[(&node_cid, &node), (&rec_cid, &rec)]);

        let records = walk(&car, &node_cid).unwrap();
        assert_eq!(
            records.iter().map(|r| r.path.as_str()).collect::<Vec<_>>(),
            vec!["app.bsky.feed.post/aaa", "app.bsky.feed.post/bbb"]
        );
    }

    #[test]
    fn missing_record_is_refused() {
        let rec = record_block();
        let rec_cid = cid_of(&rec, CODEC_DAG_CBOR);
        let node = mst_node(&rec_cid);
        let node_cid = cid_of(&node, CODEC_DAG_CBOR);
        // CAR carries the node but NOT the record it references.
        let car = build_car(&node_cid, &[(&node_cid, &node)]);
        assert!(matches!(
            walk(&car, &node_cid),
            Err(MstError::MissingRecord { .. })
        ));
    }

    #[test]
    fn finds_blob_refs_in_all_three_forms() {
        let blob_cid = cid_of(b"image bytes", CODEC_RAW);
        // Current form.
        let mut rec = Vec::new();
        map_header(&mut rec, 2);
        text(&mut rec, "embed");
        map_header(&mut rec, 4);
        text(&mut rec, "$type");
        text(&mut rec, "blob");
        text(&mut rec, "mimeType");
        text(&mut rec, "image/png");
        text(&mut rec, "ref");
        link(&mut rec, &blob_cid);
        text(&mut rec, "size");
        uint(&mut rec, 0, 11);
        text(&mut rec, "other");
        link(&mut rec, &blob_cid); // defensive bare raw link

        let v = cbor::decode(&rec).unwrap();
        let mut refs = Vec::new();
        scan_blob_refs(&v, &mut refs);
        let refs = dedup_blob_refs(refs);
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].cid, blob_cid);
        assert_eq!(refs[0].mime_type.as_deref(), Some("image/png"));
        assert_eq!(refs[0].declared_size, Some(11));

        // Legacy form.
        let mut legacy = Vec::new();
        map_header(&mut legacy, 2);
        text(&mut legacy, "cid");
        text(&mut legacy, &blob_cid.to_string_b32());
        text(&mut legacy, "mimeType");
        text(&mut legacy, "image/jpeg");
        let v = cbor::decode(&legacy).unwrap();
        let mut refs = Vec::new();
        scan_blob_refs(&v, &mut refs);
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].mime_type.as_deref(), Some("image/jpeg"));
    }
}
