//! The frozen specimen vector.
//!
//! The canonical bytes and digest of the reference specimen at revision 1.
//! Changing the specimen is a NEW REVISION with a new digest — never an edit
//! that quietly moves this number (the BDID-GENESIS-V1 law, applied to
//! heraldry: a canon change is a v2 ceremony, not a commit).

use bheraldry::specimen::{bulgaria_national_arms, house_achievement};

/// sha256(bheraldry/record/1 ‖ NUL ‖ canonical bytes) of `bg/national-arms`
/// revision 1, as first sealed on 2026-10-09 at base 87c744810.
const BG_REV1_DIGEST_HEX: &str = "0bd62b1cbc01bf44f724ceb77cf89b1d15ba61d21f22a8d7ba7b9f04926d627c"; // PUBLIC-CONSTANT (frozen specimen digest, tests/specimen_vector.rs)
const BG_REV1_BYTES: usize = 43586;
const HOUSE_REV1_BYTES: usize = 7755;

#[test]
fn bulgarian_specimen_digest_is_frozen() {
    let sealed = bulgaria_national_arms()
        .seal()
        .expect("the specimen must seal");
    let bytes = sealed.record().canonical_bytes();
    assert_eq!(
        bytes.len(),
        BG_REV1_BYTES,
        "canonical byte count moved — the specimen changed"
    );
    assert_eq!(
        sealed.digest().hex(),
        BG_REV1_DIGEST_HEX,
        "digest moved — the specimen changed; make a new revision, never an edit"
    );
}

#[test]
fn house_record_shape_is_observed() {
    let sealed = house_achievement()
        .seal()
        .expect("the house record must seal");
    assert_eq!(sealed.record().canonical_bytes().len(), HOUSE_REV1_BYTES);
    // printed as an observation (not frozen) in the receipt bin; the asset
    // binding itself is asserted live in tests/positive.rs
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
