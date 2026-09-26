// hardware-build-eternal.test.mjs — "become a producer" as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress; all three carry the SAME facts, read from the page's own walls (the six ladder
// steps, the study repos, the two festival case studies, the data law, and the comb the page's own
// script draws, counted rather than assumed); the one real action is the parts list, handed to the
// guide's build-it-yourself rung, and it lands there; and the laws hold (no dash for a value, no
// forced capitals, 44 px actions, no sideways page, motion paused on request and still under
// reduced motion).
// Run: node --test e2e/hardware-build-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/hardware/build.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/hardware/build.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9165, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.steps.length && document.body.dataset.reg, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBdGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etBdPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etBdCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the page’s own walls', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        wall: { steps: all('main .step b').map(t), polys: all('#comb polygon').length, cases: all('main .panel.case').length, repos: all('main .panel .links a').map(t) },
        steps: D.steps.map(s => [s.n, s.name, s.sub]), repos: D.repos.map(r => [r.name, r.steps]), cases: D.cases.map(c => [c.name, c.questions]), law: D.law, comb: D.comb,
        bee: all('#etBdSteps .et-b-row').map(t),
        rings: all('#etBdComb .et-ring').map(g => [g.getAttribute('data-ring'), g.getAttribute('aria-label'), g.querySelectorAll('polygon').length]),
        hint: t(document.getElementById('etBdHint')), rCases: all('#etBdCases [data-case]').map(t),
        pipe: all('#etBdPipe li b').map(t), cRepos: all('#etBdRepos tr').map(t), cCases: all('#etBdCaseTab th').map(t), cComb: t(document.getElementById('etBdCombTab')),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['steps', 'repos', 'cases', 'law', 'comb']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.equal(a.steps.length, 6); assert.deepEqual(a.steps.map(s => s[1] + ' — ' + s[2] + '.'), a.wall.steps, 'the steps are the page’s own words');
  assert.equal(a.wall.polys, 127); assert.equal(a.comb.rendered, 127, 'the comb is counted, and it is 127');
  assert.deepEqual(a.repos.map(r => r[0]), a.wall.repos); assert.equal(a.cases.length, a.wall.cases);
  assert.deepEqual(a.repos.find(r => r[0] === 'seedsigner')[1], [1]); assert.deepEqual(a.repos.find(r => r[0] === 'trezor-firmware')[1], [], 'a repo no step names is said so');
  assert.equal(a.law.length, 4);
  // each register draws all six steps and both cases
  a.steps.forEach(([n, name], i) => {
    assert.ok(a.bee[i].includes(name), 'bee row ' + n);
    assert.ok(facts.raver.rings.find(r => r[0] === String(n))[1].includes(name), 'raver ring ' + n);
    assert.ok(facts.cypherpunk.pipe[i].includes(name), 'cypherpunk step ' + n);
  });
  // the comb's rings hold 6k cells each, and the hint counts what was drawn: 127
  facts.raver.rings.forEach(([k, , n]) => assert.equal(n, 6 * +k, 'ring ' + k));
  assert.match(facts.raver.hint, /^127 cells/);
  assert.deepEqual(facts.raver.rCases, a.cases.map(c => c[0])); assert.deepEqual(facts.cypherpunk.cCases, a.cases.map(c => c[0]));
  assert.match(facts.cypherpunk.cComb, /rendered127 polygons in #comb ✓/);
  assert.equal(facts.cypherpunk.cRepos.length, 6);
});

test('the one real action: all three hand the parts list to the guide’s build-it-yourself rung', async () => {
  const hrefs = {};
  for (const [reg, sel] of [['bee', '#etBdGo'], ['raver', '#etBdPill'], ['cypherpunk', '#etBdCyGo']]) {
    const { ctx, p } = await open(reg);
    hrefs[reg] = await p.$eval(sel, a => a.getAttribute('href'));
    assert.doesNotMatch(await p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent), /\b(enrolled|registered|purchased|built it)\b/i);
    await ctx.close();
  }
  assert.deepEqual(Object.values(hrefs), ['index.html#rung-2', 'index.html#rung-2', 'index.html#rung-2']);
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBdGo');
  await p.waitForFunction(() => /hardware\/index\.html#rung-2$/.test(location.href) && window.__eternal && window.__eternal.data.rungs, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  assert.equal(await p.$eval('.et-b-step[data-step="rung"]', e => e.hidden), false, 'the guide opens on the rung');
  assert.deepEqual(await p.$$eval('#etHwDevs .et-b-item b', e => e.map(x => x.textContent)), ['SeedSigner', 'Krux'], 'the parts are the build-it-yourself signers');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee rows open in place; raver rings light the climb up to the tapped step', async () => {
  const b = await open('bee');
  await b.p.click('.et-b-row[data-step="3"]');
  assert.match(await b.p.textContent('#etBdSteps .et-b-open'), /Fork, change a screen/);
  assert.equal(await b.p.$eval('.et-b-row[data-step="3"]', e => e.getAttribute('aria-expanded')), 'true');
  await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  await p.click('#etBdComb [data-ring="4"] polygon');
  assert.deepEqual(await p.$$eval('#etBdComb .et-ring', g => g.filter(x => x.classList.contains('et-lit')).map(x => x.getAttribute('data-ring')).sort()), ['1', '2', '3', '4']);
  assert.match(await p.textContent('#etBdCard'), /Speak light[\s\S]*step 4 of 6/);
  await p.click('[data-case="1"]');
  assert.match(await p.textContent('#etBdCard'), /Tomorrowland[\s\S]*four hundred thousand/);
  await p.click('#etBdStill');
  assert.equal(await p.$eval('#etBdComb .et-ring[aria-pressed="true"]', e => getComputedStyle(e).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  await still.p.click('#etBdComb [data-ring="2"] polygon');
  assert.equal(await still.p.$eval('#etBdComb .et-ring[aria-pressed="true"]', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    pipe: document.querySelectorAll('#etBdPipe li').length, repos: document.querySelectorAll('#etBdRepos a[target="_blank"][rel="noopener noreferrer"]').length,
    law: document.querySelectorAll('#etBdLawTab tr').length, comb: document.querySelectorAll('#etBdCombTab tr').length, verify: document.querySelectorAll('#etBdVerify li').length,
    now: (document.querySelector('#etBdPipe li.et-now b') || {}).textContent, chips: document.getElementById('etBdChips').textContent,
  }));
  assert.deepEqual([d.pipe, d.repos, d.law, d.comb, d.verify], [6, 6, 5, 4, 3]);
  assert.match(d.now, /^Build one/, 'the pipeline starts where the page says to start');
  assert.match(d.chips, /comb 127\/127 ✓/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('.et-b-row[data-step="6"]');
    if (reg === 'raver') await p.click('#etBdComb [data-ring="6"] polygon');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$|^(undefined|NaN|null)$/.test(own)) out.push('value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('edge ' + el.tagName + ' ' + Math.round(r.right));
      }
      if (document.documentElement.scrollWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
