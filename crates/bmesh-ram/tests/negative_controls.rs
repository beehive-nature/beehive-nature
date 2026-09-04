//! Negative controls — each test names the mutant whose application MUST make it
//! fail. If a control stops failing, the invariant went vacuous (8r culture,
//! R-2 precedent). Mutants were really applied, run, and restored; outputs in
//! the lane receipt.
//!
//! - control_1: fee computed by FLOOR division  (quant/200) instead of the source's
//!   ceil (quant+199)/200                        → v1b-style discriminator fails
//! - control_2: truncating casts replaced by rounding in bancor_input
//!   → the cost_for_bytes(5) vector flips
//! - control_3: reserves SWAPPED in the buy direction (out computed against the
//!   wrong side)                                 → the V1 live vector fails

use bmesh_ram::RamMarket;

fn live_market() -> RamMarket {
    RamMarket::new(75_800_886_740, 251_602_894_241, 241_602_894_241)
}

#[test]
fn control_1_fee_ceils_not_floors() {
    // floor(1_000_001/200) = 5_000 ; source ceil = 5_001
    let mut m = live_market();
    assert_eq!(m.buy(1_000_001).unwrap().fee, 5_001);
    // and the classic vector still holds
    assert_eq!(m.buy(1_000_000).map(|_| ()).err(), None);
}

#[test]
fn control_2_inverse_conversion_truncates() {
    let m = live_market();
    // exact: 251602894241*5 / (75800886740-5) = 16.596…  trunc → 16, round → 17
    let (cost, _) = m.cost_for_bytes(5);
    assert_eq!(cost, 16);
}

#[test]
fn control_3_buy_converts_the_fee_net_amount_against_the_live_state() {
    let mut m = live_market();
    let t = m.buy(1_000_000).unwrap();
    assert_eq!(t.bytes, 299_764); // the independently derived live vector
    assert_eq!(m.quote_units, 251_603_889_241); // quote grew by 995_000 — the FEE-NET amount
    assert_eq!(m.base_bytes, 75_800_586_976);
}
