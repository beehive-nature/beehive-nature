//! Bounded, offline repository proof organ. Private witness enters stdin only.
//! No verifier/plugin/parameter override, network, wallet, signer or payer.
use btungsten_p3count::{
    repository::{
        self, PROFILE,
        model::{self, Hash, Record},
    },
    statement::{Digest, F},
};
use bzdid::beelog::{Frontier, Head, verify_consistency, verify_inclusion};
use p3_field::{PrimeCharacteristicRing, PrimeField32};
use serde_json::{Value, json};
use std::io::Read;

fn fields(v: &Value, want: &[&str]) -> Result<(), String> {
    let m = v.as_object().ok_or("object")?;
    let mut keys: Vec<_> = m.keys().map(String::as_str).collect();
    keys.sort();
    let mut w = want.to_vec();
    w.sort();
    if keys != w {
        return Err("closed fields".into());
    }
    Ok(())
}
fn hex(v: &str) -> Result<Vec<u8>, String> {
    if v.len() % 2 != 0
        || !v
            .bytes()
            .all(|x| x.is_ascii_digit() || (b'a'..=b'f').contains(&x))
    {
        return Err("canonical hex".into());
    }
    v.as_bytes()
        .chunks_exact(2)
        .map(|c| u8::from_str_radix(std::str::from_utf8(c).unwrap(), 16).map_err(|_| "hex".into()))
        .collect()
}
fn hash(v: &Value) -> Result<Hash, String> {
    let s = v.as_str().ok_or("hash")?;
    let b = hex(s.strip_prefix("sha256:").ok_or("hash prefix")?)?;
    if b.len() != 32 {
        return Err("hash width".into());
    }
    Ok(core::array::from_fn(|k| {
        u16::from_le_bytes([b[k * 2], b[k * 2 + 1]])
    }))
}
fn raw_hash(v: &Value) -> Result<[u8; 32], String> {
    let s = v.as_str().ok_or("hash")?;
    hex(s.strip_prefix("sha256:").ok_or("hash prefix")?)?
        .try_into()
        .map_err(|_| "hash width".into())
}
fn encoded(h: &[u8; 32]) -> String {
    format!(
        "sha256:{}",
        h.iter().map(|b| format!("{b:02x}")).collect::<String>()
    )
}
fn head(v: &Value) -> Result<Head, String> {
    fields(v, &["size", "root"])?;
    Ok(Head {
        size: v["size"].as_u64().ok_or("size")?,
        root: raw_hash(&v["root"])?,
    })
}
fn head_json(h: &Head) -> Value {
    json!({"size":h.size,"root":encoded(&h.root)})
}
fn path(v: &Value) -> Result<Vec<[u8; 32]>, String> {
    let a = v.as_array().ok_or("path")?;
    if a.len() > 64 {
        return Err("path limit".into());
    }
    a.iter().map(raw_hash).collect()
}
fn leaf(v: &Value) -> Result<Vec<u8>, String> {
    let s = v.as_str().ok_or("leaf")?;
    if s.len() > 131_072 {
        return Err("leaf limit".into());
    }
    hex(s)
}
fn log_command(mode: &str, v: &Value) -> Result<Value, String> {
    if mode == "log-extend" {
        fields(v, &["frontier", "leaf"])?;
        let input = &v["frontier"];
        fields(input, &["size", "peaks"])?;
        let size = input["size"].as_u64().ok_or("size")?;
        let a = input["peaks"].as_array().ok_or("peaks")?;
        if a.len() != 64 {
            return Err("peak slots".into());
        }
        let mut f = Frontier {
            size,
            peaks: [None; 64],
        };
        for (k, x) in a.iter().enumerate() {
            if !x.is_null() {
                f.peaks[k] = Some(raw_hash(x)?);
            }
        }
        let e = f.append(&leaf(&v["leaf"])?)?;
        return Ok(
            json!({"previous":head_json(&e.previous),"head":head_json(&e.next),"frontier":{"size":f.size,"peaks":f.peaks.iter().map(|p|p.map(|h|encoded(&h))).collect::<Vec<_>>()},"inclusion":e.inclusion.iter().map(encoded).collect::<Vec<_>>(),"consistency":e.consistency.iter().map(encoded).collect::<Vec<_>>()}),
        );
    }
    fields(v, &["previous", "head", "leaf", "inclusion", "consistency"])?;
    let old = head(&v["previous"])?;
    let new = head(&v["head"])?;
    let bytes = leaf(&v["leaf"])?;
    let inc = path(&v["inclusion"])?;
    let con = path(&v["consistency"])?;
    if old.size.checked_add(1) != Some(new.size) {
        return Err("one append required".into());
    }
    verify_inclusion(&bytes, old.size, &new, &inc)?;
    if old.size == 0 {
        if old != Head::empty() || !con.is_empty() {
            return Err("empty head pin".into());
        }
    } else {
        verify_consistency(&old, &new, &con)?;
    }
    Ok(json!({"verified":true,"scope":"BEELOG inclusion and append consistency"}))
}
fn records(v: &Value) -> Result<Vec<Record>, String> {
    let a = v.as_array().ok_or("records")?;
    if ![8, 16, 32, 64].contains(&a.len()) {
        return Err("bucket".into());
    }
    a.iter()
        .map(|r| {
            fields(
                r,
                &[
                    "previous_state",
                    "next_state",
                    "proposal_digest",
                    "policy_digest",
                    "manifest_digest",
                    "qualification_digest",
                    "salt",
                    "scope",
                    "previous_sequence",
                    "sequence",
                    "active",
                ],
            )?;
            Ok(Record {
                previous: hash(&r["previous_state"])?,
                next: hash(&r["next_state"])?,
                proposal: hash(&r["proposal_digest"])?,
                policy: hash(&r["policy_digest"])?,
                manifest: hash(&r["manifest_digest"])?,
                qualification: hash(&r["qualification_digest"])?,
                salt: hash(&r["salt"])?,
                scope: hash(&r["scope"])?,
                before: r["previous_sequence"].as_u64().ok_or("sequence")?,
                after: r["sequence"].as_u64().ok_or("sequence")?,
                active: r["active"].as_bool().ok_or("active")?,
            })
        })
        .collect()
}
fn proof(v: &Value) -> Result<(usize, Hash, Digest, Vec<u8>), String> {
    fields(v, &["profile", "bucket", "context", "root", "chunks"])?;
    if v["profile"].as_str() != Some(PROFILE) {
        return Err("profile".into());
    }
    let bucket = usize::try_from(v["bucket"].as_u64().ok_or("bucket")?).map_err(|_| "bucket")?;
    let context = hash(&v["context"])?;
    let a = v["root"].as_array().ok_or("root")?;
    if a.len() != 8 {
        return Err("root width".into());
    }
    let mut root = [F::ZERO; 8];
    for (k, x) in a.iter().enumerate() {
        let n = x.as_u64().ok_or("root field")?;
        if n >= 2_130_706_433 {
            return Err("noncanonical root field".into());
        }
        root[k] = F::from_u32(n as u32);
    }
    let chunks = v["chunks"].as_array().ok_or("proof chunks")?;
    if chunks.is_empty() || chunks.len() > 128 {
        return Err("proof limit".into());
    }
    let mut bytes = Vec::new();
    for (k, c) in chunks.iter().enumerate() {
        let s = c.as_str().ok_or("proof chunk")?;
        if s.is_empty() || s.len() > 65536 || (k + 1 < chunks.len() && s.len() != 65536) {
            return Err("proof chunk size".into());
        }
        bytes.extend(hex(s)?);
    }
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("proof limit".into());
    }
    Ok((bucket, context, root, bytes))
}
fn run() -> Result<Value, String> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 1 {
        return Err("usage: repository-proof prove|commit|verify|check < private-json".into());
    }
    let mut input = Vec::new();
    std::io::stdin()
        .take(10 * 1024 * 1024 + 1)
        .read_to_end(&mut input)
        .map_err(|_| "stdin")?;
    if input.len() > 10 * 1024 * 1024 {
        return Err("input limit".into());
    }
    let v: Value = serde_json::from_slice(&input).map_err(|_| "input JSON")?;
    match args[0].as_str() {
        "log-extend" | "log-verify" => log_command(&args[0], &v),
        "prove" | "commit" => {
            fields(&v, &["context", "records"])?;
            let context = hash(&v["context"])?;
            let rs = records(&v["records"])?;
            model::validate(&rs)?;
            if args[0] == "commit" {
                return Ok(json!({"root":model::root(&context,&rs).map(|x|x.as_canonical_u32())}));
            }
            let s = repository::setup(rs.len())?;
            let (root, bytes) = s.prove(&context, &rs)?;
            let encoded: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            let chunks: Vec<_> = encoded
                .as_bytes()
                .chunks(65536)
                .map(|c| std::str::from_utf8(c).unwrap())
                .collect();
            Ok(
                json!({"profile":PROFILE,"bucket":rs.len(),"context":v["context"],"root":root.map(|x|x.as_canonical_u32()),"chunks":chunks}),
            )
        }
        "verify" | "check" => {
            let p = if args[0] == "check" {
                fields(&v, &["proof", "records"])?;
                &v["proof"]
            } else {
                &v
            };
            let (bucket, context, root, bytes) = proof(p)?;
            let s = repository::setup(bucket)?;
            if args[0] == "check" {
                let rs = records(&v["records"])?;
                model::validate(&rs)?;
                if rs.len() != bucket || model::root(&context, &rs) != root {
                    return Err("private transcript binding".into());
                }
            }
            s.verify(&context, &root, &bytes)?;
            let security = s.security();
            Ok(
                json!({"verified":true,"profile":PROFILE,"bucket":bucket,"security_proven_bits":security.proven,"security_conjectured_bits":security.conjectured,"scope":"bound private receipt-chain relation; full repository acceptance remains mandatory"}),
            )
        }
        _ => Err("unknown command".into()),
    }
}
fn main() {
    match run() {
        Ok(v) => println!("{v}"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
