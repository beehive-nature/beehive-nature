//! The specimen receipt printer — bTunGsTeN §receipt style: observations
//! printed by the run itself, criteria named before the run (they are the
//! crate's tests), secrets asserted absent, boundaries stated per claim.
//!
//! Run: `cargo run -p bheraldry --bin specimen`
//!
//! `--export-json` prints the records JSON artifact instead (deterministic —
//! same bytes for the same code; consumed by surfaces/bheraldry.html and
//! verified against the freshly built seals by tests/artifact.rs):
//!   cargo run -p bheraldry --bin specimen -- --export-json \
//!     > surfaces/bheraldry-records.json

use bheraldry::specimen::{bulgaria_national_arms, house_achievement, ACCESS_DATE};
use bheraldry::{SealedRecord, SymbolRecord, TranslationRelationship};
use serde::Serialize;

#[derive(Serialize)]
struct ArtifactRecord {
    id: String,
    revision: u32,
    supersedes: Option<String>,
    digest: String,
    canonical_bytes: usize,
    record: SymbolRecord,
}

#[derive(Serialize)]
struct Artifact {
    schema: String,
    note: String,
    records: Vec<ArtifactRecord>,
}

fn export_json(bg: &SealedRecord, house: &SealedRecord) {
    let art = Artifact {
        schema: "bheraldry/records-json/1".into(),
        note: "Deterministic export of the bHERALDRY specimens at their current revisions. \
               Digests are sha256(bheraldry/record/1 ‖ NUL ‖ canonical JSON of `record`); \
               verify before trusting, and remember: unofficial translations are visibly \
               unattested machine drafts, and nothing here is reproduction permission."
            .into(),
        records: vec![bg, house]
            .into_iter()
            .map(|s| ArtifactRecord {
                id: s.record().id.clone(),
                revision: s.record().revision,
                supersedes: s.record().supersedes.map(|d| d.hex()),
                digest: s.digest().hex(),
                canonical_bytes: s.record().canonical_bytes().len(),
                record: s.record().clone(),
            })
            .collect(),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&art).expect("artifact JSON cannot fail")
    );
}

fn main() {
    let bg = bulgaria_national_arms()
        .seal()
        .expect("the specimen must seal");
    let house = house_achievement()
        .seal()
        .expect("the house record must seal");
    let bg_bytes = bg.record().canonical_bytes();
    let house_bytes = house.record().canonical_bytes();

    if std::env::args().nth(1).as_deref() == Some("--export-json") {
        export_json(&bg, &house);
        return;
    }

    println!("bHERALDRY specimen receipt — access date {ACCESS_DATE}");
    println!();

    println!(
        "== record: {} rev {} ==",
        bg.record().id,
        bg.record().revision
    );
    println!("classification: {:?}", bg.record().classification);
    println!("canonical bytes: {}", bg_bytes.len());
    println!("digest (sha256, domain {}):", bheraldry::RECORD_DOMAIN);
    println!("  {}", bg.digest().hex());
    println!(
        "motto original ({}): {}",
        bg.record().motto.original.lang,
        bg.record().motto.original.text()
    );
    println!(
        "motto original bytes: {}",
        bg.record().motto.original.bytes().len()
    );
    println!("translations: {}", bg.record().motto.translations.len());
    for t in &bg.record().motto.translations {
        let rel = format!("{:?}", t.relationship);
        let tier = match &t.attestation {
            language_authority::TranslationAttestation::Machine { engine } => {
                format!("MACHINE ({engine})")
            }
            language_authority::TranslationAttestation::SpeakerProvided { speaker } => {
                format!("speaker: {speaker}")
            }
            language_authority::TranslationAttestation::CommunityAttested { body } => {
                format!("community: {body}")
            }
        };
        println!("  [{:>4}] {:<18} {:<20} {}", t.lang, rel, tier, t.text);
    }
    println!(
        "glossary entries: {} (collisions: {})",
        bg.record().motto.glossary.entries.len(),
        bg.record().motto.glossary.collisions().len()
    );
    println!("sources: {}", bg.record().sources.len());
    for s in &bg.record().sources {
        println!("  [{:?}/{:?}/{:?}] {}", s.kind, s.truth, s.grade, s.label);
    }
    println!("usage conditions: {}", bg.record().usage.len());
    println!("associations: {}", bg.record().associations.len());
    println!("disputes retained: {}", bg.record().disputes.len());
    for d in &bg.record().disputes {
        println!("  - {} ({} positions)", d.topic, d.positions.len());
    }
    println!(
        "asset: {}",
        if bg.record().asset.is_none() {
            "NONE — state insignia bytes deliberately not captured"
        } else {
            "present"
        }
    );
    println!();

    println!(
        "== record: {} rev {} ==",
        house.record().id,
        house.record().revision
    );
    println!("classification: {:?}", house.record().classification);
    println!("canonical bytes: {}", house_bytes.len());
    println!("digest: {}", house.digest().hex());
    println!(
        "asset binding: {}:{}",
        house
            .record()
            .asset
            .as_ref()
            .expect("house record binds its asset")
            .path,
        bheraldry::HOUSE_ACHIEVEMENT_SHA256
    );
    println!();

    // counts by claim kind and grade, printed by this run (not by a wrapper)
    let mut kinds = std::collections::BTreeMap::new();
    let mut grades = std::collections::BTreeMap::new();
    let mut truths = std::collections::BTreeMap::new();
    for s in bg
        .record()
        .sources
        .iter()
        .chain(house.record().sources.iter())
    {
        *kinds.entry(format!("{:?}", s.kind)).or_insert(0u32) += 1;
        *grades.entry(format!("{:?}", s.grade)).or_insert(0u32) += 1;
        *truths.entry(format!("{:?}", s.truth)).or_insert(0u32) += 1;
    }
    println!("== claim counts (both records, printed by this run) ==");
    for (k, v) in &kinds {
        println!("  kind  {:<28} {}", k, v);
    }
    for (k, v) in &grades {
        println!("  grade {:<28} {}", k, v);
    }
    for (k, v) in &truths {
        println!("  truth {:<28} {}", k, v);
    }
    let machine_count = bg
        .record()
        .motto
        .translations
        .iter()
        .filter(|t| {
            matches!(
                t.attestation,
                language_authority::TranslationAttestation::Machine { .. }
            )
        })
        .count();
    println!(
        "  machine-draft translations: {} (none may be an official rendering)",
        machine_count
    );
    println!(
        "  official renderings: {}",
        bg.record()
            .motto
            .translations
            .iter()
            .filter(|t| t.relationship == TranslationRelationship::OfficialRendering)
            .count()
    );
    println!();

    println!("== boundaries (stated per claim) ==");
    println!("  - The Bulgarian record is a research/conformance specimen. Not permission to");
    println!("    reproduce; not BNR branding. Reproduction of elements requires an act of the");
    println!("    Council of Ministers (Чл. 3 (2)).");
    println!("  - Machine drafts are UNATTESTED (⚙). A machine translation is not an");
    println!("    authenticated historical quotation, and the validator refuses to let one be.");
    println!("  - Extraction is webReader/assistant-mediated; quote-level fidelity to the live");
    println!("    sources is UNVERIFIED beyond the verbatim strings recorded in each claim.");
    println!("  - No secrets are read, held, or printed by this crate or this run.");
    println!("  - Integrity of these observations is the tests' verdict, not this printout's.");
    println!(
        "  - The digest above is reproducible: sha256({} ‖ NUL ‖ canonical bytes).",
        bheraldry::RECORD_DOMAIN
    );

    let _ = SealedRecord::from_bytes(&bg_bytes, bg.digest())
        .expect("self-check: the printed record re-verifies");
}
