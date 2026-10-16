//! The correspondence check for the one change RB03 made to production code:
//! `plan_fee_cap` in ops/ant-extsig/src/budget.rs was split into `fee_cap`
//! (the arithmetic) and a message wrapper. `prior_plan_fee_cap` below is the
//! function as it stood at beehive-nature 2e8d20970 (the bench's starting
//! commit), verbatim; the test requires today's `plan_fee_cap` to return the
//! same cap or the same refusal text on every input of a boundary grid.

type Res<T> = Result<T, Box<dyn std::error::Error>>;

pub fn prior_plan_fee_cap(
    remaining_wei: u128,
    gas_limit: u128,
    network_fee_per_gas: u128,
    headroom_num: u128,
    headroom_den: u128,
    stage: &str,
) -> Res<u128> {
    if gas_limit == 0 {
        return Err(format!("REFUSE: zero gas limit for {stage}").into());
    }
    let budget_cap = remaining_wei / gas_limit;
    if budget_cap < network_fee_per_gas {
        let need = gas_limit.saturating_mul(network_fee_per_gas);
        return Err(format!(
            "REFUSE: gas budget cannot cover {stage}: gas_limit {gas_limit} × network fee {network_fee_per_gas} wei = {need} wei exceeds remaining budget {remaining_wei} wei by {} wei",
            need.saturating_sub(remaining_wei)
        )
        .into());
    }
    let with_headroom = network_fee_per_gas.saturating_mul(headroom_num) / headroom_den.max(1);
    Ok(with_headroom.min(budget_cap).max(network_fee_per_gas))
}

#[test]
fn plan_fee_cap_is_unchanged_by_the_split() {
    let m = u128::MAX;
    let vals = [
        0,
        1,
        2,
        3,
        5,
        10,
        99,
        100,
        101,
        999,
        1_000,
        55_672,
        226_213,
        1_800_000,
        157_379_521,
        200_000_000_000_000,
        1 << 64,
        m / 3,
        m / 2,
        m / 2 + 1,
        m - 1,
        m,
    ];
    let heads = [(2, 1), (0, 1), (3, 0), (1, m), (m, 1), (7, 3), (m, m)];
    let mut n = 0u64;
    for &r in &vals {
        for &g in &vals {
            for &f in &vals {
                for &(hn, hd) in &heads {
                    let now = crate::budget::plan_fee_cap(r, g, f, hn, hd, "stage");
                    let then = prior_plan_fee_cap(r, g, f, hn, hd, "stage");
                    match (now, then) {
                        (Ok(a), Ok(b)) => assert_eq!(a, b, "r={r} g={g} f={f} n={hn} d={hd}"),
                        (Err(a), Err(b)) => assert_eq!(a.to_string(), b.to_string()),
                        (a, b) => {
                            panic!("r={r} g={g} f={f} n={hn} d={hd}: now {a:?}, before {b:?}")
                        }
                    }
                    n += 1;
                }
            }
        }
    }
    assert_eq!(n, 22 * 22 * 22 * 7);
    println!("RB03-CORRESPONDENCE {n} inputs: plan_fee_cap unchanged by the split");
}
