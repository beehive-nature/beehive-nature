//! Mechanical validation gate for inscription trait layers.
//! SPDX-License-Identifier: AGPL-3.0-only
//!
//! Every check here exists because something was MEASURED, not because it seemed prudent.
//! Receipts: `docs/SPEC-INSCRIPTION-COMPAT-1.md` §4, `docs/receipts/panelfit.js`.
//!
//! Two jobs, one implementation:
//!   1. the Studio's quality control, run before a trait is accepted
//!   2. the compute market's settlement rule — a provider whose output fails the gate
//!      does not get paid, which is why pixel-art generation is verifiable in a way
//!      LLM inference is not
//!
//! The chain validates NOTHING. `setFile` performs no bounds checks, stores out-of-range
//! rects silently, and the viewport clips them — data accepted, art lost, no revert. And
//! ownership is renounced after deploy. So this is the only place a mistake can be caught.

#![forbid(unsafe_code)]

extern crate alloc;
use alloc::{vec, vec::Vec};

/// Hex lattice orientation. MEASURED: flat-top column pitch is 1.5R against pointy-top's
/// sqrt(3)R, so flat-top fits ~15% larger cells AND makes a square grid portrait (1.156)
/// rather than landscape (0.864). On a 380x520 panel that is the difference between the
/// art filling 380x440 and 380x328.
///
/// It also decides WHICH features shear: flat-top offsets columns and therefore punishes
/// HORIZONTAL runs; pointy-top offsets rows and punishes VERTICAL ones.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Orientation {
    FlatTop,
    PointyTop,
}

impl Orientation {
    /// The axis along which a 1-cell run shears into a zigzag.
    fn shear_axis(self) -> Axis {
        match self {
            Orientation::FlatTop => Axis::Horizontal,
            Orientation::PointyTop => Axis::Vertical,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Axis {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone)]
pub struct GateConfig {
    /// Grid edge in cells. A compile-time constant on-chain — frozen at deploy.
    pub grid: u8,
    /// The locked palette, 0xRRGGBB. Every collection shares ONE across all traits:
    /// measured, all seven reference pieces use the same 17 colours. Drift breaks both
    /// the style anchor and the palette-index encoding.
    pub palette: Vec<u32>,
    /// Rects per transaction. MEASURED at 675 by binary search against the 2^24 gas
    /// transaction cap (25,226 gas/rect marginal). 676 over-caps.
    pub max_rects: usize,
    /// Empty cells required at each edge. A 384px render on a 380px panel clips 2px per
    /// side; the tightest reference piece had exactly 2 to spare.
    pub min_margin: u8,
    /// The longest 1-cell run permitted along the shear axis before it reads as a zigzag.
    pub max_hairline: u8,
    pub orientation: Orientation,
}

impl Default for GateConfig {
    fn default() -> Self {
        Self {
            grid: 48,
            palette: Vec::new(),
            max_rects: 675,
            min_margin: 2,
            max_hairline: 6,
            orientation: Orientation::FlatTop,
        }
    }
}

/// A cell grid. `None` is transparent — traits are SPARSE layers, not full frames.
#[derive(Debug, Clone)]
pub struct Layer {
    pub grid: u8,
    pub cells: Vec<Option<u32>>,
}

impl Layer {
    pub fn new(grid: u8) -> Self {
        Self {
            grid,
            cells: vec![None; grid as usize * grid as usize],
        }
    }
    #[inline]
    pub fn get(&self, col: u8, row: u8) -> Option<u32> {
        if col >= self.grid || row >= self.grid {
            return None;
        }
        self.cells[row as usize * self.grid as usize + col as usize]
    }
    #[inline]
    pub fn set(&mut self, col: u8, row: u8, c: Option<u32>) {
        if col < self.grid && row < self.grid {
            let i = row as usize * self.grid as usize + col as usize;
            self.cells[i] = c;
        }
    }
    pub fn filled(&self) -> usize {
        self.cells.iter().filter(|c| c.is_some()).count()
    }
}

/// Findings carry a FIX where one is mechanical. The artist should meet this gate only
/// when a human judgement is genuinely required; everything else the tooling answers.
#[derive(Debug, Clone, PartialEq)]
pub enum Finding {
    GridMismatch {
        expected: u8,
        found: u8,
    },
    Empty,
    OffPalette {
        color: u32,
        cells: usize,
        nearest: u32,
    },
    OutOfBounds {
        col: u8,
        row: u8,
    },
    TooManyRects {
        count: usize,
        limit: usize,
    },
    /// A run of single-cell thickness along the shear axis. MEASURED: on a flat-top
    /// lattice a long horizontal 1px line becomes a zigzag chain.
    Hairline {
        axis: Axis,
        start_col: u8,
        start_row: u8,
        len: u8,
    },
    /// Alternating filled/empty on both axes. MEASURED: checkerboard is DESTROYED by the
    /// lattice change, scattering into unrelated dots.
    Dither {
        col: u8,
        row: u8,
        extent: u8,
    },
    Margin {
        side: Side,
        actual: u8,
        required: u8,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Top,
    Bottom,
    Left,
    Right,
}

impl Finding {
    /// True when the Studio can repair this without asking the artist.
    pub fn auto_fixable(&self) -> bool {
        matches!(
            self,
            Finding::OffPalette { .. } | Finding::OutOfBounds { .. }
        )
    }
    pub fn fix_hint(&self) -> &'static str {
        match self {
            Finding::OffPalette { .. } => "quantise to the nearest locked colour",
            Finding::OutOfBounds { .. } => "clip or translate into the grid",
            Finding::Hairline { .. } => "thicken to 2 cells, angle it, or break it into beads",
            Finding::Dither { .. } => {
                "replace with a solid fill; dithering cannot survive the lattice"
            }
            Finding::TooManyRects { .. } => {
                "merge vertically, or simplify — one trait must fit one transaction"
            }
            Finding::Margin { .. } => "inset the artwork; the device clips the outer cells",
            Finding::GridMismatch { .. } => "re-author at the collection's grid",
            Finding::Empty => "layer contains no cells",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Verdict {
    pub pass: bool,
    pub findings: Vec<Finding>,
    pub cells: usize,
    /// Rect count after horizontal run-length encoding — what actually goes on-chain.
    pub rects: usize,
}

/// Horizontal run-length encode. This is what the on-chain format stores, so the rect
/// count that matters is the ENCODED one, never the cell count.
pub fn rle_rects(layer: &Layer) -> usize {
    let mut n = 0usize;
    for row in 0..layer.grid {
        let mut col = 0u8;
        while col < layer.grid {
            match layer.get(col, row) {
                None => {
                    col += 1;
                }
                Some(c) => {
                    n += 1;
                    while col < layer.grid && layer.get(col, row) == Some(c) {
                        col += 1;
                    }
                }
            }
        }
    }
    n
}

fn nearest(palette: &[u32], c: u32) -> u32 {
    let (r, g, b) = (
        (c >> 16 & 255) as i32,
        (c >> 8 & 255) as i32,
        (c & 255) as i32,
    );
    let mut best = c;
    let mut bd = i32::MAX;
    for &p in palette {
        let (pr, pg, pb) = (
            (p >> 16 & 255) as i32,
            (p >> 8 & 255) as i32,
            (p & 255) as i32,
        );
        // Weighted to rough luminance sensitivity; exact metric matters less than
        // determinism, and this is deterministic.
        let d = 3 * (r - pr).pow(2) + 6 * (g - pg).pow(2) + (b - pb).pow(2);
        if d < bd {
            bd = d;
            best = p;
        }
    }
    best
}

pub fn check(layer: &Layer, cfg: &GateConfig) -> Verdict {
    let mut f = Vec::new();

    if layer.grid != cfg.grid {
        f.push(Finding::GridMismatch {
            expected: cfg.grid,
            found: layer.grid,
        });
    }
    let cells = layer.filled();
    if cells == 0 {
        f.push(Finding::Empty);
    }

    // Palette. Report each offending colour once, with its cell count and the fix.
    if !cfg.palette.is_empty() {
        let mut seen: Vec<(u32, usize)> = Vec::new();
        for c in layer.cells.iter().flatten() {
            if cfg.palette.contains(c) {
                continue;
            }
            match seen.iter_mut().find(|(k, _)| k == c) {
                Some((_, n)) => *n += 1,
                None => seen.push((*c, 1)),
            }
        }
        for (color, n) in seen {
            f.push(Finding::OffPalette {
                color,
                cells: n,
                nearest: nearest(&cfg.palette, color),
            });
        }
    }

    // Bounds. The chain does not check this and the viewport silently clips.
    for row in 0..layer.grid {
        for col in 0..layer.grid {
            if layer.get(col, row).is_some() && (col >= cfg.grid || row >= cfg.grid) {
                f.push(Finding::OutOfBounds { col, row });
            }
        }
    }

    // One trait, one transaction.
    let rects = rle_rects(layer);
    if rects > cfg.max_rects {
        f.push(Finding::TooManyRects {
            count: rects,
            limit: cfg.max_rects,
        });
    }

    // Hairlines along the shear axis only — the other axis is safe, and warning about a
    // safe feature trains the artist to ignore the gate.
    match cfg.orientation.shear_axis() {
        Axis::Horizontal => {
            for row in 0..layer.grid {
                let mut run = 0u8;
                let mut start = 0u8;
                for col in 0..=layer.grid {
                    let thin = col < layer.grid
                        && layer.get(col, row).is_some()
                        && layer.get(col, row.wrapping_sub(1)).is_none()
                        && layer.get(col, row + 1).is_none();
                    if thin {
                        if run == 0 {
                            start = col;
                        }
                        run = run.saturating_add(1);
                    } else {
                        if run > cfg.max_hairline {
                            f.push(Finding::Hairline {
                                axis: Axis::Horizontal,
                                start_col: start,
                                start_row: row,
                                len: run,
                            });
                        }
                        run = 0;
                    }
                }
            }
        }
        Axis::Vertical => {
            for col in 0..layer.grid {
                let mut run = 0u8;
                let mut start = 0u8;
                for row in 0..=layer.grid {
                    let thin = row < layer.grid
                        && layer.get(col, row).is_some()
                        && layer.get(col.wrapping_sub(1), row).is_none()
                        && layer.get(col + 1, row).is_none();
                    if thin {
                        if run == 0 {
                            start = row;
                        }
                        run = run.saturating_add(1);
                    } else {
                        if run > cfg.max_hairline {
                            f.push(Finding::Hairline {
                                axis: Axis::Vertical,
                                start_col: col,
                                start_row: start,
                                len: run,
                            });
                        }
                        run = 0;
                    }
                }
            }
        }
    }

    // Dither: a 4x4 window alternating on both axes. Report once per window origin.
    for row in 0..layer.grid.saturating_sub(3) {
        for col in 0..layer.grid.saturating_sub(3) {
            let mut checker = true;
            for dr in 0..4u8 {
                for dc in 0..4u8 {
                    let want_filled = (dr + dc) % 2 == 0;
                    if layer.get(col + dc, row + dr).is_some() != want_filled {
                        checker = false;
                    }
                }
            }
            if checker {
                f.push(Finding::Dither {
                    col,
                    row,
                    extent: 4,
                });
            }
        }
    }

    // Margin. Only meaningful when something is drawn.
    if cells > 0 {
        let (mut top, mut bottom, mut left, mut right) = (0u8, 0u8, 0u8, 0u8);
        'top: for row in 0..layer.grid {
            for col in 0..layer.grid {
                if layer.get(col, row).is_some() {
                    break 'top;
                }
            }
            top += 1;
        }
        'bot: for row in (0..layer.grid).rev() {
            for col in 0..layer.grid {
                if layer.get(col, row).is_some() {
                    break 'bot;
                }
            }
            bottom += 1;
        }
        'left: for col in 0..layer.grid {
            for row in 0..layer.grid {
                if layer.get(col, row).is_some() {
                    break 'left;
                }
            }
            left += 1;
        }
        'right: for col in (0..layer.grid).rev() {
            for row in 0..layer.grid {
                if layer.get(col, row).is_some() {
                    break 'right;
                }
            }
            right += 1;
        }
        for (side, actual) in [
            (Side::Top, top),
            (Side::Bottom, bottom),
            (Side::Left, left),
            (Side::Right, right),
        ] {
            if actual < cfg.min_margin {
                f.push(Finding::Margin {
                    side,
                    actual,
                    required: cfg.min_margin,
                });
            }
        }
    }

    Verdict {
        pass: f.is_empty(),
        findings: f,
        cells,
        rects,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn clean_layer_passes() {
        let mut l = Layer::new(16);
        for r in 5..9 {
            for c in 5..9 {
                l.set(c, r, Some(0xFF0000));
            }
        }
        let v = check(&l, &cfg());
        assert!(v.pass, "{:?}", v.findings);
        assert_eq!(v.cells, 16);
        assert_eq!(v.rects, 4); // four rows, one run each
    }

    #[test]
    fn off_palette_is_caught_with_a_nearest() {
        let mut l = Layer::new(16);
        for r in 5..9 {
            for c in 5..9 {
                l.set(c, r, Some(0xFE0101));
            }
        }
        let v = check(&l, &cfg());
        match v
            .findings
            .iter()
            .find(|f| matches!(f, Finding::OffPalette { .. }))
        {
            Some(Finding::OffPalette { cells, nearest, .. }) => {
                assert_eq!(*cells, 16);
                assert_eq!(*nearest, 0xFF0000);
            }
            _ => panic!("expected OffPalette, got {:?}", v.findings),
        }
    }

    #[test]
    fn off_palette_is_auto_fixable() {
        let f = Finding::OffPalette {
            color: 1,
            cells: 1,
            nearest: 2,
        };
        assert!(f.auto_fixable());
        assert!(!Finding::Dither {
            col: 0,
            row: 0,
            extent: 4
        }
        .auto_fixable());
    }

    #[test]
    fn horizontal_hairline_caught_on_flat_top() {
        let mut l = Layer::new(16);
        for c in 3..13 {
            l.set(c, 8, Some(0xFF0000));
        } // 10-long 1-cell run
        let v = check(&l, &cfg());
        assert!(
            v.findings.iter().any(
                |f| matches!(f, Finding::Hairline { axis: Axis::Horizontal, len, .. } if *len == 10)
            ),
            "{:?}",
            v.findings
        );
    }

    /// The same line on a POINTY-TOP lattice is safe — it shears the other axis.
    /// Warning about a safe feature trains artists to ignore the gate.
    #[test]
    fn horizontal_hairline_is_safe_on_pointy_top() {
        let mut l = Layer::new(16);
        for c in 3..13 {
            l.set(c, 8, Some(0xFF0000));
        }
        let mut c2 = cfg();
        c2.orientation = Orientation::PointyTop;
        let v = check(&l, &c2);
        assert!(
            !v.findings
                .iter()
                .any(|f| matches!(f, Finding::Hairline { .. })),
            "{:?}",
            v.findings
        );
    }

    #[test]
    fn vertical_hairline_caught_on_pointy_top() {
        let mut l = Layer::new(16);
        for r in 3..13 {
            l.set(8, r, Some(0xFF0000));
        }
        let mut c2 = cfg();
        c2.orientation = Orientation::PointyTop;
        let v = check(&l, &c2);
        assert!(
            v.findings.iter().any(
                |f| matches!(f, Finding::Hairline { axis: Axis::Vertical, len, .. } if *len == 10)
            ),
            "{:?}",
            v.findings
        );
    }

    #[test]
    fn dither_is_caught() {
        let mut l = Layer::new(16);
        for r in 4..12 {
            for c in 4..12 {
                if (r + c) % 2 == 0 {
                    l.set(c, r, Some(0xFF0000));
                }
            }
        }
        let v = check(&l, &cfg());
        assert!(
            v.findings
                .iter()
                .any(|f| matches!(f, Finding::Dither { .. })),
            "{:?}",
            v.findings
        );
    }

    #[test]
    fn margin_violation_caught_per_side() {
        let mut l = Layer::new(16);
        for r in 0..4 {
            for c in 5..9 {
                l.set(c, r, Some(0xFF0000));
            }
        } // touches the top edge
        let v = check(&l, &cfg());
        assert!(
            v.findings.iter().any(|f| matches!(
                f,
                Finding::Margin {
                    side: Side::Top,
                    actual: 0,
                    ..
                }
            )),
            "{:?}",
            v.findings
        );
    }

    #[test]
    fn rect_budget_is_the_encoded_count_not_the_cell_count() {
        let mut l = Layer::new(16);
        for r in 2..14 {
            for c in 2..14 {
                l.set(c, r, Some(0xFF0000));
            }
        }
        let v = check(&l, &cfg());
        assert_eq!(v.cells, 144);
        assert_eq!(v.rects, 12); // 12 rows, one run each — 12x cheaper than cells
        assert!(v.pass, "{:?}", v.findings);
    }

    #[test]
    fn over_budget_is_caught() {
        let mut l = Layer::new(16);
        // alternate colours so no run merges: 16 cols x 12 rows = 192 rects
        for r in 2..14 {
            for c in 2..14 {
                l.set(c, r, Some(if c % 2 == 0 { 0xFF0000 } else { 0x00FF00 }));
            }
        }
        let mut c2 = cfg();
        c2.max_rects = 100;
        let v = check(&l, &c2);
        assert!(
            v.findings
                .iter()
                .any(|f| matches!(f, Finding::TooManyRects { .. })),
            "{:?}",
            v.findings
        );
    }

    #[test]
    fn empty_layer_reports_empty_not_pass() {
        let l = Layer::new(16);
        let v = check(&l, &cfg());
        assert!(!v.pass);
        assert!(v.findings.contains(&Finding::Empty));
    }
}
