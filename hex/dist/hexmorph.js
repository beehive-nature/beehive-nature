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
import { axialToOffset, HEX_NEIGHBOURS, offsetToAxial, } from "./hexcoords.js";
function makeGrid(cols, rows, orientation) {
    return { cols, rows, orientation, cells: new Uint8Array(cols * rows) };
}
function inBounds(g, col, row) {
    return col >= 0 && row >= 0 && col < g.cols && row < g.rows;
}
/** The 6 neighbours of an offset cell, as offset indices (bounds-checked). */
export function offsetNeighbours(g, col, row) {
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
export function dilate(g) {
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
export function erode(g) {
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
export function outline(g) {
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
export function floodFill(g, col, row, match) {
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
