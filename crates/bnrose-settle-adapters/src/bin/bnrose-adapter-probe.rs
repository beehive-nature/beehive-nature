//! bnrose-adapter-probe — effect-free live probes against PRODUCTION
//! chains. No funded key exists in this environment and none is wanted
//! here: every probe below either READS the chain or re-broadcasts a
//! transaction the chain has ALREADY executed (refused by construction,
//! witnessed live).
//!
//!   hive-verify  --txid ID [--block N] --providers URL,URL…
//!     the estate's own already-published transaction, re-verified live:
//!     fetch the chain-held record, RE-SERIALIZE it canonically,
//!     recompute the id from those bytes (endpoint labels are never
//!     identity), verify inclusion by the documented container, finality
//!     by LIB — per provider, agreement recorded as corroboration
//!     (never consensus).
//!
//!   hive-dup-probe  --txid ID --providers URL,URL…
//!     re-broadcast the chain's own record of an ALREADY-EXECUTED
//!     transaction to the first provider, and record the node's
//!     classified answer. Effect-free: the transaction is already in a
//!     block (and long past expiration); this witnesses the destination's
//!     own re-delivery behavior live.
//!
//!   arb-verify  --txhash 0x… --providers URL,URL…
//!     Arbitrum One read legs: chain-id PIN, receipt, inclusion
//!     container, `finalized`-tag finality. The preimage is
//!     node-supplied on this probe (we hold no signed bytes for an
//!     arbitrary public transaction) — recorded as the weaker evidence
//!     class it is.
//!
//!   selftest  offline pin checks (the serializer and keccak vectors)

use bnrose_settle_adapters::evm::EvmRail;
use bnrose_settle_adapters::hive::{self, ser, HiveAnswer, HiveRail};
use bnrose_settle_adapters::{hex, FinalityMethod};
use serde_json::{json, Value};

fn flag(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let cmd = argv.first().cloned().unwrap_or_default();
    let providers: Vec<String> = flag(&argv, "--providers")
        .map(|p| {
            p.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    match cmd.as_str() {
        "hive-verify" => {
            let txid = flag(&argv, "--txid").unwrap_or_default();
            if txid.is_empty() || providers.is_empty() {
                eprintln!("usage: bnrose-adapter-probe hive-verify --txid ID --providers URL,URL");
                std::process::exit(2);
            }
            hive_verify(&txid, &providers);
        }
        "hive-dup-probe" => {
            let txid = flag(&argv, "--txid").unwrap_or_default();
            if txid.is_empty() || providers.is_empty() {
                eprintln!(
                    "usage: bnrose-adapter-probe hive-dup-probe --txid ID --providers URL,URL"
                );
                std::process::exit(2);
            }
            hive_dup_probe(&txid, &providers);
        }
        "arb-verify" => {
            let txhash = flag(&argv, "--txhash").unwrap_or_default();
            if txhash.is_empty() || providers.is_empty() {
                eprintln!(
                    "usage: bnrose-adapter-probe arb-verify --txhash 0x… --providers URL,URL"
                );
                std::process::exit(2);
            }
            arb_verify(&txhash, &providers);
        }
        "selftest" => {
            // the offline pins: the dhive differential runs in the crate's
            // unit tests; this just proves the probe binary is alive
            println!(
                "{}",
                json!({"selftest":"alive","keccak_empty":hex(&bnrose_settle_adapters::evm::keccak256(b""))})
            );
        }
        _ => {
            eprintln!(
                "usage: bnrose-adapter-probe hive-verify|hive-dup-probe|arb-verify|selftest …"
            );
            std::process::exit(2);
        }
    }
}

fn hive_verify(txid: &str, providers: &[String]) {
    let mut receipts = Vec::new();
    for p in providers {
        let rail = match HiveRail::new(p, p, ser::HIVE_CHAIN_ID_HEX) {
            Ok(r) => r,
            Err(e) => {
                receipts.push(json!({"provider":p,"error":e}));
                continue;
            }
        };
        let mut rec = json!({"provider": p});
        // 1 · the chain-held record
        match rail.get_transaction(txid) {
            Ok(Some(trx)) => {
                rec["found"] = json!(true);
                rec["block_num"] = json!(trx.get("block_num").and_then(|v| v.as_i64()));
                rec["sig_count"] = json!(trx
                    .get("signatures")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len()));
                rec["op_count"] = json!(trx
                    .get("operations")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len()));
                rec["node_transaction_id_echo"] =
                    json!(trx.get("transaction_id").and_then(|v| v.as_str()));
                // 2 · the identity law: re-serialize canonically, recompute
                match hive::parse_chain_trx(&trx)
                    .and_then(|t| ser::serialize_trx(&t).map(|b| (t, b)))
                {
                    Ok((_t, bytes)) => {
                        let recomputed = ser::hive_txid(&bytes);
                        rec["recomputed_txid_from_canonical_bytes"] = json!(recomputed);
                        rec["recomputed_matches_queried"] = json!(recomputed == txid);
                    }
                    Err(e) => {
                        rec["recompute_error"] = json!(e);
                    }
                }
                // 3 · inclusion by the documented container
                match rail.inclusion(txid) {
                    Ok(Some(inc)) => {
                        rec["inclusion"] = json!({
                            "container": inc.container, "block_height": inc.block_height, "member": inc.member,
                        });
                        // 4 · finality by LIB
                        match rail.finality(txid, inc.block_height, FinalityMethod::HiveLib) {
                            Ok(f) => {
                                rec["finality"] = json!({
                                    "method": f.method.word(), "irreversible_height": f.irreversible_height,
                                    "block_height": f.block_height, "final": f.final_,
                                });
                            }
                            Err(e) => rec["finality_error"] = json!(e),
                        }
                    }
                    Ok(None) => rec["inclusion"] = json!(null),
                    Err(e) => rec["inclusion_error"] = json!(e),
                }
            }
            Ok(None) => rec["found"] = json!(false),
            Err(e) => rec["error"] = json!(e),
        }
        receipts.push(rec);
    }
    let agree = receipts
        .iter()
        .filter(|r| {
            r["recomputed_matches_queried"] == json!(true) && r["finality"]["final"] == json!(true)
        })
        .count();
    println!(
        "{}",
        json!({
            "probe": "hive-verify",
            "txid": txid,
            "note": "per-provider facts; agreement across providers is corroboration, never consensus",
            "providers_agreeing": agree,
            "receipts": receipts,
        })
    );
}

fn hive_dup_probe(txid: &str, providers: &[String]) {
    let Some(first) = providers.first() else {
        return;
    };
    let rail = match HiveRail::new(first, first, ser::HIVE_CHAIN_ID_HEX) {
        Ok(r) => r,
        Err(e) => {
            println!("{}", json!({"probe":"hive-dup-probe","error":e}));
            return;
        }
    };
    // fetch the chain's own record (signatures included — that is how the
    // bdrop lane recovered signatures offline)
    let Some(trx) = rail.get_transaction(txid).ok().flatten() else {
        println!(
            "{}",
            json!({"probe":"hive-dup-probe","error":"transaction not found — nothing to re-broadcast"})
        );
        return;
    };
    let block_num = trx.get("block_num").and_then(|v| v.as_i64());
    // the re-broadcast payload: exactly the chain-held signed object
    let payload = json!({
        "ref_block_num": trx.get("ref_block_num"),
        "ref_block_prefix": trx.get("ref_block_prefix"),
        "expiration": trx.get("expiration"),
        "operations": trx.get("operations"),
        "extensions": trx.get("extensions").cloned().unwrap_or(json!([])),
        "signatures": trx.get("signatures"),
    });
    // effect-free by construction: already executed, long past expiration
    let answer = rail.broadcast(&payload);
    let verdict = match &answer {
        Ok(HiveAnswer::Ok(_)) => {
            "accepted (unexpected for an executed+expired transaction — recorded as observed)"
                .to_string()
        }
        Ok(HiveAnswer::Duplicate(t)) => format!("duplicate: {t}"),
        Ok(HiveAnswer::HivedRefusal { class, text }) => format!("hived-refusal:{class}: {text}"),
        Ok(HiveAnswer::GatewayNoVerdict(t)) => format!("gateway-no-verdict: {t}"),
        Err(e) => format!("transport: {e}"),
    };
    println!(
        "{}",
        json!({
            "probe":"hive-dup-probe",
            "txid": txid,
            "in_block": block_num,
            "effect_class": "none — the transaction is already executed (and long past expiration); re-delivery is witnessed, nothing is created",
            "reconstructed_from": "the chain's own record (get_transaction, signatures included)",
            "provider": first,
            "verdict": verdict,
        })
    );
}

fn arb_verify(txhash: &str, providers: &[String]) {
    let mut receipts = Vec::new();
    for p in providers {
        let rail = EvmRail::new(p, p);
        let mut rec = json!({"provider": p});
        // the chain law: pin the chain id before reading anything else
        match rail.chain_id() {
            Ok(id) if id == 42161 => rec["chain_id_pinned"] = json!("0xa4b1 (42161, Arbitrum One)"),
            Ok(id) => {
                rec["chain_id_mismatch"] = json!(format!("{id:#x} — not Arbitrum One; refusing"));
                receipts.push(rec);
                continue;
            }
            Err(e) => {
                rec["error"] = json!(e);
                receipts.push(rec);
                continue;
            }
        }
        match rail.receipt(txhash) {
            Ok(Some(r)) => {
                let bn = r
                    .get("blockNumber")
                    .and_then(|v| v.as_str())
                    .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
                rec["receipt"] = json!({
                    "blockNumber": bn,
                    "status": r.get("status"),
                    "note": "preimage is node-supplied on this probe (we hold no signed bytes for an arbitrary public transaction) — weaker class, labeled",
                });
                if let Some(bn) = bn {
                    match rail.inclusion(txhash, bn) {
                        Ok(inc) => {
                            rec["inclusion"] =
                                json!({"container": inc.container, "member": inc.member});
                        }
                        Err(e) => rec["inclusion_error"] = json!(e.text()),
                    }
                    match rail.finality(txhash, bn, FinalityMethod::EvmFinalizedTag) {
                        Ok(f) => {
                            rec["finality"] = json!({
                                "method": f.method.word(), "irreversible_height": f.irreversible_height,
                                "block_height": f.block_height, "final": f.final_,
                            });
                        }
                        Err(e) => rec["finality_error"] = json!(e.text()),
                    }
                }
            }
            Ok(None) => rec["receipt"] = json!(null),
            Err(e) => rec["error"] = json!(e.text()),
        }
        receipts.push(rec);
    }
    println!(
        "{}",
        json!({
            "probe": "arb-verify",
            "txhash": txhash.to_lowercase(),
            "note": "read-only legs on a public transaction; production acceptance/idempotency for FRESH transactions stay UNVERIFIED without a funded key",
            "receipts": receipts,
        })
    );
}
