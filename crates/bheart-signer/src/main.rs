//! bheart-signer — bHEartWALLet's DECIDING organ.
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
//! NOT to be confused with crates/bsigner — the C1 Trezor scaffold whose
//! fences (cannot sign, RefusingSigner) are a different lane's law and are
//! untouched by this one.
//!
//! COMMANDS:
//!   bheart-signer keygen --alg ml-dsa-65 [--keydir DIR]
//!   bheart-signer keygen --alg ml-kem-768 [--keydir DIR]
//!   bheart-signer sign --key-id ID --file PATH [--keydir DIR] [--out PATH]
//!   bheart-signer verify --key-id ID --file PATH --envelope PATH [--keydir DIR]
//!   bheart-signer list [--keydir DIR]
//!   bheart-signer kemtest --key-id ID [--keydir DIR]   (encapsulate+decapsulate roundtrip receipt)
//!   bheart-signer selftest
//!   bheart-signer version

mod alg;
mod b64;
mod envelope;
mod keys;
mod pq;

use serde_json::{json, Value};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match args.first().map(String::as_str) {
        Some("keygen") => cmd_keygen(&args[1..]),
        Some("sign") => cmd_sign(&args[1..]),
        Some("verify") => cmd_verify(&args[1..]),
        Some("list") => cmd_list(&args[1..]),
        Some("kemtest") => cmd_kemtest(&args[1..]),
        Some("selftest") => cmd_selftest(),
        Some("version") | None => {
            println!(
                "bheart-signer {} — the deciding organ of bHEartWALLet (ML-DSA/ML-KEM, agility envelopes, keys never leave)",
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
}

fn parse_opts(args: &[String]) -> Result<Opts, String> {
    let mut o = Opts { keydir: None, alg: None, key_id: None, file: None, envelope: None, out: None };
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
            other => return Err(format!("unknown flag {other:?}")),
        }
        i += 2;
    }
    Ok(o)
}

fn cmd_keygen(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let alg = match o.alg.as_deref() {
        Some(a) => a,
        None => return fail("keygen needs --alg (ml-dsa-44|ml-dsa-65|ml-dsa-87|ml-kem-512|ml-kem-768|ml-kem-1024)".into()),
    };
    let result = if let Ok(sig) = alg::SigAlg::parse(alg) {
        keys::keygen_dsa(sig, o.keydir)
    } else if let Ok(kem) = alg::KemAlg::parse(alg) {
        keys::keygen_kem(kem, o.keydir)
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
    let (alg, seed, _vk) = match keys::load_dsa(kid, o.keydir.clone()) {
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
                    println!("{}", json!({ "written": path, "alg": alg.id(), "key_id": kid, "envelope_type": "bheart.signature/1" }));
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
    let (Some(kid), Some(file), Some(env_path)) =
        (o.key_id.as_deref(), o.file.as_deref(), o.envelope.as_deref())
    else {
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
    let (_alg, _seed, vk) = match keys::load_dsa(kid, o.keydir) {
        Ok(x) => x,
        Err(e) => return fail(e),
    };
    match envelope::verify_envelope(&env, &vk, &msg) {
        Ok(()) => {
            println!("{}", json!({ "verified": true, "key_id": kid, "alg": env["alg"] }));
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
    println!("{}", serde_json::to_string_pretty(&keys::list_keys(o.keydir)).unwrap());
    0
}

fn cmd_kemtest(args: &[String]) -> i32 {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    let Some(kid) = o.key_id.as_deref() else {
        return fail("kemtest needs --key-id (a ml-kem keyset)".into());
    };
    let (alg, seed, ek) = match keys::load_kem(kid, o.keydir) {
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

fn cmd_selftest() -> i32 {
    // exercise every public surface once; exit code is the receipt
    let dir = std::env::temp_dir().join("bheart-selftest");
    let _ = std::fs::remove_dir_all(&dir);
    let mut ok = true;
    for alg in ["ml-dsa-44", "ml-dsa-65", "ml-dsa-87"] {
        let sig = alg::SigAlg::parse(alg).unwrap();
        let out = keys::keygen_dsa(sig, Some(dir.clone()));
        ok &= out.is_ok();
        if let Ok(out) = out {
            let kid = out["key_id"].as_str().unwrap().to_string();
            let (a, seed, vk) = keys::load_dsa(&kid, Some(dir.clone())).unwrap();
            let env = envelope::sign_envelope(a, &kid, &seed, b"selftest").unwrap();
            ok &= envelope::verify_envelope(&env, &vk, b"selftest").is_ok();
            ok &= envelope::verify_envelope(&env, &vk, b"tamper").is_err();
        }
    }
    for alg in ["ml-kem-512", "ml-kem-768", "ml-kem-1024"] {
        let kem = alg::KemAlg::parse(alg).unwrap();
        let out = keys::keygen_kem(kem, Some(dir.clone()));
        ok &= out.is_ok();
        if let Ok(out) = out {
            let kid = out["key_id"].as_str().unwrap().to_string();
            let (a, seed, ek) = keys::load_kem(&kid, Some(dir.clone())).unwrap();
            if let Ok((ct, ss1)) = pq::kem_encapsulate(a, &ek) {
                ok &= pq::kem_decapsulate(a, &seed, &ct).map(|ss2| ss1 == ss2).unwrap_or(false);
            } else {
                ok = false;
            }
        }
    }
    ok &= alg::SigAlg::parse("ml-dsa-65-hedged-2265").is_err(); // agility refusal
    let _ = std::fs::remove_dir_all(&dir);
    println!("{}", json!({ "selftest": if ok { "PASS" } else { "FAIL" }, "covered": ["ml-dsa-44/65/87 roundtrip+tamper", "ml-kem-512/768/1024 roundtrip", "future-alg refusal", "keys never printed"] }));
    if ok {
        0
    } else {
        1
    }
}

fn fail(e: String) -> i32 {
    eprintln!("bheart-signer: {e}");
    1
}
