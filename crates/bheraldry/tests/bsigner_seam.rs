//! The bSiGner seam — a REAL post-quantum envelope over the specimen's
//! canonical bytes, through the frozen CLI contract (crates/bsigner/CONTRACT.md).
//!
//! What this proves: the four-truth record plus a domain-separated payload
//! can be signed by the estate's deciding organ, verified by anyone holding
//! the public keyset, and TAMPERING — flipped payload bytes, or the same
//! envelope presented for a different record — is refused by the verifier,
//! not by our wrapper.
//!
//! What this does NOT prove (and never claims): that a signature establishes
//! historical truth, legal rights, or anything but "this signer held this
//! key, and these are the bytes signed."
//!
//! The test needs the bsigner binary. CI builds the whole workspace before
//! `cargo test`, so it is present there; locally run `cargo build -p bsigner`
//! first. The recovery code below is a deterministic TEST root — not a
//! secret, and worth nothing.

use bech32::{ToBase32, Variant};
use bheraldry::specimen::{bulgaria_national_arms, house_achievement};
use bheraldry::{SealedRecord, SignedSeal};
use std::process::Command;

fn bsigner_bin() -> std::path::PathBuf {
    let mut candidates = Vec::new();
    if let Ok(dir) = std::env::var("CARGO_TARGET_DIR") {
        candidates.push(std::path::PathBuf::from(dir).join("debug"));
    }
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    candidates.push(manifest.join("target/debug"));
    for dir in candidates {
        for name in ["bsigner.exe", "bsigner"] {
            let p = dir.join(name);
            if p.exists() {
                return p;
            }
        }
    }
    panic!(
        "bsigner binary not found — run `cargo build --workspace` (CI does this before tests) \
         or `cargo build -p bsigner` locally"
    );
}

/// A deterministic test recovery code (bdidrec1…, version 1 ‖ 32-byte test
/// root). Env-delivered to the CLI by variable NAME, never by value on the
/// command line — the organ's own law.
fn test_recovery_code() -> String {
    let mut payload = Vec::with_capacity(33);
    payload.push(1u8);
    payload.extend_from_slice(&[0xB1u8; 32]); // test root, publicly worthless
    bech32::encode("bdidrec", payload.to_base32(), Variant::Bech32m).expect("valid hrp")
}

struct Ctx {
    dir: std::path::PathBuf,
    key_id: String,
}

fn run(bin: &std::path::Path, args: &[&str], rec_env: Option<(&str, &str)>) -> (i32, String) {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some((name, value)) = rec_env {
        cmd.env(name, value);
    }
    let out = cmd.output().expect("spawn bsigner");
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    (out.status.code().unwrap_or(-1), text)
}

fn setup() -> Ctx {
    let bin = bsigner_bin();
    let dir = std::env::temp_dir().join(format!("bheraldry-seam-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let rec = test_recovery_code();
    let rec_env = "BHERALDRY_SEAM_REC";

    let (rc, out) = run(
        &bin,
        &[
            "keygen",
            "--alg",
            "ml-dsa-44",
            "--rec-env",
            rec_env,
            "--keydir",
            &dir.display().to_string(),
        ],
        Some((rec_env, &rec)),
    );
    assert_eq!(rc, 0, "keygen failed: {out}");
    let v: serde_json::Value = serde_json::from_str(&out).expect("keygen prints JSON");
    let key_id = v["key_id"]
        .as_str()
        .expect("key_id in keygen output")
        .to_string();
    Ctx { dir, key_id }
}

#[test]
fn the_organ_signs_the_specimen_and_refuses_tampering() {
    let bin = bsigner_bin();
    let ctx = setup();
    let rec = test_recovery_code();
    let rec_env = "BHERALDRY_SEAM_REC";
    let keydir = ctx.dir.display().to_string();

    // the payload: domain ‖ NUL ‖ seal canon ‖ NUL ‖ record canonical bytes
    let sealed = bulgaria_national_arms().seal().unwrap();
    let record_bytes = sealed.record().canonical_bytes();
    let did = bzdid::BzDid::derive(b"bheraldry seam test signer");
    let seal = SignedSeal::new(
        did.as_str(),
        &ctx.key_id,
        sealed.digest(),
        Some("seam test"),
    )
    .unwrap();
    let payload = seal.payload_bytes(&record_bytes);
    let payload_path = ctx.dir.join("payload.bin");
    std::fs::write(&payload_path, &payload).unwrap();
    let envelope_path = ctx.dir.join("envelope.json");

    // sign — signs, never submits; and keys never cross argv
    let (rc, out) = run(
        &bin,
        &[
            "sign",
            "--key-id",
            &ctx.key_id,
            "--file",
            &payload_path.display().to_string(),
            "--rec-env",
            rec_env,
            "--keydir",
            &keydir,
            "--out",
            &envelope_path.display().to_string(),
        ],
        Some((rec_env, &rec)),
    );
    assert_eq!(rc, 0, "sign failed: {out}");
    assert!(
        out.contains("bheart.signature/1"),
        "envelope type named: {out}"
    );

    // verify the true bytes → accepted
    let (rc, out) = run(
        &bin,
        &[
            "verify",
            "--key-id",
            &ctx.key_id,
            "--file",
            &payload_path.display().to_string(),
            "--envelope",
            &envelope_path.display().to_string(),
            "--keydir",
            &keydir,
        ],
        None,
    );
    assert_eq!(rc, 0, "verify of true bytes failed: {out}");

    // ATTACK: flip one payload byte — the SAME envelope must now be refused
    let mut tampered = payload.clone();
    let mid = tampered.len() / 2;
    tampered[mid] ^= 0x01;
    let tampered_path = ctx.dir.join("payload.tampered.bin");
    std::fs::write(&tampered_path, &tampered).unwrap();
    let (rc, out) = run(
        &bin,
        &[
            "verify",
            "--key-id",
            &ctx.key_id,
            "--file",
            &tampered_path.display().to_string(),
            "--envelope",
            &envelope_path.display().to_string(),
            "--keydir",
            &keydir,
        ],
        None,
    );
    assert_ne!(
        rc, 0,
        "a flipped payload byte MUST be refused by the organ's verifier"
    );
    assert!(!out.trim().is_empty(), "the refusal says why: {out}");

    // ATTACK: present the same envelope for a DIFFERENT record (the house
    // record) — content hash over different bytes → refused
    let house = house_achievement().seal().unwrap();
    let house_payload = seal.payload_bytes(&house.record().canonical_bytes());
    let house_path = ctx.dir.join("payload.house.bin");
    std::fs::write(&house_path, &house_payload).unwrap();
    let (rc, _out) = run(
        &bin,
        &[
            "verify",
            "--key-id",
            &ctx.key_id,
            "--file",
            &house_path.display().to_string(),
            "--envelope",
            &envelope_path.display().to_string(),
            "--keydir",
            &keydir,
        ],
        None,
    );
    assert_ne!(
        rc, 0,
        "an envelope made for one record must not verify for another"
    );

    // ATTACK: a DIFFERENT identity — second key, same envelope → refused
    let dir2 = ctx.dir.join("keys2");
    std::fs::create_dir_all(&dir2).unwrap();
    let (rc, out) = run(
        &bin,
        &[
            "keygen",
            "--alg",
            "ml-dsa-44",
            "--rec-env",
            rec_env,
            "--keydir",
            &dir2.display().to_string(),
        ],
        Some((rec_env, &rec)),
    );
    assert_eq!(rc, 0, "second keygen failed: {out}");
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    let other_key = v["key_id"].as_str().unwrap().to_string();
    let (rc, _out) = run(
        &bin,
        &[
            "verify",
            "--key-id",
            &other_key,
            "--file",
            &payload_path.display().to_string(),
            "--envelope",
            &envelope_path.display().to_string(),
            "--keydir",
            &keydir,
        ],
        None,
    );
    // the other keyset lives in dir2, not keydir — the refusal may be
    // "unknown key" or "wrong key"; either way it is NOT a verification
    assert_ne!(
        rc, 0,
        "an envelope must not verify under a key id it was not made for"
    );

    // structural layer agrees: the seal's payload digest binds THESE record bytes
    assert!(seal.verify_structure(&record_bytes).is_ok());
    assert!(matches!(
        seal.verify_structure(&house.record().canonical_bytes()),
        Err(bheraldry::LawViolation::DigestMismatch { .. })
    ));
    let _ = SealedRecord::from_bytes(&record_bytes, sealed.digest()).unwrap();
}
