//! Negative controls (8r culture): tests that MUST FAIL if a guard is
//! deleted from the implementation. If one of these stops failing, the
//! invariant it guards went vacuous — that is a defect in the test, not a
//! reason to celebrate a green run.
//!
//! Proven by mutation during the lane (receipts in
//! `RECEIPT_ZCODE_R2_BMESH_METER_2026-08-16`): with the `exponent >= 1.0`
//! check removed from `PriceCurveParams::validate`,
//! `exponent_guard_rejects_below_one` fails; with the
//! flat-below-watermark block removed from `ResourceMarket::calc_fee`,
//! `flat_below_watermark_is_priced_not_vacuous` fails.
//!
//! The rejection-path tests at the bottom pin the source's literal behaviors
//! that a reasonable implementation might "fix" into something else.

use bmesh_meter::{FeeError, ParamError, PriceCurveParams, ResourceMarket, StateError};

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
        .expect("live captured state is valid")
}

/// Guard: `exponent must be >= 1` (powerup.cpp:203). Delete the check in
/// `validate` and this constructor succeeds — and this test FAILS, because an
/// exponent below 1 makes the price curve non-monotone (falling toward
/// `min_price` at full utilization), which is exactly what the guard exists
/// to prevent.
#[test]
fn exponent_guard_rejects_below_one() {
    let params = PriceCurveParams {
        exponent: 0.5,
        ..live_params()
    };
    assert_eq!(
        ResourceMarket::new(params, 86_400, 0).unwrap_err(),
        StateError::Params(ParamError::ExponentBelowOne(0.5))
    );
    // The boundary itself is legal — exponent exactly 1.0 with min != max
    // trips the coupling guard instead (powerup.cpp:210-211), asserted here
    // so the two guards cannot be confused.
    let boundary = PriceCurveParams {
        exponent: 1.0,
        ..live_params()
    };
    assert_eq!(
        ResourceMarket::new(boundary, 86_400, 0).unwrap_err(),
        StateError::Params(ParamError::ExponentOneRequiresEqualPrices {
            min_price: 2_500,
            max_price: 75_000
        })
    );
}

/// Guard: the flat-below-watermark rule (powerup.cpp:304-308). Delete the
/// block in `calc_fee` and this market's fee for a below-watermark rental
/// becomes the plain curve integral — a DIFFERENT integer — and this test
/// FAILS. The expected 16 is the independent python derivation of
/// `p_adj * 1e12 / W` (see tests/live_conformance.rs); the curve-only
/// integral for the same stretch is 15. One unit apart, distinguishable, and
/// both raw values sit far from integer boundaries, so the pair cannot
/// coincide by rounding luck.
#[test]
fn flat_below_watermark_is_priced_not_vacuous() {
    let market = live_market();
    assert_eq!(market.calc_fee(1_000_000_000_000), Ok(16));
}

/// Guard companion: the coupling `exponent == 1.0 => min == max`
/// (powerup.cpp:210-211). Asserted for its own sake in
/// `live_conformance::exponent_one_prices_flat_at_max_price`; repeated here
/// so the negative-control file carries all three pricing guards between two
/// tests.
#[test]
fn exponent_one_rejects_unequal_prices() {
    let params = PriceCurveParams {
        min_price: 1,
        max_price: 2,
        exponent: 1.0,
        weight: 1_000,
    };
    assert_eq!(
        ResourceMarket::new(params, 86_400, 0).unwrap_err(),
        StateError::Params(ParamError::ExponentOneRequiresEqualPrices {
            min_price: 1,
            max_price: 2
        })
    );
}

// ---------------------------------------------------------------------------
// Rejection paths — literal source behaviors, pinned.
// ---------------------------------------------------------------------------

/// powerup.cpp:263: a non-positive increase returns 0 from the fee function;
/// it is not an error. The action layer (powerup.cpp:345-346) rejects
/// negatives before that, which `record_rental` mirrors.
#[test]
fn fee_function_returns_zero_for_non_positive_increase() {
    let market = live_market();
    assert_eq!(market.calc_fee(0), Ok(0));
    assert_eq!(market.calc_fee(-5), Ok(0));
}

#[test]
fn record_rental_rejects_negative_increase() {
    let mut market = live_market();
    assert_eq!(
        market.record_rental(-1),
        Err(FeeError::NegativeIncrease(-1))
    );
    assert_eq!(
        market.utilization(),
        UTILIZATION,
        "state untouched by the refusal"
    );
}

/// powerup.cpp:362: a zero-rounding rental is refused, not recorded.
#[test]
fn record_rental_refuses_fee_below_minimum() {
    // min_price 0, spread 1, exponent 19, weight 1e18: the fee for one unit
    // is coefficient * (1e-18)^19, which underflows f64 to exactly 0.0 —
    // ceil(0.0) = 0, and the source refuses with "calculated fee is below
    // minimum".
    let params = PriceCurveParams {
        min_price: 0,
        max_price: 1,
        exponent: 19.0,
        weight: 1_000_000_000_000_000_000,
    };
    let mut market = ResourceMarket::new(params, 86_400, 0).expect("params are valid");
    assert_eq!(market.calc_fee(1), Ok(0));
    assert_eq!(market.record_rental(1), Err(FeeError::FeeBelowMinimum));
    assert_eq!(market.utilization(), 0, "state untouched by the refusal");
}

/// powerup.cpp:360: `market doesn't have enough resources available`.
#[test]
fn increase_beyond_available_is_rejected() {
    let market = live_market();
    let available = WEIGHT - UTILIZATION;
    assert_eq!(
        market.calc_fee(available + 1),
        Err(FeeError::IncreaseExceedsAvailable {
            increase: available + 1,
            available
        })
    );
    // Exactly the full remaining market is rentable.
    assert!(market.calc_fee(available).is_ok());
    assert_eq!(market.utilization(), UTILIZATION, "calc_fee never mutates");
}
