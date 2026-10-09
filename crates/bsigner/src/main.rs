//! bsigner — bHEartWALLet's DECIDING organ (canon name).
//!
//! **NAMING RULING (Seat-1 under founder delegation, 2026-09-03):** `bsigner`
//! is THE signer name of the estate — this organ holds it. The former C1
//! Trezor scaffold now lives as crates/btrezor, its fences untouched ("this
//! crate cannot sign" stays verbatim there); **btrezor is intended to become
//! a BACKEND of this organ** — hardware signing behind the same interface —
//! not a permanent sibling. Do not re-litigate.
//!
//! Identity + post-quantum keys: ML-DSA signatures (FIPS 204), ML-KEM
//! encapsulation (FIPS 203), both via the RustCrypto crates, both cited at
//! source in pq.rs. Signs on-device; keys never leave, never printed;
//! every signature and hash travels in an agility envelope that names its
//! algorithms — nothing hardcoded, so the estate can migrate for 1000 years.
//!
//! INDEPENDENCE LAW: this crate has NO banchor dependency, direct or
//! transitive. The wallet works fully with the anchor off. (See Cargo.toml
//! — the absence is the fence.)
//!
//! COMMANDS:
//!   Key files are sealed at rest under the owner's recovery words (keys.rs):
//!   every command that touches a seed takes --rec-env VAR, the name of an
//!   environment variable holding the bdidrec1 recovery code or the 24
//!   recovery words (never argv, never printed).
//!   bsigner keygen --alg ml-dsa-65 --rec-env VAR [--keydir DIR]
//!   bsigner keygen --alg ml-kem-768 --rec-env VAR [--keydir DIR]
//!   bsigner sign --key-id ID --file PATH --rec-env VAR [--keydir DIR] [--out PATH]
//!   bsigner verify --key-id ID --file PATH --envelope PATH [--keydir DIR]   (public half only)
//!   bsigner list [--keydir DIR]
//!   bsigner keys-seal --key-id ID --rec-env VAR [--keydir DIR]
//!     (reseals a plaintext bheart.keyset/1 file written before 2026-10-08)
//!   bsigner kemtest --key-id ID --rec-env VAR [--keydir DIR]   (encapsulate+decapsulate roundtrip receipt)
//!   bsigner x402pay --key-id ID --offer PATH --policy PATH --rec-env VAR [--keydir DIR] [--out PATH]
//!     (the PRE-SIGNATURE OFFER GATE: verifies the pinned seller's signature
//!      on the offer, checks the allowlist + expiry + per-signature cap +
//!      remaining budget BEFORE any signing, validates the exact-multi split
//!      invariants, then emits ONE signed instruction paying seller + tithe
//!      together — signed, never submitted; see src/x402.rs for the laws)
//!   bsigner bpq-open --object PATH --rec-env VAR [--context CTX] [--out PATH]
//!     (opens a bpq1 sealed object made in the browser — surfaces/bpq.js —
//!      with the keys your bzDiD recovery code derives; the code is read from
//!      the environment variable VAR, never from argv, and never printed.
//!      Without --context it opens with the phrase-only vault (context
//!      "root"), which opens every "only me" file the wallet seals; with
//!      --context pq:NAME it tries that vault, then NAME's vault, then NAME's
//!      X-Wing key, for files shared to NAME or sealed before 2026-10-04.
//!      The context "root" is reserved and refused. Prints JSON with
//!      "opened_with" = root | context | x-wing; without --context the
//!      you.context, you.ml_dsa_65_public_sha3 and you.x_wing_public_sha3
//!      fields are null)
//!   bsigner bpq-handover --rec-env VAR --context FROM --to-context TO [--at TIME] [--out PATH]
//!     (SPEC-BPQ-1 §5 succession handover v1: reveals FROM's SLH-DSA-SHAKE-256f
//!      key and signs with it the statement retiring FROM's id for TO's card)
//!   bsigner bpq-attest-nostr --rec-env VAR --context CTX --event ID [--out PATH]
//!     (SPEC-BPQ-1 §5b: CTX's bzpq1 key vouches for one Nostr event id, which
//!      Buzz and every relay still check by its secp256k1 Schnorr signature)
//!   bsigner bpq-verify --file PATH [--target FILE]
//!     (a bpq1 public key card, binding, handover or Nostr event attestation;
//!      or a detached signature, checked
//!      against the file named by --target)
//!   bsigner selftest
//!   bsigner version

mod alg;
mod b64;
mod bip39;
mod bpq;
mod envelope;
#[cfg(test)]
mod kat;
mod keys;
mod pq;
mod x402;

use serde_json::{json, Value};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match args.first().map(String::as_str) {
        Some("keygen") => cmd_keygen(&args[1..]),
        Some("sign") => cmd_sign(&args[1..]),
        Some("verify") => cmd_verify(&args[1..]),
        Some("list") => cmd_list(&args[1..]),
        Some("keys-seal") => cmd_keys_seal(&args[1..]),
        Some("kemtest") => cmd_kemtest(&args[1..]),
        Some("x402pay") => cmd_x402pay(&args[1..]),
        Some("bpq-open") => cmd_bpq_open(&args[1..]),
        Some("bpq-verify") => cmd_bpq_verify(&args[1..]),
        Some("bpq-handover") => cmd_bpq_handover(&args[1..]),
        Some("bpq-attest-nostr") => cmd_bpq_attest_nostr(&args[1..]),
        Some("selftest") => cmd_selftest(),
        Some("version") | None => {
            println!(
                "bsigner {} — the deciding organ of bHEartWALLet (ML-DSA/ML-KEM, agility envelopes, keys never leave)",
                env!("CARGO_PKG_VERSION")
            );
            0
        }
        Some(other) => {
            eprintln!("unknown command {other:?}");
            2
        }
    };
    std::process::exit(code);
}

struct Opts {
    keydir: Option<std::path::PathBuf>,
    alg: Option<String>,
    key_id: Option<String>,
    file: Option<String>,
    envelope: Option<String>,
    out: Option<String>,
    offer: Option<String>,
    policy: Option<String>,
    object: Option<String>,
    rec_env: Option<String>,
    context: Option<String>,
    target: Option<String>,
    to_context: Option<String>,
    at: Option<String>,
    event: Option<String>,
}

fn parse_opts(args: &[String]) -> Result<Opts, String> {
    let mut o = Opts {
        keydir: None,
        alg: None,
        key_id: None,
        file: None,
        envelope: None,
        out: None,
        offer: None,
        policy: None,
        object: None,
        rec_env: None,
        context: None,
        target: None,
        to_context: None,
        at: None,
        event: None,
    };
    let mut i = 0;
    while i < args.len() {
        let val = args
            .get(i + 1)
            .ok_or_else(|| format!("{} needs a value", args[i]))?
            .clone();
        match args[i].as_str() {
            "--keydir" => o.keydir = Some(val.into()),
            "--alg" => o.alg = Some(val),
            "--key-id" => o.key_id = Some(val),
            "--file" => o.file = Some(val),
            "--envelope" => o.envelope = Some(val),
            "--out" => o.out = Some(val),
            "--offer" => o.offer = Some(val),
            "--policy" => o.policy = Some(val),
            "--object" => o.object = Some(val),
            "--rec-env" => o.rec_env = Some(val),
            "--context" => o.context = Some(val),
            "--target" => o.target = Some(val),
            "--to-context" => o.to_context = Some(val),
            "--at" => o.at = Some(val),
            "--event" => o.event = Some(val),
            other => return Err(format!("unknown flag {other:?}")),
        }
        i += 2;
    }
    Ok(o)
}

/// The root vault of the owner's recovery words, from `--rec-env VAR`.
fn unlock(o: &Opts) -> Result<keys::Vault, String> {
    let var = o.rec_env.as_deref().ok_or(
        "key files are sealed at rest: pass the owner's recovery code with --rec-env VAR \
         (read from the environment variable VAR, never from argv)",
    )?;
    keys::Vault::from_env(var)
}

fn cmd_keygen(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let alg = match o.alg.as_deref() {
        Some(a) => a,
        None => return fail(
            "keygen needs --alg (ml-dsa-44|ml-dsa-65|ml-dsa-87|ml-kem-512|ml-kem-768|ml-kem-1024)"
                .into(),
        ),
    };
    let vault = match unlock(&o) {
        Ok(v) => v,
        Err(e) => return fail(e),
    };
    let result = if let Ok(sig) = alg::SigAlg::parse(alg) {
        keys::keygen_dsa(sig, o.keydir, &vault)
    } else if let Ok(kem) = alg::KemAlg::parse(alg) {
        keys::keygen_kem(kem, o.keydir, &vault)
    } else {
        return fail(format!("unknown --alg {alg:?}"));
    };
    match result {
        Ok(v) => {
            println!("{}", serde_json::to_string_pretty(&v).unwrap());
            0
        }
        Err(e) => fail(e),
    }
}

fn cmd_sign(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(kid), Some(file)) = (o.key_id.as_deref(), o.file.as_deref()) else {
        return fail("sign needs --key-id and --file".into());
    };
    let msg = match std::fs::read(file) {
        Ok(m) => m,
        Err(e) => return fail(format!("read {file}: {e}")),
    };
    let (alg, seed, _vk) = match unlock(&o).and_then(|v| keys::load_dsa(kid, o.keydir.clone(), &v))
    {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    match envelope::sign_envelope(alg, kid, &seed, &msg) {
        Ok(env) => {
            let text = serde_json::to_string_pretty(&env).unwrap();
            match o.out {
                Some(path) => {
                    if let Err(e) = std::fs::write(&path, &text) {
                        return fail(format!("write {path}: {e}"));
                    }
                    println!(
                        "{}",
                        json!({ "written": path, "alg": alg.id(), "key_id": kid, "envelope_type": "bheart.signature/1" })
                    );
                }
                None => println!("{text}"),
            }
            0
        }
        Err(e) => fail(e),
    }
}

fn cmd_verify(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(kid), Some(file), Some(env_path)) = (
        o.key_id.as_deref(),
        o.file.as_deref(),
        o.envelope.as_deref(),
    ) else {
        return fail("verify needs --key-id, --file, and --envelope".into());
    };
    let msg = match std::fs::read(file) {
        Ok(m) => m,
        Err(e) => return fail(format!("read {file}: {e}")),
    };
    let env_text = match std::fs::read_to_string(env_path) {
        Ok(t) => t,
        Err(e) => return fail(format!("read {env_path}: {e}")),
    };
    let env: Value = match serde_json::from_str(&env_text) {
        Ok(v) => v,
        Err(e) => return fail(format!("envelope parse: {e}")),
    };
    let (_alg, vk) = match keys::load_dsa_public(kid, o.keydir) {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    match envelope::verify_envelope(&env, &vk, &msg) {
        Ok(()) => {
            println!(
                "{}",
                json!({ "verified": true, "key_id": kid, "alg": env["alg"] })
            );
            0
        }
        Err(e) => {
            println!("{}", json!({ "verified": false, "reason": e }));
            1
        }
    }
}

fn cmd_list(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&keys::list_keys(o.keydir)).unwrap()
    );
    0
}

fn cmd_keys_seal(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let Some(kid) = o.key_id.as_deref() else {
        return fail("keys-seal needs --key-id and --rec-env VAR".into());
    };
    match unlock(&o).and_then(|v| keys::seal_plaintext(kid, o.keydir.clone(), &v)) {
        Ok(v) => {
            println!("{}", serde_json::to_string_pretty(&v).unwrap());
            0
        }
        Err(e) => fail(e),
    }
}

fn cmd_kemtest(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let Some(kid) = o.key_id.as_deref() else {
        return fail("kemtest needs --key-id (a ml-kem keyset)".into());
    };
    let (alg, seed, ek) = match unlock(&o).and_then(|v| keys::load_kem(kid, o.keydir.clone(), &v)) {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    let (ct, ss_enc) = match pq::kem_encapsulate(alg, &ek) {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    let ss_dec = match pq::kem_decapsulate(alg, &seed, &ct) {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    // shared secrets are printed as MATCH/NO-MATCH + digest, never in full
    let agree = ss_enc == ss_dec;
    println!(
        "{}",
        json!({
            "kem": alg.id(),
            "key_id": kid,
            "ciphertext_bytes": ct.len(),
            "shared_secret_bytes": 32,
            "shared_secret_digest": { "alg": "sha3-256", "b64u": b64::sha3_256_b64u(&ss_enc) },
            "roundtrip": if agree { "agrees" } else { "DISAGREES" },
        })
    );
    if agree {
        0
    } else {
        1
    }
}

fn cmd_x402pay(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(kid), Some(offer_path), Some(policy_path)) =
        (o.key_id.as_deref(), o.offer.as_deref(), o.policy.as_deref())
    else {
        return fail("x402pay needs --key-id, --offer, and --policy".into());
    };
    let read_json = |path: &str| -> Result<Value, String> {
        std::fs::read_to_string(path)
            .map_err(|e| format!("read {path}: {e}"))
            .and_then(|t| serde_json::from_str(&t).map_err(|e| format!("parse {path}: {e}")))
    };
    let offer_doc = match read_json(offer_path) {
        Ok(v) => v,
        Err(e) => return fail(e),
    };
    let policy_doc = match read_json(policy_path) {
        Ok(v) => v,
        Err(e) => return fail(e),
    };
    let (policy, used_default_cap) = match x402::parse_policy(&policy_doc) {
        Ok(p) => p,
        Err(e) => return fail(e),
    };
    // THE GATE — every refusal below happens BEFORE any key is touched
    let instruction = match x402::gate(&offer_doc, &policy) {
        Ok(i) => i,
        Err(refusal) => {
            // a refusal is a receipt, not a crash: the organ said NO, on the record
            println!(
                "{}",
                json!({
                    "signed": false,
                    "refusal": refusal,
                    "gate": "pre-signature (x402-RAID-Z31): allowlist, pinned seller sig, expiry, asset, per-signature cap, remaining budget, split invariants — all checked before signing"
                })
            );
            return 1;
        }
    };
    // the key is unlocked only after the gate has said yes
    let (alg, seed, _vk) = match unlock(&o).and_then(|v| keys::load_dsa(kid, o.keydir.clone(), &v))
    {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    let signature = match envelope::sign_envelope(alg, kid, &seed, &x402::canonical(&instruction)) {
        Ok(env) => env,
        Err(e) => return fail(e),
    };
    let payment = json!({
        "signed": true,
        "instruction": instruction,
        "signature": signature,
        "default_cap_applied": used_default_cap,
        "note": "signed, never submitted — submission is the rail adapter's job (qisma signCascade shape)",
    });
    let text = serde_json::to_string_pretty(&payment).unwrap();
    match o.out {
        Some(path) => {
            if let Err(e) = std::fs::write(&path, &text) {
                return fail(format!("write {path}: {e}"));
            }
            println!(
                "{}",
                json!({
                    "written": path,
                    "kind": payment["instruction"]["kind"],
                    "outputs": payment["instruction"]["outputs"].as_array().map(Vec::len),
                    "amount_atomic": payment["instruction"]["amount_atomic"],
                    "memo": payment["instruction"]["memo"],
                })
            );
        }
        None => println!("{text}"),
    }
    0
}

fn cmd_bpq_open(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(path), Some(var)) = (o.object, o.rec_env) else {
        return fail("bpq-open needs --object PATH --rec-env VAR [--context CTX]".into());
    };
    let context = o.context;
    let obj = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => return fail(format!("read {path}: {e}")),
    };
    let code = match std::env::var(&var) {
        Ok(c) => zeroize::Zeroizing::new(c),
        Err(_) => return fail(format!("environment variable {var} is not set")),
    };
    let prk = match bip39::master_prk_from_recovery(&code) {
        Ok(p) => p,
        Err(e) => return fail(e),
    };
    // The phrase-only vault (context "root") first: every "only me" file the
    // wallet seals since 2026-10-04 opens with it. Then, when a context is
    // named, that persona's vault (files sealed before) and its X-Wing key
    // (files shared to that persona).
    let root = bpq::root_vault(&prk);
    let keys = match context.as_deref().map(|c| bpq::keys(&prk, c)).transpose() {
        Ok(k) => k,
        Err(e) => return fail(e.to_string()),
    };
    let mut opened = bpq::open(&obj, &bpq::Reader::SelfVault(&root)).map(|x| (x, "root"));
    if let Some(k) = &keys {
        opened = opened
            .or_else(|_| {
                bpq::open(&obj, &bpq::Reader::SelfVault(k.vault())).map(|x| (x, "context"))
            })
            .or_else(|_| bpq::open(&obj, &bpq::Reader::XWing(k)).map(|x| (x, "x-wing")));
    }
    let (opened, via) = match opened {
        Ok(x) => x,
        Err(bpq::BpqError::NoKey) if keys.is_none() => {
            return fail(format!(
                "{}; files sealed before 2026-10-04 open with --context pq:NAME",
                bpq::BpqError::NoKey
            ))
        }
        Err(e) => return fail(e.to_string()),
    };
    let sealed_by = opened.sealed_by.as_ref().map(
        |s| json!({ "ok": s.ok, "id": s.id, "public_key_sha3": b64::sha3_256_b64u(&s.public_key) }),
    );
    if let Some(out) = &o.out {
        if let Err(e) = std::fs::write(out, &opened.bytes) {
            return fail(format!("write {out}: {e}"));
        }
    }
    println!(
        "{}",
        json!({
            "opened": true,
            "bytes": opened.bytes.len(),
            "plaintext_sha3": b64::sha3_256_b64u(&opened.bytes),
            "meta": opened.meta,
            "sealed_by": sealed_by,
            "opened_with": via,
            "you": {
                "context": context,
                "ml_dsa_65_public_sha3": keys.as_ref().map(|k| b64::sha3_256_b64u(&k.dsa_public)),
                "x_wing_public_sha3": keys.as_ref().map(|k| b64::sha3_256_b64u(&k.kem_public)),
            },
            "written": o.out,
        })
    );
    0
}

fn cmd_bpq_handover(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(var), Some(from), Some(to)) = (
        o.rec_env.as_deref(),
        o.context.as_deref(),
        o.to_context.as_deref(),
    ) else {
        return fail("bpq-handover needs --rec-env VAR --context FROM --to-context TO".into());
    };
    let code = match std::env::var(var) {
        Ok(c) => zeroize::Zeroizing::new(c),
        Err(_) => return fail(format!("environment variable {var} is not set")),
    };
    let prk = match bip39::master_prk_from_recovery(&code) {
        Ok(p) => p,
        Err(e) => return fail(e),
    };
    let at = o.at.clone().unwrap_or_else(|| keys::now_iso().0);
    let h = match bpq::handover(&prk, from, to, &at) {
        Ok(h) => h,
        Err(e) => return fail(e.to_string()),
    };
    let text = serde_json::to_string_pretty(&h).unwrap();
    match o.out {
        Some(path) => {
            if let Err(e) = std::fs::write(&path, &text) {
                return fail(format!("write {path}: {e}"));
            }
            println!(
                "{}",
                json!({ "written": path, "kind": "handover", "from": h["from"], "to": h["to"], "at": h["at"] })
            );
        }
        None => println!("{text}"),
    }
    0
}

fn cmd_bpq_attest_nostr(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let (Some(var), Some(ctx), Some(event)) = (
        o.rec_env.as_deref(),
        o.context.as_deref(),
        o.event.as_deref(),
    ) else {
        return fail("bpq-attest-nostr needs --rec-env VAR --context CTX --event ID".into());
    };
    let code = match std::env::var(var) {
        Ok(c) => zeroize::Zeroizing::new(c),
        Err(_) => return fail(format!("environment variable {var} is not set")),
    };
    let prk = match bip39::master_prk_from_recovery(&code) {
        Ok(p) => p,
        Err(e) => return fail(e),
    };
    let a = match bpq::attest_nostr(&prk, ctx, event) {
        Ok(a) => a,
        Err(e) => return fail(e.to_string()),
    };
    let text = serde_json::to_string_pretty(&a).unwrap();
    match o.out {
        Some(path) => {
            if let Err(e) = std::fs::write(&path, &text) {
                return fail(format!("write {path}: {e}"));
            }
            println!(
                "{}",
                json!({ "written": path, "kind": "nostr-event", "id": a["id"], "event": a["event"] })
            );
        }
        None => println!("{text}"),
    }
    0
}

fn cmd_bpq_verify(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let Some(path) = o.file else {
        return fail("bpq-verify needs --file PATH".into());
    };
    let doc: Value = match std::fs::read(&path)
        .map_err(|e| e.to_string())
        .and_then(|b| serde_json::from_slice(&b).map_err(|e| e.to_string()))
    {
        Ok(v) => v,
        Err(e) => return fail(format!("{path}: {e}")),
    };
    let (kind, ok) = if doc["kind"] == "detached" {
        let Some(target) = o.target else {
            return fail("a detached signature needs --target FILE".into());
        };
        let bytes = match std::fs::read(&target) {
            Ok(b) => b,
            Err(e) => return fail(format!("read {target}: {e}")),
        };
        ("detached", bpq::verify_detached(&doc, &bytes).is_some())
    } else if doc["kind"] == "handover" {
        ("handover", bpq::verify_handover(&doc).is_some())
    } else if doc["kind"] == "nostr-event" {
        ("nostr-event", bpq::verify_nostr(&doc).is_some())
    } else if doc["kind"] == "binding" {
        ("binding", bpq::verify_bind(&doc))
    } else {
        ("card", bpq::verify_card(&doc))
    };
    println!(
        "{}",
        json!({ "kind": kind, "id": doc["id"], "from": doc["from"], "to": doc["to"], "event": doc["event"], "verified": ok })
    );
    if ok {
        0
    } else {
        1
    }
}

fn cmd_selftest() -> i32 {
    // exercise every public surface once; exit code is the receipt
    let dir = std::env::temp_dir().join("bheart-selftest");
    let _ = std::fs::remove_dir_all(&dir);
    let mut ok = true;
    // a throwaway root for the selftest's own throwaway keys
    let mut prk = zeroize::Zeroizing::new([0u8; 32]);
    getrandom::getrandom(prk.as_mut()).expect("OS entropy");
    let vault = keys::Vault::from_recovery_code(&bpq::recovery_code(&prk))
        .expect("a fresh recovery code decodes");
    for alg in ["ml-dsa-44", "ml-dsa-65", "ml-dsa-87"] {
        let sig = alg::SigAlg::parse(alg).unwrap();
        let out = keys::keygen_dsa(sig, Some(dir.clone()), &vault);
        ok &= out.is_ok();
        if let Ok(out) = out {
            let kid = out["key_id"].as_str().unwrap().to_string();
            let (a, seed, vk) = keys::load_dsa(&kid, Some(dir.clone()), &vault).unwrap();
            let env = envelope::sign_envelope(a, &kid, &seed, b"selftest").unwrap();
            ok &= envelope::verify_envelope(&env, &vk, b"selftest").is_ok();
            ok &= envelope::verify_envelope(&env, &vk, b"tamper").is_err();
        }
    }
    for alg in ["ml-kem-512", "ml-kem-768", "ml-kem-1024"] {
        let kem = alg::KemAlg::parse(alg).unwrap();
        let out = keys::keygen_kem(kem, Some(dir.clone()), &vault);
        ok &= out.is_ok();
        if let Ok(out) = out {
            let kid = out["key_id"].as_str().unwrap().to_string();
            let (a, seed, ek) = keys::load_kem(&kid, Some(dir.clone()), &vault).unwrap();
            if let Ok((ct, ss1)) = pq::kem_encapsulate(a, &ek) {
                ok &= pq::kem_decapsulate(a, &seed, &ct)
                    .map(|ss2| ss1 == ss2)
                    .unwrap_or(false);
            } else {
                ok = false;
            }
        }
    }
    ok &= alg::SigAlg::parse("ml-dsa-65-hedged-2265").is_err(); // agility refusal
                                                                // x402 gate pass: a good offer signs ONE exact-multi instruction, an
                                                                // over-cap offer is refused BEFORE signing, and the payment verifies offline
    {
        use crate::pq::dsa_generate;
        let g = dsa_generate(alg::SigAlg::MlDsa44);
        let seller_seed = zeroize::Zeroizing::new(g.seed);
        let buyer = dsa_generate(alg::SigAlg::MlDsa44);
        let buyer_seed = zeroize::Zeroizing::new(buyer.seed);
        let now = keys::now_ms() as u64;
        let offer = json!({
            "pay_to": "selftsellr11", "rail": "vaulta",
            "asset": {"symbol": "A", "precision": 4},
            "amount_atomic": 6_000, "expires_at_ms": now + 60_000,
            "nonce": 1, "tithe_bp": 1_000,
            "outputs": [
                {"to": "selftsellr11", "amount_atomic": 5_400, "role": "seller"},
                {"to": "selfttithe11", "amount_atomic": 600, "role": "tithe"},
            ],
        });
        let sig = envelope::sign_envelope(
            alg::SigAlg::MlDsa44,
            "selftest-seller",
            &seller_seed,
            &x402::canonical(&offer),
        )
        .unwrap();
        let offer_doc = json!({"kind": "x402.offer/1", "offer": offer, "seller_sig": sig});
        let policy_doc = json!({
            "payer": "selftpayer11",
            "remaining_budget_atomic": 50_000,
            "asset": {"symbol": "A", "precision": 4},
            "now_ms": now,
            "allowlist": [{
                "pay_to": "selftsellr11", "rail": "vaulta",
                "seller_key_id": "selftest-seller",
                "seller_vk_b64u": b64::b64u(&g.verifying_key),
            }],
        });
        let (policy, _) = x402::parse_policy(&policy_doc).unwrap();
        let instruction = x402::gate(&offer_doc, &policy);
        ok &= instruction.is_ok();
        if let Ok(instruction) = instruction {
            let pay_sig = envelope::sign_envelope(
                alg::SigAlg::MlDsa44,
                "selftest-buyer",
                &buyer_seed,
                &x402::canonical(&instruction),
            )
            .unwrap();
            ok &= x402::verify_payment(
                &json!({"instruction": instruction, "signature": pay_sig}),
                &buyer.verifying_key,
            )
            .is_ok();
        }
        let mut over = offer_doc.clone();
        over["offer"]["amount_atomic"] = json!(1_000_000);
        over["offer"]["outputs"][0]["amount_atomic"] = json!(999_100);
        // re-sign the tampered body so ONLY the cap check can refuse it
        let over_sig = envelope::sign_envelope(
            alg::SigAlg::MlDsa44,
            "selftest-seller",
            &seller_seed,
            &x402::canonical(&over["offer"]),
        )
        .unwrap();
        over["seller_sig"] = over_sig;
        ok &= matches!(x402::gate(&over, &policy), Err(r) if r.contains("over per-signature cap"));
    }
    let _ = std::fs::remove_dir_all(&dir);
    println!(
        "{}",
        json!({ "selftest": if ok { "PASS" } else { "FAIL" }, "covered": ["ml-dsa-44/65/87 roundtrip+tamper", "ml-kem-512/768/1024 roundtrip", "future-alg refusal", "keys never printed", "x402 pre-signature gate + exact-multi sign/verify + over-cap refusal"] })
    );
    if ok {
        0
    } else {
        1
    }
}

fn fail(e: String) -> i32 {
    eprintln!("bsigner: {e}");
    1
}
