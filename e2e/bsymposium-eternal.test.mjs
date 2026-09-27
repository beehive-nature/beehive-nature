// bsymposium-eternal.test.mjs — "two food protocols, both receipted" as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; all three quote the SAME discourse the page renders (window.__bsymposium): seven
// questions, align 4 · complementary 1 · open 2, both receipts per line with the page's own labels and
// links, the measured link status (16 of 17 resolve, one paywall, 2026-08-21) and the corrections in
// the page's own words; every gesture hands off to the page's own beats (meet, figure, deeper) and the
// raver's breathing pauses (its own button and the room's). Run: node --test e2e/bsymposium-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bsymposium.html> node --test e2e/bsymposium-eternal.test.mjs
const PAGE = 'bsymposium.html', PORT = 9266;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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

async function open(reg, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', 'en'); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#etBeeRows .et-b-row'), null, { timeout: 8000 });
  return { ctx, p, errs, outside };
}
const beat = p => p.evaluate(() => document.body.getAttribute('data-bsymp-beat'));
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
// the page's own rendered discourse, read from its table (not from the front)
const PAGEROWS = () => [...document.querySelectorAll('#rows tbody tr')].map(tr => ({ q: tr.cells[0].textContent, state: tr.cells[3].textContent.trim(),
  links: [...tr.querySelectorAll('.cite a')].map(a => [a.getAttribute('href'), a.textContent]), fix: ([...tr.cells[1].querySelectorAll('i')].find(i => /^a prior version/.test(i.textContent)) || {}).textContent || '' }));

test('one front per register, its own dress, and the same discourse the page renders', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([w, PR]) => {
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, page = new Function('return (' + PR + ')()')();
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        primaries: fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary').length, page,
        model: D.rows.map(r => ({ q: r.q, state: r.glyph + ' ' + r.state, links: [[r.mu, r.mc], [r.bu, r.bc]], fix: r.correction })),
        counts: [D.counts.align, D.counts.comp, D.counts.open, D.resolve, D.measured, D.on, D.sources, D.corrections], srcs: document.querySelectorAll('#srcs a').length,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.querySelector('.q').textContent),
        beeLinks: [...document.querySelectorAll('#etBeeRows .et-b-open')].map(o => [...o.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.firstChild.textContent])),
        strands: [...document.querySelectorAll('#etBraid .strand')].map(g => g.querySelector('.th').classList[1]),
        lines: [...document.querySelectorAll('#etLines tr.pick')].map(r => [r.cells[1].textContent, r.cells[2].textContent]),
        cyLinks: [...document.querySelectorAll('#etLines tr.more')].map(o => [...o.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.firstChild.textContent])),
        lede: document.getElementById('etBeeLede').textContent, foot: document.getElementById('etBeeFoot').textContent, receipt: document.getElementById('etReceipt').textContent };
    }, [w, PAGEROWS.toString()]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one filled action');
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' laws');
    // one discourse: the front's model is the page's own table, quoted
    assert.equal(d.page.length, 7);
    assert.deepEqual(d.model.map(r => r.q), d.page.map(r => r.q), 'the seven questions');
    assert.deepEqual(d.model.map(r => r.state), d.page.map(r => r.state), 'the states, glyph and label');
    assert.deepEqual(d.model.map(r => r.links), d.page.map(r => r.links), 'both receipts per line: the page\'s own labels and links');
    assert.deepEqual(d.model.map(r => r.fix.replace(/\s+/g, ' ')), d.page.map(r => r.fix.replace(/\s+/g, ' ')), 'the corrections, in the page\'s own words');
    assert.deepEqual(d.counts, [4, 1, 2, 16, 17, '2026-08-21', d.srcs, 2]); assert.equal(d.srcs, 22);
    // every register draws the same seven, in order
    assert.deepEqual(d.bee, d.page.map(r => r.q));
    assert.deepEqual(d.beeLinks, d.page.map(r => r.links));
    assert.deepEqual(d.strands, ['align', 'comp', 'align', 'align', 'open', 'open', 'align']);
    assert.deepEqual(d.lines, d.page.map(r => [r.q, r.state]));
    assert.deepEqual(d.cyLinks, d.page.map(r => r.links));
    assert.match(d.lede, /on 7 questions.*they agree on 4, each fills the other’s gap on 1, and 2 are still open/);
    assert.match(d.foot, /16 of 17 cited links opened when they were checked on 2026-08-21/);
    assert.match(d.receipt, /measured17 cited urls · 16 resolve · 1 unverifiable from here/);
    assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('bee: a question opens to both receipts; the one action and the link hand off to the page\'s own beats', async () => {
  const { ctx, p, errs } = await open('bee');
  assert.equal(await beat(p), 'arrival');
  await p.click('#etBeeRows .et-b-row[data-n="7"]');
  const o = await p.evaluate(() => { const b = document.querySelector('#etBeeRows .et-b-row[data-n="7"]').nextElementSibling; return { hidden: b.hidden, a: [...b.querySelectorAll('a')].map(a => [a.target, a.rel]), txt: b.textContent }; });
  assert.equal(o.hidden, false);
  assert.deepEqual(o.a, [['_blank', 'noopener noreferrer'], ['_blank', 'noopener noreferrer']], 'external receipts open a new tab');
  assert.match(o.txt, /NOTUS, May 29 2025.*this link opened when it was checked on 2026-08-21/);
  assert.match(o.txt, /opens in a new tab/);
  await p.click('#eternal .et-b-primary');
  assert.equal(await beat(p), 'meet', 'the page\'s own "meet" beat');
  assert.equal(await p.$eval('#layer-meet', e => getComputedStyle(e).display), 'block');
  await p.click('#eternal .et-b-link[data-bsymp-go="deeper"]');
  assert.equal(await beat(p), 'deeper'); assert.equal(await p.$eval('#instrument', e => getComputedStyle(e).display), 'block');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a thread to light it; its receipts are touchable; the pill sits with both sides; breathing pauses', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.$eval('#etBraid', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const c = await p.$eval('#etBraid .strand[data-n="5"] .gap', g => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(c.x, c.y);
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 4, 'the tap landed on thread 5');
  assert.match(await p.textContent('#etRaverCard'), /◐ 5seed oils\?open · a graded, pre-registered evidence review/);
  const rc = await p.$$eval('#etRaverReceipts a', as => as.map(a => [a.getAttribute('href'), a.target]));
  const want = await p.evaluate(() => [...document.querySelectorAll('#rows tbody tr')[4].querySelectorAll('.cite a')].map(a => a.getAttribute('href')));
  assert.deepEqual(rc.map(r => r[0]), want); assert.ok(rc.every(r => r[1] === '_blank'));
  await p.focus('#etBraid'); await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 5);
  const on = () => p.$eval('#etBraid .strand.on', g => getComputedStyle(g).animationPlayState);
  assert.equal(await on(), 'running');
  assert.ok(await p.$eval('#etBraid .strand.on', g => parseFloat(getComputedStyle(g).animationDuration)) >= 1 / 3, 'under 3 Hz');
  await p.click('#etBreath'); assert.equal(await on(), 'paused', 'its own pause');
  await p.click('#etBreath'); assert.equal(await on(), 'running');
  await p.evaluate(() => document.body.setAttribute('data-motion-paused', 'true')); assert.equal(await on(), 'paused', 'the room\'s pause holds it too');
  await p.click('#eternal .et-r-pill');
  assert.equal(await beat(p), 'figure', 'the page\'s own raver beat');
  assert.equal(await p.$eval('#layer-figure', e => getComputedStyle(e).display), 'block');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduced: true });
  assert.equal(await still.p.$eval('#etBraid .strand.on', g => getComputedStyle(g).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the receipts are complete at first paint; a line opens to its citations, status and confession', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  assert.equal(await beat(p), 'deeper', 'the page\'s own cypherpunk default');
  const d = await p.evaluate(() => ({ lines: document.querySelectorAll('#etLines tr.pick').length, pipe: document.querySelectorAll('#etPipe li').length, kv: document.querySelectorAll('#etReceipt tr').length,
    path: document.getElementById('etPath').textContent, pipeTxt: document.getElementById('etPipe').textContent,
    fork: [...document.querySelectorAll('.et-c a')].filter(a => /fork/.test(a.textContent)).map(a => [a.target, a.rel, a.href])[0] }));
  assert.equal(d.lines, 7); assert.equal(d.pipe, 6); assert.equal(d.kv, 7);
  assert.equal(d.path, 'bsymposium://maha×bfood · 7 lines · both receipted');
  assert.match(d.pipeTxt, /16 × 200 · 1 × 401 \(paywalled to this host — neither confirmed nor refuted\)/, 'the paywall quoted as the page measured it');
  assert.deepEqual(d.fork, ['_blank', 'noopener noreferrer', 'https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/bsymposium.html']);
  await p.click('#etLines tr.pick[data-n="2"]');
  const more = await p.$eval('#etLines tr.more[data-n="2"]', t => ({ hidden: t.hidden, q: t.querySelector('q').textContent, txt: t.textContent }));
  const pageFix = await p.evaluate(() => [...document.querySelectorAll('#rows tbody tr')[1].cells[1].querySelectorAll('i')].find(i => /^a prior version/.test(i.textContent)).textContent.replace(/\s+/g, ' '));
  assert.equal(more.hidden, false); assert.equal(more.q, pageFix, 'the confession, word for word');
  assert.match(more.txt, /200 · resolved 2026-08-21/);
  await p.click('#etLines tr.pick[data-n="4"]');
  assert.match(await p.textContent('#etLines tr.more[data-n="4"]'), /401 · paywalled to this host — neither confirmed nor refuted/);
  await p.click('#etCyRecord');
  assert.equal(await p.$eval('#sources-panel', d => d.open), true, 'the record opens below');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
