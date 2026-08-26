// run.mjs — zero-dependency test runner. Every assertion prints its raw
// got/want (REPORT-LINT); any failure exits 1. Run: node tests/run.mjs
// (build first: node tools/build.mjs — tests exercise dist/, what ships.)
import * as coords from "../dist/hexcoords.js";
import * as resample from "../dist/hexresample.js";
import * as morph from "../dist/hexmorph.js";
import * as dither from "../dist/hexdither.js";
import * as render from "../dist/hexrender.js";

let pass = 0;
let fail = 0;
function eq(label, got, want, tol) {
	const okNum = typeof want === "number" && typeof got === "number";
	const ok = okNum ? Math.abs(got - want) <= (tol ?? 1e-9) : JSON.stringify(got) === JSON.stringify(want);
	const raw = okNum ? `got=${got} want=${want}` : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`;
	console.log(`${ok ? "PASS" : "FAIL"} ${label} :: ${raw}`);
	ok ? pass++ : fail++;
}
function ok(label, cond, raw) {
	console.log(`${cond ? "PASS" : "FAIL"} ${label} :: ${raw ?? String(cond)}`);
	cond ? pass++ : fail++;
}

// ── hexcoords ────────────────────────────────────────────────────────────────
const S3 = Math.sqrt(3);
eq("pointy hexToPixel(1,0)", coords.hexToPixel(1, 0, 10, "pointy"), { x: 10 * S3, y: 0 });
eq("pointy hexToPixel(0,1)", coords.hexToPixel(0, 1, 10, "pointy"), { x: 5 * S3, y: 15 });
eq("pointy hexToPixel(-1,2)", coords.hexToPixel(-1, 2, 10, "pointy"), { x: 0, y: 30 });
eq("flat hexToPixel(1,0)", coords.hexToPixel(1, 0, 10, "flat"), { x: 15, y: 5 * S3 });
eq("flat hexToPixel(0,1)", coords.hexToPixel(0, 1, 10, "flat"), { x: 0, y: 10 * S3 });
eq("pixelToHex(0,0)", coords.pixelToHex(0, 0, 10, "pointy"), { q: 0, r: 0 });
eq("pixelToHex(17.32,0)", coords.pixelToHex(10 * S3, 0, 10, "pointy"), { q: 1, r: 0 });
eq("pixelToHex(8.66,15)", coords.pixelToHex(5 * S3, 15, 10, "pointy"), { q: 0, r: 1 });
eq("pixelToHex(0,30) pointy", coords.pixelToHex(0, 30, 10, "pointy"), { q: -1, r: 2 });
eq("pixelToHex(15,8.66) flat", coords.pixelToHex(15, 5 * S3, 10, "flat"), { q: 1, r: 0 });

eq("cubeRound(0.3,1.6)", coords.cubeRound(0.3, 1.6), { q: 0, r: 2 });
eq("cubeRound(0.6,0.6) boundary tie", coords.cubeRound(0.6, 0.6), { q: 1, r: 0 });
eq("cubeRound(-0.4,-0.4)", coords.cubeRound(-0.4, -0.4), { q: 0, r: -1 });
{
	let rt = true;
	let n = 0;
	for (let q = -6; q <= 6; q++)
		for (let r = -6; r <= 6; r++) {
			const p = coords.hexToPixel(q, r, 7, "pointy");
			if (coords.pixelToHex(p.x, p.y, 7, "pointy").q !== q || coords.pixelToHex(p.x, p.y, 7, "pointy").r !== r) rt = false;
			const pf = coords.hexToPixel(q, r, 7, "flat");
			if (coords.pixelToHex(pf.x, pf.y, 7, "flat").q !== q || coords.pixelToHex(pf.x, pf.y, 7, "flat").r !== r) rt = false;
			n += 2;
		}
	ok("hexToPixel->pixelToHex identity (both orientations)", rt, `${n} roundtrips, q,r in [-6,6]`);
}

const nbs = coords.HEX_NEIGHBOURS.map(([dq, dr]) => [0 + dq, 0 + dr]);
eq("neighbours of origin (constant table)", nbs, [
	[1, 0],
	[1, -1],
	[0, -1],
	[-1, 0],
	[-1, 1],
	[0, 1],
]);
{
	const sum = nbs.reduce((s, [q, r]) => [s[0] + q, s[1] + r], [0, 0]);
	eq("neighbour deltas sum to zero", sum, [0, 0]);
	let allD1 = true;
	for (const [q, r] of nbs) if (coords.hexDistance(0, 0, q, r) !== 1) allD1 = false;
	ok("all neighbours at cube distance 1", allD1);
}
eq("hexDistance(3,-2,-1,1)", coords.hexDistance(3, -2, -1, 1), 4);
eq("neighbour add (3,-2)+(1,-1)", [3 + 1, -2 - 1], [4, -3]);

eq("pointy axial(2,3)->offset odd-r", coords.axialToOffset(2, 3, "pointy"), { col: 3, row: 3 });
eq("pointy axial(0,1)->offset", coords.axialToOffset(0, 1, "pointy"), { col: 0, row: 1 });
eq("flat axial(3,-1)->offset odd-q", coords.axialToOffset(3, -1, "flat"), { col: 3, row: 0 });
{
	let rt = true;
	for (let q = -8; q <= 8; q++)
		for (let r = -8; r <= 8; r++)
			for (const o of ["pointy", "flat"]) {
				const off = coords.axialToOffset(q, r, o);
				const back = coords.offsetToAxial(off.col, off.row, o);
				if (back.q !== q || back.r !== r) rt = false;
			}
	ok("axial<->offset roundtrip (negatives included)", rt, "q,r in [-8,8], both orientations");
}

// ── hexresample ──────────────────────────────────────────────────────────────
{
	const W = 8;
	const H = 8;
	const data = new Uint8ClampedArray(W * H * 4);
	for (let i = 0; i < W * H; i++) {
		data[i * 4] = 255;
		data[i * 4 + 1] = 0;
		data[i * 4 + 2] = 255;
		data[i * 4 + 3] = 255;
	}
	const cells = resample.resampleToHex({ width: W, height: H, data }, { size: 2, orientation: "pointy", supersample: 2 });
	const ref = resample.srgbToOklab(255, 0, 255);
	let uniform = true;
	for (const c of cells)
		if (Math.abs(c.ok.L - ref.L) > 1e-9 || Math.abs(c.ok.a - ref.a) > 1e-9 || Math.abs(c.ok.b - ref.b) > 1e-9) uniform = false;
	ok("uniform raster -> uniform cells (exact Oklab)", uniform, `${cells.length} cells vs L=${ref.L.toFixed(6)} a=${ref.a.toFixed(6)} b=${ref.b.toFixed(6)}`);
	const coverage = cells.reduce((s, c) => s + c.weight, 0);
	eq("sub-sample coverage invariant", coverage, W * H * 4);
}
for (const [r, g, b] of [
	[255, 255, 255],
	[0, 0, 0],
	[128, 128, 128],
	[29, 119, 47],
	[124, 40, 138],
]) {
	const back = resample.oklabToSrgb(resample.srgbToOklab(r, g, b));
	ok(`oklab roundtrip rgb(${r},${g},${b})`, back.r === r && back.g === g && back.b === b, `-> rgb(${back.r},${back.g},${back.b})`);
}

// ── hexmorph ────────────────────────────────────────────────────────────────
{
	const mk = (cols, rows) => ({ cols, rows, orientation: "pointy", cells: new Uint8Array(cols * rows) });
	const g = mk(9, 9);
	g.cells[4 * 9 + 4] = 1; // single centre dot
	const d = morph.dilate(g);
	eq("dilate(single dot) popcount", d.cells.reduce((s, v) => s + v, 0), 7);
	const e = morph.erode(g);
	eq("erode(single dot) popcount", e.cells.reduce((s, v) => s + v, 0), 0);
	const o = morph.outline(g);
	eq("outline(single dot) popcount (ring)", o.cells.reduce((s, v) => s + v, 0), 6);
	ok("outline excludes the content", o.cells[4 * 9 + 4] === 0);
	// flood: background inside the ring is sealed off by 6-connectivity
	const inside = morph.floodFill(o, 4, 4); // value 0 inside the ring
	eq("flood inside ring reaches only centre", inside.cells.reduce((s, v) => s + v, 0), 1);
	const outside = morph.floodFill(o, 0, 0);
	eq("flood outside ring reaches all background", outside.cells.reduce((s, v) => s + v, 0), 81 - 7);
}

// ── hexdither ────────────────────────────────────────────────────────────────
{
	const mask = dither.voidClusterMask();
	ok("mask size", mask.length === 4096, `${mask.length}`);
	ok("mask is a permutation of 0..4095", new Set(mask).size === 4096, `unique=${new Set(mask).size}`);
	eq("toneIndex(0)", dither.toneIndex({ L: 0, a: 0, b: 0 }), 0);
	eq("toneIndex(0.4)", dither.toneIndex({ L: 0.4, a: 0, b: 0 }), 102);
	eq("toneIndex(0.6) mirrors to 102", dither.toneIndex({ L: 0.6, a: 0, b: 0 }), 102);
}
{
	// the verified table: shape, sanity, known rows, normalization
	const ints = dither.JODOIN_TABLE_INTS;
	eq("table carries 128 rows x 3", ints.length, 384);
	let sumsOK = true;
	let nonNeg = true;
	for (let i = 0; i < 128; i++) {
		const s = ints[i * 3] + ints[i * 3 + 1] + ints[i * 3 + 2];
		if (s < 9998 || s > 10002) sumsOK = false;
		for (let k = 0; k < 3; k++) if (ints[i * 3 + k] < 0) nonNeg = false;
	}
	ok("every row sums to ~10000 (9998..10002)", sumsOK, `row0=${ints[0] + ints[1] + ints[2]} row127=${ints[381] + ints[382] + ints[383]}`);
	ok("no negative weights", nonNeg);
	let normOK = true;
	for (let i = 0; i < 128; i++) {
		const s = dither.JODOIN_TRIPLES[i * 3] + dither.JODOIN_TRIPLES[i * 3 + 1] + dither.JODOIN_TRIPLES[i * 3 + 2];
		if (Math.abs(s - 1) > 1e-12) normOK = false;
	}
	ok("JODOIN_TRIPLES rows normalized to 1", normOK);
	eq("row 0 = (6691,0,3309)", [ints[0], ints[1], ints[2]], [6691, 0, 3309]);
	eq("row 58 = (2800,2900,4300)", [ints[58 * 3], ints[58 * 3 + 1], ints[58 * 3 + 2]], [2800, 2900, 4300]);
	eq("row 120 = (5556,4444,0)", [ints[120 * 3], ints[120 * 3 + 1], ints[120 * 3 + 2]], [5556, 4444, 0]);
	eq("row 127 = (4920,3918,1162)", [ints[127 * 3], ints[127 * 3 + 1], ints[127 * 3 + 2]], [4920, 3918, 1162]);
}
{
	// 50% grey field, black/white palette: tone preservation
	const cells = [];
	for (let r = 0; r < 32; r++) for (let q = 0; q < 32; q++) cells.push({ q, r, ok: resample.srgbToOklab(128, 128, 128) });
	const quant = (v) => (v.L >= 0.5 ? { L: 1, a: 0, b: 0 } : { L: 0, a: 0, b: 0 });
	const out = dither.diffuseHexError(cells, quant, { orientation: "pointy" });
	let whites = 0;
	for (const c of cells) if (out.get(c.q + "," + c.r).L === 1) whites++;
	const grey = resample.srgbToOklab(128, 128, 128).L;
	eq("diffusion tone preservation (1024 cells)", whites / 1024, grey, 0.02);
}
{
	// ordered dither tone preservation at a flat 25% tone
	const cells = [];
	for (let r = 0; r < 64; r++) for (let q = 0; q < 64; q++) cells.push({ q, r, ok: { L: 0.25, a: 0, b: 0 } });
	const quant = (v) => (v.L >= 0.5 ? { L: 1, a: 0, b: 0 } : { L: 0, a: 0, b: 0 });
	const out = dither.orderedDitherHex(cells, quant, { ladder: [0, 1] });
	let whites = 0;
	for (const c of cells) if (out.get(c.q + "," + c.r).L === 1) whites++;
	eq("ordered tone preservation (4096 cells, tone 0.25)", whites / 4096, 0.25, 0.02);
}
{
	// downstream routing on an even (L->R) row — expectations derived from the
	// live weight table so the routing (not the numbers) is what's under test
	const row = (L) => {
		const i = dither.toneIndex({ L, a: 0, b: 0 });
		return [0, 1, 2].map((s) => dither.JODOIN_TRIPLES[i * 3 + s]);
	};
	const base = (L) => ({ L, a: 0, b: 0 });
	const cells = [
		{ q: 0, r: 0, ok: base(0.8) }, // white, err -0.2
		{ q: 1, r: 0, ok: base(1.0) }, // white; re-diffuses its own small error
		{ q: 0, r: 1, ok: base(0.51) }, // black iff below-slot errors arrived
		{ q: 5, r: 5, ok: base(0.51) }, // control: stays white
	];
	const quant = (v) => (v.L >= 0.5 ? { L: 1, a: 0, b: 0 } : { L: 0, a: 0, b: 0 });
	const w0 = row(0.8); // weights active at (0,0)
	const v1 = 1.0 + w0[0] * (0.8 - 1); // (1,0) diffused value
	const w1 = row(v1); // weights active at (1,0)
	const exp01 = 0.51 + w0[2] * (0.8 - 1) + w1[1] * (v1 - 1); // (0,1): slot2 from (0,0) + slot1 from (1,0)
	const out = dither.diffuseHexError(cells, quant, { orientation: "pointy" });
	ok("derived expectation actually decides (exp01 < 0.45)", exp01 < 0.45, `exp01=${exp01.toFixed(4)}`);
	ok("below target (0,1) received both slot errors -> black", out.get("0,1").L === 0, `chosen L=${out.get("0,1").L} vs exp01=${exp01.toFixed(4)}`);
	ok("control cell (5,5) untouched -> white", out.get("5,5").L === 1, `chosen L=${out.get("5,5").L}`);
}
{
	// serpentine mirroring: on the odd line r=1 the scan runs -q, so (1,1)'s
	// error must flow forward to (0,1) (processed after it), not to (2,1).
	const row = (L) => {
		const i = dither.toneIndex({ L, a: 0, b: 0 });
		return [0, 1, 2].map((s) => dither.JODOIN_TRIPLES[i * 3 + s]);
	};
	const base = (L) => ({ L, a: 0, b: 0 });
	const cells = [
		{ q: 2, r: 0, ok: base(0.8) }, // white, err -0.2 -> below-left slot reaches (1,1)
		{ q: 1, r: 1, ok: base(0.51) }, // -> black
		{ q: 0, r: 1, ok: base(0.49) }, // black alone; white iff mirrored forward error arrives
	];
	const quant = (v) => (v.L >= 0.5 ? { L: 1, a: 0, b: 0 } : { L: 0, a: 0, b: 0 });
	const w0 = row(0.8);
	const v11 = 0.51 + w0[1] * (0.8 - 1); // (1,1) diffused value -> black
	const w11 = row(v11);
	const exp01 = 0.49 + w11[0] * v11; // (0,1): mirrored-forward (slot0) of (1,1)'s error (+v11)
	const out = dither.diffuseHexError(cells, quant, { orientation: "pointy" });
	ok("derived expectation actually decides (exp01 > 0.55)", exp01 > 0.55, `exp01=${exp01.toFixed(4)}`);
	ok("(1,1) received (2,0) below-left error -> black", out.get("1,1").L === 0, `chosen L=${out.get("1,1").L} vs v11=${v11.toFixed(4)}`);
	ok("mirrored forward: (1,1) error reached (0,1) -> white", out.get("0,1").L === 1, `chosen L=${out.get("0,1").L} vs exp01=${exp01.toFixed(4)}`);
}

// ── hexrender (DOM-free surface) ─────────────────────────────────────────────
{
	const rc = [
		{ q: 0, r: 0, fill: "#1d772f" },
		{ q: 1, r: 0, fill: "#1d772f" },
		{ q: 0, r: 1, fill: "#2800ba" },
	];
	const svg = render.exportSVG(rc, { size: 8, orientation: "pointy" });
	const uses = svg.split("<use").length - 1;
	ok("exportSVG emits symbol + one use per cell", svg.includes('<symbol id="hx"') && uses === 3, `uses=${uses}`);
	ok("exportSVG groups by fill colour", svg.includes('<g fill="#1d772f">'), svg.match(/<g fill="[^"]+">/g)?.join(" ") ?? "no groups");
	ok("exportSVG is a complete document", svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), `${svg.length} chars`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
