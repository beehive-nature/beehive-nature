//! The committed artifact test — "only committed blobs count."
//!
//! `surfaces/bheraldry-records.json` is what the read-only surface renders
//! from. This test pins it to the freshly built specimens: the committed
//! bytes must parse, each record must validate, each digest must equal the
//! digest of a fresh build, and a tampered copy must be REFUSED by exactly
//! that check. If the specimens change (a new revision), regenerate the
//! artifact and this test enforces that it happened.

use bheraldry::specimen::{bulgaria_national_arms, house_achievement};
use bheraldry::{LawViolation, RecordDigest, SealedRecord, SymbolRecord};
use serde::Deserialize;

#[derive(Deserialize)]
struct ArtifactRecord {
    id: String,
    revision: u32,
    supersedes: Option<String>,
    digest: String,
    canonical_bytes: usize,
    record: SymbolRecord,
}

#[derive(Deserialize)]
struct Artifact {
    schema: String,
    records: Vec<ArtifactRecord>,
}

fn load_committed() -> Artifact {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../surfaces/bheraldry-records.json");
    let bytes = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("committed artifact missing at surfaces/bheraldry-records.json: {e} — regenerate with `cargo run -p bheraldry --bin specimen -- --export-json > surfaces/bheraldry-records.json`"));
    serde_json::from_slice(&bytes).expect("the committed artifact parses")
}

fn expected() -> Vec<(String, SealedRecord)> {
    vec![
        (
            "bg/national-arms".into(),
            bulgaria_national_arms().seal().expect("bg rev3 seals"),
        ),
        (
            "bnr/house-achievement".into(),
            house_achievement()
                .seal()
                .expect("house rev2 seals (unchanged this round)"),
        ),
    ]
}

#[test]
fn the_committed_artifact_is_exactly_the_built_specimens() {
    let art = load_committed();
    assert_eq!(art.schema, "bheraldry/records-json/1");
    let expect = expected();
    assert_eq!(
        art.records.len(),
        expect.len(),
        "one artifact row per specimen"
    );

    for (row, (id, sealed)) in art.records.iter().zip(expect.iter()) {
        assert_eq!(row.id, *id);
        assert_eq!(row.revision, sealed.record().revision);
        // the record validates on its own
        row.record.validate().expect("artifact record validates");
        // the record's own canonical bytes digest to the row's digest
        let bytes = row.record.canonical_bytes();
        assert_eq!(bytes.len(), row.canonical_bytes);
        assert_eq!(SymbolRecord::digest_of_bytes(&bytes).hex(), row.digest);
        // and those bytes are EXACTLY the fresh build's bytes
        assert_eq!(
            bytes,
            sealed.record().canonical_bytes(),
            "committed artifact drifted from the code — regenerate it"
        );
        assert_eq!(row.digest, sealed.digest().hex());
        // the supersedes link survived the round trip
        assert_eq!(
            row.supersedes.as_deref(),
            sealed.record().supersedes.map(|d| d.hex()).as_deref()
        );
    }
}

#[test]
fn a_tampered_artifact_is_refused_by_the_same_check() {
    let mut art = load_committed();
    // the attack: flip one translation's text in the shipped artifact
    art.records[0].record.motto.translations[3].text = "VIENOTIBA RADA SPEKU (tampered)".into();
    let bytes = art.records[0].record.canonical_bytes();
    let claimed = RecordDigest::of_bytes(
        bheraldry::RECORD_DOMAIN,
        &art.records[0].record.canonical_bytes(),
    );
    let _ = claimed;
    // the row's digest still names the ORIGINAL bytes, so verification
    // against the row's own claim fails:
    let row_digest_hex = art.records[0].digest.clone();
    let mut claimed_arr = [0u8; 32];
    for (i, chunk) in row_digest_hex.as_bytes().chunks(2).enumerate() {
        claimed_arr[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    match SealedRecord::from_bytes(&bytes, RecordDigest(claimed_arr)) {
        Err(LawViolation::DigestMismatch { .. }) => {}
        other => panic!("tampered artifact must be refused by name, got {other:?}"),
    }
}
