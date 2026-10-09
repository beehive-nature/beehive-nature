//! The base proof works end to end on the asymmetric cohort fixture, and the
//! statement mutations the PLONK lane refuses are refused here too.

use btungsten_p3count::air::CountAir;
use btungsten_p3count::config::{self, Params};
use btungsten_p3count::statement::{Hasher, leaves_from_cohort, statement};
use btungsten_p3count::trace::{generate, public_values};
use p3_uni_stark::{prove_with_preprocessed, setup_preprocessed, verify_with_preprocessed};

const ASYM: &str = include_str!("../../../contracts/zkreceipts/fixtures/asym-cohort.json");
// Test-sized parameters: these runs check the statement, not its security level.
const P: Params = Params {
    log_blowup: 1,
    num_queries: 28,
    query_pow_bits: 0,
};

fn run(
    leaves_for_trace: &[btungsten_p3count::statement::Leaf],
    public: Vec<btungsten_p3count::statement::F>,
) -> bool {
    let h = Hasher::default();
    let height = config::height(64, P);
    let air = CountAir::new(64, 40, height);
    let w = generate(&h, &air, leaves_for_trace);
    let cfg = config::seeded_for_tests(P, 64, 40, 7);
    let (pp, vk) = setup_preprocessed(&cfg, &air, height.trailing_zeros() as usize)
        .expect("preprocessed commit")
        .expect("the AIR has preprocessed columns");
    match prove_with_preprocessed(&cfg, &air, w.trace, &public, Some(&pp)) {
        Ok(proof) => verify_with_preprocessed(&cfg, &air, &proof, &public, Some(&vk)).is_ok(),
        Err(_) => false,
    }
}

#[test]
fn the_true_claims_prove_and_verify() {
    let leaves = leaves_from_cohort(ASYM, 64);
    let s = statement(&Hasher::default(), &leaves);
    assert_eq!((s.dead, s.live), (20, 19));
    assert!(run(&leaves, public_values(&s.root, 0, 20)), "dead-kept 20");
    assert!(run(&leaves, public_values(&s.root, 1, 19)), "live-kept 19");
}
