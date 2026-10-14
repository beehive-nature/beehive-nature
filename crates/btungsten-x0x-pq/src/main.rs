//! x0x-specific PQ evidence. Every implementation has its own counted rows.
mod backends;
mod wrappers;

use btungsten_pq::{acvp, mldsa, mlkem, report::Report};
use std::{path::PathBuf, process::ExitCode};

const PIN: &str = include_str!("../inventory.json");

fn required() -> Vec<(String, &'static str)> {
    let mut rows = Vec::new();
    for f in mlkem::FUNCTIONS {
        rows.push((format!("ML-KEM-768 {f} (FIPS203)"), "fips203"));
        if f != "encapsulation" {
            rows.push((format!("ML-KEM-768 {f} (FIPS203) KAT"), "saorsa-pqc"));
        }
    }
    for f in [
        "keyGen",
        "sigGen ext-pure det",
        "sigGen ext-pure hedged",
        "sigGen internal det",
        "sigGen internal hedged",
        "sigVer ext-pure",
        "sigVer internal",
    ] {
        rows.push((format!("ML-DSA-65 {f} (FIPS204)"), "fips204"));
    }
    for f in ["keyGen", "sigVer ext-pure"] {
        rows.push((format!("ML-DSA-65 {f} (FIPS204) KAT"), "saorsa-pqc"));
    }
    rows.push((
        "ML-DSA-65 sigGen ext-pure (FIPS204) DIFFERENTIAL".into(),
        "saorsa-pqc",
    ));
    for imp in ["rustcrypto", "libcrux"] {
        for row in [
            "ML-DSA-65 OsRng keyGen/sign DIFFERENTIAL",
            "ML-KEM-768 OsRng keyGen/encapsulation DIFFERENTIAL",
            "ML-KEM-768 independent encapsulation/wrapper decapsulation DIFFERENTIAL",
            "ML-DSA-65 legacy wrapper DIFFERENTIAL",
        ] {
            rows.push((row.into(), imp));
        }
    }
    for row in [
        "ML-DSA-65 TEETH last message byte",
        "ML-DSA-65 TEETH wrong signer",
        "ML-DSA-65 TEETH last signature byte",
        "ML-KEM-768 TEETH changed ciphertext (implicit rejection)",
        "T-VACUOUS malformed imports TEETH",
        "ML-DSA-65 legacy wrapper TEETH message",
    ] {
        rows.push((row.into(), "saorsa-pqc"));
    }
    for imp in ["fips203", "saorsa-pqc"] {
        for row in [
            "ML-KEM-768 TEETH encapsulation key check",
            "ML-KEM-768 TEETH decapsulation key check",
        ] {
            rows.push((row.into(), imp));
        }
    }
    rows
}

fn main() -> ExitCode {
    match execute() {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(e) => {
            eprintln!("X0X-PQ ERROR: {e}");
            ExitCode::FAILURE
        }
    }
}

fn execute() -> Result<bool, String> {
    let mut cache = PathBuf::from("target/pq-vectors");
    let mut receipt = None;
    let mut empty = false;
    let mut sabotage = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--cache" => cache = PathBuf::from(args.next().ok_or("--cache needs a directory")?),
            "--receipt" => {
                receipt = Some(PathBuf::from(args.next().ok_or("--receipt needs a path")?))
            }
            "--empty-vectors" => empty = true,
            "--sabotage-expected" => sabotage = true,
            _ => return Err(format!("unknown argument {arg}")),
        }
    }
    let inventory: serde_json::Value = serde_json::from_str(PIN).map_err(|e| e.to_string())?;
    let manifest = acvp::manifest();
    println!(
        "X0X-PQ x0x {} / {}; saorsa-pqc 0.5.1 / fips203 0.4.3 / fips204 0.4.6; ACVP {}",
        inventory["x0x"]["version"], inventory["x0x"]["commit"], manifest.commit
    );
    let mut report = Report::default();
    let mut errors = Vec::new();
    let mut sabotage_applied = false;
    for (dir, rev, mode, set) in [
        ("ML-KEM-keyGen-FIPS203", "FIPS203", "keyGen", "ML-KEM-768"),
        (
            "ML-KEM-encapDecap-FIPS203",
            "FIPS203",
            "encapDecap",
            "ML-KEM-768",
        ),
        (
            "ML-KEM-encapDecap-FIPS203-tr1",
            "FIPS203-tr1",
            "encapDecap",
            "ML-KEM-768",
        ),
        ("ML-DSA-keyGen-FIPS204", "FIPS204", "keyGen", "ML-DSA-65"),
        ("ML-DSA-sigGen-FIPS204", "FIPS204", "sigGen", "ML-DSA-65"),
        (
            "ML-DSA-sigGen-FIPS204-tr1",
            "FIPS204-tr1",
            "sigGen",
            "ML-DSA-65",
        ),
        ("ML-DSA-sigVer-FIPS204", "FIPS204", "sigVer", "ML-DSA-65"),
    ] {
        if empty {
            continue;
        }
        let loaded = manifest
            .load(&cache, dir, "prompt.json")
            .and_then(|p| Ok((p, manifest.load(&cache, dir, "expectedResults.json")?)));
        let (prompt, mut expected) = match loaded {
            Ok(files) => files,
            Err(e) => {
                errors.push(e);
                continue;
            }
        };
        if sabotage && dir == "ML-KEM-keyGen-FIPS203" {
            // Change an official expected public-key byte in memory, after the
            // pinned file passes its checksum. The real equality gate must fail.
            let group = prompt["testGroups"]
                .as_array()
                .unwrap()
                .iter()
                .find(|g| g["parameterSet"] == set)
                .ok_or("missing sabotage target")?;
            let tg = group["tgId"].clone();
            let target = expected["testGroups"]
                .as_array_mut()
                .unwrap()
                .iter_mut()
                .find(|g| g["tgId"] == tg)
                .ok_or("missing sabotage expected group")?;
            let value = &mut target["tests"][0]["ek"];
            let mut text = value.as_str().ok_or("sabotage ek is absent")?.to_string();
            text.replace_range(..1, if text.starts_with('0') { "1" } else { "0" });
            *value = text.into();
            sabotage_applied = true;
        }
        let cases = match acvp::cases(&prompt, &expected) {
            Ok(cs) => cs
                .into_iter()
                .filter(|c| c.group_str("parameterSet") == Some(set))
                .collect::<Vec<_>>(),
            Err(e) => {
                errors.push(format!("{dir}: {e}"));
                continue;
            }
        };
        println!("X0X-PQ {dir}: {} selected cases", cases.len());
        if cases.is_empty() {
            errors.push(format!("{dir}: empty selected group"));
        }
        if set.starts_with("ML-KEM") {
            mlkem::run_on(&mut report, rev, &cases, |_| vec![backends::kem()]);
            wrappers::kem_vectors(&mut report, rev, &cases);
        } else {
            mldsa::run_on(&mut report, rev, mode, &cases, |_| vec![backends::dsa()]);
            wrappers::dsa_vectors(&mut report, rev, mode, &cases);
        }
    }
    if !empty {
        if let Err(e) = wrappers::composition(&mut report) {
            errors.push(e);
        }
    }
    if sabotage && !sabotage_applied {
        errors.push("expected-byte sabotage did not execute".into());
    }
    report.not_run("L2 Cryptol comparison / L3-L5 FIPS and Saorsa proofs", "this lane executes official-vector and independent-implementation tests; BNR's RustCrypto proofs do not transfer");
    report.not_run("RNG assurance", "OsRng calls exercised; entropy quality, validation status and failure injection not established");
    report.not_run("other crypto and full-system qualification", "ChaCha20-Poly1305, BLAKE3, SHA-256, transport, all application call sites and full-system properties require separate lanes");
    let required = required();
    let missing = required
        .iter()
        .filter(|(key, imp)| report.executed(key, imp) == 0)
        .map(|(key, imp)| format!("{key} [{imp}]"))
        .collect::<Vec<_>>();
    report.print_as("X0X-PQ");
    for row in &missing {
        println!("X0X-PQ MISSING {row}");
    }
    for error in &errors {
        println!("X0X-PQ ERROR {error}");
    }
    let (executed, passed) = report.totals();
    let ok =
        executed > 0 && report.failures().is_empty() && missing.is_empty() && errors.is_empty();
    println!("X0X-PQ SUMMARY: {executed} executed, {passed} passed, {} failed; {} required rows, {} missing; {} errors",
        report.failures().len(), required.len(), missing.len(), errors.len());
    if let Some(path) = receipt {
        let value = serde_json::json!({
            "schema": "btungsten.x0x-pq-receipt/1", "inventory": inventory,
            "acvp_commit": manifest.commit, "result": if ok { "PASS" } else { "FAIL" },
            "full_system_qualification": "UNESTABLISHED", "report": report.json(),
            "required_rows": required.len(), "missing": missing, "errors": errors,
            "controls": {"empty_vectors": empty, "sabotage_expected": sabotage, "sabotage_applied": sabotage_applied},
        });
        std::fs::write(
            path,
            serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(ok)
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_obligation_is_unique_and_an_empty_run_has_no_coverage() {
        let rows = super::required();
        let distinct = rows.iter().collect::<std::collections::BTreeSet<_>>();
        assert_eq!(rows.len(), distinct.len());
        assert!(rows
            .iter()
            .all(|(row, imp)| btungsten_pq::report::Report::default().executed(row, imp) == 0));
    }
}
