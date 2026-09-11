// zcode-watch-manifest-check.mjs — local proof for the W@tch manifest seam.
// The watch page is served as a one-file surface, so the test supplies only
// its existing static dependencies and a fixture-backed manifest. It never
// contacts a relay, opens x0x, writes to Autonomi, or starts a meter session.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const requests = [];
const server = createServer(async (req, res) => {
  requests.push({ method: req.method, url: req.url });
  const route = req.url.split('?')[0];
  if (route === '/live/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ publishing: false, rooms: [] })); return; }
  if (route === '/live/ticker/general.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  if (route === '/join/' || route === '/watch/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>local room</title>'); return; }
  let file = join(ROOT, decodeURIComponent(route).replace(/^\//, ''));
  if (route === '/tokens.css') file = join(ROOT, 'surfaces', 'tokens.css');
  if (route === '/watch/hls.min.js') file = join(ROOT, 'surfaces', 'hls.min.js');
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
let pass = 0, fail = 0;
const ok = (label, condition, note = '') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` — ${note}` : ''}`); } };

await page.goto(`${base}/surfaces/watch.html`);
await page.waitForFunction(() => document.getElementById('manifest-state')?.textContent === 'verified');
ok('watch: page has no errors', errors.length === 0, errors.join(' | '));
ok('watch: page carries SKAISTS identity', await page.title() === 'SKAISTS watch room · skaists.buzz' && (await page.locator('h1').innerText()) === 'SKAISTS watch room');
ok('watch: shared manifest is verified', (await page.locator('#manifest-state').innerText()).trim().toLowerCase() === 'verified');
ok('watch: channel and sequence are projected', await page.locator('#manifest-channel').innerText() === 'plur' && await page.locator('#manifest-sequence').innerText() === '12');
ok('watch: checkpoint remains a bounded reference', (await page.locator('#manifest-checkpoint').innerText()).includes('…'));
ok('watch: encrypted item count is visible', await page.locator('#manifest-items').innerText() === '4 encrypted');
const jamsRef = page.locator('a[href="https://jams.community/"]');
const watchRef = page.locator('a[href="https://relay.skaists.dev/watch/"]');
ok('watch: independent references are explicit', await jamsRef.count() === 1 && await watchRef.count() === 1 && (await page.locator('.independent').innerText()).includes('separate projects'));
ok('watch: independent references open safely in new tabs', await jamsRef.getAttribute('target') === '_blank' && await jamsRef.getAttribute('rel') === 'noopener noreferrer' && await watchRef.getAttribute('target') === '_blank' && await watchRef.getAttribute('rel') === 'noopener noreferrer');
ok('watch: no write or raw transport was opened', !requests.some(r => r.method === 'POST' || r.url.includes('/ws')));
await page.waitForSelector('#breg-bee');
for (const mode of ['bee', 'raver', 'cypherpunk']) {
  await page.locator(`#breg-${mode}`).click();
  const view = await page.evaluate(() => {
    const visible = selector => { const node = document.querySelector(selector); return !!node && getComputedStyle(node).display !== 'none'; };
    return {
      reg: document.body.dataset.reg,
      leads: [...document.querySelectorAll('.view-lead[data-view]')].filter(node => getComputedStyle(node).display !== 'none').map(node => node.dataset.view),
      leadKeys: [...document.querySelectorAll('.view-lead[data-view]')].map(node => node.dataset.i18n || node.querySelector('[data-i18n]')?.getAttribute('data-i18n')),
      manifest: visible('.manifest-card'),
      welcome: visible(`.room-welcome[data-view="${document.body.dataset.reg}"]`),
    };
  });
  ok(`watch: ${mode} view selects its own reading`, view.reg === mode && view.leads.length === 1 && view.leads[0] === mode && view.welcome === (mode !== 'cypherpunk') && view.manifest === (mode === 'cypherpunk'));
  ok(`watch: ${mode} view copy is translation-keyed`, view.leadKeys.every(Boolean));
}
await page.locator('#breg-bee').click();
await page.waitForSelector('#blangsel');
await page.evaluate(() => localStorage.setItem('blang', 'ru'));
await page.reload();
await page.waitForFunction(() => document.documentElement.lang === 'ru' && document.querySelector('#blangsel')?.value === 'ru');
const translatedLead = await page.locator('.view-lead[data-view="bee"] [data-i18n="room.beeLead"]').innerText();
const translatedLang = await page.evaluate(() => document.documentElement.lang);
ok('watch: view copy travels through the language dock', translatedLead !== 'Open a second tab. Turn a knob. Watch it move.' && translatedLang === 'ru');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
