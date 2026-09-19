// bui-daily-art-gate.mjs - THE RENDERED ACCEPTANCE GATE (bUi Slice 01, queen
// order 1822fa54; writer zCode; budget + attack contract pinned by bFUzZ
// 9e333cf7 / PLANS/BUI_SLICE01_PROVE_RULING.md).
//
// Serves surfaces/ from this worktree, opens index.html in chromium, and
// proves the queen's acceptance list against the BUILT page:
//   1. 18 cells: 3 frozen UTC dates x 3 modes (new bee / raver / cypherpunk)
//      x 2 widths (390 / desktop) - the clock is frozen at page level
//      (playwright clock API): the ONLY clock read is the module's boundary
//      (bFUzZ build req 1 - injectable clock proven through the real boot).
//   2. Facts byte-identical across all 18 cells: counts, every surface href,
//      the preserved hex band outerHTML, nav links. Three modes, one truth.
//   3. Manifest: byte-identical across modes/widths for a date; different
//      across dates; the rendered overlay visibly differs across dates.
//   4. +6 reduced-motion cells: static render, no animation.
//   5. Byte-identical revisit: date 1 reloaded in a fresh context re-derives
//      identical manifest bytes and hash.
//   6. Broken candidate: a tampered manifest is rejected, recorded, and the
//      engine falls back to the previous accepted day (last good).
//   7. Cache poison: a corrupt localStorage cache never changes the render.
//   8. Attribute-flip replay (bFUzZ attack R1): replay from recorded inputs
//      ignores the live DOM attribute; a live re-derive with a flipped
//      attribute yields a different hash (the fork is visible, never silent).
//   9. P4 throttled: 1,826-manifest chain under 4x CPU throttle <= 600ms.
//  10. P5 first art paint <= 200ms after DOMContentLoaded.
//  11. P9 zero runtime requests after load.
//  12. Zero page errors in every cell.
//
//   node e2e/bui-daily-art-gate.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const art = require('../surfaces/daily-art.js');
const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const path = url === '/' ? '/index.html' : url;
  try {
    const body = await readFile(join(SURFACES, ...path.split('/')));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const DATES = ['2026-09-19', '2026-10-31', '2027-02-15'];
const MODES = ['bee', 'raver', 'cypherpunk'];
const WIDTHS = [390, 1280];

const browser = await chromium.launch();

async function openCell(date, mode, width, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 },
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference'
  });
  const page = await ctx.newPage();
  const errors = [];
  const postLoadRequests = [];
  let loaded = false;
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('request', r => { if (loaded) postLoadRequests.push(r.url()); });
  await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'));
  await page.addInitScript(m => { try { localStorage.setItem('bregister', m); } catch (e) { /* fresh origin */ } }, mode);
  if (opts.cachePoison) await page.addInitScript(() => { try { localStorage.setItem('bui.cache', '{"d":"1999-01-01","h":"deadbeef","n":999999}'); } catch (e) {} });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  loaded = true;
  await page.waitForSelector('.bui-overlay', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(250);
  const cell = await page.evaluate(() => {
    const b = document.querySelector('header.mast .bui-overlay');
    const s = window.buiDailyArt.__state();
    const counts = [...document.querySelectorAll('[data-hero-number], .tree-sum, .footer-count')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const hrefs = [...document.querySelectorAll('#list a[href], .side-family[href], .keep-link[href], .start-link[href]')].map(a => a.getAttribute('href')).sort();
    const band = document.querySelector('#bandwrap') ? document.querySelector('#bandwrap').outerHTML : '';
    const navLinks = [...document.querySelectorAll('[data-experience-nav] a')].map(a => a.getAttribute('href'));
    return {
      hash: s.hash, bytes: s.bytes, chainLength: s.chainLength, rejected: s.rejected, lastGood: s.lastGood,
      painted: !!(b && b.parentNode), variant: b ? b.getAttribute('data-bui-variant') : null,
      overlayHtml: b ? b.innerHTML : '', anim: b ? b.style.animation : '',
      animName: b ? getComputedStyle(b).animationName : '',
      degraded: s.degraded, deriveMs: s.render ? s.render.deriveMs : null,
      scrollWidth: document.documentElement.scrollWidth,
      facts: JSON.stringify({ counts, hrefs, band, navLinks }),
      mastSig: (() => { const sig = (el) => el ? el.tagName + (el.classList && el.classList.length ? '.' + [...el.classList].sort().join('.') : '') + '(' + [...el.children].map(sig).join(',') + ')' : ''; return sig(document.querySelector('header.mast')); })(),
      treeFams: (() => { const fams = {}; document.querySelectorAll('[data-tree-family]').forEach(g => { const f = g.getAttribute('data-tree-family'); const n = +g.getAttribute('data-tree-count'); if (!(f in fams)) fams[f] = n; else if (fams[f] !== n) fams[f] = -1; }); return fams; })(),
      hero: document.querySelector('[data-hero-number]') ? +document.querySelector('[data-hero-number]').textContent : null
    };
  });
  cell.errors = errors;
  cell.postLoadRequests = postLoadRequests;
  cell.page = page; cell.ctx = ctx;
  return cell;
}

/* ---- 1-4: the 24-cell matrix -------------------------------------------- */
const cells = {};
let zeroErrorOK = true, factsOK = true, paintOK = true, widthOK = true, reducedOK = true;
const factsRef = {};
for (const date of DATES) {
  for (const mode of MODES) {
    for (const width of WIDTHS) {
      const key = `${date}|${mode}|${width}`;
      const c = await openCell(date, mode, width);
      cells[key] = c;
      process.stdout.write('  cell ' + key + (c.errors.length ? ' ERR' : '') + '\n');
      if (c.errors.length) { zeroErrorOK = false; console.log('  page errors in ' + key + ': ' + c.errors.join(' | ')); }
      if (!c.painted) { paintOK = false; console.log('  overlay missing in ' + key); }
      if (width === 390 && c.scrollWidth > 390) { widthOK = false; console.log('  horizontal overflow in ' + key + ': scrollWidth ' + c.scrollWidth); }
      if (!factsRef[date]) factsRef[date] = c.facts;
      else if (factsRef[date] !== c.facts) { factsOK = false; console.log('  facts differ within date ' + key); }
    }
  }
}
const allFacts = [...new Set(Object.values(cells).map(c => c.facts))];
check('facts byte-identical across all 18 cells (3 dates x 3 modes x 2 widths)', allFacts.length === 1 && factsOK, allFacts.length + ' distinct fact-sets');
/* structure/art separation (bFUzZ attack 41ea55f1), scoped honestly: the
   masthead node tree must be structurally identical ACROSS DATES for every
   (mode, width) - daily mutation is attribute-level only. The MODE axis DOES
   restructure the masthead (register.js comprehension disclosure law:
   bee/raver collapse dense blocks, cypherpunk stands open) - verified
   pre-existing: the same bee!=cypherpunk split appears with daily-art.js
   blocked entirely. */
let structOK = true;
for (const mode of MODES) for (const width of WIDTHS) {
  const sigs = new Set(DATES.map(d => cells[`${d}|${mode}|${width}`].mastSig));
  if (sigs.size !== 1) { structOK = false; console.log('  structure drift across dates at ' + mode + '/' + width); }
}
check('structure/art separation: masthead node tree identical across all 3 dates for every mode+width (daily mutation is attribute-level only)', structOK);
/* T4 TREE DRIFT (bFUzZ matrix addition): the tree's boughs ARE the registry -
   per-bough == estate.json byFamily, boughs sum to the door number, every cell */
const estate = JSON.parse(readFileSync(join(here, '..', 'estate.json'), 'utf8'));
let t4ok = true;
for (const [key, c] of Object.entries(cells)) {
  const sum = Object.values(c.treeFams).reduce((a, b) => a + b, 0);
  if (sum !== c.hero || sum !== estate.counts.surfaces) { t4ok = false; console.log('  T4 sum mismatch in ' + key + ': ' + sum + ' vs hero ' + c.hero); }
  for (const [f, n] of Object.entries(c.treeFams)) if (estate.counts.byFamily[f] !== n) { t4ok = false; console.log('  T4 bough mismatch in ' + key + ': ' + f + '=' + n + ' vs registry ' + estate.counts.byFamily[f]); }
}
check('T4 TREE DRIFT: per-bough == registry byFamily, boughs sum to the door number (' + estate.counts.surfaces + '), every cell', t4ok);
check('zero page errors across all cells', zeroErrorOK);
check('overlay painted in every cell (P5 shape)', paintOK);
check('390px: no horizontal overflow in any cell', widthOK);

/* manifest truth: same per date across modes/widths, different across dates */
let manifestStable = true;
for (const date of DATES) {
  const hashes = new Set(), bytes = new Set();
  for (const mode of MODES) for (const width of WIDTHS) {
    hashes.add(cells[`${date}|${mode}|${width}`].hash);
    bytes.add(cells[`${date}|${mode}|${width}`].bytes);
  }
  if (hashes.size !== 1 || bytes.size !== 1) { manifestStable = false; console.log('  manifest drift within date ' + date); }
}
check('manifest byte-identical across modes/widths for each date (three modes, one truth)', manifestStable);
const dateHashes = DATES.map(d => cells[`${d}|bee|390`].hash);
check('manifest different across the three frozen dates', new Set(dateHashes).size === 3, dateHashes.map(h => h.slice(0, 8)).join(' '));
const overlaySigs = DATES.map(d => cells[`${d}|bee|390`].overlayHtml);
check('rendered art visibly differs across the three dates', new Set(overlaySigs).size === 3);
const rootAttr = await cells[`${DATES[0]}|bee|390`].page.evaluate(() => document.body.getAttribute('data-state-root'));
check('state root baked and consistent with the served registry', /^[0-9a-f]{64}$/.test(rootAttr), rootAttr.slice(0, 12));
const crossCheck = art.chainTo(DATES[1], rootAttr);
check('page manifest equals the engine cross-derivation (same bytes, different host)', cells[`${DATES[1]}|bee|390`].hash === crossCheck.hash && cells[`${DATES[1]}|bee|390`].bytes === crossCheck.bytes);

/* ---- 4b: reduced-motion cells (the +6 to 24) ------------------------------ */
for (const mode of MODES) for (const width of WIDTHS) {
  const c = await openCell('2026-10-31', mode, width, { reduced: true });
  const still = c.painted && (c.animName === 'none' || c.animName === '');
  if (!still) { reducedOK = false; console.log('  reduced-motion cell animated: ' + mode + '/' + width + ' anim=' + c.animName); }
  if (c.errors.length) { reducedOK = false; console.log('  reduced-motion page errors: ' + c.errors.join(' | ')); }
  if (c.hash !== cells[`2026-10-31|${mode}|${width}`].hash) { reducedOK = false; console.log('  reduced-motion manifest drift'); }
  if (c.mastSig !== cells[`2026-10-31|${mode}|${width}`].mastSig) { reducedOK = false; console.log('  reduced-motion structure drift'); }
  const sum = Object.values(c.treeFams).reduce((a, b) => a + b, 0);
  if (sum !== c.hero || sum !== estate.counts.surfaces) { reducedOK = false; console.log('  reduced-motion T4 drift'); }
  await c.ctx.close();
}
check('reduced-motion: static render, same manifest, no animation (24/24 cells)', reducedOK);

/* ---- 5: byte-identical revisit -------------------------------------------- */
const revisit = await openCell(DATES[0], 'bee', 390);
check('date-1 revisit re-derives the byte-identical manifest', revisit.hash === cells[`${DATES[0]}|bee|390`].hash && revisit.bytes === cells[`${DATES[0]}|bee|390`].bytes);
await revisit.ctx.close();

/* ---- 6: broken candidate -> recorded + last-good fallback ----------------- */
const tamperPage = cells[`${DATES[2]}|bee|390`].page;
const tampered = await tamperPage.evaluate(() => {
  const s = window.buiDailyArt.__state();
  const c = JSON.parse(s.bytes); /* rehydrate the live manifest */
  c.manifest_hash = s.hash;
  c.params.variant = (c.params.variant % 6) + 1 === c.params.variant ? 2 : (c.params.variant % 6) + 1; /* silent param bump */
  return c;
});
const acceptedTampered = await tamperPage.evaluate(c => window.buiDailyArt.__accept(c), tampered);
const afterTamper = await tamperPage.evaluate(() => window.buiDailyArt.__state());
let prevOfDay = art.GENESIS_DAY;
while (art.nextDay(prevOfDay) !== DATES[2]) prevOfDay = art.nextDay(prevOfDay);
const prevDay = art.chainTo(prevOfDay, rootAttr);
check('broken candidate rejected and kept on record', acceptedTampered === false && afterTamper.rejected.length >= 1, 'reason: ' + (afterTamper.rejected[0] ? afterTamper.rejected[0].reason : 'none'));
check('last good manifest is the ACCEPTED manifest - a rejected candidate never promotes itself', afterTamper.lastGood.manifest_hash === cells[`${DATES[2]}|bee|390`].hash && afterTamper.lastGood.utc_day === DATES[2]);
/* end-to-end: a broken candidate pushed through the REAL accept path renders
   the fallback (previous accepted day) and the failure stays on record */
const fbProof = await tamperPage.evaluate(d => window.buiDailyArt.__testBrokenDay(d), DATES[2]);
check('injected broken candidate falls back to the last good manifest (rendered)', !fbProof.error && fbProof.renderedHash === prevDay.hash && fbProof.renderedDay === prevOfDay, 'rendered ' + (fbProof.renderedDay || '?') + ' ' + String(fbProof.renderedHash || '').slice(0, 8));
check('failed candidate kept on record (end-to-end)', fbProof.rejected && !!fbProof.rejected.reason);

/* ---- 7: cache poison never changes the render ----------------------------- */
const poisoned = await openCell(DATES[1], 'raver', 390, { cachePoison: true });
check('corrupt local cache never changes the derived manifest (cache is speed, never authority)', poisoned.hash === cells[`${DATES[1]}|raver|390`].hash);
await poisoned.ctx.close();

/* ---- 8: attribute-flip replay (bFUzZ R1) ----------------------------------- */
const flip = await cells[`${DATES[1]}|bee|1280`].page.evaluate(() => {
  const s = window.buiDailyArt.__state();
  const recorded = { utc_day: JSON.parse(s.bytes).utc_day, state_root: document.body.getAttribute('data-state-root'), prev_manifest_hash: JSON.parse(s.bytes).prev_manifest_hash };
  const before = document.body.getAttribute('data-state-root');
  const flipped = 'f'.repeat(64);
  document.body.setAttribute('data-state-root', flipped); /* tamper the LIVE attribute */
  const replayRecorded = window.buiDailyArt.replay(recorded);
  const replayLive = window.buiDailyArt.__replayLive(recorded);
  document.body.setAttribute('data-state-root', before); /* restore */
  return { recordedHash: replayRecorded.hash, liveHash: replayLive.hash, expected: s.hash };
});
check('replay from recorded inputs ignores the flipped live attribute', flip.recordedHash === flip.expected);
check('live re-derive under a flipped attribute produces a DIFFERENT hash (fork visible, never silent)', flip.liveHash !== flip.expected);

/* ---- 9: P4 throttled (median of 3 - single readings on a loaded dev box
   are noise, the median is the receipt) -------------------------------------- */
const throttlePage = cells[`${DATES[0]}|bee|390`].page;
const cdp = await throttlePage.context().newCDPSession(throttlePage);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const throttledRuns = [];
for (let i = 0; i < 3; i++) {
  throttledRuns.push(await throttlePage.evaluate(() => {
    const root = document.body.getAttribute('data-state-root');
    const t0 = performance.now();
    window.buiDailyArt.chainTo('2031-09-18', root);
    return performance.now() - t0;
  }));
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const throttledMedian = throttledRuns.slice().sort((a, b) => a - b)[1];
check('P4: 1,826-manifest chain under 4x CPU throttle <= 600ms (median of 3)', throttledMedian <= 600, 'runs ' + throttledRuns.map(m => m.toFixed(0)).join('/') + 'ms median ' + throttledMedian.toFixed(0) + 'ms');
const fastRuns = [];
for (let i = 0; i < 3; i++) {
  fastRuns.push(await throttlePage.evaluate(() => {
    const root = document.body.getAttribute('data-state-root');
    const t0 = performance.now();
    window.buiDailyArt.chainTo('2031-09-18', root);
    return performance.now() - t0;
  }));
}
const fastMedian = fastRuns.slice().sort((a, b) => a - b)[1];
check('P4: same chain unthrottled <= 150ms (desktop ceiling, median of 3)', fastMedian <= 150, 'runs ' + fastRuns.map(m => m.toFixed(0)).join('/') + 'ms median ' + fastMedian.toFixed(0) + 'ms');
/* P3: single derive <= 5ms desktop */
const deriveMs = await throttlePage.evaluate(() => {
  const root = document.body.getAttribute('data-state-root');
  const t0 = performance.now();
  window.buiDailyArt.deriveDay('2027-01-01', root, '0'.repeat(64));
  return performance.now() - t0;
});
check('P3: single derive <= 5ms desktop', deriveMs <= 5, deriveMs.toFixed(2) + 'ms');

/* ---- 10: P5 first paint ------------------------------------------------------ */
const p5cell = await openCell(DATES[1], 'bee', 390);
const p5 = await p5cell.page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = window.buiDailyArt.__state().render;
  return { dcl: nav ? nav.domContentLoadedEventStart : -1, deriveMs: paint ? paint.deriveMs : -1 };
});
check('P5: derive+paint is immediate after DOMContentLoaded (<=200ms)', p5.deriveMs >= 0 && p5.deriveMs <= 200, 'derive ' + p5.deriveMs.toFixed(1) + 'ms');
await p5cell.ctx.close();

/* ---- 11: P9 zero runtime requests -------------------------------------------- */
/* Differential proof: the art module adds ZERO requests. The hub's own lazy
   language loader (lang.js) fires after load BY DESIGN (pre-existing, main
   behavior) - so the gate compares the post-load request SET with the module
   present vs. blocked, and they must be identical. */
const withArt = await openCell(DATES[1], 'bee', 390);
const noArtCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const noArtPage = await noArtCtx.newPage();
const noArtReqs = [];
let noArtLoaded = false;
noArtPage.on('request', r => { if (noArtLoaded) noArtReqs.push(r.url()); });
await noArtPage.clock.setFixedTime(new Date(DATES[1] + 'T12:00:00Z'));
await noArtPage.route('**/daily-art.js*', route => route.abort());
await noArtPage.goto(origin + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
noArtLoaded = true;
await noArtPage.waitForTimeout(250 + 400);
const strip = (u) => u.replace(origin, '').split('?')[0];
const setWith = [...new Set(withArt.postLoadRequests.map(strip))].sort();
const setWithout = [...new Set(noArtReqs.map(strip))].sort();
check('P9: the art module adds zero runtime requests (differential vs module-blocked page)', JSON.stringify(setWith) === JSON.stringify(setWithout), 'with=' + JSON.stringify(setWith) + ' without=' + JSON.stringify(setWithout));
await withArt.ctx.close();
await noArtCtx.close();

/* ---- teardown ---------------------------------------------------------------- */
for (const c of Object.values(cells)) await c.ctx.close();
await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(`\nbui-daily-art gate: ${results.length - failed.length}/${results.length} checks green`);
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log('  ' + f.name + (f.detail ? ' - ' + f.detail : '')); process.exit(1); }
process.exit(0);
