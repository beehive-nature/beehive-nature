//! Rust oracle for the Trezor fork's `crypto/bpq/emu_xcheck.py`.
//!
//! Reads the same input JSON as the fork's `js-xcheck.mjs` on stdin, plus the
//! wallet's binding as the JS oracle made it:
//! `{prk, context, card, binding, detached, file_hex, wallet_binding, ...}`.
//! `prk` is the device's SLIP-21 child for the PUBLIC BIP-39 test vector,
//! recomputed by the harness; nothing here is a real key.
//!
//! The checks of the fork's former `rust-xcheck` are kept by name; `succ_equal`
//! and `id_equal` are added because bsigner now derives the SLH-DSA succession
//! key itself (`bpq::succession_keys`, fips205 0.4.1), so the device's
//! succession commitment is no longer only an input.
//!
//! Output, one JSON line: `checks` flat (every name the gate-6 plan cites) and
//! three summary booleans that keep key equality apart from signature
//! verification and from the controls: `keys_equal`, `signatures_verify`,
//! `controls_refused`. `ok` is all three. Exit 0 iff `ok`.

use bpq_device_xcheck::bpq;
use fips205::traits::SerDes;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::Read;

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

fn b64u(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    for c in b.chunks(3) {
        let n = c
            .iter()
            .enumerate()
            .fold(0u32, |acc, (i, &x)| acc | (x as u32) << (16 - 8 * i));
        for i in 0..=c.len() {
            out.push(A[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    out
}

fn unb64u(s: &str) -> Vec<u8> {
    let v = |c: u8| match c {
        b'A'..=b'Z' => c - b'A',
        b'a'..=b'z' => c - b'a' + 26,
        b'0'..=b'9' => c - b'0' + 52,
        b'-' => 62,
        b'_' => 63,
        _ => panic!("not base64url"),
    };
    let mut out = Vec::new();
    for c in s.as_bytes().chunks(4) {
        let n = c
            .iter()
            .enumerate()
            .fold(0u32, |acc, (i, &x)| acc | (v(x) as u32) << (18 - 6 * i));
        for i in 0..c.len() - 1 {
            out.push((n >> (16 - 8 * i)) as u8);
        }
    }
    out
}

fn main() {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s).unwrap();
    let input: Value = serde_json::from_str(&s).unwrap();
    let card = &input["card"];
    let prk: [u8; 32] = unhex(input["prk"].as_str().unwrap()).try_into().unwrap();
    let ctx = input["context"].as_str().unwrap();
    let file = unhex(input["file_hex"].as_str().unwrap());

    // keys: what bsigner derives from the public-fixture PRK, against the card
    let k = bpq::keys(&prk, ctx).expect("bsigner keys");
    let (slh_pk, _slh_sk) = bpq::succession_keys(&prk, ctx).expect("bsigner succession keys");
    let succ = bpq::succession_commit(&slh_pk.into_bytes());
    let card_dsa = card["dsa"].as_str().unwrap();
    let card_succ = unb64u(card["succ"].as_str().unwrap());
    let keys: Vec<(&str, bool)> = vec![
        ("dsa_equal", b64u(&k.dsa_public) == card_dsa),
        (
            "kem_equal",
            b64u(&k.kem_public) == card["kem"].as_str().unwrap(),
        ),
        ("succ_equal", b64u(&succ) == card["succ"].as_str().unwrap()),
        (
            "id_equal",
            bpq::id_from(&k.dsa_public, &succ).as_deref() == card["id"].as_str(),
        ),
        (
            "id_from_device_succ_equal",
            bpq::id_from(&k.dsa_public, &card_succ).as_deref() == card["id"].as_str(),
        ),
    ];

    // signatures: the device's statements, verified by bsigner's code alone
    let verify: Vec<(&str, bool)> = vec![
        ("verify_card_device", bpq::verify_card(card)),
        ("verify_bind_device", bpq::verify_bind(&input["binding"])),
        (
            "verify_detached_device",
            bpq::verify_detached(&input["detached"], &file).is_some(),
        ),
        (
            "verify_bind_wallet",
            bpq::verify_bind(&input["wallet_binding"]),
        ),
        (
            "wallet_binding_names_device",
            input["wallet_binding"]["claims"]["bsafe-pq"] == card["id"],
        ),
        (
            "device_binding_names_wallet",
            input["binding"]["claims"]["bzpq-wallet"] == input["wallet_binding"]["id"],
        ),
    ];

    // controls: one flipped signature bit, one changed claim, one changed file must each fail
    let mut flipped = card.clone();
    let mut sig = unb64u(card["sig"].as_str().unwrap());
    sig[100] ^= 1;
    flipped["sig"] = Value::from(b64u(&sig));
    let mut changed = input["binding"].clone();
    changed["claims"]["bzpq-wallet"] = Value::from("bzpq1other");
    let mut longer = file.clone();
    longer.push(b'x');
    let controls: Vec<(&str, bool)> = vec![
        ("control_card_bitflip_refused", !bpq::verify_card(&flipped)),
        (
            "control_binding_claim_changed_refused",
            !bpq::verify_bind(&changed),
        ),
        (
            "control_file_changed_refused",
            bpq::verify_detached(&input["detached"], &longer).is_none(),
        ),
    ];

    let all = |v: &[(&str, bool)]| v.iter().all(|(_, b)| *b);
    let (keys_equal, signatures_verify, controls_refused) =
        (all(&keys), all(&verify), all(&controls));
    let ok = keys_equal && signatures_verify && controls_refused;
    let checks: serde_json::Map<String, Value> = keys
        .iter()
        .chain(verify.iter())
        .chain(controls.iter())
        .map(|(n, v)| (n.to_string(), Value::from(*v)))
        .collect();
    let bpq_rs_sha256 = format!("{:x}", Sha256::digest(bpq_device_xcheck::BPQ_RS_BYTES));
    println!(
        "{}",
        serde_json::json!({
            "oracle": bpq_device_xcheck::BPQ_RS,
            "bpq_rs_sha256": bpq_rs_sha256,
            "checks": checks,
            "keys_equal": keys_equal,
            "signatures_verify": signatures_verify,
            "controls_refused": controls_refused,
            "ok": ok,
        })
    );
    std::process::exit(if ok { 0 } else { 1 });
}

#[cfg(test)]
mod tests {
    use super::unhex;
    use bpq_device_xcheck::bpq;
    use fips205::traits::SerDes;

    /// A witness foreign to this code: the public fixture's SLIP-21 child PRK
    /// (the fork's emu_xcheck.py prints it "because it guards nothing") and the
    /// id the T3W1 emulator returned for it (crypto/bpq/emu_xcheck_receipt.json).
    /// If bsigner's derivation ever drifts from the device's, this fails.
    #[test]
    fn public_fixture_prk_gives_the_emulator_id() {
        let prk: [u8; 32] =
            unhex("ce023ae3b0a9b3bc670c52195fd83ea2cc9308b79acd278e595a036f1ef90081") // PUBLIC-CONSTANT: the public BIP-39 test vector's device PRK
                .try_into()
                .unwrap();
        let k = bpq::keys(&prk, "pq:bsafe").unwrap();
        let (slh_pk, _) = bpq::succession_keys(&prk, "pq:bsafe").unwrap();
        let succ = bpq::succession_commit(&slh_pk.into_bytes());
        assert_eq!(
            bpq::id_from(&k.dsa_public, &succ).as_deref(),
            Some("bzpq1lws2ertcufjd8ehnr0qndqrz5krg3qqd4zltg7d5vrgncl8j8qjsr47lvv")
        );
    }
}
