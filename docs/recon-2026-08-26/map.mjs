// map.mjs — STEP 1: the one token table. Declarations only (var() usage is not duplication).
import { readFileSync } from "node:fs";

const FILES = {
	"A·brief hub": ".recon/Beehive Hub.dc.html",
	"A·brief review": ".recon/Estate Review 2026-08-26.dc.html",
	"B·live hub": "surfaces/index.html",
	"C·tokens.css(surfaces)": "surfaces/tokens.css",
	"C·tokens.css(docs)": "docs/tokens.css",
	"D·blight/demo": "surfaces/blight/demo.html",
};
const declarers = readFileSync(".recon/declarers.txt", "utf8").trim().split("\n").filter(Boolean);

const decl = (path) => {
	const src = readFileSync(path, "utf8");
	const out = {};
	const re = /(--[A-Za-z0-9-]+)\s*:\s*([^;{}]+);/g;
	let m;
	while ((m = re.exec(src))) {
		const v = m[2].trim();
		if (!/#[0-9a-fA-F]{3,8}/.test(v) && !/^var\(/.test(v) && !/gradient/.test(v)) continue;
		if (out[m[1]] && out[m[1]] !== v) out[m[1]] = out[m[1]] + " ||also|| " + v;
		else if (!out[m[1]]) out[m[1]] = v;
	}
	return out;
};

const tables = {};
for (const [label, path] of Object.entries(FILES)) tables[label] = decl(path);
for (const f of declarers) {
	if (Object.values(FILES).includes(f)) continue;
	const t = decl(f);
	if (Object.keys(t).length) tables["E·" + f] = t;
	else delete tables["E·" + f];
}

// per-file: does it merely use, or also DECLARE?
console.log("## declaration census (files that DECLARE, vs token count):");
for (const [label, t] of Object.entries(tables)) {
	const keys = Object.keys(t);
	if (label.startsWith("A") || label.startsWith("B") || label.startsWith("C") || label.startsWith("D"))
		console.log("  " + label.padEnd(28) + keys.length + " declared");
}
for (const f of declarers) {
	const label = "E·" + f;
	if (tables[label]) console.log("  " + label.padEnd(28) + Object.keys(tables[label]).length + " declared");
	else console.log("  " + ("use-only: " + f).padEnd(28) + "0 declared (references only)");
}

const header = Object.keys(tables);
const names = [...new Set(header.flatMap((h) => Object.keys(tables[h])))].sort();
console.log("\n## THE TABLE  (token × source; empty cell = not declared there)");
console.log(["token", ...header].join("\t"));
for (const n of names) {
	const cells = header.map((h) => tables[h][n] ?? "");
	const flat = new Set();
	for (const c of cells) for (const v of String(c).split(" ||also|| ")) if (v) flat.add(v);
	const diverged = flat.size > 1;
	console.log((diverged ? "⚠ " + n : n) + "\t" + cells.join("\t"));
}
console.log("\n⚠ = this token carries 2+ different values across (or within) sources");
