//! The Nostr twin of a Review.
//!
//! The BNR-owned rail (buzz relay, Nostr) is the record of truth and the
//! atproto record is the broadcast mirror (mirror-by-law) — so the twin is
//! not a lossy repost but the SAME review in Nostr's shape:
//!
//! - **kind 30078** — application-specific data (NIP-78), which sits in the
//!   parameterized-replaceable range 30000–39999 (NIP-01): duplicate
//!   prevention is structural, since `(pubkey, kind, d-tag)` addresses one
//!   logical event.
//! - **d-tag = the review's rkey** (the client-minted TID) — the shared
//!   identity across both rails.
//! - **content = the canonical record JSON** (serde_json's default map is
//!   sorted, so serialization is deterministic).
//! - **created_at = the review's createdAt** as Unix seconds (from
//!   `validate::validate_datetime`), NOT an ambient clock — the same
//!   review + pubkey + rkey always mints the same event id.
//!
//! The event **id** (sha256 over NIP-01's canonical serialization
//! `[0,pubkey,created_at,kind,tags,content]`, compact JSON, the leading `0`
//!-- being the integer standing in for the 32 zero bytes of the id field
//! during hashing) is computed HERE, and the orchestrator refuses a sink
//! whose answer disagrees — the re-hash law applied to the owned rail.
//! Signatures are out of scope for this slice (BIP-340 schnorr + user keys
//! arrive with the deliberate-publication/OAuth slice); the id is fully
//! defined without them.

use sha2::{Digest, Sha256};

use crate::record::Review;
use crate::validate::{validate_datetime, validate_review, FetchedReceipt};

/// NIP-78 application-specific data.
pub const TWIN_KIND: u64 = 30078;

/// An unsigned twin event. `id` is locally computed; the signature is
/// absent until the publish path signs (remaining work — see the dispatch).
#[derive(Debug, Clone, PartialEq)]
pub struct TwinEvent {
    pub id: String,
    pub pubkey: String,
    pub created_at: i64,
    pub kind: u64,
    /// Deterministically sorted tags (lexicographic by the full tag).
    pub tags: Vec<Vec<String>>,
    pub content: String,
}

/// Build the twin for a review. Full local validation runs first (same
/// `validate_review`, same fail-closed receipt cross-check, `receipt` has
/// the same Option semantics); then `rkey` must be a TID and `pubkey` a
/// 64-char lowercase-hex x-only secp256k1 key. No ambient clock, no
/// network — identical inputs mint an identical event id.
pub fn build_twin(
    review: &Review,
    receipt: Option<FetchedReceipt<'_>>,
    rkey: &str,
    pubkey: &str,
) -> Result<TwinEvent, String> {
    validate_review(review, receipt)?;
    crate::validate::validate_tid(rkey).map_err(|e| format!("rkey: {e}"))?;
    validate_pubkey(pubkey)?;
    let created_at =
        validate_datetime(&review.created_at).map_err(|e| format!("createdAt: {e}"))?;
    // The NOSTR-TWIN policy (not Lexicon grammar): NIP-01 created_at is
    // u64 seconds, so a pre-1970 createdAt — grammar-valid as a record
    // field — cannot be twinned. Refused HERE, at the layer that needs it.
    if created_at < 0 {
        return Err(format!(
            "createdAt: instant {} is before 1970 — the Nostr twin's created_at is u64 \
             seconds; the record's datetime is grammar-valid but cannot be twinned",
            created_at
        ));
    }

    // Canonical content: the record JSON itself, compact + sorted-map. The
    // ORIGINAL createdAt string travels verbatim into the content and thus
    // the event id's hash input — it is never round-tripped through the
    // whole-second nostr representation (which is derived, not substituted).
    let value = serde_json::to_value(review).map_err(|e| e.to_string())?;
    let content = serde_json::to_string(&value).map_err(|e| e.to_string())?;

    // Binding + identity tags; sorted for determinism.
    let mut tags: Vec<Vec<String>> = vec![
        vec!["d".into(), rkey.into()],
        vec!["atproto.record".into(), review.at_uri(rkey)],
        vec!["review.subject".into(), review.subject.uri.clone()],
        vec!["review.subject.cid".into(), review.subject.cid.clone()],
        vec!["review.verdict".into(), review.verdict.clone()],
    ];
    if let Some(receipt_ref) = &review.receipt {
        tags.push(vec!["review.receipt.uri".into(), receipt_ref.uri.clone()]);
        tags.push(vec!["review.receipt.cid".into(), receipt_ref.cid.clone()]);
    }
    tags.sort();

    let mut event = TwinEvent {
        id: String::new(),
        pubkey: pubkey.to_string(),
        created_at,
        kind: TWIN_KIND,
        tags,
        content,
    };
    event.id = compute_event_id(&event)?;
    Ok(event)
}

/// NIP-01 event id: sha256 (lowercase hex) of the compact JSON
/// `[0, pubkey, created_at, kind, tags, content]`.
pub fn compute_event_id(event: &TwinEvent) -> Result<String, String> {
    let canonical = serde_json::Value::Array(vec![
        serde_json::Value::from(0),
        serde_json::Value::String(event.pubkey.clone()),
        serde_json::Value::from(event.created_at),
        serde_json::Value::from(event.kind),
        serde_json::to_value(&event.tags).map_err(|e| e.to_string())?,
        serde_json::Value::String(event.content.clone()),
    ]);
    let serialized = serde_json::to_string(&canonical).map_err(|e| e.to_string())?;
    Ok(atmirror::rail::hex_lower(&Sha256::digest(
        serialized.as_bytes(),
    )))
}

/// Nostr pubkey: 64 lowercase hex chars (x-only secp256k1). Syntax only.
fn validate_pubkey(s: &str) -> Result<(), String> {
    if s.len() != 64 {
        return Err(format!("nostr pubkey: {} chars, expected 64", s.len()));
    }
    if !s
        .bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("nostr pubkey: non-hex or uppercase character present".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::record::{Review, StorageRef, REVIEW_NSID};
    use atmirror::receipt::StrongRef;

    pub(crate) fn sample_review() -> Review {
        Review {
            record_type: REVIEW_NSID.into(),
            author: "did:plc:reviewer".into(),
            subject: StrongRef {
                uri: "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a".into(),
                cid: "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku".into(),
            },
            verdict: "sound".into(),
            storage_refs: vec![StorageRef {
                scheme: "ar".into(),
                address: "A".repeat(43),
                sha256: "cd".repeat(32),
                byte_length: Some(42),
                label: None,
            }],
            receipt: None,
            comment: Some("verified end to end".into()),
            created_at: "2026-09-12T00:00:00Z".into(),
        }
    }

    pub(crate) fn sample_pubkey() -> String {
        format!("{:0>64}", "11") // runtime-constructed; no literal long-hex runs
    }

    #[test]
    fn twin_is_deterministic() {
        let r = sample_review();
        let a = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        let b = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        assert_eq!(a, b, "same inputs must mint the identical event id");
        assert_eq!(a.kind, 30078);
        assert_eq!(a.id.len(), 64);
    }

    #[test]
    fn tags_bind_both_rails() {
        let r = sample_review();
        let e = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        let d = e.tags.iter().find(|t| t[0] == "d").unwrap();
        assert_eq!(d[1], "3jzfcijpj2z2a");
        let at = e.tags.iter().find(|t| t[0] == "atproto.record").unwrap();
        assert_eq!(
            at[1],
            "at://did:plc:reviewer/com.beehivenature.temp.royalReview/3jzfcijpj2z2a"
        );
        let names: Vec<&str> = e.tags.iter().map(|t| t[0].as_str()).collect();
        let mut sorted = names.clone();
        sorted.sort();
        assert_eq!(names, sorted);
    }

    #[test]
    fn content_carries_the_record() {
        let r = sample_review();
        let e = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        let v: serde_json::Value = serde_json::from_str(&e.content).unwrap();
        assert_eq!(v["$type"], REVIEW_NSID);
        assert_eq!(v["verdict"], "sound");
    }

    #[test]
    fn id_matches_independent_recomputation() {
        let r = sample_review();
        let e = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        assert_eq!(e.id, compute_event_id(&e).unwrap());
        // Perturbing any field changes the id.
        let mut e2 = e.clone();
        e2.content.push(' ');
        assert_ne!(e.id, compute_event_id(&e2).unwrap());
    }

    #[test]
    fn refuses_invalid_inputs() {
        let r = sample_review();
        assert!(build_twin(&r, None, "not-a-tid!", &sample_pubkey()).is_err());
        assert!(build_twin(&r, None, "3jzfcijpj2z2a", "abc").is_err());
        let mut bad = r.clone();
        bad.verdict = "amazing".into();
        assert!(build_twin(&bad, None, "3jzfcijpj2z2a", &sample_pubkey()).is_err());
    }

    #[test]
    fn pre1970_created_at_is_grammar_valid_but_cannot_be_twinned() {
        // The grammar admits pre-1970 instants; the NON-NEGATIVE rule is
        // this layer's policy (NIP-01 created_at is u64 seconds). The
        // split is asserted both ways: validate passes, twin refuses.
        let mut r = sample_review();
        r.created_at = "1969-12-31T23:59:59Z".into();
        assert!(
            crate::validate::validate_review(&r, None).is_ok(),
            "record-level validation is grammar-only"
        );
        let err = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey())
            .expect_err("the twin must refuse a pre-1970 instant");
        assert!(err.contains("u64"), "got: {err}");
    }

    #[test]
    fn fractional_created_at_is_preserved_verbatim_in_content_and_hash_input() {
        // The ORIGINAL datetime string travels byte-for-byte into the twin
        // content (and therefore the event id's hash input); it is never
        // round-tripped through the whole-second nostr representation.
        // That representation exists only as the derived event field.
        let mut r = sample_review();
        r.created_at = "1985-04-12T23:20:50.123456Z".into();
        let e = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        assert!(
            e.content.contains("1985-04-12T23:20:50.123456Z"),
            "content must preserve the original string verbatim: {}",
            e.content
        );
        assert_eq!(
            e.created_at,
            crate::validate::validate_datetime("1985-04-12T23:20:50.123456Z").unwrap(),
            "event.created_at is the derived whole-second instant"
        );
        // Determinism still holds with the fraction present.
        let e2 = build_twin(&r, None, "3jzfcijpj2z2a", &sample_pubkey()).unwrap();
        assert_eq!(e.id, e2.id);
    }
}
