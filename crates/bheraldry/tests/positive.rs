//! Positive laws: the things that must hold for honest records.
//! The adversarial suite (adversarial.rs) shows the refusals; this file
//! shows the guarantees the refusals protect.

use bheraldry::specimen::{bulgaria_national_arms, house_achievement, successor};
use bheraldry::*;
use language_authority::TranslationAttestation;
use std::io::Read;

fn repo_asset(path: &str) -> Vec<u8> {
    let manifest = env!("CARGO_MANIFEST_DIR");
    let full = std::path::Path::new(manifest).join("../..").join(path);
    let mut f = std::fs::File::open(&full).unwrap_or_else(|e| panic!("cannot open {path}: {e}"));
    let mut v = Vec::new();
    f.read_to_end(&mut v).unwrap();
    v
}

#[test]
fn both_specimens_seal_and_round_trip() {
    for sealed in [
        bulgaria_national_arms().seal().unwrap(),
        house_achievement().seal().unwrap(),
    ] {
        let bytes = sealed.record().canonical_bytes();
        // decode → re-canonicalize → decode: the bytes survive the loop
        let back = SealedRecord::from_bytes(&bytes, sealed.digest()).expect("round trip");
        assert_eq!(back.record().canonical_bytes(), bytes);
        // and the seal's own integrity check
        assert!(sealed.digest_matches(&bytes));
    }
}

#[test]
fn bulgarian_cyrillic_original_survives_every_layer_byte_exact() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let bytes = sealed.record().canonical_bytes();
    let back = SealedRecord::from_bytes(&bytes, sealed.digest()).unwrap();
    assert_eq!(
        back.record().motto.original.text().as_bytes(),
        "Съединението прави силата".as_bytes(),
        "the original inscription must survive canonical serialization byte-exact"
    );
    // and the law's own wording of it is in the verbatim quote
    let law = &back.record().sources[0];
    assert!(law
        .verbatim
        .as_ref()
        .unwrap()
        .contains("Съединението прави силата"));
}

#[test]
fn nfc_and_nfd_are_different_records_not_silently_merged() {
    // „Съединението“ with a combining accent instead of precomposed е is a
    // DIFFERENT byte string. This crate preserves bytes; it does not
    // normalize. Different bytes ⇒ different digest ⇒ visible, not merged.
    let nfc = OriginalText::new(
        "Съединението прави силата",
        "bg",
        None,
        bheraldry::specimen::bulgaria_national_arms().sources[0].clone(),
    )
    .unwrap();
    let decomposed = "Съединението".replace('е', "е\u{0301}"); // force one decomposed pair
    let nfd = OriginalText::new(
        &format!("{} прави силата", decomposed),
        "bg",
        None,
        bheraldry::specimen::bulgaria_national_arms().sources[0].clone(),
    )
    .unwrap();
    assert_ne!(
        nfc.bytes(),
        nfd.bytes(),
        "combining characters must not be normalized away"
    );
    assert_ne!(nfc.digest(), nfd.digest());
}

#[test]
fn malformed_encoding_is_refused_not_repaired() {
    // 0xD0 0x41 is not valid UTF-8 (continuation byte missing)
    let bad: &[u8] = &[0xD0, 0x41, 0x20, 0x78];
    let err = OriginalText::from_bytes(
        bad,
        "bg",
        None,
        bheraldry::specimen::bulgaria_national_arms().sources[0].clone(),
    )
    .unwrap_err();
    assert_eq!(err, LawViolation::InvalidUtf8);
}

#[test]
fn every_translation_binds_and_declares_its_provenance() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let original = sealed.record().motto.original.digest();
    for t in &sealed.record().motto.translations {
        assert_eq!(t.translates_original, original);
        // the bLANGUAGEdock law: a rendering of unknown provenance cannot
        // exist — and machine drafts are visibly machine
        match &t.attestation {
            TranslationAttestation::Machine { engine } => assert!(!engine.is_empty()),
            TranslationAttestation::SpeakerProvided { speaker } => assert!(!speaker.is_empty()),
            TranslationAttestation::CommunityAttested { body } => assert!(!body.is_empty()),
        }
    }
    // the tiers stay visibly distinct in the canon
    let m = serde_json::to_string(&TranslationAttestation::Machine { engine: "e".into() }).unwrap();
    let s = serde_json::to_string(&TranslationAttestation::SpeakerProvided {
        speaker: "p".into(),
    })
    .unwrap();
    assert_ne!(m, s);
}

#[test]
fn rtl_field_round_trips_and_logical_order_is_preserved() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    let ar = sealed
        .record()
        .motto
        .translations
        .iter()
        .find(|t| t.lang == "ar")
        .expect("the Arabic machine draft exists");
    assert_eq!(ar.direction, Direction::Rtl);
    let bytes = sealed.record().canonical_bytes();
    let back = SealedRecord::from_bytes(&bytes, sealed.digest()).unwrap();
    let ar2 = back
        .record()
        .motto
        .translations
        .iter()
        .find(|t| t.lang == "ar")
        .unwrap();
    assert_eq!(
        ar2.text.as_bytes(),
        ar.text.as_bytes(),
        "serialization must not reorder RTL logical order"
    );
}

#[test]
fn specimen_glossary_keeps_every_distinct_posture_distinct() {
    let sealed = bulgaria_national_arms().seal().unwrap();
    assert!(
        sealed.record().motto.glossary.collisions().is_empty(),
        "the shipped glossary must not collapse distinctions"
    );
}

#[test]
fn house_asset_binding_is_live() {
    // The house record binds the sha256 of the in-tree asset. If the asset
    // changes, THIS fails — correctly: a provenance binding that survives
    // its asset being swapped is not a binding.
    let sealed = house_achievement().seal().unwrap();
    let asset = sealed.record().asset.as_ref().unwrap();
    let bytes = repo_asset(&asset.path);
    assert!(
        asset.verify_bytes(&bytes),
        "assets/house/house-achievement.svg no longer matches its bound digest {} — update the binding deliberately (a new record revision)",
        HOUSE_ACHIEVEMENT_SHA256
    );
}

#[test]
fn revisions_succeed_without_rewriting_history() {
    let rev1 = bulgaria_national_arms().seal().unwrap();
    let rev2_record = successor(&rev1, "demonstrating the correction path");
    let rev2 = rev2_record.seal().unwrap();
    let chain = RevisionChain::build(vec![rev1.clone(), rev2.clone()]).unwrap();

    assert!(matches!(chain.status(&rev2), RevisionStatus::Current));
    // the predecessor remains verifiable as history — bytes untouched
    let rev1_bytes = rev1.record().canonical_bytes();
    assert!(rev1.digest_matches(&rev1_bytes));
    assert_eq!(chain.current().record().revision, 2);
    // and its record still decodes and validates on its own
    assert!(SealedRecord::from_bytes(&rev1_bytes, rev1.digest()).is_ok());
}

#[test]
fn the_seal_binds_domain_and_did() {
    // a real-shape did:b: (52 lowercase base32 chars) — the parser law
    let did = bzdid::BzDid::derive(b"bheraldry seam test signer");
    let sealed = bulgaria_national_arms().seal().unwrap();
    let seal = SignedSeal::new(did.as_str(), "test-key-1", sealed.digest(), None).unwrap();
    let payload = seal.payload_bytes(&sealed.record().canonical_bytes());
    assert!(payload.starts_with(b"bheraldry/attest/v1\x00"));
    assert!(seal
        .verify_structure(&sealed.record().canonical_bytes())
        .is_ok());
    // a did that is not did:b: shape is refused at construction
    assert!(SignedSeal::new("did:key:z6Mk", "k", sealed.digest(), None).is_err());
}
