//! bnrose-anchor-vaulta — open a controller against its latest Vaulta anchor,
//! and build the next anchor action for a signer lane.
//!
//!   bnrose-anchor-vaulta open --state DIR --engine sqlite|surrealkv --trust FILE
//!       --subject NAME --contract ACCOUNT --endpoints URL[,URL…] [--chain-id ID]
//!       read the subject's latest anchor from every endpoint (chain id pinned,
//!       Jungle4 by default), then open the controller against it; exit 0
//!       accepted, 3 refused as tampered, 4 refused for any other reason
//!   bnrose-anchor-vaulta action … the same flags, plus --publisher ACCOUNT
//!       the same open, and only if it is accepted, print the UNSIGNED anchor
//!       action for the journal as it now stands (a refused journal is never
//!       re-anchored); signing and pushing it belong to a signer lane
//!
//! Nothing here signs, holds a key, or asks for one.

use std::collections::BTreeMap;
use std::path::Path;

use bnrose_anchor_vaulta::{anchor_action, latest, JUNGLE4_CHAIN_ID};
use bnrose_evolve::{AnchorStatement, Controller, TrustRoot};

fn opts(args: &[String]) -> Result<BTreeMap<String, String>, String> {
    let mut m = BTreeMap::new();
    let mut it = args.iter();
    while let Some(k) = it.next() {
        let k = k
            .strip_prefix("--")
            .ok_or_else(|| format!("expected --flag, got {k:?}"))?;
        let v = it.next().ok_or_else(|| format!("--{k} needs a value"))?;
        if m.insert(k.to_string(), v.clone()).is_some() {
            return Err(format!("--{k} given twice"));
        }
    }
    Ok(m)
}

fn need<'a>(m: &'a BTreeMap<String, String>, k: &str) -> Result<&'a str, String> {
    m.get(k)
        .map(String::as_str)
        .ok_or_else(|| format!("missing --{k}"))
}

fn run(args: &[String]) -> Result<i32, String> {
    let cmd = args.first().map(String::as_str);
    if !matches!(cmd, Some("open") | Some("action")) {
        return Err("usage: bnrose-anchor-vaulta open … | action …".into());
    }
    let m = opts(&args[1..])?;
    let trust = std::fs::read_to_string(need(&m, "trust")?)
        .map_err(|e| format!("trust file: {e}"))
        .and_then(|t| TrustRoot::parse(&t).map_err(|e| e.to_string()))?;
    let subject = need(&m, "subject")?;
    let contract = need(&m, "contract")?;
    let chain_id = m.get("chain-id").map_or(JUNGLE4_CHAIN_ID, String::as_str);
    let endpoints: Vec<&str> = need(&m, "endpoints")?.split(',').collect();

    let lookup = latest(&endpoints, chain_id, contract, subject);
    println!("anchor lookup: {lookup:?}");
    let opened = Controller::open_anchored(
        Path::new(need(&m, "state")?),
        need(&m, "engine")?,
        trust,
        subject,
        &lookup,
    );
    let (c, rep, check) = match opened {
        Ok(v) => v,
        Err(e) => {
            println!("refused: {e}");
            return Ok(if e.code() == "tampered" { 3 } else { 4 });
        }
    };
    println!("accepted: {check:?}");
    println!("journal: {} records, head {}", rep.records, rep.head);
    if cmd == Some("action") {
        let s = AnchorStatement::of(&c, subject).map_err(|e| e.to_string())?;
        println!("statement digest: {}", s.digest());
        println!(
            "{}",
            serde_json::to_string_pretty(&anchor_action(contract, need(&m, "publisher")?, &s))
                .expect("a json value serializes")
        );
    }
    Ok(0)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("bnrose-anchor-vaulta: {e}");
            std::process::exit(64);
        }
    }
}
