// hexcoords.ts — axial (q,r) coordinate math for the hexagonal rendering path.
// Pure functions. No DOM, no dependencies. Plain TypeScript.
//
// LAW: hex is a MODE alongside square, never a replacement.
//
// Conventions (Red Blob Games axial system, size = circumradius):
//   pointy-top:  x = size * (sqrt(3)*q + (sqrt(3)/2)*r),  y = size * (3/2 * r)
//   flat-top:    x = size * (3/2 * q),                    y = size * ((sqrt(3)/2)*q + sqrt(3)*r)
// Cube coordinates: s = -q - r; the three always sum to zero.

export type Orientation = "pointy" | "flat";

export interface Axial {
	q: number;
	r: number;
}

export interface Pt {
	x: number;
	y: number;
}

export interface Offset {
	col: number;
	row: number;
}

const SQRT3 = Math.sqrt(3);

/** Constant 6-neighbour axial table — no row-parity branching, ever. */
export const HEX_NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
	[+1, 0],
	[+1, -1],
	[0, -1],
	[-1, 0],
	[-1, +1],
	[0, +1],
];

/** Stable string key for a cell — the shared key format across the hex modules. */
export function axialKey(q: number, r: number): string {
	return q + "," + r;
}

/** Centre of hex (q,r) in pixel space. */
export function hexToPixel(q: number, r: number, size: number, orientation: Orientation): Pt {
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
export function pixelToHexFractional(x: number, y: number, size: number, orientation: Orientation): Axial {
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
export function cubeRound(qf: number, rf: number): Axial {
	const sf = -qf - rf;
	let q = Math.round(qf);
	let r = Math.round(rf);
	let s = Math.round(sf);
	const dq = Math.abs(q - qf);
	const dr = Math.abs(r - rf);
	const ds = Math.abs(s - sf);
	if (dq > dr && dq > ds) {
		q = -r - s;
	} else if (dr > ds) {
		r = -q - s;
	} else {
		s = -q - r;
	}
	return { q, r };
}

/** Pixel to the hex cell containing it. */
export function pixelToHex(x: number, y: number, size: number, orientation: Orientation): Axial {
	const f = pixelToHexFractional(x, y, size, orientation);
	return cubeRound(f.q, f.r);
}

/** Distance in cell steps (cube distance). Neighbours are distance 1. */
export function hexDistance(qa: number, ra: number, qb: number, rb: number): number {
	const dq = qa - qb;
	const dr = ra - rb;
	return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
}

/**
 * Axial <-> offset lives ONLY at the array storage boundary — geometry code
 * above never branches on row parity. Pointy-top uses odd-r rows, flat-top
 * uses odd-q columns.
 */
export function axialToOffset(q: number, r: number, orientation: Orientation): Offset {
	if (orientation === "pointy") {
		// odd-r: odd rows shifted right by half a step
		return { col: q + ((r - (r & 1)) >> 1), row: r };
	}
	// odd-q: odd columns shifted down by half a step
	return { col: q, row: r + ((q - (q & 1)) >> 1) };
}

export function offsetToAxial(col: number, row: number, orientation: Orientation): Axial {
	if (orientation === "pointy") {
		return { q: col - ((row - (row & 1)) >> 1), r: row };
	}
	return { q: col, r: row - ((col - (col & 1)) >> 1) };
}

/** The six corners of a unit hex centred at the origin, winding clockwise in canvas space. */
export function hexCorners(size: number, orientation: Orientation): Pt[] {
	const out: Pt[] = [];
	for (let k = 0; k < 6; k++) {
		const angleDeg = orientation === "pointy" ? 60 * k - 30 : 60 * k;
		const a = (angleDeg * Math.PI) / 180;
		out.push({ x: size * Math.cos(a), y: size * Math.sin(a) });
	}
	return out;
}

/** Bounding box of the six corners (min x, min y, max x, max y). */
export function hexBounds(size: number, orientation: Orientation): [number, number, number, number] {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const c of hexCorners(size, orientation)) {
		if (c.x < minX) minX = c.x;
		if (c.y < minY) minY = c.y;
		if (c.x > maxX) maxX = c.x;
		if (c.y > maxY) maxY = c.y;
	}
	return [minX, minY, maxX, maxY];
}
