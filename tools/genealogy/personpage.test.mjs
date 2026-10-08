// personpage.test.mjs — the generated research-page contract (2026-10-03 handoff
// repair). The original miss: blood.html's person panel improved while the
// "open full research" destination stayed an older page without the site menu,
// return-to-tree, Wikipedia links, grandparent branch or labelled family. This
// battery reads the COMMITTED pages (plus a generator↔output sync check) so a
// future generator edit that drifts from the published pages fails here, not
// in the founder's browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "./personpage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, "..", "..", "assets", "profile-archive", "lineage", "persons");
const page = (id) => readFileSync(join(PAGES, id + ".html"), "utf8");
const CHARLE = "p1790a81049", LOUIS = "paf36b10c53", DONNA = "p7b1078c886";

const EXT_ATTR = 'target="_blank" rel="noopener noreferrer"';
const externalAnchors = (h) => [...h.matchAll(/<a [^>]*href="https?:[^"]*"[^>]*>/g)].map((m) => m[0]);

test("every page keeps the visitor oriented: estate crumbs, return-to-tree, shared site menu", () => {
  for (const id of [CHARLE, LOUIS, DONNA, "founder"]) {
    const h = page(id);
    assert.ok(h.includes('class="crumbs"'), id + ": no estate crumbs");
    assert.ok(h.includes('href="../../../../surfaces/index.html"'), id + ": crumbs do not reach the estate front door");
    assert.ok(h.includes('href="../../../../surfaces/blood.html#p=' + id + '"'), id + ": no return-to-tree with the person selected");
    assert.ok(h.includes("return to the family tree"), id + ": return-to-tree action not worded");
    assert.ok(h.includes('src="../../../../surfaces/tour.js?v='), id + ": shared site menu (tour.js) not included");
    assert.ok(h.includes('href="../../../../surfaces/profile.html#blood-record"'), id + ": profile doorway missing");
  }
});

test("Charlemagne and Louis I carry their exact Wikipedia articles; the label says a new tab opens", () => {
  const c = page(CHARLE);
  assert.ok(c.includes('href="https://en.wikipedia.org/wiki/Charlemagne" target="_blank"'), "Charlemagne: exact article URL missing or without new-tab attributes");
  assert.match(c, />Read on Wikipedia \(new tab\)</);
  const l = page(LOUIS);
  assert.ok(l.includes('href="https://en.wikipedia.org/wiki/Louis_the_Pious" target="_blank"'), "Louis I: exact article URL missing or without new-tab attributes");
  assert.match(l, />Read on Wikipedia \(new tab\)</);
});

test("other deceased people get a clearly labelled search, never presented as an article", () => {
  const h = page(DONNA);
  assert.ok(h.includes("https://en.wikipedia.org/w/index.php?search="), "Donna: search link missing");
  assert.match(h, />Search Wikipedia \(new tab\)</);
  assert.ok(!h.includes("/wiki/Donna"), "a search must not resolve to a guessed article");
});

test("living people leak nothing: no external identity search, no provider record, no refs", () => {
  for (const id of ["founder", "liv-1", "liv-2"]) {
    const h = page(id);
    assert.ok(!h.includes("wikipedia.org"), id + ": living page carries a Wikipedia link");
    assert.ok(!h.includes("familysearch.org"), id + ": living page carries a provider record link");
    assert.ok(!/>ref: /.test(h), id + ": living page lists provider refs");
    assert.equal(externalAnchors(h).length, 0, id + ": living page has external anchors");
    assert.match(h, /living — redacted stub/, id + ": the redaction is not stated");
  }
});

test("the grandparent branch: Donna answers for Charlemagne and Louis, worded as a family-tree route", () => {
  for (const [id, name] of [[CHARLE, "Charlemagne"], [LOUIS, "Louis"]]) {
    const h = page(id);
    assert.match(h, /Through <strong>Grandma Donna Ruth Lawton<\/strong>|Through Grandma Donna Ruth Lawton/, name + ": no Donna branch answer");
    assert.match(h, /the parent-to-child line from Donna Ruth Lawton/, name + ": no expandable line");
    assert.ok(h.includes(DONNA + ".html"), name + ": the branch head is not navigable");
    assert.match(h, /not an inherited DNA segment/, name + ": route-vs-DNA wording missing");
    assert.match(h, /check all four grandparent branches/, name + ": the four-branch check is missing");
  }
});

test("marriages and children are labelled groups with navigable relatives", () => {
  const c = page(CHARLE);
  assert.match(c, /<h3>marriage<\/h3>/, "no marriage heading");
  assert.ok(c.includes("Charlemagne Emperor Of The Holy Roman Empire &amp; <a href=\"pb8a3d3a07b.html\">Hildegard"), "Charlemagne's marriage does not name Hildegard as a link");
  assert.match(c, /children of this couple \(1\)/, "children are not grouped under the couple");
  assert.ok(c.includes(">" + "Louis I. Emperor Of The Holy Roman Empire</a>"), "Louis is not a navigable child");
  const d = page(DONNA);
  assert.ok(d.includes("Donna Ruth Lawton &amp; <a href="), "Donna's marriage to Jack is not a labelled group");
  assert.match(d, /Children listed here may not be the complete family/, "coverage law sentence missing");
});

test("sources stay classified with research notes; provider links open a new tab and say so", () => {
  const c = page(CHARLE);
  assert.match(c, /<h2>sources and research notes<\/h2>/, "sources section retitled away");
  assert.ok(c.includes("https://www.familysearch.org/tree/person/details/PFQ1-515\" target=\"_blank\" rel=\"noopener noreferrer\""), "FamilySearch record link lacks the new-tab law");
  assert.match(c, /opens a new tab/, "the reader is not told a new tab opens");
  assert.match(c, /research status: <b>/, "research status not carried");
  assert.match(c, /era ≠ support/, "era-vs-support law line missing");
});

test("same-origin relative navigation keeps the current tab (external-nav law)", () => {
  const h = page(DONNA);
  for (const a of h.matchAll(/<a [^>]*href="(?!https?:|#)([^"]+)"[^>]*>/g))
    assert.ok(!/target=/.test(a[0]), "same-origin link " + a[1] + " must not open a new tab");
});

test("a sample of the whole run: every external anchor carries the law, every relative link resolves", () => {
  const files = readdirSync(PAGES).filter((f) => f.endsWith(".html"));
  const known = new Set(files);
  const stride = Math.max(1, Math.floor(files.length / 300));
  for (let i = 0; i < files.length; i += stride) {
    const h = readFileSync(join(PAGES, files[i]), "utf8");
    for (const a of externalAnchors(h))
      assert.ok(a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"'), files[i] + ": external anchor without the law: " + a.slice(0, 90));
    for (const m of h.matchAll(/href="([a-z0-9-]+)\.html"/g))
      assert.ok(known.has(m[1] + ".html"), files[i] + ": relative link to missing page " + m[1]);
  }
});

test("generator ↔ output sync: committed pages are what the current generator emits", () => {
  for (const id of [CHARLE, LOUIS, DONNA, "founder", "p72d226cedf"]) {
    const staged = JSON.parse(readFileSync(join(PAGES, id + ".json"), "utf8"));
    assert.equal(renderPage(staged), page(id), id + ": committed page differs from generator output — regenerate");
  }
});
