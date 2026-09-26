// bnr-dashboard-eternal.test.mjs — the BNR dashboard (surfaces/fleet-hosted/lab/bnr-dashboard.html), the
// founder's instrument that "reads what the other instruments write", with three products above it
// (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the dashboard, its chart and the
// localStorage bus keep working; fleet-bus and intake-daybucket stay green). Proves at 390 px: one front
// per register in its own dress; the SAME totals in all three, read from the SAME keys with the SAME
// arithmetic as loadData() and equal to what the dashboard itself renders, both for a seeded browser and
// an empty one (shown as empty, never as a sample); honest gestures (the one action opens the real write
// side; a bead opens its own entry; export hands over exactly what was read); no storage write, no
// request off the origin; the dashboard below is untouched; the laws.
// Run: node --test e2e/bnr-dashboard-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/bnr-dashboard.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9184, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// a browser that has used the lab: one flower-lab session, three intake entries today, an RDI of 120.
// The clock is pinned (Denver, 19:00) so "today" is known: the 04:00 day start makes it 2026-09-26.
const NOW = '2026-09-26T19:00:00-06:00', TODAY = '2026-09-26';
const SEED = {
  bnSessions: [{ blend: 'night garden', timestamp: '2026-09-25T20:00:00Z', thcaPercent: '18.5%', doseG: 0.3 }],
  intake: [{ method: 'edible', strain: 'honey', time: '09:10', mg: 10, timestamp: '2026-09-26T15:10:00Z' }, { method: 'vape', strain: '', time: '13:40', mg: 25, timestamp: '2026-09-26T19:40:00Z' }, { method: 'flower', strain: 'lemon', time: '18:05', mg: 40, timestamp: '2026-09-27T00:05:00Z' }],
  rdi: '120',
};
async function open(reg, seeded = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Denver', acceptDownloads: true });
  await ctx.addInitScript(([r, S, day, seeded]) => {
    try {
      localStorage.setItem('bregister', r);
      if (seeded && !sessionStorage.getItem('seeded')) { localStorage.setItem('bnSessions', JSON.stringify(S.bnSessions)); localStorage.setItem('bnIntake_' + day, JSON.stringify(S.intake)); localStorage.setItem('bnRDI', S.rdi); sessionStorage.setItem('seeded', '1'); }
    } catch {}
  }, [reg, SEED, TODAY, seeded]);
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
const bus = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')).sort().map(k => [k, localStorage.getItem(k)])));
// loadData()'s own arithmetic, done here from the seed
const sessMg = SEED.bnSessions.reduce((a, s) => a + s.doseG * parseFloat(s.thcaPercent) / 100 * 1000 * 0.877, 0);
const inMg = SEED.intake.reduce((a, e) => a + e.mg, 0);
const WANT = { sessions: '4', mg: String(Math.round(sessMg + inMg)), blends: '1', rdi: Math.round((sessMg + inMg) / 120 * 100) + '%' };

test('one front per register, each in its own dress; the dashboard keeps its own ground', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(26, 26, 46)', reg + ': the dashboard keeps its own ground (#1a1a2e)');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + `: no sideways page at 390 px (${d.wide}/${d.vw})`);
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same totals in all three: the same keys, the same arithmetic, equal to what the dashboard renders', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        today: D.today, total: D.total, page: D.page, agree: D.agree,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row small')].map(t), empty: document.getElementById('etBeeEmpty').hidden,
        raver: { big: t(document.getElementById('etDayBig')), small: t(document.getElementById('etDaySmall')), beads: document.querySelectorAll('#etDay .et-b-g').length, rim: !!document.querySelector('#etDay .et-rim-fill') },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 4).map(r => t(r.cells[1])),
      };
    });
    await ctx.close();
  }
  const b = seen.bee;
  assert.equal(b.today, TODAY, 'the behavioural day, as intake-tracker and the dashboard count it');
  assert.deepEqual(b.page, { sessions: WANT.sessions, mg: WANT.mg, blends: WANT.blends, rdiPct: WANT.rdi }, 'the dashboard rendered the seed');
  assert.deepEqual({ sessions: String(b.total.sessions), mg: String(b.total.mg), blends: String(b.total.blends), rdiPct: b.total.rdiPct }, b.page, 'the front recomputes the same');
  assert.equal(b.agree, true);
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].total, b.total, reg);
  assert.deepEqual(b.bee, [WANT.sessions, WANT.mg + ' mg', WANT.blends, WANT.rdi]); assert.equal(b.empty, true);
  assert.equal(seen.raver.raver.big, WANT.mg); assert.match(seen.raver.raver.small, new RegExp(WANT.rdi)); assert.equal(seen.raver.raver.beads, 3, 'a bead for each intake entry today'); assert.ok(seen.raver.raver.rim);
  assert.deepEqual(seen.cypherpunk.cy, [`${WANT.sessions} · ${WANT.sessions} ✓`, `${WANT.mg} · ${WANT.mg} ✓`, `${WANT.blends} · ${WANT.blends} ✓`, `${WANT.rdi} · ${WANT.rdi} ✓`]);
});

test('an empty browser is shown as empty in every register, never as a sample', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, false);
    const d = await p.evaluate(() => ({ total: window.__eternal.data.total, page: window.__eternal.data.page, empty: document.getElementById('etBeeEmpty').hidden, ring: !!document.querySelector('#etDay .et-face.et-empty'), beads: document.querySelectorAll('#etDay .et-b-g').length, card: document.getElementById('etDayCard').textContent, bus: document.getElementById('etcBus').textContent }));
    assert.deepEqual(d.page, { sessions: '0', mg: '0', blends: '0', rdiPct: '0%' });
    assert.deepEqual([d.total.sessions, d.total.mg, d.total.blends, d.total.rdiPct], [0, 0, 0, '0%']);
    if (reg === 'bee') assert.equal(d.empty, false, 'bee says nothing is logged yet');
    if (reg === 'raver') { assert.ok(d.ring); assert.equal(d.beads, 0); assert.match(d.card, /an empty ring, honestly/); }
    if (reg === 'cypherpunk') assert.match(d.bus, /absent · read as \[\].*absent · read as \[\].*absent · 100 by default.*absent · 4 by default/);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('honest gestures: the one action is the real write side; a bead opens its entry; nothing is written or sent', async () => {
  const { ctx, p, errs, outside } = await open('raver');
  const before = await bus(p);
  const hrefs = await p.evaluate(() => ['.et-b-primary', '.et-r-pill', '.et-c-primary'].map(s => document.querySelector('#eternal ' + s).getAttribute('href')));
  assert.deepEqual(hrefs, ['intake-tracker.html', 'intake-tracker.html', 'intake-tracker.html'], 'every register hands off to the same real instrument');
  await p.click('#etDay .et-b-g[data-b="2"]', { force: true });
  assert.match(await p.textContent('#etDayCard'), /flower · lemon.*40 mg at 18:05/);
  assert.equal(await bus(p), before, 'the front wrote nothing to the bus');
  assert.deepEqual(outside, []);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const c = await open('cypherpunk');
  const [dl] = await Promise.all([c.p.waitForEvent('download'), c.p.click('#etcExport')]);
  const body = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(body.day, TODAY); assert.equal(body.intake.length, 3); assert.equal(body.totals.mg, +WANT.mg); assert.match(body.note, /nothing was sent anywhere/);
  assert.deepEqual(c.outside, []); await c.ctx.close();
});

test('the dashboard below is untouched: its tabs, its chart and its own numbers', async () => {
  const { ctx, p, errs } = await open('bee');
  const d = await p.evaluate(() => ({ chart: !!(window.Chart && Chart.getChart('methodChart')), wiki: document.querySelectorAll('#wikiList .entry-row').length, modules: document.querySelectorAll('#moduleList .edu-module').length, rows: document.querySelectorAll('#dataList .entry-row').length, first: document.querySelector('body>#etArchive').nextElementSibling.className }));
  assert.deepEqual(d, { chart: true, wiki: 16, modules: 9, rows: 4, first: 'hdr' });
  await p.click('.tab:nth-child(2)');
  assert.equal(await p.$eval('#sec-library', e => getComputedStyle(e).display), 'block', 'its own tabs still switch');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    for (const seeded of [true, false]) {
      const { ctx, p } = await open(reg, seeded);
      if (reg === 'raver' && seeded) await p.click('#etDay .et-b-g[data-b="1"]', { force: true });
      const bad = await p.evaluate(() => {
        const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
        for (const el of fr.querySelectorAll('*')) {
          const cs = getComputedStyle(el); if (cs.display === 'none') continue;
          if (cs.textTransform !== 'none') out.push('caps ' + el.className);
          const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
          if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + el.className);
          const r = el.getBoundingClientRect();
          if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
          if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target');
        }
        return out;
      });
      assert.deepEqual(bad, [], reg + (seeded ? ' seeded' : ' empty'));
      await ctx.close();
    }
  }
});
