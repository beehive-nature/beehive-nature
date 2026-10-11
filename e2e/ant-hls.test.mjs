import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, MAGIC, HEADER_BYTES, createAntSession, digest, validateManifest } from '../tools/autonomous-delivery/ant-hls.mjs';
const address = 'ab'.repeat(32);
async function fixture(options = {}) {
  const media = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8])];
  const playlists = [ ['master.m3u8', '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800\nv/index.m3u8\n'],
    ['v/index.m3u8', '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\na.m4s\n#EXTINF:4,\nb.m4s\n#EXT-X-ENDLIST\n'] ];
  const files = await Promise.all(playlists.map(async ([path, text]) => ({ path, text, bytes: new TextEncoder().encode(text).length, sha256: await digest(new TextEncoder().encode(text)) })));
  for (const [i, bytes] of media.entries()) files.push({ path: 'v/' + ['a', 'b'][i] + '.m4s', bytes: bytes.length, sha256: await digest(bytes), offset: i * 4 });
  const manifest = { schema: SCHEMA, sourceAddress: address, bundleId: address, files };
  const json = new TextEncoder().encode(JSON.stringify(manifest)), start = HEADER_BYTES + json.length;
  const pack = new Uint8Array(start + 8); pack.set(MAGIC); new DataView(pack.buffer).setUint32(12, json.length, true); pack.set(json, HEADER_BYTES); pack.set(media[0], start); pack.set(media[1], start + 4);
  let opens = 0, closes = 0, active = 0, peak = 0; const ranges = [];
  const client = { async openFile() { opens++; return { size: pack.length, close() { closes++; }, async read(at, length, { signal }) {
    ranges.push([at, length]); active++; peak = Math.max(peak, active);
    try {
      if (options.delay && at >= start) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, options.delay);
        const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
        signal.addEventListener('abort', abort, { once: true });
      });
      const bytes = pack.slice(at, at + length); if (options.corrupt && at >= start) bytes[0] ^= 1;
      return bytes;
    } finally { active--; }
  } }; } };
  return { pack, manifest, client, start, ranges, counts: () => ({ opens, closes, peak }) };
}
test('one open, range reads, hash verification, cache copies and eviction', async () => {
  const f = await fixture(), s = await createAntSession({ address, client: f.client, limits: { cacheBytes: 4 } });
  const url = new URL('v/a.m4s', s.url).href;
  const bytes = await s.load(url); bytes[0] = 255;
  assert.deepEqual(await s.load(url), new Uint8Array([1, 2, 3, 4]));
  await s.load(new URL('v/b.m4s', s.url).href); await s.load(url);
  assert.equal(f.counts().opens, 1); assert.equal(s.stats.cacheHits, 1); assert.equal(s.stats.cacheBytes, 4);
  assert.equal(s.stats.verifiedBytes, 12); assert.equal(s.stats.readBytes, f.start + 12);
  await assert.rejects(s.load('https://other.invalid/v/a.m4s'), /Cross-publication/);
  await assert.rejects(s.load(new URL('../v/a.m4s', s.url).href), /Cross-publication/);
  s.close(); await assert.rejects(s.load(url), { name: 'AbortError' });
});
test('tampering closes the session and never caches or verifies corrupt bytes', async () => {
  const f = await fixture({ corrupt: true }), s = await createAntSession({ address, client: f.client });
  await assert.rejects(s.load(new URL('v/a.m4s', s.url).href), /integrity/);
  assert.equal(s.stats.verifiedBytes, 0); assert.equal(s.stats.cacheBytes, 0); assert.equal(s.stats.readBytes, f.start + 4);
  await assert.rejects(s.load(new URL('v/b.m4s', s.url).href), { name: 'AbortError' });
  s.close();
});
test('concurrent reads reserve before admission; byte cap prevents another read', async () => {
  const f = await fixture({ delay: 30 });
  const s = await createAntSession({ address, client: f.client, limits: { concurrency: 1, sessionBytes: f.start + 4 } });
  const result = await Promise.allSettled(['a', 'b'].map(p => s.load(new URL('v/' + p + '.m4s', s.url).href)));
  assert.equal(result[0].status, 'fulfilled'); assert.equal(result[1].status, 'rejected');
  assert.match(result[1].reason.message, /budget/); assert.equal(f.counts().peak, 1);
  assert.equal(s.stats.reservedBytes, f.start + 4); assert.equal(f.ranges.length, 3); s.close();
});
test('active caller cancellation retains its slot until completion, queued cancellation never reads', async () => {
  const f = await fixture({ delay: 40 }), s = await createAntSession({ address, client: f.client, limits: { concurrency: 1 } });
  const first = new AbortController(), second = new AbortController();
  const a = s.load(new URL('v/a.m4s', s.url).href, first.signal);
  await new Promise(r => setTimeout(r, 5)); first.abort();
  const b = s.load(new URL('v/b.m4s', s.url).href, second.signal);
  second.abort(); await assert.rejects(b, { name: 'AbortError' }); await a;
  assert.equal(s.stats.cacheBytes, 0); assert.equal(f.ranges.length, 3);
  await s.load(new URL('v/b.m4s', s.url).href); assert.equal(f.counts().peak, 1); s.close();
});
test('SDK read deadline closes uncertain work without refund or automatic retry', async () => {
  const f = await fixture({ delay: 200 }), s = await createAntSession({ address, client: f.client, limits: { timeoutMs: 20 } });
  await assert.rejects(s.load(new URL('v/a.m4s', s.url).href), { name: 'AbortError' });
  assert.equal(s.stats.reservedBytes, f.start + 4); assert.equal(s.stats.readBytes, f.start);
  await assert.rejects(s.load(new URL('v/b.m4s', s.url).href), { name: 'AbortError' });
  assert.equal(f.ranges.length, 3); s.close();
});
test('reject remote URLs, unsupported tags, live lists, overlaps and oversized headers before media reads', async () => {
  const f = await fixture();
  for (const mutate of [
    m => { m.files[0].text += '#EXT-X-KEY:METHOD=AES-128,URI="https://elsewhere.invalid/key"\n'; },
    m => { m.files[0].text += 'https://elsewhere.invalid/media\n'; },
    m => { m.files[1].text = m.files[1].text.replace('#EXT-X-ENDLIST', '#UNKNOWN'); }
  ]) {
    const m = structuredClone(f.manifest); mutate(m);
    for (const x of m.files) if (x.text) x.bytes = new TextEncoder().encode(x.text).length;
    assert.throws(() => validateManifest(m, 8));
  }
  const overlap = structuredClone(f.manifest); overlap.files[3].offset = 0;
  assert.throws(() => validateManifest(overlap, 8), /range/);
  new DataView(f.pack.buffer).setUint32(12, 0xffffffff, true);
  await assert.rejects(createAntSession({ address, client: f.client }), /manifest size/);
  assert.equal(f.ranges.length, 1); assert.ok(f.counts().closes > 0);
});
