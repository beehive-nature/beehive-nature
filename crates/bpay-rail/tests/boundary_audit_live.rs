//! BOUNDARY AUDIT — the provenance law (founder order 2026-09-16):
//!
//! *uncertainty begins only after an irreversible external boundary has
//! actually been crossed. A local failure leaves the existing intent
//! open; it cannot manufacture `Unknown`.*
//!
//! Boundaries: LOCAL/PRE-SEND → SUBMITTED/UNACKNOWLEDGED →
//! RELAY-ACKNOWLEDGED → COUNTERPARTY-OBSERVED → SETTLEMENT-EVIDENCED.
//!
//! This file: the live-transport probes (live-nwc gated). The RED
//! receipts at authoring time, against the unmodified code:
//! (1) connect failure (DNS/socket/TLS) was typed TransportAmbiguous —
//!     a payment that was NEVER sent went Unknown;
//! (2) local crypto construction failure rode Other — same disease;
//! (3) relay OK=false was IGNORED by the read loop (fell through to
//!     window exhaustion → Unknown) though the relay DEFINITIVELY
//!     refused — the event never entered the network.

#![cfg(feature = "live-nwc")]

use bpay_rail::nwc::NwcRail;
use bpay_rail::nwc_live::{ClockFn, LiveNwcTransport, NwcConnection};
use bpay_rail::units::MilliSatoshi;
use bpay_rail::{LedgerError, LifecycleState};
use std::cell::RefCell;
use std::rc::Rc;

fn test_conn() -> NwcConnection {
    let url: String = "nostr+walletconnect://".to_string()
        + "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" // PUBLIC-CONSTANT: x-only G — synthetic valid wallet point, never a wallet
        + "?relay=wss%3A%2F%2F127.0.0.1%3A1%2Fnoop&secret="
        + &"07".repeat(32); // PUBLIC-CONSTANT: synthetic throwaway connection secret, never a wallet
    NwcConnection::parse(&url).expect("connection parses")
}

fn ok_clock() -> ClockFn {
    Rc::new(|| Ok(1_000_000))
}

fn rail(transport: LiveNwcTransport) -> NwcRail<LiveNwcTransport> {
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

// ── LOCAL/PRE-SEND: nothing of ours escaped → intent stays open ────────

#[test]
fn ba_connect_failure_is_local_intent_stays_open() {
    // DNS/socket/connect/TLS: no application byte reached any relay.
    let mut transport = LiveNwcTransport::new(test_conn());
    let log = Rc::new(RefCell::new(Vec::new()));
    transport = transport
        .with_clock(ok_clock())
        .with_connect_log(log.clone());
    transport.connect_fail_next = true; // the boundary seam: fail BEFORE connecting
    let mut rail = rail(transport);
    let id = bpay_rail::ln::PaymentHash([0xC1; 32]);
    let e = rail
        .pay(id, "lnbc-ba-connect", 1_003_600, 1_000_000)
        .unwrap_err();
    assert!(
        e.to_string().contains("connect") || e.to_string().contains("Connect"),
        "names the local class: {e}"
    );
    assert!(
        !e.to_string().contains("ambiguous") && !e.to_string().contains("AMBIGUOUS"),
        "a pre-send failure is NEVER ambiguous: {e}"
    );
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
    assert!(log.borrow().is_empty(), "no connection was made");
    // Identity intact: the same id remains the live intent.
    let e2 = rail
        .pay(id, "lnbc-ba-connect", 1_003_600, 1_000_000)
        .unwrap_err();
    assert_eq!(refusal_field(&e2), "payment_hash");
}

#[test]
fn ba_local_crypto_failure_is_local_intent_stays_open() {
    // CSPRNG/serialization/signature-construction failure happens BEFORE
    // any byte is sent — same law as the clock (R17 class).
    let mut transport = LiveNwcTransport::new(test_conn());
    let log = Rc::new(RefCell::new(Vec::new()));
    transport = transport
        .with_clock(ok_clock())
        .with_connect_log(log.clone());
    transport.encrypt_fail_next = true; // fail at the local construction seam
    let mut rail = rail(transport);
    let id = bpay_rail::ln::PaymentHash([0xC2; 32]);
    let e = rail
        .pay(id, "lnbc-ba-crypto", 1_003_600, 1_000_000)
        .unwrap_err();
    assert!(
        e.to_string().contains("local")
            || e.to_string().contains("crypto")
            || e.to_string().contains("construction"),
        "names the local construction class: {e}"
    );
    assert!(!e.to_string().contains("AMBIGUOUS"), "pre-send: {e}");
    assert_eq!(rail.state(&id), Some(LifecycleState::Intent));
    assert!(log.borrow().is_empty(), "nothing published");
}

// ── Malformed local configuration never reaches a ledger ───────────────

#[test]
fn ba_malformed_config_fails_at_construction_no_rail_exists() {
    let bad = "definitely-not-a-walletconnect-url";
    assert!(NwcConnection::parse(bad).is_err());
    let no_secret =
        "nostr+walletconnect://".to_string() + &"0".repeat(64) + "?relay=wss%3A%2F%2F127.0.0.1%3A1";
    assert!(NwcConnection::parse(&no_secret).is_err());
    let short_secret = "nostr+walletconnect://".to_string()
        + &"0".repeat(64)
        + "?relay=wss%3A%2F%2F127.0.0.1%3A1&secret=0707"; // PUBLIC-CONSTANT: malformed synthetic secret
    assert!(NwcConnection::parse(&short_secret).is_err());
    // Every failure is at construction: there is no transport, no
    // request, and no ledger to mutate — the earliest possible boundary.
}

// ── SUBMITTED and beyond: Unknown is LAWFUL (pins, not bugs) ───────────

#[test]
fn ba_send_failure_after_connect_is_submitted_hence_unknown() {
    // Connect SUCCEEDS, then the event write fails: bytes may have
    // escaped — the transport boundary WAS crossed → Unknown.
    let mut transport = LiveNwcTransport::new(test_conn());
    let log = Rc::new(RefCell::new(Vec::new()));
    transport = transport
        .with_clock(ok_clock())
        .with_connect_log(log.clone());
    transport.send_fail_next = true; // fail AFTER connect, at the write
    let mut rail = rail(transport);
    let id = bpay_rail::ln::PaymentHash([0xC3; 32]);
    let st = rail
        .pay(id, "lnbc-ba-sendfail", 1_003_600, 1_000_000)
        .unwrap();
    assert_eq!(st, LifecycleState::Unknown);
    assert_eq!(
        log.borrow().len(),
        1,
        "the connection WAS made — boundary crossed"
    );
}
