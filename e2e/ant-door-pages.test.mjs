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
  assert.match(page, /autonomi:\/\/711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a/);
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

test("registry gloss no longer claims Pages is same-origin", () => {
  const row = estate.surfaces.find((s) => s.id === "ant-door");
  assert.ok(row);
  assert.equal(row.path, "surfaces/ant-door.html");
  assert.doesNotMatch(row.gloss, /same-origin/);
  assert.match(row.gloss, /GET-only door/);
});
