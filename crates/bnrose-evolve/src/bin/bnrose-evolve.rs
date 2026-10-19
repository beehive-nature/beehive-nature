//! bnrose-evolve — the controller's command face (read and verify only).
//!
//!   bnrose-evolve verify-envelope --trust FILE --role sovereign|agent --file PATH --envelope PATH
//!       verify a bsigner bheart.signature/1 envelope over PATH's bytes, signed
//!       by a key of that role in the trust file; exit 0 verified, 1 refused
//!   bnrose-evolve status --state DIR --engine sqlite|surrealkv --trust FILE
//!       open the state directory (claiming it), run recovery, print the report
//!       and the journal head; exit 0, or 2 if unresolved liabilities remain
//!
//! Nothing here signs, holds a key, or contacts a network.

use std::collections::BTreeMap;
use std::path::Path;

use bnrose_evolve::{Controller, Role, TrustRoot};

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

fn trust(m: &BTreeMap<String, String>) -> Result<TrustRoot, String> {
    let t = std::fs::read_to_string(need(m, "trust")?).map_err(|e| format!("trust file: {e}"))?;
    TrustRoot::parse(&t).map_err(|e| e.to_string())
}

fn run(args: &[String]) -> Result<i32, String> {
    match args.first().map(String::as_str) {
        Some("verify-envelope") => {
            let m = opts(&args[1..])?;
            let role = match need(&m, "role")? {
                "sovereign" => Role::Sovereign,
                "agent" => Role::Agent,
                r => return Err(format!("unknown role {r:?}")),
            };
            let msg = std::fs::read(need(&m, "file")?).map_err(|e| format!("file: {e}"))?;
            let env = std::fs::read_to_string(need(&m, "envelope")?)
                .map_err(|e| format!("envelope: {e}"))?;
            match trust(&m)?.verify(&env, &msg, role) {
                Ok(kid) => {
                    println!(
                        "verified: {} bytes, role {}, key {kid}",
                        msg.len(),
                        role.name()
                    );
                    Ok(0)
                }
                Err(e) => {
                    println!("refused: {e}");
                    Ok(1)
                }
            }
        }
        Some("status") => {
            let m = opts(&args[1..])?;
            let (c, rep) = Controller::open(
                Path::new(need(&m, "state")?),
                need(&m, "engine")?,
                trust(&m)?,
            )
            .map_err(|e| e.to_string())?;
            println!("engine: {}", rep.engine);
            println!("journal: {} records, head {}", rep.records, rep.head);
            println!("current: {:?}", c.current());
            println!("exposure: {}", rep.exposure);
            println!(
                "recovered now: never-dispatched {}, settled-from-evidence {}, unresolved {}",
                rep.never_dispatched.len(),
                rep.settled_from_evidence.len(),
                rep.unresolved.len()
            );
            for o in &rep.owed_cleanup {
                println!("owed cleanup: {o}");
            }
            let open = c.unresolved_liabilities();
            for (a, amt) in &open {
                println!("unresolved liability: {a} charged {amt}");
            }
            for l in c.lessons() {
                println!("lesson {}: {:?} — {}", l.class, l.state, l.invariant);
            }
            Ok(if open.is_empty() { 0 } else { 2 })
        }
        _ => Err("usage: bnrose-evolve verify-envelope … | status …".into()),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("bnrose-evolve: {e}");
            std::process::exit(64);
        }
    }
}
