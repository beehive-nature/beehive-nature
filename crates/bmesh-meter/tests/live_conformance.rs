//! Conformance vectors against live mainnet `powup.state` (CPU resource),
//! captured 2026-08-16 via eos.greymass.com on chain `aca376f2…e906` and
//! recorded in `DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16` §2c:
//!
//! ```text
//! exponent 2.0 · min_price 2,500 · max_price 75,000 · decay_secs 86,400
//! utilization 15,771,913,637,620 · weight 381,816,116,585,640
//! adjusted_utilization 18,499,333,784,624
//! ```
//!
//! Expected values were derived INDEPENDENTLY of this crate, by evaluating the
//! closed form from the pinned source's own comment (powerup.cpp:265-269,
//! `p(u) = min + (max-min)·u^(e-1)`, `f(u) = min·u + ((max-min)/e)·u^e`) in
//! python3 (WSL), before the Rust assertions were written. The full session
//! output, pasted verbatim:
//!
//! ```text
//! u   = 0.04130761629094935
//! ua  = 0.048450898170702715
//! adj - util = 2727420147004
//! p_adj (flat price at watermark) = 6012.690117375947
//!
//! case1 raw  = 38750.0   ceil = 38750      (fresh market, whole market [0,1])
//! case2 raw  = 15.747606913882908   ceil = 16     (below watermark, flat only)
//! case2 NO-FLAT raw = 14.63988272889178   ceil = 15
//! case3 raw  = 389.13676519082003   ceil = 390    (spanning the watermark)
//! case4 raw  = 25000.0   ceil = 25000      (exponent-1 trap, half market)
//! ratchet gap=1e6 elapsed=1*decay -> delta=367879 (raw 367879.44117144233)
//! ratchet gap=1e6 elapsed=3*decay -> delta=49787 (raw 49787.06836786395)
//! ```
//!
//! Every non-integer raw value sits at least 0.25 away from an integer
//! boundary, so a last-ulp difference in `powf`/`exp` (the pinned source has
//! the same property via `std::pow`/`std::exp`) cannot move the `ceil`. The
//! two exact integers (38750, 25000) are sums of exactly representable terms
//! (`2500 + 72500/2`, `50000·0.5`).

use bmesh_meter::{ParamError, PriceCurveParams, ResourceMarket, StateError};

const WEIGHT: i64 = 381_816_116_585_640;
const UTILIZATION: i64 = 15_771_913_637_620;
const ADJUSTED: i64 = 18_499_333_784_624;

fn live_params() -> PriceCurveParams {
    PriceCurveParams {
        min_price: 2_500,
        max_price: 75_000,
        exponent: 2.0,
        weight: WEIGHT,
    }
}

fn live_market() -> ResourceMarket {
    ResourceMarket::from_state(live_params(), 86_400, UTILIZATION, ADJUSTED, 1_777_777_777)
        .expect("live captured state satisfies the source invariants")
}

#[test]
fn whole_market_from_zero_costs_min_plus_half_spread() {
    // f(1) - f(0) = 2500 + 72500/2 = 38750 — exactly the integral of the
    // linear price from min to max across the whole market.
    let mut market = ResourceMarket::new(live_params(), 86_400, 0).expect("fresh market is valid");
    assert_eq!(market.calc_fee(WEIGHT), Ok(38_750));
    assert_eq!(market.record_rental(WEIGHT), Ok(38_750));
    assert_eq!(market.utilization(), WEIGHT);
    // Rented out entirely: the watermark catches up at the next update.
    market.update_utilization(1);
    assert_eq!(market.adjusted_utilization(), WEIGHT);
}

#[test]
fn below_watermark_pays_flat_price_at_watermark() {
    // increase 1e12 <= watermark gap 2,727,420,147,004: pure flat stretch.
    // Independent derivation: p_adj * 1e12 / W = 15.7476... -> 16.
    // The curve-only integral for the same stretch is 14.6399... -> 15
    // (see the NO-FLAT line above) — the flat rule changes the answer.
    let market = live_market();
    assert_eq!(market.calc_fee(1_000_000_000_000), Ok(16));
    // The flat price itself: 2500 + 72500 * ua = 6012.690117375947.
    // powf may wobble an ulp across platforms (as does std::pow in the
    // source), so the signal is checked to 1e-9, not bitwise.
    assert!((market.price_now() - 6012.690_117_375_947).abs() < 1e-9);
}

#[test]
fn spanning_rental_pays_flat_then_integral() {
    // increase 2e13 crosses the watermark: flat over d_flat = 2,727,420,147
    // 004 at p_adj, then the integral up to end_u = 0.09368885199898702.
    // Independent derivation: 389.13676... -> 390.
    let market = live_market();
    assert_eq!(market.calc_fee(20_000_000_000_000), Ok(390));
}

#[test]
fn exponent_one_prices_flat_at_max_price() {
    // The trap the lane names: at exponent exactly 1.0 the source's price
    // function returns max_price outright (powerup.cpp:290-292), and
    // configuration then REQUIRES min == max (powerup.cpp:210-211). Both
    // halves are asserted: the flat-at-max pricing...
    let params = PriceCurveParams {
        min_price: 50_000,
        max_price: 50_000,
        exponent: 1.0,
        weight: WEIGHT,
    };
    let market = ResourceMarket::new(params, 86_400, 0).expect("min == max at exponent 1");
    assert_eq!(params.price_at(0), 50_000.0);
    assert_eq!(params.price_at(WEIGHT / 2), 50_000.0);
    assert_eq!(market.calc_fee(WEIGHT / 2), Ok(25_000));
    // ...and the rejection when min != max at exponent 1.0.
    let bad = PriceCurveParams {
        min_price: 49_999,
        ..params
    };
    assert_eq!(
        ResourceMarket::new(bad, 86_400, 0),
        Err(StateError::Params(
            ParamError::ExponentOneRequiresEqualPrices {
                min_price: 49_999,
                max_price: 50_000
            }
        ))
    );
}

#[test]
fn ratchet_decay_matches_one_e_fold_per_decay_secs() {
    // Two independent vectors, gap 1,000,000, from the captured decay_secs.
    // delta truncates toward zero (powerup.cpp:112-113):
    //   after 1 decay:  int(1e6 * e^-1) = int(367879.441...) = 367879
    //   after 3 decays: int(1e6 * e^-3) = int(49787.068...) = 49787
    let base = 1_000_000_000_000_i64;
    let mut after_one = ratchet_market(base, 86_400);
    after_one.update_utilization(86_400);
    assert_eq!(after_one.adjusted_utilization(), base + 367_879);

    let mut after_three = ratchet_market(base, 86_400);
    after_three.update_utilization(3 * 86_400);
    assert_eq!(after_three.adjusted_utilization(), base + 49_787);
}

fn ratchet_market(utilization: i64, decay_secs: u32) -> ResourceMarket {
    ResourceMarket::from_state(
        live_params(),
        decay_secs,
        utilization,
        utilization + 1_000_000,
        0,
    )
    .expect("ratchet fixture is valid")
}
