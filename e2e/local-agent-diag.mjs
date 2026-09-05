// local-agent-diag.mjs — warm-phase diagnostic (scratch, not a gate).
// Persistent profile so the COLD state survives between runs.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const srv = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const body = await readFile(join('..', rel));
    res.writeHead(200, { 'content-type': MIME[(rel.match(/\.[a-z0-9]+$/) || [])[0]] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const mode = process.argv[2] || 'warm';
const ctx = await chromium.launchPersistentContext('./.local-agent-profile', {
  channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-gpu'],
  args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU'],
  viewport: { width: 390, height: 844 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console.' + m.type() + ']', m.text().slice(0, 160)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 160)));
const reqs = [];
page.on('request', r => reqs.push(r.url().replace(BASE, '')));

await page.goto(`${BASE}/surfaces/local-agent/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(600);

if (mode === 'cold') {
  await page.locator('#wake').click();
  await page.waitForFunction(() => {
    const b = document.getElementById('wake');
    return b && (b.innerText.includes('awake') || b.innerText.includes('try again'));
  }, null, { timeout: 900000 });
} else {
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  reqs.length = 0;
  await page.locator('#wake').click();
  await page.waitForTimeout(25000);   // let it fail or settle
}
const st = await page.evaluate(() => ({
  wake: document.getElementById('wake').innerText.slice(0, 80),
  answer: document.getElementById('answer').innerText.slice(0, 160),
  sri: window.__localAgent.sri,
  census: window.__localAgent.sriCensus,
  wire: window.__localAgent.wireState,
  sw: navigator.serviceWorker.controller ? 'controlled' : 'NOT controlled',
}));
console.log(JSON.stringify(st, null, 1));
console.log('requests after reload-wake:', reqs.length ? reqs.slice(0, 30).join('\n  ') : 'none');
await ctx.close(); srv.close();
