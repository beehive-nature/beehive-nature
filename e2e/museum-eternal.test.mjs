// museum-eternal.test.mjs — the museum as three ways to walk ONE collection (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register in its own dress;
// the SAME pieces, count and states in all three (read from window.__eternal.data and from each
// front's DOM); three different walks (a guided walk room by room, a constellation you light, a
// catalogue with a pipeline); honest gestures (with base.org and the RPCs unreachable, nothing is
// called live; "verify" really hashes the archived files against MANIFEST.json); every keyed
// data-i18n string keeps its key and English; and the laws on the front.
// Run: node --test e2e/museum-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8935, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/museum.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.count != null && window.__museum.SEALS.every(s => s.state !== 'reading'), null, { timeout: 30000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', sel: '.et-b-primary' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', sel: '.et-r-pill' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', sel: '.et-c-primary' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f);
      return { shown: ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'),
        bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector('.et-b-h,.et-r-h,.et-c-path')).fontFamily,
        action: getComputedStyle(fr.querySelector(a)).backgroundColor, primaries: [...fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary')].filter(e => e.getClientRects().length).length,
        wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [FRONT[reg], w.sel]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg); assert.match(d.title, w.title); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one primary per view');
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same collection in all three: count, pieces, states — and nothing claimed live', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, outside } = await open(reg);
    seen[reg] = await p.evaluate(f => {
      const D = window.__eternal.data, fr = document.querySelector('#eternal>' + f);
      return { data: { count: D.count, pieces: D.pieces.map(x => [x.id, x.state]), wings: D.wings.map(w => w.name) },
        hero: document.getElementById('exhibitCount').textContent,
        count: [...fr.querySelectorAll('[data-et="count"]')].map(e => e.textContent),
        wingsDom: [...fr.querySelectorAll('[data-et="wing"]')].map(e => e.textContent),
        piecesDom: [...fr.querySelectorAll('[data-et="piece"]')].map(e => e.textContent),
        statesDom: [...fr.querySelectorAll('[data-et="state"]')].map(e => e.getAttribute('data-state')),
        hint: (fr.querySelector('#etSkyHint') || {}).textContent || '', hub: (fr.querySelector('#etSky .hubt') || {}).textContent || '' };
    }, FRONT[reg]);
    assert.ok(outside.length > 0, reg + ': the page did try base.org / the RPCs (blocked here)');
    await ctx.close();
  }
  const a = seen.bee.data;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].data, a, reg + ': the same data layer');
  // with base.org and every RPC unreachable: the four seals come from the archive, the royal collection is "not read"
  assert.deepEqual(a.pieces.filter(x => x[0].startsWith('seal-')).map(x => x[1]), ['archived', 'archived', 'archived', 'archived']);
  assert.deepEqual(a.pieces.find(x => x[0].startsWith('royal-')), ['royal-unread', 'not read']);
  assert.ok(!a.pieces.some(x => x[1] === 'live'), 'nothing is called live when the chain did not answer');
  assert.equal(a.count, 5, '4 seals + 0 royal read + the purse, the page’s own formula');
  assert.equal(seen.bee.hero, '5', 'the hero number below agrees');
  assert.equal(a.pieces.filter(x => x[0].startsWith('room-')).length, 8, 'the corridor’s eight rooms');
  // each walk draws it its own way
  assert.deepEqual(seen.bee.wingsDom, a.wings, 'bee lists the eight rooms of the walk');
  assert.ok(seen.bee.count.every(x => x === '5'));
  assert.equal(seen.raver.hub, '5'); assert.match(seen.raver.hint, new RegExp(`of ${a.pieces.length} lit`));
  assert.equal(seen.cypherpunk.piecesDom.length, a.pieces.length, 'the catalogue has a row per piece');
  assert.deepEqual(seen.cypherpunk.statesDom, a.pieces.map(x => x[1]), 'the catalogue states are the data’s');
  assert.ok(seen.cypherpunk.count.every(x => x === '5'));
});

test('three walks: room by room, star by star, row by row — and verify really hashes', async () => {
  const { ctx: c1, p: b } = await open('bee');
  await b.click('.et-b-primary[data-go="1"]');
  assert.match(await b.textContent('#etBeeCount'), /room 1 of 8/);
  assert.match(await b.textContent('#etBeeRoom'), /the Luna Seals[\s\S]*shown from the archive/);
  await b.click('#etBeeNext');
  assert.match(await b.textContent('#etBeeRoom'), /the royal collection[\s\S]*not read yet/, 'bee says plainly the chain was not read');
  assert.equal(await b.getAttribute('#etBeeWall', 'href'), '#wing-royal');
  assert.ok(await b.$('#wing-royal'), 'the wall it points to exists');
  await c1.close();

  const { ctx: c2, p: r, errs } = await open('raver');
  await r.click('#etSky .star[data-id="room-dj"]');
  assert.match(await r.textContent('#etSkyCard'), /the DJ[\s\S]*1959/);
  assert.match(await r.textContent('#etSkyHint'), /^1 of/);
  assert.equal(await r.getAttribute('#etSkyGo', 'href'), '#wing-corridor');
  await r.click('#etSkyAll');
  const n = await r.evaluate(() => window.__eternal.data.pieces.length);
  assert.match(await r.textContent('#etSkyHint'), new RegExp(`^${n} of ${n}`));
  await r.click('#etSkyMotion');
  assert.equal(await r.evaluate(() => getComputedStyle(document.querySelector('#etSky .dot')).animationName), 'none', 'the sky is still when paused');
  assert.equal(errs.length, 0, errs.join(' | '));
  await c2.close();

  const { ctx: c3, p: c } = await open('cypherpunk');
  assert.match(await c.textContent('#etMuReceipt'), /not verified yet/, 'no hash is claimed before it is computed');
  await c.click('#etMuVerify');
  await c.waitForFunction(() => window.__eternal.data.verify.state === 'done', null, { timeout: 20000 });
  const v = await c.evaluate(() => window.__eternal.data.verify);
  assert.deepEqual([v.ok, v.n], [4, 4], 'the four archived cards match their receipts');
  assert.match(await c.textContent('#etMuPipe'), /4\/4 match/);
  // the proof is real: hash the same files here and compare
  const mf = JSON.parse((await readFile(join(ROOT, 'assets/museum/luna-seals/MANIFEST.json'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, ''));
  const got = execFileSync('sha256sum', ['luni.cardImage.svg'], { cwd: join(ROOT, 'assets/museum/luna-seals') }).toString().split(' ')[0];
  assert.equal(got, mf.items[0].svg_sha256);
  assert.equal(await c.$eval('.et-c a[target="_blank"]', a => a.rel), 'noopener noreferrer');
  await c3.close();
});

test('every keyed string keeps its key and its English', async () => {
  const head = execFileSync('git', ['show', 'HEAD:surfaces/museum.html'], { cwd: ROOT }).toString();
  const now = await readFile(join(ROOT, 'surfaces/museum.html'), 'utf8');
  const keyed = h => Object.fromEntries([...h.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)].map(m => [m[1], m[2]]));
  const a = keyed(head), b = keyed(now);
  assert.ok(Object.keys(a).length >= 30);
  for (const [k, en] of Object.entries(a)) assert.equal(b[k], en, k);
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^([—–-]|NaN|undefined|null)$/.test(own)) out.push('dash ' + el.className);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.getAttribute('data-id') || el.textContent.trim().slice(0, 20)));
      }
      return out;
    }, FRONT[reg]);
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
