//! The CLI that makes the slice executable end to end (BNROSE-RUST-001).
//!
//! Exit codes are part of the contract the demo scripts assert on:
//!   0 ok · 1 refusal/error (message on stderr, JSON on stdout when a
//!   report exists) · 3 lost response (the WB004 crash point) ·
//!   4 recovery completed with UNKNOWNs preserved.
//!
//! Every subcommand takes `--clock` explicitly: the slice's determinism is
//! a property, and a hidden wall clock would make receipts unreproducible.
//! Where a production deployment's clock comes from is out of scope and
//! named as such in the dispatch.

use crate::fixtures::{fixture, read_intent, test_policy};
use crate::opexec::Supervisor;
use crate::receipt::Receipt;
use crate::worker::{wasm_module_bytes, Bounds, NativeWorker, ParanoidWorker, WasmWorker, Worker};
use crate::{hex, unhex};
use serde_json::Value;
use std::path::PathBuf;

fn flag(args: &[String], name: &str) -> Option<String> {
    let mut i = 0;
    while i + 1 < args.len() {
        if args[i] == name {
            return Some(args[i + 1].clone());
        }
        i += 1;
    }
    None
}

fn need(args: &[String], name: &str) -> Result<String, String> {
    flag(args, name).ok_or_else(|| format!("missing {name}"))
}

fn make_worker(which: &str) -> Result<Box<dyn Worker>, String> {
    match which {
        "native" => Ok(Box::new(NativeWorker::new())),
        "wasm" => Ok(Box::new(WasmWorker::new(&wasm_module_bytes()?, Bounds::default()).map_err(|e| e.to_string())?)),
        "paranoid" => Ok(Box::new(ParanoidWorker::around(Box::new(
            WasmWorker::new(&wasm_module_bytes()?, Bounds::default()).map_err(|e| e.to_string())?,
        )))),
        other => Err(format!(
            "unknown worker {other:?} (native | wasm | paranoid)"
        )),
    }
}

/// Returns the process exit code.
pub fn run_cli(argv: Vec<String>) -> i32 {
    let (cmd, args) = match argv.split_first() {
        Some((c, rest)) => (c.as_str(), rest.to_vec()),
        None => {
            eprintln!("usage: bnrose-exec <init|make-fixture|run-op|recover|verify-receipt|status> ...");
            return 1;
        }
    };
    match cmd {
        "init" => match cmd_init(&args) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("refused: {e}");
                1
            }
        },
        "make-fixture" => match cmd_fixture(&args) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("refused: {e}");
                1
            }
        },
        "run-op" => cmd_run(&args),
        "recover" => cmd_recover(&args),
        "verify-receipt" => match cmd_verify(&args) {
            Ok(code) => code,
            Err(e) => {
                eprintln!("refused: {e}");
                1
            }
        },
        "status" => match cmd_status(&args) {
            Ok(code) => code,
            Err(e) => {
                eprintln!("refused: {e}");
                1
            }
        },
        other => {
            eprintln!("unknown command {other:?}");
            1
        }
    }
}

fn cmd_init(args: &[String]) -> Result<(), String> {
    let state = PathBuf::from(need(args, "--state")?);
    let root_hex = need(args, "--root-hex")?;
    if root_hex.len() != 64 {
        return Err("--root-hex is 64 hex characters (32 bytes)".into());
    }
    let root: [u8; 32] = unhex(&root_hex)?.try_into().map_err(|_| "root")?;
    let keys = crate::keys::SupervisorKeys::init(&state, &root)?;
    println!(
        "{}",
        serde_json::json!({
            "state": state.display().to_string(),
            "supervisorFingerprint": keys.fingerprint(),
            "note": "root written once, never replaced; fingerprint is public",
        })
    );
    Ok(())
}

fn cmd_fixture(args: &[String]) -> Result<(), String> {
    let index: u64 = need(args, "--index")?.parse().map_err(|_| "index")?;
    let now: u64 = need(args, "--now")?.parse().map_err(|_| "now")?;
    let ttl: u64 = flag(args, "--ttl").unwrap_or("600".into()).parse().map_err(|_| "ttl")?;
    let f = fixture(index, now, ttl);
    let v = f.to_json();
    match flag(args, "--out") {
        Some(p) => std::fs::write(&p, serde_json::to_string_pretty(&v).unwrap())
            .map_err(|e| e.to_string())?,
        None => println!("{}", serde_json::to_string_pretty(&v).unwrap()),
    }
    Ok(())
}

fn cmd_run(args: &[String]) -> i32 {
    let state = PathBuf::from(need(args, "--state").unwrap_or_default());
    let intent_path = need(args, "--intent").unwrap_or_default();
    let clock: u64 = need(args, "--clock").unwrap_or_default().parse().unwrap_or(0);
    let which = flag(args, "--worker").unwrap_or_else(|| "paranoid".into());
    let lose = args.iter().any(|a| a == "--lose-response");
    let intent_v: Value = match std::fs::read_to_string(&intent_path)
        .map_err(|e| e.to_string())
        .and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("refused: intent file: {e}");
            return 1;
        }
    };
    let intent = match read_intent(&intent_v) {
        Ok(i) => i,
        Err(e) => {
            eprintln!("refused: {e}");
            return 1;
        }
    };
    let worker = match make_worker(&which) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("refused: {e}");
            return 1;
        }
    };
    let mut sup = match Supervisor::open(&state, worker, test_policy()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("refused: {e}");
            return 1;
        }
    };
    let out = sup.run(&intent, clock, lose, &Bounds::default());
    let code = if out.lost_response {
        3
    } else if out.refused.is_some() || out.receipt.is_none() {
        1
    } else {
        0
    };
    println!(
        "{}",
        serde_json::json!({
            "op": out.op.map(|o| hex(&o)),
            "refused": out.refused,
            "lostResponse": out.lost_response,
            "state": out.receipt.as_ref().map(|r| crate::receipt::state_word(r.state)),
            "recovered": out.receipt.as_ref().map(|r| r.recovered == 1),
            "effectDigest": out.receipt.as_ref().map(|r| hex(&r.effect)),
            "receiptPath": out.receipt_path.map(|p| p.display().to_string()),
            "worker": which,
            "clock": clock,
        })
    );
    if let Some(w) = &out.refused {
        eprintln!("refused: {w}");
    }
    code
}

fn cmd_recover(args: &[String]) -> i32 {
    let state = PathBuf::from(need(args, "--state").unwrap_or_default());
    let clock: u64 = need(args, "--clock").unwrap_or_default().parse().unwrap_or(0);
    let which = flag(args, "--worker").unwrap_or_else(|| "paranoid".into());
    let worker = match make_worker(&which) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("refused: {e}");
            return 1;
        }
    };
    let mut sup = match Supervisor::open(&state, worker, test_policy()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("refused: {e}");
            return 1;
        }
    };
    match sup.recover(clock) {
        Ok(report) => {
            let unknowns = report["unknownsPreserved"].as_array().map(|a| a.len()).unwrap_or(0);
            println!("{}", serde_json::to_string_pretty(&report).unwrap());
            if unknowns > 0 {
                4
            } else {
                0
            }
        }
        Err(e) => {
            eprintln!("refused: {e}");
            1
        }
    }
}

fn cmd_verify(args: &[String]) -> Result<i32, String> {
    let pk_hex = need(args, "--pk")?;
    let path = need(args, "--receipt")?;
    let pk: [u8; 32] = unhex(&pk_hex)?.try_into().map_err(|_| "pk must be 32 bytes")?;
    let v: Value = std::fs::read_to_string(&path)
        .map_err(|e| e.to_string())
        .and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))?;
    let r = Receipt::from_json(&v)?;
    Ok(if r.verify(&pk) { 0 } else { 1 })
}

fn cmd_status(args: &[String]) -> Result<i32, String> {
    let state = PathBuf::from(need(args, "--state")?);
    let keys = crate::keys::SupervisorKeys::load(&state)?;
    let records = crate::journal::load(&state.join("journal.bin"), &keys.journal_mac)
        .map_err(|e| e.to_string())?;
    let rows = crate::ledger::load(&state.join("effects.bin"), &keys.ledger_mac)
        .map_err(|e| e.to_string())?;
    println!(
        "{}",
        serde_json::json!({
            "supervisorFingerprint": keys.fingerprint(),
            "receiptPublicKey": hex(&keys.ed_public),
            "journalRecords": records.len(),
            "effectRows": rows.len(),
            "effectsAreOnePerOp": rows.len() == rows.iter().map(|r| r.op_id).collect::<std::collections::BTreeSet<_>>().len(),
        })
    );
    Ok(0)
}
