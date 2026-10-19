//! Read-only repository byte adapter over the existing atmirror Rail contract.
//! No default endpoint, wallet, signer, payment, upload or server.
use atmirror::arweave::ArweaveRail;
use atmirror::autonomi::AntCli;
use atmirror::rail::Rail;
use std::io::Write;

fn run(args: &[String]) -> Result<(), String> {
    if args.len() != 4 {
        return Err("usage: repository-rail ar|ant ADDRESS GATEWAY_OR_ANT_BINARY MAX_BYTES".into());
    }
    let cap: usize = args[3].parse().map_err(|_| "bad byte ceiling")?;
    if cap > 256 * 1024 * 1024 {
        return Err("read ceiling exceeds 256 MiB per object".into());
    }
    let address = &args[1];
    let rail: Box<dyn Rail> = match args[0].as_str() {
        "ar" if address.len() == 43
            && address
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') =>
        {
            Box::new(ArweaveRail::read_only(&[args[2].clone()]).with_read_limit(cap as u64))
        }
        "ant"
            if address.len() == 64
                && address
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) =>
        {
            Box::new(AntCli::new(&args[2]).with_read_limit(cap as u64))
        }
        _ => return Err("invalid rail/address".into()),
    };
    let bytes = rail.get(address).map_err(|_| "rail read failed")?;
    if bytes.len() > cap {
        return Err("rail returned too many bytes".into());
    }
    std::io::stdout()
        .write_all(&bytes)
        .map_err(|_| "output failed".into())
}

fn main() {
    if let Err(e) = run(&std::env::args().skip(1).collect::<Vec<_>>()) {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
