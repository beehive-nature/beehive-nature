// ORDER cc2-FLEET item 1 · M2 — PIXELS, on the real hosted surface.
//
// Three claims are NOT the same claim, and only the third is worth anything:
//   1. chart.js is reachable                    (a 200)
//   2. window.Chart is a function               (it parsed and loaded)
//   3. A CHART ACTUALLY DREW on this page       <- this file
//
// A vendored library can load perfectly and still render nothing: a broken
// relative path in a second asset, a canvas of zero height, a JS error after
// construction, a swap that moved the script past the code that calls it.
// Loading is not drawing. This reads the real canvas back, pixel by pixel,
// on surfaces/fleet-hosted/gallery/acid-cascade.html — the hosted copy, not
// a synthetic canvas and not the original.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.env.FLEET_HOSTED || 'C:/Users/travi/wt-cD/surfaces/fleet-hosted';
const TARGET = process.env.FLEET_TARGET || 'gallery/acid-cascade.html';
const CANVAS = process.env.FLEET_CANVAS || 'diseaseChart';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

let pass = 0, fail = 0;
const ok = (n, c, note = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${note ? ' — ' + note : ''}`); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => errors.push('requestfailed ' + r.url()));

await page.goto(`${base}/${TARGET}`, { waitUntil: 'load' });

// give the chart its animation, then require the canvas to actually settle
await page.waitForFunction((id) => {
  const c = document.getElementById(id);
  if (!c || !c.width || !c.height) return false;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;   // any opaque pixel
  return false;
}, CANVAS, { timeout: 20000 }).catch(() => {});

const px = await page.evaluate((id) => {
  const c = document.getElementById(id);
  if (!c) return null;
  const { width, height } = c;
  const d = c.getContext('2d').getImageData(0, 0, width, height).data;
  const colours = new Set();
  let painted = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;                       // fully transparent = never drawn
    painted++;
    colours.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
  }
  // CONTROL: an identical canvas that nothing ever drew on
  const ctl = document.createElement('canvas');
  ctl.width = width; ctl.height = height;
  const cd = ctl.getContext('2d').getImageData(0, 0, width, height).data;
  let ctlPainted = 0;
  for (let i = 3; i < cd.length; i += 4) if (cd[i] !== 0) ctlPainted++;
  return { width, height, total: width * height, painted, colours: colours.size, ctlPainted };
}, CANVAS);

if (!px) {
  ok(`canvas #${CANVAS} exists`, false, 'not found');
} else {
  console.log(`  canvas #${CANVAS} — ${px.width}x${px.height} = ${px.total} px`);
  ok('CONTROL: an undrawn canvas of the same size is empty', px.ctlPainted === 0, `${px.ctlPainted} painted`);
  ok('canvas has non-zero dimensions', px.width > 0 && px.height > 0, `${px.width}x${px.height}`);
  ok('PIXELS CHANGED — a chart actually drew', px.painted > 1000, `${px.painted} px painted (${(px.painted / px.total * 100).toFixed(1)}% of canvas)`);
  ok('DISTINCT COLOURS — it is a chart, not a fill', px.colours >= 5, `${px.colours} distinct colours`);
}
ok('no page errors or failed requests while drawing', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
