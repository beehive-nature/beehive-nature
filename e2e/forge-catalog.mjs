// forge-catalog.mjs — the catalog's load-bearing property.
//
// THE CLAIM: the whole artwork is ONE renderer hash + N parameter tuples, and
// adding a piece is adding a tuple, NOTHING ELSE. That is only true if every
// visible thing — the frames, the parameter chips, the seed-links, and the hero
// count — is derived from one array. This asserts that, and asserts the art
// actually DRAWS rather than merely loading.
//
// A NOTE ON THRESHOLDS, earned: the first version of this file asserted
// "svg nodes > 10" and failed against a correct page. A 7-ring rose is exactly
// SEVEN paths. An arbitrary threshold is not an assertion about the subject —
// so every count here is derived from the tuple itself (paths === rings), which
// cannot drift out of agreement with the art.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.env.SURFACES || 'C:/Users/travi/wt-cD/surfaces';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.md':'text/plain', '.json':'application/json' };
const srv = createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const body = await readFile(join(ROOT, p));
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(body);
  } catch { r.writeHead(404); r.end('nf'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

let pass = 0, fail = 0;
const ok = (n, c, note = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${note ? ' — ' + note : ''}`); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`${base}/museum.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);   // let each embedded renderer draw

// the tuples the page was built from, read back out of the page itself
const PIECES = await page.evaluate(() => (typeof PIECES !== 'undefined' ? PIECES : null));
ok('the page exposes its tuple array', Array.isArray(PIECES) && PIECES.length > 0,
   PIECES ? `${PIECES.length} tuple(s)` : 'not found');

const dom = await page.evaluate(() => ({
  frames: [...document.querySelectorAll('iframe.frame')].map(f => f.getAttribute('src')),
  hero: document.getElementById('n-pieces')?.textContent,
  tuples: [...document.querySelectorAll('.tuple')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
  links: [...document.querySelectorAll('.seedlink a')].map(a => a.getAttribute('href')),
}));

ok('one frame per tuple', dom.frames.length === PIECES.length, `${dom.frames.length} frames / ${PIECES.length} tuples`);
ok('one parameter chip-set per tuple', dom.tuples.length === PIECES.length, `${dom.tuples.length}`);
ok('one seed-link per tuple', dom.links.length === PIECES.length, `${dom.links.length}`);
ok('hero count is DERIVED, not typed', dom.hero === String(PIECES.length), `hero="${dom.hero}"`);

// every frame must carry EXACTLY its tuple, in the renderer's own link format
const KEYS = ['seed', 'k', 'rings', 'twist', 'hueBase'];
let mismatched = 0;
PIECES.forEach((p, i) => {
  const want = 'forge/orbit.html?' + KEYS.map(k => `${k}=${encodeURIComponent(p[k])}`).join('&');
  if (dom.frames[i] !== want || dom.links[i] !== want) mismatched++;
});
ok('every frame + seed-link carries exactly its tuple', mismatched === 0, `${mismatched} mismatched`);

// ── the art must DRAW, not merely load ─────────────────────────────
const orbitFrames = page.frames().filter(f => f.url().includes('orbit.html'));
ok('every frame is the frozen renderer', orbitFrames.length === PIECES.length,
   `${orbitFrames.length}/${PIECES.length}`);

let drew = 0, metaOk = 0, bare = 0, filled = 0;
for (let i = 0; i < orbitFrames.length; i++) {
  const want = PIECES[i];
  try {
    const d = await orbitFrames[i].evaluate(() => ({
      paths: document.querySelectorAll('svg path').length,
      meta: document.getElementById('meta')?.textContent || '',
      seed: document.getElementById('seed')?.value,
      // getClientRects().length === 0 rather than offsetParent: a position:fixed
      // badge has a null offsetParent while still being perfectly visible.
      chrome: [...document.querySelectorAll('body > *:not(.wrap), .wrap > *:not(#stage)')]
                .filter(e => e.getClientRects().length > 0).length,
      stageH: document.getElementById('stage')?.getBoundingClientRect().height || 0,
    }));
    // paths === rings: derived from the tuple, never a magic threshold
    if (d.paths === want.rings) drew++;
    else console.log(`     piece ${i}: ${d.paths} paths, tuple says rings=${want.rings}`);
    if (d.meta.includes(`"${want.seed}"`) && d.meta.includes(`${want.rings} rings`)) metaOk++;
    if (d.chrome === 0) bare++;
    else console.log(`     piece ${i}: ${d.chrome} workshop element(s) still visible in the frame`);
    if (d.stageH > 200) filled++;
    else console.log(`     piece ${i}: stage is only ${Math.round(d.stageH)}px tall`);
  } catch (e) { console.log(`     piece ${i}: frame eval failed — ${e.message.slice(0, 60)}`); }
}
ok('each piece drew exactly `rings` paths (derived from its tuple)', drew === PIECES.length, `${drew}/${PIECES.length}`);
ok('each renderer reports the tuple back in its own meta line', metaOk === PIECES.length, `${metaOk}/${PIECES.length}`);

ok('the workshop is hidden in every frame — the art, not the controls', bare === PIECES.length, `${bare}/${PIECES.length} bare`);
ok('the art fills its frame (not cropped to a strip)', filled === PIECES.length, `${filled}/${PIECES.length}`);

// ── C0 CONTROL: the same probe, on a page that MUST fail it ────────
// The two assertions above are only meaningful if the probe can SEE chrome when
// chrome is there. Opening a seed-link directly is that control — and it is not
// a synthetic fixture, it is a claim the catalog makes in its own lede: "open
// any seed-link and the workshop is right there." If this control ever reports
// zero, the two greens above are the probe agreeing with itself, not evidence.
const ctl = await ctx.newPage();
await ctl.goto(`${base}/${dom.frames[0]}`, { waitUntil: 'load' });
await ctl.waitForTimeout(1200);
const ctlChrome = await ctl.evaluate(() =>
  [...document.querySelectorAll('body > *:not(.wrap), .wrap > *:not(#stage)')]
    .filter(e => e.getClientRects().length > 0).length);
ok('CONTROL — the seed-link opened bare still shows the full workshop', ctlChrome > 0,
   `${ctlChrome} control element(s) visible; 0 here would mean the probe is blind`);
await ctl.close();

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
