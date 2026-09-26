// local-agent-eternal.test.mjs — the local agent as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal; ETERNAL wave 3). Proves at 390 px: exactly one front per register,
// each in its own dress, structure and gesture; all three carry the SAME facts, read from the page's
// own state (window.__localAgent), its own figures and the seventeen pins in ./sw.js; and THE
// LOCAL-AGENT RULING: nothing model-shaped loads on arrival (no shard, no wasm, no engine, no model
// door, no service worker), the only request a front makes is sw.js read as text, waking is the page's
// own #wake reached only after consent (bee's box, raver's FULL hold), and the P1 member key is never
// read by a front. This Chromium has no WebGPU, so route B is the natural state; route A is proved with
// a fixture adapter (named: the model door is off this box, so the page's own wake fails and says so).
// Run: node --test e2e/local-agent-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9252, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const SW = await readFile(join(ROOT, 'surfaces/local-agent/sw.js'), 'utf8');
const PINS = [...(/const PINS = \{([\s\S]*?)\n\};/.exec(SW)[1]).matchAll(/'([^']+)':\s*'([0-9a-f]{64})'/g)].map(m => [m[1], m[2]]);
const MODEL_SHAPED = /\.bin(\?|$)|\.wasm(\?|$)|web-llm\.mjs|qwen05\/|relay\.skaists\.dev|huggingface|jsdelivr/;

// a fixture adapter (route A) and a spy on the member key: every read of #p1key's value is counted
function fixtures(gpu) {
  if (gpu) Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ requestAdapterInfo: async () => ({ vendor: 'fixture', description: 'test adapter' }) }) } });
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); window.__keyReads = 0;
  Object.defineProperty(HTMLInputElement.prototype, 'value', { configurable: true, get() { if (this.id === 'p1key') window.__keyReads++; return d.get.call(this); }, set(v) { d.set.call(this, v); } });
  document.addEventListener('click', e => { if (e.target && e.target.id === 'wake') window.__wakes = (window.__wakes || 0) + 1; }, true);
}
async function open(reg, { gpu = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'allow' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(fixtures, gpu);
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push(u.slice(ORIGIN.length)); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/local-agent/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.pins.length && window.__eternal.data.gpu !== null, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs, outside, requests };
}

test('each register: its own front, dress and structure; the same facts; nothing model-shaped on arrival; the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', actSel: '.et-b-primary', titleSel: '.et-b-h' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', actSel: '.et-r-pill', titleSel: '.et-r-h' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', actSel: '.et-c-primary', titleSel: '.et-c-path' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside, requests } = await open(reg);
    const d = await p.evaluate(async w => {
      const txt = s => (s || '').replace(/\s+/g, ' ').trim();
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, S = window.__localAgent, bad = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('value ' + own);
        const r = el.getBoundingClientRect(); if (r.right > 390.5) bad.push('edge ' + el.tagName + ' ' + Math.round(r.right));
        if ((/^(BUTTON|A|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) bad.push('small ' + el.tagName + ' ' + txt(el.textContent).slice(0, 20));
      }
      return {
        shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.titleSel)).fontFamily, action: getComputedStyle(fr.querySelector(w.actSel)).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, cells: fr.querySelectorAll('svg.et-r-art [data-et-pin]').length, tables: fr.querySelectorAll('table.et-c-tab').length,
        model: { model: D.model, size: D.sizeMB, claim: D.claimPins, pins: D.pins.map(p => [p.f, p.h]), gpu: D.gpu, route: D.route, awake: D.awake, verified: D.verified },
        page: { size: +document.querySelector('.pstat.hero .n').textContent, claim: +document.querySelectorAll('.pstat .n')[1].textContent, route: S.route, gpu: S.gpu, engine: !!S.engine, wakeShown: getComputedStyle(document.getElementById('wake')).display !== 'none', p1: getComputedStyle(document.getElementById('p1box')).display !== 'none' },
        sw: (await navigator.serviceWorker.getRegistrations().catch(() => [])).length, keyReads: window.__keyReads,
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => txt(r.textContent)), beeGo: document.getElementById('etBeeGo').textContent,
        cellNames: [...document.querySelectorAll('#etArt [data-et-pin]')].map(g => g.getAttribute('aria-label')), hint: document.getElementById('etRaverHint').textContent, holdShown: !document.getElementById('etHoldBox').hidden,
        pinRows: [...document.querySelectorAll('#etPins tr:not(.sub)')].map(r => r.cells[0].textContent), pinHashes: [...document.querySelectorAll('#etPins tr.sub')].map(r => r.textContent.replace('sha256 ', '')), receipt: txt(document.getElementById('etReceipt').textContent), cyGo: document.getElementById('etCyWake').textContent,
      };
    }, w);
    assert.deepEqual(d.shown, [w.front], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.cells > 0, reg === 'raver', 'raver is the comb'); assert.equal(d.tables > 0, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ': the laws on the front');
    // THE RULING: nothing model-shaped, no worker, no engine; the fronts' one request is sw.js as text
    assert.deepEqual(requests.filter(u => MODEL_SHAPED.test(u)), [], reg + ': nothing model-shaped on arrival');
    assert.equal(requests.filter(u => /local-agent\/sw\.js/.test(u)).length, 1, 'sw.js read once, as text');
    assert.equal(d.sw, 0, 'no service worker registered on arrival'); assert.equal(d.page.engine, false);
    assert.equal(d.keyReads, 0, reg + ': the member key was never read');
    assert.deepEqual(outside, [], reg + ': no request left the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
  const a = facts.bee;
  const byName = x => x.slice().sort((m, n) => m[0] < n[0] ? -1 : 1);
  assert.deepEqual(byName(a.model.pins), byName(PINS), 'the pins are sw.js\'s own, in full'); assert.equal(PINS.length, 17);
  assert.equal(a.model.claim, a.page.claim); assert.equal(a.model.claim, PINS.length, 'the page\'s "17" agrees with the worker');
  assert.equal(a.model.size, a.page.size); assert.equal(a.model.model, 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  assert.deepEqual([a.model.gpu, a.model.route, a.page.route, a.page.wakeShown, a.page.p1], [false, 'p1', 'p1', false, true], 'no WebGPU here: route B, stated');
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model, reg + ' reads the same facts');
  assert.deepEqual(a.beeRows, ['where it thinksnot here: no WebGPU', `how bigabout ${a.model.size} MB, once`, `checked before it runs${PINS.length} fingerprints`, 'your browsercan\'t run it here', 'the mindasleep']);
  assert.equal(a.beeGo, 'use the shared helper below');
  const r = facts.raver; assert.equal(r.cellNames.length, PINS.length); assert.deepEqual(r.cellNames.map(n => n.split(' · ')[0]).sort(), PINS.map(x => x[0]).sort());
  assert.ok(r.cellNames.every(n => / · not fetched$/.test(n))); assert.equal(r.hint, `0 of ${PINS.length} sealed · tap a cell`); assert.equal(r.holdShown, false, 'no hold where the mind cannot run');
  const c = facts.cypherpunk; assert.deepEqual(c.pinRows, a.model.pins.map(x => x[0])); assert.deepEqual(c.pinHashes, a.model.pins.map(x => x[1]), 'every hash shown whole');
  assert.match(c.receipt, /routep1 · webgpu no/); assert.match(c.receipt, new RegExp(`pins0 verified · 0 refused · ${PINS.length} not fetched · of ${PINS.length} in sw\\.js`));
  assert.match(c.receipt, /banned0 · no huggingface, no jsdelivr/); assert.match(c.receipt, /member keynever read by these fronts/);
  assert.equal(c.cyGo, 'route b · the P1 door ↓');
});

test('route B: the fronts hand the reader to the page\'s own P1 door and never touch the key', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.fill('#p1key', 'fixture-member-key'); await p.locator('#p1key').blur(); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__keyReads = 0; }); // the page's own change handler has stored it; from here every read is counted
  await p.click('#etBeeGo'); await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ top: document.getElementById('p1box').getBoundingClientRect().top, reads: window.__keyReads, wakes: window.__wakes || 0 }));
  assert.ok(Math.abs(d.top) < 60, 'the P1 door is in view (' + d.top + ')'); assert.equal(d.reads, 0, 'the key was not read'); assert.equal(d.wakes, 0);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('route A (fixture adapter): bee wakes only after consent, through the page\'s own #wake; a failure is named, never "awake"', async () => {
  const { ctx, p, errs, requests } = await open('bee', { gpu: true });
  assert.equal(await p.evaluate(() => window.__localAgent.route), 'local');
  assert.equal(await p.$eval('#etBeeGo', b => [b.textContent, b.disabled].join('|')), 'wake the mind|true', 'no wake before consent');
  assert.deepEqual(requests.filter(u => MODEL_SHAPED.test(u)), []);
  await p.check('#etBeeOk');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => window.__localAgent.refused || /try again/.test(document.getElementById('wake').textContent), null, { timeout: 10000 });
  await p.waitForTimeout(1200);
  const d = await p.evaluate(() => ({ wakes: window.__wakes, refused: !!window.__localAgent.refused, rows: document.getElementById('etBeeRows').textContent, go: document.getElementById('etBeeGo').textContent, answer: document.getElementById('answer').textContent, awake: window.__eternal.data.awake }));
  assert.equal(d.wakes, 1, 'the page\'s own #wake ran once'); assert.equal(d.awake, false);
  // the model door is off this box: the page either refuses at its SRI gate or fails to wake, and says which
  // (both of the page's own messages can land, the later one wins #answer; the fronts follow the page's refused flag)
  assert.match(d.answer, /integrity refused|the mind did not wake/);
  if (d.refused) { assert.match(d.rows, /the mindstopped: a part failed its check/); assert.equal(d.go, 'stopped. nothing unchecked runs.'); }
  else { assert.match(d.rows, /the minddidn't wake/); assert.equal(d.go, 'try waking it again'); }
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('route A (fixture adapter): raver\'s short hold does nothing; the full hold is the consent', async () => {
  const { ctx, p, errs } = await open('raver', { gpu: true });
  await p.click('#etArt [data-et-pin="3"]', { force: true });
  assert.match(await p.textContent('#etHoldHint'), /^tokcfg · tokenizer_config\.json · hashed before a byte is served · not fetched/);
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(450); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__wakes || 0), 0, 'a short hold wakes nothing');
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
  await p.waitForFunction(() => window.__localAgent.refused || /try again/.test(document.getElementById('wake').textContent), null, { timeout: 10000 });
  assert.equal(await p.evaluate(() => window.__wakes), 1, 'the full hold ran the page\'s own #wake');
  await p.waitForTimeout(1200);
  assert.match(await p.textContent('#etHoldHint'), /it didn't wake · hold to try again|refused · nothing unverified answers · the mind rests/);
  const seals = await p.evaluate(() => [[...document.querySelectorAll('#etArt [data-et-pin].ok')].map(g => g.getAttribute('aria-label').split(' · ')[0]), Object.keys(window.__localAgent.sri).filter(f => window.__localAgent.sri[f].state === 'verified')]);
  assert.deepEqual(seals[0].sort(), seals[1].sort(), 'a cell is sealed only where the worker itself verified the bytes');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
