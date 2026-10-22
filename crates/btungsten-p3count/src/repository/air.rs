//! Upstream Poseidon2 constraints, a verifier-fixed sponge schedule, private
//! 16-bit digest limbs, u64 carry arithmetic and neutral suffix padding.
use super::model::{BLOCKS, DOMAIN, VERSION};
use crate::air::{HALF_FULL, P2, P2Air, P2Cols, round_constants};
use crate::statement::F;
use core::borrow::Borrow;
use p3_air::{Air, AirBuilder, BaseAir, WindowAccess};
use p3_field::PrimeCharacteristicRing;
use p3_matrix::dense::RowMajorMatrix;
use p3_uni_stark::SubAirBuilder;

pub const BITS: usize = P2;
pub const PREVIOUS: usize = BITS + 128;
pub const NEXT: usize = PREVIOUS + 16;
pub const BEFORE: usize = NEXT + 16;
pub const AFTER: usize = BEFORE + 4;
pub const CARRY: usize = AFTER + 4;
pub const ACTIVE: usize = CARRY + 5;
pub const POLICY: usize = ACTIVE + 1;
pub const SCOPE: usize = POLICY + 16;
pub const ACC: usize = SCOPE + 16;
pub const COLS: usize = ACC + 8;
pub const RUN: usize = 0;
pub const BODY: usize = 1;
pub const SAME: usize = 2;
pub const BOUNDARY: usize = 3;
pub const FIRST: usize = 4;
pub const INDEX: usize = 5;
pub const CHUNK: usize = 6;
pub const CONTEXT: usize = CHUNK + BLOCKS;
pub const PRE_WIDTH: usize = CONTEXT + 3;
pub const PUBLIC: usize = 24;

pub struct RepositoryAir {
    pub bucket: usize,
    pub height: usize,
    p2: P2Air,
}
impl RepositoryAir {
    pub fn new(bucket: usize, height: usize) -> Self {
        assert!([8, 16, 32, 64].contains(&bucket));
        assert!(height.is_power_of_two() && height > 3 + BLOCKS * bucket);
        Self {
            bucket,
            height,
            p2: P2Air::new(round_constants()),
        }
    }
    pub fn schedule(&self, row: usize) -> Vec<F> {
        let mut p = vec![F::ZERO; PRE_WIDTH];
        if row < 3 {
            p[RUN] = F::ONE;
            p[CONTEXT + row] = F::ONE;
        } else if row < 3 + BLOCKS * self.bucket {
            let i = (row - 3) / BLOCKS;
            let chunk = (row - 3) % BLOCKS;
            p[RUN] = F::ONE;
            p[BODY] = F::ONE;
            p[SAME] = F::from_bool(chunk > 0);
            p[BOUNDARY] = F::from_bool(chunk == 0 && i > 0);
            p[FIRST] = F::from_bool(chunk == 0 && i == 0);
            p[INDEX] = F::from_usize(i);
            p[CHUNK + chunk] = F::ONE;
        }
        p
    }
}
impl BaseAir<F> for RepositoryAir {
    fn width(&self) -> usize {
        COLS
    }
    fn preprocessed_width(&self) -> usize {
        PRE_WIDTH
    }
    fn preprocessed_trace(&self) -> Option<RowMajorMatrix<F>> {
        Some(RowMajorMatrix::new(
            (0..self.height).flat_map(|r| self.schedule(r)).collect(),
            PRE_WIDTH,
        ))
    }
    fn num_public_values(&self) -> usize {
        PUBLIC
    }
    fn max_constraint_degree(&self) -> Option<usize> {
        Some(4)
    }
}
impl<AB: AirBuilder<F = F>> Air<AB> for RepositoryAir {
    fn eval(&self, b: &mut AB) {
        let main = b.main();
        let l = main.current_slice().to_vec();
        let n = main.next_slice().to_vec();
        let pre = b.preprocessed().clone();
        let pl = pre.current_slice().to_vec();
        let pn = pre.next_slice().to_vec();
        let public: Vec<AB::Expr> = b.public_values().iter().map(|&x| x.into()).collect();
        let e = |v: AB::Var| -> AB::Expr { v.into() };
        let one = AB::Expr::ONE;
        {
            let mut sub = SubAirBuilder::<AB, P2Air, AB::Var>::new(&mut *b, 0..P2);
            <P2Air as Air<SubAirBuilder<'_, AB, P2Air, AB::Var>>>::eval(&self.p2, &mut sub);
        }
        let lp: &P2Cols<AB::Var> = l[..P2].borrow();
        let np: &P2Cols<AB::Var> = n[..P2].borrow();
        let lo = lp.ending_full_rounds[HALF_FULL - 1].post;
        let no = np.ending_full_rounds[HALF_FULL - 1].post;
        // Exact SHA-256 byte encodings, not modular reductions of 256-bit hashes.
        for k in 0..8 {
            let mut value = AB::Expr::ZERO;
            for j in 0..16 {
                let bit = l[BITS + 16 * k + j];
                b.assert_bool(bit);
                value += e(bit) * F::from_u32(1 << j);
            }
            b.assert_eq(lp.inputs[8 + k], value);
        }
        b.assert_bool(l[ACTIVE]);
        for k in 0..5 {
            b.assert_bool(l[CARRY + k]);
        }
        let body = e(pl[BODY]);
        let active = e(l[ACTIVE]);
        b.assert_zero(body.clone() * (e(l[CARRY]) - active.clone()));
        b.assert_zero(body.clone() * e(l[CARRY + 4]));
        for k in 0..4 {
            b.assert_zero(
                body.clone()
                    * (e(l[AFTER + k]) - e(l[BEFORE + k]) - e(l[CARRY + k])
                        + e(l[CARRY + k + 1]) * F::from_u32(65536)),
            );
        }
        b.assert_zero(e(pl[FIRST]) * (active.clone() - one.clone()));
        for k in 0..16 {
            b.assert_zero(
                body.clone()
                    * (one.clone() - active.clone())
                    * (e(l[NEXT + k]) - e(l[PREVIOUS + k])),
            );
        }
        // Private receipt fields in the fixed sponge schedule.
        for (chunk, start, half) in [
            (0, PREVIOUS, 0),
            (1, PREVIOUS, 8),
            (2, NEXT, 0),
            (3, NEXT, 8),
            (6, POLICY, 0),
            (7, POLICY, 8),
            (14, SCOPE, 0),
            (15, SCOPE, 8),
        ] {
            for k in 0..8 {
                b.assert_zero(
                    e(pl[CHUNK + chunk]) * (e(lp.inputs[8 + k]) - e(l[start + half + k])),
                );
            }
        }
        for chunk in [4, 5, 8, 9, 10, 11] {
            for k in 0..8 {
                b.assert_zero(
                    e(pl[CHUNK + chunk]) * (one.clone() - active.clone()) * e(lp.inputs[8 + k]),
                );
            }
        }
        for k in 0..8 {
            let seq = if k < 4 { BEFORE + k } else { AFTER + k - 4 };
            b.assert_zero(e(pl[CHUNK + 16]) * (e(lp.inputs[8 + k]) - e(l[seq])));
        }
        let header = [
            active.clone(),
            e(pl[INDEX]),
            AB::Expr::from(F::from_u32(DOMAIN)),
            AB::Expr::ZERO,
            AB::Expr::ZERO,
            AB::Expr::ZERO,
            AB::Expr::ZERO,
            AB::Expr::ZERO,
        ];
        for k in 0..8 {
            b.assert_zero(e(pl[CHUNK + 17]) * (e(lp.inputs[8 + k]) - header[k].clone()));
        }
        for half in 0..2 {
            for k in 0..8 {
                b.assert_zero(
                    e(pl[CONTEXT + half]) * (e(lp.inputs[8 + k]) - public[half * 8 + k].clone()),
                );
            }
        }
        for k in 0..8 {
            let want = match k {
                0 => DOMAIN,
                1 => VERSION,
                2 => self.bucket as u32,
                _ => 0,
            };
            b.assert_zero(e(pl[CONTEXT + 2]) * (e(lp.inputs[8 + k]) - F::from_u32(want)));
        }
        {
            let mut first = b.when_first_row();
            for k in 0..8 {
                first.assert_zero(lp.inputs[k]);
                first.assert_eq(l[ACC + k], lo[k]);
            }
        }
        {
            let mut t = b.when_transition();
            for k in 0..8 {
                t.assert_zero(e(pn[RUN]) * (e(np.inputs[k]) - e(l[ACC + k])));
                t.assert_zero(e(pn[RUN]) * (e(n[ACC + k]) - e(no[k])));
                t.assert_zero((one.clone() - e(pn[RUN])) * (e(n[ACC + k]) - e(l[ACC + k])));
            }
            for k in POLICY..ACC {
                t.assert_eq(n[k], l[k]);
            }
            for k in PREVIOUS..POLICY {
                t.assert_zero(e(pn[SAME]) * (e(n[k]) - e(l[k])));
            }
            for k in 0..16 {
                t.assert_zero(e(pn[BOUNDARY]) * (e(n[PREVIOUS + k]) - e(l[NEXT + k])));
            }
            for k in 0..4 {
                t.assert_zero(e(pn[BOUNDARY]) * (e(n[BEFORE + k]) - e(l[AFTER + k])));
            }
            t.assert_zero(e(pn[BOUNDARY]) * e(n[ACTIVE]) * (one.clone() - active));
        }
        {
            let mut last = b.when_last_row();
            for k in 0..8 {
                last.assert_eq(l[ACC + k], public[16 + k].clone());
            }
        }
    }
}
