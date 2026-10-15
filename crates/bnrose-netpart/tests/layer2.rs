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
    write_rules(&rules, serde_json::json!({"hostA": {"mode": "drop-ack"}}));
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
    write_rules(&rules, serde_json::json!({}));
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
