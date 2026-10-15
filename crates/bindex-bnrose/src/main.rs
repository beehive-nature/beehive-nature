//! The stranger's audit surface: ingest a state directory under a handed
//! receipt public key, then ask the sealed file.

use bindex_bnrose::ingest::{ingest, IngestOptions};
use bindex_bnrose::store::Store;
use bindex_bnrose::{hex, query, unhex32};
use std::path::PathBuf;

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1).cloned())
}

fn usage() -> i32 {
    eprintln!(
        "usage: bindex-bnrose <ingest|entity|authority|steps|status|prove-keyless> ...\n\
         ingest   --state DIR --receipt-pk HEX --db FILE [--allow-single-replica]\n\
         entity   --db FILE --id HEX\n\
         authority --db FILE --authority HEX [--after SEQ] [--limit N]\n\
         steps    --db FILE --root HEX\n\
         status   --db FILE\n\
         prove-keyless"
    );
    2
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = args.first().cloned() else {
        std::process::exit(usage());
    };
    let db = || arg(&args, "--db").map(PathBuf::from);
    let code = match cmd.as_str() {
        "prove-keyless" => {
            println!(
                "{}",
                serde_json::json!({
                    "crate": "bindex-bnrose",
                    "keyless": true,
                    "reads": ["journal.bin", "replica/journal.bin", "effects.bin", "receipts/op-*.json"],
                    "neverReads": "the supervisor's root key file",
                    "holds": "the receipt PUBLIC key, handed in",
                    "chainTags": "served, unverified by construction",
                    "enforcedBy": "tests/keyless.rs (source scan)"
                })
            );
            0
        }
        "ingest" => {
            let (Some(state), Some(pk), Some(dbp)) =
                (arg(&args, "--state"), arg(&args, "--receipt-pk"), db())
            else {
                std::process::exit(usage());
            };
            let pk = match unhex32(&pk) {
                Ok(k) => k,
                Err(e) => {
                    eprintln!("receipt-pk: {e}");
                    std::process::exit(2);
                }
            };
            let opts = IngestOptions {
                allow_single_replica: args.iter().any(|a| a == "--allow-single-replica"),
            };
            match Store::open(&dbp) {
                Ok(mut store) => match ingest(&mut store, &PathBuf::from(state), &pk, &opts) {
                    Ok(rep) => {
                        println!(
                            "{}",
                            serde_json::json!({
                                "coveredThroughSeq": rep.covered_through_seq,
                                "indexHead": hex(&rep.index_head),
                                "agreement": rep.agreement,
                                "singleReplica": rep.single_replica,
                                "entities": rep.entities,
                                "receiptsPresent": rep.receipts_present,
                                "receiptsVerified": rep.receipts_verified,
                                "entitiesAttested": rep.entities_attested,
                                "effectRows": rep.effect_rows,
                                "ledgerNote": rep.ledger_note,
                                "replicas": rep.replicas,
                            })
                        );
                        0
                    }
                    Err(e) => {
                        eprintln!("{e}");
                        3
                    }
                },
                Err(e) => {
                    eprintln!("{e}");
                    2
                }
            }
        }
        "entity" | "authority" | "steps" | "status" => {
            let Some(dbp) = db() else {
                std::process::exit(usage());
            };
            let store = match Store::open(&dbp) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("{e}");
                    std::process::exit(2);
                }
            };
            let out = match cmd.as_str() {
                "entity" => arg(&args, "--id")
                    .ok_or_else(|| "missing --id".to_string())
                    .and_then(|h| unhex32(&h))
                    .map_err(bindex_bnrose::Error::Refused)
                    .and_then(|id| query::entity(&store, &id)),
                "authority" => arg(&args, "--authority")
                    .ok_or_else(|| "missing --authority".to_string())
                    .and_then(|h| unhex32(&h))
                    .map_err(bindex_bnrose::Error::Refused)
                    .and_then(|a| {
                        let after = arg(&args, "--after").and_then(|s| s.parse().ok());
                        let limit = arg(&args, "--limit")
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(100);
                        query::by_authority(&store, &a, after, limit)
                    }),
                "steps" => arg(&args, "--root")
                    .ok_or_else(|| "missing --root".to_string())
                    .and_then(|h| unhex32(&h))
                    .map_err(bindex_bnrose::Error::Refused)
                    .and_then(|r| query::steps(&store, &r)),
                _ => query::status(&store),
            };
            match out {
                Ok(v) => {
                    println!("{}", serde_json::to_string_pretty(&v).unwrap());
                    0
                }
                Err(e) => {
                    eprintln!("{e}");
                    3
                }
            }
        }
        _ => usage(),
    };
    std::process::exit(code);
}
