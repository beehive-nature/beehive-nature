// blight-compare-eternal.test.mjs — the bLighT catalog (the ERC-20i family, artist by artist) as three
// products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly
// one front per register, each in its own dress; three different products (bee: two plain pickers and a
// versus card; raver: every ladder as a ray you light; cypherpunk: the sourced table, the pair diff, the
// read pipeline); the SAME facts in all three (the catalog's own COLS, the pair, the live price read);
// every choice writes through to the catalog's own pickers (#a, #b) and redraws the real panes; a price
// is shown ONLY when the read returned one (blocked here: every front says so; a stubbed answer flips
// all three); and the laws (no dash for a value, no forced capitals, 44 px actions, no sideways page).
// Run: node --test e2e/blight-compare-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/compare.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/compare.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9145, ORIGIN = `http://127.0.0.1:${PORT}`;
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

async function open(reg, { price = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // the market is outside this box: the price read is refused, unless a test stubs its answer
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (price && u.startsWith('https://api.dexscreener.com/')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ pair: { priceUsd: price } }) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.cols.length && Object.values(window.__eternal.data.price).every(x => x.state !== 'wait'), null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const pane = p => p.evaluate(() => [...document.querySelectorAll('#split .pane h3')].map(h => h.textContent));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products: layout, graphic and gesture differ, not only colour', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    pickers: document.querySelectorAll('#etCmPick .et-b-row[data-side]').length,
    vs: document.querySelectorAll('#etCmVs .et-vs-l').length,
    rays: document.querySelectorAll('#etCmRays .et-ray').length, lit: document.querySelectorAll('#etCmRays .et-ray[aria-pressed="true"]').length,
    cyRows: document.querySelectorAll('#etCmRows tr.et-pick').length, cyDiff: document.querySelectorAll('#etCmDiff tr').length, cyPipe: document.querySelectorAll('#etCmPipe li').length,
  }));
  assert.equal(s.pickers, 2, 'new bee: two plain pickers'); assert.ok(s.vs >= 5, 'new bee: a plain versus card');
  assert.equal(s.rays, 10, 'raver: one ray per collection'); assert.equal(s.lit, 2, 'raver: two lit');
  assert.equal(s.cyRows, 10); assert.ok(s.cyDiff >= 8); assert.equal(s.cyPipe, 5, 'cypherpunk: table, diff, numbered pipeline');
  await ctx.close();
});

test('the same facts in all three: the catalog, the pair, the ladders, the price', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        cols: D.cols.map(C => [C.sym, C.supply, C.top, C.rungs, C.hasMeta]),
        src: COLS.map(c => [c.sym, c.supply, c.ladder ? c.ladder[c.ladder.length - 1] : null, c.ladder ? c.ladder.length : null, c.hasMeta]),
        pair: D.pair, sel: [+document.getElementById('a').value, +document.getElementById('b').value],
        price: D.price, panePrice: (document.getElementById('tp-FUNGI') || {}).textContent,
        vs: document.getElementById('etCmVs').textContent, pairCards: document.getElementById('etCmPair').textContent,
        diff: document.getElementById('etCmDiff').textContent, rows: [...document.querySelectorAll('#etCmRows tr.et-pick')].map(r => r.cells[1].firstChild.textContent + ' ' + r.cells[2].textContent),
        rayLabels: [...document.querySelectorAll('#etCmRays .et-ray')].map(g => g.getAttribute('aria-label')),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].cols, a.cols); assert.deepEqual(facts[reg].pair, a.pair); assert.deepEqual(facts[reg].price, a.price); }
  assert.deepEqual(a.cols, a.src, 'the data layer is the catalog\'s own COLS'); assert.equal(a.cols.length, 10);
  assert.deepEqual(a.pair, a.sel, 'the pair is the catalog\'s own pickers');
  // the pair as each register shows it
  assert.match(a.vs, /PEPI v2.*FUNGI/); assert.match(a.vs, /13,370/); assert.match(a.vs, /210,000,000/); assert.match(a.vs, /2,100,000 · 1\.0% of all/);
  assert.match(facts.raver.pairCards, /PEPI v2.*top rung 56 · 0\.42% of supply/); assert.match(facts.raver.pairCards, /FUNGI.*top rung 2,100,000 · 1\.0% of supply/);
  assert.match(facts.cypherpunk.diff, /13,370/); assert.match(facts.cypherpunk.diff, /L5 @ 2,100,000/);
  assert.match(facts.cypherpunk.rows[2], /FUNGI.*L5 @ 2,100,000.*1\.0% of supply/);
  assert.match(facts.raver.rayLabels[2], /FUNGI: 5 rungs, top 2,100,000 = 1\.0% of supply/);
  assert.match(facts.raver.rayLabels[5], /TRUFFI: ladder not measured/);
  // the price read is refused here, and every front says so rather than showing a number
  assert.equal(a.price.FUNGI.state, 'no'); assert.match(a.panePrice, /unreachable/);
  assert.match(a.vs, /it did not answer today/); assert.match(facts.raver.pairCards, /the price did not answer here/);
  assert.match(facts.cypherpunk.diff, /price.*no/);
});

test('honest price: shown only when the read returns one, and then in all three', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { price: '0.0005' });
    await p.waitForFunction(() => window.__eternal.data.price.FUNGI.state === 'ok', null, { timeout: 10000 });
    const d = await p.evaluate(() => ({ pane: document.getElementById('tp-FUNGI').textContent, vs: document.getElementById('etCmVs').textContent, raver: document.getElementById('etCmPair').textContent, cy: document.getElementById('etCmReceipt').textContent }));
    assert.equal(d.pane, '$1050.00 ($0.0005 each)', 'the pane\'s own read');
    assert.ok(d.vs.includes(d.pane) && d.raver.includes(d.pane) && d.cy.includes(d.pane), reg + ': the same price everywhere');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('every gesture writes through to the catalog\'s own pickers and redraws the real panes', async () => {
  { // bee: open the first picker, choose JEDI
    const { ctx, p } = await open('bee');
    await p.click('#etCmPick .et-b-row[data-side="a"]');
    await p.click('#etCmPick .et-b-row[data-pick="6"][data-for="a"]');
    assert.equal(await p.$eval('#a', s => s.value), '6'); assert.deepEqual(await pane(p), ['JEDI', 'FUNGI']);
    assert.match(await p.textContent('#etCmVs'), /JEDI.*FUNGI/);
    await ctx.close();
  }
  { // raver: light JELLI, then JEDI — each takes the side changed less recently
    const { ctx, p } = await open('raver');
    await p.click('#etCmLegend .et-r-chip[data-i="4"]');
    assert.deepEqual(await pane(p), ['JELLI', 'FUNGI']);
    await p.click('#etCmLegend .et-r-chip[data-i="6"]');
    assert.deepEqual(await pane(p), ['JELLI', 'JEDI']);
    assert.equal(await p.$$eval('#etCmRays .et-ray[aria-pressed="true"]', g => g.map(x => x.dataset.i).join(',')), '4,6');
    await p.click('#etCmSwap');
    assert.deepEqual(await pane(p), ['JEDI', 'JELLI'], 'swap is the catalog\'s own ⇄');
    await ctx.close();
  }
  { // cypherpunk: open a row, set it as b
    const { ctx, p } = await open('cypherpunk');
    await p.click('#etCmRows tr.et-pick[data-i="3"]');
    await p.click('#etCmRows [data-set="b"][data-i="3"]');
    assert.equal(await p.$eval('#b', s => s.value), '3'); assert.deepEqual(await pane(p), ['PEPI v2', '$FROGGI']);
    assert.match(await p.textContent('#etCmDiffH'), /a PEPI v2 × b \$FROGGI/);
    await ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etCmPick .et-b-row[data-side="a"]');
    if (reg === 'cypherpunk') await p.click('#etCmRows tr.et-pick[data-i="2"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('junk ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
