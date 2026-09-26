// blight-bnri-gallery-eternal.test.mjs — BNRi, the fleet's own art, as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; three different products (bee: one picture and seven plain rows; raver: a
// honeycomb you tap and hold; cypherpunk: the files table, the decode pipeline and the bytes); the SAME
// facts in all three and on the wall below (the manifest and the seven .hex files, decoded by the
// page's own decoder); honest failure (a manifest that does not arrive is said by every front, and
// nothing is drawn from a copy); the hold builds the picture from its records and pauses on release;
// and the laws (no dash for a value, no forced capitals, 44 px actions, no sideways page).
// Run: node --test e2e/blight-bnri-gallery-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/bnri-gallery.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/bnri-gallery.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9146, ORIGIN = `http://127.0.0.1:${PORT}`;
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

const MAN = JSON.parse(await readFile(join(ROOT, 'surfaces/blight/bnri-art/manifest.json'), 'utf8'));

async function open(reg, { noManifest = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); }
    if (noManifest && u.includes('bnri-art/manifest.json')) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state !== 'wait', null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs, outside };
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
    beeRows: document.querySelectorAll('#etBnRows .et-b-row').length,
    beeFeature: !!document.querySelector('#etBnFeature canvas'),
    cells: document.querySelectorAll('#etBnComb .et-r-cell').length,
    heart: document.querySelectorAll('#etBnComb .et-r-cell.et-heart').length,
    cyTables: document.querySelectorAll('.et-c table').length,
    cyPipe: document.querySelectorAll('#etBnPipe li').length,
    cyDump: /first records/.test(document.getElementById('etBnDump').textContent),
  }));
  assert.equal(s.beeRows, 7, 'new bee: seven plain rows'); assert.ok(s.beeFeature, 'new bee: one picture at a time');
  assert.equal(s.cells, 7, 'raver: a seven-cell honeycomb'); assert.equal(s.heart, 1, 'raver: one heart to hold');
  assert.ok(s.cyTables >= 2 && s.cyPipe === 6 && s.cyDump, 'cypherpunk: tables, a numbered pipeline, the bytes');
  await ctx.close();
});

test('the same facts in all three and on the wall: the manifest, the files, the decode', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await p.waitForFunction(() => document.querySelectorAll('#g figure canvas').length === 7, null, { timeout: 20000 });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, digits = s => +String(s).replace(/[^\d]/g, '');
      return {
        data: D.pieces.map(P => [P.name, P.ver, P.rects.length, P.W + 'x' + P.H, P.got, P.match]),
        totals: [D.state, D.read, D.rects, D.bytes, D.v1, D.v2],
        wall: [...document.querySelectorAll('#g figcaption')].map(c => { const m = c.textContent.match(/(\d+)×(\d+) · (\d+) rects · ([\d,.\s]+) B/); return [c.querySelector('b').textContent, +m[3], digits(m[4])]; }),
        bee: [...document.querySelectorAll('#etBnRows .et-b-row')].map(r => [r.querySelector('b').textContent, digits(r.querySelector('em').textContent.split('little')[0])]),
        cy: [...document.querySelectorAll('#etBnFiles tr.et-pick')].map(r => [r.cells[1].firstChild.textContent, digits(r.cells[3].textContent), r.cells[2].textContent]),
        raverCard: document.getElementById('etBnRaverCard').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].data, a.data); assert.deepEqual(facts[reg].totals, a.totals); }
  assert.deepEqual(a.data.map(x => x[0]), MAN.map(m => m.name), 'the manifest, in order');
  assert.deepEqual(a.data.map(x => x[4]), MAN.map(m => m.bytes), 'each file decodes to its manifest size');
  assert.ok(a.data.every(x => x[5] === true && x[3] === '96x96'));
  assert.deepEqual(a.totals, ['ok', 7, a.data.reduce((s, x) => s + x[2], 0), MAN.reduce((s, m) => s + m.bytes, 0), 7, 0]);
  // the wall below and every front agree, piece by piece
  assert.deepEqual(a.wall.map(w => [w[0], w[1], w[2]]), a.data.map(x => [x[0], x[2], x[4]]), 'the wall = the data layer');
  assert.deepEqual(a.bee, a.data.map(x => [x[0], x[2]]), 'bee rows = the data layer');
  assert.deepEqual(facts.cypherpunk.cy, a.data.map(x => [x[0], x[2], 'v' + x[1]]), 'cypherpunk table = the data layer');
  assert.match(facts.raver.raverCard, new RegExp(a.data[0][0] + '.*' + a.data[0][2].toLocaleString('en-US') + ' records'));
});

test('honest failure: a manifest that does not arrive is said everywhere, nothing is drawn from a copy', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { noManifest: true });
    await p.waitForFunction(() => /manifest unreachable/.test(document.getElementById('g').textContent), null, { timeout: 20000 });
    const d = await p.evaluate(() => ({
      state: window.__eternal.data.state, pieces: window.__eternal.data.pieces.length,
      bee: document.getElementById('etBnBeeCard').textContent, beeRows: document.querySelectorAll('#etBnRows .et-b-row').length,
      raver: document.getElementById('etBnRaverCard').textContent + ' ' + document.getElementById('etBnHint').textContent,
      cy: document.getElementById('etBnFiles').textContent + ' ' + document.getElementById('etBnReceipt').textContent,
      drawn: [...document.querySelectorAll('#eternal canvas')].filter(c => c.offsetParent && c.width > 8).length,
    }));
    assert.equal(d.state, 'no'); assert.equal(d.pieces, 0);
    if (reg === 'bee') { assert.match(d.bee, /could not be read/); assert.equal(d.beeRows, 0); }
    if (reg === 'raver') assert.match(d.raver, /did not arrive/);
    if (reg === 'cypherpunk') { assert.match(d.cy, /did not arrive/); assert.match(d.cy, /0 decoded/); }
    assert.equal(d.drawn, 0, reg + ': nothing is drawn when nothing arrived');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: tap brings a piece to the heart; the hold builds it record by record and pauses on release', async () => {
  const { ctx, p, errs, outside } = await open('raver');
  const at = () => p.evaluate(() => [window.__eternal.raver.at[0], window.__eternal.data.sel, window.__eternal.raver.built]);
  await p.click('#etBnComb .et-r-cell[data-slot="3"]');
  const [heart, sel] = await at();
  assert.equal(heart, 3); assert.equal(sel, 3, 'the tapped piece is now at the heart, and selected');
  assert.match(await p.textContent('#etBnRaverCard'), new RegExp(MAN[3].name.replace(/[()]/g, '.')));
  const n = await p.evaluate(() => window.__eternal.data.pieces[3].rects.length);
  const hb = await p.locator('#etBnComb .et-heart').boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(250);
  const part = (await at())[2];
  assert.ok(part > 0 && part < n, `a short hold builds part of it (${part} of ${n}) and pauses`);
  await p.waitForTimeout(300);
  assert.equal((await at())[2], part, 'released, it stays paused');
  assert.match(await p.textContent('#etBnMeterR'), new RegExp(part.toLocaleString('en-US') + ' / ' + n.toLocaleString('en-US')));
  await p.mouse.down(); await p.waitForTimeout(1900); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal((await at())[2], n, 'held on, every record is drawn');
  assert.deepEqual(outside, [], 'nothing leaves the origin');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: a row picks the file; the download is the real artifact and the bytes are its own', async () => {
  const { ctx, p } = await open('cypherpunk');
  await p.click('#etBnFiles tr.et-pick[data-i="1"]');
  const d = await p.evaluate(() => ({ href: document.getElementById('etBnCyGet').getAttribute('href'), dl: document.getElementById('etBnCyGet').hasAttribute('download'), dump: document.getElementById('etBnDump').textContent }));
  assert.equal(d.href, MAN[1].file); assert.ok(d.dl);
  const hex = (await readFile(join(ROOT, 'surfaces/blight', MAN[1].file), 'utf8')).trim();
  const first = hex.slice(0, 16).match(/../g).join(' ');
  assert.ok(d.dump.includes(first), 'the dump shows the file\'s own first record: ' + first);
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
