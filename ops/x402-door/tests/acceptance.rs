//! The eight-point acceptance contract (Mission 6 design) — the door is
//! complete when these pass, not when it compiles.
//!
//! 1. verify-refuses when wallet float < settlement floor (fail-closed)
//! 2. upto settlement reconciles reservation to actual ≤ authorized,
//!    receipt evidence required
//! 3. same auth nonce settles exactly once (idempotent journal + simulated
//!    on-chain nonce agreement)
//! 4. expired validBefore never settles; release at expiry requires
//!    evidence of non-settlement
//! 5. journal torn-file fails closed
//! 6. no cross-chain payer correlation in any log line (R4)
//! 7. door swap: the same scenario runs against a second facilitator
//!    implementation with zero surface change
//! 8. daily-cap refusal names the cap and current exposure

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use x402_door::journal::{HumanGate, Journal, ReleaseVerdict, ReservationState, SettleEvidence};
use x402_door::orchestrator::StaticFloat;
use x402_door::orchestrator::{
    Door, DoorConfig, FacilitatorSettle, SettlementFacilitator, VerifyOutcome,
};
use x402_door::wire::{extract_leg, leg_tag};

// ---------- test scaffolding ----------

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir()
        .join("x402-door-acceptance")
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
                "from": "0xaaaa000000000000000000000000000000000aaa",
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

struct MockFaci {
    verify_ok: bool,
    settle: FacilitatorSettle,
    executions: AtomicUsize,
}

impl MockFaci {
    fn good() -> Self {
        MockFaci {
            verify_ok: true,
            settle: FacilitatorSettle::Success {
                payer: "0xaaaa000000000000000000000000000000000aaa".into(),
                transaction: "0xdeadbeefcafe0000000000000000000000000000000000000000000000001234" // PUBLIC-CONSTANT: synthetic test tx hash
                    .into(),
                network: "eip155:8453".into(),
                actual_amount: Some("50".into()),
                gas_actual_wei: Some(90_000),
            },
            executions: AtomicUsize::new(0),
        }
    }
}

impl SettlementFacilitator for MockFaci {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        if self.verify_ok {
            Ok(())
        } else {
            Err("mock refusal: signature invalid".into())
        }
    }
    fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
        self.executions.fetch_add(1, Ordering::SeqCst);
        self.settle.clone()
    }
}

fn door<F: SettlementFacilitator>(
    tag: &str,
    faci: F,
    reserved_gas: u64,
    float: u64,
    cap: u64,
) -> Door<F> {
    Door::new(
        Arc::new(Journal::open(&tmp_root(tag), cap).unwrap()),
        Arc::new(faci),
        DoorConfig {
            reserved_gas_wei: reserved_gas,
            ops_float_available_wei: float,
        },
        // Static float at the configured figure — the D-3 dynamic source
        // is exercised in the d_specs suite.
        Arc::new(StaticFloat(float.max(reserved_gas))),
    )
}

// ---------- 1. float fail-closed ----------

#[test]
fn acceptance_1_verify_refuses_when_float_cannot_fund() {
    let d = door("p1", MockFaci::good(), 100_000, 50_000, 1_000_000_000);
    let req = request("eip155:8453", "exact", "0x01", "100", far_future());
    let leg = extract_leg(&req).unwrap();
    let err = d.verify(&leg, &req).unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("fail-closed"),
        "refusal must be fail-closed: {msg}"
    );
    assert!(
        msg.contains("50") && msg.contains("100"),
        "refusal must name the numbers: {msg}"
    );
    // Fail-closed means NO reservation was created.
    assert!(d.journal.get(&leg).unwrap().is_none());
}

// ---------- 2. upto reconciliation with evidence ----------

#[test]
fn acceptance_2_upto_reconciles_to_actual_with_evidence() {
    let d = door("p2", MockFaci::good(), 100_000, 1_000_000, 1_000_000_000);
    let req = request("eip155:8453", "upto", "0x02", "1000", far_future());
    let leg = extract_leg(&req).unwrap();
    assert!(d.verify(&leg, &req).is_ok());
    let out = d.settle(&leg, &req).unwrap();
    match out {
        FacilitatorSettle::Success { actual_amount, .. } => {
            assert_eq!(actual_amount.as_deref(), Some("50"));
        }
        other => panic!("expected success, got {other:?}"),
    }
    let rec = d.journal.get(&leg).unwrap().unwrap();
    match rec.state {
        ReservationState::Settled {
            actual_amount,
            tx_hash,
            gas_actual_wei,
            ..
        } => {
            assert_eq!(actual_amount, "50"); // reconciled DOWN from 1000
            assert!(!tx_hash.is_empty()); // receipt evidence present
            assert_eq!(gas_actual_wei, 90_000); // gas reconciled to actual
        }
        other => panic!("expected settled, got {other:?}"),
    }
    // Evidence-gated: an actual ABOVE the authorized max is refused outright.
    let req3 = request("eip155:8453", "upto", "0x03", "10", far_future());
    let leg3 = extract_leg(&req3).unwrap();
    d.verify(&leg3, &req3).unwrap();
    let _over = FacilitatorSettle::Success {
        payer: "p".into(),
        transaction: "0xtx".into(),
        network: "eip155:8453".into(),
        actual_amount: Some("11".into()), // > authorized 10
        gas_actual_wei: Some(1),
    };
    // Direct journal law check (the door maps facilitator output to evidence):
    let ev = SettleEvidence {
        actual_amount: "11".into(),
        tx_hash: "0xtx".into(),
        gas_actual_wei: 1,
    };
    assert!(d.journal.settle_with_evidence(&leg3, &ev).is_err());
}

// ---------- 3. idempotent settle + nonce agreement ----------

#[test]
fn acceptance_3_same_nonce_settles_exactly_once() {
    let d = door("p3", MockFaci::good(), 100_000, 1_000_000, 1_000_000_000);
    let req = request("eip155:8453", "exact", "0x04", "77", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    let first = d.settle(&leg, &req).unwrap();
    let second = d.settle(&leg, &req).unwrap();
    // Idempotent: same evidence replayed, facilitator executed ONCE.
    assert_eq!(first, second);
    assert_eq!(d.facilitator.executions.load(Ordering::SeqCst), 1);
    // And a third settle after verify-replay also does not re-execute.
    assert!(matches!(
        d.verify(&leg, &req).unwrap(),
        VerifyOutcome::AlreadySettled { .. }
    ));
    assert_eq!(d.facilitator.executions.load(Ordering::SeqCst), 1);
}

// ---------- 4. expiry law ----------

#[test]
fn acceptance_4_expired_window_never_settles_release_needs_evidence() {
    let d = door("p4", MockFaci::good(), 100_000, 1_000_000, 1_000_000_000);
    let past = x402_door::journal::now_unix() - 10;
    let req = request("eip155:8453", "exact", "0x05", "5", past);
    let leg = extract_leg(&req).unwrap();
    // Verify refuses the already-expired window.
    let err = d.verify(&leg, &req).unwrap_err().to_string();
    assert!(err.contains("expired"), "must name expiry: {err}");

    // A live reservation whose window then expires: release WITHOUT the
    // on-chain non-settlement check is refused…
    let req6 = request("eip155:8453", "exact", "0x06", "6", past);
    let leg6 = extract_leg(&req6).unwrap();
    // (journal state fabricated via a fresh reserve at a live window, then
    // the clock is beyond it for the release checks)
    let live_req = request("eip155:8453", "exact", "0x06", "6", far_future());
    let live_leg = extract_leg(&live_req).unwrap();
    d.journal.reserve(&live_leg, 100_000, 1_000_000).unwrap();
    assert!(d
        .journal
        .expire_released(&live_leg, ReleaseVerdict::RpcUnavailable)
        .is_err()); // window not expired
                    // Expired + evidenced -> released; expired + NOT evidenced -> refused.
    assert!(d.expire(&leg6, ReleaseVerdict::SpentOnChain).is_err());
    assert!(d.expire(&leg6, ReleaseVerdict::UnspentOnChain).is_err()); // no reservation exists — lawful refusal
                                                                       // The real release path on a live-turned-expired leg: rewrite window.
    let mut rec = d.journal.get(&live_leg).unwrap().unwrap();
    rec.leg.valid_before_unix = past;
    d.journal.write_for_test(&rec).unwrap();
    let expired_leg = extract_leg(&req6).unwrap(); // identity now carries the past window
                                                   // D-4 semantics: a SPENT verdict parks the leg to Unknown (lawful Ok)
                                                   // — it NEVER releases; only UnspentOnChain releases.
    d.journal
        .expire_released(&expired_leg, ReleaseVerdict::SpentOnChain)
        .unwrap();
    assert!(matches!(
        d.journal.get(&expired_leg).unwrap().unwrap().state,
        ReservationState::Unknown { .. }
    ));
    // The Unknown leg then resolves through the human gate (evidence law).
    let ev = SettleEvidence {
        actual_amount: "6".into(),
        tx_hash: "0xd4".into(),
        gas_actual_wei: 1,
    };
    d.resolve_unknown(&expired_leg, HumanGate::explicit_human_approval(), &ev)
        .unwrap();
    // A FRESH leg releases only on UnspentOnChain.
    let fresh_req = request("eip155:8453", "exact", "0x0E2", "6", far_future());
    let fresh_leg = extract_leg(&fresh_req).unwrap();
    d.journal.reserve(&fresh_leg, 1_000, 1_000_000).unwrap();
    let mut frec = d.journal.get(&fresh_leg).unwrap().unwrap();
    frec.leg.valid_before_unix = past;
    d.journal.write_for_test(&frec).unwrap();
    let fresh_expired = extract_leg(&request("eip155:8453", "exact", "0x0E2", "6", past)).unwrap();
    assert!(d
        .journal
        .expire_released(&fresh_expired, ReleaseVerdict::RpcUnavailable)
        .is_err()); // typed HOLD
    assert!(d
        .journal
        .expire_released(&fresh_expired, ReleaseVerdict::UnspentOnChain)
        .is_ok()); // evidenced release
                   // Settle on the RELEASED leg is refused (terminal state).
    assert!(d.settle(&fresh_expired, &fresh_req).is_err());
}

// ---------- 5. torn file fails closed ----------

#[test]
fn acceptance_5_torn_journal_file_fails_closed() {
    let root = tmp_root("p5");
    let j = Journal::open(&root, 1_000_000_000).unwrap();
    let req = request("eip155:8453", "exact", "0x07", "7", far_future());
    let leg = extract_leg(&req).unwrap();
    j.reserve(&leg, 1_000, 1_000_000).unwrap();
    let path = root.join("eip155_8453").join("res-0x07.json");
    std::fs::write(&path, "{\"record_version\":1,\"leg\":{").unwrap(); // torn
    let err = j.get(&leg).unwrap_err().to_string();
    assert!(
        err.contains("torn") && err.contains("refusing"),
        "must name torn + refusal: {err}"
    );
    // And operations needing state fail closed rather than guess.
    assert!(j.begin_settle(&leg).is_err());
}

// ---------- 6. R4 per-leg log law ----------

#[test]
fn acceptance_6_no_cross_chain_payer_correlation_in_log_lines() {
    let base_leg =
        extract_leg(&request("eip155:8453", "exact", "0x08", "8", far_future())).unwrap();
    let sep_leg = extract_leg(&request(
        "eip155:11155111",
        "upto",
        "0x09",
        "9",
        far_future(),
    ))
    .unwrap();
    let lines = [
        format!("verify valid {}", leg_tag(&base_leg)),
        format!("verify valid {}", leg_tag(&sep_leg)),
        format!("settle {}", leg_tag(&base_leg)),
    ];
    for line in &lines {
        let chain_count = ["eip155:8453", "eip155:11155111"]
            .iter()
            .filter(|c| line.contains(*c))
            .count();
        assert_eq!(chain_count, 1, "R4 law: one chain per log line: {line}");
        assert!(
            !line.contains(&base_leg.payer) || !line.contains(&sep_leg.payer),
            "R4 law: no joined payer identifiers: {line}"
        );
    }
    // Payer appears truncated only.
    assert!(leg_tag(&base_leg).contains("payer=0xaaaa0000…"));
    // Journal layout is per-chain directories (structural unlinkability).
    let root = tmp_root("p6");
    let j = Journal::open(&root, 1_000).unwrap();
    j.reserve(&base_leg, 1, 1_000).unwrap();
    j.reserve(&sep_leg, 1, 1_000).unwrap();
    let dirs: Vec<_> = std::fs::read_dir(&root)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n != ".lock")
        .collect();
    assert!(dirs.contains(&"eip155_8453".to_string()));
    assert!(dirs.contains(&"eip155_11155111".to_string()));
}

// ---------- 7. door swap (second facilitator impl, zero surface change) ----------

/// A deliberately different second implementation (e.g. a hosted or future
/// Rust facilitator behind the same seam).
struct OtherFaci {
    tx: &'static str,
}
impl SettlementFacilitator for OtherFaci {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, _r: &serde_json::Value) -> FacilitatorSettle {
        FacilitatorSettle::Success {
            payer: "0xaaaa000000000000000000000000000000000aaa".into(),
            transaction: self.tx.into(),
            network: "eip155:8453".into(),
            actual_amount: Some("50".into()),
            gas_actual_wei: Some(1),
        }
    }
}

fn scenario<F: SettlementFacilitator>(d: &Door<F>) {
    let req = request("eip155:8453", "upto", "0x0A", "100", far_future());
    let leg = extract_leg(&req).unwrap();
    assert!(matches!(
        d.verify(&leg, &req).unwrap(),
        VerifyOutcome::Valid
    ));
    match d.settle(&leg, &req).unwrap() {
        FacilitatorSettle::Success { actual_amount, .. } => {
            assert_eq!(actual_amount.as_deref(), Some("50"))
        }
        other => panic!("surface changed with second facilitator: {other:?}"),
    }
    // Same laws hold identically.
    assert!(matches!(
        d.verify(&leg, &req).unwrap(),
        VerifyOutcome::AlreadySettled { .. }
    ));
}

#[test]
fn acceptance_7_door_swap_zero_surface_change() {
    scenario(&door(
        "p7a",
        MockFaci::good(),
        100_000,
        1_000_000,
        1_000_000_000,
    ));
    scenario(&door(
        "p7b",
        OtherFaci { tx: "0xother" },
        100_000,
        1_000_000,
        1_000_000_000,
    ));
}

// ---------- 8. daily cap names cap + exposure ----------

#[test]
fn acceptance_8_daily_cap_refusal_names_cap_and_exposure() {
    let cap = 250_000u64;
    let d = door("p8", MockFaci::good(), 100_000, 1_000_000, cap);
    // Three reserves of 100k each: 1,2 fit; the 3rd crosses the 300k cap.
    for n in ["0x0B", "0x0C"] {
        let req = request("eip155:8453", "exact", n, "1", far_future());
        let leg = extract_leg(&req).unwrap();
        assert!(d.verify(&leg, &req).is_ok(), "reserve {n} must fit");
    }
    let req = request("eip155:8453", "exact", "0x0D", "1", far_future());
    let leg = extract_leg(&req).unwrap();
    let err = d.verify(&leg, &req).unwrap_err().to_string();
    assert!(err.contains("daily gas cap"), "must name the cap: {err}");
    assert!(
        err.contains("250000") && err.contains("200000"),
        "must name cap+exposure: {err}"
    );
    assert!(err.contains("100000"), "must name this reservation: {err}");
}

// ---------- bonus laws (journal-level, tested because they are laws) ----------

#[test]
fn law_duplicate_live_reservation_refused() {
    let d = door("law1", MockFaci::good(), 1_000, 1_000_000, 1_000_000);
    let req = request("eip155:8453", "exact", "0x0E", "1", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    assert!(
        d.verify(&leg, &req).is_err(),
        "duplicate live reservation refused"
    );
}

#[test]
fn law_unknown_never_auto_retries_and_human_gate_resolves() {
    let faci = MockFaci {
        verify_ok: true,
        settle: FacilitatorSettle::Ambiguous {
            reason: "transport dropped".into(),
        },
        executions: AtomicUsize::new(0),
    };
    let d = door("law2", faci, 1_000, 1_000_000, 1_000_000);
    let req = request("eip155:8453", "exact", "0x0F", "1", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    assert!(matches!(
        d.settle(&leg, &req).unwrap(),
        FacilitatorSettle::Ambiguous { .. }
    ));
    // Auto-retry is refused by the journal.
    let err = d.settle(&leg, &req).unwrap_err().to_string();
    assert!(
        err.contains("human gate"),
        "Unknown must demand the human gate: {err}"
    );
    assert_eq!(
        d.facilitator.executions.load(Ordering::SeqCst),
        1,
        "no auto re-execution"
    );
    // The human gate resolves it with evidence.
    let ev = SettleEvidence {
        actual_amount: "1".into(),
        tx_hash: "0xresolved".into(),
        gas_actual_wei: 500,
    };
    d.resolve_unknown(&leg, HumanGate::explicit_human_approval(), &ev)
        .unwrap();
    match d.journal.get(&leg).unwrap().unwrap().state {
        ReservationState::Settled { gas_actual_wei, .. } => assert_eq!(gas_actual_wei, 500),
        other => panic!("expected settled after human gate, got {other:?}"),
    }
}

#[test]
fn law_no_evidence_failure_keeps_reservation() {
    let faci = MockFaci {
        verify_ok: true,
        settle: FacilitatorSettle::Error {
            reason: "reverted".into(),
            network: "eip155:8453".into(),
        },
        executions: AtomicUsize::new(0),
    };
    let d = door("law3", faci, 1_000, 1_000_000, 1_000_000);
    let req = request("eip155:8453", "exact", "0x10", "1", far_future());
    let leg = extract_leg(&req).unwrap();
    d.verify(&leg, &req).unwrap();
    d.settle(&leg, &req).unwrap();
    let rec = d.journal.get(&leg).unwrap().unwrap();
    match &rec.state {
        ReservationState::FailedKeep {
            reason,
            reserved_gas_wei,
        } => {
            assert!(reason.contains("reverted"));
            assert_eq!(*reserved_gas_wei, 1_000, "retained exposure carried");
        }
        other => panic!("expected FailedKeep, got {other:?}"),
    }
    assert_eq!(
        rec.settle_attempts, 1,
        "first no-evidence failure counts attempt 1"
    );
    // Budget still carries the kept reservation (exposure counted).
    let open = d.journal.exposure_for_test(&leg.chain).unwrap();
    assert_eq!(open, 1_000);
}
