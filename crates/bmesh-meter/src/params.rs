//! Injected curve parameters and the configuration guards they must pass.
//!
//! Validation order and error conditions mirror `cfgpowerup`,
//! powerup.cpp:203-212 at the pinned commit (see crate docs), plus the state
//! invariant `weight >= 1` that the source assumes everywhere it divides by
//! `weight` (e.g. powerup.cpp:359-360).

use core::fmt;

/// Price-curve parameters for one resource market. All fields are injected;
/// the crate defines no defaults — curve parameter values are a founder gate.
///
/// Mirror of the pricing fields of `powerup_state_resource`
/// (eosio.system.hpp:744-750): `exponent: double`, prices as `asset` amounts
/// (`int64_t`), `weight: int64_t`. Units are the caller's: the engine only
/// requires that prices share one unit and utilization share one unit with
/// `weight`.
///
/// Semantics (powerup.hpp comments, confirmed by powerup.cpp:265-269):
/// `max_price` is the fee to reserve the entire market weight at the maximum
/// price; with `exponent = 2.0` the price of a tiny reservation grows
/// linearly with utilization.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PriceCurveParams {
    /// Fee to reserve the entire market at the minimum price. Must satisfy
    /// `0 <= min_price <= max_price`; must equal `max_price` when
    /// `exponent == 1.0` (powerup.cpp:210-211).
    pub min_price: i64,
    /// Fee to reserve the entire market at the maximum price. Must be `> 0`.
    pub max_price: i64,
    /// Price-curve exponent, `>= 1.0` (powerup.cpp:203). Stored as `f64`
    /// because the source stores `double`.
    pub exponent: f64,
    /// Resource market weight: the utilization at which the market is 100%
    /// sold. Must be `>= 1`.
    pub weight: i64,
}

/// Rejection reasons for [`PriceCurveParams::validate`], one per source guard.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParamError {
    /// `exponent must be >= 1` — powerup.cpp:203.
    ExponentBelowOne(f64),
    /// `min_price and max_price must be the same if the exponent is 1` —
    /// powerup.cpp:210-211.
    ExponentOneRequiresEqualPrices { min_price: i64, max_price: i64 },
    /// `max_price must be positive` — powerup.cpp:206.
    MaxPriceNotPositive(i64),
    /// `min_price must be non-negative` — powerup.cpp:208.
    MinPriceNegative(i64),
    /// `min_price cannot exceed max_price` — powerup.cpp:209.
    MinPriceAboveMax { min_price: i64, max_price: i64 },
    /// The market weight must be positive: the fee path divides by it
    /// (powerup.cpp:276-277, 306) and the action guards
    /// `state.weight` truthiness (powerup.cpp:359).
    WeightNotPositive(i64),
}

impl fmt::Display for ParamError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ParamError::ExponentBelowOne(exponent) => {
                write!(f, "exponent must be >= 1 (got {exponent})")
            }
            ParamError::ExponentOneRequiresEqualPrices {
                min_price,
                max_price,
            } => {
                write!(
                    f,
                    "min_price and max_price must be the same if the exponent is 1 \
                     (got min_price {min_price}, max_price {max_price})"
                )
            }
            ParamError::MaxPriceNotPositive(max_price) => {
                write!(f, "max_price must be positive (got {max_price})")
            }
            ParamError::MinPriceNegative(min_price) => {
                write!(f, "min_price must be non-negative (got {min_price})")
            }
            ParamError::MinPriceAboveMax {
                min_price,
                max_price,
            } => {
                write!(
                    f,
                    "min_price cannot exceed max_price (got min_price {min_price}, max_price {max_price})"
                )
            }
            ParamError::WeightNotPositive(weight) => {
                write!(f, "weight must be positive (got {weight})")
            }
        }
    }
}

impl std::error::Error for ParamError {}

impl PriceCurveParams {
    /// Validates against the `cfgpowerup` guards, in the source's order
    /// (powerup.cpp:203-212), then the weight bound.
    pub fn validate(&self) -> Result<(), ParamError> {
        if self.exponent < 1.0 {
            return Err(ParamError::ExponentBelowOne(self.exponent));
        }
        if self.max_price <= 0 {
            return Err(ParamError::MaxPriceNotPositive(self.max_price));
        }
        if self.min_price < 0 {
            return Err(ParamError::MinPriceNegative(self.min_price));
        }
        if self.min_price > self.max_price {
            return Err(ParamError::MinPriceAboveMax {
                min_price: self.min_price,
                max_price: self.max_price,
            });
        }
        if self.exponent == 1.0 && self.min_price != self.max_price {
            return Err(ParamError::ExponentOneRequiresEqualPrices {
                min_price: self.min_price,
                max_price: self.max_price,
            });
        }
        if self.weight < 1 {
            return Err(ParamError::WeightNotPositive(self.weight));
        }
        Ok(())
    }
}
