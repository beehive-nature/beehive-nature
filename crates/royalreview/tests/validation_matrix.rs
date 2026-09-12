//! Deterministic invalid-input matrix for `validate_review`, plus the
//! fail-closed receipt cross-validation cases. Every case asserts the
//! refusal NAMES the field — a validator error you cannot act on is a
//! bug, not a verdict.

use atmirror::receipt::{Receipt, StrongRef};
use royalreview::record::{Review, StorageRef, REVIEW_NSID};
use royalreview::validate::{validate_review, FetchedReceipt};

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
            label: Some("repo CAR".into()),
        }],
        receipt: None,
        comment: None,
        created_at: "2026-09-12T10:20:30Z".into(),
    }
}

/// A VALID receipt record as atmirror would emit it, plus its own
/// coordinates (what a getRecord / atmirror state lookup returns).
fn valid_receipt_fixture(
    subject_uri: &str,
    subject_cid: &str,
) -> (String, String, serde_json::Value) {
    let receipt = Receipt {
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
    };
    let uri = "at://did:plc:reviewer/com.beehivenature.receipt/3jzfcijpj2z2a".to_string();
    let cid = "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku".to_string();
    (uri, cid, serde_json::to_value(&receipt).unwrap())
}

#[test]
fn valid_review_passes() {
    let ok = validate_review(&base_review(), None).unwrap();
    assert!(ok.receipt.is_none());
}

#[test]
fn every_single_field_corruption_is_named_and_refused() {
    let cases: Vec<(&str, Box<dyn Fn(&mut Review)>)> = vec![
        (
            "$type",
            Box::new(|r| r.record_type = "com.beehivenature.receipt".into()),
        ),
        ("author", Box::new(|r| r.author = "not-a-did".into())),
        (
            "subject.uri",
            Box::new(|r| {
                r.subject.uri = "at://handle.example/app.bsky.feed.post/3jzfcijpj2z2a".into()
            }),
        ),
        (
            "subject.uri",
            Box::new(|r| r.subject.uri = "https://example.com".into()),
        ),
        (
            "subject.cid",
            Box::new(|r| r.subject.cid = "not-a-cid".into()),
        ),
        ("verdict", Box::new(|r| r.verdict = "excellent".into())),
        ("storageRefs", Box::new(|r| r.storage_refs.clear())),
        (
            "storageRefs[0]",
            Box::new(|r| r.storage_refs[0].scheme = "ipfs".into()),
        ),
        (
            "storageRefs[0]",
            Box::new(|r| r.storage_refs[0].address = "A".repeat(42)),
        ),
        (
            "storageRefs[0]",
            Box::new(|r| r.storage_refs[0].sha256 = "CD".repeat(32)),
        ),
        (
            "createdAt",
            Box::new(|r| r.created_at = "2026-09-12 10:20:30Z".into()),
        ),
        (
            "createdAt",
            Box::new(|r| r.created_at = "2026-09-12t10:20:30Z".into()),
        ),
    ];
    for (expected_field, mutate) in cases {
        let mut r = base_review();
        mutate(&mut r);
        let err = validate_review(&r, None)
            .expect_err(&format!("corrupting {expected_field} must be refused"));
        assert!(
            err.starts_with(expected_field),
            "error for {expected_field} should name the field, got: {err}"
        );
    }
}

#[test]
fn more_than_sixteen_storage_refs_refused() {
    let mut r = base_review();
    for _ in 0..16 {
        r.storage_refs.push(r.storage_refs[0].clone());
    }
    let err = validate_review(&r, None).expect_err("17 refs must be refused");
    assert!(err.starts_with("storageRefs"));
}

#[test]
fn receipt_strongref_without_record_is_refused_fail_closed() {
    let mut r = base_review();
    let (uri, cid, _) = valid_receipt_fixture(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        &"bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    );
    r.receipt = Some(StrongRef { uri, cid });
    let err = validate_review(&r, None).expect_err("must refuse a blind receipt reference");
    assert!(err.contains("no receipt record supplied"), "got: {err}");
}

#[test]
fn receipt_with_valid_record_cross_validates() {
    let subject_cid = "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    let (uri, cid, value) = valid_receipt_fixture(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        subject_cid,
    );
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: uri.clone(),
        cid: cid.clone(),
    });
    let fetched = FetchedReceipt {
        uri: &uri,
        cid: &cid,
        value: &value,
    };
    let ok = validate_review(&r, Some(fetched)).unwrap();
    assert!(
        ok.receipt.is_some(),
        "the validated receipt is carried forward"
    );
}

#[test]
fn receipt_reference_mismatching_the_fetched_record_is_refused() {
    let (uri, cid, value) = valid_receipt_fixture(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    );
    // Reference points at a DIFFERENT cid than the fetched record.
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: uri.clone(),
        cid: format!("{cid}X"),
    });
    let fetched = FetchedReceipt {
        uri: &uri,
        cid: &cid,
        value: &value,
    };
    assert!(validate_review(&r, Some(fetched)).is_err());
}

#[test]
fn receipt_violating_the_binding_law_is_refused() {
    // contentCid != subject.cid — SPEC_LEXICON-1 §5's MUST.
    let mut receipt_value = {
        let (uri, _cid, value) = valid_receipt_fixture(
            "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
            "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        );
        let _ = uri;
        value
    };
    receipt_value["contentCid"] = serde_json::json!("bafyreidifferent0000000000000000000000000");
    let uri = "at://did:plc:reviewer/com.beehivenature.receipt/3jzfcijpj2z2a";
    let cid = "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: uri.into(),
        cid: cid.into(),
    });
    let fetched = FetchedReceipt {
        uri,
        cid,
        value: &receipt_value,
    };
    let err = validate_review(&r, Some(fetched)).expect_err("broken binding must be refused");
    assert!(err.contains("binding"), "got: {err}");
}

#[test]
fn receipt_in_wrong_collection_is_refused() {
    // The reference and the fetched record AGREE on coordinates — but the
    // coordinates are not in the receipt collection, so the collection
    // gate fires (not the coordinate-equality one).
    let (_receipt_uri, _cid, value) = valid_receipt_fixture(
        "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a",
        "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    );
    let uri = "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a";
    let cid = "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    let mut r = base_review();
    r.receipt = Some(StrongRef {
        uri: uri.into(),
        cid: cid.into(),
    });
    let fetched = FetchedReceipt {
        uri,
        cid,
        value: &value,
    };
    let err = validate_review(&r, Some(fetched)).expect_err("wrong collection must be refused");
    assert!(
        err.starts_with("receipt.uri") && err.contains("collection"),
        "got: {err}"
    );
}
