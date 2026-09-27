// austras-koks-eternal.test.mjs — austras koks as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; the SAME facts in all three (the founder line walked from the archive the tree below reads:
// the living generations held, where the line comes into the open, every generation's places); and no
// gesture invents anything — every climb is the mounted tree's own go(), visible in location.hash.
// Run: node --test e2e/austras-koks-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.ETERNAL_PAGE || 'surfaces/austras-koks.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8984, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const u = decodeURIComponent(q.url.split('?')[0]); const f = join(ROOT, u === '/surfaces/austras-koks.html' ? PAGE : u); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/austras-koks.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state === 'ready', null, { timeout: 30000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the guard, where the line opens, every generation', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, all = s => [...document.querySelectorAll(s)];
      return {
        model: { bridge: D.bridge, entries: D.entries.map(e => e.name), gens: D.gens.map(g => [g.slots, g.found, g.living]), people: D.people, privacy: D.privacy },
        receiptText: document.getElementById('receipt').textContent,
        beePeople: all('#etBeeRows .et-b-person b').map(b => b.textContent),
        beeHeld: (all('#etBeeRows small.out')[0] || {}).textContent || '',
        tiers: all('#etTree .tier').map(t => t.querySelectorAll('.cell').length),
        found: all('#etTree .tier').map(t => t.querySelectorAll('.cell:not(.held)').length),
        cyRows: all('#etGens tr.pick').map(r => [...r.cells].map(c => c.textContent.trim()).join(' | ')),
        cyBridge: (document.querySelector('.et-c-guard [data-et="bridge"]') || {}).textContent,
        receipt: document.getElementById('etReceipt').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee, M = a.model;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, M, reg + ' reads the same model');
  // the model is the receipt's own numbers
  assert.match(a.receiptText, new RegExp(`people in the public archive: ${M.people}\\b`));
  assert.match(a.receiptText, new RegExp(`living generations held ${M.bridge} · comes into the open at ${M.entries.length} people`));
  assert.equal(M.privacy, 0);
  // new bee: the people where the line opens, and the held generations, in words
  assert.deepEqual(a.beePeople, M.entries); assert.match(a.beeHeld, new RegExp(`^${M.bridge} held`));
  // raver: one leaf per place, on every branch of the tree
  assert.deepEqual(facts.raver.tiers, M.gens.map(g => g[0]), 'one leaf per place');
  // cypherpunk: the table, the guard and the receipt say the same
  assert.equal(facts.cypherpunk.cyRows.length, M.gens.length);
  M.gens.forEach(([slots, found], i) => { if (found) assert.match(facts.cypherpunk.cyRows[i], new RegExp(`\\| ${slots} \\| found ${found}\\b`)); });
  assert.equal(facts.cypherpunk.cyBridge, String(M.bridge));
  assert.match(facts.cypherpunk.receipt, new RegExp(M.entries[0]));
});

test('bee: the one action climbs the real tree; a person row opens their real story', async () => {
  const { ctx, p, errs } = await open('bee');
  const first = await p.evaluate(() => window.__eternal.data.entries[0].id);
  await p.click('#etBeeClimb'); await p.waitForTimeout(300);
  assert.match(await p.evaluate(() => location.hash), new RegExp(`f=${first}`), 'the tree climbs from the first ancestor');
  const second = await p.evaluate(() => window.__eternal.data.entries[1].id);
  await p.click(`#etBeeRows [data-open="${second}"]`); await p.waitForTimeout(300);
  assert.match(await p.evaluate(() => location.hash), new RegExp(`p=${second}`));
  assert.equal(await p.evaluate(() => !!document.querySelector('#tree .tol-card')), true, 'the tree opens that person\'s card');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a branch to light it; a held branch cannot be climbed; a found one climbs the tree', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etTree .tier[data-g="4"] .hit', { force: true });
  assert.equal(await p.getAttribute('#etTree .tier[data-g="4"]', 'aria-pressed'), 'true');
  const g4 = await p.evaluate(() => window.__eternal.data.gens[4]);
  assert.match(await p.textContent('#etRaverCard'), new RegExp(`${g4.found} of ${g4.slots} found`));
  await p.click('#etTree .tier[data-g="1"] .hit', { force: true });
  assert.equal(await p.$eval('#etRaverClimb', b => b.disabled), true, 'the living are held: no climb');
  assert.match(await p.textContent('#etRaverCard'), /living · held, never named/);
  await p.click('#etTree .tier[data-g="3"] .hit', { force: true });
  const id = await p.evaluate(() => window.__eternal.data.gens[3].people[0].id);
  await p.click('#etRaverClimb'); await p.waitForTimeout(300);
  assert.match(await p.evaluate(() => location.hash), new RegExp(`f=${id}`), 'the pill hands off to the tree');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etGens tr.pick').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    fork: document.querySelector('.et-c a[href*="tools/genealogy"]').getAttribute('rel'),
  }));
  assert.equal(d.rows, 8); assert.equal(d.steps, 6); assert.equal(d.receipt, 9);
  assert.match(d.now, /climb/, 'the pipeline points at the reader\'s own step');
  assert.equal(d.fork, 'noopener noreferrer');
  await p.click('.et-c-tab tr.pick[data-g="5"]');
  assert.equal(await p.$eval('.et-c-tab tr.names[data-g="5"]', e => e.hidden), false, 'a generation opens to its people');
  await p.click('#etCyClimb'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#etPipe'), /at #l=founder&f=/, 'the pipeline shows the state it handed to the tree');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$|NaN|undefined/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
