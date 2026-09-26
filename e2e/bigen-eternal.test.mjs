// bigen-eternal.test.mjs — BiGen, the evidence library, as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; all three draw the SAME verdicts from the library's own claim table
// (window.__bigen: ROWS, ROWS2, GM, REG) — no register pools, re-grades or drops a claim; the empty
// cells stay first-class; and every gesture hands off to the library's own beats or to a source
// in a new tab. Run: node --test e2e/bigen-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bigen.html> node --test e2e/bigen-eternal.test.mjs
const PAGE = 'bigen.html', PORT = 8965;
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

test('the same verdicts in all three: counts, petals, rows, the empty cells, the sweep', async () => {
  const f = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    f[reg] = await p.evaluate(() => {
      const B = window.__bigen, D = window.__eternal.data, t = s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g, ' ').trim());
      const count = rows => rows.reduce((a, r) => (a[r.t] = (a[r.t] || 0) + 1, a), {});
      return {
        truth: [count(B.ROWS), count(B.ROWS2), B.ROWS.length, B.ROWS2.length, Object.keys(B.SRC).length, B.REG.swept, B.REG.flagged, B.REG.manual],
        data: [D.exhibits[0].tiers, D.exhibits[1].claims.length, D.gapEmpty, D.gapCells, D.sources],
        beeRows: t('#etBeeRows .et-b-row'), petals: document.querySelectorAll('#etWheel [data-i]').length,
        claims: t('#etClaims tr.pick'), receipt: t('#etReceipt tr').join(' | '), gap: t('#etGap td').join(' '),
        foot: t('#etBeeFoot')[0],
      };
    });
    await ctx.close();
  }
  const a = f.bee;
  assert.deepEqual(f.raver.truth, a.truth); assert.deepEqual(f.cypherpunk.truth, a.truth);
  assert.deepEqual(f.raver.data, a.data); assert.deepEqual(f.cypherpunk.data, a.data);
  const [c1, , n1, n2, nsrc, swept, flagged, manual] = a.truth;
  // new bee: one plain row per verdict, carrying the table's own count
  const word = { sup: 'supported', mix: 'mixed', unt: 'untested', ref: 'refuted', runiv: 'refuted as universal' };
  for (const [tier, n] of Object.entries(c1)) assert.ok(a.beeRows.includes(`${word[tier]} ${n} ${n === 1 ? 'claim' : 'claims'}`), tier + ' row: ' + a.beeRows.join(' / '));
  assert.ok(a.beeRows.includes('the empty cells 3 of 6'), 'the empty cells are a row, not an omission');
  assert.equal(a.data[2], 3); assert.equal(a.data[3], 6);
  // raver: one petal per claim; cypherpunk: one table row per claim, tier named as the library names it
  assert.equal(f.raver.petals, n1, 'one petal per claim');
  assert.equal(f.cypherpunk.claims.length, n1);
  const B = await (async () => { const { ctx, p } = await open('cypherpunk'); const r = await p.evaluate(() => window.__bigen.ROWS.map(r => [r.cl, window.__bigen.TIER[r.t].n.toLowerCase(), r.s.length])); await ctx.close(); return r; })();
  B.forEach(([cl, tier, n], i) => { assert.ok(f.cypherpunk.claims[i].includes(cl), 'claim ' + i); assert.ok(f.cypherpunk.claims[i].includes(`${tier} · src ${n}`), 'tier ' + i + ': ' + f.cypherpunk.claims[i]); });
  assert.match(f.cypherpunk.receipt, new RegExp(`${swept} swept / ${flagged} flagged / ${manual} manual watch`));
  assert.match(f.cypherpunk.receipt, /pooled never rendered/);
  assert.match(f.cypherpunk.receipt, new RegExp(`001 ${n1} · 002 ${n2}`));
  assert.equal((f.cypherpunk.gap.match(/empty/g) || []).length, 3, 'three empty cells, named');
  assert.match(a.foot, /2026-08-19/);
  assert.equal(nsrc, 19);
});

test('new bee: the one action opens the library’s own map; the link goes to the instrument', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-t="unt"]');
  const open1 = await txt(p, '#etBeeRows .et-b-open[data-t="unt"] p');
  assert.ok(open1.some(s => /no study has asked this yet/.test(s)), 'an untested claim with no source says so plainly');
  await p.click('#etBeeGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bigen-beat')), 'map', 'hands off to the map beat');
  assert.ok(await p.locator('#layer-map').isVisible(), 'the real map opens');
  await p.click('#etBeeDeeper'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bigen-beat')), 'deeper');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a petal lights its claim; the exhibit switch redraws the wheel; the heart stays empty', async () => {
  const { ctx, p, errs } = await open('raver');
  const rows = await p.evaluate(() => window.__bigen.ROWS.map(r => r.cl));
  await p.click('#etWheel [data-i="2"]');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 2);
  assert.ok((await p.textContent('#etRaverCard')).includes(rows[2]), 'the lit petal is the claim it stands for');
  assert.equal(await p.getAttribute('#etWheel [data-i="2"]', 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etWheel'), /no pooled\s*number/, 'the heart is empty on purpose');
  await p.click('#etExhibits [data-ex="1"]');
  assert.equal(await p.locator('#etWheel [data-i]').count(), await p.evaluate(() => window.__bigen.ROWS2.length));
  await p.click('#etRaverGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bigen-beat')), 'map');
  const still = await p.evaluate(() => { document.body.setAttribute('data-motion-paused', 'true'); const e = document.querySelector('#etWheel .breathe'); return e ? getComputedStyle(e).animationPlayState : 'none'; });
  assert.ok(still === 'paused' || still === 'none', 'motion pauses with the room');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and runnable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ path: document.getElementById('etPath').textContent, steps: document.querySelectorAll('#etPipe li').length,
    guard: document.querySelectorAll('#etPipe li.guard').length, q: document.getElementById('etQuery').href, rel: document.getElementById('etQuery').rel, target: document.getElementById('etQuery').target,
    reg: window.__bigen.REG.query }));
  assert.match(d.path, /^bigen:\/\/evidence-maps\/cannabis-cancer\.yaml$/);
  assert.equal(d.steps, 6); assert.equal(d.guard, 1, 'the no-pooling render step is the guard');
  assert.equal(d.q, 'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(d.reg), 'the button runs the library’s own standing query');
  assert.equal(d.target, '_blank'); assert.equal(d.rel, 'noopener noreferrer');
  await p.click('#etClaims tr.pick[data-i="0"]');
  assert.equal(await p.$eval('#etClaims tr.more[data-i="0"]', e => e.hidden), false, 'a claim opens to its sources');
  assert.ok(await p.locator('#etClaims tr.more[data-i="0"] a[href*="pubmed"]').count() >= 1);
  await p.click('#etSeg [data-ex="1"]');
  assert.match(await p.textContent('#etPath'), /cannabinoid-panel-undercount/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
