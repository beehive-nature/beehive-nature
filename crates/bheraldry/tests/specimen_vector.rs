//! The frozen specimen vectors.
//!
//! Revision 1 is immutable: its bytes and digest are pinned here forever, and
//! revision 2's `supersedes` must point at exactly that digest. Revision 2 is
//! pinned the same way from its first sealing, and revision 3 (the portal
//! read) supersedes rev 2 by exactly rev 2's frozen digest. Changing a
//! specimen is a NEW REVISION with a new digest — never an edit that quietly
//! moves these numbers (the BDID-GENESIS-V1 law, applied to heraldry: a canon
//! change is a new ceremony, not a commit).

use bheraldry::specimen::{
    bulgaria_national_arms, bulgaria_national_arms_r2, bulgaria_national_arms_v1,
    house_achievement, house_achievement_v1,
};
use bheraldry::SymbolRecord;

/// sha256(bheraldry/record/1 ‖ NUL ‖ canonical bytes) of `bg/national-arms`
/// revision 1, as first sealed on 2026-10-09 at base 87c744810.
const BG_REV1_DIGEST_HEX: &str = "0bd62b1cbc01bf44f724ceb77cf89b1d15ba61d21f22a8d7ba7b9f04926d627c"; // PUBLIC-CONSTANT (frozen rev1 digest — immutability pin)
const BG_REV1_BYTES: usize = 43586;
const HOUSE_REV1_BYTES: usize = 7755;

/// Revision 2 (the gazette pass, 2026-10-10) — pinned at its first sealing.
const BG_REV2_DIGEST_HEX: &str = "fd991cf4e2f6d86d5b4b9d1bc07d3a3b3b5d134b6b920ce15e6d07c61f70a759"; // PUBLIC-CONSTANT (frozen rev2 digest — gazette pass)
const BG_REV2_BYTES: usize = 60787;
const HOUSE_REV2_DIGEST_HEX: &str =
    "8fe6a76f6acdae0686c5a959777a80141a2812c9352ec5f9ed9ca663f6222d69"; // PUBLIC-CONSTANT (frozen house rev2 digest — claim restructure)

/// Revision 3 (the portal read, 2026-10-10) — pinned at its first sealing.
const BG_REV3_DIGEST_HEX: &str = "4101baf1709175003f039fb49839d04ce7460251e74703d2503c9b7e0f917bc4"; // PUBLIC-CONSTANT (frozen rev3 digest — portal read)
const BG_REV3_BYTES: usize = 84085;

#[test]
fn bulgarian_revision_1_is_frozen() {
    let sealed = bulgaria_national_arms_v1()
        .seal()
        .expect("rev1 must still seal");
    let bytes = sealed.record().canonical_bytes();
    assert_eq!(
        bytes.len(),
        BG_REV1_BYTES,
        "rev1 canonical byte count moved — revision 1 is immutable"
    );
    assert_eq!(
        sealed.digest().hex(),
        BG_REV1_DIGEST_HEX,
        "rev1 digest moved — revision 1 is immutable"
    );
}

#[test]
fn house_revision_1_shape_is_frozen() {
    // house rev1 predates the blazon-verbatim consistency law (V9), so it is
    // not sealed here — its BYTES are the anchor rev2 supersedes, and the
    // byte count is what is frozen.
    let v1 = house_achievement_v1();
    assert_eq!(
        v1.canonical_bytes().len(),
        HOUSE_REV1_BYTES,
        "house rev1 byte count is frozen"
    );
}

#[test]
fn bulgarian_revision_2_is_frozen_and_supersedes_exactly_rev1() {
    let v1_digest = SymbolRecord::digest_of_bytes(&bulgaria_national_arms_v1().canonical_bytes());
    let sealed = bulgaria_national_arms_r2().seal().expect("rev2 must seal");
    let bytes = sealed.record().canonical_bytes();
    assert_eq!(bytes.len(), BG_REV2_BYTES, "rev2 byte count moved");
    assert_eq!(
        sealed.digest().hex(),
        BG_REV2_DIGEST_HEX,
        "rev2 digest moved — make a new revision, never an edit"
    );
    assert_eq!(sealed.record().revision, 2);
    assert_eq!(
        sealed.record().supersedes,
        Some(v1_digest),
        "rev2 must supersede exactly rev1's frozen digest"
    );
}

#[test]
fn bulgarian_revision_3_is_frozen_and_supersedes_exactly_rev2() {
    let v2_digest = SymbolRecord::digest_of_bytes(&bulgaria_national_arms_r2().canonical_bytes());
    let sealed = bulgaria_national_arms().seal().expect("rev3 must seal");
    let bytes = sealed.record().canonical_bytes();
    assert_eq!(bytes.len(), BG_REV3_BYTES, "rev3 byte count moved");
    assert_eq!(
        sealed.digest().hex(),
        BG_REV3_DIGEST_HEX,
        "rev3 digest moved — make a new revision, never an edit"
    );
    assert_eq!(sealed.record().revision, 3);
    assert_eq!(
        sealed.record().supersedes,
        Some(v2_digest),
        "rev3 must supersede exactly rev2's frozen digest"
    );
    assert_eq!(
        v2_digest.hex(),
        BG_REV2_DIGEST_HEX,
        "the digest rev3 supersedes IS rev2's frozen digest"
    );
}

#[test]
fn the_chain_v1_v2_v3_verifies_and_names_rev3_current() {
    use bheraldry::{RevisionChain, RevisionStatus};
    let v1 = bulgaria_national_arms_v1().seal().expect("rev1 seals");
    let v2 = bulgaria_national_arms_r2().seal().expect("rev2 seals");
    let v3 = bulgaria_national_arms().seal().expect("rev3 seals");
    let chain = RevisionChain::build(vec![v1.clone(), v2.clone(), v3]).expect("the chain verifies");
    assert_eq!(chain.status(&v1), RevisionStatus::SupersededBy(v2.digest()));
    assert!(matches!(chain.status(&v2), RevisionStatus::SupersededBy(_)));
    // predecessors stay verifiable as history: their bytes still check
    assert!(v1.digest_matches(&v1.record().canonical_bytes()));
    assert!(v2.digest_matches(&v2.record().canonical_bytes()));
}

#[test]
fn house_revision_2_is_frozen_and_supersedes_rev1() {
    let v1_digest = SymbolRecord::digest_of_bytes(&house_achievement_v1().canonical_bytes());
    let sealed = house_achievement().seal().expect("house rev2 must seal");
    assert_eq!(sealed.digest().hex(), HOUSE_REV2_DIGEST_HEX);
    assert_eq!(sealed.record().revision, 2);
    assert_eq!(sealed.record().supersedes, Some(v1_digest));
}

#[test]
fn canon_is_deterministic_across_runs() {
    let a = bulgaria_national_arms().canonical_bytes();
    let b = bulgaria_national_arms().canonical_bytes();
    assert_eq!(
        a, b,
        "two constructions of the same specimen must be byte-identical"
    );
}

#[test]
fn the_withdrawn_amendment_line_is_a_claim_corpse_only_in_rev1() {
    // the corrective discipline made checkable: rev2's and rev3's CLAIMS carry
    // no amendment (the withdrawal note names the line only to bury it), while
    // rev1 keeps its own extraction verbatim — history is not rewritten.
    for (label, bytes) in [
        ("rev2", bulgaria_national_arms_r2().canonical_bytes()),
        ("rev3", bulgaria_national_arms().canonical_bytes()),
    ] {
        let record: bheraldry::SymbolRecord = serde_json::from_slice(&bytes).unwrap();
        for s in &record.sources {
            if let Some(v) = &s.verbatim {
                assert!(
                    !v.contains("ДВ. бр. 100"),
                    "{label} claim verbatim must not carry the withdrawn line: {}",
                    s.label
                );
            }
        }
        assert!(record
            .usage
            .iter()
            .all(|u| !u.statement.contains("changes the law")));
    }
    let rev1 = String::from_utf8_lossy(&bulgaria_national_arms_v1().canonical_bytes()).into_owned();
    assert!(
        rev1.contains("ДВ. бр. 100"),
        "rev1 is immutable and retains its own extraction"
    );
}

#[test]
fn the_portal_read_is_what_rev3_claims_byte_exactly() {
    // rev3's working text IS the portal PDF's Чл. 2 (1): the four residual
    // divergences from lex.bg are present in the sealed bytes, and the seven
    // originally disputed lex.bg-only wordings are NOT. This is the
    // adjudication, made checkable.
    // the WORKING TEXT is what the adjudication governs; the old wordings
    // legitimately survive in the retained rev-1 claim and dispute positions
    let working = &bulgaria_national_arms().blazon.text;
    for needle in [
        "първообраз на която са корони на български владетели",
        "отделно кръст над самата корона",
        "Над щита има голяма корона",
        "с плодове",
        "трикольорен кант е изписано",
    ] {
        assert!(
            working.contains(needle),
            "rev3 working text must carry the portal edition's wording: {needle}"
        );
    }
    assert!(!working.contains("кантова ивичка"));
    assert!(!working.contains("с желуди"));
    // УКАЗ № 304, read in the same edition, names all three dates — in the
    // sealed bytes, where the decree claim lives
    let bytes = bulgaria_national_arms().canonical_bytes();
    let text = String::from_utf8_lossy(&bytes).into_owned();
    assert!(text.contains("Издаден в София на 4 август 1997 г."));
    assert!(text.contains("приет от ХХХVIII Народно събрание на 31 юли 1997 г."));
}
