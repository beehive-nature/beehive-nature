// ORDER cc2-FLEET · M2 — PIXELS, on EVERY chart-bearing hosted surface.
//
// Three claims are NOT the same claim, and only the third is worth anything:
//   1. chart.js is reachable                    (a 200)
//   2. window.Chart is a function               (it parsed and loaded)
//   3. A CHART ACTUALLY DREW                    <- this file
//
// A vendored library can load perfectly and still render nothing: a broken
// relative path, a canvas of zero height, a JS error after construction, a
// swap that moved the script past the code that calls it. Loading is not
// drawing.
//
// COVERAGE IS THE POINT. An earlier version of this file proved ONE of seven
// chart-bearing copies and read as if it had proved the set — and the one it
// skipped included resonance.html, the surface named as the silent-failure
// risk. Both the target list and the canvas list are now DISCOVERED at run
// time, never hardcoded, so an eighth chart-bearing surface or a fourth canvas
// on an existing one is covered the moment it lands rather than the moment
// someone remembers to add it.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Resolve from THIS FILE, never a private absolute path (see fleet-bus.mjs).
const ROOT = process.env.FLEET_HOSTED
  || join(dirname(fileURLToPath(import.meta.url)), '..', 'surfaces', 'fleet-hosted');
// The twins carry the estate riders as ../../tour.js etc.; serving only
// fleet-hosted/ turns every rider into a 404 and fails "no page errors" for a
// path problem the DEPLOYED site does not have. Serve the parent so relative
// rider paths resolve exactly as they do on Pages.
const SERVE = dirname(dirname(ROOT));
const MIN_PAINTED = 500;      // a real plot paints thousands; a stray border does not
const MIN_COLOURS = 4;        // axis + grid + at least one series
const EXPECT_MIN_TARGETS = 7; // an existence floor: a broken scan must FAIL, never pass empty

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const body = await readFile(join(SERVE, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

let pass = 0, fail = 0;
const ok = (n, c, note = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${note ? ' — ' + note : ''}`); c ? pass++ : fail++; };

// ── DISCOVER the chart-bearing surfaces (never a hardcoded list) ────
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const all = await walk(ROOT);
const targets = [];
for (const f of all) {
  if ((await readFile(f, 'utf8')).includes('vendor/chart.js')) {
    targets.push(relative(ROOT, f).split('\\').join('/'));
  }
}
targets.sort();
console.log(`  discovered ${targets.length} chart-bearing surfaces: ${targets.join(', ')}\n`);
ok(`at least ${EXPECT_MIN_TARGETS} chart-bearing surfaces discovered (a broken scan must fail, not pass empty)`,
   targets.length >= EXPECT_MIN_TARGETS, `${targets.length} found`);

const browser = await chromium.launch();
let totalCanvases = 0, unpainted = 0;

for (const t of targets) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('requestfailed', r => errs.push('requestfailed ' + r.url()));
  await page.goto(`${base}/surfaces/fleet-hosted/${t}`, { waitUntil: 'load' });

  // wait until EVERY canvas on the page has at least one opaque pixel
  await page.waitForFunction(() => {
    const cs = [...document.querySelectorAll('canvas')];
    if (!cs.length) return true;
    return cs.every(c => {
      if (!c.width || !c.height) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });
  }, null, { timeout: 20000 }).catch(() => {});

  const shots = await page.evaluate(() => {
    const read = c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const colours = new Set(); let painted = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        painted++; colours.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
      }
      return { id: c.id || '(no id)', w: c.width, h: c.height, painted, colours: colours.size };
    };
    // CONTROL: an identical, never-drawn canvas must read empty
    const first = document.querySelector('canvas');
    let control = null;
    if (first) {
      const ctl = document.createElement('canvas');
      ctl.width = first.width; ctl.height = first.height;
      const cd = ctl.getContext('2d').getImageData(0, 0, ctl.width, ctl.height).data;
      let p = 0; for (let i = 3; i < cd.length; i += 4) if (cd[i] !== 0) p++;
      control = p;
    }
    return { canvases: [...document.querySelectorAll('canvas')].map(read), control };
  });

  console.log(`  ${t}`);
  if (shots.control !== null) {
    ok(`  control: an undrawn canvas of the same size is empty`, shots.control === 0, `${shots.control} painted`);
  }
  for (const c of shots.canvases) {
    totalCanvases++;
    const drew = c.painted >= MIN_PAINTED && c.colours >= MIN_COLOURS;
    if (!drew) unpainted++;
    ok(`  #${c.id} drew`, drew, `${c.w}x${c.h} · ${c.painted} px painted · ${c.colours} colours`);
  }
  ok(`  no page errors on ${t}`, errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');
  await ctx.close();
}

console.log('');
ok(`every canvas on every chart-bearing surface drew`, unpainted === 0,
   `${totalCanvases} canvases, ${unpainted} unpainted`);

await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
