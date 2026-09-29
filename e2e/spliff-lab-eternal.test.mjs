// spliff-lab-eternal.test.mjs — the spliff lab (surfaces/fleet-hosted/lab/spliff-lab.html), the founder's
// tobacco + cannabis blender with its dose arithmetic (DECARB, BIOAVAIL, INTENT), with three products above it
// (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the lab stays exactly as made, 0 lines
// removed; fleet-pixels stays green). Proves at 390 px: one front per register in its own dress; the SAME dose in
// all three, set through each register's own gesture on the lab's own intention select, recomputed from its own
// constants and equal to what doUpdate() prints; the lab's own caution carried in every register; honest gestures
// (a stone, a row or a select is the lab's own select; a pour is its own gram input; nothing is stored or sent);
// the lab below still works and moves the fronts; an empty mix says so plainly; the laws.
// Run: node --test e2e/spliff-lab-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/spliff-lab.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9213, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await p.clock.install();
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.getAttribute('data-reg') && window.chart, null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const bus = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')).sort()));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|[\s·(])[—–](?=$|[\s·)])/.test(own) || /\b(undefined|NaN|null|Infinity)\b/.test(own)) out.push('value "' + own + '" in ' + (el.id || el.className));
    const r = el.getBoundingClientRect();
    if (r.width && r.right > 390.5) out.push('past 390: ' + (el.id || el.tagName) + ' ' + Math.round(r.right));
    if (/^(BUTTON|A|SELECT|LABEL)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'checkbox')) { if (r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20))); }
    if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target');
  }
  return out;
});
const CAUTION = 'Actual varies by smoking technique, lung capacity, and hold time.';

test('one front per register in its own dress; the lab keeps its own ground; its own caution in all three; the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  const where = { bee: '#etBeeCaution', raver: '#etRgCard', cypherpunk: '#etcQuote' };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(26, 26, 46)', reg + ': the lab keeps its own ground (#1a1a2e)');
    const said = (await p.textContent(where[reg])).toLowerCase();
    assert.ok(said.includes(CAUTION.toLowerCase()), reg + ': the lab\'s own caution, carried as it gives it');
    assert.deepEqual(await laws(p), [], reg);
    if (reg === 'raver') { await p.click('#etRgStrains [data-s="purple"]'); assert.deepEqual(await laws(p), [], 'raver strain card'); }
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same dose in all three: each register sets the lab\'s own intention, and the figures equal what doUpdate() prints', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'bee') await p.click('#etBeeIntent [data-i="moderate"]');
    if (reg === 'raver') await p.click('#etRg .et-rg-stone[data-i="moderate"]', { force: true });
    if (reg === 'cypherpunk') await p.selectOption('#etcIntent', 'moderate');
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        D: { intent: D.intent, target: D.target, total: D.total, spliffs: D.spliffs, ratio: D.ratio, thca: D.thca, thc: D.thc, abs: D.abs, match: D.match, cost: D.cost, per: D.per, agree: D.agree, page: D.page, want: D.want, decarb: D.decarb, bioavail: D.bioavail },
        lab: [document.getElementById('intention').value, document.getElementById('show_target').textContent, document.getElementById('rname').value, document.getElementById('g_pineapple').value],
        bee: [...document.querySelectorAll('#etBeeSum .et-b-row>small')].map(t), pressed: t(document.querySelector('#etBeeIntent [aria-pressed="true"]')),
        raver: { legend: [...document.querySelectorAll('#etRgLegend span')].map(t), stone: document.querySelector('#etRg .et-rg-stone[aria-pressed="true"]').getAttribute('data-i') },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 9).map(r => t(r.cells[1])),
      };
    });
    assert.equal(await p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')))), '[]', reg + ': nothing stored');
    await ctx.close();
  }
  const D = seen.bee.D;
  assert.deepEqual(seen.bee.lab, ['moderate', '20mg', 'Moderate Spliff', '12.4'], 'the lab\'s own doIntention() ran: target, name, cannabis sized');
  assert.equal(D.agree, true, 'the front recomputes what doUpdate() prints'); assert.deepEqual([D.decarb, D.bioavail, D.target], [0.877, 0.3, 20]);
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].D, D, reg + ' reads the same dose'); assert.deepEqual(seen[reg].lab, seen.bee.lab); }
  assert.deepEqual(seen.bee.bee, [Math.round(D.abs) + ' mg', '20 mg', String(D.spliffs), D.ratio, '$' + D.per.toFixed(2)]); assert.match(seen.bee.pressed, /^moderate · social & creative/);
  assert.deepEqual(seen.raver.raver.legend, [`thca in it · ${Math.round(D.thca)} mg`, `after heat · ${Math.round(D.thc)} mg`, `absorbed · ${Math.round(D.abs)} mg`, 'intention · 20 mg']); assert.equal(seen.raver.raver.stone, 'moderate');
  assert.equal(seen.cypherpunk.cy.length, 9); for (const c of seen.cypherpunk.cy) assert.match(c, /✓$/, c);
  assert.match(seen.cypherpunk.cy[6], new RegExp(`20 mg · ${D.match ? 'on target' : 'adjust needed'}`));
});

test('honest gestures: a pour is the lab\'s own gram input; the tables drive its inputs; nothing is stored', async () => {
  let o = await open('raver');
  const quiet = await bus(o.p);
  await o.p.click('#etRgStrains [data-s="pineapple"]');
  assert.equal(await o.p.inputValue('#g_pineapple'), '3', 'a tap only chooses');
  await o.p.dispatchEvent('#etRgStrains [data-s="pineapple"]', 'pointerdown'); await o.p.clock.runFor(450 + 400 * 2 + 50); await o.p.dispatchEvent('#etRgStrains [data-s="pineapple"]', 'pointerup');
  assert.equal(await o.p.inputValue('#g_pineapple'), '3.2', 'two pours of 0.1 g, into the lab\'s own input');
  assert.equal(await o.p.evaluate(() => window.__eternal.data.agree), true, 'and the lab re-ran doUpdate()');
  assert.equal(await bus(o.p), quiet); assert.deepEqual(o.outside, []); await o.ctx.close();
  o = await open('cypherpunk');
  await o.p.fill('#etcTob input[data-g="virginia"]', '30'); await o.p.dispatchEvent('#etcTob input[data-g="virginia"]', 'change');
  assert.equal(await o.p.inputValue('#g_virginia'), '30'); assert.equal(await o.p.textContent('#show_total'), '58g', 'the lab\'s own total moved');
  await o.p.selectOption('#etcBatch', '100');
  assert.equal(await o.p.inputValue('#batchcount'), '100'); assert.equal(await o.p.inputValue('#g_pineapple'), '3', 'the batch select alone moves no gram, as doBatch() is written');
  assert.match(await o.p.textContent('#etcFinding'), /batchcount 100 spliffs; doUpdate\(\) divides by round\(total \/ 0.9\) = 64/);
  assert.equal(await o.p.evaluate(() => window.__eternal.data.agree), true);
  assert.deepEqual(o.outside, []); await o.ctx.close();
});

test('the lab below is untouched and moves the fronts; an empty mix says so plainly in all three', async () => {
  let o = await open('bee');
  assert.equal(await o.p.evaluate(() => document.querySelector('body>#etArchive').nextElementSibling.className), 'hdr');
  await o.p.click('.btn[onclick="doPreset(\'evening\')"]');
  assert.deepEqual(await o.p.evaluate(() => [window.__eternal.data.preset, window.__eternal.data.intent]), ['evening', 'strong'], 'the front follows the lab\'s own recipe');
  assert.match(await o.p.textContent('#etBeePresets [aria-pressed="true"]'), /evening relaxer/);
  assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    o = await open(reg);
    await o.p.evaluate(() => { for (const i of document.querySelectorAll('.card input[type="number"]')) { i.value = '0'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    const d = await o.p.evaluate(() => ({ D: window.__eternal.data, sum: document.getElementById('etBeeSum').textContent }));
    assert.deepEqual([d.D.total, d.D.spliffs, d.D.abs, d.D.per, d.D.agree], [0, 0, 0, 0, true]);
    if (reg === 'bee') assert.match(d.sum, /0 mg.*\$0\.00/);
    assert.deepEqual(await laws(o.p), [], reg + ' empty mix');
    assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
  }
});
