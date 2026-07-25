//! `com.beehivenature.receipt` — SPEC_LEXICON-1 §4, emitted as the mirror's
//! manifest. This is the lexicon's shape, not a competing format: a
//! repo-state receipt per §5.1 (subject = the repo root, `contentCid` = the
//! CAR's root commit CID, the CAR itself anchored on the rail, one
//! `mediaPointer` per verified blob).
//!
//! ## Additive fields — PROPOSED for SPEC_LEXICON-1 v0.2, flagged not smuggled
//!
//! The mirror docket requires recording, per artifact: content address,
//! sha256 of the bytes, byte length. §4 v0.1 carries sha256 only on
//! `mediaPointer`. Under §9's evolution policy (*adding optional fields is
//! the only non-breaking change permitted*), this implementation adds:
//!
//! - `arweaveAnchor.sha256`, `arweaveAnchor.byteLength` — the CAR bytes.
//! - `mediaPointer.byteLength`.
//! - `autonomi` anchor (`address`, `sha256`, `byteLength`) — the CAR's home
//!   when the target rail is Autonomi; §4.1 names Autonomi as exactly this
//!   class of future optional anchor.
//!
//! All four are optional, omitted when absent, and listed for Seat 1
//! ratification in the docket receipt. A §8 verifier that ignores them
//! loses nothing: the v0.1 verification procedure runs unchanged.

use serde::{Deserialize, Serialize};

pub const RECEIPT_NSID: &str = "com.beehivenature.receipt";

/// `com.atproto.repo.strongRef` — uri + cid.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StrongRef {
    pub uri: String,
    pub cid: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArweaveAnchor {
    pub tx_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<String>,
    /// PROPOSED v0.2 (additive): sha256 of the anchored bytes, lowercase hex.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    /// PROPOSED v0.2 (additive): exact byte length of the anchored bytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_length: Option<u64>,
}

/// PROPOSED v0.2 (additive optional anchor; §4.1 names Autonomi as the
/// anticipated next rail). The CAR's anchor when the target rail is `ant`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutonomiAnchor {
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_length: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HiveAnchor {
    pub account: String,
    pub custom_json_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trx_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_num: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPointer {
    /// `"ar"` or `"ant"`.
    pub scheme: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_blob_cid: Option<String>,
    /// PROPOSED v0.2 (additive): exact byte length of the blob.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_length: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    #[serde(rename = "$type")]
    pub record_type: String,
    pub subject: StrongRef,
    pub content_cid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arweave: Option<ArweaveAnchor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autonomi: Option<AutonomiAnchor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hive: Option<HiveAnchor>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub media: Vec<MediaPointer>,
    pub created_at: String,
}

impl Receipt {
    /// §5's MUST: `contentCid` equals `subject.cid`; a receipt where they
    /// differ is invalid and MUST be rejected by verifiers (A5).
    pub fn binding_ok(&self) -> bool {
        self.record_type == RECEIPT_NSID && self.content_cid == self.subject.cid
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_in_lexicon_field_names() {
        let r = Receipt {
            record_type: RECEIPT_NSID.into(),
            subject: StrongRef {
                uri: "at://did:plc:x".into(),
                cid: "bafyreiaaa".into(),
            },
            content_cid: "bafyreiaaa".into(),
            arweave: Some(ArweaveAnchor {
                tx_id: "A".repeat(43),
                bundled: Some(true),
                settled_at: None,
                sha256: Some("00".repeat(32)),
                byte_length: Some(1234),
            }),
            autonomi: None,
            hive: None,
            media: vec![MediaPointer {
                scheme: "ar".into(),
                address: "B".repeat(43),
                sha256: Some("11".repeat(32)),
                mime_type: Some("image/png".into()),
                source_blob_cid: Some("bafkreibbb".into()),
                byte_length: Some(9),
            }],
            created_at: "2026-07-25T00:00:00Z".into(),
        };
        assert!(r.binding_ok());
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["$type"], RECEIPT_NSID);
        assert_eq!(json["contentCid"], "bafyreiaaa");
        assert_eq!(json["subject"]["cid"], "bafyreiaaa");
        assert_eq!(json["arweave"]["txId"], "A".repeat(43));
        assert_eq!(json["arweave"]["byteLength"], 1234);
        assert_eq!(json["media"][0]["sourceBlobCid"], "bafkreibbb");
        assert_eq!(json["media"][0]["mimeType"], "image/png");
        assert_eq!(json["createdAt"], "2026-07-25T00:00:00Z");
        // Omitted optionals stay omitted (claim vs proof states, §4.1).
        assert!(json.get("hive").is_none());
        assert!(json.get("autonomi").is_none());
        // Round-trips.
        let back: Receipt = serde_json::from_value(json).unwrap();
        assert_eq!(back, r);
    }

    #[test]
    fn mismatched_binding_is_detected() {
        let r = Receipt {
            record_type: RECEIPT_NSID.into(),
            subject: StrongRef {
                uri: "at://did:plc:x".into(),
                cid: "bafyreiaaa".into(),
            },
            content_cid: "bafyreiOTHER".into(),
            arweave: None,
            autonomi: None,
            hive: None,
            media: vec![],
            created_at: "2026-07-25T00:00:00Z".into(),
        };
        assert!(!r.binding_ok());
    }
}
