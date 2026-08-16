//! Property tests over randomized-but-deterministic valid markets.
//! Hand-rolled 64-bit LCG (fixed seed): no dependencies, reproducible forever.
//! The four properties are the lane's list (staging dispatch §5.4):
//!
//! 1. `fee(u, u) = 0` — an empty rental costs nothing (powerup.cpp:263);
//! 2. fee is monotone (non-strict) in the interval — price is non-negative;
//! 3. additivity across adjacent intervals, with the exact ceil-rounding
//!    tolerance the source implies: two ceils versus one differ by at most 1,
//!    and never below — `ceil(x) + ceil(y) - ceil(x+y) ∈ {0, 1}`. The split
//!    path is integral-equivalent to the one-shot path by construction: the
//!    flat stretch below the watermark has the same total length either way,
//!    and the curve segments cover the same `[watermark, end]` bounds;
//! 4. the ratchet never decays below current utilization, and the source's
//!    postconditions (powerup.cpp:12-15) hold on every step.

use bmesh_meter::{PriceCurveParams, ResourceMarket};

struct Lcg(u64);

impl Lcg {
    fn next_u64(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0
    }

    fn below(&mut self, bound: u64) -> u64 {
        if bound == 0 {
            0
        } else {
            self.next_u64() % bound
        }
    }
}

struct Scenario {
    market: ResourceMarket,
    available: i64,
}

fn scenario(rng: &mut Lcg) -> Scenario {
    let weight = 1 + rng.below(1_000_000_000_000_000) as i64;
    let max_price = 1 + rng.below(1_000_000) as i64;
    let min_price = rng.below(max_price as u64 + 1) as i64;
    // Exponent 1.0 requires min == max (powerup.cpp:210-211); honor the
    // coupling when the dice pick it so params stay valid.
    let exponent = if rng.next_u64() % 8 == 0 {
        let flat = rng.next_u64() % 2 == 0;
        if flat {
            1.0
        } else {
            1.0 + (rng.below(100) as f64) / 4.0
        }
    } else {
        1.0 + (rng.below(100) as f64) / 4.0
    };
    let min_price = if exponent == 1.0 {
        max_price
    } else {
        min_price
    };
    let utilization = rng.below(weight as u64 + 1) as i64;
    let adjusted = utilization + rng.below((weight - utilization) as u64 + 1) as i64;
    let decay_secs = 1 + rng.below(100_000) as u32;
    let timestamp = rng.below(2_000_000_000);
    let params = PriceCurveParams {
        min_price,
        max_price,
        exponent,
        weight,
    };
    let market = ResourceMarket::from_state(params, decay_secs, utilization, adjusted, timestamp)
        .expect("scenario builder only produces valid state");
    Scenario {
        market,
        available: weight - utilization,
    }
}

const ITERS: usize = 2_000;

#[test]
fn empty_rental_costs_nothing() {
    let mut rng = Lcg(0x2545_F491_4F6C_DD1D);
    for _ in 0..ITERS {
        let Scenario { market, .. } = scenario(&mut rng);
        assert_eq!(market.calc_fee(0), Ok(0), "market: {market:?}");
    }
}

#[test]
fn fee_is_monotone_in_the_interval() {
    let mut rng = Lcg(0x0DDB_1A11_CE57_F00D);
    for _ in 0..ITERS {
        let Scenario { market, available } = scenario(&mut rng);
        if available < 2 {
            continue;
        }
        let i1 = rng.below(available as u64) as i64;
        let i2 = i1 + rng.below((available - i1) as u64 + 1) as i64;
        let f1 = market.calc_fee(i1).expect("i1 within available");
        let f2 = market.calc_fee(i2).expect("i2 within available");
        assert!(
            f2 >= f1,
            "fee({i2}) = {f2} < fee({i1}) = {f1}; market: {market:?}"
        );
    }
}

#[test]
fn split_rentals_match_one_shot_within_one_ceil_unit() {
    let mut rng = Lcg(0x00C0_FFEE_0000_0001);
    let mut checked = 0usize;
    let mut skipped = 0usize;
    for _ in 0..ITERS {
        let Scenario {
            mut market,
            available,
        } = scenario(&mut rng);
        if available < 2 {
            skipped += 1;
            continue;
        }
        let i1 = rng.below(available as u64) as i64;
        let i2 = rng.below((available - i1) as u64 + 1) as i64;
        let one_shot = market.calc_fee(i1 + i2).expect("i1 + i2 within available");
        let fee1 = match market.record_rental(i1) {
            Ok(fee) => fee,
            // A split so small its ceiled fee is zero is refused by the
            // source's fee-below-minimum check (powerup.cpp:362); the
            // one-shot equivalent may still be rentable. Not an additivity
            // witness — skip.
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let fee2 = match market.record_rental(i2) {
            Ok(fee) => fee,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let split = fee1 + fee2;
        assert!(
            split == one_shot || split == one_shot + 1,
            "split {split} vs one-shot {one_shot} outside the ceil tolerance \
             (two ceils are at most one unit above one); market before split \
             would have had available {available}, i1 {i1}, i2 {i2}"
        );
        checked += 1;
    }
    assert!(
        checked > ITERS / 2,
        "corpus too sparse: {checked} checked, {skipped} skipped"
    );
}

#[test]
fn ratchet_postconditions_hold_on_every_step() {
    let mut rng = Lcg(0xBADC_0FFE_1234_5678);
    for _ in 0..ITERS {
        let Scenario { mut market, .. } = scenario(&mut rng);
        let now = market.utilization_timestamp() + rng.below(400_000);
        let (utilization, old_adjusted) = (market.utilization(), market.adjusted_utilization());

        market.update_utilization(now);
        let new_adjusted = market.adjusted_utilization();

        // The lane's invariant: the watermark never decays below current
        // utilization.
        assert!(new_adjusted >= utilization);
        // The source's postconditions, powerup.cpp:12-15.
        if utilization < old_adjusted {
            assert!(new_adjusted <= old_adjusted);
        } else {
            assert_eq!(new_adjusted, utilization);
        }
        assert!(new_adjusted <= market.weight());
        assert_eq!(market.utilization_timestamp(), now);
    }
}

#[test]
fn update_at_or_before_the_timestamp_is_a_no_op() {
    let mut rng = Lcg(0x5EED_0000_0000_0001);
    for _ in 0..ITERS {
        let Scenario { mut market, .. } = scenario(&mut rng);
        let before = market;
        // powerup.cpp:106: now <= utilization_timestamp returns unchanged.
        market.update_utilization(market.utilization_timestamp());
        assert_eq!(market, before);
        // One second before is equally a no-op.
        if market.utilization_timestamp() > 0 {
            let stamp = market.utilization_timestamp();
            let mut earlier = market;
            earlier.update_utilization(stamp - 1);
            assert_eq!(earlier, market);
        }
    }
}
