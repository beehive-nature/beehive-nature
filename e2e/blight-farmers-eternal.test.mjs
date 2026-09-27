// blight-farmers-eternal.test.mjs — the farmers market (stalls read from the founder's garden, priced in
// fUSD, opened with a bAccord handshake card) as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; three different products (bee: plain stall rows and one button; raver: a sunflower, one petal
// per ladder level, the five house rules lit before a hold; cypherpunk: the ledger, the price rule, the
// numbered pipeline, the receipt); the SAME facts in all three (the market's own COLS, FUSD, dealOf(),
// the stalls buildStalls() read, the house rules, the escrow state); the fronts ask the chain for nothing
// themselves; the stalls rest honestly when the chain does not answer (here) and open in all three when a
// stubbed chain answers; every handshake opens the page's own accord card; and NOTHING says paid or
// settled, because the page's own sign button still waits for the escrow. Plus the laws.
// Run: node --test e2e/blight-farmers-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/farmers.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/farmers.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9225, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// a stubbed Base: the garden holds FUNGI (seed 2,140,426) and PEPI v2 (seed 44); every getSvg answers a small svg
const W = v => BigInt(v).toString(16).padStart(64, '0');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#3f9c55"/></svg>';
const ABI = '0x' + W(0x20) + W(SVG.length) + Buffer.from(SVG).toString('hex').padEnd(Math.ceil(SVG.length / 32) * 64, '0');
const SEEDS = { '0x7d9ce55d54ff3feddb611fc63ff63ec01f26d15f': 2140426, '0x28a5e71bfc02723eac17e39c84c5190415c0de9f': 44 };
const answer = body => body.map(q => ({ jsonrpc: '2.0', id: q.id, result: /^0x70a08231/.test(q.params[0].data) ? '0x' + W(BigInt(SEEDS[q.params[0].to.toLowerCase()] || 0) * 1000000000n) : ABI }));
// the price rule, computed by the test itself from the page's stated dealOf(): lot = max(1, floor(seed × 0.4)), ask = max(1, round(lot × unit, 2))
const deal = (seed, unit) => { const lot = Math.max(1, Math.floor(seed * 0.4)); return { lot, ask: Math.max(1, Math.round(lot * unit * 100) / 100) }; };

async function open(reg, { chain = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const ext = [];
  await ctx.route('**/*', r => {
    const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue();
    ext.push(r.request().method() + ' ' + u);
    if (chain && r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(answer(JSON.parse(r.request().postData()))) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state !== 'reading', null, { timeout: 12000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, ext };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const NEVER = /\b(paid|settled)\b/i;
const facts = {};

test('per register: its own front and dress, a resting market said as resting, and the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, ext } = await open(reg);
    const d = await p.evaluate(f => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-fm-heart,.et-c-primary');
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
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily,
        action: getComputedStyle(act).backgroundColor,
        data: { state: D.state, cols: D.cols.map(c => [c.sym, c.unit, c.levels]), rules: D.rules, escrow: D.escrow, garden: D.garden },
        page: { cols: COLS.map(c => [c.sym, FUSD[c.sym]]), rules: [...document.querySelectorAll('#rules .r b')].length, wall: document.getElementById('wall').textContent, sign: document.getElementById('aSign').textContent },
        text: { bee: document.querySelector('#eternal>.et-b').textContent, raver: document.querySelector('#eternal>.et-r').textContent, cy: document.querySelector('#eternal>.et-c').textContent },
        counts: { beeHow: document.querySelectorAll('#etFmBeeHow .et-b-row').length, petals: document.querySelectorAll('#etFmFlower .et-petal path:not(.et-hit)').length, rules: document.querySelectorAll('#etFmRules .et-r-tile').length,
          ringArcs: document.querySelectorAll('#etFmFlower > path').length, rows: document.querySelectorAll('#etFmTab tr').length, pipe: document.querySelectorAll('#etFmPipe li').length },
        disabled: { bee: document.getElementById('etFmBeeGo').disabled, hold: document.getElementById('etFmHold').disabled, cy: document.getElementById('etFmCyGo').disabled } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face');
    assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    // the fronts ask for nothing themselves: every request off the origin is the page's own garden read
    assert.ok(ext.length > 0 && ext.every(u => /^POST https:\/\/(base-rpc\.publicnode\.com|base\.drpc\.org)\//.test(u)), reg + ': only the page\'s own chain read leaves the origin');
    assert.equal(d.data.state, 'resting'); assert.match(d.page.wall, /the stalls are resting/);
    assert.deepEqual(d.disabled, { bee: false, hold: false, cy: false }, reg + ': resting, every action asks the garden again');
    assert.match(d.text[reg === 'cypherpunk' ? 'cy' : reg], reg === 'bee' ? /ask the garden again/ : reg === 'raver' ? /to ask again/ : /re-read the garden · balanceOf × 4/);
    for (const t of Object.values(d.text)) assert.doesNotMatch(t, NEVER, reg + ': never paid or settled');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same facts: COLS, FUSD, the rules, the escrow, the resting stalls', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.deepEqual(a.data.cols.map(c => [c[0], c[1]]), a.page.cols, 'the market\'s own COLS and FUSD');
  assert.equal(a.data.rules.length, 5); assert.equal(a.page.rules, 5); assert.equal(a.data.rules[1], 'fUSD is the porch currency');
  assert.equal(a.data.escrow, 'not docked'); assert.match(a.page.sign, /when escrow docks/, 'read from the page\'s own sign button');
  assert.match(a.text.bee, /resting today/); assert.match(a.text.bee, /moves only once the escrow is built/);
  assert.match(a.text.raver, /the stalls are resting/); assert.match(a.text.raver, /0 of 4 stalls open/);
  assert.match(a.text.cy, /resting · 0 came back/); assert.match(a.text.cy, /fUSD · not docked · nothing moved/);
  const c = a.counts;
  assert.equal(c.beeHow, 4, 'new bee: plain rows');
  assert.equal(c.petals, a.data.cols.reduce((n, x) => n + x[2], 0), 'raver: one petal per ladder level'); assert.equal(c.rules, 5); assert.equal(c.ringArcs, 5);
  assert.equal(c.rows, 4); assert.equal(c.pipe, 6, 'cypherpunk: ledger, numbered pipeline');
});

test('resting: the bee button asks the garden again through the page\'s own buildStalls(), and it rests again honestly', async () => {
  const { ctx, p, errs, ext } = await open('bee');
  const n = ext.length;
  await p.click('#etFmBeeGo');
  await p.waitForFunction(() => window.__eternal.data.state === 'resting', null, { timeout: 8000 });
  assert.equal(ext.length, n * 2, 'the page\'s own read, once more: the same calls again');
  assert.match(await p.textContent('#wall'), /the stalls are resting/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('a stubbed chain opens the same stalls, at the same exact lot and ask, in all three', async () => {
  const want = { FUNGI: deal(2140426, 0.00041), 'PEPI v2': deal(44, 3.2) };
  assert.deepEqual(want.FUNGI, { lot: 856170, ask: 351.03 });
  const { ctx, p, errs } = await open('bee', { chain: true });
  const d = await p.evaluate(() => ({ stalls: window.__eternal.data.stalls.map(s => [s.sym, s.lot, s.fusd]),
    bee: document.getElementById('etFmBeeStalls').textContent, raver: document.getElementById('etFmPetals').textContent + document.getElementById('etFmCard').textContent,
    cy: document.getElementById('etFmTab').textContent, wall: [...document.querySelectorAll('#wall .price .p')].map(e => e.textContent) }));
  assert.deepEqual(d.stalls, [['FUNGI', want.FUNGI.lot, want.FUNGI.ask], ['PEPI v2', want['PEPI v2'].lot, want['PEPI v2'].ask]]);
  assert.deepEqual(d.wall, ['351.03 fUSD', '54.4 fUSD'], 'the page\'s own stall prices');
  assert.match(d.bee, /FUNGI\s*351\.03 fUSD · lot of 856,170/); assert.match(d.bee, /PEPI v2\s*54\.4 fUSD · lot of 17/);
  assert.match(d.raver, /FUNGI · 351\.03 fUSD/); assert.match(d.raver, /a lot of 856,170 FUNGI/);
  assert.match(d.cy, /FUNGI · 0\.00041 fUSD \/ unit.*lot 856,170 · ask 351\.03 fUSD/); assert.match(d.cy, /\$FROGGI.*no stall · no balance came back/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee: pick a stall, the button opens the page\'s own accord card; nothing says paid or settled', async () => {
  const { ctx, p, errs } = await open('bee', { chain: true });
  await p.click('#etFmBeeStalls [data-pick="1"]');
  assert.match(await p.textContent('#etFmBeeGo'), /PEPI v2/);
  await p.click('#etFmBeeGo'); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ open: document.getElementById('accord').classList.contains('open'), piece: document.getElementById('aPiece').textContent,
    ask: document.getElementById('aAsk').textContent, sign: document.getElementById('aSign').textContent, front: document.getElementById('eternal').textContent, rcpt: document.getElementById('etFmReceipt').textContent }));
  assert.equal(d.open, true, 'the page\'s own accord card'); assert.equal(d.piece, 'PEPI v2'); assert.match(d.ask, /54\.4 fUSD/);
  assert.match(d.sign, /when escrow docks/); assert.match(d.rcpt, /PEPI v2 · 54\.4 fUSD · viewing · from: you \(buyer opens\)/);
  assert.doesNotMatch(d.front, NEVER);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the hold waits for all five rules; a short hold does nothing; a full hold opens the card', async () => {
  const { ctx, p, errs } = await open('raver', { chain: true });
  for (const i of [0, 1, 2, 3]) await p.click(`#etFmRules [data-rule="${i}"]`);
  assert.equal(await p.$eval('#etFmHold', b => b.disabled), true, 'four of five: still waiting');
  assert.match(await p.textContent('#etFmHold'), /4 of 5/);
  await p.click('#etFmRules [data-rule="4"]');
  assert.equal(await p.$eval('#etFmHold', b => b.disabled), false);
  assert.equal(await p.$eval('#etFmHold', b => getComputedStyle(b).backgroundColor), 'rgb(214, 85, 187)', 'raver: the lit heart is the magenta action');
  await p.locator('#etFmHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etFmHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.getElementById('accord').classList.contains('open')), false, 'a short hold opens nothing');
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.getElementById('accord').classList.contains('open')), true);
  assert.equal(await p.textContent('#aPiece'), 'FUNGI');
  assert.match(await p.textContent('#etFmCard'), /the card is open below/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: pick a ledger row, the teal action opens the card for that stall', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { chain: true });
  await p.click('#etFmTab tr.et-pick[data-sym="PEPI v2"]');
  assert.match(await p.textContent('#etFmCyGo'), /PEPI v2 · 54\.4 fUSD/);
  await p.click('#etFmCyGo'); await p.waitForTimeout(200);
  assert.equal(await p.textContent('#aPiece'), 'PEPI v2');
  assert.match(await p.textContent('#etFmPipe'), /open · PEPI v2/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
