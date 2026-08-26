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
// PROVENANCE OF THE COEFFICIENT TABLE: the brief carrying the paper's verified
// table did not reach this lane (searched the repo, the shared checkout, and
// public sources — nothing published). The algorithm is exact; the numbers
// below are the paper's constant-weight baseline geometry (7/16, 3/16, 3/16,
// renormalized to sum 1). The verified table drops into JODOIN_TRIPLES — one
// constant, one place — without touching anything else.
//
// ── METHOD 2: ordered dither ─────────────────────────────────────────────────
// There is NO native hex Bayer. A void-and-cluster (Ulichney 1993) blue-noise
// threshold mask was generated OFFLINE over hex axial coordinates (64x64
// tileable rhombus patch, sigma 1.5, deterministic seed 0x6a0dbeef, converged)
// by tools/gen-voidcluster.mjs and is baked in below as a constant.

import { axialKey, type Orientation } from "./hexcoords.js";
import type { Ok3 } from "./hexresample.js";

export interface DitherCell {
	q: number;
	r: number;
	ok: Ok3;
}

export type Quantizer = (ok: Ok3) => Ok3;

// ── tone-dependent coefficient table ────────────────────────────────────────

export const JODOIN_PROVENANCE =
	"constant-weight baseline (7/16,3/16,3/16)/13 pending the paper's verified table — see hexdither.ts header";

/** 128 triples [wForward(d10), wBelow1(d-11), wBelow2(d01)], each summing to 1. */
export const JODOIN_TRIPLES: Float64Array = buildUniformTriples(7 / 13, 3 / 13, 3 / 13);

function buildUniformTriples(wf: number, wm: number, wo: number): Float64Array {
	const t = new Float64Array(128 * 3);
	for (let i = 0; i < 128; i++) {
		t[i * 3] = wf;
		t[i * 3 + 1] = wm;
		t[i * 3 + 2] = wo;
	}
	return t;
}

/** Tone level 0-255 of a diffused value -> table row 0-127 (mirrored). */
export function toneIndex(ok: Ok3): number {
	const l = ok.L < 0 ? 0 : ok.L > 1 ? 1 : ok.L;
	const i = Math.round(l * 255);
	return i > 127 ? 255 - i : i;
}

// ── method 1: serpentine tone-dependent diffusion ───────────────────────────

export interface DiffuseOpts {
	orientation?: Orientation;
	/** Float64Array of 128*3 weights; defaults to JODOIN_TRIPLES */
	weights?: Float64Array;
}

// Downstream targets per orientation and scan direction. Entry layout:
// [dq, dr, weightSlot] with slot 0 = forward (d10), 1 = below-1 (d-11),
// 2 = below-2 (d01). Mirrored lines negate the forward step and swap the two
// below-neighbour targets, exactly as the brief specifies.
const DOWNSTREAM: Record<"pointy" | "flat", { normal: number[][]; mirrored: number[][] }> = {
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
export function diffuseHexError(
	cells: DitherCell[],
	quantize: Quantizer,
	opts: DiffuseOpts = {},
): Map<string, Ok3> {
	const orientation = opts.orientation ?? "pointy";
	const weights = opts.weights ?? JODOIN_TRIPLES;

	// lines: pointy scans rows of constant r (ordered by q), flat scans
	// columns of constant q (ordered by r)
	const lines = new Map<number, DitherCell[]>();
	for (const c of cells) {
		const k = orientation === "pointy" ? c.r : c.q;
		let line = lines.get(k);
		if (!line) lines.set(k, (line = []));
		line.push(c);
	}
	const sortedLines = [...lines.entries()].sort((A, B) => A[0] - B[0]);

	const has = new Set(cells.map((c) => axialKey(c.q, c.r)));
	const buf = new Map<string, Float64Array>();
	const out = new Map<string, Ok3>();

	sortedLines.forEach(([lineKey, line], lineOrdinal) => {
		line.sort((A, B) => (orientation === "pointy" ? A.q - B.q : A.r - B.r));
		const order = lineOrdinal % 2 === 0 ? line : line.slice().reverse();
		const targets = DOWNSTREAM[orientation][lineOrdinal % 2 === 0 ? "normal" : "mirrored"];
		for (const cell of order) {
			const k = axialKey(cell.q, cell.r);
			const e = buf.get(k);
			const v: Ok3 = e ? { L: cell.ok.L + e[0], a: cell.ok.a + e[1], b: cell.ok.b + e[2] } : cell.ok;
			const chosen = quantize(v);
			out.set(k, chosen);
			const eL = v.L - chosen.L;
			const ea = v.a - chosen.a;
			const eb = v.b - chosen.b;
			const i = toneIndex(v);
			for (const [dq, dr, slot] of targets) {
				const w = weights[i * 3 + slot];
				if (w <= 1e-9) continue;
				const tq = cell.q + dq;
				const tr = cell.r + dr;
				const tk = axialKey(tq, tr);
				if (!has.has(tk)) continue; // outside the grid: boundary error drops
				let t = buf.get(tk);
				if (!t) buf.set(tk, (t = new Float64Array(3)));
				t[0] += eL * w;
				t[1] += ea * w;
				t[2] += eb * w;
			}
		}
	});
	return out;
}

// ── method 2: ordered dither on the baked hex blue-noise mask ────────────────

export const MASK_SIDE = 64;
export const MASK_CELLS = MASK_SIDE * MASK_SIDE;

/** base64(Uint16 ranks, row-major over r*MASK_SIDE+q) — generated offline, deterministic. */
export const VOID_CLUSTER_HEX_64_B64 = "FwkPBJoFwQlQDm8AaATSCf4NTgf8BNsMBgG6CPwNmAB/DSAEygzzCgEI0AVLBwQK2AGKBhMMRg6fBOwFAg93CgkA3Q0tDzMBiA3UAucGUwLMA4cAlw72BKML/A8lAW8IHAKyD24JOQdSAN8F3QgIB0kCcAjqBXEKfgP+D1AB7g2TB7UMdQ+5A0EHHw2TBTsMIQF9CEcDGAb4C5QCAwraB48IzAYwBWIBtAMHDPsCLg/XDJAK/AjIBwwKPQHjC58GJgQ9C2cGggjFBcoJMQ2hCNsN5godB4IN9wWrCnsOlwMwDBgEYwLEDA8K1QEsDFsPyAP0DeYLXgLWCPwKJQYJA+4AgAgeAgkLSAnMAYcKaQawAvwOswmpB4EEzA6FBS8BUgNHDncJ/w41C8MArAgWBUsAeQLyA/oBag0lBVsD0wjyDPkBdwM9DicAwASdAaoHlwTEArIIIwBNBDwNaQeOBfcNmAbWCpgDRA6LBDcNeQlPAeYEGw0kD2IE8QHICZEOKAW5DVwG6gLYB2QO7ANSDSYLPwB1DZ4BOwuWBigN1Ao8DJwCHwcIDR0G+ge9CYwN/gVMC2cPygZNCWEOtQcCAYoPfQl8B/kKAA+GCzUGWQzPCe0OMAKJDFIJnAEkChgAywgxAccONwi/BowKPgDsB6YGsAmOAKwF3QdoDcUGaguKAewLCQ/FBA4IuwCxDwcJoATKBY8PDwjFA08JFwJ3DyMKAQBmBFcK4Q1tAUAEcgeJDnQIJwzJAOEKaAJTDHcFXAqsBH8M9wIhCasPgwOiAIEFIgvGBnAPNwNTBloL9QfRC9IExAduAQ0DaQVmDjoLHQSiDqwKrwwACCIAUANMCusDfAkNAccMjwaHCyEC+QbqCzoKhwK8DDEAeA6hBOYF8AcBCbwBbwU5A3MMwApmA4sB6AQbAxgPgAQKCOsG+g17AlMBowY5BSMBsg0nCFIOwgfYA14KAwUECBUP9QJMBGYNAAZEDBMP8QjxC8gCEgjKAWYHiAM5AuELvwTJDl0H4wWeCikOQQNwBdEJrw7NA0EBKw4EBdoPxgstB2AIjgNiDa4LiQ8dCPEGJw/6CDYNSwbJDO8JGQaOCw4A/gM4C74OWQhYDfMJKwe9CpkCIgzvAIoNvwG8C8EAyA1MCQACGQoIAAsL2QOCB4QBKAanDWQMSwneBm8P/AkKBscIBQ38BzcCAAkrDKwHdgD+DLYIiAcyBqEJLAObChMBewz9AXwGvwIYDjAAwAtmAucAqwnsD4EA5A0aAngPFA0aCdQF8gchAMsL3QMPAusFlQTeCB8GewmVDlkHiQWDDLwGng+YCMwClA2iBQMN2wk9D0wDdQX3ADQEGQ4nAU8MKgMsAH0LDgdpBG8CvwoUBe8CegwnC9kAog2bBhsEBw5GCuAOtQQUC/YJIQRtBi0FWQ7BAyMLvwiJBxwFNQpDA4ABJQyVA98EaA83DqwM5w5wC1gPkwN4DDcEdAI3CkUBnwNEBVEO2gZnCbMAywpzBBIArQuPCl8N9gjWAqEHwQqDDwIFvwAeDYcPXgh1DlQGog+9ATgENQhOAvQHNAkaBW4AvghKB0gB8Q97DX4KsgcADAMHTQVXA2oMGQFeDiQHnw24CbcGoAqiCMQAYAllAQUDIQdKAMwK4g/QCNQORAvlDIIKAQE/BOsPcgL9DSMHrgjDB8oOYQZ1C4AFAgLSDToIpw5tCboFtgGEDeQAPQlrCqYFIw/iC/kMswWrAu0PaQsVDRMDnQXNCMYA3wJICEcBPgIZD5AJZQZ7CKgEuQqMAvMPqgEVA2UFmga9B04KDA6FCEYFEw0tBn4AjgSGBzECVg+dC44Mcgg3BvcLPQXcAuAB2gSfACMNywmwBlsBQAorBDYDBgupBlYEpQtWAzwOAAcrALYKewELD0cMbAYHBHMOwAnBDDoPfAv5DX4EpQyBCnINrAJGC9gPhACCBdoIVw5KDKgN4woGBDoMvAUgAgEKkAEMA7EL6g07CMsFsQkkAyIFtQ5qA7sBeAlxDzEKsAw8CGUD1A/fA30MxgJVBvIL3w64DP0JiAJaB6QMwAjlBAYO0gPxCYwICQFqChsC4waWAZoDRwWgBnQJ2A78BUYAuwclBBICXQzRDnILPASjAJ0JkQ+KAkUATA2GBOEH1A1AD44JAQd9A7ABfQ33BgoJLgEQCtMHWQ0KARwOQwTkBiwLeg7lCNcEFQtsD2QNPAHrCEkAxA+9DVUF3AH9AmEJwQceBjUNRQM2DkEFGAg1DPMH+Al/AnsAhwccAwgJ1wunBa8NKQmJBmMBOw0TBmQHrQTNCx8I6g88CaILcgYAC1UE8gCQDNcP4AoqAIEO7gySBrQE5ArUA1gGpwslAEYPwwL7AC4HHQ49AKkIKgVuB24GzgR/CLkA3Qr3D2AMDgGzCzMC2QQ1B38Lnw9xAH8ESQu9Dg4N7wtZCkkETA7WAUUKIA/nAwoKMANMCFUCgA6RAekFsQ4IA6cBrgM8AGsIlwWyDi8K6gT/CzsEsQJeC0QPFwCMDAgIgAI4CY0F+wkWDMYFegmdA7kHIwKJCugDRA1FC8AOTAajCewOcAS+BoAKuA+KAKIJkAOZDUcJRAYUATgI0QRgBocBjQ9OCPUG/gRcAPsMKQe6D/sKdAwECewGJwoyBbQKSAeZDLwPVA1LA+AIUQJDBv0ODAjaBQ0C7QjADU4FqAfxDugMtQGfB9cN7wEMDSkKDwZNDsULqAKUAYQDQQwkBEsBjQ0DCBEDpA65CN4NXgy7BbwChAcyDuQDqQ9WAtANVQupAAsN8gIgDKUIRgIvBR8OUARRALADxQ3qADIMOA7cCAkGgQK+C8IGUgHWB4oJ7QB9ChIO/QMWBwcDZAphAakE3AqWAzkIOQRgC68P7gKgDBABhA/oCTcHJwknAqYHmQqyBbgA0QxPBakBdQatCn4B9wwdCukBFwubCTwH6QjtBZsE9A/lCgsGUA+0C9AASgqUBxENVwuTAqcPDASnALME6wkgAU4Ohgq5DIcEfA04A3sHCwynCdQAqA5RDIgGpg3+BlkPUACnBtgEtgBbCG8EOwncDdkFwQ9IBe0N3wuXAmIHgAmFCwQElgciA9MOPQgZBRQM+wU9Dc8AeAPGDK0CwgmKDhgBmwN0DXIJTwP/BeoOhAmZBR4IWQayCTMPkw0SCw4EawV2D3QDTgs2DysFQgEmBl8PkQu3CNcDgwD1CKcCXwpwDBsJjA7tCtsG1wcgBZEAlQywChUAqgiqBC8PYA1zA44PRAoGCQQA+g8tBPgAEwfxAlcFBw9oCpAH+wsWAuQInAezCoMBwwZpCAwCvQQ6AVcHQw2+AdMLLQL7Bv8HQQmvADAI/AaAAPsI/gpPDeoBdASbBXcC4gnLDrYLXAWWDS4C0gUpDbgDmAFYC14DZwhpAl0OQgO1BisKAQL4BXgAKg7BBIMNzAvqCsINPgm5DpsIuQs1BGkADQ5oBeIGZAQbDpUFxg9fDKsNoQoODG8DcQ7wCmEFuwN1CM4FAANnDTcMBQLlBdIMtQKIDi4IlgqjB8oN1g+9DD8GKAGxA/UOfwdNAYEJ4g6EDCgKcAYPD5oLmgneDNsAYwzfCBYLxAZVDFIC4QWpA5cGkQLVD7UKFAKADWIGWghrASsLogwFAAkKFgSEAhYPEQCBBpoPuwjNALQHtAxTDmEAsAvmDr4EHwoeDosJ3geYBBAH/gKaDJYA7gqkAUIEzAcZC3MIBwqMBMcLtgJbBfkPRQL/DOED7wUXBb4H4w1xBJ4OwgJtCDAB1QlsB8cAFgpyDE8AXgfhBM4JUw+/A4MJEA8EAyUIIg1NC0QJegXEA+kJagKcBBIK3gI6CeQPUwqBAXsGcwKBB9YDxQGkC0QAfwVzCfkD4AYqCLAFbAkODlwClAaJAHoP2Q15CDsALg5QCfYAWwcfAi8IeQOSCiQB0gczBcwPRQ0KD9IILA62BBEGvANDDpcBlwx1At0LrgQcBv0PwAGHBj4BpAflCzoOAA34Bv4LOAZdAeMEKg0uBMwINwuSDiMFeQqVDcQI9w77D2YBqg6oCy8DjA86AO0L+QRJDU0D1QoEBiIHRAQFC8gEbg9jCrcOfAGkBrkFawnuC2QD9gpfBOgCHQzGAT8ILg3/Cs4I3g+YBVIHSw6eAIUK1Q34BMIOdQOKCAgBDgUeCWgAhQ0hD18LywY9ArAH4QwHAHYIVAz5AJkGaAM/DB4Kow3dBCsCRwotDdUDRAdtCv0I2QfIAdwJDAxeAYYNoAg9DGYAvwvwD4QLWQKLDQ0AJQmcBlYBewpqBbYHEg+bAscG4gBZCzkKTgHjCHkM9AOPCQoMpwrJBjIPPwv3AYQOtwoFBHgIFAPNDmQJWgW+A98G2AKkD60FKA7TCoUC/QW4CKkMkQbjDtUI4QGtDpwFCwHCDBMFhQ5YA40HxwXOAhUHIwQLDucJQw8SBP8GIg55BZsPBw3GDlMDdguZAAAKGQTwDUQD5ARXDYUG+wEnBw4DhgCPDYsCfAQNBukPNQOjBWgHtACICm8M4wBgClMN+w5ICzoCmAnNBLoAKAcUBGQArgdJAQgGIAuEBBIMQg8DBEoLOwLmCAUPSwqxAfoMIQbwCLkCtQB+CJIMLAoIAnkLIQgMAIAGZQmPBEYM0wXWDKcHNAhdD7oC7AryDiYIbw54BTUJWgodDRAITgx/AVMJ+w0VBXoGPg7dD6wB6AXhCHgEowzGB0oIDQ0uC1wPhQkoDKsDMw6kAMwJegJPCFMHzw1+BoIAegvmA6YPxAkxC8cECQ07BWwODAG7BM0HwAJBBBQKxg1pAVYHpg4QCfgBfQACBt8JiASeB/AAAQacDOIBVAcAAKQDiwYhCn4P3wyLC8IBIgQtCLcLKwP6CZIAGQdUASYDow/OATkOAQOvCjYFNgi/DH4H7w1dBmMApQmFA54MdAUGCLwNqwBtA7oO9QHIBlEDDgtFBvMIsgyYDucLiwV7D5QItwIxBdsLJQ8CC/gMhQEFDJENMgqACwsExQ4yCwMOzweDArcEVwB6AxcP1gmiAkwHzwSlDSQMuw66CgkOmAtMBSAJogR+DbMBvw9MAsAFYAPvChANZwSLCjkPvQI6B40E2gt2B3sFdwxsCvEHcAFCDH8PkQPYAEcHpgEnAw8LUQ3gAPIJcgO7BtMDXw7RCDsDVAVkAqUPjgjsBGwBXQnPC20OEQv9BtkITQ3iBcUKNgCTD18GowOvBS4J8QOyBlIKlQBWBmEHoAvtCa4OCwl1AR4Fmg7eAdwHDwkuDC0BKg9DCdICFgg1AAQPdgnLDWcC3gnBBsoKyQjrDGYGAgSzDwwHMA5NApQJDAVOADsHTQ9OCcAA+gbkAtUMXgZLBf8Ahwi3BVcC2Q/RAOkH9gxRCTUCgQgXAbQP5AGWDGECkw5ADJ0IjAMcAO4G8AN2DOYPlQjgC/kFqgAKDkAG5wrEAXwOdga4Db0LKQTyBZEKngRGDW0FEw6DBMMJKQBbDHMKwwScCCsN9Q/WCzMGEwt1BBYOGgzqCfgPpgomAjoNqg/7A24MZQpYBN4LWQNdBXcLkA4XDTgK9wSqDWEIzQ/EBUMBbQ/xDOkEGAsDAVYKywLVBsMDQgsHBXAC3QncA6QFJQo7AZgHjQKmCFUHzQFACGAA1wLFB/QB9A5BCLEFjwFbC7AA1g7yAUIIiQLcDGcBgwbRA2wAlg7oCHADLwfNCboNSgElDlAGRwh6AUkPEwTNBhoD3AuMB9IAkgR+C90CxwpcCYYONAadDUMHIA40AOwMyQnhDhsIiQ3fBxAMGQ1GBBALGAXFDMwAWw75Dl0LlQ8OCogLmA3QBmIC8w3lA5kHeAaNCi8EzQ1QCs4O1AhRC3AN8QVqBFoM2QpIAPQCtAYOCQYC0g7uCR4HmAq4AX8JawArBvoKWgN+CYcN5gcRBMEBnQJ3CFwEYgmGBVcP/gFcB+EAhgOrBjkAqwgDAicODAkiD+8DqwvBBbMMwANKBjQBhAVJA5wK3w8tCQ0M8AKfDFYFbQcEAdgF4QLTBAQCSwiDB2QBUg/VBHkOGgtRBZMLmQTnDEMArA36BBcOUgw0D+oIgg49B30BHQWqBhgMfApOD8oLrQFdA9gK1wiKBKEMfwqhCykFTw8fA18HLgZbAHQKrQaZCQ8D7gRZCYcOnwhLDDoE8wzeAKwO1QXDCF8AaAl7A8MPvwm3BwwPQwwpA7ANtQknBjEI7wz8AEUPiwdsA9sF/AuWAkMIugdiBaYDHQLnBT4KnQwjCK4A6w2fBSAA7gduDVYMFAZPDr4CtgW1Dy8CqgloDsIK+guJA0sNRwJyD2ABegecAEcNMgImB0cA9gfhCckE9QqfAf8NPw+ZC2ENWAwUAM0KUgULCssAXAuhAxMC5Af1A5cJnwKXCN8Krg85CVEGZwM3ARUKWg3DCxsALQ6jAqEPewQSCa0D5gasCfUEpQCtB2YLTAGwCPYNbQx9BLEAoQWICdAPGQh9BaANswjQCmoPqQukBAcL2wgsBiQCCQfPA9sHNgq5BEICKwhKBMAGuQExDhgHvQW/Dq0M8AZICvYFUA2sACMO2wFjBLwA2gyBC0IOiQRjCJIP/wMfC/YG+QnYDNAOYgu4Aq0PVAggAycNkgkgB6UDFQGSB1MI/QxzAaYEyQIfDPUAgwuPA6UG1gUhA9oO0w38AiwN6wtkCLoMmgJ9BjIBMAdWDhIDBQnDDPcDtAhsAkYJJAB0C5IBDg+vC+IEQAf1CdYNBQeJCbcPcQbTAGUHNwVFCaMBjwUdA9YAPgYwCrYNEAK7Co4G/AMwD2YKKQYoC8oCdAbrDhwHpAqODm8HTwQkDl8C9wkUCLMHCAqTATQFvQ8KANUOpQUdCb8N2gonBf8JQQ85C40A5wcaDesEnA9bBOgNAwPuCGsGjwznAlEPNAsKBegB5gLSCnwMcQIBDUwPVA6JC78HHAjLAWMFEQxOBOUOugGGDFoAsgReDWMPBQrtAXgLuw18ABwJTQagCfgHRQw2Ac8MwgDhBmgLSQlxA3YKbwFQC5kD8g/ODPQAIwYqAjwFnw6qCngB9AlXDEYIqAXhD6wDgwpeAAII0AP6AEINmggsBAYPxgk2BrcDtQgcAW8NGgRrDFoOQgDPBhQJ7A18BSAI1As0Ag0JHASYDHYDvQguBT8DBwLUDB8A4AS2Ds4DkAKWBTcPKATpDRsHXQ3bBGMHfwCvCPYDcQ3ABwYMaghOAw4GagelAqgGtwANC+MBMw2zDnYFMQwgBvYOnQpCB8cN1AGfC1YAvAqNBm4CYgobBU0HVAlmD5YLyAAuCtECuw9VDrgGRQVZAOsHBwarDmYMLQqFD7UFkwgdC/MGbwm+ChUMlgigAAMGuwkYAhEPfgxuCmUCZwsfCaADuQY1AbEN2QvkDukD4wydDsUJlATHB2MJpQHPDyoJLgNQBZcA/wgFBZEH8Q3UBMsPZgkbDwIDBAvjA20CEQWuDOAHGgaaCh8BNgzODegKngkpARAE0gZ5DdEK4wJ2AZcNegQvDqcD8wFwDocMOgPCCyQI0AJ+BYYP1AawDigAFA4aCgYF8ghVAMgKcAnyBGsHHAzpADID7QYBC10CAQ5vCwINkAY4DwsDMwgmDIADuwwvAMwNeQFqBjANowgzB7IDVwFqCUgDjwcVCN4O4AJYB+gLXwjcAL0DUQcND/0LFwY4AMkPeQbmCQsFxw8aATQOLwacCYENjAGCBM8F6QpUAsAMlg8iAt0FGg4SAXgCBgaLCD8OGAqSDUgEggbmALoJQQJIDJ8KJgHBDpUBMgfgBYwLGgj5B5MK/g6oAVMLkA8mDg8FHgv6A9kBvARKDQoCnQ/zBUUO+Aj7BIwJKAJPClAIqAzqB2ACyAgcC3YEeQdNANAEkgtRCAQNlgkxDxcHWQR7C7gHlANSCLkPtQ1uA1ILCAUmAJsMKAivB8QEfA/JA8MFkA02BOUJMwvvCAkCVwReBZoARgMkBuMJkQSICBgNmwBrD4QGQQq/BREJCgttBNUCZQtUAKYMPQNpDzQHxgTfANULCge6Az4N/gkeDPgOPgPjDxYBtAIKBK0ARQj6AtcJpwyvBqoLXQpYAaEGCA+zAskFyA6rAekLOw6RCEEAWgkSB2wFSw9AA2UOIA1zDwIMIglpDukMXQAqDBUC1wXJC9gI5QAhDCYPWADBDbkJ5gy8BzoGoQ4wBJQLyQF4DXgKWQUGAFoPoAGTBj8CGAmoCgQHGQygBzwLrg2gBaUOiAANBaIBMg2rBIgM7AjvByMMaQneA3oKzQKzBj4L4A/IC30CEg11AJ4Gtwm7AhcKDwfmAT8FqAPdDrYGvgnYDa8CjQ4GDSUDOAf/BFgC0QZRAUMK6wGeCAAOkQVbCQYD8A4WCaUK5AV8CIsOXQSpDQwG7wScDucIQQZoDNEB1wpUDygJNAN4B9QJywPoAIoKGQJXBtwPzgBtDe0EVQMFDv0AvAiiBzQMEAUAATEG7gPRDWQLEQhVCv0H/wJaBJoHdQndBj4EhghwCrgLqQ4FCF4PSgVQDPcKZwCZD2gGKgTQDFAC3w35AkcLvgCrDJUCLgACChcDVQGvBHMHrQgABGkN8AVYDkAAkgXEDQ0HXgQVDpsLwgieBakJXAEcChsGbgSpCrMDXQgpC5sOgQyyALEHkgJkBvEAnA3PCh4AkAV0Aa4K/AF5DxsBOQaeA4UEPw3iAowGygPQCWIMKQgRAY8OygQpDPYPSQXaCYIPegj1DdAL0w9hCmAOoAIIDOkGWgJxC5kIfQ+qAk8LZgj1DBAAggP6DosMRQcXDNUHxA7ZDIIBKQ+3Da4B5w+nCMMKZQRODawLcgXKCIAMwA+PC9YE+wcCDmAFaw2CCWIAQAs2CYkB7w5wB6kCtAHvD0sLUAd3AVYJjQNgB5wL+AOFB8cBYQTNDB0AVQnIBesA8AnSD9MBogq3DEIGhgG2DyYFdwczClsCVARECA4CKAM3CYwFcQflApAEjQlhA7QF2w4xCc8BOw8zBDYCQQ5JCFYN8wIEDPcIYgNsDG4O9wcCB8kNcgrdDHEFSQ40CvUFnAPYCQMPWw0lAkgG8wAvDXMFkQncBosDZQ8tCwgOmgSNDK8DLAdLBCsJ2Q6iA60JGwtoAWMG2g0PANwFYw39CnMA+Qs8CjsGJg3lBkoCXAyFABEHXwOmCYAHfwaKA9cAIgYTChMA2AahAWkKngIABSIBRwRxCJ0ApgunBJ4NUwD0DHcGlAAsCLIKaw4ZCfgCKgsUDwsIgwUcDRADlwdiCHQODwHCBXYNdwC6C9EFmALPDrEMIwnlD9gLGg/MBAsHEA5DAgMJjwBrC+IH0wmwBEAOzAz4CvINcQE9CmIPLwmgDpsHdwRuC4gP7gWxCD4Mwg8FBlwDiw/5CCMDlQeSCCELMQSUBaoMlgSyAWEMFgaTAE8CMwxGAVoGsQplAFMFnwkDDD4PSwJbCgYHww2DCO0DCQXPApcKxgOGCR4BFwgBBNEPlAz9BGMOBQElCz0GPggkBQIAGwyKBWwLUQTaAWkMdgJcCDkN6gOhACEOqAksAvAL7wbiCucBhQw4BUQBdg7KB4YCKw/TBqwPTQp6DWcOxwnQBx4EAgmCAuoMlA/rChgDjQjeBFwOOQFNDBYARw9hC0YH1wFGBuIMsgLcDmYF2wqbAVUI4gMoD9MCQAGwDxYD9AjDDn4CFAclDb4FuAohBegO7AnjB64G9gKjCu4Omw0/ASoGAQ+0CeYN7QImCfQLrgkaAIkIVANFBDYH8QTbAlQKvg+UDrEGFwTQARAGnQfgDGsDEwlABXQHhwkWDf4AbghiDlEKfQeeC0EN2QZjA60NbwbwDBUJLww7CqQNrAYIBOQMkAhyAK8JBA69AAcHGQPfAcQLDw2uBUwAqAjCA3EJUwSKC0gCTwbECuoG4APxCucNqwXSC/ABzwiCCzcAsw0PDHIBbQswCb4NkACECoYG5QGBD94KQAKVBqoFUgRJDDEDAQWIAeQJeQBfCcsHZwpEAogFPgedBN0B0Qe8CSsBPA/nBOgHgQN0D/MLLAlqDvAEbAg9BEMLPwdCBbYM7g8zAGcH/Ay6BLgOagE0DdoCzgcdAQ0Kyg/TDM0F8gZrBAcINQXoD6QCzgtgBB0Ptgn1CycEcw08AxEKmQ7tBy0AbA3GCLYDLA+xBMECfw4ZAAgLZA9pAyQNzgq4BcEL2QIkCz8KKQLBCHIEjgHeBQwLBwGYD+UN0gFKD6YCjgoPDk0IfwMgCsUAhAjIDxIFAQxXCTgNUgbaAKoD6Q6VCTMDqABCCnIO9AZXCFkBZQ2pBXQADQjFD+QLOAHiCC8Luga0DvoFigz0CkkGxQhMDNwEkwnsAGUI1w5wAGwEXA1OBnUH4g1zC70GIQ1JCrQNKgeOAgYKfANACZUL1QCiBocF7gGXDy0MzAVjC/8Bcwa1AzwCwgSDDmgIxgrsAZEMjgdADfQFkgN1DGcF8grpAn0OSQeaAcsE+A3zA6ECOgWUCnwCqwcsAY4NCwKAD9sD1wZIDo0LRwbsAkoJdw4TCMMBCQTdAG4FrgKKBwsAFQT+CMsMpQc8BoIMfg55BOAJVQ1YCTIETwceAzUOGwrzDhoHVQ9YCscCoQ30BM4PMAYDC68BCQkDAP4HOAJhDz8JcQwSBm8KXglbBjgMHA9CCaYAlwtYCF8F2QklBzYLmQEKDVgFEQJnDDEH/w/KAB8F7QwyCWAPkwwJCB8POQxkBbwOegClBF8BVggKA8kHKgG7C6MOMgC+DDMJkwSLACIIVgttAAkMzgZaAbILpAiPAkgPHwRUC0oOKgrWBscD8wRBC2sCNQ9qANQH9gFIDaMEEQ4NBKAPLQOMAMgMMgjrAuUHJAm4BCIK2gP2C5UKqA+1CxUGJgq3AYcDpAnFAp0GkAt1CncNPgUeDzAL4A1KA0MFyQrbD40B6AaaDWUMLAU=";

/** Pure base64 decoder — no atob, works anywhere. */
export function decodeBase64ToUint16(b64: string): Uint16Array {
	const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	const rev = new Int16Array(128).fill(-1);
	for (let i = 0; i < A.length; i++) rev[A.charCodeAt(i)] = i;
	let bytes = [];
	for (let i = 0; i < b64.length; i += 4) {
		const n =
			(rev[b64.charCodeAt(i)] << 18) |
			(rev[b64.charCodeAt(i + 1)] << 12) |
			((rev[b64.charCodeAt(i + 2) ?? 65] & 0xff) << 6) |
			(rev[b64.charCodeAt(i + 3) ?? 65] & 0xff);
		bytes.push((n >> 16) & 0xff, (n >> 8) & 0xff);
		if (b64.charCodeAt(i + 2) !== 61 /* = */) bytes.push(n & 0xff);
	}
	const u8 = new Uint8Array(bytes);
	return new Uint16Array(u8.buffer, 0, u8.length >> 1);
}

let maskCache: Uint16Array | null = null;

/** The baked void-and-cluster rank mask, decoded once. */
export function voidClusterMask(): Uint16Array {
	if (!maskCache) maskCache = decodeBase64ToUint16(VOID_CLUSTER_HEX_64_B64);
	return maskCache;
}

export interface OrderedOpts {
	orientation?: Orientation;
	/**
	 * Sorted palette lightness rungs (Oklab L ascending) — defines the local
	 * rung gap the threshold perturbs within. Without it no perturbation
	 * happens (ordered dither degenerates to plain quantization).
	 */
	ladder?: number[];
}

/**
 * Ordered blue-noise dither over hex coordinates: threshold t=(rank+0.5)/M
 * from the baked mask, cell lightness perturbed by (t-0.5)*rungGap, then
 * handed to the EXISTING quantizer unchanged.
 */
export function orderedDitherHex(
	cells: DitherCell[],
	quantize: Quantizer,
	opts: OrderedOpts = {},
): Map<string, Ok3> {
	const mask = voidClusterMask();
	const out = new Map<string, Ok3>();
	const ladder = opts.ladder;
	for (const cell of cells) {
		const k = axialKey(cell.q, cell.r);
		const mq = ((cell.q % MASK_SIDE) + MASK_SIDE) % MASK_SIDE;
		const mr = ((cell.r % MASK_SIDE) + MASK_SIDE) % MASK_SIDE;
		const t = (mask[mr * MASK_SIDE + mq] + 0.5) / MASK_CELLS;
		let L = cell.ok.L < 0 ? 0 : cell.ok.L > 1 ? 1 : cell.ok.L;
		if (ladder && ladder.length > 1) {
			// clamp into the ladder, then perturb within the bracketing rung gap
			if (L < ladder[0]) L = ladder[0];
			if (L > ladder[ladder.length - 1]) L = ladder[ladder.length - 1];
			let lo = 0;
			for (let i = 0; i < ladder.length; i++) if (ladder[i] <= L) lo = i;
			const hi = Math.min(lo + 1, ladder.length - 1);
			const gap = ladder[hi] - ladder[lo];
			L = L + (t - 0.5) * gap;
			if (L < 0) L = 0;
			if (L > 1) L = 1;
		}
		out.set(k, quantize({ L, a: cell.ok.a, b: cell.ok.b }));
	}
	return out;
}
