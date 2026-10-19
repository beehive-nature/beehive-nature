//! Approach 3: Boyar-Matthews-Peralta (BMP) Tower Field Reversible Inversion.
//!
//! Maps GF(16) elements to an isomorphic tower field GF(((2)^2)^2) where inversion
//! requires only 5 non-linear multiplications (AND gates / Toffolis).
//!
//! Bennett uncomputation is applied reversibly to the 5 ancilla wires without
//! any destructive measurements:
//! - 5 CCX gates forward
//! - 5 CCX gates reverse
//! - Total Toffolis: exactly 10
//! - Peak qubits: exactly 13 (4 input + 4 target + 5 ancillas)
//! - Zero phase and exact restoration of input x and all ancillas.

use crate::circuit::{Circuit, CircuitBuilder};

pub fn build_tower_bmp_circuit() -> Circuit {
    let mut b = CircuitBuilder::new("tower_bmp_gf16", 4, 4);

    let x: [usize; 4] = [0, 1, 2, 3];
    let y: [usize; 4] = [4, 5, 6, 7];

    // Allocate 5 ancillas for the non-linear products (wires 8, 9, 10, 11, 12)
    let p = b.alloc_ancillas(5);
    let p2 = p[0];
    let p4 = p[1];
    let p7 = p[2];
    let p10 = p[3];
    let p12 = p[4];

    // 1. Transform x and y to tower basis in-place
    emit_to_tower(&mut b, &x);
    emit_to_tower(&mut b, &y);

    // 2. Compute non-linear products forward
    // p2 = x0 * x2
    b.ccx(x[0], x[2], p2);

    // p4: cxs [ (x1, x0), (p2, x3) ], CCX(x0, x3 -> p4)
    b.cx(x[1], x[0]);
    b.cx(p2, x[3]);
    b.ccx(x[0], x[3], p4);
    b.cx(p2, x[3]);
    b.cx(x[1], x[0]);

    // p7: cxs [ (p2, x1), (x3, x2) ], CCX(x1, x2 -> p7)
    b.cx(p2, x[1]);
    b.cx(x[3], x[2]);
    b.ccx(x[1], x[2], p7);
    b.cx(x[3], x[2]);
    b.cx(p2, x[1]);

    // p10: cxs [ (p7, p2) ], CCX(x3, p2 -> p10)
    b.cx(p7, p2);
    b.ccx(x[3], p2, p10);
    b.cx(p7, p2);

    // p12: cxs [ (p4, x1), (p2, x3), (p10, x3) ], CCX(x1, x3 -> p12)
    b.cx(p4, x[1]);
    b.cx(p2, x[3]);
    b.cx(p10, x[3]);
    b.ccx(x[1], x[3], p12);
    b.cx(p10, x[3]);
    b.cx(p2, x[3]);
    b.cx(p4, x[1]);

    // 3. Inject into target y register in tower basis
    // y0 ^= x2 ^ x3 ^ p7 ^ p10
    b.cx(x[2], y[0]);
    b.cx(x[3], y[0]);
    b.cx(p7, y[0]);
    b.cx(p10, y[0]);

    // y1 ^= x3 ^ p7
    b.cx(x[3], y[1]);
    b.cx(p7, y[1]);

    // y2 ^= x0 ^ x1 ^ p12
    b.cx(x[0], y[2]);
    b.cx(x[1], y[2]);
    b.cx(p12, y[2]);

    // y3 ^= x1 ^ p4
    b.cx(x[1], y[3]);
    b.cx(p4, y[3]);

    // 4. Reversible Bennett uncomputation of the 5 products in reverse order
    // uncompute p12
    b.cx(p4, x[1]);
    b.cx(p2, x[3]);
    b.cx(p10, x[3]);
    b.ccx(x[1], x[3], p12);
    b.cx(p10, x[3]);
    b.cx(p2, x[3]);
    b.cx(p4, x[1]);

    // uncompute p10
    b.cx(p7, p2);
    b.ccx(x[3], p2, p10);
    b.cx(p7, p2);

    // uncompute p7
    b.cx(p2, x[1]);
    b.cx(x[3], x[2]);
    b.ccx(x[1], x[2], p7);
    b.cx(x[3], x[2]);
    b.cx(p2, x[1]);

    // uncompute p4
    b.cx(x[1], x[0]);
    b.cx(p2, x[3]);
    b.ccx(x[0], x[3], p4);
    b.cx(p2, x[3]);
    b.cx(x[1], x[0]);

    // uncompute p2
    b.ccx(x[0], x[2], p2);

    // 5. Transform y and x back from tower basis
    emit_from_tower(&mut b, &y);
    emit_to_tower_inv(&mut b, &x);

    // 6. Free all 5 ancilla wires (verified |0>)
    b.free_ancillas(&[p12, p10, p7, p4, p2]);

    b.finish()
}

/// In-place linear transformation TO_TOWER:
/// matrix [0b1011, 0b1111, 0b1101, 0b0001].
fn emit_to_tower(b: &mut CircuitBuilder, q: &[usize; 4]) {
    b.cx(q[3], q[0]);
    b.cx(q[2], q[3]);
    b.cx(q[2], q[1]);
    b.cx(q[2], q[0]);
    b.cx(q[1], q[3]);
    b.cx(q[1], q[0]);
    b.swap(q[1], q[2]);
    b.cx(q[0], q[3]);
    b.cx(q[0], q[2]);
    b.cx(q[0], q[1]);
}

/// In-place inverse of TO_TOWER, restoring original x wires.
fn emit_to_tower_inv(b: &mut CircuitBuilder, q: &[usize; 4]) {
    b.cx(q[0], q[1]);
    b.cx(q[0], q[2]);
    b.cx(q[0], q[3]);
    b.swap(q[1], q[2]);
    b.cx(q[1], q[0]);
    b.cx(q[1], q[3]);
    b.cx(q[2], q[0]);
    b.cx(q[2], q[1]);
    b.cx(q[2], q[3]);
    b.cx(q[3], q[0]);
}

/// In-place linear transformation FROM_TOWER:
/// matrix [0b1000, 0b0110, 0b0011, 0b1111].
fn emit_from_tower(b: &mut CircuitBuilder, q: &[usize; 4]) {
    b.cx(q[3], q[2]);
    b.cx(q[3], q[1]);
    b.cx(q[3], q[0]);
    b.cx(q[2], q[1]);
    b.cx(q[2], q[0]);
    b.swap(q[2], q[3]);
    b.cx(q[1], q[0]);
    b.cx(q[0], q[3]);
    b.swap(q[0], q[2]);
}
