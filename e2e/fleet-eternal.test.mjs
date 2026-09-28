// fleet-eternal.test.mjs — the fleet index (surfaces/fleet-hosted/index.html) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per
// register in its own dress; the SAME nine pieces, times and links in all three, read from the list the
// page already carries (window.__eternal.data) and from each front's DOM; three different ways in (calm
// rows, a night clock you light, an instrument with a live diff); honest gestures (the verify button
// really hashes each original against its hosted copy, from this origin only; the clock's sweep pauses
// and is still under reduced motion); nothing depicts the nine; and the laws on the front.
// Run: node --test e2e/fleet-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const PORT = 9180, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opt.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.count > 0 && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress, nothing off-origin', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const ground = e => { for (; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return ''; };
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: ground(fr), title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + `: no sideways page at 390 px (${d.wide}/${d.vw})`);
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same nine, the same night, in all three (read from the list the page carries)', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e.textContent.replace(/\s+/g, ' ').trim();
      const cards = [...document.querySelectorAll('main section:not(#eternal) a.art')].map(a => ({ name: t(a.querySelector('.n')), time: t(a.querySelector('.t')), href: a.getAttribute('href') }));
      return {
        D: { count: D.count, lab: D.lab, gallery: D.gallery, first: D.first, last: D.last, minutes: D.minutes, date: D.date, items: D.items.map(i => [i.name, i.time, i.href, i.kind]) },
        cards, hero: D.hero,
        bee: [...document.querySelectorAll('#etBeeRows a.et-b-row')].map(a => [a.getAttribute('data-name'), t(a.querySelector(':scope>small')), a.getAttribute('href')]),
        raver: [...document.querySelectorAll('#etNight .et-star')].map(g => g.getAttribute('aria-label')),
        cy: [...document.querySelectorAll('#etcFiles tr')].map(r => [t(r.cells[0]), r.querySelector('a').getAttribute('href'), t(r.cells[2])]),
        path: t(document.getElementById('etcPath')), foot: t(document.getElementById('etBeeFoot')), mid: t(document.getElementById('etNightBig')),
      };
    });
    await ctx.close();
  }
  const b = seen.bee, D = b.D;
  assert.equal(D.count, 9); assert.equal(D.lab, 6); assert.equal(D.gallery, 3);
  assert.equal(D.first, '03:25'); assert.equal(D.last, '04:47'); assert.equal(D.minutes, 82); assert.equal(D.date, '2026-08-03');
  // the page's own hero numbers agree with what the data layer derives from its own list
  assert.deepEqual(b.hero, [String(D.minutes), String(D.count), '0']);
  // every card below is in the data, in time order
  assert.deepEqual(D.items.map(i => i[2]).sort(), b.cards.map(c => c.href).sort());
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ' reads the same list');
  // each register draws the same nine, the same times, the same links
  assert.deepEqual(b.bee.map(r => r[0]), D.items.filter(i => i[3] === 'lab').concat(D.items.filter(i => i[3] !== 'lab')).map(i => i[0]), 'bee rows: the nine, lab then gallery');
  for (const r of b.bee) { const it = D.items.find(i => i[0] === r[0]); assert.equal(r[1], it[1]); assert.equal(r[2], it[2]); }
  assert.equal(seen.raver.raver.length, 9, 'nine stars');
  D.items.forEach((it, k) => assert.match(seen.raver.raver[k], new RegExp(`^${it[0]}, ${it[1]}, `), 'star ' + k));
  assert.deepEqual(seen.cypherpunk.cy, D.items.map(i => [i[1], i[2], i[3]]), 'cypherpunk table');
  assert.match(b.foot, /2026-08-03, between 03:25 and 04:47/); assert.equal(seen.raver.mid, '82');
  assert.match(seen.cypherpunk.path, /9 files · 2026-08-03 03:25 → 04:47/);
});

test('bee: one way in, and it is the real first piece (a plain link, same tab)', async () => {
  const { ctx, p, errs } = await open('bee');
  const go = await p.$eval('#etBeeGo', a => ({ href: a.getAttribute('href'), target: a.target, text: a.textContent }));
  assert.equal(go.href, 'lab/flower-lab.html'); assert.equal(go.target, ''); assert.match(go.text, /03:25/);
  const rows = await p.$$eval('#etBeeRows a.et-b-row', as => as.every(a => !a.target && /^(lab|gallery)\/[\w-]+\.html$/.test(a.getAttribute('href'))));
  assert.ok(rows, 'every row opens the real file in this tab');
  assert.equal(await p.$eval('#provenance', e => e.tagName), 'SECTION', '"how they are kept" has somewhere to go');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a star lights on a tap; the sweep lights them in time, pauses, and is still under reduced motion', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.evaluate(() => Object.keys(window.__eternal.raver.lit).length), 0, 'nothing is lit before a gesture');
  await p.click('#etNight .et-star[data-i="8"]', { force: true });
  assert.match(await p.textContent('#etNightCard'), /acid-cascade/);
  assert.equal(await p.$eval('#etNightGo', a => a.getAttribute('href')), 'gallery/acid-cascade.html', 'the pill opens the star you lit');
  await p.click('#etNightPlay'); await p.waitForTimeout(3200);
  await p.click('#etNightPlay');
  const mid = await p.evaluate(() => ({ t: window.__eternal.raver.t, playing: window.__eternal.raver.playing, lit: Object.keys(window.__eternal.raver.lit).map(Number).sort((a, b) => a - b) }));
  assert.equal(mid.playing, false, 'the sweep pauses');
  assert.ok(mid.t > 10 && mid.t < 82, 'paused part-way through the night: t=' + mid.t);
  const D = await p.evaluate(() => window.__eternal.data.items.map(i => i.min));
  D.forEach((m, i) => { if (i !== 8) assert.equal(mid.lit.includes(i), m <= mid.t + 1e-6, `star ${i} lit exactly when the hand passed it`); });
  await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => window.__eternal.raver.t), mid.t, 'paused means still');
  await ctx.close();
  const r = await open('raver', { reduced: true });
  await r.p.click('#etNightPlay');
  const s = await r.p.evaluate(() => ({ t: window.__eternal.raver.t, playing: window.__eternal.raver.playing, lit: Object.keys(window.__eternal.raver.lit).length }));
  assert.deepEqual(s, { t: 82, playing: false, lit: 9 }, 'reduced motion: the whole night at once, no sweep');
  assert.equal(errs.length + r.errs.length, 0); await r.ctx.close();
});

test('cypherpunk: verify really hashes each original against its copy, from this origin only', async () => {
  const { ctx, p, errs, outside } = await open('cypherpunk');
  assert.match(await p.textContent('#etcPipe li.et-now'), /not run yet/, 'the instrument says what it has not done');
  await p.click('#etcVerify');
  await p.waitForFunction(() => window.__eternal.data.verify.state === 'done', null, { timeout: 20000 });
  const V = await p.evaluate(() => window.__eternal.data.verify);
  assert.equal(V.rows.length, 9); assert.ok(V.rows.every(r => r.ok), V.rows.filter(r => !r.ok).map(r => r.why).join(' | '));
  const sha = b => createHash('sha256').update(b).digest('hex');
  const delta = (a, b) => { const m = new Map(); let add = 0, del = 0; a.split('\n').forEach(l => m.set(l, (m.get(l) || 0) + 1)); b.split('\n').forEach(l => { if (m.get(l)) m.set(l, m.get(l) - 1); else add++; }); m.forEach(v => { del += v; }); return { add, del }; };
  for (const r of V.rows) {
    const name = r.file.split('/').pop();
    const o = await readFile(join(ROOT, 'surfaces/fleet', name)), c = await readFile(join(ROOT, 'surfaces/fleet-hosted', r.file));
    assert.equal(r.o, sha(o), name + ' original sha256'); assert.equal(r.c, sha(c), name + ' copy sha256');
    assert.deepEqual({ add: r.add, del: r.del }, delta(o.toString('utf8'), c.toString('utf8')), name + ' line counts');
  }
  const vend = await readFile(join(ROOT, 'surfaces/fleet-hosted/vendor/chart.js'));
  assert.equal(V.chart.sha, sha(vend)); assert.equal(V.chart.sha, await p.evaluate(() => window.__eternal.data.pin.sha), 'the vendored chart.js matches its pin');
  assert.equal(await p.$$eval('#etcDiff tbody tr', t => t.length), 10);
  assert.deepEqual(outside, [], 'verify never leaves the origin');
  assert.match(await p.textContent('#etcReceipt'), /0 off-origin/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('nothing depicts the nine: the front draws no image and embeds no piece', async () => {
  const { ctx, p } = await open('raver');
  const d = await p.evaluate(() => ({ img: document.querySelectorAll('#eternal img,#eternal iframe,#eternal canvas,#eternal object,#eternal embed').length }));
  assert.equal(d.img, 0);
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'cypherpunk') { await p.click('#etcVerify'); await p.waitForFunction(() => window.__eternal.data.verify.state === 'done', null, { timeout: 20000 }); }
    if (reg === 'raver') await p.click('#etNight .et-star[data-i="0"]', { force: true });
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target');
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
