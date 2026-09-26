// Z3 · blight-keccak — the Keccak-256 core gate.
// Cut: one browser-safe module (surfaces/blight/keccak.js) extracted verbatim
// from the five inline page copies; five <script src> pins; NO page may still
// define keccak256; the known vector must hash exact; midi's two triple-wrapped
// disclosures (md.d.compose, md.d.balance) are single-wrapped.
// Source-level + one vm-executed vector. node --test e2e/blight-keccak.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const surf = (p) => readFileSync(join(here, "../surfaces/blight", p), "utf8");
const PAGES = ["gallery.html", "inscription-explorer.html", "midi.html", "profile.html", "workbench.html"];
const VECTOR_EMPTY = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"; // Keccak-256("") PUBLIC-CONSTANT: public known-answer-test vector

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

function loadModule() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(surf("keccak.js"), ctx);
  return ctx;
}

test("T1 · the vector: Keccak-256 of the empty string, exact", () => {
  const ctx = loadModule();
  assert.equal(typeof ctx.keccak256, "function", "module exposes keccak256");
  assert.equal(hex(ctx.keccak256(new Uint8Array(0))), VECTOR_EMPTY);
});

test("T2 · no page still defines keccak256 (RED at base: five definitions)", () => {
  for (const p of PAGES) {
    assert.ok(!/^function keccak256\s*\(/m.test(surf(p)), p + " still defines keccak256");
  }
});

test("T3 · five script-src pins — each page loads the module exactly once", () => {
  const tag = '<script src="keccak.js"></script>';
  for (const p of PAGES) {
    assert.equal(surf(p).split(tag).length - 1, 1, p + " carries the src tag exactly once");
  }
});

test("T4 · module law: classic script, single M64, single keccak256, provenance header", () => {
  const m = surf("keccak.js");
  assert.ok(m.startsWith("/*! keccak.js"));
  assert.ok(!/module\.exports|\bexport\s/.test(m), "no exports — plain globals (bcomb.js precedent)");
  assert.equal((m.match(/const M64=/g) || []).length, 1);
  assert.equal((m.match(/^function keccak256\s*\(/m) || []).length, 1);
});

test("T5 · midi's two disclosures are single-wrapped (md.d.compose, md.d.balance)", () => {
  const m = surf("midi.html");
  for (const key of ["md.d.compose", "md.d.balance"]) {
    assert.equal((m.match(new RegExp('data-i18n="' + key + '"', "g")) || []).length, 1, key + " appears exactly once");
  }
  const opens = (m.match(/<details class="tnote" data-reg-disclose>/g) || []).length;
  const closes = (m.match(/<\/details>/g) || []).length;
  assert.equal(opens, closes, "midi disclosures balance: " + opens + "/" + closes);
  assert.ok(!/<\/summary>\s*\n\s*<details class="tnote" data-reg-disclose>/.test(m), "no disclosure opens straight into a twin");
});

test("T6 · every page's keccak call sites are untouched", () => {
  for (const p of ["gallery.html", "inscription-explorer.html", "profile.html"]) {
    assert.ok(surf(p).includes("const lh=keccak256(new TextEncoder().encode(L[i]));"), p);
  }
  assert.ok(surf("midi.html").includes("function bk(bytes){return keccak256(bytes);}"));
  assert.ok(surf("workbench.html").includes("keccak256(new Uint8Array(0))"));
});
