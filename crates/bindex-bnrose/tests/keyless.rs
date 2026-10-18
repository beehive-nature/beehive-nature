//! Keyless by construction, enforced by source scan (the `bindexer` law,
//! carried over). This crate reads what the supervisor wrote and holds the
//! receipt PUBLIC key it was handed; it never names the root key file,
//! never derives a key, never holds a MAC, never signs. If someone adds
//! any of that, CI goes red; that is the point.

use std::fs;
use std::path::PathBuf;

const FORBIDDEN: &[&str] = &[
    // the supervisor's secrets and the types that hold them
    "supervisor.root",
    "KEY_FILE",
    "SupervisorKeys",
    "journal_mac",
    "ledger_mac",
    "ed_seed",
    "from_root",
    "root_fingerprint",
    // the owner's key-taking loaders (a keyless reader must not call them)
    "Journal::open",
    "EffectLedger::open",
    "ReplicatedJournal",
    "journal::load(",
    "ledger::load(",
    // MAC and signing vocabulary
    "use hmac",
    "Hmac<",
    "sign_statement",
    "secret_to_public",
    "signer",
    "sign(",
    // custody vocabulary (bindexer's list)
    "privatekey",
    "private_key",
    "mnemonic",
    "seed_phrase",
    "keystore",
];

fn src_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")
}

#[test]
fn no_root_key_mac_or_signing_vocabulary_in_this_crate() {
    let mut checked = 0usize;
    for entry in fs::read_dir(src_dir()).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        let text = fs::read_to_string(&path).unwrap();
        for token in FORBIDDEN {
            assert!(
                !text.contains(token),
                "{} names {token:?}: this crate must stay keyless",
                path.display()
            );
        }
        checked += 1;
    }
    assert!(
        checked >= 6,
        "the scan must have walked the sources ({checked})"
    );
}

#[test]
fn the_manifest_pulls_no_mac_or_signing_crate_directly() {
    let manifest =
        fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")).unwrap();
    for dep in [
        "hmac",
        "libcrux-ed25519",
        "ed25519-dalek",
        "ml-dsa",
        "zeroize",
    ] {
        assert!(
            !manifest.lines().any(|l| l.trim_start().starts_with(dep)),
            "Cargo.toml depends on {dep} directly"
        );
    }
}
