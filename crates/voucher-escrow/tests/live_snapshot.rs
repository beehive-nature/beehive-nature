//! CONFORMANCE ACCEPTANCE — the live on-box ledger, snapshotted.
//!
//! `fixtures/live-ledger-snapshot.jsonl` is a verbatim snapshot of the
//! production escrow ledger on the Oracle box (events only — secrets never
//! live in the ledger; bearer keys stay in keys.json, root-vaulted, excluded).
//! The Rust core must (a) verify the Python engine's hash chain exactly as
//! written — cross-language byte-conformance of the canonicalization law —
//! and (b) derive the same balances the box reports.
//!
//! Snapshot taken 2026-08-29: 6 events — 2 migration seeds (citing
//! migration-from-keys.json), 1 A-rail proof deposit, 1 proof charge,
//! 1 USDC-rail proof deposit (12 USDC @ 2.5 → 30 A), 1 USDC-rail charge.

use voucher_escrow::Escrow;

fn load() -> Vec<serde_json::Value> {
    let raw = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures/live-ledger-snapshot.jsonl"),
    )
    .expect("fixture present");
    raw.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).expect("each line parses"))
        .collect()
}

#[test]
fn live_chain_verifies_in_rust() {
    let events = load();
    // the Python-written chain must verify under the Rust hash law, exactly
    let n = Escrow::verify_external_chain(&events)
        .expect("the live Python chain verifies in the Rust core");
    assert_eq!(n, 6, "6 events in the snapshot");
}

#[test]
fn live_balances_derive_identically() {
    let events = load();
    // the balances the box proved live on 2026-08-29 (receipts in-tree)
    assert_eq!(Escrow::external_balance(&events, "bclau-paid-1"), "1.0000");
    assert_eq!(Escrow::external_balance(&events, "p3-test-key"), "0.5000");
    assert_eq!(
        Escrow::external_balance(&events, "live-proof-test-1"),
        "1.3400"
    );
    assert_eq!(Escrow::external_balance(&events, "baseproof-1"), "29.3400");
    // zero-balance keys derive to zero — nothing up anyone's sleeve
    assert_eq!(
        Escrow::external_balance(&events, "estate-compute-key-1"),
        "0.0000"
    );
}

#[test]
fn tamper_in_snapshot_is_caught() {
    let mut events = load();
    // an attacker shrinks their own USDC credit in the snapshot
    if let Some(amt) = events[4].get_mut("amount") {
        *amt = serde_json::json!("1.0000");
    }
    assert!(
        Escrow::verify_external_chain(&events).is_err(),
        "an edited snapshot event must break the chain under Rust verification too"
    );
}

/// THE ACCEPTANCE, UNDER RULE 3 — the live box ledger verified from its
/// **stored bytes**, not from re-serialised values.
///
/// The two tests above verify the same snapshot through
/// `verify_external_chain`, which re-renders each parsed body. That works on
/// these six events, and it is the fragile path: it asks two serialisers in two
/// languages to agree about float rendering, key order and string escaping,
/// which no format guarantees. A five-event ledger written by the in-tree
/// Python engine fails that way at event 2 on a single float digit — while
/// another event with the same digit count passes. The divergence is
/// value-specific and cannot be enumerated.
///
/// So the live ledger is also verified the way rule 3 requires: loaded with
/// `from_jsonl`, which keeps each body's bytes exactly as the box wrote them,
/// and checked against those. This is the test that keeps passing when the next
/// unenumerable fork appears.
#[test]
fn live_chain_verifies_from_its_stored_bytes() {
    let raw = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures/live-ledger-snapshot.jsonl"),
    )
    .expect("fixture present");

    let es = Escrow::from_jsonl(&raw).expect("the live box ledger must load");
    assert_eq!(es.event_count(), 6, "6 events in the snapshot");
    assert_eq!(
        es.verify_chain()
            .expect("the live chain verifies from stored bytes"),
        6
    );

    // and the money agrees with what the box reported, read the same way
    assert_eq!(es.balance("bclau-paid-1"), "1.0000");
    assert_eq!(es.balance("p3-test-key"), "0.5000");
    assert_eq!(es.balance("live-proof-test-1"), "1.3400");
    assert_eq!(es.balance("baseproof-1"), "29.3400");
    assert_eq!(es.balance("estate-compute-key-1"), "0.0000");
}

/// …and an edited byte in the live snapshot is still caught through the
/// stored-bytes path. Red-then-green in the same shape as the rest.
#[test]
fn tamper_in_the_live_snapshot_is_caught_from_stored_bytes() {
    let raw = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures/live-ledger-snapshot.jsonl"),
    )
    .expect("fixture present");
    // an attacker shrinks a credit in the file itself
    let edited = raw.replacen("\"amount\":\"30.0000\"", "\"amount\":\"1.0000\"", 1);
    assert_ne!(edited, raw, "the edit must actually land in the bytes");
    let es = Escrow::from_jsonl(&edited).expect("still parses");
    assert!(
        es.verify_chain().is_err(),
        "an edited stored byte must break the live chain"
    );
}
