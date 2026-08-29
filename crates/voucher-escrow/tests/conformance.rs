//! The 16-proof conformance battery, ported 1:1 from
//! `scripts/buzz-meter/test_voucher_escrow.py`. Same laws, same numbers —
//! the Rust core must agree with the Python engine on every claim.

use voucher_escrow::{Escrow, RateSet, VoucherError};

const Q: u128 = 10_000; // 1.0000 A in quatch
const IN_RATE: u128 = 200; // 0.000002 A/token  (fp8)
const OUT_RATE: u128 = 1_000; // 0.000010 A/token  (fp8)

fn rs() -> RateSet {
    RateSet::new(
        "rate_set-2026-08-29-v1",
        "anthropic-posted-2026-08",
        vec![
            ("prefill_token", IN_RATE),
            ("decode_token", OUT_RATE),
            ("vram_byte_second", 10),
        ],
    )
    .unwrap()
}

#[test]
fn proofs_1_to_10() {
    let mut es = Escrow::new();

    // 1. deposit refuses without vaulta_tx
    assert!(matches!(
        es.deposit("member-abc", 5 * Q, "", "", "", 1),
        Err(VoucherError::MissingRef(_))
    ));
    // 2. deposit recorded, tx-cited
    let ev = es
        .deposit(
            "member-abc",
            5 * Q,
            "6eddf2c1demo",
            "vaulta-account-1",
            "member-abc",
            1,
        )
        .unwrap();
    assert_eq!(ev["type"], "DEPOSIT");
    assert_eq!(ev["sender"], "vaulta-account-1"); // A-rail rider: memo-native fields recorded
    assert_eq!(ev["memo"], "member-abc");
    // 3. balance derived = 5.0000
    assert_eq!(es.balance("member-abc"), "5.0000");
    // 4. charge metered: total 0.4400 incl. DISTINCT tithe line 0.0400
    let r = es
        .charge(
            "member-abc",
            &[("prefill_token", 100_000), ("decode_token", 20_000)],
            &rs(),
            2,
        )
        .unwrap();
    let total = Escrow::receipt_total_quatch(&r);
    let tithe = Escrow::receipt_tithe_quatch(&r);
    assert_eq!(voucher_escrow::fmt_a(total), "0.4400");
    assert_eq!(voucher_escrow::fmt_a(tithe), "0.0400");
    assert!(r["line_items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|li| li["resource"] == "tithe.founder"));
    assert!(r["line_items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|li| li.get("rate_set_ref").is_some()));
    // 5. balance after charge
    assert_eq!(es.balance("member-abc"), "4.5600");
    // 6. refuse-before-write: over-balance charge appends NOTHING
    let before = es.event_count();
    match es.charge("member-abc", &[("decode_token", 5_000_000)], &rs(), 3) {
        Err(VoucherError::InsufficientVoucher { .. }) => {}
        other => panic!("FAIL: over-balance accepted: {other:?}"),
    }
    assert_eq!(es.event_count(), before, "ledger changed on refusal!");
    // 7. stolen-key ceiling: drain to hard stop, residual < one hit
    let mut drained = 0u32;
    while es
        .charge("member-abc", &[("decode_token", 100_000)], &rs(), 4)
        .is_ok()
    {
        drained += 1;
    }
    let residual = es.balance("member-abc");
    assert!(parse(&residual) < 11 * Q / 10, "residual {residual}");
    // 8. closed resource enum
    assert!(matches!(
        RateSet::new("x", "x", vec![("magic.beans", 1)]),
        Err(VoucherError::UnknownResourceClass(_))
    ));
    // 9. chain verifies clean
    let n = es.verify_chain().unwrap();
    assert!(n >= 6);
    // 10. tamper caught: shrink a past bill, chain breaks
    es.tamper_event(1, |ev| {
        if let Some(items) = ev["line_items"].as_array_mut() {
            for li in items {
                li["charged"] = serde_json::json!("0.0001");
            }
        }
    });
    assert!(matches!(es.verify_chain(), Err(VoucherError::Tamper(1))));
}

#[test]
fn proofs_11_to_16_usdc_rail() {
    let mut es = Escrow::new();

    // 11. refuses without base_tx / rate_ref
    assert!(matches!(
        es.deposit_usdc("member-x", 10_000_000, "", 25_000_000, "card@v1", 1),
        Err(VoucherError::MissingRef(_))
    ));
    assert!(matches!(
        es.deposit_usdc("member-x", 10_000_000, "0xabc", 25_000_000, "", 1),
        Err(VoucherError::MissingRef(_))
    ));
    // 12. 10 USDC @ 2.5 -> 25.0000 A credited; rate + rate_ref on the event
    let ev = es
        .deposit_usdc(
            "member-x",
            10_000_000,
            "0xbase123",
            250_000_000,
            "estate-rate-card@v1-demo",
            2,
        )
        .unwrap();
    assert_eq!(ev["currency_in"], "USDC");
    assert_eq!(ev["chain_in"], "base");
    assert_eq!(ev["usdc_amount"], "10.000000");
    assert_eq!(ev["rate_a_per_usdc"], "2.5");
    assert_eq!(es.balance("member-x"), "25.0000");
    // 13. mixed rails sum to ONE A balance
    es.deposit("member-x", 5 * Q, "vlt789", "", "", 3).unwrap();
    assert_eq!(es.balance("member-x"), "30.0000");
    // 14. metering unchanged on the mixed balance; tithe intact
    let r = es
        .charge("member-x", &[("decode_token", 20_000)], &rs(), 4)
        .unwrap();
    assert_eq!(
        voucher_escrow::fmt_a(Escrow::receipt_total_quatch(&r)),
        "0.2200"
    );
    assert_eq!(
        voucher_escrow::fmt_a(Escrow::receipt_tithe_quatch(&r)),
        "0.0200"
    );
    assert_eq!(es.balance("member-x"), "29.7800");
    // 15. dust refused (credit rounds to zero)
    assert!(matches!(
        es.deposit_usdc("member-x", 10, "0xdust", 250_000_000, "card@v1", 5),
        Err(VoucherError::DustRefused)
    ));
    // 16. chain verifies with the USDC event shape
    let n = es.verify_chain().unwrap();
    assert_eq!(n, 3, "3 events: 2 deposits + 1 charge");
}

fn parse(a: &str) -> u128 {
    let (i, f) = a.split_once('.').unwrap();
    i.parse::<u128>().unwrap() * 10_000 + format!("{f:<04}").parse::<u128>().unwrap()
}

/// PROOF 17 — WIRE LAW v1, the ensure_ascii clause.
///
/// Python's `json.dumps` escapes non-ASCII by default; serde_json emits raw
/// UTF-8. Without matching that, the two forms hash the SAME event differently
/// the moment any string carries a non-ASCII character — a voucher name, a
/// memo, a cost-basis ref — and the estate would have two laws again.
///
/// The expected hash below was produced by running the REAL Python engine's
/// canonicalisation over this exact body (sorted keys, compact separators,
/// ensure_ascii). It is a foreign oracle, not this crate's own output:
///
/// ```text
/// canon: {"amount":"5.0000","chain_in":"vaulta","currency_in":"A","ts":1500,
///         "type":"DEPOSIT","vaulta_tx":"tx1","voucher":"café"}
/// hash : 30c1df09b4aed34617a490544e0405a73a3ca3c1dc74c0e47fc6157e0205f64c // PUBLIC-CONSTANT
/// ```
///
/// The raw-UTF-8 rendering hashes to a DIFFERENT value, which is what this
/// asserts against: it fails loudly if the escaping is ever dropped.
#[test]
fn proof_17_non_ascii_hashes_exactly_as_python() {
    let mut es = Escrow::new();
    let ev = es
        .deposit("caf\u{e9}", 5 * Q, "tx1", "", "", 1500)
        .expect("deposit");
    assert_eq!(
        ev["hash"].as_str().unwrap(),
        // PUBLIC-CONSTANT: a test vector computed by the Python reference engine
        "30c1df09b4aed34617a490544e0405a73a3ca3c1dc74c0e47fc6157e0205f64c", // PUBLIC-CONSTANT: a test vector from the Python reference engine
        "a non-ASCII voucher must hash exactly as the Python engine hashes it"
    );
    assert_eq!(es.verify_chain().unwrap(), 1);
}

/// PROOF 18 — THE CROSS-FORM ACCEPTANCE. A ledger written by the OTHER form
/// verifies here, byte-for-byte, through `from_jsonl`.
///
/// The fixture in `tests/fixtures/python_ledger.jsonl` was written by the REAL
/// in-tree `scripts/buzz-meter/voucher_escrow.py` — the same code the box runs
/// — not by this crate. It is deliberately adversarial for everything that has
/// forked the two forms so far:
///
///   · FLOAT timestamps (`1787997957.817159`), the class that made an intact
///     chain report Tamper when verification re-serialised structs;
///   · a NON-ASCII voucher (`café-Ω-voucher`), escaped as Python
///     escapes it and as serde_json would not;
///   · both funding rails, A/Vaulta and USDC/Base, in one chain.
///
/// It passes because `verify_chain` hashes the STORED BODY BYTES (rule 3) and
/// never asks a serialiser to reproduce them. That is the whole point: this
/// test would keep passing against divergences nobody has found yet.
///
/// Python's own reading of this ledger, for comparison:
///   balance member-abc       = 29.5600
///   balance café-Ω-voucher  = 1.0000
#[test]
fn proof_18_a_python_written_ledger_verifies_here() {
    let text = include_str!("../fixtures/python_ledger.jsonl");
    let es = Escrow::from_jsonl(text).expect("the Python ledger must load");
    assert_eq!(es.event_count(), 5, "five events, as Python wrote them");
    assert_eq!(
        es.verify_chain().unwrap(),
        5,
        "a chain written by the other form must verify here"
    );
    // and the money agrees, which is the part that actually matters
    assert_eq!(es.balance("member-abc"), "29.5600");
    assert_eq!(es.balance("caf\u{e9}-\u{3a9}-voucher"), "1.0000");
}

/// PROOF 19 — the loader refuses rather than half-reads, and a real on-disk
/// edit is still caught. Red-then-green in the same shape as proof 17.
#[test]
fn proof_19_a_tampered_or_malformed_line_is_refused() {
    let text = include_str!("../fixtures/python_ledger.jsonl");

    // one edited byte in a STORED body — an attacker with the ledger file
    let tampered = text.replacen("\"charged\":\"0.2000\"", "\"charged\":\"0.0001\"", 1);
    let es = Escrow::from_jsonl(&tampered).expect("still parses");
    assert!(
        matches!(es.verify_chain(), Err(VoucherError::Tamper(1))),
        "an edited stored byte must break the chain at that event"
    );

    // a line that is not an event at all
    assert!(Escrow::from_jsonl("{\"nope\":1}").is_err());
    assert!(Escrow::from_jsonl("not json").is_err());
    // blank lines are skipped, not treated as events
    assert_eq!(Escrow::from_jsonl("\n\n").unwrap().event_count(), 0);
}
