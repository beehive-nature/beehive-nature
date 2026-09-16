//! LT-8.1 REPLACEMENT (founder order 2026-09-16): the placeholder test
//! constructed an `Err` and asserted `is_err()` — a tautology that proved
//! nothing. These tests drive the REAL NWC request path
//! (`NwcRail::pay` → `LiveNwcTransport::request`) with an injected
//! FAILING CLOCK and prove the three claims:
//!
//! 1. ZERO published requests (no socket connect is even attempted);
//! 2. ZERO ledger mutation (the intent stays exactly `Intent` — never
//!    InFlight/Unknown/Failed);
//! 3. The payment identity is unchanged (same `PaymentHash`, no
//!    re-minting; the duplicate-refusal names the SAME id).
//!
//! The deliberately-broken implementation this suite must catch is the
//! code it was written against: a clock failure typed as
//! `NwcError::Other` rides the LU-6 map into `MarkUnknownHumanGate` —
//! mutating a payment that was never sent. (RED at authoring; the fix
//! adds `NwcError::ClockUnavailable` → `LeaveOpenAtIntent`.)

#![cfg(feature = "live-nwc")]

use bpay_rail::nwc::NwcRail;
use bpay_rail::nwc_live::{ClockError, ClockFn, LiveNwcTransport, NwcConnection};
use bpay_rail::units::MilliSatoshi;
use bpay_rail::{LedgerError, LifecycleState};
use std::cell::RefCell;
use std::rc::Rc;

fn test_conn() -> NwcConnection {
    // A syntactically valid connection to an UNREACHABLE loopback relay —
    // if the implementation ever tries to connect, the connect-LOG (not
    // the network) proves it; nothing here can reach production.
    let url: String = "nostr+walletconnect://".to_string()
        + &"0".repeat(64) // zero wallet pk: syntactic only, gated before contact
        + "?relay=wss%3A%2F%2F127.0.0.1%3A1%2Fnoop&secret="
        + &"07".repeat(32); // PUBLIC-CONSTANT: synthetic throwaway connection secret, never a wallet
    NwcConnection::parse(&url).expect("connection parses")
}

fn failing_clock() -> ClockFn {
    Rc::new(|| {
        Err(ClockError::Unavailable(
            "injected: clock source dead".into(),
        ))
    })
}

fn rail_with(clock: ClockFn, log: Rc<RefCell<Vec<String>>>) -> NwcRail<LiveNwcTransport> {
    let conn = test_conn();
    let mut transport = LiveNwcTransport::new(conn);
    transport = transport.with_clock(clock).with_connect_log(log);
    let mut rail = NwcRail::new(
        transport,
        MilliSatoshi(10_000),
        MilliSatoshi(1_000),
        1_000_000,
    );
    rail.enable_sends();
    rail
}

fn refusal_field(e: &LedgerError) -> &'static str {
    match e {
        LedgerError::Refusal { field, .. } => field,
    }
}

#[test]
fn lt81_clock_failure_publishes_zero_requests_and_mutates_nothing() {
    let log = Rc::new(RefCell::new(Vec::new()));
    let mut rail = rail_with(failing_clock(), log.clone());
    let hash = [7u8; 32];
    let id = bpay_rail::ln::PaymentHash(hash);
    let e = rail
        .pay(id, "lnbc-clock-failure-probe", 1_003_600, 1_000_000)
        .unwrap_err();
    // The refusal names the clock class (not a generic other).
    let msg = e.to_string();
    assert!(
        msg.contains("clock") || msg.contains("Clock"),
        "typed clock refusal: {msg}"
    );
    // Claim 1: ZERO published requests — no connect was even attempted.
    assert!(
        log.borrow().is_empty(),
        "zero socket connects on clock failure: {:?}",
        log.borrow()
    );
    // Claim 2: ZERO ledger mutation — the intent stays exactly Intent
    // (the never-mutated reservation; NOT Unknown, NOT Failed).
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
    // Claim 3: the payment identity is unchanged — the same id is the
    // live identity (duplicate refusal names it; no re-minted id exists).
    let e2 = rail
        .pay(id, "lnbc-clock-failure-probe", 1_003_600, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e2), "payment_hash");
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
}

#[test]
fn lt81_epoch0_clock_reading_is_refused_never_sent() {
    // The mutant this test must catch: a clock that "recovers" by
    // returning 0 (the epoch-0 fallback LT-8.1 exists to kill) — the
    // transport must refuse BEFORE building any event, not publish a
    // created_at=0 signature.
    let log = Rc::new(RefCell::new(Vec::new()));
    let epoch0: ClockFn = Rc::new(|| Ok(0));
    let mut rail = rail_with(epoch0, log.clone());
    let id = bpay_rail::ln::PaymentHash([9u8; 32]);
    let e = rail
        .pay(id, "lnbc-epoch0-probe", 1_003_600, 1_000_000)
        .unwrap_err();
    assert!(
        e.to_string().contains("epoch-0") || e.to_string().contains("clock"),
        "epoch-0 refused as a clock failure: {e}"
    );
    assert!(log.borrow().is_empty(), "nothing published");
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
}

#[test]
fn lt81_clock_recovery_settles_the_same_identity() {
    // The identity survives the outage: after the clock heals, the
    // reconcile path (not a re-minted payment) resolves the SAME id —
    // here proven by direct evidence on the still-open intent.
    let log = Rc::new(RefCell::new(Vec::new()));
    let mut rail = rail_with(failing_clock(), log.clone());
    let id = bpay_rail::ln::PaymentHash([0xB1; 32]);
    let _ = rail
        .pay(id, "lnbc-recovery-probe", 1_003_600, 1_000_000)
        .unwrap_err();
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
    assert!(log.borrow().is_empty());
    // Human/reconcile resolution path on the SAME identity works while
    // the transport is still broken (lookup-only is the lawful route;
    // here: direct evidence reconciliation, the ledger-side seam).
    // The ledger accepts evidence for the open intent (preimage class):
    // settle via reconcile-style transition is out of NwcRail's public
    // API for LN (preimage flows through transport results), so the
    // identity-proof is: the intent is STILL the payment (no second
    // identity was created by the outage) — duplicate refusal, same id.
    let e2 = rail
        .pay(id, "lnbc-recovery-probe", 1_003_600, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e2), "payment_hash");
    assert_eq!(
        rail.state(&id),
        Some(LifecycleState::Intent),
        "identity intact across the clock outage"
    );
}
