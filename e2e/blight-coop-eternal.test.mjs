// blight-coop-eternal.test.mjs — the Coop (hemp biomass downstream: the Core 10 criticality index) as three
// products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly
// one front per register, each in its own dress; three different products (bee: ten plain rows that open
// one at a time and one button; raver: the harvest wheel, ten spokes in rank order coloured by family, a
// family you light; cypherpunk: the index table, the stated ranking rule, the numbered pipeline, the
// receipt); the SAME facts in all three (the page's own CORE, its tier rule, its settlement words); the
// rank is CORE's declared order and no register claims a live recompute; every "ask for an offer" opens
// the page's own sheet for that stream; the offtake note is said copied only once the page's own button
// says so; nothing says paid or settled; and the laws (no dash, no caps, 44 px, no sideways page).
// Run: node --test e2e/blight-coop-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/coop.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/coop.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9226, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const ext = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); ext.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.streams.length, null, { timeout: 8000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, ext };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const NEVER = /\b(paid|settled|live recompute[sd]?)\b(?! here)/i;
const facts = {};

test('per register: its own front and dress, nothing sent, and the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, ext } = await open(reg);
    if (reg === 'bee') await p.click('#etCoBeeRows .et-b-row[data-i="0"]');
    if (reg === 'cypherpunk') await p.click('#etCoTab tr.et-pick[data-i="0"]');
    const d = await p.evaluate(f => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      if (document.documentElement.scrollWidth > 390 || innerWidth > 390) bad.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > 390.5) bad.push('edge ' + el.tagName + '.' + el.className + ' ' + Math.round(r.right));
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('junk ' + el.className + ' ' + own);
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      const D = window.__eternal.data;
      const spokes = [...document.querySelectorAll('#etCoWheel .et-spoke line')].map(l => Math.round(Math.hypot(+l.getAttribute('x2'), +l.getAttribute('y2'))));
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        data: { streams: D.streams.map(s => [s.rank, s.n, s.dept, !!s.gated]), rule: D.rule, settle: D.settle, escrow: D.escrow, depts: D.depts },
        core: CORE.map(s => [s.rank, s.n, s.dept, !!s.gated]),
        text: { bee: document.querySelector('#eternal>.et-b').textContent, raver: document.querySelector('#eternal>.et-r').textContent, cy: document.querySelector('#eternal>.et-c').textContent },
        counts: { beeRows: document.querySelectorAll('#etCoBeeRows .et-b-row').length, spokes, chips: document.querySelectorAll('#etCoDepts button').length,
          rows: document.querySelectorAll('#etCoTab tr.et-pick').length, pipe: document.querySelectorAll('#etCoPipe li').length } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(ext, [], reg + ': nothing leaves the origin');
    for (const t of Object.values(d.text)) assert.doesNotMatch(t, NEVER, reg + ': never paid, settled or live-ranked');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same facts: CORE in its declared order, the rule, the settlement words', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.deepEqual(a.data.streams, a.core, 'the data layer is the page\'s own CORE');
  assert.deepEqual(a.data.streams.map(s => s[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(a.data.depts, { cannabinoid: 5, food: 3, fiber: 2 });
  assert.equal(a.data.rule, 'market depth × offtake readiness × regulatory clarity × storage stability');
  assert.equal(a.data.settle, 'fUSD · community rail'); assert.equal(a.data.escrow, 'not docked');
  // the gated stream, in each register's words
  assert.match(a.text.bee, /THCa \/ legal-limit distillate\s*rules differ by state/);
  assert.match(facts.raver.text.raver, /gated · 1/); assert.match(facts.cypherpunk.text.cy, /#10 THCa \/ legal-limit distillate · GATED — state-by-state/);
  assert.match(facts.cypherpunk.text.cy, /no live recompute here/); assert.match(facts.cypherpunk.text.cy, /rank is CORE\[i\]\.rank, as declared/);
  const c = a.counts;
  assert.equal(c.beeRows, 10, 'new bee: ten plain rows');
  assert.equal(c.spokes.length, 10); assert.deepEqual(c.spokes, [...c.spokes].sort((x, y) => y - x), 'raver: the first-ranked spoke is the longest, in order');
  assert.equal(c.chips, 3, 'raver: three families to light');
  assert.equal(c.rows, 10); assert.equal(c.pipe, 5, 'cypherpunk: the index table and a numbered pipeline');
});

test('bee: a row opens in plain words; the button opens the page\'s own sheet for that stream', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etCoBeeRows .et-b-row[data-i="3"]');
  assert.match(await p.textContent('#etCoBeeRows .et-b-open'), /what it is · hulled seed, food-grade.*how it keeps · 12mo frozen \/ 6mo dry.*why it is number 4/);
  assert.match(await p.textContent('#etCoBeeGo'), /hemp hearts \(dehulled seed\)/);
  await p.click('#etCoBeeGo'); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.getElementById('detail').classList.contains('open')), true, 'the page\'s own sheet');
  assert.equal(await p.textContent('#sheet h3'), 'hemp hearts (dehulled seed)');
  assert.match(await p.textContent('#etCoReceipt'), /sheet\s*hemp hearts \(dehulled seed\)/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light a family, tap a spoke, the pill opens its sheet', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etCoDepts [data-dept="fiber"]');
  assert.equal(await p.evaluate(() => window.__eternal.data.streams[window.__eternal.raver.sel].rank), 8, 'the lit family takes the selection');
  assert.deepEqual(await p.$$eval('#etCoWheel .et-spoke', g => g.map(x => x.getAttribute('opacity'))), ['0.3', '0.3', '0.3', '0.3', '0.3', '0.3', '0.3', '1', '1', '0.3'], 'only fiber stands lit');
  await p.click('#etCoDepts [data-dept="fiber"]');
  await p.locator('#etCoWheel .et-spoke[data-i="9"]').click({ force: true });
  assert.match(await p.textContent('#etCoCard'), /THCa \/ legal-limit distillate/); assert.equal(await p.textContent('#etCoMidN'), '#10');
  await p.click('#etCoRaverGo'); await p.waitForTimeout(150);
  assert.equal(await p.textContent('#sheet h3'), 'THCa / legal-limit distillate');
  assert.match(await p.textContent('#etCoRaverGo'), /its sheet is open/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: a row opens its fields; the teal action opens the sheet; "copied" only after the page\'s own copy', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.click('#etCoTab tr.et-pick[data-i="2"]');
  assert.match(await p.textContent('#etCoTab tr.et-more'), /spec 70-90% CBG.*clarity hemp-compliant/);
  await p.click('#etCoCyGo'); await p.waitForTimeout(150);
  assert.equal(await p.textContent('#sheet h3'), 'CBG distillate');
  assert.match(await p.textContent('#etCoReceipt'), /offtake\s*not copied/);
  await p.click('#offtake');
  await p.waitForFunction(() => /copied/.test(document.getElementById('offtake').textContent), null, { timeout: 5000 });
  await p.waitForTimeout(150);
  assert.match(await p.textContent('#etCoReceipt'), /offtake\s*note copied · nothing sent/);
  assert.match(await p.evaluate(() => navigator.clipboard.readText()), /^COOP OFFTAKE REQUEST - CBG distillate \(rank #3\)/, 'the page\'s own note');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
