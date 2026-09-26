// Tree of Life navigator — the pure layer of surfaces/tree-of-life.mjs, on the
// SYNTHETIC two-line family. The DOM mount is exercised in the harness
// (tools/genealogy/tree-of-life-harness.html); what can be proven without a
// browser is proven here: state round-trips, one truth under three readings,
// the living carry nothing, and no two names sit on each other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { privatize } from "./model.mjs";
import { syntheticLines } from "./synthetic-lines.mjs";
import { encodeState, decodeState, lineView, layout, claimLines, pickDepth, lineName, yearText, heldText } from "../../surfaces/tree-of-life.mjs";

const corpus = privatize(syntheticLines());
const READINGS = ["bee", "raver", "cypherpunk"];

test("state round-trips through the hash; junk and unsafe ids are dropped", () => {
  const st = { l: "spouse-1", f: "s-aa", p: "s-aaa" };
  assert.deepEqual(decodeState(encodeState(st)), st);
  assert.equal(encodeState({ l: "founder" }), "#l=founder");
  assert.deepEqual(decodeState("#l=founder&x=1&p=<script>&f=a%20b"), { l: "founder", f: null, p: null });
  assert.deepEqual(decodeState(""), { l: null, f: null, p: null });
});

test("a line view starts at the line's own root and climbs to the depth", () => {
  const v = lineView(corpus, "spouse-1", null, 4);
  assert.equal(v.focus, "spouse");
  assert.deepEqual(v.nodes.map((n) => n.id).sort(), ["s-a", "s-aa", "s-aaa", "s-ab", "s-aba", "s-b", "spouse"]);
  const shallow = lineView(corpus, "spouse-1", null, 2);
  assert.equal(shallow.nodes.find((n) => n.id === "s-aa").above, 1, "the cut-off generation says how many more wait above");
  assert.equal(lineView(corpus, "nope", null), null);
});

test("living nodes in a view carry no name, dates, standing, or claims", () => {
  const v = lineView(corpus, "spouse-1", null, 4);
  for (const n of v.nodes.filter((x) => x.living)) {
    assert.equal(n.name, null);
    assert.equal(n.lifespan, null);
    assert.equal(n.support, null);
    assert.equal(n.claims, 0);
  }
  assert.equal(v.held, 3);
});

test("focus moves the climb without changing the corpus", () => {
  const before = JSON.stringify(corpus);
  const v = lineView(corpus, "spouse-1", "s-ab", 4);
  assert.deepEqual(v.nodes.map((n) => n.id), ["s-ab", "s-aba"]);
  assert.equal(JSON.stringify(corpus), before);
});

test("pedigree collapse: a person met twice is one node with two links", () => {
  const c = {
    persons: { r: { name: "R", living: false }, a: { name: "A", living: false }, b: { name: "B", living: false }, g: { name: "G", living: false } },
    edges: { r: ["a", "b"], a: ["g"], b: ["g"] },
    lines: [{ key: "founder", label: "Founder line", root: "r", entries: ["r"], bridge: 0 }],
  };
  const v = lineView(c, "founder", null, 4);
  assert.equal(v.nodes.filter((n) => n.id === "g").length, 1);
  assert.equal(v.links.filter((k) => k.parent === "g").length, 2);
});

test("the three readings lay out the same people and the same links", () => {
  for (const [line, depth] of [["founder", 4], ["spouse-1", 4], ["spouse-1", 2]]) {
    const v = lineView(corpus, line, null, depth);
    const shapes = READINGS.map((r) => layout(v, r, 700));
    for (const s of shapes) {
      assert.deepEqual(Object.keys(s.pos).sort(), v.nodes.map((n) => n.id).sort());
      assert.equal(s.paths.length, v.links.length);
    }
  }
});

test("every node sits wholly inside the box, and no two overlap (row readings)", () => {
  for (const px of [354, 700]) for (const line of ["founder", "spouse-1"]) {
    const v = lineView(corpus, line, null, pickDepth(px));
    for (const r of READINGS) {
      const { pos } = layout(v, r, px);
      for (const [id, p] of Object.entries(pos)) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${r} ${id} finite`);
        assert.ok(p.x - p.w / 2 >= 0.5 && p.x + p.w / 2 <= 99.5, `${r} ${line} ${px}px ${id} inside horizontally: ${p.x}±${p.w / 2}`);
      }
      if (r === "raver") continue; // the mandala's clearance is 2-d; the browser measure covers it
      const rows = new Map();
      for (const n of v.nodes) (rows.get(n.gen) || rows.set(n.gen, []).get(n.gen)).push(pos[n.id]);
      for (const row of rows.values()) {
        row.sort((a, b) => a.x - b.x);
        for (let i = 1; i < row.length; i++)
          assert.ok(row[i].x - row[i - 1].x >= row[i].w, `${r} ${line} ${px}px row overlap`);
      }
    }
  }
});

test("depth follows the width, never the reading", () => {
  assert.equal(pickDepth(354), 2);
  assert.equal(pickDepth(700), 3);
  assert.equal(pickDepth(2000), 4);
  assert.equal(pickDepth(0), 3);
});

test("only sourced claims are shown, each with its time", () => {
  const p = {
    cultureClaims: [
      { kind: "language", value: "Latvian", from: 1901, to: 1970, source: "register" },
      { kind: "religion", value: "Lutheran", source: "" },
      { kind: "title", value: "jarl", from: -850, source: "saga text", note: "tradition" },
      { kind: "region", value: "Zemgale", to: 1918, source: "census" },
    ],
  };
  const out = claimLines(p);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { kind: "spoke", value: "Latvian", when: "1901 to 1970", source: "source: register", note: null });
  assert.equal(out[1].when, "from 850 BC");
  assert.equal(out[2].when, "until 1918");
  assert.deepEqual(claimLines({}), []);
  assert.equal(yearText(-1), "1 BC");
});

test("line names are neutral and lowercase", () => {
  assert.equal(lineName("founder"), "founder line");
  assert.equal(lineName("spouse-3"), "spouse line III");
  assert.equal(heldText(0), "no living generation stands between this line and its first ancestors.");
  assert.equal(heldText(1), "1 living generation held. living people stay out. always.");
});

test("the navigator never writes a living name, even when handed one", () => {
  // a corpus that (wrongly) still carries a living name: the view must not pass it on
  const leaky = JSON.parse(JSON.stringify(corpus));
  leaky.persons.spouse.name = "A Real Name";
  leaky.persons.spouse.lifespan = "1985–";
  const v = lineView(leaky, "spouse-1", null, 4);
  assert.ok(!JSON.stringify(v).includes("A Real Name"));
  assert.ok(!JSON.stringify(v).includes("1985–"));
});

test("design laws hold in the source: no honey, no red, no text-transform, one primary", () => {
  const css = readFileSync(new URL("../../surfaces/tree-of-life.css", import.meta.url), "utf8");
  const js = readFileSync(new URL("../../surfaces/tree-of-life.mjs", import.meta.url), "utf8");
  for (const src of [css, js]) {
    assert.ok(!/#e8b54b|#d4a94e|--gold/i.test(src), "honey is the colour of b only");
    assert.ok(!/text-transform/i.test(src), "casing is payload, never styled");
    assert.ok(!/#ff0000|#e5484d|:\s*red\b/i.test(src), "guard is lilac, never red");
  }
  assert.equal((js.match(/class="tol-primary"/g) || []).length, 1, "one primary per view");
});
