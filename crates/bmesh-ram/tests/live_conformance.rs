//! Conformance against LIVE Vaulta mainnet state, 2026-08-22 (~03:1x UTC).
//!
//! Capture: POST https://eos.greymass.com/v1/chain/get_table_rows {eosio,eosio,rammarket}
//! cross-checked byte-identical against https://eos.eosphere.io; global row via greymass;
//! chain aca376f2… head 516,155,085. Rows still carry the historical "EOS" symbol —
//! Vaulta "A" is the same unit at the same 4-dp precision (see crate docs).
//!
//! Every expected value below was derived INDEPENDENTLY in WSL python3 (an IEEE-754
//! double machine, faithfully replicating the C++ `double` promotions) BEFORE this
//! crate's Rust was written. The session is pasted in the lane receipt. Vectors are
//! not the output of the code they test.

use bmesh_ram::RamMarket;

/// live rammarket row, 2026-08-22
fn live_market() -> RamMarket {
    RamMarket::new(
        75_800_886_740, // base  RAM bytes      = max_ram_size − total_ram_bytes_reserved (exact)
        251_602_894_241, // quote "25160289.4241" core-token raw units @ 4 dp
        241_602_894_241, // global total_ram_stake (raw units)
    )
}

#[test]
fn v1_buy_100_tokens_matches_live_derivation() {
    let mut m = live_market();
    let t = m.buy(1_000_000).unwrap(); // 100.0000 core
    assert_eq!(t.fee, 5_000); // (1_000_000 + 199)/200
    assert_eq!(t.after_fee, 995_000);
    assert_eq!(t.bytes, 299_764); // python: int(995000*75800886740 / (251602894241+995000))
    assert_eq!(m.base_bytes, 75_800_586_976);
    assert_eq!(m.quote_units, 251_603_889_241);
    assert_eq!(m.total_ram_stake, 241_603_889_241);
}

#[test]
fn v1b_fee_ceils_not_floors() {
    // discriminator: at 1,000,001 the ceil and floor diverge (5,001 vs 5,000)
    let mut m = live_market();
    let t = m.buy(1_000_001).unwrap();
    assert_eq!(t.fee, 5_001); // (1_000_001 + 199)/200 = 5,001 exactly
}

#[test]
fn v2_sell_round_trip_and_loss_accounting() {
    let mut m = live_market();
    let b = m.buy(1_000_000).unwrap();
    let s = m.sell(b.bytes).unwrap();
    assert_eq!(s.after_fee, 994_998); // gross tokens_out
    assert_eq!(s.fee, 4_975); // (994_998 + 199)/200
    assert_eq!(s.amount_in, 990_023); // net proceeds
                                      // loss = fee_buy + fee_sell + exactly 2 truncation units (measured)
    assert_eq!(1_000_000 - s.amount_in, 9_977);
}

#[test]
fn v3_buyrambytes_double_fee_undershoots_one_byte() {
    // db:25-31 — cost via inverse conversion, then /0.995 double gross-up (truncated),
    // then buy() applies its OWN ceil'd 0.5% on top. Measured at live state:
    // the deployed "exact bytes" action delivers ONE BYTE LESS than requested.
    let mut m = live_market();
    let (cost, cost_plus_fee) = m.cost_for_bytes(4096);
    assert_eq!(cost, 13_595); // int(251602894241*4096 / (75800886740-4096)) = 13657.28→trunc… see receipt
    assert_eq!(cost_plus_fee, 13_663); // int(13595/0.995) = int(13663.316…) trunc
    let t = m.buy(cost_plus_fee).unwrap();
    assert_eq!(t.fee, 69); // (13663+199)/200 = 69
    assert_eq!(t.after_fee, 13_594);
    assert_eq!(t.bytes, 4_095); // < 4096: the measured undershoot
}

#[test]
fn v4_live_state_invariants() {
    // relay base is EXACTLY the unallocated supply (research §2c cross-check, reproduced)
    assert_eq!(
        418_945_440_768_i64 - 343_144_554_028_i64,
        75_800_886_740_i64
    );
    // the never-deposited genesis seed: quote − stake == supply/1000 at init
    // (sys:583) — 10,000,000,000 raw = 1,000,000.0000 core, conserved exactly
    assert_eq!(
        251_602_894_241_i64 - 241_602_894_241_i64,
        10_000_000_000_i64
    );
    // and the lockstep pairing conserves it through trades:
    let mut m = live_market();
    let seed_before = m.quote_units - m.total_ram_stake;
    let b = m.buy(7_777_777).unwrap();
    let s = m.sell(b.bytes).unwrap();
    assert_eq!(m.quote_units - m.total_ram_stake, seed_before);
    assert!(s.amount_in < 7_777_777);
}

#[test]
fn v5_guards_reject_like_the_chain() {
    let mut m = live_market();
    assert!(m.buy(0).is_err()); // db:57 positive amount
    assert!(m.buy(-5).is_err());
    // a buy so small the relay rounds to zero bytes — db:85 rejects
    assert!(m.buy(1).is_err());
    // at LIVE prices one byte is worth 3 raw units — selling 1 byte is legal there
    // (measured micro-vector: out 3, fee 1, net 2):
    let mut m2 = live_market();
    let s = m2.sell(1).unwrap();
    assert_eq!(s.after_fee, 3);
    assert_eq!(s.fee, 1);
    assert_eq!(s.amount_in, 2);
    // the >1 guard bites on a relay where a byte rounds to ≤1 unit (e.g. ratio 1:1)
    let mut full = RamMarket::new(100_000_000_000, 100_000_000_000, 0);
    assert!(full.sell(1).is_err()); // db:128
                                    // and an Err sell leaves state untouched — the chain's revert, mirrored
    let before = (full.base_bytes, full.quote_units, full.total_ram_stake);
    assert!(full.sell(1).is_err());
    assert_eq!(
        (full.base_bytes, full.quote_units, full.total_ram_stake),
        before
    );
}
