//! bnrose-dest-arb — the EVM settlement destination for the partition
//! harness. Speaks the landed netpart line protocol; behind it is a REAL
//! EVM node (the Nitro-calibrated Anvil devnet in the battery; any EVM
//! JSON-RPC endpoint in production mode).
//!
//! The identity law at the destination: the transaction id is RECOMPUTED
//! from the submitted raw bytes (`keccak256(raw envelope)`) and a label
//! that disagrees is a CONFLICT — the destination never trusts a label.
//!
//! `observe` answers from the node's own record: no receipt and no
//! pending transaction = unknown-to-dest; a pending transaction =
//! pending; a receipt above the `finalized` tag = included; at or below
//! it = final. `advance` is REFUSED — block production belongs to the
//! chain, never the harness.
//!
//! env: `DEST_ARB_FINALITY` = "devnet" (default; the finalized tag of a
//! single-node devnet, labeled) or "production" (the finalized tag of a
//! production chain).

use bnrose_settle_adapters::evm::{self, EvmRail};
use bnrose_settle_adapters::{hex, lineproto, unhex, FinalityMethod};
use serde_json::{json, Value};
use std::sync::Arc;

fn main() {
    let mut rpc_url = String::new();
    let mut bind = "127.0.0.1:0".to_string();
    let mut chain_id: u64 = 31337; // anvil's devnet id
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--rpc-url" => rpc_url = args.next().unwrap_or_default(),
            "--bind" => bind = args.next().unwrap_or_default(),
            "--chain-id" => {
                chain_id = args
                    .next()
                    .and_then(|v| {
                        // hex ONLY when explicitly 0x-prefixed; a bare
                        // number is decimal (31337 ≠ 0x31337 — probed live)
                        if v.starts_with("0x") || v.starts_with("0X") {
                            u64::from_str_radix(
                                v.trim_start_matches("0x").trim_start_matches("0X"),
                                16,
                            )
                            .ok()
                        } else {
                            v.parse().ok()
                        }
                    })
                    .unwrap_or(31337)
            }
            _ => {}
        }
    }
    if rpc_url.is_empty() {
        eprintln!("usage: bnrose-dest-arb --rpc-url URL [--bind addr:port] [--chain-id N]");
        std::process::exit(2);
    }
    let method = match std::env::var("DEST_ARB_FINALITY").as_deref() {
        Ok("production") => FinalityMethod::EvmFinalizedTag,
        _ => FinalityMethod::EvmDevnetFinalizedTag,
    };
    let rail = Arc::new(EvmRail::new("dest-arb", &rpc_url));
    // the chain law: pin before the first submission is even possible
    if let Err(e) = rail.pin_chain_id(chain_id) {
        eprintln!("bnrose-dest-arb: {e}");
        std::process::exit(1);
    }
    let handler: Arc<dyn Fn(Value) -> Value + Send + Sync> = Arc::new(move |req: Value| {
        let op = req["op"].as_str().unwrap_or("");
        match op {
            "submit" => {
                let label_tx = req["txId"].as_str().unwrap_or("").to_lowercase();
                let payload = req["payload"].as_str().unwrap_or("");
                let Some(raw) = unhex(payload) else {
                    return json!({"result":"storage-error","note":"payload not hex"});
                };
                // the identity law: recompute, never trust the label
                let recomputed = hex(&evm::keccak256(&raw));
                if recomputed != label_tx {
                    return json!({
                        "result":"conflict",
                        "note":format!("txId label {label_tx} does not bind to the submitted bytes (recomputed {recomputed})")
                    });
                }
                match rail.send_raw(payload, &recomputed) {
                    Ok(evm::SendOutcome::Accepted { hash }) => {
                        debug_assert_eq!(hash.trim_start_matches("0x"), recomputed);
                        json!({"result":"acked","txHash":hash})
                    }
                    Ok(evm::SendOutcome::AlreadyKnown) => {
                        json!({"result":"duplicate","note":"node already holds this exact transaction"})
                    }
                    Ok(evm::SendOutcome::Refused { class, text }) => {
                        json!({"result":format!("refused:{class}"),"note":text})
                    }
                    // no conclusive outcome: transport-level failure — the
                    // request may or may not have crossed the wire
                    Err(_) => json!({"result":"timeout"}),
                }
            }
            "observe" => {
                let label_tx = req["txId"].as_str().unwrap_or("").to_lowercase();
                let receipt = rail.receipt(&label_tx);
                let tx = rail.tx_by_hash(&label_tx);
                match (receipt, tx) {
                    (Err(_), _) | (_, Err(_)) => {
                        json!({"state":"unknown-to-dest","note":"reads failed — no evidence"})
                    }
                    (Ok(None), Ok(None)) => json!({"state":"unknown-to-dest"}),
                    (Ok(None), Ok(Some(_))) => {
                        json!({"state":"pending","note":"known to the node, not yet in a block"})
                    }
                    (Ok(Some(r)), _) => {
                        let bn = r
                            .get("blockNumber")
                            .and_then(|v| v.as_str())
                            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
                        let Some(bn) = bn else {
                            return json!({"state":"unknown-to-dest","note":"receipt without integer-parseable blockNumber"});
                        };
                        let status = r.get("status").and_then(|v| v.as_str()).unwrap_or("");
                        if status != "0x1" {
                            return json!({"state":"included","note":"receipt status != 0x1 (failed execution)","blockNumber":bn});
                        }
                        match rail.block_height("finalized") {
                            Ok(fin) if fin >= bn => {
                                json!({"state":"final","blockNumber":bn,"finalizedHeight":fin,"method":method.word()})
                            }
                            Ok(fin) => {
                                json!({"state":"included","blockNumber":bn,"finalizedHeight":fin,"method":method.word()})
                            }
                            Err(_) => {
                                json!({"state":"included","blockNumber":bn,"note":"finalized tag unreadable — finality NOT claimed"})
                            }
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
    eprintln!("bnrose-dest-arb: {err}");
    std::process::exit(1);
}
