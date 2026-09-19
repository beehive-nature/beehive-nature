/* Source checks for biq.html's three views. Views change density, never the
   composer: section 1 (the before-composing check) is a <details
   data-reg-disclose> (register.js collapses it for bee/raver and opens it for
   cypherpunk); the why (§0), every composer step (§2 subject, §3 sentences,
   §4 tone check) and the draft with its human-hands handoff (§5) stay open.
   The page carries no per-view markup, so every fact, link and keyed string
   is identical in all three views by construction. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/biq.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script src="tour.js'));
const sections = [...body.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);
const ORDER = 'https://github.com/beehive-nature/beehive-nature/blob/main/docs/dispatches/ORDER_ZAGENT_IQWIKI_SOPHIA_2026-08-20.md';

test('no per-view markup: every view renders the same facts and links', () => {
  assert.doesNotMatch(body, /data-reg=/);
  assert.doesNotMatch(page.slice(page.indexOf('<script>')), /data-reg|bregister/);
  const links = [...body.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, [ORDER, 'https://iq.wiki/', ORDER, 'index.html']);
  assert.equal(sections.length, 6);
});

test('the before-composing check is the one view disclosure, keyed heading as summary', () => {
  const blocks = [...body.matchAll(/<details data-reg-disclose>\s*<summary><h2>\d · <span data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(blocks, ['h.045']);
  assert.equal((body.match(/<details\b/g) || []).length, 1);
  assert.equal((body.match(/<\/details>/g) || []).length, 1);
  assert.doesNotMatch(body, /<details data-reg-disclose open/);
  assert.match(sections[1], /^\s*<details data-reg-disclose>[\s\S]*href="https:\/\/iq\.wiki\/"[\s\S]*<\/details>\s*$/);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
});

test('the why, every composer step and the draft stay open in every view', () => {
  for (const i of [0, 2, 3, 4, 5]) assert.doesNotMatch(sections[i], /<details/, '§'+i);
  const keys = ['h.044', null, 'h.046', 'h.047', 'h.048', 'h.049'];
  for (const i of [0, 2, 3, 4, 5]) assert.match(sections[i], new RegExp('^\\s*<h2>'+i+' · <span data-i18n="'+keys[i].replace('.', '\\.')+'">'));
  assert.match(sections[2], /id="subject"[\s\S]*id="scope"/);
  for (const id of ['sents', 'c-text', 'c-label', 'c-url', 'c-fb']) assert.match(sections[3], new RegExp('id="'+id+'"'));
  assert.match(sections[3], /onclick="addCustom\(\)"/);
  assert.match(sections[4], /onclick="compose\(\)"[\s\S]*id="toneOut"/);
  assert.match(sections[5], /id="draft"[\s\S]*id="cp"[\s\S]*class="never"/);
});
