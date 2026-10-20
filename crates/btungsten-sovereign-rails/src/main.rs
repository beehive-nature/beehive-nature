//! sovereign-peer — run one independently administered peer (issue #479).
//!
//!   sovereign-peer serve --store <dir> [--bind 127.0.0.1:0]
//!                         [--egress-budget-bytes N] [--truncate-after N]
//!   sovereign-peer fetch --peer 127.0.0.1:PORT --person <id>
//!                        [--pin <64-hex>] [--max-bytes N]
//!
//! The serve mode prints its bound direct address as JSON on stdout. The
//! fetch mode verifies the full /2 chain over the RECEIVED bytes and
//! prints the verdict as JSON. Exit codes: 0 verified, 1 refusal, 2 usage.

use std::process::ExitCode;

fn usage() -> ExitCode {
    eprintln!(
        "usage: sovereign-peer serve --store <dir> [--bind 127.0.0.1:0] [--egress-budget-bytes N] [--truncate-after N]\n       sovereign-peer fetch --peer 127.0.0.1:PORT --person <id> [--pin <hex>] [--max-bytes N]"
    );
    ExitCode::from(2)
}

fn flag(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("serve") => {
            let Some(store) = flag(&args, "--store") else {
                return usage();
            };
            let bind = flag(&args, "--bind").unwrap_or_else(|| "127.0.0.1:0".to_string());
            let budget: u64 = flag(&args, "--egress-budget-bytes")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            let truncate: Option<u64> =
                flag(&args, "--truncate-after").and_then(|v| v.parse().ok());
            let mut peer = btungsten_sovereign_rails::SovereignPeer::new(&store, budget);
            if let Some(t) = truncate {
                peer = peer.with_truncate_after(t);
            }
            match peer.serve(&bind) {
                Ok(h) => {
                    println!(
                        "{{\"serving\": true, \"addr\": \"{}\", \"egressAuthorizedBytes\": {}, \"x0xSeam\": \"{}\"}}",
                        h.addr,
                        h.ledger.authorized(),
                        btungsten_sovereign_rails::x0x::SEAM
                    );
                    std::thread::park(); // the lab driver stop()s us via the handle in-process; as a child process, kill does
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("serve refused: {e}");
                    ExitCode::from(2)
                }
            }
        }
        Some("fetch") => {
            let (Some(peer_addr), Some(person)) = (flag(&args, "--peer"), flag(&args, "--person"))
            else {
                return usage();
            };
            let pin = flag(&args, "--pin");
            let max: u64 = flag(&args, "--max-bytes")
                .and_then(|v| v.parse().ok())
                .unwrap_or(64 * 1024 * 1024);
            match btungsten_sovereign_rails::fetch_and_verify(
                &peer_addr,
                &person,
                pin.as_deref(),
                max,
            ) {
                Ok(v) => {
                    println!(
                        "{{\"verdict\": \"verified\", \"person\": {:?}, \"name\": {:?}, \"stateSha256\": \"{}\", \"pageHtmlSha256\": \"{}\"}}",
                        person, v.name, v.state_sha256, v.page_html_sha256
                    );
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    println!("{{\"verdict\": \"refused\", \"reason\": {:?}}}", e);
                    ExitCode::FAILURE
                }
            }
        }
        _ => usage(),
    }
}
