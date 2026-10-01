// acid-cascade-eternal.test.mjs — ACiD (surfaces/fleet-hosted/gallery/acid-cascade.html), the founder's
// piece, with three products above it (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted
// ruling: the piece and its chart keep working exactly). Proves at 390 px: one front per register in
// its own dress; the SAME seven steps, disease rows, chart values and the piece's OWN caution in all
// three, read from the piece itself (window.__eternal.data) and from each front's DOM, never stronger
// than the piece; honest gestures (every "read" goes to the piece; the raver hold lights steps one by
// one and a short press lights one; nothing is stored or sent); the piece below is untouched; the laws.
// Run: node --test e2e/acid-cascade-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/gallery/acid-cascade.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9181, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.steps.length && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const store = p => p.evaluate(() => Object.keys(localStorage).filter(k => k !== 'bregister' && k !== 'blang').sort());
const frontText = (p, f) => p.evaluate(s => document.querySelector('#eternal>' + s).innerText.replace(/\s+/g, ' '), f);

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
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        art: getComputedStyle(document.body).backgroundColor, hdr: getComputedStyle(document.querySelector('.hdr')).backgroundImage, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(10, 10, 20)', reg + ': the piece keeps its own ground (#0a0a14)'); assert.match(d.hdr, /linear-gradient/, 'its own header');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + `: no sideways page at 390 px (${d.wide}/${d.vw})`);
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same claims in all three, read from the piece, never stronger', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etBeeSureGo');
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e.textContent.replace(/\s+/g, ' ').trim(), art = s => [...document.querySelectorAll(s)].filter(e => !e.closest('#eternal'));
      return {
        steps: D.steps.map(s => s.title), artSteps: art('.cascade-step .cascade-content b').map(t),
        rows: D.rows.map(r => [r.name, r.cost, r.stated, r.chartM]), total: D.total, agree: D.agree, sumB: D.sumB,
        chart: D.chart.read ? D.chart.data : null, status: D.status, hero: D.hero,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(t),
        raver: { steps: [...document.querySelectorAll('#etFall .et-step')].map(g => g.getAttribute('aria-label')), drops: document.querySelectorAll('#etFall .et-drop').length },
        cy: { steps: [...document.querySelectorAll('#etcSteps li b')].map(t), rows: [...document.querySelectorAll('#etcRows tbody tr')].map(r => t(r.cells[0])), foot: t(document.querySelector('#etcRows tfoot')), quote: t(document.getElementById('etcQuote')) },
      };
    });
    seen[reg].text = await frontText(p, FRONT[reg]);
    await ctx.close();
  }
  const b = seen.bee;
  assert.equal(b.steps.length, 7); assert.deepEqual(b.steps, b.artSteps, 'the seven steps are the piece\'s own');
  assert.equal(b.rows.length, 10); assert.equal(b.total, '$14.11T/yr');
  assert.equal(b.sumB, 2165, 'the listed rows sum to $2,165B a year');
  assert.deepEqual(b.chart, [100, 50, 30.3, 37.3, 40, 37, 24, 6.5, 18, 16], 'the live chart\'s own values');
  assert.equal(b.agree, 9, 'nine of ten rows state the chart\'s number (cancer states new cases a year)');
  assert.equal(b.status.kind, 'theoretical framework'); assert.equal(b.status.author, 'Travis Remington, FMF HM3, MPAS PA');
  assert.equal(b.status.gradeA, 'well-established telomere biology'); assert.equal(b.status.gradeD, 'practitioner-level clinical observation');
  assert.equal(b.status.advice, 'This is research, not medical advice.');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].steps, b.steps, reg); assert.deepEqual(seen[reg].rows, b.rows, reg); assert.deepEqual(seen[reg].status, b.status, reg); }
  // each register draws the same seven and the same ten
  b.steps.forEach((s, i) => assert.equal(b.bee[i].replace(/\s+/g, ' ').toLowerCase(), `${i + 1} · ${s.toLowerCase()}`, 'bee step ' + (i + 1)));
  assert.equal(seen.raver.raver.steps.length, 7); assert.equal(seen.raver.raver.drops, 10);
  assert.deepEqual(seen.cypherpunk.cy.steps, b.steps, 'cypherpunk quotes the steps exactly');
  assert.equal(seen.cypherpunk.cy.rows.length, 10); assert.match(seen.cypherpunk.cy.foot, /rows sum \$2,165B\/yr · stated total \$14\.11T\/yr/);
  // the piece's own caution travels with every register, and nothing is stronger than it
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const tx = seen[reg].text;
    assert.match(tx, /not medical advice/, reg + ' carries "not medical advice"');
    assert.match(tx, /\[A\]/, reg + ' carries the grade range'); assert.match(tx, /\[D\]/, reg);
    assert.doesNotMatch(tx, /\b(cure[sd]?|proven|guarantee[sd]?|you should take|recommended dose)\b/i, reg + ' says nothing stronger than the piece');
  }
  assert.match(seen.cypherpunk.cy.quote, /This is research, not medical advice\./, 'cypherpunk quotes the disclaimer whole');
});

test('bee: the steps open to the piece\'s own words; every "read" goes to the piece', async () => {
  const { ctx, p, errs } = await open('bee');
  const before = await store(p);
  await p.click('#etBeeRows .et-b-row[data-k="2"]');
  const open3 = await p.evaluate(() => ({ line: document.querySelector('#etBeeRows .et-b-open[data-k="2"]').textContent, art: document.querySelectorAll('.cascade-step')[2].querySelector('small').textContent, exp: document.querySelector('#etBeeRows .et-b-row[data-k="2"]').getAttribute('aria-expanded') }));
  assert.equal(open3.line, open3.art); assert.equal(open3.exp, 'true');
  await p.click('#etBeeRead'); await p.waitForTimeout(900);
  const top = await p.$eval('#etArchive', e => Math.round(e.getBoundingClientRect().top));
  assert.ok(Math.abs(top) < 12, 'read the whole argument lands on the piece: ' + top);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'etArchive');
  assert.deepEqual(await store(p), before, 'nothing stored');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a short press lights one step; a hold lets all seven fall; the ending is the piece\'s own headline', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etFall .et-step[data-s="4"]', { force: true });
  assert.match(await p.textContent('#etFallCard'), /artificial telomere shortening/);
  const hold = p.locator('#etFallHold'); await hold.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const bx = await hold.boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => window.__eternal.raver.fell), 1, 'a short press lights exactly one');
  assert.equal(await p.$eval('#etFallRead', b => b.hidden), true);
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up(); await p.waitForTimeout(700);
  const part = await p.evaluate(() => window.__eternal.raver.fell);
  assert.ok(part > 1 && part < 7, 'release stops the fall part-way: ' + part);
  await p.mouse.down(); await p.waitForTimeout(3400); await p.mouse.up(); await p.waitForTimeout(300);
  const R = await p.evaluate(() => ({ fell: window.__eternal.raver.fell, complete: window.__eternal.raver.complete, big: document.getElementById('etFallBig').textContent, pool: document.getElementById('etFall').classList.contains('et-pool'), read: document.getElementById('etFallRead').hidden, hero: document.querySelector('.hero .hero-card .mega').textContent }));
  assert.deepEqual({ fell: R.fell, complete: R.complete, pool: R.pool, read: R.read }, { fell: 7, complete: true, pool: true, read: false });
  assert.equal(R.big, R.hero, 'the ending shows the piece\'s own headline figure');
  await p.click('#etFall .et-drop[data-d="Obesity"]', { force: true });
  assert.match(await p.textContent('#etFallCard'), /100 million affected in the US, per the piece's chart · \$173B\/yr · stated: 100M\+ adults/);
  await p.click('#etFallRead'); await p.waitForTimeout(900);
  assert.ok(Math.abs(await p.$eval('#etArchive', e => e.getBoundingClientRect().top)) < 12, 'into the whole argument');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: complete at first paint, every figure checked against the live chart', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    steps: document.querySelectorAll('#etcSteps li').length, rows: document.querySelectorAll('#etcRows tbody tr').length,
    ok: document.querySelectorAll('#etcRows tbody .et-st-ok').length, ne: document.querySelectorAll('#etcRows tbody .et-st-wait').length,
    cancer: [...document.querySelectorAll('#etcRows tbody tr')].find(r => /Cancer/.test(r.textContent)).textContent,
    receipt: document.getElementById('etcReceipt').textContent, chips: document.getElementById('etcChips').textContent,
  }));
  assert.equal(d.steps, 7); assert.equal(d.rows, 10); assert.equal(d.ok, 9); assert.equal(d.ne, 1);
  assert.match(d.cancer, /1\.9M new\/yr.*18M ≠/);
  assert.match(d.receipt, /#diseaseChart · bar · 10 values · read live from Chart\.getChart\(\)/);
  assert.match(d.receipt, /no study cited by title/); assert.match(d.chips, /links to studies · 0/);
  await p.click('#etcRead'); await p.waitForTimeout(900);
  assert.ok(Math.abs(await p.$eval('#etArchive', e => e.getBoundingClientRect().top)) < 12);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the piece below is untouched: its chart draws, its steps and rows are where they were', async () => {
  const { ctx, p } = await open('cypherpunk');
  const d = await p.evaluate(() => {
    const c = Chart.getChart('diseaseChart'), cv = document.getElementById('diseaseChart');
    return { chart: !!c, w: cv.width, steps: document.querySelectorAll('.cascade .cascade-step').length, names: document.querySelectorAll('.disease-name').length,
      firstArt: document.querySelector('body>#etArchive').nextElementSibling.className };
  });
  assert.ok(d.chart && d.w > 0); assert.equal(d.steps, 7); assert.equal(d.names, 11); assert.equal(d.firstArt, 'hdr', 'the piece starts right after the heading');
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') { await p.click('#etBeeSureGo'); await p.click('#etBeeRows .et-b-row[data-k="0"]'); }
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
