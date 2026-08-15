//! bComb — the optical frame format of the bLighTnetWorK.
//!
//! `no_std`, no allocator, no floating-point transcendentals. Those three
//! constraints are not stylistic: this crate has to compile into Trezor firmware,
//! where there is no heap to speak of and pulling in `libm` for a `sin` call to
//! draw a hexagon would be absurd. Every geometric constant it needs is exact and
//! embedded, so the whole renderer is multiplies and adds.
//!
//! # What a bComb frame is
//!
//! A flat-top axial hex grid, 6 rings, 127 cells, rendered white-on-black:
//!
//! | ring | cells | role |
//! |------|-------|------|
//! | 0 | 1 | finder core — always lit |
//! | 1 | 6 | finder collar — always dark |
//! | 2–5 | 84 | data — one luminance bit each |
//! | 6 | 36 | rim — always lit |
//!
//! The core-inside-a-dark-collar is the anchor, and the rim gives a decoder the
//! comb's centre and scale. All of it reads on **luminance alone** — no hue is
//! involved anywhere, because a saturated frame drags a camera's auto-exposure
//! and white balance around, and because a decoder that needs colour cannot work
//! on a monochrome display, in print, or through a cheap sensor.
//!
//! # Two layers of integrity, and why both are needed
//!
//! Each frame carries a CRC-8, which rejects a mangled frame cheaply — but 1 in
//! 256 corrupt frames slips through. Sighting a frame twice before trusting it
//! catches *random* noise, which rarely repeats byte-identically, and does
//! nothing about a *systematic* misread: a reflection parked on one part of the
//! screen reads wrong the same way every look, so it gets confirmed.
//!
//! So the beam itself is wrapped: `[2 len][payload][4 CRC-32]`, zero-padded to
//! the frame boundary. A complete set that fails the outer sum is **discarded**,
//! never delivered. Handing up bytes we cannot vouch for is the worst outcome
//! available — worse than a slow beam, worse than no beam at all.
//!
//! The explicit length also replaces stripping trailing zeros, which could never
//! tell a real trailing NUL in the payload from padding.
//!
//! # Conformance
//!
//! `surfaces/blight/bcomb.js` is the oracle: it has been decoding real beams off
//! real screens since 2026-08-14. The cell table in [`cells`] and the vectors in
//! `tests/golden.rs` are **generated from it**. A second implementation is not
//! evidence for the first — it is held hostage to it.

#![no_std]
#![forbid(unsafe_code)]
#![deny(missing_docs)]

mod cells;
pub use cells::{Cell, CELLS};

/// Rings of cells around the core.
pub const RINGS: u8 = 6;
/// Data bits carried by one frame, one per data cell.
pub const DATA_BITS: usize = 84;
/// Payload bytes carried by one frame.
pub const PAYLOAD_BYTES: usize = 8;
/// Frames a single beam may contain — the index and total fields are 6 bits each.
pub const MAX_FRAMES: usize = 64;

/// Length prefix, in bytes, at the head of a beam body.
pub const HEADER_BYTES: usize = 2;
/// CRC-32 trailer, in bytes, at the tail of a beam body.
pub const TRAILER_BYTES: usize = 4;
/// Largest payload one beam can carry: `64 * 8 - 6`.
pub const MAX_BEAM_BYTES: usize = MAX_FRAMES * PAYLOAD_BYTES - HEADER_BYTES - TRAILER_BYTES;

/// `sqrt(3)`, to f32 precision. Embedded so the renderer needs no `libm`.
pub const SQRT_3: f32 = 1.732_050_8;

/// Unit-circumradius vertices of a flat-top hexagon, at 0°, 60° … 300°.
///
/// Exact values, so drawing a cell costs six multiply-adds and no trigonometry.
pub const HEX_VERTICES: [(f32, f32); 6] = [
    (1.0, 0.0),
    (0.5, 0.866_025_4),
    (-0.5, 0.866_025_4),
    (-1.0, 0.0),
    (-0.5, -0.866_025_4),
    (0.5, -0.866_025_4),
];

/// A decoded frame: where it sits in the beam, and the bytes it carried.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Frame {
    /// Position of this frame in the beam, `0..total`.
    pub index: u8,
    /// How many frames the whole beam contains, `1..=64`.
    pub total: u8,
    /// The frame's payload bytes.
    pub bytes: [u8; PAYLOAD_BYTES],
}

/// Why a frame or beam was refused. Every variant is a refusal, never a guess.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    /// `total` was outside `1..=64`.
    TotalOutOfRange,
    /// `index` was not less than `total`, which no real frame can be.
    IndexNotLessThanTotal,
    /// The bit slice was not exactly [`DATA_BITS`] long.
    WrongBitCount,
    /// The frame's CRC-8 did not match its contents.
    FrameChecksum,
    /// The payload will not fit in one beam.
    PayloadTooLong,
}

/// What a given cell does in the frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// Ring 0 — always lit.
    Core,
    /// Ring 1 — always dark.
    Collar,
    /// Rings 2–5 — carries the bit at this index.
    Data(usize),
    /// Ring 6 — always lit.
    Rim,
}

/// CRC-8/ATM, polynomial `0x07`. Guards a single frame.
pub fn crc8(bytes: &[u8]) -> u8 {
    let mut c: u8 = 0;
    for b in bytes {
        c ^= *b;
        for _ in 0..8 {
            c = if c & 0x80 != 0 { (c << 1) ^ 0x07 } else { c << 1 };
        }
    }
    c
}

/// CRC-32/IEEE, reflected, as used by zlib and PNG. Guards the whole beam.
pub fn crc32(bytes: &[u8]) -> u32 {
    let mut c: u32 = 0xFFFF_FFFF;
    for b in bytes {
        c ^= *b as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
        }
    }
    !c
}

/// Lay out one frame's 84 bits: `[6 index][6 total-1][64 payload][8 CRC-8]`.
///
/// Payload shorter than [`PAYLOAD_BYTES`] is zero-filled, which is what the last
/// frame of a beam needs.
pub fn pack_frame(index: u8, total: u8, payload: &[u8]) -> Result<[bool; DATA_BITS], Error> {
    if total < 1 || total as usize > MAX_FRAMES {
        return Err(Error::TotalOutOfRange);
    }
    if index >= total {
        return Err(Error::IndexNotLessThanTotal);
    }
    let mut bytes = [0u8; PAYLOAD_BYTES];
    for (slot, b) in bytes.iter_mut().zip(payload.iter()) {
        *slot = *b;
    }

    let mut crc_input = [0u8; PAYLOAD_BYTES + 2];
    crc_input[0] = index;
    crc_input[1] = total - 1;
    crc_input[2..].copy_from_slice(&bytes);
    let crc = crc8(&crc_input);

    let mut bits = [false; DATA_BITS];
    let mut at = 0usize;
    let put = |value: u32, width: usize, bits: &mut [bool; DATA_BITS], at: &mut usize| {
        for shift in (0..width).rev() {
            bits[*at] = (value >> shift) & 1 == 1;
            *at += 1;
        }
    };
    put(index as u32, 6, &mut bits, &mut at);
    put((total - 1) as u32, 6, &mut bits, &mut at);
    for b in &bytes {
        put(*b as u32, 8, &mut bits, &mut at);
    }
    put(crc as u32, 8, &mut bits, &mut at);
    debug_assert_eq!(at, DATA_BITS);
    Ok(bits)
}

/// Read one frame back out of 84 sampled bits, or refuse.
///
/// An impossible index and a failed CRC-8 are both refusals: a decoder that
/// guesses is worse than one that waits for the next look.
pub fn unpack_frame(bits: &[bool]) -> Result<Frame, Error> {
    if bits.len() != DATA_BITS {
        return Err(Error::WrongBitCount);
    }
    let take = |from: usize, width: usize| -> u32 {
        let mut v = 0u32;
        for i in 0..width {
            v = (v << 1) | bits[from + i] as u32;
        }
        v
    };
    let index = take(0, 6) as u8;
    let total = take(6, 6) as u8 + 1;
    let mut bytes = [0u8; PAYLOAD_BYTES];
    for (i, slot) in bytes.iter_mut().enumerate() {
        *slot = take(12 + i * 8, 8) as u8;
    }
    let crc = take(12 + PAYLOAD_BYTES * 8, 8) as u8;

    if index >= total {
        return Err(Error::IndexNotLessThanTotal);
    }
    let mut crc_input = [0u8; PAYLOAD_BYTES + 2];
    crc_input[0] = index;
    crc_input[1] = total - 1;
    crc_input[2..].copy_from_slice(&bytes);
    if crc8(&crc_input) != crc {
        return Err(Error::FrameChecksum);
    }
    Ok(Frame { index, total, bytes })
}

/// Total body length for a payload: length prefix, payload, CRC-32 trailer.
const fn body_len(payload_len: usize) -> usize {
    HEADER_BYTES + payload_len + TRAILER_BYTES
}

/// How many frames a payload of this length needs.
pub fn frames_needed(payload_len: usize) -> Result<usize, Error> {
    if payload_len > MAX_BEAM_BYTES {
        return Err(Error::PayloadTooLong);
    }
    let body = body_len(payload_len);
    Ok(((body + PAYLOAD_BYTES - 1) / PAYLOAD_BYTES).max(1))
}

/// The byte at `offset` of the beam body, without ever materialising the body.
///
/// Keeping this a pure function of the payload is what lets firmware stream a
/// beam with no buffer beyond the payload it already holds.
fn body_byte(payload: &[u8], sum: u32, offset: usize) -> u8 {
    let len = payload.len();
    if offset == 0 {
        (len >> 8) as u8
    } else if offset == 1 {
        (len & 0xFF) as u8
    } else if offset < HEADER_BYTES + len {
        payload[offset - HEADER_BYTES]
    } else if offset < body_len(len) {
        let t = offset - HEADER_BYTES - len;
        (sum >> (24 - 8 * t)) as u8
    } else {
        0 // padding to the frame boundary
    }
}

/// Build frame `index` of the beam carrying `payload`.
pub fn frame_at(payload: &[u8], index: usize) -> Result<[bool; DATA_BITS], Error> {
    let total = frames_needed(payload.len())?;
    if index >= total {
        return Err(Error::IndexNotLessThanTotal);
    }
    let sum = crc32(payload);
    let mut chunk = [0u8; PAYLOAD_BYTES];
    for (i, slot) in chunk.iter_mut().enumerate() {
        *slot = body_byte(payload, sum, index * PAYLOAD_BYTES + i);
    }
    pack_frame(index as u8, total as u8, &chunk)
}

/// Verify an assembled beam body and return the payload inside it.
///
/// `None` means the beam did not survive the trip. There is deliberately no
/// "best effort" variant: every frame having passed its own CRC-8 and the beam
/// still failing means at least one frame was misread the same way every look,
/// and that is precisely the case where partial data is most convincing and most
/// wrong.
pub fn open_envelope(body: &[u8]) -> Option<&[u8]> {
    if body.len() < HEADER_BYTES + TRAILER_BYTES {
        return None;
    }
    let len = ((body[0] as usize) << 8) | body[1] as usize;
    if len > MAX_BEAM_BYTES || body.len() < body_len(len) {
        return None;
    }
    let payload = &body[HEADER_BYTES..HEADER_BYTES + len];
    let o = HEADER_BYTES + len;
    let want = u32::from_be_bytes([body[o], body[o + 1], body[o + 2], body[o + 3]]);
    (crc32(payload) == want).then_some(payload)
}

/// What the cell at `cell_index` does in a frame.
pub fn role(cell_index: usize) -> Role {
    let cell = &CELLS[cell_index];
    match cell.ring {
        0 => Role::Core,
        1 => Role::Collar,
        6 => Role::Rim,
        _ => Role::Data(cell.data_index as usize),
    }
}

/// Whether the cell at `cell_index` is lit for these frame bits.
///
/// This is the whole renderer contract: a display driver walks the cells, asks
/// this, and fills white or black.
pub fn lit_cell(cell_index: usize, bits: &[bool; DATA_BITS]) -> bool {
    match role(cell_index) {
        Role::Core | Role::Rim => true,
        Role::Collar => false,
        Role::Data(i) => bits[i],
    }
}

/// Centre of a cell, given the comb's centre and one cell's size.
///
/// `size` is the hex grid pitch; a comb `w` pixels across uses `size = w / 23.0`.
pub fn cell_center(cell_index: usize, center_x: f32, center_y: f32, size: f32) -> (f32, f32) {
    let c = &CELLS[cell_index];
    (
        center_x + size * 1.5 * c.q as f32,
        center_y + size * SQRT_3 * (c.r as f32 + c.q as f32 / 2.0),
    )
}

/// Circumradius to draw a cell at: slightly under the pitch, so cells do not touch.
///
/// The gap is deliberate — it keeps neighbouring cells from bleeding into each
/// other when a camera is slightly out of focus.
pub fn cell_radius(size: f32) -> f32 {
    size * 0.92
}

/// The six corners of a cell, ready to fill.
pub fn hex_corners(cx: f32, cy: f32, r: f32) -> [(f32, f32); 6] {
    let mut out = [(0.0, 0.0); 6];
    for (slot, (ux, uy)) in out.iter_mut().zip(HEX_VERTICES.iter()) {
        *slot = (cx + r * ux, cy + r * uy);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crcs_match_known_values() {
        // CRC-32 of "123456789" is the standard check value for IEEE.
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc8(&[]), 0);
    }

    #[test]
    fn frame_round_trips() {
        let bits = pack_frame(5, 20, &[9, 8, 7, 6, 5, 4, 3, 2]).unwrap();
        let f = unpack_frame(&bits).unwrap();
        assert_eq!(f.index, 5);
        assert_eq!(f.total, 20);
        assert_eq!(f.bytes, [9, 8, 7, 6, 5, 4, 3, 2]);
    }

    #[test]
    fn every_single_bit_flip_is_refused() {
        let base = pack_frame(3, 12, &[1, 2, 3, 4, 5, 6, 7, 8]).unwrap();
        for i in 0..DATA_BITS {
            let mut bad = base;
            bad[i] = !bad[i];
            assert!(unpack_frame(&bad).is_err(), "bit {i} was accepted");
        }
    }

    #[test]
    fn impossible_frames_are_refused() {
        assert_eq!(pack_frame(0, 0, &[]).unwrap_err(), Error::TotalOutOfRange);
        assert_eq!(pack_frame(0, 65, &[]).unwrap_err(), Error::TotalOutOfRange);
        assert_eq!(pack_frame(4, 4, &[]).unwrap_err(), Error::IndexNotLessThanTotal);
        assert_eq!(unpack_frame(&[false; 10]).unwrap_err(), Error::WrongBitCount);
    }

    /// Assembling a beam and opening it, exactly as a receiver does.
    fn round_trip(payload: &[u8]) -> Option<[u8; MAX_FRAMES * PAYLOAD_BYTES]> {
        let total = frames_needed(payload.len()).ok()?;
        let mut body = [0u8; MAX_FRAMES * PAYLOAD_BYTES];
        for i in 0..total {
            let f = unpack_frame(&frame_at(payload, i).ok()?).ok()?;
            body[i * PAYLOAD_BYTES..(i + 1) * PAYLOAD_BYTES].copy_from_slice(&f.bytes);
        }
        let used = total * PAYLOAD_BYTES;
        open_envelope(&body[..used])?;
        Some(body)
    }

    #[test]
    fn beams_round_trip_including_awkward_payloads() {
        for p in [
            &b""[..],
            &b"b"[..],
            &b"bComb"[..],
            &b"ends with nulls\0\0\0"[..],   // explicit length beats tail-stripping
            &[0u8; 64][..],
            &[0xFFu8; MAX_BEAM_BYTES][..],
        ] {
            let total = frames_needed(p.len()).unwrap();
            let body = round_trip(p).unwrap_or_else(|| panic!("beam failed for {} bytes", p.len()));
            let got = open_envelope(&body[..total * PAYLOAD_BYTES]).unwrap();
            assert_eq!(got, p, "payload of {} bytes", p.len());
        }
    }

    #[test]
    fn oversized_payload_is_refused_not_truncated() {
        assert_eq!(frames_needed(MAX_BEAM_BYTES + 1).unwrap_err(), Error::PayloadTooLong);
        assert!(frames_needed(MAX_BEAM_BYTES).is_ok());
    }

    #[test]
    fn a_corrupt_body_is_never_opened() {
        let payload = b"the whole-beam sum is the last line of defence";
        let total = frames_needed(payload.len()).unwrap();
        let mut body = round_trip(payload).unwrap();
        let used = total * PAYLOAD_BYTES;
        assert!(open_envelope(&body[..used]).is_some());
        // corrupt one payload byte, leaving every frame's own CRC-8 valid
        body[HEADER_BYTES + 3] ^= 0xFF;
        assert!(
            open_envelope(&body[..used]).is_none(),
            "a systematically misread frame was delivered"
        );
    }

    #[test]
    fn geometry_needs_no_trig() {
        // the unit hexagon really is a unit hexagon
        for (x, y) in HEX_VERTICES {
            let r2 = x * x + y * y;
            assert!((r2 - 1.0).abs() < 1e-6, "vertex off the unit circle: {r2}");
        }
        // the core sits exactly at the centre
        let (x, y) = cell_center(0, 100.0, 100.0, 10.0);
        assert_eq!(CELLS[0].ring, 0);
        assert!((x - 100.0).abs() < 1e-6 && (y - 100.0).abs() < 1e-6);
    }

    #[test]
    fn roles_are_exactly_the_rendering_contract() {
        assert_eq!(role(0), Role::Core);
        assert!(matches!(role(1), Role::Collar));
        assert_eq!(CELLS.iter().filter(|c| c.ring == 1).count(), 6);
        assert_eq!(CELLS.iter().filter(|c| c.ring == 6).count(), 36);
        assert_eq!(CELLS.iter().filter(|c| c.data_index >= 0).count(), DATA_BITS);
        let bits = [true; DATA_BITS];
        assert!(lit_cell(0, &bits), "core must light");
        assert!(!lit_cell(1, &bits), "collar must stay dark even with all bits set");
    }
}
