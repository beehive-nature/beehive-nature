//! Cross-reader conformance: bzdid's canonical encoder output must parse
//! under atmirror's STRICT dag-cbor reader — the same cross-language law
//! that keeps the Rust voucher core and the box's Python engine agreeing.
//! Two independent readers, one byte string; if either moves, this test is
//! the tripwire.

use bzdid::{GenesisOp, KeyAlg, KeyCard};

fn demo() -> GenesisOp {
    GenesisOp {
        rotation_keys: vec![
            KeyCard::new(KeyAlg::Ed25519, vec![0xA1; 32]).unwrap(),
            KeyCard::new(KeyAlg::MlDsa65, vec![0xB2; 1952]).unwrap(),
        ],
        signing_key: KeyCard::new(KeyAlg::MlDsa65, vec![0x5D; 1952]).unwrap(),
        services: vec!["ar://cross-check".into(), "https://cross.example".into()],
        also_known_as: vec!["did:web:cross.example".into()],
        valid_until: 4_102_444_800,
    }
}

#[test]
fn atmirror_reads_exactly_what_bzdid_writes() {
    let bytes = demo().build().unwrap();
    let v = atmirror::cbor::decode(&bytes)
        .expect("a second strict reader must parse our canonical bytes");
    assert_eq!(v.get("type").and_then(|t| t.as_text()), Some("b:genesis"));
    assert_eq!(
        v.get("validUntil").and_then(|n| n.as_int()),
        Some(4_102_444_800)
    );
    let rot = match v.get("rotationKeys") {
        Some(atmirror::cbor::Value::Array(a)) => a,
        other => panic!("rotationKeys must be an array, got {other:?}"),
    };
    assert_eq!(rot.len(), 2);
    assert_eq!(rot[0].get("alg").and_then(|a| a.as_text()), Some("ed25519"));
    assert_eq!(
        rot[0].get("key").and_then(|k| k.as_bytes()),
        Some(&vec![0xA1u8; 32][..])
    );
    assert_eq!(
        rot[1].get("alg").and_then(|a| a.as_text()),
        Some("ml-dsa-65")
    );
    let sk = match v.get("signingKey") {
        Some(m @ atmirror::cbor::Value::Map(_)) => m,
        other => panic!("signingKey must be a map, got {other:?}"),
    };
    assert_eq!(sk.get("alg").and_then(|a| a.as_text()), Some("ml-dsa-65"));
    assert_eq!(
        sk.get("key").and_then(|k| k.as_bytes()).map(<[u8]>::len),
        Some(1952)
    );
    // the services and alsoKnownAs strings survive the roundtrip through a
    // reader that did not write them
    let svcs = match v.get("services") {
        Some(atmirror::cbor::Value::Array(a)) => a,
        other => panic!("services must be an array, got {other:?}"),
    };
    assert_eq!(svcs[0].as_text(), Some("ar://cross-check"));
}
