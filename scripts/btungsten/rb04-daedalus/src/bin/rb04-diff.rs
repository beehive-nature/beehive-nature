//! rb04-diff: run RB04's comparison and print one JSON summary line.
//!
//! usage:
//!   rb04-diff check --variant NAME --corpus vectors|sampled [--seed N --count N]
//!   rb04-diff bench --seed N --count N --reps N
//!
//! `check` compares one grammar variant with BNR's decode on every input of
//! the corpus and reports, per dimension, how many inputs it applied to, how
//! many agreed, and the first disagreement (with, for a TEETH variant,
//! whether the honest grammar agrees with BNR on that same input). On the
//! vectors it also checks BNR's answers against the pinned or constructed
//! ones. `bench` times BNR's decode and the honest grammar's two entries
//! over one sampled corpus, interleaved, `reps` times.
//!
//! Exit 0 when the run completed (the verdicts are in the summary), 2 on a
//! usage error. Inputs are written base64url in dot-separated groups of 32
//! characters (`input_b64url_dotted`; remove the dots to decode): an input
//! with many zero bytes is a long run of `A`, which a hex-shaped scan of a
//! committed receipt would read as a 48+ character hex run.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use rb04_daedalus::corpus::{self, Case, Expect};
use rb04_daedalus::{Bnr, Comparison, DIMENSIONS, Ddl, bnr, compare, variant};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

fn b64url(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = chunk.iter().fold(0u32, |a, &b| (a << 8) | b as u32) << (8 * (3 - chunk.len()));
        for i in 0..=chunk.len() {
            s.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    s
}

/// base64url in groups of 32 characters joined by `.`: no run of
/// hex-alphabet characters is longer than 32.
fn b64url_dotted(bytes: &[u8]) -> String {
    let s = b64url(bytes);
    s.as_bytes()
        .chunks(32)
        .map(|c| std::str::from_utf8(c).expect("base64url is ASCII"))
        .collect::<Vec<_>>()
        .join(".")
}

/// One digest over the corpus: each input's length (u64 little-endian) and
/// bytes, in order.
fn corpus_tag(cases: &[Case]) -> String {
    let mut h = Sha256::new();
    for c in cases {
        h.update((c.input.len() as u64).to_le_bytes());
        h.update(&c.input);
    }
    format!("sha256:{}", b64url(&h.finalize()))
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn usage() -> ! {
    eprintln!(
        "usage: rb04-diff check --variant NAME --corpus vectors|sampled [--seed N --count N]\n       rb04-diff bench --seed N --count N --reps N"
    );
    std::process::exit(2)
}

fn num(args: &[String], name: &str) -> u64 {
    arg(args, name)
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| usage())
}

fn bnr_text(b: &Bnr) -> String {
    match b {
        Bnr::Accept(_) => "accept".into(),
        Bnr::Refuse(c) => format!("refuse {c}"),
        Bnr::Panic => "panic".into(),
    }
}

fn ddl_text(d: &Ddl) -> String {
    match d {
        Ddl::Accept { consumed, .. } => format!("accept, consumed {consumed}"),
        Ddl::Fail(m) => format!("fail: {m}"),
        Ddl::Exception(m) => format!("exception: {m}"),
        Ddl::Panic => "panic".into(),
    }
}

fn dims_json(c: &Comparison) -> Value {
    let mut m = serde_json::Map::new();
    for (k, d) in DIMENSIONS.iter().zip(c.dims.iter()) {
        m.insert(
            k.to_string(),
            json!(d.map_or("n/a", |a| if a { "agree" } else { "disagree" })),
        );
    }
    Value::Object(m)
}

/// Panics are caught per input and counted; the first few are also shown.
static PANICS_SHOWN: AtomicUsize = AtomicUsize::new(0);

fn check(args: &[String]) -> Value {
    let vname = arg(args, "--variant").unwrap_or_else(|| usage());
    let v = variant(&vname).unwrap_or_else(|| usage());
    let honest = variant("honest").expect("the honest grammar is compiled in");
    let corpus_name = arg(args, "--corpus").unwrap_or_else(|| usage());
    let (cases, seed, count): (Vec<Case>, Value, Value) = match corpus_name.as_str() {
        "vectors" => (corpus::vectors(), Value::Null, Value::Null),
        "sampled" => {
            let seed = num(args, "--seed");
            let count = num(args, "--count");
            (
                corpus::sampled(seed, count).collect(),
                json!(seed.to_string()),
                json!(count),
            )
        }
        _ => usage(),
    };
    let mut kinds: BTreeMap<&str, u64> = BTreeMap::new();
    let mut refusals: BTreeMap<&str, u64> = BTreeMap::new();
    let (mut b_acc, mut b_panic, mut e_acc, mut p_acc, mut exc, mut d_panic) = (0, 0, 0, 0, 0, 0);
    let mut compared = [0u64; 4];
    let mut agree = [0u64; 4];
    let mut witness: [Option<Value>; 4] = [None, None, None, None];
    let (mut checked, mut mismatched) = (0u64, 0u64);
    let mut first_mismatch = Value::Null;
    let t0 = Instant::now();
    for (idx, case) in cases.iter().enumerate() {
        *kinds.entry(case.kind).or_default() += 1;
        let c = compare(v, &case.input);
        match &c.bnr {
            Bnr::Accept(_) => b_acc += 1,
            Bnr::Refuse(code) => *refusals.entry(code).or_default() += 1,
            Bnr::Panic => b_panic += 1,
        }
        for d in [&c.exact, &c.prefix] {
            match d {
                Ddl::Exception(_) => exc += 1,
                Ddl::Panic => d_panic += 1,
                _ => {}
            }
        }
        e_acc += c.exact.accepted().is_some() as u64;
        p_acc += c.prefix.accepted().is_some() as u64;
        if let Some(exp) = &case.expect {
            checked += 1;
            let ok = match (exp, &c.bnr) {
                (Expect::Accept(None), Bnr::Accept(_)) => true,
                (Expect::Accept(Some(want)), Bnr::Accept(got)) => want == got,
                (Expect::Refuse(want), Bnr::Refuse(got)) => want == got,
                _ => false,
            };
            if !ok {
                mismatched += 1;
                if first_mismatch.is_null() {
                    first_mismatch = json!({ "index": idx, "kind": case.kind, "input_b64url_dotted": b64url_dotted(&case.input), "expected": format!("{exp:?}").chars().take(400).collect::<String>(), "bnr": bnr_text(&c.bnr) });
                }
            }
        }
        for k in 0..4 {
            let Some(a) = c.dims[k] else { continue };
            compared[k] += 1;
            if a {
                agree[k] += 1;
            } else if witness[k].is_none() {
                let mut w = json!({
                    "index": idx,
                    "kind": case.kind,
                    "len": case.input.len(),
                    "input_b64url_dotted": b64url_dotted(&case.input),
                    "bnr": bnr_text(&c.bnr),
                    "exact": ddl_text(&c.exact),
                    "prefix": ddl_text(&c.prefix),
                    "dims": dims_json(&c),
                });
                if v.name != "honest" {
                    let h = compare(honest, &case.input);
                    w["honest_agrees"] = json!(h.agrees_everywhere());
                    w["honest_dims"] = dims_json(&h);
                }
                witness[k] = Some(w);
            }
        }
    }
    let elapsed = t0.elapsed().as_nanos() as u64;
    let mut dims = serde_json::Map::new();
    for k in 0..4 {
        dims.insert(
            DIMENSIONS[k].to_string(),
            json!({ "compared": compared[k], "agree": agree[k], "disagree": compared[k] - agree[k], "witness": witness[k] }),
        );
    }
    json!({
        "schema": "rb04-diff/1",
        "mode": "check",
        "variant": v.name,
        "corpus": corpus_name,
        "seed": seed,
        "count": count,
        "inputs": cases.len(),
        "corpus_sha256": corpus_tag(&cases),
        "kinds": kinds,
        "bnr": { "accepted": b_acc, "refusals": refusals, "panics": b_panic },
        "ddl": { "exact_accepted": e_acc, "prefix_accepted": p_acc, "exceptions": exc, "panics": d_panic },
        "expected": { "checked": checked, "mismatched": mismatched, "first_mismatch": first_mismatch },
        "dims": dims,
        "elapsed_ns": elapsed,
    })
}

fn bench(args: &[String]) -> Value {
    let seed = num(args, "--seed");
    let count = num(args, "--count");
    let reps = num(args, "--reps");
    let honest = variant("honest").expect("the honest grammar is compiled in");
    let cases: Vec<Case> = corpus::sampled(seed, count).collect();
    let bytes: u64 = cases.iter().map(|c| c.input.len() as u64).sum();
    let mut times: [Vec<u64>; 3] = [Vec::new(), Vec::new(), Vec::new()];
    let mut accepted = [0u64; 3];
    for _ in 0..reps {
        for (k, t) in times.iter_mut().enumerate() {
            let mut acc = 0u64;
            let t0 = Instant::now();
            for c in &cases {
                let ok = match k {
                    0 => matches!(std::hint::black_box(bnr(&c.input)), Bnr::Accept(_)),
                    1 => std::hint::black_box((honest.exact)(&c.input))
                        .accepted()
                        .is_some(),
                    _ => std::hint::black_box((honest.prefix)(&c.input))
                        .accepted()
                        .is_some(),
                };
                acc += ok as u64;
            }
            t.push(t0.elapsed().as_nanos() as u64);
            accepted[k] = acc;
        }
    }
    let names = ["bnr_decode", "ddl_exact", "ddl_prefix"];
    let mut parsers = serde_json::Map::new();
    for k in 0..3 {
        let mut s = times[k].clone();
        s.sort_unstable();
        parsers.insert(
            names[k].to_string(),
            json!({ "ns_per_pass": times[k], "median_ns_per_pass": s[s.len() / 2], "median_ns_per_input": s[s.len() / 2] / count.max(1), "accepted_per_pass": accepted[k] }),
        );
    }
    json!({
        "schema": "rb04-diff/1",
        "mode": "bench",
        "seed": seed.to_string(),
        "count": count,
        "reps": reps,
        "corpus_sha256": corpus_tag(&cases),
        "corpus_bytes": bytes,
        "parsers": parsers,
        "note": "one pass = every input of the corpus through one parser; passes are interleaved bnr, exact, prefix per repetition; the median is the upper median",
    })
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        if PANICS_SHOWN.fetch_add(1, Ordering::Relaxed) < 20 {
            eprintln!("caught panic: {info}");
        }
    }));
    let args: Vec<String> = std::env::args().skip(1).collect();
    let out = match args.first().map(String::as_str) {
        Some("check") => check(&args),
        Some("bench") => bench(&args),
        _ => usage(),
    };
    println!("{out}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dotted_input_has_no_long_hex_shaped_run_and_decodes_back() {
        let zeros = vec![0u8; 300];
        let d = b64url_dotted(&zeros);
        let longest = d
            .split(|c: char| !c.is_ascii_hexdigit())
            .map(str::len)
            .max()
            .unwrap_or(0);
        assert!(longest <= 32, "{longest}");
        assert_eq!(d.replace('.', ""), b64url(&zeros));
    }
}
