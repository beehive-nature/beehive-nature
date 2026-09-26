// dao-dashboard-eternal.test.mjs — the skaists.social DAO dashboard ("how a treasury says I don't know") as
// three products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px:
// exactly one front per register, each in its own dress; three different products (bee: seven plain rows
// and the five honest answers; raver: the treasury as a honeycomb of certainty; cypherpunk: the HUD's
// enums, the headroom check, every panel's state, the commissioning pipeline and the §5 control); the SAME
// facts in all three, read from the dashboard's own render and its own reading-level copy; "I don't know"
// honoured in every register and every scenario — a stale gauge shows no number anywhere, absent panels say
// why, the rate stays refused, and a breach never looks like at cap; the b amount sits in honey on its dark
// chip only; honest gestures (the dashboard's own currency buttons, its own level buttons for the §5
// control, its own ?scenario= and test seam); raver motion that pauses and is still under reduced motion;
// and the laws (no dash for a value, no forced capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/dao-dashboard-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/dao-dashboard/index.html`> node --test e2e/dao-dashboard-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/dao-dashboard/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9246, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { scenario = '', reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}${scenario ? '?scenario=' + scenario : ''}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.facts.money, null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  return { ctx, p, errs, out };
}
// the dashboard itself asks Google for its webfonts (as on HEAD); nothing else may leave
const onlyFonts = out => { for (const u of out) assert.match(u, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, 'only the page\'s own font request: ' + u); };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const front = p => p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /^(undefined|NaN|null)$|\bNaN\b|\[object/.test(own)) out.push('junk ' + el.tagName + ' ' + own.slice(0, 30));
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') { if (r.height < 43.5 || r.width < 43.5) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 24)); }
    if (r.width && r.right > 390.5) out.push('offside ' + el.tagName + ' ' + (el.className.baseVal ?? el.className) + ' ' + Math.round(r.right));
  }
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
  return out;
});
const SCEN = ['mixed', 'measured', 'breach'];

test('one front per register, each in its own dress and structure; the laws hold in every scenario', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '.et-b [data-go="know"]', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etDaPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etDaCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor,
        shape: [fr.querySelectorAll('.et-b-row').length, fr.querySelectorAll('svg [role="button"]').length, fr.querySelectorAll('table').length] };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    if (reg === 'bee') assert.deepEqual(d.shape, [7, 0, 0]);
    if (reg === 'raver') assert.deepEqual(d.shape, [0, 7, 0]);
    if (reg === 'cypherpunk') assert.ok(d.shape[0] === 0 && d.shape[1] === 0 && d.shape[2] >= 3);
    for (const s of SCEN) {
      await p.evaluate(s => window.__dao.set({ scenario: s }), s); await p.waitForTimeout(50);
      assert.deepEqual(await laws(p), [], reg + ' laws · ' + s);
    }
    onlyFonts(out); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('"I don\'t know" in all three: the stale gauge shows no number, absence says why, the rate stays refused', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') { await p.click('.et-b-row[data-open="b"]'); }
    seen[reg] = await p.evaluate(() => ({ D: JSON.parse(JSON.stringify(window.__eternal.data)), text: [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '),
      rows: [...document.querySelectorAll('#etDaRows .et-b-rv')].map(e => e.textContent).join(' | '), cells: Object.fromEntries([...document.querySelectorAll('#etDaComb .et-cell')].map(c => [c.dataset.cell, c.getAttribute('class')])) }));
    await ctx.close();
  }
  const D = seen.bee.D;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ': one data layer');
  assert.equal(D.scenario, 'mixed'); assert.equal(D.facts.b.state, 'stale'); assert.equal(D.facts.b.value, null); assert.equal(D.facts.b.minutes, 47);
  assert.equal(D.facts.rate.state, 'refused'); assert.equal(D.facts.circles.state, 'absent'); assert.equal(D.facts.spirit.state, 'absent');
  assert.equal(D.stamp, '12:04 UTC · 20 Jul 2026');
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    assert.doesNotMatch(seen[reg].text, /4,120/, reg + ': no number for a stale gauge');
    assert.ok(seen[reg].text.includes('$4,812.30') || reg === 'raver', reg + ' money'); // raver shows it in its cell
  }
  assert.match(seen.bee.text, /b in the treasury\s*not shown/); assert.match(seen.bee.text, /47 minutes ago/); assert.match(seen.bee.text, /not here, on purpose/);
  assert.equal((seen.bee.rows.match(/not shown, on purpose/g) || []).length, 2, 'bee: circles and spirit say so');
  assert.match(seen.bee.text, /none is read live/);
  assert.match(seen.raver.cells.b, /et-stale/); assert.match(seen.raver.cells.rate, /et-refused/); assert.match(seen.raver.cells.circles, /et-absent/); assert.match(seen.raver.cells.money, /et-known/);
  assert.match(seen.raver.text, /held back · too old to trust/); assert.match(seen.raver.text, /not read live/);
  assert.match(seen.cypherpunk.text, /BGauge::stale\(\)/); assert.match(seen.cypherpunk.text, /HudRefusal::RateOutsideDrawFacility/);
  assert.match(seen.cypherpunk.text, /Panel::Absent \{ reason: "circle lexicon not landed" \}/); assert.match(seen.cypherpunk.text, /cap − emitted = 3,120 ✓/);
  assert.match(seen.cypherpunk.text, /live reads: none · design figures/);
});

test('every scenario, every register: known b in honey on its chip; a breach never looks like at cap', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { scenario: 'measured' });
    const D = await p.evaluate(() => window.__eternal.data.facts);
    assert.equal(D.b.state, 'known'); assert.equal(D.b.value, '4,120 b'); assert.equal(D.circles.state, 'known');
    if (reg === 'bee') await p.click('.et-b-row[data-open="b"]');
    const chip = await p.evaluate(() => { const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none');
      const c = fr.querySelector('.et-bchip,text.et-honey'); if (!c) return null; const cs = getComputedStyle(c);
      const bg = c.tagName === 'text' ? getComputedStyle(c.previousElementSibling).fill : cs.backgroundColor; return [c.textContent, c.tagName === 'text' ? cs.fill : cs.color, bg]; });
    assert.deepEqual(chip, ['4,120 b', 'rgb(232, 181, 75)', 'rgb(12, 20, 18)'], reg + ': honey on the dark chip');
    // the dashboard's own seam moves the fronts: a breach, quantified, never at cap
    await p.evaluate(() => window.__dao.set({ scenario: 'breach' })); await p.waitForTimeout(80);
    const f = await p.evaluate(() => window.__eternal.data.facts.headroom);
    assert.deepEqual([f.state, f.n, f.check], ['breach', 140, true]);
    const t = await front(p);
    if (reg === 'bee') assert.match(t, /140 b over the limit/);
    if (reg === 'raver') { assert.match(await p.getAttribute('#etDaComb [data-cell="headroom"]', 'class'), /et-breach/); assert.doesNotMatch(await p.getAttribute('#etDaComb [data-cell="headroom"]', 'class'), /atcap/); }
    if (reg === 'cypherpunk') { assert.match(t, /Headroom::Breach\(140\)/); assert.match(t, /emitted − cap = 140 ✓/); }
    await ctx.close();
  }
});

test('honest gestures: the dashboard\'s own currency and level buttons; the §5 control runs here and restores', async () => {
  // bee: the money row offers the other currency; it presses the dashboard's own button
  let { ctx, p, errs, out } = await open('bee');
  await p.click('.et-b-row[data-open="money"]'); await p.click('#eternal .et-b-open [data-cur="MXN"]');
  assert.equal(await p.getAttribute('#seg-currency-MXN', 'aria-pressed'), 'true', 'the dashboard\'s own button');
  assert.equal(await p.textContent('.gauge-money .gauge-num'), 'MX$88,546.32');
  assert.match(await front(p), /MX\$88,546\.32/);
  onlyFonts(out); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // raver: the pill is the same currency hand-off; the money cell follows
  ({ ctx, p, errs, out } = await open('raver'));
  assert.match(await p.textContent('#etDaPill'), /see it in Mexican pesos/);
  await p.click('#etDaPill');
  assert.equal(await p.getAttribute('#seg-currency-MXN', 'aria-pressed'), 'true');
  assert.match(await p.getAttribute('#etDaComb [data-cell="money"]', 'aria-label'), /MX\$88,546\.32/);
  await p.$eval('#etDaComb', e => e.scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  await p.locator('#etDaComb [data-cell="spirit"] text').first().click({ force: true });
  assert.equal(await p.getAttribute('#etDaComb [data-cell="spirit"]', 'aria-pressed'), 'true', 'the tap landed');
  assert.match(await p.textContent('#etDaCard'), /spirit · absent, on purpose.*SPIRIT-1/);
  onlyFonts(out); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  // cypherpunk: the §5 negative control, through the dashboard's own level buttons, then the reader's level back
  ({ ctx, p, errs, out } = await open('cypherpunk'));
  await p.click('#seg-level-technical');
  await p.click('#etDaCyGo');
  const c = await p.evaluate(() => window.__eternal.data.control);
  assert.equal(c.same, true, 'numbers never change with reading level'); assert.equal(c.restored, 'technical');
  assert.equal(await p.getAttribute('#seg-level-technical', 'aria-pressed'), 'true', 'the reader\'s level is restored');
  assert.match(await p.textContent('#etDaCtl'), /identical across levels ✓/);
  // the scenarios are the dashboard's own ?scenario= links, same tab
  const links = await p.$$eval('#etDaScen a', a => a.map(x => [x.getAttribute('href'), x.target]));
  assert.deepEqual(links, [['?scenario=measured', ''], ['?scenario=mixed', ''], ['?scenario=breach', '']]);
  onlyFonts(out); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver motion: known cells breathe, pause on request, and are still under reduced motion', async () => {
  let { ctx, p } = await open('raver');
  const play = () => p.$eval('#etDaComb .et-cell.et-known polygon', e => getComputedStyle(e).animationPlayState);
  assert.equal(await play(), 'running');
  await p.click('#etDaStill'); assert.equal(await play(), 'paused');
  await ctx.close();
  ({ ctx, p } = await open('raver', { reduced: true }));
  assert.equal(await p.$eval('#etDaComb .et-cell.et-known polygon', e => getComputedStyle(e).animationName), 'none');
  await ctx.close();
});
