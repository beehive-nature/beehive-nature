// buzz-studio-eternal.test.mjs — "paint a comb together, live" as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three are views of the page's ONE document (window.__buzz): 24 × 21 = 504 cells,
// the raver comb drawn on the page's own geometry, the bee patch a window into the same cells; the
// fronts join nothing on arrival (the page's own channel and its one hello are all there is: no peer
// connection, no socket, no probe of the room); a stroke in any front is the page's own op (the same
// lamport tick, the same broadcast) and lands on the comb below; two tabs converge to the same seed;
// "invite" only takes you to the page's pairing ceremony. Run: node --test e2e/buzz-studio-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/buzz-studio.html> node --test e2e/buzz-studio-eternal.test.mjs
const PAGE = 'buzz-studio.html', PORT = 9265;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const ORIGIN = `http://127.0.0.1:${PORT}`;
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

// counts every way a page could join anything, before any script of the page runs
const NET = () => {
  const n = window.__net = { bc: 0, post: [], rtc: 0, ws: 0, fetch: [] };
  const BC = window.BroadcastChannel;
  if (BC) window.BroadcastChannel = function (name) { n.bc++; const c = new BC(name); const pm = c.postMessage.bind(c); c.postMessage = m => { n.post.push(JSON.parse(JSON.stringify(m))); return pm(m); }; return c; };
  const RTC = window.RTCPeerConnection; if (RTC) window.RTCPeerConnection = function (...a) { n.rtc++; return new RTC(...a); };
  const WS = window.WebSocket; if (WS) window.WebSocket = function (...a) { n.ws++; return new WS(...a); };
  const F = window.fetch; window.fetch = function (u, ...a) { n.fetch.push(String(u && u.url || u)); return F.call(this, u, ...a); };
};
async function open(reg, { reduced = false, ctx: shared = null } = {}) {
  const ctx = shared || await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const outside = [];
  if (!shared) {
    await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
    await ctx.addInitScript(NET);
    await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  }
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#etBeeRows .et-b-row'), null, { timeout: 8000 });
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const LAWS = () => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)|\[object/.test(own)) out.push('bad value ' + (el.className.baseVal ?? el.className) + ' ' + own);
    const r = el.getBoundingClientRect();
    if ((/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
    if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
  }
  if (document.documentElement.scrollWidth > innerWidth || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  return out;
};
const ROOMHOSTS = /skaists\.buzz|relay\.skaists\.dev/;

test('one front per register, its own dress, one document, and nothing joined on arrival', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    await p.waitForTimeout(600);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, Z = window.__buzz;
      const page = [...document.querySelectorAll('#comb polygon')].map(x => x.getAttribute('points'));
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        primaries: fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary').length,
        model: [D.cols, D.rows, D.n, D.painted, D.me === Z.me], pageCells: page.length,
        sameGeometry: [...document.querySelectorAll('#etComb .c')].every((x, i) => x.getAttribute('points') === page[i]),
        patch: [...document.querySelectorAll('#etPatch .cell')].map(x => +x.dataset.i), path: document.getElementById('etPath').textContent,
        net: window.__net, front: document.getElementById('eternal-js').textContent };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one filled action');
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' laws');
    // one document
    assert.deepEqual(d.model, [24, 21, 504, 0, true]); assert.equal(d.pageCells, 504);
    assert.ok(d.sameGeometry, 'the raver comb is drawn on the page\'s own geometry, cell for cell');
    assert.equal(d.patch.length, 30); assert.ok(d.patch.every(i => i >= 0 && i < 504));
    assert.deepEqual(d.patch.slice(0, 6), [201, 202, 203, 204, 205, 206], 'the bee patch is a window onto rows 8 to 12, columns 9 to 14');
    assert.equal(d.path, 'buzz://skaists.buzz/genesis · 24×21 · lww-crdt');
    // joined nothing: the page's own channel and its one hello are all there is
    assert.equal(d.net.bc, 1, reg + ': only the page\'s own channel'); assert.equal(d.net.post.length, 1); assert.ok(d.net.post[0].hello, 'the page\'s own hello');
    assert.equal(d.net.rtc, 0, reg + ': no peer connection'); assert.equal(d.net.ws, 0, reg + ': no socket');
    assert.ok(!d.net.fetch.some(u => ROOMHOSTS.test(u)), reg + ': the room is never probed on arrival');
    assert.ok(!outside.some(u => ROOMHOSTS.test(u)), reg + ': no request to the room');
    assert.doesNotMatch(d.front, /BroadcastChannel|RTCPeerConnection|WebSocket|fetch\(|XMLHttpRequest|sendBeacon|localStorage/, 'the front script opens nothing of its own');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('bee: a tapped cell is the page\'s own op on the comb below; invite only takes you to the ceremony', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b-swatches button[data-k="1"]');
  assert.equal(await p.$eval('.et-b-swatches button[data-k="1"]', b => b.getAttribute('aria-checked')), 'true');
  await p.$eval('#etPatch', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  await p.click('#etPatch .cell[data-i="230"]');
  await p.waitForFunction(() => document.getElementById('painted').textContent === '1');
  await p.waitForFunction(() => /painted so far1 of 504 cells/.test(document.getElementById('etBeeRows').textContent), null, { timeout: 3000 }); // the front redraws from the same document
  const d = await p.evaluate(() => ({ page: document.querySelector('#comb polygon[data-i="230"]').getAttribute('fill'), front: document.querySelector('#etPatch .cell[data-i="230"]').style.fill,
    pal: window.__buzz.PAL[1], ops: document.getElementById('ops').textContent, post: window.__net.post.slice(-1)[0], me: window.__buzz.me, rows: document.getElementById('etBeeRows').textContent,
    label: document.querySelector('#etPatch .cell[data-i="230"]').getAttribute('aria-label') }));
  assert.equal(d.page, d.pal, 'the comb below took the stroke'); assert.equal(d.ops, '1');
  assert.deepEqual(d.post, { op: [230, { t: 1, c: d.me, k: 1 }] }, 'the page\'s own op on the page\'s own channel');
  assert.match(d.rows, /painted so far1 of 504 cells/); assert.equal(d.label, 'cell 230: violet');
  await p.click('#etBeeInvite'); await p.waitForTimeout(300);
  const inv = await p.evaluate(() => ({ focus: document.activeElement.id, box: document.getElementById('pairbox').value, state: document.getElementById('pairstate').textContent, rtc: window.__net.rtc }));
  assert.deepEqual(inv, { focus: 'mkoffer', box: '', state: 'not paired — tabs on this device sync regardless.', rtc: 0 }, 'invite hands off; the ceremony starts only on the page\'s own button');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a drag paints through the page\'s engine; the pulse pauses and is still under reduced motion', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('.et-r-swatches button[data-k="3"]');
  await p.$eval('#etComb', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const pts = await p.$$eval('#etComb .c', cs => [100, 101, 102, 103].map(i => { const r = cs[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 4 });
  await p.mouse.up(); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ painted: document.getElementById('painted').textContent, big: document.getElementById('etRaverBig').firstChild.textContent,
    cells: [100, 101, 102, 103].map(i => document.querySelector('#comb polygon[data-i="' + i + '"]').getAttribute('fill')), pal: window.__buzz.PAL[3], ops: window.__buzz.ops }));
  assert.deepEqual(d.cells, [d.pal, d.pal, d.pal, d.pal], 'the stroke landed on the comb below');
  assert.equal(d.painted, '4'); assert.equal(d.big, '4'); assert.equal(d.ops, 4, 'one op per cell: a drag over a painted cell makes no extra op');
  assert.equal(await p.$eval('#etLast', l => [l.getAttribute('visibility'), getComputedStyle(l).animationPlayState].join()), 'visible,running');
  await p.click('#etPulse');
  assert.equal(await p.$eval('#etLast', l => getComputedStyle(l).animationPlayState), 'paused');
  assert.ok(await p.$eval('#etLast', l => parseFloat(getComputedStyle(l).animationDuration)) >= 1 / 3, 'under 3 Hz');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduced: true });
  assert.equal(await still.p.$eval('#etLast', l => getComputedStyle(l).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: an op composed here reaches a second tab; both replicas converge to one seed; export is the page\'s own', async () => {
  const A = await open('cypherpunk');
  const B = await open('cypherpunk', { ctx: A.ctx });
  await A.p.bringToFront();
  await A.p.fill('#etOpI', '999'); await A.p.click('#etCyApply');
  assert.match(await A.p.textContent('#etCyLast'), /refused · i must be 0 to 503/);
  await A.p.fill('#etOpI', '100'); await A.p.selectOption('#etOpK', '2'); await A.p.click('#etCyApply');
  const me = await A.p.evaluate(() => window.__buzz.me);
  assert.equal(await A.p.textContent('#etCyLast'), 'applied · ' + JSON.stringify({ op: [100, { t: 1, c: me, k: 2 }] }));
  await B.p.waitForFunction(() => document.querySelector('#comb polygon[data-i="100"]').getAttribute('fill') === window.__buzz.PAL[2], null, { timeout: 5000 });
  await B.p.waitForFunction(() => /peer/.test(document.getElementById('etLog').textContent), null, { timeout: 5000 });
  const seed = p => p.evaluate(() => window.__eternal.data.seed);
  assert.equal(await seed(A.p), await seed(B.p), 'converged: one seed in both tabs');
  assert.match(await A.p.textContent('#etLog'), new RegExp('1001' + me + '2you'));
  assert.match(await B.p.textContent('#etLog'), new RegExp('1001' + me + '2peer'));
  await B.p.waitForFunction(() => /peers 1/.test(document.getElementById('etChips').textContent), null, { timeout: 5000 });
  await A.p.click('#etCyExport');
  const prov = await A.p.$eval('#svgout', e => [e.style.display, e.textContent.split('\n')[1]]);
  assert.deepEqual(prov, ['block', 'seed (FNV of state): ' + await seed(A.p)], 'the page\'s own export prints the same seed');
  assert.equal(await A.p.evaluate(() => window.__net.rtc), 0);
  assert.equal(A.errs.length + B.errs.length, 0, A.errs.concat(B.errs).join(' | '));
  await A.ctx.close();
});
