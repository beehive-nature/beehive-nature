// Real private working edition — ordinary-gesture user journey (2026-10-19).
// Gated: runs only when SKAISTS_LOCAL_EDITION points at a prepared
// skaists.preservation-local/1 package directory (this box; CI skips).
//
// Journey: one ring person (Elizabeth Jane "Eliza" Boyd — her own shard
// carries the retained 1885 Nebraska census page). Keyboard operation opens
// her from the Tree of Life (the orbit buttons overlap each other's pointer
// paths at 1280x900 and 1920x1080 — sibling buttons intercept the centre
// click, captured in earlier runs), then every downstream gesture is an
// ORDINARY actionable click: story card, source row summary, nested
// transcription summary, Verify and open saved page. A browser-context guard
// records any outside-origin attempt for the whole journey.
//
//   SKAISTS_LOCAL_EDITION=<package-dir> node e2e/local-evidence-real-edition.mjs
import { chromium } from 'playwright';
import { createLocalEditionHost } from '../tools/genealogy/serve-local.mjs';

const ROOT = process.env.SKAISTS_LOCAL_EDITION;
if (!ROOT) { console.log('skip: SKAISTS_LOCAL_EDITION not set'); process.exit(0); }
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const PERSON = { id: 'p10e83a0970', name: 'Elizabeth Jane Boyd', sources: 19, row: /Eliza Davis/ };

const t0 = Date.now();
const server = createLocalEditionHost({ root: ROOT });
const startupMs = Date.now() - t0;
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
console.log('startup snapshot verification: ' + startupMs + 'ms, ' + server.package.files + ' files, ' + server.package.totalBytes + ' bytes');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const outside = [];
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (u.origin === new URL(base).origin) return route.continue();
  outside.push(route.request().url());
  return route.abort('blockedbyclient');
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

await page.goto(base + 'surfaces/blood.html', { waitUntil: 'load', timeout: 90000 });
const stamped = await page.evaluate(() => document.documentElement.dataset.localEvidence || null);
check('package page carries the stamped local-evidence base', !!stamped, stamped || 'absent');

await page.waitForSelector('#ppanel[data-pp-mounted="1"]', { timeout: 60000 });
await page.waitForSelector('#lifeTree .tol-orbit-person', { timeout: 60000 });
await page.locator(`#lifeTree .tol-orbit-person[data-person="${PERSON.id}"]`).focus({ timeout: 30000 });
await page.keyboard.press('Enter');
await page.locator('#lifeTree .tol-card [data-story]').first().focus({ timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForSelector('#ppanel .pp-person', { timeout: 60000 });
check('person panel opened via keyboard on the tree (orbit pointer paths overlap)', true);

// The person view wraps its sections in COLLAPSIBLE <details class="pp-sec">
// that start CLOSED: Chrome lays out the content (non-zero boxes) but paints
// and hit-tests nothing inside — which is why indirect probes read "visible"
// while the browser refuses interaction. The user gesture is the section's
// own summary header. (This closed-details wrapper is the entire hidden-state
// cause recorded in the review.)
const wrapper = page.locator('details.pp-sec', { has: page.locator('[data-pp-local-evidence]') }).first();
await wrapper.locator('summary').first().click({ timeout: 30000 });
const stateLine = page.locator('[data-pp-local-evidence] p').filter({ hasText: PERSON.sources + ' source entries stored locally' }).first();
await stateLine.waitFor({ state: 'visible', timeout: 60000 });
check('her evidence state line is VISIBLE after opening the section', await stateLine.isVisible(), (await stateLine.textContent()).trim());

// the retained page: 1885 Nebraska census — ordinary clicks all the way
const censusRow = page.locator('[data-pp-local-evidence] details').filter({ has: page.locator('summary', { hasText: PERSON.row }) }).first();
await censusRow.locator('summary').click({ timeout: 30000 });
const transcription = censusRow.locator('summary', { hasText: 'Recorded text and transcription' });
if (await transcription.count()) await transcription.click({ timeout: 30000 });
const verify = censusRow.getByRole('button', { name: 'Verify and open saved page' });
await verify.waitFor({ state: 'visible', timeout: 30000 });
await verify.click({ timeout: 30000 });
const receiptLine = censusRow.locator('p', { hasText: 'Saved bytes match the receipt' });
await receiptLine.waitFor({ state: 'visible', timeout: 30000 });
check('receipt line VISIBLE after an ORDINARY Verify click', await receiptLine.isVisible(), (await receiptLine.textContent()).trim());

const decoded = await page.waitForFunction(async () => {
  const img = document.querySelector('[data-pp-local-evidence] img');
  if (!img) return false;
  try { await img.decode(); } catch { return false; }
  return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}, null, { timeout: 30000 }).then(() => true).catch(() => false);
check('the real 1885 census page image DECODES in the browser', decoded);

check('ZERO outside-origin attempts across the real journey', outside.length === 0, outside.slice(0, 3).join(' | '));
check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

console.log(JSON.stringify({
  schema: 'skaists.local-edition-acceptance/1',
  ordinaryGestures: 'keyboard open (tree) + ordinary actionable clicks downstream',
  startupVerificationMs: startupMs,
  files: server.package.files,
  totalBytes: server.package.totalBytes,
  person: PERSON.name,
  outsideOriginAttempts: outside.length,
  pageErrors: pageErrors.length,
}, null, 1));

await context.close();
await browser.close();
server.closeAllConnections?.();
await new Promise((r) => server.close(r));
const failed = results.filter((r) => !r.ok);
console.log('\n' + results.length + ' checks, ' + (results.length - failed.length) + ' pass, ' + failed.length + ' fail');
if (failed.length) { failed.forEach((f) => console.log('FAIL', f.name, f.detail)); process.exit(1); }
process.exit(0);
