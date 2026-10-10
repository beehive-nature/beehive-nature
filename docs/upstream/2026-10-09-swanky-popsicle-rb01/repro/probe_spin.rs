//! Where a circuit-PSI session that has not completed is spending its time,
//! without a debugger: both parties' protocol RNGs (the `RNG` type
//! parameter) count their draws and record the call site of every 4096th
//! draw. After PROBE_SECS the probe prints, per party, the draw count and
//! the sampled call sites, then exits.
//!
//! Place at edge/popsicle/examples/probe_spin.rs and run:
//!   cargo run --release -p popsicle --example probe_spin -- garbler-repeat
//!   cargo run --release -p popsicle --example probe_spin -- evaluator-repeat4
//!
//! Set PROBE_RAW=1 to also print one full backtrace at the first sample.
//!
//! Synthetic data only.

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::{RngExt, SeedableRng, TryCryptoRng, TryRng};
use std::cell::Cell;
use std::collections::BTreeMap;
use std::convert::Infallible;
use std::sync::Mutex;
use std::time::Duration;
use swanky_block::Block;
use swanky_rng::SwankyRng;

const PROBE_SECS: u64 = 10;
const SAMPLE_EVERY: u64 = 4096;

static COUNTS: Mutex<BTreeMap<&'static str, u64>> = Mutex::new(BTreeMap::new());
static SITES: Mutex<BTreeMap<(&'static str, String), u64>> = Mutex::new(BTreeMap::new());

thread_local! {
    static PARTY: Cell<&'static str> = const { Cell::new("?") };
}

/// Innermost frames outside this file, rand, std and the RNG crates.
fn site() -> String {
    let bt = std::backtrace::Backtrace::force_capture().to_string();
    let mut frames = Vec::new();
    let mut lines = bt.lines().peekable();
    while let Some(line) = lines.next() {
        let t = line.trim_start();
        if !t.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            continue;
        }
        let Some((_, sym)) = t.split_once(": ") else { continue };
        let at = match lines.peek() {
            Some(l) if l.trim_start().starts_with("at ") => {
                let l = lines.next().unwrap().trim_start().trim_start_matches("at ").to_string();
                l.rsplit_once("/src/")
                    .map(|(p, rest)| format!("{}/src/{rest}", p.rsplit('/').next().unwrap_or("")))
                    .unwrap_or(l)
            }
            _ => String::new(),
        };
        // Drop a trailing generic-argument list, which repeats type names.
        let sym = match sym.rfind("::<") {
            Some(k) if sym.ends_with('>') => &sym[..k],
            _ => sym,
        };
        let skip = ["probe_spin::", "<probe_spin::", "rand::", "<rand::", "rand_core::", "<rand_core::", "std::", "<std", "core::", "<core", "alloc::", "<alloc", "swanky_rng::", "<swanky_rng", "swanky_block::", "<R as", "__rust"];
        if skip.iter().any(|s| sym.starts_with(s)) {
            continue;
        }
        frames.push(format!("{sym} ({at})"));
        if frames.len() == 2 {
            break;
        }
    }
    frames.join("\n        <- ")
}

struct ProbeRng {
    inner: SwankyRng,
    party: &'static str,
}

impl ProbeRng {
    fn tick(&self) {
        let n = {
            let mut c = COUNTS.lock().unwrap();
            let e = c.entry(self.party).or_insert(0);
            *e += 1;
            *e
        };
        if n % SAMPLE_EVERY == 0 {
            if n == SAMPLE_EVERY && std::env::var_os("PROBE_RAW").is_some() {
                println!("raw backtrace at {} draw {n}:
{}", self.party, std::backtrace::Backtrace::force_capture());
            }
            let s = site();
            *SITES.lock().unwrap().entry((self.party, s)).or_insert(0) += 1;
        }
    }
}

impl SeedableRng for ProbeRng {
    type Seed = <SwankyRng as SeedableRng>::Seed;
    fn from_seed(seed: Self::Seed) -> Self {
        ProbeRng { inner: SwankyRng::from_seed(seed), party: PARTY.with(|p| p.get()) }
    }
}

impl TryRng for ProbeRng {
    type Error = Infallible;
    fn try_next_u32(&mut self) -> Result<u32, Infallible> {
        self.tick();
        self.inner.try_next_u32()
    }
    fn try_next_u64(&mut self) -> Result<u64, Infallible> {
        self.tick();
        self.inner.try_next_u64()
    }
    fn try_fill_bytes(&mut self, dst: &mut [u8]) -> Result<(), Infallible> {
        self.tick();
        self.inner.try_fill_bytes(dst)
    }
}

impl TryCryptoRng for ProbeRng {}

/// Printed before anything runs, so the operator sees it at the point of use.
fn notice() {
    println!("NOTICE: this program runs popsicle circuit PSI from Swanky, which its README calls research software,");
    println!("not for production or sensitive data. The two parties are threads of this one process,");
    println!("joined by an in-process socket pair. Data: synthetic keys made by this program; nothing is read");
    println!("from or written to disk, and results print to this terminal only. Limits: one case per run; the process ends after 10 s and keeps one CPU core busy until then.");
    println!("It deliberately drives upstream into sessions that do not complete.");
    println!("Unresolved: results are samples from one host and one target (x86_64); behaviour elsewhere is untested, and no result here establishes a security property of Swanky.");
    println!("It reproduces upstream behaviour at a pinned commit and establishes no security property.");
    println!("It creates no persistent state.");
}

fn main() {
    notice();
    let case = std::env::args().nth(1).unwrap_or_default();
    let (x, y) = (7u64.to_le_bytes().to_vec(), 9u64.to_le_bytes().to_vec());
    let (a, b) = match case.as_str() {
        "garbler-repeat" => (vec![x.clone(), x.clone(), y], vec![x]),
        "evaluator-repeat4" => (vec![x.clone()], vec![x.clone(), x.clone(), x.clone(), x, y]),
        _ => {
            eprintln!("usage: probe_spin garbler-repeat|evaluator-repeat4");
            std::process::exit(2);
        }
    };
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(PROBE_SECS));
        println!("{case}: no result after {PROBE_SECS} s");
        for (party, n) in COUNTS.lock().unwrap().iter() {
            println!("  {party}: {n} RNG draws");
        }
        for ((party, s), n) in SITES.lock().unwrap().iter() {
            println!("  {party}: {n} samples at\n        {s}");
        }
        std::process::exit(124);
    });
    let r = swanky_channel::local::local_channel_pair(
        |ch| {
            PARTY.with(|p| p.set("garbler"));
            let mut gb = OpprfPsiGarbler::<ProbeRng>::new(ch, Block::from(SwankyRng::new().random::<u128>()))?;
            let r = gb.intersect(&a, ch)?;
            let c = fancy_cardinality(&mut gb.gb, &r.intersection.existence_bit_vector, ch)?;
            gb.gb.outputs(c.wires(), ch)?;
            Ok(())
        },
        |ch| {
            PARTY.with(|p| p.set("evaluator"));
            let mut ev = OpprfPsiEvaluator::<ProbeRng>::new(ch, Block::from(SwankyRng::new().random::<u128>()))?;
            let r = ev.intersect(&b, ch)?;
            let c = fancy_cardinality(&mut ev.ev, &r.intersection.existence_bit_vector, ch)?;
            let out = ev.ev.outputs(c.wires(), ch)?.expect("evaluator receives the output");
            Ok(binary_to_u128(out))
        },
    );
    println!("finished: {:?}", r.map(|(_, c)| c));
}
