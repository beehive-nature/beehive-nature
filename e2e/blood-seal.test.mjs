// The blood seal reader (surfaces/blood-seal.html + blood-seal.js) — hermetic
// browser gates for the dApp verification and retrieval layer (founder order
// 2026-10-19). One law under test: AN UNVERIFIED BYTE NEVER RENDERS.
//
//   node --test e2e/blood-seal.test.mjs
//
// A fixture corpus (two persons, real sha256 digests, the seal's own schemas)
// is served from a throwaway docroot beside real copies of the surface, its
// JS, register.js and skaists.css. Gates, run in order inside ONE journey:
//   A  rails labeled honestly — three declared-unqualified rails visible
//   B  correct out-of-band pin — VERIFIED, card, page rendered (srcdoc set
//      ONLY after its digest verified)
//   C  tampered page bytes — FAILED CLOSED (page-drift), nothing rendered
//   D  wrong root pin — FAILED CLOSED (pin-mismatch), nothing rendered
//   E  no pin — CONSISTENCY ONLY, visibly untrusted, never "verified"
//   F  unknown person — FAILED CLOSED
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');

// ---- a real fixture corpus in the seal's own schemas -----------------------
const docroot = mkdtempSync(join(tmpdir(), 'blood-seal-e2e-'));
const persons = {
  p1: { name: 'Ann Fixture', lifespan: '1801-1877', era: 'colonial', html: '<html><body><main id="mk">PAGE-ONE-MARKER Ann Fixture research page</main></body></html>' },
  p2: { name: 'Bob Fixture', lifespan: '1830-1901', era: 'recorded', html: '<html><body><main id="mk">PAGE-TWO-MARKER Bob Fixture research page</main></body></html>' },
};
const lineageDir = join(docroot, 'assets', 'profile-archive', 'lineage');
mkdirSync(join(lineageDir, 'persons'), { recursive: true });
const pageEntries = {};
const indexPersons = {};
for (const [id, p] of Object.entries(persons)) {
  const htmlBytes = Buffer.from(p.html, 'utf8');
  const jsonBytes = Buffer.from(JSON.stringify({ id }) + '\n', 'utf8');
  writeFileSync(join(lineageDir, 'persons', `${id}.html`), htmlBytes);
  writeFileSync(join(lineageDir, 'persons', `${id}.json`), jsonBytes);
  pageEntries[id] = { id, html: { sha256: sha(htmlBytes), bytes: htmlBytes.length }, json: { sha256: sha(jsonBytes), bytes: jsonBytes.length } };
  indexPersons[id] = {
    name: p.name, lifespan: p.lifespan, era: p.era, publication: 'public',
    fsRefs: [`FS-${id}`], recordArks: [`ARK-${id}`],
    parents: [], spouses: [], children: [],
    pageHtml: `persons/${id}.html`, pageJson: `persons/${id}.json`,
    pageHtmlSha256: sha(htmlBytes), pageJsonSha256: sha(jsonBytes),
  };
}
const stateObj = {
  schema: 'skaists.genealogy-publication-state/1',
  tool: { name: 'fixture', version: '0' },
  hexLawNote: 'PUBLIC-CONSTANT fixture digests',
  corpus: {}, census: { persons: 2, htmlPages: 2, jsonPages: 2, strays: 0 },
  pages: Object.values(pageEntries),
};
const stateBytes = Buffer.from(JSON.stringify(stateObj) + '\n', 'utf8');
writeFileSync(join(lineageDir, 'publication-state.json'), stateBytes);
writeFileSync(join(lineageDir, 'publication-index.json'), Buffer.from(JSON.stringify({
  schema: 'skaists.genealogy-publication-index/1',
  tool: { name: 'fixture', version: '0' },
  hexLawNote: 'PUBLIC-CONSTANT fixture digests',
  stateSha256: sha(stateBytes), rootPerson: 'p1',
  counts: { persons: 2, fsRefsTotal: 2, recordArksTotal: 2 },
  persons: indexPersons,
}) + '\n', 'utf8'));
const realPin = sha(stateBytes);

// the real surface files, served from the throwaway root so the bootstrap
// rail's relative corpus path resolves inside the fixture
mkdirSync(join(docroot, 'surfaces'), { recursive: true });
for (const f of ['blood-seal.html', 'blood-seal.js', 'register.js', 'skaists.css']) {
  cpSync(join(root, 'surfaces', f), join(docroot, 'surfaces', f));
}

const files = {
  'surfaces/blood-seal.html': 'text/html',
  'surfaces/blood-seal.js': 'text/javascript',
  'surfaces/register.js': 'text/javascript',
  'surfaces/skaists.css': 'text/css',
  'assets/profile-archive/lineage/publication-state.json': 'application/json',
  'assets/profile-archive/lineage/publication-index.json': 'application/json',
};
for (const id of Object.keys(persons)) {
  files[`assets/profile-archive/lineage/persons/${id}.html`] = 'text/html';
  files[`assets/profile-archive/lineage/persons/${id}.json`] = 'application/json';
}
const serve = (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  if (files[rel]) {
    res.writeHead(200, { 'content-type': files[rel] });
    res.end(readFileSync(join(docroot, rel)));
  } else {
    res.writeHead(404);
    res.end('no');
  }
};

test('the blood seal reader: verified reads, fail-closed everything else', async () => {
  const server = createServer(serve).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/surfaces/blood-seal.html`);
    const status = page.locator('#sealStatus');
    const frame = page.locator('#sealFrame');
    const statusText = () => status.textContent();

    // A — rails labeled honestly
    assert.ok((await page.locator('#sealRailList').textContent()).includes('not yet qualified'), 'A: declared-unqualified rails must say so');

    // B — correct pin: VERIFIED and rendered only after verification
    await page.fill('#sealPerson', 'p1');
    await page.fill('#sealPin', realPin);
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="verified"]');
    assert.match(await statusText(), /VERIFIED/);
    assert.match(await statusText(), new RegExp(realPin.slice(0, 16)));
    assert.ok((await page.locator('#sealName').textContent()).includes('Ann Fixture'), 'B: the card names the person');
    const srcdocB = await frame.getAttribute('srcdoc');
    assert.ok(srcdocB && srcdocB.includes('PAGE-ONE-MARKER'), 'B: the page renders only once its digest verified');

    // C — tampered page bytes: FAILED CLOSED, nothing renders
    writeFileSync(join(lineageDir, 'persons', 'p1.html'), persons.p1.html.replace('Ann Fixture', 'Ann Tampered'));
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /page-drift/, 'C: the drift is named');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'C: no byte renders unverified');

    // D — wrong root pin: refused
    await page.fill('#sealPin', '0'.repeat(64));
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /pin-mismatch/, 'D: the pin mismatch is named');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'D: nothing renders');

    // E — no pin: consistency only, visibly untrusted (page restored first:
    // step C's tamper must not shadow the untrusted-path journey)
    writeFileSync(join(lineageDir, 'persons', 'p1.html'), persons.p1.html);
    await page.fill('#sealPin', '');
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="untrusted-consistency"]');
    const textE = await statusText();
    assert.match(textE, /CONSISTENCY ONLY/, 'E: untrusted mode says what it is');
    assert.ok(!/VERIFIED/.test(textE), 'E: untrusted mode never claims the verified word');
    assert.ok(await page.locator('#sealUntrustedWarn').isVisible(), 'E: the warning is visible');

    // F — unknown person: failed closed
    await page.fill('#sealPerson', 'nobody-here');
    await page.fill('#sealPin', realPin);
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /person-unknown|all-rails-failed/, 'F: the miss is named');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'F: nothing renders');
  } finally {
    await browser.close();
    server.close();
    rmSync(docroot, { recursive: true, force: true });
  }
});
