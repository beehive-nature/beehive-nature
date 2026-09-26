// intake-tracker-eternal.test.mjs — the daily intake tracker (surfaces/fleet-hosted/lab/intake-tracker.html),
// the founder's instrument that writes bnIntake_<day> and bnRDI for the dashboard, with three products above it
// (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the tracker stays exactly as made,
// 0 lines removed; intake-daybucket, fleet-bus and fleet-pixels stay green). Proves at 390 px: one front per
// register in its own dress; the SAME day in all three, read from the tracker's own model and equal to what
// it renders, for a seeded browser and an empty one; honest gestures (every write goes through the tracker's
// own button or slider, "added" only when bnIntake_<day> really grew, a short hold writes nothing, a failed
// save is never called done); nothing leaves the origin; the tracker below still works; the laws.
// Run: node --test e2e/intake-tracker-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/intake-tracker.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9210, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// a browser that has used the tracker today: three entries (morning, afternoon, evening) and a target of 120.
// The clock is pinned (Denver, 19:00) so the behavioural day (04:00 start) is 2026-09-26.
const NOW = '2026-09-26T19:00:00-06:00', TODAY = '2026-09-26';
const SEED = [
  { method: 'flower', amount: 0.5, potency: 30, strain: 'lemon', time: '09:10', hits: 1, mg: 132, timestamp: '2026-09-26T15:10:00.000Z' },
  { method: 'vape', amount: 5, potency: 90, strain: '', time: '14:00', hits: 3, mg: 15, timestamp: '2026-09-26T20:00:00.000Z' },
  { method: 'edible', amount: 10, potency: 100, strain: 'honey', time: '18:30', hits: 1, mg: 10, timestamp: '2026-09-27T00:30:00.000Z' },
];
const WANT = { total: 157, entries: 3, pct: Math.round(157 / 120 * 100), avg: Math.round(157 / 3), morn: 132, aft: 15, eve: 10 };
async function open(reg, { seeded = true, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Denver' });
  await ctx.addInitScript(([r, S, day, seeded]) => {
    try {
      localStorage.setItem('bregister', r);
      if (seeded && !sessionStorage.getItem('seeded')) { localStorage.setItem('bnIntake_' + day, JSON.stringify(S)); localStorage.setItem('bnRDI', '120'); sessionStorage.setItem('seeded', '1'); }
    } catch {}
  }, [reg, SEED, TODAY, seeded]);
  if (init) await ctx.addInitScript(init);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.install({ time: new Date(NOW) });
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const bucket = p => p.evaluate(d => JSON.parse(localStorage.getItem('bnIntake_' + d) || '[]').length, TODAY);
const bus = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')).sort().map(k => [k, localStorage.getItem(k)])));
// the laws on the visible front: no dash or NaN for a value, no forced capitals, 44 px targets, nothing past 390 px
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + (el.id || el.className));
    const r = el.getBoundingClientRect();
    if (r.width && r.right > 390.5) out.push('past 390: ' + (el.id || el.tagName) + ' ' + Math.round(r.right));
    if (/^(BUTTON|A|SELECT|LABEL)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'checkbox')) { if (r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20))); }
    if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target');
  }
  return out;
});

test('one front per register in its own dress; the tracker keeps its own ground; the laws, seeded', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-holdbtn,.et-c-primary');
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(26, 26, 46)', reg + ': the tracker keeps its own ground (#1a1a2e)');
    if (reg === 'raver') await p.click('.et-r-lgb[data-band="aft"]');
    assert.deepEqual(await laws(p), [], reg + ' seeded');
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same day in all three: the tracker\'s own model, equal to what it renders', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        D: { today: D.today, total: D.total, count: D.count, pct: D.pct, avg: D.avg, band: D.band, rdi: D.rdi, agree: D.agree, page: D.page, want: D.want },
        bee: [...document.querySelectorAll('#etBeeTotals .et-b-row>small,#etBeeDay .et-b-row>small')].map(t), list: document.querySelectorAll('#etBeeList .et-b-row').length,
        raver: { big: t(document.getElementById('etOrbBig')), small: t(document.getElementById('etOrbSmall')), bands: [...document.querySelectorAll('#etOrb .et-band-g')].map(g => g.dataset.band).sort(), legend: [...document.querySelectorAll('.et-r-lgb')].map(t) },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 7).map(r => t(r.cells[1])), rows: document.querySelectorAll('#etcBucket tbody tr').length,
      };
    });
    await ctx.close();
  }
  const D = seen.bee.D;
  assert.equal(D.today, TODAY, 'the behavioural day, as the tracker counts it');
  assert.deepEqual(D.page, { total: '157', entries: '3', pct: WANT.pct + '%', avg: String(WANT.avg), morn: 'Morning 132mg', aft: 'Afternoon 15mg', eve: 'Evening 10mg', bar: '157mg / 120mg' }, 'the tracker rendered the seed');
  assert.equal(D.agree, true, 'the front recomputes the same');
  assert.deepEqual([D.total, D.count, D.pct, D.avg, D.rdi], [WANT.total, WANT.entries, WANT.pct, WANT.avg, 120]);
  assert.deepEqual(D.band, { morn: 132, aft: 15, eve: 10 });
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ' reads the same model');
  assert.deepEqual(seen.bee.bee, ['157 mg', '3', `${WANT.pct}% of 120 mg`, `${WANT.avg} mg`, '132 mg', '15 mg', '10 mg']); assert.equal(seen.bee.list, 3);
  assert.equal(seen.raver.raver.big, '157'); assert.match(seen.raver.raver.small, new RegExp(`${WANT.pct}% of 120`));
  assert.deepEqual(seen.raver.raver.bands, ['aft', 'eve', 'morn']); assert.deepEqual(seen.raver.raver.legend, ['morning · 132 mg', 'afternoon · 15 mg', 'evening · 10 mg']);
  assert.deepEqual(seen.cypherpunk.cy, ['157 · 157 ✓', '3 · 3 ✓', `${WANT.pct}% · ${WANT.pct}% ✓`, `${WANT.avg} · ${WANT.avg} ✓`, '132mg · 132mg ✓', '15mg · 15mg ✓', '10mg · 10mg ✓']);
  assert.equal(seen.cypherpunk.rows, 3);
});

test('an empty browser is shown as empty in every register, never as a sample; the laws, empty', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { seeded: false });
    const d = await p.evaluate(() => ({ D: window.__eternal.data, empty: document.getElementById('etBeeEmpty').hidden, bands: document.querySelectorAll('#etOrb .et-band-g').length, card: document.getElementById('etOrbCard').textContent, head: document.getElementById('etcBucketH').textContent }));
    assert.deepEqual([d.D.total, d.D.count, d.D.pct, d.D.avg, d.D.rdi, d.D.agree], [0, 0, 0, 0, 100, true]);
    if (reg === 'bee') assert.equal(d.empty, false, 'bee says nothing is logged today');
    if (reg === 'raver') { assert.equal(d.bands, 0); assert.match(d.card, /an empty orb, honestly/); }
    if (reg === 'cypherpunk') assert.match(d.head, /absent, read as \[\]/);
    assert.deepEqual(await laws(p), [], reg + ' empty');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('honest gestures: each register adds through the tracker\'s own button and says so only when the bucket grew', async () => {
  // new bee: choose edible, add; the tracker's own onMethodChange sets its amount
  let o = await open('bee');
  await o.p.click('#etBeeAdd');
  await o.p.click('#etBeeMethods [data-m="edible"]');
  assert.deepEqual(await o.p.evaluate(() => [document.getElementById('method').value, document.getElementById('amount').value]), ['edible', '10'], 'the front moved the tracker\'s own form');
  assert.equal(await o.p.textContent('#etBeePreview'), '10 mg');
  await o.p.click('#etBeeLog');
  assert.equal(await bucket(o.p), 4, 'bnIntake_<day> grew by one');
  assert.equal(await o.p.isVisible('#etBeeDone'), true); assert.match(await o.p.textContent('#etBeeSaid'), /10 mg of edible at 12:00/);
  assert.equal(await o.p.textContent('#entries'), '4', 'the tracker itself shows it');
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // raver: taps change nothing in storage; a short hold writes nothing; a full hold adds one vape entry
  o = await open('raver');
  const quiet = await bus(o.p);
  await o.p.click('#etOrbMethods [data-m="vape"]');
  await o.p.click('.et-r-lgb[data-band="morn"]');
  assert.equal(await bus(o.p), quiet, 'choosing and looking write nothing');
  await o.p.dispatchEvent('#etOrbHold', 'pointerdown'); await o.p.clock.runFor(500); await o.p.dispatchEvent('#etOrbHold', 'pointerup');
  await o.p.clock.runFor(1500);
  assert.equal(await bucket(o.p), 3, 'a short hold writes nothing');
  await o.p.dispatchEvent('#etOrbHold', 'pointerdown'); await o.p.clock.runFor(1600); await o.p.dispatchEvent('#etOrbHold', 'pointerup');
  assert.equal(await bucket(o.p), 4, 'a full hold adds one entry');
  assert.match(await o.p.textContent('#etOrbCard'), /added · 5 mg of vape cart/);
  assert.equal(await o.p.evaluate(() => document.querySelectorAll('#etOrb .et-band-g').length), 3);
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // cypherpunk: setRDI() moves the tracker's own slider; logEntry() appends and the receipt says so
  o = await open('cypherpunk');
  await o.p.fill('#etcRdi', '150'); await o.p.click('#etcRdiSet');
  assert.deepEqual(await o.p.evaluate(() => [localStorage.getItem('bnRDI'), document.getElementById('rdiSlider').value, document.getElementById('rdiDisplay').textContent]), ['150', '150', '150']);
  await o.p.click('#etcLog');
  assert.equal(await bucket(o.p), 4); assert.match(await o.p.textContent('#etcLogged'), /3 → 4 entries ✓ · \+132 mg/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
});

test('a save that fails is never called done', async () => {
  const { ctx, p } = await open('bee', { init: () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('bnIntake_')) throw new Error('quota'); return set.call(this, k, v); }; } });
  await p.click('#etBeeAdd'); await p.click('#etBeeLog');
  assert.equal(await p.isVisible('#etBeeDone'), false, 'no "added." screen');
  assert.match(await p.textContent('#etBeeAfter'), /not added: the tracker did not save it/);
  await ctx.close();
});

test('the tracker below is untouched: its own add, log and delete work and move the fronts', async () => {
  const { ctx, p, errs } = await open('bee');
  assert.equal(await p.evaluate(() => document.querySelector('body>#etArchive').nextElementSibling.className), 'hdr');
  await p.click('button.btn[onclick="logEntry()"]');
  assert.equal(await bucket(p), 4);
  assert.equal(await p.textContent('#etBeeTotals .et-b-row:nth-child(2) small'), '4', 'the front follows the tracker');
  await p.click('#logList .del >> nth=0');
  assert.equal(await bucket(p), 3); assert.equal(await p.textContent('#etBeeTotals .et-b-row:nth-child(2) small'), '3');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
