import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../fixtures/bview/adaptive/', import.meta.url);
test('packaged fixture has complete aligned variants, accurate peak rates and intact media', async () => {
  const report = JSON.parse(await readFile(new URL('package.json', root)));
  const master = await readFile(new URL('master.m3u8', root), 'utf8');
  assert.equal(report.variants.length, 2);
  let reference;
  for (const v of report.variants) {
    const playlist = await readFile(new URL(v.path, root), 'utf8');
    assert.match(playlist, /#EXT-X-ENDLIST/); assert.match(playlist, /#EXT-X-INDEPENDENT-SEGMENTS/);
    const segments = [...playlist.matchAll(/#EXTINF:([\d.]+),[^\n]*\n([^\r\n]+)/g)];
    const durations = segments.map(x => Number(x[1]));
    if (reference) assert.deepEqual(durations, reference); else reference = durations;
    assert.equal(durations.reduce((a, b) => a + b), 48);
    assert.ok(durations.every(n => n <= 4.05));
    for (const [, t, path] of segments) {
      const data = await readFile(new URL(path, new URL(v.path, root)));
      assert.ok(data.length * 8 / Number(t) <= v.bandwidth);
    }
    assert.ok(master.includes(`BANDWIDTH=${v.bandwidth},AVERAGE-BANDWIDTH=${v.averageBandwidth}`));
  }
  for (const f of report.files) {
    const data = await readFile(new URL(f.path, root));
    assert.equal(data.length, f.bytes); assert.equal(createHash('sha256').update(data).digest('hex'), f.sha256);
  }
});
