/* Source checks for bfactory.html's three views. Views change density, never
   the design: sections 3-5 (what plugs in, honesty, open gates) are
   <details data-reg-disclose> (register.js collapses them for bee/raver and
   opens them for cypherpunk); the design bar, the farmer's law, the control
   loop (§1) and the fraction planner (§2) stay open. The page carries no
   per-view markup, so every fact, link and keyed string is identical in all
   three views by construction. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bfactory.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script src="tour.js'));
const beforeMain = body.slice(0, body.indexOf('<main>'));
const sections = [...body.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);

test('no per-view markup: every view renders the same facts and links', () => {
  assert.doesNotMatch(body, /data-reg=/);
  assert.doesNotMatch(page.slice(page.indexOf('<script>')), /data-reg|bregister/);
  const links = [...body.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, ['blight/farmers.html', 'blight/coop.html', 'index.html']);
  assert.equal(sections.length, 5);
});

test('sections 3-5 are view disclosures with their keyed heading as the summary', () => {
  const blocks = [...body.matchAll(/<details data-reg-disclose>\s*<summary><h2>\d · <span data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(blocks, ['h.019', 'h.020', 'h.021']);
  assert.equal((body.match(/<details\b/g) || []).length, 3);
  assert.equal((body.match(/<\/details>/g) || []).length, 3);
  assert.doesNotMatch(body, /<details data-reg-disclose open/);
  for (const s of sections.slice(2)) assert.match(s, /^\s*<details data-reg-disclose>[\s\S]*<\/details>\s*$/);
  assert.equal((sections[2].match(/<tr>/g) || []).length, 7);
  assert.equal((sections[4].match(/class="gate"/g) || []).length, 3);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
});

test('the design bar, the farmer\'s law, the loop and the planner stay open in every view', () => {
  assert.doesNotMatch(beforeMain, /<details/);
  assert.match(beforeMain, /id="designbar"[\s\S]*NOTHING IS BUILT/);
  assert.match(beforeMain, /id="farmerlaw"[\s\S]*THE FARMER EATS FIRST/);
  assert.doesNotMatch(sections[0], /<details/);
  assert.match(sections[0], /data-i18n="h\.017"[\s\S]*id="loop"/);
  assert.doesNotMatch(sections[1], /<details/);
  assert.match(sections[1], /^\s*<h2>2 · <span data-i18n="h\.018">/);
  assert.match(sections[1], /data-plan="fibre"[\s\S]*data-plan="seed"[\s\S]*data-plan="dual"[\s\S]*id="split"/);
});
