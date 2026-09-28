// blend-lab-eternal.test.mjs — the blend lab (surfaces/fleet-hosted/lab/blend-lab.html), the founder's tobacco
// blending calculator (DATA, PRESETS, a radar chart, cost per pack against a fixed $12.00), with three products
// above it (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the lab stays exactly as made,
// 0 lines removed; fleet-pixels stays green). Proves at 390 px: one front per register in its own dress; the SAME
// blend in all three, set through each register's own gesture on the lab's own recipe button, recomputed from
// DATA and equal to what doUpdate() prints and charts; honest gestures (a recipe is the lab's own button, a batch
// size its own select, a pour its own gram input; nothing is stored or sent); the lab below still works and moves
// the fronts; an empty batch says so plainly; the laws.
// Run: node --test e2e/blend-lab-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/blend-lab.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9214, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.install();
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.getAttribute('data-reg') && window.myChart, null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const bus = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')).sort()));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|[\s·(])[—–](?=$|[\s·)])/.test(own) || /\b(undefined|NaN|null|Infinity)\b/.test(own)) out.push('value "' + own + '" in ' + (el.id || el.className));
    const r = el.getBoundingClientRect();
    if (r.width && r.right > 390.5) out.push('past 390: ' + (el.id || el.tagName) + ' ' + Math.round(r.right));
    if (/^(BUTTON|A|SELECT|LABEL)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'checkbox')) { if (r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20))); }
  }
  return out;
});
// PRESETS.black from the lab's source: virginia 35, burley 40, turkish 10, perique 15
const G = { virginia: 35, burley: 40, turkish: 10, perique: 15 }, P = { virginia: 21.99, burley: 22.99, turkish: 21.99, perique: 47.98 };
const COST = Object.keys(G).reduce((a, k) => a + G[k] * P[k] / 454, 0), PACK = COST / 111 * 20;
const BLACK = { total: '100g', cigs: '111', pack: '$' + PACK.toFixed(2), cost: '$' + COST.toFixed(2), save: Math.round((12 - PACK) / 12 * 100) + '%' };

test('one front per register in its own dress; the lab keeps its own ground; the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(26, 26, 46)', reg + ': the lab keeps its own ground (#1a1a2e)');
    assert.deepEqual(await laws(p), [], reg);
    if (reg === 'raver') { await p.click('#etSunLeaves [data-s="perique"]'); assert.deepEqual(await laws(p), [], 'raver leaf card'); }
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same blend in all three: each register presses the lab\'s own recipe, and the figures equal what the lab prints and charts', async () => {
  const via = { bee: '#etBeeRecipes [data-p="black"]', raver: '#etSunRecipes [data-p="black"]', cypherpunk: '#etcPresets [data-p="black"]' };
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await p.click(via[reg]);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        D: { total: D.total, profile: D.profile, cigs: D.cigs, cost: D.cost, pack: D.pack, save: D.save, ref: D.ref, preset: D.preset, agree: D.agree, page: D.page, want: D.want },
        lab: [document.getElementById('recipe_name').value, ...['virginia', 'burley', 'turkish', 'perique', 'firecured', 'darkair'].map(k => document.getElementById('g_' + k).value)],
        bee: [...document.querySelectorAll('#etBeeSum .et-b-row>small')].map(t),
        raver: { legend: [...document.querySelectorAll('#etSunLegend span')].map(t), rays: document.querySelectorAll('#etSun .et-sun-ray').length, rim: document.querySelectorAll('#etSun .et-sun-rim').length, pack: t(document.getElementById('etSunPack')) },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 8).map(r => t(r.cells[1])),
      };
    });
    assert.equal(await bus(p), '[]', reg + ': nothing stored');
    await ctx.close();
  }
  const D = seen.bee.D;
  assert.deepEqual(seen.bee.lab, ['AS Black', '35', '40', '10', '15', '0', '0'], 'the lab\'s own doPreset() ran');
  assert.equal(D.preset, 'black'); assert.equal(D.agree, true, 'the front recomputes what doUpdate() prints and myChart draws'); assert.equal(D.ref, 12);
  assert.deepEqual([D.page.total, D.page.cigs, D.page.pack, D.page.cost, D.page.save], [BLACK.total, BLACK.cigs, BLACK.pack, BLACK.cost, BLACK.save]);
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].D, D, reg + ' reads the same blend'); assert.deepEqual(seen[reg].lab, seen.bee.lab); }
  assert.deepEqual(seen.bee.bee, ['100 g', '111', BLACK.pack, BLACK.save.replace('%', '% less'), BLACK.cost]);
  assert.deepEqual(seen.raver.raver.legend, ['sweetness', 'body', 'spice', 'strength', 'smokiness', 'aroma'].map((k, i) => k + ' ' + D.profile[i].toFixed(1)));
  assert.equal(seen.raver.raver.rays, 6); assert.equal(seen.raver.raver.rim, 4, 'a rim arc for each leaf in the batch'); assert.equal(seen.raver.raver.pack, BLACK.pack + ' a pack');
  assert.equal(seen.cypherpunk.cy.length, 8); for (const c of seen.cypherpunk.cy) assert.match(c, /✓$/, c);
});

test('honest gestures: a pour is the lab\'s own gram input; a batch size is its own select; nothing is stored', async () => {
  let o = await open('raver');
  await o.p.click('#etSunLeaves [data-s="darkair"]');
  assert.equal(await o.p.inputValue('#g_darkair'), '0', 'a tap only chooses');
  await o.p.dispatchEvent('#etSunLeaves [data-s="darkair"]', 'pointerdown'); await o.p.clock.runFor(450 + 400 * 3 + 50); await o.p.dispatchEvent('#etSunLeaves [data-s="darkair"]', 'pointerup');
  assert.equal(await o.p.inputValue('#g_darkair'), '3', 'three pours of 1 g, into the lab\'s own input');
  assert.equal(await o.p.textContent('#show_total'), '103g', 'and the lab re-ran doUpdate()');
  assert.equal(await o.p.evaluate(() => window.__eternal.data.agree), true);
  assert.equal(await bus(o.p), '[]'); assert.deepEqual(o.outside, []); await o.ctx.close();
  o = await open('bee');
  await o.p.click('#etBeeBatch [data-b="200"]');
  assert.deepEqual(await o.p.evaluate(() => [document.getElementById('batch_size').value, document.getElementById('show_total').textContent, document.getElementById('g_virginia').value]), ['200', '200g', '100'], 'the lab\'s own doScale() ran');
  assert.match(await o.p.textContent('#etBeeBatch [aria-pressed="true"]'), /to 200 g/);
  assert.equal(await bus(o.p), '[]'); assert.deepEqual(o.outside, []); await o.ctx.close();
  o = await open('cypherpunk');
  await o.p.fill('#etcLeaves input[data-g="firecured"]', '20'); await o.p.dispatchEvent('#etcLeaves input[data-g="firecured"]', 'change');
  assert.equal(await o.p.inputValue('#g_firecured'), '20'); assert.equal(await o.p.textContent('#show_total'), '120g');
  assert.match(await o.p.textContent('#etcQuote'), /batch_size reads 100 g but the batch weighs 120 g/);
  assert.equal(await o.p.evaluate(() => window.__eternal.data.agree), true);
  assert.deepEqual(o.outside, []); await o.ctx.close();
});

test('the lab below is untouched and moves the fronts; an empty batch says so plainly in all three', async () => {
  let o = await open('bee');
  assert.equal(await o.p.evaluate(() => document.querySelector('body>#etArchive').nextElementSibling.className), 'header');
  await o.p.click('.btn[onclick="doPreset(\'midnight\')"]');
  assert.equal(await o.p.evaluate(() => window.__eternal.data.preset), 'midnight', 'the front follows the lab\'s own recipe');
  assert.match(await o.p.textContent('#etBeeRecipes [aria-pressed="true"]'), /Midnight/);
  assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    o = await open(reg);
    await o.p.evaluate(() => { for (const i of document.querySelectorAll('.card input[type="number"]')) { i.value = '0'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    const d = await o.p.evaluate(() => ({ D: window.__eternal.data, leaves: document.getElementById('etBeeLeaves').textContent, card: document.getElementById('etSunCard').textContent }));
    assert.deepEqual([d.D.total, d.D.cigs, d.D.pack, d.D.save, d.D.agree], [0, 0, 0, 0, true]);
    if (reg === 'bee') assert.match(d.leaves, /no leaves in the batch yet/);
    if (reg === 'raver') assert.match(d.card, /an empty sun, honestly/);
    assert.deepEqual(await laws(o.p), [], reg + ' empty batch');
    assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
  }
});
