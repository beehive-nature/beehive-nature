// blight-profile-eternal.test.mjs — the bLighT holder profile (identity and art read straight from the chain,
// keyless; an address book kept on this device) as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; three different products (bee: plain rows and one button; raver: the hive of eight families
// around a cell you hold, each family's own ladder; cypherpunk: an addr> field, the numbered read path,
// the family table, the receipt); the SAME facts in all three (the page's own COLS and ladders, its five
// rails, its read state, its book's own list); NOTHING is read, signed or stored on arrival; every read
// goes through the page's own #addr + #go or its own founder's-garden example; an unanswered chain ends in
// an honest line in all three (it used to throw and hang on "scanning…"); a stubbed chain that answers
// "nothing held" is said as exactly that; the book is counted, never written; and the laws.
// Run: node --test e2e/blight-profile-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/profile.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/profile.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PORT = 9228, ORIGIN = `http://127.0.0.1:${PORT}`;
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

const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
// a stubbed Base that answers, and holds nothing for anyone: block 16, no transfers, every call empty
const empty = body => Array.isArray(body) ? body.map(q => ({ jsonrpc: '2.0', id: q.id, result: '0x' }))
  : { jsonrpc: '2.0', id: body.id, result: body.method === 'eth_blockNumber' ? '0x10' : body.method === 'eth_getLogs' ? [] : '0x' };

async function open(reg, { chain = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const ext = [];
  await ctx.route('**/*', r => {
    const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue();
    ext.push(r.request().method() + ' ' + u);
    if (chain && r.request().method() === 'POST' && /publicnode|drpc/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(empty(JSON.parse(r.request().postData()))) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.cols.length, null, { timeout: 8000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, ext };
}
const until = (p, st) => p.waitForFunction(s => window.__eternal.data.state === s, st, { timeout: 10000 });
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const facts = {};

test('per register: its own front and dress, nothing read or stored on arrival, and the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, ext } = await open(reg);
    if (reg === 'cypherpunk') await p.fill('#etHoAddr', GARDEN);   // the action lights once there is an address
    const d = await p.evaluate(f => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-ho-hold,.et-c-primary');
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
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        stored: Object.keys(localStorage).filter(k => k !== 'bregister' && !/^blang/.test(k)),
        data: { cols: D.cols.map(c => [c.sym, c.levels]), rails: D.rails, state: D.state, book: D.book, example: D.example },
        page: { cols: COLS.map(c => [c.sym, c.lv ? c.lv.length - 1 : null]), caps: document.querySelectorAll('#caps .cap').length },
        text: { bee: document.querySelector('#eternal>.et-b').textContent, raver: document.querySelector('#eternal>.et-r').textContent, cy: document.querySelector('#eternal>.et-c').textContent },
        counts: { beeRows: document.querySelectorAll('#etHoBeeRows .et-b-row').length, cells: document.querySelectorAll('#etHoComb .et-cell').length, rungs: document.querySelectorAll('#etHoLadder .et-ho-rung').length,
          rows: document.querySelectorAll('#etHoTab tr').length, pipe: document.querySelectorAll('#etHoPipe li').length } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(ext, [], reg + ': nothing read on arrival'); assert.deepEqual(d.stored, [], reg + ': nothing stored on arrival (the book is counted, never written)');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same facts: COLS and their ladders, the rails, the read state, the book', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.deepEqual(a.data.cols, a.page.cols, 'the families and ladders are the page\'s own COLS');
  assert.equal(a.data.rails.length, 5); assert.equal(a.page.caps, 5);
  assert.deepEqual(a.data.rails.map(r => r.tag), ['live', 'live', 'live · this page', 'live · resolver', 'coming soon']);
  assert.equal(a.data.state, 'idle'); assert.equal(a.data.book, 0); assert.match(a.data.example, /bloverai\.base\.eth/);
  assert.match(a.text.bee, /whose\s*no one yet/); assert.match(a.text.bee, /empty · this device only/);
  assert.match(facts.raver.text.raver, /8 families · not read yet/); assert.match(facts.raver.text.raver, /crown\s*2,100,000\+/, 'FUNGI\'s own ladder, crown at the top');
  assert.match(facts.cypherpunk.text.cy, /4 rails live · 1 coming soon/); assert.match(facts.cypherpunk.text.cy, /none · nothing read/);
  const c = a.counts;
  assert.equal(c.beeRows, 5, 'new bee: plain rows');
  assert.equal(c.cells, 8); assert.equal(c.rungs, 6, 'raver: eight cells, the chosen family\'s six rungs');
  assert.equal(c.rows, 8); assert.equal(c.pipe, 5, 'cypherpunk: the family table and the numbered read path');
});

test('bee: the button reads the page\'s own example; an unanswered chain ends honestly in all three', async () => {
  const { ctx, p, errs, ext } = await open('bee');
  await p.click('#etHoBeeGo');
  await until(p, 'failed'); await p.waitForTimeout(150);
  const d = await p.evaluate(() => ({ addr: document.getElementById('addr').value, msg: document.getElementById('msg').textContent,
    bee: document.getElementById('etHoBeeRows').textContent, raver: document.getElementById('etHoNote').textContent, cy: document.getElementById('etHoReceipt').textContent, pipe: document.getElementById('etHoPipe').textContent }));
  assert.equal(d.addr, GARDEN, 'the page\'s own founder\'s-garden example');
  assert.ok(ext.some(u => /publicnode|drpc/.test(u)), 'the page\'s own read was attempted');
  assert.match(d.msg, /^the chain did not answer from here/);
  assert.match(d.bee, /whose\s*0xfbd2…7876/); assert.match(d.bee, /the chain did not answer here/); assert.match(d.bee, /art they hold\s*not read yet/);
  assert.match(d.raver, /the chain did not answer here, so no cell lights up/); assert.match(d.cy, /state\s*failed/); assert.match(d.pipe, /the chain did not answer · nothing drawn/);
  assert.equal(errs.length, 0, 'no uncaught error when every host refuses: ' + errs.join(' | ')); await ctx.close();
});

test('raver, a chain that answers "nothing held": a short hold reads nothing, a full hold reads, and all three say so', async () => {
  const { ctx, p, errs, ext } = await open('raver', { chain: true });
  await p.locator('#etHoHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHoHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(150);
  assert.deepEqual(ext, [], 'a short hold reads nothing');
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up();
  await until(p, 'done'); await p.waitForTimeout(150);
  const d = await p.evaluate(() => ({ D: window.__eternal.data, bee: document.getElementById('etHoBeeRows').textContent, hint: document.getElementById('etHoHint').textContent,
    cy: document.getElementById('etHoReceipt').textContent, lit: document.querySelectorAll('#etHoComb .et-cell polygon[stroke-width="3"]').length }));
  assert.equal(d.D.short, '0xfbd2…7876'); assert.equal(d.D.pieces, 0); assert.equal(d.D.tokens, 0); assert.deepEqual(d.D.held, []);
  assert.match(d.D.msg, /^this address holds nothing readable/);
  assert.match(d.bee, /art they hold\s*none readable/); assert.match(d.bee, /families with a balance\s*0/);
  assert.match(d.hint, /8 families · 0 held/); assert.equal(d.lit, 1, 'only the tapped cell is rimmed: nothing lights as held');
  assert.match(d.cy, /held\s*no balances/); assert.match(d.cy, /wall\s*0 pieces/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: addr> writes through to the page\'s own #addr and #go; the book is counted from the page\'s own list', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { chain: true });
  const other = '0x' + '1'.repeat(40);
  await p.fill('#etHoAddr', other); await p.click('#etHoCyGo');
  await until(p, 'done');
  assert.equal(await p.$eval('#addr', e => e.value), other);
  assert.match(await p.textContent('#etHoReceipt'), new RegExp('address\\s*0x1111…1111\\s*' + other));
  // the page's own book form: one entry, and every register counts it
  await p.fill('#b-val', other); await p.click('#b-add'); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => window.__eternal.data.book), 1);
  assert.match(await p.textContent('#etHoBeeRows'), /your address book\s*1 entry · this device/);
  assert.match(await p.textContent('#etHoReceipt'), /book\s*1 entry · this device only · never sent/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
