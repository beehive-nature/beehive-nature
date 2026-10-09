//! Circuit PSI with edge-case evaluator (and garbler) inputs: repeated
//! elements in B, and empty sets.
//!
//! Place at edge/popsicle/examples/repro_evaluator_inputs.rs and run:
//!   cargo run --release -p popsicle --example repro_evaluator_inputs -- <case>
//! where <case> is one of: dup2 dup3 dup4 empty-b empty-a empty-both
//!
//! Synthetic data only. A watchdog ends the process after WATCHDOG_SECS with
//! exit code 124 if the session has not finished.

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::RngExt;
use std::time::{Duration, Instant};
use swanky_block::Block;
use swanky_rng::SwankyRng;

const WATCHDOG_SECS: u64 = 60;

fn key(x: u64) -> Vec<u8> {
    x.to_le_bytes().to_vec()
}

/// Printed before anything runs, so the operator sees it at the point of use.
fn notice() {
    println!("NOTICE: this program runs popsicle circuit PSI from Swanky, which its README calls research software,");
    println!("not for production or sensitive data. The two parties are threads of this one process,");
    println!("joined by an in-process socket pair. Data: synthetic keys made by this program; nothing is read");
    println!("from or written to disk, and results print to this terminal only. Limits: one case per run; a watchdog ends the process after 60 s, and until then a case that does not complete keeps one CPU core busy.");
    println!("It deliberately drives upstream into panics or sessions that do not complete.");
    println!("Unresolved: results are samples from one host and one target (x86_64); behaviour elsewhere is untested, and no result here establishes a security property of Swanky.");
    println!("It reproduces upstream behaviour at a pinned commit and establishes no security property.");
    println!("It creates no persistent state.");
}

fn main() {
    notice();
    let case = std::env::args().nth(1).unwrap_or_default();
    let base: Vec<Vec<u8>> = (100u64..356).map(key).collect();
    let (x, y) = (key(7), key(9));
    // (A, B, the answer under set semantics)
    let (a, b, set_answer): (Vec<Vec<u8>>, Vec<Vec<u8>>, u128) = match case.as_str() {
        "dup2" => (vec![x.clone()], vec![x.clone(), x.clone(), y], 1),
        "dup3" => (vec![x.clone()], vec![x.clone(), x.clone(), x.clone(), y], 1),
        "dup4" => (vec![x.clone()], vec![x.clone(), x.clone(), x.clone(), x.clone(), y], 1),
        "empty-b" => (base.clone(), vec![], 0),
        "empty-a" => (vec![], base.clone(), 0),
        "empty-both" => (vec![], vec![], 0),
        _ => {
            eprintln!("usage: repro_evaluator_inputs dup2|dup3|dup4|empty-b|empty-a|empty-both");
            std::process::exit(2);
        }
    };
    let start = Instant::now();
    let what = case.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(WATCHDOG_SECS));
        println!("{what}: no result after {:?}; exiting 124", start.elapsed());
        std::process::exit(124);
    });
    let r = swanky_channel::local::local_channel_pair(
        |ch| {
            let mut rng = SwankyRng::new();
            let mut gb = OpprfPsiGarbler::<SwankyRng>::new(ch, Block::from(rng.random::<u128>()))?;
            let r = gb.intersect(&a, ch)?;
            let c = fancy_cardinality(&mut gb.gb, &r.intersection.existence_bit_vector, ch)?;
            gb.gb.outputs(c.wires(), ch)?;
            Ok(())
        },
        |ch| {
            let mut rng = SwankyRng::new();
            let mut ev = OpprfPsiEvaluator::<SwankyRng>::new(ch, Block::from(rng.random::<u128>()))?;
            let r = ev.intersect(&b, ch)?;
            let c = fancy_cardinality(&mut ev.ev, &r.intersection.existence_bit_vector, ch)?;
            let out = ev.ev.outputs(c.wires(), ch)?.expect("evaluator receives the output");
            Ok(binary_to_u128(out))
        },
    );
    println!(
        "{case}: |A| = {}, |B| = {} (as given), set answer {set_answer}: {} after {:?}",
        a.len(),
        b.len(),
        match r {
            Ok((_, c)) => format!("cardinality {c}"),
            Err(e) => format!("Err({e})"),
        },
        start.elapsed()
    );
}
