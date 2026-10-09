//! rb-cvc5-intblast: the cvc5 that RB03 puts first on Crux-MIR's PATH, under
//! the name `cvc5`, for its second solver strategy.
//!
//! Crux-MIR has no way to pass options to a solver. This shim runs the cvc5
//! named by `RB_CVC5` (the what4-solvers snapshot binary, recorded in the
//! receipt) with `--solve-bv-as-int=sum` added in front of the arguments
//! what4 passes (`--lang smt2 --incremental --strings-exp --fp-exp`), so
//! cvc5 translates each bit-vector goal into integer arithmetic with range
//! constraints. On the 128-bit division lemma behind RB03's p2, p4 and p6
//! that decided UNSAT in under a second where bitwuzla's bit-blasting stayed
//! Unknown for 1,100 s (2026-10-08).
//!
//! One line of the script what4 writes is dropped: `(set-option
//! :produce-abducts true)`. It puts cvc5 in SyGuS mode, which refuses
//! integer blasting ("solveBVAsInt not supported in sygus"), and abducts are
//! only requested with crux-mir's `--get-abducts`, which RB03 does not pass.
//! Every other byte is forwarded unchanged, one line at a time; cvc5's
//! answers go straight back to Crux-MIR, which reads them as usual.

use std::io::{BufRead, BufReader, Write};
use std::process::{Command, ExitCode, Stdio};

const DROPPED: &str = "(set-option :produce-abducts true)";

fn main() -> ExitCode {
    let Some(real) = std::env::var_os("RB_CVC5") else {
        eprintln!("rb-cvc5-intblast: RB_CVC5 must name the cvc5 binary");
        return ExitCode::from(2);
    };
    let mut child = match Command::new(&real)
        .arg("--solve-bv-as-int=sum")
        .args(std::env::args_os().skip(1))
        .stdin(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!(
                "rb-cvc5-intblast: cannot run {}: {e}",
                std::path::Path::new(&real).display()
            );
            return ExitCode::from(2);
        }
    };
    let mut to_solver = child.stdin.take().expect("stdin was piped");
    // not joined: when cvc5 exits, returning from main ends this process
    // even if the caller still holds our stdin open
    std::thread::spawn(move || {
        let mut input = BufReader::new(std::io::stdin().lock());
        let mut line = String::new();
        loop {
            line.clear();
            match input.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) if line.trim() == DROPPED => continue,
                Ok(_) => {
                    if to_solver
                        .write_all(line.as_bytes())
                        .and_then(|()| to_solver.flush())
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
    });
    match child.wait() {
        Ok(s) => ExitCode::from(s.code().map_or(1, |c| c as u8)),
        Err(_) => ExitCode::from(1),
    }
}
