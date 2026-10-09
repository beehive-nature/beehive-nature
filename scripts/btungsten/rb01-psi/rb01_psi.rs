//! RB01 provider: Swanky popsicle circuit-PSI cardinality, instrumented.
//!
//! This file is not part of the beehive-nature workspace. The bench
//! orchestrator (`crates/btungsten-bench`, `rbench rb01`) copies it into a
//! build copy of GaloisInc/swanky at the pinned revision as
//! `edge/popsicle/examples/rb01_psi.rs` and builds it with Swanky's own
//! toolchain file, lockfile and native CPU flags:
//!
//!   cargo build --locked --release -p popsicle --example rb01_psi
//!
//! The protocol calls are the ones in upstream
//! `edge/popsicle/examples/circuit_psi_cardinality.rs`: `OpprfPsiGarbler` /
//! `OpprfPsiEvaluator` (PSTY19 circuit PSI over a KMPRT OPPRF, semi-honest
//! two-party garbling over `WireMod2`, ALSZ OT extension whose default base
//! OT is Chou-Orlandi over Ristretto), then `fancy_cardinality` and an output
//! reveal that only the evaluator receives.
//!
//! Modes:
//!
//!   startup                       print one line and exit (process startup)
//!   local --a FILE --b FILE       the upstream composition: two threads in
//!                                 one process over a Unix socket pair; the
//!                                 garbler holds A, the evaluator holds B
//!   garbler --listen ADDR --ready-file PATH --input FILE --session HEX
//!   evaluator --connect ADDR --input FILE --session HEX
//!                                 one role per process over TCP, after a
//!                                 session handshake (magic, version, role,
//!                                 parameter digest, session id)
//!   probe-length-ambiguity        A = {[0x01]}, B = {[0x01, 0x00]} through
//!                                 the local composition with no width check
//!
//! Common options: `--element-bytes 8|16` (default 8), `--io-timeout-ms N`
//! (default 30000); probe switches `--allow-empty`, `--allow-duplicates`
//! bypass the input policy so the upstream behaviour can be observed.
//!
//! Input files are fixed-width elements, concatenated. Policy, enforced
//! before any byte reaches the network: the length must be a whole number of
//! elements, the set must be non-empty, and no element may repeat.
//!
//! Output, one line on stdout, then the exit code:
//!   RB01-RESULT {json}    exit 0
//!   RB01-REFUSAL {json}   exit 3   (input or handshake refused, no protocol run)
//!   RB01-ABORT {json}     exit 4   (protocol started and failed)
//!   usage errors          exit 2
//!
//! Session randomness: each role seeds its protocol RNG with
//! `SwankyRng::new()` (operating-system entropy through `rand::random`), as
//! the upstream example does; no seed is printed, stored or accepted.

use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::net::UnixStream;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use fancy_traits::FancyOutput;
use popsicle::circuit_psi::{
    CircuitPsi, circuits::*, evaluator::OpprfPsiEvaluator, garbler::OpprfPsiGarbler, utils::*,
};
use rand::RngExt;
use serde_json::json;
use sha2::{Digest, Sha256};
use swanky_block::Block;
use swanky_channel::Channel;
use swanky_rng::SwankyRng;

const MAGIC: &[u8; 8] = b"RB01PSI\x00";
const VERSION: u8 = 1;
const ROLE_GARBLER: u8 = 1;
const ROLE_EVALUATOR: u8 = 2;
const FRAME_LEN: usize = 8 + 1 + 1 + 32 + 16;
/// The protocol configuration both roles must agree on, hashed with the
/// element width into the handshake's parameter digest.
const CONFIG: &str = "rb01/popsicle-circuit-psi/OpprfPsiGarbler+OpprfPsiEvaluator/semi-honest/WireMod2/alsz+chou-orlandi/fancy_cardinality/output=evaluator";
const MAX_ELEMENTS: usize = 1 << 20;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match args.first().map(String::as_str) {
        Some("startup") => {
            println!("RB01-STARTUP");
            0
        }
        Some("local") => local(&Opts::parse(&args[1..])),
        Some("garbler") => tcp_role(&Opts::parse(&args[1..]), ROLE_GARBLER),
        Some("evaluator") => tcp_role(&Opts::parse(&args[1..]), ROLE_EVALUATOR),
        Some("probe-length-ambiguity") => probe_length_ambiguity(),
        _ => usage("expected startup | local | garbler | evaluator | probe-length-ambiguity"),
    };
    std::process::exit(code);
}

fn usage(why: &str) -> i32 {
    eprintln!("rb01_psi: {why}");
    2
}

#[derive(Default)]
struct Opts {
    a: Option<String>,
    b: Option<String>,
    input: Option<String>,
    listen: Option<String>,
    connect: Option<String>,
    ready_file: Option<String>,
    session: Option<String>,
    element_bytes: usize,
    io_timeout: Duration,
    allow_empty: bool,
    allow_duplicates: bool,
}

impl Opts {
    fn parse(args: &[String]) -> Opts {
        let mut o = Opts { element_bytes: 8, io_timeout: Duration::from_millis(30_000), ..Opts::default() };
        let mut i = 0;
        while i < args.len() {
            let val = || args.get(i + 1).cloned().unwrap_or_else(|| exit_usage(&format!("{} needs a value", args[i])));
            match args[i].as_str() {
                "--a" => o.a = Some(val()),
                "--b" => o.b = Some(val()),
                "--input" => o.input = Some(val()),
                "--listen" => o.listen = Some(val()),
                "--connect" => o.connect = Some(val()),
                "--ready-file" => o.ready_file = Some(val()),
                "--session" => o.session = Some(val()),
                "--element-bytes" => o.element_bytes = val().parse().unwrap_or_else(|_| exit_usage("--element-bytes")),
                "--io-timeout-ms" => {
                    let ms: u64 = val().parse().unwrap_or_else(|_| exit_usage("--io-timeout-ms"));
                    // zero would disable the socket timeout altogether
                    if ms == 0 {
                        exit_usage("--io-timeout-ms must be positive");
                    }
                    o.io_timeout = Duration::from_millis(ms)
                }
                "--allow-empty" => {
                    o.allow_empty = true;
                    i += 1;
                    continue;
                }
                "--allow-duplicates" => {
                    o.allow_duplicates = true;
                    i += 1;
                    continue;
                }
                other => exit_usage(&format!("unknown option {other}")),
            }
            i += 2;
        }
        if o.element_bytes != 8 && o.element_bytes != 16 {
            exit_usage("--element-bytes must be 8 or 16");
        }
        o
    }
}

fn exit_usage(why: &str) -> ! {
    std::process::exit(usage(why))
}

fn refuse(code: &str, detail: String) -> i32 {
    println!("RB01-REFUSAL {}", json!({ "code": code, "detail": detail }));
    3
}

/// Read and check one role's input under the bench policy.
fn load_set(path: &str, o: &Opts) -> Result<Vec<Vec<u8>>, (&'static str, String)> {
    let bytes = std::fs::read(path).map_err(|e| ("input-unreadable", format!("{path}: {e}")))?;
    if bytes.len() % o.element_bytes != 0 {
        return Err((
            "input-truncated",
            format!("{} bytes is not a whole number of {}-byte elements", bytes.len(), o.element_bytes),
        ));
    }
    let set: Vec<Vec<u8>> = bytes.chunks(o.element_bytes).map(<[u8]>::to_vec).collect();
    if set.is_empty() && !o.allow_empty {
        return Err(("input-empty", "the set has no elements".into()));
    }
    if set.len() > MAX_ELEMENTS {
        return Err(("input-too-large", format!("{} elements exceeds the bound {MAX_ELEMENTS}", set.len())));
    }
    if !o.allow_duplicates {
        let mut seen = HashSet::with_capacity(set.len());
        for (i, e) in set.iter().enumerate() {
            if !seen.insert(e.as_slice()) {
                return Err(("input-duplicate", format!("element {i} repeats an earlier element")));
            }
        }
    }
    Ok(set)
}

/// A byte-counting wrapper around the connection a `Channel` takes over: the
/// counts are application bytes handed to and taken from the socket.
struct Counted<S> {
    inner: S,
    sent: Arc<AtomicU64>,
    received: Arc<AtomicU64>,
    timed_out: Arc<AtomicBool>,
}

#[derive(Clone, Default)]
struct Counters {
    sent: Arc<AtomicU64>,
    received: Arc<AtomicU64>,
    timed_out: Arc<AtomicBool>,
}

impl Counters {
    fn wrap<S>(&self, inner: S) -> Counted<S> {
        Counted { inner, sent: self.sent.clone(), received: self.received.clone(), timed_out: self.timed_out.clone() }
    }
    fn json(&self) -> serde_json::Value {
        json!({ "sent": self.sent.load(Ordering::SeqCst), "received": self.received.load(Ordering::SeqCst) })
    }
}

impl<S> Counted<S> {
    fn note(&self, e: &std::io::Error) {
        if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) {
            self.timed_out.store(true, Ordering::SeqCst);
        }
    }
}

impl<S: Read> Read for Counted<S> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        match self.inner.read(buf) {
            Ok(n) => {
                self.received.fetch_add(n as u64, Ordering::SeqCst);
                Ok(n)
            }
            Err(e) => {
                self.note(&e);
                Err(e)
            }
        }
    }
}

impl<S: Write> Write for Counted<S> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        match self.inner.write(buf) {
            Ok(n) => {
                self.sent.fetch_add(n as u64, Ordering::SeqCst);
                Ok(n)
            }
            Err(e) => {
                self.note(&e);
                Err(e)
            }
        }
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Elapsed nanoseconds per protocol phase, as seen by one role. Every phase
/// includes the time that role spent waiting on its peer.
#[derive(Default)]
struct Phases {
    setup: u128,
    intersect: u128,
    cardinality: u128,
    reveal: u128,
}

impl Phases {
    fn json(&self) -> serde_json::Value {
        json!({
            "setup_ns": self.setup as u64,
            "intersect_ns": self.intersect as u64,
            "cardinality_ns": self.cardinality as u64,
            "reveal_ns": self.reveal as u64,
        })
    }
}

/// The garbler side of upstream `psty_cardinality`, with phase timers.
fn garble(channel: &mut Channel, set: &[Vec<u8>], t: &mut Phases) -> swanky_error::Result<Option<u128>> {
    let t0 = Instant::now();
    let mut rng = SwankyRng::new();
    let mut gb_psi = OpprfPsiGarbler::<SwankyRng>::new(channel, Block::from(rng.random::<u128>()))?;
    t.setup = t0.elapsed().as_nanos();
    let t1 = Instant::now();
    let intersection_results = gb_psi.intersect(set, channel)?;
    t.intersect = t1.elapsed().as_nanos();
    let t2 = Instant::now();
    let res = fancy_cardinality(&mut gb_psi.gb, &intersection_results.intersection.existence_bit_vector, channel)?;
    t.cardinality = t2.elapsed().as_nanos();
    let t3 = Instant::now();
    let out = gb_psi.gb.outputs(res.wires(), channel)?;
    t.reveal = t3.elapsed().as_nanos();
    Ok(out.map(binary_to_u128))
}

/// The evaluator side of upstream `psty_cardinality`, with phase timers.
fn evaluate(channel: &mut Channel, set: &[Vec<u8>], t: &mut Phases) -> swanky_error::Result<Option<u128>> {
    let t0 = Instant::now();
    let mut rng = SwankyRng::new();
    let mut ev_psi = OpprfPsiEvaluator::<SwankyRng>::new(channel, Block::from(rng.random::<u128>()))?;
    t.setup = t0.elapsed().as_nanos();
    let t1 = Instant::now();
    let intersection_results = ev_psi.intersect(set, channel)?;
    t.intersect = t1.elapsed().as_nanos();
    let t2 = Instant::now();
    let res = fancy_cardinality(&mut ev_psi.ev, &intersection_results.intersection.existence_bit_vector, channel)?;
    t.cardinality = t2.elapsed().as_nanos();
    let t3 = Instant::now();
    let out = ev_psi.ev.outputs(res.wires(), channel)?;
    t.reveal = t3.elapsed().as_nanos();
    Ok(out.map(binary_to_u128))
}

fn local(o: &Opts) -> i32 {
    let (Some(pa), Some(pb)) = (&o.a, &o.b) else { return usage("local needs --a and --b") };
    let a = match load_set(pa, o) {
        Ok(s) => s,
        Err((c, d)) => return refuse(c, format!("A: {d}")),
    };
    let b = match load_set(pb, o) {
        Ok(s) => s,
        Err((c, d)) => return refuse(c, format!("B: {d}")),
    };
    run_local(&a, &b, "local-threads")
}

/// Two threads in one process over a Unix socket pair, the shape of
/// `swanky_channel::local::local_channel_pair`, with counters on both ends.
fn run_local(a: &[Vec<u8>], b: &[Vec<u8>], mode: &str) -> i32 {
    let (sa, sb) = match UnixStream::pair() {
        Ok(p) => p,
        Err(e) => return abort("socketpair", &e.to_string(), &Counters::default(), false),
    };
    let ca = Counters::default();
    let cb = Counters::default();
    let t0 = Instant::now();
    let (ga, gb) = (ca.clone(), cb.clone());
    let (a, b) = (a.to_vec(), b.to_vec());
    let hg = std::thread::spawn(move || {
        let mut t = Phases::default();
        let r = Channel::with(ga.wrap(sa), |ch| garble(ch, &a, &mut t));
        (r, t)
    });
    let he = std::thread::spawn(move || {
        let mut t = Phases::default();
        let r = Channel::with(gb.wrap(sb), |ch| evaluate(ch, &b, &mut t));
        (r, t)
    });
    let (rg, tg) = match hg.join() {
        Ok(x) => x,
        Err(_) => return abort("garbler-thread", "panicked", &ca, false),
    };
    let (re, te) = match he.join() {
        Ok(x) => x,
        Err(_) => return abort("evaluator-thread", "panicked", &cb, false),
    };
    let total = t0.elapsed().as_nanos() as u64;
    match (rg, re) {
        (Ok(out_g), Ok(out_e)) => {
            println!(
                "RB01-RESULT {}",
                json!({
                    "mode": mode,
                    "config": CONFIG,
                    "garbler": { "output": out_g.map(|v| v.to_string()), "phases": tg.json(), "bytes": ca.json() },
                    "evaluator": { "output": out_e.map(|v| v.to_string()), "phases": te.json(), "bytes": cb.json() },
                    "total_ns": total,
                })
            );
            0
        }
        (rg, re) => {
            let why = format!(
                "garbler: {} | evaluator: {}",
                rg.err().map_or("ok".into(), |e| format!("{e:?}")),
                re.err().map_or("ok".into(), |e| format!("{e:?}"))
            );
            abort("protocol", &why, &cb, cb.timed_out.load(Ordering::SeqCst) || ca.timed_out.load(Ordering::SeqCst))
        }
    }
}

fn abort(stage: &str, error: &str, c: &Counters, io_timeout: bool) -> i32 {
    println!(
        "RB01-ABORT {}",
        json!({ "stage": stage, "error": error, "io_timeout": io_timeout, "bytes": c.json() })
    );
    4
}

fn param_digest(element_bytes: usize) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(CONFIG.as_bytes());
    h.update([0u8]);
    h.update((element_bytes as u64).to_le_bytes());
    h.finalize().into()
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn parse_session(s: &str) -> Option<[u8; 16]> {
    // ASCII hex only: byte slicing below must stay on character boundaries,
    // and from_str_radix alone would accept a leading "+"
    if s.len() != 32 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let mut out = [0u8; 16];
    for (i, o) in out.iter_mut().enumerate() {
        *o = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).ok()?;
    }
    Some(out)
}

fn frame(role: u8, params: &[u8; 32], session: &[u8; 16]) -> [u8; FRAME_LEN] {
    let mut f = [0u8; FRAME_LEN];
    f[..8].copy_from_slice(MAGIC);
    f[8] = VERSION;
    f[9] = role;
    f[10..42].copy_from_slice(params);
    f[42..58].copy_from_slice(session);
    f
}

/// Check the peer's handshake frame against ours; `Err` is a refusal code.
fn check_frame(peer: &[u8; FRAME_LEN], role: u8, params: &[u8; 32], session: &[u8; 16]) -> Result<(), (&'static str, String)> {
    if &peer[..8] != MAGIC {
        return Err(("handshake-malformed", format!("bad magic {}", hex(&peer[..8]))));
    }
    if peer[8] != VERSION {
        return Err(("handshake-version", format!("peer version {} != {VERSION}", peer[8])));
    }
    let want = if role == ROLE_GARBLER { ROLE_EVALUATOR } else { ROLE_GARBLER };
    if peer[9] != want {
        return Err(("handshake-role", format!("peer role {} != {want}", peer[9])));
    }
    if &peer[10..42] != params {
        return Err(("handshake-params", "peer parameter digest differs".into()));
    }
    if &peer[42..58] != session {
        return Err(("handshake-session", "peer session id differs".into()));
    }
    Ok(())
}

fn tcp_role(o: &Opts, role: u8) -> i32 {
    let name = if role == ROLE_GARBLER { "garbler" } else { "evaluator" };
    let Some(input) = &o.input else { return usage("--input is required") };
    let Some(session) = o.session.as_deref().and_then(parse_session) else {
        return usage("--session must be 32 hex characters");
    };
    // The input is checked before any connection is made.
    let set = match load_set(input, o) {
        Ok(s) => s,
        Err((c, d)) => return refuse(c, d),
    };
    let stream = if role == ROLE_GARBLER {
        let (Some(addr), Some(ready)) = (&o.listen, &o.ready_file) else {
            return usage("garbler needs --listen and --ready-file");
        };
        let listener = match TcpListener::bind(addr) {
            Ok(l) => l,
            Err(e) => return abort("listen", &e.to_string(), &Counters::default(), false),
        };
        let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
        let tmp = format!("{ready}.tmp");
        if std::fs::write(&tmp, port.to_string()).and_then(|()| std::fs::rename(&tmp, ready)).is_err() {
            return abort("ready-file", "cannot write the ready file", &Counters::default(), false);
        }
        match listener.accept() {
            Ok((s, _)) => s,
            Err(e) => return abort("accept", &e.to_string(), &Counters::default(), false),
        }
    } else {
        let Some(addr) = &o.connect else { return usage("evaluator needs --connect") };
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            match TcpStream::connect(addr) {
                Ok(s) => break s,
                Err(e) if Instant::now() >= deadline => {
                    return abort("connect", &e.to_string(), &Counters::default(), false);
                }
                Err(_) => std::thread::sleep(Duration::from_millis(5)),
            }
        }
    };
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(o.io_timeout));
    let _ = stream.set_write_timeout(Some(o.io_timeout));
    let c = Counters::default();
    let mut s = c.wrap(stream);

    let t0 = Instant::now();
    let params = param_digest(o.element_bytes);
    if let Err(e) = s.write_all(&frame(role, &params, &session)).and_then(|()| s.flush()) {
        return abort("handshake-send", &e.to_string(), &c, c.timed_out.load(Ordering::SeqCst));
    }
    let mut peer = [0u8; FRAME_LEN];
    if let Err(e) = s.read_exact(&mut peer) {
        // A peer that closes or stalls before a full frame is not a refusal
        // of a frame: no frame was received.
        return abort("handshake-recv", &e.to_string(), &c, c.timed_out.load(Ordering::SeqCst));
    }
    if let Err((code, detail)) = check_frame(&peer, role, &params, &session) {
        return refuse(code, detail);
    }
    let handshake_ns = t0.elapsed().as_nanos() as u64;

    let mut t = Phases::default();
    let r = if role == ROLE_GARBLER {
        Channel::with(s, |ch| garble(ch, &set, &mut t))
    } else {
        Channel::with(s, |ch| evaluate(ch, &set, &mut t))
    };
    let total = t0.elapsed().as_nanos() as u64;
    match r {
        Ok(out) => {
            println!(
                "RB01-RESULT {}",
                json!({
                    "mode": "tcp-process",
                    "role": name,
                    "config": CONFIG,
                    "session": hex(&session),
                    "n_input": set.len(),
                    "output": out.map(|v| v.to_string()),
                    "handshake_ns": handshake_ns,
                    "phases": t.json(),
                    "bytes": c.json(),
                    "total_ns": total,
                })
            );
            0
        }
        Err(e) => abort("protocol", &format!("{e:?}"), &c, c.timed_out.load(Ordering::SeqCst)),
    }
}

/// Upstream maps any element of at most 16 bytes into a block by zero
/// padding (`popsicle::utils::compress_and_hash_inputs`), so `[0x01]` and
/// `[0x01, 0x00]` become the same block. This probe runs that pair through
/// the local composition and reports what the protocol says.
fn probe_length_ambiguity() -> i32 {
    let a = vec![vec![0x01u8]];
    let b = vec![vec![0x01u8, 0x00u8]];
    run_local(&a, &b, "probe-length-ambiguity")
}
