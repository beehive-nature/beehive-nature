/* Source checks for listening.html's three views. Views change density, never
   the piece: the provenance card (§3) and the creation doctrine (§4) are
   <details data-reg-disclose> (register.js collapses them for bee/raver and
   opens them for cypherpunk); the seed, player and fork (§1, §2) stay open.
   The page carries no per-view markup, so every fact, link and keyed string is
   identical in all three views by construction. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/listening.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script src="tour.js'));
const sections = [...body.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);

test('no per-view markup: every view renders the same facts and links', () => {
  assert.doesNotMatch(body, /data-reg=/);
  assert.doesNotMatch(page.slice(page.indexOf('<script>')), /data-reg|bregister/);
  const links = [...body.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, ['blight/midi-organ.html', 'blight/studio-music.html', 'index.html']);
  assert.equal(sections.length, 4);
});

test('the provenance card and the doctrine are view disclosures with their keyed heading as the summary', () => {
  const blocks = [...body.matchAll(/<details data-reg-disclose>\s*<summary><h2>\d · <span data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(blocks, ['h.150', 'h.151']);
  assert.equal((body.match(/<details\b/g) || []).length, 2);
  assert.equal((body.match(/<\/details>/g) || []).length, 2);
  assert.doesNotMatch(body, /<details data-reg-disclose open/);
  assert.match(sections[2], /<table>[\s\S]*<\/table>\s*<\/details>\s*$/);
  assert.equal((sections[2].match(/<tr>/g) || []).length, 6);
  assert.match(sections[3], /SPEC-DJBUZZ-1 §7\.<\/div>\s*<\/details>\s*$/);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
});

test('the piece and the fork stay open in every view', () => {
  for (const s of sections.slice(0, 2)) assert.doesNotMatch(s, /<details/);
  for (const id of ['seed', 'play', 'stop', 'rand', 'viz', 'now']) assert.match(sections[0], new RegExp('id="'+id+'"'));
  for (const id of ['fork', 'forkcount', 'lineage']) assert.match(sections[1], new RegExp('id="'+id+'"'));
  assert.match(sections[0], /data-i18n="h\.148"/);
  assert.match(sections[1], /data-i18n="h\.149"/);
});
