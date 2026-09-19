/* agent-dock.js cache-bust pin gate (2026-09-19). tour.js does not inject
   agent-dock.js, so each page's `?v=N` is the only cache key the dock has.
   On d7b9b2c6 the one file was pinned three ways (v=4 ×9, v=5 ×6, v=9 ×1)
   while agent-dock.js kept changing. Rules:
     1. Every surfaces/**.html reference to agent-dock.js carries a `?v=N` pin.
     2. Every holder outside EXEMPT carries the same pin, and that pin is the
        one index.html carries (the estate's newest).
     3. EXEMPT rows are owner-fenced pages that still hold an old pin. Each row
        asserts its page still holds exactly that pin, so the owner who bumps
        the page must delete the row in the same change (the no-dead-host
        pin-row pattern). The rows are debt, not a pass. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const walk = (dir, out = []) => {
  for (const e of readdirSync(new URL('../' + dir, import.meta.url))) {
    const p = join(dir, e).replace(/\\/g, '/');
    if (statSync(new URL('../' + p, import.meta.url)).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
};

const EXEMPT = [
  { file: 'surfaces/wallet.html', pin: '5', lane: 'payment lane' },
  { file: 'surfaces/royalguard.html', pin: '5', lane: 'payment lane (treasury/wallet deck)' },
  { file: 'surfaces/profile.html', pin: '5', lane: 'genealogy lane' },
  { file: 'surfaces/bmeshasi.html', pin: '5', lane: 'bKiMi, PR #92' },
];

const holders = walk('surfaces')
  .map(file => ({ file, refs: [...read(file).matchAll(/agent-dock\.js(?:\?v=(\d+))?/g)].map(m => m[1]) }))
  .filter(h => h.refs.length);

test('every agent-dock.js reference carries a ?v= pin', () => {
  assert.ok(holders.length >= 16, 'scanner must actually be finding the dock holders');
  const unpinned = holders.filter(h => h.refs.some(r => r === undefined)).map(h => h.file);
  assert.deepEqual(unpinned, []);
});

test('every unfenced holder carries index.html\'s pin', () => {
  const newest = holders.find(h => h.file === 'surfaces/index.html');
  assert.ok(newest, 'index.html must hold the dock');
  assert.equal(newest.refs.length, 1);
  const pin = newest.refs[0];
  const exempt = new Set(EXEMPT.map(e => e.file));
  const drift = holders
    .filter(h => !exempt.has(h.file))
    .filter(h => h.refs.some(r => r !== pin))
    .map(h => `${h.file} v=${h.refs.join(',')}`);
  assert.deepEqual(drift, [], `every unfenced page pins agent-dock.js?v=${pin}`);
});

for (const e of EXEMPT) {
  test(`${e.file}: exempt at v=${e.pin} (${e.lane}); delete this row when the owner bumps`, () => {
    const h = holders.find(x => x.file === e.file);
    assert.ok(h, 'an exempt page that no longer holds the dock must lose its row');
    assert.deepEqual(h.refs, [e.pin]);
  });
}
