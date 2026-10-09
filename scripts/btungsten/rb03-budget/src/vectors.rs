//! Concrete boundary vectors. They run twice: under Crux-MIR (the same
//! translated code the symbolic properties use) and as ordinary `cargo test`
//! on the native build, so the two executions can be compared. Each vector
//! goes through both `fee_cap` and the production entry point `plan_fee_cap`.

use crate::budget::{fee_cap, gas_limit_with_buffer, payment_floor_limit, plan_fee_cap};
use crate::spec::fits;

const MAX: u128 = u128::MAX;
const CEILING: u128 = 200_000_000_000_000;

/// (remaining, gas_limit, fee, headroom_num, headroom_den, expected cap or refusal)
const PLAN: &[(u128, u128, u128, u128, u128, Option<u128>)] = &[
    // the production-shaped rows ant-extsig's own unit tests pin
    (CEILING, 226_213, 157_379_521, 2, 1, Some(314_759_042)),
    (CEILING, 1_800_000, 20_000_000, 2, 1, Some(40_000_000)),
    (
        CEILING,
        1_800_000,
        100_000_000,
        2,
        1,
        Some(CEILING / 1_800_000),
    ),
    (CEILING, 1_800_000, 1_000_000_000, 2, 1, None),
    // maximum values
    (MAX, 1, MAX, 2, 1, Some(MAX)),
    (MAX, MAX, 1, 2, 1, Some(1)),
    (MAX - 1, MAX, 1, 2, 1, None),
    (MAX, 2, MAX / 2 + 1, 1, 1, None),
    (MAX, 2, MAX / 2, 3, 1, Some(MAX / 2)),
    // an exact fit, and one wei short of it
    (1_000, 10, 100, 2, 1, Some(100)),
    (999, 10, 100, 2, 1, None),
    // the headroom denominator at 0, 1 and its maximum, and a zero numerator
    (1_000, 10, 5, 3, 0, Some(15)),
    (1_000, 10, 5, 3, 1, Some(15)),
    (1_000, 10, 5, 3, MAX, Some(5)),
    (1_000, 10, 5, 0, 1, Some(5)),
    // a zero gas limit, and a zero fee on an empty budget
    (MAX, 0, 0, 2, 1, None),
    (0, 10, 0, 2, 1, Some(0)),
];

/// (estimated gas, buffered limit)
const BUFFER: &[(u64, u128)] = &[
    (188_511, 226_213),
    (46_394, 55_672),
    (0, 0),
    (1, 1),
    (5, 6),
    (u64::MAX, 22_136_092_888_451_461_938),
];

#[cfg_attr(crux, crux::test)]
#[cfg_attr(not(crux), test)]
fn plan_fee_cap_vectors() {
    for &(r, g, f, n, d, want) in PLAN {
        let got = fee_cap(r, g, f, n, d).ok();
        assert!(got == want);
        assert!(plan_fee_cap(r, g, f, n, d, "vector").ok() == want);
        if let Some(cap) = got {
            assert!(cap >= f);
            assert!(fits(cap, g, r));
        }
    }
}

#[cfg_attr(crux, crux::test)]
#[cfg_attr(not(crux), test)]
fn gas_buffer_vectors() {
    for &(e, want) in BUFFER {
        assert!(gas_limit_with_buffer(e) == want);
    }
}

#[cfg_attr(crux, crux::test)]
#[cfg_attr(not(crux), test)]
fn payment_floor_vectors() {
    assert!(payment_floor_limit(55_672, 4) == 111_344);
    assert!(payment_floor_limit(MAX, 2) == MAX / 2);
    assert!(payment_floor_limit(0, 7) == 0);
}
