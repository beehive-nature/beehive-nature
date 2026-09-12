//! The `com.beehivenature.temp.royalReview` record type. Field names
//! serialize exactly as the Lexicon artifact spells them (camelCase, `$type`)
//! — the same discipline as `atmirror::receipt`.

use atmirror::receipt::StrongRef;
use serde::{Deserialize, Serialize};

/// The experimental NSID. `.temp.` = unstable variant per the Lexicon Style
/// Guide; promote or drop before any corpus depends on it.
pub const REVIEW_NSID: &str = "com.beehivenature.temp.royalReview";

/// Allowed verdicts (the artifact's `#verdict` knownValues, enforced
/// strictly by this implementation). Wording follows the estate's
/// crypto-language law: caps at "sound", never exceeds "sound by
/// construction", and an uncited claim stops at "unverified".
pub const VERDICTS: [&str; 4] = ["sound", "sound-with-notes", "unsound", "unverified"];

/// Storage rails — the same vocabulary as the receipt lexicon's
/// `mediaPointer.scheme` (one vocabulary, no second source of truth).
pub const STORAGE_SCHEMES: [&str; 2] = ["ar", "ant"];

/// One explicit storage reference: where the reviewed bytes live, plus the
/// sha256 that makes the reference verifiable. Unlike the receipt
/// `mediaPointer` (sha256 optional), a storageRef WITHOUT sha256 is refused
/// — a review asserts "I verified bytes at these addresses".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageRef {
    /// `"ar"` or `"ant"`.
    pub scheme: String,
    pub address: String,
    pub sha256: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_length: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

/// The Review record. `subject`/`receipt` are `com.atproto.repo.strongRef`
/// (uri + cid), reusing atmirror's type verbatim.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    #[serde(rename = "$type")]
    pub record_type: String,
    /// Reviewer DID. Must equal the atproto twin's repo authority; the
    /// Nostr twin binds to it via the `atproto.record` tag.
    pub author: String,
    pub subject: StrongRef,
    pub verdict: String,
    /// 1..=16 explicit storage references (artifact: minItems 1, maxLength 16).
    pub storage_refs: Vec<StorageRef>,
    /// Optional strongRef to a VALIDATED `com.beehivenature.receipt`
    /// record. Fail-closed: present without the receipt's bytes to
    /// cross-validate ⇒ refusal (see `validate`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<StrongRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    /// RFC 3339, uppercase T, timezone required, ≤3 fractional digits.
    pub created_at: String,
}

impl Review {
    /// The at-uri the atproto twin will live at, given the client-minted
    /// rkey (a TID — the twin identity shared by both rails).
    pub fn at_uri(&self, rkey: &str) -> String {
        format!("at://{}/{}/{}", self.author, REVIEW_NSID, rkey)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atmirror::receipt::StrongRef;

    fn sample() -> Review {
        Review {
            record_type: REVIEW_NSID.into(),
            author: "did:plc:example".into(),
            subject: StrongRef {
                uri: "at://did:plc:example/com.beehivenature.receipt/3jzfcijpj2z2a".into(),
                cid: "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku".into(),
            },
            verdict: "sound".into(),
            storage_refs: vec![StorageRef {
                scheme: "ar".into(),
                address: "A".repeat(43),
                sha256: "ab".repeat(32),
                byte_length: Some(1234),
                label: Some("repo CAR".into()),
            }],
            receipt: None,
            comment: None,
            created_at: "2026-09-12T00:00:00Z".into(),
        }
    }

    #[test]
    fn serializes_in_lexicon_field_names() {
        let v = serde_json::to_value(sample()).unwrap();
        assert_eq!(v["$type"], REVIEW_NSID);
        assert_eq!(v["author"], "did:plc:example");
        assert_eq!(
            v["subject"]["uri"],
            "at://did:plc:example/com.beehivenature.receipt/3jzfcijpj2z2a"
        );
        assert_eq!(v["storageRefs"][0]["sha256"], "ab".repeat(32));
        assert_eq!(v["storageRefs"][0]["byteLength"], 1234);
        assert_eq!(v["createdAt"], "2026-09-12T00:00:00Z");
        // Omitted optionals stay omitted.
        assert!(v.get("receipt").is_none());
        assert!(v.get("comment").is_none());
    }

    #[test]
    fn round_trips() {
        let r = sample();
        let back: Review = serde_json::from_value(serde_json::to_value(&r).unwrap()).unwrap();
        assert_eq!(back, r);
    }

    #[test]
    fn at_uri_shape() {
        assert_eq!(
            sample().at_uri("3jzfcijpj2z2a"),
            "at://did:plc:example/com.beehivenature.temp.royalReview/3jzfcijpj2z2a"
        );
    }
}
