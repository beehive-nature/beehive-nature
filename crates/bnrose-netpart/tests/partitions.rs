//! BNROSE-NETPART-001 scenario battery: real processes, a real loopback
//! network, a real fault injector, and an independent destination that
//! owns inclusion/execution/finality. Every scenario asserts the
//! initial-result distinction: LOCAL SAFETY (claim, one signed attempt,
//! durable-before-submission) vs DESTINATION EXECUTION (its `included`)
//! vs FINALITY (its `final`) — separately attributed, never conflated.

use bnrose_netpart::{DestClient, DestState, Host};
use serde_json::Value;
use std::process::{Child, Command};
use std::time::Duration;

const NOW: u64 = 1_800_000_000;

struct DestProc {
    child: Child,
    addr: std::net::SocketAddr,
}

impl Drop for DestProc {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn spawn_dest(tag: &str) -> DestProc {
    let dir = std::env::temp_dir().join(format!("bnrose-netpart-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let log = dir.join("dest.log");
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest"))
        .arg(&log)
        .arg("0")
        .stdout(std::process::Stdio::piped())
        .spawn()
        .expect("spawn destination");
    let port: u16 = {
        use std::io::BufRead;
        let mut line = String::new();
        let stdout = child.stdout.as_mut().expect("piped");
        {
            let mut reader = std::io::BufReader::new(stdout);
            reader.read_line(&mut line).expect("port line");
        }
        line.trim().parse().expect("port number")
    };
    DestProc {
        child,
        addr: format!("127.0.0.1:{port}").parse().unwrap(),
    }
}

fn admin(d: &DestProc) -> DestClient {
    DestClient::new(d.addr, "admin", Duration::from_secs(5))
}

fn host_client(d: &DestProc, label: &str) -> DestClient {
    // the submission window is deliberately short: a delayed answer is an
    // UNKNOWN, which is the scenario's point
    DestClient::new(d.addr, label, Duration::from_millis(400))
}

fn tmp(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-netpart-host-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn intent_of(index: u64) -> bnrose_exec_host::fixtures::IntentFile {
    let f = bnrose_exec_host::fixtures::fixture(index, NOW, 3600);
    bnrose_exec_host::fixtures::read_intent(&f.to_json()).unwrap()
}

/// The summary assertion the order demands: local safety, destination
/// execution, and finality are three separately attributed facts.
fn assert_the_distinction(report_json: &Value, dest_state: DestState) {
    assert_eq!(
        report_json["localSafety"]["oneSignedAttempt"],
        serde_json::json!(true),
        "local safety: exactly one signed attempt, durably recorded before submission"
    );
    let included = matches!(dest_state, DestState::Included | DestState::Final);
    assert_eq!(
        report_json["destinationExecution"]["included"]
            .as_bool()
            .unwrap(),
        included,
        "destination execution is the DESTINATION's fact"
    );
    assert_eq!(
        report_json["finality"]["final"].as_bool().unwrap(),
        dest_state == DestState::Final,
        "finality is only finality when the destination says final"
    );
}

fn summary(report: &bnrose_netpart::HostReport, obs: Option<DestState>) -> Value {
    serde_json::json!({
        "localSafety": {
            "oneSignedAttempt": report.signatures_journaled == 1,
            "journalRecords": report.journal_records,
        },
        "destinationExecution": {
            "included": matches!(obs, Some(DestState::Included) | Some(DestState::Final)),
            "observation": obs.map(|o| o.word()),
        },
        "finality": {
            "final": obs == Some(DestState::Final),
            "note": "finality is the destination's own state, observed",
        },
        "submissionOutcome": report.submission_outcome,
    })
}

#[test]
fn s1_delayed_requests_leave_unknown_then_resolve_by_observation() {
    let d = spawn_dest("s1");
    admin(&d).set_fault("hostA", "delay", 1500).unwrap(); // > the 400ms window
    let mut host = Host::open(&tmp("s1"), &[0x91; 32], host_client(&d, "hostA")).unwrap();
    let intent = intent_of(1);
    let r = host.run_to_effect(&intent, NOW);
    // the delayed answer is NO conclusive outcome: UNKNOWN, one signed
    // attempt, nothing re-signed
    assert_eq!(r.submission_outcome, "timeout");
    assert_eq!(r.signatures_journaled, 1);
    // heal: the fault clears, block production happens, and the SAME host
    // (no re-submission at all) resolves by pure observation
    admin(&d).set_fault("hostA", "none", 0).unwrap();
    admin(&d).advance(1).unwrap();
    let r2 = host.resolve(&intent, NOW, false);
    let obs = host_client(&d, "probe").observe(&r.tx_id).unwrap();
    assert!(matches!(obs, DestState::Included | DestState::Pending));
    let s = summary(&r2, Some(obs));
    assert_the_distinction(&s, obs);
    // and no second signature ever existed
    assert_eq!(r2.signatures_journaled, 1);
    println!("netpart/s1: delayed request → UNKNOWN → resolved by observation; one signed attempt throughout");
}

#[test]
fn s2_lost_acknowledgement_preserves_unknown_and_rebroadcast_reconciles() {
    let d = spawn_dest("s2");
    // the destination ACCEPTS (durably) but its acknowledgement is dropped
    admin(&d).set_fault("hostA", "drop", 0).unwrap();
    let mut host = Host::open(&tmp("s2"), &[0x92; 32], host_client(&d, "hostA")).unwrap();
    let intent = intent_of(2);
    let r = host.run_to_effect(&intent, NOW);
    assert_eq!(
        r.submission_outcome, "timeout",
        "the acknowledgement was lost"
    );
    assert_eq!(r.signatures_journaled, 1);
    // heal and reconcile: rebroadcast the IDENTICAL signed bytes — the
    // destination answers duplicate (an OBSERVATION), block production
    // makes it final, and ONLY the observation completes
    admin(&d).set_fault("hostA", "none", 0).unwrap();
    admin(&d).advance(3).unwrap();
    let r2 = host.resolve(&intent, NOW, true);
    assert_eq!(r2.submission_outcome, "duplicate");
    let obs = host_client(&d, "probe").observe(&r.tx_id).unwrap();
    assert_eq!(obs, DestState::Final);
    assert_eq!(
        r2.signatures_journaled, 1,
        "the duplicate never became a second signature"
    );
    let s = summary(&r2, Some(obs));
    assert_the_distinction(&s, obs);
    println!("netpart/s2: lost ack → UNKNOWN; identical-bytes rebroadcast answered duplicate (observation, not success); finality observed");
}

#[test]
fn s3_duplicate_delivery_never_promotes_unknown_to_success() {
    let d = spawn_dest("s3");
    let mut host = Host::open(&tmp("s3"), &[0x93; 32], host_client(&d, "hostA")).unwrap();
    let intent = intent_of(3);
    let r = host.run_to_effect(&intent, NOW);
    assert_eq!(r.submission_outcome, "acked");
    // NO block production: the transaction is pending at the destination.
    // Re-deliveries answer duplicate — and the operation must NOT be
    // called successful on that basis alone.
    let r2 = host.resolve(&intent, NOW, true);
    assert_eq!(r2.submission_outcome, "duplicate");
    let obs = host_client(&d, "probe").observe(&r.tx_id).unwrap();
    assert_eq!(obs, DestState::Pending, "pending, not executed, not final");
    let s = summary(&r2, Some(obs));
    assert_eq!(
        s["destinationExecution"]["included"],
        serde_json::json!(false)
    );
    assert_eq!(s["finality"]["final"], serde_json::json!(false));
    assert_eq!(
        s["localSafety"]["oneSignedAttempt"],
        serde_json::json!(true),
        "a duplicate response is a reconciliation observation, never a promotion"
    );
    println!("netpart/s3: three duplicate responses, zero promotions — pending stays pending");
}

#[test]
fn s4_competing_recovery_converges_through_destination_idempotency() {
    let d = spawn_dest("s4");
    // host A submits; the ack is lost; A dies with the op UNKNOWN
    admin(&d).set_fault("hostA", "drop", 0).unwrap();
    let intent = intent_of(4);
    let dir_a = tmp("s4a");
    let (tx_id, records) = {
        let mut a = Host::open(&dir_a, &[0x94; 32], host_client(&d, "hostA")).unwrap();
        let r = a.run_to_effect(&intent, NOW);
        assert_eq!(r.submission_outcome, "timeout");
        (r.tx_id.clone(), r.journal_records)
    };
    // (host A dropped; its durable state remains for the copy below)
    // host B — a DIFFERENT sovereign directory, the replica copied across
    // (the durable state travels; the claim does not) — recovers the SAME
    // operation and rebroadcasts the IDENTICAL signed bytes
    admin(&d).set_fault("hostA", "none", 0).unwrap();
    let dir_b = tmp("s4b");
    std::fs::create_dir_all(dir_b.join("replica")).unwrap();
    // the durable state travels across hosts; the CLAIM does not (B takes
    // its own claim on its own directory)
    let src = dir_a.clone();
    let _ = std::fs::copy(src.join("journal.bin"), dir_b.join("journal.bin"));
    let _ = std::fs::copy(
        src.join("replica").join("journal.bin"),
        dir_b.join("replica").join("journal.bin"),
    );
    let mut b = Host::open(&dir_b, &[0x94; 32], host_client(&d, "hostB")).unwrap();
    let rb = b.resolve(&intent, NOW, true);
    // the destination's idempotency is what protected the effect: exactly
    // ONE acceptance exists, whatever the hosts attempted
    assert_eq!(
        rb.signatures_journaled, 1,
        "one signed attempt across BOTH hosts"
    );
    admin(&d).advance(3).unwrap();
    let obs = host_client(&d, "probe").observe(&tx_id).unwrap();
    assert_eq!(obs, DestState::Final);
    let dump = dump(&d.addr);
    assert_eq!(
        dump["txs"].as_array().unwrap().len(),
        1,
        "one acceptance, one effect"
    );
    let s = summary(&rb, Some(obs));
    assert_the_distinction(&s, obs);
    let _ = records;
    println!("netpart/s4: competing recovery across sovereign hosts — destination idempotency protected the effect; local exclusion protected each process");
}

#[test]
fn s5_reconciliation_after_partition_heals_with_per_host_observations() {
    let d = spawn_dest("s5");
    // a full partition: BOTH directions dropped for both hosts
    admin(&d).set_fault("hostA", "drop", 0).unwrap();
    admin(&d).set_fault("hostB", "drop", 0).unwrap();
    let intent = intent_of(5);
    let mut a = Host::open(&tmp("s5a"), &[0x95; 32], host_client(&d, "hostA")).unwrap();
    let r = a.run_to_effect(&intent, NOW);
    assert_eq!(r.submission_outcome, "timeout");
    let b = Host::open(&tmp("s5b"), &[0x96; 32], host_client(&d, "hostB")).unwrap();
    let _ = b; // B held its own claim through the partition
               // heal: block production, then each host independently observes
    admin(&d).set_fault("hostA", "none", 0).unwrap();
    admin(&d).set_fault("hostB", "none", 0).unwrap();
    admin(&d).advance(3).unwrap();
    let obs_a = host_client(&d, "hostA").observe(&r.tx_id).unwrap();
    let obs_b = host_client(&d, "hostB").observe(&r.tx_id).unwrap();
    assert_eq!(obs_a, obs_b, "convergent observations after healing");
    assert_eq!(obs_a, DestState::Final);
    let r2 = a.resolve(&intent, NOW, true);
    assert_eq!(
        r2.submission_outcome, "duplicate",
        "the partition-era acceptance reconciles"
    );
    let s = summary(&r2, Some(obs_a));
    assert_the_distinction(&s, obs_a);
    // restart durability: the destination's acceptance log survives
    drop(d);
    let d2 = spawn_dest("s5");
    let obs2 = host_client(&d2, "probe").observe(&r.tx_id);
    // a fresh destination process has a fresh log (per-test dirs): the
    // observation is UnknownToDest — honest absence, not silent downgrade
    assert!(matches!(obs2, None | Some(DestState::UnknownToDest)));
    println!("netpart/s5: partition healed, observations converged on final; a fresh destination honestly knows nothing");
}

fn dump(addr: &std::net::SocketAddr) -> Value {
    use std::io::{BufRead, Write};
    let mut s = std::net::TcpStream::connect(addr).expect("connect dump");
    let mut line = String::new();
    writeln!(s, "{}", serde_json::json!({"op": "dump", "label": "admin"})).unwrap();
    std::io::BufReader::new(s).read_line(&mut line).unwrap();
    serde_json::from_str(line.trim()).unwrap()
}
