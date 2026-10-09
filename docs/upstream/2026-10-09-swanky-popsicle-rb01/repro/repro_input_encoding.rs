//! popsicle::utils::compress_and_hash_inputs zero-pads inputs of at most 16
//! bytes, so byte strings that differ only by trailing zero bytes map to the
//! same block; circuit PSI then counts them as equal.
//!
//! Place at edge/popsicle/examples/repro_input_encoding.rs and run:
//!   cargo run --release -p popsicle --example repro_input_encoding
//!
//! Synthetic data only. A watchdog ends the process after 60 s with exit
//! code 124.

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::RngExt;
use std::time::{Duration, Instant};
use swanky_block::Block;
use swanky_rng::SwankyRng;

/// Printed before anything runs, so the operator sees it at the point of use.
fn notice() {
    println!("NOTICE: this program runs popsicle circuit PSI from Swanky, which its README calls research software,");
    println!("not for production or sensitive data. The two parties are threads of this one process,");
    println!("joined by an in-process socket pair. Data: synthetic keys made by this program; nothing is read");
    println!("from or written to disk, and results print to this terminal only. Limits: three encoding comparisons and one short session; a watchdog ends the process after 60 s.");
    println!("It deliberately shows an encoding collision in upstream.");
    println!("Unresolved: results are samples from one host and one target (x86_64); behaviour elsewhere is untested, and no result here establishes a security property of Swanky.");
    println!("It reproduces upstream behaviour at a pinned commit and establishes no security property.");
    println!("It creates no persistent state.");
}

fn main() {
    notice();
    let start = Instant::now();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(60));
        println!("no result after {:?}; exiting 124", start.elapsed());
        std::process::exit(124);
    });
    // 1. The encoding function alone.
    let key = SwankyRng::new().random::<Block>();
    let pairs: [(&[u8], &[u8]); 3] = [
        (&[0x01], &[0x01, 0x00]),
        (&[], &[0x00]),
        (b"alice", b"alice\0\0\0"),
    ];
    for (p, q) in pairs {
        let h = popsicle::utils::compress_and_hash_inputs(&[p.to_vec(), q.to_vec()], key);
        println!("compress_and_hash_inputs({p:02x?}) == compress_and_hash_inputs({q:02x?}): {}", h[0] == h[1]);
    }

    // 2. End to end: A = {[0x01]}, B = {[0x01, 0x00]}. Byte-string answer 0.
    let a = vec![vec![0x01u8]];
    let b = vec![vec![0x01u8, 0x00]];
    let (_, c) = swanky_channel::local::local_channel_pair(
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
    )
    .unwrap();
    println!("circuit PSI cardinality of A = {{[01]}}, B = {{[01 00]}}: {c} (byte-string answer 0)");
}
