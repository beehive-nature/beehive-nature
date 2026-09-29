// flower-lab-eternal.test.mjs — the flower lab (surfaces/fleet-hosted/lab/flower-lab.html), the founder's THCA
// blending calculator and session log that writes bnSessions for the dashboard, with three products above it
// (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the lab stays exactly as made, 0 lines
// removed; fleet-bus, which presses the lab's own submit button, and fleet-pixels stay green). Proves at 390 px:
// one front per register in its own dress; the SAME blend in all three, set through each register's own gesture
// on the lab's own preset button, recomputed from S and equal to what the lab prints and charts; honest gestures
// (a gram is the lab's own input, a rating its own slider, a side effect its own box, saving its own button;
// "saved" only when bnSessions grew; a tap or a short hold writes nothing; a failed save is never called done);
// nothing leaves the origin; the lab below still works; the laws, in every step and mode.
// Run: node --test e2e/flower-lab-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/flower-lab.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9211, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const SEED = [{ blend: 'night garden', timestamp: '2026-09-25T20:00:00Z', thcaPercent: '18.5%', doseG: 0.3, method: 'Pipe', effects: {}, sideEffects: [] }, { blend: 'noon', timestamp: '2026-09-26T12:00:00Z', thcaPercent: '27.2%', doseG: 0.5, method: 'Joint', effects: {}, sideEffects: [] }];
async function open(reg, { seeded = true, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, S, seeded]) => {
    try { localStorage.setItem('bregister', r); if (seeded && !sessionStorage.getItem('seeded')) { localStorage.setItem('bnSessions', JSON.stringify(S)); sessionStorage.setItem('seeded', '1'); } } catch {}
  }, [reg, SEED, seeded]);
  if (init) await ctx.addInitScript(init);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.install();
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.getAttribute('data-reg') && window.Chart && Chart.getChart('chart'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const sessions = p => p.evaluate(() => JSON.parse(localStorage.getItem('bnSessions') || '[]'));
const bus = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('bn')).sort().map(k => [k, localStorage.getItem(k)])));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + (el.id || el.className));
    const r = el.getBoundingClientRect();
    if (r.width && r.right > 390.5) out.push('past 390: ' + (el.id || el.tagName) + ' ' + Math.round(r.right));
    if (/^(BUTTON|A|SELECT|LABEL)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'checkbox')) { if (r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20))); }
    if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target ' + el.getAttribute('data-k'));
  }
  return out;
});
// P.rest from the lab's source: cadillac 1.0 g + ice cream cake 2.5 g
const REST = { t: 3.5, thca: ((30.1 * 1 + 25 * 2.5) / 3.5).toFixed(1) + '%', cost: '$' + ((50 / 28) + 2.5 * 48 / 28).toFixed(2), cpj: '$' + (((50 / 28) + 2.5 * 48 / 28) / 7).toFixed(2), tod: 'evening' };

test('one front per register in its own dress; the lab keeps its own ground; the laws in every step', async () => {
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
      return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.art, 'rgb(26, 26, 46)', reg + ': the lab keeps its own ground (#1a1a2e)');
    assert.deepEqual(await laws(p), [], reg + ' first screen');
    if (reg === 'bee') { await p.click('#etBeeRate'); assert.deepEqual(await laws(p), [], 'bee log step'); }
    if (reg === 'raver') { await p.click('#etFlStrains [data-s="purple"]'); assert.deepEqual(await laws(p), [], 'raver strain card'); await p.click('#etFlModeRate'); assert.deepEqual(await laws(p), [], 'raver rate mode'); }
    assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same blend in all three: each register sets the lab\'s own preset, and the facts equal what the lab prints', async () => {
  const via = { bee: '#etBeePresets [data-p="rest"]', raver: '#etFlPresets [data-p="rest"]', cypherpunk: '#etcPresets [data-p="rest"]' };
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await p.click(via[reg]);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        D: { t: D.t, thca: D.thca, cost: D.cost, cpj: D.cpj, tod: D.tod, profile: D.profile, preset: D.preset, agree: D.agree, page: D.page, want: D.want },
        lab: [document.getElementById('cadillac_i').value, document.getElementById('icc_i').value, document.getElementById('pineapple_i').value],
        bee: [...document.querySelectorAll('#etBeeMix .et-b-row>small')].map(t), pressed: t(document.querySelector('#etBeePresets [aria-pressed="true"]')),
        raver: { legend: [...document.querySelectorAll('#etFlLegend span')].map(t), petals: document.querySelectorAll('#etFl .et-petal').length, rim: document.querySelectorAll('#etFl .et-fl-rim').length, card: t(document.getElementById('etFlCard')) },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 6).map(r => t(r.cells[1])),
      };
    });
    await ctx.close();
  }
  const D = seen.bee.D;
  assert.deepEqual(seen.bee.lab, ['1', '2.5', '0'], 'the lab\'s own inputs hold P.rest');
  assert.equal(D.preset, 'rest'); assert.equal(D.agree, true, 'the front recomputes what the lab prints and charts');
  assert.deepEqual([D.page.tc, D.page.cpj, D.page.thca, D.page.tod], [REST.cost, REST.cpj, REST.thca, REST.tod]);
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(seen[reg].D, D, reg + ' reads the same blend'); assert.deepEqual(seen[reg].lab, seen.bee.lab); }
  assert.deepEqual(seen.bee.bee, ['3.5 g', REST.thca, REST.cost, REST.cpj, 'evening / night']); assert.match(seen.bee.pressed, /^deep rest/);
  assert.deepEqual(seen.raver.raver.legend, ['energy', 'creativity', 'focus', 'euphoria', 'relaxation', 'body'].map((k, i) => k + ' ' + D.profile[i].toFixed(1)));
  assert.equal(seen.raver.raver.petals, 6); assert.equal(seen.raver.raver.rim, 2, 'a rim arc for each strain in the mix'); assert.match(seen.raver.raver.card, /deep rest · evening \/ night/);
  assert.equal(seen.cypherpunk.cy.length, 6); for (const c of seen.cypherpunk.cy) assert.match(c, /✓$/, c);
});

test('honest gestures: every change is the lab\'s own control; saved only when bnSessions grew', async () => {
  // new bee: rate energy up twice, tick anxiety, save through the lab's own button
  let o = await open('bee');
  await o.p.click('#etBeeRate');
  await o.p.click('#etBeeFelt [data-rate="energy"][data-d="1"]'); await o.p.click('#etBeeFelt [data-rate="energy"][data-d="1"]');
  await o.p.check('#etBeeSide [data-side="Anxiety"]');
  assert.deepEqual(await o.p.evaluate(() => [document.getElementById('rate_energy').value, document.querySelector('.checkbox-row input[value="Anxiety"]').checked]), ['7', true], 'the lab\'s own slider and box moved');
  await o.p.click('#etBeeSave');
  let s = await sessions(o.p);
  assert.equal(s.length, 3, 'bnSessions grew by one'); assert.equal(s[2].effects.energy, 7); assert.deepEqual(s[2].sideEffects, ['Anxiety']); assert.equal(s[2].blend, 'Morning Energy');
  assert.equal(await o.p.isVisible('#etBeeSaved'), true); assert.match(await o.p.textContent('#etBeeSaid'), /“Morning Energy”, 0.5 g by joint, is session 3/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // raver: a tap chooses without pouring; a hold pours 0.1 g per 400 ms through the lab's input; a short hold on the hexagon saves nothing
  o = await open('raver');
  const quiet = await bus(o.p);
  await o.p.click('#etFlStrains [data-s="purple"]');
  assert.equal(await o.p.inputValue('#purple_i'), '1', 'a tap only chooses');
  await o.p.dispatchEvent('#etFlStrains [data-s="purple"]', 'pointerdown'); await o.p.clock.runFor(450 + 400 * 3 + 50); await o.p.dispatchEvent('#etFlStrains [data-s="purple"]', 'pointerup');
  assert.equal(await o.p.inputValue('#purple_i'), '1.3', 'three pours of 0.1 g, into the lab\'s own input');
  assert.equal(await o.p.evaluate(() => window.__eternal.data.strains.find(s => s.id === 'purple').g), 1.3, 'and into its model');
  assert.equal(await bus(o.p), quiet, 'pouring writes no storage');
  await o.p.click('#etFlModeRate');
  await o.p.dispatchEvent('#etFlHold', 'pointerdown'); await o.p.clock.runFor(500); await o.p.dispatchEvent('#etFlHold', 'pointerup'); await o.p.clock.runFor(1500);
  assert.equal((await sessions(o.p)).length, 2, 'a short hold saves nothing');
  await o.p.dispatchEvent('#etFlHold', 'pointerdown'); await o.p.clock.runFor(1600); await o.p.dispatchEvent('#etFlHold', 'pointerup');
  s = await sessions(o.p); assert.equal(s.length, 3, 'a full hold saves one session'); assert.equal(s[2].totalGrams, 3.8);
  assert.match(await o.p.textContent('#etFlCard'), /saved · session 3.*bnSessions grew 2 → 3/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // cypherpunk: a gram typed in the table is the lab's own input; submitSession() appends and the receipt says so
  o = await open('cypherpunk');
  await o.p.fill('#etcStrains input[data-s="icc"]', '2'); await o.p.press('#etcStrains input[data-s="icc"]', 'Enter'); await o.p.dispatchEvent('#etcStrains input[data-s="icc"]', 'change');
  assert.equal(await o.p.inputValue('#icc_i'), '2');
  assert.equal(await o.p.evaluate(() => window.__eternal.data.agree), true, 'still agrees with what the lab prints');
  await o.p.click('#etcSubmit');
  assert.equal((await sessions(o.p)).length, 3); assert.match(await o.p.textContent('#etcSubmitted'), /bnSessions · 2 → 3 ✓/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
});

test('a save that fails is never called done; an empty mix and an empty browser say so plainly', async () => {
  let o = await open('bee', { init: () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'bnSessions') throw new Error('quota'); return set.call(this, k, v); }; } });
  await o.p.click('#etBeeRate'); await o.p.click('#etBeeSave');
  assert.equal(await o.p.isVisible('#etBeeSaved'), false, 'no "saved." screen');
  assert.match(await o.p.textContent('#etBeeSaveNote'), /not saved: the lab did not keep it/);
  await o.ctx.close();
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    o = await open(reg, { seeded: false });
    await o.p.evaluate(() => { for (const i of document.querySelectorAll('#strainList input')) { i.value = '0'; i.dispatchEvent(new Event('change', { bubbles: true })); } });
    const d = await o.p.evaluate(() => ({ t: window.__eternal.data.t, sess: window.__eternal.data.sessions, bee: document.getElementById('etBeeMix').textContent, card: document.getElementById('etFlCard').textContent, chips: document.getElementById('etcChips').textContent, hold: document.getElementById('etFlHold').disabled }));
    assert.equal(d.t, 0); assert.equal(d.sess, null);
    if (reg === 'bee') assert.match(d.bee, /nothing in the mix yet/);
    if (reg === 'raver') { assert.match(d.card, /an empty flower, honestly/); assert.equal(d.hold, true, 'nothing to save from an empty mix'); }
    if (reg === 'cypherpunk') assert.match(d.chips, /bnSessions · absent/);
    assert.deepEqual(await laws(o.p), [], reg + ' empty mix');
    assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
  }
});

test('the lab below is untouched: its chart, its own presets and its own submit still work and move the fronts', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  assert.equal(await p.evaluate(() => document.querySelector('body>#etArchive').nextElementSibling.className), 'hdr');
  await p.click('.pbtn[onclick="applyPreset(\'creative\')"]');
  assert.equal(await p.evaluate(() => window.__eternal.data.preset), 'creative', 'the front follows the lab');
  await p.click('button.submit-btn');
  assert.equal((await sessions(p)).length, 3); assert.match(await p.textContent('#etcChips'), /bnSessions · 3/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
