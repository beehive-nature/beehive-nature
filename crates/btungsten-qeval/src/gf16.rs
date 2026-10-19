//! Reference arithmetic for GF(16) = GF(2^4) modulo x^4 + x + 1.
//!
//! Reduction polynomial: P(x) = x^4 + x + 1, encoded as 0x13 (0b10011).
//! Elements are 4-bit values in 0..16, where bit k represents the coefficient of x^k.
//! Inversion satisfies inv(0) = 0, and for v != 0, v * inv(v) == 1 (Fermat: v^14).

pub const POLY: u16 = 0x13; // x^4 + x + 1

/// The canonical inversion table for GF(16) modulo x^4 + x + 1 with inv(0) = 0.
pub const CANONICAL_INV: [u8; 16] = [0, 1, 9, 14, 13, 11, 7, 6, 15, 2, 12, 5, 10, 4, 3, 8];

/// Field addition: bitwise XOR in characteristic 2.
#[inline]
pub fn gf_add(u: u8, v: u8) -> u8 {
    (u ^ v) & 0x0F
}

/// Field multiplication: polynomial multiplication modulo x^4 + x + 1.
pub fn gf_mul(u: u8, v: u8) -> u8 {
    let u = (u & 0x0F) as u16;
    let v = (v & 0x0F) as u16;
    let mut r: u16 = 0;
    for i in 0..4 {
        if ((v >> i) & 1) != 0 {
            r ^= u << i;
        }
    }
    for k in (4..=6).rev() {
        if ((r >> k) & 1) != 0 {
            r ^= POLY << (k - 4);
        }
    }
    (r & 0x0F) as u8
}

/// Field squaring: in GF(2^4), squaring is GF(2)-linear.
#[inline]
pub fn gf_sq(v: u8) -> u8 {
    gf_mul(v, v)
}

/// Field inversion: inv(0) = 0, and for v != 0, inv(v) = v^14 (Fermat's Little Theorem).
pub fn gf_inv(v: u8) -> u8 {
    let v = v & 0x0F;
    if v == 0 {
        return 0;
    }
    let mut r = 1u8;
    for _ in 0..14 {
        r = gf_mul(r, v);
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_inversion_table() {
        for v in 0..16u8 {
            let inv = gf_inv(v);
            assert_eq!(
                inv, CANONICAL_INV[v as usize],
                "Mismatch at v={v}: expected {}, got {}",
                CANONICAL_INV[v as usize], inv
            );
        }
    }

    #[test]
    fn test_multiplicative_inverse_property() {
        assert_eq!(gf_inv(0), 0, "inv(0) must equal 0");
        for v in 1..16u8 {
            let inv = gf_inv(v);
            let prod = gf_mul(v, inv);
            assert_eq!(prod, 1, "v * inv(v) != 1 for v={v}, inv={inv}");
        }
    }

    #[test]
    fn test_squaring_is_linear() {
        for u in 0..16u8 {
            for v in 0..16u8 {
                assert_eq!(
                    gf_sq(gf_add(u, v)),
                    gf_add(gf_sq(u), gf_sq(v)),
                    "Squaring must be linear over GF(2)"
                );
            }
        }
    }
}
