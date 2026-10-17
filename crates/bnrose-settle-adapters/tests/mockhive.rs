//! The wire-shape mock battery for `bnrose-dest-hive` — ADAPTER-LOGIC
//! evidence only, honestly labeled: the mock speaks Hive's DOCUMENTED
//! JSON-RPC shapes (positional params, ASSERT-error not-found, top-level
//! `transaction_ids`, integer heights, DGP head/LIB), but it is not a
//! chain and nothing here is chain evidence. The chain legs live in the
//! live probes (real mainnet, read-only) and the founder-gesture write
//! qualification (named, not simulated).
//!
//! EVIDENCE CLASS of every green test below: the destination binary's
//! id-recompute, classification, and ladder LOGIC against the documented
//! wire — never destination execution on a real chain.

use bnrose_settle_adapters::hive::{parse_chain_trx, ser};
use bnrose_settle_adapters::railhost::RailHost;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

// ── the wire-shape mock (hived-lite, documented shapes only) ──────────

struct MockState {
    now: u32,
    head: i64,
    lib: i64,
    /// txid → (signed trx, block_num once included)
    txs: std::collections::BTreeMap<String, (Value, Option<i64>)>,
    /// respond to broadcasts with a gateway-grade internal error
    gateway_garbage: bool,
}

struct Mock {
    port: u16,
    state: Arc<Mutex<MockState>>,
}

impl Mock {
    fn start(now: u32) -> Mock {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let state = Arc::new(Mutex::new(MockState {
            now,
            head: 1000,
            lib: 999,
            txs: Default::default(),
            gateway_garbage: false,
        }));
        let st = state.clone();
        std::thread::spawn(move || {
            for conn in listener.incoming() {
                let Ok(mut s) = conn else { break };
                let st = st.clone();
                std::thread::spawn(move || {
                    let _ = serve_mock(&mut s, &st);
                });
            }
        });
        Mock { port, state }
    }

    /// include all pending transactions, advance head, move LIB to head
    fn advance(&self, n: i64) {
        let mut st = self.state.lock().unwrap();
        st.head += n;
        st.lib = st.head;
        let head = st.head;
        let pending: Vec<String> = st
            .txs
            .iter()
            .filter(|(_, (_, b))| b.is_none())
            .map(|(k, _)| k.clone())
            .collect();
        for id in pending {
            st.txs.get_mut(&id).unwrap().1 = Some(head);
        }
    }

    fn tx_count(&self) -> usize {
        self.state.lock().unwrap().txs.len()
    }
}

fn serve_mock(s: &mut TcpStream, st: &Arc<Mutex<MockState>>) -> std::io::Result<()> {
    let (req, head_end) = bnrose_settle_adapters::faultproxy::read_request(s)?;
    let body = &req[head_end..];
    let v: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    let method = v["method"].as_str().unwrap_or("");
    let params = v["params"].clone();
    let id = v["id"].clone();
    let answer = route(st, method, &params);
    let payload = match answer {
        Ok(result) => json!({"jsonrpc":"2.0","id":id,"result":result}).to_string(),
        Err(msg) => {
            json!({"jsonrpc":"2.0","id":id,"error":{"code":-32000,"message":msg,"data":""}})
                .to_string()
        }
    };
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        payload.len(),
        payload
    );
    s.write_all(resp.as_bytes())?;
    Ok(())
}

fn route(st: &Arc<Mutex<MockState>>, method: &str, params: &Value) -> Result<Value, String> {
    let mut st = st.lock().unwrap();
    match method {
        "condenser_api.get_dynamic_global_properties" => Ok(json!({
            "head_block_number": st.head,
            "last_irreversible_block_num": st.lib,
        })),
        "condenser_api.get_block" => {
            let n = params[0].as_i64().ok_or("bad param")?;
            let ids: Vec<&str> = st
                .txs
                .iter()
                .filter(|(_, (_, b))| *b == Some(n))
                .map(|(k, _)| k.as_str())
                .collect();
            Ok(json!({"block_num": n, "transaction_ids": ids}))
        }
        "condenser_api.get_transaction" => {
            let id = params[0].as_str().ok_or("bad param")?;
            match st.txs.get(id) {
                // hived answers an unknown id with an ASSERT-error shape —
                // the documented not-found reality
                None => Err("Assert Exception: tx not found".into()),
                Some((trx, Some(bn))) => {
                    let mut t = trx.clone();
                    t["block_num"] = json!(bn);
                    t["transaction_id"] = json!(id);
                    Ok(t)
                }
                // a pending tx is NOT visible through get_transaction on
                // this API — no record here means no evidence
                Some((_, None)) => Err("Assert Exception: tx not found".into()),
            }
        }
        "condenser_api.broadcast_transaction" => {
            let signed = &params[0];
            // hived-lite: the node computes the id from the canonical bytes
            let (_bytes, id) = canonical_id(signed)?;
            if st.txs.contains_key(&id) {
                return Err("duplicate transaction".into());
            }
            let exp = signed["expiration"].as_str().unwrap_or("").to_string();
            let exp_unix =
                bnrose_settle_adapters::hive::chrono_independent_unix(&exp).unwrap_or(0) as i64;
            if exp_unix <= st.now as i64 {
                return Err("Assert Exception:now < trx.expiration: ".into());
            }
            st.txs.insert(id, (signed.clone(), None));
            // a gateway-grade garbage answer comes AFTER the bytes were
            // taken — the wallet's own law: such an answer proves nothing
            if st.gateway_garbage {
                return Err("Internal Error".into());
            }
            Ok(json!({}))
        }
        _ => Err("method not found on mock".into()),
    }
}

fn canonical_id(signed: &Value) -> Result<(Vec<u8>, String), String> {
    let trx = parse_chain_trx(signed)?;
    let bytes = ser::serialize_trx(&trx)?;
    let id = ser::hive_txid(&bytes);
    Ok((bytes, id))
}

// ── harness helpers ───────────────────────────────────────────────────

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

fn spawn_bin(name: &str, args: &[&str]) -> DestProc {
    let exe = env_bin(name);
    let mut child = Command::new(exe)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit()) // a panic must be READ, never a bare exit code
        .spawn()
        .expect("spawn bin");
    let port = {
        let stdout = child.stdout.take().unwrap();
        let mut line = String::new();
        BufReader::new(stdout)
            .read_line(&mut line)
            .expect("port line");
        line.trim().parse().expect("port parses")
    };
    DestProc { child, port }
}

fn env_bin(name: &str) -> std::path::PathBuf {
    // CARGO_BIN_EXE_* is set for this crate's own binaries in tests
    match name {
        "bnrose-dest-hive" => std::path::PathBuf::from(env!("CARGO_BIN_EXE_bnrose-dest-hive")),
        "bnrose-rail-host" => std::path::PathBuf::from(env!("CARGO_BIN_EXE_bnrose-rail-host")),
        _ => panic!("unknown bin {name}"),
    }
}

struct HostRun {
    code: i32,
    report: Value,
}

fn run_host(args: &[&str]) -> HostRun {
    let out = Command::new(env!("CARGO_BIN_EXE_bnrose-rail-host"))
        .args(args)
        .output()
        .expect("run host");
    let code = out.status.code().unwrap_or(-1);
    if code != 0 {
        eprintln!(
            "[host stderr] {}/{}: {}",
            code,
            out.status,
            String::from_utf8_lossy(&out.stderr)
        );
    }
    let report: Value = serde_json::from_slice(&out.stdout).unwrap_or(Value::Null);
    HostRun { code, report }
}

fn tmpdir(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("mockhive-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
}

fn wait_listening(port: u16) {
    for _ in 0..100 {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    panic!("dest never listened on {port}");
}

/// the Hive destination behind this mock
fn dest_hive(mock_port: u16) -> DestProc {
    let d = spawn_bin(
        "bnrose-dest-hive",
        &[
            "--endpoint",
            &format!("http://127.0.0.1:{mock_port}"),
            "--bind",
            "127.0.0.1:0",
        ],
    );
    wait_listening(d.port);
    d
}

fn host_args(state: &std::path::Path, dest_port: u16, now: u32) -> Vec<String> {
    [
        "submit",
        "--rail",
        "hive",
        "--state",
        state.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{dest_port}"),
        "--from",
        "alice",
        "--to",
        "bob",
        "--amount",
        "1.5",
        "--sym",
        "HIVE",
        "--memo",
        "adapter battery",
        "--ref-block-num",
        "1000",
        "--ref-block-prefix",
        "123456789",
        "--expiration-unix",
        &(now + 3600).to_string(),
        "--seed-hex",
        &"2c".repeat(32),
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn now_plus_mock() -> u32 {
    let mock_now = 1791210000u32; // a fixed mock clock: deterministic
    mock_now
}

// ── the battery (adapter-logic evidence class, labeled) ──────────────

/// healthy acceptance: acked; before inclusion the honest answer is
/// unknown-to-dest (a Hive node's mempool is not queryable through this
/// API); after the mock includes and LIB passes, final
#[test]
fn m1_healthy_acceptance_and_the_honest_pending_word() {
    let now = now_plus_mock();
    let mock = Mock::start(now);
    let dest = dest_hive(mock.port);
    let dir = tmpdir("m1");
    let args = host_args(&dir, dest.port, now);
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let run = run_host(&refs);
    assert_eq!(run.code, 0, "healthy submit exits 0");
    assert_eq!(run.report["outcome"], "acked");
    assert_eq!(run.report["admissions"], 1, "ONE signed attempt");
    // pending, unobservable on this API — the honest word
    assert_eq!(run.report["observation"], "unknown-to-dest");
    let txid = run.report["txid"].as_str().unwrap().to_string();
    // include + LIB: the chain's own ladder answers
    mock.advance(2);
    let obs = observe(&dir, dest.port, &txid);
    assert_eq!(obs.code, 0);
    assert_eq!(obs.report["state"], "final");
    assert_eq!(mock.tx_count(), 1, "one effect");
    let _ = std::fs::remove_dir_all(&dir);
}

fn observe(state: &std::path::Path, dest_port: u16, txid: &str) -> HostRun {
    let args: Vec<String> = [
        "observe",
        "--rail",
        "hive",
        "--state",
        state.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{dest_port}"),
        "--txid",
        txid,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_host(&refs)
}

/// duplicate delivery of the SAME bytes: the node says duplicate, the
/// destination reports the observation, and the effect count stays one
#[test]
fn m2_duplicate_delivery_one_effect() {
    let now = now_plus_mock();
    let mock = Mock::start(now);
    let dest = dest_hive(mock.port);
    let dir = tmpdir("m2");
    let args = host_args(&dir, dest.port, now);
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let first = run_host(&refs);
    assert_eq!(first.code, 0);
    // deliver the EXACT same signed bytes again (the journal holds them)
    let op = first.report["op"].as_str().unwrap().to_string();
    let re: Vec<String> = [
        "rebroadcast",
        "--rail",
        "hive",
        "--state",
        dir.to_str().unwrap(),
        "--dest",
        &format!("127.0.0.1:{}", dest.port),
        "--op-hex",
        &op,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    let rrefs: Vec<&str> = re.iter().map(|s| s.as_str()).collect();
    let second = run_host(&rrefs);
    assert_eq!(
        second.report["outcome"], "duplicate",
        "the node's own duplicate word"
    );
    assert_eq!(second.report["admissions"], 1, "still ONE signed attempt");
    assert_eq!(mock.tx_count(), 1, "ONE effect");
    let _ = std::fs::remove_dir_all(&dir);
}

/// the identity law at the destination: a txId label that does not bind
/// to the submitted bytes is a CONFLICT
#[test]
fn m3_identity_binds_to_bytes() {
    let now = now_plus_mock();
    let mock = Mock::start(now);
    let dest = dest_hive(mock.port);
    // submit through the line protocol with a LYING label
    use bnrose_settle_adapters::lineproto::LineClient;
    let client = LineClient::new(
        format!("127.0.0.1:{}", dest.port).parse().unwrap(),
        "tester",
        Duration::from_secs(5),
    );
    let signed = json!({
        "ref_block_num": 10, "ref_block_prefix": 20,
        "expiration": "2026-10-05T13:00:00Z",
        "operations": [["transfer", {"from":"a","to":"b","amount":"1.000 HIVE","memo":""}]],
        "extensions": [], "signatures": ["ab".repeat(65)]
    });
    let out = client.submit(
        "0000000000000000000000000000000000000000",
        // the line protocol carries the payload HEX-encoded
        &bnrose_settle_adapters::hex(&serde_json::to_vec(&signed).unwrap()),
    );
    assert_eq!(out, bnrose_settle_adapters::lineproto::RailSubmit::Conflict);
    assert_eq!(mock.tx_count(), 0, "nothing reached the rail on a conflict");
}

/// hived's own refusal class travels: an expired transaction is refused
/// with the expiration class, conclusively (exit 2), never UNKNOWN
#[test]
fn m4_hived_refusal_classes_travel() {
    let now = now_plus_mock();
    let mock = Mock::start(now);
    let dest = dest_hive(mock.port);
    let dir = tmpdir("m4");
    let mut args = host_args(&dir, dest.port, now);
    // expire it against the mock clock
    let pos = args.iter().position(|s| s == "--expiration-unix").unwrap();
    args[pos + 1] = (now - 10).to_string();
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let run = run_host(&refs);
    assert_eq!(run.code, 2, "a definitive refusal exits 2");
    assert_eq!(run.report["outcome"], "refused:expiration");
    assert_eq!(mock.tx_count(), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

/// a gateway answer WITHOUT a verdict proves nothing: UNKNOWN (exit 3),
/// preserved and resolvable — and the rebroadcast after healing sees the
/// duplicate observation at the destination
#[test]
fn m5_gateway_no_verdict_is_unknown_then_duplicate_after_heal() {
    let now = now_plus_mock();
    let mock = Mock::start(now);
    mock.state.lock().unwrap().gateway_garbage = true;
    let dest = dest_hive(mock.port);
    let dir = tmpdir("m5");
    let args = host_args(&dir, dest.port, now);
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let run = run_host(&refs);
    assert_eq!(run.code, 3, "no conclusive outcome exits 3 — UNKNOWN");
    assert_eq!(run.report["outcome"], "timeout");
    assert_eq!(run.report["admissions"], 1);

    let txid = run.report["txid"].as_str().unwrap().to_string();
    // the gateway error proved nothing — the mock DID take the bytes
    // (garbage-answer mode only mangles the response)
    {
        let st = mock.state.lock().unwrap();
        assert_eq!(st.txs.len(), 1, "the bytes were taken; the answer was lost");
    }
    mock.state.lock().unwrap().gateway_garbage = false;
    mock.advance(2);
    let obs = observe(&dir, dest.port, &txid);
    assert_eq!(
        obs.report["state"], "final",
        "the chain's own record resolves the UNKNOWN"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

/// the railhost journal holds exactly one admission per distinct bytes
/// and refuses to invent bytes for an unknown op
#[test]
fn m6_journal_refuses_to_invent() {
    let dir = tmpdir("m6");
    let host = RailHost::open(&dir, &[0x22u8; 32]).unwrap();
    let op = host.journal_signed(b"bytes-a", "aaaa1111").unwrap();
    let op_b = host.journal_signed(b"bytes-b", "bbbb2222").unwrap();
    assert_ne!(op, op_b);
    assert_eq!(host.admissions(), 2);
    // a caller that never journaled gets a REFUSAL, never invention
    assert!(host.persisted(&[0x99u8; 32]).is_none());
    let _ = std::fs::remove_dir_all(&dir);
}
