// blanguage-eternal.test.mjs — the language dock's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts, counted from lang-corpus.json (tongues, keys, per-tongue cells, the
// attested and withdrawn maps, the right-to-left set); and the gestures hand off to the real flows:
// a tongue is chosen through the estate's own picker (#blangsel, lang.js), docking opens the
// workshop, which composes and never posts. Right to left is tested as a first-class reading.
// Run: node --test e2e/blanguage-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8975, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const CORPUS = JSON.parse(await readFile(join(ROOT, 'surfaces/lang-corpus.json'), 'utf8'));
const KEYS = Object.keys(CORPUS.strings);
const cells = c => KEYS.filter(k => typeof CORPUS.strings[k][c] === 'string' && CORPUS.strings[k][c].trim()).length;

async function open(reg, { lang = 'en' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); } catch {} }, [reg, lang]);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blanguage.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.loaded && document.getElementById('blangsel'), null, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBDock', action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRDock', action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCDock', action: 'rgb(69, 194, 220)' },
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

test('the same facts in all three, counted from the corpus', async () => {
  const want = { tongues: CORPUS._meta.langs.length + 1, keys: KEYS.length, attested: Object.keys(CORPUS._meta.attested || {}).length,
    withdrawn: Object.keys(CORPUS._meta.withdrawn || {}).length, rtl: CORPUS._meta.rtl };
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return { tongues: D.tongues, keys: D.keys, attested: D.attested, withdrawn: D.withdrawn, rtl: D.rtl, current: D.current,
        cells: D.langs.map(L => [L.code, L.cells, L.rtl]),
        lede: t('#etBLede'), rays: document.querySelectorAll('#etRSun .ray').length, rtlRays: [...document.querySelectorAll('#etRSun .ray line.petal')].filter(l => /--sk-ai/.test(l.getAttribute('style'))).length,
        hollow: [...document.querySelectorAll('#etRSun .ray circle')].filter(c => /--sk-bg\)/.test(c.getAttribute('style'))).length,
        note: t('#etRNote'), rows: [...document.querySelectorAll('#etCRows tr')].map(r => [...r.cells].map(c => c.textContent)), rec: t('#etCRec'), chips: t('#etCChips') };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const k of Object.keys(want)) assert.deepEqual(a[k], want[k], 'bee ' + k);
  assert.deepEqual(a.cells, [['en', KEYS.length, false], ...CORPUS._meta.langs.map(c => [c, cells(c), CORPUS._meta.rtl.includes(c)])], 'per-tongue cells, counted');
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['tongues', 'keys', 'attested', 'withdrawn', 'rtl', 'current', 'cells']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  // each register draws the same numbers its own way
  assert.match(a.lede, new RegExp('speaks ' + want.tongues + ' languages'));
  assert.equal(facts.raver.rays, want.tongues, 'one ray per tongue');
  assert.equal(facts.raver.rtlRays, want.rtl.length, 'right-to-left tongues ray in their own colour');
  assert.equal(facts.raver.hollow, want.tongues - want.attested, 'a seed stays hollow until a speaker signs');
  assert.match(facts.raver.note, new RegExp(want.tongues + ' tongues · ' + want.keys.toLocaleString('en') + ' lines in the source · ' + want.attested + ' signed'));
  assert.equal(facts.cypherpunk.rows.length, want.tongues);
  facts.cypherpunk.rows.forEach((r, i) => { assert.equal(r[0], a.cells[i][0]); assert.equal(+r[3], a.cells[i][1]); assert.equal(r[2], a.cells[i][2] ? 'rtl' : 'ltr'); });
  assert.match(facts.cypherpunk.rec, new RegExp('keys' + want.keys)); assert.match(facts.cypherpunk.rec, new RegExp('attested' + want.attested));
  assert.match(facts.cypherpunk.chips, new RegExp('rtl ' + want.rtl.join(' ')));
});

test('bee: a tongue is chosen through the estate\'s own picker; docking opens the workshop', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBRows .et-b-row[data-code="lv"]');
  assert.match(await p.textContent('#etBRows .et-b-open'), new RegExp(cells('lv').toLocaleString('en') + ' of ' + KEYS.length.toLocaleString('en') + ' lines are drafted by a machine'));
  await p.click('#etBRows [data-use="lv"]');
  await p.waitForFunction(() => document.documentElement.lang === 'lv', null, { timeout: 8000 });
  assert.equal(await p.evaluate(() => localStorage.getItem('blang')), 'lv', 'lang.js persisted the choice');
  assert.equal(await p.inputValue('#blangsel'), 'lv');
  assert.equal(await p.evaluate(() => window.__eternal.data.current), 'lv');
  assert.match(await p.textContent('#etBRows .et-b-row[data-code="lv"]'), /reading now/);
  // the one magenta action opens the real workshop (it composes, it never posts)
  await p.click('#etBDock');
  await p.waitForFunction(() => getComputedStyle(document.getElementById('ws-editor')).display !== 'none', null, { timeout: 8000 });
  assert.match(await p.textContent('#ws-verbtitle'), /CREATE/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a ray to choose; only a full hold of the heart changes the language', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.textContent('#etRHeartName'), 'English');
  await p.click('#etRCard [data-step="1"]');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), CORPUS._meta.langs[0]);
  await p.evaluate(() => { const r = document.querySelector('#etRSun .ray[data-code="ar"] path.hit'); r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  assert.equal(await p.textContent('#etRHeartName'), 'العربية');
  assert.match(await p.textContent('#etRCard'), /right to left/);
  const bx = await p.locator('#etRHeart').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'en', 'a short hold changes nothing');
  await p.mouse.down(); await p.waitForTimeout(1200); await p.mouse.up();
  await p.waitForFunction(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl', null, { timeout: 8000 });
  assert.equal(await p.evaluate(() => localStorage.getItem('blang')), 'ar');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'right to left, no sideways page');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    steps: [...document.querySelectorAll('#etCPipe li')].map(l => l.className), rec: document.querySelectorAll('#etCRec tr').length,
    curl: document.querySelector('#etCCurl').textContent,
    fork: (() => { const a = [...document.querySelectorAll('.et-c a')].find(x => /fork/.test(x.textContent)); return a && [a.target, a.rel, a.href, a.textContent]; })(),
  }));
  assert.equal(d.steps.length, 6); assert.equal(d.rec, 9);
  assert.equal(d.steps[3], 'now', 'attestation is the open step while no speaker has signed');
  assert.equal(d.steps[4], 'guard', 'withdrawal is the guard: honoured, never erased');
  assert.match(d.curl, /lang-corpus\.json \| jq/);
  assert.deepEqual(d.fork.slice(0, 2), ['_blank', 'noopener noreferrer']);
  assert.match(d.fork[2], /blob\/main\/surfaces\/lang-corpus\.json$/); assert.match(d.fork[3], /opens in a new tab/);
  await p.click('#etCRows tr[data-use="he"]');
  await p.waitForFunction(() => document.documentElement.lang === 'he', null, { timeout: 8000 });
  assert.match(await p.getAttribute('#etCRows tr[data-use="he"]', 'class'), /cur/, 'the row for the reading tongue is marked');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('a failed corpus read says so in every register, never zero', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
    await ctx.route('**/*', r => { const u = r.request().url(); if (/lang-corpus\.json\?v=2/.test(u)) return r.abort('failed'); return u.startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'); });
    const p = await ctx.newPage(); await p.goto(`${ORIGIN}/surfaces/blanguage.html`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__eternal && window.__eternal.data.failed, null, { timeout: 15000 });
    const txt = await p.evaluate(f => document.querySelector('#eternal>' + f).textContent, FRONT[reg]);
    assert.match(txt, /could not be read|did not answer|fetch failed/, reg);
    assert.doesNotMatch(txt, /speaks 0|keys 0/, reg);
    await ctx.close();
  }
});

test('the laws hold on the front, left to right and right to left', async () => {
  for (const [reg, lang] of [['bee', 'en'], ['raver', 'en'], ['cypherpunk', 'en'], ['bee', 'ar'], ['raver', 'fa'], ['cypherpunk', 'ur']]) {
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
        if (/^(BUTTON|A|INPUT|LABEL)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg + ' ' + lang);
    await ctx.close();
  }
});
