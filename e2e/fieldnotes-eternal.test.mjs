// fieldnotes-eternal.test.mjs — the logbook as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its
// own dress; all three carry the SAME facts, read from the logbook below (every entry's anchor,
// title, date and beats, word for word); every quote on a front is the entry's own words (a cut
// quote is a true prefix and ends in "…"); the receipts (links and ids) are the ones the entries
// cite, external ones opening a new tab; the raver chart's blocks are as tall as the words written;
// copy says "copied" only when the browser copied; the page's own § links still work; and the laws
// hold on the front.
// Run: node --test e2e/fieldnotes-eternal.test.mjs
// Red-on-HEAD proof: git show HEAD:surfaces/fieldnotes.html > /tmp/fn.html;
//   ETERNAL_OVERRIDE=/tmp/fn.html node --test e2e/fieldnotes-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fieldnotes.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9271, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''); if (rel.endsWith('/')) rel += 'index.html';
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
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
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.entries.length && document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const view = async reg => (cache[reg] ||= await open(reg));
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etFnGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etFnPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etFnCopy', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { p, errs } = await view(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
  }
});

test('the same logbook in all three, read word for word from the entries', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        entries: D.entries.map(e => [e.id, e.title, e.date, e.beats.map(b => [b.kind, b.text, b.words])]), hero: D.hero,
        page: all('main article.entry').map(a => [a.id, t(a.querySelector('.etitle')), t(a.querySelector('.edate')), all('#' + a.id + ' .beat .bv').map(t)]), count: +t(document.getElementById('entryCount')),
        bee: all('#etFnRows .et-b-row b').map(t),
        cols: all('#etFnWave .et-col').map(g => [g.getAttribute('data-entry'), g.querySelectorAll('.et-blk').length, [...g.querySelectorAll('.et-blk')].map(r => +r.getAttribute('height'))]),
        rows: all('#etFnTab tr.et-pick').map(t), pipe: all('#etFnPipe li').map(t), codes: all('#etFnReceipts code').map(t),
        ext: all('#etFnReceipts a').filter(a => /^https?:/.test(a.getAttribute('href'))).map(a => [a.target, a.rel, /new tab/.test(a.textContent)]),
      };
    });
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].entries, a.entries, reg + ' entries');
  // the data layer is the page, word for word
  assert.equal(a.entries.length, 4); assert.equal(a.hero, a.count); assert.equal(a.count, a.entries.length, 'the hero figure agrees with the entries');
  a.entries.forEach(([id, title, date, beats], i) => { assert.deepEqual([id, title, date], a.page[i].slice(0, 3)); assert.deepEqual(beats.map(b => b[1]), a.page[i][3], id + ' beats word for word'); });
  assert.ok(a.entries.every(e => e[3].some(b => b[0] === 'wrong')), 'every entry says what we got wrong');
  // each register draws the same four entries
  assert.deepEqual(a.bee, a.entries.map(e => e[1]), 'bee rows');
  assert.deepEqual(facts.raver.cols.map(c => c[1]), a.entries.map(e => e[3].length), 'raver: one block per beat');
  const [c0] = facts.raver.cols, beats0 = a.entries[0][3], k = c0[2][0] / beats0[0][2];
  beats0.forEach((b, i) => { if (b[2] * k >= 4) assert.ok(Math.abs(c0[2][i] - b[2] * k) < 0.2, 'block ' + i + ' is as tall as its words'); });
  assert.equal(facts.cypherpunk.rows.length, 4); facts.cypherpunk.rows.forEach((r, i) => assert.ok(r.includes(a.entries[i][1])));
  assert.equal(facts.cypherpunk.pipe.length, 6, 'the six beats of the logbook law');
  for (const tx of ['70eb99cb', 'b9c010a6', 'b32aa6f4']) assert.ok(facts.cypherpunk.codes.some(c => c.startsWith(tx)), 'receipt ' + tx);
  assert.ok(facts.cypherpunk.ext.length >= 3 && facts.cypherpunk.ext.every(([t, r, n]) => t === '_blank' && r === 'noopener noreferrer' && n), 'external receipts open a new tab and say so');
});

test('every quote is the entry’s own words; bee opens an entry, raver lights a beat across the logbook', async () => {
  const b = await open('bee');
  await b.p.click('.et-b-row[data-entry="2"]');
  const q = await b.p.evaluate(() => [...document.querySelectorAll('.et-b-open[data-entry="2"] .et-b-q')].map(e => e.textContent));
  const e2 = await b.p.evaluate(() => window.__eternal.data.entries[2]);
  const beatText = k => e2.beats.find(x => x.kind === k).text;
  for (const [quote, kind] of [[q[0], 'happened'], [q[1], 'wrong']]) { const s = quote.replace(/ …$/, ''); assert.ok(beatText(kind).startsWith(s), kind + ' quoted as written'); assert.equal(quote.endsWith(' …'), s !== beatText(kind), 'a cut quote says so'); }
  assert.equal(await b.p.getAttribute('.et-b-open[data-entry="2"] a', 'href'), '#' + e2.id);
  assert.equal(await b.p.getAttribute('#etFnGo', 'href'), '#e-pricing-2026-08-29', 'the one action opens the newest entry');
  await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  await p.locator('#etFnBeats [data-k="wrong"]').click({ force: true });
  await p.locator('#etFnWave .et-col[data-entry="3"] .et-hit').click({ force: true });
  assert.deepEqual(await p.evaluate(() => [window.__eternal.raver.e, window.__eternal.raver.k]), [3, 'wrong'], 'the taps landed');
  assert.equal(await p.$$eval('#etFnWave .et-blk.et-k-wrong:not(.et-dim)', e => e.length), 4, 'what we got wrong lights in all four entries');
  const card = await p.textContent('#etFnCard'), e3 = await p.evaluate(() => window.__eternal.data.entries[3]);
  const wrong = e3.beats.find(x => x.kind === 'wrong').text, shownQ = await p.$eval('#etFnCard span:last-child', e => e.textContent);
  assert.ok(card.includes(e3.title)); assert.ok(wrong.startsWith(shownQ.replace(/ …$/, '')), 'the card quotes the entry');
  assert.equal(await p.getAttribute('#etFnPill', 'href'), '#' + e3.id);
  await p.click('#etFnStill');
  assert.equal(await p.$eval('#etFnWave .et-blk.et-sel', e => getComputedStyle(e).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  assert.equal(await still.p.$eval('#etFnWave .et-blk.et-sel', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: copy is honest, and the page’s own § link still works', async () => {
  const { p } = await view('cypherpunk');
  await p.click('#etFnCopy'); await p.waitForTimeout(250);
  assert.doesNotMatch(await p.textContent('#etFnCopied'), /^copied/, 'no permission, no "copied"');
  await p.click('#etFnTab tr.et-pick[data-entry="1"]');
  assert.equal(await p.$eval('#etFnTab tr.et-more[data-entry="1"]', e => e.hidden), false, 'an entry opens to its beats');
  const g = await open('cypherpunk', { clip: true });
  await g.p.click('#etFnCopy'); await g.p.waitForTimeout(250);
  assert.match(await g.p.textContent('#etFnCopied'), /^copied/);
  assert.equal(await g.p.evaluate(() => navigator.clipboard.readText()), `${ORIGIN}/${PAGE}#e-pricing-2026-08-29`);
  await g.p.click('#e-domain-2026-08-29 .elink'); await g.p.waitForTimeout(100);
  assert.equal(await g.p.evaluate(() => location.hash), '#e-domain-2026-08-29', 'the logbook’s own anchor handler is untouched');
  await g.ctx.close();
});

test('the laws hold on the front: no dash or NaN for a value, no forced capitals, 44 px actions, nothing past 390 px', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    if (reg === 'bee') await p.click('.et-b-row[data-entry="0"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null|\?)$|not read/.test(own)) out.push('value ' + el.className + ' ' + own);
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
