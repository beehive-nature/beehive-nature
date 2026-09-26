// bfood-eternal.test.mjs — the bFood Hexagon as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its
// own dress; all three draw the SAME forty cells from the Hexagon's own render (window.__bfood) —
// the covered count, the floors and the not-measured cells agree with the instrument's #vbig; a
// not-measured cell is drawn empty and reads n/m, never 0; a changed body moves every register at
// once; and every gesture hands off to the page's own inputs (data-bfood-go, #age).
// Run: node --test e2e/bfood-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bfood.html> node --test e2e/bfood-eternal.test.mjs
const PAGE = 'bfood.html', PORT = 8966;
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
// ETERNAL_PAGE_FILE serves another copy of the page (e.g. `git show HEAD:surfaces/PAGE`) to prove the red
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

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#eternal .et-b-rows .et-b-row'), null, { timeout: 8000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g, ' ').trim()), sel);

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth, first: document.querySelector('main').firstElementChild.id };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.first, 'eternal', reg + ': the front leads the page');
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      for (const b of document.querySelectorAll('#eternal [aria-expanded="false"]')) if (b.offsetParent) b.click();
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /^null$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('non-value ' + el.tagName + ' ' + own.slice(0, 30));
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && r.right > innerWidth + 1) out.push('past the edge ' + el.tagName + '.' + el.className);
      }
      for (const a of fr.querySelectorAll('a[href^="http"]')) if (a.target !== '_blank' || a.rel !== 'noopener noreferrer') out.push('external link ' + a.href);
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});

async function facts(p) {
  return p.evaluate(() => {
    const D = window.__eternal.data, t = s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g, ' ').trim());
    const vbig = document.getElementById('vbig').textContent.match(/(\d+)\s*of\s*(\d+)/);
    return { vbig: [+vbig[1], +vbig[2]], met: D.met, cells: D.cells, count: D.count, n: D.cellsList.length,
      nmNames: D.cellsList.filter(x => x.state === 'nm').map(x => x.k), beeMet: t('#etBeeMet')[0], beeRows: t('#etBeeRows .et-b-row'),
      comb: [...document.querySelectorAll('#etComb [data-i]')].map(g => g.textContent.replace(/\s+/g, ' ').trim()),
      hint: t('#etRaverHint')[0], chips: t('#etChips span').join(' | '), pipe: t('#etPipe li').join(' | ') };
  });
}

test('the same forty cells in all three: covered, floors, not measured, and the instrument agrees', async () => {
  const f = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) { const { ctx, p } = await open(reg); f[reg] = await facts(p); await ctx.close(); }
  const a = f.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(f[reg].count, a.count, reg); assert.equal(f[reg].met, a.met); assert.deepEqual(f[reg].nmNames, a.nmNames); }
  assert.deepEqual([a.met, a.cells], a.vbig, 'the front counts what the instrument prints');
  assert.equal(a.n, 40); assert.equal(a.cells, 40);
  assert.equal(a.beeMet, `${a.met} of 40`);
  assert.ok(a.beeRows.includes(`covered ${a.count.met}`) && a.beeRows.includes(`not measured ${a.count.nm}`) && a.beeRows.includes(`at least this much ${a.count.floor}`), a.beeRows.join(' / '));
  assert.equal(f.raver.comb.length, 40, 'forty cells in the comb');
  assert.match(f.raver.hint, new RegExp(`^${a.met} of 40`));
  assert.match(f.cypherpunk.chips, new RegExp(`met ${a.met} \\| floor ≥ ${a.count.floor} \\| n/m ${a.count.nm}`));
  assert.match(f.cypherpunk.pipe, new RegExp(`${a.met} of 40 covered`));
  // the non-value states: every not-measured cell reads n/m and has no fill; every floor reads ≥
  const nm = await (async () => { const { ctx, p } = await open('raver'); const r = await p.evaluate(() => window.__eternal.data.cellsList.map((x, i) => {
    const g = document.querySelector(`#etComb [data-i="${i}"]`); return [x.state, x.floor, g.textContent, g.querySelectorAll('polygon').length]; })); await ctx.close(); return r; })();
  assert.ok(a.count.nm > 0, 'this basket has not-measured cells to prove the law on');
  for (const [state, floor, text, polys] of nm) {
    if (state === 'nm') { assert.match(text, /n\/m$/); assert.equal(polys, 1, 'not measured: an empty cell, no fill'); assert.doesNotMatch(text, /\b0%/); }
    else if (floor) assert.match(text, /≥\d+%$/);
  }
});

test('a changed body moves every register at once (the real inputs are the gesture)', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const before = await facts(p);
  await p.fill('#wt', '55'); await p.dispatchEvent('#wt', 'input'); await p.waitForTimeout(200);
  const after = await facts(p);
  assert.match(await p.textContent('#etPath'), /-55kg-/);
  assert.deepEqual([after.met, after.cells], after.vbig, 'still the instrument’s own count');
  assert.ok(JSON.stringify(after.count) !== JSON.stringify(before.count) || after.pipe !== before.pipe, 'the front re-drew from the new render');
  assert.match(after.pipe, /55 kg/);
  await p.click('#etCyEdit'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'age', 'edit hands off to the real inputs');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('new bee: plain rows open to the nutrients; the one action opens the body inputs', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-t="nm"]');
  const names = await p.evaluate(() => window.__eternal.data.cellsList.filter(x => x.state === 'nm').map(x => x.k));
  const open1 = (await txt(p, '#etBeeRows .et-b-open[data-t="nm"]'))[0];
  for (const n of names) assert.ok(open1.includes(n + ' · not measured'), n);
  assert.match(open1, /never zero/);
  await p.click('#etBeeGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bfood-beat')), 'inputs');
  assert.ok(await p.locator('#layer-inputs').isVisible(), 'the real inputs open');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a cell lights its nutrient; the pill opens the inputs; motion pauses with the room', async () => {
  const { ctx, p, errs } = await open('raver');
  const i = await p.evaluate(() => window.__eternal.data.cellsList.findIndex(x => x.state === 'nm'));
  const k = await p.evaluate(i => window.__eternal.data.cellsList[i].k, i);
  await p.click(`#etComb [data-i="${i}"]`);
  const card = await p.textContent('#etRaverCard');
  assert.ok(card.includes(k + ' · not measured'), card);
  assert.match(card, /no food here has a published number/);
  await p.click('#etRaverGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bfood-beat')), 'inputs');
  const still = await p.evaluate(() => { document.body.setAttribute('data-motion-paused', 'true'); const e = document.querySelector('#etComb .breathe'); return e ? getComputedStyle(e).animationPlayState : 'none'; });
  assert.ok(still === 'paused' || still === 'none');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
