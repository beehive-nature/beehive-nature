/* z1.a people-journey three-view walk + screenshots — buzz-directory.html and
   profile.html (PR #56 finish). Run from repo root:
   node e2e/people-journey-shot.mjs
   Covers what the shared reading-room suite does not pin for these two pages:
   the three-view screenshot set (bee/raver/cypherpunk at desktop + 390), the
   Raver figure→hives / figure→house story paths, RTL (ar) visual receipts,
   language retention across view toggles, disclosure state across toggles in
   the real DOM, and the estate external-link law (new tab + noopener).
   No outbound requests or credentials. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const pages = ['buzz-directory.html', 'profile.html'];
const beatAttr = { 'buzz-directory.html': 'data-dir-beat', 'profile.html': 'data-prof-beat' };
const server = createServer(async (req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + sep)) throw Error('outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const shots = resolve(root, 'e2e/shots-people-journey'); await mkdir(shots, { recursive: true });
let assertions = 0;
const ok = (cond, why) => { assert.ok(cond, why); assertions++; };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
try {
  for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: size });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const path of pages) {
      const stem = path.replace('.html', '');
      await page.goto(base + '/surfaces/' + path); await page.locator('[data-reading-room]').waitFor();
      // ---- New bee: welcome arrival, first action, return
      await page.locator('#breg-bee').click(); await page.locator('#blangsel').selectOption('en');
      ok(await page.locator('#first-bee').isVisible(), path + ' bee arrival');
      ok(await overflow(page), path + ' bee fits ' + size.width);
      await page.screenshot({ path: resolve(shots, stem + '-bee-' + size.width + '.png'), fullPage: size.width === 390 });
      await page.locator('#first-bee .primary').first().click();
      await page.waitForFunction(() => document.activeElement.id.startsWith('layer-'));
      const layer = await page.evaluate(() => document.activeElement.id);
      ok(layer === (path === 'buzz-directory.html' ? 'layer-hives' : 'layer-house'), path + ' bee first action opens the story layer (' + layer + ')');
      ok(await overflow(page), path + ' story layer fits ' + size.width);
      await page.screenshot({ path: resolve(shots, stem + '-bee-story-' + size.width + '.png'), fullPage: size.width === 390 });
      await page.locator('[data-room-overview]').click();
      ok(await page.locator('#first-bee').isVisible(), path + ' bee returns');
      // ---- Raver: scene arrival → figure → story layer (the new paths)
      await page.locator('#breg-raver').click();
      ok(await page.locator('#first-raver').isVisible(), path + ' raver arrival');
      ok(await overflow(page), path + ' raver scene fits ' + size.width);
      await page.screenshot({ path: resolve(shots, stem + '-raver-' + size.width + '.png') });
      await page.locator('#first-raver .primary').first().click();
      ok(await page.locator('#layer-figure').isVisible(), path + ' raver figure');
      await page.screenshot({ path: resolve(shots, stem + '-raver-figure-' + size.width + '.png'), fullPage: size.width === 390 });
      await page.locator('#layer-figure .primary').first().click();
      const story = path === 'buzz-directory.html' ? '#layer-hives' : '#layer-house';
      ok(await page.locator(story).isVisible(), path + ' raver reaches the story layer');
      ok(await overflow(page), path + ' raver story fits ' + size.width);
      await page.screenshot({ path: resolve(shots, stem + '-raver-story-' + size.width + '.png'), fullPage: size.width === 390 });
      // ---- Cypherpunk: full instrument, connection details open
      await page.locator('#breg-cypherpunk').click();
      ok(await page.locator('#instrument').isVisible(), path + ' cypherpunk instrument');
      const openConn = await page.locator('.connection-details, .name-history').first().getAttribute('open');
      ok(openConn !== null, path + ' cypherpunk disclosures open');
      ok(await overflow(page), path + ' instrument fits ' + size.width);
      await page.screenshot({ path: resolve(shots, stem + '-cypherpunk-' + size.width + '.png'), fullPage: size.width === 390 });
      // ---- disclosure state survives view toggles (real DOM)
      await page.locator('#breg-bee').click();
      ok(await page.locator('.connection-details, .name-history').first().getAttribute('open') === null, path + ' bee collapses disclosures');
      await page.locator('#breg-cypherpunk').click();
      ok(await page.locator('.connection-details, .name-history').first().getAttribute('open') !== null, path + ' cypherpunk restores disclosure state');
      // ---- external-link law: every external anchor opens a labeled new tab
      const bad = await page.locator('a[href^="http"]').evaluateAll(nodes => nodes.filter(a => !a.target || !/noopener/.test(a.rel || '')).map(a => a.href));
      ok(!bad.length, path + ' external links are new-tab + noopener: ' + bad.join(', '));
      ok(!errors.length, path + ' no script errors: ' + errors.join('; '));
    }
    // ---- language retention across view toggles (390 only, one page each way)
    if (size.width === 390) {
      for (const [path, lang] of [['buzz-directory.html', 'lv'], ['profile.html', 'ar']]) {
        await page.goto(base + '/surfaces/' + path); await page.locator('[data-reading-room]').waitFor();
        await page.locator('#breg-bee').click();
        await page.locator('#blangsel').selectOption(lang);
        await page.waitForFunction(l => document.documentElement.lang === l, lang);
        const rtl = await page.evaluate(() => document.documentElement.dir);
        if (lang === 'ar') ok(rtl === 'rtl', path + ' Arabic mirrors RTL');
        const firstText = (await page.locator('#first-bee .calm').innerText()).trim();
        ok(firstText.length > 0 && firstText !== 'Welcome. This page is the estate\'s front porch — the place to find our community rooms.' || path !== 'buzz-directory.html', path + ' translated calm renders');
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-bee-390.png') });
        await page.locator('#breg-raver').click();
        const kept = await page.locator('#blangsel').inputValue();
        ok(kept === lang, path + ' language select retained across view toggle');
        const feel = (await page.locator('#first-raver .feel').innerText()).trim();
        ok(feel.length > 0, path + ' raver feel renders in ' + lang);
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-raver-390.png') });
        await page.locator('#breg-cypherpunk').click();
        ok(await page.locator('#blangsel').inputValue() === lang, path + ' language retained into cypherpunk');
        ok(await overflow(page), path + ' ' + lang + ' cypherpunk fits');
      }
    }
    await context.close();
    console.log('PASS', size.width, '— assertions so far:', assertions);
  }
  console.log(`PASS ${assertions} assertions. Screenshots: ${shots}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
