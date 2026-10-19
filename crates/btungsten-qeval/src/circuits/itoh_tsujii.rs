//! Approach 2: Itoh-Tsujii addition chain.
//!
//! Uses x^-1 = x^14 = (x^7)^2, where:
//! - x^3 = x * x^2
//! - x^7 = x^3 * x^4
//! - y ^= (x^7)^2 = x^14
//! Followed by Bennett uncomputation of intermediate powers (x^7 and x^3).

use crate::circuit::{Circuit, CircuitBuilder};
use crate::gf16::{gf_mul, gf_sq};

pub fn build_itoh_tsujii_circuit() -> Circuit {
    let mut b = CircuitBuilder::new("itoh_tsujii_gf16", 4, 4);

    let x: [usize; 4] = [0, 1, 2, 3];
    let y: [usize; 4] = [4, 5, 6, 7];

    let x2 = b.alloc_ancillas(4);
    let b3 = b.alloc_ancillas(4);
    let x4 = b.alloc_ancillas(4);
    let b7 = b.alloc_ancillas(4);

    let mark_start = b.len();

    // 1. x2 = x^2
    emit_linear(&mut b, &x, &x2, gf_sq);
    // 2. b3 = x * x^2 = x^3
    emit_multiply(&mut b, &x, &x2, &b3);
    // 3. x4 = (x^2)^2 = x^4
    emit_linear(&mut b, &x, &x4, |v| gf_sq(gf_sq(v)));
    // 4. b7 = b3 * x4 = x^3 * x^4 = x^7
    emit_multiply(&mut b, &b3, &x4, &b7);

    let mark_end = b.len();

    // 5. y ^= (b7)^2 = (x^7)^2 = x^14
    emit_linear(&mut b, &b7, &y, gf_sq);

    // 6. Bennett uncomputation of steps 1..4 in reverse
    b.mirror_range(mark_start, mark_end);

    b.free_ancillas(&b7);
    b.free_ancillas(&x4);
    b.free_ancillas(&b3);
    b.free_ancillas(&x2);

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
