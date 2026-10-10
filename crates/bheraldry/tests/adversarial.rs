//! The ten deliberately misleading specimens (order bHERALDRY-001 §8).
//!
//! Each test CONSTRUCTS the attack, then asserts the detector fires — a
//! named `LawViolation`, a refused verify, or a visible collision. A test
//! that only showed a clean process exit would be a decoration; every one
//! here ends in a refusal with a name.

use bheraldry::specimen::{bulgaria_national_arms, house_achievement, successor, ACCESS_DATE};
use bheraldry::*;

/// Attack 1 — alter the motto after the translations were made.
/// The attacker swaps the original inscription in a decoded record. The
/// translations still bind the ORIGINAL's digest, so validation refuses:
/// the alteration orphans every translation at once.
#[test]
fn a01_altered_motto_after_translation_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r.motto.original = OriginalText::new(
        "Силата прави съединението",
        "bg",
        Some("Cyrl"),
        r.sources[0].clone(),
    )
    .unwrap();
    let err = r.validate().unwrap_err();
    match &err {
        LawViolation::TranslationTargetsDifferentOriginal {
            lang,
            expected,
            found,
        } => {
            assert_eq!(lang, "en");
            assert_ne!(expected, found);
        }
        other => panic!("wrong detector fired: {other:?}"),
    }
    // and even if the attacker skips validation, the sealed digest drifts
    let tampered_bytes = r.canonical_bytes();
    assert!(!sealed.digest_matches(&tampered_bytes));
}

/// Attack 2 — replace the historical image with a visually similar
/// counterfeit. The record binds a sha256, not a look: the counterfeit is
/// different bytes, therefore a different thing.
#[test]
fn a02_visually_similar_counterfeit_image_is_detected() {
    let sealed = house_achievement().seal().unwrap();
    let asset = sealed.record().asset.clone().unwrap();
    // a byte-flipped lookalike of the real file
    let manifest = env!("CARGO_MANIFEST_DIR");
    let real_file = std::path::Path::new(manifest)
        .join("../../")
        .join(&asset.path);
    let bytes = std::fs::read(&real_file).expect("in-tree asset exists");
    let mut lookalike = bytes.clone();
    let last = lookalike.len() - 1;
    lookalike[last] ^= 0x01;
    assert!(
        !asset.verify_bytes(&lookalike),
        "one flipped byte must fail the binding — visual similarity is not identity"
    );
    // and the true bytes DO verify (the detector is strict, not "always no")
    assert!(
        asset.verify_bytes(&bytes),
        "the true bytes must verify — otherwise the detector is broken, not strict"
    );
}

/// Attack 3 — attribute the emblem to the wrong family. Two forms: an
/// association with no documentary source, and an official record whose
/// entity was swapped to an unrelated family.
#[test]
fn a03_wrong_family_attribution_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    // 3a: unsourced association (family claim with an internal-tree source)
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r.associations.push(HeraldicAssociation {
        subject: AssociationSubject::Family {
            name: "House of Zutphen".into(),
        },
        basis: AssociationBasis::Charter,
        source: SourceClaim {
            label: "in-tree prose only".into(),
            url: "docs/BLAZON.md".into(),
            publisher: "internal".into(),
            lang: "en".into(),
            accessed: ACCESS_DATE.into(),
            kind: ClaimKind::Historical,
            truth: TruthKind::HistoricalInterpretation,
            grade: ProvenanceGrade::InternalTree,
            verbatim: None,
            access_note: None,
        },
        note: None,
    });
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::DocumentaryBasisNeedsExternalSource
    );

    // 3b: entity swapped while keeping official classification
    let mut r2: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r2.entity = AssociationSubject::Family {
        name: "House of Remington".into(),
    };
    assert_eq!(
        r2.validate().unwrap_err(),
        LawViolation::OfficialEntityNeedsLegalAssociation
    );
}

/// Attack 4 — swap source metadata while keeping the (valid) image. The
/// record digest covers sources too; metadata surgery is digest drift.
#[test]
fn a04_source_metadata_swap_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r.sources[0].url = "https://evil.example/law".into();
    r.sources[0].publisher = "Evil Press".into();
    let tampered = r.canonical_bytes();
    assert!(
        !sealed.digest_matches(&tampered),
        "source metadata is part of the record; swapping it must move the digest"
    );
    let err = SealedRecord::from_bytes(&tampered, sealed.digest()).unwrap_err();
    assert!(matches!(err, LawViolation::DigestMismatch { .. }));
}

/// Attack 5 — reuse a valid signature under a different identity or record.
/// The structural layer: the seal's domain and payload digest refuse the
/// swap. (The cryptographic layer — a real bsigner envelope — is exercised
/// in tests/bsigner_seam.rs.)
#[test]
fn a05_signature_reuse_across_records_or_domains_is_detected() {
    let bg = bulgaria_national_arms().seal().unwrap();
    let house = house_achievement().seal().unwrap();
    let did = bzdid::BzDid::derive(b"bheraldry seam test signer");
    let seal = SignedSeal::new(did.as_str(), "key-1", bg.digest(), None).unwrap();

    // present the seal for the HOUSE record's bytes: payload digest mismatch
    let house_bytes = house.record().canonical_bytes();
    assert!(matches!(
        seal.verify_structure(&house_bytes),
        Err(LawViolation::DigestMismatch { .. })
    ));

    // a seal from a different domain (an attacker's vocabulary) is refused
    let mut foreign: SignedSeal =
        serde_json::from_str(&serde_json::to_string(&seal).unwrap()).unwrap();
    foreign.domain = "evil/attest/1".into();
    assert!(matches!(
        foreign.verify_structure(&bg.record().canonical_bytes()),
        Err(LawViolation::WrongSealDomain { .. })
    ));

    // a signer that is not a did:b: cannot even construct
    assert!(SignedSeal::new("did:key:z6Mk", "key-1", bg.digest(), None).is_err());
}

/// Attack 6 — convert a creative asset into false official insignia. The
/// classification flip is refused: official status is earned by law, and
/// the house record has no legal source or usage.
#[test]
fn a06_creative_asset_relabelled_official_is_detected() {
    let sealed = house_achievement().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r.classification = Classification::OfficialStateInsignia;
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::OfficialClassNeedsLegalSource
    );

    // even after grafting a fake "legal" source, the usage condition is missing
    r.sources.push(SourceClaim {
        label: "fake law".into(),
        url: "https://evil.example/law".into(),
        publisher: "Evil Press".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: None,
        access_note: None,
    });
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::OfficialClassNeedsLegalUsage
    );
}

/// Attack 7 — misidentify a living genealogical subject. A living person is
/// a pseudonym; a name is a doxx and the record refuses to carry it.
#[test]
fn a07_living_person_named_is_detected() {
    let sealed = house_achievement().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r.associations.push(HeraldicAssociation {
        subject: AssociationSubject::Person {
            name: Some("A Living Descendant".into()),
            pseudonym: None,
            living: true,
        },
        basis: AssociationBasis::SecondaryScholarship,
        source: SourceClaim {
            label: "some compiled genealogy".into(),
            url: "https://example.org/gen".into(),
            publisher: "Example".into(),
            lang: "en".into(),
            accessed: ACCESS_DATE.into(),
            kind: ClaimKind::Historical,
            truth: TruthKind::HistoricalInterpretation,
            grade: ProvenanceGrade::SecondaryScholarly,
            verbatim: None,
            access_note: None,
        },
        note: None,
    });
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::LivingPersonNameForbidden
    );

    // the lawful form — a pseudonym on a documentary external source — passes
    let mut r2: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    r2.associations.push(HeraldicAssociation {
        subject: AssociationSubject::living_pseudonym("liv-7"),
        basis: AssociationBasis::SecondaryScholarship,
        source: SourceClaim {
            label: "an external scholarly armorial (hypothetical, for the control)".into(),
            url: "https://example.org/armorial".into(),
            publisher: "Example Academic Press".into(),
            lang: "en".into(),
            accessed: ACCESS_DATE.into(),
            kind: ClaimKind::Historical,
            truth: TruthKind::HistoricalInterpretation,
            grade: ProvenanceGrade::SecondaryScholarly,
            verbatim: None,
            access_note: None,
        },
        note: None,
    });
    assert!(r2.validate().is_ok());
}

/// Attack 8 — present a stale source revision as current. The chain names
/// the current revision; the predecessor presented as current is refused.
#[test]
fn a08_stale_revision_as_current_is_detected() {
    let rev1 = bulgaria_national_arms().seal().unwrap();
    let rev2 = successor(&rev1, "a correction that must not rewrite history")
        .seal()
        .unwrap();
    let chain = RevisionChain::build(vec![rev1.clone(), rev2]).unwrap();

    match chain.assert_current(&rev1) {
        Err(LawViolation::StaleRevision { id, revision, .. }) => {
            assert_eq!(id, "bg/national-arms");
            assert_eq!(revision, 1);
        }
        other => panic!("wrong detector: {other:?}"),
    }
    assert!(chain.current().record().revision == 2);
}

/// Attack 9 — drop critical heraldic distinctions during translation. Two
/// different postures rendered by one word in the target language is a
/// collision, and the glossary detector names it.
#[test]
fn a09_dropped_heraldic_distinction_is_detected() {
    let sample = bheraldry::specimen::bulgaria_national_arms();
    let law = sample.sources[0].clone();
    let lossy = TermGlossary {
        entries: vec![
            TermEntry {
                source_term: "изправен".into(),
                source_lang: "bg".into(),
                target_term: "lion pose".into(),
                target_lang: "en".into(),
                source: law.clone(),
            },
            TermEntry {
                source_term: "ходещ".into(),
                source_lang: "bg".into(),
                target_term: "lion pose".into(),
                target_lang: "en".into(),
                source: law.clone(),
            },
            TermEntry {
                source_term: "клекнал".into(),
                source_lang: "bg".into(),
                target_term: "lion pose".into(),
                target_lang: "en".into(),
                source: law,
            },
        ],
    };
    let collisions = lossy.collisions();
    assert_eq!(
        collisions.len(),
        2,
        "three collapsed terms yield two named pair-collisions"
    );
    assert!(collisions.iter().all(|c| c.shared_target == "lion pose"));
    // the shipped glossary keeps rampant distinct from everything else
    assert!(sample.motto.glossary.collisions().is_empty());
}

/// Attack 10 — migrate storage without preserving the record and its
/// provenance. A lossy migration (usage conditions and disputes dropped)
/// fails validation AND drifts the digest; a lossless migration is
/// byte-identical.
#[test]
fn a10_lossy_migration_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let bytes = sealed.record().canonical_bytes();

    // lossless "migration": decode and re-serialize through a fresh warehouse
    // representation — a migration that preserves everything changes no bytes
    let lossless = serde_json::from_slice::<SymbolRecord>(&bytes)
        .unwrap()
        .canonical_bytes();
    assert_eq!(
        lossless, bytes,
        "a migration that changes nothing must change no bytes"
    );

    // lossy migration: drop usage + disputes + one source
    let mut migrated: SymbolRecord = serde_json::from_slice(&bytes).unwrap();
    migrated.usage.clear();
    migrated.disputes.clear();
    migrated.sources.truncate(1);
    let migrated_bytes = migrated.canonical_bytes();
    assert!(
        !sealed.digest_matches(&migrated_bytes),
        "provenance loss is digest drift"
    );
    // and the record that lost its usage can no longer pass as official
    assert_eq!(
        migrated.validate().unwrap_err(),
        LawViolation::OfficialClassNeedsLegalUsage
    );
}
