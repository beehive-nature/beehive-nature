// Z4 · stack-dataflow idempotency gate.
// Cut (2d4ddb78): make scripts/stack-dataflow-corpus.mjs idempotent - guard
// the _meta.drafted append with includes. The gate runs the script TWICE on a
// sandbox copy (script + corpus in a temp tree preserving relative layout -
// the script resolves ROOT from its own path, so the copy can never touch the
// real corpus) and requires byte-identical output. It also pins that the real
// worktree corpus is untouched (isolation proof) and that the provenance
// sentence appears exactly once after two runs.
// node --test e2e/stack-dataflow-idempotent.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SCRIPT = join(ROOT, "scripts/stack-dataflow-corpus.mjs");
const CORPUS = join(ROOT, "surfaces/lang-corpus.json");
const SANDBOX = join(ROOT, ".z4-sandbox");

const sha = (b) => createHash("sha256").update(b).digest("hex");
const run = (cwd, args) => execFileSync("node", args, { cwd, encoding: "utf8", maxBuffer: 96 * 1024 * 1024 });

test("T1 · two runs, byte-identical corpus - the script is idempotent", () => {
  const realBefore = sha(readFileSync(CORPUS));
  try {
    rmSync(SANDBOX, { recursive: true, force: true });
    mkdirSync(join(SANDBOX, "scripts"), { recursive: true });
    mkdirSync(join(SANDBOX, "surfaces"), { recursive: true });
    copyFileSync(SCRIPT, join(SANDBOX, "scripts/stack-dataflow-corpus.mjs"));
    copyFileSync(CORPUS, join(SANDBOX, "surfaces/lang-corpus.json"));
    const out1 = run(SANDBOX, ["scripts/stack-dataflow-corpus.mjs"]);
    const h1 = sha(readFileSync(join(SANDBOX, "surfaces/lang-corpus.json")));
    const out2 = run(SANDBOX, ["scripts/stack-dataflow-corpus.mjs"]);
    const h2 = sha(readFileSync(join(SANDBOX, "surfaces/lang-corpus.json")));
    assert.equal(h1, h2, "run1 and run2 must be byte-identical (was: the provenance sentence re-appended every run)");
    assert.ok(/flow\.\* keys written/.test(out1) && /flow\.\* keys written/.test(out2), "both runs report writes");
  } finally {
    rmSync(SANDBOX, { recursive: true, force: true });
    assert.equal(sha(readFileSync(CORPUS)), realBefore, "the REAL corpus is untouched by this gate (sandbox isolation)");
  }
});

test("T2 · after two runs the provenance sentence appears exactly once", () => {
  try {
    mkdirSync(join(SANDBOX, "scripts"), { recursive: true });
    mkdirSync(join(SANDBOX, "surfaces"), { recursive: true });
    copyFileSync(SCRIPT, join(SANDBOX, "scripts/stack-dataflow-corpus.mjs"));
    copyFileSync(CORPUS, join(SANDBOX, "surfaces/lang-corpus.json"));
    run(SANDBOX, ["scripts/stack-dataflow-corpus.mjs"]);
    run(SANDBOX, ["scripts/stack-dataflow-corpus.mjs"]);
    const corpus = JSON.parse(readFileSync(join(SANDBOX, "surfaces/lang-corpus.json"), "utf8"));
    const n = (corpus._meta.drafted.match(/stack dataflow lane/g) || []).length;
    assert.equal(n, 1, "the sentence appears exactly once, not once per run");
    const flowKeys = Object.keys(corpus.strings).filter((k) => k.startsWith("flow.")).length;
    assert.ok(flowKeys >= 112, "the flow.* family is present (" + flowKeys + ")");
  } finally {
    rmSync(SANDBOX, { recursive: true, force: true });
  }
});

test("T3 · the script source carries the guard, and no unguarded append remains", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("if (!corpus._meta.drafted.includes(PROV)) corpus._meta.drafted += PROV;"), "includes-guard present");
  assert.ok(!/corpus\._meta\.drafted \+= '/.test(src), "no bare append");
  assert.ok(src.includes("export { TBL, LANGS, NAME_CONST };"), "module exports intact (three importers depend on them)");
});
