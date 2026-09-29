// stack-eternal.test.mjs — the Engine Room as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal): "one engine diagram, honest parts included". Proves at 390 px:
// exactly one front per register, each in its own dress; all three carry the SAME facts, read from
// the page's own walls (the four tiers, the seven rails, the measured door table, the honest parts,
// the licensing rows, the data loop) and the live organ board, mirrored exactly as the board draws
// it; the honest parts are drawn in every register (the raver diagram keeps its scaffolding and the
// dashed relay rail); the one real action is the board's own re-read, and the fronts add no request
// of their own; the one real file comes from its receipt, or says it could not be read; and the laws
// hold (no dash for a value, no forced capitals, 44 px actions, nothing past the 390 px edge, motion
// paused on request and still under reduced motion).
// Run: node --test e2e/stack-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/stack.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/stack.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9168, ORIGIN = `http://127.0.0.1:${PORT}`;
const RECEIPT = JSON.parse(await readFile(join(ROOT, 'surfaces/stack-dataflow-example.json'), 'utf8'));
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
  // the estate's live relays are outside this box: the board must show them as guard, never red
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  if (opts.noReceipt) await ctx.route('**/stack-dataflow-example.json', r => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && !window.__eternal.data.asking && window.__eternal.data.fileState !== 'reading' && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(200);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etStCheck', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etStPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etStCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.vw <= 390, reg + ': the layout viewport stays at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the shape, the rails, the doors, the board as it reads', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      const key = k => t([...document.querySelectorAll('[data-i18n]')].find(e => e.dataset.i18n === k));
      return {
        wall: { tiers: all('#flow .tier').length, chips: all('#flow .tier .chip').map(t), board: all('#organBoard .organ').map(o => [t(o.querySelector('.oname')), t(o.querySelector('.oword'))]), count: t(document.getElementById('organCount')), hon: [key('st.hon.3'), key('st.hon.5')], stages: all('#flowLoop .fstage').length },
        tiers: D.tiers.map(x => x.title), rails: D.rails.map(r => r.glyph + ' ' + r.name), doors: D.doors.map(d => [d.doors.map(x => x.text), d.rails.map(x => x.k)]),
        honest: D.honest.map(h => h.said), loop: D.loop.length, licence: D.licence.map(l => l.licence), measured: D.measured,
        organs: D.organs.map(o => [o.name, o.word, o.cls]), alive: D.alive, autonomi: D.autonomi.length,
        bee: all('#etStLayers .et-b-row').map(t), beeHonest: t(document.getElementById('etStHonest')), beeLive: t(document.getElementById('etStLive')),
        arcs: all('#etStEngine .et-railg').map(g => g.getAttribute('aria-label')), dnodes: all('#etStEngine .et-door').length, beats: all('#etStEngine .et-beat').map(c => c.getAttribute('class').split(' ')[1]),
        scaffold: all('#etStEngine .et-scaf').length, dashedRelay: all('#etStEngine .et-r-social').length, rCard: t(document.getElementById('etStCard')),
        cTiers: all('#etStTiers li b').map(t), cOrgans: all('#etStOrgans tr').map(t), cDoors: all('#etStDoors tr').length, cDebt: t(document.getElementById('etStDebtTab')),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['tiers', 'rails', 'doors', 'honest', 'loop', 'licence', 'measured', 'organs', 'alive', 'autonomi']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.equal(a.tiers.length, a.wall.tiers); assert.equal(a.tiers.length, 4);
  assert.deepEqual(a.rails, a.wall.chips); assert.equal(a.rails.length, 7);
  assert.equal(a.doors.length, 7); assert.equal(a.measured, '2026-08-21'); assert.equal(a.loop, a.wall.stages); assert.equal(a.loop, 8);
  assert.deepEqual(a.licence, ['BUSL-1.1', 'Apache-2.0']); assert.equal(a.autonomi, 5);
  // the board, mirrored: the same eight organs with the same words and the same live count
  assert.deepEqual(a.organs.map(o => [o[0], o[1]]), a.wall.board); assert.equal(String(a.alive), a.wall.count);
  assert.deepEqual(a.organs.find(o => /pages/.test(o[0])).slice(1), ['alive', 'ok'], 'this origin answers');
  assert.ok(a.organs.filter(o => /hive|till/.test(o[0])).every(o => o[2] === 'guard'), 'a refused road is a guard, never red');
  // each register draws them: four layers, seven rails and seven door rows, eight heartbeats, the board's words
  assert.equal(a.bee.length, 4); assert.equal(facts.raver.arcs.length, 7); assert.equal(facts.raver.dnodes, 7);
  assert.deepEqual(facts.raver.beats, a.organs.map(o => 's-' + o[2]));
  a.rails.forEach((r, i) => assert.ok(facts.raver.arcs[i].startsWith(r)));
  assert.deepEqual(facts.cypherpunk.cTiers, a.tiers); assert.equal(facts.cypherpunk.cDoors, 7);
  facts.cypherpunk.cOrgans.forEach((row, i) => assert.ok(row.includes(a.organs[i][0]) && row.includes(a.organs[i][1])));
  assert.match(a.beeLive, new RegExp('^right now\\s*' + a.alive + ' of 4 watched parts answered'));
  // the honest parts, in every register, in the page's own words
  assert.deepEqual(a.honest, a.wall.hon);
  for (const h of a.honest) { assert.ok(a.beeHonest.includes(h), 'bee: ' + h); assert.ok(facts.raver.rCard.includes(h), 'raver: ' + h); assert.ok(facts.cypherpunk.cDebt.includes(h), 'cypherpunk: ' + h); }
  assert.equal(facts.raver.scaffold, 1, 'the scaffolding is drawn'); assert.equal(facts.raver.dashedRelay, 1, 'the relay rail is drawn dashed: the last planned migration');
});

test('the one real action is the board’s own re-read; the fronts add no request of their own', async () => {
  for (const [reg, sel] of [['bee', '#etStCheck'], ['raver', '#etStPill'], ['cypherpunk', '#etStCyGo']]) {
    const { ctx, p, errs } = await open(reg);
    await p.evaluate(() => { window.__rereads = 0; document.getElementById('reread').addEventListener('click', () => window.__rereads++); });
    const reqs = []; p.on('request', r => reqs.push(r.url()));
    await p.click(sel);
    assert.equal(await p.evaluate(() => window.__rereads), 1, reg + ': the board’s button was pressed');
    await p.waitForFunction(() => !window.__eternal.data.asking, null, { timeout: 15000 });
    await p.waitForTimeout(200);
    const own = reqs.filter(u => u.startsWith(ORIGIN) && !/\/surfaces\/index\.html$/.test(u));
    assert.deepEqual(own, [], reg + ': only the board’s own probes went out');
    assert.equal(await p.evaluate(() => String(window.__eternal.data.alive)), await p.textContent('#organCount'));
    assert.doesNotMatch(await p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent), /\b(healthy|all systems|operational|online|up and running)\b/i, 'no state the board did not say');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: tap a rail or a door to light its measured links; the heart and the pause', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etStEngine [data-sel="rail:ant"] path');
  assert.match(await p.textContent('#etStCard'), /Autonomi[\s\S]*1 door row runs on it: bIQ · bTranslated · bFactory · recover/);
  assert.equal(await p.$$eval('#etStEngine .et-chord.et-on', e => e.length), 1);
  await p.click('#etStEngine [data-sel="door:6"] circle');
  assert.match(await p.textContent('#etStCard'), /bFood[\s\S]*pure computation[\s\S]*zero-rail/);
  assert.equal(await p.$$eval('#etStEngine .et-chord.et-on', e => e.length), 0, 'a zero-rail door lights no rail');
  await p.click('#etStEngine [data-sel="rail:social"] path');
  assert.match(await p.textContent('#etStCard'), /last planned migration/);
  await p.click('#etStStill');
  assert.equal(await p.$eval('#etStEngine .et-chord.et-on', e => getComputedStyle(e).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  assert.equal(await still.p.$eval('#etStEngine .et-beat.s-ok', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: complete at first paint; the one real file is read from its receipt, or says it could not be', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ tiers: document.querySelectorAll('#etStTiers li').length, organs: document.querySelectorAll('#etStOrgans tr').length, doors: document.querySelectorAll('#etStDoors tr').length, file: document.getElementById('etStFile').textContent, debt: document.querySelectorAll('#etStDebtTab tr').length }));
  assert.deepEqual([d.tiers, d.organs, d.doors, d.debt], [4, 8, 7, 4]);
  assert.ok(d.file.includes(String(RECEIPT.file.bytes)) && d.file.includes(RECEIPT.quote.amountAnt + ' ANT') && d.file.includes(RECEIPT.file.sha256Short));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const off = await open('cypherpunk', { noReceipt: true });
  const t = await off.p.textContent('#etStFile');
  assert.match(t, /could not be read just now; no number is guessed/);
  assert.doesNotMatch(t, /214091829|4\.2459/);
  assert.equal(off.errs.length, 0, off.errs.join(' | ')); await off.ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('.et-b-row[data-tier="3"]');
    if (reg === 'raver') await p.click('#etStEngine [data-sel="door:1"] circle');
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
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
