/* Public listen-later collection: save once, refuse writes, export public data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const page = readFileSync(resolve(root, 'docs/mvp-walk/artist-audio-showcase.html'), 'utf8');
const collectionSrc = readFileSync(resolve(root, 'docs/mvp-walk/assets/artist-audio/collection.js'), 'utf8');
const showcase = readFileSync(resolve(root, 'docs/mvp-walk/assets/artist-audio/showcase.js'), 'utf8');

await import(pathToFileURL(resolve(root, 'docs/mvp-walk/assets/artist-audio/collection.js')).href);
const later = globalThis.BNRListenLater;
assert.ok(later, 'collection.js must attach BNRListenLater');

const FIXTURE = {
  id: 'test-audio-not-authorized-release',
  title: 'TEST AUDIO — not the authorized release',
  artist: 'Beehive Nature development fixture (not an artist release)',
  rights: 'unconfirmed',
  fixture: true,
  fixtureNote: 'Development-only generated tone. Not an authorized recording.',
  medium: 'audio',
  links: [
    { name: 'YouTube', kind: 'external', url: 'https://www.youtube.com/watch?v=pb6OqIyyLAk' },
    { name: 'evil', kind: 'external', url: 'javascript:alert(1)' },
    { name: 'local', kind: 'local', url: 'assets/artist-audio/TEST-AUDIO-not-authorized-release.wav' },
    { name: 'wallet', kind: 'wallet', url: 'https://example.invalid/wallet' }
  ]
};

function memory(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    _map: map
  };
}

test('page offers save, remove, export, and an external JAMS link without compatibility claims', () => {
  assert.match(page, /id="save-later"/);
  assert.match(page, /id="remove-later"/);
  assert.match(page, /id="export-later"/);
  assert.match(page, /https:\/\/jams\.community\//);
  assert.match(page, /Explore JAMS is a separate external site/);
  assert.match(page, /Not JAMS-compatible/);
  assert.match(collectionSrc, /Not JAMS-compatible/);
  assert.doesNotMatch(page, /(?<!Not )JAMS-compatible/);
  assert.doesNotMatch(collectionSrc, /(?<!Not )JAMS-compatible/);
  assert.match(page, /assets\/artist-audio\/collection\.js/);
});

test('save once is idempotent and keeps fixture status', () => {
  const storage = memory();
  const first = later.saveItem(storage, FIXTURE);
  assert.equal(first.saved, true);
  assert.equal(first.already, false);
  assert.equal(first.store.items.length, 1);
  assert.equal(first.store.items[0].fixture, true);
  assert.equal(first.store.items[0].rights, 'unconfirmed');
  const second = later.saveItem(storage, FIXTURE);
  assert.equal(second.saved, false);
  assert.equal(second.already, true);
  assert.equal(second.store.items.length, 1);
});

test('failed writes do not report saved and do not erase earlier entries', () => {
  const storage = memory();
  later.saveItem(storage, FIXTURE);
  const prior = storage.getItem(later.STORE);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => later.saveItem(storage, {
    ...FIXTURE,
    id: 'other-public-ref'
  }), /quota|storage-denied/);
  assert.equal(storage._map.get(later.STORE), prior);
  assert.match(showcase, /Save was refused\. Earlier entries were not erased\./);
  assert.match(showcase, /paintCollection\(before/);
});

test('export is public data only: credits, https external links, no private paths', () => {
  const storage = memory();
  later.saveItem(storage, FIXTURE);
  const exported = later.exportPublic(later.readStore(storage));
  assert.equal(exported.schema, 'bnr-listen-later/1');
  assert.match(exported.note, /Not JAMS-compatible/);
  assert.doesNotMatch(exported.note, /(?<!Not )JAMS-compatible/);
  const json = JSON.stringify(exported);
  assert.doesNotMatch(json, /javascript:/i);
  assert.doesNotMatch(json, /assets\/artist-audio/);
  assert.doesNotMatch(json, /file:/i);
  assert.doesNotMatch(json, /wallet/);
  assert.doesNotMatch(json, /autonomi|arweave|nsec|private/i);
  assert.equal(exported.items[0].links.length, 1);
  assert.equal(exported.items[0].links[0].url, 'https://www.youtube.com/watch?v=pb6OqIyyLAk');
  assert.equal(exported.items[0].title, FIXTURE.title);
  assert.equal(exported.items[0].artist, FIXTURE.artist);
});

test('remove drops the saved reference; unreadable store is not overwritten by save UI', () => {
  const storage = memory();
  later.saveItem(storage, FIXTURE);
  const next = later.removeItem(storage, FIXTURE.id);
  assert.equal(next.items.length, 0);
  storage.setItem(later.STORE, '{"nope":true}');
  assert.throws(() => later.readStore(storage), { code: 'unreadable' });
  assert.match(showcase, /Saved collection could not be read\. Save was refused/);
});
