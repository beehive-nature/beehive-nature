/* hexart-check.mjs — the hexart surface battery (2026-09-16).
   Proves the honeycomb-native generative-art contract: hex default +
   polygon variants, deterministic regeneration (same seed → same cells),
   recipe round-trip (save → load → identical), manual edits ride the recipe,
   transparent export, image→cells conversion, zero outbound requests,
   390px containment, zero page errors. Serves hexart.html over a static
   server (estate rails only — every host must be ours). */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = process.cwd();
const server = createServer((req, res) => {
  try {
    const file = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) throw Error('path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); cond ? pass++ : fail++; };

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const hosts = new Set();
  page.on('request', r => hosts.add(new URL(r.url()).host));

  await page.goto(`${base}/surfaces/hexart.html`, { waitUntil: 'networkidle' });

  // H1: hex default + the estate fingerprint claim
  ok('surface loads with zero page errors', errs.length === 0, errs.slice(0, 2).join('|'));
  const pressed = await page.getAttribute('[data-topo="hex-pointy"]', 'aria-pressed');
  ok('hex-pointy is the DEFAULT medium', pressed === 'true');
  const cellCount1 = await page.evaluate(() => document.querySelectorAll('#cv')[0] && window.__hexart ? window.__hexart.cells.filter(v => v >= 0).length : -1);

  // H2: determinism — same seed twice → identical cell arrays
  const run = () => page.evaluate(() => {
    const s = window.__hexart;
    return { seed: s.seed, cells: s.cells.join(','), topo: s.topology, palette: s.palette.join(',') };
  });
  await page.click('#go'); const a = await run();
  await page.evaluate(() => { location.hash = ''; }); // no-op keep context
  await page.click('#go'); const b = await run();
  ok('determinism: regenerate with same seed → identical cells', a.cells === b.cells && a.seed === b.seed);
  await page.fill('#prompt', 'amber light through wax');
  await page.click('#go'); const c = await run();
  ok('prompt bends the field (different cells than unprompted)', c.cells !== a.cells);
  await page.fill('#prompt', ''); await page.click('#go'); const d = await run();
  ok('empty prompt returns to the seed field', d.cells === a.cells);

  // H3: recipe round-trip via the page's own recipe() + regeneration
  const recipe = await page.evaluate(() => JSON.stringify(window.__hexart.recipe()));
  const roundTrip = await page.evaluate(async (recJson) => {
    const rec = JSON.parse(recJson);
    const H = window.__hexart;
    H.topology = rec.topology; H.cols = rec.cols; H.rows = rec.rows; H.seed = rec.seed;
    H.palette = rec.palette.slice(); H.threshold = rec.threshold; H.detail = rec.detail; H.dither = rec.dither;
    H.edits = rec.edits || {};
    const cells = window.HexArtEngines[rec.engine].generate(rec, null);
    for (const k in H.edits) { const [cc, rr] = k.split(',').map(Number); cells[rr * rec.cols + cc] = H.edits[k]; }
    return cells.join(',');
  }, recipe);
  ok('recipe round-trip: saved recipe regrows identical cells', roundTrip === a.cells);

  // H3b: hand edits ride the recipe
  const edited = await page.evaluate(() => {
    const H = window.__hexart;
    H.cells[5 * H.cols + 5] = 2; H.edits['5,5'] = 2;
    const r = H.recipe();
    return { edits: JSON.stringify(r.edits) };
  });
  ok('manual edit recorded in the recipe overlay', edited.edits.includes('"5,5":2'), edited.edits);

  // H4: topology variants render without errors
  for (const topo of ['hex-flat', 'tri', 'square']) {
    await page.click(`[data-topo="${topo}"]`);
    const n = await page.evaluate(() => window.__hexart.cells.filter(v => v >= 0).length);
    ok(`topology ${topo} regenerates cells (${n})`, n > 0);
    const errsNow = errs.length;
    ok(`topology ${topo} zero page errors`, errsNow === 0);
  }
  await page.click('[data-topo="hex-pointy"]');

  // H5: transparent cells exist at threshold > 0
  const transparent = await page.evaluate(() => window.__hexart.cells.filter(v => v < 0).length);
  ok(`open (transparent) cells present (${transparent})`, transparent > 0);

  // H6: PNG export via canvas (alpha honored)
  const png = await page.evaluate(() => new Promise(res => {
    const cv = document.getElementById('cv');
    cv.toBlob(b => res(b ? b.size : 0), 'image/png');
  }));
  ok('PNG export produces a blob', png > 1000, png + ' B');

  // H7: image→cells engine on a drawn fixture (no file input needed)
  const conv = await page.evaluate(() => {
    const H = window.__hexart;
    const off = document.createElement('canvas'); off.width = 64; off.height = 48;
    const o = off.getContext('2d');
    const g = o.createLinearGradient(0, 0, 64, 48);
    g.addColorStop(0, '#e8b54b'); g.addColorStop(1, '#0d1410');
    o.fillStyle = g; o.fillRect(0, 0, 64, 48);
    const rec = H.recipe();
    const src = { data: o.getImageData(0, 0, 64, 48).data, w: 64, h: 48 };
    const cells = window.HexArtEngines['image-conv'].generate(rec, src);
    const filled = cells.filter(v => v >= 0).length;
    return { filled, total: cells.length };
  });
  ok(`image→cells conversion fills the grid (${conv.filled}/${conv.total})`, conv.filled > conv.total * 0.5);

  // H8: palette from image (deterministic farthest-point)
  const palN = await page.evaluate(() => window.__hexart.palette.length);
  ok(`palette active (${palN} dyes)`, palN >= 3 && palN <= 8);

  // H9: zero outbound — estate rails only
  const external = [...hosts].filter(h => h !== new URL(base).host);
  ok('zero outbound requests (estate rails only)', external.length === 0, external.join(',') || 'same-origin only');

  // H10: 390px containment
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok('390px: no horizontal overflow', sw <= 391, 'scrollWidth=' + sw);

  // H11: area-average conversion — a bright thin line survives (center-tap killed it)
  const line = await page.evaluate(() => {
    const H = window.__hexart;
    const off = document.createElement('canvas'); off.width = 96; off.height = 72;
    const o = off.getContext('2d');
    o.fillStyle = '#0a0a0a'; o.fillRect(0, 0, 96, 72);
    o.fillStyle = '#ffe082'; o.fillRect(0, 34, 96, 2);   // 2px horizontal line — sub-cell-width
    const rec = H.recipe();
    const src = { data: o.getImageData(0, 0, 96, 72).data, w: 96, h: 72 };
    const cells = window.HexArtEngines['image-conv'].generate(rec, src);
    // count bright palette matches in the middle band
    const mid = cells.slice(Math.floor(rec.rows * .44) * rec.cols, Math.ceil(rec.rows * .56) * rec.cols);
    const palBright = H.palette.map((p, i) => [p, i]).filter(([p]) => { const n = parseInt(p.slice(1), 16); return ((n >> 16) & 255) > 180; }).map(([, i]) => i);
    return mid.filter(v => palBright.includes(v)).length;
  });
  ok('area-average conversion: thin bright feature survives (' + line + ' cells)', line > 0);

  // H12: shelf round-trip — shelve, wipe, restore → identical cells
  const shelved = await page.evaluate(async () => {
    const H = window.__hexart, S = window.__hexartShelf;
    H.cells[4 * H.cols + 3] = 1; H.edits['3,4'] = 1;      // a hand edit (key is col,row — the battery had it transposed)
    S.save();
    const before = H.cells.join(',');
    H.cells = H.cells.map(() => -1); H.edits = {};         // wipe
    const list = S.list();
    if (!list.length) return { ok: false, why: 'empty shelf' };
    await S.load(list[0].digest);
    return { ok: H.cells.join(',') === before, edits: Object.keys(H.edits).length };
  });
  ok('shelf round-trip: restore regrows identical cells + edits', shelved.ok, JSON.stringify(shelved));

  // H13: image-recipe embed — after a real image-conv run, recipe() carries source+digest
  const embed = await page.evaluate(() => {
    const H = window.__hexart;
    // run image-conv through the page's own path (sets imgData)
    const off = document.createElement('canvas'); off.width = 64; off.height = 48;
    const o = off.getContext('2d'); const g = o.createLinearGradient(0, 0, 64, 48);
    g.addColorStop(0, '#e8b54b'); g.addColorStop(1, '#18362a');
    o.fillStyle = g; o.fillRect(0, 0, 64, 48);
    const im = document.createElement('canvas'); im.width = 64; im.height = 48;
    const ic = im.getContext('2d'); ic.drawImage(off, 0, 0);
    H.imgCanvas = im; H.imgSrc = true; H.imgData = null; H.engine = 'image-conv';
    const rec = { ...H.recipe(), cols: H.cols, rows: H.rows, topology: H.topology, palette: H.palette.slice(), threshold: H.threshold, detail: H.detail, dither: H.dither, seed: H.seed };
    H.imgDataFor(rec);   // cache the source through the page's own path (what regen does)
    H.cells = window.HexArtEngines['image-conv'].generate(rec, H.imgData);
    H.cells[10 * H.cols + 10] = 2; H.edits['10,10'] = 2;
    const full = H.recipe();       // now imgData is cached → embedded
    return { has: !!(full.image && full.image.data && full.image.digest), digest: full.image ? full.image.digest : null, engine: full.engine };
  });
  ok('image-recipe carries embedded source + digest after a real conversion', embed.has && !!embed.digest, JSON.stringify(embed));

  ok('battery total: zero page errors across everything', errs.length === 0, errs.slice(0, 2).join('|'));
} finally {
  await browser?.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
