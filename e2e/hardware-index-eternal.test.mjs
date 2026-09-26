// hardware-index-eternal.test.mjs — the open hardware guide as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per
// register, each in its own dress; all three carry the SAME facts, read from the guide's own walls
// (the ladder table, the device panels and their gauges, the excluded list, the three rules); every
// "order direct" is the maker's own link opened in a new tab, never a purchase, and the excluded
// devices get no link at all; and the laws hold (no dash for a value, no forced capitals, 44 px
// actions, no sideways page, motion paused on request and still under reduced motion).
// Run: node --test e2e/hardware-index-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/hardware/index.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/hardware/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9164, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  // nothing leaves the box: the makers' sites and their product images are refused
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}${opts.hash || ''}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.rungs.length && document.body.dataset.reg, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etHwFree', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHwPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etHwCyOrder', action: 'rgb(69, 194, 220)' },
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
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px (' + d.wide + '/' + d.vw + ')');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the guide’s own walls', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
      const all = s => [...document.querySelectorAll(s)];
      return {
        // the page itself, counted independently of the data layer
        wall: { panels: all('main .panel.dev').length, ladder: all('main table')[0].querySelectorAll('tr td:first-child').length, excluded: all('main .panel.x p b').map(t) },
        rungs: D.rungs.map(r => [r.price, r.rung, r.device, r.devs.map(i => D.devices[i].name)]),
        devices: D.devices.map(d => [d.name, d.checks.length, d.maker && d.maker.href]),
        also: D.also.map(i => D.devices[i].name), excluded: D.excluded.map(x => x.name), rules: D.rules.map(r => r.n),
        bee: all('#etHwRungs .et-b-row').map(t), beeOut: all('#etHwOut .et-b-term b').map(t),
        treads: all('#etHwClimb .et-tread').map(g => [g.getAttribute('aria-label'), g.querySelectorAll('circle').length]),
        rAlso: all('#etHwAlso [data-rdev]').map(t), rLeft: all('#etHwLeft [data-left]').map(t),
        cLadder: all('#etHwLadder tr').map(t), cDevs: all('#etHwDevTab tr').map(t), cOut: all('#etHwOutTab th').map(t),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['rungs', 'devices', 'also', 'excluded', 'rules']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  // the data layer is the wall: 6 rungs, 8 panels (one of them names three devices), 3 excluded, 3 rules
  assert.equal(a.wall.ladder, 6); assert.equal(a.rungs.length, 6); assert.equal(a.wall.panels, 8); assert.equal(a.devices.length, 10);
  assert.deepEqual(a.excluded, a.wall.excluded.map(s => s.replace(/\.$/, ''))); assert.deepEqual(a.rules, [1, 2, 3]);
  assert.deepEqual(a.rungs[1][3], ['SeedSigner', 'Krux']); assert.deepEqual(a.rungs[4][3], ['Trezor Safe 7']); assert.deepEqual(a.rungs[0][3], []);
  assert.deepEqual(a.also, ['BitBox02', 'OneKey', 'Cypherock X1']);
  assert.ok(a.devices.every(d => /^https:\/\//.test(d[2])), 'every device carries its maker’s own link');
  // bee rows, raver treads, cypherpunk ladder: each draws every rung with its price
  a.rungs.forEach(([price, rung], i) => {
    assert.ok(a.bee[i].includes(price) && a.bee[i].includes(rung), 'bee row ' + i);
    assert.ok(facts.raver.treads[i][0].includes(price) && facts.raver.treads[i][0].includes(rung), 'raver tread ' + i);
    assert.ok(facts.cypherpunk.cLadder[i].includes(price) && facts.cypherpunk.cLadder[i].includes(rung), 'cypherpunk row ' + i);
  });
  // the raver lights are the gauges: one light per gauge of the devices on that tread
  a.rungs.forEach((r, i) => { const n = r[3].reduce((s, name) => s + a.devices.find(d => d[0] === name)[1], 0); assert.equal(facts.raver.treads[i][1], n, 'lights on tread ' + i); });
  assert.deepEqual(a.beeOut, a.excluded); assert.deepEqual(facts.raver.rLeft, a.excluded); assert.deepEqual(facts.cypherpunk.cOut, a.excluded);
  assert.deepEqual(facts.raver.rAlso, a.also); assert.equal(facts.cypherpunk.cDevs.length, 10);
});

test('bee: a rung, its device, three habits, then the maker’s own page in a new tab', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await p.click('.et-b-row[data-rung="2"]');
  assert.deepEqual(await p.$$eval('#etHwDevs .et-b-item b', e => e.map(x => x.textContent)), ['SeedSigner', 'Krux']);
  await p.click('#etHwNext');
  assert.equal(await p.$eval('.et-b-step[data-step="rules"]', e => e.hidden), false);
  assert.equal(await p.$$eval('#etHwRules .et-b-term', e => e.length), 3, 'the guide’s three rules');
  assert.equal(await p.$eval('#etHwWait', b => b.disabled), true, 'no link before the habits are accepted');
  assert.equal(await p.$eval('#etHwGo', a => a.hidden), true);
  await p.check('#etHwOk');
  const go = await p.$eval('#etHwGo', a => ({ hidden: a.hidden, href: a.href, target: a.target, rel: a.rel, text: a.textContent }));
  assert.equal(go.hidden, false); assert.equal(go.href, 'https://seedsigner.com/'); assert.equal(go.target, '_blank'); assert.equal(go.rel, 'noopener noreferrer');
  assert.match(go.text, /new.tab/, 'the reader is told a new tab opens');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#etHwGo')]);
  await pop.waitForLoadState().catch(() => {});
  assert.ok(outside.includes('https://seedsigner.com/'), 'a new tab asked the maker itself (refused here, nothing leaves the box)');
  assert.notEqual(pop, p, 'the guide stays open in its own tab');
  const said = await p.textContent('#etHwSaid');
  assert.match(said, /opened in a new tab\. nothing was bought here\./);
  assert.doesNotMatch(await p.textContent('#eternal .et-b'), /\b(ordered|purchased|paid|verified)\b/i, 'the front never claims an order');
  assert.ok(outside.every(u => !/seedsigner/.test(u) || u.startsWith('https://seedsigner.com')), 'only the maker is asked');
  // the $0 rung buys nothing: it is the estate's own ceremony, same tab
  await p.click('.et-b-back[data-go="rung"]'); await p.click('.et-b-back[data-go="ladder"]');
  await p.click('.et-b-row[data-rung="1"]');
  const free = await p.$eval('#etHwNext', a => ({ href: a.getAttribute('href'), target: a.target }));
  assert.deepEqual(free, { href: '../onboarding/', target: '' });
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a tread, light the three rules; the left-out get a reason and no link', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.$$eval('#etHwClimb .et-tread', e => e.length), 6);
  await p.click('.et-tread[data-rung="5"]');
  assert.match(await p.textContent('#etHwCard'), /Trezor Safe 7/);
  assert.equal(await p.$eval('#etHwPill', a => a.hidden), true, 'no link before the rules are lit');
  for (const t of [1, 2]) await p.click(`#etHwTiles button[data-t="${t}"]`);
  assert.match(await p.textContent('#etHwLit'), /2 of 3 lit/);
  assert.equal(await p.$eval('#etHwPill', a => a.hidden), true);
  await p.click('#etHwTiles button[data-t="3"]');
  const pill = await p.$eval('#etHwPill', a => ({ hidden: a.hidden, href: a.href, target: a.target, rel: a.rel }));
  assert.deepEqual(pill, { hidden: false, href: 'https://trezor.io/', target: '_blank', rel: 'noopener noreferrer' });
  await p.click('[data-left="0"]');
  assert.match(await p.textContent('#etHwCard'), /Ledger[\s\S]*closed secure element/);
  assert.equal(await p.$eval('#etHwPill', a => a.hidden), true, 'an excluded device never gets a link');
  assert.equal(await p.$$eval('#eternal a[href*="ledger"],#eternal a[href*="coinkite"],#eternal a[href*="coldcard"]', e => e.length), 0);
  // the motion pauses on request
  await p.click('#etHwStill');
  assert.equal(await p.$eval('.et-tread[aria-pressed="true"] .et-dots', e => getComputedStyle(e).animationPlayState).catch(() => 'paused'), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduce: true });
  await still.p.click('.et-tread[data-rung="2"]');
  assert.equal(await still.p.$eval('.et-tread[aria-pressed="true"] .et-dots', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and every outside link says so', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    ladder: document.querySelectorAll('#etHwLadder tr').length, devs: document.querySelectorAll('#etHwDevTab tr').length,
    pipe: document.querySelectorAll('#etHwPipe li').length, rcpt: document.querySelectorAll('#etHwRcpt tr').length,
    out: document.querySelectorAll('#etHwOutTab tr').length, verify: document.querySelectorAll('#etHwVerify li').length,
    path: document.getElementById('etHwPath').textContent,
    ext: [...document.querySelectorAll('#eternal a[href^="http"]')].map(a => [a.target, a.rel]),
  }));
  assert.deepEqual([d.ladder, d.devs, d.pipe, d.rcpt, d.out, d.verify], [6, 10, 5, 7, 3, 3]);
  assert.equal(d.path, 'hw://guide/trezor-safe-7', 'the first panel in page order is selected');
  assert.ok(d.ext.length >= 4 && d.ext.every(([t, r]) => t === '_blank' && r === 'noopener noreferrer'), 'external links open a new tab');
  await p.click('#etHwDevTab tr[data-cdev="1"]');
  assert.equal(await p.textContent('#etHwPath'), 'hw://guide/seedsigner');
  assert.equal(await p.$eval('#etHwCyOrder', a => a.href), 'https://seedsigner.com/');
  assert.match(await p.textContent('#etHwRcpt'), /source\s*https:\/\/github\.com\/SeedSigner\/seedsigner/);
  await p.click('#etHwLadder tr[data-crung="1"]');
  assert.equal(await p.$eval('#etHwCyOrder', a => a.getAttribute('href')), '../onboarding/');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  const views = [['bee'], ['bee', '#rung-2'], ['raver'], ['cypherpunk']];
  for (const [reg, hash] of views) {
    const { ctx, p } = await open(reg, { hash });
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
    assert.deepEqual(bad, [], reg + (hash || ''));
    if (hash) assert.equal(await p.$eval('.et-b-step[data-step="rung"]', e => e.hidden), false, 'a #rung-N link opens that rung');
    await ctx.close();
  }
});
