// profile-eternal.test.mjs — the dynasty profile's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts, read from the page's own published records (the house
// instrument, the disclosure manifest, the bloodline stats); the one action hands off to the page's
// own share button and the front repeats only what that button reports; the cypherpunk check really
// hashes the pinned files in the page and shows a pin that differs as differing; the laws hold.
// Run: node --test e2e/profile-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8916, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { share = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  if (share) await ctx.addInitScript(() => { window.__shared = []; navigator.share = async p => { window.__shared.push(p); }; });
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/profile.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.houses.length, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const html = await readFile(join(ROOT, 'surfaces/profile.html'), 'utf8');
const RECORDS = [...html.matchAll(/<h2 class="hname">([^<]+)<\/h2>/g)].map(m => m[1]);
const STATS = JSON.parse(/<script type="application\/json" id="blood-data">(.*?)<\/script>/s.exec(html)[1]).stats;

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRaverGo', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyVerify', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the houses, their holders, the living guard, the lineage', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => ((document.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ');
      return { data: D.houses.map(h => [h.name, h.kind, h.holder, h.gens, h.current]), living: D.living,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-person b')].map(b => b.textContent), guard: t('#etBeeGuard'),
        cells: [...document.querySelectorAll('#etHive .cell')].map(c => c.getAttribute('aria-label')), threads: document.querySelectorAll('#etHive line').length, tied: D.houses.filter(h => h.tied).length,
        table: [...document.querySelectorAll('#etHouses tr')].map(r => r.textContent), cyGuard: t('#etCyGuard'), manifest: t('#etManifest') };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ': the one data layer');
  assert.deepEqual(a.data.map(h => h[0]), RECORDS, 'the data layer is the page\'s own records');
  assert.equal(a.data[0][2], 'Travis Mark Remington'); assert.equal(a.data.filter(h => h[4]).length, 2);
  assert.deepEqual(a.bee, RECORDS, 'bee: one row per house');
  facts.raver.cells.forEach((l, i) => assert.ok(l.startsWith(RECORDS[i] + ','), 'raver cell ' + i));
  assert.equal(facts.raver.threads, facts.raver.tied); assert.ok(facts.raver.tied >= 4, 'the founder-tied houses are drawn tied');
  facts.cypherpunk.table.forEach((r, i) => assert.ok(r.startsWith(RECORDS[i]), 'cypherpunk row ' + i));
  assert.equal(a.living, STATS.livingRedacted);
  assert.match(a.guard, new RegExp(STATS.livingRedacted + ' people are held back'));
  assert.match(facts.cypherpunk.cyGuard, new RegExp(STATS.livingRedacted + ' living redacted'));
  assert.ok(facts.cypherpunk.manifest.includes(STATS.personsWalked.toLocaleString('en-US')) && facts.cypherpunk.manifest.includes('spine ' + STATS.spineGenerations + ' gens'));
});

test('honest: the share action is the page’s own, and the front repeats only what it reports', async () => {
  for (const reg of ['bee', 'raver']) {
    const { ctx, p } = await open(reg, { share: true });
    const sel = reg === 'bee' ? '#etBeeGo' : '#etRaverGo', st = reg === 'bee' ? '#etBeeStatus' : '#etRaverStatus';
    assert.equal(await p.textContent(st), '', reg + ': nothing claimed before the press');
    await p.click(sel); await p.waitForTimeout(700);
    const d = await p.evaluate(s => ({ shared: window.__shared, page: document.getElementById('share-status').textContent, front: document.querySelector(s).textContent }), st);
    assert.equal(d.shared.length, 1, reg + ': one real share, through the page handler');
    assert.match(d.shared[0].url, /\/surfaces\/profile\.html#house-archive$/);
    assert.ok(d.page.length > 0); assert.equal(d.front, d.page, reg + ': the front says exactly what the page says');
    await ctx.close();
  }
  // without a share sheet the page's own fallback speaks, and the front says the same, not "shared"
  const { ctx, p } = await open('bee');
  await p.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch {} });
  await p.click('#etBeeGo'); await p.waitForTimeout(700);
  const d = await p.evaluate(() => ({ page: document.getElementById('share-status').textContent, front: document.getElementById('etBeeStatus').textContent }));
  assert.equal(d.front, d.page); assert.doesNotMatch(d.front, /opened|copied/i);
  await ctx.close();
});

test('raver: a tapped cell reads its house', async () => {
  const { ctx, p } = await open('raver');
  await p.evaluate(() => document.querySelector('#etHive .cell[data-i="2"] polygon').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const card = await p.textContent('#etRaverCard');
  assert.ok(card.includes(RECORDS[2])); assert.match(card, /held by bClaude/);
  assert.match(await p.textContent('#etRaverNote'), /^2 of 7 read/);
  assert.equal(await p.$eval('#etHive .cell[data-i="2"]', e => e.getAttribute('aria-pressed')), 'true');
  await ctx.close();
});

test('cypherpunk: the pins are hashed in the page, and a pin that differs says so', async () => {
  const { ctx, p } = await open('cypherpunk');
  await p.click('#etCyVerify');
  await p.waitForFunction(() => window.__eternal.ui.verified, null, { timeout: 10000 });
  const v = await p.evaluate(() => window.__eternal.ui.verified.rows);
  assert.equal(v.length, 4);
  for (const r of v) {
    const disk = createHash('sha256').update(await readFile(join(ROOT, r.path))).digest('hex').toUpperCase();
    assert.equal(r.got, disk, r.key + ': the page hashed the real bytes');
    assert.equal(r.state, disk === r.want.toUpperCase() ? 'match' : 'differs', r.key + ': the verdict follows the bytes');
  }
  const shownText = await p.textContent('#etVerify');
  assert.equal((shownText.match(/matches its pin/g) || []).length, v.filter(r => r.state === 'match').length);
  assert.equal((shownText.match(/differs from its pin/g) || []).length, v.filter(r => r.state === 'differs').length);
  assert.match(await p.textContent('#etPipe'), new RegExp(v.filter(r => r.state === 'match').length + ' of 4 match, hashed here'));
  assert.equal(await p.$eval('.et-c a[target="_blank"]', a => a.getAttribute('rel')), 'noopener noreferrer');
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        if (/^(BUTTON|A)$/.test(el.tagName) && el.getBoundingClientRect().height < 44) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
