// law-of-the-sea-eternal.test.mjs — the Law of the Sea as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). FOUNDER PRINT RULING (2026-09-21): the ruled first
// screen (#first) and the first disclosure (#why) stay clear of the tour bar at 390x844, so on this
// page the fronts come AFTER them (e2e/law-of-the-sea-fold.test.mjs is the ruling's own proof; this
// file re-asserts the order and the clearance). Proves at 390 px: exactly one front per register,
// each in its own dress; all three carry the SAME facts, read from the page (the three laws, the one
// ruled word, the 22 glossary rows in the order a file travels, the 16 history rows with their
// caveat, the open items), and the glossary matches docs/LAW-OF-THE-SEA.md word for word; every
// word flies its first letter's signal flag; hoisting a flag never rules a word; the fronts open the
// page's own disclosures; and the laws hold on the front.
// Run: node --test e2e/law-of-the-sea-eternal.test.mjs
// Red-on-HEAD proof: git show HEAD:surfaces/law-of-the-sea.html > /tmp/sea.html;
//   ETERNAL_OVERRIDE=/tmp/sea.html node --test e2e/law-of-the-sea-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/law-of-the-sea.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9272, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.terms.length && document.body.dataset.reg && document.getElementById('bregbar'), null, { timeout: 8000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  return { ctx, p, errs };
}
const view = async reg => (cache[reg] ||= await open(reg));
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('the print ruling holds: #first and #why come first and clear the bar, the fronts follow them', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    const m = await p.evaluate(() => {
      const tb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tbar-h')), b = s => document.querySelector(s).getBoundingClientRect();
      const ev = document.getElementById('eternal');
      return { limit: innerHeight - tb, tb, first: b('#first').bottom, ruled: b('#ruled').bottom, why: b('#why > summary').bottom, et: b('#eternal').top,
        after: !!(document.getElementById('why').compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING), firstAfter: !!(document.getElementById('first').compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    assert.ok(Number.isFinite(m.tb) && m.tb > 0, reg + ': --tbar-h is published');
    assert.ok(m.after && m.firstAfter, reg + ': the fronts come after #first and #why in the page');
    for (const k of ['first', 'ruled', 'why']) assert.ok(m[k] <= m.limit, `${reg}: ${k} bottom ${m[k]} clears the bar (${m.limit})`);
    assert.ok(m.et >= m.why, reg + ': the fronts start below the first disclosure');
  }
});

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etSeaGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '.et-r-pill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '.et-c-primary', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { p, errs } = await view(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(fr.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
  }
});

test('the same law in all three, read from the page, and the glossary is the source file’s, word for word', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        laws: D.laws, ruled: D.ruled, terms: D.terms.map(x => [x.name, x.ruled, x.sea, x.here]), history: D.history.length, historyNote: D.historyNote, open: D.open, source: D.source, date: D.rulingDate,
        page: { laws: all('#first ol.laws li').map(t), terms: all('#glossary article.term h3').map(h => t(h)), ruled: t(document.querySelector('#ruled h2')) },
        flags: all('#etSeaFlags [data-term]').map(b => [b.classList.contains('et-ruled'), b.getAttribute('aria-label')]), hoist: all('#etSeaHoist .et-sea-fly b').map(t),
        rows: all('#etSeaTab tr.et-pick').map(r => [t(r.children[1]), t(r.children[2])]), cyLaws: all('#etSeaLaws li').length, cyHist: all('#etSeaHist tbody tr').length, cyOpen: all('#etSeaOpen li').length,
      };
    });
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['laws', 'ruled', 'terms', 'history', 'open', 'source', 'date']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.laws, a.page.laws); assert.equal(a.laws.length, 3);
  assert.equal(a.terms.length, 22); assert.deepEqual(a.terms.filter(x => x[1]).map(x => x[0]), ['Manifest'], 'only Manifest is ruled');
  assert.equal(a.ruled.name, a.page.ruled); assert.equal(a.date, '2026-09-21');
  assert.equal(a.history, 16); assert.match(a.historyNote, /to be checked against a source/); assert.equal(a.open.length, 3);
  // the source file the footer names carries the same glossary, row for row
  assert.equal(a.source, 'docs/LAW-OF-THE-SEA.md');
  const md = await readFile(join(ROOT, a.source), 'utf8');
  const table = md.split('\n').filter(l => /^\| (?!Term |---)/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  assert.deepEqual(table.slice(0, a.terms.length), a.terms.map(x => [x[0], x[2], x[3]]), 'the glossary matches docs/LAW-OF-THE-SEA.md');
  // bee: every word, raver: every flag, cypherpunk: every row
  const { p } = await view('bee'); await p.click('#etSeaMore');
  assert.deepEqual(await p.$$eval('#etSeaRows .et-b-row[data-term] b', e => e.map(x => x.textContent)), a.terms.map(x => x[0]));
  assert.equal(facts.raver.flags.length, 22); assert.deepEqual(facts.raver.flags.map(f => f[0]), a.terms.map(x => x[1]), 'solid edge only where ruled');
  facts.raver.flags.forEach(([, label], i) => assert.ok(label.endsWith('flies ' + a.terms[i][0][0].toUpperCase()), 'flag ' + i + ' flies its first letter'));
  assert.deepEqual(facts.raver.hoist, ['manifest'], 'the ruled word flies from arrival');
  assert.deepEqual(facts.cypherpunk.rows.map(r => r[1]), a.terms.map(x => x[1] ? 'ruled' : 'proposed'));
  assert.equal(facts.cypherpunk.cyLaws, 3); assert.equal(facts.cypherpunk.cyHist, 16); assert.equal(facts.cypherpunk.cyOpen, 3);
});

test('gestures read, never rule: bee opens the page’s own disclosures, raver hoists flags, cypherpunk opens rows', async () => {
  const b = await open('bee');
  assert.equal(await b.p.$eval('#glossary', d => d.open), false);
  await b.p.click('#etSeaGo'); await b.p.waitForTimeout(250);
  assert.equal(await b.p.$eval('#glossary', d => d.open), true, 'the one action opens the whole glossary');
  assert.ok(await b.p.$eval('#glossary', e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  await p.locator('#etSeaFlags [data-term="1"]').click({ force: true });
  assert.deepEqual(await p.$$eval('#etSeaHoist .et-sea-fly b', e => e.map(x => x.textContent)), ['manifest', 'cargo'], 'the tap landed: cargo flies beside manifest');
  assert.match(await p.textContent('#etSeaCard'), /cargo · proposed[\s\S]*The goods being carried/);
  for (const i of [2, 3, 4]) await p.locator(`#etSeaFlags [data-term="${i}"]`).click({ force: true });
  assert.deepEqual(await p.$$eval('#etSeaHoist .et-sea-fly b', e => e.map(x => x.textContent)), ['manifest', 'hold', 'bill of lading', 'clearance'], 'a hoist carries the ruled word and three more');
  await p.locator('#etSeaFlags [data-term="0"]').click({ force: true });
  assert.ok((await p.$$eval('#etSeaHoist .et-sea-fly b', e => e.map(x => x.textContent))).includes('manifest'), 'the ruled flag cannot be lowered');
  assert.deepEqual(await p.evaluate(() => window.__eternal.data.terms.filter(t => t.ruled).map(t => t.name)), ['Manifest'], 'no gesture ruled a word');
  await p.click('#etSeaStill');
  assert.equal(await p.$eval('#etSeaHoist .et-sea-fly svg', e => getComputedStyle(e).animationPlayState), 'paused', 'the wind can be stilled');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  assert.equal(await still.p.$eval('#etSeaHoist .et-sea-fly svg', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
  const c = await view('cypherpunk');
  await c.p.click('#etSeaTab tr.et-pick[data-term="6"]');
  assert.match(await c.p.$eval('#etSeaTab tr.et-more[data-term="6"]', e => e.hidden ? '' : e.textContent), /at sea · Departure/);
  assert.equal(await c.p.$eval('#eternal .et-c-primary', a => [a.target, a.rel, a.textContent].join(' ')), '_blank noopener noreferrer read the source file ↗ (new tab)');
});

test('the laws hold on the front: no dash or NaN for a value, no forced capitals, 44 px actions, nothing past 390 px', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
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
