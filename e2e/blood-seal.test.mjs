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
  schema: 'skaists.genealogy-publication-state/2',
  tool: { name: 'fixture', version: '0' },
  hexLawNote: 'PUBLIC-CONSTANT fixture digests',
  indexSha256: 'PLACEHOLDER',
  corpus: {}, census: { persons: 2, htmlPages: 2, jsonPages: 2, strays: 0 },
  pages: Object.values(pageEntries),
};
const indexBytes = Buffer.from(JSON.stringify({
  schema: 'skaists.genealogy-publication-index/2',
  tool: { name: 'fixture', version: '0' },
  hexLawNote: 'PUBLIC-CONSTANT fixture digests',
  rootPerson: 'p1',
  counts: { persons: 2, fsRefsTotal: 2, recordArksTotal: 2 },
  persons: indexPersons,
}) + '\n', 'utf8');
// issue #477 chain: the STATE binds the index by digest (acyclic —
// pin -> state -> indexSha256 -> index bytes -> page digests)
stateObj.indexSha256 = sha(indexBytes);
const stateBytes = Buffer.from(JSON.stringify(stateObj) + '\n', 'utf8');
writeFileSync(join(lineageDir, 'publication-index.json'), indexBytes);
writeFileSync(join(lineageDir, 'publication-state.json'), stateBytes);
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
  served.add(rel);
  // door-shaped mock rails for gate J: JSON {"data": base64} — the estate
  // door's OBSERVED wrapper shape. doorA serves a TAMPERED p2 page; doorB
  // serves the sealed bytes.
  const doorMatch = /^door([AB])\/(.*)$/.exec(rel);
  if (doorMatch) {
    const name = doorMatch[2];
    const clean = files['assets/profile-archive/lineage/' + name] !== undefined;
    if (!clean) {
      res.writeHead(404);
      res.end('no');
      return;
    }
    let bytes = readFileSync(join(docroot, 'assets/profile-archive/lineage', name));
    if (doorMatch[1] === 'A' && name === 'persons/p2.html') {
      bytes = Buffer.from(bytes.toString('utf8').replace('Bob Fixture', 'Bob Tampered'));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: bytes.toString('base64') }));
    return;
  }
  if (files[rel]) {
    res.writeHead(200, { 'content-type': files[rel] });
    res.end(readFileSync(join(docroot, rel)));
  } else {
    res.writeHead(404);
    res.end('no');
  }
};
const served = new Set();

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

    // G — issue #477's exact substitution: ONLY metadata forged (name, refs,
    // arks), page digests and state intact — must refuse, nothing displayed
    const indexPath = join(lineageDir, 'publication-index.json');
    const pristineIndex = readFileSync(indexPath, 'utf8');
    const forged = JSON.parse(pristineIndex);
    forged.persons.p1.name = 'Forged von Fabrication';
    forged.persons.p1.fsRefs = ['FAKE-999'];
    forged.persons.p1.recordArks = ['FAKE-ARK-1'];
    writeFileSync(indexPath, JSON.stringify(forged) + '\n');
    await page.fill('#sealPerson', 'p1');
    await page.fill('#sealPin', realPin);
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /index-not-state-bound/, 'G: the substituted index is named');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'G: nothing renders');
    assert.ok(await page.locator('#sealCard').isHidden(), 'G: no forged metadata displayed');
    writeFileSync(indexPath, pristineIndex);

    // H — locator escape, tested separately per #477: even a self-consistent
    // state+index pair (only possible without a pin — the pin is the real
    // boundary) cannot aim a locator outside persons/; and the server PROVES
    // no outside path was ever requested
    const escapeIndex = JSON.parse(pristineIndex);
    escapeIndex.persons.p1.pageHtml = '../secrets.html';
    const escapeIndexBytes = Buffer.from(JSON.stringify(escapeIndex) + '\n', 'utf8');
    writeFileSync(indexPath, escapeIndexBytes);
    const statePath = join(lineageDir, 'publication-state.json');
    const pristineState = readFileSync(statePath, 'utf8');
    const escapeState = JSON.parse(pristineState);
    escapeState.indexSha256 = sha(escapeIndexBytes);
    writeFileSync(statePath, JSON.stringify(escapeState) + '\n');
    await page.fill('#sealPin', '');
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /locator-escape/, 'H: the escape is named');
    assert.ok(!served.has('secrets.html') && ![...served].some((p) => p.includes('..')),
      'H: no request ever escaped the corpus paths');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'H: nothing renders');
    writeFileSync(indexPath, pristineIndex);
    writeFileSync(statePath, pristineState);

    // I — path-shaped person ids rejected before anything is fetched
    await page.fill('#sealPerson', '../escape');
    await page.click('#sealGo');
    await page.waitForSelector('#sealStatus[data-state="failed"]');
    assert.match(await statusText(), /person-id-rejected/, 'I: the id shape is named');
    assert.equal(await frame.getAttribute('srcdoc'), null, 'I: nothing renders');

    // J — pluggable rails through the REAL reader (the 2026-10-20 rail
    // qualification pass): door-shaped rails in the reader's own
    // verifyPerson, serving the estate door's OBSERVED wrapper shape.
    // Rail "one" serves a tampered p2 page; rail "two" the sealed bytes —
    // the tampered rail is named and refused, the good rail verifies; two
    // tampered rails fail closed with every refusal named. No rail's bytes
    // render unverified, ever.
    const viaDoors = await page.evaluate(async ({ pin }) => {
      const origin = location.origin;
      const mk = (id, doorTag) => ({
        id,
        qualified: true,
        kind: 'estate-door',
        door: origin + '/door' + doorTag + '/',
        addresses: {
          'publication-state.json': 'publication-state.json',
          'publication-index.json': 'publication-index.json',
          'persons/p2.html': 'persons/p2.html',
          'persons/p2.json': 'persons/p2.json',
        },
      });
      const run = async (rails) => {
        try {
          const r = await BloodSeal.verifyPerson({ person: 'p2', rootPin: pin, rails });
          return { status: r.status, rail: r.rail, attempts: r.attempts.map((a) => a.rail + ':' + a.refused) };
        } catch (e) {
          return { error: e.code, attempts: (e.attempts || []).map((a) => a.rail + ':' + a.refused) };
        }
      };
      return {
        happy: await run([mk('door-tampered', 'A'), mk('door-clean', 'B')]),
        bothTampered: await run([mk('door-tampered-1', 'A'), mk('door-tampered-2', 'A')]),
      };
    }, { pin: realPin });
    assert.ok(viaDoors.happy.status === 'verified' && viaDoors.happy.rail === 'door-clean',
      'J: verified through the clean door rail: ' + JSON.stringify(viaDoors.happy));
    assert.ok(viaDoors.happy.attempts.some((a) => a.startsWith('door-tampered:page-drift')),
      'J: the tampered rail is named: ' + JSON.stringify(viaDoors.happy.attempts));
    assert.equal(viaDoors.bothTampered.error, 'all-rails-failed',
      'J: tampered everywhere fails closed: ' + JSON.stringify(viaDoors.bothTampered));
    assert.ok(viaDoors.bothTampered.attempts.length === 2,
      'J: every rail refusal named: ' + JSON.stringify(viaDoors.bothTampered.attempts));
  } finally {
    await browser.close();
    server.close();
    rmSync(docroot, { recursive: true, force: true });
  }
});
