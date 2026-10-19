//! PQ01 runner: every ACVP case for ML-KEM-512/768/1024, ML-DSA-44/65/87
//! and SLH-DSA-SHAKE-256f, on two implementations each.
//!
//! usage: pq-kat [--cache DIR]   (default target/pq-vectors)
//!
//! Exit 0 only if every executed case passed, every TEETH control refused
//! its flipped input, and every required (set, function, implementation)
//! row executed at least one case. NOT RUN rows are printed with their
//! reason and never counted as passed.

use std::path::PathBuf;
use std::process::ExitCode;

use btungsten_pq::acvp::{self, cases};
use btungsten_pq::report::Report;
use btungsten_pq::{mldsa, mlkem, slhdsa};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let cache = match args.iter().position(|a| a == "--cache") {
        Some(i) => PathBuf::from(args.get(i + 1).expect("--cache DIR")),
        None => PathBuf::from("target/pq-vectors"),
    };
    let m = acvp::manifest();
    println!(
        "PQ01 ACVP-Server commit {} (vectors cached in {})",
        m.commit,
        cache.display()
    );

    let mut r = Report::default();
    let mut load_errors = Vec::new();
    let sets: [(&str, &str, &str); 10] = [
        ("ML-KEM-keyGen-FIPS203", "FIPS203", "keyGen"),
        ("ML-KEM-encapDecap-FIPS203", "FIPS203", "encapDecap"),
        ("ML-KEM-encapDecap-FIPS203-tr1", "FIPS203-tr1", "encapDecap"),
        ("ML-DSA-keyGen-FIPS204", "FIPS204", "keyGen"),
        ("ML-DSA-sigGen-FIPS204", "FIPS204", "sigGen"),
        ("ML-DSA-sigGen-FIPS204-tr1", "FIPS204-tr1", "sigGen"),
        ("ML-DSA-sigVer-FIPS204", "FIPS204", "sigVer"),
        ("SLH-DSA-keyGen-FIPS205", "FIPS205", "keyGen"),
        ("SLH-DSA-sigGen-FIPS205", "FIPS205", "sigGen"),
        ("SLH-DSA-sigVer-FIPS205", "FIPS205", "sigVer"),
    ];
    for (dir, rev, mode) in sets {
        let loaded = m
            .load(&cache, dir, "prompt.json")
            .and_then(|p| Ok((p, m.load(&cache, dir, "expectedResults.json")?)));
        let (prompt, expected) = match loaded {
            Ok(x) => x,
            Err(e) => {
                load_errors.push(e);
                continue;
            }
        };
        let cs = match cases(&prompt, &expected) {
            Ok(cs) => cs,
            Err(e) => {
                load_errors.push(format!("{dir}: {e}"));
                continue;
            }
        };
        println!("PQ01 {dir}: {} cases in the file", cs.len());
        if dir.starts_with("ML-KEM") {
            mlkem::run(&mut r, rev, &cs);
        } else if dir.starts_with("ML-DSA") {
            mldsa::run(&mut r, rev, mode, &cs);
        } else {
            slhdsa::run(&mut r, rev, mode, &cs);
        }
    }
    r.print();

    // Non-vacuity: every exposed (set, function) row ran on both implementations.
    let mut required: Vec<(String, &'static str)> = Vec::new();
    for set in mlkem::SETS {
        for f in mlkem::FUNCTIONS {
            for imp in ["rustcrypto", "libcrux"] {
                required.push((format!("{set} {f} (FIPS203)"), imp));
            }
        }
    }
    for set in mldsa::SETS {
        for row in [
            "keyGen",
            "sigGen ext-pure det",
            "sigGen ext-pure hedged",
            "sigGen internal det",
            "sigGen internal hedged",
            "sigVer ext-pure",
            "sigVer internal",
        ] {
            for imp in ["rustcrypto", "libcrux"] {
                required.push((format!("{set} {row} (FIPS204)"), imp));
            }
        }
    }
    for row in [
        "keyGen",
        "sigGen ext-pure det",
        "sigGen ext-pure hedged",
        "sigGen internal det",
        "sigGen internal hedged",
        "sigVer ext-pure",
        "sigVer internal",
    ] {
        for imp in ["rustcrypto", "fips205"] {
            required.push((format!("{} {row} (FIPS205)", slhdsa::SET), imp));
        }
    }
    let missing: Vec<_> = required
        .iter()
        .filter(|(k, i)| r.executed(k, i) == 0)
        .collect();
    for (k, i) in &missing {
        println!("PQ01 MISSING {k} [{i}]: required and not executed");
    }
    for e in &load_errors {
        println!("PQ01 LOAD ERROR {e}");
    }

    let (executed, passed) = r.totals();
    println!(
        "PQ01 SUMMARY: {executed} executed, {passed} passed, {} failed; {} required rows, {} missing; {} load errors",
        r.failures().len(),
        required.len(),
        missing.len(),
        load_errors.len()
    );
    if r.failures().is_empty() && missing.is_empty() && load_errors.is_empty() && executed > 0 {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
