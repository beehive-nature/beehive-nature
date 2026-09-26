// watch-eternal.test.mjs — the watch room as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register in its own dress;
// the SAME room facts in all three (the room, the ticker, the price), read from window.__eternal.data
// and from each front's DOM; the room pass (#access, the page's own field and Watch) sits in the front
// that is showing and is offered only where a room host answers; honest gestures (a tick reads, "check
// again" re-asks /live/health and nothing else, nothing says live unless the host says publishing); the
// laws. A local room host is MOCKED. Run: node --test e2e/watch-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8936, ORIGIN = `http://127.0.0.1:${PORT}`;
let hosted = false; const asked = [];
const json = (s, o) => { s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify(o)); };
const srv = createServer(async (q, s) => {
  const path = decodeURIComponent(q.url.split('?')[0]); asked.push(path);
  if (hosted && path === '/live/health') return json(s, { publishing: false, rooms: [] });
  if (hosted && path === '/live/ticker/general.json') return json(s, { now: 'the long take', next: 'dawn chorus', set: '21:00' });
  if (hosted && path.startsWith('/live/session/')) return json(s, { ok: true, sess: { credit: '2.0000 A', burned: '0.5000 A', state: 0, audit_state: 1 } });
  try { const f = path === '/tokens.css' ? join(ROOT, 'surfaces/tokens.css') : join(ROOT, path); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, host) {
  hosted = host;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', 'en'); localStorage.removeItem('watch.session'); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/watch.html`, { waitUntil: 'load' });
  await p.waitForFunction(h => window.__eternal && window.__eternal.data.room === (h ? 'hosted' : 'none') && window.__eternal.data.polls.length > 0, host, { timeout: 20000 });
  if (host) await p.waitForFunction(() => window.__eternal.data.now, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };

test('one front per register, each in its own dress, the room pass inside it', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg, true);
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      return { shown: ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'),
        bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector('.et-b-h,.et-r-h,.et-c-path')).fontFamily,
        action: getComputedStyle(document.getElementById('go')).backgroundColor, inFront: fr.contains(document.getElementById('access')), pass: document.getElementById('sess').checkVisibility(),
        h1: document.querySelector('h1').innerText, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg); assert.match(d.title, w.title); assert.equal(d.action, w.action, reg + ': Watch in the register’s action colour');
    assert.ok(d.inFront && d.pass, reg + ': the room pass is in the front that is showing');
    assert.equal(d.h1, 'Watch together', 'the page keeps its name');
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same room in all three: room state, now, next and price', async () => {
  for (const host of [false, true]) {
    const seen = {};
    for (const reg of ['bee', 'raver', 'cypherpunk']) {
      const { ctx, p, errs } = await open(reg, host);
      seen[reg] = await p.evaluate(f => {
        const D = window.__eternal.data, fr = document.querySelector('#eternal>' + f), all = k => [...fr.querySelectorAll(`[data-et="${k}"]`)];
        return { data: { room: D.room, stream: D.stream, now: D.now, next: D.next },
          room: all('room').map(e => e.getAttribute('data-room')), now: all('now').map(e => e.textContent), price: all('price').map(e => e.textContent),
          stream: all('stream').map(e => e.getAttribute('data-stream')), pass: document.getElementById('sess').checkVisibility() };
      }, FRONT[reg]);
      assert.equal(errs.length, 0, errs.join(' | '));
      await ctx.close();
    }
    const a = seen.bee.data;
    for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].data, a, `${reg} (hosted ${host}): the same data layer`);
    assert.equal(a.room, host ? 'hosted' : 'none');
    assert.equal(a.stream, host ? 'offline' : 'none', 'a host that is not publishing is never called live');
    if (host) assert.deepEqual([a.now, a.next], ['the long take', 'dawn chorus']);
    for (const reg of ['bee', 'raver', 'cypherpunk']) {
      const f = seen[reg];
      assert.ok(f.room.length && f.room.every(x => x === a.room), reg + ' room');
      assert.equal(f.pass, host, reg + ': the pass is offered only where a room host answered');
    }
    for (const reg of ['bee', 'raver']) assert.ok(seen[reg].now.length && seen[reg].now.every(x => x === (host ? 'the long take' : 'not read yet')), reg + ' now: ' + seen[reg].now);
    for (const reg of ['bee', 'cypherpunk']) assert.deepEqual(seen[reg].price, ['Not quoted'], reg + ' price');
    assert.ok(seen.raver.stream.every(x => x === a.stream) && seen.cypherpunk.stream.every(x => x === a.stream));
  }
});

test('honest gestures: a tick reads, "check again" only re-asks the room, Watch is the page’s own', async () => {
  const { ctx: c1, p: r, errs } = await open('raver', false);
  const n0 = await r.evaluate(() => window.__eternal.data.polls.length);
  await r.click('#etPulse .tick[data-i="0"]');
  assert.match(await r.textContent('#etPulseCard'), /Preview/, 'the tick says what the room answered');
  const before = asked.length;
  await r.click('#etRecheck'); await r.waitForTimeout(800);
  const again = asked.slice(before);
  assert.deepEqual(again, ['/live/health'], 'check again asks /live/health once, and nothing else');
  assert.ok(await r.evaluate(() => window.__eternal.data.polls.length) > n0, 'the answer becomes a tick');
  assert.equal(await r.evaluate(() => window.__eternal.data.room), 'none', 'still no room: nothing pretends otherwise');
  await r.click('#etPulseMotion');
  assert.equal(await r.evaluate(() => document.body.hasAttribute('data-motion-paused')), true);
  assert.equal(errs.length, 0, errs.join(' | '));
  await c1.close();

  const { ctx: c2, p: b } = await open('bee', true);
  await b.fill('#sess', '600'); await b.click('#go'); await b.waitForTimeout(900);
  assert.ok(asked.includes('/live/session/600.json'), 'Watch runs the page’s own session read');
  assert.match(await b.textContent('#nums'), /credit 2\.0000 A · burned 0\.5000 A · left 1\.5 A/);
  assert.match(await b.textContent('#etBeeRows'), /entered on this device/);
  await c2.close();

  const { ctx: c3, p: y } = await open('cypherpunk', true);
  await y.fill('#sess', '600'); await y.click('#go'); await y.waitForTimeout(900);
  const kv = await y.textContent('#etWReceipt');
  assert.match(kv, /receipt\s*credit 2\.0000 A/, 'the cypherpunk receipt is the page’s receipt');
  assert.match(kv, /audit\s*pending/);
  assert.equal(await y.$eval('.et-c a[target="_blank"]', a => a.rel), 'noopener noreferrer');
  await c3.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const host of [false, true]) for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, host);
    const bad = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^([—–-]|NaN|undefined|null)$/.test(own)) out.push('dash ' + (el.id || el.className));
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A|INPUT)$/.test(el.tagName) || el.getAttribute('role') === 'button') && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    }, FRONT[reg]);
    assert.deepEqual(bad, [], `${reg} (hosted ${host})`);
    await ctx.close();
  }
});
