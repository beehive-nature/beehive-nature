// b4b-eternal.test.mjs — BNR × Base, the application appendix, as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; three different products (bee: four receipts in plain words and one way to
// check; raver: the receipts as a constellation where both oracles beam to the star you tap; cypherpunk:
// every receipt with its date, the re-run pipeline, the plan and the synergy map); the SAME facts in all
// three, read from the page's own receipts (token, seed count, holders, tests, dates, the plan); honest
// gestures (every link is one of the page's own receipt links, opened in a new tab; nothing says
// "verified"; no request leaves the page); raver motion that pauses and is still under reduced motion;
// and the laws (no dash for a value, no forced capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/b4b-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/b4b.html`> node --test e2e/b4b-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/b4b.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9242, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.receipts.length, null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
// the laws, over the one visible front
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
const PAGE_SRC = await readFile(join(ROOT, PAGE), 'utf8');

test('one front per register, each in its own dress, and the laws hold on each', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etB4Go', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etB4Pill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etB4CyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(await laws(p), [], reg + ' laws');
    assert.deepEqual(out, [], reg + ': nothing leaves the page');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products: rows and a plan, a constellation, an instrument', async () => {
  const shape = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    shape[reg] = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none');
      return { rows: fr.querySelectorAll('.et-b-row').length, stars: fr.querySelectorAll('svg [role="button"]').length, tables: fr.querySelectorAll('table').length, pipe: fr.querySelectorAll('.et-c-pipe li').length };
    });
    await ctx.close();
  }
  assert.ok(shape.bee.rows >= 4 && shape.bee.stars === 0 && shape.bee.tables === 0, 'bee is plain rows');
  assert.ok(shape.raver.stars >= 4 && shape.raver.rows === 0 && shape.raver.tables === 0, 'raver is the constellation');
  assert.ok(shape.cypherpunk.tables >= 3 && shape.cypherpunk.pipe === 5 && shape.cypherpunk.stars === 0, 'cypherpunk is the instrument');
});

test('the same facts in all three, read from the page\'s own receipts', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') { await p.click('.et-b-row[data-rec="1"]'); }
    if (reg === 'cypherpunk') { await p.click('.et-c-tab tr.et-pick[data-rec="1"]'); }
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none');
      return { D: JSON.parse(JSON.stringify(D)), text: fr.textContent.replace(/\s+/g, ' ') };
    });
    await ctx.close();
  }
  const D = seen.bee.D;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ': one data layer');
  // the facts are the page's own words, not typed into the front
  assert.equal(D.receipts.length, 4); assert.equal(D.oracles, 2); assert.equal(D.prepared, '2026-08-20');
  const f = Object.fromEntries(D.receipts.map(r => [r.kind, r]));
  assert.equal(f.agents.f.token, '#25331'); assert.ok(PAGE_SRC.includes('token #25331'));
  assert.equal(f.seed.f.seeds, 'five'); assert.equal(f.census.f.holders, '1,150'); assert.equal(f.census.f.trunc, '1,000');
  assert.equal(f.instrument.f.tests, '14/14'); assert.deepEqual(D.receipts.map(r => r.date), ['2026-08-20', '2026-08-20', '2026-08-19', null]);
  assert.equal(D.plan.length, 4); assert.equal(D.synergy.length, 3);
  assert.match(D.absence, /Validation registry has no canonical address yet/);
  // each register shows them
  assert.match(seen.bee.text, /agent #25331/); assert.match(seen.bee.text, /measured 2026-08-20/); assert.match(seen.bee.text, /weeks 7–8/);
  assert.match(seen.raver.text, /token #25331/); assert.match(seen.raver.text, /2 oracles each/); assert.match(seen.raver.text, /weeks 1–2/);
  assert.match(seen.cypherpunk.text, /token #25331/); assert.match(seen.cypherpunk.text, /2026-08-19/); assert.match(seen.cypherpunk.text, /14\/14/);
  assert.match(seen.cypherpunk.text, /Validation registry has no canonical address yet/);
  // an undated receipt says so; it never shows a dash
  assert.match(seen.cypherpunk.text, /undated/);
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.doesNotMatch(seen[reg].text, /\bverified\b/i, reg + ' never says verified');
});

test('honest gestures: every link is the page\'s own receipt link, in a new tab', async () => {
  const own = [...PAGE_SRC.matchAll(/<a href="(https:\/\/github\.com\/[^"]+)"/g)].map(m => m[1]);
  // bee: a row opens to its receipt links; the one action opens the page's own docs/receipts link
  let { ctx, p, errs, out } = await open('bee');
  await p.click('.et-b-row[data-rec="1"]');
  let links = await p.$$eval('#eternal .et-b-open a', a => a.map(x => [x.getAttribute('href'), x.target, x.rel, x.textContent]));
  assert.equal(links.length, 2);
  for (const [href, tgt, rel, t] of links) { assert.ok(own.includes(href), href); assert.equal(tgt, '_blank'); assert.equal(rel, 'noopener noreferrer'); assert.match(t, /new tab/); }
  assert.deepEqual(await p.$eval('#etB4Go', a => [a.getAttribute('href'), a.target]), ['https://github.com/beehive-nature/beehive-nature/tree/main/docs/receipts', '_blank']);
  assert.match(await p.textContent('#etB4Foot'), /new tab/);
  assert.deepEqual(out, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // raver: tapping a star lights it, both oracles beam to it, and the pill carries that receipt's own link
  ({ ctx, p, errs, out } = await open('raver'));
  assert.equal(await p.locator('#etB4Sky .et-beam').count(), 2, 'two beams: two oracles each');
  await p.$eval('#etB4Sky', e => e.scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  await p.locator('#etB4Sky .et-star[data-rec="2"]').click({ force: true });
  assert.equal(await p.getAttribute('#etB4Sky .et-star[data-rec="2"]', 'aria-pressed'), 'true', 'the tap landed');
  assert.match(await p.textContent('#etB4Card'), /five seed values in one wallet · measured 2026-08-20/);
  const pill = await p.$eval('#etB4Pill', a => [a.getAttribute('href'), a.target, a.rel, a.textContent]);
  assert.ok(own.includes(pill[0]) && /RECEIPT_ERC20I/.test(pill[0]), pill[0]); assert.equal(pill[1], '_blank'); assert.match(pill[3], /new tab/);
  await p.locator('#etB4Sky .et-core').click({ force: true });
  assert.match(await p.textContent('#etB4Card'), /tests 14\/14/);
  await p.click('#etB4Beats [data-beat="3"]');
  assert.match(await p.textContent('#etB4Beat'), /Demo Day/);
  assert.deepEqual(out, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // cypherpunk: a row opens to its evidence; the re-run commands come from the page's own links
  ({ ctx, p, errs, out } = await open('cypherpunk'));
  await p.click('.et-c-tab tr.et-pick[data-rec="3"]');
  const cl = await p.$$eval('#eternal .et-c-tab .et-c-a', a => a.map(x => x.getAttribute('href')));
  assert.equal(cl.length, 1); assert.ok(own.includes(cl[0]) && /DISPATCH_SOULCATS/.test(cl[0]));
  const pipe = await p.textContent('#etB4Pipe');
  assert.match(pipe, /node docs\/receipts\/erc8004-e1-read-first\.mjs/); assert.match(pipe, /cargo test -p bindexer/);
  assert.deepEqual(out, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver motion: the orbit pauses on request and is still under reduced motion', async () => {
  const pos = p => p.$eval('#etB4Sky .et-oracle', g => g.getAttribute('transform'));
  let { ctx, p } = await open('raver');
  const a = await pos(p); await p.waitForTimeout(700); const b = await pos(p);
  assert.notEqual(a, b, 'the oracles circle');
  await p.click('#etB4Still');
  assert.equal(await p.getAttribute('#etB4Still', 'aria-pressed'), 'true');
  const c = await pos(p); await p.waitForTimeout(500); assert.equal(await pos(p), c, 'paused');
  await ctx.close();
  ({ ctx, p } = await open('raver', { reduced: true }));
  const d = await pos(p); await p.waitForTimeout(500); assert.equal(await pos(p), d, 'still under reduced motion');
  await ctx.close();
});
