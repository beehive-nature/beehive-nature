//! gp — the genealogy-publication CLI.
//!
//!   gp bind    --root <repo>           seal the tree (write state + index)
//!   gp check   --root <repo>           verify the seal; red on any drift
//!   gp resolve --root <repo> --person <id> [--bname <label>.b]
//!                                       emit the decentralized resolution
//!                                       record for one person
//!
//! Exit codes: 0 green, 1 drift/lookup failure, 2 usage/IO error.

use std::path::Path;
use std::process::ExitCode;

fn usage() -> ExitCode {
    eprintln!("usage: gp <bind|check|resolve> --root <repo> [--person <id>] [--bname <label>.b] [--max-named N]");
    ExitCode::from(2)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str);
    let flag = |name: &str| -> Option<String> {
        args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
    };
    let Some(cmd) = cmd else { return usage() };
    let Some(root) = flag("--root") else { return usage() };
    let root = Path::new(&root);

    match cmd {
        "bind" => match genealogy_publication::bind_and_write(root) {
            Ok(out) => {
                println!(
                    "{{\"bound\": true, \"persons\": {}, \"state\": \"{}\", \"index\": \"{}\"}}",
                    out.persons,
                    genealogy_publication::state_path(root).display(),
                    genealogy_publication::index_path(root).display()
                );
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("bind refused: {e}");
                ExitCode::from(2)
            }
        },
        "check" => {
            let max: usize = flag("--max-named").and_then(|v| v.parse().ok()).unwrap_or(20);
            match genealogy_publication::check(root, max) {
                Ok(rep) => {
                    for f in &rep.findings {
                        println!("RED: {f}");
                    }
                    println!("{{\"green\": {}, \"findings\": {}}}", rep.green, rep.findings.len());
                    if rep.green {
                        ExitCode::SUCCESS
                    } else {
                        ExitCode::FAILURE
                    }
                }
                Err(e) => {
                    eprintln!("check error: {e}");
                    ExitCode::from(2)
                }
            }
        }
        "resolve" => {
            let Some(person) = flag("--person") else { return usage() };
            match genealogy_publication::resolve(root, &person, flag("--bname").as_deref()) {
                Ok(out) => {
                    print!("{out}");
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("resolve: {e}");
                    ExitCode::FAILURE
                }
            }
        }
        _ => usage(),
    }
}
