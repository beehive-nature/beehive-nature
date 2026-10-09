//! BIP-39 for the 24-word recovery phrase (SPEC-BTUNGSTEN-PQ-1 PQ11).
//!
//! The phrase is the masterPrk's BIP-39 encoding (SPEC-BPQ-1 §2): 256 bits of
//! entropy and an 8-bit checksum, 264 bits read most significant first as 24
//! word indices of 11 bits each. The checksum byte is an INPUT here: bsigner
//! computes it (the first byte of SHA-256 of the entropy) and looks words up.
//! So `scripts/btungsten/pq11-saw/bip39.saw` proves the packing a bijection
//! for every checksum byte, which makes it a bijection for any hash
//! (`mnemonicRoundTrip`), and that a phrase whose checksum byte differs from
//! the one the hash gives is refused (`badChecksumRefused`).

/// Words in a 256-bit phrase.
pub const WORDS: usize = 24;
/// Words in a BIP-39 list.
pub const LIST_LEN: u16 = 2048;

/// The 24 word indices (each below 2048) that carry `entropy` and `checksum`.
pub fn indices(entropy: &[u8; 32], checksum: u8) -> [u16; WORDS] {
    let mut out = [0u16; WORDS];
    let mut w = 0;
    while w < WORDS {
        let mut v: u16 = 0;
        let mut b = 0;
        while b < 11 {
            let bit = w * 11 + b;
            let byte = if bit < 256 {
                entropy[bit / 8]
            } else {
                checksum
            };
            v = (v << 1) | (((byte >> (7 - bit % 8)) & 1) as u16);
            b += 1;
        }
        out[w] = v;
        w += 1;
    }
    out
}

/// Every index names a word of the list.
pub fn indices_ok(idx: &[u16; WORDS]) -> bool {
    let mut ok = true;
    let mut w = 0;
    while w < WORDS {
        ok &= idx[w] < LIST_LEN;
        w += 1;
    }
    ok
}

/// The entropy and the checksum byte 24 indices carry. Only the low 11 bits
/// of each index are read; callers check `indices_ok` first.
pub fn unpack(idx: &[u16; WORDS]) -> ([u8; 32], u8) {
    let mut entropy = [0u8; 32];
    let mut checksum = 0u8;
    let mut bit = 0;
    while bit < 264 {
        let v = (idx[bit / 11] >> (10 - bit % 11)) & 1;
        if bit < 256 {
            entropy[bit / 8] |= (v as u8) << (7 - bit % 8);
        } else {
            checksum |= (v as u8) << (7 - bit % 8);
        }
        bit += 1;
    }
    (entropy, checksum)
}

/// Cryptol `decodeOk`: the indices name words and carry the checksum byte the
/// hash gives for their entropy (`hashed`, the first byte of SHA-256 of
/// `unpack(idx).0`, computed by the caller).
pub fn decode_ok(idx: &[u16; WORDS], hashed: u8) -> bool {
    indices_ok(idx) & (unpack(idx).1 == hashed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packing_round_trips() {
        let mut e = [0u8; 32];
        for (i, b) in e.iter_mut().enumerate() {
            *b = (i as u8).wrapping_mul(37).wrapping_add(11);
        }
        for cs in [0u8, 1, 0x80, 0xff, 0x5a] {
            let idx = indices(&e, cs);
            assert!(indices_ok(&idx));
            assert_eq!(unpack(&idx), (e, cs));
            assert!(decode_ok(&idx, cs));
            assert!(!decode_ok(&idx, cs ^ 1));
        }
        assert_eq!(indices(&[0u8; 32], 0), [0u16; WORDS]);
        assert_eq!(indices(&[0xff; 32], 0xff), [0x7ff; WORDS]);
    }

    #[test]
    fn an_index_past_the_list_is_refused() {
        let mut idx = indices(&[7u8; 32], 3);
        idx[5] = LIST_LEN;
        assert!(!indices_ok(&idx));
        assert!(!decode_ok(&idx, 3));
    }
}
