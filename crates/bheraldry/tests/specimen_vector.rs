//! The frozen specimen vectors.
//!
//! Revision 1 is immutable: its bytes and digest are pinned here forever, and
//! revision 2's `supersedes` must point at exactly that digest. Revision 2 is
//! pinned the same way from its first sealing. Changing a specimen is a NEW
//! REVISION with a new digest — never an edit that quietly moves these
//! numbers (the BDID-GENESIS-V1 law, applied to heraldry: a canon change is
//! a new ceremony, not a commit).

use bheraldry::specimen::{
    bulgaria_national_arms, bulgaria_national_arms_v1, house_achievement, house_achievement_v1,
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
    let sealed = bulgaria_national_arms().seal().expect("rev2 must seal");
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
    // the corrective discipline made checkable: rev2's CLAIMS carry no
    // amendment (the withdrawal note names the line only to bury it), while
    // rev1 keeps its own extraction verbatim — history is not rewritten.
    let rev2: bheraldry::SymbolRecord =
        serde_json::from_slice(&bulgaria_national_arms().canonical_bytes()).unwrap();
    for s in &rev2.sources {
        if let Some(v) = &s.verbatim {
            assert!(
                !v.contains("ДВ. бр. 100"),
                "rev2 claim verbatim must not carry the withdrawn line: {}",
                s.label
            );
        }
    }
    assert!(rev2
        .usage
        .iter()
        .all(|u| !u.statement.contains("changes the law")));
    let rev1 = String::from_utf8_lossy(&bulgaria_national_arms_v1().canonical_bytes()).into_owned();
    assert!(
        rev1.contains("ДВ. бр. 100"),
        "rev1 is immutable and retains its own extraction"
    );
}
