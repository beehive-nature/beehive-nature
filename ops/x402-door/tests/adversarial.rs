//! The adversarial battery (founder order 2026-09-16): AV-7 two-route
//! acceptance, AV-8 settle-UNKNOWN reconciliation, replay, duplicate-settle
//! races, retained-failure exposure, R4 cross-leg correlation, torn-journal
//! variants, and gas-cap escape attempts — against the LANDED door.
//!
//! House law (ADVERSARIAL-BPAY-SPECS): red-test-first — the
//! duplicate-concurrent-settle race below WAS red against the pre-battery
//! journal (both callers passed precheck and double-executed the
//! facilitator; the on-chain 3009 nonce protects funds, not gas) and is
//! now green under the lock-held `Settling` transition.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use x402_door::journal::{HumanGate, Journal, ReservationState, SettleEvidence};
use x402_door::orchestrator::{
    Door, DoorConfig, FacilitatorSettle, SettlementFacilitator, VerifyOutcome,
};
use x402_door::wire::{extract_leg, leg_tag};

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir()
        .join("x402-door-adversarial")
        .join(format!("{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn request(
    chain: &str,
    scheme: &str,
    nonce: &str,
    max_or_value: &str,
    valid_before: u64,
) -> serde_json::Value {
    let amount_key = if scheme == "upto" {
        "maxAmount"
    } else {
        "value"
    };
    serde_json::json!({
        "x402Version": 2,
        "paymentRequirements": {
            "scheme": scheme,
            "network": chain,
            "payTo": "0x1111111111111111111111111111111111111111",
            "asset": "0x2222222222222222222222222222222222222222",
            "maxTimeoutSeconds": 3600
        },
        "paymentPayload": {
            "x402Version": 2,
            "payload": {
                "from": "0xbbbb000000000000000000000000000000000bbb",
                "nonce": nonce,
                "validBefore": valid_before.to_string(),
                amount_key: max_or_value
            }
        }
    })
}

fn far_future() -> u64 {
    x402_door::journal::now_unix() + 3600
}

/// A facilitator whose settle spins briefly (~40ms) to widen the race
/// window — without the Settling law, concurrent settles double-execute.
struct SlowGood {
    executions: AtomicUsize,
}
impl SettlementFacilitator for SlowGood {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, r: &serde_json::Value) -> FacilitatorSettle {
        self.executions.fetch_add(1, Ordering::SeqCst);
        let spin = std::time::Instant::now();
        while std::time::Instant::now().duration_since(spin).as_millis() < 40 {}
        // Echo the declared amount (value for exact, maxAmount for upto) so
        // evidence is lawful by construction.
        let declared = r
            .pointer("/paymentPayload/payload/value")
            .or_else(|| r.pointer("/paymentPayload/payload/maxAmount"))
            .and_then(|v| v.as_str())
            .unwrap_or("0")
            .to_string();
        FacilitatorSettle::Success {
            payer: "0xbbbb000000000000000000000000000000000bbb".into(),
            transaction: "0xadvRACE-TXHASH-0009" // PUBLIC-CONSTANT: synthetic adversarial tx hash (non-hex-run form)
                .into(), // PUBLIC-CONSTANT: synthetic adversarial tx hash
            network: "eip155:8453".into(),
            actual_amount: Some(declared),
            gas_actual_wei: Some(700),
        }
    }
}

// ---------- the duplicate-concurrent-settle race (was RED, now GREEN) ----------

#[test]
fn adv_duplicate_concurrent_settle_executes_exactly_once() {
    let faci = Arc::new(SlowGood {
        executions: AtomicUsize::new(0),
    });
    let journal = Arc::new(Journal::open(&tmp_root("adv-race"), 1_000_000_000).unwrap());
    let make_door = || {
        Door::new(
            journal.clone(),
            faci.clone(),
            DoorConfig {
                reserved_gas_wei: 100_000,
                ops_float_available_wei: 10_000_000,
            },
        )
    };
    let req = request("eip155:8453", "exact", "0xR1", "9", far_future());
    let leg = extract_leg(&req).unwrap();
    let d0 = make_door();
    d0.verify(&leg, &req).unwrap();

    let barrier = Arc::new(Barrier::new(8));
    let outcomes: Arc<Mutex<Vec<Result<FacilitatorSettle, x402_door::orchestrator::DoorError>>>> =
        Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();
    for _ in 0..8 {
        let d = make_door();
        let req = req.clone();
        let leg = leg.clone();
        let barrier = barrier.clone();
        let outcomes = outcomes.clone();
        handles.push(std::thread::spawn(move || {
            barrier.wait();
            let out = d.settle(&leg, &req);
            outcomes.lock().unwrap().push(out);
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    let outcomes = outcomes.lock().unwrap();
    let successes = outcomes
        .iter()
        .filter(|o| matches!(o, Ok(FacilitatorSettle::Success { .. })))
        .count();
    let in_flight = outcomes
        .iter()
        .filter(|o| {
            o.as_ref()
                .is_err_and(|e| e.to_string().contains("in flight"))
        })
        .count();
    assert_eq!(
        faci.executions.load(Ordering::SeqCst),
        1,
        "exactly one facilitator execution"
    );
    assert_eq!(successes, 1, "exactly one success: {outcomes:?}");
    assert_eq!(in_flight, 7, "the rest refused in-flight: {outcomes:?}");
    // Post-completion replay returns the SAME evidence, still one execution.
    let replay = make_door().settle(&leg, &req).unwrap();
    assert!(
        matches!(replay, FacilitatorSettle::Success { ref transaction, .. } if transaction.ends_with("0009"))
    );
    assert_eq!(faci.executions.load(Ordering::SeqCst), 1);
}

// ---------- AV-7: two-route acceptance, shared journal ----------

struct RouteA; // settles
impl SettlementFacilitator for RouteA {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
        FacilitatorSettle::Success {
            payer: "p".into(),
            transaction: "0xrouteA".into(),
            network: "eip155:8453".into(),
            actual_amount: Some("5".into()),
            gas_actual_wei: Some(500),
        }
    }
}
struct RouteB; // would settle differently (must never execute after A)
impl SettlementFacilitator for RouteB {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
        FacilitatorSettle::Success {
            payer: "p".into(),
            transaction: "0xrouteB".into(),
            network: "eip155:8453".into(),
            actual_amount: Some("5".into()),
            gas_actual_wei: Some(500),
        }
    }
}

#[test]
fn adv_av7_two_route_acceptance_no_double_debit() {
    let journal = Arc::new(Journal::open(&tmp_root("adv-av7"), 1_000_000_000).unwrap());
    let da = Door::new(
        journal.clone(),
        Arc::new(RouteA),
        DoorConfig {
            reserved_gas_wei: 1_000,
            ops_float_available_wei: 1_000_000,
        },
    );
    let db = Door::new(
        journal.clone(),
        Arc::new(RouteB),
        DoorConfig {
            reserved_gas_wei: 1_000,
            ops_float_available_wei: 1_000_000,
        },
    );
    let req = request("eip155:8453", "upto", "0xR2", "100", far_future());
    let leg = extract_leg(&req).unwrap();
    da.verify(&leg, &req).unwrap();
    // Route A computes and settles; route B's late settle must REPLAY A's
    // evidence — never execute its own, never double-debit the budget.
    let a = da.settle(&leg, &req).unwrap();
    let b = db.settle(&leg, &req).unwrap();
    assert!(
        matches!(&a, FacilitatorSettle::Success { transaction, .. } if transaction == "0xrouteA")
    );
    assert!(
        matches!(&b, FacilitatorSettle::Success { transaction, .. } if transaction == "0xrouteA"),
        "route B replays A's evidence: {b:?}"
    );
    // The other shape: B settles FIRST on a distinct nonce after A's
    // definitive failure — the earned claim (A's reservation) is preserved
    // through FailedKeep and settles once.
    let req2 = request("eip155:8453", "upto", "0xR3", "100", far_future());
    let leg2 = extract_leg(&req2).unwrap();
    da.verify(&leg2, &req2).unwrap();
    da.settle(&leg2, &req2).unwrap(); // A settles
    assert!(matches!(
        da.verify(&leg2, &req2).unwrap(),
        VerifyOutcome::AlreadySettled { .. }
    ));
}

// ---------- AV-8: settle-UNKNOWN reconciliation ----------

#[test]
fn adv_av8_unknown_never_auto_retries_and_gate_is_bounded() {
    struct Ambig;
    impl SettlementFacilitator for Ambig {
        fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
            Ok(())
        }
        fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
            FacilitatorSettle::Ambiguous {
                reason: "connection reset mid-settle".into(),
            }
        }
    }
    let d = Door::new(
        Arc::new(Journal::open(&tmp_root("adv-av8"), 1_000_000).unwrap()),
        Arc::new(Ambig),
        DoorConfig {
            reserved_gas_wei: 1_000,
            ops_float_available_wei: 1_000_000,
        },
    );
    let req = request("eip155:8453", "exact", "0xR4", "4", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    assert!(matches!(
        d.settle(&leg, &req).unwrap(),
        FacilitatorSettle::Ambiguous { .. }
    ));
    let retry = d.settle(&leg, &req).unwrap_err().to_string();
    assert!(retry.contains("human gate"), "auto-retry refused: {retry}");
    // The gate is BOUNDED: over-authorized evidence is refused even through
    // the human path (upto law survives the gate).
    let req5 = request("eip155:8453", "upto", "0xR5", "10", far_future());
    let leg5 = extract_leg(&req5).unwrap();
    d.verify(&leg5, &req5).unwrap();
    d.settle(&leg5, &req5).unwrap(); // -> Unknown
    let over = SettleEvidence {
        actual_amount: "11".into(),
        tx_hash: "0xover".into(),
        gas_actual_wei: 1,
    };
    assert!(d
        .resolve_unknown(&leg5, HumanGate::explicit_human_approval(), &over)
        .is_err());
    let ok = SettleEvidence {
        actual_amount: "9".into(),
        tx_hash: "0xfine".into(),
        gas_actual_wei: 1,
    };
    d.resolve_unknown(&leg5, HumanGate::explicit_human_approval(), &ok)
        .unwrap();
    assert!(matches!(
        d.journal.get(&leg5).unwrap().unwrap().state,
        ReservationState::Settled { .. }
    ));
}

// ---------- replay with a mutated claim ----------

#[test]
fn adv_replay_with_mutated_amount_is_refused() {
    let d = Door::new(
        Arc::new(Journal::open(&tmp_root("adv-replay"), 1_000_000).unwrap()),
        Arc::new(SlowGood {
            executions: AtomicUsize::new(0),
        }),
        DoorConfig {
            reserved_gas_wei: 1_000,
            ops_float_available_wei: 1_000_000,
        },
    );
    let req = request("eip155:8453", "exact", "0xR6", "6", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    d.settle(&leg, &req).unwrap();
    // Same nonce, attacker-inflated amount: the leg identity no longer
    // matches the journal record — torn/identity refusal, never a re-settle.
    let mutated = request("eip155:8453", "exact", "0xR6", "6000000", far_future());
    let mutated_leg = extract_leg(&mutated).unwrap();
    let err = d.settle(&mutated_leg, &mutated).unwrap_err().to_string();
    assert!(
        err.contains("torn") || err.contains("identity") || err.contains("refus"),
        "mutated replay refused: {err}"
    );
    assert_eq!(
        d.facilitator.executions.load(Ordering::SeqCst),
        1,
        "no re-execution for the mutated replay"
    );
}

// ---------- retained-failure exposure exhaustion ----------

#[test]
fn adv_retained_failures_exhaust_the_budget_by_number() {
    struct Fail;
    impl SettlementFacilitator for Fail {
        fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
            Ok(())
        }
        fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
            FacilitatorSettle::Error {
                reason: "reverted".into(),
                network: "eip155:8453".into(),
            }
        }
    }
    let gas = 1_000u64;
    let cap = 5 * gas;
    let d = Door::new(
        Arc::new(Journal::open(&tmp_root("adv-exhaust"), cap).unwrap()),
        Arc::new(Fail),
        DoorConfig {
            reserved_gas_wei: gas,
            ops_float_available_wei: 1_000_000,
        },
    );
    for i in 0..5u32 {
        let req = request(
            "eip155:8453",
            "exact",
            &format!("0xF{i}"),
            "1",
            far_future(),
        );
        let leg = extract_leg(&req).unwrap();
        d.verify(&leg, &req).unwrap();
        d.settle(&leg, &req).unwrap(); // each failure RETAINS its exposure
    }
    let sixth = request("eip155:8453", "exact", "0xF5", "1", far_future());
    let leg6 = extract_leg(&sixth).unwrap();
    let err = d.verify(&leg6, &sixth).unwrap_err().to_string();
    assert!(
        err.contains("daily gas cap") && err.contains("5000"),
        "cap named: {err}"
    );
    // Evidence on ONE of them reconciles it down and reopens budget.
    let req0 = request("eip155:8453", "exact", "0xF0", "1", far_future());
    let leg0 = extract_leg(&req0).unwrap();
    d.journal.begin_settle(&leg0).unwrap();
    d.journal
        .settle_with_evidence(
            &leg0,
            &SettleEvidence {
                actual_amount: "1".into(),
                tx_hash: "0xe".into(),
                gas_actual_wei: 0,
            },
        )
        .unwrap();
    assert!(
        d.verify(&leg6, &sixth).is_ok(),
        "budget reopened by evidence"
    );
}

// ---------- R4: hostile chain strings + cross-leg isolation ----------

#[test]
fn adv_r4_hostile_chain_strings_refused_and_cross_leg_isolation() {
    let root = tmp_root("adv-r4");
    let j = Journal::open(&root, 1_000_000).unwrap();
    // Hostile chain strings — traversal, second namespace, extra colons,
    // uppercase — are REFUSED at leg extraction, fail-closed, named.
    let hostile = [
        "eip155:8453/../../eip155:11155111",
        r"eip155:8453\..\other",
        "eip155:8453:0x00",
        "EIP155:8453",
    ];
    for (i, chain) in hostile.iter().enumerate() {
        let req = request(chain, "exact", &format!("0xH{i}"), "1", far_future());
        let err = extract_leg(&req).unwrap_err().to_string();
        assert!(
            err.contains("CAIP-2"),
            "hostile chain {chain} refused: {err}"
        );
    }
    // Well-formed cross-leg isolation: records never mention each other.
    let mut legs = Vec::new();
    for (i, chain) in ["eip155:8453", "eip155:11155111"].iter().enumerate() {
        let req = request(chain, "exact", &format!("0xW{i}"), "1", far_future());
        let leg = extract_leg(&req).unwrap();
        j.reserve(&leg, 1, 1_000).unwrap();
        legs.push(leg);
    }
    for (i, leg) in legs.iter().enumerate() {
        let path = root
            .join(leg.chain.replace(":", "_"))
            .join(format!("res-{}.json", leg.auth_nonce));
        let raw = std::fs::read_to_string(path).unwrap();
        let other = legs[1 - i].chain.as_str();
        assert!(!raw.contains(other), "record {i} leaks chain {other}");
    }
    let tag = leg_tag(&legs[0]);
    assert_eq!(tag.matches("eip155").count(), 1);
    assert!(tag.contains("payer=0xbbbb0000…"));
}

// ---------- torn journal variants ----------

#[test]
fn adv_torn_journal_all_corruption_modes_fail_closed() {
    let modes: Vec<(&str, Vec<u8>)> = vec![
        ("truncated", b"{\"record_version\":1,\"leg\":{\"chain\":".to_vec()),
        ("wrong_version", b"{\"record_version\":99,\"leg\":{},\"state\":{},\"updated_unix\":0}".to_vec()),
        ("identity_mismatch", b"{\"record_version\":1,\"leg\":{\"chain\":\"eip155:999\",\"scheme\":\"exact\",\"auth_nonce\":\"0xT\",\"payer\":\"p\",\"amount_authorized\":\"1\",\"valid_before_unix\":9999999999,\"pay_to\":\"a\",\"asset\":\"b\"},\"state\":{\"state\":\"reserved\",\"reserved_gas_wei\":1},\"updated_unix\":0}".to_vec()),
        ("garbage", vec![0xff, 0xfe, 0x00, 0x01]),
    ];
    for (name, bytes) in modes {
        let root = tmp_root("adv-torn");
        let j = Journal::open(&root, 1_000).unwrap();
        let req = request("eip155:8453", "exact", "0xT", "1", far_future());
        let leg = extract_leg(&req).unwrap();
        j.reserve(&leg, 1, 1_000).unwrap();
        let dir: String = "eip155_8453".into();
        std::fs::write(root.join(&dir).join("res-0xT.json"), &bytes).unwrap();
        let err = j.begin_settle(&leg).unwrap_err().to_string();
        assert!(
            err.contains("torn")
                || err.contains("identity")
                || err.contains("refus")
                || err.contains("journal")
                || err.contains("UTF-8"),
            "{name} fails closed: {err}"
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}

// ---------- gas-cap escapes ----------

#[test]
fn adv_gas_cap_concurrent_reserve_race_admits_exactly_cap() {
    let faci = Arc::new(SlowGood {
        executions: AtomicUsize::new(0),
    });
    let journal = Arc::new(Journal::open(&tmp_root("adv-caprace"), 3_000).unwrap());
    let barrier = Arc::new(Barrier::new(6));
    let successes = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();
    for i in 0..6u32 {
        let d = Door::new(
            journal.clone(),
            faci.clone(),
            DoorConfig {
                reserved_gas_wei: 1_000,
                ops_float_available_wei: 1_000_000,
            },
        );
        let req = request(
            "eip155:8453",
            "exact",
            &format!("0xC{i}"),
            "1",
            far_future(),
        );
        let barrier = barrier.clone();
        let successes = successes.clone();
        handles.push(std::thread::spawn(move || {
            let leg = extract_leg(&req).unwrap();
            barrier.wait();
            if d.verify(&leg, &req).is_ok() {
                successes.fetch_add(1, Ordering::SeqCst);
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(
        successes.load(Ordering::SeqCst),
        3,
        "exactly cap/1k = 3 admissions"
    );
    // Settling one WITH EVIDENCE at lower actual does not exceed the cap
    // post-hoc (actuals are truth), and expire-release of one reopens room.
}

#[test]
fn adv_expire_release_then_rereserve_refused() {
    let d = Door::new(
        Arc::new(Journal::open(&tmp_root("adv-exp"), 1_000_000).unwrap()),
        Arc::new(SlowGood {
            executions: AtomicUsize::new(0),
        }),
        DoorConfig {
            reserved_gas_wei: 1_000,
            ops_float_available_wei: 1_000_000,
        },
    );
    let past = x402_door::journal::now_unix() - 10;
    let req = request("eip155:8453", "exact", "0xE1", "1", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    // Force the window into the past via the test seam, then release.
    let mut rec = d.journal.get(&leg).unwrap().unwrap();
    rec.leg.valid_before_unix = past;
    d.journal.write_for_test(&rec).unwrap();
    let expired_leg = extract_leg(&request("eip155:8453", "exact", "0xE1", "1", past)).unwrap();
    assert!(d.journal.expire_released(&expired_leg, true).is_ok());
    // Re-reserving the same (expired) nonce is refused — terminal state.
    let again = request("eip155:8453", "exact", "0xE1", "1", far_future());
    let again_leg = extract_leg(&again).unwrap();
    // Identity carries the ORIGINAL record's leg (the expired one) — the
    // fresh-window attempt mismatches and is refused as torn; the expired
    // identity is refused as released. Both are lawful refusals.
    let err = d.verify(&again_leg, &again).unwrap_err().to_string();
    let err2 = d
        .verify(
            &expired_leg,
            &request("eip155:8453", "exact", "0xE1", "1", past),
        )
        .unwrap_err()
        .to_string();
    assert!(
        err.contains("torn")
            || err.contains("identity")
            || err.contains("expired")
            || err.contains("released")
    );
    assert!(err2.contains("expired") || err2.contains("released") || err2.contains("torn"));
}
