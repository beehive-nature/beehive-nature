// record-eternal.test.mjs — "every screenshot we ever kept" as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three carry the SAME facts, counted from the record's own index (E, DIMS): 76
// photographs, 20 moments, before 22 · after 22 · alone 30 · named 2; the record is large, so no
// front asks for a picture on arrival (every png requested belongs to the list below, fewer than HEAD
// loaded); the raver develops ONE picture only after a full hold, a short hold loads nothing; every
// "see it" is a same-tab link to the moment's own entry. Run: node --test e2e/record-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/record.html> node --test e2e/record-eternal.test.mjs
const PAGE = 'record.html', PORT = 9263;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// the index, read independently of the page's script
const SRC = await readFile(join(ROOT, 'surfaces', PAGE), 'utf8');
const DIMS = JSON.parse(SRC.match(/var DIMS=(\{.*?\});/)[1]);
const E = new Function('return ' + SRC.match(/var E=(\[[\s\S]*?\n\]);/)[1])();
const KIND = { before: 0, after: 0, alone: 0, named: 0 }; E.forEach(e => e.i.forEach(s => KIND[['before', 'after', 'alone'].includes(s[1]) ? s[1] : 'named']++));
const PHOTOS = E.reduce((n, e) => n + e.i.length, 0);

async function open(reg, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], pngs = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (/\/record\/[^/]+\.png/.test(u)) pngs.push(decodeURIComponent(u.split('/').pop())); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#etBeeRows .et-b-row'), null, { timeout: 8000 });
  return { ctx, p, errs, outside, pngs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const LAWS = () => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)|\[object/.test(own)) out.push('bad value ' + el.className + ' ' + own);
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
    if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
  }
  if (document.documentElement.scrollWidth > innerWidth || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  return out;
};

test('one front per register, its own dress, the same facts from the index, no picture asked for on arrival', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside, pngs } = await open(reg);
    await p.waitForTimeout(1200); // let the list's own lazy loads settle
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, t = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        primaries: fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary').length,
        model: [D.photos, D.indexed, D.entries.length, D.kinds.before, D.kinds.after, D.kinds.alone, D.kinds.named],
        frontImgs: [...document.querySelectorAll('#eternal img')].filter(i => i.getAttribute('src')).length,
        listImgs: [...document.querySelectorAll('#list img')].map(i => i.getAttribute('src').replace('record/', '')),
        pageCount: document.getElementById('count').textContent,
        beeRows: [...document.querySelectorAll('#etBeeRows a')].map(a => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]),
        frames: ['before', 'after', 'alone', 'named'].map(k => document.querySelectorAll('#etReel .fr.' + k).length), legend: t('#etLegend span').join(' | '),
        receipt: t('#etReceipt tr').join(' | '), entries: [...document.querySelectorAll('#etEntries tr.pick')].map(r => [r.cells[3].textContent, r.cells[2].firstChild.textContent]),
        loaded: +document.getElementById('etLoaded').textContent, loadedNow: window.__eternal.loadedNow() };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one filled action');
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' laws');
    // the record is large: the fronts ask for no picture; only the list's own lazy images load
    assert.equal(d.frontImgs, 0, reg + ': no front picture on arrival');
    assert.ok(pngs.every(f => d.listImgs.includes(f)), reg + ': every png asked for belongs to the list below');
    assert.ok(pngs.length <= 9 && pngs.length < PHOTOS / 4, reg + ': ' + pngs.length + ' of ' + PHOTOS + ' pictures on arrival (HEAD loaded 9)');
    assert.equal(d.loaded, d.loadedNow, reg + ': the receipt\'s loaded count is the browser\'s own');
    assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model, [PHOTOS, Object.keys(DIMS).length, E.length, KIND.before, KIND.after, KIND.alone, KIND.named]);
  assert.deepEqual(a.model, [76, 76, 20, 22, 22, 30, 2], 'the index as kept');
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model);
  assert.match(a.pageCount, /^76 photographs/, 'the page\'s own count agrees');
  // bee: the newest five moments, linked to their own entries, then every moment
  assert.deepEqual(a.beeRows.slice(0, 5).map(r => r[0]), ['#rec-0', '#rec-1', '#rec-2', '#rec-3', '#rec-4']);
  a.beeRows.slice(0, 5).forEach((r, k) => assert.ok(r[1].startsWith(E[k].t) && r[1].includes(E[k].i.length + ' picture'), r[1]));
  assert.deepEqual(a.beeRows[5], ['#list', 'every moment20 moments']);
  // raver: one frame per photograph, by kind, legend in words
  assert.deepEqual(a.frames, [22, 22, 30, 2]);
  assert.equal(a.legend, 'before · 22 | after · 22 | kept alone · 30 | two languages · 2');
  // cypherpunk: the receipt and every entry
  assert.match(a.receipt, /index76 files sized \(DIMS\) · 20 entries/); assert.match(a.receipt, /listed76 photographs · 76 distinct files · ✓ every one sized/);
  assert.match(a.receipt, /pairsbefore 22 · after 22/); assert.match(a.receipt, /commitsc7102fc · 542d986/);
  assert.deepEqual(a.entries, E.map(e => [String(e.i.length), e.t]));
});

test('bee: a row opens its own moment in the record, in this tab', async () => {
  const { ctx, p, errs, pngs } = await open('bee');
  assert.equal(await p.$eval('#etBeeGo', a => a.getAttribute('href')), '#rec-0');
  assert.ok(await p.$('#rec-4'), 'every linked moment exists');
  await p.click('#etBeeRows a[href="#rec-2"]'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => location.hash), '#rec-2');
  assert.equal(await p.evaluate(() => { const r = document.getElementById('rec-2').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), true, 'the moment is on screen');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#eternal .et-b a, #eternal .et-r a')].filter(a => a.target).length), 0, 'bee and raver links stay in this tab');
  assert.ok(pngs.length < PHOTOS, 'still lazy');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a moment on the reel; a short hold develops nothing, a full hold develops exactly one picture', async () => {
  const { ctx, p, errs, pngs } = await open('raver');
  await p.$eval('#etReel', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const c = await p.$eval('#etReel .fr[data-k="2"]', f => { const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(c.x, c.y, { force: true });
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 2, 'the tap landed on moment 3');
  assert.match(await p.textContent('#etRaverCard'), new RegExp('3' + E[2].t.replace(/[()]/g, '.')));
  assert.equal(await p.$eval('#etRaverGo', a => [a.getAttribute('href'), a.target].join()), '#rec-2,', 'same-tab link to its entry');
  await p.focus('#etReel'); await p.keyboard.press('ArrowLeft');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 1);
  // develop the OLDEST moment: its picture sits at the foot of the list, far past Chromium's lazy-load
  // distance (1250-2500 px, by connection estimate). A near-top moment's picture can already have been
  // fetched by the list below, and then a network check proves nothing (CI 2026-09-26).
  const K = E.length - 1;
  await p.keyboard.press('End');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), K, 'End reaches the oldest moment');
  await p.$eval('#etDevelop', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); // clear of the fixed tour bar await p.waitForTimeout(300);
  const want0 = (E[K].i.find(s => s[1] === 'after') || E[K].i[0])[0];
  assert.ok(!pngs.includes(want0), 'the list has not fetched the oldest picture, so the network check below means something');
  const n0 = pngs.length, b = await p.locator('#etDevelop').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.$eval('#etPhoto', f => f.hidden), true, 'a short hold develops nothing');
  assert.equal(await p.$eval('#etPhotoImg', i => i.getAttribute('src')), null);
  assert.ok(!pngs.slice(n0).includes((E[K].i.find(s => s[1] === 'after') || E[K].i[0])[0]), 'nothing was asked for');
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up();
  await p.waitForFunction(() => document.getElementById('etPhotoImg').complete && document.getElementById('etPhotoImg').naturalWidth > 0, null, { timeout: 5000 });
  const want = (E[K].i.find(s => s[1] === 'after') || E[K].i[0])[0];
  const ph = await p.evaluate(() => { const i = document.getElementById('etPhotoImg'); return { src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight, fit: getComputedStyle(i).objectFit, cap: document.getElementById('etPhotoCap').textContent, hidden: document.getElementById('etPhoto').hidden }; });
  assert.equal(ph.hidden, false); assert.equal(ph.src, 'record/' + want);
  assert.deepEqual([ph.w, ph.h], DIMS[want], 'the file, at its own size');
  assert.equal(ph.fit, 'contain', 'never cropped'); assert.match(ph.cap, /as kept, unretouched/);
  assert.ok(pngs.slice(n0).includes(want), 'the one picture was asked for only after the full hold');
  assert.match(await p.textContent('#etDevelopHint'), /developed/);
  assert.equal(await p.$eval('#etReel .arc', g => getComputedStyle(g).animationPlayState), 'running');
  await p.click('#etGlow');
  assert.equal(await p.$eval('#etReel .arc', g => getComputedStyle(g).animationPlayState), 'paused');
  assert.ok(await p.$eval('#etReel .arc', g => parseFloat(getComputedStyle(g).animationDuration)) >= 1 / 3, 'under 3 Hz');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduced: true });
  assert.equal(await still.p.$eval('#etReel .arc', g => getComputedStyle(g).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the index is complete at first paint; an entry opens to its files, linked in this tab', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ kv: document.querySelectorAll('#etReceipt tr').length, rows: document.querySelectorAll('#etEntries tr.pick').length, pipe: document.querySelectorAll('#etPipe li').length,
    path: document.getElementById('etPath').textContent, fork: [...document.querySelectorAll('.et-c a')].filter(a => /fork/.test(a.textContent)).map(a => [a.target, a.rel, a.href])[0] }));
  assert.equal(d.kv, 10); assert.equal(d.rows, 20); assert.equal(d.pipe, 6);
  assert.equal(d.path, 'record/ · 76 files · 20 entries');
  assert.deepEqual(d.fork, ['_blank', 'noopener noreferrer', 'https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/record.html']);
  await p.click('#etEntries tr.pick[data-k="4"]');
  const files = await p.$$eval('#etEntries tr.more[data-k="4"] a', as => as.map(a => [a.getAttribute('href'), a.target, a.textContent]));
  assert.equal(files.length, E[4].i.length);
  files.forEach((f, i) => { assert.equal(f[0], 'record/' + E[4].i[i][0]); assert.equal(f[1], ''); assert.ok(f[2].includes(DIMS[E[4].i[i][0]].join('×'))); });
  assert.equal(await p.$eval('#etEntries tr.more[data-k="4"]', r => r.hidden), false);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
