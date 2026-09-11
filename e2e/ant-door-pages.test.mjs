import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "surfaces/ant-door.html"), "utf8");
const atlas = readFileSync(join(root, "surfaces/index.html"), "utf8");
const estate = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));

const ADDR = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a"; // PUBLIC-CONSTANT
const articles = [...atlas.matchAll(/<article class="srf"[\s\S]*?<\/article>/g)];

test("public Autonomi address stays the documented DataMap", () => {
  assert.match(page, new RegExp(ADDR + ".*PUBLIC-CONSTANT"));
  assert.match(page, /autonomi:\/\/711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a/); // PUBLIC-CONSTANT
});

test("Pages hosts use the relay door; local poke can stay same-origin", () => {
  assert.match(page, /https:\/\/relay\.skaists\.dev/);
  assert.match(page, /host === "skaists\.dev"/);
  assert.match(page, /doorBases/);
  assert.match(page, /\?door=relay/);
  assert.match(page, /isPagesHtml/);
});

test("estate three-view chrome and language stay on the page", () => {
  assert.match(page, /data-experience="ant-door"/);
  assert.match(page, /data-language-host/);
  assert.match(page, /data-experience-nav/);
  assert.match(page, /data-tour-host/);
  assert.match(page, /tour\.js\?v=41/);
  assert.match(page, /data-view="bee"/);
  assert.match(page, /data-view="raver"/);
  assert.match(page, /data-view="cypherpunk"/);
});

test("post-success connect cards are parsed from the atlas, not invented", () => {
  assert.match(page, /fetch\(new URL\("index\.html"/);
  assert.match(page, /article\.srf/);
  assert.match(page, /a\.surface-link/);
  assert.match(page, /\.open-seat/);
  assert.match(page, /ant-door omitted/);
  assert.match(page, /ant-door\\?\.html/);
  const published = estate.surfaces.filter((s) => s.presented !== false);
  assert.equal(articles.length, published.length);
  assert.ok(articles.length >= 90, "atlas still publishes the estate, not a handful");
  assert.match(atlas, /href="bsymposium.html"/);
  assert.match(atlas, /href="bearth.html"/);
  assert.match(atlas, /href="bfood.html"/);
  assert.match(atlas, /href="bantfarm.html"/);
  assert.match(atlas, /href="blight\/gallery.html"/);
  assert.match(atlas, /href="blight\/studio-music.html"/);
  assert.match(atlas, /href="watch.html"/);
  assert.match(atlas, /href="blight\/midivault.html"/);
});

function collectAttrBlocks(html, attr, view) {
  const chunks = [];
  const tagged = new RegExp(
    `<([a-z0-9]+)([^>]*\\s(?:${attr})="${view}"[^>]*)>`,
    "gi"
  );
  let m;
  while ((m = tagged.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === "body") continue;
    const start = m.index;
    const openEnd = tagged.lastIndex;
    if (/\/>$/.test(m[0])) {
      chunks.push(m[0]);
      continue;
    }
    const close = new RegExp(`</${tag}>`, "i");
    const rest = html.slice(openEnd);
    const end = rest.search(close);
    chunks.push(html.slice(start, end === -1 ? openEnd : openEnd + end + tag.length + 3));
  }
  return chunks.join("\n");
}

function speakBranches(html, view) {
  const start = html.indexOf("function speak(");
  const end = html.indexOf("function teachFailure(");
  assert.ok(start >= 0 && end > start, "speak() must sit above teachFailure()");
  const speak = html.slice(start, end);
  const parts = speak.split(/v === "/);
  return parts
    .filter((p) => p.startsWith(view + "\""))
    .map((p) => p.split(/}else/)[0])
    .join("\n");
}

const JARGON = /CORS|WASM|\bproxy\b|GitHub Pages|same-origin|daemon|GET-only|DataMap|\/ant\/v1|\bantd\b|Caddy/i;

test("New bee first paint is one image moment — no protocol cards", () => {
  const markup = [
    collectAttrBlocks(page, "data-view", "bee"),
    collectAttrBlocks(page, "data-reg", "bee"),
  ].join("\n");
  assert.match(markup, /Look first\./);
  assert.doesNotMatch(markup, /<h2>Look<\/h2>|<h2>Feel<\/h2>|<h2>Choose<\/h2>/);
  assert.doesNotMatch(page, /<section class="truth" data-reg="bee"/);
  assert.doesNotMatch(markup, JARGON);
  const beeSpeak = speakBranches(page, "bee");
  assert.match(beeSpeak, /It arrived\./);
  assert.match(beeSpeak, /Not this time\./);
  assert.doesNotMatch(beeSpeak, JARGON);
  assert.doesNotMatch(beeSpeak, /BYTES|UNREACHABLE|SAME-ORIGIN|RELAY/);
});

test("progressive disclosure: bee closed, raver optional road, cypherpunk full", () => {
  assert.match(page, /data-view-disclosure="road"/);
  assert.match(page, /data-view-disclosure="rooms"/);
  assert.match(page, /data-view-disclosure="record"/);
  assert.match(page, /function defaultOpen/);
  assert.match(page, /reading === "cypherpunk"/);
  assert.match(page, /How it found you/);
  const start = page.indexOf("function defaultOpen");
  const end = page.indexOf("function applyReading");
  const fn = page.slice(start, end);
  assert.match(fn, /kind === "record"/);
  assert.match(fn, /kind === "rooms"/);
  assert.match(fn, /return false/);
});

test("Raver copy celebrates the picture; no protocol lecture", () => {
  const markup = [
    collectAttrBlocks(page, "data-view", "raver"),
    collectAttrBlocks(page, "data-reg", "raver"),
  ].join("\n");
  assert.match(markup, /garden|bloom|dusk|living/i);
  assert.doesNotMatch(markup, JARGON);
  const raverSpeak = speakBranches(page, "raver");
  assert.match(raverSpeak, /It bloomed/);
  assert.match(raverSpeak, /The garden just handed you a living picture\./);
  assert.doesNotMatch(raverSpeak, JARGON);
  assert.doesNotMatch(raverSpeak, /BYTES|UNREACHABLE|SAME-ORIGIN|\/ant/);
});

test("Cypherpunk keeps door vs WASM, /ant proxy, relay, network-tab truth", () => {
  const markup = [
    collectAttrBlocks(page, "data-view", "cypherpunk"),
    collectAttrBlocks(page, "data-reg", "cypherpunk"),
  ].join("\n");
  assert.match(markup, /Door vs WASM/);
  assert.match(markup, /\/ant/);
  assert.match(markup, /relay\.skaists\.dev/);
  assert.match(markup, /Network tab/);
  assert.match(markup, /WASM/);
  const punkSpeak = speakBranches(page, "cypherpunk");
  assert.match(punkSpeak, /BYTES/);
  assert.match(page, /ant-door omitted/);
});

test("registry gloss no longer claims Pages is same-origin", () => {
  const row = estate.surfaces.find((s) => s.id === "ant-door");
  assert.ok(row);
  assert.equal(row.path, "surfaces/ant-door.html");
  assert.doesNotMatch(row.gloss, /same-origin/);
  assert.match(row.gloss, /GET-only door/);
});
