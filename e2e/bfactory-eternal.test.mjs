// bfactory-eternal.test.mjs — the bFactory (a ratified design, nothing built) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: the design bar and the
// farmer-first law keep their page-one place above the fronts; exactly one front per register, each in
// its own dress; three different products (bee: the plan as four plain steps, three open questions and a
// plain split; raver: the loop as a wheel around a harvest fan whose petals are the split; cypherpunk: the
// loop table, the split matrix, the layers, the gates and the checks); the SAME facts in all three (the
// page's own LOOP and PLANS, its gates and layers); honest gestures (choosing a demand signal draws the
// split through the page's own function, both ways; every register says "illustrative, not measured"
// and nothing built; nothing leaves the page); raver motion that pauses and is still under reduced
// motion; and the laws (no dash for a value, no forced capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/bfactory-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/bfactory.html`> node --test e2e/bfactory-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/bfactory.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9244, ORIGIN = `http://127.0.0.1:${PORT}`;
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

async function open(reg, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.plans.length, null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const front = p => p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /^(undefined|NaN|null)$|\bNaN\b|\[object/.test(own)) out.push('junk ' + el.tagName + ' ' + own.slice(0, 30));
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') { if (r.height < 43.5 || r.width < 43.5) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 24)); }
    if (r.width && r.right > 390.5) out.push('offside ' + el.tagName + ' ' + (el.className.baseVal ?? el.className) + ' ' + Math.round(r.right));
  }
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
  return out;
});
// the page's own split, as drawn below the fronts
const pageSplit = p => p.evaluate(() => ({ on: (document.querySelector('main [data-plan].on') || {}).dataset?.plan, first: document.querySelector('#split .splitrow .lbl').textContent.replace(/\s+/g, ' ').trim() }));

test('the law keeps page one; one front per register, each in its own dress; the laws hold', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '.et-b [data-go="split"]', action: 'rgb(168, 35, 140)', shape: [7, 0, 0] },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#eternal .et-r-pill', action: 'rgb(214, 85, 187)', shape: [0, 8, 0] },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etFaCyGo', action: 'rgb(69, 194, 220)', shape: [0, 0, 4] },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), ev = document.getElementById('eternal');
      const before = el => !!(el.compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor,
        law: before(document.getElementById('designbar')) && before(document.getElementById('farmerlaw')),
        shape: [fr.querySelectorAll('.et-b-row').length, fr.querySelectorAll('svg [role="button"]').length, fr.querySelectorAll('table').length] };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.law, 'the design bar and the farmer-first law stay above the fronts');
    assert.deepEqual(d.shape, w.shape, reg + ': its own structure');
    assert.deepEqual(await laws(p), [], reg + ' laws');
    assert.deepEqual(out, [], reg + ': nothing leaves the page'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the page\'s own loop, plans, gates and layers', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('.et-b [data-go="split"]');
    seen[reg] = await p.evaluate(() => ({ D: JSON.parse(JSON.stringify(window.__eternal.data)), page: JSON.parse(JSON.stringify(window.BFACTORY.plans)),
      text: [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '),
      petals: [...document.querySelectorAll('#etBfWheel .et-petal')].map(g => g.getAttribute('aria-label')) }));
    await ctx.close();
  }
  const D = seen.bee.D;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ': one data layer');
  assert.equal(D.built, false); assert.equal(D.telemetry, 'none'); assert.equal(D.illustrative, true);
  assert.equal(D.loop.length, 4); assert.equal(D.gates.length, 3); assert.deepEqual(D.gates.map(g => g.id), ['BF-1', 'BF-2', 'BF-3']);
  assert.equal(D.layers.length, 6); assert.equal(D.honesty.length, 3); assert.equal(D.current, 'dual');
  // the plans are the page's own PLANS object, untouched
  for (const pl of D.plans) { assert.deepEqual(pl.rows.map(r => [r.name, r.pct]), seen.bee.page[pl.key].map(r => [r[0], r[1]])); assert.equal(pl.sum, 100); }
  const dual = D.plans.find(x => x.key === 'dual');
  for (const r of dual.rows) {
    assert.ok(seen.bee.text.includes(r.name) && seen.bee.text.includes(r.pct + '%'), 'bee legend ' + r.name);
    assert.ok(seen.raver.petals.includes(`${r.name}: ${r.pct}%, illustrative`), 'raver petal ' + r.name);
    assert.ok(seen.cypherpunk.text.includes(r.name), 'cypherpunk matrix ' + r.name);
  }
  assert.match(seen.cypherpunk.text, /46%/); assert.match(seen.cypherpunk.text, /44%/); assert.match(seen.cypherpunk.text, /not in plan/);
  // nothing built, nothing measured, in every voice
  assert.match(seen.bee.text, /not a measured yield/); assert.match(seen.raver.text, /not a measured yield/); assert.match(seen.cypherpunk.text, /built: none/);
  assert.match(seen.cypherpunk.text, /splits illustrative/);
});

test('honest gestures: a demand signal draws the page\'s own split, both ways, and nothing leaves', async () => {
  for (const [reg, sel] of [['bee', '#etFaBeeSeg [data-plan-front="seed"]'], ['raver', '#etFaSeeds [data-plan-front="seed"]'], ['cypherpunk', '#etFaCySeg [data-plan-front="seed"]']]) {
    const { ctx, p, errs, out } = await open(reg);
    assert.equal((await pageSplit(p)).on, 'dual');
    if (reg === 'bee') await p.click('.et-b [data-go="split"]');
    await p.click(sel);
    const s = await pageSplit(p);
    assert.equal(s.on, 'seed', reg + ': the page\'s own plan button is now on'); assert.match(s.first, /^▪ seed — 44% of harvested mass/);
    assert.equal(await p.getAttribute(sel, 'aria-pressed'), 'true');
    // and the page's own button moves the front back
    await p.click('main [data-plan="fibre"]');
    await p.waitForFunction(() => window.__eternal.data.current === 'fibre');
    const t = await front(p);
    if (reg === 'raver') assert.match(t, /fibre-led: bast fibre leads at 46%/);
    if (reg === 'cypherpunk') assert.match(await p.textContent('#etFaCyGo'), /draw fibre-led in the page's split/);
    if (reg === 'bee') assert.equal(await p.getAttribute('#etFaBeeSeg [data-plan-front="fibre"]', 'aria-pressed'), 'true');
    assert.doesNotMatch(t, /\b(verified|measured yield of|built and running)\b/i);
    assert.deepEqual(out, []); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  // cypherpunk's primary draws the chosen plan and brings the page's split into view
  const { ctx, p } = await open('cypherpunk');
  await p.click('#etFaCySeg [data-plan-front="fibre"]'); await p.click('#etFaCyGo');
  assert.equal((await pageSplit(p)).on, 'fibre');
  assert.ok(await p.evaluate(() => { const r = document.getElementById('split').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'the split is in view');
  await ctx.close();
});

test('raver: petals and stages answer a tap; the wheel pauses and is still under reduced motion', async () => {
  let { ctx, p, errs } = await open('raver');
  await p.$eval('#etBfWheel', e => e.scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  // tap where the petal's own figure sits (a wedge's box centre can fall outside the wedge)
  await p.locator('#etBfWheel .et-petal text').first().click({ force: true });
  assert.equal(await p.$eval('#etBfWheel .et-petal', g => g.getAttribute('aria-pressed')), 'true', 'the tap landed');
  assert.match(await p.textContent('#etFaCard'), /of harvested mass.*illustrative shape, not a measured yield/);
  await p.locator('#etBfWheel .et-stage[data-sel="s4"] text').click({ force: true });
  assert.match(await p.textContent('#etFaCard'), /DELIVER \+ MEASURE.*re-docks/);
  const play = () => p.$eval('#etBfWheel .et-sweep', e => getComputedStyle(e).animationPlayState);
  assert.equal(await play(), 'running');
  await p.click('#etFaStill'); assert.equal(await play(), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  ({ ctx, p } = await open('raver', { reduced: true }));
  assert.equal(await p.$eval('#etBfWheel .et-sweep', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await ctx.close();
});
