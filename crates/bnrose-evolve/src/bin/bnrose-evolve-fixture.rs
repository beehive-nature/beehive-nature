//! The battery's disposable service and its verifier probes. FIXTURE ONLY.
//!
//! The "service" is a counter whose configuration lives in the artifact under
//! test (`svc/service.cfg`, the file an agent may repair). Its seeded defect
//! is a real crash/restart defect, run in real processes: with
//! `ack=before_write` the service acknowledges a write before it is durable,
//! a crash then loses an acknowledged write, and the restarted service cannot
//! find it. The invariant it violates: an acknowledged write survives restart.
//!
//! Probes (the artifact is the working directory):
//!   restart     run the service in a child, crash it mid-stream, restart,
//!               exit 0 iff every acknowledged write survived
//!               (`--fault-injection`: the same, under a lying fsync)
//!   format      exit 0 iff service.cfg names only known keys with sane values
//!   canary      exit 0 iff the restart backoff is not a hot loop
//!   hang        sleep far past any ceiling (and write $BEVOLVE_MARK first)
//!   drift M     exit 1 while the file M exists (an environment regression)
//!   flap        exit 1 on the first run against this artifact path, 0 after
//!   mutate      write into the artifact, exit 0
//!   noisy       print more than the evidence cap, exit 0
//!   svc-run     (internal) the service itself
//!   drive-hang  (internal) open a controller on a state dir and run `hang`
//!               against the baseline — the crash-recovery test kills it

use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

fn cfg(dir: &Path) -> Result<BTreeMap<String, String>, String> {
    let text = std::fs::read_to_string(dir.join("svc/service.cfg"))
        .map_err(|e| format!("svc/service.cfg: {e}"))?;
    let mut m = BTreeMap::new();
    for line in text.lines().filter(|l| !l.is_empty()) {
        let (k, v) = line
            .split_once('=')
            .ok_or_else(|| format!("bad line {line:?}"))?;
        if m.insert(k.to_string(), v.to_string()).is_some() {
            return Err(format!("{k} twice"));
        }
    }
    Ok(m)
}

const WRITES: u32 = 6;
const CRASH_AFTER_ACK: u32 = 3;

/// The service: for each write, ack and persist in the configured order, and
/// die abruptly right after the CRASH_AFTER_ACK-th acknowledgement.
///
/// `lying_fsync` is the stronger verifier's storage fault injection: a sync
/// returns before the bytes are durable, and only every second write actually
/// reaches the data file. Ack-after-write is then no longer enough.
fn svc_run(artifact: &Path, state: &Path, lying_fsync: bool) -> i32 {
    let c = match cfg(artifact) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            return 2;
        }
    };
    let ack_first = c.get("ack").map(String::as_str) == Some("before_write");
    let acks = state.join("acks");
    let data = state.join("data");
    for i in 1..=WRITES {
        let persist = || {
            if lying_fsync && i % 2 == 1 {
                return; // "synced", and still only in a cache the crash takes
            }
            let mut f = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&data)
                .unwrap();
            writeln!(f, "{i}").unwrap();
            f.sync_all().unwrap();
        };
        let ack = || {
            let mut f = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&acks)
                .unwrap();
            writeln!(f, "{i}").unwrap();
            f.sync_all().unwrap();
        };
        if ack_first {
            ack();
            if i == CRASH_AFTER_ACK {
                std::process::exit(137); // crash: acknowledged, not yet written
            }
            persist();
        } else {
            persist();
            ack();
            if i == CRASH_AFTER_ACK {
                std::process::exit(137);
            }
        }
    }
    0
}

fn restart(artifact: &Path, fault_injection: bool) -> i32 {
    let state = std::env::temp_dir().join(format!(
        "bnrose-evolve-fixture-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&state).unwrap();
    let me = std::env::current_exe().unwrap();
    let st = Command::new(&me)
        .arg("svc-run")
        .arg(&state)
        .arg(if fault_injection {
            "lying-fsync"
        } else {
            "honest-fsync"
        })
        .current_dir(artifact)
        .status()
        .expect("spawn service");
    println!("service run 1 ended: {st}");
    // restart: what the durable state says
    let read = |p: PathBuf| -> Vec<String> {
        std::fs::read_to_string(p)
            .unwrap_or_default()
            .lines()
            .map(str::to_string)
            .collect()
    };
    let acked = read(state.join("acks"));
    let data = read(state.join("data"));
    let _ = std::fs::remove_dir_all(&state);
    let lost: Vec<&String> = acked.iter().filter(|a| !data.contains(a)).collect();
    if lost.is_empty() {
        println!("restart: {} acknowledged writes, all present", acked.len());
        0
    } else {
        println!("restart: acknowledged write(s) {lost:?} lost across restart");
        1
    }
}

fn format_check(artifact: &Path) -> i32 {
    match cfg(artifact) {
        Err(e) => {
            println!("format: {e}");
            1
        }
        Ok(c) => {
            for (k, v) in &c {
                let ok = match k.as_str() {
                    "ack" => v == "before_write" || v == "after_write",
                    "restart_backoff_ms" => v.parse::<u64>().is_ok(),
                    _ => false,
                };
                if !ok {
                    println!("format: {k}={v} refused");
                    return 1;
                }
            }
            println!("format: ok");
            0
        }
    }
}

fn canary(artifact: &Path) -> i32 {
    let backoff = cfg(artifact).ok().and_then(|c| {
        c.get("restart_backoff_ms")
            .and_then(|v| v.parse::<u64>().ok())
    });
    match backoff {
        Some(b) if b > 0 => {
            println!("canary: healthy (backoff {b} ms)");
            0
        }
        _ => {
            println!("canary: hot restart loop under load");
            1
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let here = std::env::current_dir().unwrap();
    let code = match args.get(1).map(String::as_str) {
        Some("restart") => restart(
            &here,
            args.get(2).map(String::as_str) == Some("--fault-injection"),
        ),
        Some("format") => format_check(&here),
        Some("canary") => canary(&here),
        Some("hang") => {
            if let Ok(m) = std::env::var("BEVOLVE_MARK") {
                std::fs::write(m, std::process::id().to_string()).unwrap();
            }
            std::thread::sleep(std::time::Duration::from_secs(120));
            0
        }
        Some("drift") => {
            // the environment drifted under the implementation: red while the
            // marker named by the pinned argument exists (outside the artifact)
            let marker = Path::new(&args[2]);
            if marker.exists() {
                println!("drift: environment marker present");
                1
            } else {
                println!("drift: clean");
                0
            }
        }
        Some("flap") => {
            // fails on its first run against this artifact path, passes after:
            // a flaky check. The counter lives outside the artifact.
            let key = here
                .to_string_lossy()
                .bytes()
                .fold(0xcbf2_9ce4_8422_2325u64, |h, b| {
                    (h ^ b as u64).wrapping_mul(0x0000_0100_0000_01b3)
                });
            let f = std::env::temp_dir().join(format!("bnrose-evolve-flap-{key:016x}"));
            let first = !f.exists();
            std::fs::write(&f, b"seen").unwrap();
            println!("flap: {}", if first { "red" } else { "green" });
            if first {
                1
            } else {
                0
            }
        }
        Some("mutate") => {
            std::fs::write(here.join("svc/scribble.txt"), b"the check wrote here").unwrap();
            0
        }
        Some("noisy") => {
            let chunk = vec![b'x'; 1 << 20];
            let mut out = std::io::stdout().lock();
            for _ in 0..9 {
                out.write_all(&chunk).unwrap();
            }
            0
        }
        Some("svc-run") => svc_run(&here, Path::new(&args[2]), args[3] == "lying-fsync"),
        Some("drive-hang") => drive_hang(&args[2..]),
        _ => {
            eprintln!("usage: bnrose-evolve-fixture <probe>");
            64
        }
    };
    std::process::exit(code);
}

/// drive-hang <state-dir> <engine> <trust-file> <baseline-dir>
fn drive_hang(a: &[String]) -> i32 {
    use bnrose_evolve::controller::{CheckCommand, Controller};
    let trust = bnrose_evolve::TrustRoot::parse(&std::fs::read_to_string(&a[2]).unwrap()).unwrap();
    let (mut c, _) = Controller::open(Path::new(&a[0]), &a[1], trust).unwrap();
    let me = std::env::current_exe().unwrap();
    let args = vec!["hang".to_string()];
    let r = c.run_baseline(
        &CheckCommand {
            id: "hang",
            program: &me,
            args: &args,
        },
        Path::new(&a[3]),
    );
    println!("drive-hang returned (it should have been killed first): {r:?}");
    0
}
