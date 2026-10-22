//! Crux-MIR properties of the budget arithmetic. Every `u128` argument of
//! `fee_cap` is a fresh symbolic value; the gas estimate of
//! `gas_limit_with_buffer` a symbolic `u64`. No property carries a
//! `crucible_assume!` beyond the one its comment names.
//!
//! `fee_cap` is the arithmetic `plan_fee_cap` delegates to (budget.rs): the
//! wrapper only formats a refusal message, and formatting a symbolic `u128`
//! produces solver goals that do not close, so the properties are stated on
//! `fee_cap`; `vectors.rs` and budget.rs's own tests hold the two together.
//!
//! Each `check_*` takes the function under test, so `faulty.rs` runs the
//! same obligations against the deliberately wrong variants.

extern crate crucible;
use crucible::*;

use crate::budget::{self, FeeCapRefusal};
use crate::spec::{fits, requested_headroom, FeeCapFn};

pub(crate) struct In {
    remaining: u128,
    gas_limit: u128,
    fee: u128,
    num: u128,
    den: u128,
}

pub(crate) fn symbolic_inputs() -> In {
    In {
        remaining: u128::symbolic("remaining_wei"),
        gas_limit: u128::symbolic("gas_limit"),
        fee: u128::symbolic("network_fee_per_gas"),
        num: u128::symbolic("headroom_num"),
        den: u128::symbolic("headroom_den"),
    }
}

/// p1: a zero gas limit is refused as such, whatever the other inputs are.
pub(crate) fn check_zero_gas_refuses(f: FeeCapFn) {
    let i = symbolic_inputs();
    crucible_assert!(f(i.remaining, 0, i.fee, i.num, i.den) == Err(FeeCapRefusal::ZeroGasLimit));
}

/// p2: with a non-zero gas limit, the send is refused exactly when the
/// network fee does not fit the remaining budget for that gas limit.
pub(crate) fn check_refuses_iff_unaffordable(f: FeeCapFn, i: In) {
    crucible_assume!(i.gas_limit != 0);
    let refused = f(i.remaining, i.gas_limit, i.fee, i.num, i.den).is_err();
    crucible_assert!(refused == !fits(i.fee, i.gas_limit, i.remaining));
}

/// p3: every returned cap is at least the network fee.
pub(crate) fn check_cap_at_least_fee(f: FeeCapFn) {
    let i = symbolic_inputs();
    if let Ok(cap) = f(i.remaining, i.gas_limit, i.fee, i.num, i.den) {
        crucible_assert!(cap >= i.fee);
    }
}

/// p4: every returned cap fits the remaining budget for the supplied gas
/// limit (`cap × gas_limit ≤ remaining`, overflow counted as not fitting).
pub(crate) fn check_cap_fits(f: FeeCapFn, i: In) {
    if let Ok(cap) = f(i.remaining, i.gas_limit, i.fee, i.num, i.den) {
        crucible_assert!(fits(cap, i.gas_limit, i.remaining));
    }
}

/// p5: a returned cap never exceeds what the headroom asked for (or the
/// network fee, when the headroom asks for less). When `fee × num`
/// overflows, the request is unbounded and only p4 limits the cap.
pub(crate) fn check_headroom_never_exceeded(f: FeeCapFn) {
    let i = symbolic_inputs();
    if let Ok(cap) = f(i.remaining, i.gas_limit, i.fee, i.num, i.den) {
        if let Some(h) = requested_headroom(i.fee, i.num, i.den) {
            crucible_assert!(cap <= if h > i.fee { h } else { i.fee });
        }
    }
}

/// p6: when the requested headroom fits the budget, it is granted in full.
pub(crate) fn check_headroom_granted_when_it_fits(f: FeeCapFn, i: In) {
    if let Ok(cap) = f(i.remaining, i.gas_limit, i.fee, i.num, i.den) {
        if let Some(h) = requested_headroom(i.fee, i.num, i.den) {
            if fits(h, i.gas_limit, i.remaining) {
                crucible_assert!(cap >= h);
            }
        }
    }
}

/// p7: a zero headroom denominator behaves exactly as a denominator of 1.
pub(crate) fn check_zero_den_reads_as_one(f: FeeCapFn) {
    let i = symbolic_inputs();
    crucible_assert!(
        f(i.remaining, i.gas_limit, i.fee, i.num, 0)
            == f(i.remaining, i.gas_limit, i.fee, i.num, 1)
    );
}

/// p10: an unaffordable refusal reports `gas_limit × fee` (saturating), the
/// number plan_fee_cap's message prints as the need.
pub(crate) fn check_refusal_reports_need(f: FeeCapFn) {
    let i = symbolic_inputs();
    if let Err(FeeCapRefusal::Unaffordable { need_wei }) =
        f(i.remaining, i.gas_limit, i.fee, i.num, i.den)
    {
        crucible_assert!(need_wei == i.gas_limit.saturating_mul(i.fee));
    }
}

#[crux::test]
fn p1_zero_gas_limit_refuses() {
    check_zero_gas_refuses(budget::fee_cap);
}

#[crux::test]
fn p2_refuses_iff_network_fee_unaffordable() {
    check_refuses_iff_unaffordable(budget::fee_cap, symbolic_inputs());
}

#[crux::test]
fn p3_cap_at_least_network_fee() {
    check_cap_at_least_fee(budget::fee_cap);
}

#[crux::test]
fn p4_cap_fits_remaining_budget() {
    check_cap_fits(budget::fee_cap, symbolic_inputs());
}

#[crux::test]
fn p5_headroom_never_exceeded() {
    check_headroom_never_exceeded(budget::fee_cap);
}

#[crux::test]
fn p6_headroom_granted_when_it_fits() {
    check_headroom_granted_when_it_fits(budget::fee_cap, symbolic_inputs());
}

#[crux::test]
fn p7_zero_denominator_reads_as_one() {
    check_zero_den_reads_as_one(budget::fee_cap);
}

/// p8: the gas buffer is exactly ⌊estimate × 6/5⌋ for every `u64` estimate,
/// never below the estimate, and the saturating multiply never saturates.
#[crux::test]
fn p8_gas_buffer_is_floor_six_fifths() {
    let e = u64::symbolic("estimated_gas");
    let b = budget::gas_limit_with_buffer(e);
    let e = e as u128;
    crucible_assert!(e.checked_mul(120).is_some());
    crucible_assert!(b * 100 <= e * 120);
    crucible_assert!(e * 120 < (b + 1) * 100);
    crucible_assert!(b >= e);
}

/// p9: the payment floor is ⌊approval × transfers / 2⌋ whenever the product
/// is representable, and `u128::MAX / 2` when it is not (saturation).
#[crux::test]
fn p9_payment_floor_is_half_product() {
    let a = u128::symbolic("approval_gas_limit");
    let t = u128::symbolic("transfers");
    let f = budget::payment_floor_limit(a, t);
    match t.checked_mul(a) {
        Some(p) => crucible_assert!(f == p / 2),
        None => crucible_assert!(f == u128::MAX / 2),
    }
}

#[crux::test]
fn p10_refusal_reports_the_need() {
    check_refusal_reports_need(budget::fee_cap);
}
