//! Measured experimental comparator, not a shipping x0x/ANT qualification.
use btungsten_pq::{acvp, mldsa, report::Report};
use btungsten_x0x_pq::PreparedMlDsa65PublicKey as Prepared;
use saorsa_pqc::{
    api::sig::{self, MlDsaPublicKey, MlDsaSignature, MlDsaVariant},
    pqc::{MlDsa65, MlDsaOperations},
};
use serde_json::{json, Value};
use std::{hint::black_box, path::PathBuf, process::ExitCode, time::Instant};

const D: MlDsaVariant = MlDsaVariant::MlDsa65;
const IMP: &str = "prepared-fips204-0.4.6";
const LENGTHS: [usize; 12] = [0, 1, 63, 64, 65, 135, 136, 137, 255, 256, 257, 4096];
const SAMPLES: usize = 17;
const BATCH: usize = 64;

#[derive(Clone, Copy, PartialEq)]
enum Control {
    Honest,
    Accept,
    Truncate,
}

fn required() -> Vec<(&'static str, &'static str, usize)> {
    let mut rows = vec![
        ("official valid KAT", IMP, 3),
        ("official invalid KAT", IMP, 12),
        ("boundary DIFFERENTIAL", IMP, 36),
        ("boundary DIFFERENTIAL", "rustcrypto", 36),
        ("boundary DIFFERENTIAL", "libcrux", 36),
        ("TEETH malformed public-key length", IMP, 3),
    ];
    for row in [
        "TEETH last message byte",
        "TEETH last signature byte",
        "TEETH last context byte",
        "TEETH replaced identity key",
        "TEETH empty signature",
        "TEETH truncated signature",
        "TEETH overlong signature",
        "TEETH overlong context",
    ] {
        rows.push((row, IMP, 36));
    }
    rows
}

fn missing(report: &Report) -> Vec<String> {
    required()
        .into_iter()
        .filter_map(|(row, imp, expected)| {
            let actual = report.executed(row, imp);
            (actual != expected)
                .then(|| format!("{row} [{imp}]: expected {expected}, executed {actual}"))
        })
        .collect()
}

fn changed(input: &[u8]) -> Vec<u8> {
    let mut out = input.to_vec();
    if let Some(last) = out.last_mut() {
        *last ^= 1;
    } else {
        out.push(1);
    }
    out
}

fn verify(pk: &Prepared, m: &[u8], s: &[u8], ctx: &[u8], sabotage: Control) -> bool {
    match sabotage {
        Control::Accept => true,
        Control::Truncate => pk.verify(&m[..m.len().min(256)], s, ctx),
        Control::Honest => pk.verify(m, s, ctx),
    }
}

fn assurance(
    cache: &std::path::Path,
    sabotage: Control,
    empty: bool,
) -> Result<(Report, bool), String> {
    if empty {
        return Ok((Report::default(), false));
    }
    let manifest = acvp::manifest();
    let dir = "ML-DSA-sigVer-FIPS204";
    let prompt = manifest.load(cache, dir, "prompt.json")?;
    let expected = manifest.load(cache, dir, "expectedResults.json")?;
    let mut r = Report::default();
    for c in acvp::cases(&prompt, &expected)? {
        if c.group_str("parameterSet") != Some("ML-DSA-65")
            || c.group_str("signatureInterface") != Some("external")
            || c.group_str("preHash") == Some("preHash")
        {
            continue;
        }
        let pk = Prepared::from_bytes(&c.hex("pk"))?;
        let got = verify(
            &pk,
            &c.hex("message"),
            &c.hex("signature"),
            &c.hex("context"),
            sabotage,
        );
        r.record(
            if c.passed() {
                "official valid KAT"
            } else {
                "official invalid KAT"
            },
            IMP,
            c.tc,
            got == c.passed(),
        );
    }
    let dsa = sig::ml_dsa_65();
    let (pk, sk) = dsa.generate_keypair().map_err(|e| e.to_string())?;
    let (other, _) = dsa.generate_keypair().map_err(|e| e.to_string())?;
    let prepared = Prepared::from_bytes(&pk.to_bytes())?;
    let replaced = Prepared::from_bytes(&other.to_bytes())?;
    let mut tc = 0;
    for len in LENGTHS {
        let m = vec![0x42; len];
        for ctx_len in [0, 1, 255] {
            let ctx = vec![0x43; ctx_len];
            // The truncate control deliberately signs a prefix. Accepting a
            // changed suffix must convict the verifier's ignored-input defect.
            let signed_message = if sabotage == Control::Truncate {
                &m[..m.len().min(256)]
            } else {
                &m[..]
            };
            let s = dsa
                .sign_with_context(&sk, signed_message, &ctx)
                .map_err(|e| e.to_string())?;
            let bytes = s.to_bytes();
            r.record(
                "boundary DIFFERENTIAL",
                IMP,
                tc,
                verify(&prepared, &m, &bytes, &ctx, sabotage)
                    && dsa
                        .verify_with_context(&pk, &m, &s, &ctx)
                        .map_err(|e| e.to_string())?,
            );
            for i in mldsa::impls("ML-DSA-65") {
                r.record(
                    "boundary DIFFERENTIAL",
                    i.name,
                    tc,
                    (i.verify_ext)(&pk.to_bytes(), &m, &ctx, &bytes),
                );
            }
            for (row, ok) in [
                (
                    "TEETH last message byte",
                    !verify(&prepared, &changed(&m), &bytes, &ctx, sabotage),
                ),
                (
                    "TEETH last signature byte",
                    !verify(&prepared, &m, &changed(&bytes), &ctx, sabotage),
                ),
                (
                    "TEETH last context byte",
                    !verify(&prepared, &m, &bytes, &changed(&ctx), sabotage),
                ),
                (
                    "TEETH replaced identity key",
                    !verify(&replaced, &m, &bytes, &ctx, sabotage),
                ),
                (
                    "TEETH empty signature",
                    !verify(&prepared, &m, &[], &ctx, sabotage),
                ),
                (
                    "TEETH truncated signature",
                    !verify(&prepared, &m, &bytes[..bytes.len() - 1], &ctx, sabotage),
                ),
                (
                    "TEETH overlong signature",
                    !verify(
                        &prepared,
                        &m,
                        &[bytes.clone(), vec![0]].concat(),
                        &ctx,
                        sabotage,
                    ),
                ),
                (
                    "TEETH overlong context",
                    !verify(&prepared, &m, &bytes, &[0; 256], sabotage),
                ),
            ] {
                r.record(row, IMP, tc, ok);
            }
            tc += 1;
        }
    }
    for (tc, bytes) in [vec![], vec![0; 1951], vec![0; 1953]]
        .into_iter()
        .enumerate()
    {
        r.record(
            "TEETH malformed public-key length",
            IMP,
            tc as u64,
            Prepared::from_bytes(&bytes).is_err(),
        );
    }
    let complete = missing(&r).is_empty();
    r.not_run(
        "L2-L5 prepared/FIPS equivalence and protocol properties",
        "executed KAT/DIFFERENTIAL/TEETH only; BNR RustCrypto proofs do not transfer",
    );
    r.not_run(
        "other PQ algorithms, ANT/Autonomi storage, transport and full-system qualification",
        "public-key verification comparator; no network, storage or population-scale run",
    );
    Ok((r, complete))
}

fn timed(f: impl Fn() -> bool) -> f64 {
    let start = Instant::now();
    for _ in 0..BATCH {
        assert!(black_box(f()), "measured verification refused valid input");
    }
    start.elapsed().as_nanos() as f64 / BATCH as f64
}

fn stats(samples: &[f64]) -> Value {
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    json!({"ns_per_op_samples": samples, "median_ns_per_op": sorted[SAMPLES/2],
        "min_ns_per_op": sorted[0], "max_ns_per_op": sorted[SAMPLES-1]})
}

fn benchmark() -> Result<Vec<Value>, String> {
    let dsa = sig::ml_dsa_65();
    let (pk, sk) = dsa.generate_keypair().map_err(|e| e.to_string())?;
    let pk_bytes = pk.to_bytes();
    let prepared = Prepared::from_bytes(&pk_bytes)?;
    let legacy = MlDsa65::new();
    let legacy_pk =
        saorsa_pqc::pqc::types::MlDsaPublicKey::from_bytes(&pk_bytes).map_err(|e| e.to_string())?;
    let names = [
        "saorsa_api_warm",
        "ant_legacy_warm",
        "prepared_warm",
        "saorsa_api_cold",
        "prepared_cold",
    ];
    let mut rows = Vec::new();
    for len in [0, 256, 4096, 65536] {
        let m = vec![0x42; len];
        let signature = dsa.sign(&sk, &m).map_err(|e| e.to_string())?;
        let s = signature.to_bytes();
        let legacy_sig =
            saorsa_pqc::pqc::types::MlDsaSignature::from_bytes(&s).map_err(|e| e.to_string())?;
        let run = |profile| {
            timed(|| match profile {
                0 => dsa
                    .verify(black_box(&pk), black_box(&m), black_box(&signature))
                    .unwrap(),
                1 => legacy
                    .verify(black_box(&legacy_pk), black_box(&m), black_box(&legacy_sig))
                    .unwrap(),
                2 => prepared.verify(black_box(&m), black_box(&s), b""),
                3 => {
                    let pk = MlDsaPublicKey::from_bytes(D, black_box(&pk_bytes)).unwrap();
                    let sig = MlDsaSignature::from_bytes(D, black_box(&s)).unwrap();
                    dsa.verify(&pk, black_box(&m), &sig).unwrap()
                }
                4 => Prepared::from_bytes(black_box(&pk_bytes)).unwrap().verify(
                    black_box(&m),
                    black_box(&s),
                    b"",
                ),
                _ => unreachable!(),
            })
        };
        // Warm every profile, then rotate the execution order to limit drift bias.
        for profile in 0..5 {
            run(profile);
        }
        let mut samples: [Vec<f64>; 5] = std::array::from_fn(|_| Vec::new());
        for sample in 0..SAMPLES {
            for slot in 0..5 {
                let profile = (slot + sample) % 5;
                samples[profile].push(run(profile));
            }
        }
        let mut row = json!({"message_bytes": len, "context_bytes": 0});
        for (name, samples) in names.iter().zip(&samples) {
            row[name] = stats(samples);
        }
        let median = |profile: &str| row[profile]["median_ns_per_op"].as_f64().unwrap();
        let api_gain = median(names[0]) / median(names[2]);
        let ant_gain = median(names[1]) / median(names[2]);
        let cold_gain = median(names[3]) / median(names[4]);
        println!(
            "PQ-SPEED {len} B: prepared {:.1} us/op; API {:.3}x; ANT legacy {:.3}x; cold {:.3}x",
            median(names[2]) / 1000.0,
            api_gain,
            ant_gain,
            median(names[3]) / median(names[4])
        );
        row["speedup_vs_api_warm"] = json!(api_gain);
        row["speedup_vs_ant_legacy_warm"] = json!(ant_gain);
        row["speedup_vs_api_cold"] = json!(cold_gain);
        rows.push(row);
    }
    Ok(rows)
}

fn execute() -> Result<bool, String> {
    let mut cache = PathBuf::from("target/pq-vectors");
    let mut receipt = None;
    let mut sabotage = Control::Honest;
    let mut empty = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--cache" => cache = args.next().ok_or("--cache requires a directory")?.into(),
            "--receipt" => {
                receipt = Some(PathBuf::from(
                    args.next().ok_or("--receipt requires a file")?,
                ))
            }
            "--sabotage-accept" => sabotage = Control::Accept,
            "--sabotage-truncate" => sabotage = Control::Truncate,
            "--empty-vectors" => empty = true,
            _ => return Err(format!("unknown argument {arg}")),
        }
    }
    let (report, complete) = assurance(&cache, sabotage, empty)?;
    let (executed, passed) = report.totals();
    report.print_as("PQ-SPEED");
    for row in missing(&report) {
        println!("PQ-SPEED MISSING {row}");
    }
    let ok = complete && executed > 0 && report.failures().is_empty();
    println!(
        "PQ-SPEED assurance: {passed}/{executed}; coverage complete={complete}; sabotage={}",
        sabotage != Control::Honest
    );
    let timings = if ok { benchmark()? } else { Vec::new() };
    if let Some(receipt) = receipt {
        let value = json!({"schema": "btungsten.pq-speed/1", "inventory": serde_json::from_str::<Value>(include_str!("../../inventory.json")).unwrap(),
            "acvp_commit": acvp::manifest().commit, "assurance": report.json(), "coverage_complete": complete,
            "required_rows": required().len(), "missing": missing(&report),
            "result": if ok {"PASS"} else {"FAIL"}, "sabotage_accept": sabotage == Control::Accept,
            "sabotage_truncate": sabotage == Control::Truncate,
            "empty_vectors": empty,
            "experimental_comparator": true, "full_system_qualification": "UNESTABLISHED",
            "prepared_public_key_resident_bytes": std::mem::size_of::<Prepared>(),
            "encoded_public_key_bytes": 1952, "samples": SAMPLES, "batch_operations": BATCH,
            "warmup_batches_per_profile": 1, "timings": timings});
        std::fs::write(
            receipt,
            serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(ok)
}

fn main() -> ExitCode {
    match execute() {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(e) => {
            eprintln!("PQ-SPEED ERROR: {e}");
            ExitCode::FAILURE
        }
    }
}
