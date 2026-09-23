// lifespan.mjs is THE year reader; blood.html's classic-script byr() mirrors it.
// This holds the two equal on the shapes the archive actually carries, so a
// third unsigned copy cannot quietly return (it did: 1,462 false chips).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { birthYear, deathYear } from "../../surfaces/lifespan.mjs";
import * as model from "./model.mjs";

const VECTORS = [
  ["1931–2025", 1931, 2025], ["1115BC–Deceased", -1115, null], ["2514BC–2485BC", -2514, -2485],
  ["0600–0650", 600, 650], ["99–Deceased", 99, null], ["9–99", 9, 99], ["–1187BC", null, -1187],
  ["Deceased", null, null], ["", null, null], [null, null, null], ["1400–1349BC", 1400, -1349],
  ["mid 9th century–0887? (traditional)", null, 887],
];

test("the signed reader reads BC and 1-4 digit years", () => {
  for (const [l, b, d] of VECTORS) {
    assert.equal(birthYear(l), b, `birth of ${l}`);
    assert.equal(deathYear(l), d, `death of ${l}`);
  }
});

test("the model re-exports the one reader, not a copy", () => {
  assert.equal(model.birthYear, birthYear);
  assert.equal(model.deathYear, deathYear);
});

test("blood.html's byr() mirrors birthYear on every vector", () => {
  const html = readFileSync(new URL("../../surfaces/blood.html", import.meta.url), "utf8");
  const src = html.match(/function byr\(l\)\{[^\n]*\}/)?.[0];
  assert.ok(src, "byr() found in blood.html");
  const byr = new Function(src + "; return byr;")();
  for (const [l] of VECTORS) assert.equal(byr(l), birthYear(l), `byr(${l})`);
});

test("no unsigned year reader remains in the genealogy surfaces", () => {
  for (const f of ["surfaces/person-panel-corpus.mjs", "surfaces/blood.html", "surfaces/tree-of-life.mjs"]) {
    const s = readFileSync(new URL("../../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /match\(\/\^\(\\d\{3,4\}\)\//, f);
  }
});
