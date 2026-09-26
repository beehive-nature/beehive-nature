// bnamesday-eternal.test.mjs — bNames Day as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; the SAME facts in all three (today's names from the Centre's calendar, the Thai day, the
// payload's receipt); every answer is the pure core's (findName, thaiDay), and the front adds no read
// of its own: the page still makes exactly its two same-origin reads.
// Run: node --test e2e/bnamesday-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.ETERNAL_PAGE || 'surfaces/bnamesday.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8987, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const u = decodeURIComponent(q.url.split('?')[0]); const f = join(ROOT, u === '/surfaces/bnamesday.html' ? PAGE : u); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const DATA = JSON.parse(await readFile(join(ROOT, 'surfaces/bnamesday-data.json'), 'utf8'));
async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [], reads = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('request', r => { if (/\.json(\?|$)/.test(r.url())) reads.push(new URL(r.url()).pathname); });
  await p.goto(`${ORIGIN}/surfaces/bnamesday.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state === 'ready', null, { timeout: 20000 });
  return { ctx, p, errs, reads };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});


test('the same facts in all three: today\'s names, the Thai day, the receipt', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, all = s => [...document.querySelectorAll(s)];
      return {
        model: JSON.stringify({ key: D.key, t: D.t, x: D.x, thai: D.thai, meta: D.meta }), key: D.key, t: D.t, x: D.x, thai: D.thai,
        beeNames: all('#etBeeRows .et-b-person b').map(b => b.textContent), beeRows: document.getElementById('etBeeRows').textContent,
        petals: all('#etBloom .petal').length, cyT: (document.querySelector('#etDay tr td:nth-child(2)') || {}).textContent,
        cyThai: document.getElementById('etThai').textContent, receipt: document.getElementById('etReceipt').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.equal(facts[reg].model, a.model, reg + ' reads the same calendar');
  const now = new Date(), key = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  assert.equal(a.key, key); assert.deepEqual(a.t, DATA.days[key].t); assert.deepEqual(a.x, DATA.days[key].x);
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  if (a.thai) assert.equal(a.thai.en, wd, 'a date alone: the weekday rules');
  assert.deepEqual(a.beeNames, a.t);
  if (a.thai) assert.match(a.beeRows, new RegExp(`in Thailand, ${wd}: ${a.thai.colorName}`));
  assert.equal(facts.raver.petals, a.t.length + a.x.length, 'one petal per name');
  assert.equal(facts.cypherpunk.cyT, a.t.join(' · ') || 'no names on this day');
  if (a.thai) assert.match(facts.cypherpunk.cyThai, new RegExp(`colour${a.thai.colorName}`));
  assert.match(facts.cypherpunk.receipt, new RegExp(`${DATA._meta.counts.traditional} traditional · ${DATA._meta.counts.extended_only} extended`));
  assert.ok(facts.cypherpunk.receipt.includes(DATA._meta.source_files['traditional_sha256_PUBLIC-CONSTANT']));
});

test('bee: a name finds its day through the core; an unwritten name gets 22 May', async () => {
  const { ctx, p, errs, reads } = await open('bee');
  await p.fill('#etBeeName', 'janis'); await p.click('#etBeeFind');
  assert.match(await p.textContent('#etBeeAnswer'), /Jānis’s day is 24 June/);
  assert.match(await p.textContent('#etBeeAnswer'), /also on 27 August/);
  await p.fill('#etBeeName', 'Remington'); await p.click('#etBeeFind');
  assert.match(await p.textContent('#etBeeAnswer'), /22 May is its day/);
  assert.equal(reads.filter(x => x.endsWith('bnamesday-data.json')).length, 1, 'the front adds no read: the calendar is read once');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a petal to light it; walk the days; a name blooms its own day; motion pauses', async () => {
  const { ctx, p, errs } = await open('raver');
  const first = await p.evaluate(() => window.__eternal.data.t[0]);
  await p.click(`#etBloom .petal[data-name="${first}"] .hit`, { force: true });
  assert.equal(await p.getAttribute(`#etBloom .petal[data-name="${first}"]`, 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etRaverCard'), new RegExp(first + '.*the calendar'));
  const k0 = await p.evaluate(() => window.__eternal.data.sel);
  await p.click('#etNext'); assert.notEqual(await p.evaluate(() => window.__eternal.data.sel), k0);
  await p.click('#etToday'); assert.equal(await p.evaluate(() => window.__eternal.data.sel), k0);
  await p.fill('#etRaverName', 'INGA'); await p.click('#etRaverFind');
  assert.equal(await p.evaluate(() => window.__eternal.data.sel), '12-28');
  assert.equal(await p.getAttribute('#etBloom .petal[data-name="Inga"]', 'aria-pressed'), 'true');
  await p.click('#etPause');
  assert.equal(await p.$eval('#etBloom .bloom', g => getComputedStyle(g).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the payload is complete at first paint; the query is findName\'s own answer', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etPipe li').length), 6);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etReceipt tr').length), 7);
  await p.fill('#etCyName', 'janis'); await p.click('#etCyFind');
  const hits = await p.evaluate(() => [...document.querySelectorAll('#etHits tbody tr')].map(r => r.cells[0].textContent + ' ' + r.cells[1].textContent.slice(0, 5)));
  assert.deepEqual(hits, ['Jānis 06-24', 'Janis 08-27'], 'the same answer bnamesday.test.mjs pins for the core');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('.et-c a[target]')].every(a => a.rel === 'noopener noreferrer')), true);
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
        if (/^[—–-]$|NaN|undefined/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
