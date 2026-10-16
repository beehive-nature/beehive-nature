//! The WB004 retry failure as a NON-SPENDING fixture, end to end through
//! the real CLI in SEPARATE PROCESSES (BNROSE-RUST-001):
//!
//!   process A: run-op --lose-response  → dispatches, applies the effect,
//!              exits 3 without recording the response ("the response was
//!              lost" — the WB004 retry failure itself)
//!   the worker and its whole process are now gone
//!   process B: recover → must complete the SAME logical operation from
//!              the authenticated durable records, with exactly one effect
//!              row and no second admission — and must refuse a
//!              replacement operation carrying the same authorization.
//!
//! What is asserted, in the order the order demands it:
//! crash (exit 3) → one effect row exists → recovery completes the same op
//! (recovered receipt, verifies under the public key alone) → still one
//! row → the same intent again is refused → a fresh intent completes on a
//! fresh nonce.

use std::path::PathBuf;
use std::process::Command;

const NOW: &str = "1800000000";

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_bnrose-exec-host")
}

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-wb004-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn run(args: &[&str]) -> (i32, String) {
    let out = Command::new(bin())
        .args(args)
        .env("BNROSE_EXEC_WASM", wasm_path())
        .output()
        .expect("spawn bnrose-exec");
    (
        out.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&out.stdout).into_owned(),
    )
}

fn wasm_path() -> String {
    std::env::var("BNROSE_EXEC_WASM").unwrap_or_else(|_| {
        let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        p.push("../../target/wasm32-unknown-unknown/release/bnrose_exec_wasm.wasm");
        p.display().to_string()
    })
}

fn json_field(stdout: &str, key: &str) -> String {
    let v: serde_json::Value =
        serde_json::from_str(stdout.trim()).expect("stdout is one JSON object");
    match &v[key] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Null => "null".into(),
        other => other.to_string(),
    }
}

#[test]
fn the_wb004_retry_failure_recovers_without_a_second_operation() {
    let state = tmp("e2e");
    let root = "cd".repeat(32);
    run(&[
        "init",
        "--state",
        state.to_str().unwrap(),
        "--root-hex",
        &root,
    ]);
    let intent = state.join("intent.json");
    run(&[
        "make-fixture",
        "--index",
        "7",
        "--now",
        NOW,
        "--ttl",
        "600",
        "--out",
        intent.to_str().unwrap(),
    ]);

    // ---- process A: the operation succeeds, its response is lost
    let (code, out) = run(&[
        "run-op",
        "--state",
        state.to_str().unwrap(),
        "--intent",
        intent.to_str().unwrap(),
        "--clock",
        NOW,
        "--worker",
        "paranoid",
        "--lose-response",
    ]);
    assert_eq!(code, 3, "the crash point exits 3: {out}");
    let op = json_field(&out, "op");
    assert_ne!(op, "null");
    // the worker's process is gone; its scratch (nothing but process
    // memory in this slice) is unavailable by construction
    let (_, status) = run(&["status", "--state", state.to_str().unwrap()]);
    assert_eq!(
        json_field(&status, "effectRows"),
        "1",
        "the effect HAPPENED: {status}"
    );
    assert_eq!(json_field(&status, "effectsAreOnePerOp"), "true");

    // ---- process B: a clean replacement recovers from durable records
    let (code, report) = run(&[
        "recover",
        "--state",
        state.to_str().unwrap(),
        "--clock",
        NOW,
        "--worker",
        "paranoid",
    ]);
    assert_eq!(code, 0, "recovery completes: {report}");
    let v: serde_json::Value = serde_json::from_str(report.trim()).unwrap();
    let rop = &v["ops"][0];
    assert_eq!(
        rop["op"].as_str().unwrap(),
        op,
        "the SAME logical operation"
    );
    assert_eq!(rop["stateBefore"], "dispatched");
    assert_eq!(rop["stateAfter"], "completed");
    assert_eq!(rop["recovered"], serde_json::json!(true));
    assert_eq!(rop["invariantReverified"], serde_json::json!(true));

    // still exactly one effect row, one admission, one receipt — the
    // dedup components (journal uniqueness + ledger idempotency) held
    let (_, status) = run(&["status", "--state", state.to_str().unwrap()]);
    assert_eq!(json_field(&status, "effectRows"), "1");
    assert_eq!(json_field(&status, "effectsAreOnePerOp"), "true");

    // the recovered receipt verifies under the public key ALONE
    let pk = json_field(&status, "receiptPublicKey");
    let receipt = state.join("receipts").join(format!("op-{op}.json"));
    let (code, _) = run(&[
        "verify-receipt",
        "--pk",
        &pk,
        "--receipt",
        receipt.to_str().unwrap(),
    ]);
    assert_eq!(code, 0, "the recovered receipt verifies independently");

    // a replacement operation with the same authorization: refused
    let (code, out) = run(&[
        "run-op",
        "--state",
        state.to_str().unwrap(),
        "--intent",
        intent.to_str().unwrap(),
        "--clock",
        NOW,
        "--worker",
        "paranoid",
    ]);
    assert_eq!(code, 1);
    assert_eq!(json_field(&out, "refused"), "admission:nonce-reuse");

    // a fresh authorization (fresh nonce) on the same state: completes
    let intent2 = state.join("intent2.json");
    run(&[
        "make-fixture",
        "--index",
        "8",
        "--now",
        NOW,
        "--ttl",
        "600",
        "--out",
        intent2.to_str().unwrap(),
    ]);
    let (code, out) = run(&[
        "run-op",
        "--state",
        state.to_str().unwrap(),
        "--intent",
        intent2.to_str().unwrap(),
        "--clock",
        NOW,
        "--worker",
        "paranoid",
    ]);
    assert_eq!(code, 0, "a fresh authorization completes: {out}");
    let (_, status) = run(&["status", "--state", state.to_str().unwrap()]);
    assert_eq!(json_field(&status, "effectRows"), "2");

    println!(
        "wb004-retry: crash exit 3 → same op {op} recovered from durable records (1 row throughout), receipt verified independently, replacement refused, fresh authorization completed"
    );
}
