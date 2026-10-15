//! Recovery keeps responsibility: a hard-killed controller's attempt is
//! rescued as evidence before anything new happens, charged at its full
//! reservation (never zero), never re-run, and its orphaned process is named
//! as owed cleanup. The journal fails closed on tampering. One holder at a time.

use super::common::*;

use std::process::Command;
use std::time::{Duration, Instant};

use adapter_store::{open_named, Edit, EmbeddedStore};
use bnrose_evolve::journal::{Journal, Record};
use bnrose_evolve::{Controller, Digest32};

fn kill_pid(pid: &str) {
    #[cfg(unix)]
    let _ = Command::new("kill").args(["-9", pid]).status();
    #[cfg(windows)]
    let _ = Command::new("taskkill").args(["/F", "/PID", pid]).status();
}

fn records(w: &World) -> Vec<Record> {
    let store = open_named(w.engine, &w.state.join("store")).unwrap();
    Journal::open(store).unwrap().1
}

#[test]
fn a_killed_controller_is_rescued_never_rerun_never_zeroed() {
    for engine in engines() {
        killed_controller(engine);
    }
}

fn killed_controller(engine: &'static str) {
    let w = World::new(&format!("crash-{engine}"), engine);
    {
        let (mut c, _) = w.open();
        w.adopt(
            &mut c,
            &Knobs {
                attempt_ceiling: 60_000,
                extra: vec![("hang".into(), args(&["hang"]))],
                ..Knobs::default()
            },
        );
    }
    let trust = w.root.join("trust.txt");
    std::fs::write(
        &trust,
        w.sovereign.trust_line("sovereign") + &w.agent.trust_line("agent"),
    )
    .unwrap();
    let mark = w.root.join("worker.pid");
    let mut driver = Command::new(fixture())
        .arg("drive-hang")
        .arg(&w.state)
        .arg(engine)
        .arg(&trust)
        .arg(&w.base)
        .env("BEVOLVE_MARK", &mark)
        .spawn()
        .unwrap();
    let t0 = Instant::now();
    while !mark.exists() {
        assert!(
            t0.elapsed() < Duration::from_secs(60),
            "{engine}: worker never started"
        );
        std::thread::sleep(Duration::from_millis(20));
    }
    std::thread::sleep(Duration::from_millis(100)); // the pid file is fully written
    let worker_pid = std::fs::read_to_string(&mark).unwrap();
    driver.kill().unwrap(); // the controller dies mid-attempt; its worker lives on
    driver.wait().unwrap();

    // the dead holder's claim is still on disk: opening is refused until the
    // explicit adoption gesture
    let e = Controller::open(&w.state, engine, w.trust()).err().unwrap();
    assert_eq!(e.code(), "state:already-claimed");
    let (c, rep) = Controller::open_adopting_stale_claim(&w.state, engine, w.trust()).unwrap();
    assert_eq!(rep.unresolved.len(), 1, "{engine}: {rep:?}");
    let attempt = rep.unresolved[0];
    assert_eq!(rep.owed_cleanup.len(), 1);
    assert!(
        rep.owed_cleanup[0].contains(&format!("pid {}", worker_pid.trim()))
            || rep.owed_cleanup[0].contains("pid "),
        "{:?}",
        rep.owed_cleanup
    );
    assert_eq!(
        rep.exposure, 60_000,
        "{engine}: charged at the full reservation"
    );
    assert_eq!(c.unresolved_liabilities(), vec![(attempt, 60_000)]);
    assert!(c.execs().is_empty(), "no result was invented");
    kill_pid(worker_pid.trim()); // the test cleans up what the controller refused to signal

    // the rescue record precedes the settlement it explains
    let head_after = c.head();
    drop(c);
    let recs = records(&w);
    let rescue = recs
        .iter()
        .position(
            |r| matches!(r, Record::Rescue { unresolved, .. } if unresolved == &vec![attempt]),
        )
        .expect("rescue record");
    let settled = recs
        .iter()
        .position(|r| matches!(r, Record::Settled { attempt: a, usage, .. } if *a == attempt && usage.known().is_none()))
        .expect("unknown settlement");
    assert!(rescue < settled);
    // spawned pid and dispatch were durable before the crash
    assert!(recs
        .iter()
        .any(|r| matches!(r, Record::Spawned { attempt: a, .. } if *a == attempt)));

    // a second open finds nothing new to rescue and writes nothing
    let (mut c, rep2) = w.open();
    assert!(rep2.unresolved.is_empty(), "{engine}: idempotent");
    assert_eq!(c.head(), head_after);

    // later evidence of the real cost reconciles the liability, once
    c.reconcile_unknown(&attempt, 1_234, "worker accounting recovered")
        .unwrap();
    assert_eq!(c.exposure(), 1_234);
    assert!(c.unresolved_liabilities().is_empty());
    assert_eq!(
        c.reconcile_unknown(&attempt, 1, "again")
            .unwrap_err()
            .code(),
        "unknown"
    );
}

#[test]
fn the_state_matrix_settles_by_evidence() {
    let w = World::new("matrix", "sqlite");
    {
        let (mut c, _) = w.open();
        w.adopt(&mut c, &Knobs::default());
    }
    let a = bnrose_evolve::digest::hash("t", &[b"never dispatched"]);
    let b = bnrose_evolve::digest::hash("t", &[b"dispatched, spawn unrecorded"]);
    let x = bnrose_evolve::digest::hash("t", &[b"exited, result lost"]);
    {
        let store = open_named("sqlite", &w.state.join("store")).unwrap();
        let (mut j, _) = Journal::open(store).unwrap();
        for (id, amount) in [(a, 10), (b, 20), (x, 40)] {
            j.append(&Record::Reserved {
                attempt: id,
                subject: None,
                check: "restart".into(),
                amount,
            })
            .unwrap();
        }
        j.append(&Record::Dispatched { attempt: b }).unwrap();
        j.append(&Record::Dispatched { attempt: x }).unwrap();
        j.append(&Record::Spawned {
            attempt: x,
            pid: 4242,
        })
        .unwrap();
        j.append(&Record::WorkerExited {
            attempt: x,
            code: Some(0),
            killed: false,
        })
        .unwrap();
    }
    let (c, rep) = w.open();
    assert_eq!(rep.never_dispatched, vec![a]);
    assert_eq!(rep.unresolved, vec![b, x]);
    assert_eq!(
        rep.owed_cleanup.len(),
        1,
        "an exited worker owes no cleanup"
    );
    assert!(rep.owed_cleanup[0].contains("no process is known"));
    assert_eq!(
        c.exposure(),
        20 + 40,
        "never-dispatched is a known zero; the rest are charged"
    );
    assert_eq!(c.unresolved_liabilities(), vec![(b, 20), (x, 40)]);
}

#[test]
fn the_journal_fails_closed_on_tampering() {
    for engine in engines() {
        tamper(engine);
    }
}

fn tamper(engine: &'static str) {
    let w = World::new(&format!("tamper-{engine}"), engine);
    {
        let (mut c, _) = w.open();
        w.adopt(&mut c, &Knobs::default());
        c.observe("one", b"1").unwrap();
        c.observe("two", b"2").unwrap();
    }
    let rows = {
        let s = open_named(engine, &w.state.join("store")).unwrap();
        s.scan_prefix(b"j/").unwrap()
    };
    assert_eq!(rows.len(), 3);
    let head = {
        let s = open_named(engine, &w.state.join("store")).unwrap();
        s.get(b"h").unwrap().unwrap()
    };
    let with = |edits: Vec<Edit>| {
        let s: Box<dyn EmbeddedStore> = open_named(engine, &w.state.join("store")).unwrap();
        s.write_batch(&edits).unwrap();
    };
    let restore = || {
        let mut e: Vec<Edit> = rows
            .iter()
            .map(|(k, v)| Edit::Put(k.clone(), v.clone()))
            .collect();
        e.push(Edit::Put(b"h".to_vec(), head.clone()));
        with(e);
    };
    let refused = |what: &str| {
        let e = Controller::open(&w.state, engine, w.trust()).err();
        assert_eq!(
            e.as_ref().map(|e| e.code()),
            Some("tampered"),
            "{engine}: {what}: {e:?}"
        );
    };

    // one flipped byte in the middle record
    let mut v = rows[1].1.clone();
    v[5] ^= 0x01;
    with(vec![Edit::Put(rows[1].0.clone(), v)]);
    refused("flipped byte");
    restore();

    // the last record removed, head kept
    with(vec![Edit::Delete(rows[2].0.clone())]);
    refused("truncated");
    restore();

    // the head removed
    with(vec![Edit::Delete(b"h".to_vec())]);
    refused("head removed");
    restore();

    // two records swapped
    with(vec![
        Edit::Put(rows[1].0.clone(), rows[2].1.clone()),
        Edit::Put(rows[2].0.clone(), rows[1].1.clone()),
    ]);
    refused("reordered");
    restore();

    // restored bytes open cleanly: the refusals were about the edits
    let (c, rep) = w.open();
    assert_eq!(rep.records, 3);
    drop(c);
}

#[test]
fn one_holder_at_a_time() {
    let w = World::new("claim", "sqlite");
    let (c, _) = w.open();
    let e = Controller::open(&w.state, "sqlite", w.trust())
        .err()
        .unwrap();
    assert_eq!(e.code(), "state:already-claimed");
    drop(c);
    let (_c, _) = w.open();
}

#[test]
fn a_tampered_blob_is_refused_on_read() {
    let w = World::new("blob", "sqlite");
    let ev = {
        let (mut c, _) = w.open();
        w.adopt(&mut c, &Knobs::default());
        let id = c.observe("fault", b"the raw bytes").unwrap();
        drop(c);
        let recs = records(&w);
        recs.iter()
            .find_map(|r| match r {
                Record::Observation {
                    id: i, evidence, ..
                } if *i == id => Some(*evidence),
                _ => None,
            })
            .unwrap()
    };
    let (c, _) = w.open();
    assert_eq!(c.blob(&ev).unwrap().unwrap(), b"the raw bytes");
    drop(c);
    {
        let s = open_named("sqlite", &w.state.join("store")).unwrap();
        let mut k = b"b/".to_vec();
        k.extend_from_slice(&ev.0);
        s.write_batch(&[Edit::Put(k, b"other bytes".to_vec())])
            .unwrap();
    }
    let (c, _) = w.open();
    assert_eq!(c.blob(&ev).unwrap_err().code(), "tampered");
    assert_eq!(c.blob(&Digest32::ZERO).unwrap(), None);
}
