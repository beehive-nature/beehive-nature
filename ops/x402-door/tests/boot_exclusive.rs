//! The boot-sequence suite (gesture-D F1, 2026-09-17): the door binary's
//! startup order — `Journal::open_exclusive` (the process-lifetime OS lock,
//! D-5) followed by `recover_stranded_settling` — must COMPLETE. RED at
//! authoring time, before the accompanying journal change in the same
//! pass: every mutation through an exclusively-opened instance (recovery
//! included) re-acquired the OS lock on a SECOND file handle, and std
//! file locks conflict per open file description even within one process
//! — so startup waited on its own lifetime hold forever. Box evidence at
//! the stop receipt (kernel stack `locks_lock_inode_wait` on
//! `/var/lib/x402-door/.lock`, library repro killed at 10s exit 124):
//! docs/dispatches/2026-09-17-gesture-d-stop-at-boot-receipt.md §3.
//!
//! Every call through an exclusive instance runs under `under_deadline`
//! so the deadlock FAILS a test in bounded time instead of hanging the
//! suite — the failure mode itself is the thing under test.

use x402_door::journal::{Journal, ReservationState};
use x402_door::wire::extract_leg;

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir()
        .join("x402-door-boot")
        .join(format!("{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn request(chain: &str, scheme: &str, nonce: &str, max_or_value: &str) -> serde_json::Value {
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
                "validBefore": (x402_door::journal::now_unix() + 3600).to_string(),
                amount_key: max_or_value
            }
        }
    })
}

/// Run `f` on a helper thread and fail LOUD if it does not finish in
/// 10s — a blocked call here is the boot self-deadlock, not slowness
/// (the receipt's library repro used the same 10s budget).
fn under_deadline<T: Send + 'static>(what: &str, f: impl FnOnce() -> T + Send + 'static) -> T {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::Builder::new()
        .name(format!("boot:{what}"))
        .spawn(move || {
            let _ = tx.send(f());
        })
        .expect("spawn boot-sequence thread");
    match rx.recv_timeout(std::time::Duration::from_secs(10)) {
        Ok(v) => v,
        Err(_) => panic!(
            "SELF-DEADLOCK (F1, stop receipt 2026-09-17): {what} did not \
             complete in 10s — the exclusive instance already owns the \
             process-lifetime journal lock and the operation is blocking \
             to acquire it a second time on a fresh file handle"
        ),
    }
}

/// Boot bar 1: a FRESH journal's startup sequence completes — exclusive
/// open, then recovery over the empty root, under the hold.
#[test]
fn boot_fresh_journal_startup_recovery_completes() {
    let root = tmp_root("fresh");
    let (parked, second_pass) = under_deadline("fresh boot: open_exclusive + recover", move || {
        let j = Journal::open_exclusive(&root, 1_000_000).unwrap();
        let parked = j.recover_stranded_settling().unwrap();
        let second_pass = j.recover_stranded_settling().unwrap();
        (parked, second_pass)
    });
    assert!(parked.is_empty(), "fresh journal has nothing stranded");
    assert!(second_pass.is_empty(), "recovery is idempotent");
}

/// Boot bar 2 + 3: RESTART with an existing journal whose prior instance
/// crashed mid-settle — the stranded `Settling` leg is recovered UNDER
/// the exclusive ownership (parked to Unknown for the human gate), the
/// untouched `Reserved` leg survives, and the parked leg still refuses
/// automated re-execution.
#[test]
fn boot_restart_recovers_stranded_settling_under_exclusive_ownership() {
    let root = tmp_root("restart");
    // The "crash": a prior non-exclusive instance strands one leg in
    // Settling (begin_settle completed, evidence never recorded).
    let leg_s = extract_leg(&request("eip155:8453", "exact", "0xB1", "1")).unwrap();
    let leg_r = extract_leg(&request("eip155:8453", "exact", "0xB2", "1")).unwrap();
    {
        let j = Journal::open(&root, 1_000_000).unwrap();
        j.reserve(&leg_s, 100, 1_000).unwrap();
        j.reserve(&leg_r, 100, 1_000).unwrap();
        j.begin_settle(&leg_s).unwrap();
    } // drop = "process died with the leg in flight"

    let report = under_deadline("restart boot: open_exclusive + recover", move || {
        let j = Journal::open_exclusive(&root, 1_000_000).unwrap();
        let parked = j.recover_stranded_settling().unwrap();
        let again = j.recover_stranded_settling().unwrap();
        let parked_state = j.get(&leg_s).unwrap().map(|r| r.state);
        let live_state = j.get(&leg_r).unwrap().map(|r| r.state);
        // The door SERVES after boot: a parked leg demands the human gate.
        let gate_refusal = j.begin_settle(&leg_s).err().map(|e| e.to_string());
        (parked, again, parked_state, live_state, gate_refusal)
    });

    let (parked, again, parked_state, live_state, gate_refusal) = report;
    assert_eq!(parked.len(), 1, "exactly the stranded leg reconciled");
    assert!(again.is_empty(), "second recovery pass finds nothing");
    match parked_state {
        Some(ReservationState::Unknown { note, .. }) => assert!(
            note.contains("Settling at restart"),
            "named note: {note}"
        ),
        other => panic!("stranded leg must park to Unknown, got {other:?}"),
    }
    assert!(
        matches!(live_state, Some(ReservationState::Reserved { .. })),
        "the untouched leg stays Reserved"
    );
    let gate_refusal = gate_refusal.unwrap_or_default();
    assert!(
        gate_refusal.contains("human gate"),
        "parked leg never auto-retried: {gate_refusal}"
    );
}

/// The deadlock was never only recovery: ANY mutation through the
/// exclusive instance re-acquired against its own lifetime hold. Boot is
/// not done until the door can actually serve — reserve, execute the
/// settled transition, and record evidence, all under the hold.
#[test]
fn boot_exclusive_instance_serves_mutations_under_its_hold() {
    let root = tmp_root("serve");
    let leg = extract_leg(&request("eip155:8453", "exact", "0xB3", "1")).unwrap();
    let settled = under_deadline("serving mutations under the hold", move || {
        let j = Journal::open_exclusive(&root, 1_000_000).unwrap();
        j.reserve(&leg, 100, 1_000).unwrap();
        assert!(j.begin_settle(&leg).unwrap().is_none());
        j.settle_with_evidence(
            &leg,
            &x402_door::journal::SettleEvidence {
                actual_amount: "1".into(),
                tx_hash: "0xB3X".into(),
                gas_actual_wei: 5,
            },
        )
        .unwrap();
        j.get(&leg).unwrap().map(|r| r.state)
    });
    assert!(
        matches!(settled, Some(ReservationState::Settled { .. })),
        "the leg settles with evidence under the hold, got {settled:?}"
    );
}

/// Boot bar 4, pinned at the boot seam (the d_specs D-5 law test is the
/// authority; this keeps the boot file honest about what the hold means):
/// while the first instance owns the journal, a second exclusive start is
/// REFUSED by name — and the hold still dies with its instance.
#[test]
fn boot_second_exclusive_start_refused_while_first_holds() {
    let root = tmp_root("second");
    let first = Journal::open_exclusive(&root, 1_000).unwrap();
    let err = Journal::open_exclusive(&root, 1_000)
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default();
    assert!(
        err.contains("already held by a live opener") && err.contains("D-5"),
        "second exclusive start refuses named: {err}"
    );
    drop(first);
    assert!(
        Journal::open_exclusive(&root, 1_000).is_ok(),
        "the hold dies with its instance"
    );
}
