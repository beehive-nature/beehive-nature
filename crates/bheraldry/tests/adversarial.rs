//! The ten deliberately misleading specimens (order bHERALDRY-001 §8).
//!
//! Each test CONSTRUCTS the attack, then asserts the detector fires — a
//! named `LawViolation`, a refused verify, or a visible collision. A test
//! that only showed a clean process exit would be a decoration; every one
//! here ends in a refusal with a name.

use bheraldry::specimen::{
    bulgaria_national_arms, bulgaria_national_arms_v1, house_achievement, successor, ACCESS_DATE,
};
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
/// Exercised BOTH on the synthetic successor and on the REAL revision pair
/// (rev1 frozen forever, rev2 the gazette pass that supersedes it).
#[test]
fn a08_stale_revision_as_current_is_detected() {
    // synthetic pair
    let rev1 = bulgaria_national_arms_v1().seal().unwrap();
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

    // the real chain: immutable rev1 and rev2 vs the shipped rev3
    let v1 = bulgaria_national_arms_v1().seal().unwrap();
    let v2 = bheraldry::specimen::bulgaria_national_arms_r2()
        .seal()
        .unwrap();
    let v3 = bulgaria_national_arms().seal().unwrap();
    let real = RevisionChain::build(vec![v1.clone(), v2.clone(), v3.clone()]).unwrap();
    // each stale revision is named as superseded by its IMMEDIATE successor
    // (v1 by v2, v2 by v3), while only v3 is the chain's current
    for (stale, superseder) in [(&v1, v2.digest()), (&v2, v3.digest())] {
        match real.assert_current(stale) {
            Err(LawViolation::StaleRevision {
                revision,
                superseded_by,
                ..
            }) => {
                assert!(revision == 1 || revision == 2);
                assert_eq!(superseded_by, superseder.hex());
            }
            other => panic!("real revision chain must detect the stale presentation: {other:?}"),
        }
    }
    assert_eq!(real.current().record().revision, 3);
}

// ── round-2 regressions (the gazette pass) ────────────────────────────────────

/// Regression r1 — swap the working text while keeping the source's verbatim
/// quote (the metadata/working-text split). Detected by the V9 law.
#[test]
fn r01_blazon_text_swapped_keeping_verbatim_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    // one word changed in the working text, verbatim quote untouched
    r.blazon.text = r.blazon.text.replacen("плодове", "желуди", 1);
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::BlazonTextDivergesFromSourceVerbatim
    );
    // and the frozen digest refuses the swap even without validation
    assert!(!sealed.digest_matches(&r.canonical_bytes()));
}

/// Regression r2 — swap the gazette-portal claim's URL (source-metadata
/// surgery on the NEW claim class): digest drift + named mismatch.
#[test]
fn r02_gazette_claim_url_swap_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let portal = r
        .sources
        .iter_mut()
        .find(|s| s.url.contains("dv.parliament.bg"))
        .expect("the gazette portal claim is present in rev2");
    portal.url = "https://evil.example/gazette".into();
    let tampered = r.canonical_bytes();
    assert!(!sealed.digest_matches(&tampered));
    assert!(matches!(
        SealedRecord::from_bytes(&tampered, sealed.digest()),
        Err(LawViolation::DigestMismatch { .. })
    ));
}

/// Regression r3 — resurrect the withdrawn amendment line in a rev2 claim:
/// the corrective discipline's corpse stays buried, checkably.
#[test]
fn r03_withdrawal_rollback_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let adoption = r
        .sources
        .iter_mut()
        .find(|s| s.label.contains("adoption and promulgation"))
        .expect("the r2 adoption claim is present");
    adoption.verbatim = Some(format!(
        "{} изм. - ДВ. бр. 100 от 29 Декември 2017г.",
        adoption.verbatim.clone().unwrap()
    ));
    // the resurrection is a NEW canonical form: the frozen vector test pins
    // rev2's true bytes, and any hand-off checking digests sees this drift;
    // the detector here is the digest itself
    assert!(
        !sealed.digest_matches(&r.canonical_bytes()),
        "a rolled-back withdrawal must not verify as the shipped rev2"
    );
    // and the record it produces still round-trips — the point is that it is
    // NOT the shipped record, which only the digest can prove
    let _ = SealedRecord::from_bytes(
        &r.canonical_bytes(),
        bheraldry::SymbolRecord::digest_of_bytes(&r.canonical_bytes()),
    )
    .expect("decodes; it is simply a different, unshipped record");
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

// ── round-3 regressions (the portal read) ─────────────────────────────────────

/// Regression r4 — present the lex.bg rendering as the working text while
/// citing the portal PDF as the source: the exact transport-misattribution
/// the portal read could have enabled. Detected by the V9 law, and by the
/// frozen digest refusing the swap.
#[test]
fn r04_portal_claim_paired_with_lex_text_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    // the rev2 lex.bg text, spliced in as the working text under the portal claim
    let lex = bheraldry::specimen::bulgaria_national_arms_r2();
    r.blazon.text = lex.blazon.text.clone();
    assert_eq!(
        r.validate().unwrap_err(),
        LawViolation::BlazonTextDivergesFromSourceVerbatim,
        "the blazon must carry exactly the portal edition's bytes it claims to read from"
    );
    assert!(!sealed.digest_matches(&r.canonical_bytes()));
}

/// Regression r5 — roll back the adoption-date resolution: strip the УКАЗ №
/// 304 position and the resolution note, quietly re-opening the dispute the
/// primary evidence closed. No `LawViolation` fires here BY DESIGN and this
/// test says so on its face: dispute notes are not law-protected state, so
/// the FROZEN DIGEST is the only guard — the rolled-back record still
/// validates cleanly (asserted below, so the guard's solitude is itself
/// checkable), and only the digest refuses it as the shipped rev3.
#[test]
fn r05_resolution_rollback_is_detected() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let d = r
        .disputes
        .iter_mut()
        .find(|d| d.topic.contains("adopted"))
        .expect("the adoption-date dispute is present");
    // roll the resolution back: drop the УКАЗ № 304 position and the note
    let before = d.positions.len();
    d.positions.retain(|p| !p.statement.contains("УКАЗ № 304"));
    assert_eq!(d.positions.len(), before - 1, "the position was removed");
    d.note = Some("RETAINED, not adjudicated.".into());
    // the rolled-back record is structurally lawful — the digest is the ONLY
    // thing standing between it and a reader (independent-review finding 1
    // made checkable instead of hidden)
    assert!(
        r.validate().is_ok(),
        "the rollback passes the laws — only the frozen digest catches it"
    );
    assert!(
        !sealed.digest_matches(&r.canonical_bytes()),
        "a rolled-back resolution must not verify as the shipped rev3"
    );
    // and the shipped record itself carries the decree's date line, so the
    // corpse of the resolution is checkable while it lives
    let shipped = String::from_utf8_lossy(&sealed.record().canonical_bytes()).into_owned();
    assert!(shipped.contains("Издаден в София на 4 август 1997 г."));
    assert!(shipped.contains("RESOLVED BY PRIMARY EVIDENCE"));
}

/// Regression r6 — launder a machine draft into an official rendering, three
/// ways: machine attestation under the official relationship; a speaker
/// claim without any authority basis; and a speaker claim whose "basis" is a
/// tertiary wiki page. All three are named refusals — the bLANGUAGEdock
/// tier can be carried honestly, never forged into authority.
#[test]
fn r06_machine_draft_laundered_into_official_is_detected() {
    use language_authority::TranslationAttestation;
    let sealed = bulgaria_national_arms().seal().unwrap();

    // (a) the ⚙ machine draft, relabelled OfficialRendering as-is
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let t = r
        .motto
        .translations
        .iter_mut()
        .find(|t| t.lang == "lv" && matches!(t.attestation, TranslationAttestation::Machine { .. }))
        .expect("the lv machine draft is present");
    t.relationship = TranslationRelationship::OfficialRendering;
    // graft a legal-grade basis FIRST, so what remains wrong is exactly the
    // machine attestation under the official relationship
    let legal = r
        .sources
        .iter()
        .find(|s| s.grade == ProvenanceGrade::PrimaryLegal)
        .expect("a primary-legal source is present")
        .clone();
    t.authority_basis = Some(legal);
    assert!(matches!(
        r.validate().unwrap_err(),
        LawViolation::MachineCannotBeOfficial { lang } if lang == "lv"
    ));
    assert!(!sealed.digest_matches(&r.canonical_bytes()));

    // (b) the documented variant, promoted with NO basis at all
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let t = r
        .motto
        .translations
        .iter_mut()
        .find(|t| t.lang == "ar" && t.text.contains("تولد"))
        .expect("the ar documented variant is present");
    t.relationship = TranslationRelationship::OfficialRendering;
    t.authority_basis = None;
    assert!(matches!(
        r.validate().unwrap_err(),
        LawViolation::OfficialRenderingNeedsAuthorityBasis { lang } if lang == "ar"
    ));
    assert!(!sealed.digest_matches(&r.canonical_bytes()));

    // (c) the documented variant, promoted with a TERTIARY wiki "basis" —
    // grade is a fact about the channel, and a wiki page is not authority
    let mut r: SymbolRecord = serde_json::from_slice(&sealed.record().canonical_bytes()).unwrap();
    let t = r
        .motto
        .translations
        .iter_mut()
        .find(|t| t.lang == "ar" && t.text.contains("تولد"))
        .expect("the ar documented variant is present");
    t.relationship = TranslationRelationship::OfficialRendering;
    let wiki_basis = r
        .sources
        .iter()
        .find(|s| s.label.contains("Arabic Wikipedia"))
        .expect("the ar wiki claim is in sources")
        .clone();
    t.authority_basis = Some(wiki_basis);
    assert!(matches!(
        r.validate().unwrap_err(),
        LawViolation::OfficialRenderingNeedsAuthorityBasis { lang } if lang == "ar"
    ));
    // and the launder drifts the digest — none of the three ships as rev3
    assert!(!sealed.digest_matches(&r.canonical_bytes()));
}
