// indigo-index-eternal.test.mjs — the Indigo Index (surfaces/fleet-hosted/gallery/indigo-index.html), the
// founder's piece, with three products above it (founder blueprint 2026-09-26, docs/design/eternal;
// fleet-hosted ruling: the piece and its four charts keep working exactly). Proves at 390 px: one front
// per register in its own dress; the SAME claim, cut and model outputs in all three, and every "what if"
// in every register moves the piece's OWN slider and reads doReduction()'s outputs back (a stepper, a
// dragged knob, a typed number); cypherpunk's recomputation agrees with the page; the index is the
// page's own indigo(); the caution travels with every register; nothing is stored or sent; the laws.
// Run: node --test e2e/indigo-index-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/gallery/indigo-index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9182, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.sim.s25 && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const page = p => p.evaluate(() => { const t = id => document.getElementById(id).textContent.trim(); return { r: +document.getElementById('reductionSlider').value, s25: t('sim_25yr'), remaining: t('sim_annual'), saved: t('sim_save_yr'), healed: t('sim_healed') }; });
const store = p => p.evaluate(() => Object.keys(localStorage).filter(k => k !== 'bregister' && k !== 'blang').sort());

test('one front per register, each in its own dress; the piece keeps its own ground', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(10, 10, 20)', reg + ': the piece keeps its own ground');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + `: no sideways page at 390 px (${d.wide}/${d.vw})`);
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same claim, cut and outputs in all three, read from the piece and its own model', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        hero: D.hero.map(h => h.big), share: D.share, sim: D.sim, comps: D.comps.map(c => [c.label, c.val]), sum: D.sum, total: D.total, chain: D.chain,
        countries: D.countries.map(c => [c.name, c.indigo]), artTable: [...document.querySelectorAll('#countryRows tr')].map(r => [r.cells[0].firstChild.textContent.trim(), +r.cells[2].textContent]),
        status: D.status, charts: D.charts.filter(c => c.drawn).length,
        bee: t(document.getElementById('etBeeOut')), beeFacts: t(document.getElementById('etBeeFacts')), beeR: t(document.getElementById('etBeeR')),
        raver: { big: t(document.getElementById('etRingBig')), knob: document.getElementById('etKnob').getAttribute('aria-valuenow'), segs: document.querySelectorAll('#etRing .et-seg').length },
        cy: [...document.querySelectorAll('#etcOut tbody tr')].map(r => [t(r.cells[1]), t(r.cells[2])]), text: t(document.querySelector('#eternal>' + ({ bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' })[document.body.getAttribute('data-reg')])),
      };
    });
    await ctx.close();
  }
  const b = seen.bee;
  assert.deepEqual(b.hero, ['$14.11T', '90%', '$317T']); assert.deepEqual(b.share, { pct: '52%', gdp: '$26.95T' });
  assert.deepEqual(b.comps, [['Consumption', '$8.85T'], ['Investment', '$2.75T'], ['Government', '$2.16T'], ['Additional', '$0.35T']]);
  assert.equal(b.sum, 14.11); assert.equal(b.total, '$14.11T');
  assert.equal(b.chain.length, 8); assert.equal(b.chain[0], 'ECS Dysfunction');
  assert.deepEqual(b.countries, b.artTable, 'the index is the page\'s own indigo(), in the page\'s own order');
  assert.equal(b.charts, 4, 'all four of the piece\'s charts drew');
  assert.equal(b.sim.r, 90); assert.equal(b.sim.s25, '$317.5T'); assert.equal(b.sim.remaining, '$1.41T');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].sim, b.sim, reg + ' same model state'); assert.deepEqual(seen[reg].status, b.status, reg); }
  assert.equal(b.beeR, '90%'); for (const v of [b.sim.remaining, b.sim.saved, b.sim.s25, b.sim.healed]) assert.ok(b.bee.includes(v), 'bee shows ' + v);
  assert.match(b.beeFacts, /\$14\.11T.*52% of \$26\.95T.*90% · a hypothesis/);
  assert.equal(seen.raver.raver.big, b.sim.s25); assert.equal(seen.raver.raver.knob, '90'); assert.equal(seen.raver.raver.segs, 4);
  assert.ok(seen.cypherpunk.cy.every(([pg, re]) => re === pg + ' ✓'), 'recomputed from the source constants, every output agrees: ' + JSON.stringify(seen.cypherpunk.cy));
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    assert.match(seen[reg].text, /hypothesis/, reg + ' says hypothesis'); assert.match(seen[reg].text, /not medical or financial advice/, reg + ' carries the caution');
    assert.doesNotMatch(seen[reg].text, /\b(cure[sd]?|proven|guarantee[sd]?|will save)\b/i, reg + ' says nothing stronger than the piece');
  }
});

test('bee: the stepper moves the piece\'s own slider; the one action hands off to the full model', async () => {
  const { ctx, p, errs } = await open('bee');
  const before = await store(p);
  for (let i = 0; i < 8; i++) await p.click('#etBeeLess');
  const pg = await page(p);
  assert.equal(pg.r, 50, 'the piece\'s slider moved');
  assert.equal(pg.s25, '$176.4T', 'and its own model answered');
  const bee = await p.evaluate(() => ({ r: document.getElementById('etBeeR').textContent, out: document.getElementById('etBeeOut').textContent }));
  assert.equal(bee.r, '50%'); assert.ok(bee.out.includes(pg.s25) && bee.out.includes(pg.remaining) && bee.out.includes(pg.healed));
  await p.click('#etBeeGo'); await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'reductionSlider', 'the full model has focus');
  // and the piece's own slider moves the front back
  await p.evaluate(() => { const s = document.getElementById('reductionSlider'); s.value = '70'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await p.textContent('#etBeeR'), '70%');
  assert.deepEqual(await store(p), before, 'nothing stored');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: drag the knob and the ring, the slider and the model move together', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.locator('#etRing').scrollIntoViewIfNeeded();
  const g = await p.evaluate(() => { const svg = document.getElementById('etRing').getBoundingClientRect(), k = document.getElementById('etKnob').getBoundingClientRect(); return { cx: svg.x + svg.width / 2, cy: svg.y + svg.height / 2, s: svg.width / 400, kx: k.x + k.width / 2, ky: k.y + k.height / 2 }; });
  // the burden spans 360 × 14.11 / 26.95 degrees from the top; half of it back is a 50% cut
  const burden = 360 * 14.11 / 26.95, a = (burden * 0.5 - 90) * Math.PI / 180;
  await p.mouse.move(g.kx, g.ky); await p.mouse.down();
  await p.mouse.move(g.cx + Math.cos(a) * 150 * g.s, g.cy + Math.sin(a) * 150 * g.s, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  const pg = await page(p);
  assert.equal(pg.r, 50, 'the dragged knob set the piece\'s own slider');
  assert.equal(await p.textContent('#etRingBig'), pg.s25, 'the ring shows the model\'s own answer');
  await p.click('#etRingMore');
  assert.equal((await page(p)).r, 55);
  await p.click('.et-lg-b[data-c="0"]');
  assert.match(await p.textContent('#etRingCard'), /\$8\.85T.*consumption.*Healthcare \$5\.19T/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: a typed number runs the page\'s model, and the recomputation agrees', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.fill('#etcR', '35'); await p.click('#etcRun');
  const pg = await page(p);
  assert.equal(pg.r, 35); assert.equal(pg.s25, '$123.5T');
  const rows = await p.$$eval('#etcOut tbody tr', rs => rs.map(r => [r.cells[1].textContent, r.cells[2].textContent]));
  assert.ok(rows.every(([a, b]) => b === a + ' ✓'), JSON.stringify(rows));
  const d = await p.evaluate(() => ({ idx: document.querySelectorAll('#etcIdx tbody tr').length, note: document.getElementById('etcIdxNote').textContent, model: document.getElementById('etcModel').textContent, foot: document.querySelector('#etcGdp tfoot').textContent }));
  assert.equal(d.idx, 16); assert.match(d.note, /round\(c\.access\*3\+c\.innov\*0\.3\+c\.creative\*2\.5\+c\.hemp\*0\.15\)/);
  assert.match(d.model, /cost 14\.11T\/yr · gdp 26\.95T · people 133M · 25 years/); assert.match(d.foot, /14\.11T · stated total \$14\.11T ✓/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etBeeSrcGo');
    if (reg === 'raver') await p.click('.et-lg-b[data-c="3"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
