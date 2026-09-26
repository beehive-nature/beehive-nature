// hardware-lab-eternal.test.mjs — the lab as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its
// own dress; all three carry the SAME facts, read from the lab's own walls (the ethics law, the six
// Comb Score axes, each bench's unit disclosure and bars, the harness sentences, the gear table); no
// total is ever drawn, and the Art cell waits for its human; every harness claim names the source
// file and test it rests on, and says it is cited, not re-run (crypto-claims law: cite or say
// UNVERIFIED); the one action is reading the full review below; and the laws hold.
// Run: node --test e2e/hardware-lab-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/hardware/lab.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/hardware/lab.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9166, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''); if (rel.endsWith('/')) rel += 'index.html';
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.benches.length && document.body.dataset.reg, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etLbGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etLbPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etLbCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the lab’s own walls', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        wall: { discs: all('main .disc').map(t), widths: all('main .axes .bar i').map(i => parseFloat(i.style.width)), gear: all('main .gear tr td:first-child').map(t) },
        law: D.law, axes: D.axes, benches: D.benches.map(b => [b.name, b.unit, b.state, b.bars.map(x => [x.axis, x.pct, x.waiting]), b.claims.map(c => c.text), b.pending]), gear: D.gear.map(g => g.k),
        bee: all('#etLbBench .et-b-row').map(t), rDevs: all('#etLbDevs [data-dev]').map(t),
        petals: all('#etLbFlower .et-petal').map(g => [g.getAttribute('aria-label'), g.querySelectorAll('.et-fill').length]),
        cBench: all('#etLbBenchTab tr').map(t), cScore: all('#etLbScore tr').map(t), cClaims: t(document.getElementById('etLbClaims')), cLaw: all('#etLbLaw li').length, cGear: all('#etLbGear th').map(t),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['law', 'axes', 'benches', 'gear']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.equal(a.law.length, 5, 'five laws, as printed'); assert.deepEqual(a.axes, ['Openness', 'Air-gap', 'Custody law', 'Build', 'Art', 'Ecosystem fit']);
  assert.deepEqual(a.benches.map(b => b[1]), a.wall.discs, 'each bench carries its own unit disclosure');
  assert.deepEqual(a.benches.map(b => b[2]), ['bench', 'slot', 'queued']);
  assert.deepEqual(a.benches[0][3].map(b => b[1]), a.wall.widths, 'the bars are the page’s own widths');
  assert.deepEqual(a.benches[0][3].find(b => b[0] === 'Art'), ['Art', 0, true], 'the art cell waits for its human');
  assert.equal(a.benches[0][4].length, 3); assert.equal(a.benches[0][5].length, 3);
  assert.deepEqual(a.gear, a.wall.gear);
  // bee rows, raver chips, cypherpunk table: the same three benches with their states
  a.benches.forEach(([name], i) => { assert.ok(a.bee[i].includes(name)); assert.equal(facts.raver.rDevs[i], name); assert.ok(facts.cypherpunk.cBench[i].includes(name)); });
  // raver petals: six cells, filled exactly where a bar is non-zero; never a total
  assert.equal(facts.raver.petals.length, 6);
  assert.deepEqual(facts.raver.petals.map(p => p[1]), a.axes.map(ax => { const b = a.benches[0][3].find(x => ax.startsWith(x[0])); return b && b[1] && !b[2] ? 1 : 0; }));
  assert.ok(facts.raver.petals.every(p => !/total|average/i.test(p[0])));
  facts.cypherpunk.cScore.forEach((row, i) => assert.ok(row.startsWith(a.axes[i]), 'score row ' + i));
  assert.equal(facts.cypherpunk.cLaw, 5); assert.deepEqual(facts.cypherpunk.cGear, a.gear);
});

test('every harness claim names the file and test it rests on, cited, not re-run', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const claims = await p.evaluate(() => window.__eternal.data.benches[0].claims.map(c => ({ text: c.text, files: c.src && c.src.files })));
  assert.equal(claims.length, 3);
  for (const c of claims) {
    assert.ok(c.files && c.files.length, 'a source for: ' + c.text);
    for (const f of c.files) await access(join(ROOT, f.split(' · ')[0])); // every cited file exists in this tree
  }
  const rust = await readFile(join(ROOT, 'rust/bsafe-host/thp/src/lib.rs'), 'utf8');
  assert.match(rust, /fn noise_xx_handshake_transport_and_tamper_refusal\(/, 'the cited test function exists');
  const kb = await readFile(join(ROOT, 'key-build/bdid-key/test/test.mjs'), 'utf8');
  assert.equal((kb.match(/^\s*(ok|throws)\(/gm) || []).length, 26, 'the key-build file holds the 26 checks the page reports');
  const txt = await p.textContent('#etLbClaims');
  assert.equal((txt.match(/cited, not re-run here/g) || []).length, 3);
  assert.equal((txt.match(/pending · no result yet/g) || []).length, 3);
  assert.doesNotMatch(await p.textContent('#eternal'), /\bverified by this page\b|\bre-run: pass/i);
  assert.equal(await p.$eval('#etLbCyGo', a => [a.target, a.rel].join(' ')), '_blank noopener noreferrer');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the one action is reading the review below; raver cells light, the art cell says it waits', async () => {
  const b = await open('bee');
  assert.equal(await b.p.$eval('#etLbGo', a => a.getAttribute('href')), '#etBench1');
  await b.p.click('.et-b-row[data-bench="2"]');
  assert.match(await b.p.textContent('#etLbBench .et-b-open'), /not yet received[\s\S]*no tests yet[\s\S]*not written yet/);
  assert.equal(await b.p.$eval('#etLbGo', a => a.getAttribute('href')), '#etBench2');
  await b.p.click('#etLbGo'); await b.p.waitForTimeout(300);
  assert.ok(await b.p.$eval('#etBench2', e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'the review is on screen');
  await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  await p.click('#etLbFlower [data-axis="4"] polygon');
  assert.match(await p.textContent('#etLbCard'), /Art[\s\S]*awaiting the human/);
  await p.click('#etLbFlower [data-axis="0"] polygon');
  assert.match(await p.textContent('#etLbCard'), /92%[\s\S]*Openness/);
  await p.click('#etLbStill');
  assert.equal(await p.$eval('#etLbFlower .et-petal[aria-pressed="true"] .et-fill', e => getComputedStyle(e).animationPlayState), 'paused');
  await p.click('[data-dev="1"]');
  assert.equal(await p.$$eval('#etLbFlower .et-fill', e => e.length), 0, 'an unscored device draws no fill');
  assert.equal(await p.$eval('#etLbPill', a => a.getAttribute('href')), '#etBench2');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  await still.p.click('#etLbFlower [data-axis="1"] polygon');
  assert.equal(await still.p.$eval('#etLbFlower .et-petal[aria-pressed="true"] .et-fill', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'raver') await p.click('#etLbFlower [data-axis="2"] polygon');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null)$/.test(own)) out.push('value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('edge ' + el.tagName + ' ' + Math.round(r.right));
      }
      if (document.documentElement.scrollWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
