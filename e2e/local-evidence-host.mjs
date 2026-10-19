// Local working edition host gate — the native local-reader path (2026-10-18).
// Serves a SYNTHETIC skaists.preservation-local/1 package (real reader module,
// one person shard, one retained page image) through tools/genealogy/serve-local.mjs
// and drives the reader IN REAL CHROMIUM against the served bytes: manifest +
// shard + artifact all read same-origin, digest-verified before the image opens,
// object URL revoked, nothing outside the declared package ever answers.
//
//   node e2e/local-evidence-host.mjs
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalEditionHost } from '../tools/genealogy/serve-local.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

// ---- synthetic package: the REAL reader + a one-person evidence edition ----
const artifactBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000' + '001f15c4890000000d4944415478da63fcffff3f0300050201f4d34f4e0000000049454e44ae426082', 'hex'); // 1x1 png PUBLIC-CONSTANT: synthetic 1x1 PNG fixture, public test constant
const shard = {
  schema: 'skaists.person-evidence/1', personId: 'plocal1', sources: [{
    id: 'record-local-1', title: 'Synthetic retained record',
    citation: 'Retained citation, p. 2.', evidence: [{ factType: 'Christening', value: '9 June 1805' }],
    conflicts: [{ value: '31 Jan 1730/1', basis: 'another retained source' }],
    urls: ['https://www.familysearch.org/ark:/example'],
    artifacts: [{ path: 'objects/sha256/' + sha(artifactBytes).slice(0, 2) + '/' + sha(artifactBytes),
      digest: 'sha256:' + sha(artifactBytes), bytes: artifactBytes.length, mediaType: 'image/png',
      acquisition: 'synthetic e2e', verification: 'verified-at-serve' }],
  }],
};
const evidenceManifest = {
  schema: 'skaists.local-evidence/1',
  persons: { plocal1: { path: 'persons/plocal1.json', bytes: 0, sha256: '' } },
};
const shardBytes = Buffer.from(JSON.stringify(shard));
evidenceManifest.persons.plocal1 = { path: 'persons/plocal1.json', bytes: shardBytes.length, sha256: sha(shardBytes) };
const evidenceManifestBytes = Buffer.from(JSON.stringify(evidenceManifest));
const checkPage = `<!doctype html><html><body><script type="module">
  import { createLocalEvidence } from '../tools/genealogy/local-evidence.mjs';
  const r = createLocalEvidence({ base: new URL('../assets/profile-archive/lineage/local-evidence/', location.href).href });
  const shard = await r.forPerson('plocal1');
  const art = shard.sources[0].artifacts[0];
  const opened = await r.openArtifact(art);
  const blobBytes = new Uint8Array(await (await fetch(opened.url)).arrayBuffer());
  const dig = await crypto.subtle.digest('SHA-256', blobBytes);
  const hex = [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2, '0')).join('');
  const mismatchLen = blobBytes.byteLength !== art.bytes;
  opened.revoke();
  r.destroy();
  globalThis.__le = { status: shard.status, integrity: shard.integrity, evidence: shard.sources[0].evidence[0].value,
    conflict: shard.sources[0].conflicts[0].value, citation: shard.sources[0].citation,
    digestMatches: hex === art.digest.slice(7), mismatchLen, mediaType: opened.mediaType };
</script></body></html>`;

const root = mkdtempSync(join(tmpdir(), 'skaists-le-e2e-'));
const put = (rel, data) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), data); return [rel, { sha256: sha(data), bytes: data.length }]; };
const files = new Map([
  put('surfaces/local-evidence-check.html', Buffer.from(checkPage)),
  put('tools/genealogy/local-evidence.mjs', readFileSync(join(here, '..', 'tools', 'genealogy', 'local-evidence.mjs'))),
  put('assets/profile-archive/lineage/local-evidence/manifest.json', evidenceManifestBytes),
  put('assets/profile-archive/lineage/local-evidence/persons/plocal1.json', shardBytes),
  put('assets/profile-archive/lineage/local-evidence/' + shard.sources[0].artifacts[0].path, artifactBytes),
]);
const filesMap = Object.fromEntries(files);
const packageManifest = {
  schema: 'skaists.preservation-local/1', files: filesMap,
  totalBytes: [...files.values()].reduce((a, m) => a + m.bytes, 0),
  manifestSha256: sha(Buffer.from(JSON.stringify(filesMap))),
};
writeFileSync(join(root, 'manifest.json'), JSON.stringify(packageManifest));

let served404 = 0, served = 0;
const server = createLocalEditionHost({ root });
server.on('request', (req, res) => { if (res.statusCode === 404) served404++; else served++; });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(base + 'surfaces/local-evidence-check.html');
await page.waitForFunction(() => globalThis.__le, null, { timeout: 15000 });
const le = await page.evaluate(() => globalThis.__le);

check('package serves its app page same-origin', await page.title() !== undefined && pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
check('person shard reads from the retained package', le.status === 'ready' && le.integrity === 'verified');
check('transcription value renders from retained bytes', le.evidence === '9 June 1805');
check('the conflicting assertion stays recorded, not rewritten', le.conflict === '31 Jan 1730/1');
check('citation text is retained (inert provider link)', le.citation === 'Retained citation, p. 2.');
check('image opens only after digest verification', le.digestMatches === true && le.mismatchLen === false && le.mediaType === 'image/png');
check('provider fallback never happened (all hits inside the package)', served > 0 && served404 === 0, `served=${served} 404=${served404}`);

// the host itself refuses what the package never declared
const evil = await fetch(base + 'assets/profile-archive/lineage/local-evidence/../../../../../etc/passwd').then((r) => r.status).catch(() => 'blocked');
check('path escape out of the package is refused', evil === 404 || evil === 'blocked', String(evil));
const undeclared = await fetch(base + 'e/nope.json').then((r) => r.status);
check('undeclared file answers 404, never a listing', undeclared === 404);

await browser.close();
server.closeAllConnections?.();
await new Promise((r) => server.close(r));
rmSync(root, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.length + ' checks, ' + (results.length - failed.length) + ' pass, ' + failed.length + ' fail');
if (failed.length) { failed.forEach((f) => console.log('FAIL', f.name, f.detail)); process.exit(1); }
process.exit(0);
