// Z2 · btranslated-views — the composition/density gate for surfaces/btranslated.html.
// Cut (WIDE_QUEUE Set Z): §1 (top-2 picker) stays open everywhere; §2–§6 become
// progressive-disclosure tech notes (register canon); the three unkeyed h2
// strings are pinned BYTE-EQUAL (unkeyed English - no keying in this family).
// Source-level, zero deps: node --test e2e/btranslated-views.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../surfaces/btranslated.html"), "utf8");

const S1 = "1 · <span data-i18n=\"h.110\">YOUR TOP-2 — mother tongue + father tongue (local-first, never identity data)</span>";
const S2 = "2 · THE POINTER PRINCIPLE, WALKED — alias → skeleton → canonical, always <span class=\"badge\">DEMO RENDERING</span>";
const S3 = "3 · <span data-i18n=\"h.111\">WITHDRAWAL — a first-class state, receipt-shaped</span>";
const S4 = "4 · THE FATHER SET <span class=\"badge\">CANDIDATE — pending T-1 number + T-5 ruler</span>";
const S5 = "5 · <span data-i18n=\"h.112\">THE UNIFICATION LAW, LIVE — every color's mandatory label is a corpus record</span>";
const S6 = "6 · THE ADAPTER RING THIS RIDES ON <span class=\"badge\">R-5 · founder-seeded</span>";

test("T1 · §1 open everywhere — the TOP-2 picker is a step section, never folded", () => {
  assert.ok(page.includes("<h2>" + S1 + "</h2>"), "§1's heading stays a plain h2");
  const first = page.slice(0, page.indexOf("<details")); // §1 + header = everything before the first disclosure
  assert.ok(first.includes('id="father"') && first.includes('id="mother"') && first.includes('id="students"'), "the three controls live in §1");
  assert.ok(!first.includes("data-reg-disclose"), "no disclosure wraps §1");
});

test("T2 · §2–§6 disclose — exactly five single-wrapped tech notes, none forced open, no twins", () => {
  const opens = (page.match(/<details class="tnote" data-reg-disclose>/g) || []).length;
  const closes = (page.match(/<\/details>/g) || []).length;
  assert.equal(opens, 5, "five disclosures");
  assert.equal(closes, 5, "balanced closes");
  assert.ok(!/data-reg-disclose[^>]*\sopen(?:\s|>)/.test(page), "source carries no open attribute — bee/raver collapse is the default, cypherpunk opens");
  assert.ok(!/<\/summary>\s*<details class="tnote" data-reg-disclose>/.test(page), "no disclosure opens straight into a twin (R3's law)");
});

test("T3 · the summaries carry the section headings BYTE-EQUAL — the three unkeyed strings pinned verbatim", () => {
  for (const s of [S2, S3, S4, S5, S6]) {
    assert.ok(page.includes("<summary>" + s + "</summary>"), "summary missing or drifted: " + s.slice(0, 48));
  }
  assert.ok(!page.includes("<h2>" + S2), "the moved headings no longer render as plain h2");
});

test("T4 · keys: exactly the four existing, each once, in order; no view-register attributes", () => {
  const keys = [...page.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ["h.110", "h.111", "h.112", "law.hive"]);
  assert.ok(!/data-reg(?!-disclose)["=\s]/.test(page), "no data-reg view attributes ride this page");
});

test("T5 · hrefs pinned: exactly two, byte-equal — one static (the hive), one script-built (Vaulta)", () => {
  assert.equal((page.match(/href="/g) || []).length, 2);
  assert.ok(page.includes('<a href="index.html" data-i18n="law.hive">'));
  assert.ok(page.includes('<a href="blight/vaulta-reader.html">read it live</a>'));
});

test("T6 · script discipline: tour.js + one inline; the draft STR table untouched", () => {
  assert.equal((page.match(/<script/g) || []).length, 2);
  assert.ok(page.includes('<script src="tour.js?v=42"></script>'));
  assert.ok(page.includes("var STR={"));
  assert.ok(page.includes("canon:  {en:'canonical leaf + Merkle proof'"));
});
