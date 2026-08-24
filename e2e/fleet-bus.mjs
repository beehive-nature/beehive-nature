// ORDER cc2-FLEET · the localStorage data bus, asserted rather than assumed.
//
// bnr-dashboard READS keys that flower-lab / intake-tracker / edible-tracker
// WRITE. localStorage is scoped per ORIGIN, so hosting the lab on a different
// origin from the dashboard severs the bus — and NOTHING ERRORS. The dashboard
// just renders zeros, which is indistinguishable from "no data yet".
//
// This test therefore proves BOTH directions:
//   POSITIVE — same origin: a session written in flower-lab is read by the
//              dashboard.
//   NEGATIVE — different origin, same files: the dashboard shows 0 and throws
//              nothing. Without this control the positive case would pass even
//              if the bus were incidental.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.env.FLEET_HOSTED
  || 'C:/Users/travi/wt-cD/surfaces/fleet-hosted';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json' };

function serve() {
  const s = createServer(async (req, res) => {
    try {
      const p = req.url.split('?')[0];
      const body = await readFile(join(ROOT, decodeURIComponent(p)));
      res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ s, base: `http://127.0.0.1:${s.address().port}` })));
}

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`);
  cond ? pass++ : fail++;
};

const A = await serve();          // origin A — the real placement
const B = await serve();          // origin B — the counterfactual
const browser = await chromium.launch();
const ctx = await browser.newContext();
const errors = [];
ctx.on('weberror', e => errors.push(e.error().message));

// ── write a session in flower-lab, on origin A ──────────────────────
const lab = await ctx.newPage();
await lab.goto(`${A.base}/lab/flower-lab.html`, { waitUntil: 'load' });
const before = await lab.evaluate(() => JSON.parse(localStorage.getItem('bnSessions') || '[]').length);
await lab.click('button.submit-btn');
const after = await lab.evaluate(() => JSON.parse(localStorage.getItem('bnSessions') || '[]').length);
ok('flower-lab writes a session to bnSessions', after === before + 1, `${before} -> ${after}`);

// ── POSITIVE: same origin, dashboard reads it ──────────────────────
const dashA = await ctx.newPage();
await dashA.goto(`${A.base}/lab/bnr-dashboard.html`, { waitUntil: 'load' });
const seenA = await dashA.evaluate(() => JSON.parse(localStorage.getItem('bnSessions') || '[]').length);
const shownA = (await dashA.locator('#totalSessions').innerText()).trim();
ok('SAME ORIGIN — dashboard sees the session in storage', seenA >= 1, `bnSessions=${seenA}`);
ok('SAME ORIGIN — dashboard RENDERS it', parseInt(shownA, 10) >= 1, `#totalSessions="${shownA}"`);

// ── NEGATIVE: different origin, identical files ────────────────────
const dashB = await ctx.newPage();
await dashB.goto(`${B.base}/lab/bnr-dashboard.html`, { waitUntil: 'load' });
const seenB = await dashB.evaluate(() => JSON.parse(localStorage.getItem('bnSessions') || '[]').length);
const shownB = (await dashB.locator('#totalSessions').innerText()).trim();
ok('CROSS ORIGIN — the bus is severed', seenB === 0, `bnSessions=${seenB}`);
ok('CROSS ORIGIN — and it fails SILENTLY (this is the hazard)',
   parseInt(shownB, 10) === 0 && errors.length === 0,
   `#totalSessions="${shownB}" errors=${errors.length}`);

// ── the vendor swap is load-bearing, not cosmetic ──────────────────
const reqs = [];
const chartPage = await ctx.newPage();
chartPage.on('request', r => reqs.push(r.url()));
await chartPage.goto(`${A.base}/gallery/acid-cascade.html`, { waitUntil: 'load' });
ok('hosted surface makes ZERO off-origin requests',
   reqs.every(u => u.startsWith(A.base)),
   reqs.filter(u => !u.startsWith(A.base)).join(',') || 'all same-origin');
ok('Chart.js actually loaded from vendor/',
   await chartPage.evaluate(() => typeof window.Chart === 'function'),
   'window.Chart is a function');

await browser.close(); A.s.close(); B.s.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
