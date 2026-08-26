// inline-hexcore.mjs — pack the five compiled hex modules (hex/dist/*.js)
// into ONE IIFE block for the single-file surface. Mirrors the surface's own
// vendor law: types already stripped by tsc emit, no build step at view time,
// no dependencies. Output: hex/tools/hexcore-block.js
// The block is injected into surfaces/blight/pixelrefiner.html between the
// HEXCORE markers by this same script (idempotent).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HEX = join(HERE, "..");
const ORDER = ["hexcoords", "hexresample", "hexmorph", "hexdither", "hexrender"];
const EXPORTS = [
	// hexcoords
	"hexToPixel", "pixelToHex", "pixelToHexFractional", "cubeRound", "hexDistance",
	"axialToOffset", "offsetToAxial", "hexCorners", "hexBounds", "axialKey", "HEX_NEIGHBOURS",
	// hexresample
	"resampleToHex", "srgbToOklab", "oklabToSrgb",
	// hexmorph
	"dilate", "erode", "outline", "floodFill", "offsetNeighbours",
	// hexdither
	"diffuseHexError", "orderedDitherHex", "toneIndex", "voidClusterMask",
	"JODOIN_TRIPLES", "JODOIN_TABLE_INTS", "JODOIN_PROVENANCE", "MASK_SIDE", "MASK_CELLS",
	// hexrender
	"drawHexCells", "exportSVG", "exportPNG", "cellsBounds", "buildHexPath",
];

let body = "";
for (const name of ORDER) {
	let src = readFileSync(join(HEX, "dist", name + ".js"), "utf8");
	// strip intra-package imports (same-scope names after concatenation) and
	// export keywords; nothing else is touched
	src = src.replace(/^import\s+[^\n]*from\s+"\.[^"]*";\s*$/gm, "");
	src = src.replace(/^export\s+/gm, "");
	body += "\n// ── " + name + " ──────────────────────────────────────────────\n" + src.trim() + "\n";
}

const block =
	`<script>/* ── HEXCORE — the hexagonal rendering path, lane/hex ───────────────────\n` +
	` * Five dependency-free modules (hexcoords · hexresample · hexmorph · hexdither ·\n` +
	` * hexrender), inlined under the same one-file-zero-calls law as the engine above.\n` +
	` * Sources + tests + provenance: /hex in the repo. Diffusion coefficients:\n` +
	` * Jodoin & Ostromoukhov, Halftoning Over a Hexagonal Grid, Proc. SPIE 5008 (2003),\n` +
	` * DOI 10.1117/12.473230. Ordered dither: void-and-cluster hex blue-noise mask.\n` +
	` * Regenerate: node hex/tools/build.mjs && node hex/tools/inline-hexcore.mjs */\n` +
	`"use strict";\nvar HexCore = (() => {\n${body}\nreturn { ${EXPORTS.join(", ")} };\n})();\n</script>`;

writeFileSync(join(HERE, "hexcore-block.js"), block);
console.log("hexcore block:", block.length, "chars ->", join(HERE, "hexcore-block.js"));

// idempotent injection between the markers
const surfacePath = join(HEX, "..", "surfaces", "blight", "pixelrefiner.html");
const OPEN = "<!--HEXCORE-->";
const CLOSE = "<!--/HEXCORE-->";
let html = readFileSync(surfacePath, "utf8");
const inject = OPEN + "\n" + block + "\n" + CLOSE;
if (html.includes(OPEN)) {
	const re = new RegExp(OPEN + "[\\s\\S]*?" + CLOSE);
	html = html.replace(re, inject.replace(/\$/g, "$$$$"));
} else {
	// first injection: after the engine's closing </script>, before the app IIFE
	const anchor = `</script>\n<script>\n(function(){\n'use strict';\nvar C=window.PixelRefinerCore;`;
	if (!html.includes(anchor)) {
		console.error("inject anchor not found — engine script tail changed?");
		process.exit(1);
	}
	html = html.replace(anchor, `</script>\n` + inject + `\n<script>\n(function(){\n'use strict';\nvar C=window.PixelRefinerCore;`);
}
writeFileSync(surfacePath, html);
console.log("injected into", surfacePath);
