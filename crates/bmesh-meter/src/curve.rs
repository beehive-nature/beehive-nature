//! The price/fee function family — pure functions over validated parameters.
//!
//! Mirrors the two lambdas inside `calc_powerup_fee`,
//! powerup.cpp:265-298 at the pinned commit. The math, in the source's own
//! comment notation: `p(u) = min_price + (max_price - min_price) * u^(exponent-1)`
//! for the utilization fraction `u` in `[0, 1]`, with antiderivative
//! `f(u) = min_price * u + ((max_price - min_price) / exponent) * u^exponent`.
//! A fee over `[u_start, u_end]` is `f(u_end) - f(u_start)`, computed in `f64`,
//! ceiled once by the caller.

use crate::params::PriceCurveParams;

impl PriceCurveParams {
    /// `p(utilization / weight)` — powerup.cpp:284-298.
    ///
    /// Mirrors the source's explicit special case exactly: when
    /// `exponent - 1.0 <= 0.0` the price is flat at **`max_price`** — the
    /// source returns `state.max_price.amount` outright rather than relying on
    /// `std::pow` to produce `1.0` (powerup.cpp:286-292). This is why an
    /// exponent of exactly `1.0` prices flat at `max`, not `min`.
    ///
    /// Precondition, as in the source (`@pre` at powerup.cpp:283):
    /// `0 <= utilization <= weight`. The fee path enforces it upstream;
    /// callers computing a price signal directly must respect it.
    pub fn price_at(&self, utilization: i64) -> f64 {
        let new_exponent = self.exponent - 1.0;
        if new_exponent <= 0.0 {
            return self.max_price as f64;
        }
        let u = utilization as f64 / self.weight as f64;
        self.min_price as f64 + (self.max_price - self.min_price) as f64 * u.powf(new_exponent)
    }

    /// `f(end/weight) - f(start/weight)` — powerup.cpp:274-280, the
    /// price-integral delta, term for term in the source's order:
    /// `min*end_u - min*start_u + coefficient*end_u^e - coefficient*start_u^e`
    /// with `coefficient = (max - min) / exponent`.
    ///
    /// Precondition (powerup.cpp:273): `0 <= start <= end <= weight`.
    pub(crate) fn price_integral_delta(&self, start_utilization: i64, end_utilization: i64) -> f64 {
        let coefficient = (self.max_price - self.min_price) as f64 / self.exponent;
        let start_u = start_utilization as f64 / self.weight as f64;
        let end_u = end_utilization as f64 / self.weight as f64;
        self.min_price as f64 * end_u - self.min_price as f64 * start_u
            + coefficient * end_u.powf(self.exponent)
            - coefficient * start_u.powf(self.exponent)
    }
}
