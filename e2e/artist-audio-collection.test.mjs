/* Collection behavior: coordinated tabs, trustworthy failures, bounded exports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const page = readFileSync(resolve(root, 'docs/mvp-walk/artist-audio-showcase.html'), 'utf8');
await import(pathToFileURL(resolve(root, 'docs/mvp-walk/assets/artist-audio/collection.js')).href);
const later = globalThis.BNRListenLater;
const FIXTURE = {
  id: 'test-audio-not-authorized-release', title: 'TEST AUDIO — not the authorized release',
  artist: 'Beehive Nature development fixture', rights: 'unconfirmed', fixture: true,
  fixtureNote: 'Development-only generated tone.', medium: 'audio', links: []
};
const ref = id => ({ ...FIXTURE, id });
const publicLink = url => ({ name: 'Public artist link', kind: 'external', url });

function memory(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return { getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)), _map: map };
}

function lockManager() {
  const tails = new Map();
  const requests = [];
  return { requests, request(name, options, action) {
    requests.push({ name, ...options });
    const before = tails.get(name) || Promise.resolve();
    let release;
    const done = new Promise(resolve => { release = resolve; });
    tails.set(name, done);
    return before.then(() => action({ name, mode: 'exclusive' })).finally(release);
  } };
}
const ids = storage => later.readStore(storage).items.map(item => item.id);

test('collection UI offers save/remove/export and names JAMS as external', () => {
  for (const id of ['save-later', 'remove-later', 'export-later']) assert.ok(page.includes('id="' + id + '"'));
  assert.match(page, /https:\/\/jams\.community\//);
  assert.match(page, /Not JAMS-compatible/);
});

test('simultaneous saves and removals use the same exclusive lock without losing entries', async () => {
  const storage = memory(); const locks = lockManager();
  const saved = await Promise.all(['A', 'B', 'C'].map(id => later.saveItem(storage, ref(id), { locks })));
  assert.ok(saved.every(result => result.saved));
  assert.deepEqual(ids(storage), ['A', 'B', 'C']);
  await Promise.all(['A', 'B'].map(id => later.removeItem(storage, id, { locks })));
  assert.deepEqual(ids(storage), ['C']);
  assert.equal(new Set(locks.requests.map(request => request.name)).size, 1);
  assert.ok(locks.requests.every(request => request.mode === 'exclusive'));
});

test('a queued mutation reads storage only after acquiring its lock', async () => {
  const storage = memory(); const locks = lockManager();
  let release; const blocker = new Promise(resolve => { release = resolve; });
  const held = locks.request('bnr-listen-later:mutation', { mode: 'exclusive' }, () => blocker);
  let reads = 0; const getItem = storage.getItem;
  storage.getItem = key => { reads++; return getItem(key); };
  const queued = later.saveItem(storage, ref('queued'), { locks });
  await Promise.resolve();
  assert.equal(reads, 0);
  storage.setItem(later.STORE, JSON.stringify({ schema: later.SCHEMA, items: [ref('committed-while-waiting')] }));
  release(); await held; await queued;
  assert.deepEqual(ids(storage), ['committed-while-waiting', 'queued']);
});

test('duplicate concurrent saves stay once and survive a fresh read', async () => {
  const storage = memory(); const locks = lockManager();
  const results = await Promise.all([1, 2].map(() => later.saveItem(storage, FIXTURE, { locks })));
  assert.equal(results.filter(result => result.saved).length, 1);
  assert.equal(results.filter(result => result.already).length, 1);
  const reloaded = later.readStore(storage);
  assert.equal(reloaded.items.length, 1);
  assert.equal(reloaded.items[0].fixture, true);
  assert.equal(reloaded.items[0].rights, 'unconfirmed');
});

test('missing or denied locks refuse mutations without reading or writing storage', async () => {
  const storage = { getItem() { assert.fail('unexpected read'); }, setItem() { assert.fail('unexpected write'); } };
  for (const locks of [null, {}, { request() { throw new Error('locks denied'); } }]) {
    await assert.rejects(later.saveItem(storage, FIXTURE, { locks }), { code: 'locking-unavailable' });
    await assert.rejects(later.removeItem(storage, FIXTURE.id, { locks }), { code: 'locking-unavailable' });
  }
});

test('rejected setItem preserves old data for both save and remove', async () => {
  const storage = memory(); const locks = lockManager();
  await later.saveItem(storage, FIXTURE, { locks });
  const before = storage.getItem(later.STORE);
  storage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(later.saveItem(storage, ref('new'), { locks }), { code: 'storage-denied', phase: 'write' });
  await assert.rejects(later.removeItem(storage, FIXTURE.id, { locks }), { code: 'storage-denied', phase: 'write' });
  assert.equal(storage.getItem(later.STORE), before);
});

test('a committed removal with denied verification is uncertain, not preserved', async () => {
  const storage = memory(); const locks = lockManager();
  await later.saveItem(storage, FIXTURE, { locks });
  const setItem = storage.setItem; const getItem = storage.getItem; let wrote = false;
  storage.setItem = (key, value) => { setItem(key, value); wrote = true; };
  storage.getItem = key => { if (wrote) throw new Error('read denied'); return getItem(key); };
  await assert.rejects(later.removeItem(storage, FIXTURE.id, { locks }), { code: 'uncertain-write', phase: 'verify' });
  assert.deepEqual(JSON.parse(getItem(later.STORE)).items, []);
});

test('an uncooperative writer during verification is uncertain and is never rolled back', async () => {
  const storage = memory(); const locks = lockManager();
  const setItem = storage.setItem;
  const outsider = JSON.stringify({ schema: later.SCHEMA, items: [ref('other-tab')] });
  storage.setItem = (key, value) => { setItem(key, value); setItem(key, outsider); };
  await assert.rejects(later.saveItem(storage, FIXTURE, { locks }), { code: 'uncertain-write' });
  assert.equal(storage.getItem(later.STORE), outsider);
});

test('removing an absent item is idempotent and does not attempt a write', async () => {
  const storage = memory(); storage.setItem = () => { assert.fail('unnecessary write'); };
  assert.deepEqual((await later.removeItem(storage, 'absent', { locks: lockManager() })).items, []);
});

test('malformed, future, duplicate, or invalid existing stores refuse writes without migration', async () => {
  const invalid = [
    '{bad json', JSON.stringify({ schema: 'bnr-listen-later/2', items: [] }),
    JSON.stringify({ schema: later.SCHEMA, items: [null] }),
    JSON.stringify({ schema: later.SCHEMA, items: [FIXTURE, FIXTURE] }),
    JSON.stringify({ schema: later.SCHEMA, items: [{ ...FIXTURE, title: { privatePath: 'synthetic-only' } }] }),
    JSON.stringify({ schema: later.SCHEMA, items: [{ ...FIXTURE, privatePath: 'synthetic-only' }] })
  ];
  for (const raw of invalid) {
    const storage = memory({ [later.STORE]: raw }); const locks = lockManager();
    assert.throws(() => later.readStore(storage), { code: 'unreadable' });
    await assert.rejects(later.saveItem(storage, ref('new'), { locks }), { code: 'unreadable' });
    await assert.rejects(later.removeItem(storage, FIXTURE.id, { locks }), { code: 'unreadable' });
    assert.equal(storage.getItem(later.STORE), raw);
  }
  assert.throws(() => later.readStore({ getItem() { throw new Error('denied'); } }), { code: 'storage-denied', phase: 'read' });
});

test('unsafe links are rejected rather than silently removed during save or export', async () => {
  const urls = [
    'javascript:alert(1)', 'file:///synthetic.wav', 'https://user:demo-password@example.com/track',
    'https://127.0.0.1/track', 'https://2130706433/track', 'https://0x7f000001/track',
    'https://[::1]/track', 'https://localhost/track', 'https://demo.local/track',
    'https://example.com/track?access_token=DEMO', 'https://example.com/track?apiKey=DEMO',
    'https://example.com/track?sessionId=DEMO', 'https://example.com/track#token=DEMO',
    'https://example.com/track#access-token', 'https://example.com/track?localPath=C%3A%2Fdemo',
    'https://www.youtube.com/watch?v=pb6OqIyyLAk&unknown=DEMO'
  ];
  for (const url of urls) {
    const entry = { ...FIXTURE, links: [publicLink(url)] }; const storage = memory();
    await assert.rejects(later.saveItem(storage, entry, { locks: lockManager() }), { code: 'invalid-entry' }, url);
    assert.equal(storage.getItem(later.STORE), null);
    assert.throws(() => later.exportPublic({ schema: later.SCHEMA, items: [entry] }), { code: 'invalid-entry' }, url);
  }
});

test('bounded metadata rejects objects, extra fields, control characters and excessive links', async () => {
  const invalid = [
    { ...FIXTURE, title: { privatePath: 'synthetic-only' } }, { ...FIXTURE, artist: [] },
    { ...FIXTURE, id: '' }, { ...FIXTURE, title: 'x'.repeat(301) }, { ...FIXTURE, fixture: 'false' },
    { ...FIXTURE, fixtureNote: 'line\u0000break' }, { ...FIXTURE, privatePath: 'synthetic-only' },
    { ...FIXTURE, links: new Array(1) },
    { ...FIXTURE, links: Array(9).fill(publicLink('https://example.com/artist')) }
  ];
  for (const entry of invalid) {
    await assert.rejects(later.saveItem(memory(), entry, { locks: lockManager() }), { code: 'invalid-entry' });
    assert.throws(() => later.exportPublic({ schema: later.SCHEMA, items: [entry] }), { code: 'invalid-entry' });
  }
});

test('collection cap refuses growth without preventing duplicate save or removal', async () => {
  const full = { schema: later.SCHEMA, items: Array.from({ length: later.MAX_ITEMS }, (_, i) => ref(String(i))) };
  const storage = memory({ [later.STORE]: JSON.stringify(full) }); const locks = lockManager();
  await assert.rejects(later.saveItem(storage, ref('overflow'), { locks }), { code: 'collection-full' });
  assert.equal((await later.saveItem(storage, ref('0'), { locks })).already, true);
  await later.removeItem(storage, '0', { locks });
  assert.equal((await later.saveItem(storage, ref('replacement'), { locks })).saved, true);
  assert.equal(later.readStore(storage).items.length, later.MAX_ITEMS);
});

test('export retains credits and fixture identity, canonicalizes a public watch link and keeps clean artist links', async () => {
  const storage = memory();
  const entry = { ...FIXTURE, links: [publicLink('https://youtu.be/pb6OqIyyLAk?si=public-share-code'), publicLink('https://example.com/artist#credits')] };
  await later.saveItem(storage, entry, { locks: lockManager() });
  const exported = later.exportPublic(later.readStore(storage));
  assert.equal(exported.items[0].title, FIXTURE.title);
  assert.equal(exported.items[0].artist, FIXTURE.artist);
  assert.equal(exported.items[0].fixture, true);
  assert.equal(exported.items[0].links[0].url, 'https://www.youtube.com/watch?v=pb6OqIyyLAk');
  assert.equal(exported.items[0].links[1].url, 'https://example.com/artist#credits');
  assert.match(exported.note, /Not JAMS-compatible/);
  assert.match(exported.note, /cannot detect every private detail/);
});
