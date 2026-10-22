//! PQ11 runner: BIP-340 (sign and verify) and Wycheproof secp256k1 ECDSA on
//! k256, Wycheproof X25519 on x25519-dalek, from the files pinned in
//! classic-manifest.json.
//!
//! usage: classic-kat [--cache DIR]   (default target/pq-vectors)
//!
//! Exit 0 only if every case passed and every required row ran. A `valid`
//! Wycheproof signature that k256 refuses because its s is in the upper half
//! is k256's low-S policy, the same rule Bitcoin and Antelope enforce; it is
//! printed as its own row and counted, by tcId, never folded into a pass.

use std::path::PathBuf;
use std::process::ExitCode;

use btungsten_pq::classic;
use btungsten_pq::report::Report;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let cache = match args.iter().position(|a| a == "--cache") {
        Some(i) => PathBuf::from(args.get(i + 1).expect("--cache DIR")),
        None => PathBuf::from("target/pq-vectors"),
    };
    let mut r = Report::default();
    let load = |name: &str| classic::load(&cache, name).unwrap_or_else(|e| panic!("{e}"));
    let json = |name: &str| -> serde_json::Value {
        serde_json::from_slice(&load(name)).unwrap_or_else(|e| panic!("{name}: {e}"))
    };

    classic::bip340(&String::from_utf8(load("bip340")).expect("utf-8"), &mut r);
    let plain = classic::ecdsa(
        &json("ecdsa_secp256k1_sha256"),
        "ECDSA secp256k1 SHA-256",
        &mut r,
    );
    let bitcoin = classic::ecdsa(
        &json("ecdsa_secp256k1_sha256_bitcoin"),
        "ECDSA secp256k1 SHA-256 bitcoin (low-S)",
        &mut r,
    );
    classic::x25519(&json("x25519"), &mut r);

    r.print_as("PQ11");
    println!(
        "PQ11 k256 low-S policy: {} Wycheproof `valid` high-s signatures refused in the plain set (tcIds {:?}); {} in the bitcoin set, which marks them invalid",
        plain.len(),
        plain,
        bitcoin.len()
    );
    let required: [(&str, &'static str); 6] = [
        ("BIP-340 verify", "k256"),
        ("BIP-340 sign", "k256"),
        ("ECDSA secp256k1 SHA-256", "k256"),
        ("ECDSA secp256k1 SHA-256 bitcoin (low-S)", "k256"),
        ("X25519 valid", "x25519-dalek"),
        ("X25519 acceptable", "x25519-dalek"),
    ];
    let missing: Vec<_> = required
        .iter()
        .filter(|(k, i)| r.executed(k, i) == 0)
        .collect();
    let (executed, passed) = r.totals();
    println!(
        "PQ11 SUMMARY: {executed} executed, {passed} passed, {} failed; {} required rows, {} missing",
        r.failures().len(),
        required.len(),
        missing.len()
    );
    if r.failures().is_empty() && missing.is_empty() && bitcoin.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
