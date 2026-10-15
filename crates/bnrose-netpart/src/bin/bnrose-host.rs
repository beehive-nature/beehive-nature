//! `bnrose-host` — a SOVEREIGN HOST as its own executable
//! (BNROSE-NETPART layer 2, founder review of #444): the host is no
//! longer a struct inside the test process. It holds a claim over its
//! state directory, drives the merged core, and submits to a destination
//! address — recovery rebroadcasts the ORIGINAL persisted bytes from its
//! journal, never bytes reconstructed from the intent file.
//!
//! Usage:
//!   bnrose-host submit   --state DIR --root-hex H --dest ADDR:PORT --intent FILE
//!   bnrose-host resolve  --state DIR --root-hex H --dest ADDR:PORT [--intent FILE] [--rebroadcast]
//!   bnrose-host observe  --dest ADDR:PORT --tx-id HEX
//!
//! Prints one JSON report object; exit 0 = the operation is resolved by
//! an included/final observation, 3 = UNKNOWN preserved, 1 = refusal.

use bnrose_netpart::{DestClient, Host};
use std::time::Duration;

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

fn main() {
    // claims release on return: run() owns every Host, and exit happens
    // only after its locals (claims included) have dropped
    let code = run();
    std::process::exit(code);
}

fn run() -> i32 {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let cmd = argv.first().cloned().unwrap_or_default();
    let args = argv[1..].to_vec();
    let need = |n: &str| -> String { flag(&args, n).unwrap_or_else(|| panic!("missing {n}")) };
    match cmd.as_str() {
        "observe" => {
            let dest: std::net::SocketAddr = need("--dest").parse().expect("addr");
            let c = DestClient::new(dest, "probe", Duration::from_secs(5));
            match c.observe(&need("--tx-id")) {
                Some(st) => {
                    println!("{{\"observed\": \"{}\"}}", st.word());
                    if matches!(
                        st,
                        bnrose_netpart::DestState::Included | bnrose_netpart::DestState::Final
                    ) {
                        0
                    } else {
                        3
                    }
                }
                None => {
                    println!("{{\"observed\": \"unreachable\"}}");
                    3
                }
            }
        }
        "submit" | "resolve" => {
            let state = need("--state");
            let root_hex = need("--root-hex");
            let dest: std::net::SocketAddr = need("--dest").parse().expect("addr");
            let root: [u8; 32] = match bnrose_exec_host::unhex(&root_hex) {
                Ok(v) => match v.try_into() {
                    Ok(r) => r,
                    Err(_) => panic!("root length"),
                },
                Err(_) => panic!("root hex"),
            };
            let client = DestClient::new(dest, &label_of(&state), Duration::from_millis(400));
            let mut host = Host::open(std::path::Path::new(&state), &root, client)
                .unwrap_or_else(|e| panic!("host open: {e}"));
            let now: u64 = flag(&args, "--clock")
                .and_then(|c| c.parse().ok())
                .unwrap_or(1_800_000_000);
            let intent_file = need("--intent");
            let v: serde_json::Value = std::fs::read_to_string(&intent_file)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .expect("intent file");
            let intent = bnrose_exec_host::fixtures::read_intent(&v).expect("intent");
            if cmd == "submit" {
                let r = host.run_to_effect(&intent, now);
                let obs = r.final_observation;
                report(&r, obs);
                if matches!(obs, Some("included") | Some("final")) {
                    0
                } else {
                    3
                }
            } else {
                let rebroadcast = args.iter().any(|a| a == "--rebroadcast");
                // RECOVERY LAW: the journal's admitted operation is
                // authoritative — a supplied intent that disagrees with
                // the PERSISTED bytes is refused before anything leaves
                if rebroadcast {
                    let persisted = host.first_persisted_submission();
                    match persisted {
                        Some(env) if env == intent.env => {}
                        Some(_) => {
                            eprintln!("refused: persisted-bytes-mismatch — the journal's submission is authoritative");
                            return 1;
                        }
                        None => {
                            eprintln!("refused: no persisted operation in this journal");
                            return 1;
                        }
                    }
                }
                let r = host.resolve(&intent, now, rebroadcast);
                let obs = r.final_observation;
                report(&r, obs);
                if r.submission_outcome.starts_with("recovery:") {
                    eprintln!("refused: {}", r.submission_outcome);
                    return 1;
                }
                if matches!(obs, Some("included") | Some("final")) {
                    0
                } else {
                    3
                }
            }
        }
        _ => {
            eprintln!("usage: bnrose-host <submit|resolve|observe> ...");
            1
        }
    }
}

fn label_of(state: &str) -> String {
    std::path::Path::new(state)
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| "host".into())
}

fn host_client_observation(
    r: &bnrose_netpart::HostReport,
    dest: std::net::SocketAddr,
) -> Option<&'static str> {
    let _ = dest;
    r.final_observation
}

fn report(r: &bnrose_netpart::HostReport, obs: Option<&'static str>) {
    println!(
        "{}",
        serde_json::json!({
            "op": bnrose_exec_host::hex(&r.op),
            "txId": r.tx_id,
            "submitted": r.submitted,
            "submissionOutcome": r.submission_outcome,
            "observed": obs,
            "oneSignedAttempt": r.signatures_journaled == 1,
            "journalRecords": r.journal_records,
        })
    );
}
