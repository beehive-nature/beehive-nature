//! The accepted-input boundary (repair 2026-10-07): ill-formed UTF-16 is
//! refused at encode, malformed UTF-8 at decode; valid international text,
//! supplementary characters and a legitimate U+FFFD survive byte-exactly.

use crate::common::{base, hex, intent_of, parse, seed, t, t16, to_hex, VECTORS};
use btungsten_wb001::core::HEAD8;
use btungsten_wb001::{
    canonical, decode, public_key, sign, verify, verify_envelope, IntentIn, Text,
};
use ed25519_dalek::{Signer, SigningKey};

const LONE_SURROGATES: [&[u16]; 8] = [
    &[0xd800],
    &[0xdbff],
    &[0xdc00],
    &[0xdfff],
    &[0x78, 0xd800],
    &[0xd800, 0x78],
    &[0xd800, 0x41],
    &[0xdc00, 0xd800],
];

const VALID_INTERNATIONAL: [&str; 8] = [
    "\u{1F431}",
    "\u{1D54F}",
    "b\u{0101}bis",
    "e\u{0301}",
    "\u{FFFD}",
    "\u{652f}\u{4ed8}",
    "\u{0645}\u{0646}\u{062d}\u{0649}",
    "a\u{1F600}\u{0101}",
];

fn with_field(field: usize, v: Text) -> IntentIn {
    let mut x = base();
    match field {
        0 => x.domain = v,
        1 => x.destination = v,
        2 => x.capability = v,
        _ => x.payer = v,
    }
    x
}

fn with_domain_bytes(bytes: &[u8]) -> Vec<u8> {
    let good = canonical(&base().build().unwrap()).unwrap();
    let rest = &good[8 + 5 + "skaists.bpay/1".len()..];
    let mut e = HEAD8.to_vec();
    e.push(0x01);
    e.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    e.extend_from_slice(bytes);
    e.extend_from_slice(rest);
    e
}

#[test]
fn unpaired_surrogates_are_refused_at_encode_in_every_text_field() {
    let mut n = 0;
    for field in 0..4 {
        for s in LONE_SURROGATES {
            assert_eq!(
                with_field(field, t16(s)).build().unwrap_err().code(),
                "bt-wb01:utf16"
            );
            n += 1;
        }
    }
    assert_eq!(n, 32);
}

#[test]
fn the_surrogate_collision_class_is_gone() {
    let s = seed(20);
    let pk = public_key(&s);
    let honest = base().build().unwrap();
    let sig = sign(&s, &honest).unwrap();
    assert!(verify(&pk, &honest, &sig));
    for field in 0..4 {
        assert_eq!(
            with_field(field, t16(&[0xd800]))
                .build()
                .unwrap_err()
                .code(),
            "bt-wb01:utf16"
        );
        assert_eq!(
            with_field(field, t16(&[0xd801]))
                .build()
                .unwrap_err()
                .code(),
            "bt-wb01:utf16"
        );
        let ffd = with_field(field, t("\u{FFFD}")).build().unwrap();
        assert_ne!(canonical(&honest).unwrap(), canonical(&ffd).unwrap());
        let ffsig = sign(&s, &ffd).unwrap();
        assert!(verify(&pk, &ffd, &ffsig));
        assert!(!verify(&pk, &honest, &ffsig));
        assert!(verify(&pk, &honest, &sig));
        assert!(!verify(&pk, &ffd, &sig));
    }
}

#[test]
fn valid_international_text_survives_byte_exactly() {
    for s in VALID_INTERNATIONAL {
        let x = IntentIn {
            destination: t(s),
            ..base()
        }
        .build()
        .unwrap();
        let env = canonical(&x).unwrap();
        let back = decode(&env).unwrap();
        let n = back.destination_len as usize;
        assert_eq!(&back.destination[..n], s.as_bytes());
        assert!(env.windows(s.len()).any(|w| w == s.as_bytes()));
    }
}

#[test]
fn strict_decode_refuses_malformed_utf8_by_name() {
    let cases: [&[u8]; 9] = [
        &[0xff],
        &[0x80],
        &[0xc0, 0x80],
        &[0xe0, 0x9f, 0xbf],
        &[0xed, 0xa0, 0x80],
        &[0xf4, 0x90, 0x80, 0x80],
        &[0xf0, 0x8f, 0xbf, 0xbf],
        &[0xc2],
        &[0xe2, 0x82],
    ];
    for c in cases {
        assert_eq!(
            decode(&with_domain_bytes(c)).unwrap_err().code(),
            "bt-wb01:utf8",
            "{c:02x?}"
        );
    }
    let bee = decode(&with_domain_bytes(&[0xf0, 0x9f, 0x90, 0x9d])).unwrap();
    assert_eq!(&bee.domain[..4], "\u{1F41D}".as_bytes());
    let fffd = decode(&with_domain_bytes(&[0xef, 0xbf, 0xbd])).unwrap();
    assert_eq!(&fffd.domain[..3], "\u{FFFD}".as_bytes());
}

#[test]
fn verify_envelope_refuses_malformed_wire_even_when_signed_over_exactly_those_bytes() {
    let s = seed(21);
    let malformed = with_domain_bytes(&[0xff]);
    let sig = SigningKey::from_bytes(&s).sign(&malformed).to_bytes();
    assert!(!verify_envelope(&public_key(&s), &malformed, &sig));
    let honest = base().build().unwrap();
    assert!(
        verify(&public_key(&s), &honest, &sign(&s, &honest).unwrap()),
        "control"
    );
}

#[test]
fn the_pinned_shared_vectors_byte_for_byte_and_refusals_by_code() {
    let v = parse(VECTORS);
    assert_eq!(v.at("format").s(), "bt-wb01/1");
    let positives = v.at("positives").arr();
    for p in positives {
        let i = intent_of(p)
            .build()
            .unwrap_or_else(|e| panic!("{}: {}", p.at("name").s(), e.code()));
        let env = canonical(&i).unwrap();
        assert_eq!(
            to_hex(&env),
            p.at("envelope").s(),
            "{}: envelope drifted",
            p.at("name").s()
        );
        assert_eq!(env.len() as u64, p.at("length").n());
        assert_eq!(
            canonical(&decode(&env).unwrap()).unwrap(),
            env,
            "{}: round-trip",
            p.at("name").s()
        );
    }
    let refusals = v.at("refusals").arr();
    for r in refusals {
        let code = match r.get("intent") {
            Some(row) => intent_of(row).build().unwrap_err().code(),
            None => decode(&hex(&r.at("envelope").s())).unwrap_err().code(),
        };
        assert_eq!(code, r.at("code").s(), "{}", r.at("name").s());
    }
    assert_eq!((positives.len(), refusals.len()), (10, 9));
}
