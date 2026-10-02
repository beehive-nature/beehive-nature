// e2e/onboarding-link-wire.mjs — prove hub/doors discover onboarding.html and CTAs reach wallet + bdata
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as fsConstants } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const PORT = 8961, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = join(ROOT, u);
    const b = await readFile(f);
    s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    s.end(b);
  } catch { s.writeHead(404); s.end('missing ' + q.url); }
});
let browser;
before(async () => {
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); srv.close(); });

test('onboarding.html exists and redirects into the ceremony', async () => {
  await access(join(ROOT, 'surfaces/onboarding.html'), fsConstants.R_OK);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/onboarding.html`, { waitUntil: 'load' });
  await p.waitForURL(/onboarding\/index\.html/, { timeout: 10000 });
  assert.match(p.url(), /\/surfaces\/onboarding\/index\.html/);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('hub New bee footer discovers onboarding.html then lands on ceremony', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'bee'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/surfaces/index.html`, { waitUntil: 'load' });
  const href = await p.getAttribute('footer .footer-links a', 'href');
  assert.equal(href, 'onboarding.html', 'hub New bee must point at onboarding.html');
  await Promise.all([
    p.waitForURL(/onboarding/, { timeout: 15000 }),
    p.click('footer .footer-links a'),
  ]);
  // shim then ceremony
  await p.waitForURL(/onboarding\/index\.html/, { timeout: 15000 });
  assert.match(p.url(), /\/surfaces\/onboarding\/index\.html/);
  await ctx.close();
});

test('nature door Join tile href is onboarding.html', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/surfaces/doors/beehivenature.html`, { waitUntil: 'load' });
  const href = await p.getAttribute('a.t.p[href*="onboarding"]', 'href');
  assert.equal(href, '../onboarding.html');
  await Promise.all([
    p.waitForURL(/onboarding/, { timeout: 15000 }),
    p.click('a.t.p[href*="onboarding"]'),
  ]);
  await p.waitForURL(/onboarding\/index\.html/, { timeout: 15000 });
  await ctx.close();
});

test('ready CTAs wire to wallet.html and bdata.html (no alert stub)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'bee'); } catch {} });
  const p = await ctx.newPage();
  const dialogs = [];
  p.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  await p.goto(`${ORIGIN}/surfaces/onboarding/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof window.jumpInstrument === 'function' || (window.APP && window.APP.go), null, { timeout: 20000 });
  // force ready screen
  await p.evaluate(() => {
    if (typeof jumpInstrument === 'function') jumpInstrument('ready');
    else if (window.APP && APP.go) APP.go('ready');
  });
  await p.waitForSelector('a[data-onb-next="wallet"]', { timeout: 10000 });
  const walletHref = await p.getAttribute('a[data-onb-next="wallet"]', 'href');
  const bdataHref = await p.getAttribute('a[data-onb-next="bdata"]', 'href');
  assert.equal(walletHref, '../wallet.html');
  assert.equal(bdataHref, '../bdata.html');
  assert.equal(dialogs.length, 0, 'no alert stub: ' + dialogs.join('|'));

  await Promise.all([
    p.waitForURL(/\/wallet\.html/, { timeout: 15000 }),
    p.click('a[data-onb-next="wallet"]'),
  ]);
  assert.match(p.url(), /\/surfaces\/wallet\.html/);
  const title = await p.title();
  assert.ok(title.length > 0);

  await p.goto(`${ORIGIN}/surfaces/onboarding/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof window.jumpInstrument === 'function' || (window.APP && window.APP.go), null, { timeout: 20000 });
  await p.evaluate(() => {
    if (typeof jumpInstrument === 'function') jumpInstrument('ready');
    else if (window.APP && APP.go) APP.go('ready');
  });
  await p.waitForSelector('a[data-onb-next="bdata"]', { timeout: 10000 });
  await Promise.all([
    p.waitForURL(/\/bdata\.html/, { timeout: 15000 }),
    p.click('a[data-onb-next="bdata"]'),
  ]);
  assert.match(p.url(), /\/surfaces\/bdata\.html/);
  // Add to manifest is on main today
  const add = await p.locator('text=Add to manifest').first().isVisible().catch(() => false);
  assert.ok(add, 'bdata must show Add to manifest');
  await ctx.close();
});