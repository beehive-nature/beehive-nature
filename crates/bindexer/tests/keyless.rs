//! Keyless by construction — enforced by source scan, not policy.
//!
//! The spec's most important row is sendtx: NO, permanently. This test walks
//! every source file in the crate and refuses the vocabulary of broadcasting
//! and custody. If someone adds a wallet, CI goes red — that is the point.

use std::fs;
use std::path::PathBuf;

const FORBIDDEN: &[&str] = &[
    // broadcast vocabulary (method names, exact forms)
    "eth_sendrawtransaction",
    "eth_sendtransaction",
    "sendrawtransaction",
    "sendtransaction",
    "broadcasttransaction",
    // signing vocabulary
    "eth_signtransaction",
    "eth_sign(",
    "personal_sign",
    "signer", // bsigner exists elsewhere in the kernel; it must not exist HERE
    "sign_raw",
    // custody vocabulary
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
fn no_broadcast_signing_or_custody_vocabulary_in_this_crate() {
    let mut checked = 0usize;
    for entry in fs::read_dir(src_dir()).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        let body = fs::read_to_string(&path).unwrap().to_ascii_lowercase();
        for word in FORBIDDEN {
            assert!(
                !body.contains(word),
                "keyless violation: '{}' appears in {} — SPEC-BINDEXER-0 forbids broadcast/signing/custody vocabulary in this crate",
                word,
                path.display()
            );
        }
        checked += 1;
    }
    assert!(
        checked >= 6,
        "expected the crate's source files, found {checked} — scan integrity"
    );
}

#[test]
fn help_text_carries_the_no_row() {
    // the denial must be readable by a stranger running --help, not just in docs
    let main_rs = fs::read_to_string(src_dir().join("main.rs")).unwrap();
    assert!(
        main_rs.contains("sendtx: NO — permanently"),
        "--help must carry the spec's most important row"
    );
}
