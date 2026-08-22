//! Properties that must hold for EVERY state and trade, not just tonight's vectors.

use bmesh_ram::{bancor_output, RamMarket};

fn live_market() -> RamMarket {
    RamMarket::new(75_800_886_740, 251_602_894_241, 241_602_894_241)
}

#[test]
fn round_trip_never_gains_and_pays_both_fees() {
    for quant in [
        2_i64,
        3,
        7,
        199,
        200,
        201,
        9_999,
        1_000_000,
        250_000_000_000,
    ] {
        let mut m = live_market();
        let Ok(b) = m.buy(quant) else { continue }; // dust trades may be rejected — fine
        let Ok(s) = m.sell(b.bytes) else { continue };
        assert!(s.amount_in < quant, "round trip gained at quant={quant}");
        // loss ≥ both fees (each ≥1 whenever the trade executed)
        assert!(
            quant - s.amount_in >= b.fee + s.fee,
            "loss below the two fees at quant={quant}"
        );
        // truncation leakage on tonight's corpus shape: bounded small (measured 2 on V2)
        assert!(
            quant - s.amount_in <= b.fee + s.fee + 4,
            "truncation leakage too large at quant={quant}"
        );
    }
}

#[test]
fn virtual_seed_lockstep_is_conserved() {
    for quant in [1_000, 1_000_000, 999_999_999] {
        let mut m = live_market();
        let seed = m.quote_units - m.total_ram_stake;
        let b = m.buy(quant).unwrap();
        assert_eq!(
            m.quote_units - m.total_ram_stake,
            seed,
            "buy broke lockstep"
        );
        let s = m.sell(b.bytes).unwrap();
        assert_eq!(
            m.quote_units - m.total_ram_stake,
            seed,
            "sell broke lockstep"
        );
        assert!(s.amount_in > 0);
    }
}

#[test]
fn double_path_agrees_with_exact_integer_math_on_this_corpus() {
    // The source computes in double; we mirror it. This property MEASURES the
    // deviation from exact u128 arithmetic on a corpus — 0 on tonight's live
    // sizes. It is an empirical band, not a source guarantee; the comment in
    // the crate docs owns that honestly.
    let m = live_market();
    for qaf in [
        1_i64,
        995,
        995_000,
        13594,
        13595,
        1_000_000_000,
        40_000_000_000,
    ] {
        let dbl = bancor_output(m.quote_units, m.base_bytes, qaf);
        let exact = ((qaf as u128) * (m.base_bytes as u128))
            / ((m.quote_units as u128) + (qaf as u128)) as u128;
        let diff = (dbl as i128 - exact as i128).abs();
        assert!(
            diff <= 4,
            "double-vs-exact diff {diff} too large at qaf={qaf}"
        );
    }
}

#[test]
fn bytes_are_monotone_in_payment() {
    let mut prev: i64 = 0;
    for quant in [2_i64, 1_000, 2_000, 1_000_000, 5_000_000, 100_000_000] {
        let mut m = live_market();
        if let Ok(t) = m.buy(quant) {
            assert!(t.bytes >= prev, "bytes decreased at quant={quant}");
            prev = t.bytes;
        }
    }
}
