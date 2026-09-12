/* z1.b LIVE people acceptance — buzz-directory.html + profile.html against
   https://skaists.dev at Pages build 5709897f (verified byte-identical first).
   Faithful port of e2e/people-journey-shot.mjs (source-review harness) plus
   live-only checks: cold contexts, reload persona retention (bregister),
   cross-page language travel (blang), network/console capture.
   Collects a full pass/fail matrix; never aborts on first failure.
   Run from repo root: node e2e/people-journey-live-shot.mjs (NOT in the CI list — live-network by design) */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'https://skaists.dev/surfaces/';
const shots = resolve('e2e/shots-people-journey-live');
await mkdir(shots, { recursive: true });

const corpus = await (await fetch(BASE + 'lang-corpus.json')).json();

const pages = ['buzz-directory.html', 'profile.html'];
const storyLayer = { 'buzz-directory.html': '#layer-hives', 'profile.html': '#layer-house' };

const results = [];
const check = (cond, name) => {
  results.push([!!cond, name]);
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name);
};
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

const browser = await chromium.launch({ headless: true });
const netLog = []; // one line per doc + every non-200 / failed request
try {
  for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: size }); // COLD: no cache, no storage
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('requestfailed', r => netLog.push(`FAILED ${r.failure()?.errorText} ${r.url()}`));
    page.on('response', r => {
      if (r.request().isNavigationRequest()) netLog.push(`DOC ${r.status()} ${r.url()}`);
      else if (r.status() >= 400) netLog.push(`HTTP ${r.status()} ${r.url()}`);
    });
    console.log(`\n=== ${size.width}x${size.height} (cold context) ===`);
    for (const path of pages) {
      const stem = path.replace('.html', '');
      console.log('-- ' + path);
      try {
        await page.goto(BASE + path, { waitUntil: 'load' });
        await page.locator('[data-reading-room]').waitFor();
        check(true, `${path} cold load, reading room mounted`);
        // ---- New bee: welcome arrival, first action, return
        await page.locator('#breg-bee').click();
        await page.locator('#blangsel').selectOption('en');
        check(await page.locator('#first-bee').isVisible(), `${path} bee arrival`);
        check(await overflow(page), `${path} bee fits ${size.width}`);
        await page.screenshot({ path: resolve(shots, `${stem}-bee-${size.width}.png`), fullPage: size.width === 390 });
        await page.locator('#first-bee .primary').first().click();
        await page.waitForFunction(() => document.activeElement.id.startsWith('layer-'));
        const layer = await page.evaluate(() => document.activeElement.id);
        check(layer === storyLayer[path].slice(1), `${path} bee first action opens story layer (${layer})`);
        check(await overflow(page), `${path} story layer fits ${size.width}`);
        await page.screenshot({ path: resolve(shots, `${stem}-bee-story-${size.width}.png`), fullPage: size.width === 390 });
        await page.locator('[data-room-overview]').click();
        check(await page.locator('#first-bee').isVisible(), `${path} bee returns`);
        // ---- Raver: scene arrival -> figure -> story layer
        await page.locator('#breg-raver').click();
        check(await page.locator('#first-raver').isVisible(), `${path} raver arrival`);
        check(await overflow(page), `${path} raver scene fits ${size.width}`);
        await page.screenshot({ path: resolve(shots, `${stem}-raver-${size.width}.png`) });
        await page.locator('#first-raver .primary').first().click();
        check(await page.locator('#layer-figure').isVisible(), `${path} raver figure`);
        await page.screenshot({ path: resolve(shots, `${stem}-raver-figure-${size.width}.png`), fullPage: size.width === 390 });
        await page.locator('#layer-figure .primary').first().click();
        check(await page.locator(storyLayer[path]).isVisible(), `${path} raver reaches the story layer`);
        check(await overflow(page), `${path} raver story fits ${size.width}`);
        await page.screenshot({ path: resolve(shots, `${stem}-raver-story-${size.width}.png`), fullPage: size.width === 390 });
        // ---- Cypherpunk: full instrument, connection details open
        await page.locator('#breg-cypherpunk').click();
        check(await page.locator('#instrument').isVisible(), `${path} cypherpunk instrument`);
        const openConn = await page.locator('.connection-details, .name-history').first().getAttribute('open');
        check(openConn !== null, `${path} cypherpunk disclosures open`);
        check(await overflow(page), `${path} instrument fits ${size.width}`);
        await page.screenshot({ path: resolve(shots, `${stem}-cypherpunk-${size.width}.png`), fullPage: size.width === 390 });
        // ---- reload retention (live-only): bregister survives reload
        await page.reload({ waitUntil: 'load' });
        await page.locator('[data-reading-room]').waitFor();
        const keptReg = await page.evaluate(() => document.body.getAttribute('data-reg'));
        check(keptReg === 'cypherpunk', `${path} persona survives reload (bregister -> ${keptReg})`);
        // ---- F4 (390 only): New bee routine labels >=14px, wrap, visible
        if (size.width === 390) {
          await page.locator('#breg-bee').click();
          await page.locator('#first-bee .primary').first().click();
          await page.locator('#layer-hives .door, #layer-house .door').last().click(); // Go deeper -> instrument
          check(await page.locator('#instrument').isVisible(), `${path} bee reaches instrument`);
          const selectors = path === 'buzz-directory.html'
            ? ['.listing .lrelay', '.listing .chip']
            : ['.holder .bio .bdesc', '.holder .bio .bmeta'];
          for (const sel of selectors) {
            const sizes = await page.locator(sel).evaluateAll(nodes =>
              nodes.filter(n => n.offsetParent !== null).map(n => parseFloat(getComputedStyle(n).fontSize)));
            check(sizes.length > 0, `${path} ${sel} visible in bee instrument`);
            if (sizes.length) check(Math.min(...sizes) >= 14, `${path} ${sel} >=14px computed (min ${Math.min(...sizes)})`);
          }
          const clipped = await page.locator(selectors.join(',')).evaluateAll(nodes =>
            nodes.filter(n => n.offsetParent !== null && (n.scrollWidth > n.clientWidth + 1)).length);
          check(clipped === 0, `${path} bee labels wrap, none clip horizontally`);
          check(await overflow(page), `${path} bee instrument fits 390`);
          await page.screenshot({ path: resolve(shots, `${stem}-bee-inst-390.png`), fullPage: true });
        }
        // ---- disclosure state survives view toggles (real DOM)
        await page.locator('#breg-bee').click();
        check(await page.locator('.connection-details, .name-history').first().getAttribute('open') === null, `${path} bee collapses disclosures`);
        await page.locator('#breg-cypherpunk').click();
        check(await page.locator('.connection-details, .name-history').first().getAttribute('open') !== null, `${path} cypherpunk restores disclosure state`);
        // ---- external-link law (live DOM)
        const bad = await page.locator('a[href^="http"]').evaluateAll(nodes =>
          nodes.filter(a => !a.target || !/noopener/.test(a.rel || '')).map(a => a.href));
        check(!bad.length, `${path} external links are new-tab + noopener: ${bad.join(', ')}`);
        check(!errors.length, `${path} no script/console errors: ${errors.join(' | ')}`);
      } catch (e) {
        check(false, `${path} walk threw: ${e.message.split('\n')[0]}`);
      }
    }
    // ---- language block (390 only): directory lv, profile he (RTL) — cold context
    if (size.width === 390) {
      const langContext = await browser.newContext({ viewport: size }); // COLD
      const lp = await langContext.newPage();
      lp.setDefaultTimeout(45000);
      const lerrors = [];
      lp.on('pageerror', e => lerrors.push('pageerror: ' + e.message));
      lp.on('console', m => { if (m.type() === 'error') lerrors.push('console: ' + m.text()); });
      console.log('-- language: directory lv + travel, profile he RTL');
      try {
        await lp.goto(BASE + 'buzz-directory.html', { waitUntil: 'load' });
        await lp.locator('[data-reading-room]').waitFor();
        await lp.locator('#breg-bee').click();
        await lp.locator('#blangsel').selectOption('lv');
        await lp.waitForFunction(l => document.documentElement.lang === l, 'lv');
        check(true, 'directory lv applied (documentElement.lang=lv)');
        check((await lp.evaluate(() => document.documentElement.dir)) === 'ltr', 'directory lv stays LTR');
        const calmKey = await lp.locator('#first-bee .calm').getAttribute('data-i18n');
        const calmText = (await lp.locator('#first-bee .calm').innerText()).trim();
        check(calmText === corpus.strings[calmKey].lv.trim(), 'directory rendered calm equals corpus lv');
        await lp.screenshot({ path: resolve(shots, 'buzz-directory-lv-bee-390.png'), fullPage: true });
        await lp.locator('#first-bee .primary').first().click();
        const storySel = '[data-i18n="dir.hives.doorcard"]';
        const storyText = (await lp.locator(storySel).first().innerText()).trim();
        check(storyText === corpus.strings['dir.hives.doorcard'].lv.trim(), 'directory rendered story sentence equals corpus lv');
        await lp.screenshot({ path: resolve(shots, 'buzz-directory-lv-bee-story-390.png'), fullPage: true });
        await lp.locator('[data-room-overview]').click();
        await lp.locator('#breg-raver').click();
        check((await lp.locator('#blangsel').inputValue()) === 'lv', 'directory language select retained across view toggle');
        const feelKey = await lp.locator('#first-raver .feel').getAttribute('data-i18n');
        check((await lp.locator('#first-raver .feel').innerText()).trim() === corpus.strings[feelKey].lv.trim(), 'directory raver feel equals corpus lv');
        await lp.screenshot({ path: resolve(shots, 'buzz-directory-lv-raver-390.png'), fullPage: true });
        await lp.locator('#breg-cypherpunk').click();
        check((await lp.locator('#blangsel').inputValue()) === 'lv', 'directory language retained into cypherpunk');
        const lvDrift = await lp.locator('#instrument [data-i18n]').evaluateAll((nodes, rows) =>
          nodes.filter(n => !n.querySelector('[data-i18n]') && (n.innerText || '').trim())
            .filter(n => { const k = n.dataset.i18n; const cell = rows.strings[k]?.[document.documentElement.lang]; return typeof cell === 'string' && cell.trim() && n.textContent.trim() !== cell.trim(); })
            .map(n => n.dataset.i18n), corpus);
        check(!lvDrift.length, 'directory instrument keyed leaves render lv (drift: ' + lvDrift.join(',') + ')');
        await lp.screenshot({ path: resolve(shots, 'buzz-directory-lv-instrument-390.png'), fullPage: true });
        // ---- travel: lv set on directory carries to profile (blang)
        await lp.goto(BASE + 'profile.html', { waitUntil: 'load' });
        await lp.locator('[data-reading-room]').waitFor();
        check((await lp.locator('#blangsel').inputValue()) === 'lv', 'language travels directory -> profile (blang=lv)');
        // ---- Hebrew RTL on profile
        await lp.locator('#breg-bee').click();
        await lp.locator('#blangsel').selectOption('he');
        await lp.waitForFunction(l => document.documentElement.lang === l, 'he');
        check((await lp.evaluate(() => document.documentElement.dir)) === 'rtl', 'profile Hebrew mirrors RTL (dir=rtl)');
        const pCalmKey = await lp.locator('#first-bee .calm').getAttribute('data-i18n');
        check((await lp.locator('#first-bee .calm').innerText()).trim() === corpus.strings[pCalmKey].he.trim(), 'profile rendered calm equals corpus he');
        await lp.screenshot({ path: resolve(shots, 'profile-he-bee-390.png'), fullPage: true });
        check(await overflow(lp), 'profile he bee fits 390 (RTL)');
        await lp.locator('#first-bee .primary').first().click();
        const pStory = '[data-i18n="prof.house.story"]';
        check((await lp.locator(pStory).first().innerText()).trim() === corpus.strings['prof.house.story'].he.trim(), 'profile rendered story sentence equals corpus he');
        await lp.screenshot({ path: resolve(shots, 'profile-he-bee-story-390.png'), fullPage: true });
        check(await overflow(lp), 'profile he story layer fits 390 (RTL)');
        await lp.locator('[data-room-overview]').click();
        await lp.locator('#breg-raver').click();
        check((await lp.locator('#blangsel').inputValue()) === 'he', 'profile language select retained across view toggle (he)');
        const pFeelKey = await lp.locator('#first-raver .feel').getAttribute('data-i18n');
        check((await lp.locator('#first-raver .feel').innerText()).trim() === corpus.strings[pFeelKey].he.trim(), 'profile raver feel equals corpus he');
        await lp.screenshot({ path: resolve(shots, 'profile-he-raver-390.png'), fullPage: true });
        await lp.locator('#breg-cypherpunk').click();
        const heDrift = await lp.locator('#instrument [data-i18n]').evaluateAll((nodes, rows) =>
          nodes.filter(n => !n.querySelector('[data-i18n]') && (n.innerText || '').trim())
            .filter(n => { const k = n.dataset.i18n; const cell = rows.strings[k]?.[document.documentElement.lang]; return typeof cell === 'string' && cell.trim() && n.textContent.trim() !== cell.trim(); })
            .map(n => n.dataset.i18n), corpus);
        check(!heDrift.length, 'profile instrument keyed leaves render he (drift: ' + heDrift.join(',') + ')');
        await lp.screenshot({ path: resolve(shots, 'profile-he-instrument-390.png'), fullPage: true });
        check(await overflow(lp), 'profile he instrument fits 390 (RTL)');
        check(!lerrors.length, 'language pass no script/console errors: ' + lerrors.join(' | '));
      } catch (e) {
        check(false, 'language walk threw: ' + e.message.split('\n')[0]);
      }
      await langContext.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const pass = results.filter(r => r[0]).length;
console.log(`\n==== LIVE PASS: ${pass}/${results.length} checks passed ====`);
const fails = results.filter(r => !r[0]);
if (fails.length) { console.log('FAILURES:'); for (const [, n] of fails) console.log('  - ' + n); }
console.log('\nNETWORK LOG (docs + failures only):'); for (const l of netLog) console.log('  ' + l);
console.log('SHOTS: ' + shots);
process.exit(fails.length ? 1 : 0);
