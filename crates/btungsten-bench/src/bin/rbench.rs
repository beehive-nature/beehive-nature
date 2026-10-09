//! rbench: run one bTunGsTeN RB lane and write its receipt.
//!
//! usage: rbench <rb01|rb02|rb03> [--quick] [--work DIR] [--out DIR] [--tools DIR]
//!
//!   --work   build copies, fetched dependencies, build output
//!            (default target/rbench/work)
//!   --out    the receipt and its evidence files (default
//!            target/rbench/out/<lane>)
//!   --tools  RB02/RB03: the directory holding the pinned verifier bundles
//!            (see scripts/btungsten/README.md §RB for the layout)
//!   --quick  the CI plan: the same rows with fewer samples
//!
//! Exit status: 0 only when the receipt's verdict is PASS; 1 FAIL;
//! 2 INCONCLUSIVE; 3 the harness itself could not complete the lane (the
//! message says why; no receipt verdict exists).

use std::path::PathBuf;
use std::process::ExitCode;

use btungsten_bench::lanes::{rb01, rb02, rb03};
use btungsten_bench::upstream::repo_root;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(lane) = args.first().cloned() else {
        eprintln!(
            "usage: rbench <rb01|rb02|rb03> [--quick] [--work DIR] [--out DIR] [--tools DIR]"
        );
        return ExitCode::from(3);
    };
    let opt = |name: &str| {
        args.iter()
            .position(|a| a == name)
            .and_then(|i| args.get(i + 1))
            .map(PathBuf::from)
    };
    let quick = args.iter().any(|a| a == "--quick");
    let root = repo_root();
    let work = opt("--work").unwrap_or_else(|| root.join("target/rbench/work"));
    let out = opt("--out").unwrap_or_else(|| root.join("target/rbench/out").join(&lane));
    let tools = opt("--tools");
    let result = match lane.as_str() {
        "rb01" => rb01::run(
            &work,
            &out,
            &if quick {
                rb01::Plan::quick()
            } else {
                rb01::Plan::full()
            },
        ),
        "rb02" => match tools {
            Some(t) => rb02::run(&work, &out, &t, quick),
            None => Err("rb02 needs --tools DIR (the SAW 1.6 bundle)".into()),
        },
        "rb03" => match tools {
            Some(t) => rb03::run(&work, &out, &t, quick),
            None => Err("rb03 needs --tools DIR (the Crux-MIR bundle)".into()),
        },
        other => Err(format!("unknown lane {other}")),
    };
    match result {
        Ok((path, verdict)) => {
            println!("rbench {lane}: {verdict} ({})", path.display());
            ExitCode::from(match verdict {
                "PASS" => 0,
                "FAIL" => 1,
                _ => 2,
            })
        }
        Err(e) => {
            eprintln!("rbench {lane}: harness error, no verdict: {e}");
            ExitCode::from(3)
        }
    }
}
