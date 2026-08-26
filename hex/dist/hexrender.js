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
import { hexCorners, hexToPixel } from "./hexcoords.js";
/** Build the ONE hex path at the origin — pass a real Path2D in the browser. */
export function buildHexPath(path, size, orientation) {
    const c = hexCorners(size, orientation);
    path.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 6; i++)
        path.lineTo(c[i].x, c[i].y);
    path.closePath();
    return path;
}
/** Live render: translate + fill per cell, reusing the single hex path. */
export function drawHexCells(ctx, path, cells, opts) {
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
export function cellsBounds(cells, size, orientation) {
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
export function exportSVG(cells, opts) {
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
export async function exportPNG(cells, opts) {
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
