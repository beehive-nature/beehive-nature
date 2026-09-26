// hardware-security-eternal.test.mjs — security events as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress; all three carry the SAME facts, read from the page's own hand-curated entries
// (dates, kinds, titles, "what it means for you") and the sources its footer names; every entry
// either links its source or says UNVERIFIED (AGENTS.md: security claims cite their source or say
// UNVERIFIED), and only a source the page itself links is ever linked; the raver line draws the
// silence before each disclosure from the page's own dates; and the laws hold.
// Run: node --test e2e/hardware-security-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/hardware/security.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/hardware/security.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9167, ORIGIN = `http://127.0.0.1:${PORT}`;
const BLOCK = 'https://engineering.block.xyz/blog/predictable-rng-fallback-and-32-bit-reseed-in-coldcard-firmware';
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
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.events.length && document.body.dataset.reg, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etScAll', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etScPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etScCyOpen', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'nothing is fetched: the entries are hand-curated, never ingested');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, from the page’s own entries and footer', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      return {
        wall: { titles: all('main .panel h2').map(t), dates: all('main .panel .date').map(t), links: all('main footer a[href^="http"]').map(a => a.href) },
        events: D.events.map(e => [e.n, e.title, e.date, e.kind, e.src, e.sources.map(s => s.name), e.devices, [e.w.start, e.w.end, e.w.open, e.w.exploited].map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v)]),
        sources: D.sources.map(s => [s.name, s.href, s.events]),
        devRows: all('#etScDevs .et-b-row').map(t),
        lanes: all('#etScWave .et-lane').map(g => [g.getAttribute('aria-label'), g.querySelectorAll('.et-quiet').length, g.querySelectorAll('.et-told').length, g.querySelectorAll('.et-open').length]),
        cTab: all('#etScTab tr.et-pick').map(t), cAudit: all('#etScAudit tr').map(t), cSrc: all('#etScSrc th').map(t),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['events', 'sources']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.events.map(e => e[1]), a.wall.titles, 'five entries, the page’s own titles');
  assert.deepEqual(a.events.map(e => e[2]), a.wall.dates);
  // the sources: five named by the footer, one linked by the page; each finds its entry by shared words
  assert.equal(a.sources.length, 5);
  assert.deepEqual(a.sources.filter(s => s[1]).map(s => s[1]), a.wall.links.filter(h => h.includes('block.xyz')));
  assert.deepEqual(a.sources.map(s => s[2]), [[1], [1], [2], [3], [4]]);
  assert.deepEqual(a.events.map(e => e[4]), ['linked', 'named', 'named', 'named', 'none'], 'linked, or UNVERIFIED');
  // the dates, as the page writes them: 2021 silence broken in Jul 2026; three still standing
  const [rng] = a.events; assert.deepEqual([Math.floor(rng[7][0]), Math.floor(rng[7][1]), rng[7][3]], [2021, 2026, true]);
  assert.deepEqual(a.events.map(e => e[7][2]), [false, false, true, true, true]);
  assert.deepEqual(a.events.map(e => e[6]), [['Coldcard'], ['Trezor Safe 7'], ['Ledger'], ['Coldcard'], ['Trezor Safe 7']]);
  // bee counts per device, raver lanes, cypherpunk rows all draw the same five
  assert.match(a.devRows[0], /Coldcard\s*2 entries/); assert.match(a.devRows[1], /Trezor Safe 7\s*2 entries/); assert.match(a.devRows[2], /Ledger\s*1 entry/);
  assert.equal(facts.raver.lanes.length, 5);
  assert.deepEqual(facts.raver.lanes.map(l => [l[1], l[2]]), [[1, 1], [1, 1], [0, 0], [0, 0], [1, 0]], 'silence then a burst where the page says disclosed; the gap stays silent');
  facts.raver.lanes.forEach((l, i) => assert.ok(l[0].startsWith(a.events[i][1])));
  facts.cypherpunk.cTab.forEach((r, i) => assert.ok(r.includes(a.events[i][1]) && r.includes(a.events[i][2])));
  assert.deepEqual(facts.cypherpunk.cAudit.map(r => /linked$/.test(r) ? 'linked' : /UNVERIFIED$/.test(r) ? 'unverified' : r), ['linked', 'unverified', 'unverified', 'unverified', 'unverified']);
});

test('bee: pick a device, read what it means, and the source or the page itself', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await p.click('.et-b-row[data-dev="Coldcard"]');
  assert.equal(await p.$$eval('#etScEvents .et-b-term', e => e.length), 2);
  assert.match(await p.textContent('#etScEvents'), /a serious flaw[\s\S]*generated weak[\s\S]*Block engineering advisory[\s\S]*source named, not linked here · UNVERIFIED/);
  const go = await p.$eval('#etScGo', a => [a.href, a.target, a.rel]);
  assert.deepEqual(go, [BLOCK, '_blank', 'noopener noreferrer']);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#etScGo')]);
  await pop.waitForLoadState().catch(() => {});
  assert.ok(outside.includes(BLOCK), 'the linked source opens in a new tab (refused here)');
  await p.click('.et-b-back');
  await p.click('.et-b-row[data-dev="Ledger"]');
  assert.equal(await p.$eval('#etScGo', a => a.getAttribute('href')), '#etEvent3', 'no linked source: the page’s own entry');
  assert.match(await p.textContent('#etScEvents'), /UNVERIFIED/);
  await p.click('.et-b-back'); await p.click('.et-b-row[data-dev="other"]');
  assert.match(await p.textContent('#etScDevL'), /not a clean bill of health/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a line to light it; motion pauses and is still under reduced motion', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.$eval('#etScPill', a => a.getAttribute('href')), '#etEvent1');
  await p.click('#etScWave [data-ev="1"] rect');
  assert.match(await p.textContent('#etScCard'), /Coldcard RNG failure[\s\S]*silent for about 5 years[\s\S]*actively exploited[\s\S]*source linked/);
  assert.equal(await p.$eval('#etScPill', a => a.href), BLOCK);
  await p.click('#etScWave [data-ev="5"] rect');
  assert.match(await p.textContent('#etScCard'), /no source named · UNVERIFIED/);
  assert.equal(await p.$eval('#etScPill', a => a.getAttribute('href')), '#etEvent5');
  await p.click('#etScStill');
  assert.equal(await p.$eval('#etScWave .et-scan', e => getComputedStyle(e).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  assert.equal(await still.p.$eval('#etScWave .et-scan', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: every entry audited against the page’s own law, complete at first paint', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etScTab tr.et-pick').length, audit: document.querySelectorAll('#etScAudit tr').length,
    law: [...document.querySelectorAll('#etScLaw li b')].map(b => b.textContent), src: document.querySelectorAll('#etScSrc tr').length,
    links: [...document.querySelectorAll('#eternal a[href^="http"]')].map(a => [a.href, a.target, a.rel]),
  }));
  assert.equal(d.rows, 5); assert.equal(d.audit, 5); assert.equal(d.src, 6, 'five named sources and the one entry with none');
  assert.deepEqual(d.law, ['kind · 5/5', 'access required · 1/5', 'disclosed or outed · 2/5', 'what it means for you · 5/5', 'primary source · 1/5']);
  assert.ok(d.links.every(([h, t, r]) => t === '_blank' && r === 'noopener noreferrer'));
  assert.deepEqual([...new Set(d.links.map(l => l[0]).filter(h => !h.includes('github.com/beehive-nature')))], [BLOCK], 'only the source the page links is linked');
  await p.click('#etScTab tr[data-cev="2"]');
  assert.match(await p.textContent('#etScTab tr.et-more'), /two heterogeneous secure elements[\s\S]*vendor disclosed/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etScAll');
    if (reg === 'raver') await p.click('#etScWave [data-ev="2"] rect');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null)$/.test(own)) out.push('value ' + el.className + ' ' + own);
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
