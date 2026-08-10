//! Emit an Ed25519 (sig type 2) ANS-104 DataItem to a file, for FOREIGN-ORACLE
//! conformance: `node` + `arbundles` then parses and validates the bytes (see the
//! companion harness). A page must not be its own witness — our Rust encoder is
//! proven by an independent implementation accepting its output, not by our own test.
//!
//! Deterministic (fixed key + data + tags) so the conformance run is reproducible.
//!   cargo run -p atmirror --example emit_ed25519_dataitem -- <out.bin>

use atmirror::arweave::build_ed25519_data_item;
use ed25519_dalek::SigningKey;
use std::io::Write;

fn main() {
    let sk = SigningKey::from_bytes(&[42u8; 32]);
    let data = b"bnr sovereign funding lever";
    let tags = [("Content-Type".to_string(), "text/plain".to_string())];
    let (id, item) = build_ed25519_data_item(&sk, data, &tags);

    let path = std::env::args()
        .nth(1)
        .expect("usage: emit_ed25519_dataitem <out.bin>");
    std::fs::File::create(&path)
        .and_then(|mut f| f.write_all(&item))
        .expect("write DataItem bytes");

    // to stderr so stdout stays clean for any piping
    eprintln!("id={id} bytes={} owner={}", item.len(), b64url_addr(&sk));
    eprintln!("wrote {path}");
}

/// The Arweave address of an Ed25519 owner = base64url_nopad(sha256(pubkey)).
fn b64url_addr(sk: &SigningKey) -> String {
    use base64::Engine;
    use sha2::{Digest, Sha256};
    let h = Sha256::digest(sk.verifying_key().to_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(h)
}
