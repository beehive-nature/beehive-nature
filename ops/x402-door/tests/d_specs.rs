//! The D-specs RED-first suite (D-2/D-3/D-4/D-5/D-6/D-7 + the founder's
//! crash-while-Settling recovery order), consumed per the specs seat's
//! priority. RED status at authoring time (before the accompanying law
//! changes, same session): D-3 (no settle-time float check existed),
//! D-4's typed-HOLD + contradiction park (bare bool), D-5 (no exclusive
//! open), crash-recovery (no reconcile path — stranded forever), D-6
//! (config unvalidated, binary-only), D-7 (no gate audit). D-2 was
//! already-green and is DEFINED here by test, per its spec.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use x402_door::config::RunConfig;
use x402_door::journal::{HumanGate, Journal, ReleaseVerdict, ReservationState, SettleEvidence};
use x402_door::orchestrator::{
    Door, DoorConfig, FacilitatorSettle, FloatSource, SettlementFacilitator,
};

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join("x402-door-dspecs").join(format!(
        "{}-{}",
        tag,
        std::process::id()
    ));
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
            "scheme": scheme, "network": chain,
            "payTo": "0x1111111111111111111111111111111111111111",
            "asset": "0x2222222222222222222222222222222222222222",
            "maxTimeoutSeconds": 3600
        },
        "paymentPayload": {
            "x402Version": 2,
            "payload": {
                "from": "0xcccc000000000000000000000000000000000ccc",
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

/// The D-3 dynamic float: drained and recovered live, like an ops wallet.
struct DynFloat(AtomicU64);
impl FloatSource for DynFloat {
    fn available_wei(&self) -> u64 {
        self.0.load(Ordering::SeqCst)
    }
}

struct GoodFaci {
    executions: std::sync::atomic::AtomicUsize,
}
impl SettlementFacilitator for GoodFaci {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, r: &serde_json::Value) -> FacilitatorSettle {
        self.executions.fetch_add(1, Ordering::SeqCst);
        let declared = r
            .pointer("/paymentPayload/payload/value")
            .or_else(|| r.pointer("/paymentPayload/payload/maxAmount"))
            .and_then(|v| v.as_str())
            .unwrap_or("0")
            .to_string();
        FacilitatorSettle::Success {
            payer: "0xcccc000000000000000000000000000000000ccc".into(),
            transaction: "0xD3TX-0001".into(), // PUBLIC-CONSTANT: synthetic d-specs tx marker
            network: "eip155:8453".into(),
            actual_amount: Some(declared),
            gas_actual_wei: Some(50),
        }
    }
}

fn record_bytes(j: &Journal, leg: &x402_door::journal::LegKey) -> Vec<u8> {
    let path = j
        .root_for_test()
        .join(leg.chain.replace(':', "_"))
        .join(format!("res-{}.json", leg.auth_nonce));
    std::fs::read(path).unwrap()
}

// ---------- D-3: settle-time float drain ----------

#[test]
fn d3_settle_time_float_drain_refuses_loud_and_preserves_the_nonce() {
    let float = Arc::new(DynFloat(AtomicU64::new(1_000)));
    let journal = Arc::new(Journal::open(&tmp_root("d3"), 1_000_000).unwrap());
    let d = Door::new(
        journal.clone(),
        Arc::new(GoodFaci {
            executions: Default::default(),
        }),
        DoorConfig {
            reserved_gas_wei: 400,
            ops_float_available_wei: 1_000,
        },
        float.clone(),
    );
    let leg1 =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD31", "1", far_future()))
            .unwrap();
    let req1 = request("eip155:8453", "exact", "0xD31", "1", far_future());
    let leg2 =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD32", "1", far_future()))
            .unwrap();
    let req2 = request("eip155:8453", "exact", "0xD32", "1", far_future());
    d.verify(&leg1, &req1).unwrap();
    d.verify(&leg2, &req2).unwrap();
    d.settle(&leg1, &req1).unwrap(); // settles, gas_actual 50
                                     // The wallet is DRAINED below leg2's reserved figure.
    float.0.store(300, Ordering::SeqCst); // < reserved 400
    let before = record_bytes(journal.as_ref(), &leg2);
    let err = d.settle(&leg2, &req2).unwrap_err().to_string();
    assert!(
        err.contains("float shortfall"),
        "loud refusal naming the class: {err}"
    );
    assert!(
        err.contains("300") && err.contains("400"),
        "names the numbers: {err}"
    );
    assert!(
        err.contains("state untouched"),
        "names the invariant: {err}"
    );
    let after = record_bytes(journal.as_ref(), &leg2);
    assert_eq!(before, after, "record byte-identical on refusal");
    // Float recovers -> the SAME nonce settles (nothing was consumed).
    float.0.store(1_000, Ordering::SeqCst);
    d.settle(&leg2, &req2).unwrap();
    assert!(matches!(
        journal.get(&leg2).unwrap().unwrap().state,
        ReservationState::Settled { .. }
    ));
}

// ---------- D-4: lying-RPC release evidence ----------

#[test]
fn d4_contradiction_settled_leg_cannot_release_via_any_verdict() {
    let d = Door::new(
        Arc::new(Journal::open(&tmp_root("d4a"), 1_000_000).unwrap()),
        Arc::new(GoodFaci {
            executions: Default::default(),
        }),
        DoorConfig {
            reserved_gas_wei: 100,
            ops_float_available_wei: 1_000,
        },
        Arc::new(DynFloat(AtomicU64::new(1_000))),
    );
    let req = request("eip155:8453", "exact", "0xD41", "1", far_future());
    let leg = x402_door::wire::extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    d.settle(&leg, &req).unwrap(); // journal HOLDS the evidence
                                   // The lying RPC claims unspent — release must be REFUSED (terminal).
    for verdict in [
        ReleaseVerdict::UnspentOnChain,
        ReleaseVerdict::RpcUnavailable,
        ReleaseVerdict::SpentOnChain,
    ] {
        assert!(
            d.journal.expire_released(&leg, verdict).is_err(),
            "settled leg never releases ({verdict:?})"
        );
    }
    assert!(matches!(
        d.journal.get(&leg).unwrap().unwrap().state,
        ReservationState::Settled { .. }
    ));
}

#[test]
fn d4_rpc_unavailable_is_a_typed_hold_then_exactly_one_release() {
    let j = Journal::open(&tmp_root("d4b"), 1_000_000).unwrap();
    let past = x402_door::journal::now_unix() - 10;
    let leg_live =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD42", "1", far_future()))
            .unwrap();
    j.reserve(&leg_live, 100, 1_000).unwrap();
    let mut rec = j.get(&leg_live).unwrap().unwrap();
    rec.leg.valid_before_unix = past;
    j.write_for_test(&rec).unwrap();
    let leg =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD42", "1", past)).unwrap();
    let before =
        std::fs::read(j.root_for_test().join("eip155_8453").join("res-0xD42.json")).unwrap();
    // The HOLD: RPC unavailable refuses loudly, state untouched, retryable.
    let err = j
        .expire_released(&leg, ReleaseVerdict::RpcUnavailable)
        .unwrap_err()
        .to_string();
    assert!(
        err.contains("HELD") && err.contains("RPC unavailable"),
        "typed hold: {err}"
    );
    let after =
        std::fs::read(j.root_for_test().join("eip155_8453").join("res-0xD42.json")).unwrap();
    assert_eq!(before, after, "hold leaves the record byte-identical");
    // Retry after the RPC heals: the genuine unspent verdict releases...
    j.expire_released(&leg, ReleaseVerdict::UnspentOnChain)
        .unwrap();
    // ...exactly once — the second release attempt refuses (terminal).
    assert!(j
        .expire_released(&leg, ReleaseVerdict::UnspentOnChain)
        .is_err());
    assert!(matches!(
        j.get(&leg).unwrap().unwrap().state,
        ReservationState::ExpiredReleased { .. }
    ));
}

#[test]
fn d4_spent_verdict_parks_unknown_and_the_gate_reconciles() {
    let j = Journal::open(&tmp_root("d4c"), 1_000_000).unwrap();
    let past = x402_door::journal::now_unix() - 10;
    let leg_live =
        x402_door::wire::extract_leg(&request("eip155:8453", "upto", "0xD43", "10", far_future()))
            .unwrap();
    j.reserve(&leg_live, 100, 1_000).unwrap();
    let mut rec = j.get(&leg_live).unwrap().unwrap();
    rec.leg.valid_before_unix = past;
    j.write_for_test(&rec).unwrap();
    let leg =
        x402_door::wire::extract_leg(&request("eip155:8453", "upto", "0xD43", "10", past)).unwrap();
    j.expire_released(&leg, ReleaseVerdict::SpentOnChain)
        .unwrap();
    match j.get(&leg).unwrap().unwrap().state {
        ReservationState::Unknown { note, .. } => assert!(note.contains("SPENT")),
        other => panic!("expected Unknown park, got {other:?}"),
    }
    let ev = SettleEvidence {
        actual_amount: "7".into(),
        tx_hash: "0xD4C".into(),
        gas_actual_wei: 10,
    };
    j.resolve_unknown(&leg, HumanGate::explicit_human_approval(), &ev)
        .unwrap();
    assert!(matches!(
        j.get(&leg).unwrap().unwrap().state,
        ReservationState::Settled { .. }
    ));
}

// ---------- D-5: concurrent journal open/start ----------

#[test]
fn d5_second_exclusive_open_refuses_named_and_dies_with_the_instance() {
    let root = tmp_root("d5");
    let first = Journal::open_exclusive(&root, 1_000).unwrap();
    let err = match Journal::open_exclusive(&root, 1_000) {
        Err(e) => e.to_string(),
        Ok(_) => String::new(),
    };
    assert!(
        err.contains("already held by a live opener") && err.contains("D-5"),
        "second exclusive start refuses named: {err}"
    );
    // Per-op journals still work alongside (the multi-handle contract).
    assert!(Journal::open(&root, 1_000).is_ok());
    // The hold dies with the instance — drop, then reopen succeeds.
    drop(first);
    assert!(Journal::open_exclusive(&root, 1_000).is_ok());
}

#[test]
fn d5_unlockable_root_refuses_to_open() {
    let root = tmp_root("d5b");
    let file_as_root = root.join("not-a-dir");
    std::fs::write(&file_as_root, b"x").unwrap();
    // The lock file cannot be created under a FILE root — open refuses
    // (an unlocked journal is not a journal).
    assert!(Journal::open(&file_as_root, 1_000).is_err());
}

// ---------- crash while Settling -> restart -> UNKNOWN (founder order) ----------

#[test]
fn crash_while_settling_restarts_to_unknown_and_reconciles_via_gate() {
    let root = tmp_root("crash");
    let j = Journal::open(&root, 1_000_000).unwrap();
    let leg1 =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xC1", "1", far_future()))
            .unwrap();
    let leg2 =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xC2", "1", far_future()))
            .unwrap();
    let leg3 =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xC3", "1", far_future()))
            .unwrap();
    for leg in [&leg1, &leg2, &leg3] {
        j.reserve(leg, 100, 1_000).unwrap();
    }
    // Two legs crash mid-execution (fabricated Settling), one stays Reserved.
    j.begin_settle(&leg1).unwrap();
    j.begin_settle(&leg2).unwrap();
    drop(j); // "crash"
             // Restart: recovery parks ONLY the stranded Settling records.
    let j2 = Journal::open(&root, 1_000_000).unwrap();
    let parked = j2.recover_stranded_settling().unwrap();
    assert_eq!(parked.len(), 2);
    for leg in [&leg1, &leg2] {
        match j2.get(leg).unwrap().unwrap().state {
            ReservationState::Unknown { note, .. } => {
                assert!(note.contains("Settling at restart"), "named note: {note}")
            }
            other => panic!("expected Unknown, got {other:?}"),
        }
    }
    assert!(matches!(
        j2.get(&leg3).unwrap().unwrap().state,
        ReservationState::Reserved { .. }
    ));
    // Idempotent: a second recovery pass finds nothing.
    assert!(j2.recover_stranded_settling().unwrap().is_empty());
    // NEVER auto-retried: settle on a parked leg demands the human gate.
    let err = j2.begin_settle(&leg1).unwrap_err().to_string();
    assert!(err.contains("human gate"), "{err}");
    // The gate reconciles with evidence — bounded by the upto law.
    let over = SettleEvidence {
        actual_amount: "1".into(),
        tx_hash: "0xC1X".into(),
        gas_actual_wei: 5,
    };
    assert!(j2
        .resolve_unknown(&leg1, HumanGate::explicit_human_approval(), &over)
        .is_ok());
    assert!(matches!(
        j2.get(&leg1).unwrap().unwrap().state,
        ReservationState::Settled { .. }
    ));
}

// ---------- D-6: journal web-unreachability ----------

#[test]
fn d6_journal_root_under_web_roots_refused_named() {
    for bad in [
        "/var/www/html/journal",
        "/srv/http/x402",
        "/srv/www/j",
        "/usr/share/nginx/html/j",
        "/public_html/j",
    ] {
        let cfg = serde_json::json!({
            "bind": "127.0.0.1:18042",
            "journal_root": bad,
            "daily_gas_cap_wei": 1, "reserved_gas_wei": 1, "ops_float_available_wei": 1
        });
        let err = RunConfig::from_json(&cfg).unwrap_err().to_string();
        assert!(
            err.contains("web-served") && err.contains("D-6"),
            "{bad}: {err}"
        );
    }
    // Relative roots are the quiet variant of the same hole.
    let rel = serde_json::json!({
        "bind": "127.0.0.1:18042", "journal_root": "journal",
        "daily_gas_cap_wei": 1, "reserved_gas_wei": 1, "ops_float_available_wei": 1
    });
    assert!(RunConfig::from_json(&rel)
        .unwrap_err()
        .to_string()
        .contains("absolute"));
    // The lawful shape passes.
    let ok_root = if cfg!(windows) {
        "C:/var/lib/x402-door"
    } else {
        "/var/lib/x402-door"
    };
    let ok = serde_json::json!({
        "bind": "127.0.0.1:18042", "journal_root": ok_root,
        "daily_gas_cap_wei": 1, "reserved_gas_wei": 1, "ops_float_available_wei": 1
    });
    let okr = RunConfig::from_json(&ok);
    assert!(okr.is_ok(), "lawful config must pass: {:?}", okr.err());
}

// ---------- D-7: HumanGate auditability ----------

#[test]
fn d7_every_gate_use_writes_an_attributable_audit_line() {
    let root = tmp_root("d7");
    let j = Journal::open(&root, 1_000_000).unwrap();
    let leg =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD71", "1", far_future()))
            .unwrap();
    j.reserve(&leg, 100, 1_000).unwrap();
    j.begin_settle(&leg).unwrap();
    j.settle_unknown(&leg, "d7 ambiguous").unwrap();
    let ev = SettleEvidence {
        actual_amount: "1".into(),
        tx_hash: "0xD7X".into(),
        gas_actual_wei: 5,
    };
    j.resolve_unknown(&leg, HumanGate::explicit_human_approval(), &ev)
        .unwrap();
    let log = std::fs::read_to_string(root.join("human-gates.log")).unwrap();
    assert!(log.contains("d_specs.rs"), "call site attributable: {log}");
    assert!(
        log.contains("0xD71") && log.contains("eip155_8453") || log.contains("eip155:8453"),
        "leg attributable: {log}"
    );
}

// ---------- D-2: rollover exposure semantics (defined by test) ----------

#[test]
fn d2_rollover_yesterday_actuals_expire_open_exposure_does_not() {
    let root = tmp_root("d2");
    let j = Journal::open(&root, 500).unwrap();
    // A record SETTLED YESTERDAY at actual gas 500 == the cap.
    let yday_leg =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD21", "1", far_future()))
            .unwrap();
    j.reserve(&yday_leg, 500, 1_000).unwrap();
    j.begin_settle(&yday_leg).unwrap();
    let mut rec = j.get(&yday_leg).unwrap().unwrap();
    if let ReservationState::Settled { settled_unix, .. } = rec.state {
        let _ = settled_unix;
    } else {
        // fabricate the settled-yesterday shape through the evidence path
        let ev = SettleEvidence {
            actual_amount: "1".into(),
            tx_hash: "0xD2Y".into(),
            gas_actual_wei: 500,
        };
        j.settle_with_evidence(&yday_leg, &ev).unwrap();
        rec = j.get(&yday_leg).unwrap().unwrap();
    }
    if let ReservationState::Settled {
        ref mut settled_unix,
        ..
    } = rec.state
    {
        *settled_unix = x402_door::journal::now_unix() - 86_400 * 2; // two days ago
    }
    j.write_for_test(&rec).unwrap();
    // TODAY: a fresh reserve of the full cap is admitted — yesterday's
    // ACTUALS expired with the UTC day.
    let today_leg =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD22", "1", far_future()))
            .unwrap();
    j.reserve(&today_leg, 500, 1_000)
        .unwrap_or_else(|e| panic!("day-rollover must free actuals: {e}"));
    // But an OPEN reservation never expires with the day: fabricate a
    // yesterday-open reservation alongside today's, cap now full.
    let open_yday =
        x402_door::wire::extract_leg(&request("eip155:8453", "exact", "0xD23", "1", far_future()))
            .unwrap();
    let mut rec2 = j.get(&today_leg).unwrap().unwrap();
    if let ReservationState::Reserved { .. } = rec2.state {
        rec2.updated_unix = x402_door::journal::now_unix() - 86_400 * 2;
        j.write_for_test(&rec2).unwrap();
    }
    assert!(
        j.reserve(&open_yday, 1, 1_000).is_err(),
        "open exposure counts across day rollover — live reservations never expire with the calendar"
    );
}
