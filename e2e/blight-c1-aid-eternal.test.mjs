// blight-c1-aid-eternal.test.mjs — the C-1 aid (taxonomy sizing: expected collisions against the founder's
// bar, priced in parts, uploads and bytes) as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; three
// different products (bee: one question, four plain supply choices, the answer in words; raver: the
// collision dial, a knob you drag round the ring, two needles on a log scale against the bar; cypherpunk:
// the axes table, every figure, the numbered pipeline with the spec self-check, how to rerun it); the SAME
// numbers in all three, read from the aid's own compute() and equal to the test's own recomputation of
// the catalog prefill; every gesture writes through to the aid's own controls (#k, #g48 / #g96); the
// self-check is shown as the aid ran it; and the laws (no dash, no caps, 44 px, no sideways page).
// Run: node --test e2e/blight-c1-aid-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/c1-aid.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/c1-aid.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9227, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// the catalog prefill, recomputed here on its own: six layers of 30 (gates 100 100 60 37 37 100) × the
// HD colour axis 1/9/33/37/20 — the uniform product and the weighted Σp² figure, at k pieces
const GATES = [100, 100, 60, 37, 37, 100], HD = [1, 9, 33, 37, 20];
const N = GATES.reduce((a, g) => a * (g < 100 ? 31 : 30), 1) * HD.length;
const PAIR = GATES.reduce((a, g) => { const p = g / 100; return a * (30 * (p / 30) ** 2 + (1 - p) ** 2); }, 1) * HD.reduce((a, w) => a + (w / 100) ** 2, 0);
const want = k => ({ ecU: k * k / (2 * N), ecW: k * k / 2 * PAIR });
const near = (a, b, why) => assert.ok(Math.abs(a / b - 1) < 1e-9, `${why}: ${a} vs ${b}`);

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const ext = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); ext.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.k, null, { timeout: 8000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, ext };
}
const settle = p => p.waitForTimeout(120);
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const facts = {};

test('per register: its own front and dress, nothing sent, the laws, and the page\'s own disclosure law kept', async () => {
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
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-knob circle:not(.et-hit),.et-c-primary');
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
      const D = window.__eternal.data, L = window.__c1aid.last;
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily,
        action: f === '.et-r' ? getComputedStyle(act).fill : getComputedStyle(act).backgroundColor,
        data: { k: D.k, ecU: D.ecU, ecW: D.ecW, passU: D.passU, passW: D.passW, components: D.components, txs: D.txs, bytes: D.bytes, check: D.check.ok },
        last: { k: L.k, ecU: L.ecU, ecW: L.ecW, components: L.components, txs: L.txs, bytes: L.bytes }, selfcheck: document.getElementById('selfcheck').textContent,
        recapOpen: document.querySelector('details.tnote').open,
        text: { bee: document.querySelector('#eternal>.et-b').textContent, raver: document.querySelector('#eternal>.et-r').textContent, cy: document.querySelector('#eternal>.et-c').textContent },
        counts: { beeK: document.querySelectorAll('#etC1BeeK button.et-b-row').length, needles: document.querySelectorAll('#etC1Dial > line[x1="0"]').length, knob: document.querySelectorAll('#etC1Dial .et-knob').length,
          layers: document.querySelectorAll('#etC1Layers tr').length, fig: document.querySelectorAll('#etC1Fig tr').length, pipe: document.querySelectorAll('#etC1Pipe li').length } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(ext, [], reg + ': nothing leaves the origin');
    assert.equal(d.recapOpen, reg === 'cypherpunk', reg + ': the recap disclosure keeps its register default');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same numbers: the aid\'s own compute(), equal to the prefill recomputed here', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.equal(a.data.k, 5000); assert.deepEqual({ k: a.last.k, ecU: a.last.ecU, ecW: a.last.ecW, components: a.last.components, txs: a.last.txs, bytes: a.last.bytes },
    { k: a.data.k, ecU: a.data.ecU, ecW: a.data.ecW, components: a.data.components, txs: a.data.txs, bytes: a.data.bytes }, 'read from the aid, not recomputed by the front');
  near(a.data.ecU, want(5000).ecU, 'uniform bound'); near(a.data.ecW, want(5000).ecW, 'weighted figure');
  assert.equal(a.data.passU, true); assert.equal(a.data.passW, false, 'the prefill is over the bar on the weighted figure: the aid\'s own lesson');
  assert.equal(a.data.components, 180); assert.equal(a.data.check, true); assert.match(a.selfcheck, /^SELF-CHECK PASS/);
  // the same numbers in each register's own words
  assert.match(a.text.bee, /over the founder’s bar/); assert.match(a.text.bee, /about 3\.8\. the bar is 0\.01/); assert.match(a.text.bee, /simple estimate says 0\.0031/);
  assert.match(a.text.bee, /parts to draw\s*180/); assert.match(a.text.bee, /they match the spec’s own example/);
  assert.match(facts.raver.text.raver, /3\.8\s*pairs expected/); assert.match(facts.raver.text.raver, /over the bar\s*weighted 3\.77×10⁰ · uniform 3\.11×10⁻³/);
  assert.match(facts.cypherpunk.text.cy, /E uniform\s*3\.11×10⁻³/); assert.match(facts.cypherpunk.text.cy, /E weighted\s*3\.77×10⁰/); assert.match(facts.cypherpunk.text.cy, /self-check pass/);
  const c = a.counts;
  assert.equal(c.beeK, 4, 'new bee: four plain choices');
  assert.equal(c.needles, 2); assert.equal(c.knob, 1, 'raver: two needles and a knob');
  assert.equal(c.layers, 7); assert.equal(c.fig, 7); assert.equal(c.pipe, 5, 'cypherpunk: axes, figures, a numbered pipeline');
});

test('bee: a plain choice writes through to the aid\'s own slider, and the answer follows', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etC1BeeK [data-k="1000"]'); await settle(p);
  const d = await p.evaluate(() => ({ k: document.getElementById('k').value, kVal: document.getElementById('kVal').textContent, D: window.__eternal.data, ans: document.getElementById('etC1BeeAnswer').textContent }));
  assert.equal(d.k, '1000'); assert.equal(d.kVal, '1,000', 'the aid\'s own label moved');
  near(d.D.ecW, want(1000).ecW, 'weighted at 1,000'); assert.match(d.ans, /at 1,000 pieces: about 0\.15/);
  assert.equal(await p.$eval('#etC1BeeK [data-k="1000"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: drag the knob to the start of the ring, the aid recomputes, the needle crosses under the bar', async () => {
  const { ctx, p, errs } = await open('raver');
  const knob = p.locator('#etC1Dial .et-knob circle.et-hit');
  await knob.scrollIntoViewIfNeeded();
  const b = await knob.boundingBox(), svg = await p.locator('#etC1Dial').boundingBox();
  // walk the knob round the ring, over the top, to the ring's start (225° anticlockwise from the right)
  const cx = svg.x + svg.width / 2, cy = svg.y + svg.height / 2, r = svg.width * 176 / 400;
  const kx = b.x + b.width / 2, ky = b.y + b.height / 2, from = Math.atan2(ky - cy, kx - cx) * 180 / Math.PI;
  await p.mouse.move(kx, ky); await p.mouse.down();
  for (const f of [0.8, 0.6, 0.4, 0.2, 0]) { const deg = (-225 + f * (from + 225)) * Math.PI / 180; await p.mouse.move(cx + r * Math.cos(deg), cy + r * Math.sin(deg)); }
  await p.mouse.up(); await settle(p);
  const d = await p.evaluate(() => ({ k: +document.getElementById('k').value, D: window.__eternal.data, card: document.getElementById('etC1Card').textContent }));
  assert.equal(d.k, 100, 'the knob wrote the aid\'s own #k'); near(d.D.ecW, want(100).ecW, 'weighted at 100');
  assert.equal(d.D.passW, true); assert.match(d.card, /under the bar/);
  await p.click('#etC1Grid [data-grid="96"]'); await settle(p);
  assert.equal(await p.evaluate(() => window.__c1aid.last.grid), 96, 'the aid\'s own grid toggle');
  assert.equal(await p.$eval('#g96', b => b.getAttribute('aria-pressed')), 'true');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: k= writes through; recompute re-runs the aid\'s own self-check and arithmetic', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.fill('#etC1K', '2000'); await p.press('#etC1K', 'Enter'); await p.locator('#etC1K').blur(); await settle(p);
  assert.equal(await p.$eval('#k', e => e.value), '2000');
  near(await p.evaluate(() => window.__eternal.data.ecW), want(2000).ecW, 'weighted at 2,000');
  await p.evaluate(() => { document.getElementById('selfcheck').textContent = 'stale'; });
  await p.click('#etC1CyGo'); await settle(p);
  assert.match(await p.textContent('#selfcheck'), /^SELF-CHECK PASS/, 'the aid\'s own selfCheck() ran again');
  assert.match(await p.textContent('#etC1Pipe'), /4\.03×10⁹.*pass/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
