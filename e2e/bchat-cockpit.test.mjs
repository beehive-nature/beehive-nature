// bchat-cockpit.test.mjs — the connection-health strip is a projection of the receipt stream.
// Proves: green needs its receipt; "restricted" never renders as success and keeps the relay's
// words; fallback differs from primary; offline is a legitimate state; no plaintext reaches a
// light or an evidence row. Run: node --test e2e/bchat-cockpit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../surfaces/bchat-core.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../surfaces/bchat-cockpit.js', import.meta.url), 'utf8'), ctx);
const { BCHAT, BCHATCOCKPIT } = ctx;

// receipts are written the page's way: BCHAT.receipt, newest first
function stream(rows) {
  let t = 1000;
  const out = [];
  for (const [event, ref, meta, dt] of rows) { t += dt || 10; const r = BCHAT.receipt(event, ref, meta || {}); r.ts = t; out.unshift(r); }
  return out;
}
const light = (p, key) => p.lights.find(l => l.key === key);
const info = (p, key) => p.info.find(r => r[0] === key)[1];

test('a fresh page has no green light: absence of evidence is not health', () => {
  const p = BCHATCOCKPIT.project(stream([['surface-open', 'local-state-only'], ['road-remembered', 'wss://skaists.buzz', { road: 'primary' }]]), 2000);
  assert.deepEqual([...p.lights.map(l => l.tone)], ['idle', 'idle', 'idle', 'idle', 'idle']);
  assert.equal(light(p, 'road').word, 'primary · not probed');
  assert.equal(light(p, 'crypto').word, 'vectors not run in this page');
  assert.equal(light(p, 'receipt').word, 'no event evidence yet');
});

test('each green light needs its own receipt', () => {
  const p = BCHATCOCKPIT.project(stream([
    ['key-armed', 'abcd1234'],
    ['vectors-run', 'nip44', { passed: 5, total: 5 }],
    ['road-probe', 'https://skaists.buzz/', { road: 'primary' }],
    ['relay-dial', 'wss://skaists.buzz', { road: 'primary' }],
    ['relay-open', 'wss://skaists.buzz', {}, 120],
    ['nip42-challenge', 'wss://skaists.buzz', {}, 30],
    ['nip42-auth', 'e1'.repeat(32), { kind: 22242 }, 5],
    ['nip42-verdict', 'e1'.repeat(32), { ok: true, note: '' }, 40],
    ['dm-offered', 'ff'.repeat(32), { kind: 1059 }],
    ['dm-published', 'ff'.repeat(32), { kind: 1059 }, 75]
  ]), 5000);
  assert.deepEqual([...p.lights.map(l => l.tone)], ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.equal(light(p, 'relay').word, '✓ published');
  assert.equal(info(p, 'socket open'), '✓ · dial → open 120 ms');
  assert.equal(info(p, 'AUTH answered'), '✓ · challenge → AUTH 5 ms');
  assert.equal(info(p, 'AUTH verdict'), '✓ OK true · AUTH → OK 40 ms');
  assert.equal(info(p, 'EVENT → OK'), '75 ms · last offer');
  assert.equal(info(p, 'last event'), 'ffffffff…');
  assert.ok(p.live);

  const failed = BCHATCOCKPIT.project(stream([['vectors-run', 'nip44', { passed: 4, total: 5 }]]));
  assert.equal(light(failed, 'crypto').tone, 'bad');
  const socketOnly = BCHATCOCKPIT.project(stream([['relay-dial', 'wss://skaists.buzz', { road: 'primary' }], ['relay-open', 'wss://skaists.buzz']]));
  assert.equal(light(socketOnly, 'relay').tone, 'idle', 'an open socket is not an authed relay');
});

test('restricted never renders as success, and keeps the relay\'s own words', () => {
  const words = 'restricted: not a relay member';
  const p = BCHATCOCKPIT.project(stream([
    ['key-armed', 'abcd1234'],
    ['relay-dial', 'wss://skaists.buzz', { road: 'primary' }],
    ['relay-open', 'wss://skaists.buzz'],
    ['nip42-challenge', 'wss://skaists.buzz'],
    ['nip42-auth', 'aa'.repeat(32), { kind: 22242 }],
    ['nip42-verdict', 'aa'.repeat(32), { ok: false, note: words }],
    ['dm-offered', 'bb'.repeat(32)],
    ['dm-rejected', 'bb'.repeat(32), { note: words }],
    ['relay-closed', 'wss://skaists.buzz']
  ]));
  const relay = light(p, 'relay');
  assert.equal(relay.tone, 'bad');
  assert.equal(relay.word, words);
  assert.equal(light(p, 'receipt').tone, 'idle');
  assert.equal(info(p, 'relay verdict'), words);
  assert.equal(info(p, 'AUTH verdict').startsWith('✗ OK false'), true);
  assert.equal(info(p, 'publication'), '✗ 1 rejected');
  const closed = BCHATCOCKPIT.project(stream([['relay-dial', 'wss://x', { road: 'primary' }], ['relay-open', 'wss://x'], ['sub-closed', 'bchat_1', { note: words }]]));
  assert.equal(light(closed, 'relay').tone, 'bad');
});

test('fallback is visibly different from primary, and offline is a state of its own', () => {
  const fb = BCHATCOCKPIT.project(stream([['road-probe', 'https://relay.skaists.dev', { road: 'fallback' }]]));
  assert.equal(light(fb, 'road').tone, 'alt');
  assert.match(light(fb, 'road').word, /fallback/);
  const remembered = BCHATCOCKPIT.project(stream([['road-remembered', 'wss://relay.skaists.dev', { road: 'fallback' }]]));
  assert.equal(light(remembered, 'road').word, '↪ fallback · remembered');
  const none = BCHATCOCKPIT.project(stream([['road-probe', 'https://relay.skaists.dev', { road: 'none' }]]));
  assert.deepEqual({ ...light(none, 'road') }, { key: 'road', tone: 'idle', word: 'offline' });
  const off = BCHATCOCKPIT.project(stream([['road-probe', 'https://skaists.buzz/', { road: 'primary' }], ['net-offline', 'browser']]));
  assert.equal(light(off, 'road').word, 'offline');
});

test('no plaintext reaches the strip: receipts drop content keys, and the projection reads none', () => {
  const secret = 'meet me at the north gate at nine';
  const p = BCHATCOCKPIT.project(stream([
    ['dm-offered', 'cc'.repeat(32), { kind: 1059, text: secret, content: secret, plaintext: secret, payload: secret }],
    ['dm-published', 'cc'.repeat(32), { kind: 1059, text: secret }]
  ]));
  assert.doesNotMatch(JSON.stringify(p), /north gate/);
});
