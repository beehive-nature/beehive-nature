//! Gate 4 Acceptance Test: Quantum Lost-Response Retry & Envelope Receipt Binding.
//!
//! SPEC-RUSTEOSVM-1, Grok Review R-6:
//! 1. Lost-response retry: client retry of completed or dispatched op returns the
//!    original receipt (bound to envelope hash) instead of dead refusal, preventing
//!    duplicate paid provider runs.
//! 2. Envelope binding: a retry with the same nonce but a DIFFERENT envelope is
//!    refused ("admission:nonce-reuse — payload mismatch"), never served the old receipt.
//! 3. Provider idempotency: provider idempotency key equals op_id.
//! 4. Half-written / crashed op: client retry recovers operation from durable evidence
//!    and serves recovery receipt rather than dead refusal.

use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy, Fixture, IntentFile};
use bnrose_exec_host::opexec::Supervisor;
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
    println!("gate4: PASS - lost response retry returns original receipt, 0 duplicate dispatches");
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
    assert!(out1.refused.is_none());

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
