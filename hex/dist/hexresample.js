// hexresample.ts — square raster -> hex cells.
// Pure functions. No DOM, no dependencies.
//
// AREA-WEIGHTED, not centre point-sampling: the source is supersampled and
// every sub-sample whose centre lands inside a hex (via pixel->hex rounding)
// contributes to that hex's average. Averaging happens in Oklab (same
// constants as the estate colorUtils — no drift), and the per-cell averages
// are handed onward to the EXISTING quantizer UNCHANGED: it is
// lattice-agnostic and is not forked here.
import { axialKey, pixelToHex } from "./hexcoords.js";
function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
}
/** sRGB 0-255 -> Oklab (estate constants). */
export function srgbToOklab(r, g, b) {
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
export function oklabToSrgb(ok) {
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
export function resampleToHex(img, opts) {
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
