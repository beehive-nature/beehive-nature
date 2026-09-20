//! SPEC AV-2 — stale conversion quote / TTL replay
//! (`docs/agents/ADVERSARIAL-BPAY-SPECS.md`, P0 head of queue).
//!
//! Written FIRST against the intended law (red-test-first protocol): the
//! gap at the pre-fix crate was proven by audit — zero ttl/expiry/
//! valid_until/stale handling in the cited-rate acceptance path, so a rate
//! quoted at any time credited at deposit time with no bound. Cases 2.2,
//! 2.3 and 2.4 are expected RED on the unfixed crate; their green run is
//! chartered by the receipted RED in this lane's dispatch.

use voucher_escrow::{ConversionQuote, Escrow, VoucherError, QUOTE_TTL_SECS};

const RATE: u128 = 250_000_000; // 2.5 A per USDC, fp8

/// Fingerprint of the whole ledger state: the exact JSONL bytes. Identical
/// fingerprints ⇒ identical chain (every event incl. its prev/hash links;
/// append-only means any mutation moves the fingerprint).
fn chain_fp(es: &Escrow) -> String {
    es.to_jsonl().unwrap()
}

fn quote_with(id: &str, quoted_at: u64) -> ConversionQuote {
    ConversionQuote::new(id, RATE, "estate-rate-card@v1-demo", quoted_at).unwrap()
}

fn fresh_quote(quoted_at: u64) -> ConversionQuote {
    quote_with("q-demo-1", quoted_at)
}

#[test]
fn case_2_1_fresh_quote_deposits_math_unchanged() {
    let mut es = Escrow::new();
    // age = TTL - 1: the newest age that must still credit.
    let quote = fresh_quote(1_000 - (QUOTE_TTL_SECS - 1));
    let ev = es
        .deposit_usdc("member-x", 10_000_000, "0xbase123", &quote, 1_000)
        .unwrap();
    // exact units × rate: 10 USDC × 2.5 = 25.0000 A — no rounding drift.
    assert_eq!(ev["amount"], "25.0000");
    assert_eq!(ev["quote_id"], "q-demo-1");
    assert_eq!(es.balance("member-x"), "25.0000");
    // chain verifies and carries exactly the one deposit row.
    assert_eq!(es.verify_chain().unwrap(), 1);
}

#[test]
fn case_2_2_stale_quote_refused_zero_mutation() {
    let mut es = Escrow::new();
    // Seed one legitimate deposit so "no row / no partial credit" is provable
    // against a non-empty chain, not just an empty one.
    let seed = quote_with("q-seed", 100);
    es.deposit_usdc(
        "member-y",
        1_000_000,
        "0xseed",
        &seed,
        100 + (QUOTE_TTL_SECS - 1),
    )
    .unwrap();
    let pre_fp = chain_fp(&es);
    let pre_balance = es.balance("member-x");

    // age = TTL + 1: refuse with the TYPED error, nothing written.
    let stale = fresh_quote(2_000);
    let now = 2_000 + QUOTE_TTL_SECS + 1;
    let err = es
        .deposit_usdc("member-x", 10_000_000, "0xbad", &stale, now)
        .unwrap_err();
    assert_eq!(
        err,
        VoucherError::StaleQuote {
            age_secs: QUOTE_TTL_SECS + 1,
            ttl_secs: QUOTE_TTL_SECS
        },
        "typed refusal naming age and TTL"
    );
    assert_eq!(
        chain_fp(&es),
        pre_fp,
        "zero ledger mutation — chain identical"
    );
    assert_eq!(es.balance("member-x"), pre_balance, "no partial credit");
    assert_eq!(es.verify_chain().unwrap(), 1, "no row appended");
}

#[test]
fn case_2_2b_future_dated_quote_refused() {
    let mut es = Escrow::new();
    // A quote "quoted" after the deposit time is malformed, not fresh.
    let future = fresh_quote(5_000);
    let err = es
        .deposit_usdc("member-x", 10_000_000, "0xbad", &future, 4_000)
        .unwrap_err();
    assert!(
        matches!(err, VoucherError::StaleQuote { .. }),
        "future-dated quote refuses with the same typed error, got {err:?}"
    );
    assert_eq!(es.verify_chain().unwrap(), 0, "nothing written");
}

#[test]
fn case_2_3_boundary_age_equals_ttl_refused() {
    let mut es = Escrow::new();
    // age == TTL exactly: expiry is INCLUSIVE — fail closed.
    let boundary = fresh_quote(3_000);
    let now = 3_000 + QUOTE_TTL_SECS;
    let err = es
        .deposit_usdc("member-x", 10_000_000, "0xedge", &boundary, now)
        .unwrap_err();
    assert_eq!(
        err,
        VoucherError::StaleQuote {
            age_secs: QUOTE_TTL_SECS,
            ttl_secs: QUOTE_TTL_SECS
        }
    );
    assert_eq!(es.verify_chain().unwrap(), 0);
}

#[test]
fn case_2_4_quote_replay_refused_independent_of_staleness() {
    let mut es = Escrow::new();
    // First use: fresh quote credits.
    let quote = fresh_quote(10_000);
    es.deposit_usdc("member-x", 10_000_000, "0xfirst", &quote, 10_000 + 1)
        .unwrap();
    assert_eq!(es.balance("member-x"), "25.0000");

    // Replay: the SAME quote id, immediately (still fresh), different tx and
    // even a different voucher — single-use is identity-bound, not
    // tx-bound, and staleness is irrelevant to it.
    let replay =
        ConversionQuote::new("q-demo-1", RATE, "estate-rate-card@v1-demo", 10_002).unwrap();
    let err = es
        .deposit_usdc("member-z", 10_000_000, "0xsecond", &replay, 10_003)
        .unwrap_err();
    assert_eq!(err, VoucherError::QuoteReplay("q-demo-1".into()));
    assert_eq!(es.balance("member-x"), "25.0000", "first credit untouched");
    assert_eq!(
        es.balance("member-z"),
        "0.0000",
        "no second credit, any voucher"
    );
    assert_eq!(es.verify_chain().unwrap(), 1);
}

#[test]
fn case_2_4b_replay_refused_across_reload() {
    // The single-use law survives from_jsonl: the quote id burned into the
    // stored event must still refuse after a reload.
    let mut es = Escrow::new();
    let quote = ConversionQuote::new("q-reload-7", RATE, "card@v1", 500).unwrap();
    es.deposit_usdc("member-x", 10_000_000, "0xtx", &quote, 501)
        .unwrap();
    let text = es.to_jsonl().unwrap();

    let reloaded = Escrow::from_jsonl(&text).unwrap();
    let replay = ConversionQuote::new("q-reload-7", RATE, "card@v1", 600).unwrap();
    let mut reloaded = reloaded;
    let err = reloaded
        .deposit_usdc("member-x", 10_000_000, "0xtx2", &replay, 601)
        .unwrap_err();
    assert_eq!(err, VoucherError::QuoteReplay("q-reload-7".into()));
    assert_eq!(reloaded.balance("member-x"), "25.0000");
}

#[test]
fn case_2_1b_dust_and_validation_unchanged_under_quote_api() {
    let mut es = Escrow::new();
    // Dust still refused through the quote API.
    let q = fresh_quote(1);
    assert!(matches!(
        es.deposit_usdc("member-x", 10, "0xdust", &q, 1),
        Err(VoucherError::DustRefused)
    ));
    // Quote validation: empty id / empty rate_ref / zero rate are typed
    // refusals at quote construction (MissingRef / NonPositive).
    assert!(matches!(
        ConversionQuote::new("", RATE, "card@v1", 1),
        Err(VoucherError::MissingRef(_))
    ));
    assert!(matches!(
        ConversionQuote::new("q1", RATE, "", 1),
        Err(VoucherError::MissingRef(_))
    ));
    assert!(matches!(
        ConversionQuote::new("q1", 0, "card@v1", 1),
        Err(VoucherError::NonPositive(_))
    ));
}
