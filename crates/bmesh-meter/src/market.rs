//! The resource market: curve parameters plus live utilization state, owning
//! the adjusted-utilization ratchet and the fee calculation.
//!
//! State mirror of `powerup_state_resource` (eosio.system.hpp:731-755) reduced
//! to the pricing-relevant fields — the stake-weight transition machinery
//! (`weight_ratio`, `assumed_stake_weight`, target timestamps) is chain
//! plumbing outside this crate's scope and is absent, not silenced.

use crate::params::{ParamError, PriceCurveParams};
use core::fmt;

/// Rejection reasons when constructing market state. The invariants are the
/// source's `@pre` at powerup.cpp:259:
/// `0 <= utilization <= adjusted_utilization <= weight`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StateError {
    /// A `cfgpowerup` parameter guard rejected the curve parameters
    /// (powerup.cpp:203-212). The inner error names the exact guard.
    Params(ParamError),
    /// `utilization` must be non-negative.
    UtilizationNegative(i64),
    /// `adjusted_utilization >= utilization` — powerup.cpp:259.
    UtilizationAboveAdjusted {
        utilization: i64,
        adjusted_utilization: i64,
    },
    /// `adjusted_utilization <= weight` — powerup.cpp:259.
    AdjustedAboveWeight {
        adjusted_utilization: i64,
        weight: i64,
    },
    /// `decay_secs must be >= 1` — powerup.cpp:204.
    DecaySecsZero,
}

impl fmt::Display for StateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StateError::Params(err) => write!(f, "curve parameters rejected: {err}"),
            StateError::UtilizationNegative(utilization) => {
                write!(f, "utilization must be non-negative (got {utilization})")
            }
            StateError::UtilizationAboveAdjusted {
                utilization,
                adjusted_utilization,
            } => {
                write!(
                    f,
                    "utilization {utilization} exceeds adjusted_utilization {adjusted_utilization}"
                )
            }
            StateError::AdjustedAboveWeight {
                adjusted_utilization,
                weight,
            } => {
                write!(
                    f,
                    "adjusted_utilization {adjusted_utilization} exceeds weight {weight}"
                )
            }
            StateError::DecaySecsZero => {
                write!(f, "decay_secs must be >= 1")
            }
        }
    }
}

impl std::error::Error for StateError {}

/// Rejection reasons from the fee path.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FeeError {
    /// `net_frac can't be negative` — powerup.cpp:345-346: the action layer
    /// rejects negative quantities before any fee math runs.
    NegativeIncrease(i64),
    /// `market doesn't have enough resources available` — powerup.cpp:360:
    /// the requested increase exceeds `weight - utilization`.
    IncreaseExceedsAvailable { increase: i64, available: i64 },
    /// `calculated fee is below minimum; try powering up with more resources`
    /// — powerup.cpp:362: an increase whose ceiled fee rounds to zero. In the
    /// source this is also what a positive fraction rounding to a zero amount
    /// hits.
    FeeBelowMinimum,
}

impl fmt::Display for FeeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FeeError::NegativeIncrease(increase) => {
                write!(f, "increase can't be negative (got {increase})")
            }
            FeeError::IncreaseExceedsAvailable {
                increase,
                available,
            } => {
                write!(f, "increase {increase} exceeds available {available}")
            }
            FeeError::FeeBelowMinimum => {
                write!(
                    f,
                    "calculated fee is below minimum; try powering up with more resources"
                )
            }
        }
    }
}

impl std::error::Error for FeeError {}

/// One resource market: injected curve parameters, injected decay, and the
/// live utilization state. All time is injected as whole seconds — the crate
/// never reads a clock.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResourceMarket {
    params: PriceCurveParams,
    decay_secs: u32,
    utilization: i64,
    adjusted_utilization: i64,
    utilization_timestamp: u64,
}

impl ResourceMarket {
    /// A fresh market at zero utilization, stamped `utilization_timestamp`.
    pub fn new(
        params: PriceCurveParams,
        decay_secs: u32,
        utilization_timestamp: u64,
    ) -> Result<Self, StateError> {
        Self::from_state(params, decay_secs, 0, 0, utilization_timestamp)
    }

    /// A market restored from captured state (the conformance tests restore
    /// the live mainnet `powup.state` row this way). Validates parameters
    /// (`cfgpowerup` guards) and the state invariants of powerup.cpp:259.
    pub fn from_state(
        params: PriceCurveParams,
        decay_secs: u32,
        utilization: i64,
        adjusted_utilization: i64,
        utilization_timestamp: u64,
    ) -> Result<Self, StateError> {
        if let Err(err) = params.validate() {
            return Err(StateError::Params(err));
        }
        if decay_secs < 1 {
            return Err(StateError::DecaySecsZero);
        }
        if utilization < 0 {
            return Err(StateError::UtilizationNegative(utilization));
        }
        if utilization > adjusted_utilization {
            return Err(StateError::UtilizationAboveAdjusted {
                utilization,
                adjusted_utilization,
            });
        }
        if adjusted_utilization > params.weight {
            return Err(StateError::AdjustedAboveWeight {
                adjusted_utilization,
                weight: params.weight,
            });
        }
        Ok(Self {
            params,
            decay_secs,
            utilization,
            adjusted_utilization,
            utilization_timestamp,
        })
    }

    /// The adjusted-utilization ratchet — powerup.cpp:105-117, verbatim in
    /// structure:
    ///
    /// - `now <= utilization_timestamp` is a no-op (powerup.cpp:106);
    /// - if `utilization >= adjusted_utilization`, the watermark ratchets up
    ///   to `utilization` instantly;
    /// - otherwise the gap decays by `exp(-elapsed / decay_secs)`, truncated
    ///   to an integer and clamped to `[0, gap]` (powerup.cpp:111-114).
    ///
    /// Postconditions, in the source's own contract (powerup.cpp:12-15):
    /// `utilization <= adjusted_utilization` afterwards; while below the old
    /// watermark the new watermark never rises; at or above it, the watermark
    /// equals `utilization`.
    pub fn update_utilization(&mut self, now: u64) {
        if now <= self.utilization_timestamp {
            return;
        }
        if self.utilization >= self.adjusted_utilization {
            self.adjusted_utilization = self.utilization;
        } else {
            let gap = self.adjusted_utilization - self.utilization;
            let elapsed = now - self.utilization_timestamp;
            let delta = (gap as f64 * (-(elapsed as f64) / self.decay_secs as f64).exp()) as i64;
            let delta = delta.clamp(0, gap);
            self.adjusted_utilization = self.utilization + delta;
        }
        self.utilization_timestamp = now;
    }

    /// The fee for a utilization increase — `calc_powerup_fee`,
    /// powerup.cpp:262-315, term for term:
    ///
    /// 1. `utilization_increase <= 0` returns `0` (powerup.cpp:263) — a
    ///    negative increase is not an error in the source and is not one here;
    /// 2. below the watermark (`utilization < adjusted_utilization`) the
    ///    stretch pays flat `price_at(adjusted_utilization)` up to
    ///    `min(increase, watermark - utilization)` (powerup.cpp:304-308);
    /// 3. the remaining stretch pays the price integral
    ///    (powerup.cpp:310-312);
    /// 4. the `f64` sum is ceiled once at the end (powerup.cpp:314).
    pub fn calc_fee(&self, utilization_increase: i64) -> Result<i64, FeeError> {
        if utilization_increase <= 0 {
            return Ok(0);
        }
        let available = self.params.weight - self.utilization;
        if utilization_increase > available {
            return Err(FeeError::IncreaseExceedsAvailable {
                increase: utilization_increase,
                available,
            });
        }

        let end_utilization = self.utilization + utilization_increase;
        let mut start_utilization = self.utilization;
        let mut fee = 0.0f64;

        if start_utilization < self.adjusted_utilization {
            let flat_length =
                utilization_increase.min(self.adjusted_utilization - start_utilization);
            fee += self.params.price_at(self.adjusted_utilization) * flat_length as f64
                / self.params.weight as f64;
            start_utilization = self.adjusted_utilization;
        }

        if start_utilization < end_utilization {
            fee += self
                .params
                .price_integral_delta(start_utilization, end_utilization);
        }

        Ok(fee.ceil() as i64)
    }

    /// Computes the fee for an increase and records the rental, mirroring the
    /// `powerup` action's per-resource step (powerup.cpp:355-365). Negative
    /// increases are rejected outright (`net_frac can't be negative`,
    /// powerup.cpp:345-346); an increase whose ceiled fee is zero is refused
    /// (`calculated fee is below minimum`, powerup.cpp:362 — in the source a
    /// positive fraction that rounds to a zero amount lands on exactly this
    /// check); on success `utilization` advances by the increase. The
    /// watermark is deliberately untouched — in the source, renting moves
    /// `utilization` only; the watermark catches up at the next
    /// `update_utilization`.
    pub fn record_rental(&mut self, utilization_increase: i64) -> Result<i64, FeeError> {
        if utilization_increase < 0 {
            return Err(FeeError::NegativeIncrease(utilization_increase));
        }
        let fee = self.calc_fee(utilization_increase)?;
        if fee <= 0 {
            return Err(FeeError::FeeBelowMinimum);
        }
        self.utilization += utilization_increase;
        Ok(fee)
    }

    /// Instantaneous utilization — the current amount sold
    /// (eosio.system.hpp:751-752).
    pub fn utilization(&self) -> i64 {
        self.utilization
    }

    /// The watermark: grows instantly, decays exponentially
    /// (eosio.system.hpp:753-754). This and [`ResourceMarket::price_now`]
    /// are the autoscaler's input signal.
    pub fn adjusted_utilization(&self) -> i64 {
        self.adjusted_utilization
    }

    /// The price signal at the watermark — what a marginal rental below the
    /// watermark actually pays per unit (powerup.cpp:305). Above the watermark
    /// the marginal price is `price_at(utilization)`.
    pub fn price_now(&self) -> f64 {
        self.params.price_at(self.adjusted_utilization)
    }

    /// Market weight (eosio.system.hpp:732-734).
    pub fn weight(&self) -> i64 {
        self.params.weight
    }

    /// Decay constant of the watermark, in seconds (eosio.system.hpp:745-746).
    pub fn decay_secs(&self) -> u32 {
        self.decay_secs
    }

    /// Whole-seconds timestamp of the last watermark update
    /// (eosio.system.hpp:755).
    pub fn utilization_timestamp(&self) -> u64 {
        self.utilization_timestamp
    }

    /// The injected curve parameters.
    pub fn params(&self) -> &PriceCurveParams {
        &self.params
    }
}
