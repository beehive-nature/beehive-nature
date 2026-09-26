// comb-eternal.test.mjs — the comb as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). The comb is canon geometry with ONE renderer at every zoom, so this proves,
// at 390 px: exactly one front per register, each in its own dress and structure; every front draws
// through the page's one renderer (window.__comb: one drawCell in the source, the same palette on the
// canvas, the stage's own census still reported); all three carry the SAME facts — the frame fill from
// the renderer's own state() and equal to the stage HUD's own numbers, the canon read from the page's
// own words, the bills from the verifier's own census; the gestures only move cameras (tap dives,
// hold rises, a tapped cell is the cell the renderer has there); the clock pauses and is still under
// reduced motion. Run: node --test e2e/comb-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9158, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });
const HTML = await readFile(join(ROOT, 'surfaces/comb.html'), 'utf8');

async function open(reg, { motion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/comb.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.audit.state === 'done', null, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
// the comb-shot bucket law, on any canvas: sealed gold, honey amber, nectar cyan
const buckets = (p, id) => p.evaluate(id => {
  const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = { nectar: 0, honey: 0, capped: 0 };
  for (let i = 0; i < d.length; i += 16) { const R = d[i], G = d[i + 1], B = d[i + 2];
    if (R > 200 && G > 170 && B < 90 && R - B > 120) b.capped++; else if (R > G && G > B && R > 110 && R - B > 60) b.honey++; else if (B > G && G > R && B > 35) b.nectar++; }
  return b;
}, id);

test('one front per register, each in its own dress and structure', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      const vis = s => { const e = fr.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: vis('#etCbRows .et-b-row'), art: vis('canvas#etCbRaver') && fr.querySelectorAll('#etCbKey canvas').length === 3, bench: vis('#etCbCanon tr') && fr.querySelectorAll('#etCbPipe li').length === 6 };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.art, reg === 'raver'); assert.equal(d.bench, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('one renderer at every zoom, in every front: no second drawCell, the same palette on every canvas', async () => {
  assert.equal(HTML.match(/function drawCell\(/g).length, 1, 'the geometry is drawn by one function in the whole page');
  assert.equal(HTML.match(/function state\(/g).length, 1); assert.equal(HTML.match(/function h01\(/g).length, 1);
  const ids = { bee: 'etCbBee', raver: 'etCbRaver', cypherpunk: 'etCbCy' };
  for (const [reg, id] of Object.entries(ids)) {
    const { ctx, p } = await open(reg);
    const b = await buckets(p, id), s = await p.evaluate(r => { const v = window.__eternal.views[r]; return [v.stats.exact, v.stats.nectar, v.stats.honey, v.stats.capped]; }, reg);
    assert.ok(b.capped > 40 && b.honey > 40 && b.nectar > 40, reg + ': the front canvas carries all three states in the renderer\'s palette ' + JSON.stringify(b));
    assert.ok(s[0] > 0 && s[1] > 0 && s[2] > 0 && s[3] > 0, reg + ': the renderer counted the cells it drew for this front');
    const main = await p.evaluate(() => window.__combStats);
    assert.ok(main.exact > 0 && main.nectar > 0 && main.honey > 0 && main.capped > 0, 'the stage still reports its own census');
    await ctx.close();
  }
});

test('the same facts in all three: the frame fill (the HUD\'s own numbers), the canon, the bills', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await p.waitForFunction(() => /frame fill — nectar \d+%/.test(document.getElementById('hudFill').textContent), null, { timeout: 5000 });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, A = window.__spendAuditStats.byState, t = s => { const e = document.querySelector(s); return (e.getBoundingClientRect().height ? e.innerText : e.textContent).replace(/\s+/g, ' ').trim(); };
      const hud = document.getElementById('hudFill').textContent.match(/nectar (\d+)% · honey (\d+)% · capped (\d+)%/).slice(1).map(Number);
      return { T: D.T, fill: [D.fill.nectar, D.fill.honey, D.fill.capped], hud, frame: D.frame, canon: D.canon.map(c => c.term), pageCanon: [...document.querySelectorAll('#canonSec .vocab .v b')].map(b => b.textContent.replace('⬡', '').trim()),
        audit: [D.audit.receipts, D.audit.passed, D.audit.pending, D.audit.failed, D.audit.inconclusive], truth: [A.PASSED + A.PENDING_ANCHOR + A.FAILED + A.INCONCLUSIVE, A.PASSED, A.PENDING_ANCHOR, A.FAILED, A.INCONCLUSIVE],
        rows: t('#etCbRows'), key: t('#etCbKey'), census: t('#etCbCensus'), canonDom: t('#etCbCanon') };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.equal(a.T, 41.7, 'reduced motion rests on the one composed frame');
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const f = facts[reg];
    assert.deepEqual(f.fill, f.hud, reg + ': the front\'s fill is the stage HUD\'s own'); assert.deepEqual(f.fill, a.fill, reg + ' agrees with bee');
    assert.equal(f.frame, 7776); assert.deepEqual(f.canon, f.pageCanon, reg + ' reads the canon from the page'); assert.deepEqual(f.audit, f.truth, reg + ' reads the verifier\'s census');
  }
  const [n, h, c] = a.fill;
  assert.match(a.rows, new RegExp(`a frame 7,776 cells.*filling now ${c}% sealed.*bills checked on this page ${a.truth[0]}`));
  assert.equal(facts.raver.key, `${n}% nectar ${h}% honey ${c}% capped`);
  assert.match(facts.cypherpunk.census, new RegExp(`frame fill level 0 · nectar ${n}% · honey ${h}% · capped ${c}% · 91 cells`));
  assert.match(facts.cypherpunk.census, new RegExp(`bills ${a.truth[0]} · PASSED ${a.truth[1]} · PENDING_ANCHOR ${a.truth[2]} · FAILED ${a.truth[3]} · INCONCLUSIVE ${a.truth[4]}`));
  assert.match(facts.cypherpunk.canonDom, /^CELL block\. one cell of the comb is one block of the chain/);
});

test('bee: look inside a cell and come back; the camera moves, nothing else does', async () => {
  const { ctx, p, errs } = await open('bee');
  const t0 = await p.evaluate(() => window.__eternal.data.T);
  await p.click('#etCbBeeLook'); await p.waitForTimeout(150);
  const d = await p.evaluate(() => ({ lv: window.__comb.level(window.__eternal.views.bee), cap: document.getElementById('etCbBeeCap').textContent, btn: document.getElementById('etCbBeeLook').textContent, exact: window.__eternal.views.bee.stats.exact }));
  assert.equal(d.lv, -1); assert.equal(d.cap, 'inside one cell: its nineteen receipts'); assert.equal(d.btn, 'back to the frame');
  assert.ok(d.exact >= 19, 'the cell opened into its receipts');
  await p.click('#etCbBeeLook'); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => window.__comb.level(window.__eternal.views.bee)), 0);
  assert.equal(await p.evaluate(() => window.__eternal.data.T), t0, 'the season did not move');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap dives where you tap, hold rises, the pill dives, home returns', async () => {
  const { ctx, p, errs } = await open('raver');
  const z = () => p.evaluate(() => window.__eternal.views.raver.zoom);
  assert.equal(await z(), 30);
  await p.locator('#etCbRaver').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etCbRaver').boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.7, bx.y + bx.height * 0.3); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await z(), 90, 'a tap dives ×3'); assert.equal(await p.textContent('#etCbRaverH'), 'one cell in');
  await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await z(), 30, 'a hold rises ÷3');
  await p.click('#etCbDive'); await p.waitForTimeout(100); assert.equal(await z(), 90);
  await p.click('#etCbHome'); await p.waitForTimeout(100);
  assert.deepEqual(await p.evaluate(() => { const v = window.__eternal.views.raver; return [v.zoom, v.camx, v.camy]; }), [30, 0, 0]);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: a tapped cell is the renderer\'s own cell, and opens into its receipts', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.locator('#etCbCy').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etCbCy').boundingBox();
  await p.mouse.click(bx.x + bx.width / 2 + 52, bx.y + bx.height / 2);
  await p.waitForTimeout(100);
  const d = await p.evaluate(() => { const C = window.__comb, c = window.__eternal.data.cell, s = C.state(c.lev, c.q, c.r); return { c, k: s.k, h: C.h01(c.lev, c.q, c.r), path: document.getElementById('etCbPath').textContent, kv: document.getElementById('etCbCell').innerText.replace(/\s+/g, ' ') }; });
  assert.deepEqual([d.c.lev, d.c.q, d.c.r], [0, 1, 0], 'one cell east of the origin at 30 px');
  assert.equal(d.c.k, d.k); assert.equal(d.c.h, d.h);
  assert.equal(d.path, 'comb://level/0/⬡1,0');
  assert.match(d.kv, new RegExp('h01 ' + d.h.toFixed(6) + ' state ' + ['nectar', 'honey', 'capped'][d.k]));
  assert.equal(d.c.children.reduce((a, b) => a + b, 0), 19, 'nineteen receipts inside');
  await p.click('#etCbOpen'); await p.waitForTimeout(100);
  const v = await p.evaluate(() => { const v = window.__eternal.views.cypherpunk; return [v.zoom, Math.round(v.camx * 1000) / 1000, v.camy, window.__comb.level(v)]; });
  assert.deepEqual(v, [110, Math.round(Math.sqrt(3) * 1000) / 1000, 0, -1], 'the camera sits on that cell, its rim 110 px from its heart');
  assert.equal(await p.textContent('#etCbOpen'), 'back to the frame');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the clock: the fill moves slowly, pauses on request, and is still under reduced motion', async () => {
  {
    const { ctx, p } = await open('raver', { motion: 'no-preference' });
    const a = await p.evaluate(() => window.__comb.T()); await p.waitForTimeout(500); const b = await p.evaluate(() => window.__comb.T());
    assert.ok(b > a, 'the season advances');
    await p.click('#etCbPause'); await p.waitForTimeout(50);
    const c = await p.evaluate(() => window.__comb.T()); await p.waitForTimeout(500); const d = await p.evaluate(() => window.__comb.T());
    assert.equal(c, d, 'paused means still'); assert.equal(await p.getAttribute('#etCbPause', 'aria-pressed'), 'true');
    await p.click('#etCbPause'); await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => window.__comb.T()) > d, 'and it resumes where it stopped');
    await ctx.close();
  }
  {
    const { ctx, p } = await open('raver');
    assert.equal(await p.$eval('#etCbPause', b => b.disabled), true);
    const a = await p.evaluate(() => window.__comb.T()); await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => window.__comb.T()), a);
    await ctx.close();
  }
});

test('the laws hold on the front: no dash, NaN or undefined for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined|null|\[object/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
