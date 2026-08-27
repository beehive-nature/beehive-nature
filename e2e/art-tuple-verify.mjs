/* art-tuple-verify.mjs — the tuple-ABI fix's verification (2026-08-27).
   The defect: chips showed but ART WALLS showed no FROGGI (60KB poison string
   at high seeds, dropped by the length guard) and no PEPI v1/v2 (inline form
   reverts outright). The fix: sel + 0x20 + (seed, extra) everywhere.
   Asserts the ART renders — wall piece labels, not chips — for the garden
   (FROGGI + both PEPIs), the purse (the egg), museum's live exhibits (which
   had been silently falling back), gallery, explorer, farmers, market, hearth. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8912';
const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const PURSE = '0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479';
const results = [];
const check = (name, ok, detail='') => { results.push({name, ok}); console.log((ok?'PASS':'FAIL')+'  '+name+(detail?'  — '+detail:'')); };

const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });

/* 1. profile — the garden wall must carry FROGGI + PEPI v1 + PEPI v2 ART */
try {
  await page.goto(BASE + '/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.click('#chip-founder');
  await page.waitForFunction(() => /rendered from chain|holds nothing/.test(document.getElementById('msg').textContent), null, { timeout:90000 });
  await page.waitForTimeout(1200);
  const wall = await page.textContent('#wall');
  const pieces = await page.evaluate(() => document.querySelectorAll('#wall .piece').length);
  check('profile garden wall: FROGGI art', /\$FROGGI/.test(wall));
  check('profile garden wall: PEPI v1 art', /PEPI v1/.test(wall));
  check('profile garden wall: PEPI v2 art', /PEPI v2/.test(wall));
  check('profile garden wall: piece count grew', pieces >= 6, pieces + ' pieces');
  await page.screenshot({ path:'e2e/shots-zb-visual/garden-tuple-profile.png' });
} catch (e) { check('profile garden wall (live)', false, String(e).slice(0,150)); }

/* 2. profile — the purse still renders her egg */
try {
  await page.goto(BASE + '/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.fill('#addr', PURSE);
  await page.click('#go');
  await page.waitForFunction(() => /rendered from chain|holds nothing/.test(document.getElementById('msg').textContent), null, { timeout:90000 });
  await page.waitForTimeout(1200);
  const wall = await page.textContent('#wall');
  check('profile purse wall: FROGGI egg, seed 52', /\$FROGGI/.test(wall) && /seed 52\b/.test(wall));
  await page.screenshot({ path:'e2e/shots-zb-visual/purse-tuple-profile.png' });
} catch (e) { check('profile purse wall (live)', false, String(e).slice(0,150)); }

/* 3. gallery — default wing still renders, now with the fixed calls */
try {
  await page.goto(BASE + '/surfaces/blight/gallery.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForFunction(() => Array.isArray(window.__garden) && window.__garden.length > 0, null, { timeout:90000 });
  const n = await page.evaluate(() => window.__garden.length);
  check('gallery default renders live pieces', n > 0, n + ' pieces');
} catch (e) { check('gallery default (live)', false, String(e).slice(0,150)); }

/* 4. explorer — the purse exhibit renders her wall */
try {
  await page.goto(BASE + '/surfaces/blight/inscription-explorer.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.click('button[data-a="' + PURSE + '"]');
  await page.waitForFunction(() => { const w = document.querySelector('#wall'); return w && w.children.length > 0; }, null, { timeout:90000 });
  const wall = await page.textContent('#wall');
  check('explorer purse wall: FROGGI + egg', /FROGGI/i.test(wall) && /\begg\b/i.test(wall));
} catch (e) { check('explorer purse wall (live)', false, String(e).slice(0,150)); }

/* 5. museum — the live exhibits render real SVGs, not the unreachable fallback */
try {
  await page.goto(BASE + '/surfaces/blight/museum.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForTimeout(9000); /* exhibits fetch on load */
  for (const [id, name] of [['pepiArt','PEPI art (Exhibit 2)'], ['froggiArt','FROGGI art (Exhibit 2)'], ['trapCtl','seed-trap control (Exhibit 7)']]) {
    const has = await page.evaluate(i => !!document.getElementById(i).querySelector('svg'), id);
    const fallback = await page.evaluate(i => /unreachable|failed/.test(document.getElementById(i).textContent), id);
    check('museum ' + name + ' renders SVG', has && !fallback, has ? (fallback ? 'fallback text present' : 'ok') : 'no svg');
  }
  const ex10 = await page.textContent('h2:nth-of-type(10)').catch(()=>'');
  await page.screenshot({ path:'e2e/shots-zb-visual/museum-tuple.png', fullPage:false });
} catch (e) { check('museum exhibits (live)', false, String(e).slice(0,150)); }

/* 6. farmers / market — load clean, stalls show art */
for (const surf of ['farmers', 'market']) {
  try {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0,80)));
    await page.goto(BASE + '/surfaces/blight/' + surf + '.html', { waitUntil:'domcontentloaded', timeout:30000 });
    await page.waitForTimeout(9000);
    const art = await page.evaluate(() => document.querySelectorAll('svg').length);
    check(surf + ' loads clean with rendered SVGs', errors.length === 0 && art > 0, errors.length ? errors[0] : art + ' svg nodes');
  } catch (e) { check(surf + ' (live)', false, String(e).slice(0,150)); }
}

/* 7. hearth — art rides a chat reply; drive the chat ("pepi" triggers the PEPI
   art route — the a435130b tuple call that used to revert) */
try {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,80)));
  await page.goto(BASE + '/surfaces/blight/hearth.html', { waitUntil:'domcontentloaded', timeout:30000 });
  const inp = page.locator('input, textarea').first();
  await inp.waitFor({ state:'visible', timeout:10000 });
  await inp.fill('show me a pepi');
  await inp.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('svg').length > 0, null, { timeout:60000 });
  const art = await page.evaluate(() => document.querySelectorAll('svg').length);
  check('hearth chat: PEPI art renders through the tuple call', errors.length === 0 && art > 0, errors.length ? errors[0] : art + ' svg nodes');
} catch (e) { check('hearth chat art (live)', false, String(e).slice(0,150)); }

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log('\n' + (failed ? failed + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASS'));
process.exit(failed ? 1 : 0);
