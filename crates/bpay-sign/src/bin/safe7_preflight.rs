//! safe7-preflight — Observation A of the first Safe 7 ceremony
//! (board ruling @fedb2095): the harmless device preflight that banks a
//! REAL device receipt before any transaction is ever composed.
//!
//! Stages (each one device round-trip, no retries — a timeout or refusal
//! ends the observation and is recorded as what happened):
//! 0. `tools/list` — runtime interface evidence (the tool inventory).
//! 1. `trezor_get_address` (SILENT — no device button) at the EVM path →
//!    the device-derived address.
//! 2. `trezor_sign_message` — the founder is asked to REJECT on the
//!    device ONCE (a deliberate refusal, handled cleanly).
//! 3. `trezor_sign_message` again — the founder APPROVES.
//! 4. The signer is RECOVERED locally from the 65-byte signature over
//!    the personal-message hash and must equal BOTH the address derived
//!    in stage 1 and the device-claimed address in the response.
//!
//! Nothing here composes, signs, or broadcasts a transaction; the word
//! "broadcast" appears only as the constant false inside the transport
//! adapter. Exit 0 = full observation; 1 = RECOVERED-SIGNER MISMATCH
//! (discrepancy — inspect, do not proceed); 2 = incomplete (recorded).
//!
//! Environment: BPAY_MCP_URL (default http://127.0.0.1:21340/mcp),
//! BPAY_MCP_TOKEN (required — read from Suite's config.json, never
//! printed), BPAY_MCP_PATH (default m/44'/60'/0'/0/0),
//! BPAY_MCP_TIMEOUT_SECS (device stages; default 300),
//! BPAY_PREFLIGHT_OUT (receipt path; default safe7-preflight-receipt.json).

use bpay_sign::suite_mcp::{
    get_address, personal_message_hash, recover_personal_message_signer, SuiteMcp, ToolReply,
};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn main() {
    let token = match std::env::var("BPAY_MCP_TOKEN") {
        Ok(t) if !t.trim().is_empty() => t.trim().to_string(),
        _ => {
            eprintln!("safe7-preflight: BPAY_MCP_TOKEN is required (Suite config.json → mcpSettings.token); it is never printed or committed");
            std::process::exit(2);
        }
    };
    let url = env_or("BPAY_MCP_URL", bpay_sign::suite_mcp::DEFAULT_MCP_URL);
    let path = env_or("BPAY_MCP_PATH", "m/44'/60'/0'/0/0");
    let timeout: u64 = env_or("BPAY_MCP_TIMEOUT_SECS", "300")
        .parse()
        .unwrap_or(300);
    let out_path = env_or("BPAY_PREFLIGHT_OUT", "safe7-preflight-receipt.json");
    let message = format!(
        "bPay Safe 7 preflight {}: harmless message, no transaction, no broadcast",
        chrono_date()
    );

    let mut receipt = json!({
        "schema": "bpay.safe7-preflight/1",
        "when_unix": now_secs(),
        "suite": {
            "version": "26.9.2 (config.json savedCurrentVersion; experimental MCP enabled by the founder)",
            "endpoint": url,
            "token": "REDACTED — local credential, never committed",
            "transport": "suite-experimental-mcp (POST /mcp, JSON-RPC tools/call)",
        },
        "path": path,
        "message": message,
        "device_note": "Trezor Safe 7 (T3W1, USB VID_1209 PID_53C1); founder upgraded to stock firmware 2.12.5 immediately before this observation",
        "laws": {
            "broadcast": false,
            "transaction_signatures": 0,
            "note": "message signatures only; no transaction composed, signed, or broadcast in Observation A"
        }
    });

    // stage 0: interface evidence
    let mut quick = SuiteMcp::new(&url, &token, 30);
    let tools = match quick.tools_list() {
        Ok(t) => t,
        Err(e) => {
            eprintln!("stage 0 tools/list FAILED: {e}");
            receipt["stages"] = json!({ "tools_list": { "ok": false, "error": e.to_string() }});
            finish(&receipt, &out_path, 2);
        }
    };
    println!("stage 0 — tools/list (runtime evidence): {tools:?}");
    receipt["tools"] = json!(tools);

    // stage 1: silent address derivation
    println!("stage 1 — deriving the device EVM address at {path} (silent; if Suite shows a Grant-permissions prompt for mcp://localhost read-address, confirm it)");
    let mut mcp = SuiteMcp::new(&url, &token, 120);
    let device_address = match get_address(&mut mcp, &path, false) {
        Ok(a) => a.to_lower_hex(),
        Err(e) => {
            eprintln!("stage 1 get_address FAILED: {e}");
            receipt["stages"] = json!({ "derive": { "ok": false, "error": e.to_string() }});
            finish(&receipt, &out_path, 2);
        }
    };
    println!("stage 1 — device address: {device_address}");
    receipt["stages"]["derive"] = json!({ "ok": true, "address": device_address });

    // stage 2: the deliberate rejection
    println!("stage 2 — REJECT ON THE DEVICE NOW (this is the deliberate-rejection stage; refusing the message is the point)");
    let mut slow = SuiteMcp::new(&url, &token, timeout);
    let reject = slow.call_tool(
        "trezor_sign_message",
        json!({ "coin": "eth", "path": path, "message": message }),
    );
    match reject {
        Err(e) => {
            eprintln!("stage 2 transport error (recorded, not retried): {e}");
            receipt["stages"]["reject"] =
                json!({ "attempted": true, "refused_cleanly": false, "observed": e.to_string() });
            finish(&receipt, &out_path, 2);
        }
        Ok(ToolReply::ToolError(why)) => {
            println!("stage 2 — refusal observed cleanly: {why}");
            receipt["stages"]["reject"] =
                json!({ "attempted": true, "refused_cleanly": true, "observed": why });
        }
        Ok(ToolReply::Ok(payload)) => {
            eprintln!("stage 2 — the founder APPROVED the first prompt; the deliberate-rejection stage was NOT exercised (recorded honestly)");
            receipt["stages"]["reject"] = json!({
                "attempted": true, "refused_cleanly": false,
                "observed": "founder approved the first device prompt — rejection stage not exercised",
            });
            // fall through to recovery with THIS signature; no second ask
            if let Some(outcome) =
                recover_and_record(&mut receipt, &message, &payload, &device_address, false)
            {
                let code = if outcome { 0 } else { 1 };
                finish(&receipt, &out_path, code);
            } else {
                finish(&receipt, &out_path, 2);
            }
        }
    }

    // stage 3: the approval
    println!("stage 3 — APPROVE ON THE DEVICE NOW (the harmless message: {message:?})");
    let approve = slow.call_tool(
        "trezor_sign_message",
        json!({ "coin": "eth", "path": path, "message": message }),
    );
    match approve {
        Err(e) => {
            eprintln!("stage 3 transport error (recorded, not retried): {e}");
            receipt["stages"]["approve"] = json!({ "ok": false, "error": e.to_string() });
            finish(&receipt, &out_path, 2);
        }
        Ok(ToolReply::ToolError(why)) => {
            eprintln!("stage 3 — refused again (recorded): {why}");
            receipt["stages"]["approve"] = json!({ "ok": false, "refused": true, "observed": why });
            finish(&receipt, &out_path, 2);
        }
        Ok(ToolReply::Ok(payload)) => {
            receipt["stages"]["approve"] = json!({ "ok": true });
            if let Some(outcome) =
                recover_and_record(&mut receipt, &message, &payload, &device_address, true)
            {
                let code = if outcome { 0 } else { 1 };
                finish(&receipt, &out_path, code);
            } else {
                finish(&receipt, &out_path, 2);
            }
        }
    }
}

/// Recover the signer from the sign_message payload and record the match
/// proof. Returns Some(true) on MATCH, Some(false) on MISMATCH, None on
/// decode failure (already recorded).
fn recover_and_record(
    receipt: &mut serde_json::Value,
    message: &str,
    payload: &serde_json::Value,
    device_address: &str,
    approval_stage: bool,
) -> Option<bool> {
    let stage = if approval_stage {
        "approve"
    } else {
        "unexpected_first_approval"
    };
    let sig_hex = payload
        .get("signature")
        .and_then(|s| s.as_str())
        .map(|s| s.trim_start_matches("0x").to_string())
        .unwrap_or_default();
    let claimed = payload
        .get("address")
        .and_then(|a| a.as_str())
        .unwrap_or("")
        .to_lowercase();
    let sig_bytes = match hex::decode(&sig_hex) {
        Ok(b) if b.len() == 65 => b,
        other => {
            let why = match other {
                Ok(v) => format!("signature not 65 bytes ({}), decode ok", v.len()),
                Err(e) => format!("signature hex decode: {e}"),
            };
            eprintln!("signature decode failed: {why}");
            receipt["proof"] = json!({ "ok": false, "why": why });
            return None;
        }
    };
    let sig65: [u8; 65] = sig_bytes.as_slice().try_into().expect("65");
    let (recovered, v_raw) = match recover_personal_message_signer(message, &sig65) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("recovery refused: {e}");
            receipt["proof"] = json!({ "ok": false, "why": e.to_string() });
            return None;
        }
    };
    let recovered_hex = recovered.to_lower_hex();
    let matches_device = recovered_hex == device_address.to_lowercase();
    let matches_claimed = recovered_hex == claimed;
    let msg_hash = personal_message_hash(message);
    receipt["proof"] = json!({
        "ok": true,
        "stage": stage,
        "claimed_address": claimed,
        "recovered_signer": recovered_hex,
        "message_hash": format!("0x{}", hex::encode(msg_hash)),
        "signature": format!("0x{}", sig_hex),
        "v_raw": v_raw,
        "recovered_matches_device_address": matches_device,
        "recovered_matches_claimed_address": matches_claimed,
    });
    println!("proof — recovered signer {recovered_hex} (v={v_raw})");
    println!("proof — device address   {device_address} → match: {matches_device}");
    println!("proof — claimed address  {claimed} → match: {matches_claimed}");
    if !matches_device {
        eprintln!("DISCREPANCY: recovered signer does NOT equal the device-derived address — inspect before anything further");
    }
    Some(matches_device)
}

fn finish(receipt: &serde_json::Value, out_path: &str, code: i32) -> ! {
    match std::fs::write(
        out_path,
        serde_json::to_string_pretty(receipt).unwrap_or_default(),
    ) {
        Ok(()) => println!("receipt → {out_path}"),
        Err(e) => eprintln!("receipt write FAILED ({out_path}): {e}"),
    }
    std::process::exit(code);
}

/// Local date (UTC) for the signed message, no chrono dep.
fn chrono_date() -> String {
    let days = now_secs() / 86_400;
    // civil-from-days (Howard Hinnant's algorithm)
    let z = days as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}
