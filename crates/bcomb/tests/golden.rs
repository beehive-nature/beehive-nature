//! GENERATED FROM surfaces/blight/bcomb.js — DO NOT EDIT BY HAND.
//!
//! These vectors come out of the JavaScript codec that has been decoding real
//! beams off real screens since 2026-08-14. The JS is the conformance oracle;
//! this file is how the Rust implementation proves it agrees, bit for bit.
//! A second implementation is not evidence for the first — it is a hostage.

use bcomb::*;

fn bits_to_string(bits: &[bool]) -> String {
    bits.iter().map(|b| if *b { '1' } else { '0' }).collect()
}
fn string_to_bits(s: &str) -> Vec<bool> {
    s.chars().map(|c| c == '1').collect()
}

/// (index, total, payload, exact 84-bit string the oracle produces)
#[rustfmt::skip] // one vector per line so each PUBLIC-CONSTANT marker stays on its string (the secret scan requires same-line markers)
const FRAMES: &[(u8, u8, [u8; 8], &str)] = &[
    (0, 1, [0, 0, 0, 0, 0, 0, 0, 0], "000000000000000000000000000000000000000000000000000000000000000000000000000000000000"), // PUBLIC-CONSTANT (bComb frame bits)
    (3, 12, [1, 2, 3, 4, 5, 6, 7, 8], "000011001011000000010000001000000011000001000000010100000110000001110000100011001100"), // PUBLIC-CONSTANT (bComb frame bits)
    (63, 64, [255, 255, 255, 255, 255, 255, 255, 255], "111111111111111111111111111111111111111111111111111111111111111111111111111100010001"), // PUBLIC-CONSTANT (bComb frame bits)
    (7, 22, [222, 173, 190, 239, 0, 17, 34, 51], "000111010101110111101010110110111110111011110000000000010001001000100011001111100010"), // PUBLIC-CONSTANT (bComb frame bits)
    (1, 2, [98, 67, 111, 109, 98, 32, 118, 50], "000001000001011000100100001101101111011011010110001000100000011101100011001001011011"), // PUBLIC-CONSTANT (bComb frame bits)
];

/// (text, frame count, exact frame bit strings in order)
#[rustfmt::skip] // same-line PUBLIC-CONSTANT markers, same reason as FRAMES
const BEAMS: &[(&str, usize, &[&str])] = &[
    ("bComb", 2, &[
        "000000000001000000000000010101100010010000110110111101101101011000101001110001110011", // PUBLIC-CONSTANT (bComb frame bits)
        "000001000001000101011011110101100000000000000000000000000000000000000000000010001100", // PUBLIC-CONSTANT (bComb frame bits)
    ]),
    ("bLighTnetWorK mono v2 — luminance only", 6, &[
        "000000000101000000000010100001100010010011000110100101100111011010000101010001000110", // PUBLIC-CONSTANT (bComb frame bits)
        "000001000101011011100110010101110100010101110110111101110010010010110010000001000010", // PUBLIC-CONSTANT (bComb frame bits)
        "000010000101011011010110111101101110011011110010000001110110001100100010000010101101", // PUBLIC-CONSTANT (bComb frame bits)
        "000011000101111000101000000010010100001000000110110001110101011011010110100100101111", // PUBLIC-CONSTANT (bComb frame bits)
        "000100000101011011100110000101101110011000110110010100100000011011110110111011011011", // PUBLIC-CONSTANT (bComb frame bits)
        "000101000101011011000111100101110101010100000100011011110110000000000000000001101011", // PUBLIC-CONSTANT (bComb frame bits)
    ]),
    ("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", 26, &[
        "000000011001000000001100100001111000011110000111100001111000011110000111100011010010", // PUBLIC-CONSTANT (bComb frame bits)
        "000001011001011110000111100001111000011110000111100001111000011110000111100001011111", // PUBLIC-CONSTANT (bComb frame bits)
        "000010011001011110000111100001111000011110000111100001111000011110000111100011100111", // PUBLIC-CONSTANT (bComb frame bits)
        "000011011001011110000111100001111000011110000111100001111000011110000111100010001111", // PUBLIC-CONSTANT (bComb frame bits)
        "000100011001011110000111100001111000011110000111100001111000011110000111100010010000", // PUBLIC-CONSTANT (bComb frame bits)
        "000101011001011110000111100001111000011110000111100001111000011110000111100011111000", // PUBLIC-CONSTANT (bComb frame bits)
        "000110011001011110000111100001111000011110000111100001111000011110000111100001000000", // PUBLIC-CONSTANT (bComb frame bits)
        "000111011001011110000111100001111000011110000111100001111000011110000111100000101000", // PUBLIC-CONSTANT (bComb frame bits)
        "001000011001011110000111100001111000011110000111100001111000011110000111100001111110", // PUBLIC-CONSTANT (bComb frame bits)
        "001001011001011110000111100001111000011110000111100001111000011110000111100000010110", // PUBLIC-CONSTANT (bComb frame bits)
        "001010011001011110000111100001111000011110000111100001111000011110000111100010101110", // PUBLIC-CONSTANT (bComb frame bits)
        "001011011001011110000111100001111000011110000111100001111000011110000111100011000110", // PUBLIC-CONSTANT (bComb frame bits)
        "001100011001011110000111100001111000011110000111100001111000011110000111100011011001", // PUBLIC-CONSTANT (bComb frame bits)
        "001101011001011110000111100001111000011110000111100001111000011110000111100010110001", // PUBLIC-CONSTANT (bComb frame bits)
        "001110011001011110000111100001111000011110000111100001111000011110000111100000001001", // PUBLIC-CONSTANT (bComb frame bits)
        "001111011001011110000111100001111000011110000111100001111000011110000111100001100001", // PUBLIC-CONSTANT (bComb frame bits)
        "010000011001011110000111100001111000011110000111100001111000011110000111100010100101", // PUBLIC-CONSTANT (bComb frame bits)
        "010001011001011110000111100001111000011110000111100001111000011110000111100011001101", // PUBLIC-CONSTANT (bComb frame bits)
        "010010011001011110000111100001111000011110000111100001111000011110000111100001110101", // PUBLIC-CONSTANT (bComb frame bits)
        "010011011001011110000111100001111000011110000111100001111000011110000111100000011101", // PUBLIC-CONSTANT (bComb frame bits)
        "010100011001011110000111100001111000011110000111100001111000011110000111100000000010", // PUBLIC-CONSTANT (bComb frame bits)
        "010101011001011110000111100001111000011110000111100001111000011110000111100001101010", // PUBLIC-CONSTANT (bComb frame bits)
        "010110011001011110000111100001111000011110000111100001111000011110000111100011010010", // PUBLIC-CONSTANT (bComb frame bits)
        "010111011001011110000111100001111000011110000111100001111000011110000111100010111010", // PUBLIC-CONSTANT (bComb frame bits)
        "011000011001011110000111100001111000011110000111100001111000011110000111100011101100", // PUBLIC-CONSTANT (bComb frame bits)
        "011001011001011110000111100001111110110010110110101110100110000000000000000000101110", // PUBLIC-CONSTANT (bComb frame bits)
    ]),
];

#[test]
fn geometry_matches_the_oracle() {
    assert_eq!(CELLS.len(), 127, "cell count");
    assert_eq!(DATA_BITS, 84, "data bits per frame");
    assert_eq!(PAYLOAD_BYTES, 8, "payload bytes per frame");
    assert_eq!(
        CELLS.iter().filter(|c| c.data_index >= 0).count(),
        84,
        "data-carrying cells"
    );
    // roles are exactly as the drawer assumes
    assert_eq!(CELLS.iter().filter(|c| c.ring == 0).count(), 1, "core");
    assert_eq!(CELLS.iter().filter(|c| c.ring == 1).count(), 6, "collar");
    assert_eq!(CELLS.iter().filter(|c| c.ring == 6).count(), 36, "rim");
}

#[test]
fn packs_exactly_what_the_oracle_packs() {
    for (index, total, payload, expect) in FRAMES {
        let bits = pack_frame(*index, *total, payload).expect("pack");
        assert_eq!(
            bits_to_string(&bits),
            *expect,
            "frame index={} total={} payload={:?}",
            index,
            total,
            payload
        );
    }
}

#[test]
fn unpacks_the_oracles_own_bits() {
    for (index, total, payload, encoded) in FRAMES {
        let frame = unpack_frame(&string_to_bits(encoded)).expect("unpack");
        assert_eq!(frame.index, *index);
        assert_eq!(frame.total, *total);
        assert_eq!(&frame.bytes, payload);
    }
}

#[test]
fn splits_beams_exactly_as_the_oracle_does() {
    for (text, count, frames) in BEAMS {
        let data = text.as_bytes();
        assert_eq!(
            frames_needed(data.len()).expect("count"),
            *count,
            "frame count for {:?}",
            text
        );
        for (i, expect) in frames.iter().enumerate() {
            let bits = frame_at(data, i).expect("frame");
            assert_eq!(
                bits_to_string(&bits),
                **expect,
                "beam {:?} frame {}",
                text,
                i
            );
        }
    }
}

#[test]
fn lit_cells_match_the_oracles_renderer() {
    let data = "bComb".as_bytes();
    let bits = frame_at(data, 0).expect("frame");
    let lit: Vec<usize> = (0..CELLS.len()).filter(|i| lit_cell(*i, &bits)).collect();
    let expect: Vec<usize> = vec![
        0, 18, 32, 34, 36, 37, 41, 44, 49, 50, 52, 53, 55, 56, 57, 58, 60, 61, 63, 64, 66, 68, 69,
        73, 75, 78, 79, 80, 84, 85, 86, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102,
        103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
        121, 122, 123, 124, 125, 126,
    ];
    assert_eq!(
        lit, expect,
        "lit cell indices for the first frame of \"bComb\""
    );
    assert_eq!(lit.len(), 69);
}
