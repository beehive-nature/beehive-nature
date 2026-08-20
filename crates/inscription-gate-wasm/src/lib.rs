//! C-ABI wasm shim over `inscription-gate`.
//! SPDX-License-Identifier: AGPL-3.0-only
//!
//! 1st Assistant Code Surgeon — zCode (GLM 5.3), 2026-08-16. Rank per founder
//! ruling of the same date; attribution per RULING_COMMIT_ATTRIBUTION_2026-08-07.
//!
//! The verdict code is the core crate's, UNCHANGED — every check, threshold and
//! fix hint lives there and nowhere else. This crate only marshals bytes across
//! a flat C ABI so the Studio's browser preview and the LaunchPad's deploy check
//! can run the same `check()` with no JS port to drift from it. If the two ever
//! disagree, the gate is advisory rather than binding, which defeats its purpose.
//!
//! THE REPORT FORMAT (all little-endian). `gate_check` returns the report's byte
//! length; if that exceeds the caller's capacity NOTHING is written and the
//! length is still returned, so the caller reallocates and retries.
//!
//!   u8      pass
//!   u8      reserved (0)
//!   u32     cells
//!   u32     rects
//!   u32     findings_count
//!   findings_count × 16 bytes, each: u8 tag then tag-specific payload:
//!     1 GridMismatch  { u8 expected, u8 found }
//!     2 Empty         { }
//!     3 OffPalette    { u32 color, u32 cells, u32 nearest }
//!     4 OutOfBounds   { u8 col, u8 row }
//!     5 TooManyRects  { u32 count, u32 limit }
//!     6 Hairline      { u8 axis, u8 start_col, u8 start_row, u8 len }
//!     7 Dither        { u8 col, u8 row, u8 extent }
//!     8 Margin        { u8 side, u8 actual, u8 required }
//!
//! The fix-hint strings are UI copy and live in the surface, keyed by tag —
//! they are static text, not verdict logic, and duplicating verdict TEXT would
//! be the drift risk this crate exists to prevent.

use inscription_gate::{check, Axis, Finding, GateConfig, Layer, Orientation, Side};

/// Report format version. Bump on any layout change; the surface refuses on mismatch.
/// v2: `gate_check` grew a separate `layer_grid` parameter — v1 reused one value for
/// both `Layer.grid` and `GateConfig.grid`, which made `GridMismatch` unreachable
/// through the ABI (caught by the surface's self-test, 2026-08-16).
pub const REPORT_VERSION: u32 = 2;

/// Bytes per serialized finding.
pub const FINDING_BYTES: usize = 16;

fn axis_byte(a: Axis) -> u8 {
    match a {
        Axis::Horizontal => 0,
        Axis::Vertical => 1,
    }
}
fn side_byte(s: Side) -> u8 {
    match s {
        Side::Top => 0,
        Side::Bottom => 1,
        Side::Left => 2,
        Side::Right => 3,
    }
}

/// Serialize a Verdict into the flat report. Exposed natively so tests pin the
/// exact bytes the browser will parse — the ABI is the contract.
pub fn encode_report(v: &inscription_gate::Verdict) -> Vec<u8> {
    let mut out = Vec::with_capacity(16 + v.findings.len() * FINDING_BYTES);
    out.push(v.pass as u8);
    out.push(0);
    out.extend_from_slice(&(v.cells as u32).to_le_bytes());
    out.extend_from_slice(&(v.rects as u32).to_le_bytes());
    out.extend_from_slice(&(v.findings.len() as u32).to_le_bytes());
    for f in &v.findings {
        let mut rec = [0u8; FINDING_BYTES];
        match f {
            Finding::GridMismatch { expected, found } => {
                rec[0] = 1;
                rec[1] = *expected;
                rec[2] = *found;
            }
            Finding::Empty => {
                rec[0] = 2;
            }
            Finding::OffPalette {
                color,
                cells,
                nearest,
            } => {
                rec[0] = 3;
                rec[1..5].copy_from_slice(&color.to_le_bytes());
                rec[5..9].copy_from_slice(&(*cells as u32).to_le_bytes());
                rec[9..13].copy_from_slice(&nearest.to_le_bytes());
            }
            Finding::OutOfBounds { col, row } => {
                rec[0] = 4;
                rec[1] = *col;
                rec[2] = *row;
            }
            Finding::TooManyRects { count, limit } => {
                rec[0] = 5;
                rec[1..5].copy_from_slice(&(*count as u32).to_le_bytes());
                rec[5..9].copy_from_slice(&(*limit as u32).to_le_bytes());
            }
            Finding::Hairline {
                axis,
                start_col,
                start_row,
                len,
            } => {
                rec[0] = 6;
                rec[1] = axis_byte(*axis);
                rec[2] = *start_col;
                rec[3] = *start_row;
                rec[4] = *len;
            }
            Finding::Dither { col, row, extent } => {
                rec[0] = 7;
                rec[1] = *col;
                rec[2] = *row;
                rec[3] = *extent;
            }
            Finding::Margin {
                side,
                actual,
                required,
            } => {
                rec[0] = 8;
                rec[1] = side_byte(*side);
                rec[2] = *actual;
                rec[3] = *required;
            }
        }
        out.extend_from_slice(&rec);
    }
    out
}

/// Shared body of `gate_check`, safe and testable natively. `layer_grid` is the
/// grid the cells actually decode to; `cfg_grid` is the collection's configured
/// grid — they differ exactly when `GridMismatch` should fire. Returns the report
/// bytes, or the needed length alone when `cap` is too small (nothing written).
fn gate_check_impl(
    cells: &[u8],
    layer_grid: u8,
    cfg_grid: u8,
    max_rects: u32,
    min_margin: u8,
    max_hairline: u8,
    orientation: u8,
    palette: &[u8],
    out_cap: usize,
) -> (usize, Option<Vec<u8>>) {
    let cells_u32: Vec<u32> = cells
        .chunks_exact(4)
        .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    let palette_u32: Vec<u32> = palette
        .chunks_exact(4)
        .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();

    let layer = Layer {
        grid: layer_grid,
        cells: cells_u32
            .into_iter()
            .map(|c| if c == 0 { None } else { Some(c) })
            .collect(),
    };
    let cfg = GateConfig {
        grid: cfg_grid,
        palette: palette_u32,
        max_rects: max_rects as usize,
        min_margin,
        max_hairline,
        orientation: if orientation == 1 {
            Orientation::PointyTop
        } else {
            Orientation::FlatTop
        },
    };
    let report = encode_report(&check(&layer, &cfg));
    if report.len() > out_cap {
        (report.len(), None)
    } else {
        (report.len(), Some(report))
    }
}

/// Run the gate. Writes the report into `report_ptr` (caller-allocated, capacity
/// `report_cap`) and returns the report's byte length — which may exceed
/// `report_cap`, in which case nothing was written: allocate the returned size
/// and call again.
#[no_mangle]
pub extern "C" fn gate_check(
    cells_ptr: *const u8,
    cells_len: u32,
    layer_grid: u8,
    cfg_grid: u8,
    max_rects: u32,
    min_margin: u8,
    max_hairline: u8,
    orientation: u8,
    palette_ptr: *const u8,
    palette_len: u32,
    report_ptr: *mut u8,
    report_cap: u32,
) -> u32 {
    use core::slice;
    let cells = unsafe { slice::from_raw_parts(cells_ptr, cells_len as usize) };
    let palette = unsafe { slice::from_raw_parts(palette_ptr, palette_len as usize) };
    let out = unsafe { slice::from_raw_parts_mut(report_ptr, report_cap as usize) };
    let (len, report) = gate_check_impl(
        cells,
        layer_grid,
        cfg_grid,
        max_rects,
        min_margin,
        max_hairline,
        orientation,
        palette,
        out.len(),
    );
    if let Some(r) = report {
        out[..r.len()].copy_from_slice(&r);
    }
    len as u32
}

#[no_mangle]
pub extern "C" fn gate_version() -> u32 {
    REPORT_VERSION
}

/// Caller-owned linear allocator. Pair every successful `alloc` with `dealloc`
/// of the same pointer and length; the Studio allocates once per session and
/// reuses the buffers across every check.
#[no_mangle]
pub extern "C" fn alloc(len: u32) -> *mut u8 {
    let mut v = vec![0u8; len as usize];
    let p = v.as_mut_ptr();
    core::mem::forget(v);
    p
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, len: u32) {
    if !ptr.is_null() && len > 0 {
        unsafe { drop(Vec::from_raw_parts(ptr, len as usize, len as usize)) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use inscription_gate::{Axis, Finding, Side};

    fn cfg() -> GateConfig {
        GateConfig {
            grid: 16,
            palette: vec![0xFF0000, 0x00FF00],
            max_rects: 675,
            min_margin: 2,
            max_hairline: 4,
            orientation: Orientation::FlatTop,
        }
    }

    fn layer_bytes(grid: u8, filled: &[(u8, u8, u32)]) -> Vec<u8> {
        let mut l = Layer::new(grid);
        for &(c, r, col) in filled {
            l.set(c, r, Some(col));
        }
        l.cells
            .iter()
            .map(|c| c.unwrap_or(0).to_le_bytes())
            .collect::<Vec<_>>()
            .concat()
    }

    fn palette_bytes() -> Vec<u8> {
        [0xFF0000u32, 0x00FF00]
            .iter()
            .flat_map(|c| c.to_le_bytes())
            .collect()
    }

    /// The ABI parses clean input and the report says PASS with the measured
    /// cells/rects — this is the exact byte string the browser will read.
    #[test]
    fn clean_layer_reports_pass_with_pinned_bytes() {
        let cells = layer_bytes(
            16,
            &(5..9)
                .flat_map(|r| (5..9).map(move |c| (c, r, 0xFF0000u32)))
                .collect::<Vec<_>>(),
        );
        let (len, report) =
            gate_check_impl(&cells, 16, 16, 675, 2, 4, 0, &palette_bytes(), usize::MAX);
        let r = report.expect("cap was MAX; must be written");
        assert_eq!(r.len(), len);
        assert_eq!(r[0], 1, "pass");
        assert_eq!(u32::from_le_bytes(r[2..6].try_into().unwrap()), 16, "cells");
        assert_eq!(u32::from_le_bytes(r[6..10].try_into().unwrap()), 4, "rects");
        assert_eq!(
            u32::from_le_bytes(r[10..14].try_into().unwrap()),
            0,
            "findings"
        );
        assert_eq!(r.len(), 14, "header only — 14 bytes");
    }

    /// Every finding kind round-trips through the flat record with its fields
    /// intact — one layer constructed to trip every check at once.
    #[test]
    fn every_finding_serializes_with_fields() {
        let mut l = Layer::new(16);
        // off-palette block touching the top edge (margin) …
        for r in 0..4 {
            for c in 5..9 {
                l.set(c, r, Some(0xFE0101));
            }
        }
        // … a horizontal hairline …
        for c in 3..13 {
            l.set(c, 8, Some(0xFF0000));
        }
        // … and a dither window
        for r in 10..14 {
            for c in 2..6 {
                if (r + c) % 2 == 0 {
                    l.set(c, r, Some(0xFF0000));
                }
            }
        }
        let report = encode_report(&check(&l, &cfg()));
        let n = u32::from_le_bytes(report[10..14].try_into().unwrap()) as usize;
        assert!(
            n >= 4,
            "expected off-palette, margin, hairline, dither — got {} findings",
            n
        );
        let tags: Vec<u8> = report[14..]
            .chunks_exact(FINDING_BYTES)
            .map(|f| f[0])
            .collect();
        assert!(tags.contains(&3), "OffPalette missing: {:?}", tags);
        assert!(tags.contains(&6), "Hairline missing: {:?}", tags);
        assert!(tags.contains(&7), "Dither missing: {:?}", tags);
        assert!(tags.contains(&8), "Margin missing: {:?}", tags);
        // field-level: the off-palette record carries colour, count and nearest
        let op = report[14..]
            .chunks_exact(FINDING_BYTES)
            .find(|f| f[0] == 3)
            .unwrap();
        assert_eq!(u32::from_le_bytes(op[1..5].try_into().unwrap()), 0xFE0101);
        assert_eq!(u32::from_le_bytes(op[5..9].try_into().unwrap()), 16);
        assert_eq!(u32::from_le_bytes(op[9..13].try_into().unwrap()), 0xFF0000);
        // field-level: hairline carries axis and length
        let hl = report[14..]
            .chunks_exact(FINDING_BYTES)
            .find(|f| f[0] == 6)
            .unwrap();
        assert_eq!(hl[1], 0, "horizontal axis byte");
        assert_eq!(hl[4], 10, "run length");
        // field-level: margin is the top side, actual 0
        let mg = report[14..]
            .chunks_exact(FINDING_BYTES)
            .find(|f| f[0] == 8)
            .unwrap();
        assert_eq!(mg[1], 0, "top side byte");
        assert_eq!(mg[2], 0, "actual margin");
    }

    /// Tag bytes and the Rust enum must stay in lockstep — if the enum gains a
    /// variant, this refuses to compile until the ABI grows with it.
    #[test]
    fn every_enum_variant_has_a_tag() {
        let all: Vec<Finding> = vec![
            Finding::GridMismatch {
                expected: 1,
                found: 2,
            },
            Finding::Empty,
            Finding::OffPalette {
                color: 1,
                cells: 1,
                nearest: 2,
            },
            Finding::OutOfBounds { col: 1, row: 2 },
            Finding::TooManyRects { count: 1, limit: 2 },
            Finding::Hairline {
                axis: Axis::Horizontal,
                start_col: 1,
                start_row: 2,
                len: 3,
            },
            Finding::Hairline {
                axis: Axis::Vertical,
                start_col: 1,
                start_row: 2,
                len: 3,
            },
            Finding::Dither {
                col: 1,
                row: 2,
                extent: 4,
            },
            Finding::Margin {
                side: Side::Top,
                actual: 1,
                required: 2,
            },
            Finding::Margin {
                side: Side::Bottom,
                actual: 1,
                required: 2,
            },
            Finding::Margin {
                side: Side::Left,
                actual: 1,
                required: 2,
            },
            Finding::Margin {
                side: Side::Right,
                actual: 1,
                required: 2,
            },
        ];
        for f in all {
            let r = encode_report(&inscription_gate::Verdict {
                pass: false,
                findings: vec![f.clone()],
                cells: 1,
                rects: 1,
            });
            assert_eq!(r.len(), 14 + FINDING_BYTES);
            assert!(r[14] >= 1 && r[14] <= 8, "tag out of range for {:?}", f);
        }
    }

    /// The overflow contract: too-small capacity writes nothing and still
    /// returns the needed size, so the caller can retry — never a torn report.
    #[test]
    fn insufficient_capacity_returns_needed_length_unwritten() {
        let cells = layer_bytes(
            16,
            &(5..9)
                .flat_map(|r| (5..9).map(move |c| (c, r, 0xFF0000u32)))
                .collect::<Vec<_>>(),
        );
        let (len, report) = gate_check_impl(&cells, 16, 16, 675, 2, 4, 0, &palette_bytes(), 4);
        assert!(len > 4);
        assert!(report.is_none(), "must not write when cap < len");
    }

    /// GridMismatch must be reachable THROUGH THE ABI: layer grid and config
    /// grid are separate parameters. v1 of this shim reused one value for both,
    /// which made the finding impossible to produce — caught by the surface's
    /// self-test on 2026-08-16, and this test keeps it caught.
    #[test]
    fn grid_mismatch_is_reachable_through_the_abi() {
        let cells = layer_bytes(16, &[(5, 5, 0xFF0000)]);
        let (_, report) =
            gate_check_impl(&cells, 16, 48, 675, 2, 4, 0, &palette_bytes(), usize::MAX);
        let r = report.unwrap();
        assert_eq!(r[0], 0, "fail");
        let n = u32::from_le_bytes(r[10..14].try_into().unwrap()) as usize;
        assert!(n >= 1);
        let first = &r[14..30];
        assert_eq!(first[0], 1, "tag 1 = GridMismatch");
        assert_eq!(first[1], 48, "expected = cfg grid");
        assert_eq!(first[2], 16, "found = layer grid");
    }

    /// Empty palette skips the palette check (core semantics) — the ABI passes
    /// a zero-length slice through unchanged.
    #[test]
    fn zero_length_palette_disables_palette_check() {
        let cells = layer_bytes(16, &[(5, 5, 0x123456)]);
        let (_, report) = gate_check_impl(&cells, 16, 16, 675, 2, 4, 0, &[], usize::MAX);
        let r = report.unwrap();
        assert_eq!(r[0], 1, "pass — no palette, no OffPalette finding");
    }
}
