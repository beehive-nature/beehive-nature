//! The bSigner organ closed loop — ORDER BZDID-002 Phase 1.
//!
//! The frozen interface, exercised end to end: a rotation key is GENERATED
//! by the organ (`keygen`), its public half becomes the genesis card, the
//! op body is SIGNED by the organ (`sign` → bheart.signature/1 envelope),
//! and bzdid verifies the signature LOCALLY — offline, no keyset, no
//! organ call — against the card alone. One negative control: bytes the
//! organ signed for a DIFFERENT message do not verify, so the organ's
//! envelope cannot vouch for bytes it did not see.
//!
//! Signing in production is bSigner's through exactly this path; bzdid
//! holds no keys and never invokes the organ to verify (self-custody:
//! a third party with only the public card reaches the same verdict).
//!
//! CI wires `BZDID_BSIGNER_BIN` with an existence gate ("a skipped suite
//! is not a pass" — the settle-nerve precedent). Locally the test probes
//! `target/debug/bsigner` itself and says so.

use common::{scenario, TestKey, T0, V1};
use std::process::Command;

mod common;

fn organ() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("BZDID_BSIGNER_BIN") {
        let pb = std::path::PathBuf::from(&p);
        assert!(
            pb.is_file(),
            "BZDID_BSIGNER_BIN={p:?} is not a file — a skipped suite is not a pass"
        );
        return pb;
    }
    // local probe: cargo runs test binaries from the package dir, so the
    // workspace target dir sits two levels up from this crate (crates/bzdid)
    let ws_target = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .unwrap()
        .join("target/debug");
    for name in [
        ws_target.join("bsigner.exe"),
        ws_target.join("bsigner"),
        std::path::PathBuf::from("target/debug/bsigner.exe"),
        std::path::PathBuf::from("target/debug/bsigner"),
    ] {
        if name.is_file() {
            eprintln!("bzdid/bsigner_organ: using local probe {}", name.display());
            return name;
        }
    }
    panic!("no bsigner organ binary found — set BZDID_BSIGNER_BIN or build target/debug/bsigner; a skipped suite is not a pass");
}

fn b64u_decode(s: &str) -> Vec<u8> {
    const A: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut out = Vec::new();
    for c in s.bytes() {
        if c == b'=' {
            break;
        }
        let v = A.iter().position(|&a| a == c).expect("base64url char") as u32;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    out
}

struct Organ {
    bin: std::path::PathBuf,
    keydir: std::path::PathBuf,
    key_id: String,
    public: Vec<u8>,
}

impl Drop for Organ {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.keydir);
    }
}

fn organ_keygen() -> Organ {
    let bin = organ();
    let keydir = std::env::temp_dir().join(format!(
        "bzdid-organ-{}-{:x}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&keydir).unwrap();
    // the TEST recovery code the settle-nerve suite also uses (committed
    // in-tree as test material; throwaway keydir) — by env per the
    // organ's law: never argv, never printed
    let rec_env = "BZDID_TEST_REC_CODE";
    std::env::set_var(
        rec_env,
        "bdidrec1q9r0n4djklfz8l57r3mtajrstnze98jxsa37w2l980tn6xkljllvkh5lf9u",
    );
    let out = Command::new(&bin)
        .args([
            "keygen",
            "--alg",
            "ml-dsa-65",
            "--keydir",
            keydir.to_str().unwrap(),
            "--rec-env",
            rec_env,
        ])
        .output()
        .expect("organ keygen runs");
    assert!(
        out.status.success(),
        "keygen failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        !stdout.contains("seed"),
        "keygen output must never carry secret material"
    );
    let v: serde_json::Value = serde_json::from_str(stdout.trim()).expect("keygen prints JSON");
    let key_id = v["key_id"].as_str().expect("key id").to_string();
    let pk = b64u_decode(v["verifying_key_b64u"].as_str().expect("verifying key"));
    assert_eq!(pk.len(), 1952, "ml-dsa-65 public key length");
    Organ {
        bin,
        keydir,
        key_id,
        public: pk,
    }
}

fn organ_sign(org: &Organ, msg: &[u8]) -> serde_json::Value {
    let dir = std::env::temp_dir().join(format!("bzdid-organ-sign-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("body.bin");
    std::fs::write(&file, msg).unwrap();
    let rec_env = "BZDID_TEST_REC_CODE";
    let out = Command::new(&org.bin)
        .args([
            "sign",
            "--key-id",
            &org.key_id,
            "--file",
            file.to_str().unwrap(),
            "--rec-env",
            rec_env,
            "--keydir",
            org.keydir.to_str().unwrap(),
        ])
        .output()
        .expect("organ sign runs");
    let _ = std::fs::remove_dir_all(&dir);
    assert!(
        out.status.success(),
        "sign failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    serde_json::from_str(&String::from_utf8_lossy(&out.stdout))
        .expect("sign prints the bheart.signature/1 envelope")
}

#[test]
fn the_organ_signs_what_bzdid_verifies_offline() {
    let s = scenario();
    let org = organ_keygen();

    // the genesis keyset carries the ORGAN's public key as r0 — the
    // organ holds the private half, bzdid sees only the card
    let r0_card = bzdid::KeyCard::new(bzdid::KeyAlg::MlDsa65, org.public.clone()).unwrap();
    let genesis = bzdid::GenesisOp {
        rotation_keys: vec![r0_card.clone(), s.r1.card()],
        signing_key: s.genesis.signing_key.clone(),
        services: vec![],
        also_known_as: vec![],
        valid_until: V1,
    };
    let genesis_bytes = genesis.build().unwrap();
    let did = bzdid::BzDid::derive(&genesis_bytes);
    let genesis_hash = {
        use sha2::Digest;
        let h: [u8; 32] = sha2::Sha256::digest(&genesis_bytes).into();
        h
    };

    // build the op body, hand it to the organ, take the signature out of
    // the envelope — the organ is the signer, the envelope the transport
    let mut op = bzdid::RotateOp {
        seq: 1,
        prev: genesis_hash,
        at: T0,
        signed_by: 0,
        rotation_keys: vec![s.r1.card()],
        signing_key: TestKey::ed(0x5E).card(),
        services: vec![],
        also_known_as: vec![],
        valid_until: V1,
        sig: vec![0u8; 3309],
    };
    let body = bzdid::rotate_body_bytes(&op).unwrap();
    let envelope = organ_sign(&org, &body);
    assert_eq!(envelope["type"], "bheart.signature/1");
    assert_eq!(envelope["alg"], "ml-dsa-65");
    assert_eq!(envelope["content"]["bytes"], body.len() as u64);
    op.sig = b64u_decode(envelope["signature"]["b64u"].as_str().unwrap());
    assert_eq!(op.sig.len(), 3309);
    let bytes = op.build().unwrap();

    // OFFLINE verification: no organ, no keyset — the card alone
    let resolved = bzdid::resolve_did(&did, &genesis_bytes, std::slice::from_ref(&bytes), None)
        .expect("the organ-signed rotation verifies locally");
    assert_eq!(resolved.head.seq, 1);
    assert_eq!(resolved.head.rotation_keys, vec![s.r1.card()]);

    // NEGATIVE CONTROL: the organ signs different bytes; those bytes do
    // not verify as this op — the envelope vouches only for what it saw
    let other = organ_sign(&org, b"not this op");
    let mut op_wrong = op.clone();
    op_wrong.sig = b64u_decode(other["signature"]["b64u"].as_str().unwrap());
    let wrong_bytes = op_wrong.build().unwrap();
    assert!(matches!(
        bzdid::resolve_did(&did, &genesis_bytes, &[wrong_bytes], None),
        Err(bzdid::SuccessionError::InvalidSignature {
            seq: 1,
            signed_by: 0
        })
    ));
}
