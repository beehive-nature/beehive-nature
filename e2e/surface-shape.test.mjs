/* Estate markup-shape guard (2026-09-19), standalone on the no-dead-host
   precedent. For every surfaces/**.html:
     1. every heading level h1-h6 has as many closes as opens, and each
        heading closes its own level (b4b.html once closed an <h2> with </h5>);
     2. <details> opens and closes balance;
     3. no disclosure opens straight into a twin: a <summary> followed directly
        by a <details> whose summary carries the same data-i18n key. That shape
        shows the summary row twice and takes two taps for bee/raver
        (blight/museum.html carried three).
   EXEMPT rows are known twins whose owner fixes them in their own lane. Each
   row asserts its page still holds exactly that many twin hits, so the owner
   who fixes the page must delete the row in the same change. The rows are
   debt, not a pass. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const walk = (dir, out = []) => {
  for (const e of readdirSync(new URL('../' + dir, import.meta.url))) {
    if (e === 'node_modules') continue;
    const p = join(dir, e).replace(/\\/g, '/');
    if (statSync(new URL('../' + p, import.meta.url)).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
};

const pages = walk('surfaces').map(file => ({ file, src: read(file) }));
const count = (s, re) => (s.match(re) || []).length;

const EXEMPT = [
  { file: 'surfaces/blight/midi.html', key: 'md.d.compose', hits: 2, owner: 'ZcODe5.3max, Z3 (triple wrapper)' },
  { file: 'surfaces/blight/midi.html', key: 'md.d.balance', hits: 2, owner: 'ZcODe5.3max, Z3 (triple wrapper)' },
];

function twins(src) {
  // the summary body may not cross another summary tag, and the twin is a
  // lookahead, so a triple wrapper counts its two adjacent pairs
  const re = /<summary[^>]*data-i18n="([^"]+)"[^>]*>[^<]*(?:<(?!\/?summary[\s>])[^<]*)*<\/summary>(?=\s*<details[^>]*>\s*<summary[^>]*data-i18n="([^"]+)")/g;
  const out = [];
  for (const m of src.matchAll(re)) if (m[1] === m[2]) out.push(m[1]);
  return out;
}

test('the guard is reading the estate', () => {
  assert.ok(pages.length >= 100, `found ${pages.length} pages`);
});

test('every heading level balances and closes its own level', () => {
  const bad = [];
  for (const { file, src } of pages) {
    for (let n = 1; n <= 6; n++) {
      const o = count(src, new RegExp(`<h${n}[\\s>]`, 'g')), c = count(src, new RegExp(`</h${n}>`, 'g'));
      if (o !== c) bad.push(`${file} h${n} open=${o} close=${c}`);
    }
    for (const m of src.matchAll(/<h([1-6])[\s>][^<]*(?:<(?!\/?h[1-6][\s>])[^<]*)*<\/h([1-6])>/g)) {
      if (m[1] !== m[2]) bad.push(`${file} <h${m[1]}> closed by </h${m[2]}>`);
    }
  }
  assert.deepEqual(bad, []);
});

test('<details> opens and closes balance', () => {
  const bad = pages
    .map(({ file, src }) => [file, count(src, /<details[\s>]/g), count(src, /<\/details>/g)])
    .filter(([, o, c]) => o !== c)
    .map(([f, o, c]) => `${f} details open=${o} close=${c}`);
  assert.deepEqual(bad, []);
});

test('no disclosure opens straight into a twin, outside the exemption rows', () => {
  const exempt = new Set(EXEMPT.map(e => e.file + '#' + e.key));
  const bad = [];
  for (const { file, src } of pages) {
    for (const k of twins(src)) if (!exempt.has(file + '#' + k)) bad.push(`${file} ${k}`);
  }
  assert.deepEqual(bad, []);
});

for (const e of EXEMPT) {
  test(`${e.file} ${e.key}: exempt at ${e.hits} twin hits (${e.owner}); delete this row when fixed`, () => {
    const p = pages.find(x => x.file === e.file);
    assert.ok(p, 'an exempt page that no longer exists must lose its row');
    assert.equal(twins(p.src).filter(k => k === e.key).length, e.hits);
  });
}
