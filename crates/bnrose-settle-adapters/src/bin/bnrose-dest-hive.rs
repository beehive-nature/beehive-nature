//! bnrose-dest-hive — the Hive settlement destination for the partition
//! harness. Speaks the landed netpart line protocol; behind it is a Hive
//! JSON-RPC endpoint (the wire-shape mock in the adapter-logic battery,
//! production mainnet in the live probes).
//!
//! The payload is the SIGNED transaction object (JSON, the exact bytes
//! that get rebroadcast). The destination parses it, re-serializes it
//! canonically, RECOMPUTES the transaction id from those bytes, and
//! refuses a label that disagrees (conflict) — identity binds to bytes
//! on this rail too.
//!
//! `observe` is the chain's own ladder: `get_transaction` found → its
//! `block_num` against LIB (final / included); not found →
//! unknown-to-dest (a Hive node's mempool is not queryable through this
//! API — absence of a record is absence of EVIDENCE, never proof of
//! non-execution). `advance` is REFUSED.

use bnrose_settle_adapters::hive::{self, ser, HiveAnswer, HiveRail};
use bnrose_settle_adapters::{lineproto, FinalityMethod};
use serde_json::{json, Value};
use std::sync::Arc;

fn main() {
    let mut endpoint = String::new();
    let mut bind = "127.0.0.1:0".to_string();
    let mut chain_hex = ser::HIVE_CHAIN_ID_HEX.to_string();
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--endpoint" => endpoint = args.next().unwrap_or_default(),
            "--bind" => bind = args.next().unwrap_or_default(),
            "--chain-id-hex" => chain_hex = args.next().unwrap_or_default(),
            _ => {}
        }
    }
    if endpoint.is_empty() {
        eprintln!("usage: bnrose-dest-hive --endpoint URL [--bind addr:port] [--chain-id-hex HEX]");
        std::process::exit(2);
    }
    let method = match std::env::var("DEST_HIVE_FINALITY").as_deref() {
        Ok("production") => FinalityMethod::HiveLib,
        _ => FinalityMethod::MockLabeled,
    };
    let rail = Arc::new(match HiveRail::new("dest-hive", &endpoint, &chain_hex) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("bnrose-dest-hive: {e}");
            std::process::exit(1);
        }
    });
    let handler: Arc<dyn Fn(Value) -> Value + Send + Sync> = Arc::new(move |req: Value| {
        let op = req["op"].as_str().unwrap_or("");
        match op {
            "submit" => {
                let label_tx = req["txId"].as_str().unwrap_or("");
                let payload = req["payload"].as_str().unwrap_or("");
                // the line protocol carries the payload HEX-encoded; the
                // bytes are the signed transaction object (JSON text)
                let raw = match bnrose_settle_adapters::unhex(payload) {
                    Some(r) => r,
                    None => return json!({"result":"storage-error","note":"payload not hex"}),
                };
                let signed: Value = match serde_json::from_slice(&raw) {
                    Ok(v) => v,
                    Err(_) => {
                        return json!({"result":"storage-error","note":"payload is not the signed transaction object (JSON)"})
                    }
                };
                // the identity law: canonical bytes → recomputed id; a
                // label that disagrees is a conflict
                let recomputed = match hive::parse_chain_trx(&signed)
                    .and_then(|t| ser::serialize_trx(&t))
                    .map(|bytes| ser::hive_txid(&bytes))
                {
                    Ok(id) => id,
                    Err(e) => {
                        return json!({"result":"storage-error","note":format!("cannot canonically serialize: {e}")})
                    }
                };
                if recomputed != label_tx {
                    return json!({
                        "result":"conflict",
                        "note":format!("txId label {label_tx} does not bind to the submitted bytes (recomputed {recomputed})")
                    });
                }
                match rail.broadcast(&signed) {
                    Ok(HiveAnswer::Ok(_)) => json!({"result":"acked"}),
                    Ok(HiveAnswer::Duplicate(t)) => json!({"result":"duplicate","note":t}),
                    Ok(HiveAnswer::HivedRefusal { class, text }) => {
                        json!({"result":format!("refused:{class}"),"note":text})
                    }
                    // an answer without a verdict proves nothing (hived
                    // may already hold the bytes) — UNKNOWN, like transport
                    Ok(HiveAnswer::GatewayNoVerdict(t)) => {
                        json!({"result":"timeout","note":format!("gateway answer without verdict: {t}")})
                    }
                    Err(_) => json!({"result":"timeout"}),
                }
            }
            "observe" => {
                let label_tx = req["txId"].as_str().unwrap_or("");
                match rail.observe(label_tx) {
                    Err(_) => {
                        json!({"state":"unknown-to-dest","note":"reads failed — no evidence"})
                    }
                    Ok(None) => {
                        json!({"state":"unknown-to-dest","note":"no record on this node — absence of evidence, never proof of non-execution"})
                    }
                    Ok(Some((block_num, final_))) => {
                        if final_ {
                            json!({"state":"final","blockNumber":block_num,"method":method.word()})
                        } else {
                            json!({"state":"included","blockNumber":block_num,"method":method.word()})
                        }
                    }
                }
            }
            "advance" => {
                json!({"result":"refused-real-rail","note":"block production belongs to the chain, never the harness"})
            }
            "fault" => {
                json!({"result":"refused-real-rail","note":"rail faults live on the rail's own wire (the fault proxy), not in the destination"})
            }
            _ => json!({"error":format!("unknown op {op}")}),
        }
    });
    let err = lineproto::serve(&bind, handler);
    eprintln!("bnrose-dest-hive: {err}");
    std::process::exit(1);
}
