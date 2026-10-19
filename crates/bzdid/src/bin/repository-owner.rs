//! Resolve the existing bzDiD proof locally. Never fetches or creates an identity.
//! Pinned head AND sequence prevent a withheld or same-sequence substitute.
use bzdid::{resolve_did, BzDid, KeyAlg};

fn read(path: &str) -> Result<Vec<u8>, String> {
    if std::fs::metadata(path).map_err(|_| "missing proof")?.len() > 65_536 {
        return Err("proof exceeds 64 KiB".into());
    }
    std::fs::read(path).map_err(|_| "cannot read proof".into())
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn run(args: &[String]) -> Result<String, String> {
    if args.len() < 5 || args.len() > 1029 {
        return Err("usage: repository-owner DID GENESIS PINNED_HEAD_HEX PINNED_SEQUENCE CLOCK [ROTATION ...]".into());
    }
    let did = BzDid::parse(&args[0])?;
    let genesis = read(&args[1])?;
    let seq: u64 = args[3].parse().map_err(|_| "bad sequence")?;
    let clock: u64 = args[4].parse().map_err(|_| "bad clock")?;
    let rotations = args[5..]
        .iter()
        .map(|p| read(p))
        .collect::<Result<Vec<_>, _>>()?;
    let resolved = resolve_did(&did, &genesis, &rotations, Some(seq)).map_err(|e| e.to_string())?;
    if resolved.head.seq != seq || hex(&resolved.head.hash) != args[2] {
        return Err("identity head is not the independently pinned head".into());
    }
    if !resolved.valid_at(clock) || resolved.head.last_at > clock {
        return Err("identity is not current at the supplied clock".into());
    }
    if resolved.head.signing_key.alg != KeyAlg::MlDsa65 {
        return Err("repository policy v1 requires ml-dsa-65; no implicit key upgrade".into());
    }
    Ok(hex(&resolved.head.signing_key.key))
}
fn main() {
    match run(&std::env::args().skip(1).collect::<Vec<_>>()) {
        Ok(public_key) => println!("{public_key}"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
