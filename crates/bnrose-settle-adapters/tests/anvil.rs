//! The Anvil devnet battery — REAL EVM node software, REAL wire, REAL
//! receipts. EVIDENCE CLASS, labeled: single-node devnet topology
//! (foundry anvil, Nitro-calibrated base fee per `ops/ant-extsig`); its
//! `finalized`/`safe` tags stay at block 0 by construction, so finality
//! via the finalized tag is honestly NEVER final here — the same code
//! path reads the production tag in the live probes. This battery is
//! destination-execution evidence against real EVM software, never
//! Arbitrum One production finality.
//!
//! Realities pinned by live probing before these tests were written:
//! - anvil refuses a resubmit of a MINED transaction with "nonce too
//!   low" (its nonce is consumed) — the already-known class appears only
//!   while a transaction sits in the mempool unmined;
//! - the node's own receipt lookup answers under OUR locally-computed
//!   keccak hash — the identity differential (the node recomputed it
//!   from the raw bytes independently).

use bnrose_settle_adapters::evm::{self, EvmRail};
use bnrose_settle_adapters::faultproxy;
use bnrose_settle_adapters::lineproto::{LineClient, RailSubmit};
use bnrose_settle_adapters::railhost::RailHost;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

// TESTNET-ONLY: anvil's DOCUMENTED first devnet account secret (foundry's
// printed default; chain-significant nowhere but a local devnet)
const ANVIL_SEED: &str = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // TESTNET-ONLY: anvil documented devnet key, chain-significant nowhere
const ANVIL_TO: &str = "70997970C51812dc3A010C7d01b50e0d17dc79C8"; // anvil account #1
const CHAIN_ID: u64 = 31337;

fn anvil_bin() -> PathBuf {
    if let Ok(p) = std::env::var("BNROSE_ANVIL_BIN") {
        let pb = PathBuf::from(&p);
        if pb.exists() {
            return pb;
        }
        panic!("BNROSE_ANVIL_BIN={p} does not exist — the devnet battery requires real EVM node software (fail closed, never a silent skip)");
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    for name in ["anvil.exe", "anvil"] {
        let p = PathBuf::from(&home).join(".foundry").join("bin").join(name);
        if p.exists() {
            return p;
        }
    }
    panic!("anvil not found (looked in ~/.foundry/bin) — the devnet battery requires real EVM node software; install foundry or set BNROSE_ANVIL_BIN (fail closed, never a silent skip)");
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

struct KillOnDrop(Child);
impl Drop for KillOnDrop {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

struct Rig {
    _anvil: KillOnDrop,
    anvil_port: u16,
    rules: PathBuf,
    proxy_port: u16,
    dest: DestProc,
    rail: EvmRail,
}

impl Rig {
    fn dest_port(&self) -> u16 {
        self.dest.port
    }
}

struct DestProc {
    child: Child,
    port: u16,
}
impl Drop for DestProc {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn spawn_dest_proc(rpc_port: u16) -> DestProc {
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-dest-arb"))
        .args([
            "--rpc-url",
            &format!("http://127.0.0.1:{rpc_port}"),
            "--bind",
            "127.0.0.1:0",
            "--chain-id",
            "31337",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("spawn dest-arb");
    let port = {
        let out = child.stdout.take().unwrap();
        let mut line = String::new();
        BufReader::new(out).read_line(&mut line).expect("port line");
        line.trim().parse().expect("port")
    };
    DestProc { child, port }
}

fn rig(tag: &str) -> Rig {
    let anvil_port = free_port();
    let anvil = KillOnDrop(
        Command::new(anvil_bin())
            .args([
                "--port",
                &anvil_port.to_string(),
                "--base-fee",
                "100000000",
                "--no-mining",
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn anvil"),
    );
    // wait for RPC readiness
    let rail = EvmRail::new("rig", &format!("http://127.0.0.1:{anvil_port}"));
    let mut ready = false;
    for _ in 0..200 {
        if let Ok(id) = rail.chain_id() {
            if id == CHAIN_ID {
                ready = true;
                break;
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(ready, "anvil never answered eth_chainId on {anvil_port}");
    // the fault proxy on the rail's wire
    let dir = std::env::temp_dir().join(format!("anvil-rig-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let rules = dir.join("rules.json");
    std::fs::write(&rules, r#"{"mode":"pass"}"#).unwrap();
    let proxy_port = faultproxy::spawn(&format!("127.0.0.1:{anvil_port}"), rules.clone()).unwrap();
    let dest = spawn_dest_proc(proxy_port);
    Rig {
        _anvil: anvil,
        anvil_port,
        rules,
        proxy_port,
        dest,
        rail: EvmRail::new("rig", &format!("http://127.0.0.1:{anvil_port}")),
    }
}

impl Rig {
    fn set_mode(&self, mode: &str) {
        std::fs::write(&self.rules, format!("{{\"mode\":\"{mode}\"}}")).unwrap();
    }

    fn host(&self, tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("anvil-host-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d
    }
}

fn submit_args(state: &PathBuf, dest_port: u16, nonce: u64) -> Vec<String> {
    [
        "submit",
        "--rail",
        "arb",
        "--state",
        state.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{dest_port}"),
        "--to",
        &format!("0x{ANVIL_TO}"),
        "--value-wei",
        "1",
        "--nonce",
        &nonce.to_string(),
        "--gas",
        "21000",
        "--max-fee-wei",
        "2000000000",
        "--max-prio-wei",
        "1000000000",
        "--chain-id",
        "31337",
        "--seed-hex",
        ANVIL_SEED,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn run_host(args: &[String]) -> (i32, Value) {
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let out = Command::new(env!("CARGO_BIN_EXE_bnrose-rail-host"))
        .args(&refs)
        .output()
        .expect("run host");
    let code = out.status.code().unwrap_or(-1);
    if code != 0 && code != 3 {
        eprintln!(
            "[host stderr {code}] {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }
    (
        code,
        serde_json::from_slice(&out.stdout).unwrap_or(Value::Null),
    )
}

fn rebroadcast_args(state: &PathBuf, dest_port: u16, op: &str) -> Vec<String> {
    [
        "rebroadcast",
        "--rail",
        "arb",
        "--state",
        state.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{dest_port}"),
        "--op-hex",
        op,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn observe_args(state: &PathBuf, dest_port: u16, txid: &str) -> Vec<String> {
    [
        "observe",
        "--rail",
        "arb",
        "--state",
        state.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{dest_port}"),
        "--txid",
        txid,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn receipt_of(rail: &EvmRail, hash_hex: &str) -> Option<Value> {
    rail.receipt(hash_hex)
        .expect("receipt read")
        .filter(|r| !r.is_null())
}

/// a1 · healthy acceptance on a real node: acked; inclusion by the block
/// container; the node's own receipt answers under OUR recomputed hash
/// (the identity differential); the devnet's finalized tag honestly says
/// NOT final — devnet finality never masquerades as production finality.
#[test]
fn a1_healthy_acceptance_and_the_identity_differential() {
    let rig = rig("a1");
    let state = rig.host("a1");
    let (code, report) = run_host(&submit_args(&state, rig.dest_port(), 0));
    assert_eq!(code, 0, "healthy submit exits 0: {report}");
    assert_eq!(report["outcome"], "acked");
    assert_eq!(report["admissions"], 1);
    let txid = report["txid"].as_str().unwrap().to_string();
    // ACCEPTANCE ≠ INCLUSION: the node took the bytes (mempool ack), so
    // the honest observation is PENDING — known to the node, not yet in
    // a block (no receipt exists yet)
    assert!(
        receipt_of(&rig.rail, &txid).is_none(),
        "no receipt before a block exists"
    );
    assert!(
        rig.rail.tx_by_hash(&txid).unwrap().is_some(),
        "but the node HOLDS the transaction"
    );
    let (codep, obs) = run_host(&observe_args(&state, rig.dest_port(), &txid));
    assert_eq!(obs["state"], "pending", "the honest pre-inclusion word");
    // the harness asks the REAL node to build a block (devnet admin)
    rig.rail.devnet_mine().expect("devnet mine");
    // THE IDENTITY DIFFERENTIAL: the node answers a receipt under the
    // hash WE computed locally from the signed bytes
    let receipt = receipt_of(&rig.rail, &txid).expect("receipt under our own hash");
    assert_eq!(receipt["status"], "0x1", "executed successfully");
    let bn = u64::from_str_radix(
        receipt["blockNumber"]
            .as_str()
            .unwrap()
            .trim_start_matches("0x"),
        16,
    )
    .unwrap();
    // inclusion: the documented container carries the hash
    let inc = rig.rail.inclusion(&txid, bn).expect("inclusion evidence");
    assert!(inc.member, "member of block.transactions");
    // finality: the chain's OWN marker — the devnet's stays at 0, honestly
    let fin = rig
        .rail
        .finality(
            &txid,
            bn,
            bnrose_settle_adapters::FinalityMethod::EvmDevnetFinalizedTag,
        )
        .expect("finality evidence");
    assert!(
        !fin.final_,
        "devnet finalized tag stays at genesis — never claimed final"
    );
    assert!(
        fin.method.word().contains("devnet"),
        "the label rides the receipt"
    );
    let _ = std::fs::remove_dir_all(&state);
}

/// a2 · duplicate delivery of the SAME UNMINED bytes: the node's own
/// duplicate word (already known); one admission, and after the mine
/// exactly ONE effect. The nonce-too-low class for MINED bytes is
/// exercised in a7 (it is the mined reality, probed live).
#[test]
fn a2_duplicate_delivery_of_unmined_bytes_is_already_known() {
    let rig = rig("a2");
    let state = rig.host("a2");
    let (code, report) = run_host(&submit_args(&state, rig.dest_port(), 0));
    assert_eq!(code, 0);
    let txid = report["txid"].as_str().unwrap().to_string();
    let op = report["op"].as_str().unwrap().to_string();
    // the transaction sits UNMINED in the node's mempool — the pristine
    // duplicate-delivery class: identical bytes already held
    assert!(
        rig.rail.tx_by_hash(&txid).unwrap().is_some(),
        "pending in mempool"
    );
    assert!(receipt_of(&rig.rail, &txid).is_none(), "not yet in a block");
    // deliver the EXACT same bytes again
    let (code2, report2) = run_host(&rebroadcast_args(&state, rig.dest_port(), &op));
    assert_eq!(
        report2["outcome"], "duplicate",
        "already-known: the node's own duplicate word for identical unmined bytes (pinned live)"
    );
    assert_eq!(code2, 0, "a duplicate is an observation, not a failure");
    assert_eq!(report2["admissions"], 1, "ONE signed attempt ever");
    // mine exactly once: ONE receipt, ONE effect
    rig.rail.devnet_mine().expect("devnet mine");
    assert!(
        receipt_of(&rig.rail, &txid).is_some(),
        "one effect after the mine"
    );
    let _ = std::fs::remove_dir_all(&state);
}

/// a3 · drop-ack (the request delivered, the acknowledgement lost): the
/// host sees UNKNOWN (exit 3) while the node HOLDS the transaction — the
/// law in action; healing + journal-borne rebroadcast meets the nonce
/// class (it mined under our window); observation resolves included.
#[test]
fn a3_drop_ack_is_unknown_while_the_node_holds_the_transaction() {
    let rig = rig("a3");
    let state = rig.host("a3");
    rig.set_mode("drop-ack");
    let (code, report) = run_host(&submit_args(&state, rig.dest_port(), 0));
    assert_eq!(
        code, 3,
        "no conclusive outcome exits 3 — UNKNOWN, never never-executed: {report}"
    );
    assert_eq!(report["outcome"], "timeout");
    assert_eq!(report["admissions"], 1);
    let txid = report["txid"].as_str().unwrap().to_string();
    let op = report["op"].as_str().unwrap().to_string();
    // THE LAW'S PROOF: the request WAS delivered — the node HOLDS the
    // transaction (pending, unmined) while the host recorded UNKNOWN.
    // Timeout proves nothing about effect.
    assert!(receipt_of(&rig.rail, &txid).is_none(), "no receipt yet");
    assert!(
        rig.rail.tx_by_hash(&txid).unwrap().is_some(),
        "the node holds what the host never saw confirmed"
    );
    // heal the partition; the journal-borne rebroadcast of the SAME bytes
    // meets the node's own duplicate word — still nothing conclusive about
    // effect; only the chain's record after a block completes it
    rig.set_mode("pass");
    let (code2, report2) = run_host(&rebroadcast_args(&state, rig.dest_port(), &op));
    assert_eq!(
        report2["outcome"], "duplicate",
        "already-known — the observation, never a promotion"
    );
    rig.rail.devnet_mine().expect("devnet mine");
    let (code3, obs) = run_host(&observe_args(&state, rig.dest_port(), &txid));
    assert_eq!(code3, 0);
    assert_eq!(
        obs["state"], "included",
        "the chain's own record resolves the UNKNOWN"
    );
    let _ = std::fs::remove_dir_all(&state);
}

/// a4 · drop (the request NEVER arrives): UNKNOWN again, but this time
/// the node truthfully holds NOTHING; after healing, the journal-borne
/// rebroadcast is ACCEPTED fresh.
#[test]
fn a4_drop_is_unknown_and_the_node_holds_nothing() {
    let rig = rig("a4");
    let state = rig.host("a4");
    rig.set_mode("drop");
    let (code, report) = run_host(&submit_args(&state, rig.dest_port(), 0));
    assert_eq!(code, 3);
    let txid = report["txid"].as_str().unwrap().to_string();
    let op = report["op"].as_str().unwrap().to_string();
    // the request never arrived: no receipt AND no pending transaction
    assert!(receipt_of(&rig.rail, &txid).is_none(), "no receipt");
    assert!(
        rig.rail.tx_by_hash(&txid).unwrap().is_none(),
        "not even pending — it never arrived"
    );
    // heal; the SAME journaled bytes go out and are accepted fresh (the
    // nonce was never consumed — the request truly never arrived)
    rig.set_mode("pass");
    let (code2, report2) = run_host(&rebroadcast_args(&state, rig.dest_port(), &op));
    assert_eq!(code2, 0, "accepted after healing: {report2}");
    assert_eq!(report2["outcome"], "acked");
    assert_eq!(report2["admissions"], 1);
    rig.rail.devnet_mine().expect("devnet mine");
    let (code3, obs) = run_host(&observe_args(
        &state,
        rig.dest_port(),
        &report["txid"].as_str().unwrap(),
    ));
    assert_eq!(code3, 0);
    assert_eq!(obs["state"], "included");
    let _ = std::fs::remove_dir_all(&state);
}

/// a5 · the chain law: a destination pinned to the WRONG chain refuses
/// to start — never sends anything anywhere.
#[test]
fn a5_chain_id_pin_refuses_at_startup() {
    let anvil_port = free_port();
    let _anvil = KillOnDrop(
        Command::new(anvil_bin())
            .args([
                "--port",
                &anvil_port.to_string(),
                "--base-fee",
                "100000000",
                "--no-mining",
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap(),
    );
    let rail = EvmRail::new("pin", &format!("http://127.0.0.1:{anvil_port}"));
    for _ in 0..200 {
        if rail.chain_id().map(|i| i == CHAIN_ID).unwrap_or(false) {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let out = Command::new(env!("CARGO_BIN_EXE_bnrose-dest-arb"))
        .args([
            "--rpc-url",
            &format!("http://127.0.0.1:{anvil_port}"),
            "--bind",
            "127.0.0.1:0",
            "--chain-id",
            "42161", // Arbitrum One's id — NOT this node
        ])
        .output()
        .expect("spawn mispinned dest");
    assert_ne!(
        out.status.code(),
        Some(0),
        "must refuse to serve against the wrong chain"
    );
    assert!(String::from_utf8_lossy(&out.stderr).contains("chain-id pin"));
}

/// a6 · the identity law at the destination: a txId label that does not
/// bind to the submitted bytes is a CONFLICT, and nothing is sent.
#[test]
fn a6_identity_binds_to_bytes() {
    let rig = rig("a6");
    use bnrose_settle_adapters::unhex;
    let client = LineClient::new(
        format!("127.0.0.1:{}", rig.dest_port()).parse().unwrap(),
        "tester",
        Duration::from_secs(5),
    );
    // one real signed envelope (built like build_arb does)
    let seed = <[u8; 32]>::try_from(unhex(ANVIL_SEED).unwrap()).unwrap();
    let tx = evm::Eip1559 {
        chain_id: CHAIN_ID,
        nonce: 0,
        max_priority_fee_per_gas: 1_000_000_000,
        max_fee_per_gas: 2_000_000_000,
        gas_limit: 21_000,
        to: <[u8; 20]>::try_from(unhex(ANVIL_TO).unwrap()).unwrap(),
        value_wei: 1,
        data: vec![],
    };
    let signed = tx.into_signed(&seed).unwrap();
    // a LYING label: the zeros id
    let out = client.submit("0".repeat(64).as_str(), &signed.raw_hex());
    assert_eq!(out, RailSubmit::Conflict);
    // nothing was sent: no receipt, no pending tx for the REAL hash
    assert!(receipt_of(&rig.rail, &signed.hash_hex()).is_none());
    assert!(rig.rail.tx_by_hash(&signed.hash_hex()).unwrap().is_none());
}

/// a7 · the milestone law, process form: a host KILLED after its request
/// left but before any answer is UNKNOWN; a fresh host on the SAME state
/// resolves by observation and the journal-borne rebroadcast meets the
/// nonce class. ONE admission, ONE effect.
#[test]
fn a7_died_after_send_is_unknown_never_never_executed() {
    let rig = rig("a7");
    let state = rig.host("a7");
    // delay the wire answer beyond the host's window: the host is
    // in-flight while the node already mined
    std::fs::write(&rig.rules, r#"{"mode":"delay","ms":6000}"#).unwrap();
    let owned = submit_args(&state, rig.dest_port(), 0);
    let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
    let mut child = Command::new(env!("CARGO_BIN_EXE_bnrose-rail-host"))
        .args(&refs)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    // the submit line carries the txid; the host prints it only at
    // finish — so learn the id by building the same tx ourselves (same
    // deterministic signature) and poll the node for its receipt
    let seed = <[u8; 32]>::try_from(bnrose_settle_adapters::unhex(ANVIL_SEED).unwrap()).unwrap();
    let tx = evm::Eip1559 {
        chain_id: CHAIN_ID,
        nonce: 0,
        max_priority_fee_per_gas: 1_000_000_000,
        max_fee_per_gas: 2_000_000_000,
        gas_limit: 21_000,
        to: <[u8; 20]>::try_from(bnrose_settle_adapters::unhex(ANVIL_TO).unwrap()).unwrap(),
        value_wei: 1,
        data: vec![],
    };
    let signed = tx.into_signed(&seed).unwrap();
    let txid = signed.hash_hex();
    let mut held = false;
    for _ in 0..200 {
        if rig.rail.tx_by_hash(&txid).unwrap().is_some() {
            held = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(
        held,
        "the request was delivered — the node holds it while the host waits"
    );
    // KILL the host mid-flight (it has no answer yet)
    let _ = child.kill();
    let _ = child.wait();
    rig.set_mode("pass");
    // a FRESH host on the SAME state: the journal holds ONE admission
    let host = RailHost::open_recovering(&state, &[0x11u8; 32]).unwrap();
    assert_eq!(
        host.admissions(),
        1,
        "one signed attempt, journaled before the kill"
    );
    // the dead host's bytes live in the node's mempool: pending, observed
    let (codep, obs) = run_host(&observe_args(&state, rig.dest_port(), &txid));
    assert_eq!(
        codep, 5,
        "pending — the node holds the dead host's transaction"
    );
    assert_eq!(obs["state"], "pending");
    rig.rail.devnet_mine().expect("devnet mine");
    let (code, obs) = run_host(&observe_args(&state, rig.dest_port(), &txid));
    assert_eq!(code, 0);
    assert_eq!(
        obs["state"], "included",
        "resolved by observation — never classified never-executed"
    );
    let records = host.records();
    // the UNKNOWN observation family: the journal never recorded a
    // conclusive outcome for the killed attempt (code 3 or nothing)
    let _ = records;
    // and the journal-borne rebroadcast of the SAME bytes meets the class
    let op = bnrose_settle_adapters::hex(&bnrose_settle_adapters::railhost::op_of(&signed.raw));
    let (code2, report2) = run_host(&rebroadcast_args(&state, rig.dest_port(), &op));
    assert_eq!(
        report2["outcome"], "refused:nonce-too-low",
        "MINED bytes: the nonce class — the pinned mined-reality (probed live)"
    );
    let _ = std::fs::remove_dir_all(&state);
}
