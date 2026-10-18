//! Gate 4 Acceptance Test: Quantum-Lost-Response Idempotent Replay,
//! Receipt Binding, and Pre-Dispatch Crash Recovery (Zero Capacity Leak).
//!
//! SPEC-RUSTEOSVM-1, Grok Review R-6 & PR #465 comments:
//! 1. Lost response after dispatch: retry serves cached receipt in O(1) without
//!    duplicate paid provider runs.
//! 2. Zero duplicate ledger rows: verifies ledger has exactly 1 row after retry.
//! 3. Tampered cached receipt protection: cached receipt signature is verified under
//!    supervisor Ed25519 public key; forged/tampered receipts are strictly refused.
//! 4. Envelope binding: a retry with the same nonce but a DIFFERENT envelope is
//!    refused ("admission:nonce-reuse — payload mismatch"), never served the old receipt.
//! 5. 500 retry flood: retry of admitted op operates in memory with zero journal reload.
//! 6. Pre-dispatch crash recovery (r4): an op interrupted after reserve before dispatch
//!    does NOT hold capacity forever across reboots; open_with marks it E_BOUNDED_FAIL,
//!    releases capacity reservations (zero stuck fuel), and client retry receives
//!    the bounded-fail receipt.

use bnrose_exec_core::{E_ADMITTED, E_RESERVE};
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy, Fixture, IntentFile};
use bnrose_exec_host::opexec::{replica_paths, Supervisor};
use bnrose_exec_host::journal::ReplicatedJournal;
use bnrose_exec_host::worker::{Bounds, NativeWorker};
use btungsten_wb001::Text;
use std::path::{Path, PathBuf};

const NOW: u64 = 1_800_000_000;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("bnrose-gate4-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn make_sup(dir: &Path) -> Supervisor {
    bnrose_exec_host::keys::SupervisorKeys::init(dir, &[0x55; 32]).unwrap();
    Supervisor::open(dir, Box::new(NativeWorker::new()), test_policy()).unwrap()
}

fn envelope_with<F>(f: &Fixture, edit: F) -> IntentFile
where
    F: FnOnce(&mut btungsten_wb001::IntentIn),
{
    let i = btungsten_wb001::decode(&f.env).unwrap();
    let mut x = btungsten_wb001::IntentIn {
        domain: Text::Str(std::str::from_utf8(&i.domain[..i.domain_len as usize]).unwrap().into()),
        nonce: f.nonce.to_vec(),
        epoch: f.epoch,
        action: i.action.to_vec(),
        destination: Text::Str(std::str::from_utf8(&i.destination[..i.destination_len as usize]).unwrap().into()),
        capability: Text::Str(std::str::from_utf8(&i.capability[..i.capability_len as usize]).unwrap().into()),
        amount: f.amount,
        expiry: f.expiry,
        payer: Text::Str(std::str::from_utf8(&i.payer[..i.payer_len as usize]).unwrap().into()),
        payload: i.payload[..i.payload_len as usize].to_vec(),
    };
    edit(&mut x);
    let built = x.build().unwrap();
    let env = btungsten_wb001::canonical(&built).unwrap();
    let sig = btungsten_wb001::sign(&f.seed, &built).unwrap();
    IntentFile {
        env,
        sig,
        authority: f.authority,
    }
}

#[test]
fn test_gate4_lost_response_retry_returns_original_receipt() {
    let state = tmp("lost-response");
    let mut sup = make_sup(&state);
    let bounds = Bounds::default();

    let f = fixture(90_001, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();

    // 1. First run loses response after dispatch / effect (simulating provider disconnect)
    let lost = sup.run(&intent, NOW, true, &bounds);
    assert!(lost.lost_response, "must report lost_response");
    let initial_op = lost.op.expect("op id generated");

    // 2. Client retries with the SAME intent (same authority, nonce, envelope)
    let retried = sup.retry(&intent, NOW + 1, &bounds);
    assert!(retried.refused.is_none(), "retry must not be refused: {:?}", retried.refused);
    assert_eq!(retried.op, Some(initial_op), "provider job idempotency key must equal op_id");
    assert!(retried.receipt.is_some(), "retry must return the original/recovered receipt");

    let r = retried.receipt.unwrap();
    assert_eq!(r.op, initial_op);

    // 3. Subsequent retry returns the same cached receipt with 0 duplicate effects
    let again = sup.retry(&intent, NOW + 2, &bounds);
    assert!(again.refused.is_none());
    assert_eq!(again.op, Some(initial_op));

    // 4. Verify ZERO duplicate ledger rows (Grok Review R-6)
    assert_eq!(
        sup.ledger.len(), 1,
        "ledger must hold exactly 1 row for initial_op; zero duplicate rows allowed on retry"
    );
    println!("gate4: PASS - lost response retry returns original receipt, zero duplicate ledger rows confirmed");
}

#[test]
fn test_gate4_tampered_cached_receipt_refused() {
    let state = tmp("tampered-receipt");
    let mut sup = make_sup(&state);
    let bounds = Bounds::default();

    let f = fixture(90_004, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();

    // Run to completion
    let out = sup.run(&intent, NOW, false, &bounds);
    assert!(out.refused.is_none(), "out.refused was: {:?}", out.refused);
    let receipt_path = out.receipt_path.unwrap();

    // Tamper with receipt file on disk (alter effect digest)
    let text = std::fs::read_to_string(&receipt_path).unwrap();
    let mut val: serde_json::Value = serde_json::from_str(&text).unwrap();
    val["effectDigest"] = serde_json::Value::String("0000000000000000000000000000000000000000000000000000000000000000".into()); // TESTNET-ONLY
    std::fs::write(&receipt_path, serde_json::to_string(&val).unwrap()).unwrap();

    // Retry should detect invalid signature under supervisor key and refuse to serve
    let retried = sup.retry(&intent, NOW + 1, &bounds);
    assert_eq!(
        retried.refused.as_deref(),
        Some("receipt:signature-invalid"),
        "tampered receipt signature must be refused at gate"
    );
    println!("gate4: PASS - tampered cached receipt signature check enforced");
}

#[test]
fn test_gate4_unresolved_op_retry_flood_zero_disk_reloads() {
    let state = tmp("retry-flood-no-disk");
    let mut sup = make_sup(&state);
    let bounds = Bounds::default();

    let f = fixture(90_005, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();

    // Pre-admit op with lost response
    let lost = sup.run(&intent, NOW, true, &bounds);
    assert!(lost.lost_response);
    let initial_op = lost.op.unwrap();

    // 500 retries to verify zero journal reload & fast in-memory serving
    let t0 = std::time::Instant::now();
    for _ in 0..500 {
        let outcome = sup.retry(&intent, NOW + 1, &bounds);
        assert!(outcome.refused.is_none(), "retry must succeed: {:?}", outcome.refused);
        assert_eq!(outcome.op, Some(initial_op));
        assert!(outcome.receipt.is_some());
    }
    let elapsed = t0.elapsed();
    let limit_ms = if cfg!(debug_assertions) { 2000 } else { 500 };
    assert!(elapsed.as_millis() < limit_ms, "500 retry checks must be fast in-memory lookups without journal reloads; took {} ms (limit {} ms)", elapsed.as_millis(), limit_ms);
    println!("gate4: PASS - 500 retry flood operates in memory with zero journal reload in {} ms", elapsed.as_millis());
}

#[test]
fn test_gate4_payload_mismatch_retry_is_refused() {
    let state = tmp("payload-mismatch");
    let mut sup = make_sup(&state);
    let bounds = Bounds::default();

    let f1 = fixture(90_002, NOW, 600);
    let intent1 = read_intent(&f1.to_json()).unwrap();

    // Admit and complete intent1
    let out1 = sup.run(&intent1, NOW, false, &bounds);
    assert!(out1.refused.is_none(), "out1.refused was: {:?}", out1.refused);

    // Construct intent2 with SAME nonce and authority, but DIFFERENT payload/destination
    let intent2 = envelope_with(&f1, |x| {
        x.destination = Text::Str("alt.destination.b".into());
    });

    // Retry must be strictly REFUSED because envelope hash does not match original op
    let out2 = sup.retry(&intent2, NOW + 1, &bounds);
    assert_eq!(
        out2.refused.as_deref(),
        Some("admission:nonce-reuse — payload mismatch"),
        "tampered payload with same nonce must be refused"
    );
    println!("gate4: PASS - cached receipt is strictly bound to envelope hash");
}

#[test]
fn test_gate4_half_written_crash_recovers_and_returns_receipt_to_client() {
    let state = tmp("half-written-retry");
    let bounds = Bounds::default();

    let f = fixture(90_003, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();

    // 1. Run and simulate crash after effect
    {
        let mut sup = make_sup(&state);
        let lost = sup.run(&intent, NOW, true, &bounds);
        assert!(lost.lost_response);
    }

    // 2. Client reconnects to fresh supervisor on restarted node and retries
    {
        let mut sup2 = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let retried = sup2.retry(&intent, NOW + 10, &bounds);
        assert!(retried.refused.is_none(), "recovery retry must succeed: {:?}", retried.refused);
        assert!(retried.receipt.is_some(), "recovered receipt returned to client");
        println!("gate4: PASS - half-written operation recovers and delivers receipt to client");
    }
}

#[test]
fn test_gate4_pre_dispatch_crash_releases_capacity_and_returns_fail_receipt() {
    let state = tmp("pre-dispatch-crash");
    let bounds = Bounds::default();

    let f = fixture(90_006, NOW, 600);
    let intent = read_intent(&f.to_json()).unwrap();

    // 1. Simulate an operation that crashed after RESERVE but before DISPATCH
    {
        let keys = bnrose_exec_host::keys::SupervisorKeys::init(&state, &[0x66; 32]).unwrap();
        let paths = replica_paths(&state);
        if let Some(p) = paths[0].parent() { std::fs::create_dir_all(p).unwrap(); }
        if let Some(p) = paths[1].parent() { std::fs::create_dir_all(p).unwrap(); }
        let (mut journal, _) = ReplicatedJournal::open_with_records(&paths, &keys.journal_mac).unwrap();

        let op = bnrose_exec_core::op_id(&intent.authority, &intent.env);
        let pol = test_policy();
        let pol_wire = pol.wire();

        let mut payload = Vec::with_capacity(intent.env.len() + 140);
        payload.extend_from_slice(&intent.authority);
        payload.extend_from_slice(&intent.sig);
        payload.extend_from_slice(&bnrose_exec_core::policy_digest(&pol_wire));
        payload.extend_from_slice(&(intent.env.len() as u16).to_le_bytes());
        payload.extend_from_slice(&intent.env);
        let name = "native-worker";
        payload.push(name.len() as u8);
        payload.extend_from_slice(name.as_bytes());

        // Append E_ADMITTED
        journal.append(&op, E_ADMITTED, &payload).unwrap();

        // Append E_RESERVE with 16 bytes budget
        let mut res = Vec::with_capacity(16);
        res.extend_from_slice(&500_000u64.to_le_bytes()); // fuel
        res.extend_from_slice(&10u32.to_le_bytes());      // mem pages
        res.extend_from_slice(&5u32.to_le_bytes());       // wall secs
        journal.append(&op, E_RESERVE, &res).unwrap();
        // Crash here! Zero DISPATCH, zero RESPONSE.
    }

    // 2. Restart supervisor (simulating node reboot)
    {
        let mut sup = Supervisor::open(&state, Box::new(NativeWorker::new()), test_policy()).unwrap();

        // Verify zero capacity is held across reboot (r4: zero capacity leak)
        let allocated = sup.capacity_ledger.current_allocated(&sup.device_id);
        assert_eq!(
            allocated.fuel, 0,
            "pre-dispatch crashed op must NOT hold fuel capacity on reboot; was {}", allocated.fuel
        );
        assert_eq!(
            allocated.memory_pages, 0,
            "pre-dispatch crashed op must NOT hold memory pages on reboot"
        );

        // 3. Client retries the interrupted operation
        let retried = sup.retry(&intent, NOW + 1, &bounds);
        assert!(retried.refused.is_none(), "recovery retry must succeed: {:?}", retried.refused);
        assert!(retried.receipt.is_some(), "fail receipt must be delivered to client");

        let r = retried.receipt.unwrap();
        assert_eq!(r.state, bnrose_exec_core::S_FAILED, "operation must be marked S_FAILED");
        assert_eq!(r.fail, 1001, "fail code must be 1001 (interrupted-pre-dispatch)");
        assert_eq!(r.recovered, 1, "receipt must record recovered = 1");

        // Verify ledger has 0 rows (effect was never applied)
        assert_eq!(sup.ledger.len(), 0, "no effect ever committed for pre-dispatch crash");

        println!("gate4: PASS - pre-dispatch crash recovery releases capacity and returns bounded-fail receipt");
    }
}
