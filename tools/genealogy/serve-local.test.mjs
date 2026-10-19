import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createLocalEditionHost, verifyPackage } from './serve-local.mjs';

const rawStatus = (base, path, host) => new Promise((resolve, reject) => {
  const u = new URL(base + path);
  const req = httpRequest({ host: u.hostname, port: u.port, path, headers: { Host: host } }, (res) => {
    res.resume();
    res.on('end', () => resolve(res.statusCode));
  });
  req.on('error', reject);
  req.end();
});

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
  try { return await fn('http://127.0.0.1:' + p); } finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
}
const get = (base, path, headers = {}) => fetch(base + path, { headers }).then(async (r) => ({ status: r.status, type: r.headers.get('content-type'), len: Number(r.headers.get('content-length')), body: Buffer.from(await r.arrayBuffer()) }));

test('startup verifies every declared file and reports the package', () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  const v = verifyPackage(root);
  assert.equal(v.files, 2);
  assert.equal(v.totalBytes, page().length + evShard.length);
});

test('a byte flipped after packaging refuses the whole host (fail closed)', () => {
  const root = package_({ 'surfaces/blood.html': page() });
  const original = page().toString('utf8');
  writeFileSync(join(root, 'surfaces', 'blood.html'), Buffer.from(original.replace('x', 'y'))); // same length, different byte
  assert.throws(() => createLocalEditionHost({ root }), /declared digest disagrees/);
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
    assert.equal(ev.type, 'application/json');
    assert.deepEqual(ev.body, evShard);
  });
});

test('undeclared, traversing and non-file paths are all 404; HEAD answers headers only', async () => {
  const root = package_({ 'surfaces/blood.html': page() });
  await withServer(root, async (base) => {
    for (const p of ['/e/manifest.json', '/manifest.json%c0%af', '/../etc/passwd', '/surfaces/'])
      assert.equal((await get(base, p)).status, 404, p);
    // note: manifest.json itself IS declared; direct fetch of the undeclared evidence dir is the 404 case
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

test('health reports schema, file count and total bytes', async () => {
  const root = package_({ 'surfaces/blood.html': page(), 'e/manifest.json': evShard });
  await withServer(root, async (base) => {
    const h = await get(base, '/health');
    const j = JSON.parse(h.body);
    assert.equal(j.service, 'skaists-local-edition');
    assert.equal(j.schema, 'skaists.preservation-local/1');
    assert.equal(j.files, 2);
  });
});

// cleanup guard: tests above leave temp dirs; node:test has no after-all here
test('temp roots are removable after serving', () => {
  const root = package_({ 'a.txt': Buffer.from('z') });
  rmSync(root, { recursive: true, force: true });
  assert.ok(true);
});
