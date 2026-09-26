// onboarding-eternal.test.mjs — the first door as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register; each has its
// own dress, structure and gesture; all three carry the SAME facts (the page's own custody ladder,
// its key engine, the preview status, the zero start); and no gesture creates anything on its own —
// every "try it" hands off to the ceremony below (enterPlain), which keeps its own gauges.
// Run: node --test e2e/onboarding-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8954, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/onboarding/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ways.length === 4, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        graphic: !!fr.querySelector('svg.et-r-art .ring'), table: !!fr.querySelector('table.et-c-tab'), rows: !!fr.querySelector('.et-b-rows [role="radio"]') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    // three structures, not one column recoloured
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.graphic, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the four rungs and their costs, the engine, the preview, the zero start', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        model: D.ways.map(w => [w.id, w.cost, w.free]), engine: D.engine, words: D.words, ladder: LADDER.map(o => [o.id, o.cost, o.free]), realEngine: !!window.BZDIDKEY,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => [r.dataset.pick, r.querySelector('small').textContent]),
        beeTerms: document.querySelector('.et-b-step[data-step="know"]').textContent,
        rings: [...document.querySelectorAll('#etCell .ring')].map(g => [g.dataset.pick, g.getAttribute('aria-label')]),
        tiles: document.querySelector('#etTiles').textContent,
        table: [...document.querySelectorAll('#etLadder tr.pick')].map(r => [r.dataset.pick, r.children[2].textContent]),
        pipe: document.querySelector('#etPipe').textContent, receipt: document.querySelector('#etReceipt').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  // the data layer is the page's own ladder, and every register reads the same one
  assert.deepEqual(a.model, a.ladder, 'facts come from LADDER');
  assert.deepEqual(facts.raver.model, a.model); assert.deepEqual(facts.cypherpunk.model, a.model);
  assert.equal(a.engine, a.realEngine, 'engine fact is read, not declared');
  const ids = a.model.map(m => m[0]);
  assert.deepEqual(a.bee.map(r => r[0]), ids, 'bee rows'); assert.deepEqual(facts.raver.rings.map(r => r[0]), ids, 'raver rings'); assert.deepEqual(facts.cypherpunk.table.map(r => r[0]), ids, 'cypher rows');
  a.model.forEach(([id, cost, free], i) => {
    const plain = free ? 'free' : cost.replace(/^~/, '');
    assert.ok(a.bee[i][1].includes(plain), id + ' bee cost ' + a.bee[i][1]);
    assert.ok(facts.raver.rings[i][1].includes(free ? 'free' : cost), id + ' raver cost ' + facts.raver.rings[i][1]);
    assert.equal(facts.cypherpunk.table[i][1], cost.toLowerCase(), id + ' cypher cost');
  });
  // the preview and the zero start, in each register's own words
  assert.match(txt(a.beeTerms), /no account is made on this site/); assert.match(txt(a.beeTerms), /you start at 0 b/);
  assert.match(txt(facts.raver.tiles), /no account here/); assert.match(txt(facts.raver.tiles), /start at zero/);
  assert.match(txt(facts.cypherpunk.receipt), /account\s*none · preview site/); assert.match(txt(facts.cypherpunk.receipt), /balance\s*0 b/);
  assert.match(txt(facts.cypherpunk.pipe), new RegExp('recovery floor · ' + a.words + ' words'));
  assert.match(txt(facts.cypherpunk.receipt), a.engine ? /bzdid-key\.js present/ : /absent/);
});

test('bee: one question, then the one action hands off to the ceremony; nothing is made by a tap', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  assert.equal(await p.evaluate(() => APP.ctx.custody), null, 'nothing chosen at first paint');
  await p.click('.et-b-row[data-pick="optical"]');
  assert.equal(await p.getAttribute('.et-b-row[data-pick="optical"]', 'aria-checked'), 'true');
  await p.click('.et-b [data-go="know"]');
  assert.match(await p.textContent('.et-b-step[data-step="know"]'), /you chose a spare phone/);
  assert.equal(await p.evaluate(() => APP.ctx.custody), null, 'reading the terms changes nothing');
  await p.click('#etBeeGo'); await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ beat: document.body.getAttribute('data-onb-beat'), custody: APP.ctx.custody, screen: APP.current, instrument: getComputedStyle(document.getElementById('instrument')).display }));
  assert.deepEqual(d, { beat: 'deeper', custody: 'optical', screen: 'optical', instrument: 'flex' }, 'the real ceremony opens at the chosen rung');
  assert.equal(await p.$eval('.et-b-step[data-step="asked"]', e => e.hidden), false);
  assert.match(await p.textContent('.et-b-step[data-step="asked"]'), /nothing is made yet/);
  assert.deepEqual(outside, [], 'no request left the origin');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a ring, light all four, then the hold steps in; a short hold does nothing', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etCell .ring[data-pick="trezor"] .seg');
  assert.match(await p.textContent('#etRaverCard'), /r4\s*a trezor · \$79–249/);
  await p.click('#etCell .you');
  assert.equal(await p.$eval('#etHold', b => b.disabled), true, 'no hold before the four terms');
  for (const t of [1, 2, 3]) await p.click(`#etTiles button[data-t="${t}"]`);
  assert.match(await p.textContent('#etSealHint'), /3 of 4 lit/);
  await p.click('#etTiles button[data-t="4"]');
  assert.equal(await p.$eval('#etHold', b => b.disabled), false);
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'seal', 'a short hold does not step in');
  assert.equal(await p.evaluate(() => APP.ctx.custody), null);
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'in');
  assert.deepEqual(await p.evaluate(() => [APP.ctx.custody, document.body.getAttribute('data-onb-beat')]), ['trezor', 'deeper'], 'the full hold opens the real ceremony');
  assert.match(await p.textContent('#etRaverHint'), /nothing made yet/, 'a gesture never claims a wallet');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint, and a row picks the rung it runs', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etLadder tr.pick').length, steps: document.querySelectorAll('#etPipe li').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length }));
  assert.deepEqual(d, { rows: 4, steps: 6, now: 'custody · passkey', receipt: 7 });
  await p.click('#etLadder tr.pick[data-pick="key"]');
  assert.equal(await p.textContent('#etPipe li.now b'), 'custody · key');
  assert.match(await p.textContent('#etCyGo'), /run the ceremony · key/);
  await p.click('#etCyGo'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => [APP.ctx.custody, APP.current]), ['key', 'hardware'], 'hands off to the real hardware screen');
  const fork = await p.$eval('.et-c a[href*="github.com"]', a => [a.target, a.rel]);
  assert.deepEqual(fork, ['_blank', 'noopener noreferrer'], 'fork the template opens a new tab');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
