//! The frozen BDID-GENESIS-V1 vector — the byte-level canon check. Any
//! change to the field set, the canonical encoding, or the digest
//! derivation breaks this test ON PURPOSE: that is a v2 ceremony, never an
//! edit (the same law as the frozen BDID-v1 KDF labels, VOCABULARY Law 6).

use bzdid::{verify_genesis, BzDid, GenesisOp, KeyAlg, KeyCard};

fn vector_op() -> GenesisOp {
    GenesisOp {
        rotation_keys: vec![
            KeyCard::new(KeyAlg::Ed25519, vec![0xA1; 32]).unwrap(),
            KeyCard::new(KeyAlg::Ed25519, vec![0xB2; 32]).unwrap(),
            KeyCard::new(KeyAlg::Ed25519, vec![0xC3; 32]).unwrap(),
        ],
        signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5D; 32]).unwrap(),
        services: vec!["https://vector.example".into()],
        also_known_as: vec!["did:web:vector.example".into()],
        valid_until: 4_102_444_800, // 2100-01-01T00:00:00Z
    }
}

/// The v1 canon, frozen: this op hashes to exactly this did. The string is
/// lowercase base32 (not hex) by the did:b: law.
pub const FROZEN_DID: &str = "did:b:e2xsu3qrmtomrkrvgjkfhgcxhxwvauoobf2qlcg6ycn6h67ktlfa";

#[test]
fn the_vector_did_is_frozen() {
    let op = vector_op();
    let did = op.did().unwrap();
    assert_eq!(
        did.as_str(),
        FROZEN_DID,
        "the v1 canon moved — that is a v2 ceremony, not an edit"
    );
    // and the verifier confirms the frozen pair end to end
    let bytes = op.build().unwrap();
    assert_eq!(
        verify_genesis(&bytes, &BzDid::parse(FROZEN_DID).unwrap()).unwrap(),
        op
    );
}
