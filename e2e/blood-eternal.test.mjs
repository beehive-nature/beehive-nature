// blood-eternal.test.mjs — bGENEaLOGy's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register; each has its own
// dress, structure and gesture; all three carry the SAME facts (the line walked from the model,
// the living guard, the storage receipt); and no gesture pays or claims "kept" on its own —
// every keep-forever gesture opens the page's banked preservation status, and "kept" is drawn only when the
// receipt says uploaded. Run: node --test e2e/blood-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8861, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blood.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.gens.length && window.__eternal.data.E, null, { timeout: 20000 })
    .catch(e => { throw new Error(`${e.message}; page errors: ${errs.join(' | ') || 'none'}`); });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const RECEIPT = JSON.parse(await readFile(join(ROOT, 'assets/profile-archive/lineage/zblood-storage-economics.json'), 'utf8'));

// the founder's chosen UI (2026-10-05): new bee is paper with bold system sans titles and a forest
// green action; raver is night purple (the sovereign tint) with plain bold sans titles and its
// magenta pill; cypherpunk is unchanged. Each value is asserted exactly.
test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /^ui-sans-serif, system-ui/, action: 'rgb(38, 77, 54)' },
    raver: { front: '.et-r', bg: 'rgb(18, 14, 30)', title: /^ui-sans-serif, system-ui/, action: 'rgb(214, 85, 187)' },
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
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the line, the guard, the price, the receipt', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        gens: D.gens.slice(0, 5).map(g => [g.slots, g.pub, g.living]),
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        mandala: [1, 2, 3, 4, 5].map(g => document.querySelectorAll(`#etMandala .ring[data-g="${g}"] .seg`).length),
        manifest: [...document.querySelectorAll('#etManifest tr.pick')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        living: [...document.querySelectorAll('#eternal [data-et="living"]')].map(e => e.textContent),
        ant: t('#eternal [data-et="antShort"]'), pipe: t('#etPipe'), receipt: t('#etReceipt'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(facts.raver.gens, a.gens); assert.deepEqual(facts.cypherpunk.gens, a.gens);
  // the line as each register draws it: rows, rings and table agree with the model
  assert.equal(a.gens[0][2], 2, 'the parents are living'); assert.match(a.beeRows[0], /kept out while living/);
  assert.deepEqual(a.mandala, [2, 4, 8, 16, 32], 'one ring segment per place');
  a.gens.forEach(([slots, pub], i) => { if (pub) assert.match(a.manifest[i], new RegExp(`${slots}.*published ${pub}`)); });
  // the guard and the price, from the same sources
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.ok(facts[reg].living.every(x => x === '5'), reg + ' living guard');
  const ant = RECEIPT.quotes.autonomi.computed.storageANT;
  assert.equal(a.ant, Number(ant).toFixed(2) + ' ANT');
  assert.match(facts.cypherpunk.pipe, new RegExp(String(ant).replace('.', '\\.') + ' ANT'));
  // the receipt says what is true: nothing purchased, nothing uploaded
  assert.equal(RECEIPT.states.purchased, false); assert.equal(RECEIPT.states.uploaded, false);
  assert.match(facts.cypherpunk.receipt, /paid\s*not yet/); assert.match(facts.cypherpunk.receipt, /address\s*not yet/);
});

test('bee: consent before the one action; the action opens status, it never pays', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b [data-go="keep"]');
  assert.equal(await p.$eval('#etBeePay', b => b.disabled), true, 'no pay before consent');
  await p.check('#etBeeOk');
  assert.equal(await p.$eval('#etBeePay', b => b.disabled), false);
  await p.click('#etBeePay'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), false, 'the real preservation flow opens');
  assert.equal(await p.$eval('.et-b-step[data-step="kept"]', e => e.hidden), true, '"kept." is never claimed by a tap');
  assert.equal(await p.$eval('.et-b-step[data-step="asked"]', e => e.hidden), false);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light all four, then hold to view status — a short hold does nothing', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('.ring[data-g="3"] .seg');
  assert.match(await p.textContent('#etRaverCard'), /ring 3 · great · 8 of 8 found/);
  await p.click('.you');
  assert.equal(await p.$eval('#etHold', b => b.disabled), true, 'no hold before the four terms');
  for (const t of [1, 2, 3]) await p.click(`#etTiles button[data-t="${t}"]`);
  assert.match(await p.textContent('#etSealHint'), /3 of 4 lit/);
  await p.click('#etTiles button[data-t="4"]');
  assert.equal(await p.$eval('#etHold', b => b.disabled), false);
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'seal', 'a short hold does not seal');
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), true);
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'asked');
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), false, 'the full hold opens the banked status');
  assert.notEqual(await p.textContent('#etRaverTitle'), 'kept', '"kept" is never claimed by a gesture');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etManifest tr.pick').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    pipeline: document.querySelector('#etPipe').textContent,
    path: document.querySelector('#eternal [data-et="bdata"]').textContent,
  }));
  assert.equal(d.rows, 7); assert.equal(d.steps, 6); assert.equal(d.receipt, 7);
  assert.match(d.now, /consent/, 'the pipeline points at the first step not yet done');
  assert.match(d.pipeline, /quote exceeds ceiling/, 'settlement reports the over-ceiling quote');
  assert.match(d.pipeline, /payment client cannot enforce both ceilings/, 'settlement reports the client capability stop');
  assert.equal(d.path, 'bData://genealogy/unsealed', 'no storage address is claimed before a paid upload');
  await p.click('.et-c-tab tr.pick[data-g="4"]');
  assert.equal(await p.$eval('.et-c-tab tr.names[data-g="4"]', e => e.hidden), false, 'a generation opens to its people');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform === 'uppercase') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own)) out.push('dash ' + el.className);
        if (/^(BUTTON|A)$/.test(el.tagName) && el.getBoundingClientRect().height && el.getBoundingClientRect().height < 44) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});

test('cached economics without ceilings fails closed instead of crashing the front', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('bregister', 'cypherpunk'));
  await ctx.route('**/zblood-storage-economics.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      artifact: { files: 1 },
      quotes: { autonomi: { route: 'cached client', queriedAt: '2026-09-01', raw: { confidence: 'stale' }, computed: { storageANT: '1', gasETH: '0.0001' } } },
      states: { prepared: true, quoted: true, purchased: false, uploaded: false },
    }),
  }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blood.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.E);
  assert.equal(errs.length, 0, errs.join(' | '));
  assert.match(await p.textContent('#etPipe'), /required ceiling data unavailable/);
  assert.match(await p.textContent('[data-et="beeQuote"]'), /payment disabled/);
  await ctx.close();
});

test('cached economics with null or empty ceilings fails closed', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('bregister', 'bee'));
  await ctx.route('**/zblood-storage-economics.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      artifact: { files: 1 },
      quotes: { autonomi: { route: 'cached client', queriedAt: '2026-09-01', raw: { confidence: 'stale' }, computed: { storageANT: '1', gasETH: '0.0001' }, ceilings: { storageMaxANT: null, gasMaxETH: '' } } },
      states: { prepared: true, quoted: true, purchased: false, uploaded: false },
    }),
  }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blood.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.E);
  assert.equal(errs.length, 0, errs.join(' | '));
  assert.match(await p.textContent('#etPipe'), /required ceiling data unavailable/);
  assert.match(await p.textContent('[data-et="beeQuote"]'), /payment disabled/);
  await ctx.close();
});

test('package-safe status keeps the restored archive truthful without embedding its quote', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('bregister', 'bee'));
  await ctx.route('**/zblood-storage-economics.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      schema: 'zblood.storage-economics-package/1', artifact: { name: 'privacy-safe edition' },
      quotes: { autonomi: { route: 'package-safe status', raw: null, computed: null, ceilings: { storageMaxANT: 2.5, gasMaxETH: 0.0002 } } },
      states: { prepared: true, quoted: false, purchased: false, uploaded: false },
    }),
  }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blood.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.E);
  assert.equal(errs.length, 0, errs.join(' | '));
  assert.match(await p.textContent('#eternal'), /fresh quote required/);
  await p.click('#preservebtn');
  await p.waitForFunction(() => document.getElementById('preserve-step')?.textContent.includes('no self-referential quote'));
  assert.match(await p.textContent('#preserve-step'), /no self-referential quote/);
  assert.match(await p.textContent('#preserve-step'), /cannot enforce the 2.5 ANT and 0.0002 ETH ceilings atomically/);
  await ctx.close();
});
