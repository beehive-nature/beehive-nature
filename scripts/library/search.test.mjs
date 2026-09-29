// ── search.test.mjs — stale-snapshot guard over the routed/enriched choice ──
// Synthetic, runtime-constructed fixtures ONLY: no corpus documents enter CI.
// Exercises the hiding law this guard exists for: an older routed-*.jsonl must
// never be served over a newer enriched-*.jsonl, because the documents
// enriched after the last route pass would be invisible — with no signal.
// The CLI runs at import, so every case spawns the real script.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEARCH = path.join(path.dirname(fileURLToPath(import.meta.url)), "search.mjs");

// Minimal record the search paths actually read; short fake sha only (hex law).
const rec = (id, over = {}) => ({
  id, title: `Title ${id}`, author: "unknown", source: "fixture", provenance: "unknown",
  subjects: ["unsorted"], current_path: `/fixture/${id}.pdf`, original_filename: `${id}.pdf`,
  parse_state: "CLEAN", year: "unknown", year_source: "unknown", sha256: "ab".repeat(10),
  ...over,
});
const routing = (over = {}) => ({
  research_value: "routine", evidence_type: "paper", domain: ["hemp"], domain_provisional: [],
  why: "fixture routing", ...over,
});

function corpus(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blib-search-"));
  const rec_ = path.join(root, "library-records");
  fs.mkdirSync(rec_);
  for (const [name, records] of Object.entries(files)) {
    fs.writeFileSync(path.join(rec_, name), records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  return root;
}

function run(root, ...args) {
  const p = spawnSync(process.execPath, [SEARCH, root, ...args], { encoding: "utf8" });
  return { code: p.status, err: p.stderr, json: () => JSON.parse(p.stdout) };
}

test("stale routed index no longer hides newer enriched documents", () => {
  const root = corpus({
    "routed-2026-09-28.jsonl": [rec("A")],
    "enriched-2026-09-29.jsonl": [rec("A"), rec("B")],
  });
  const r = run(root, "--json");
  assert.equal(r.code, 0);
  const ids = r.json().map((x) => x.id);
  assert.deepEqual(ids.sort(), ["A", "B"], "the day-newer enriched record must be served");
  assert.match(r.err, /STALE ROUTED INDEX/, "the fallback must say so, not silently switch");
  assert.match(r.err, /enriched-2026-09-29\.jsonl/);
});

test("stale fallback honestly returns nothing for routing-only filters", () => {
  const root = corpus({
    "routed-2026-09-28.jsonl": [rec("A", { routing: routing() })],
    "enriched-2026-09-29.jsonl": [rec("A"), rec("B")],
  });
  const r = run(root, "--value", "high", "--json");
  assert.equal(r.code, 0);
  assert.deepEqual(r.json(), [], "no routing labels in the enriched snapshot — zero, not a guess");
  assert.match(r.err, /route\.mjs re-runs/);
});

test("same-day routed snapshot stays preferred (normal chain)", () => {
  const root = corpus({
    "enriched-2026-09-29.jsonl": [rec("A"), rec("B")],
    "routed-2026-09-29.jsonl": [rec("A"), rec("B", { routing: routing({ research_value: "high" }) })],
  });
  const r = run(root, "--value", "high", "--json");
  assert.deepEqual(r.json().map((x) => x.id), ["B"]);
  assert.doesNotMatch(r.err, /STALE/);
  assert.match(r.err, /, routed\)/, "index line must name the routed file");
  assert.match(r.err, /legend:/, "label-semantics legend rides every routed query");
});

test("routed newer than enriched stays preferred", () => {
  const root = corpus({
    "enriched-2026-09-28.jsonl": [rec("A")],
    "routed-2026-09-29.jsonl": [rec("A", { routing: routing() })],
  });
  const r = run(root, "--json");
  assert.deepEqual(r.json().map((x) => x.id), ["A"]);
  assert.doesNotMatch(r.err, /STALE/);
  assert.match(r.err, /, routed\)/);
});

test("enriched-only corpus keeps working", () => {
  const root = corpus({ "enriched-2026-09-29.jsonl": [rec("A"), rec("B")] });
  const r = run(root, "--json");
  assert.equal(r.json().length, 2);
  assert.doesNotMatch(r.err, /STALE/);
});

test("no snapshot at all fails loudly with exit 2", () => {
  const root = corpus({ "inventory-2026-09-29.jsonl": [rec("A")] });
  const r = run(root);
  assert.equal(r.code, 2);
  assert.match(r.err, /no enriched\/routed jsonl/);
});
