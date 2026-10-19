import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createLocalEditionHost, verifyPackage } from './serve-local.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
function package_(files, { tweak } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'skaists-serve-local-'));
  const map = {};
  for (const [rel, data] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), data);
    map[rel] = { sha256: sha(data), bytes: data.length };
  }
  const manifest = {
    schema: 'skaists.preservation-local/1',
    files: map,
    totalBytes: Object.values(map).reduce((a, m) => a + m.bytes, 0),
    manifestSha256: sha(Buffer.from(JSON.stringify(map))),
  };
  if (tweak) tweak(manifest, root);
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  return root;
}
const page = (body = '<html data-local-evidence="../e/"><body>' + 'x'.repeat(64) + '</body></html>') => Buffer.from(body);
const evShard = Buffer.from(JSON.stringify({ schema: 'skaists.person-evidence/1', personId: 'p1', sources: [] }));

async function withServer(root, fn, port = 0) {
  const server = createLocalEditionHost({ root });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const { port: p } = server.address();
  try { return await fn('http://127.0.0.1:' + p, server); } finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
}
const get = (base, path, headers = {}) => fetch(base + path, { headers }).then(async (r) => ({ status: r.status, type: r.headers.get('content-type'), len: Number(r.headers.get('content-length')), body: Buffer.from(await r.arrayBuffer()) }));
const rawStatus = (base, path, host) => new Promise((resolve, reject) => {
  const u = new URL(base + path);
  const req = httpRequest({ host: u.hostname, port: u.port, path, headers: { Host: host } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end();
});
const canSymlink = (() => { try { const d = mkdtempSync(join(tmpdir(), 'sym-probe-')); symlinkSync(join(d, 'a'), join(d, 'b')); rmSync(d, { recursive: true, force: true }); return true; } catch { return false; } })();

test('startup verifies every declared file into an immutable snapshot and reports the package', () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  const v = verifyPackage(root);
  assert.equal(v.files, 2);
  assert.equal(v.totalBytes, page().length + evShard.length);
  assert.ok(v.snapshotDir && existsSync(v.snapshotDir), 'snapshot exists');
});

test('a byte flipped before startup refuses the whole host (fail closed)', () => {
  const root = package_({ 'surfaces/blood.html': page() });
  const original = page().toString('utf8');
  writeFileSync(join(root, 'surfaces', 'blood.html'), Buffer.from(original.replace('x', 'y'))); // same length, different byte
  assert.throws(() => createLocalEditionHost({ root }), /declared digest disagrees/);
});

test('REVIEW ROW 1 — same-length change AFTER startup still serves the VERIFIED bytes', async () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  await withServer(root, async (base) => {
    const before = await get(base, '/e/manifest.json');
    // same-length in-place modification of the package member after startup
    writeFileSync(join(root, 'e', 'manifest.json'), Buffer.from(evShard.toString('utf8').replace('p1', 'q1')));
    const after = await get(base, '/e/manifest.json');
    assert.equal(after.status, 200);
    assert.deepEqual(after.body, before.body, 'served bytes must equal the verified snapshot, not the modified file');
    assert.equal(sha(after.body), sha(before.body));
  });
});

test('REVIEW ROW 2 — package member replaced by a symlink AFTER startup still serves the verified bytes', { skip: !canSymlink && 'symlinks unavailable on this platform' }, async () => {
  const outside = mkdtempSync(join(tmpdir(), 'skaists-outside-'));
  writeFileSync(join(outside, 'sentinel'), 'OUTSIDE!');
  const root = package_({ 'e/x': Buffer.from('INSIDE!!') });
  await withServer(root, async (base) => {
    unlinkSync(join(root, 'e', 'x'));
    symlinkSync(join(outside, 'sentinel'), join(root, 'e', 'x'));
    const r = await get(base, '/e/x');
    assert.equal(r.status, 200);
    assert.equal(r.body.toString('utf8'), 'INSIDE!!', 'outside bytes must never be served');
  });
});

test('REVIEW ROW 3 — an outside-pointing symlink present BEFORE startup is refused', { skip: !canSymlink && 'symlinks unavailable on this platform' }, () => {
  const outside = mkdtempSync(join(tmpdir(), 'skaists-outside-'));
  const data = Buffer.from('OUTSIDE!');
  writeFileSync(join(outside, 'real'), data);
  const root = mkdtempSync(join(tmpdir(), 'skaists-serve-local-'));
  mkdirSync(join(root, 'e'), { recursive: true });
  symlinkSync(join(outside, 'real'), join(root, 'e', 'x'));
  const map = { 'e/x': { sha256: sha(data), bytes: data.length } };
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({
    schema: 'skaists.preservation-local/1', files: map, totalBytes: data.length,
    manifestSha256: sha(Buffer.from(JSON.stringify(map))),
  }));
  assert.throws(() => createLocalEditionHost({ root }), /not a regular file|changed shape/);
});

test('REVIEW ROW 4 — deleting a declared file AFTER startup keeps serving verified bytes; the host stays up', async () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  await withServer(root, async (base) => {
    rmSync(join(root, 'e'), { recursive: true, force: true });
    const r = await get(base, '/e/manifest.json');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, evShard, 'snapshot serves the verified bytes after package deletion');
    const h = await get(base, '/health');
    assert.equal(h.status, 200, 'host did not crash');
  });
});

test('a foreign schema refuses; a bad manifestSha256 refuses', () => {
  const root = package_({ 'a.txt': Buffer.from('a') }, { tweak: (m) => { m.schema = 'skaists.preservation/1'; } });
  assert.throws(() => createLocalEditionHost({ root }), /local working editions only/);
  const root2 = package_({ 'a.txt': Buffer.from('a') }, { tweak: (m) => { m.manifestSha256 = '0'.repeat(64); } });
  assert.throws(() => createLocalEditionHost({ root: root2 }), /manifestSha256 disagrees/);
});

test('serves declared files with exact bytes, type and length; root is the app page', async () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  await withServer(root, async (base) => {
    const idx = await get(base, '/');
    assert.equal(idx.status, 200);
    assert.equal(idx.type, 'text/html; charset=utf-8');
    assert.deepEqual(idx.body, page());
    const ev = await get(base, '/e/manifest.json');
    assert.equal(ev.status, 200);
    assert.deepEqual(ev.body, evShard);
  });
});

test('undeclared, traversing and non-file paths are all 404; HEAD answers headers only; writes refused', async () => {
  const root = package_({ 'surfaces/blood.html': page() });
  await withServer(root, async (base) => {
    for (const p of ['/e/manifest.json', '/manifest.json%c0%af', '/../etc/passwd', '/surfaces/'])
      assert.equal((await get(base, p)).status, 404, p);
    const head = await fetch(base + '/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(Number(head.headers.get('content-length')), page().length);
    const put = await fetch(base + '/', { method: 'PUT' });
    assert.equal(put.status, 405);
  });
});

test('a non-loopback Host header is refused (no DNS rebinding to the shelf)', async () => {
  const root = package_({ 'surfaces/blood.html': page() });
  await withServer(root, async (base) => {
    assert.equal(await rawStatus(base, '/', 'evil.example'), 403);
    assert.equal(await rawStatus(base, '/', '127.0.0.1'), 200);
    assert.equal((await get(base, '/health')).status, 200);
  });
});

test('health reports schema, file count and total bytes; snapshot is removed on close', async () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  let snapDir = null;
  await withServer(root, async (base, server) => {
    snapDir = server.snapshotDir;
    const h = await get(base, '/health');
    const j = JSON.parse(h.body);
    assert.equal(j.service, 'skaists-local-edition');
    assert.equal(j.schema, 'skaists.preservation-local/1');
    assert.equal(j.files, 2);
    assert.ok(existsSync(snapDir));
  });
  assert.ok(!existsSync(snapDir), 'snapshot cleaned up after close');
});
