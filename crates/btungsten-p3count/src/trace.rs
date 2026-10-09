//! The main trace for one witness: the permutation's columns from upstream's
//! own generator, then the leaf columns, then the stack after each row.

use p3_field::PrimeCharacteristicRing;
use p3_koala_bear::GenericPoseidon2LinearLayersKoalaBear;
use p3_matrix::Matrix;
use p3_matrix::dense::RowMajorMatrix;
use p3_poseidon2_air::generate_trace_rows;

use crate::air::{
    CountAir, ENTRY, FP_BITS, HALF_FULL, LIVE, Op, P2, PARTIAL, SBOX_DEGREE, SBOX_REGISTERS, STACK,
    WIDTH, round_constants, schedule,
};
use crate::statement::{
    Digest, F, FP_LIMB_BITS, Hasher, Leaf, Statement, counters, kept, leaf_input, limbs, node_input,
};

/// Every leaf column of `l`, in layout order (FP .. LIVE).
pub fn leaf_columns(l: &Leaf) -> Vec<F> {
    let fpl = limbs(l.fp);
    let mut v: Vec<F> = fpl.iter().map(|&x| F::from_u32(x)).collect();
    for (k, &bits) in FP_LIMB_BITS.iter().enumerate() {
        v.extend((0..bits).map(|i| F::from_u32((fpl[k] >> i) & 1)));
    }
    v.push(F::from_u8(l.pheno));
    for &r in &l.r {
        v.push(F::from_u8(r & 1));
        v.push(F::from_u8((r >> 1) & 1));
    }
    let settled: Vec<bool> = l.r.iter().map(|&r| r != 0).collect();
    let matched: Vec<bool> = l.r.iter().map(|&r| r == 1 + l.pheno).collect();
    let flipped: Vec<bool> = (0..3).map(|k| settled[k] && !matched[k]).collect();
    v.extend(settled.iter().map(|&x| F::from_bool(x)));
    v.extend(matched.iter().map(|&x| F::from_bool(x)));
    v.extend(flipped.iter().map(|&x| F::from_bool(x)));
    v.push(F::from_bool(!flipped.iter().any(|&x| x)));
    v.push(F::from_bool(!settled.iter().any(|&x| x)));
    let (dead, live) = counters(l);
    v.push(F::from_bool(kept(l)));
    v.push(F::from_u32(dead));
    v.push(F::from_u32(live));
    debug_assert_eq!(P2 + v.len(), LIVE + 1);
    debug_assert_eq!(FP_BITS - P2, 3);
    v
}

pub struct Witness {
    pub trace: RowMajorMatrix<F>,
    pub statement: Statement,
}

/// The main trace of `air` over `leaves` (length n, pads already zero).
pub fn generate(h: &Hasher, air: &CountAir, leaves: &[Leaf]) -> Witness {
    assert_eq!(leaves.len(), air.n);
    let ops = schedule(air.n, air.members, air.height);
    let d = air.depth;
    let zero_leaf = leaf_columns(&Leaf::default());

    let mut stack: Vec<(Digest, u32, u32)> = Vec::new();
    let mut inputs: Vec<[F; WIDTH]> = Vec::with_capacity(ops.len());
    let mut leaf_rows: Vec<Vec<F>> = Vec::with_capacity(ops.len());
    let mut stack_rows: Vec<Vec<F>> = Vec::with_capacity(ops.len());
    let mut outputs: Vec<Digest> = Vec::with_capacity(ops.len());
    for op in &ops {
        match *op {
            Op::Leaf { index, .. } => {
                let l = &leaves[index];
                let input = leaf_input(l);
                let out = h.compress(input);
                let (dead, live) = counters(l);
                stack.push((out, dead, live));
                inputs.push(input);
                outputs.push(out);
                leaf_rows.push(leaf_columns(l));
            }
            Op::Node => {
                let right = stack.pop().expect("a node pops two");
                let left = stack.pop().expect("a node pops two");
                let input = node_input(&left.0, &right.0);
                let out = h.compress(input);
                stack.push((out, left.1 + right.1, left.2 + right.2));
                inputs.push(input);
                outputs.push(out);
                leaf_rows.push(zero_leaf.clone());
            }
            Op::Noop => {
                let input = [F::ZERO; WIDTH];
                inputs.push(input);
                outputs.push(h.compress(input));
                leaf_rows.push(zero_leaf.clone());
            }
        }
        assert!(stack.len() <= d, "stack depth {} exceeds {d}", stack.len());
        let mut row = Vec::with_capacity(ENTRY * d);
        for j in 0..d {
            match stack.len().checked_sub(1 + j).map(|i| stack[i]) {
                Some((dg, dead, live)) => {
                    row.extend_from_slice(&dg);
                    row.push(F::from_u32(dead));
                    row.push(F::from_u32(live));
                }
                None => row.extend((0..ENTRY).map(|_| F::ZERO)),
            }
        }
        stack_rows.push(row);
    }
    assert_eq!(stack.len(), 1, "the fold ends with the root alone");
    let (root, dead, live) = stack[0];

    let p2 = generate_trace_rows::<
        F,
        GenericPoseidon2LinearLayersKoalaBear,
        WIDTH,
        SBOX_DEGREE,
        SBOX_REGISTERS,
        HALF_FULL,
        PARTIAL,
    >(inputs, &round_constants(), 0);
    assert_eq!(p2.width(), P2);

    let width = air.total_width();
    let mut values = Vec::with_capacity(width * ops.len());
    for (r, out) in outputs.iter().enumerate() {
        let p2row: Vec<F> = p2.row_slice(r).expect("row").to_vec();
        // the AIR's permutation output is the last WIDTH columns of its region
        assert_eq!(
            &p2row[P2 - WIDTH..P2 - WIDTH + 8],
            &out[..],
            "row {r}: AIR permutation != model hash"
        );
        values.extend(p2row);
        values.extend_from_slice(&leaf_rows[r]);
        values.extend_from_slice(&stack_rows[r]);
    }
    assert_eq!(STACK + ENTRY * d, width);
    Witness {
        trace: RowMajorMatrix::new(values, width),
        statement: Statement { root, dead, live },
    }
}

/// Public values for a claim: root, kind, count.
pub fn public_values(root: &Digest, kind: u8, count: u32) -> Vec<F> {
    let mut v = root.to_vec();
    v.push(F::from_u8(kind));
    v.push(F::from_u32(count));
    v
}
