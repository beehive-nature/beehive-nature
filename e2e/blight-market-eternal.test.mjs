// blight-market-eternal.test.mjs — the DeMarketPlace as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress; all three carry the SAME facts (the live inventory, the five laws from the
// page's own laws tab, the collections); with the chain unreachable nothing is offered and no price
// is guessed; when listings do arrive the fronts follow and "ask" opens the page's own preview room;
// nothing ever signs (settlement is said to be docked).
// Run: node --test e2e/blight-market-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/market.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/market.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8948, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // the chain is outside this box: every RPC and indexer is refused, so the exhibits must say so
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = []; p.rpc = 0;
    p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.laws.length && !window.__eternal.data.reading, null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: (() => { const was = act.disabled; act.disabled = false; const c = getComputedStyle(act).backgroundColor; act.disabled = was; return c; })(), shut: act.disabled, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

const LOT = () => { inventory = [{ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#86cc72"/></svg>', col: LevelTruth.COLLECTIONS[0], seed: 1000, whole: 400, lvln: 1, unitUsd: null, priceTs: Date.now() }]; renderWall(); };

test('three different products: rows, a star, a book', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etMkBeeRows .et-b-row').length, points: document.querySelectorAll('#etMkStar .et-law').length,
    pipe: document.querySelectorAll('#etMkPipe li').length, laws: document.querySelectorAll('#etMkLaws tr').length,
  }));
  assert.deepEqual(s, { rows: 3, points: 5, pipe: 6, laws: 5 });
  await ctx.close();
});

test('the same facts in all three: the laws, the listings, nothing guessed', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        laws: D.laws.map(l => l.n + '|' + l.title), tab: [...document.querySelectorAll('#laws .law .t')].map(t => t.textContent.trim()),
        listings: D.listings.length, inv: inventory.length, cols: D.cols,
        star: [...document.querySelectorAll('#etMkStar .et-law')].map(g => g.getAttribute('aria-label')),
        cy: [...document.querySelectorAll('#etMkLaws tr')].map(r => r.cells[0].textContent.replace('law ', '') + '|' + r.cells[1].textContent),
        chips: document.getElementById('etMkChips').textContent, book: document.getElementById('etMkBook').textContent,
        bee: document.getElementById('etMkBeeRows').textContent, ask: document.getElementById('etMkBeeAsk').disabled,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.equal(a.laws.length, 5); assert.deepEqual(a.laws.map(l => l.split('|')[1]), a.tab, 'the laws are the laws tab');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].laws, a.laws); assert.equal(facts[reg].listings, a.listings); }
  assert.deepEqual(facts.raver.star, a.laws.map(l => l.replace('|', ' · ')));
  assert.deepEqual(facts.cypherpunk.cy, a.laws);
  assert.equal(a.listings, a.inv); assert.equal(a.listings, 0, 'no chain here: nothing offered');
  assert.match(facts.cypherpunk.chips, /listings 0.*escrow not deployed/); assert.match(facts.cypherpunk.book, /no listing read/);
  assert.doesNotMatch(facts.cypherpunk.book + a.bee, /USDC/, 'no price is shown when none was read');
  assert.match(a.bee, /none read right now/); assert.equal(a.ask, true);
});

test('when a listing arrives all three follow; ask opens the page\'s own preview room, nothing signs', async () => {
  for (const [reg, sel] of [['bee', '#etMkBeeRows [data-ask="0"]'], ['raver', '#etMkStar .et-lot'], ['cypherpunk', '#etMkCyAsk']]) {
    const { ctx, p, errs } = await open(reg);
    await p.evaluate(LOT);
    await p.waitForFunction(() => window.__eternal.data.listings.length === 1);
    const d = await p.evaluate(() => window.__eternal.data.listings[0]);
    assert.deepEqual([d.sym, d.listing, d.usdc], ['FUNGI', 400, null]);
    if (reg === 'raver') await p.locator(sel).dispatchEvent('click'); else await p.click(sel);
    const r = await p.evaluate(() => ({ open: document.getElementById('room').classList.contains('open'), pre: document.getElementById('rpre').textContent }));
    assert.ok(r.open, reg + ': the preview room opened'); assert.match(r.pre, /before anyone signs/); assert.match(r.pre, /when settlement docks/);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: tap a point of the star to read its law', async () => {
  const { ctx, p } = await open('raver');
  await p.locator('#etMkStar .et-law[data-i="2"]').dispatchEvent('click');
  assert.equal(await p.getAttribute('#etMkStar .et-law[data-i="2"]', 'aria-pressed'), 'true');
  const l = await p.evaluate(() => window.__eternal.data.laws[2]);
  assert.ok((await p.textContent('#etMkRaverCard')).includes(l.title));
  await p.click('#etMkRaverWall');
  assert.equal(await p.evaluate(() => document.getElementById('tBrowse').classList.contains('on')), true);
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
