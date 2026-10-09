//! TEETH: two deliberately wrong versions of `fee_cap`, compiled only with
//! the `teeth` feature and never reachable from ant-extsig. Each keeps the
//! production shape and changes one boundary decision. The properties in
//! `props.rs` must convict both; if Crux-MIR reports either as verified, the
//! honest results are not evidence of anything.

use crate::budget::FeeCapRefusal;

/// F1, overflow-unsafe affordability: the refusal compares a WRAPPING
/// product with the budget. Every test with realistic numbers passes; a gas
/// limit and fee whose product wraps past 2^128 slip through the refusal and
/// the cap no longer fits.
pub fn fee_cap_wrapping(
    remaining_wei: u128,
    gas_limit: u128,
    network_fee_per_gas: u128,
    headroom_num: u128,
    headroom_den: u128,
) -> Result<u128, FeeCapRefusal> {
    if gas_limit == 0 {
        return Err(FeeCapRefusal::ZeroGasLimit);
    }
    if gas_limit.wrapping_mul(network_fee_per_gas) > remaining_wei {
        return Err(FeeCapRefusal::Unaffordable {
            need_wei: gas_limit.saturating_mul(network_fee_per_gas),
        });
    }
    let budget_cap = remaining_wei / gas_limit;
    let with_headroom = network_fee_per_gas.saturating_mul(headroom_num) / headroom_den.max(1);
    Ok(with_headroom.min(budget_cap).max(network_fee_per_gas))
}

/// F2, rounding the per-gas budget UP: `budget_cap` is the ceiling of
/// remaining / gas_limit, so a cap can exceed the budget by less than one
/// gas limit's worth of wei.
pub fn fee_cap_ceiling(
    remaining_wei: u128,
    gas_limit: u128,
    network_fee_per_gas: u128,
    headroom_num: u128,
    headroom_den: u128,
) -> Result<u128, FeeCapRefusal> {
    if gas_limit == 0 {
        return Err(FeeCapRefusal::ZeroGasLimit);
    }
    let budget_cap = remaining_wei / gas_limit + u128::from(remaining_wei % gas_limit != 0);
    if budget_cap < network_fee_per_gas {
        return Err(FeeCapRefusal::Unaffordable {
            need_wei: gas_limit.saturating_mul(network_fee_per_gas),
        });
    }
    let with_headroom = network_fee_per_gas.saturating_mul(headroom_num) / headroom_den.max(1);
    Ok(with_headroom.min(budget_cap).max(network_fee_per_gas))
}

#[cfg(crux)]
mod crux_teeth {
    use super::*;
    use crate::props::{check_cap_fits, check_refuses_iff_unaffordable, symbolic_inputs};

    #[crux::test]
    fn t1_wrapping_affordability_cap_fits() {
        check_cap_fits(fee_cap_wrapping, symbolic_inputs());
    }

    #[crux::test]
    fn t2_ceiling_budget_cap_fits() {
        check_cap_fits(fee_cap_ceiling, symbolic_inputs());
    }

    #[crux::test]
    fn t3_ceiling_budget_refuses_iff_unaffordable() {
        check_refuses_iff_unaffordable(fee_cap_ceiling, symbolic_inputs());
    }
}
