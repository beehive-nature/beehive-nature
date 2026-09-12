//! Schema/validator PARITY boundaries against the official AT Protocol
//! specifications (Sprint 2, z1.d; per Astra's acceptance note #10 comment
//! 5647902093). Every case cites the rule it pins:
//!
//! - Lexicon String type: maxLength counts **UTF-8 bytes** — "maximum
//!   length of value, in UTF-8 bytes".
//! - TID reference: `TID_REGEX = /^[234567abcdefghij]
//!   [234567abcdefghijklmnopqrstuvwxyz]{12}$/` (packages/syntax/src/tid.ts).
//! - Record-key spec: charset `A-Za-z0-9.-_:~`, length 1..=512, `.` and
//!   `..` forbidden, case-sensitive.
//! - NSID spec: ≥3 segments, total ≤317; authority segments [a-z0-9-], no
//!   lead/trail hyphen, TLD not digit-first; name segment letters+digits,
//!   no hyphens, not digit-first.
//! - Open properties: "Unexpected fields … should be ignored" — extra
//!   fields are tolerated, NOT rejected.
//! - knownValues: non-enforcing per spec; our stricter policy is documented.

use atmirror::receipt::{Receipt, StrongRef};
use royalreview::record::{Review, StorageRef, REVIEW_NSID};
use royalreview::validate::{
    at_uri_parts, validate_datetime, validate_review, validate_tid, FetchedReceipt,
};

fn base_review() -> Review {
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
        comment: None,
        created_at: "2026-09-12T10:20:30Z".into(),
    }
}

fn receipt_value(subject_uri: &str, subject_cid: &str) -> serde_json::Value {
    serde_json::to_value(&Receipt {
        record_type: "com.beehivenature.receipt".into(),
        subject: StrongRef {
            uri: subject_uri.into(),
            cid: subject_cid.into(),
        },
        content_cid: subject_cid.into(),
        arweave: None,
        autonomi: None,
        hive: None,
        media: vec![],
        created_at: "2026-09-11T00:00:00Z".into(),
    })
    .unwrap()
}

const RECEIPT_URI: &str = "at://did:plc:reviewer/com.beehivenature.receipt/3jzfcijpj2z2a";
const RECEIPT_CID: &str = "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";

// ---------------------------------------------------------------- TID ----

#[test]
fn tid_first_character_bound_is_the_reference_first_half() {
    // Reference TID_REGEX first char class: 234567abcdefghij.
    for good in [
        "3jzfcijpj2z2a",
        "aaaaaaaaaaaaa",
        "jaaaaaaaaaaaa",
        "2aaaaaaaaaaaa",
    ] {
        assert!(validate_tid(good).is_ok(), "{good} should pass");
    }
    // In the alphabet but OUTSIDE the first half → refused (top bit).
    for bad in ["kaaaaaaaaaaaa", "vaaaaaaaaaaaa", "zaaaaaaaaaaaa"] {
        assert!(
            validate_tid(bad).is_err(),
            "{bad} should be refused (first char past the first-half bound)"
        );
    }
    // Excluded digits anywhere.
    for bad in [
        "0aaaaaaaaaaaa",
        "a1aaaaaaaaaaa",
        "a8aaaaaaaaaaa",
        "a9aaaaaaaaaaa",
    ] {
        assert!(
            validate_tid(bad).is_err(),
            "{bad} should be refused (0/1/8/9 excluded)"
        );
    }
    // Length boundaries: 12 and 14 chars both refused.
    assert!(validate_tid("3jzfcijpj2z2").is_err());
    assert!(validate_tid("3jzfcijpj2z2aa").is_err());
}

// ------------------------------------------------------- UTF-8 bytes ----

#[test]
fn comment_max_length_counts_utf8_bytes_not_characters() {
    let mut r = base_review();
    // 6,666 three-byte CJK chars = 19,998 bytes: PASSES (and would pass a
    // wrong char-based check too — same answer, different reason).
    r.comment = Some("語".repeat(6_666));
    assert!(validate_review(&r, None).is_ok(), "19,998 bytes fits");

    // 6,700 CJK chars = 20,100 bytes > 20,000 bytes — REFUSED, while a
    // code-point counter (6,700 < 20,000) would wrongly accept it. This is
    // the demonstrated divergence that forced the fix.
    r.comment = Some("語".repeat(6_700));
    let err =
        validate_review(&r, None).expect_err("20,100 UTF-8 bytes must exceed the byte budget");
    assert!(err.contains("UTF-8 bytes"), "got: {err}");

    // ASCII at exactly the bound: 20,000 bytes passes, 20,001 refuses.
    let mut r2 = base_review();
    r2.comment = Some("a".repeat(20_000));
    assert!(validate_review(&r2, None).is_ok());
    r2.comment = Some("a".repeat(20_001));
    assert!(validate_review(&r2, None).is_err());
}

#[test]
fn label_max_length_counts_utf8_bytes() {
    let mut r = base_review();
    r.storage_refs[0].label = Some("語".repeat(21)); // 63 bytes
    assert!(validate_review(&r, None).is_ok());
    r.storage_refs[0].label = Some("語".repeat(22)); // 66 bytes > 64
    assert!(validate_review(&r, None).is_err());
}

#[test]
fn multilingual_comments_are_valid_unicode_content() {
    // The estate is 28-tongue multilingual: RTL, CJK, and multi-codepoint
    // emoji must all be legal content. (Rust &str is valid UTF-8 by
    // construction, so lone surrogates cannot occur — structural
    // guarantee, not a runtime check.)
    let mut r = base_review();
    r.comment = Some("سلام و بررسی کامل — 完整审查 — 🐝📚 ✓".into());
    assert!(validate_review(&r, None).is_ok());
}

// ---------------------------------------------------- at-uri / NSID ----

#[test]
fn collection_segment_follows_the_full_nsid_grammar() {
    // Good: ≥3 segments, valid authority + name shapes.
    for good in [
        "app.bsky.feed.post",
        "com.beehivenature.receipt",
        "com.beehivenature.temp.royalReview", // uppercase legal in the NAME
    ] {
        assert!(
            at_uri_parts(&format!("at://did:plc:x/{good}/self")).is_ok(),
            "{good}"
        );
    }
    // Bad: fewer than 3 segments (spec: "must have at least 3 segments").
    assert!(at_uri_parts("at://did:plc:x/com.example/r").is_err());
    assert!(at_uri_parts("at://did:plc:x/example/r").is_err());
    // Bad: name segment with a hyphen, or digit-first, or empty.
    assert!(at_uri_parts("at://did:plc:x/com.example.bad-name/r").is_err());
    assert!(at_uri_parts("at://did:plc:x/com.example.1name/r").is_err());
    // Bad: TLD digit-first; hyphen-led/trailing authority segment.
    assert!(at_uri_parts("at://did:plc:x/1com.example.name/r").is_err());
    assert!(at_uri_parts("at://did:plc:x/-com.example.name/r").is_err());
    assert!(at_uri_parts("at://did:plc:x/com-.example.name/r").is_err());
    // Bad: segment longer than 63.
    let long_seg = "a".repeat(64);
    assert!(at_uri_parts(&format!("at://did:plc:x/com.{long_seg}.name/r")).is_err());
    // Bad: total length > 317.
    let mut long_coll = String::new();
    while long_coll.len() < 320 {
        long_coll.push_str("abcdefghij.");
    }
    long_coll.push_str("name");
    assert!(long_coll.len() > 317);
    assert!(at_uri_parts(&format!("at://did:plc:x/{long_coll}/r")).is_err());
}

#[test]
fn rkey_follows_the_record_key_charset() {
    // Good: the spec's own valid examples that our grammar admits.
    for good in ["self", "example.com", "~1.2-3_", "dHJ1ZQ", "pre:fix", "_"] {
        assert!(
            at_uri_parts(&format!("at://did:plc:x/com.example.name/{good}")).is_ok(),
            "{good}"
        );
    }
    // Bad: characters outside A-Za-z0-9.-_:~ (spec invalid examples).
    for bad in [
        "alpha#extra",
        "@handle",
        "a b",
        "a+b",
        "a(b)",
        "a=b",
        "a\"b",
    ] {
        assert!(
            at_uri_parts(&format!("at://did:plc:x/com.example.name/{bad}")).is_err(),
            "{bad} should be refused (record-key charset)"
        );
    }
    // Bad: '.' and '..' explicitly forbidden; 513 chars over the 512 cap.
    assert!(at_uri_parts("at://did:plc:x/com.example.name/.").is_err());
    assert!(at_uri_parts("at://did:plc:x/com.example.name/..").is_err());
    let over = "a".repeat(513);
    assert!(at_uri_parts(&format!("at://did:plc:x/com.example.name/{over}")).is_err());
    // Exactly 512 still passes.
    let at_cap = "a".repeat(512);
    assert!(at_uri_parts(&format!("at://did:plc:x/com.example.name/{at_cap}")).is_ok());
}

#[test]
fn review_subject_must_address_a_record() {
    // Repo-root and collection-only uris are legal at-uris — but not a
    // reviewable subject (contract-strict; official strongRef is looser).
    let mut r = base_review();
    r.subject.uri = "at://did:plc:reviewer".into();
    let err = validate_review(&r, None).expect_err("repo-root subject must be refused");
    assert!(err.contains("must address a RECORD"), "got: {err}");
    r.subject.uri = "at://did:plc:reviewer/app.bsky.feed.post".into();
    assert!(
        validate_review(&r, None).is_err(),
        "collection-only subject refused"
    );
}

#[test]
fn receipt_subject_repo_root_form_is_tolerated() {
    // SPEC_LEXICON-1 §5.1 repo-state receipts carry a repo-root subject —
    // inside a receipt record that shape is legal, and our cross-check
    // must not reject it (contrast: the review's own subject, above).
    let mut value = receipt_value("at://did:plc:reviewer", RECEIPT_CID);
    value["$type"] = serde_json::json!("com.beehivenature.receipt");
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: RECEIPT_URI.into(),
        cid: RECEIPT_CID.into(),
    });
    let fetched = FetchedReceipt {
        uri: RECEIPT_URI,
        cid: RECEIPT_CID,
        value: &value,
    };
    assert!(validate_review(&r, Some(fetched)).is_ok());
}

// --------------------------------------------------------- CID shape ----

#[test]
fn cid_check_is_base32_cidv1_only_a_documented_restriction() {
    // atmirror's parser (reused here) accepts ONLY base32-multibase CIDv1
    // ('b' prefix). The official cid format admits other multibase
    // encodings (e.g. base58btc 'Qm…' CIDv0) — this crate is deliberately
    // STRICTER, pinned by these cases: every cid this estate emits or
    // references is base32 CIDv1. Relaxing is a one-line decision for
    // Astra, not a silent behavior.
    let mut r = base_review();
    r.subject.cid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".into(); // base58 CIDv0
    let err = validate_review(&r, None).expect_err("base58 CIDv0 refused (documented restriction)");
    assert!(err.starts_with("subject.cid"), "got: {err}");
    r.subject.cid = "z".to_string() + &"a".repeat(45); // base58btc multibase prefix
    assert!(validate_review(&r, None).is_err());
    r.subject.cid = "BAFYREIHDWDCEFGH4DQKJV67UZCMW7OJEE6XEDZDETOJUZJEVTENXQUVYKU".into(); // uppercase
    assert!(validate_review(&r, None).is_err());
}

// ---------------------------------------------------- receipt shape ----

#[test]
fn receipt_record_grammar_is_checked_beyond_parsing() {
    // createdAt inside the receipt record obeys the same datetime grammar.
    let mut value = receipt_value(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        RECEIPT_CID,
    );
    value["createdAt"] = serde_json::json!("2026-09-11 00:00:00"); // space separator
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: RECEIPT_URI.into(),
        cid: RECEIPT_CID.into(),
    });
    let fetched = FetchedReceipt {
        uri: RECEIPT_URI,
        cid: RECEIPT_CID,
        value: &value,
    };
    let err = validate_review(&r, Some(fetched))
        .expect_err("malformed receipt createdAt must be refused");
    assert!(err.contains("createdAt"), "got: {err}");

    // Receipt subject uri must be a well-formed at-uri with a DID authority.
    let mut value2 = receipt_value("not-an-at-uri", RECEIPT_CID);
    value2["$type"] = serde_json::json!("com.beehivenature.receipt");
    let fetched2 = FetchedReceipt {
        uri: RECEIPT_URI,
        cid: RECEIPT_CID,
        value: &value2,
    };
    let err2 =
        validate_review(&r, Some(fetched2)).expect_err("garbage receipt subject uri refused");
    assert!(err2.contains("subject.uri"), "got: {err2}");
}

#[test]
fn receipt_record_wrongly_typed_fields_are_refused() {
    // subject as a bare string instead of a strongRef object.
    let mut value = receipt_value(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        RECEIPT_CID,
    );
    value["subject"] = serde_json::json!("at://did:plc:reviewer/x");
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: RECEIPT_URI.into(),
        cid: RECEIPT_CID.into(),
    });
    let fetched = FetchedReceipt {
        uri: RECEIPT_URI,
        cid: RECEIPT_CID,
        value: &value,
    };
    assert!(validate_review(&r, Some(fetched)).is_err());
}

#[test]
fn receipt_record_with_unknown_extra_fields_is_tolerated() {
    // Lexicon spec, open properties: "Unexpected fields in data which
    // otherwise conforms to the Lexicon should be ignored." A receipt
    // carrying forward-compatible extra fields must still cross-validate.
    let mut value = receipt_value(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        RECEIPT_CID,
    );
    value["futureOptionalAnchor"] = serde_json::json!({"v": 2});
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: RECEIPT_URI.into(),
        cid: RECEIPT_CID.into(),
    });
    let fetched = FetchedReceipt {
        uri: RECEIPT_URI,
        cid: RECEIPT_CID,
        value: &value,
    };
    assert!(
        validate_review(&r, Some(fetched)).is_ok(),
        "open properties: extra fields are warnings, never errors"
    );
}

#[test]
fn receipt_reference_without_rkey_is_refused() {
    // The reference must address a receipt RECORD (collection + rkey).
    let uri_no_rkey = "at://did:plc:reviewer/com.beehivenature.receipt";
    let value = receipt_value(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        RECEIPT_CID,
    );
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: uri_no_rkey.into(),
        cid: RECEIPT_CID.into(),
    });
    let fetched = FetchedReceipt {
        uri: uri_no_rkey,
        cid: RECEIPT_CID,
        value: &value,
    };
    let err = validate_review(&r, Some(fetched)).expect_err("rkey-less receipt reference refused");
    assert!(err.contains("receipt RECORD"), "got: {err}");
}

// ------------------------------------------------------------ datetime ----

#[test]
fn datetime_fraction_and_offset_boundaries() {
    assert!(validate_datetime("2026-09-12T10:20:30.1Z").is_ok());
    assert!(validate_datetime("2026-09-12T10:20:30.12Z").is_ok());
    assert!(validate_datetime("2026-09-12T10:20:30.123Z").is_ok());
    assert!(validate_datetime("2026-09-12T10:20:30.1234Z").is_err());
    assert!(validate_datetime("2026-09-12T10:20:30.Z").is_err());
    assert!(validate_datetime("2026-09-12T10:20:30+23:59").is_ok());
    assert!(validate_datetime("2026-09-12T10:20:30+24:00").is_err());
    assert!(validate_datetime("2026-09-12T10:20:30+00:60").is_err());
    // Offsets denote the SAME instant regardless of sign shape.
    assert_eq!(
        validate_datetime("2026-09-12T10:20:30Z").unwrap(),
        validate_datetime("2026-09-12T16:20:30+06:00").unwrap()
    );
}
