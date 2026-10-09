//! The count statement as an AIR (SPEC-BTUNGSTEN-PQ-1 §PQ10).
//!
//! One Poseidon2 permutation per row. The rows walk the full tree in post
//! order as a stack machine: a LEAF row hashes one receipt leaf and pushes
//! (digest, dead kept, live kept); a NODE row pops two entries, hashes the
//! deeper (left) digest with the top (right) one and pushes the sum of their
//! counters; NOOP rows pad the trace and change nothing. Every constraint is
//! local to a row or to a row and the next one, so no lookup or bus
//! argument is involved.
//!
//! The schedule (which rows are leaves, nodes, padding slots, noops) is the
//! same for every witness of a given (n, members), so it is a preprocessed
//! trace: the verifier holds its commitment, and a prover cannot skip a
//! leaf, add one, or change the tree's shape.
//!
//! The Poseidon2 constraints on each row are upstream's own
//! (`p3_poseidon2_air::Poseidon2Air::eval`), run through upstream's
//! `p3_uni_stark::SubAirBuilder` on the window holding just
//! the permutation's columns. They are not re-implemented here.

use core::borrow::Borrow;

use p3_air::{Air, AirBuilder, BaseAir, WindowAccess};
use p3_field::PrimeCharacteristicRing;
use p3_koala_bear::{
    GenericPoseidon2LinearLayersKoalaBear, KOALABEAR_POSEIDON2_HALF_FULL_ROUNDS,
    KOALABEAR_POSEIDON2_PARTIAL_ROUNDS_16, KOALABEAR_POSEIDON2_RC_16_EXTERNAL_FINAL,
    KOALABEAR_POSEIDON2_RC_16_EXTERNAL_INITIAL, KOALABEAR_POSEIDON2_RC_16_INTERNAL,
    KOALABEAR_S_BOX_DEGREE,
};
use p3_matrix::dense::RowMajorMatrix;
use p3_poseidon2::ExternalLayerConstants;
use p3_poseidon2_air::{Poseidon2Air, Poseidon2Cols, RoundConstants, num_cols};
use p3_uni_stark::SubAirBuilder;

use crate::statement::{F, FP_LIMB_BITS, LEAF_TAG};

pub const WIDTH: usize = 16;
pub const SBOX_DEGREE: u64 = KOALABEAR_S_BOX_DEGREE;
pub const SBOX_REGISTERS: usize = 0;
pub const HALF_FULL: usize = KOALABEAR_POSEIDON2_HALF_FULL_ROUNDS;
pub const PARTIAL: usize = KOALABEAR_POSEIDON2_PARTIAL_ROUNDS_16;

/// Poseidon2 columns, first in every row.
pub const P2: usize = num_cols::<WIDTH, SBOX_DEGREE, SBOX_REGISTERS, HALF_FULL, PARTIAL>();

pub type P2Air = Poseidon2Air<
    F,
    GenericPoseidon2LinearLayersKoalaBear,
    WIDTH,
    SBOX_DEGREE,
    SBOX_REGISTERS,
    HALF_FULL,
    PARTIAL,
>;
pub type P2Cols<T> = Poseidon2Cols<T, WIDTH, SBOX_DEGREE, SBOX_REGISTERS, HALF_FULL, PARTIAL>;

/// The AIR's round constants are the default permutation's (the one the
/// model hashes with), never random ones.
pub fn round_constants() -> RoundConstants<F, WIDTH, HALF_FULL, PARTIAL> {
    RoundConstants::try_from_layers(
        &ExternalLayerConstants::new(
            KOALABEAR_POSEIDON2_RC_16_EXTERNAL_INITIAL.to_vec(),
            KOALABEAR_POSEIDON2_RC_16_EXTERNAL_FINAL.to_vec(),
        ),
        &KOALABEAR_POSEIDON2_RC_16_INTERNAL,
    )
    .expect("the default width-16 constants have the AIR's shape")
}

// ---- leaf columns, after the permutation's ----
pub const FP: usize = P2; // 3 limbs
pub const FP_BITS: usize = FP + 3; // 64 bits, limb by limb, low bit first
pub const PHENO: usize = FP_BITS + 64;
pub const RBITS: usize = PHENO + 1; // per verdict k: low bit 2k, high bit 2k+1
pub const SETTLED: usize = RBITS + 6; // 3
pub const MATCHED: usize = SETTLED + 3; // 3: verdict == 1 + pheno
pub const FLIPPED: usize = MATCHED + 3; // 3: settled and not matched
pub const NO_FLIP: usize = FLIPPED + 3;
pub const NONE_SETTLED: usize = NO_FLIP + 1;
pub const KEPT: usize = NONE_SETTLED + 1;
pub const DEAD: usize = KEPT + 1;
pub const LIVE: usize = DEAD + 1;
/// The stack: `depth` entries of (digest 8, dead 1, live 1), top first.
pub const STACK: usize = LIVE + 1;
pub const ENTRY: usize = 10;

// ---- preprocessed columns ----
pub const PRE_LEAF: usize = 0;
pub const PRE_NODE: usize = 1;
pub const PRE_NOOP: usize = 2;
pub const PRE_PAD: usize = 3;
pub const PRE_WIDTH: usize = 4;

/// Public values: root (8), kind, count.
pub const NUM_PUBLIC: usize = 10;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    Leaf { index: usize, pad: bool },
    Node,
    Noop,
}

/// Post order of the full tree over leaves 0..n, then noops up to `height`.
pub fn schedule(n: usize, members: usize, height: usize) -> Vec<Op> {
    fn walk(lo: usize, hi: usize, members: usize, out: &mut Vec<Op>) {
        if hi - lo == 1 {
            out.push(Op::Leaf {
                index: lo,
                pad: lo >= members,
            });
        } else {
            let mid = (lo + hi) / 2;
            walk(lo, mid, members, out);
            walk(mid, hi, members, out);
            out.push(Op::Node);
        }
    }
    assert!(n.is_power_of_two() && members <= n);
    let mut out = Vec::with_capacity(height);
    walk(0, n, members, &mut out);
    assert!(
        height.is_power_of_two() && height > out.len(),
        "height {height} must exceed the {} tree ops",
        out.len()
    );
    out.resize(height, Op::Noop);
    out
}

pub struct CountAir {
    pub n: usize,
    pub members: usize,
    pub height: usize,
    pub depth: usize,
    p2: P2Air,
}

impl CountAir {
    pub fn new(n: usize, members: usize, height: usize) -> Self {
        Self {
            n,
            members,
            height,
            depth: n.trailing_zeros() as usize + 1,
            p2: P2Air::new(round_constants()),
        }
    }

    pub fn total_width(&self) -> usize {
        STACK + ENTRY * self.depth
    }
}

impl BaseAir<F> for CountAir {
    fn width(&self) -> usize {
        self.total_width()
    }

    fn preprocessed_trace(&self) -> Option<RowMajorMatrix<F>> {
        let mut v = Vec::with_capacity(self.height * PRE_WIDTH);
        for op in schedule(self.n, self.members, self.height) {
            let (leaf, node, noop, pad) = match op {
                Op::Leaf { pad, .. } => (1, 0, 0, pad as u32),
                Op::Node => (0, 1, 0, 0),
                Op::Noop => (0, 0, 1, 0),
            };
            v.extend([leaf, node, noop, pad].map(F::from_u32));
        }
        Some(RowMajorMatrix::new(v, PRE_WIDTH))
    }

    fn preprocessed_width(&self) -> usize {
        PRE_WIDTH
    }

    fn num_public_values(&self) -> usize {
        NUM_PUBLIC
    }

    fn max_constraint_degree(&self) -> Option<usize> {
        Some(3)
    }
}

impl<AB: AirBuilder<F = F>> Air<AB> for CountAir {
    fn eval(&self, b: &mut AB) {
        let main = b.main();
        let local: Vec<AB::Var> = main.current_slice().to_vec();
        let next: Vec<AB::Var> = main.next_slice().to_vec();
        let pre = b.preprocessed().clone();
        let pl: Vec<AB::Var> = pre.current_slice().to_vec();
        let pn: Vec<AB::Var> = pre.next_slice().to_vec();
        let public: Vec<AB::Expr> = b.public_values().iter().map(|&p| p.into()).collect();
        let e = |v: AB::Var| -> AB::Expr { v.into() };
        let one = AB::Expr::ONE;

        // (1) the permutation on this row: upstream's constraints, unchanged,
        // through upstream's own column-window builder
        {
            let mut w = SubAirBuilder::<AB, P2Air, AB::Var>::new(&mut *b, 0..P2);
            <P2Air as Air<SubAirBuilder<'_, AB, P2Air, AB::Var>>>::eval(&self.p2, &mut w);
        }
        let p2l: &P2Cols<AB::Var> = local[..P2].borrow();
        let p2n: &P2Cols<AB::Var> = next[..P2].borrow();
        let out_l = p2l.ending_full_rounds[HALF_FULL - 1].post;
        let out_n = p2n.ending_full_rounds[HALF_FULL - 1].post;

        // (2) the leaf: fp limbs from 64 bits, one baseline bit, 2-bit verdicts,
        // and count.circom's kept rule, every row (a zero row satisfies it)
        let mut bit = FP_BITS;
        for (k, &bits) in FP_LIMB_BITS.iter().enumerate() {
            let mut acc = AB::Expr::ZERO;
            for i in 0..bits {
                b.assert_bool(local[bit]);
                acc += e(local[bit]) * F::from_u64(1 << i);
                bit += 1;
            }
            b.assert_eq(local[FP + k], acc);
        }
        let ph = e(local[PHENO]);
        b.assert_bool(local[PHENO]);
        for k in 0..3 {
            let (lo, hi) = (e(local[RBITS + 2 * k]), e(local[RBITS + 2 * k + 1]));
            b.assert_bool(local[RBITS + 2 * k]);
            b.assert_bool(local[RBITS + 2 * k + 1]);
            // settled: verdict != 0
            b.assert_eq(
                local[SETTLED + k],
                lo.clone() + hi.clone() - lo.clone() * hi.clone(),
            );
            // matched: verdict == 1 + pheno (dead baseline 1 = 0b01, live 2 = 0b10)
            let m = (one.clone() - ph.clone()) * lo.clone() * (one.clone() - hi.clone())
                + ph.clone() * (one.clone() - lo) * hi;
            b.assert_eq(local[MATCHED + k], m);
            b.assert_eq(
                local[FLIPPED + k],
                e(local[SETTLED + k]) * (one.clone() - e(local[MATCHED + k])),
            );
        }
        b.assert_eq(
            local[NO_FLIP],
            (one.clone() - e(local[FLIPPED]))
                * (one.clone() - e(local[FLIPPED + 1]))
                * (one.clone() - e(local[FLIPPED + 2])),
        );
        b.assert_eq(
            local[NONE_SETTLED],
            (one.clone() - e(local[SETTLED]))
                * (one.clone() - e(local[SETTLED + 1]))
                * (one.clone() - e(local[SETTLED + 2])),
        );
        b.assert_eq(
            local[KEPT],
            e(local[NO_FLIP]) * (one.clone() - e(local[NONE_SETTLED])),
        );
        b.assert_eq(local[DEAD], e(local[KEPT]) * (one.clone() - ph.clone()));
        b.assert_eq(local[LIVE], e(local[KEPT]) * ph.clone());

        // padding slots carry the all-zero leaf
        let pad = e(pl[PRE_PAD]);
        for k in 0..3 {
            b.assert_zero(pad.clone() * e(local[FP + k]));
        }
        b.assert_zero(pad.clone() * ph.clone());
        for j in 0..6 {
            b.assert_zero(pad.clone() * e(local[RBITS + j]));
        }

        // (3) a leaf row hashes [tag, fp0, fp1, fp2, pheno, r1, r2, r3, 0 x 8]
        let leaf = e(pl[PRE_LEAF]);
        let mut want: Vec<AB::Expr> = vec![AB::Expr::from(F::from_u32(LEAF_TAG))];
        want.extend((0..3).map(|k| e(local[FP + k])));
        want.push(ph.clone());
        want.extend((0..3).map(|k| e(local[RBITS + 2 * k]) + e(local[RBITS + 2 * k + 1]) * F::TWO));
        want.extend((0..8).map(|_| AB::Expr::ZERO));
        for (i, w) in want.into_iter().enumerate() {
            b.assert_zero(leaf.clone() * (e(p2l.inputs[i]) - w));
        }

        // (4) the stack
        let d = self.depth;
        let s =
            |row: &[AB::Var], j: usize, c: usize| -> AB::Expr { row[STACK + ENTRY * j + c].into() };

        // first row: a leaf alone on the stack
        {
            let mut f = b.when_first_row();
            for c in 0..8 {
                f.assert_eq(s(&local, 0, c), out_l[c]);
            }
            f.assert_eq(s(&local, 0, 8), local[DEAD]);
            f.assert_eq(s(&local, 0, 9), local[LIVE]);
            for j in 1..d {
                for c in 0..ENTRY {
                    f.assert_zero(s(&local, j, c));
                }
            }
        }

        // transitions, by what the NEXT row does
        let (n_leaf, n_node, n_noop) = (e(pn[PRE_LEAF]), e(pn[PRE_NODE]), e(pn[PRE_NOOP]));
        {
            let mut t = b.when_transition();
            // next is a leaf: push its own hash and counters
            for c in 0..8 {
                t.assert_zero(n_leaf.clone() * (s(&next, 0, c) - e(out_n[c])));
            }
            t.assert_zero(n_leaf.clone() * (s(&next, 0, 8) - e(next[DEAD])));
            t.assert_zero(n_leaf.clone() * (s(&next, 0, 9) - e(next[LIVE])));
            for j in 1..d {
                for c in 0..ENTRY {
                    t.assert_zero(n_leaf.clone() * (s(&next, j, c) - s(&local, j - 1, c)));
                }
            }
            for c in 0..ENTRY {
                t.assert_zero(n_leaf.clone() * s(&local, d - 1, c));
            }
            // next is a node: hash (left = second, right = top), sum the counters, pop one
            for c in 0..8 {
                t.assert_zero(n_node.clone() * (e(p2n.inputs[c]) - s(&local, 1, c)));
                t.assert_zero(n_node.clone() * (e(p2n.inputs[8 + c]) - s(&local, 0, c)));
                t.assert_zero(n_node.clone() * (s(&next, 0, c) - e(out_n[c])));
            }
            for c in 8..ENTRY {
                t.assert_zero(
                    n_node.clone() * (s(&next, 0, c) - s(&local, 1, c) - s(&local, 0, c)),
                );
            }
            for j in 1..d - 1 {
                for c in 0..ENTRY {
                    t.assert_zero(n_node.clone() * (s(&next, j, c) - s(&local, j + 1, c)));
                }
            }
            for c in 0..ENTRY {
                t.assert_zero(n_node.clone() * s(&next, d - 1, c));
            }
            // next is a noop: the stack stands
            for j in 0..d {
                for c in 0..ENTRY {
                    t.assert_zero(n_noop.clone() * (s(&next, j, c) - s(&local, j, c)));
                }
            }
        }

        // last row: one entry left, it is the public root, and the claim holds
        {
            let kind = public[8].clone();
            let count = public[9].clone();
            let mut l = b.when_last_row();
            for c in 0..8 {
                l.assert_eq(s(&local, 0, c), public[c].clone());
            }
            for j in 1..d {
                for c in 0..ENTRY {
                    l.assert_zero(s(&local, j, c));
                }
            }
            l.assert_zero(kind.clone() * (kind.clone() - one.clone()));
            // count.circom's selector law: kind picks its OWN counter
            let picked = s(&local, 0, 8) + kind * (s(&local, 0, 9) - s(&local, 0, 8));
            l.assert_eq(picked, count);
        }
    }
}
