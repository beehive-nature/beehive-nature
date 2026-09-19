/* Source checks for bset.html's three views. Views change density, never the
   set: the header subtitle is the only per-view prose, and the composer and the
   law block are <details data-reg-disclose> (register.js collapses them for
   bee/raver and opens them for cypherpunk). The track data, the list, every
   link and every keyed string are shared markup, so they are identical in all
   three views by construction. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bset.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script type="application/json" id="setdata">'));
const header = body.slice(body.indexOf('<header>'), body.indexOf('</header>'));

test('the only per-view markup is the three header subtitles, one per view', () => {
  const variants = [...body.matchAll(/data-reg="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(variants, ['bee', 'raver', 'cypherpunk']);
  assert.deepEqual([...header.matchAll(/data-reg="([a-z]+)"/g)].map(m => m[1]), variants);
  for (const key of ['bst.bee', 'bst.rav', 'bst.cy']) assert.match(header, new RegExp('data-i18n="'+key.replace('.', '\\.')+'"'));
});

test('composer and law block are view disclosures with their keyed heading as the summary', () => {
  const blocks = [...body.matchAll(/<details data-reg-disclose>\s*<summary><h2 data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(blocks, ['bst.h.drop', 'bst.h.details']);
  assert.equal((body.match(/<details\b/g) || []).length, 2);
  assert.equal((body.match(/<\/details>/g) || []).length, 2);
  assert.doesNotMatch(body, /<details data-reg-disclose open/);
  const drop = body.slice(body.indexOf('data-i18n="bst.h.drop"'), body.indexOf('data-i18n="bst.h.details"'));
  for (const id of ['paste', 'preview', 'emit', 'share', 'out']) assert.match(drop, new RegExp('id="'+id+'"'));
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
  assert.match(page, /<script src="tour\.js\?v=\d+"><\/script>/);
});

test('the set itself sits outside every view switch and every disclosure', () => {
  const set = body.slice(body.indexOf('<section>'), body.indexOf('</section>'));
  for (const needle of ['id="tracks"', 'id="setcount"', 'id="emptynote"', 'data-i18n="bst.source"']) {
    assert.ok(set.includes(needle), needle);
  }
  assert.doesNotMatch(set, /data-reg=|<details/);
  const data = JSON.parse(page.match(/<script type="application\/json" id="setdata">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.tracks.length, 100);
  assert.doesNotMatch(page.slice(page.indexOf('<script>')), /data-reg|bregister/);
});

test('every link on the page is shared markup, not per-view', () => {
  const links = [...body.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
  const perView = [...header.matchAll(/<div class="sub" data-reg="[^"]+"[\s\S]*?<\/div>/g)].map(m => m[0]).join('');
  assert.doesNotMatch(perView, /<a /);
  assert.deepEqual(links, [
    'https://youtube.com/playlist?list=PLkUQHd8CpZKngAYcM7R0Zy4d8cGfzzwL5',
    'listening.html', 'blight/midi-organ.html', 'index.html'
  ]);
});
