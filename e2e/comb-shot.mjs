// comb-shot.mjs — THE COMB lane receipt (2026-09-01).
// The lane's receipt definition: "the live comb at 390px with all three cell
// states visible." Visible is proven TWICE, because either proof alone can lie:
//   1. __combStats — the renderer's own per-frame census of exactly-drawn cells
//      (nectar/honey/capped counts among cells painted exactly this frame);
//   2. PIXELS — the composited canvas read back and bucketed by hue family,
//      so a renderer that claims states it never painted cannot pass.
// Serves the repo root over localhost http (riders resolve exactly as Pages
// serves them), 390px phone viewport + a 1280 desktop record shot.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-comb');
await mkdir(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[(rel.match(/\.[a-z0-9]+$/) || [])[0]] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
await page.goto(BASE + '/surfaces/comb.html', { waitUntil: 'load' });
await page.waitForTimeout(1400);   // the fill wave is live; let a frame land

/* 1 · the renderer's own census of exactly-drawn cells */
const stats = await page.evaluate(() => window.__combStats);
ok('the renderer reports stats', !!stats, JSON.stringify(stats));
ok('exact cells were drawn', stats.exact > 0, String(stats.exact));
ok('all three states among exact cells',
  stats.nectar > 0 && stats.honey > 0 && stats.capped > 0,
  `nectar ${stats.nectar} · honey ${stats.honey} · capped ${stats.capped}`);

/* 2 · the pixels themselves, bucketed by hue family */
const px = await page.evaluate(() => {
  const c = document.getElementById('comb');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const b = { nectar: 0, honey: 0, capped: 0 };
  for (let i = 0; i < d.length; i += 16) {   // every 4th pixel
    const R = d[i], G = d[i + 1], B = d[i + 2];
    if (R > 200 && G > 170 && B < 90 && R - B > 120) b.capped++;        // sealed gold
    else if (R > G && G > B && R > 110 && R - B > 60) b.honey++;         // amber family
    else if (B > G && G > R && B > 35) b.nectar++;                       // translucent cyan
  }
  return b;
});
ok('capped gold pixels on canvas', px.capped > 40, String(px.capped));
ok('honey amber pixels on canvas', px.honey > 40, String(px.honey));
ok('nectar translucent pixels on canvas', px.nectar > 40, String(px.nectar));

ok('zero page errors', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: join(OUT, 'comb-390.png'), fullPage: true });
console.log('shot → e2e/shots-comb/comb-390.png');

/* the desktop record shot — the frame rings read best wide */
const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const dpage = await dctx.newPage();
await dpage.goto(BASE + '/surfaces/comb.html', { waitUntil: 'load' });
await dpage.waitForTimeout(900);
await dpage.screenshot({ path: join(OUT, 'comb-1280.png') });
console.log('shot → e2e/shots-comb/comb-1280.png');

await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
