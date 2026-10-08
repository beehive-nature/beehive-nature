//! Ed25519, three implementations against each other and the RFC:
//! libcrux (HACL*-verified, the model's signer), dalek, and OpenSSL through
//! the pinned oracle file. Deterministic signatures must agree byte-for-byte.

use crate::common::{hex, parse, ORACLE};
use btungsten_wb001::public_key;
use ed25519_dalek::{Signer, SigningKey};

#[test]
fn libcrux_dalek_and_openssl_agree_on_every_oracle_row() {
    let o = parse(ORACLE);
    let rows = o.at("rows").arr();
    let mut rfc = 0;
    for r in rows {
        let name = r.at("name").s();
        let seed: [u8; 32] = hex(&r.at("seed").s()).try_into().unwrap();
        let pk: [u8; 32] = hex(&r.at("pk").s()).try_into().unwrap();
        let msg = hex(&r.at("msg").s());
        let sig: [u8; 64] = hex(&r.at("sig").s()).try_into().unwrap();
        assert_eq!(public_key(&seed), pk, "{name}: libcrux public key");
        assert_eq!(
            libcrux_ed25519::sign(&msg, &seed).unwrap(),
            sig,
            "{name}: libcrux signature != OpenSSL"
        );
        assert_eq!(
            SigningKey::from_bytes(&seed).sign(&msg).to_bytes(),
            sig,
            "{name}: dalek signature != OpenSSL"
        );
        assert!(
            libcrux_ed25519::verify(&msg, &pk, &sig).is_ok(),
            "{name}: libcrux verify"
        );
        let mut bad = sig;
        bad[0] ^= 1;
        assert!(
            libcrux_ed25519::verify(&msg, &pk, &bad).is_err(),
            "{name}: libcrux accepted a flipped signature"
        );
        if name.starts_with("RFC8032") && !name.contains(" under ") {
            rfc += 1;
        }
    }
    assert_eq!((rows.len(), rfc), (24, 4));
}
