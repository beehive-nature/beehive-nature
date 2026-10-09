//! What the budget functions are meant to guarantee, stated with
//! multiplication where the implementation divides, so a check compares two
//! different formulations rather than restating one.

use crate::budget::FeeCapRefusal;

/// The signature `budget::fee_cap` has, so the faulty variants can stand in
/// for it.
pub type FeeCapFn = fn(u128, u128, u128, u128, u128) -> Result<u128, FeeCapRefusal>;

/// `fee_per_gas × gas_limit ≤ remaining`, without overflow: a product that
/// does not fit in a `u128` is larger than every `u128` budget.
pub fn fits(fee_per_gas: u128, gas_limit: u128, remaining: u128) -> bool {
    match fee_per_gas.checked_mul(gas_limit) {
        Some(worst) => worst <= remaining,
        None => false,
    }
}

/// The per-gas fee the caller's headroom asks for, `fee × num / den` rounded
/// down, when `fee × num` is representable; a zero denominator is read as 1
/// (property p7 holds the implementation to that reading).
pub fn requested_headroom(fee: u128, num: u128, den: u128) -> Option<u128> {
    fee.checked_mul(num)
        .map(|p| p / if den == 0 { 1 } else { den })
}
