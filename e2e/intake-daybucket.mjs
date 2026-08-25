// ORDER zB · intake day-bucket must key on LOCAL date, never UTC.
//
// Founder live-fire: entries logged 00:40Z / 00:41Z carried "date"
// 2026-08-25 while the founder sat at ~18:40 local on 2026-08-24
// (America/Denver, MDT = UTC-6). Every entry after 18:00 local rolled
// into tomorrow's bnIntake_<date> key; bnr-dashboard aggregates those
// keys, so one local day split across two and the dashboard rendered a
// partial day with errors=0. Same silent class as the cross-origin bus
// severance — nothing throws.
//
// Clock is pinned and the context timezone forced to America/Denver, so
// 17:59 vs 18:01 local is exactly the UTC-date boundary (23:59Z vs
// 00:01Z). All four assertions would fail against the pre-fix
// toISOString().slice(0,10) derivation.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = process.env.FLEET_HOSTED
  || join(dirname(fileURLToPath(import.meta.url)), '..', 'surfaces', 'fleet-hosted');

const TYPES = { '.html': 'text/html' };
function serve() {
  const s = createServer(async (req, res) => {
    try {
      const body = await readFile(join(ROOT, req.url.split('?')[0]));
      res.writeHead(200, { 'Content-Type': TYPES[extname(req.url)] || 'text/html' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));
}

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`);
  cond ? pass++ : fail++;
};

const base = await serve();
const browser = await chromium.launch();

async function freshPage(timeIso, initScript) {
  const ctx = await browser.newContext({ timezoneId: 'America/Denver' });
  if (initScript) await ctx.addInitScript(initScript);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(timeIso) });
  return { ctx, page };
}

// The founder's exact live-fire moment: 18:01 local on 2026-08-24 Denver
// is 00:01Z on 2026-08-25 — the UTC date has already rolled over.
{
  const { ctx, page } = await freshPage('2026-08-24T18:01:00-06:00');
  await page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await page.evaluate(() => logEntry());
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_')));
  ok('18:01 local writes the LOCAL day key', keys.includes('bnIntake_2026-08-24'), keys.join(','));
  ok('no tomorrow-UTC key is written', !keys.includes('bnIntake_2026-08-25'));
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('bnIntake_2026-08-24')));
  ok('the entry is in the local-day bucket', entries.length === 1);

  // Dashboard, same origin + storage, same pinned clock: must read it back.
  const dash = await ctx.newPage();
  await dash.goto(`${base}/lab/bnr-dashboard.html`, { waitUntil: 'load' });
  const totalSessions = await dash.evaluate(() => document.getElementById('totalSessions').textContent);
  const totalMg = await dash.evaluate(() => document.getElementById('totalMg').textContent);
  ok('dashboard reads the local-day key', totalSessions === '1' && totalMg === String(entries[0].mg),
    `totalSessions=${totalSessions} totalMg=${totalMg} entryMg=${entries[0].mg}`);
  await ctx.close();
}

// The mutation the order demands: 17:59 and 18:01 local, same local day,
// must land in the SAME bucket. Pre-fix, 17:59 → key 08-24 and 18:01 →
// key 08-25 (UTC rollover); this is the assertion that kills the bug.
{
  const a = await freshPage('2026-08-24T17:59:00-06:00');
  await a.page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await a.page.evaluate(() => logEntry());
  const keyA = await a.page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_'))[0]);
  await a.ctx.close();

  const b = await freshPage('2026-08-24T18:01:00-06:00');
  await b.page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await b.page.evaluate(() => logEntry());
  const keyB = await b.page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_'))[0]);
  await b.ctx.close();

  ok('17:59 and 18:01 local land in the SAME bucket', keyA === keyB && keyA === 'bnIntake_2026-08-24',
    `${keyA} vs ${keyB}`);
}

// Migration: legacy UTC-derived keys must not orphan existing data. Seed
// the founder-shaped state — evening entries under TOMORROW's UTC key,
// morning entries under today's — and assert the tracker re-buckets every
// entry by its own timestamp's LOCAL date, once, in order.
{
  const { ctx, page } = await freshPage('2026-08-24T19:00:00-06:00', () => {
    localStorage.setItem('bnIntake_2026-08-24',
      JSON.stringify([{ method: 'edible', amount: 10, potency: 100, strain: 'morning', time: '09:00', hits: 1, mg: 10, timestamp: '2026-08-24T15:00:00.000Z' }]));
    localStorage.setItem('bnIntake_2026-08-25',
      JSON.stringify([{ method: 'edible', amount: 10, potency: 100, strain: 'founder-evening', time: '18:40', hits: 1, mg: 10, timestamp: '2026-08-25T00:40:00.000Z' }]));
  });
  await page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_')));
  ok('legacy UTC key is migrated away', !keys.includes('bnIntake_2026-08-25'), keys.join(','));
  const merged = await page.evaluate(() => JSON.parse(localStorage.getItem('bnIntake_2026-08-24')));
  ok('both entries live in the one local day', merged.length === 2);
  ok('merged chronologically', merged[0].strain === 'morning' && merged[1].strain === 'founder-evening');
  // Idempotence: reload must not duplicate or re-churn.
  await page.reload({ waitUntil: 'load' });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bnIntake_2026-08-24')));
  ok('migration is idempotent on reload', after.length === 2);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
