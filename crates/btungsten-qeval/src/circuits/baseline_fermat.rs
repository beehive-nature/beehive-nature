//! Approach 1: Fermat addition chain with schoolbook GF(16) multiplier.
//!
//! Uses x^-1 = x^14 = (x^2 * x^4) * x^8.
//! Ancilla registers are restored to |0> via Bennett mirroring and freed.

use crate::circuit::{Circuit, CircuitBuilder};
use crate::gf16::{gf_mul, gf_sq};

pub fn build_fermat_circuit() -> Circuit {
    let mut b = CircuitBuilder::new("baseline_fermat_gf16", 4, 4);

    let x: [usize; 4] = [0, 1, 2, 3];
    let y: [usize; 4] = [4, 5, 6, 7];

    let a = b.alloc_ancillas(4);
    let c = b.alloc_ancillas(4);
    let t = b.alloc_ancillas(4);

    let mark_start = b.len();

    // a = x^2
    emit_linear(&mut b, &x, &a, gf_sq);
    // c = x^4
    emit_linear(&mut b, &x, &c, |v| gf_sq(gf_sq(v)));
    // t = a * c = x^6
    emit_multiply(&mut b, &a, &c, &t);
    // update a from x^2 to x^8: XOR (x^2 ^ x^8) into a
    emit_linear(&mut b, &x, &a, |v| gf_sq(v) ^ gf_sq(gf_sq(gf_sq(v))));

    let mark_end = b.len();

    // y ^= t * a = x^6 * x^8 = x^14 = inv(x)
    emit_multiply(&mut b, &t, &a, &y);

    // Bennett uncomputation: mirror gates between mark_start and mark_end in reverse order
    b.mirror_range(mark_start, mark_end);

    // Free ancillas (evaluator will verify they are clean |0>)
    b.free_ancillas(&t);
    b.free_ancillas(&c);
    b.free_ancillas(&a);

    b.finish()
}

fn emit_linear<F>(b: &mut CircuitBuilder, src: &[usize], dst: &[usize], f: F)
where
    F: Fn(u8) -> u8,
{
    for j in 0..4 {
        let col = f(1 << j);
        for k in 0..4 {
            if ((col >> k) & 1) != 0 {
                b.cx(src[j], dst[k]);
            }
        }
    }
}

fn emit_multiply(b: &mut CircuitBuilder, u: &[usize], v: &[usize], out: &[usize]) {
    for i in 0..4 {
        for j in 0..4 {
            let p = gf_mul(1 << i, 1 << j);
            for k in 0..4 {
                if ((p >> k) & 1) != 0 {
                    b.ccx(u[i], v[j], out[k]);
                }
            }
        }
    }
}
