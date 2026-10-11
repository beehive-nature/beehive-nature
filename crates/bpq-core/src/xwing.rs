//! The X-Wing glue bsigner runs around ML-KEM-768 and X25519
//! (SPEC-BTUNGSTEN-PQ-1 PQ05; draft-connolly-cfrg-xwing-kem-11, whose
//! Appendix C vectors both implementations reproduce in CI job pq05-xwing):
//! the split of the expanded seed and the combiner's input. SAW proves both
//! equal to `scripts/btungsten/pq05-cryptol/XWing.cry`, and `combinerBinds`
//! there: the 134 bytes hashed into the shared secret determine
//! (ss_M, ss_X, ct_X, pk_X).

/// The draft's XWingLabel, `\.//^\` (hex 5c2e2f2f5e5c).
pub const LABEL: [u8; 6] = *b"\\.//^\\";

/// The combiner's input: ss_M ‖ ss_X ‖ ct_X ‖ pk_X ‖ XWingLabel, the label
/// last as in draft -11 (SPEC-BPQ-1 §2). The shared secret is its SHA3-256.
pub fn combiner_input(
    ss_m: &[u8; 32],
    ss_x: &[u8; 32],
    ct_x: &[u8; 32],
    pk_x: &[u8; 32],
) -> [u8; 134] {
    let mut out = [0u8; 134];
    let mut i = 0;
    while i < 32 {
        out[i] = ss_m[i];
        out[32 + i] = ss_x[i];
        out[64 + i] = ct_x[i];
        out[96 + i] = pk_x[i];
        i += 1;
    }
    let mut j = 0;
    while j < 6 {
        out[128 + j] = LABEL[j];
        j += 1;
    }
    out
}

/// The expanded seed SHAKE256(seed, 96) split as the draft splits it: the
/// ML-KEM-768 seed d ‖ z (64 bytes), then the X25519 secret (32 bytes).
pub fn split_seed(wide: &[u8; 96]) -> ([u8; 64], [u8; 32]) {
    let mut kem = [0u8; 64];
    let mut x = [0u8; 32];
    let mut i = 0;
    while i < 64 {
        kem[i] = wide[i];
        i += 1;
    }
    let mut j = 0;
    while j < 32 {
        x[j] = wide[64 + j];
        j += 1;
    }
    (kem, x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_label_is_the_drafts() {
        assert_eq!(LABEL, [0x5c, 0x2e, 0x2f, 0x2f, 0x5e, 0x5c]);
    }

    #[test]
    fn combiner_input_is_the_concatenation() {
        let (a, b, c, d) = ([1u8; 32], [2u8; 32], [3u8; 32], [4u8; 32]);
        let x = combiner_input(&a, &b, &c, &d);
        assert_eq!(&x[..32], &a);
        assert_eq!(&x[32..64], &b);
        assert_eq!(&x[64..96], &c);
        assert_eq!(&x[96..128], &d);
        assert_eq!(&x[128..], &LABEL);
    }

    #[test]
    fn the_seed_splits_64_then_32() {
        let mut w = [0u8; 96];
        for (i, b) in w.iter_mut().enumerate() {
            *b = i as u8;
        }
        let (k, x) = split_seed(&w);
        assert_eq!(&k[..], &w[..64]);
        assert_eq!(&x[..], &w[64..]);
    }
}
