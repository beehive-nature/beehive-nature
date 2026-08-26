// demo/main.js — wiring only. The five hex modules do the work; the palette
// comes from the PixelRefiner core VERBATIM (vendor-ref), used UNCHANGED.
// Square mode is the classic baseline (serpentine Floyd–Steinberg; ordered
// reuses the hex mask's rank grid as a generic blue-noise threshold array).
import { resampleToHex, srgbToOklab, oklabToSrgb } from "../dist/hexresample.js";
import { diffuseHexError, orderedDitherHex, voidClusterMask, MASK_SIDE, MASK_CELLS } from "../dist/hexdither.js";
import { drawHexCells, exportSVG, exportPNG, cellsBounds } from "../dist/hexrender.js";
import { hexToPixel } from "../dist/hexcoords.js";
import { OklabKMeans, PaletteQuantizer } from "../dist/vendor-ref/core/quantizer.js";
import { rgbToOklab, oklabToRgb } from "../dist/vendor-ref/core/colorUtils.js";

const $ = (id) => document.getElementById(id);
const state = { mode: "square", orientation: "pointy", dither: "diffuse", paletteN: 6, across: 44 };

let shrunk = null; // {width,height,data:Uint8ClampedArray} — Oklab-averaged ×8 box shrink
let palette = null;
let lastRenderCells = null; // for exports

// ── source prep ────────────────────────────────────────────────────────────
async function loadShrunk() {
	const img = new Image();
	img.src = "./assets/fungi_sheet.png";
	await img.decode();
	const c = document.createElement("canvas");
	c.width = c.height = 1536;
	const cx = c.getContext("2d", { willReadFrequently: true });
	cx.drawImage(img, 0, 0);
	const full = cx.getImageData(0, 0, 1536, 1536).data;
	// ×8 box shrink, averaged in Oklab (area-weighted), cached for all modes
	const W = 192;
	const out = new Uint8ClampedArray(W * W * 4);
	for (let by = 0; by < W; by++) {
		for (let bx = 0; bx < W; bx++) {
			let L = 0, a = 0, b = 0, n = 0;
			for (let y = by * 8; y < by * 8 + 8; y++) {
				for (let x = bx * 8; x < bx * 8 + 8; x++) {
					const i = (y * 1536 + x) * 4;
					const ok = srgbToOklab(full[i], full[i + 1], full[i + 2]);
					L += ok.L; a += ok.a; b += ok.b; n++;
				}
			}
			const rgb = oklabToSrgb({ L: L / n, a: a / n, b: b / n });
			const o = (by * W + bx) * 4;
			out[o] = rgb.r; out[o + 1] = rgb.g; out[o + 2] = rgb.b; out[o + 3] = 255;
		}
	}
	shrunk = { width: W, height: W, data: out };
}

function buildPalette() {
	const px = [];
	for (let i = 0; i < shrunk.width * shrunk.height; i += 2) {
		const o = i * 4;
		px.push({ r: shrunk.data[o], g: shrunk.data[o + 1], b: shrunk.data[o + 2], alpha: 255 });
	}
	const uniq = new Map();
	for (const p of px) uniq.set((p.r << 16) | (p.g << 8) | p.b, p);
	let pal;
	if (uniq.size <= state.paletteN) {
		pal = [...uniq.values()];
	} else {
		const mapped = new OklabKMeans(state.paletteN, 24).quantize(px);
		const seen = new Map();
		for (const p of mapped) seen.set((p.r << 16) | (p.g << 8) | p.b, p);
		pal = [...seen.values()];
	}
	palette = pal;
	makeQuantizer();
}

// Ok3 -> Ok3 through the REAL quantizer (unchanged), memoized per 8-bit colour
let quantizer = null;
function makeQuantizer() {
	const pq = new PaletteQuantizer(palette);
	const memo = new Map();
	quantizer = (ok) => {
		const rgb = oklabToRgb(ok);
		const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
		let hit = memo.get(key);
		if (!hit) {
			const chosen = pq.quantize([{ ...rgb, alpha: 255 }])[0];
			hit = rgbToOklab(chosen);
			memo.set(key, hit);
		}
		return hit;
	};
}

function ladder() {
	return palette.map((p) => rgbToOklab(p).L).sort((x, y) => x - y);
}

// ── pipelines ──────────────────────────────────────────────────────────────
function hexCells() {
	const size = shrunk.width / (state.across * Math.sqrt(3));
	return resampleToHex(shrunk, { size, orientation: state.orientation, supersample: 3 });
}

function ditherHex(cells) {
	if (state.dither === "off") {
		const out = new Map();
		for (const c of cells) out.set(c.key, quantizer(c.ok));
		return out;
	}
	if (state.dither === "ordered") return orderedDitherHex(cells, quantizer, { ladder: ladder() });
	return diffuseHexError(cells, quantizer, { orientation: state.orientation });
}

function squareCells() {
	// area-weighted block average of the shrunk raster — same density as hex
	const G = state.across;
	const B = shrunk.width / G;
	const H = Math.round(shrunk.height / B);
	const vals = new Float64Array(G * H * 3);
	for (let gy = 0; gy < H; gy++) {
		for (let gx = 0; gx < G; gx++) {
			let L = 0, a = 0, b = 0, n = 0;
			const x0 = Math.round(gx * B), x1 = Math.round((gx + 1) * B);
			const y0 = Math.round(gy * B), y1 = Math.round((gy + 1) * B);
			for (let y = y0; y < y1; y++)
				for (let x = x0; x < x1; x++) {
					const o = (y * shrunk.width + x) * 4;
					const ok = srgbToOklab(shrunk.data[o], shrunk.data[o + 1], shrunk.data[o + 2]);
					L += ok.L; a += ok.a; b += ok.b; n++;
				}
			const i = (gy * G + gx) * 3;
			vals[i] = L / n; vals[i + 1] = a / n; vals[i + 2] = b / n;
		}
	}
	return { vals, G, H };
}

function ditherSquare({ vals, G, H }) {
	const out = new Array(G * H);
	if (state.dither === "off") {
		for (let i = 0; i < G * H; i++) out[i] = quantizer({ L: vals[i * 3], a: vals[i * 3 + 1], b: vals[i * 3 + 2] });
		return out;
	}
	const buf = new Float64Array(G * H * 3);
	const run = (x, y) => {
		const idx = y * G + x;
		const v = { L: vals[idx * 3] + buf[idx * 3], a: vals[idx * 3 + 1] + buf[idx * 3 + 1], b: vals[idx * 3 + 2] + buf[idx * 3 + 2] };
		const chosen = quantizer(v);
		out[idx] = chosen;
		const e = [v.L - chosen.L, v.a - chosen.a, v.b - chosen.b];
		return { e, idx };
	};
	if (state.dither === "ordered") {
		const mask = voidClusterMask();
		const lad = ladder();
		for (let y = 0; y < H; y++)
			for (let x = 0; x < G; x++) {
				const t = (mask[(y % MASK_SIDE) * MASK_SIDE + (x % MASK_SIDE)] + 0.5) / MASK_CELLS;
				const i = (y * G + x) * 3;
				let L = vals[i];
				if (lad.length > 1) {
					if (L < lad[0]) L = lad[0];
					if (L > lad[lad.length - 1]) L = lad[lad.length - 1];
					let lo = 0;
					for (let k = 0; k < lad.length; k++) if (lad[k] <= L) lo = k;
					const gap = lad[Math.min(lo + 1, lad.length - 1)] - lad[lo];
					L += (t - 0.5) * gap;
				}
				out[y * G + x] = quantizer({ L, a: vals[i + 1], b: vals[i + 2] });
			}
		return out;
	}
	// serpentine Floyd–Steinberg (the square classic this lane does not touch)
	const dirs = (ltr) => (ltr ? [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] : [[-1, 0, 7], [1, 1, 3], [0, 1, 5], [-1, 1, 1]]);
	for (let y = 0; y < H; y++) {
		const ltr = y % 2 === 0;
		for (let i = 0; i < G; i++) {
			const x = ltr ? i : G - 1 - i;
			const { e } = run(x, y);
			for (const [dx, dy, w] of dirs(ltr)) {
				const nx = x + dx, ny = y + dy;
				if (nx < 0 || nx >= G || ny >= H) continue;
				const ni = (ny * G + nx) * 3;
				buf[ni] += (e[0] * w) / 16; buf[ni + 1] += (e[1] * w) / 16; buf[ni + 2] += (e[2] * w) / 16;
			}
		}
	}
	return out;
}

// ── render ─────────────────────────────────────────────────────────────────
const css = (ok) => {
	const c = oklabToSrgb(ok);
	return `rgb(${c.r},${c.g},${c.b})`;
};

function render() {
	const t0 = performance.now();
	const cv = $("cv");
	const cssW = cv.parentElement.clientWidth - 20;
	const dpr = window.devicePixelRatio || 1;
	let msPipe = 0;

	if (state.mode === "hex") {
		const cells = hexCells();
		const chosen = ditherHex(cells);
		const renderCells = cells.map((c) => ({ q: c.q, r: c.r, fill: css(chosen.get(c.key)) }));
		lastRenderCells = { kind: "hex", cells: renderCells };
		msPipe = performance.now() - t0;
		// fit: unit-size bounds scaled to canvas width
		const [minX, minY, maxX, maxY] = cellsBounds(renderCells, 1, state.orientation);
		const size = Math.max(0.5, (cssW - 8) / (maxX - minX));
		const [b2x, b2y, b3x, b3y] = cellsBounds(renderCells, size, state.orientation);
		const h = Math.ceil(b3y - b2y);
		cv.width = Math.round(cssW * dpr);
		cv.height = Math.round(h * dpr);
		cv.style.height = h + "px";
		const ctx = cv.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#0a0d0b";
		ctx.fillRect(0, 0, cssW, h);
		ctx.translate(-b2x + (cssW - (b3x - b2x)) / 2, -b2y);
		drawHexCells(ctx, new Path2D(), renderCells, { size, orientation: state.orientation });
		$("st-cells").textContent = cells.length.toLocaleString();
		const used = new Set(renderCells.map((c) => c.fill));
		$("st-colours").textContent = used.size;
	} else {
		const sq = squareCells();
		const out = ditherSquare(sq);
		msPipe = performance.now() - t0;
		const cell = (cssW - 8) / sq.G;
		const h = Math.ceil(sq.H * cell);
		cv.width = Math.round(cssW * dpr);
		cv.height = Math.round(h * dpr);
		cv.style.height = h + "px";
		const ctx = cv.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#0a0d0b";
		ctx.fillRect(0, 0, cssW, h);
		ctx.translate(4, 0);
		const byRow = [];
		for (let i = 0; i < out.length; i++) byRow.push(css(out[i]));
		lastRenderCells = { kind: "square", out: byRow, G: sq.G, H: sq.H, cell };
		for (let y = 0; y < sq.H; y++)
			for (let x = 0; x < sq.G; x++) {
				ctx.fillStyle = byRow[y * sq.G + x];
				ctx.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6); // same seam law as hex
			}
		$("st-cells").textContent = (sq.G * sq.H).toLocaleString();
		const used = new Set(byRow);
		$("st-colours").textContent = used.size;
	}
	$("st-ms").textContent = Math.round(msPipe);
}

// ── controls ───────────────────────────────────────────────────────────────
function seg(id, key, cast) {
	const el = $(id);
	el.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		for (const x of el.querySelectorAll("button")) x.classList.toggle("on", x === b);
		state[key] = cast ? cast(b.dataset.v) : b.dataset.v;
		if (key === "paletteN") buildPalette();
		render();
	});
}
seg("seg-mode", "mode");
seg("seg-orient", "orientation");
seg("seg-dither", "dither");
seg("seg-palette", "paletteN", Number);
$("density").addEventListener("input", (e) => {
	state.across = Number(e.target.value);
	$("den-v").textContent = state.across;
	render();
});
const modeWatcher = () => $("row-orient").classList.toggle("disabled", state.mode !== "hex");
$("seg-mode").addEventListener("click", modeWatcher);

// ── exports ────────────────────────────────────────────────────────────────
function download(blob, name) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$("btn-svg").addEventListener("click", () => {
	if (!lastRenderCells) return;
	if (lastRenderCells.kind === "hex") {
		const svg = exportSVG(lastRenderCells.cells, { size: 8, orientation: state.orientation });
		download(new Blob([svg], { type: "image/svg+xml" }), "hex-refine.svg");
	} else {
		const { out, G, H, cell } = lastRenderCells;
		const rects = out.map((f, i) => `<rect x="${((i % G) * cell).toFixed(1)}" y="${(Math.floor(i / G) * cell).toFixed(1)}" width="${(cell + 0.6).toFixed(1)}" height="${(cell + 0.6).toFixed(1)}" fill="${f}"/>`).join("");
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(G * cell).toFixed(0)}" height="${(H * cell).toFixed(0)}">${rects}</svg>`;
		download(new Blob([svg], { type: "image/svg+xml" }), "square-refine.svg");
	}
});

$("btn-png").addEventListener("click", async () => {
	if (!lastRenderCells) return;
	if (lastRenderCells.kind === "hex") {
		const blob = await exportPNG(lastRenderCells.cells, {
			size: 8,
			orientation: state.orientation,
			scale: 3,
			makeCanvas: (w, h) => {
				const c = document.createElement("canvas");
				c.width = w; c.height = h;
				const ctx = c.getContext("2d");
				return {
					ctx: () => ctx,
					path: () => new Path2D(),
					toBlob: () => new Promise((res) => c.toBlob(res, "image/png")),
				};
			},
		});
		download(blob, "hex-refine.png");
	} else {
		const cv = $("cv");
		cv.toBlob((b) => b && download(b, "square-refine.png"), "image/png");
	}
});

// ── boot ───────────────────────────────────────────────────────────────────
await loadShrunk();
buildPalette();
makeQuantizer();
modeWatcher();
render();
