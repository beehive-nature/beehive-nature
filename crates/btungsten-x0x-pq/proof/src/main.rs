//! Rust controller: native exits, exact coverage, proof transcript and source pins.
mod binding;
mod names;
mod native;
mod obligations;
mod runner;

use std::{env, fs, path::Path, process::ExitCode};

fn main() -> ExitCode {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() == 3 && args[0] == "run" {
        return match runner::run(Path::new(&args[1]), Path::new(&args[2])) {
            Ok(()) => {
                println!("PREPARE PASS: conditional wrapper proof, native regressions, and convicted controls");
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("PREPARE FAIL: {e}");
                ExitCode::from(1)
            }
        };
    }
    if args.first().is_some_and(|a| a == "bind") {
        let proof = Path::new(env!("CARGO_MANIFEST_DIR"));
        return match binding::verify(proof.ancestors().nth(3).unwrap(), proof) {
            Ok(v) => {
                println!("{}", serde_json::to_string_pretty(&v).unwrap());
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("{e}");
                ExitCode::from(2)
            }
        };
    }
    if args.len() == 3 && args[0] == "names" {
        return match names::generate(Path::new(&args[1]), Path::new(&args[2])) {
            Ok(v) => {
                println!("{}", serde_json::to_string_pretty(&v).unwrap());
                ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("{e}");
                ExitCode::from(2)
            }
        };
    }
    if args.len() == 3 && args[0] == "native" {
        let control = match args[1].as_str() {
            "honest" => native::Control::Honest,
            "accept" => native::Control::Accept,
            "reject" => native::Control::Reject,
            "message" => native::Control::Message,
            "context" => native::Control::Context,
            "signature" => native::Control::Signature,
            "empty" => native::Control::Empty,
            _ => {
                eprintln!("unknown native control");
                return ExitCode::from(2);
            }
        };
        // Remove a stale receipt before fixture construction or any verification.
        if let Err(e) = fs::remove_file(&args[2]) {
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("{e}");
                return ExitCode::from(2);
            }
        }
        match native::run(control) {
            Ok(receipt) => {
                let pass = receipt["result"] == "PASS";
                if let Err(e) = fs::write(
                    &args[2],
                    serde_json::to_string_pretty(&receipt).unwrap() + "\n",
                ) {
                    eprintln!("{e}");
                    return ExitCode::from(2);
                }
                println!(
                    "PREPARE NATIVE {}: {}/{}; {} required rows; {} failures; {} missing",
                    control.name(),
                    receipt["passed"],
                    receipt["executed"],
                    receipt["required_rows"],
                    receipt["failures"].as_array().unwrap().len(),
                    receipt["missing"].as_array().unwrap().len()
                );
                return if pass {
                    ExitCode::SUCCESS
                } else {
                    ExitCode::from(1)
                };
            }
            Err(e) => {
                eprintln!("native fixture error: {e}");
                return ExitCode::from(2);
            }
        }
    }
    eprintln!("usage: pq-prepare-proof run OUT SAW | native honest|accept|reject|message|context|signature|empty RECEIPT | bind | names MIR OUT");
    ExitCode::from(2)
}
