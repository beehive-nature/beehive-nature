// ant-door-eternal.test.mjs — the Autonomi door's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts from the page's own single same-origin GET and the receipt on
// record; when the door does not answer (this box has no outside network) every front says so plainly
// and draws nothing it did not read; when bytes arrive (a fixture: a real JPEG from this repo) the byte
// count, sha256 and the byte histogram the fronts show are the ones Node computes from the same file, and
// bytes that are not the receipt's are never called a match; every gesture is that same GET, asked once
// (a short hold asks nothing); the old card and its receipts keep working; with no design system the
// fronts stand down. Run: node --test e2e/ant-door-eternal.test.mjs
// Red on the page before the fronts: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/ant-door.html> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'ant-door.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9124, ORIGIN = `http://127.0.0.1:${PORT}`;
const PIN = '98f657d987d339c302295e79907e7a4abc1564bd6b42300ea8d59ccd2148fd17'; // PUBLIC-CONSTANT: decoded-object sha256 pin from the antd read-door receipt (2026-09-21)
const JPG = await readFile(join(ROOT, 'assets/bnature-logo.jpg'));
const JPG_SHA = createHash('sha256').update(JPG).digest('hex');
const HIST = new Array(256).fill(0); for (const b of JPG) HIST[b]++;
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { live = false, bare = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const reads = [], foreign = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN) && !u.startsWith('data:')) { foreign.push(u); return r.abort('blockedbyclient'); }
    const path = new URL(u).pathname;
    if (path.startsWith('/ant/v1/data/public/')) { reads.push(path); if (live) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: JPG.toString('base64') }) }); }
    if (bare && path.endsWith('/skaists.css')) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state !== 'reading' && document.body.dataset.reg && (window.__eternal.data.state !== 'live' || window.__eternal.data.hashed !== null), null, { timeout: 20000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, reads, foreign };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const facts = p => p.evaluate(() => ({
  D: (({ state, status, bytes, sha, match, hashed, addr, path }) => ({ state, status, bytes, sha, match, hashed, addr, path }))(window.__eternal.data),
  frame: document.getElementById('etFrame').textContent, frameImg: document.querySelectorAll('#etFrame img').length,
  rh: document.getElementById('etRH').textContent, rcard: document.getElementById('etRCard').textContent, rays: document.querySelectorAll('#etSpec line').length,
  ring: !!document.querySelector('#etSpec .ring[role="button"]'), verdict: document.getElementById('etVerdict').hidden ? '' : document.getElementById('etVerdict').textContent,
  kv: document.getElementById('etKv').textContent, pipe: [...document.querySelectorAll('#etPipe li')].map(li => li.className),
  stage: (document.getElementById('stage') || {}).textContent || '', badge: document.getElementById('state-badge').textContent,
  content: document.querySelectorAll('img#content').length, painted: !!(document.getElementById('content') && document.getElementById('content').naturalWidth > 0),
  addrCard: document.getElementById('addr').textContent,
}));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', act: '#etBeeAsk' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', act: '#etHold' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', act: '#etCGet' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the door does not answer: all three say so plainly, draw nothing unread, and the old card says what it always said', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, reads, foreign } = await open(reg);
    const f = await facts(p);
    assert.equal(f.D.state, 'failed'); assert.equal(f.D.status, 404); assert.equal(f.D.bytes, 0);
    assert.equal(reads.length, 1, 'one read on arrival'); assert.deepEqual(foreign, [], 'nothing leaves the origin');
    assert.match(f.frame, /quiet, for now/); assert.equal(f.frameImg, 0, 'bee: no picture it did not read');
    assert.equal(f.rh, 'silence'); assert.match(f.rcard, /no bytes, no picture.*the door said 404/); assert.equal(f.ring, false, 'raver: no ring to tap without bytes');
    assert.equal(f.rays, 256, 'the silent ring still has a place for every byte value'); assert.equal(f.verdict, '');
    assert.match(f.kv, /status404/); assert.match(f.kv, /bytesnot read/); assert.match(f.kv, /sha256not read/); assert.match(f.kv, /vs receiptnot compared · no bytes/);
    assert.deepEqual(f.pipe, ['done', 'fail', 'todo', 'todo', 'todo']);
    assert.equal(f.stage, 'the door did not answer — door answered 404'); assert.equal(f.badge, 'UNREACHABLE'); assert.equal(f.content, 0);
    assert.equal(f.addrCard, 'autonomi://' + f.D.addr);
    const front = await p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').innerText);
    assert.doesNotMatch(front, /\bmatch|same bytes|read just now|bytes in,|· live\b|\blive ·/i, reg + ' claims nothing it did not read');
    assert.doesNotMatch(front, /LIVE/, reg + ' no LIVE badge in a front');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('bytes arrive: the same count, hash and histogram in all three, and bytes that are not the receipt\'s are never a match', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, reads, foreign } = await open(reg, { live: true });
    const f = await facts(p);
    assert.equal(f.D.state, 'live'); assert.equal(f.D.bytes, JPG.length); assert.equal(f.D.sha, JPG_SHA, 'crypto.subtle agrees with Node');
    assert.notEqual(JPG_SHA, PIN); assert.equal(f.D.match, false, 'not the receipt: not a match');
    assert.equal(reads.length, 1); assert.deepEqual(foreign, []);
    const n = JPG.length.toLocaleString('en-US');
    assert.match(f.frame, new RegExp(n + ' bytes, read just now')); assert.match(f.frame, /not the ones the estate recorded/); assert.equal(f.frameImg, 1);
    assert.equal(f.rh, n + ' bytes'); assert.equal(f.verdict, 'not the receipt\'s bytes'); assert.equal(f.ring, true);
    assert.match(f.kv, new RegExp('bytes' + n)); assert.match(f.kv, new RegExp('sha256' + JPG_SHA)); assert.match(f.kv, /typejpeg · ff d8 ff/); assert.match(f.kv, /differs from the receipt/);
    assert.deepEqual(f.pipe, ['done', 'done', 'done', 'done', 'done']);
    // the old card, exactly as its receipt script expects (ant-door-shot.mjs: one img#content, painted, a BYTES badge)
    assert.equal(f.content, 1); assert.ok(f.painted, 'the bytes decoded into pixels'); assert.match(f.badge, new RegExp(n + ' BYTES · SAME-ORIGIN · LIVE'));
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: a tap on the ring reads one byte value\'s real count', async () => {
  const { ctx, p, errs } = await open('raver', { live: true });
  await p.locator('#etSpec').scrollIntoViewIfNeeded();
  // tap the ray for 0xff (the jpeg marker byte), a quarter-turn short of twelve o'clock
  const pt = await p.evaluate(() => { const b = document.getElementById('etSpec').getBoundingClientRect(), a = 255 / 256 * 2 * Math.PI - Math.PI / 2, r = b.width / 2 * 0.8; return { x: b.left + b.width / 2 + Math.cos(a) * r, y: b.top + b.height / 2 + Math.sin(a) * r }; });
  await p.mouse.click(pt.x, pt.y);
  const d = await p.evaluate(() => ({ pick: window.__eternal.raver.pick, card: document.getElementById('etRCard').textContent }));
  assert.equal(d.pick, 255);
  assert.match(d.card, new RegExp('byte 0xff · ' + HIST[255].toLocaleString('en-US') + ' times'));
  // arrows walk the ring
  await p.focus('#etSpec .ring'); await p.keyboard.press('ArrowRight');
  const e = await p.evaluate(() => ({ pick: window.__eternal.raver.pick, card: document.getElementById('etRCard').textContent }));
  assert.equal(e.pick, 0); assert.match(e.card, new RegExp('byte 0x00 · ' + HIST[0].toLocaleString('en-US') + ' times'));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('every gesture is the same GET, asked once; a short hold asks nothing', async () => {
  { const { ctx, p, errs, reads } = await open('bee');
    await p.click('#etBeeAsk'); await p.waitForFunction(() => window.__eternal.data.state !== 'reading');
    assert.equal(reads.length, 2, 'bee: one more read'); assert.equal(await p.evaluate(() => window.__eternal.data.reads), 2);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close(); }
  { const { ctx, p, errs, reads } = await open('cypherpunk');
    await p.click('#etCGet'); await p.waitForFunction(() => window.__eternal.data.state !== 'reading');
    assert.equal(reads.length, 2, 'cypherpunk: one more read');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close(); }
  { const { ctx, p, errs, reads } = await open('raver');
    await p.locator('#etHold').scrollIntoViewIfNeeded();
    const b = await p.locator('#etHold').boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(300);
    assert.equal(reads.length, 1, 'a short hold is not a request');
    await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
    await p.waitForFunction(() => window.__eternal.data.state !== 'reading');
    assert.equal(reads.length, 2, 'a full hold is exactly one request');
    assert.equal(await p.evaluate(() => document.getElementById('etRH').textContent), 'silence', 'still honest after asking again');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close(); }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px presses, reading floors', async () => {
  const floor = { bee: 14, raver: 14, cypherpunk: 12 };
  for (const [reg, live] of [['bee', false], ['raver', false], ['cypherpunk', false], ['raver', true], ['bee', true]]) {
    const { ctx, p } = await open(reg, { live });
    const bad = await p.evaluate(min => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null)$/.test(own)) out.push('value ' + el.className + ' ' + own);
        if (own && parseFloat(cs.fontSize) < min) out.push('small text ' + el.tagName + ' ' + cs.fontSize);
        const press = /^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button';
        const r = el.getBoundingClientRect();
        if (press && (r.height < 44 || r.width < 44)) out.push('small press ' + el.tagName + ' ' + (el.textContent || el.getAttribute('aria-label')).trim().slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (el.tagName === 'A' && /^https?:/.test(el.getAttribute('href')) && !el.href.startsWith(location.origin) && !(el.target === '_blank' && /noopener/.test(el.rel) && /noreferrer/.test(el.rel) && /new tab/.test(el.textContent))) out.push('external link without a said new tab');
      }
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    }, floor[reg]);
    assert.deepEqual(bad, [], reg + (live ? ' live' : ''));
    await ctx.close();
  }
});

test('the old card keeps working, and the fronts stand down whole without the design system', async () => {
  const src = await readFile(process.env.ETERNAL_PAGE_FILE || join(ROOT, 'surfaces', PAGE), 'utf8');
  assert.doesNotMatch(src, /data-i18n="et\./, 'front strings ride T(), never the corpus attribute');
  for (const line of src.split('\n')) if (/[0-9a-f]{48,}/i.test(line)) assert.match(line, /PUBLIC-CONSTANT/, 'every long hex carries its marker');
  assert.match(src, new RegExp("sha:'" + PIN + "'"), 'the receipt pin is the dispatch\'s');
  const { ctx, p, errs } = await open('raver', { bare: true });
  const d = await p.evaluate(() => ({ bare: document.documentElement.hasAttribute('data-et-bare'), front: getComputedStyle(document.getElementById('eternal')).display, ids: ['stage', 'addr', 'state-badge', 'apiref'].every(id => document.getElementById(id)), badge: document.getElementById('state-badge').textContent, h1: document.querySelector('h1').textContent }));
  assert.equal(d.bare, true); assert.equal(d.front, 'none'); assert.ok(d.ids, 'every old id is here'); assert.equal(d.badge, 'UNREACHABLE'); assert.match(d.h1, /the Autonomi door/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
