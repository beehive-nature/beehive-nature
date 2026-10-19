import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createLocalEvidence, localEvidencePath } from './local-evidence.mjs';

const base = 'http://127.0.0.1:8765/local-evidence/';
const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const desc = (path, bytes) => ({ path, bytes: bytes.byteLength, sha256: hash(bytes) });
function fixture({ shardChange = x => x, entries = {}, fetchChange } = {}) {
  const page = encode('synthetic retained source page');
  const artifact = { path: 'objects/sha256/' + hash(page).slice(0, 2) + '/' + hash(page), digest: 'sha256:' + hash(page), bytes: page.length, mediaType: 'text/plain', acquisition: 'downloaded', verification: 'unverified' };
  const shard = shardChange({ schema: 'skaists.person-evidence/1', personId: 'pfixture', sources: [{ id: 'record-one', title: 'Synthetic record', citation: 'Saved citation, p. 2.', evidence: [{ factType: 'Death', value: '3 October' }], conflicts: [{ value: '11 October', basis: 'another source' }], urls: ['https://www.familysearch.org/ark:/example'], artifacts: [artifact] }] });
  const shardBytes = encode(shard);
  const manifest = { schema: 'skaists.local-evidence/1', persons: { pfixture: desc('persons/pfixture.json', shardBytes), ...entries } };
  const files = new Map([['manifest.json', encode(manifest)], ['persons/pfixture.json', shardBytes], [artifact.path, page]]);
  const calls = [], revoked = [];
  const fetcher = async (url, opts) => {
    calls.push(url); assert.equal(opts.redirect, 'error');
    assert.ok(url.startsWith(base), 'a provider URL was fetched');
    if (fetchChange) return fetchChange(url, opts, files);
    const bytes = files.get(url.slice(base.length));
    return new Response(bytes || '', { status: bytes ? 200 : 404 });
  };
  const reader = createLocalEvidence({ base, fetcher, crypto: webcrypto, location: { href: base, origin: new URL(base).origin },
    urlAPI: { createObjectURL: () => 'blob:fixture', revokeObjectURL: url => revoked.push(url) } });
  return { reader, files, manifest, shard, artifact, calls, revoked, fetcher };
}

test('one bounded person shard preserves assertions and conflicts; provider links are never fetched', async () => {
  const f = fixture();
  const result = await f.reader.forPerson('pfixture');
  assert.equal(result.integrity, 'verified');
  assert.deepEqual(result.sources[0].evidence, f.shard.sources[0].evidence);
  assert.deepEqual(result.sources[0].conflicts, f.shard.sources[0].conflicts);
  assert.equal(result.sources[0].artifacts[0].verification, 'unverified', 'shard verification must not promote page verification');
  assert.equal(await f.reader.forPerson('pfixture'), result);
  assert.deepEqual(f.calls, [base + 'manifest.json', base + 'persons/pfixture.json']);
  assert.equal((await f.reader.forPerson('unlisted')).status, 'not-held');
  assert.equal(f.calls.length, 2);
});

test('page opening verifies actual bytes, creates a local URL, and releases it', async () => {
  const f = fixture();
  const result = await f.reader.openArtifact(f.artifact);
  assert.equal(result.integrity, 'verified'); assert.equal(result.url, 'blob:fixture');
  assert.deepEqual(f.calls, [base + f.artifact.path]);
  result.revoke(); result.revoke(); assert.deepEqual(f.revoked, ['blob:fixture']);
  f.reader.destroy(); await assert.rejects(f.reader.forPerson('pfixture'), { code: 'CLOSED' });
});

test('missing and corrupt bytes stay distinct from downloaded or declared verified', async () => {
  const f = fixture();
  f.files.delete(f.artifact.path);
  await assert.rejects(f.reader.openArtifact(f.artifact), { code: 'MISSING' });
  f.files.set(f.artifact.path, encode('different page, same promise'));
  await assert.rejects(f.reader.openArtifact({ ...f.artifact, verification: 'verified' }), { code: 'INTEGRITY' });
  assert.equal(f.revoked.length, 0);
});

test('a changed shard cannot display another person or silently alter the citation', async () => {
  const f = fixture();
  f.files.set('persons/pfixture.json', encode({ ...f.shard, personId: 'other' }));
  await assert.rejects(f.reader.forPerson('pfixture'), { code: 'INTEGRITY' });
  const g = fixture({ shardChange: x => ({ ...x, personId: 'other' }) });
  await assert.rejects(g.reader.forPerson('pfixture'), { code: 'SHAPE' });
});

test('paths and origins cannot redirect an evidence read to a provider or outside the package', async () => {
  for (const path of ['../secret', '/absolute', '//familysearch.org/x', 'https://familysearch.org/x', 'x/../secret', 'x/%2e%2e/secret', 'x\\secret', 'x?remote=1'])
    assert.throws(() => localEvidencePath(path), { code: 'PATH' });
  assert.throws(() => createLocalEvidence({ base: 'https://familysearch.org/evidence/', crypto: webcrypto }), { code: 'PATH' });
  assert.throws(() => createLocalEvidence({ base: 'https://another.invalid/', location: { origin: new URL(base).origin, href: base }, crypto: webcrypto }), { code: 'PATH' });
  const f = fixture({ fetchChange: () => ({ ok: true, status: 200, redirected: true }) });
  await assert.rejects(f.reader.forPerson('pfixture'), { code: 'READ' });
});

test('oversized shards, timeouts and active media types fail before any external fallback', async () => {
  const f = fixture();
  await assert.rejects(f.reader.openArtifact({ ...f.artifact, mediaType: 'text/html' }), { code: 'MEDIA' });
  assert.equal(f.calls.length, 0);
  const g = createLocalEvidence({ base, crypto: webcrypto, maxManifestBytes: 8, fetcher: async () => new Response('more than eight bytes') });
  await assert.rejects(g.forPerson('pfixture'), { code: 'LIMIT' });
  const h = createLocalEvidence({ base, crypto: webcrypto, timeoutMs: 10, fetcher: () => new Promise(() => {}) });
  await assert.rejects(h.forPerson('pfixture'), { code: 'TIMEOUT' });
});
