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

// Timestamp-less fallback: an entry with no timestamp has no clock of its
// own to re-bucket from, so it stays under its existing key — asserted,
// not assumed (ORDER: an unasserted fallback is an unrun check).
{
  const { ctx, page } = await freshPage('2026-08-24T19:00:00-06:00', () => {
    localStorage.setItem('bnIntake_2026-08-20',
      JSON.stringify([{ method: 'edible', amount: 10, potency: 100, strain: 'no-ts', time: '12:00', hits: 1, mg: 10 }]));
  });
  await page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  const kept = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('bnIntake_2026-08-20') || 'null'); }
    catch (e) { return 'threw'; }
  });
  ok('timestamp-less entry keeps its existing key, nothing crashes',
    Array.isArray(kept) && kept.length === 1 && kept[0].strain === 'no-ts');
  await ctx.close();
}

// The 04:00 day-start ruling: the behavioural day runs 04:00->04:00
// local, so 02:00 and 05:00 on the same calendar day are DIFFERENT
// behavioural days — 02:00 belongs to the previous one. And `time` is
// soft: a blank or sloppy user-entered time must not be able to break
// the key (the machine timestamp is the spine).
{
  const a = await freshPage('2026-08-24T02:00:00-06:00');
  await a.page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await a.page.evaluate(() => logEntry());
  const keyA = await a.page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_'))[0]);
  await a.ctx.close();

  const b = await freshPage('2026-08-24T05:00:00-06:00');
  await b.page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await b.page.evaluate(() => logEntry());
  const keyB = await b.page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_'))[0]);
  await b.ctx.close();

  ok('02:00 and 05:00 local land in DIFFERENT buckets',
    keyA !== keyB, `${keyA} vs ${keyB}`);
  ok('02:00 belongs to the PREVIOUS behavioural day', keyA === 'bnIntake_2026-08-23', keyA);
  ok('05:00 belongs to the current behavioural day', keyB === 'bnIntake_2026-08-24', keyB);

  // Soft `time`: blank and sloppy values save into the correct bucket and
  // break nothing.
  const c = await freshPage('2026-08-24T05:00:00-06:00');
  await c.page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await c.page.evaluate(() => { document.getElementById('time').value = ''; logEntry(); });
  await c.page.evaluate(() => { document.getElementById('time').value = 'sloppy'; logEntry(); });
  const sloppy = await c.page.evaluate(() => {
    try {
      const list = JSON.parse(localStorage.getItem('bnIntake_2026-08-24') || 'null');
      return { n: list ? list.length : -1, times: list ? list.map(e => e.time) : [] };
    } catch (e) { return { n: 'threw', times: [] }; }
  });
  ok('blank time still keys into the right bucket, nothing crashes',
    sloppy.n === 2, JSON.stringify(sloppy));
  // The input is type=time so the browser normalizes UI input — the truly
  // sloppy path is legacy/imported data. Inject it at the storage layer and
  // reload: the render must survive and the key must not move.
  await c.page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('bnIntake_2026-08-24'));
    list.push({ method: 'edible', amount: 10, potency: 100, strain: 'legacy', time: 'sloppy', hits: 1, mg: 10, timestamp: new Date().toISOString() });
    localStorage.setItem('bnIntake_2026-08-24', JSON.stringify(list));
  });
  await c.page.reload({ waitUntil: 'load' });
  const afterSloppy = await c.page.evaluate(() => ({
    n: JSON.parse(localStorage.getItem('bnIntake_2026-08-24')).length,
    rendered: document.getElementById('entries').textContent
  }));
  ok('a storage-injected sloppy time renders without breaking key or page',
    afterSloppy.n === 3 && afterSloppy.rendered === '3', JSON.stringify(afterSloppy));
  await c.ctx.close();
}

// The bnDayStart override: an unasserted config path is an unrun check.
// Offset 8 with the clock pinned at 05:00 local -> 05:00 minus 8h is
// 21:00 the PREVIOUS day, so the entry must land in 2026-08-23 (the
// default 4 would give 2026-08-24 — this only passes if the override
// actually reached the day-key code). And the export envelope must carry
// the bucket definition with the data: dayStart + IANA timezone, or two
// exporters under different offsets produce non-comparable day totals.
{
  const { ctx, page } = await freshPage('2026-08-24T05:00:00-06:00', () => {
    localStorage.setItem('bnDayStart', '8');
  });
  await page.goto(`${base}/lab/intake-tracker.html`, { waitUntil: 'load' });
  await page.evaluate(() => logEntry());
  const key = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('bnIntake_'))[0]);
  ok('bnDayStart=8 override shifts the bucket', key === 'bnIntake_2026-08-23', key);

  await page.evaluate(() => exportData());
  const env = await page.evaluate(() => {
    const t = document.getElementById('exportOut').textContent;
    return JSON.parse(t.slice(t.indexOf('{')));
  });
  ok('export records the effective dayStart', env.dayStart === 8, `dayStart=${env.dayStart}`);
  ok('export records the IANA timezone', env.timeZone === 'America/Denver', `timeZone=${env.timeZone}`);
  ok('export envelope still carries date/rdi/totalMg',
    env.date === '2026-08-23' && typeof env.rdi === 'number' && typeof env.totalMg === 'number',
    `date=${env.date} rdi=${env.rdi} totalMg=${env.totalMg}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
