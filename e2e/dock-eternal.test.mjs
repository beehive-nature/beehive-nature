// dock-eternal.test.mjs — the Dock as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts, read from the page below — above all the three hero numbers that
// e2e/dock-claims.mjs re-derives from source (its own regex is re-run here on the page source, and
// the page must still print exactly three); the held tests the page names agree with its hero; the
// proof commands and the receipt are the page's own; the one gesture that touches anything (copy)
// says "copied" only when the browser really copied; and the laws hold on the front.
// Run: node --test e2e/dock-eternal.test.mjs
// Red-on-HEAD proof: git show HEAD:surfaces/dock.html > /tmp/dock.html;
//   ETERNAL_OVERRIDE=/tmp/dock.html node --test e2e/dock-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/dock.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9270, ORIGIN = `http://127.0.0.1:${PORT}`;
const SRC = process.env.ETERNAL_OVERRIDE || join(ROOT, PAGE);
const srv = createServer(async (q, s) => {
  try {
    let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''); if (rel.endsWith('/')) rel += 'index.html';
    const f = rel === PAGE ? SRC : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser; const cache = {};
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { for (const c of Object.values(cache)) await c.ctx.close(); if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  if (opts.clip) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.heroes.length && document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const view = async reg => (cache[reg] ||= await open(reg));   // read-only views, shared by the tests that only look
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
// dock-claims' own parse of the page source: the hero numbers it re-derives from source
const heroesInSource = async () => [...(await readFile(SRC, 'utf8')).matchAll(/<div class="n [a-z]+">(\d+)<\/div><div class="l">([^<]*)</g)].map(m => +m[1]);

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etDkGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etDkPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etDkCopy', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { p, errs } = await view(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, h1: getComputedStyle(document.querySelector('header h1')).backgroundImage };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.match(d.h1, /gradient/, reg + ': the h1 still runs proven → gate → unbuilt');
    assert.equal(errs.length, 0, errs.join(' | '));
  }
});

test('the same three hero numbers everywhere: dock-claims’ parse, the data, and each register', async () => {
  const src = await heroesInSource();
  assert.equal(src.length, 3, 'the page source still prints exactly three hero numbers for e2e/dock-claims.mjs');
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        heroes: D.heroes.map(h => [h.n, h.label, h.kind]), held: D.held.map(h => [h.name, h.why]), receipt: D.receipt, commands: D.proof.commands, gaps: D.gaps.map(g => g.title), lanes: D.lanes,
        page: { heroes: all('main .hero .pstat.hero').map(h => [+t(h.querySelector('.n')), t(h.querySelector('.l'))]), pre: document.querySelector('#proof pre code').textContent.trim().split('\n'), gaps: all('#unbuilt .gap > b').map(t) },
        bee: all('#etDkRows .et-b-row small').map(t), tiles: all('#etDkTiles .et-r-tile b').map(t),
        lit: document.querySelectorAll('#etDkDial .et-tick.et-lit').length, heldCells: document.querySelectorAll('#etDkDial .et-held').length, lanesDrawn: document.querySelectorAll('#etDkDial .et-lane').length,
        claims: all('#etDkClaims td.et-n').map(t), receiptTxt: t(document.getElementById('etDkReceipt')), heldRows: all('#etDkHeld tbody tr').map(t), heldNote: t(document.getElementById('etDkHeldNote')), pipe: all('#etDkPipe li').map(t),
      };
    });
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['heroes', 'held', 'receipt', 'commands', 'gaps', 'lanes']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.heroes.map(h => h[0]), src, 'the data layer carries exactly the numbers dock-claims parses');
  assert.deepEqual(a.heroes.map(h => [h[0], h[1]]), a.page.heroes, 'read from the page, never typed');
  assert.deepEqual(a.heroes.map(h => h[2]), ['proven', 'gate', 'unbuilt']);
  // each register draws the same numbers
  a.heroes.forEach(([n, label], i) => assert.equal(a.bee[i], n + ' ' + label, 'bee row ' + i));
  assert.deepEqual(facts.raver.tiles, src.map(String), 'raver tiles');
  assert.equal(facts.raver.lit, Math.min(60, src[0]), 'raver: the minute lights exactly the measured seconds');
  assert.equal(facts.raver.heldCells, src[1], 'raver: one dashed cell per held test'); assert.equal(facts.raver.lanesDrawn, src[2], 'raver: one hollow mark per unbuilt lane');
  assert.deepEqual(facts.cypherpunk.claims, src.map(String), 'cypherpunk claims table');
  // the held tests the page names agree with its own hero, each with its reason
  assert.equal(a.held.length, src[1]); a.held.forEach(([name, why]) => { assert.match(name, /^[\w\-/.]+$/); assert.ok(why.length > 10, name + ' names its blocker'); });
  assert.equal(facts.cypherpunk.heldRows.length, src[1]); assert.match(facts.cypherpunk.heldNote, /they agree/);
  // the proof and its receipt are the page's own words
  assert.deepEqual(a.commands, a.page.pre); assert.ok(facts.cypherpunk.pipe.slice(0, 3).every((s, i) => s.includes(a.commands[i])));
  assert.deepEqual(a.receipt.runs, [28, 35, 39]); assert.equal(a.receipt.measured, '2026-08-24'); assert.equal(a.receipt.tree, '6a56c1ba'); assert.equal(a.receipt.result, '9 passed, 0 failed, 1 ignored');
  for (const v of ['2026-08-24', '28 s · 35 s · 39 s', '9 passed, 0 failed, 1 ignored', '6a56c1ba']) assert.ok(facts.cypherpunk.receiptTxt.includes(v), 'receipt shows ' + v);
  assert.deepEqual(a.gaps, a.page.gaps); assert.deepEqual(a.lanes, ['firmware', 'legal review']); assert.equal(a.lanes.length, src[2], 'the lanes named are as many as the hero says');
});

test('bee reads calmly and hands off to the proof; raver lights a ring; nothing claims a run', async () => {
  const b = await open('bee');
  await b.p.click('.et-b-row[data-kind="proven"]');
  assert.match(await b.p.textContent('.et-b-open[data-kind="proven"]'), /28 s, 35 s, 39 s/);
  assert.equal(await b.p.getAttribute('#etDkGo', 'href'), '#proof');
  await b.p.click('#etDkGo'); await b.p.waitForTimeout(300);
  assert.ok(await b.p.$eval('#proof pre', e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'the commands are on screen');
  assert.equal(b.errs.length, 0, b.errs.join(' | ')); await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  await p.locator('#etDkTiles [data-kind="gate"]').click({ force: true });
  assert.equal(await p.evaluate(() => window.__eternal.raver.kind), 'gate', 'the tap landed');
  assert.equal(await p.$eval('#etDkDial .et-ring[data-kind="gate"]', g => g.classList.contains('et-on')), true);
  // tap the dashed cell itself: a point on its arc (mid-angle, mid-radius), in screen pixels
  await p.locator('#etDkDial').scrollIntoViewIfNeeded();
  const at = await p.evaluate(() => { const svg = document.getElementById('etDkDial'), n = document.querySelectorAll('#etDkDial .et-held').length, a = -Math.PI / 2 + 1.5 * 2 * Math.PI / n, m = svg.getScreenCTM(); return { x: m.a * 119 * Math.cos(a) + m.e, y: m.d * 119 * Math.sin(a) + m.f }; });
  await p.touchscreen.tap(at.x, at.y); await p.waitForTimeout(100);
  assert.deepEqual(await p.evaluate(() => [window.__eternal.raver.kind, window.__eternal.raver.i]), ['gate', 1], 'the tap on the cell landed');
  const held = await p.evaluate(() => window.__eternal.data.held[1]);
  assert.match(await p.textContent('#etDkCard'), new RegExp(held.name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
  await p.click('#etDkStill');
  assert.equal(await p.$eval('#etDkDial .et-cell.et-sel', e => getComputedStyle(e).animationPlayState), 'paused', 'the light can be paused');
  assert.doesNotMatch(await p.textContent('#eternal'), /\b(ran|re-ran|verified) (it )?(here|on this page)\b/i);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  assert.equal(await still.p.$eval('#etDkDial .et-tick.et-lit', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: copy says "copied" only when the browser copied, and the clipboard holds the page’s commands', async () => {
  const { p } = await view('cypherpunk');
  await p.click('#etDkCopy'); await p.waitForTimeout(250);
  const refused = await p.textContent('#etDkCopied');
  assert.doesNotMatch(refused, /^copied/, 'no permission, no "copied"'); assert.match(refused, /refused|no clipboard/);
  const g = await open('cypherpunk', { clip: true });
  await g.p.click('#etDkCopy'); await g.p.waitForTimeout(250);
  assert.match(await g.p.textContent('#etDkCopied'), /^copied · 3 lines/);
  const clip = await g.p.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, (await g.p.evaluate(() => window.__eternal.data.proof.commands)).join('\n'));
  assert.equal(await g.p.$eval('#eternal .et-c-row a[target="_blank"]', a => a.rel), 'noopener noreferrer');
  await g.ctx.close();
});

test('the laws hold on the front: no dash or NaN for a value, no forced capitals, 44 px actions, nothing past 390 px', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    if (reg === 'bee') await p.click('.et-b-row[data-kind="gate"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null|\?)$|not read from this page/.test(own)) out.push('value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > 391 || r.left < -1)) out.push('edge ' + el.tagName + ' ' + Math.round(r.right));
      }
      if (document.documentElement.scrollWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg);
  }
});
