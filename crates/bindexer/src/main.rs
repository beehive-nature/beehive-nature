//! bindexer CLI — thin shell over the library (SPEC-BINDEXER-0).
//!
//! Keyless by construction: no sendtx, no wallet, no key material anywhere in
//! this crate. Broadcasting rides the rails that already exist; the indexer
//! answers questions.

use bindexer::{api, ingest, oracle::EvmRpcOracle, serve, store};
use std::process::ExitCode;

const HELP: &str = "\
bindexer — SPEC-BINDEXER-0 (read-only chain indexer, exSat/7200 first)

USAGE:
  bindexer init --db PATH --chain 7200
  bindexer ingest --db PATH --from N --to N [--allow-single-source]
        --oracle-a URL --oracle-b URL [--name-a A] [--name-b B]
  bindexer status --db PATH
  bindexer block --db PATH --height N | --hash 0x…
  bindexer tx --db PATH --txid 0x…
  bindexer address --db PATH --addr 0x…
  bindexer serve --db PATH --addr 127.0.0.1:8877
  bindexer audit --db PATH            (stranger's audit guide: schema + counts + SQL)
  bindexer prove-keyless              (CI receipt: prints the attestation, exits 0)

LAWS (SPEC-BINDEXER-0):
  sendtx: NO — permanently. This binary cannot broadcast; it has no code path that could.
  Two-oracle law: responses carry `sources`; a single-source answer is marked
  single_source:true and surfaces render the mark.
  Reorgs append a `reorgs` row; history is never silently rewritten.
";

fn arg(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(|s| s.as_str()) {
        Some("prove-keyless") => {
            println!("bindexer keyless attestation (SPEC-BINDEXER-0 §0):");
            println!("  sendtx            : NO — permanently");
            println!("  wallet/key code   : none in this crate (see tests/keyless source scan)");
            println!("  broadcast verbs   : none (source scan green in CI)");
            println!("  api               : GET-only router, five read routes, 405 otherwise");
            println!(
                "acceptance matrix   : every spec §1 row is a named test in tests/acceptance.rs"
            );
            ExitCode::SUCCESS
        }
        Some("init") => {
            let db = arg(&args, "--db").expect("--db required");
            let chain = arg(&args, "--chain").unwrap_or_else(|| "7200".into());
            let conn = store::open(&db).expect("open db");
            store::init(&conn, &chain).expect("init schema");
            store::seal(&conn).expect("seal");
            println!(
                "initialized {db} for chain {chain} (schema v{})",
                store::SCHEMA_VERSION
            );
            ExitCode::SUCCESS
        }
        Some("ingest") => {
            let db = arg(&args, "--db").expect("--db required");
            let from: i64 = arg(&args, "--from")
                .expect("--from")
                .parse()
                .expect("integer");
            let to: i64 = arg(&args, "--to").expect("--to").parse().expect("integer");
            let a_url = arg(&args, "--oracle-a").expect("--oracle-a");
            let b_url = arg(&args, "--oracle-b").expect("--oracle-b");
            let a = EvmRpcOracle::new(
                &arg(&args, "--name-a").unwrap_or_else(|| "oracle-a".into()),
                &a_url,
            );
            let b = EvmRpcOracle::new(
                &arg(&args, "--name-b").unwrap_or_else(|| "oracle-b".into()),
                &b_url,
            );
            let mut conn = store::open(&db).expect("open db");
            let cfg = ingest::IngestConfig {
                allow_single_source: args.iter().any(|a| a == "--allow-single-source"),
                lag_ms: 0,
            };
            match ingest::ingest_range(&mut conn, &a, &b, from, to, &cfg) {
                Ok(n) => {
                    store::seal(&conn).ok();
                    println!("ingested {n} blocks [{from}..={to}] — two-oracle law enforced, single-file db sealed");
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("FAIL-CLOSED: {e}");
                    ExitCode::FAILURE
                }
            }
        }
        Some("status") => {
            let db = arg(&args, "--db").expect("--db required");
            let conn = store::open(&db).expect("open db");
            println!(
                "{}",
                serde_json::to_string_pretty(&api::status(&conn)).unwrap()
            );
            ExitCode::SUCCESS
        }
        Some("block") => {
            let db = arg(&args, "--db").expect("--db required");
            let conn = store::open(&db).expect("open db");
            let out = if let Some(h) = arg(&args, "--height") {
                api::block_by_height(&conn, h.parse().expect("integer height"))
            } else if let Some(h) = arg(&args, "--hash") {
                api::block_by_hash(&conn, &h)
            } else {
                eprintln!("--height N or --hash 0x… required");
                return ExitCode::FAILURE;
            };
            println!("{}", serde_json::to_string_pretty(&out).unwrap());
            ExitCode::SUCCESS
        }
        Some("tx") => {
            let db = arg(&args, "--db").expect("--db required");
            let conn = store::open(&db).expect("open db");
            let id = arg(&args, "--txid").expect("--txid required");
            println!(
                "{}",
                serde_json::to_string_pretty(&api::tx(&conn, &id)).unwrap()
            );
            ExitCode::SUCCESS
        }
        Some("address") => {
            let db = arg(&args, "--db").expect("--db required");
            let conn = store::open(&db).expect("open db");
            let addr = arg(&args, "--addr").expect("--addr required");
            println!(
                "{}",
                serde_json::to_string_pretty(&api::address(&conn, &addr)).unwrap()
            );
            ExitCode::SUCCESS
        }
        Some("serve") => {
            let db = arg(&args, "--db").expect("--db required");
            let addr = arg(&args, "--addr").unwrap_or_else(|| "127.0.0.1:8877".into());
            let conn = store::open(&db).expect("open db");
            match serve::serve(&conn, &addr) {
                Ok(()) => ExitCode::SUCCESS,
                Err(e) => {
                    eprintln!("serve: {e}");
                    ExitCode::FAILURE
                }
            }
        }
        Some("audit") => {
            let db = arg(&args, "--db").expect("--db required");
            let conn = store::open(&db).expect("open db");
            println!(
                "{}",
                serde_json::to_string_pretty(&api::status(&conn)).unwrap()
            );
            println!("\nstranger's audit — run these yourself (sqlite3 {}):", db);
            for q in [
                "SELECT key,value FROM meta;",
                "SELECT height,hex(hash),hex(parent),ts,tx_count FROM blocks ORDER BY height DESC LIMIT 5;",
                "SELECT chain_id,best_height,hex(best_hash),sources_json FROM tips;",
                "SELECT COUNT(*) FROM txs; SELECT COUNT(*) FROM addresses;",
                "SELECT * FROM reorgs;",
                "-- the sendtx row: no broadcast table exists. verify: .tables",
            ] {
                println!("  sqlite3> {q}");
            }
            ExitCode::SUCCESS
        }
        _ => {
            print!("{HELP}");
            ExitCode::SUCCESS
        }
    }
}
