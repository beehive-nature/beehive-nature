//! bnrose-rail-host — the sovereign host driver at the adapter seam.
//!
//! Commands:
//!   submit       build (from flags) + journal + submit (one signed attempt)
//!   rebroadcast  submit the JOURNALED bytes for --op (never caller bytes)
//!   observe      read the destination's own state for --txid/--op
//!
//! The laws in force: exact signed bytes + the chain id journaled BEFORE
//! submission; a lost/no-answer submission exits 3 (UNKNOWN — the landed
//! CLI contract) and stays resolvable; a definitive node refusal exits 2
//! with its class; `duplicate` is an observation that never completes
//! anything — only an included/final observation does.
//!
//! EVM build flags: --to 0x… --value-wei N --nonce N --gas N --max-fee-wei N
//!   --max-prio-wei N --chain-id N --seed-hex HEX
//! Hive build flags: --from --to --amount --sym HIVE|HBD --memo
//!   --ref-block-num N --ref-block-prefix N --expiration-unix N --seed-hex HEX
//! shared: --rail arb|hive --state DIR --dest HOST:PORT [--root-hex HEX]

use bnrose_settle_adapters::evm::Eip1559;
use bnrose_settle_adapters::hive::ser;
use bnrose_settle_adapters::lineproto::{LineClient, RailObserve, RailSubmit};
use bnrose_settle_adapters::railhost::{outcome, RailHost};
use bnrose_settle_adapters::{hex, unhex};
use serde_json::{json, Value};
use std::net::ToSocketAddrs;
use std::time::Duration;

fn flag(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

/// Everything runs inside this function so the CLAIM (an OS lock released
/// on Drop) is released before `std::process::exit` — process::exit skips
/// Drop, and a leaked claim panics the next run (the landed layer-2 law).
fn run() -> i32 {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let cmd = argv.first().cloned().unwrap_or_default();
    let rail = flag(&argv, "--rail").unwrap_or_else(|| "arb".into());
    let state = flag(&argv, "--state").unwrap_or_default();
    let dest = flag(&argv, "--dest").unwrap_or_default();
    let seed_hex = flag(&argv, "--seed-hex").unwrap_or_else(|| "2a".repeat(32));
    let root_hex = flag(&argv, "--root-hex").unwrap_or_else(|| "11".repeat(32));
    if state.is_empty()
        || dest.is_empty()
        || !matches!(cmd.as_str(), "submit" | "rebroadcast" | "observe")
    {
        eprintln!("usage: bnrose-rail-host submit|rebroadcast|observe --rail arb|hive --state DIR --dest HOST:PORT [build flags]");
        return 2;
    }
    let Some(dest_addr) = dest.to_socket_addrs().ok().and_then(|mut a| a.next()) else {
        eprintln!("bnrose-rail-host: cannot resolve --dest {dest}");
        return 2;
    };
    let Ok(seed) = <[u8; 32]>::try_from(unhex(&seed_hex).unwrap_or_default()) else {
        eprintln!("bnrose-rail-host: --seed-hex must be 32 bytes");
        return 2;
    };
    let Ok(root) = <[u8; 32]>::try_from(unhex(&root_hex).unwrap_or_default()) else {
        eprintln!("bnrose-rail-host: --root-hex must be 32 bytes");
        return 2;
    };
    let host = match RailHost::open_recovering(std::path::Path::new(&state), &root) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("bnrose-rail-host: {e}");
            return 1;
        }
    };
    // the submit budget is the window in which a lost answer becomes
    // UNKNOWN; observation reads get their own, longer budget
    let submit_client = LineClient::new(dest_addr, "hostA", Duration::from_millis(5000));
    let observe_client = LineClient::new(dest_addr, "hostA", Duration::from_millis(2500));

    let report = match cmd.as_str() {
        "submit" => {
            // the wire payload is the EXACT bytes that get submitted and
            // journaled: the raw signed envelope (EVM) or the signed
            // transaction object (Hive JSON)
            let (wire_payload, tx_id) = if rail == "hive" {
                build_hive(&argv, &seed)
            } else {
                build_arb(&argv, &seed)
            };
            // THE PERSISTENCE LAW: bytes + chain id durable BEFORE submission
            let op = match host.journal_signed(&wire_payload, &tx_id) {
                Ok(o) => o,
                Err(e) => {
                    eprintln!("bnrose-rail-host: {e}");
                    return 1;
                }
            };
            let outcome = submit_client.submit(&tx_id, &hex(&wire_payload));
            let _ = host.journal_outcome(&op, code_of(&outcome), &outcome.word());
            finish(&host, &observe_client, &op, &tx_id, outcome)
        }
        "rebroadcast" => {
            let op_hex = flag(&argv, "--op-hex").unwrap_or_default();
            let Some(op) = <[u8; 32]>::try_from(unhex(&op_hex).unwrap_or_default()).ok() else {
                eprintln!("bnrose-rail-host: --op-hex must be 32 bytes");
                return 2;
            };
            // THE REBROADCAST LAW: bytes sourced from the authenticated
            // journal; a missing record REFUSES
            let Some((raw, tx_id)) = host.persisted(&op) else {
                eprintln!("recovery:no-persisted-submission — refusing to invent bytes");
                return 4;
            };
            let outcome = submit_client.submit(&tx_id, &hex(&raw));
            let _ = host.journal_outcome(
                &op,
                code_of(&outcome),
                &format!("rebroadcast {}", outcome.word()),
            );
            finish(&host, &observe_client, &op, &tx_id, outcome)
        }
        _ => {
            // observe: the destination's own state decides
            let tx_id = flag(&argv, "--txid").unwrap_or_else(|| {
                let op_hex = flag(&argv, "--op-hex").unwrap_or_default();
                let op =
                    <[u8; 32]>::try_from(unhex(&op_hex).unwrap_or_default()).unwrap_or([0; 32]);
                host.persisted(&op).map(|(_r, t)| t).unwrap_or_default()
            });
            match observe_client.observe(&tx_id) {
                Some(RailObserve::Final) => {
                    println!("{}", json!({"state":"final","txid":tx_id}));
                    0
                }
                Some(RailObserve::Included) => {
                    println!("{}", json!({"state":"included","txid":tx_id}));
                    0
                }
                Some(RailObserve::Pending) => {
                    println!("{}", json!({"state":"pending","txid":tx_id}));
                    5
                }
                _ => {
                    println!("{}", json!({"state":"unknown-to-dest","txid":tx_id}));
                    6
                }
            }
        }
    };
    report
}

fn main() {
    let code = run();
    std::process::exit(code);
}

fn code_of(outcome: &RailSubmit) -> u8 {
    match outcome {
        RailSubmit::Acked => outcome::ACKED,
        RailSubmit::Duplicate => outcome::DUPLICATE,
        RailSubmit::Timeout => outcome::TIMEOUT_UNKNOWN,
        RailSubmit::Conflict => outcome::CONFLICT,
        RailSubmit::StorageError => outcome::STORAGE_ERROR,
        RailSubmit::Refused(_) => outcome::REFUSED,
    }
}

/// one report line: the outcome word, the observation, the journal count.
/// The completion law: only an included/final observation completes; a
/// duplicate response alone NEVER does.
fn finish(
    host: &RailHost,
    observe_client: &LineClient,
    op: &[u8; 32],
    tx_id: &str,
    outcome: RailSubmit,
) -> i32 {
    let obs = observe_client.observe(tx_id).map(|o| o.word());
    if matches!(obs, Some("included") | Some("final")) {
        let _ = host.journal_outcome(
            op,
            if obs == Some("final") {
                outcome::OBSERVED_FINAL
            } else {
                outcome::OBSERVED_INCLUDED
            },
            obs.unwrap_or(""),
        );
    }
    println!(
        "{}",
        json!({"op":hex(op),"txid":tx_id,"outcome":outcome.word(),"observation":obs,"admissions":host.admissions()})
    );
    match outcome {
        RailSubmit::Acked => 0,
        RailSubmit::Duplicate => 0, // an observation, not a failure
        RailSubmit::Conflict => 7,
        RailSubmit::StorageError => 8, // the destination could not take it
        RailSubmit::Refused(_) => 2,
        RailSubmit::Timeout => 3, // UNKNOWN — the landed CLI contract
    }
}

fn build_arb(argv: &[String], seed: &[u8; 32]) -> (Vec<u8>, String) {
    let to_hex = flag(argv, "--to").unwrap_or_default();
    let Ok(to) = <[u8; 20]>::try_from(unhex(&to_hex).unwrap_or_default()) else {
        eprintln!("bnrose-rail-host: --to must be a 20-byte address");
        std::process::exit(2);
    };
    let tx = Eip1559 {
        chain_id: flag(argv, "--chain-id")
            .and_then(|v| v.parse().ok())
            .unwrap_or(31337),
        nonce: flag(argv, "--nonce")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0),
        max_priority_fee_per_gas: flag(argv, "--max-prio-wei")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1_000_000_000),
        max_fee_per_gas: flag(argv, "--max-fee-wei")
            .and_then(|v| v.parse().ok())
            .unwrap_or(2_000_000_000),
        gas_limit: flag(argv, "--gas")
            .and_then(|v| v.parse().ok())
            .unwrap_or(21_000),
        to,
        value_wei: flag(argv, "--value-wei")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1),
        data: vec![],
    };
    let signed = tx.into_signed(seed).expect("seed signs");
    let hash = signed.hash_hex();
    (signed.raw, hash)
}

fn build_hive(argv: &[String], seed: &[u8; 32]) -> (Vec<u8>, String) {
    let from = flag(argv, "--from").unwrap_or_else(|| "sender".into());
    let to = flag(argv, "--to").unwrap_or_else(|| "receiver".into());
    let amount = flag(argv, "--amount").unwrap_or_else(|| "1.000".into());
    let memo = flag(argv, "--memo").unwrap_or_default();
    let sym = match flag(argv, "--sym").as_deref() {
        Some("HBD") => ser::HiveSymbol::Hbd,
        _ => ser::HiveSymbol::Hive,
    };
    let canon = ser::canonical_amount(&amount).unwrap_or_else(|e| {
        eprintln!("bnrose-rail-host: {e}");
        std::process::exit(2);
    });
    let trx = ser::UnsignedTrx {
        ref_block_num: flag(argv, "--ref-block-num")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1),
        ref_block_prefix: flag(argv, "--ref-block-prefix")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1),
        expiration: flag(argv, "--expiration-unix")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0),
        operations: vec![ser::HiveOperation::Transfer(ser::TransferOp {
            from: from.clone(),
            to: to.clone(),
            amount: canon.clone(),
            sym,
            memo: memo.clone(),
        })],
    };
    let bytes = ser::serialize_trx(&trx).expect("fixture serializes");
    let tx_id = ser::hive_txid(&bytes);
    let sig = ser::sign_hex(
        seed,
        &ser::chain_id_from_hex(ser::HIVE_CHAIN_ID_HEX).unwrap(),
        &bytes,
    )
    .expect("seed signs");
    // the wire artifact: the signed JSON object — the EXACT bytes journaled
    // and rebroadcast; the id recomputes from its canonical form
    let signed = json!({
        "ref_block_num": trx.ref_block_num,
        "ref_block_prefix": trx.ref_block_prefix,
        "expiration": iso_of(trx.expiration),
        "operations": [["transfer", {"from": from, "to": to, "amount": format!("{canon} {}", sym.word()), "memo": memo}]],
        "extensions": [],
        "signatures": [sig]
    });
    (serde_json::to_vec(&signed).unwrap(), tx_id)
}

/// unix seconds → "YYYY-MM-DDTHH:MM:SSZ" (the inverse of the rail's
/// parser — civil-from-days)
fn iso_of(unix: u32) -> String {
    let days = (unix / 86400) as i64;
    let secs = unix % 86400;
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        secs / 3600,
        (secs % 3600) / 60,
        secs % 60
    )
}
