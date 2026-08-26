// gen-voidcluster.mjs — offline generator for the hex blue-noise dither mask.
// Ulichney 1993 void-and-cluster over AXIAL hex coordinates, tileable as a
// 64x64 rhombus patch (translation by (64,0)/(0,64) is a lattice symmetry).
// Distance is the hex metric h = dq^2 + dq*dr + dr^2 (h=1 for neighbours),
// Gaussian kernel sigma = 1.5 cells — the square-lattice convention carried
// over unit-for-unit. Deterministic: mulberry32 with a fixed seed.
// Output: base64(Uint16 ranks, row-major over r*N+q) printed + written to
// tools/mask64.b64.txt, to be baked into hexdither.ts as a constant.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const N = 64; // side
const M = N * N; // 4096 cells
const SIGMA = 1.5;
const SEED = 0x6a0dbeef;

function mulberry32(a) {
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// kernel offsets on the hex torus: 0 < h <= 16
const KERNEL = [];
for (let dq = -5; dq <= 5; dq++) {
	for (let dr = -5; dr <= 5; dr++) {
		const h = dq * dq + dq * dr + dr * dr;
		if (h > 0 && h <= 16) KERNEL.push([dq, dr, Math.exp(-h / (2 * SIGMA * SIGMA))]);
	}
}
const idx = (q, r) => (((r % N) + N) % N) * N + (((q % N) + N) % N);

let D = new Float64Array(M);
let on = new Uint8Array(M);

function stamp(q, r, sign) {
	for (const [dq, dr, w] of KERNEL) D[idx(q + dq, r + dr)] += sign * w;
	D[idx(q, r)] += sign; // self-energy
}

function recompute() {
	D.fill(0);
	for (let i = 0; i < M; i++) if (on[i]) stamp(i % N, Math.floor(i / N), +1);
}

function argExt(wantOn, max, skipRanked) {
	let best = -1;
	let bestV = max ? -Infinity : Infinity;
	for (let i = 0; i < M; i++) {
		if (on[i] !== wantOn) continue;
		if (skipRanked && ranked[i]) continue;
		const v = D[i];
		if (max ? v > bestV : v < bestV) {
			bestV = v;
			best = i;
		}
	}
	return [best, bestV];
}

// ── phase A: refine a random 50% pattern ────────────────────────────────────
const rnd = mulberry32(SEED);
{
	let placed = 0;
	while (placed < M / 2) {
		const i = Math.floor(rnd() * M);
		if (!on[i]) {
			on[i] = 1;
			stamp(i % N, Math.floor(i / N), +1);
			placed++;
		}
	}
}
// kernel weight between two cells (self = 1, beyond kernel radius = 0)
const wBetween = new Map();
for (let dq = -5; dq <= 5; dq++) {
	for (let dr = -5; dr <= 5; dr++) {
		const h = dq * dq + dq * dr + dr * dr;
		wBetween.set(dq * 1000 + dr, h <= 16 ? Math.exp(-h / (2 * SIGMA * SIGMA)) : 0);
	}
}

let swaps = 0;
const ranked = new Uint8Array(M);
for (;;) {
	const [c] = argExt(1, true, false);
	const [v] = argExt(0, false, false);
	// accept the move only while it strictly reduces total pair energy:
	// new contribution of v (excluding c) vs old contribution of c (excluding self)
	const cq = c % N;
	const cr = Math.floor(c / N);
	const vq = v % N;
	const vr = Math.floor(v / N);
	const wcv = wBetween.get((cq - vq) * 1000 + (cr - vr)) ?? 0;
	if (D[c] - 1 <= D[v] - wcv + 1e-12) break;
	stamp(cq, cr, -1);
	on[c] = 0;
	stamp(vq, vr, +1);
	on[v] = 1;
	swaps++;
	if (swaps > 200000) break;
}

// neighbour-density receipt at 50%: blue noise keeps 1-ring energy low
let nbSum = 0;
for (let i = 0; i < M; i++) {
	if (!on[i]) continue;
	for (const [dq, dr] of [
		[1, 0],
		[1, -1],
		[0, -1],
		[-1, 0],
		[-1, 1],
		[0, 1],
	]) {
		nbSum += on[idx((i % N) + dq, Math.floor(i / N) + dr)];
	}
}
const onCount = on.reduce((s, v) => s + v, 0);

// ── phase B: rank removal, tightest cluster first ───────────────────────────
const rank = new Uint16Array(M);
let remaining = onCount;
for (let i = remaining - 1; i >= 0; i--) {
	const [c] = argExt(1, true, false);
	rank[c] = i;
	ranked[c] = 1;
	stamp(c % N, Math.floor(c / N), -1);
	on[c] = 0;
}
// ── phase C: rank filling, largest void first ───────────────────────────────
// candidates are unranked OFF cells only — cells ranked in phase B are done
for (let i = onCount; i < M; i++) {
	const [v] = argExt(0, false, true);
	rank[v] = i;
	ranked[v] = 1;
	stamp(v % N, Math.floor(v / N), +1);
	on[v] = 1;
}

// integrity: ranks are a permutation of 0..M-1
const seen = new Uint8Array(M);
let permOK = true;
for (let i = 0; i < M; i++) {
	if (rank[i] >= M || seen[rank[i]]) permOK = false;
	seen[rank[i]] = 1;
}

const b64 = Buffer.from(new Uint16Array(rank).buffer).toString("base64");
writeFileSync(join(HERE, "mask64.b64.txt"), b64);
console.log(`mask: side=${N} cells=${M} seed=${SEED.toString(16)} swaps=${swaps} converged=${swaps <= 150000}`);
console.log(`receipt: 50% pattern neighbour-density=${(nbSum / onCount).toFixed(3)} (random-50% baseline = 3.000; structured hex floor ~2.5 — the triangular lattice is not bipartite, so square-style ~0 is impossible at 50%)`);
console.log(`receipt: rank permutation ok=${permOK}`);
console.log(`bake this into hexdither.ts VOID_CLUSTER_HEX_64_B64 (${b64.length} chars):`);
console.log(b64);
