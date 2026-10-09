//! A repeated element in the garbler's input, and a repeated programmed point
//! in swanky-oprf-kmprt's `Sender::send`.
//!
//! Place at edge/popsicle/examples/repro_repeated_points.rs and run:
//!   cargo run --release -p popsicle --example repro_repeated_points -- psi
//!   cargo run --release -p popsicle --example repro_repeated_points -- kmprt
//!   cargo run           -p popsicle --example repro_repeated_points -- kmprt   (debug build)
//!
//! Synthetic data only. A watchdog ends the process after WATCHDOG_SECS with
//! exit code 124 if the session has not finished.

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::RngExt;
use std::time::{Duration, Instant};
use swanky_block::{Block, Block512};
use swanky_rng::SwankyRng;

const WATCHDOG_SECS: u64 = 60;

fn watchdog(what: &'static str) {
    let start = Instant::now();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(WATCHDOG_SECS));
        println!("{what}: no result after {:?}; exiting 124", start.elapsed());
        std::process::exit(124);
    });
}

fn psi() {
    let x = 7u64.to_le_bytes().to_vec();
    let y = 9u64.to_le_bytes().to_vec();
    // A = [x, x, y]: x appears twice. B = {x}. The set answer is 1.
    let a = vec![x.clone(), x.clone(), y];
    let b = vec![x];
    watchdog("circuit PSI, repeated garbler element");
    let t = Instant::now();
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
    println!("circuit PSI, repeated garbler element: {:?} after {:?}", r.map(|(_, c)| c), t.elapsed());
}

fn kmprt() {
    // Three programmed points; the first one is given twice, with the same
    // output both times. One receiver input.
    let mut rng = SwankyRng::new();
    let p = (rng.random::<Block>(), rng.random::<Block512>());
    let q = (rng.random::<Block>(), rng.random::<Block512>());
    let points = vec![p, p, q];
    let inputs = vec![p.0];
    watchdog("kmprt Sender::send, repeated programmed point");
    let t = Instant::now();
    let r = swanky_channel::local::local_channel_pair(
        |ch| {
            let mut rng = SwankyRng::new();
            let mut s: swanky_oprf_kmprt::Sender = swanky_oprf_kmprt::Sender::init(ch, &mut rng)?;
            s.send(ch, &points, inputs.len(), &mut rng)
        },
        |ch| {
            let mut rng = SwankyRng::new();
            let mut r: swanky_oprf_kmprt::Receiver = swanky_oprf_kmprt::Receiver::init(ch, &mut rng)?;
            r.receive(ch, &inputs, &mut rng)
        },
    );
    println!(
        "kmprt Sender::send, repeated programmed point: {} after {:?}",
        match r {
            Ok((_, out)) => format!("Ok, receiver output equals programmed value: {}", out[0] == p.1),
            Err(e) => format!("Err({e})"),
        },
        t.elapsed()
    );
}

/// Printed before anything runs, so the operator sees it at the point of use.
fn notice() {
    println!("NOTICE: this program runs popsicle circuit PSI (psi) or the swanky-oprf-kmprt OPPRF (kmprt) from Swanky, which its README calls research software,");
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
    match std::env::args().nth(1).as_deref() {
        Some("psi") => psi(),
        Some("kmprt") => kmprt(),
        _ => eprintln!("usage: repro_repeated_points psi|kmprt"),
    }
}
