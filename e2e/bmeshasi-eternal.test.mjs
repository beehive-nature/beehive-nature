// bmeshasi-eternal.test.mjs — bMeshAsi, the community iron exchange (metered · iron paid first · settlement
// NOT live), as three products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at
// 390 px: exactly one front per register, each in its own dress; three different products (bee: what
// exists, what doesn't, who is paid first, then one plain slider; raver: the fee curve as a landscape whose
// lit area is the fee, dragged or tapped; cypherpunk: the parameters, the engine's breakdown, the case-1
// conformance check, the board, the gates, the pulses); the SAME facts in all three (the page's own
// meterFee() over its own sliders, its stated vector, its board and gates, its pulses); the page's own
// meter still reads exactly the crate's arithmetic after the engine was shared (checked against an
// independent replica of the formula); honest gestures (every gesture moves the page's own sliders and the
// page's own readout agrees; meter units, never money; nothing but the page's own chain reads leaves); raver
// motion that pauses and is still under reduced motion; and the laws (no dash for a value, no forced
// capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/bmeshasi-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/bmeshasi.html`> node --test e2e/bmeshasi-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/bmeshasi.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9245, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// an independent replica of the landed crate's arithmetic (crates/bmesh-meter; the page's own law text):
// p(u) = min + (max−min)·u^(e−1); flat below w at p(uₐ); the integral above w; one ceil at the end
function crate({ e, min, max, w, u0, u1, ua }) {
  if (e < 1 || (e === 1 && min !== max) || u1 < u0) return null;
  const p = u => e === 1 ? max : min + (max - min) * u ** (e - 1);
  const flat = Math.max(0, Math.min(u1, w) - u0) * p(ua), hi = Math.max(u0, w);
  const intg = u1 > hi ? min * (u1 - hi) + (max - min) * (u1 ** e - hi ** e) / e : 0;
  return Math.ceil(flat + intg);
}
const PAGE_HOSTS = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com|api\.hive\.blog|api\.deathwing\.me)\//;

async function open(reg, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.meter, null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForFunction(() => { const P = window.__eternal.data.pulse; return P.vaulta && P.vaulta.s !== 'wait' && P.hive.s !== 'wait'; }, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const front = p => p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '));
const pageFee = p => p.textContent('#fee');
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /^(undefined|NaN|null)$|\bNaN\b|\[object/.test(own)) out.push('junk ' + el.tagName + ' ' + own.slice(0, 30));
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A|INPUT)$/.test(el.tagName) || el.getAttribute('role') === 'button') { if (r.height < 43.5 || r.width < 43.5) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 24)); }
    if (r.width && r.right > 390.5) out.push('offside ' + el.tagName + ' ' + (el.className.baseVal ?? el.className) + ' ' + Math.round(r.right));
  }
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
  return out;
});

test('one front per register, each in its own dress, its own structure, and the laws hold', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '.et-b [data-go="meter"]', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#eternal .et-r-pill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etMsCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor,
        shape: [fr.querySelectorAll('.et-b-row').length, fr.querySelectorAll('svg [role="button"]').length, fr.querySelectorAll('table').length] };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    if (reg === 'bee') assert.deepEqual(d.shape, [6, 0, 0]);
    if (reg === 'raver') assert.deepEqual(d.shape, [0, 2, 0]);
    if (reg === 'cypherpunk') assert.ok(d.shape[0] === 0 && d.shape[1] === 0 && d.shape[2] >= 5);
    assert.deepEqual(await laws(p), [], reg + ' laws');
    for (const u of out) assert.match(u, PAGE_HOSTS, 'only the page\'s own chain reads leave: ' + u);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the page\'s own meter reads the crate\'s arithmetic, through its own sliders', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const cases = [{}, { u0: 0, u1: 1, w: 0 }, { e: 3, u1: 0.9 }, { w: 0.8, u0: 0.2, u1: 0.5 }, { e: 1.5, minp: 1000, maxp: 90000, ua: 0.7 }];
  const ids = { e: 'e', minp: 'min', maxp: 'max', w: 'w', u0: 'u0', u1: 'u1', ua: 'ua' };
  for (const c of cases) {
    const q = await p.evaluate(c => {
      for (const [id, v] of Object.entries(c)) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      return ['e', 'minp', 'maxp', 'w', 'u0', 'u1', 'ua'].map(id => +document.getElementById(id).value);
    }, c);
    const want = crate(Object.fromEntries(Object.values(ids).map((k, i) => [k, q[i]])));
    assert.equal(await pageFee(p), want.toLocaleString('en-US'), JSON.stringify(c));
  }
  // the stated whole-market vector is the one the crate's test pins
  assert.equal(crate({ e: 2, min: 2500, max: 75000, w: 0, u0: 0, u1: 1, ua: 0.2 }), 38750);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the same facts in all three: one engine, one board, one set of gates and pulses', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('.et-b [data-go="meter"]');
    seen[reg] = { D: await p.evaluate(() => JSON.parse(JSON.stringify(window.__eternal.data))), text: await front(p), fee: await pageFee(p) };
    await ctx.close();
  }
  const D = seen.bee.D;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ': one data layer');
  assert.deepEqual(D.meter, D.reference, 'the sliders sit at the page\'s reference values');
  assert.equal(D.result.fee, 13938); assert.equal(seen.bee.fee, '13,938', 'the page\'s own readout');
  assert.deepEqual(D.vector, { stated: '38,750', computed: 38750, match: true });
  assert.equal(D.exists.length, 5); assert.equal(D.notYet.length, 4); assert.equal(D.flow.length, 3); assert.equal(D.live, false);
  assert.equal(D.supply.length, 5); assert.equal(D.gates.length, 7); assert.equal(D.gates.filter(g => g.ruled).length, 1); assert.equal(D.gates.filter(g => g.prepared).length, 4);
  assert.equal(D.founder, null, 'MX-1 open: no founder values');
  assert.equal(D.pulse.vaulta.s, 'fail'); assert.equal(D.pulse.hive.s, 'fail');
  assert.match(seen.bee.text, /13,938 meter units/); assert.match(seen.bee.text, /meter units, not money/); assert.match(seen.bee.text, /reads 38,750 for the whole network/);
  assert.match(seen.raver.text, /13,938/); assert.match(seen.raver.text, /nothing is charged/); assert.match(seen.raver.text, /out of reach from here · never a zero/);
  assert.match(seen.cypherpunk.text, /13,938 meter units/); assert.match(seen.cypherpunk.text, /engine 38,750 · page states 38,750 match ✓/);
  assert.match(seen.cypherpunk.text, /settlement not live/); assert.match(seen.cypherpunk.text, /MX-1 open · reference vectors/); assert.match(seen.cypherpunk.text, /PLEDGED/);
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.doesNotMatch(seen[reg].text, /\b(paid out|you paid|settled|verified)\b/i, reg);
});

test('honest gestures: each register moves the page\'s own sliders and the page\'s readout agrees', async () => {
  // bee: one slider for how busy your use makes the network (the page's own u₁)
  let { ctx, p, errs } = await open('bee');
  await p.click('.et-b [data-go="meter"]');
  await p.$eval('#etMsBeeU1', el => { el.value = '0.9'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await p.inputValue('#u1'), '0.9', 'the page\'s own slider moved');
  const want = crate({ e: 2, min: 2500, max: 75000, w: 0.3, u0: 0.1, u1: 0.9, ua: 0.2 }).toLocaleString('en-US');
  assert.equal(await pageFee(p), want); assert.match(await p.textContent('#etMsBeeFee'), new RegExp(want + ' meter units'));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // raver: a tap on the landscape moves the nearer end; the lit area is the page's fee
  ({ ctx, p, errs } = await open('raver'));
  await p.$eval('#etMsCurve', e => e.scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  const box = await p.locator('#etMsCurve').boundingBox();
  await p.mouse.click(box.x + box.width * (34 + 0.95 * 312) / 360, box.y + box.height * 0.4);
  const u1 = await p.inputValue('#u1');
  assert.ok(+u1 >= 0.93 && +u1 <= 0.97, 'the tap landed near 0.95: ' + u1);
  assert.equal(await p.textContent('#etMsBig'), await pageFee(p), 'the big figure is the page\'s own fee');
  // a drag on the start handle moves the page's u₀
  const h = await p.locator('#etMsCurve .et-h[data-end="u0"] .et-dot').boundingBox();
  await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
  await p.mouse.move(box.x + box.width * (34 + 0.4 * 312) / 360, h.y + h.height / 2, { steps: 4 }); await p.mouse.up();
  const u0 = +(await p.inputValue('#u0'));
  assert.ok(u0 >= 0.37 && u0 <= 0.43, 'the drag moved u₀: ' + u0);
  assert.equal(await p.textContent('#etMsBig'), await pageFee(p));
  await p.click('#etMsDrops [data-drop="0"]');
  assert.match(await p.textContent('#etMsCard'), /IRON FIRST.*settlement is not live/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // cypherpunk: case 1 is the page's own invitation (u₀=0, u₁=1, w=0); a typed parameter reaches its slider
  ({ ctx, p, errs } = await open('cypherpunk'));
  await p.click('#etMsCyGo');
  assert.equal(await pageFee(p), '38,750', 'the page reads the pinned vector');
  assert.match(await p.textContent('#etMsOut'), /38,750 meter units/);
  await p.fill('#etMsParams input[data-param="e"]', '3'); await p.press('#etMsParams input[data-param="e"]', 'Enter');
  await p.$eval('#etMsParams input[data-param="e"]', el => el.dispatchEvent(new Event('change', { bubbles: true })));
  assert.equal(await p.inputValue('#e'), '3');
  assert.equal(await pageFee(p), crate({ e: 3, min: 2500, max: 75000, w: 0, u0: 0, u1: 1, ua: 0.2 }).toLocaleString('en-US'));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver motion: the lit area pauses on request and is still under reduced motion', async () => {
  let { ctx, p } = await open('raver');
  const play = () => p.$eval('#etMsCurve .et-intg', e => getComputedStyle(e).animationPlayState);
  assert.equal(await play(), 'running');
  await p.click('#etMsStill'); assert.equal(await play(), 'paused');
  await ctx.close();
  ({ ctx, p } = await open('raver', { reduced: true }));
  assert.equal(await p.$eval('#etMsCurve .et-intg', e => getComputedStyle(e).animationName), 'none');
  await ctx.close();
});
