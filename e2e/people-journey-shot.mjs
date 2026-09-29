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
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const corpus = JSON.parse(readFileSync(resolve(root, 'surfaces/lang-corpus.json'), 'utf8'));
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
      // ---- F4: New bee routine labels measure ≥14px computed, wrap, stay visible
      if (size.width === 390) {
        await page.locator('#breg-bee').click();
        await page.locator('#first-bee .primary').first().click();
        await page.locator('#layer-hives .door, #layer-house .door').last().click(); // Go deeper → instrument
        ok(await page.locator('#instrument').isVisible(), path + ' bee reaches instrument');
        const selectors = path === 'buzz-directory.html'
          ? ['.listing .lrelay', '.listing .chip']
          : ['.holder .bio .bdesc', '.holder .bio .bmeta'];
        for (const sel of selectors) {
          const sizes = await page.locator(sel).evaluateAll(nodes =>
            nodes.filter(n => n.offsetParent !== null).map(n => parseFloat(getComputedStyle(n).fontSize)));
          ok(sizes.length > 0, path + ' ' + sel + ' visible in bee instrument');
          ok(Math.min(...sizes) >= 14, path + ' ' + sel + ' ≥14px computed (min ' + Math.min(...sizes) + ')');
        }
        const clipped = await page.locator(selectors.join(',')).evaluateAll(nodes =>
          nodes.filter(n => n.offsetParent !== null && (n.scrollWidth > n.clientWidth + 1)).length);
        ok(clipped === 0, path + ' bee labels wrap, none clip horizontally');
        ok(await overflow(page), path + ' bee instrument fits 390');
        await page.screenshot({ path: resolve(shots, stem + '-bee-inst-390.png'), fullPage: true });
      }
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
    // ---- language retention across view toggles + rendered-translation receipts (390)
    if (size.width === 390) {
      for (const [path, lang] of [['buzz-directory.html', 'lv'], ['profile.html', 'ar']]) {
        await page.goto(base + '/surfaces/' + path); await page.locator('[data-reading-room]').waitFor();
        await page.locator('#breg-bee').click();
        await page.locator('#blangsel').selectOption(lang);
        await page.waitForFunction(l => document.documentElement.lang === l, lang);
        const rtl = await page.evaluate(() => document.documentElement.dir);
        if (lang === 'ar') ok(rtl === 'rtl', path + ' Arabic mirrors RTL');
        // repaired assertion (was vacuous for profile): the rendered calm equals the corpus cell exactly
        const calmKey = await page.locator('#first-bee .calm').getAttribute('data-i18n');
        const calmText = (await page.locator('#first-bee .calm').innerText()).trim();
        ok(calmText === corpus.strings[calmKey][lang].trim(), path + ' rendered calm equals corpus ' + lang);
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-bee-390.png') });
        // F1 receipt: the mid-beat story sentence renders translated (door card / founder story)
        await page.locator('#first-bee .primary').first().click();
        const storySel = path === 'buzz-directory.html' ? '[data-i18n="dir.hives.doorcard"]' : '[data-i18n="prof.house.story"]';
        const storyKey = await page.locator(storySel).first().getAttribute('data-i18n');
        const storyText = (await page.locator(storySel).first().innerText()).trim();
        ok(storyText === corpus.strings[storyKey][lang].trim(), path + ' rendered story sentence equals corpus ' + lang);
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-bee-story-390.png') });
        await page.locator('[data-room-overview]').click();
        await page.locator('#breg-raver').click();
        const kept = await page.locator('#blangsel').inputValue();
        ok(kept === lang, path + ' language select retained across view toggle');
        const feel = (await page.locator('#first-raver .feel').innerText()).trim();
        const feelKey = await page.locator('#first-raver .feel').getAttribute('data-i18n');
        ok(feel === corpus.strings[feelKey][lang].trim(), path + ' raver feel equals corpus ' + lang);
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-raver-390.png') });
        await page.locator('#breg-cypherpunk').click();
        ok(await page.locator('#blangsel').inputValue() === lang, path + ' language retained into cypherpunk');
        ok(await overflow(page), path + ' ' + lang + ' cypherpunk fits');
        // F5 receipt: every leaf keyed element in the instrument renders its corpus cell
        // (innerText gates on rendered — closed-details copy is skipped; textContent
        // compares without CSS text-transform distortion, e.g. the uppercased .who)
        const drift = await page.locator('#instrument [data-i18n]').evaluateAll((nodes, rows) =>
          nodes.filter(n => !n.querySelector('[data-i18n]') && (n.innerText || '').trim())
            .filter(n => { const k = n.dataset.i18n; const cell = rows.strings[k]?.[document.documentElement.lang]; return typeof cell === 'string' && cell.trim() && n.textContent.trim() !== cell.trim(); })
            .map(n => n.dataset.i18n), corpus);
        ok(!drift.length, path + ' instrument keyed leaves render ' + lang + ' (drift: ' + drift.join(',') + ')');
        await page.screenshot({ path: resolve(shots, path.replace('.html', '') + '-' + lang + '-instrument-390.png'), fullPage: true });
      }
    }
    await context.close();
    console.log('PASS', size.width, '— assertions so far:', assertions);
  }
  console.log(`PASS ${assertions} assertions. Screenshots: ${shots}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
