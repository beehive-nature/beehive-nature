// SPEC-BTUNGSTEN-PQ-1 §2, PQ00: the two teeth templates run against the
// REAL defects in distributed-lab/vortex-rs at 3c0affd9320a, before they
// guard anything of ours. Both must CONVICT. If either passes, the template
// is broken and every gate that uses it is red.
//
// This file is appended as a child module of a BUILD COPY of vortex's
// src/lib.rs by scripts/btungsten/pq00-teeth-vortex.sh (one added line:
// `#[cfg(test)] #[path = "pq00_teeth.rs"] mod pq00_teeth;`). Vortex's own
// code is not edited; a child module is used only because `VortexParams`
// has private fields and no constructor. Vortex never enters the
// beehive-nature workspace.

use super::*;
use btungsten_teeth::{Failure, accepts_unless_panic, boundary_lengths, truncate, vacuous};
use rand::distr::StandardUniform;
use rand::prelude::SmallRng;
use rand::seq::IteratorRandom;
use rand::{Rng, SeedableRng};

const NB_ROW: usize = 1 << 4;
const NB_COL: usize = 1 << 6;
const RS_RATE: usize = 2;
const OPEN: usize = 16;

/// What the verifier is handed in each run of T-VACUOUS.
#[derive(Clone, Copy, Debug)]
enum Shape {
    /// The honest proof, as vortex's own `test_vortex_full` builds it.
    Honest,
    /// The honest proof with every opened column removed.
    ZeroOpenings,
    /// No opened column, and a FALSE evaluation claim: y[0] + 1, with the
    /// linear combination chosen so the one remaining equation holds.
    ZeroOpeningsFalseClaim,
}

fn params(rng: &mut SmallRng) -> VortexParams {
    VortexParams {
        perm: p3_koala_bear::Poseidon2KoalaBear::new_from_rng_128(rng),
        r_sis: RSis::new(0, NB_ROW),
        nb_row: NB_ROW,
        nb_col: NB_COL,
        rs_rate: RS_RATE,
        num_columns_to_open: OPEN,
    }
}

/// Builds the run deterministically (seed 7) and reports whether vortex's
/// `verify` accepted it. `verify` refuses by panicking.
fn run(shape: Shape) -> bool {
    let mut rng = SmallRng::seed_from_u64(7);
    let params = params(&mut rng);
    let w: Vec<Vec<KoalaBear>> = (0..NB_ROW)
        .map(|_| (0..NB_COL).map(|_| KoalaBear::new(rng.random())).collect())
        .collect();
    let (mt, w_) = commit(&params, w.clone());
    let beta: KoalaBearExt = rng.sample(StandardUniform {});
    let columns: Vec<usize> = (0..NB_COL * RS_RATE).choose_multiple(&mut rng, OPEN);
    let coin: KoalaBearExt = rng.sample(StandardUniform {});
    let mut y = eval(&params, &w, coin);
    let mut proof = open(&params, &w, &w_, &mt, beta, columns);
    match shape {
        Shape::Honest => {}
        Shape::ZeroOpenings => {
            proof.columns.clear();
            proof.merkle_proofs.clear();
            proof.column_ids.clear();
        }
        Shape::ZeroOpeningsFalseClaim => {
            proof.columns.clear();
            proof.merkle_proofs.clear();
            proof.column_ids.clear();
            y[0] += KoalaBearExt::ONE;
            let mut beta_y = KoalaBearExt::ZERO;
            let mut b = KoalaBearExt::ONE;
            for yi in &y {
                beta_y += *yi * b;
                b *= proof.beta;
            }
            proof.lin_comb = vec![KoalaBearExt::ZERO; NB_COL];
            proof.lin_comb[0] = beta_y;
        }
    }
    let root = mt.root();
    accepts_unless_panic(move || verify(&params, proof, root, y, coin))
}

#[test]
fn t_vacuous_convicts_vortex_verify() {
    for (name, shape) in [
        ("zero openings", Shape::ZeroOpenings),
        (
            "zero openings with a FALSE evaluation claim",
            Shape::ZeroOpeningsFalseClaim,
        ),
    ] {
        match vacuous(|s: &Shape| run(*s), &Shape::Honest, &[(name, shape)]) {
            Err(Failure::Convicted { detail, .. }) => {
                println!("PQ00 T-VACUOUS convicts vortex verify: true ({detail})")
            }
            other => panic!("PQ00 T-VACUOUS did NOT convict vortex verify on `{name}`: {other:?}"),
        }
    }
}

#[test]
fn t_truncate_convicts_vortex_rsis_hash() {
    let r_sis = RSis::new(0, 512);
    let dft = p3_dft::Radix2DFTSmallBatch::<KoalaBear>::new(sis::DEGREE);
    let hash = |v: &[KoalaBear]| r_sis.hash(&v.to_vec(), &dft);
    let fill = |i: usize| KoalaBear::new(((i as u64 * 7919 + 13) % 2_000_000_000) as u32);
    let bump = |x: &KoalaBear| *x + KoalaBear::ONE;
    match truncate(hash, &boundary_lengths(256, 512), fill, bump) {
        Err(Failure::Convicted {
            detail, witness, ..
        }) => {
            assert_eq!(
                (witness.len, witness.pos),
                (257, 256),
                "the flaw is the 256-element prefix"
            );
            assert_eq!(hash(&witness.a), hash(&witness.b));
            println!("PQ00 T-TRUNCATE convicts vortex RSis::hash: true ({detail})");
            println!(
                "PQ00 colliding pair: len {} differ only at position {}: a[{}] = {}, b[{}] = {}",
                witness.len,
                witness.pos,
                witness.pos,
                witness.a[witness.pos],
                witness.pos,
                witness.b[witness.pos]
            );
        }
        other => panic!("PQ00 T-TRUNCATE did NOT convict vortex RSis::hash: {other:?}"),
    }
}
