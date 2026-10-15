//! BNROSE-NETPART layer 2 (founder review of #444): FOUR independent
//! executable processes per scenario — hosts (`bnrose-host`), the proxy
//! (`bnrose-proxy`, the network middlebox the tests partition by killing
//! or by rules), and the destination (`bnrose-dest`). The corrections
//! demanded by the review are each convicted here:
//!
//! - CHECKED durable writes: a forced log failure answers
//!   `storage-error` and the acceptance is NOT recorded or acknowledged.
//! - CONFLICTING REPLAY refused: the same transaction id with different
//!   bytes is `conflict`, never `duplicate`.
//! - PERSISTED-BYTES recovery: the host's rebroadcast loads the journal's
//!   original bytes; an intent that disagrees is refused.
//! - SAME-LOG RESTART: the destination process is killed and restarted
//!   on the SAME durable log; idempotency and states replay.

use serde_json::Value;
use std::process::{Child, Command, Stdio};

fn tmp(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-l2-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

struct Proc(Child);
impl Drop for Proc {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Spawn the destination on its OWN directory (never wiped by this
/// helper — same-log restarts reuse the same dir).
fn dest_at(dir: &std::path::Path) -> (Proc, std::net::SocketAddr) {
    std::fs::create_dir_all(dir).unwrap();
    let log = dir.join("dest.log");
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest"))
        .arg(&log)
        .arg("0")
        .stdout(Stdio::piped())
        .spawn()
        .expect("dest");
    let addr = addr_of(&mut child);
    (Proc(child), addr)
}

fn addr_of(child: &mut Child) -> std::net::SocketAddr {
    use std::io::BufRead;
    let mut line = String::new();
    let stdout = child.stdout.as_mut().expect("piped");
    {
        let mut reader = std::io::BufReader::new(stdout);
        reader.read_line(&mut line).expect("port");
    }
    format!("127.0.0.1:{}", line.trim()).parse().unwrap()
}

fn proxy_at(rules: &std::path::Path, dest: std::net::SocketAddr) -> (Proc, std::net::SocketAddr) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-proxy"))
        .arg(rules)
        .arg(dest.to_string())
        .arg("0")
        .stdout(Stdio::piped())
        .spawn()
        .expect("proxy");
    let addr = addr_of(&mut child);
    (Proc(child), addr)
}

fn write_rules(path: &std::path::Path, v: Value) {
    std::fs::write(path, serde_json::to_string(&v).unwrap()).unwrap();
}

fn host(args: &[&str]) -> (i32, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_bnrose-host"))
        .args(args)
        .output()
        .expect("host exe");
    (
        out.status.code().unwrap_or(-1),
        format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr),
        ),
    )
}

fn admin_roundtrip(addr: std::net::SocketAddr, line: &str) -> Option<Value> {
    use std::io::{BufRead, Write};
    let mut s = std::net::TcpStream::connect(addr).ok()?;
    s.write_all(format!("{line}\n").as_bytes()).ok()?;
    let mut out = String::new();
    std::io::BufReader::new(s).read_line(&mut out).ok()?;
    serde_json::from_str(out.trim()).ok()
}

fn intent_env_hex(dir: &std::path::Path) -> String {
    let v: Value =
        serde_json::from_str(&std::fs::read_to_string(dir.join("intent.json")).unwrap()).unwrap();
    bnrose_exec_host::hex(&bnrose_exec_host::fixtures::read_intent(&v).unwrap().env)
}

fn intent_file(dir: &std::path::Path, index: u64) -> std::path::PathBuf {
    let p = dir.join("intent.json");
    let f = bnrose_exec_host::fixtures::fixture(index, 1_800_000_000, 3600);
    std::fs::write(&p, serde_json::to_string(&f.to_json()).unwrap()).unwrap();
    p
}

const ROOT: &str = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"; // PUBLIC-CONSTANT (disposable test supervisor root, no secret)

#[test]
fn l1_checked_durability_no_ack_without_proof() {
    let dir = tmp("l1");
    let (_d, daddr) = dest_at(&dir);
    // force the next durable append to fail
    admin_roundtrip(daddr, r#"{"op":"fail-log","label":"admin"}"#).unwrap();
    let (code, out) = host(&[
        "submit",
        "--state",
        dir.join("h").to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &daddr.to_string(),
        "--intent",
        intent_file(&dir, 1).to_str().unwrap(),
    ]);
    let v: Value = serde_json::from_str(out.trim()).expect("json");
    assert_eq!(
        v["submissionOutcome"], "storage-error",
        "the failure surfaces"
    );
    assert_eq!(v["oneSignedAttempt"], Value::Bool(true));
    let _ = code;
    // and the destination did NOT record the transaction
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(dump["txs"].as_array().unwrap().len(), 0);
    println!("l2/l1: forced log failure → storage-error, no acceptance, one signed attempt");
}

#[test]
fn l2_conflicting_replay_is_refused_not_duplicated() {
    let dir = tmp("l2");
    let (_d, daddr) = dest_at(&dir);
    let (code, out) = host(&[
        "submit",
        "--state",
        dir.join("h").to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &daddr.to_string(),
        "--intent",
        intent_file(&dir, 2).to_str().unwrap(),
    ]);
    let v: Value = serde_json::from_str(out.trim()).unwrap();
    assert_eq!(v["submissionOutcome"], "acked");
    let tx = v["txId"].as_str().unwrap().to_string();
    // the SAME transaction id with DIFFERENT bytes: conflict, not duplicate
    let r = admin_roundtrip(
        daddr,
        &format!(
            "{{\"op\":\"submit\",\"label\":\"evil\",\"txId\":\"{tx}\",\"payload\":\"deadbeef\"}}"
        ),
    )
    .unwrap();
    assert_eq!(r["result"], "conflict");
    // and the SAME bytes still answer duplicate (the honest reconciliation)
    let env_hex = intent_env_hex(&dir);
    let r = admin_roundtrip(
        daddr,
        &format!(
            "{{\"op\":\"submit\",\"label\":\"probe\",\"txId\":\"{tx}\",\"payload\":\"{env_hex}\"}}"
        ),
    )
    .unwrap();
    assert_eq!(r["result"], "duplicate");
    let _ = code;
    println!("l2/l2: same tx-id different bytes → conflict; same bytes → duplicate");
}

#[test]
fn l3_destination_restarts_on_the_same_log_and_replays() {
    let dir = tmp("l3");
    {
        let (_d, daddr) = dest_at(&dir);
        let (_, out) = host(&[
            "submit",
            "--state",
            dir.join("h").to_str().unwrap(),
            "--root-hex",
            ROOT,
            "--dest",
            &daddr.to_string(),
            "--intent",
            intent_file(&dir, 3).to_str().unwrap(),
        ]);
        let v: Value = serde_json::from_str(out.trim()).unwrap();
        let tx = v["txId"].as_str().unwrap().to_string();
        admin_roundtrip(daddr, r#"{"op":"advance","label":"admin","blocks":3}"#).unwrap();
        // KILL the destination; restart ON THE SAME durable log
        drop(_d);
        let (_d2, d2) = dest_at(&dir);
        // states replayed: the transaction is still final
        let obs = admin_roundtrip(
            d2,
            &format!("{{\"op\":\"observe\",\"label\":\"p\",\"txId\":\"{tx}\"}}"),
        )
        .unwrap();
        assert_eq!(
            obs["state"], "final",
            "restart replays the SAME durable log"
        );
        // idempotency replayed: identical bytes still duplicate
        let env_hex = intent_env_hex(&dir);
        let r = admin_roundtrip(
            d2,
            &format!(
                "{{\"op\":\"submit\",\"label\":\"p\",\"txId\":\"{tx}\",\"payload\":\"{env_hex}\"}}"
            ),
        )
        .unwrap();
        assert_eq!(r["result"], "duplicate");
    }
    println!(
        "l2/l3: destination killed and restarted on the same log — states and idempotency replay"
    );
}

#[test]
fn l4_two_host_executables_through_the_proxy_partition() {
    let dir = tmp("l4");
    let (_d, daddr) = dest_at(&dir);
    let rules = dir.join("rules.json");
    write_rules(
        &rules,
        serde_json::json!({"hostA": {"mode": "drop-ack"}, "hostB": {"mode": "pass"}}),
    );
    let (_p, paddr) = proxy_at(&rules, daddr);
    let intent = intent_file(&dir, 4);
    // host A (its own EXECUTABLE, its own state dir) submits through the
    // severed proxy: UNKNOWN, one signed attempt
    let (code, out) = host(&[
        "submit",
        "--state",
        dir.join("hostA").to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &paddr.to_string(),
        "--intent",
        intent.to_str().unwrap(),
    ]);
    let v: Value = serde_json::from_str(out.trim()).unwrap();
    assert_eq!(
        v["submissionOutcome"], "timeout",
        "the partition swallowed the exchange"
    );
    assert_eq!(v["oneSignedAttempt"], Value::Bool(true));
    let tx = v["txId"].as_str().unwrap().to_string();
    // heal the network (rules only — neither endpoint restarted)
    write_rules(
        &rules,
        serde_json::json!({"hostA": {"mode": "pass"}, "hostB": {"mode": "pass"}, "probe": {"mode": "pass"}}),
    );
    // host B — a DIFFERENT executable run, its own sovereign directory,
    // carrying A's durable state (the journal travels; the claim does not)
    let b_dir = dir.join("hostB");
    std::fs::create_dir_all(b_dir.join("replica")).unwrap();
    std::fs::copy(
        dir.join("hostA").join("journal.bin"),
        b_dir.join("journal.bin"),
    )
    .unwrap();
    std::fs::copy(
        dir.join("hostA").join("replica").join("journal.bin"),
        b_dir.join("replica").join("journal.bin"),
    )
    .unwrap();
    let (code2, out2) = host(&[
        "resolve",
        "--state",
        b_dir.to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &paddr.to_string(),
        "--intent",
        intent.to_str().unwrap(),
        "--rebroadcast",
    ]);
    let v2: Value = serde_json::from_str(out2.trim()).unwrap();
    // the rebroadcast came from the JOURNAL's persisted bytes: the
    // destination already held them (the partition-era acceptance) —
    // duplicate, an observation; and the intent file AGREED with them
    assert_eq!(
        v2["submissionOutcome"], "duplicate",
        "partition-era acceptance reconciles"
    );
    assert_eq!(
        v2["oneSignedAttempt"],
        Value::Bool(true),
        "no second signature, ever"
    );
    admin_roundtrip(daddr, r#"{"op":"advance","label":"admin","blocks":3}"#).unwrap();
    let (code3, out3) = host(&["observe", "--dest", &paddr.to_string(), "--tx-id", &tx]);
    assert_eq!(code3, 0, "finality observed: {out3}");
    // an intent that DISAGREES with the persisted bytes: refused
    let evil = dir.join("evil.json");
    let f = bnrose_exec_host::fixtures::fixture(99, 1_800_000_000, 3600);
    std::fs::write(&evil, serde_json::to_string(&f.to_json()).unwrap()).unwrap();
    let (code4, out4) = host(&[
        "resolve",
        "--state",
        b_dir.to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &paddr.to_string(),
        "--intent",
        evil.to_str().unwrap(),
        "--rebroadcast",
    ]);
    assert_eq!(
        code4, 1,
        "persisted-bytes mismatch refuses the recovery — host said: {out4}"
    );
    let _ = (code, code2);
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(
        dump["txs"].as_array().unwrap().len(),
        1,
        "one acceptance across the partition"
    );
    println!("l2/l4: two host executables, a real middlebox partition, journal-borne rebroadcast, mismatched intent refused, one effect");
}

#[test]
fn l5_corrupted_destination_log_fails_closed_on_restart() {
    let dir = tmp("l5");
    {
        let (_d, daddr) = dest_at(&dir);
        let (_, out) = host(&[
            "submit",
            "--state",
            dir.join("h").to_str().unwrap(),
            "--root-hex",
            ROOT,
            "--dest",
            &daddr.to_string(),
            "--intent",
            intent_file(&dir, 5).to_str().unwrap(),
        ]);
        let v: Value = serde_json::from_str(out.trim()).unwrap();
        assert_eq!(v["submissionOutcome"], "acked");
    }
    // CORRUPT the durable log: a truncated/garbage line
    let log = dir.join("dest.log");
    let mut text = std::fs::read_to_string(&log).unwrap();
    text.push_str("{\"ev\": \"accept\", \"txId\": \"zz"); // truncated JSON
    std::fs::write(&log, text).unwrap();
    // restart on the SAME directory: the destination REFUSES to serve —
    // a corrupted acceptance log is damage, never skippable noise
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest"))
        .arg(&log)
        .arg("0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("dest restart");
    let out = child.wait().expect("wait");
    assert_ne!(
        out.code(),
        Some(0),
        "the corrupted log must refuse to serve"
    );
    let _ = Proc(child);
    println!("l2/l5: corrupted acceptance log → restart exits nonzero (fail closed)");
}

#[test]
fn l6_concurrent_competing_recovery_one_acceptance() {
    let dir = tmp("l6");
    let (_d, daddr) = dest_at(&dir);
    // host A submits; the ack is lost to a partition at the proxy
    let rules = dir.join("rules.json");
    write_rules(
        &rules,
        serde_json::json!({"hostA": {"mode": "drop-ack"}, "hostB1": {"mode": "pass"}, "hostB2": {"mode": "pass"}, "probe": {"mode": "pass"}}),
    );
    let (_p, paddr) = proxy_at(&rules, daddr);
    let intent = intent_file(&dir, 6);
    let (code, out) = host(&[
        "submit",
        "--state",
        dir.join("hostA").to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &paddr.to_string(),
        "--intent",
        intent.to_str().unwrap(),
    ]);
    let v: Value = serde_json::from_str(out.trim()).unwrap();
    assert_eq!(v["submissionOutcome"], "timeout");
    let tx = v["txId"].as_str().unwrap().to_string();
    // TWO replacement hosts, prepared BEFORE either runs — the durable
    // state travels to both; each takes its own claim on its own dir
    for b in ["hostB1", "hostB2"] {
        let bd = dir.join(b);
        std::fs::create_dir_all(bd.join("replica")).unwrap();
        std::fs::copy(
            dir.join("hostA").join("journal.bin"),
            bd.join("journal.bin"),
        )
        .unwrap();
        std::fs::copy(
            dir.join("hostA").join("replica").join("journal.bin"),
            bd.join("replica").join("journal.bin"),
        )
        .unwrap();
    }
    // heal, then run BOTH recovery hosts SIMULTANEOUSLY (genuinely
    // concurrent processes racing the same unresolved operation)
    write_rules(
        &rules,
        serde_json::json!({"hostA": {"mode": "pass"}, "hostB1": {"mode": "pass"}, "hostB2": {"mode": "pass"}, "probe": {"mode": "pass"}}),
    );
    let s1 = dir.join("hostB1").display().to_string();
    let s2 = dir.join("hostB2").display().to_string();
    let pa = paddr.to_string();
    let ia = intent.display().to_string();
    let ia1 = ia.clone();
    let pa1 = pa.clone();
    // DETERMINISTIC, WITNESSED OVERLAP: the destination HOLDS both
    // rebroadcasts in flight (they block inside its submit handler,
    // counted by its own gauge) until released — then asserts its own
    // observed peak concurrency >= 2. This is the destination's record,
    // not window arithmetic in the test.
    admin_roundtrip(daddr, r#"{"op":"hold-submits","label":"admin"}"#).unwrap();
    let b1 = std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        let r = host(&[
            "resolve",
            "--state",
            &s1,
            "--root-hex",
            ROOT,
            "--dest",
            &pa1,
            "--intent",
            &ia1,
            "--rebroadcast",
        ]);
        (r.0, r.1, t0, std::time::Instant::now())
    });
    let s2b = s2.clone();
    let pab = pa.clone();
    let iab = ia.clone();
    let b2 = std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        let r = host(&[
            "resolve",
            "--state",
            &s2b,
            "--root-hex",
            ROOT,
            "--dest",
            &pab,
            "--intent",
            &iab,
            "--rebroadcast",
        ]);
        (r.0, r.1, t0, std::time::Instant::now())
    });
    // poll the destination's gauge until BOTH submits are in flight
    let mut peak = 0usize;
    for _ in 0..100 {
        let stats = admin_roundtrip(daddr, r#"{"op":"stats","label":"admin"}"#).unwrap();
        peak = stats["maxConcurrentSubmits"].as_u64().unwrap_or(0) as usize;
        let inflight = stats["inFlight"].as_u64().unwrap_or(0) as usize;
        if inflight >= 2 {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    admin_roundtrip(daddr, r#"{"op":"release-submits","label":"admin"}"#).unwrap();
    let ((c1, o1, w1s, w1e), (c2, o2, w2s, w2e)) = (b1.join().unwrap(), b2.join().unwrap());
    assert!(
        peak >= 2,
        "destination must witness 2 concurrent submits (saw {peak}); B1=[{o1}] B2=[{o2}]"
    );
    // SECONDARY window evidence (the destination's gauge is primary)
    assert!(w1s < w2e && w2s < w1e, "windows intersect");
    // EXIT CODES, checked: both preserved UNKNOWN at resolve time
    assert_eq!(c1, 3, "host B1 resolved UNKNOWN-preserved: {o1}");
    assert_eq!(c2, 3, "host B2 resolved UNKNOWN-preserved: {o2}");
    // both survivors converge: JOURNAL-identical bytes, ONE acceptance
    let v1: Value = serde_json::from_str(o1.trim()).unwrap();
    let v2: Value = serde_json::from_str(o2.trim()).unwrap();
    for v in [&v1, &v2] {
        assert_eq!(
            v["submissionOutcome"], "duplicate",
            "identical bytes reconcile"
        );
        assert_eq!(v["oneSignedAttempt"], Value::Bool(true));
    }
    admin_roundtrip(daddr, r#"{"op":"advance","label":"admin","blocks":3}"#).unwrap();
    // BOTH hosts independently observe finality — two separate processes,
    // each under its OWN label, each asserted on its own exit
    for (b, lbl) in [("hostB1", "hostB1"), ("hostB2", "hostB2")] {
        let _ = b;
        let (cb, ob) = host(&[
            "observe",
            "--dest",
            &paddr.to_string(),
            "--tx-id",
            &tx,
            "--label",
            lbl,
        ]);
        assert_eq!(cb, 0, "{lbl} observed final independently: {ob}");
    }
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(
        dump["txs"].as_array().unwrap().len(),
        1,
        "ONE acceptance across the race"
    );
    let _ = code;
    println!("l2/l6: two hosts recovered the SAME operation CONCURRENTLY — identical journal bytes, one acceptance, no conflict");
}

#[test]
fn l7_recovery_without_persisted_evidence_refuses() {
    // the deliberate-bug row: the OLD code fell back to caller-supplied
    // bytes when the journal had no admission — the NEW code refuses
    let dir = tmp("l7");
    let (_d, daddr) = dest_at(&dir);
    // a host whose journal is EMPTY (nothing admitted), resolving with
    // rebroadcast: no persisted evidence → refusal, zero submissions
    let (code, out) = host(&[
        "resolve",
        "--state",
        dir.join("h").to_str().unwrap(),
        "--root-hex",
        ROOT,
        "--dest",
        &daddr.to_string(),
        "--intent",
        intent_file(&dir, 7).to_str().unwrap(),
        "--rebroadcast",
    ]);
    assert_eq!(code, 1, "no persisted submission → exit 1: {out}");
    assert!(
        out.contains("recovery:") || out.contains("no persisted"),
        "{out}"
    );
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(
        dump["txs"].as_array().unwrap().len(),
        0,
        "nothing was invented and sent"
    );
    println!(
        "l2/l7: rebroadcast without persisted evidence refused — nothing invented, nothing sent"
    );
}

#[test]
fn l8_replay_validates_events_fail_closed() {
    for (tag, junk) in [
        ("missing-fields", "{\"ev\": \"accept\"}\n"),
        ("unknown-event", "{\"ev\": \"settled\", \"txId\": \"ab\"}\n"),
        (
            "impossible-transition",
            "{\"ev\": \"final\", \"txId\": \"ab\"}\n",
        ),
    ] {
        let dir = tmp(&format!("l8-{tag}"));
        // a well-formed-JSON but invalid event line in the log
        std::fs::write(dir.join("dest.log"), junk).unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest"))
            .arg(dir.join("dest.log"))
            .arg("0")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("dest");
        let out = child.wait().expect("wait");
        assert_ne!(
            out.code(),
            Some(0),
            "{tag}: invalid events must refuse to serve"
        );
        let _ = Proc(child);
    }
    println!("l2/l8: missing fields, unknown events, impossible transitions all fail closed");
}

#[test]
fn l9_advance_prefix_recovery_is_durable_and_honest() {
    let dir = tmp("l9");
    let (_d, daddr) = dest_at(&dir);
    // TWO accepted transactions
    for i in [8u64, 9u64] {
        let (_, out) = host(&[
            "submit",
            "--state",
            dir.join(format!("h{i}")).to_str().unwrap(),
            "--root-hex",
            ROOT,
            "--dest",
            &daddr.to_string(),
            "--intent",
            intent_file(&dir, i).to_str().unwrap(),
        ]);
        let v: Value = serde_json::from_str(out.trim()).unwrap();
        assert_eq!(v["submissionOutcome"], "acked");
    }
    // fail the durable append AFTER the first success, then advance:
    // the FIRST transition proves durably, the SECOND write fails — the
    // batch aborts with an honest durable PREFIX (no rollback of proof)
    admin_roundtrip(daddr, r#"{"op":"fail-log","label":"admin","after":2}"#).unwrap();
    let adv = admin_roundtrip(daddr, r#"{"op":"advance","label":"admin","blocks":1}"#).unwrap();
    assert_eq!(adv["result"], "storage-error", "the batch aborts");
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(dump["txs"].as_array().unwrap().len(), 2);
    // restart on the same log: the PREFIX replays. The map iterates in
    // its own order, so the honest assertion is EXACTLY ONE transitioned
    // durably and exactly one did not — an order-agnostic durable prefix
    drop(_d);
    let (_d2, d2) = dest_at(&dir);
    let mut states = Vec::new();
    for i in [8u64, 9u64] {
        let f = bnrose_exec_host::fixtures::fixture(i, 1_800_000_000, 3600);
        let intent = bnrose_exec_host::fixtures::read_intent(&f.to_json()).unwrap();
        let tx = bnrose_exec_host::hex(&bnrose_exec_core::effect_digest(
            &bnrose_exec_core::op_id(&intent.authority, &intent.env),
            &bnrose_exec_core::env_sha(&intent.env),
        ));
        let obs = admin_roundtrip(
            d2,
            &format!("{{\"op\":\"observe\",\"label\":\"p\",\"txId\":\"{tx}\"}}"),
        )
        .unwrap();
        states.push(obs["state"].as_str().unwrap_or("?").to_string());
    }
    states.sort();
    assert_eq!(
        states,
        vec!["included".to_string(), "pending".to_string()],
        "exactly one durable transition survived"
    );
    let _ = d2;
    println!("l2/l9: mid-batch failure → durable prefix survives restart; the rest stay pending");
}

#[test]
fn l7lib_recovery_refusal_exercised_at_the_library_boundary() {
    // THE DIRECT LIBRARY TEST (founder review round 4): the CLI gate
    // short-circuits before Host::drive, so l7 alone could not convict a
    // reintroduced fallback. This row calls Host::resolve() itself.
    // If the old unsafe fallback were restored, the outcome would be
    // "acked" (the destination accepts the invented bytes) and THIS
    // ASSERTION GOES RED — the control is the outcome itself.
    let dir = tmp("l7lib");
    let (_d, daddr) = dest_at(&dir);
    let client =
        bnrose_netpart::DestClient::new(daddr, "hostX", std::time::Duration::from_millis(400));
    let mut host = bnrose_netpart::Host::open(&dir.join("h"), &[0xb7; 32], client).unwrap();
    let f = bnrose_exec_host::fixtures::fixture(10, 1_800_000_000, 3600);
    let intent = bnrose_exec_host::fixtures::read_intent(&f.to_json()).unwrap();
    let r = host.resolve(&intent, 1_800_000_000, true);
    assert!(
        r.submission_outcome.starts_with("recovery:"),
        "the library must refuse without persisted evidence, got: {}",
        r.submission_outcome
    );
    assert_eq!(r.signatures_journaled, 0);
    // and nothing reached the destination
    let dump = admin_roundtrip(daddr, r#"{"op":"dump","label":"admin"}"#).unwrap();
    assert_eq!(dump["txs"].as_array().unwrap().len(), 0);
    println!("l2/l7lib: Host::resolve without evidence refuses AT THE LIBRARY — no submission, destination empty");
}

#[test]
fn l8every_every_invalid_replay_shape_refuses_individually() {
    // one row per validated shape (founder review: test every transition)
    let shapes: &[(&str, &str)] = &[
        ("missing-txid", r#"{"ev": "accept", "payload": "aa"}"#),
        ("accept-missing-payload", r#"{"ev": "accept", "txId": "a"}"#),
        ("unknown-event", r#"{"ev": "settled", "txId": "ab"}"#),
        (
            "duplicate-accept",
            "{\"ev\": \"accept\", \"txId\": \"ab\", \"payload\": \"aa\"}\n{\"ev\": \"accept\", \"txId\": \"ab\", \"payload\": \"aa\"}",
        ),
        ("included-unknown-tx", r#"{"ev": "included", "txId": "ab"}"#),
        ("final-unknown-tx", r#"{"ev": "final", "txId": "ab"}"#),
        (
            "included-twice",
            "{\"ev\": \"accept\", \"txId\": \"ab\", \"payload\": \"aa\"}\n{\"ev\": \"included\", \"txId\": \"ab\"}\n{\"ev\": \"included\", \"txId\": \"ab\"}",
        ),
        (
            "final-without-included",
            "{\"ev\": \"accept\", \"txId\": \"ab\", \"payload\": \"aa\"}\n{\"ev\": \"final\", \"txId\": \"ab\"}",
        ),
    ];
    for (tag, log) in shapes {
        let dir = tmp(&format!("l8e-{tag}"));
        std::fs::write(dir.join("dest.log"), log).unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest"))
            .arg(dir.join("dest.log"))
            .arg("0")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("dest");
        let out = child.wait().expect("wait");
        assert_ne!(out.code(), Some(0), "{tag}: must refuse to serve");
        let _ = Proc(child);
    }
    println!("l2/l8every: all eight invalid replay shapes refuse individually");
}

#[test]
fn l10_proxy_unknown_mode_denied_pass_allowed() {
    let dir = tmp("l10");
    let (_d, daddr) = dest_at(&dir);
    // bogus mode → the connection is severed, no answer ever arrives
    let rules = dir.join("rules.json");
    write_rules(&rules, serde_json::json!({"probe": {"mode": "bogus-mode"}}));
    let (_p, paddr) = proxy_at(&rules, daddr);
    assert!(
        admin_roundtrip(paddr, r#"{"op":"dump","label":"probe"}"#).is_none(),
        "an unknown mode must deny, not forward"
    );
    // explicit pass → forward and answer
    write_rules(&rules, serde_json::json!({"probe": {"mode": "pass"}}));
    let ok = admin_roundtrip(paddr, r#"{"op":"dump","label":"probe"}"#);
    assert!(ok.is_some(), "an explicit pass must forward");
    println!("l2/l10: unknown proxy mode denied (severed); explicit pass forwards");
}
