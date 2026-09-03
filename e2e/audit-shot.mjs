// audit-shot.mjs — THE VERIFIER build receipt (z3.2, 2026-09-03).
// The order's receipt definition: "the live panel at 390px showing all four
// states." Proven TWICE, because either alone can lie:
//   1. __spendAuditStats — the auditor's own census of the record it rendered
//      (all four verifier states present among the receipts on screen);
//   2. the DOM itself — every state's comb chip counted AND its computed fill
//      read back, so the four states are proven as PAINT, including the
//      FAILED chip at exactly the --flag/--cat-bug hue rgb(192,127,28),
//      never a new red.
// Shots: the wallet receipts panel and the comb verifier lane at 390px.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-comb');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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

/* the expected paints: tokens.css hues the chips must resolve to */
const EXPECT = {
  PASSED: 'rgb(255, 215, 0)',          // --gold
  PENDING_ANCHOR: 'rgb(255, 179, 71)', // --amber
  FAILED: 'rgb(192, 127, 28)',         // --flag/--cat-bug #c07f1c — never a new red
  INCONCLUSIVE: 'rgb(0, 229, 255)'     // --cyan (translucent nectar)
};

async function prove(page, sectionSel, label) {
  const stats = await page.evaluate(() => window.__spendAuditStats);
  ok(label + ': the auditor reports its census', !!stats, JSON.stringify(stats && stats.byState));
  ok(label + ': all four states in the record',
    stats && stats.byState && ['PASSED', 'PENDING_ANCHOR', 'FAILED', 'INCONCLUSIVE'].every(s => stats.byState[s] > 0),
    stats ? Object.entries(stats.byState).map(([k, v]) => k + ' ' + v).join(' · ') : 'no stats');

  const chips = await page.evaluate(sel => {
    const out = [];
    document.querySelectorAll(sel + ' svg[aria-label]').forEach(sv => {
      const poly = sv.querySelector('polygon');
      if (!poly) return;
      const cs = getComputedStyle(poly);
      const m = (sv.getAttribute('aria-label') || '').match(/^([A-Z_]+)/);
      out.push({ state: m ? m[1] : '?', fill: cs.fill, op: cs.fillOpacity });
    });
    return out;
  }, sectionSel);
  const byPaint = {};
  chips.forEach(c => { byPaint[c.state] = byPaint[c.state] || new Set(); byPaint[c.state].add(c.fill + '@' + c.op); });
  for (const [state, fill] of Object.entries(EXPECT)) {
    const n = chips.filter(c => c.state.startsWith(state)).length;
    ok(label + ': ' + state + ' chips painted (' + n + ')', n > 0, [...(byPaint[state] || [])].join(' | '));
    ok(label + ': ' + state + ' paint is exactly ' + fill,
      chips.some(c => c.state.startsWith(state) && c.fill === fill),
      [...(byPaint[state] || [])].join(' | ') || 'none');
  }
}

/* 1 · the wallet receipts panel at 390px */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  await page.goto(BASE + '/surfaces/wallet.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__spendAuditStats, null, { timeout: 15000 });
  await page.locator('#receipts-sec').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await prove(page, '#receipts-sec', 'wallet');
  ok('wallet: zero page errors', errors.length === 0, errors.join(' | '));
  await page.locator('#receipts-sec').screenshot({ path: join(OUT, 'wallet-receipts-390.png') });
  console.log('shot → e2e/shots-comb/wallet-receipts-390.png');
  await ctx.close();
}

/* 2 · the comb verifier lane at 390px (the same engine, the same record) */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  await page.goto(BASE + '/surfaces/comb.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__spendAuditStats, null, { timeout: 15000 });
  await page.locator('#verifierSec').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await prove(page, '#verifierSec', 'comb');
  ok('comb: zero page errors', errors.length === 0, errors.join(' | '));
  await page.locator('#verifierSec').screenshot({ path: join(OUT, 'comb-verifier-390.png') });
  console.log('shot → e2e/shots-comb/comb-verifier-390.png');
  await ctx.close();
}

await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
