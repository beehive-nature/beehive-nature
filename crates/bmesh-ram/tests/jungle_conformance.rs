//! Conformance against LIVE **Jungle4** (the b-build's home chain per the two-track
//! ruling, 2026-08-22) — captured 2026-08-22 ~05:4x UTC via
//! `jungle4.api.eosnation.io`, the endpoint pinned by the jungle-account postop.
//!
//! A SECOND chain, independently captured, with independently derived vectors
//! (WSL python3, before these assertions were written — session in the lane receipt).
//!
//! Cross-chain findings, measured:
//! 1. `max_ram_size − total_ram_bytes_reserved == relay base` holds EXACTLY on
//!    Jungle too (68,719,476,736 − 10,608,818,562 = 58,110,658,174) — structural.
//! 2. `quote − total_ram_stake` is again a conserved genesis seed — but **10,000,000.0000
//!    on Jungle, 10× mainnet's 1,000,000.0000** (Jungle's genesis supply seeded init
//!    quote = supply/1000 differently). The LAW is structural; the SEED is per-chain.
//! 3. Round-trip loss on 100.0000 = **9,977 raw — identical to mainnet to the unit**
//!    (both ceil'd fees + exactly two truncation units).
//! 4. `buyrambytes(4096)` again delivers **4095** — the double-fee undershoot
//!    reproduces on an independent chain.

use bmesh_ram::RamMarket;

/// live jungle4 rammarket + global, 2026-08-22
fn jungle_market() -> RamMarket {
    RamMarket::new(
        58_110_658_174,  // base RAM bytes = max − reserved (exact, see J-V4)
        118_256_296_455, // quote "11825629.6455 EOS" raw @ 4 dp
        18_256_296_455,  // global total_ram_stake
    )
}

#[test]
fn jv1_buy_100_tokens_matches_jungle_derivation() {
    let mut m = jungle_market();
    let t = m.buy(1_000_000).unwrap();
    assert_eq!(t.fee, 5_000);
    assert_eq!(t.after_fee, 995_000);
    assert_eq!(t.bytes, 488_934); // python: int(995000*58110658174/(118256296455+995000))
    assert_eq!(m.base_bytes, 58_110_169_240);
    assert_eq!(m.quote_units, 118_257_291_455);
}

#[test]
fn jv2_round_trip_loss_identical_to_mainnet_to_the_unit() {
    let mut m = jungle_market();
    let b = m.buy(1_000_000).unwrap();
    let s = m.sell(b.bytes).unwrap();
    assert_eq!(s.after_fee, 994_998);
    assert_eq!(s.amount_in, 990_023);
    // both fees (9,975) + exactly 2 truncation units — same as mainnet
    assert_eq!(1_000_000 - s.amount_in, 9_977);
}

#[test]
fn jv3_buyrambytes_undershoot_reproduces_on_jungle() {
    let mut m = jungle_market();
    let (cost, cpf) = m.cost_for_bytes(4096);
    assert_eq!(cost, 8_335); // int(118256296455*4096/(58110658174-4096))
    assert_eq!(cpf, 8_376); // int(8335/0.995)
    let t = m.buy(cpf).unwrap();
    assert_eq!(t.fee, 42);
    assert_eq!(t.after_fee, 8_334);
    assert_eq!(t.bytes, 4_095); // one byte short — again, on another chain
}

#[test]
fn jv4_jungle_state_invariants_and_the_ten_million_seed() {
    // structural: base == unallocated supply
    assert_eq!(68_719_476_736_i64 - 10_608_818_562_i64, 58_110_658_174_i64);
    // per-chain genesis seed: Jungle's is 10x mainnet's — the LAW is structural,
    // the SEED is genesis-supply/1000, whatever that supply was
    assert_eq!(
        118_256_296_455_i64 - 18_256_296_455_i64,
        100_000_000_000_i64
    );
    // and lockstep conservation holds under trades:
    let mut m = jungle_market();
    let seed = m.quote_units - m.total_ram_stake;
    let b = m.buy(123_457).unwrap();
    let s = m.sell(b.bytes).unwrap();
    assert_eq!(m.quote_units - m.total_ram_stake, seed);
    assert!(s.amount_in < 123_457);
}
