// Local working edition host gates (2026-10-19, repaired per PR #471 review).
//
// Part A — transport/API: the host serves a synthetic package; the reader's
//   object API reads shard + artifact and verifies digests.
// Part B — the VISIBLE reader journey: the person-panel's own evidence organ
//   (mountLocalEvidence, exactly as person-panel.mjs mounts it) in a visible
//   host, driven by ORDINARY actionable clicks — summary open, async toggle
//   fill, Verify button, visible transcription/conflict/receipt text, and an
//   image the browser actually DECODES. A corrupted artifact is the negative
//   control (the digest gate must show Page unavailable).
// Part C — network: a browser-context route guard installed BEFORE navigation
//   records+aborts every non-package-origin attempt; a deliberate probe proves
//   the guard detects outside attempts (the gate is demonstrably red for one).
//
//   node e2e/local-evidence-host.mjs
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalEditionHost } from '../tools/genealogy/serve-local.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

// ---- a VALID 1x1 RGBA PNG, built with real zlib + CRC-32 (decodable) ----
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (buf) => { let c = ~0; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const validPng = (r, g, b, a) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.from([0, r, g, b, a]); // one scanline, filter 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
};
const goodPng = validPng(0x3a, 0x5f, 0x9d, 0xff);
const corruptedPng = Buffer.from(goodPng); corruptedPng[40] ^= 0xff; // stored bytes ≠ declared digest

// ---- synthetic package: real reader + panel organ + two-source edition ----
const shard = {
  schema: 'skaists.person-evidence/1', personId: 'plocal1', sources: [
    {
      id: 'record-local-1', title: 'Synthetic retained record (valid page)',
      citation: 'Retained citation, p. 2.', evidence: [{ factType: 'Christening', value: '9 June 1805' }],
      conflicts: [{ value: '31 Jan 1730/1', basis: 'another retained source' }],
      urls: ['https://www.familysearch.org/ark:/example'],
      artifacts: [{ path: 'objects/sha256/' + sha(goodPng).slice(0, 2) + '/' + sha(goodPng), digest: 'sha256:' + sha(goodPng), bytes: goodPng.length, mediaType: 'image/png', acquisition: 'synthetic e2e', verification: 'verified-at-serve' }],
    },
    {
      id: 'record-local-2', title: 'Synthetic retained record (corrupted page)',
      citation: 'Second retained citation.', evidence: [],
      artifacts: [{ path: 'objects/sha256/' + sha(corruptedPng).slice(0, 2) + '/' + sha(corruptedPng), digest: 'sha256:' + sha(goodPng), bytes: corruptedPng.length, mediaType: 'image/png', acquisition: 'synthetic e2e', verification: 'declared-digest-mismatches-stored-bytes' }],
    },
  ],
};
const evidenceManifest = {
  schema: 'skaists.local-evidence/1',
  persons: { plocal1: { path: 'persons/plocal1.json', bytes: 0, sha256: '' } },
};
const shardBytes = Buffer.from(JSON.stringify(shard));
evidenceManifest.persons.plocal1 = { path: 'persons/plocal1.json', bytes: shardBytes.length, sha256: sha(shardBytes) };
const evidenceManifestBytes = Buffer.from(JSON.stringify(evidenceManifest));
const journeyPage = `<!doctype html><html><body>
<main style="max-width:40rem;margin:2rem">
  <section id="ev" class="pp-sec" data-pp-local-evidence></section>
</main>
<script type="module">
  // the person-panel's own composition (person-panel.mjs mounts exactly this):
  // createLocalEvidence from the stamped base + mountLocalEvidence into the slot
  import { createLocalEvidence, mountLocalEvidence } from '../tools/genealogy/local-evidence.mjs';
  const reader = createLocalEvidence({ base: new URL('../assets/profile-archive/lineage/local-evidence/', location.href).href });
  window.__dispose = mountLocalEvidence(document.getElementById('ev'), reader, 'plocal1');
</script></body></html>`;

const root = mkdtempSync(join(tmpdir(), 'skaists-le-e2e-'));
const put = (rel, data) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), data); return [rel, { sha256: sha(data), bytes: data.length }]; };
const files = new Map([
  put('surfaces/local-evidence-check.html', Buffer.from(journeyPage)),
  put('tools/genealogy/local-evidence.mjs', readFileSync(join(here, '..', 'tools', 'genealogy', 'local-evidence.mjs'))),
  put('assets/profile-archive/lineage/local-evidence/manifest.json', evidenceManifestBytes),
  put('assets/profile-archive/lineage/local-evidence/persons/plocal1.json', shardBytes),
  put('assets/profile-archive/lineage/local-evidence/' + shard.sources[0].artifacts[0].path, goodPng),
  put('assets/profile-archive/lineage/local-evidence/' + shard.sources[1].artifacts[0].path, corruptedPng),
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

// ---------- Part C guard, installed BEFORE navigation ----------
const context = await browser.newContext();
const outside = [];
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (u.origin === new URL(base).origin) return route.continue();
  outside.push(route.request().url());
  return route.abort('blockedbyclient');
});

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => {
  const u = new URL(r.url());
  if (u.origin !== new URL(base).origin && !outside.includes(r.url())) outside.push(r.url() + ' (failed)');
});

// ---------- Part B: the visible reader journey, ordinary clicks ----------
await page.goto(base + 'surfaces/local-evidence-check.html');
const section = page.locator('#ev');
await section.waitFor({ state: 'visible', timeout: 15000 });
check('the evidence organ mounts visibly in the page composition', await section.isVisible());

const stateLine = section.locator('p', { hasText: 'source entries stored locally' });
await stateLine.waitFor({ state: 'visible', timeout: 15000 });
check('state line is visible: 2 source entries stored locally', /2 source entries/.test(await stateLine.textContent()));

const goodRow = section.locator('details', { has: page.locator('summary', { hasText: 'valid page' }) });
await goodRow.locator('summary').click(); // ordinary actionable click
// transcription facts sit in a nested closed <details>; a user opens that too
await goodRow.locator('summary', { hasText: 'Recorded text and transcription' }).click();
const transcription = goodRow.locator('dd', { hasText: '9 June 1805' });
await transcription.waitFor({ state: 'visible', timeout: 15000 });
check('transcription text is VISIBLE after the toggle fill', await transcription.isVisible());
check('the conflicting assertion stays visible and recorded',
  await goodRow.locator('p', { hasText: 'Recorded conflict: 31 Jan 1730/1' }).isVisible());
const citation = await goodRow.locator('p', { hasText: 'Retained citation, p. 2.' }).isVisible();
check('citation text is visible and inert', citation);

const verifyGood = goodRow.getByRole('button', { name: 'Verify and open saved page' });
await verifyGood.waitFor({ state: 'visible', timeout: 15000 });
await verifyGood.click(); // ordinary actionable click
const receipt = goodRow.locator('p', { hasText: 'Saved bytes match the receipt' });
await receipt.waitFor({ state: 'visible', timeout: 15000 });
check('receipt line is VISIBLE after ordinary click', await receipt.isVisible());

const decoded = await page.waitForFunction(async () => {
  const img = document.querySelector('#ev img');
  if (!img) return false;
  try { await img.decode(); } catch { return false; }
  return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}, null, { timeout: 15000 }).then(() => true).catch(() => false);
check('the browser DECODES the retained page image (img.decode + natural pixels)', decoded);

// negative control: corrupted artifact must fail the digest gate, visibly
const badRow = section.locator('details', { has: page.locator('summary', { hasText: 'corrupted page' }) });
await badRow.locator('summary').click();
const verifyBad = badRow.getByRole('button', { name: 'Verify and open saved page' });
await verifyBad.waitFor({ state: 'visible', timeout: 15000 });
await verifyBad.click();
const unavailable = badRow.locator('p', { hasText: 'Page unavailable' });
await unavailable.waitFor({ state: 'visible', timeout: 15000 });
check('a corrupted artifact shows Page unavailable (digest gate refuses it)', await unavailable.isVisible());
check('no image renders for the corrupted artifact', (await badRow.locator('img').count()) === 0);

// ---------- Part A: transport/API on the same served package ----------
const api = await page.evaluate(async () => {
  const r = await fetch('../assets/profile-archive/lineage/local-evidence/manifest.json');
  return { status: r.status, bytes: Number(r.headers.get('content-length')) };
});
check('transport serves the package manifest same-origin', api.status === 200 && api.bytes === evidenceManifestBytes.length);

// ---------- Part C assertions ----------
check('ZERO outside-origin attempts during the whole journey', outside.length === 0, outside.slice(0, 3).join(' | '));
check('server answered only declared package files', served > 0 && served404 === 0, `served=${served} 404=${served404}`);

// the guard's own redness probe: a deliberate outside attempt (closed loopback
// port — no external service contacted) must be recorded and blocked
const probeBlocked = await page.evaluate(async () => {
  try { await fetch('http://127.0.0.1:9/probe'); return 'unexpectedly-served'; }
  catch (e) { return e.name === 'TypeError' || /Failed to fetch/i.test(String(e)) ? 'blocked' : 'other:' + e.name; }
});
check('negative control: an outside-origin attempt is BLOCKED and detected', probeBlocked === 'blocked' && outside.length === 1, `probe=${probeBlocked} outside=${outside.length}`);

check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await context.close();
await browser.close();
server.closeAllConnections?.();
await new Promise((r) => server.close(r));
rmSync(root, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.length + ' checks, ' + (results.length - failed.length) + ' pass, ' + failed.length + ' fail');
if (failed.length) { failed.forEach((f) => console.log('FAIL', f.name, f.detail)); process.exit(1); }
process.exit(0);
