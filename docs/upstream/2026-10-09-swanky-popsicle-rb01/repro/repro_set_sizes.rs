//! Circuit PSI with |A| > |B|: where the garbler stops producing a result.
//!
//! Place at edge/popsicle/examples/repro_set_sizes.rs and run:
//!   cargo run --release -p popsicle --example repro_set_sizes
//!
//! Synthetic data only: A = {0..na}, B = {na-128..na+128} (|B| = 256,
//! |A ∩ B| = 128), as 8-byte little-endian keys. For each |A|, TRIALS fresh
//! sessions; a session either returns a cardinality or a panic is caught.
//! Every panicking session's panic messages are tallied. A watchdog ends the
//! process after WATCHDOG_SECS with exit code 124.

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::RngExt;
use std::collections::BTreeMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use swanky_block::Block;
use swanky_rng::SwankyRng;

const TRIALS: usize = 20;
const WATCHDOG_SECS: u64 = 600;
static PANICS: Mutex<Vec<String>> = Mutex::new(Vec::new());

fn cardinality(a: &[Vec<u8>], b: &[Vec<u8>]) -> swanky_error::Result<u128> {
    let (_, out) = swanky_channel::local::local_channel_pair(
        |ch| {
            let mut rng = SwankyRng::new();
            let mut gb = OpprfPsiGarbler::<SwankyRng>::new(ch, Block::from(rng.random::<u128>()))?;
            let r = gb.intersect(a, ch)?;
            let c = fancy_cardinality(&mut gb.gb, &r.intersection.existence_bit_vector, ch)?;
            gb.gb.outputs(c.wires(), ch)?;
            Ok(())
        },
        |ch| {
            let mut rng = SwankyRng::new();
            let mut ev = OpprfPsiEvaluator::<SwankyRng>::new(ch, Block::from(rng.random::<u128>()))?;
            let r = ev.intersect(b, ch)?;
            let c = fancy_cardinality(&mut ev.ev, &r.intersection.existence_bit_vector, ch)?;
            let out = ev.ev.outputs(c.wires(), ch)?.expect("evaluator receives the output");
            Ok(binary_to_u128(out))
        },
    )?;
    Ok(out)
}

fn keys(range: std::ops::Range<u64>) -> Vec<Vec<u8>> {
    range.map(|x| x.to_le_bytes().to_vec()).collect()
}

/// Printed before anything runs, so the operator sees it at the point of use.
fn notice() {
    println!("NOTICE: this program runs popsicle circuit PSI from Swanky, which its README calls research software,");
    println!("not for production or sensitive data. The two parties are threads of this one process,");
    println!("joined by an in-process socket pair. Data: synthetic keys made by this program; nothing is read");
    println!("from or written to disk, and results print to this terminal only. Limits: nine set sizes, 20 sessions each, about 15 s on the recorded host; a watchdog ends the process after 600 s.");
    println!("It deliberately drives upstream into panics, which it catches and counts.");
    println!("Unresolved: results are samples from one host and one target (x86_64); behaviour elsewhere is untested, and no result here establishes a security property of Swanky.");
    println!("It reproduces upstream behaviour at a pinned commit and establishes no security property.");
    println!("It creates no persistent state.");
}

fn main() {
    notice();
    let start = Instant::now();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(WATCHDOG_SECS));
        println!("no result after {:?}; exiting 124", start.elapsed());
        std::process::exit(124);
    });
    std::panic::set_hook(Box::new(|info| {
        let at = info.location().map(|l| format!("{}:{}", l.file(), l.line())).unwrap_or_default();
        let msg = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_default();
        let thread = std::thread::current().name().unwrap_or("unnamed").to_string();
        PANICS.lock().unwrap().push(format!("thread '{thread}' at {at}: {msg}"));
    }));
    let nb = 256u64;
    println!("|B| = {nb}; {TRIALS} sessions per |A|; expected cardinality 128 in every row");
    for na in [128u64, 256, 288, 320, 352, 384, 448, 512, 1024] {
        let a = keys(0..na);
        let b = keys(na - 128..na + 128);
        let (mut ok, mut wrong, mut err, mut panicked) = (0, 0, 0, 0);
        let mut example = None;
        let mut panic_tally: BTreeMap<String, usize> = BTreeMap::new();
        for _ in 0..TRIALS {
            PANICS.lock().unwrap().clear();
            match std::panic::catch_unwind(|| cardinality(&a, &b)) {
                Ok(Ok(128)) => ok += 1,
                Ok(Ok(other)) => {
                    wrong += 1;
                    example.get_or_insert(format!("wrong cardinality {other}"));
                }
                Ok(Err(e)) => {
                    err += 1;
                    example.get_or_insert(format!("error: {e}"));
                }
                Err(_) => {
                    panicked += 1;
                    *panic_tally.entry(PANICS.lock().unwrap().join(" | then ")).or_insert(0) += 1;
                }
            }
        }
        println!(
            "|A| = {na:>4}: correct {ok:>2}, wrong {wrong:>2}, error {err:>2}, panic {panicked:>2}{}",
            example.map(|e| format!("  first: {e}")).unwrap_or_default()
        );
        for (p, n) in &panic_tally {
            println!("        {n:>2} session(s) panicked: {p}");
        }
    }
}
