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
ok('watch: shared manifest is verified', (await page.locator('#manifest-state').innerText()).trim().toLowerCase() === 'verified');
ok('watch: channel and sequence are projected', await page.locator('#manifest-channel').innerText() === 'plur' && await page.locator('#manifest-sequence').innerText() === '12');
ok('watch: checkpoint remains a bounded reference', (await page.locator('#manifest-checkpoint').innerText()).includes('…'));
ok('watch: encrypted item count is visible', await page.locator('#manifest-items').innerText() === '4 encrypted');
ok('watch: no write or raw transport was opened', !requests.some(r => r.method === 'POST' || r.url.includes('/ws')));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
