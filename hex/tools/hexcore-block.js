<script>/* ── HEXCORE — the hexagonal rendering path, lane/hex ───────────────────
 * Five dependency-free modules (hexcoords · hexresample · hexmorph · hexdither ·
 * hexrender), inlined under the same one-file-zero-calls law as the engine above.
 * Sources + tests + provenance: /hex in the repo. Diffusion coefficients:
 * Jodoin & Ostromoukhov, Halftoning Over a Hexagonal Grid, Proc. SPIE 5008 (2003),
 * DOI 10.1117/12.473230. Ordered dither: void-and-cluster hex blue-noise mask.
 * Regenerate: node hex/tools/build.mjs && node hex/tools/inline-hexcore.mjs */
"use strict";
var HexCore = (() => {

// ── hexcoords ──────────────────────────────────────────────
// hexcoords.ts — axial (q,r) coordinate math for the hexagonal rendering path.
// Pure functions. No DOM, no dependencies. Plain TypeScript.
//
// LAW: hex is a MODE alongside square, never a replacement.
//
// Conventions (Red Blob Games axial system, size = circumradius):
//   pointy-top:  x = size * (sqrt(3)*q + (sqrt(3)/2)*r),  y = size * (3/2 * r)
//   flat-top:    x = size * (3/2 * q),                    y = size * ((sqrt(3)/2)*q + sqrt(3)*r)
// Cube coordinates: s = -q - r; the three always sum to zero.
const SQRT3 = Math.sqrt(3);
/** Constant 6-neighbour axial table — no row-parity branching, ever. */
const HEX_NEIGHBOURS = [
    [+1, 0],
    [+1, -1],
    [0, -1],
    [-1, 0],
    [-1, +1],
    [0, +1],
];
/** Stable string key for a cell — the shared key format across the hex modules. */
function axialKey(q, r) {
    return q + "," + r;
}
/** Centre of hex (q,r) in pixel space. */
function hexToPixel(q, r, size, orientation) {
    if (orientation === "pointy") {
        return {
            x: size * (SQRT3 * q + (SQRT3 / 2) * r),
            y: size * (3 / 2) * r,
        };
    }
    return {
        x: size * (3 / 2) * q,
        y: size * ((SQRT3 / 2) * q + SQRT3 * r),
    };
}
/** Fractional axial coordinates of a pixel — round with cubeRound for the cell. */
function pixelToHexFractional(x, y, size, orientation) {
    if (orientation === "pointy") {
        return {
            q: ((SQRT3 / 3) * x - (1 / 3) * y) / size,
            r: ((2 / 3) * y) / size,
        };
    }
    return {
        q: ((2 / 3) * x) / size,
        r: ((SQRT3 / 3) * y - (1 / 3) * x) / size,
    };
}
/**
 * Cube rounding: round q, r, s independently, then correct whichever coordinate
 * moved furthest from its fractional value so q + r + s = 0 still holds.
 */
function cubeRound(qf, rf) {
    const sf = -qf - rf;
    let q = Math.round(qf);
    let r = Math.round(rf);
    let s = Math.round(sf);
    const dq = Math.abs(q - qf);
    const dr = Math.abs(r - rf);
    const ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) {
        q = -r - s;
    }
    else if (dr > ds) {
        r = -q - s;
    }
    else {
        s = -q - r;
    }
    return { q, r };
}
/** Pixel to the hex cell containing it. */
function pixelToHex(x, y, size, orientation) {
    const f = pixelToHexFractional(x, y, size, orientation);
    return cubeRound(f.q, f.r);
}
/** Distance in cell steps (cube distance). Neighbours are distance 1. */
function hexDistance(qa, ra, qb, rb) {
    const dq = qa - qb;
    const dr = ra - rb;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
}
/**
 * Axial <-> offset lives ONLY at the array storage boundary — geometry code
 * above never branches on row parity. Pointy-top uses odd-r rows, flat-top
 * uses odd-q columns.
 */
function axialToOffset(q, r, orientation) {
    if (orientation === "pointy") {
        // odd-r: odd rows shifted right by half a step
        return { col: q + ((r - (r & 1)) >> 1), row: r };
    }
    // odd-q: odd columns shifted down by half a step
    return { col: q, row: r + ((q - (q & 1)) >> 1) };
}
function offsetToAxial(col, row, orientation) {
    if (orientation === "pointy") {
        return { q: col - ((row - (row & 1)) >> 1), r: row };
    }
    return { q: col, r: row - ((col - (col & 1)) >> 1) };
}
/** The six corners of a unit hex centred at the origin, winding clockwise in canvas space. */
function hexCorners(size, orientation) {
    const out = [];
    for (let k = 0; k < 6; k++) {
        const angleDeg = orientation === "pointy" ? 60 * k - 30 : 60 * k;
        const a = (angleDeg * Math.PI) / 180;
        out.push({ x: size * Math.cos(a), y: size * Math.sin(a) });
    }
    return out;
}
/** Bounding box of the six corners (min x, min y, max x, max y). */
function hexBounds(size, orientation) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of hexCorners(size, orientation)) {
        if (c.x < minX)
            minX = c.x;
        if (c.y < minY)
            minY = c.y;
        if (c.x > maxX)
            maxX = c.x;
        if (c.y > maxY)
            maxY = c.y;
    }
    return [minX, minY, maxX, maxY];
}

// ── hexresample ──────────────────────────────────────────────
// hexresample.ts — square raster -> hex cells.
// Pure functions. No DOM, no dependencies.
//
// AREA-WEIGHTED, not centre point-sampling: the source is supersampled and
// every sub-sample whose centre lands inside a hex (via pixel->hex rounding)
// contributes to that hex's average. Averaging happens in Oklab (same
// constants as the estate colorUtils — no drift), and the per-cell averages
// are handed onward to the EXISTING quantizer UNCHANGED: it is
// lattice-agnostic and is not forked here.

function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
}
/** sRGB 0-255 -> Oklab (estate constants). */
function srgbToOklab(r, g, b) {
    const rr = srgbToLinear(r);
    const gg = srgbToLinear(g);
    const bb = srgbToLinear(b);
    const l = 0.4122214708 * rr + 0.5363325363 * gg + 0.0514459929 * bb;
    const m = 0.2119034982 * rr + 0.6806995451 * gg + 0.1073969566 * bb;
    const s = 0.0883024619 * rr + 0.2817188501 * gg + 0.6299787005 * bb;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    return {
        L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    };
}
/** Oklab -> sRGB 0-255 ints (estate constants). */
function oklabToSrgb(ok) {
    const l_ = ok.L + 0.3963377774 * ok.a + 0.2158037573 * ok.b;
    const m_ = ok.L - 0.1055613458 * ok.a - 0.0638541728 * ok.b;
    const s_ = ok.L - 0.0894841775 * ok.a - 1.291485548 * ok.b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    return {
        r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    };
}
/**
 * Supersample the source raster and average every sub-sample into the hex
 * cell whose centre-region contains it. Cells emerge only where samples
 * landed — the grid is discovered, not assumed.
 */
function resampleToHex(img, opts) {
    const ss = opts.supersample ?? 3;
    const { size, orientation } = opts;
    const acc = new Map();
    const step = 1 / ss;
    const d = img.data;
    for (let py = 0; py < img.height; py++) {
        for (let px = 0; px < img.width; px++) {
            const i = (py * img.width + px) * 4;
            const alpha = d[i + 3];
            if (alpha < 16)
                continue; // fully-transparent sources carry no tone
            const ok = srgbToOklab(d[i], d[i + 1], d[i + 2]);
            for (let sy = 0; sy < ss; sy++) {
                for (let sx = 0; sx < ss; sx++) {
                    const x = px + (sx + 0.5) * step;
                    const y = py + (sy + 0.5) * step;
                    const cell = pixelToHex(x, y, size, orientation);
                    const k = axialKey(cell.q, cell.r);
                    let e = acc.get(k);
                    if (!e) {
                        e = { q: cell.q, r: cell.r, L: 0, a: 0, b: 0, n: 0 };
                        acc.set(k, e);
                    }
                    e.L += ok.L;
                    e.a += ok.a;
                    e.b += ok.b;
                    e.n++;
                }
            }
        }
    }
    const cells = [];
    for (const e of acc.values()) {
        cells.push({
            q: e.q,
            r: e.r,
            key: axialKey(e.q, e.r),
            ok: { L: e.L / e.n, a: e.a / e.n, b: e.b / e.n },
            weight: e.n,
        });
    }
    cells.sort((A, B) => (A.r - B.r) || (A.q - B.q));
    return cells;
}

// ── hexmorph ──────────────────────────────────────────────
// hexmorph.ts — outline and flood fill on the hex lattice.
// Pure functions. No DOM, no dependencies.
//
// dilate: cell ON if it or any of its 6 neighbours is ON. erode: the inverse.
// 1-cell outline = dilate(content) AND NOT content. Flood fill walks the same
// constant 6-neighbour table. There is NO 4-connected vs 8-connected split on
// hexes — one correct connectivity — so the square build's sharp/rounded
// distinction collapses here.
//
// Storage is a rectangular offset array (odd-r for pointy-top, odd-q for
// flat-top); axial<->offset conversion happens only at this boundary, so the
// morphology code never branches on row parity.

function makeGrid(cols, rows, orientation) {
    return { cols, rows, orientation, cells: new Uint8Array(cols * rows) };
}
function inBounds(g, col, row) {
    return col >= 0 && row >= 0 && col < g.cols && row < g.rows;
}
/** The 6 neighbours of an offset cell, as offset indices (bounds-checked). */
function offsetNeighbours(g, col, row) {
    const a = offsetToAxial(col, row, g.orientation);
    const out = [];
    for (const [dq, dr] of HEX_NEIGHBOURS) {
        const o = axialToOffset(a.q + dq, a.r + dr, g.orientation);
        if (inBounds(g, o.col, o.row))
            out.push(o.row * g.cols + o.col);
    }
    return out;
}
/** Cell ON if it or any of its 6 neighbours is ON. */
function dilate(g) {
    const out = makeGrid(g.cols, g.rows, g.orientation);
    for (let row = 0; row < g.rows; row++) {
        for (let col = 0; col < g.cols; col++) {
            const i = row * g.cols + col;
            if (g.cells[i]) {
                out.cells[i] = 1;
                continue;
            }
            for (const n of offsetNeighbours(g, col, row)) {
                if (g.cells[n]) {
                    out.cells[i] = 1;
                    break;
                }
            }
        }
    }
    return out;
}
/** The inverse: cell ON only if it and all 6 neighbours are ON. */
function erode(g) {
    const out = makeGrid(g.cols, g.rows, g.orientation);
    for (let row = 0; row < g.rows; row++) {
        for (let col = 0; col < g.cols; col++) {
            const i = row * g.cols + col;
            if (!g.cells[i])
                continue;
            let all = true;
            for (const n of offsetNeighbours(g, col, row)) {
                if (!g.cells[n]) {
                    all = false;
                    break;
                }
            }
            out.cells[i] = all ? 1 : 0;
        }
    }
    return out;
}
/** 1-cell outline: dilate(content) AND NOT content. */
function outline(g) {
    const d = dilate(g);
    const out = makeGrid(g.cols, g.rows, g.orientation);
    for (let i = 0; i < out.cells.length; i++)
        out.cells[i] = d.cells[i] && !g.cells[i] ? 1 : 0;
    return out;
}
/**
 * Flood fill over the single hex connectivity. Seeds from (col,row); a cell
 * joins the component when its stored value equals the seed's value (or the
 * predicate accepts it). Returns the visited mask as a grid.
 */
function floodFill(g, col, row, match) {
    const visited = makeGrid(g.cols, g.rows, g.orientation);
    if (!inBounds(g, col, row))
        return visited;
    const seedIdx = row * g.cols + col;
    const seedVal = g.cells[seedIdx];
    const accepts = match ?? ((v) => v === seedVal);
    if (!accepts(seedVal))
        return visited;
    const stack = [seedIdx];
    visited.cells[seedIdx] = 1;
    while (stack.length) {
        const i = stack.pop();
        const c = i % g.cols;
        const r = (i - c) / g.cols;
        for (const n of offsetNeighbours(g, c, r)) {
            if (!visited.cells[n] && accepts(g.cells[n])) {
                visited.cells[n] = 1;
                stack.push(n);
            }
        }
    }
    return visited;
}

// ── hexdither ──────────────────────────────────────────────
// hexdither.ts — error diffusion and ordered dithering on the hex lattice.
// Pure functions. No DOM, no dependencies. Full-precision float Oklab buffers.
//
// ── METHOD 1: tone-dependent error diffusion ────────────────────────────────
// Structure per Jodoin & Ostromoukhov, "Halftoning Over a Hexagonal Grid,"
// Proc. SPIE 5008 (2003), DOI 10.1117/12.473230:
//   - serpentine scan, top to bottom, alternating direction each line;
//   - in that scan each cell has exactly 3 DOWNSTREAM neighbours: forward in
//     the current line (d10) and two in the next line (d-11 and d01);
//   - tone-dependent coefficient table over levels 0-127, mirrored for
//     128-255, each triple normalized to sum to 1;
//   - on mirrored (right-to-left) lines, the forward direction mirrors AND
//     the two below-neighbour targets swap.
// The quantizer is passed in as a callback and used UNCHANGED — it is
// lattice-agnostic and is not forked here.
//
// PROVENANCE OF THE COEFFICIENT TABLE: Jodoin & Ostromoukhov, "Halftoning Over
// a Hexagonal Grid," Proc. SPIE 5008 (2003), DOI 10.1117/12.473230 — the
// paper's tone-dependent table, 128 rows over levels 0-127 (levels 128-255
// mirrored by symmetry via toneIndex), each row (d10, d-11, d01) as integers
// summing to ~10000, renormalized here to sum to 1.
//
// ── METHOD 2: ordered dither ─────────────────────────────────────────────────
// There is NO native hex Bayer. A void-and-cluster (Ulichney 1993) blue-noise
// threshold mask was generated OFFLINE over hex axial coordinates (64x64
// tileable rhombus patch, sigma 1.5, deterministic seed 0x6a0dbeef, converged)
// by tools/gen-voidcluster.mjs and is baked in below as a constant.

// ── tone-dependent coefficient table ────────────────────────────────────────
const JODOIN_PROVENANCE = "Jodoin & Ostromoukhov, Halftoning Over a Hexagonal Grid, Proc. SPIE 5008 (2003), DOI 10.1117/12.473230 — verified 128-row tone-dependent table (d10, d-11, d01), renormalized to sum 1 per row; levels 128-255 mirrored";
/**
 * The paper's verified table: 128 rows x (d10, d-11, d01), integers summing
 * to ~10000 per row. Swappable constant — replace this array (or pass custom
 * weights to diffuseHexError) without touching the algorithm.
 */
const JODOIN_TABLE_INTS = [
    6691, 0, 3309, 6691, 0, 3309, 6576, 316, 3108, 6462, 629, 2909, 6348, 940, 2711, 6236, 1248, 2516,
    6124, 1554, 2322, 6014, 1857, 2129, 5904, 2157, 1938, 5795, 2456, 1749, 5688, 2751, 1561, 5581, 3044,
    1375, 5474, 3335, 1190, 5369, 3624, 1007, 5265, 3910, 825, 5161, 4194, 645, 4682, 4237, 1081, 4303,
    4272, 1425, 3997, 4300, 1704, 3743, 4323, 1934, 3530, 4342, 2128, 3900, 4165, 1935, 4516, 3871, 1613,
    4375, 3722, 1904, 4214, 3551, 2236, 4027, 3354, 2619, 4000, 3779, 2221, 3972, 4224, 1804, 3943, 4689,
    1368, 3912, 5177, 911, 3879, 5690, 431, 3785, 5701, 514, 3693, 5712, 595, 3603, 5722, 675, 3514, 5733,
    753, 3509, 5694, 798, 3504, 5655, 841, 3499, 5618, 883, 3494, 5581, 925, 3489, 5545, 965, 3485, 5510,
    1005, 3480, 5476, 1044, 3476, 5442, 1082, 3471, 5409, 1120, 3399, 5139, 1462, 3333, 4891, 1776, 3272,
    4664, 2064, 3216, 4454, 2330, 3164, 4260, 2576, 3116, 4080, 2804, 3071, 3912, 3017, 3029, 3756, 3215,
    2990, 3610, 3400, 2954, 3473, 3574, 2919, 3344, 3737, 2887, 3223, 3890, 2856, 3109, 4034, 2827, 3002,
    4171, 2800, 2900, 4300, 2774, 2804, 4422, 3134, 3401, 3466, 3460, 3942, 2598, 3757, 4435, 1808, 4029,
    4886, 1086, 4278, 5300, 422, 4249, 5324, 427, 4220, 5347, 432, 4192, 5371, 437, 4163, 5395, 442, 4134,
    5418, 447, 4106, 5442, 452, 4077, 5465, 457, 4049, 5489, 462, 4020, 5512, 467, 3992, 5536, 472, 3964,
    5559, 477, 3936, 5582, 482, 3907, 5605, 487, 3879, 5628, 492, 3851, 5652, 497, 3823, 5675, 502, 3795,
    5698, 507, 3768, 5721, 512, 3740, 5744, 517, 3712, 5767, 521, 3684, 5789, 526, 3743, 5747, 510, 3802,
    5705, 493, 3860, 5663, 477, 3918, 5622, 461, 3975, 5580, 444, 4032, 5539, 428, 4089, 5498, 412, 4146,
    5458, 396, 4202, 5417, 381, 4258, 5377, 365, 4313, 5337, 349, 4369, 5298, 334, 4424, 5258, 318, 4478,
    5219, 303, 4532, 5180, 288, 4586, 5141, 273, 4640, 5103, 258, 4693, 5064, 243, 4746, 5026, 228, 4799,
    4988, 213, 4851, 4950, 198, 4904, 4913, 183, 4955, 4876, 169, 5007, 4839, 154, 5058, 4802, 140, 5109,
    4765, 126, 5160, 4729, 111, 5210, 4693, 97, 5260, 4657, 83, 5310, 4621, 69, 5360, 4585, 55, 5409, 4550,
    41, 5458, 4514, 27, 5507, 4479, 14, 5556, 4444, 0, 5506, 4403, 91, 5448, 4356, 196, 5380, 4299, 321,
    5299, 4232, 469, 5200, 4150, 650, 5077, 4048, 875, 4920, 3918, 1162,
];
/** 128 triples [wForward(d10), wBelow1(d-11), wBelow2(d01)], each summing to 1. */
const JODOIN_TRIPLES = normalizeTriples(JODOIN_TABLE_INTS);
function normalizeTriples(ints) {
    const t = new Float64Array(128 * 3);
    for (let i = 0; i < 128; i++) {
        const s = ints[i * 3] + ints[i * 3 + 1] + ints[i * 3 + 2];
        t[i * 3] = ints[i * 3] / s;
        t[i * 3 + 1] = ints[i * 3 + 1] / s;
        t[i * 3 + 2] = ints[i * 3 + 2] / s;
    }
    return t;
}
/** Tone level 0-255 of a diffused value -> table row 0-127 (mirrored). */
function toneIndex(ok) {
    const l = ok.L < 0 ? 0 : ok.L > 1 ? 1 : ok.L;
    const i = Math.round(l * 255);
    return i > 127 ? 255 - i : i;
}
// Downstream targets per orientation and scan direction. Entry layout:
// [dq, dr, weightSlot] with slot 0 = forward (d10), 1 = below-1 (d-11),
// 2 = below-2 (d01). Mirrored lines negate the forward step and swap the two
// below-neighbour targets, exactly as the brief specifies.
const DOWNSTREAM = {
    pointy: {
        normal: [
            [1, 0, 0],
            [-1, 1, 1],
            [0, 1, 2],
        ],
        mirrored: [
            [-1, 0, 0],
            [0, 1, 1],
            [-1, 1, 2],
        ],
    },
    flat: {
        normal: [
            [0, 1, 0],
            [1, 0, 1],
            [1, -1, 2],
        ],
        mirrored: [
            [0, -1, 0],
            [1, -1, 1],
            [1, 0, 2],
        ],
    },
};
/**
 * Serpentine hex error diffusion. `quantize` is the EXISTING quantizer,
 * invoked unchanged per cell; the error buffer keeps full float precision in
 * Oklab. Returns the chosen colour per axialKey.
 */
function diffuseHexError(cells, quantize, opts = {}) {
    const orientation = opts.orientation ?? "pointy";
    const weights = opts.weights ?? JODOIN_TRIPLES;
    // lines: pointy scans rows of constant r (ordered by q), flat scans
    // columns of constant q (ordered by r)
    const lines = new Map();
    for (const c of cells) {
        const k = orientation === "pointy" ? c.r : c.q;
        let line = lines.get(k);
        if (!line)
            lines.set(k, (line = []));
        line.push(c);
    }
    const sortedLines = [...lines.entries()].sort((A, B) => A[0] - B[0]);
    const has = new Set(cells.map((c) => axialKey(c.q, c.r)));
    const buf = new Map();
    const out = new Map();
    sortedLines.forEach(([lineKey, line], lineOrdinal) => {
        line.sort((A, B) => (orientation === "pointy" ? A.q - B.q : A.r - B.r));
        const order = lineOrdinal % 2 === 0 ? line : line.slice().reverse();
        const targets = DOWNSTREAM[orientation][lineOrdinal % 2 === 0 ? "normal" : "mirrored"];
        for (const cell of order) {
            const k = axialKey(cell.q, cell.r);
            const e = buf.get(k);
            const v = e ? { L: cell.ok.L + e[0], a: cell.ok.a + e[1], b: cell.ok.b + e[2] } : cell.ok;
            const chosen = quantize(v);
            out.set(k, chosen);
            const eL = v.L - chosen.L;
            const ea = v.a - chosen.a;
            const eb = v.b - chosen.b;
            const i = toneIndex(v);
            for (const [dq, dr, slot] of targets) {
                const w = weights[i * 3 + slot];
                if (w <= 1e-9)
                    continue;
                const tq = cell.q + dq;
                const tr = cell.r + dr;
                const tk = axialKey(tq, tr);
                if (!has.has(tk))
                    continue; // outside the grid: boundary error drops
                let t = buf.get(tk);
                if (!t)
                    buf.set(tk, (t = new Float64Array(3)));
                t[0] += eL * w;
                t[1] += ea * w;
                t[2] += eb * w;
            }
        }
    });
    return out;
}
// ── method 2: ordered dither on the baked hex blue-noise mask ────────────────
const MASK_SIDE = 64;
const MASK_CELLS = MASK_SIDE * MASK_SIDE;
/** base64(Uint16 ranks, row-major over r*MASK_SIDE+q) — generated offline, deterministic. */
const VOID_CLUSTER_HEX_64_B64 = "FwkPBJoFwQlQDm8AaATSCf4NTgf8BNsMBgG6CPwNmAB/DSAEygzzCgEI0AVLBwQK2AGKBhMMRg6fBOwFAg93CgkA3Q0tDzMBiA3UAucGUwLMA4cAlw72BKML/A8lAW8IHAKyD24JOQdSAN8F3QgIB0kCcAjqBXEKfgP+D1AB7g2TB7UMdQ+5A0EHHw2TBTsMIQF9CEcDGAb4C5QCAwraB48IzAYwBWIBtAMHDPsCLg/XDJAK/AjIBwwKPQHjC58GJgQ9C2cGggjFBcoJMQ2hCNsN5godB4IN9wWrCnsOlwMwDBgEYwLEDA8K1QEsDFsPyAP0DeYLXgLWCPwKJQYJA+4AgAgeAgkLSAnMAYcKaQawAvwOswmpB4EEzA6FBS8BUgNHDncJ/w41C8MArAgWBUsAeQLyA/oBag0lBVsD0wjyDPkBdwM9DicAwASdAaoHlwTEArIIIwBNBDwNaQeOBfcNmAbWCpgDRA6LBDcNeQlPAeYEGw0kD2IE8QHICZEOKAW5DVwG6gLYB2QO7ANSDSYLPwB1DZ4BOwuWBigN1Ao8DJwCHwcIDR0G+ge9CYwN/gVMC2cPygZNCWEOtQcCAYoPfQl8B/kKAA+GCzUGWQzPCe0OMAKJDFIJnAEkChgAywgxAccONwi/BowKPgDsB6YGsAmOAKwF3QdoDcUGaguKAewLCQ/FBA4IuwCxDwcJoATKBY8PDwjFA08JFwJ3DyMKAQBmBFcK4Q1tAUAEcgeJDnQIJwzJAOEKaAJTDHcFXAqsBH8M9wIhCasPgwOiAIEFIgvGBnAPNwNTBloL9QfRC9IExAduAQ0DaQVmDjoLHQSiDqwKrwwACCIAUANMCusDfAkNAccMjwaHCyEC+QbqCzoKhwK8DDEAeA6hBOYF8AcBCbwBbwU5A3MMwApmA4sB6AQbAxgPgAQKCOsG+g17AlMBowY5BSMBsg0nCFIOwgfYA14KAwUECBUP9QJMBGYNAAZEDBMP8QjxC8gCEgjKAWYHiAM5AuELvwTJDl0H4wWeCikOQQNwBdEJrw7NA0EBKw4EBdoPxgstB2AIjgNiDa4LiQ8dCPEGJw/6CDYNSwbJDO8JGQaOCw4A/gM4C74OWQhYDfMJKwe9CpkCIgzvAIoNvwG8C8EAyA1MCQACGQoIAAsL2QOCB4QBKAanDWQMSwneBm8P/AkKBscIBQ38BzcCAAkrDKwHdgD+DLYIiAcyBqEJLAObChMBewz9AXwGvwIYDjAAwAtmAucAqwnsD4EA5A0aAngPFA0aCdQF8gchAMsL3QMPAusFlQTeCB8GewmVDlkHiQWDDLwGng+YCMwClA2iBQMN2wk9D0wDdQX3ADQEGQ4nAU8MKgMsAH0LDgdpBG8CvwoUBe8CegwnC9kAog2bBhsEBw5GCuAOtQQUC/YJIQRtBi0FWQ7BAyMLvwiJBxwFNQpDA4ABJQyVA98EaA83DqwM5w5wC1gPkwN4DDcEdAI3CkUBnwNEBVEO2gZnCbMAywpzBBIArQuPCl8N9gjWAqEHwQqDDwIFvwAeDYcPXgh1DlQGog+9ATgENQhOAvQHNAkaBW4AvghKB0gB8Q97DX4KsgcADAMHTQVXA2oMGQFeDiQHnw24CbcGoAqiCMQAYAllAQUDIQdKAMwK4g/QCNQORAvlDIIKAQE/BOsPcgL9DSMHrgjDB8oOYQZ1C4AFAgLSDToIpw5tCboFtgGEDeQAPQlrCqYFIw/iC/kMswWrAu0PaQsVDRMDnQXNCMYA3wJICEcBPgIZD5AJZQZ7CKgEuQqMAvMPqgEVA2UFmga9B04KDA6FCEYFEw0tBn4AjgSGBzECVg+dC44Mcgg3BvcLPQXcAuAB2gSfACMNywmwBlsBQAorBDYDBgupBlYEpQtWAzwOAAcrALYKewELD0cMbAYHBHMOwAnBDDoPfAv5DX4EpQyBCnINrAJGC9gPhACCBdoIVw5KDKgN4woGBDoMvAUgAgEKkAEMA7EL6g07CMsFsQkkAyIFtQ5qA7sBeAlxDzEKsAw8CGUD1A/fA30MxgJVBvIL3w64DP0JiAJaB6QMwAjlBAYO0gPxCYwICQFqChsC4waWAZoDRwWgBnQJ2A78BUYAuwclBBICXQzRDnILPASjAJ0JkQ+KAkUATA2GBOEH1A1AD44JAQd9A7ABfQ33BgoJLgEQCtMHWQ0KARwOQwTkBiwLeg7lCNcEFQtsD2QNPAHrCEkAxA+9DVUF3AH9AmEJwQceBjUNRQM2DkEFGAg1DPMH+Al/AnsAhwccAwgJ1wunBa8NKQmJBmMBOw0TBmQHrQTNCx8I6g88CaILcgYAC1UE8gCQDNcP4AoqAIEO7gySBrQE5ArUA1gGpwslAEYPwwL7AC4HHQ49AKkIKgVuB24GzgR/CLkA3Qr3D2AMDgGzCzMC2QQ1B38Lnw9xAH8ESQu9Dg4N7wtZCkkETA7WAUUKIA/nAwoKMANMCFUCgA6RAekFsQ4IA6cBrgM8AGsIlwWyDi8K6gT/CzsEsQJeC0QPFwCMDAgIgAI4CY0F+wkWDMYFegmdA7kHIwKJCugDRA1FC8AOTAajCewOcAS+BoAKuA+KAKIJkAOZDUcJRAYUATgI0QRgBocBjQ9OCPUG/gRcAPsMKQe6D/sKdAwECewGJwoyBbQKSAeZDLwPVA1LA+AIUQJDBv0ODAjaBQ0C7QjADU4FqAfxDugMtQGfB9cN7wEMDSkKDwZNDsULqAKUAYQDQQwkBEsBjQ0DCBEDpA65CN4NXgy7BbwChAcyDuQDqQ9WAtANVQupAAsN8gIgDKUIRgIvBR8OUARRALADxQ3qADIMOA7cCAkGgQK+C8IGUgHWB4oJ7QB9ChIO/QMWBwcDZAphAakE3AqWAzkIOQRgC68P7gKgDBABhA/oCTcHJwknAqYHmQqyBbgA0QxPBakBdQatCn4B9wwdCukBFwubCTwH6QjtBZsE9A/lCgsGUA+0C9AASgqUBxENVwuTAqcPDASnALME6wkgAU4Ohgq5DIcEfA04A3sHCwynCdQAqA5RDIgGpg3+BlkPUACnBtgEtgBbCG8EOwncDdkFwQ9IBe0N3wuXAmIHgAmFCwQElgciA9MOPQgZBRQM+wU9Dc8AeAPGDK0CwgmKDhgBmwN0DXIJTwP/BeoOhAmZBR4IWQayCTMPkw0SCw4EawV2D3QDTgs2DysFQgEmBl8PkQu3CNcDgwD1CKcCXwpwDBsJjA7tCtsG1wcgBZEAlQywChUAqgiqBC8PYA1zA44PRAoGCQQA+g8tBPgAEwfxAlcFBw9oCpAH+wsWAuQInAezCoMBwwZpCAwCvQQ6AVcHQw2+AdMLLQL7Bv8HQQmvADAI/AaAAPsI/gpPDeoBdASbBXcC4gnLDrYLXAWWDS4C0gUpDbgDmAFYC14DZwhpAl0OQgO1BisKAQL4BXgAKg7BBIMNzAvqCsINPgm5DpsIuQs1BGkADQ5oBeIGZAQbDpUFxg9fDKsNoQoODG8DcQ7wCmEFuwN1CM4FAANnDTcMBQLlBdIMtQKIDi4IlgqjB8oN1g+9DD8GKAGxA/UOfwdNAYEJ4g6EDCgKcAYPD5oLmgneDNsAYwzfCBYLxAZVDFIC4QWpA5cGkQLVD7UKFAKADWIGWghrASsLogwFAAkKFgSEAhYPEQCBBpoPuwjNALQHtAxTDmEAsAvmDr4EHwoeDosJ3geYBBAH/gKaDJYA7gqkAUIEzAcZC3MIBwqMBMcLtgJbBfkPRQL/DOED7wUXBb4H4w1xBJ4OwgJtCDAB1QlsB8cAFgpyDE8AXgfhBM4JUw+/A4MJEA8EAyUIIg1NC0QJegXEA+kJagKcBBIK3gI6CeQPUwqBAXsGcwKBB9YDxQGkC0QAfwVzCfkD4AYqCLAFbAkODlwClAaJAHoP2Q15CDsALg5QCfYAWwcfAi8IeQOSCiQB0gczBcwPRQ0KD9IILA62BBEGvANDDpcBlwx1At0LrgQcBv0PwAGHBj4BpAflCzoOAA34Bv4LOAZdAeMEKg0uBMwINwuSDiMFeQqVDcQI9w77D2YBqg6oCy8DjA86AO0L+QRJDU0D1QoEBiIHRAQFC8gEbg9jCrcOfAGkBrkFawnuC2QD9gpfBOgCHQzGAT8ILg3/Cs4I3g+YBVIHSw6eAIUK1Q34BMIOdQOKCAgBDgUeCWgAhQ0hD18LywY9ArAH4QwHAHYIVAz5AJkGaAM/DB4Kow3dBCsCRwotDdUDRAdtCv0I2QfIAdwJDAxeAYYNoAg9DGYAvwvwD4QLWQKLDQ0AJQmcBlYBewpqBbYHEg+bAscG4gBZCzkKTgHjCHkM9AOPCQoMpwrJBjIPPwv3AYQOtwoFBHgIFAPNDmQJWgW+A98G2AKkD60FKA7TCoUC/QW4CKkMkQbjDtUI4QGtDpwFCwHCDBMFhQ5YA40HxwXOAhUHIwQLDucJQw8SBP8GIg55BZsPBw3GDlMDdguZAAAKGQTwDUQD5ARXDYUG+wEnBw4DhgCPDYsCfAQNBukPNQOjBWgHtACICm8M4wBgClMN+w5ICzoCmAnNBLoAKAcUBGQArgdJAQgGIAuEBBIMQg8DBEoLOwLmCAUPSwqxAfoMIQbwCLkCtQB+CJIMLAoIAnkLIQgMAIAGZQmPBEYM0wXWDKcHNAhdD7oC7AryDiYIbw54BTUJWgodDRAITgx/AVMJ+w0VBXoGPg7dD6wB6AXhCHgEowzGB0oIDQ0uC1wPhQkoDKsDMw6kAMwJegJPCFMHzw1+BoIAegvmA6YPxAkxC8cECQ07BWwODAG7BM0HwAJBBBQKxg1pAVYHpg4QCfgBfQACBt8JiASeB/AAAQacDOIBVAcAAKQDiwYhCn4P3wyLC8IBIgQtCLcLKwP6CZIAGQdUASYDow/OATkOAQOvCjYFNgi/DH4H7w1dBmMApQmFA54MdAUGCLwNqwBtA7oO9QHIBlEDDgtFBvMIsgyYDucLiwV7D5QItwIxBdsLJQ8CC/gMhQEFDJENMgqACwsExQ4yCwMOzweDArcEVwB6AxcP1gmiAkwHzwSlDSQMuw66CgkOmAtMBSAJogR+DbMBvw9MAsAFYAPvChANZwSLCjkPvQI6B40E2gt2B3sFdwxsCvEHcAFCDH8PkQPYAEcHpgEnAw8LUQ3gAPIJcgO7BtMDXw7RCDsDVAVkAqUPjgjsBGwBXQnPC20OEQv9BtkITQ3iBcUKNgCTD18GowOvBS4J8QOyBlIKlQBWBmEHoAvtCa4OCwl1AR4Fmg7eAdwHDwkuDC0BKg9DCdICFgg1AAQPdgnLDWcC3gnBBsoKyQjrDGYGAgSzDwwHMA5NApQJDAVOADsHTQ9OCcAA+gbkAtUMXgZLBf8Ahwi3BVcC2Q/RAOkH9gxRCTUCgQgXAbQP5AGWDGECkw5ADJ0IjAMcAO4G8AN2DOYPlQjgC/kFqgAKDkAG5wrEAXwOdga4Db0LKQTyBZEKngRGDW0FEw6DBMMJKQBbDHMKwwScCCsN9Q/WCzMGEwt1BBYOGgzqCfgPpgomAjoNqg/7A24MZQpYBN4LWQNdBXcLkA4XDTgK9wSqDWEIzQ/EBUMBbQ/xDOkEGAsDAVYKywLVBsMDQgsHBXAC3QncA6QFJQo7AZgHjQKmCFUHzQFACGAA1wLFB/QB9A5BCLEFjwFbC7AA1g7yAUIIiQLcDGcBgwbRA2wAlg7oCHADLwfNCboNSgElDlAGRwh6AUkPEwTNBhoD3AuMB9IAkgR+C90CxwpcCYYONAadDUMHIA40AOwMyQnhDhsIiQ3fBxAMGQ1GBBALGAXFDMwAWw75Dl0LlQ8OCogLmA3QBmIC8w3lA5kHeAaNCi8EzQ1QCs4O1AhRC3AN8QVqBFoM2QpIAPQCtAYOCQYC0g7uCR4HmAq4AX8JawArBvoKWgN+CYcN5gcRBMEBnQJ3CFwEYgmGBVcP/gFcB+EAhgOrBjkAqwgDAicODAkiD+8DqwvBBbMMwANKBjQBhAVJA5wK3w8tCQ0M8AKfDFYFbQcEAdgF4QLTBAQCSwiDB2QBUg/VBHkOGgtRBZMLmQTnDEMArA36BBcOUgw0D+oIgg49B30BHQWqBhgMfApOD8oLrQFdA9gK1wiKBKEMfwqhCykFTw8fA18HLgZbAHQKrQaZCQ8D7gRZCYcOnwhLDDoE8wzeAKwO1QXDCF8AaAl7A8MPvwm3BwwPQwwpA7ANtQknBjEI7wz8AEUPiwdsA9sF/AuWAkMIugdiBaYDHQLnBT4KnQwjCK4A6w2fBSAA7gduDVYMFAZPDr4CtgW1Dy8CqgloDsIK+guJA0sNRwJyD2ABegecAEcNMgImB0cA9gfhCckE9QqfAf8NPw+ZC2ENWAwUAM0KUgULCssAXAuhAxMC5Af1A5cJnwKXCN8Krg85CVEGZwM3ARUKWg3DCxsALQ6jAqEPewQSCa0D5gasCfUEpQCtB2YLTAGwCPYNbQx9BLEAoQWICdAPGQh9BaANswjQCmoPqQukBAcL2wgsBiQCCQfPA9sHNgq5BEICKwhKBMAGuQExDhgHvQW/Dq0M8AZICvYFUA2sACMO2wFjBLwA2gyBC0IOiQRjCJIP/wMfC/YG+QnYDNAOYgu4Aq0PVAggAycNkgkgB6UDFQGSB1MI/QxzAaYEyQIfDPUAgwuPA6UG1gUhA9oO0w38AiwN6wtkCLoMmgJ9BjIBMAdWDhIDBQnDDPcDtAhsAkYJJAB0C5IBDg+vC+IEQAf1CdYNBQeJCbcPcQbTAGUHNwVFCaMBjwUdA9YAPgYwCrYNEAK7Co4G/AMwD2YKKQYoC8oCdAbrDhwHpAqODm8HTwQkDl8C9wkUCLMHCAqTATQFvQ8KANUOpQUdCb8N2gonBf8JQQ85C40A5wcaDesEnA9bBOgNAwPuCGsGjwznAlEPNAsKBegB5gLSCnwMcQIBDUwPVA6JC78HHAjLAWMFEQxOBOUOugGGDFoAsgReDWMPBQrtAXgLuw18ABwJTQagCfgHRQw2Ac8MwgDhBmgLSQlxA3YKbwFQC5kD8g/ODPQAIwYqAjwFnw6qCngB9AlXDEYIqAXhD6wDgwpeAAII0AP6AEINmggsBAYPxgk2BrcDtQgcAW8NGgRrDFoOQgDPBhQJ7A18BSAI1As0Ag0JHASYDHYDvQguBT8DBwLUDB8A4AS2Ds4DkAKWBTcPKATpDRsHXQ3bBGMHfwCvCPYDcQ3ABwYMaghOAw4GagelAqgGtwANC+MBMw2zDnYFMQwgBvYOnQpCB8cN1AGfC1YAvAqNBm4CYgobBU0HVAlmD5YLyAAuCtECuw9VDrgGRQVZAOsHBwarDmYMLQqFD7UFkwgdC/MGbwm+ChUMlgigAAMGuwkYAhEPfgxuCmUCZwsfCaADuQY1AbEN2QvkDukD4wydDsUJlATHB2MJpQHPDyoJLgNQBZcA/wgFBZEH8Q3UBMsPZgkbDwIDBAvjA20CEQWuDOAHGgaaCh8BNgzODegKngkpARAE0gZ5DdEK4wJ2AZcNegQvDqcD8wFwDocMOgPCCyQI0AJ+BYYP1AawDigAFA4aCgYF8ghVAMgKcAnyBGsHHAzpADID7QYBC10CAQ5vCwINkAY4DwsDMwgmDIADuwwvAMwNeQFqBjANowgzB7IDVwFqCUgDjwcVCN4O4AJYB+gLXwjcAL0DUQcND/0LFwY4AMkPeQbmCQsFxw8aATQOLwacCYENjAGCBM8F6QpUAsAMlg8iAt0FGg4SAXgCBgaLCD8OGAqSDUgEggbmALoJQQJIDJ8KJgHBDpUBMgfgBYwLGgj5B5MK/g6oAVMLkA8mDg8FHgv6A9kBvARKDQoCnQ/zBUUO+Aj7BIwJKAJPClAIqAzqB2ACyAgcC3YEeQdNANAEkgtRCAQNlgkxDxcHWQR7C7gHlANSCLkPtQ1uA1ILCAUmAJsMKAivB8QEfA/JA8MFkA02BOUJMwvvCAkCVwReBZoARgMkBuMJkQSICBgNmwBrD4QGQQq/BREJCgttBNUCZQtUAKYMPQNpDzQHxgTfANULCge6Az4N/gkeDPgOPgPjDxYBtAIKBK0ARQj6AtcJpwyvBqoLXQpYAaEGCA+zAskFyA6rAekLOw6RCEEAWgkSB2wFSw9AA2UOIA1zDwIMIglpDukMXQAqDBUC1wXJC9gI5QAhDCYPWADBDbkJ5gy8BzoGoQ4wBJQLyQF4DXgKWQUGAFoPoAGTBj8CGAmoCgQHGQygBzwLrg2gBaUOiAANBaIBMg2rBIgM7AjvByMMaQneA3oKzQKzBj4L4A/IC30CEg11AJ4Gtwm7AhcKDwfmAT8FqAPdDrYGvgnYDa8CjQ4GDSUDOAf/BFgC0QZRAUMK6wGeCAAOkQVbCQYD8A4WCaUK5AV8CIsOXQSpDQwG7wScDucIQQZoDNEB1wpUDygJNAN4B9QJywPoAIoKGQJXBtwPzgBtDe0EVQMFDv0AvAiiBzQMEAUAATEG7gPRDWQLEQhVCv0H/wJaBJoHdQndBj4EhghwCrgLqQ4FCF4PSgVQDPcKZwCZD2gGKgTQDFAC3w35AkcLvgCrDJUCLgACChcDVQGvBHMHrQgABGkN8AVYDkAAkgXEDQ0HXgQVDpsLwgieBakJXAEcChsGbgSpCrMDXQgpC5sOgQyyALEHkgJkBvEAnA3PCh4AkAV0Aa4K/AF5DxsBOQaeA4UEPw3iAowGygPQCWIMKQgRAY8OygQpDPYPSQXaCYIPegj1DdAL0w9hCmAOoAIIDOkGWgJxC5kIfQ+qAk8LZgj1DBAAggP6DosMRQcXDNUHxA7ZDIIBKQ+3Da4B5w+nCMMKZQRODawLcgXKCIAMwA+PC9YE+wcCDmAFaw2CCWIAQAs2CYkB7w5wB6kCtAHvD0sLUAd3AVYJjQNgB5wL+AOFB8cBYQTNDB0AVQnIBesA8AnSD9MBogq3DEIGhgG2DyYFdwczClsCVARECA4CKAM3CYwFcQflApAEjQlhA7QF2w4xCc8BOw8zBDYCQQ5JCFYN8wIEDPcIYgNsDG4O9wcCB8kNcgrdDHEFSQ40CvUFnAPYCQMPWw0lAkgG8wAvDXMFkQncBosDZQ8tCwgOmgSNDK8DLAdLBCsJ2Q6iA60JGwtoAWMG2g0PANwFYw39CnMA+Qs8CjsGJg3lBkoCXAyFABEHXwOmCYAHfwaKA9cAIgYTChMA2AahAWkKngIABSIBRwRxCJ0ApgunBJ4NUwD0DHcGlAAsCLIKaw4ZCfgCKgsUDwsIgwUcDRADlwdiCHQODwHCBXYNdwC6C9EFmALPDrEMIwnlD9gLGg/MBAsHEA5DAgMJjwBrC+IH0wmwBEAOzAz4CvINcQE9CmIPLwmgDpsHdwRuC4gP7gWxCD4Mwg8FBlwDiw/5CCMDlQeSCCELMQSUBaoMlgSyAWEMFgaTAE8CMwxGAVoGsQplAFMFnwkDDD4PSwJbCgYHww2DCO0DCQXPApcKxgOGCR4BFwgBBNEPlAz9BGMOBQElCz0GPggkBQIAGwyKBWwLUQTaAWkMdgJcCDkN6gOhACEOqAksAvAL7wbiCucBhQw4BUQBdg7KB4YCKw/TBqwPTQp6DWcOxwnQBx4EAgmCAuoMlA/rChgDjQjeBFwOOQFNDBYARw9hC0YH1wFGBuIMsgLcDmYF2wqbAVUI4gMoD9MCQAGwDxYD9AjDDn4CFAclDb4FuAohBegO7AnjB64G9gKjCu4Omw0/ASoGAQ+0CeYN7QImCfQLrgkaAIkIVANFBDYH8QTbAlQKvg+UDrEGFwTQARAGnQfgDGsDEwlABXQHhwkWDf4AbghiDlEKfQeeC0EN2QZjA60NbwbwDBUJLww7CqQNrAYIBOQMkAhyAK8JBA69AAcHGQPfAcQLDw2uBUwAqAjCA3EJUwSKC0gCTwbECuoG4APxCucNqwXSC/ABzwiCCzcAsw0PDHIBbQswCb4NkACECoYG5QGBD94KQAKVBqoFUgRJDDEDAQWIAeQJeQBfCcsHZwpEAogFPgedBN0B0Qe8CSsBPA/nBOgHgQN0D/MLLAlqDvAEbAg9BEMLPwdCBbYM7g8zAGcH/Ay6BLgOagE0DdoCzgcdAQ0Kyg/TDM0F8gZrBAcINQXoD6QCzgtgBB0Ptgn1CycEcw08AxEKmQ7tBy0AbA3GCLYDLA+xBMECfw4ZAAgLZA9pAyQNzgq4BcEL2QIkCz8KKQLBCHIEjgHeBQwLBwGYD+UN0gFKD6YCjgoPDk0IfwMgCsUAhAjIDxIFAQxXCTgNUgbaAKoD6Q6VCTMDqABCCnIO9AZXCFkBZQ2pBXQADQjFD+QLOAHiCC8Luga0DvoFigz0CkkGxQhMDNwEkwnsAGUI1w5wAGwEXA1OBnUH4g1zC70GIQ1JCrQNKgeOAgYKfANACZUL1QCiBocF7gGXDy0MzAVjC/8Bcwa1AzwCwgSDDmgIxgrsAZEMjgdADfQFkgN1DGcF8grpAn0OSQeaAcsE+A3zA6ECOgWUCnwCqwcsAY4NCwKAD9sD1wZIDo0LRwbsAkoJdw4TCMMBCQTdAG4FrgKKBwsAFQT+CMsMpQc8BoIMfg55BOAJVQ1YCTIETwceAzUOGwrzDhoHVQ9YCscCoQ30BM4PMAYDC68BCQkDAP4HOAJhDz8JcQwSBm8KXglbBjgMHA9CCaYAlwtYCF8F2QklBzYLmQEKDVgFEQJnDDEH/w/KAB8F7QwyCWAPkwwJCB8POQxkBbwOegClBF8BVggKA8kHKgG7C6MOMgC+DDMJkwSLACIIVgttAAkMzgZaAbILpAiPAkgPHwRUC0oOKgrWBscD8wRBC2sCNQ9qANQH9gFIDaMEEQ4NBKAPLQOMAMgMMgjrAuUHJAm4BCIK2gP2C5UKqA+1CxUGJgq3AYcDpAnFAp0GkAt1CncNPgUeDzAL4A1KA0MFyQrbD40B6AaaDWUMLAU=";
/** Pure base64 decoder — no atob, works anywhere. */
function decodeBase64ToUint16(b64) {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const rev = new Int16Array(128).fill(-1);
    for (let i = 0; i < A.length; i++)
        rev[A.charCodeAt(i)] = i;
    let bytes = [];
    for (let i = 0; i < b64.length; i += 4) {
        const n = (rev[b64.charCodeAt(i)] << 18) |
            (rev[b64.charCodeAt(i + 1)] << 12) |
            ((rev[b64.charCodeAt(i + 2) ?? 65] & 0xff) << 6) |
            (rev[b64.charCodeAt(i + 3) ?? 65] & 0xff);
        bytes.push((n >> 16) & 0xff, (n >> 8) & 0xff);
        if (b64.charCodeAt(i + 2) !== 61 /* = */)
            bytes.push(n & 0xff);
    }
    const u8 = new Uint8Array(bytes);
    return new Uint16Array(u8.buffer, 0, u8.length >> 1);
}
let maskCache = null;
/** The baked void-and-cluster rank mask, decoded once. */
function voidClusterMask() {
    if (!maskCache)
        maskCache = decodeBase64ToUint16(VOID_CLUSTER_HEX_64_B64);
    return maskCache;
}
/**
 * Ordered blue-noise dither over hex coordinates: threshold t=(rank+0.5)/M
 * from the baked mask, cell lightness perturbed by (t-0.5)*rungGap, then
 * handed to the EXISTING quantizer unchanged.
 */
function orderedDitherHex(cells, quantize, opts = {}) {
    const mask = voidClusterMask();
    const out = new Map();
    const ladder = opts.ladder;
    for (const cell of cells) {
        const k = axialKey(cell.q, cell.r);
        const mq = ((cell.q % MASK_SIDE) + MASK_SIDE) % MASK_SIDE;
        const mr = ((cell.r % MASK_SIDE) + MASK_SIDE) % MASK_SIDE;
        const t = (mask[mr * MASK_SIDE + mq] + 0.5) / MASK_CELLS;
        let L = cell.ok.L < 0 ? 0 : cell.ok.L > 1 ? 1 : cell.ok.L;
        if (ladder && ladder.length > 1) {
            // clamp into the ladder, then perturb within the bracketing rung gap
            if (L < ladder[0])
                L = ladder[0];
            if (L > ladder[ladder.length - 1])
                L = ladder[ladder.length - 1];
            let lo = 0;
            for (let i = 0; i < ladder.length; i++)
                if (ladder[i] <= L)
                    lo = i;
            const hi = Math.min(lo + 1, ladder.length - 1);
            const gap = ladder[hi] - ladder[lo];
            L = L + (t - 0.5) * gap;
            if (L < 0)
                L = 0;
            if (L > 1)
                L = 1;
        }
        out.set(k, quantize({ L, a: cell.ok.a, b: cell.ok.b }));
    }
    return out;
}

// ── hexrender ──────────────────────────────────────────────
// hexrender.ts — display and export for the hex lattice.
// No npm, no DOM at import time: canvas-ish objects arrive as parameters
// (structural types), so the module runs under node with stubs and in the
// browser with real Path2D/canvas untouched.
//
// Live render: ONE hex Path2D built at the origin, then translate + fill per
// cell (SVG dies past a few thousand nodes; canvas does not).
// HAIRLINE SEAMS between adjacent cells are a known artifact — fixed here by
// drawing each hex slightly oversized (default +0.5px circumradius) AND
// stroking it 1px in the SAME colour as the fill. Never crispEdges.
//
// Export: SVG <symbol>/<use> polygons grouped by fill colour; PNG re-rendered
// at Nx onto an offscreen canvas via toBlob.

/** Build the ONE hex path at the origin — pass a real Path2D in the browser. */
function buildHexPath(path, size, orientation) {
    const c = hexCorners(size, orientation);
    path.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 6; i++)
        path.lineTo(c[i].x, c[i].y);
    path.closePath();
    return path;
}
/** Live render: translate + fill per cell, reusing the single hex path. */
function drawHexCells(ctx, path, cells, opts) {
    const oversize = opts.oversize ?? 0.5;
    const strokeSeam = opts.strokeSeam ?? true;
    const p = buildHexPath(path, opts.size + oversize, opts.orientation);
    for (const cell of cells) {
        const { x, y } = hexToPixel(cell.q, cell.r, opts.size, opts.orientation);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = cell.fill;
        ctx.fill(p);
        if (strokeSeam) {
            ctx.strokeStyle = cell.fill;
            ctx.lineWidth = 1;
            ctx.stroke(p);
        }
        ctx.restore();
    }
}
/** Bounding box [minX, minY, maxX, maxY] of a cell set (with hex extents). */
function cellsBounds(cells, size, orientation) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cell of cells) {
        const { x, y } = hexToPixel(cell.q, cell.r, size, orientation);
        if (x < minX)
            minX = x;
        if (y < minY)
            minY = y;
        if (x > maxX)
            maxX = x;
        if (y > maxY)
            maxY = y;
    }
    const ext = size; // circumradius = the farthest vertex reach in either orientation
    return [minX - ext, minY - ext, maxX + ext, maxY + ext];
}
/** SVG export: one <symbol> hexagon, <use> per cell, grouped by fill colour. */
function exportSVG(cells, opts) {
    const oversize = opts.oversize ?? 0.5;
    const s = opts.size + oversize;
    const [minX, minY, maxX, maxY] = cellsBounds(cells, opts.size, opts.orientation);
    const w = Math.ceil(maxX - minX);
    const h = Math.ceil(maxY - minY);
    const pts = hexCorners(s, opts.orientation)
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ");
    const byFill = new Map();
    for (const cell of cells) {
        const { x, y } = hexToPixel(cell.q, cell.r, opts.size, opts.orientation);
        const use = `<use href="#hx" x="${(x - minX).toFixed(2)}" y="${(y - minY).toFixed(2)}"/>`;
        let g = byFill.get(cell.fill);
        if (!g)
            byFill.set(cell.fill, (g = []));
        g.push(use);
    }
    const groups = [...byFill.entries()]
        .map(([fill, uses]) => `\t<g fill="${fill}">\n\t\t${uses.join("\n\t\t")}\n\t</g>`)
        .join("\n");
    return (`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
        `\t<defs><symbol id="hx"><polygon points="${pts}"/></symbol></defs>\n` +
        groups +
        `\n</svg>\n`);
}
/**
 * PNG export: re-render at Nx onto an offscreen canvas, then toBlob.
 * The canvas factory is injected (browser: Path2D + canvas); returns a Blob.
 */
async function exportPNG(cells, opts) {
    const scale = opts.scale ?? 2;
    const [minX, minY, maxX, maxY] = cellsBounds(cells, opts.size, opts.orientation);
    const w = Math.max(1, Math.ceil((maxX - minX) * scale));
    const h = Math.max(1, Math.ceil((maxY - minY) * scale));
    const canvas = opts.makeCanvas(w, h);
    const ctx = canvas.ctx();
    const path = canvas.path();
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);
    drawHexCells(ctx, path, cells, opts);
    ctx.restore();
    const blob = await canvas.toBlob();
    if (!blob)
        throw new Error("exportPNG: toBlob returned null");
    return blob;
}

return { hexToPixel, pixelToHex, pixelToHexFractional, cubeRound, hexDistance, axialToOffset, offsetToAxial, hexCorners, hexBounds, axialKey, HEX_NEIGHBOURS, resampleToHex, srgbToOklab, oklabToSrgb, dilate, erode, outline, floodFill, offsetNeighbours, diffuseHexError, orderedDitherHex, toneIndex, voidClusterMask, JODOIN_TRIPLES, JODOIN_TABLE_INTS, JODOIN_PROVENANCE, MASK_SIDE, MASK_CELLS, drawHexCells, exportSVG, exportPNG, cellsBounds, buildHexPath };
})();
</script>