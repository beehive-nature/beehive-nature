// resonance-eternal.test.mjs — Resonance (surfaces/fleet-hosted/gallery/resonance.html), the founder's
// piece, with three products above it (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted
// ruling: the piece, its Schumann canvas and its two charts keep working exactly). Proves at 390 px: one
// front per register in its own dress; the SAME seventeen states and the SAME model outputs in all three,
// read from the piece (HAWKINS, doSim) and from each front's DOM; honest gestures (a state opened in any
// register is opened in the piece by its own selectLevel(); every "what if" moves the piece's own sliders;
// the raver hold raises the count while held and stops on release); the piece's caution ("modelled
// projections, not proven causation") travels with every register; nothing stored or sent; the laws.
// Run: node --test e2e/resonance-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/gallery/resonance.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9183, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.levels.length && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const sim = p => p.evaluate(() => { const t = id => document.getElementById(id).textContent.trim(); return { c: +document.getElementById('consumerSlider').value, i: +document.getElementById('intakeSlider').value, consc: t('sim_consc'), shift: t('sim_shift'), anxiety: t('sim_anxiety'), name: t('hl_name') }; });
const store = p => p.evaluate(() => Object.keys(localStorage).filter(k => k !== 'bregister' && k !== 'blang').sort());

test('one front per register, each in its own dress; the piece keeps its own ground', async () => {
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
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(10, 10, 20)', reg + ': the piece keeps its own ground');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + `: no sideways page at 390 px (${d.wide}/${d.vw})`);
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same seventeen states and the same model in all three, read from the piece', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etBeeScale');
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        levels: D.levels.map(l => [l.level, l.name]), hawkins: HAWKINS.filter(h => !h.div).map(h => [h.level, h.name]), sim: D.sim, base: D.base, status: D.status, model: D.model.comment,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row[data-lv]')].map(r => [t(r.querySelector('span')), t(r.querySelector('small'))]),
        raver: { states: [...document.querySelectorAll('#etSpiral .et-st')].map(g => g.getAttribute('aria-label')), big: t(document.getElementById('etSpBig')) },
        cy: { scale: [...document.querySelectorAll('#etcScale tr.et-pick')].map(r => t(r.cells[0])), out: [...document.querySelectorAll('#etcOut tbody tr')].map(r => [t(r.cells[1]), t(r.cells[2])]) },
        text: t(document.querySelector('#eternal>' + ({ bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' })[document.body.getAttribute('data-reg')])),
      };
    });
    await ctx.close();
  }
  const b = seen.bee;
  assert.equal(b.levels.length, 17); assert.deepEqual(b.levels, b.hawkins, 'the states are the piece\'s own HAWKINS');
  assert.equal(b.base, '7.83 Hz'); assert.equal(b.sim.c, 600); assert.equal(b.sim.i, 25); assert.equal(b.sim.consc, '283', 'the piece\'s own doSim, live (its static markup said 285)');
  assert.match(b.model, /baseline consciousness 205/);
  assert.equal(b.status.projection, 'Correlations are modeled projections, not proven causation.');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].levels, b.levels, reg); assert.deepEqual(seen[reg].sim, b.sim, reg); assert.deepEqual(seen[reg].status, b.status, reg); }
  assert.equal(b.bee.length, 17, 'bee lists the seventeen');
  b.levels.forEach(([lv, nm], i) => assert.deepEqual(b.bee[i], [nm, String(lv)]));
  assert.equal(seen.raver.raver.states.length, 17); assert.equal(seen.raver.raver.big, b.sim.consc);
  assert.deepEqual(seen.cypherpunk.cy.scale.map(Number), b.levels.map(l => l[0]).sort((x, y) => y - x));
  assert.ok(seen.cypherpunk.cy.out.every(([pg, re]) => re === pg + ' ✓'), 'recomputed from doSim\'s constants, every output agrees: ' + JSON.stringify(seen.cypherpunk.cy.out));
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    assert.match(seen[reg].text, /not proven causation|does not prove a cause/, reg + ' carries the caution');
    assert.doesNotMatch(seen[reg].text, /\b(cure[sd]?|guarantee[sd]?|proves)\b/i, reg + ' says nothing stronger than the piece');
  }
});

test('bee: a state opens in the piece too; the what-if moves the piece\'s own sliders', async () => {
  const { ctx, p, errs } = await open('bee');
  const before = await store(p);
  await p.click('#etBeeScale'); await p.click('#etBeeRows .et-b-row[data-lv="3"]');
  assert.equal((await sim(p)).name, 'Love (500)', 'selectLevel ran in the piece');
  assert.match(await p.textContent('#etBeeRows .et-b-open'), /Not emotion but a way of being/);
  await p.click('#eternal .et-b [data-go="what"]');
  await p.click('[data-d="c:100"]'); await p.click('[data-d="c:100"]'); await p.click('[data-d="i:5"]');
  const s = await sim(p);
  assert.deepEqual([s.c, s.i], [800, 30]);
  assert.equal(s.consc, String(Math.round(205 + 800 * 0.13 * (30 / 25))), 'the piece\'s model answered');
  assert.ok((await p.textContent('#etBeeOut')).includes(s.consc) && (await p.textContent('#etBeeOut')).includes(s.anxiety));
  await p.click('#etBeeFull'); await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'consumerSlider', 'handed off to the full piece');
  assert.deepEqual(await store(p), before, 'nothing stored');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the hold raises the tide while held and stops on release; a tapped state opens in the piece', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etSpiral .et-st[data-lv="8"]', { force: true });
  assert.equal((await sim(p)).name, 'Courage (200)');
  assert.match(await p.textContent('#etSpCard'), /courage/);
  const hold = p.locator('#etSpHold'); await hold.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const bx = await hold.boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up();
  const a = await sim(p);
  assert.ok(a.c >= 700 && a.c <= 800, 'held for 1.3 s: +50M a step, one step each 400 ms: ' + a.c);
  await p.waitForTimeout(900);
  const b = await sim(p);
  assert.equal(b.c, a.c, 'released means stopped');
  assert.equal(await p.textContent('#etSpBig'), b.consc, 'the tide is the piece\'s own number');
  await p.click('#etSpReset');
  assert.deepEqual([(await sim(p)).c, (await sim(p)).i], [600, 25], 'back to the piece\'s own starting values');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: typed inputs run the page\'s model; a scale row opens the state in the piece', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.fill('#etcC', '1500'); await p.fill('#etcI', '50'); await p.click('#etcRun');
  const s = await sim(p);
  assert.deepEqual([s.c, s.i], [1500, 50]); assert.equal(s.consc, String(Math.round(205 + 1500 * 0.13 * 2)));
  const rows = await p.$$eval('#etcOut tbody tr', rs => rs.map(r => [r.cells[1].textContent, r.cells[2].textContent]));
  assert.ok(rows.every(([x, y]) => y === x + ' ✓'), JSON.stringify(rows));
  assert.match(await p.textContent('#etcOut'), /-40%/, 'the model\'s own cap on anxiety shows as the page shows it');
  await p.click('#etcScale tr.et-pick[data-lv="13"]');
  assert.equal((await sim(p)).name, 'Fear (100)');
  assert.match(await p.textContent('#etcScale'), /CBD is clinically shown to reduce fear\/anxiety/, 'the piece\'s own words, quoted, not strengthened');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') { await p.click('#etBeeScale'); await p.click('#etBeeRows .et-b-row[data-lv="0"]'); }
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target ' + el.getAttribute('aria-label'));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
