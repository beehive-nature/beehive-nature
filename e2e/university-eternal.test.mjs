// university-eternal.test.mjs — Beehive University's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts (the page's own curriculum, the local progress its acts record, and
// its gates); and every gesture hands off to the page: the first lesson is its own beat, a course
// opens in the instrument, the graduation line is gradLine()'s. "done" is drawn only from what an
// act recorded (buni_progress), never from a tap on the front.
// Run: node --test e2e/university-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8977, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { lang = 'en', progress = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, l, pr]) => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); if (pr) localStorage.setItem('buni_progress', pr); } catch {} }, [reg, lang, progress]);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/university/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.BeehiveUni && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBGo', action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRGo', action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [FRONT[reg], w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the curriculum, the recorded progress, the gates', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { progress: JSON.stringify({ c1: 1, c5: 1 }) });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return { ids: D.courses.map(c => c.id), total: D.total, done: D.done, gates: D.gates, pageGates: ['g-u1', 'g-u2', 'g-u3'].map(i => document.getElementById(i).textContent.trim()),
        tstate: t('#tstate'), prog: t('#etBProg'), beeRows: [...document.querySelectorAll('#etBRows [data-open]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        nodes: document.querySelectorAll('#etROrbit .node').length, centre: [...document.querySelectorAll('#etROrbit > text')].map(x => x.textContent).join(' '),
        rows: [...document.querySelectorAll('#etCRows tr')].map(r => r.textContent), gatesTxt: t('#etCGates') };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.ids, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']); assert.equal(a.total, 7);
  assert.deepEqual(a.done, ['c1', 'c5'], 'what the acts recorded, read from the page');
  assert.match(a.tstate, /^2 of 7 acts receipted/, 'the page itself says the same');
  assert.deepEqual(a.gates.map(g => g.state), a.pageGates);
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['ids', 'total', 'done', 'gates']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.match(a.prog, /^2of 7 lessons done/); assert.match(a.beeRows[0], /done/); assert.match(a.beeRows[1], /open/);
  assert.equal(facts.raver.nodes, 7); assert.match(facts.raver.centre, /2\/7/);
  assert.match(facts.cypherpunk.rows[0], /c1.*✓ receipted/); assert.match(facts.cypherpunk.rows[1], /c2.*○ open/);
  assert.match(facts.cypherpunk.gatesTxt, /U-3RULED/);
});

test('bee: the one action is the page\'s own first lesson; a row opens its course', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBGo');
  await p.waitForFunction(() => document.body.getAttribute('data-uni-beat') === 'lesson', null, { timeout: 5000 });
  assert.ok(await p.locator('#layer-lesson').isVisible(), 'the real lesson beat opens');
  assert.deepEqual(await p.evaluate(() => window.__eternal.data.done), [], 'opening a lesson is not doing it');
  await p.click('#etBRows [data-open="c3"]');
  await p.waitForFunction(() => document.body.getAttribute('data-uni-beat') === 'deeper', null, { timeout: 5000 });
  assert.ok(await p.locator('#st-c3').isVisible(), 'the course opens in the instrument');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a tap lights a lesson, never marks it done; done comes only from an act', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etROrbit .node[data-id="c4"]');
  assert.equal(await p.getAttribute('#etROrbit .node[data-id="c4"]', 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etRCard'), /how to read a chain.*not yet/);
  assert.deepEqual(await p.evaluate(() => window.__eternal.data.done), []);
  // the real act: c7's honest answer, run in the instrument
  await p.click('#etRCard [data-open="c4"]');
  await p.waitForFunction(() => document.body.getAttribute('data-uni-beat') === 'deeper', null, { timeout: 5000 });
  await p.locator('#ex-c7-opts input[data-i="1"]').check();
  await p.click('#ex-c7-go');
  await p.waitForFunction(() => window.__eternal.data.done.includes('c7'), null, { timeout: 5000 });
  assert.match(await p.textContent('#etRNote'), /1 of 7 done/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; the graduation line is the page\'s own', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etCRows tr').length, steps: document.querySelectorAll('#etCPipe li').length, gates: document.querySelectorAll('#etCGates tr').length,
    fork: (() => { const a = [...document.querySelectorAll('.et-c a')].find(x => /fork/.test(x.textContent)); return a && [a.target, a.rel, a.href, a.textContent]; })() }));
  assert.equal(d.rows, 7); assert.equal(d.steps, 6); assert.equal(d.gates, 3);
  assert.deepEqual(d.fork.slice(0, 2), ['_blank', 'noopener noreferrer']); assert.match(d.fork[2], /surfaces\/university\/index\.html$/); assert.match(d.fork[3], /opens in a new tab/);
  await p.click('#etCGo');
  await p.waitForFunction(() => !document.getElementById('etCGrad').hidden, null, { timeout: 5000 });
  assert.equal(await p.textContent('#etCGrad'), await p.textContent('#gradOut'));
  assert.match(await p.textContent('#etCGrad'), /^\[bX review\] ✅ works university\/index\.html .* 0\/7 acts receipted/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front, left to right and right to left', async () => {
  for (const [reg, lang] of [['bee', 'en'], ['raver', 'en'], ['cypherpunk', 'en'], ['bee', 'fa'], ['raver', 'ar']]) {
    const { ctx, p } = await open(reg, { lang });
    if (lang !== 'en') await p.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 8000 });
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A|INPUT|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg + ' ' + lang);
    await ctx.close();
  }
});
