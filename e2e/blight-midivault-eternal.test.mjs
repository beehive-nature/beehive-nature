// blight-midivault-eternal.test.mjs — the vault's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts (the recording the vault read, its sound, who can open it, what
// the manifest holds, the SIMULATED backend); no gesture stores, probes or picks on its own — every one
// clicks the vault's real control (.mode, #store, #probe) and the fronts read MANIFEST back; and no
// register ever says a recording is on the Autonomi network: this box has no antd daemon, the store is
// this browser's own, and the failed probe is said plainly.
// Run: node --test e2e/blight-midivault-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9136, ORIGIN = `http://127.0.0.1:${PORT}`, PATH = '/surfaces/blight/midivault.html';
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === PATH ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : (out.push(r.request().url()), r.abort('blockedbyclient')));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('dialog', d => { errs.push('unexpected dialog: ' + d.message()); d.dismiss(); });
  await p.goto(ORIGIN + PATH, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.seed === 20260826, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const manifest = p => p.evaluate(() => JSON.parse(localStorage.getItem('bmidi-vault') || '[]'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeKeep', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyStore', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(out, [], reg + ': nothing leaves the page on arrival');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the recording, its sound, who can open it, the empty manifest, the simulated store', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        seed: D.seed, mode: D.mode, modeName: D.modeName, bpm: D.bpm, rootName: D.rootName, count: D.count, backend: D.backend, bytes: D.scoreBytes,
        page: { mode: window.MODE, seed: window.current.seed, bpm: window.current.P.bpm },
        beeRows: [...document.querySelectorAll('.et-b .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        beeChecked: (document.querySelector('.et-b [role="radio"][aria-checked="true"]') || {}).dataset?.m, guard: t('.et-b-guard'),
        heart: t('#etComb .et-v-heart'), card: t('#etRaverCard'), hint: t('#etRaverHint'), tile: (document.querySelector('#etTiles [aria-pressed="true"]') || {}).dataset?.m,
        emptyCells: document.querySelectorAll('#etComb .et-v-cell:not([role])').length,
        artifact: t('#etArtifact'), chips: t('#etChips'), man: t('#etManifest'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['seed', 'mode', 'modeName', 'bpm', 'rootName', 'count', 'backend', 'bytes']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.page, { mode: a.mode, seed: a.seed, bpm: a.bpm }, 'the data layer is the vault\'s own artifact and MODE');
  assert.equal(a.count, 0); assert.equal(a.backend, 'SIMULATED'); assert.equal(a.mode, 'public');
  // each register draws the same recording its own way
  assert.ok(a.beeRows.some(r => r.includes('seed 20260826')) && a.beeRows.some(r => r.includes(a.modeName) && r.includes(a.bpm + ' beats a minute')), 'bee names the recording and its sound');
  assert.equal(a.beeChecked, 'public'); assert.match(a.guard, /not on the Autonomi network yet/);
  assert.ok(facts.raver.heart.includes(a.rootName) && facts.raver.heart.includes(a.bpm + ' bpm'), 'the comb\'s heart is the recording');
  assert.equal(facts.raver.tile, 'public'); assert.equal(facts.raver.emptyCells, 18, 'eighteen empty cells wait'); assert.match(facts.raver.hint, /0 cells · this browser only/);
  const c = facts.cypherpunk;
  assert.ok(c.artifact.includes('20260826') && c.artifact.includes(a.modeName) && c.artifact.includes(a.bytes + ' B score JSON'));
  assert.match(c.chips, /backend SIMULATED/); assert.match(c.man, /empty · nothing stored yet/);
});

test('bee: choose "only you", then keep — through the vault\'s own mode and store; the words never claim the network', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b [role="radio"][data-m="private"]');
  assert.equal(await p.evaluate(() => window.MODE), 'private', 'the vault\'s own mode switched');
  assert.equal(await p.evaluate(() => document.querySelector('.mode.private').classList.contains('on')), true, 'and its own pill shows it');
  assert.equal(await p.getAttribute('.et-b [role="radio"][data-m="private"]', 'aria-checked'), 'true');
  await p.fill('#etBeeName', 'saturday lydian');
  assert.equal(await p.inputValue('#name'), 'saturday lydian', 'the name lands in the vault\'s own field');
  assert.deepEqual(await manifest(p), [], 'nothing kept before the press');
  await p.click('#etBeeKeep');
  await p.waitForFunction(() => window.MANIFEST.length === 1 && window.__eternal.data.count === 1);
  const m = await manifest(p);
  assert.equal(m.length, 1); assert.equal(m[0].name, 'saturday lydian'); assert.equal(m[0].mode, 'private'); assert.ok(m[0].key, 'a private item carries its key in the manifest');
  const now = await p.textContent('#etBeeNow');
  assert.match(now, /kept in your vault, in this browser\. it is locked with a key only this device holds\./);
  assert.doesNotMatch(await p.textContent('.et-b'), /stored on Autonomi|on the Autonomi network\./, 'bee never says it reached the network');
  assert.match(await p.textContent('.et-b'), /1 recording/);
  assert.equal(await p.inputValue('#etBeeName'), '', 'the vault clears its name field after a store, and the front follows');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light a tile, a short hold seals nothing, a full hold seals one cell into the comb', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etTiles button[data-m="privileged"]');
  assert.equal(await p.evaluate(() => window.MODE), 'privileged');
  await p.$eval('#etHold', b => b.scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(300);
  assert.deepEqual(await manifest(p), [], 'a short hold seals nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.MANIFEST.length === 1 && document.querySelector('#etComb .et-v-cell.k-privileged'));
  const d = await p.evaluate(() => ({ title: document.getElementById('etRaverTitle').textContent, hint: document.getElementById('etRaverHint').textContent, fresh: document.querySelectorAll('#etComb .fresh').length, empty: document.querySelectorAll('#etComb .et-v-cell:not([role])').length }));
  assert.deepEqual(d, { title: 'sealed in', hint: '1 cell · this browser only', fresh: 1, empty: 17 });
  await p.click('#etComb .et-v-cell[data-i="0"]');
  assert.match(await p.textContent('#etRaverCard'), /seed 20260826.*privileged · \d+ B · ant[0-9a-f]+… · in this browser/);
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => document.body.classList.contains('et-still') && getComputedStyle(document.querySelector('#etComb .et-breath')).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('#etComb .et-breath')).animationName), 'none', 'still under reduced motion');
  await r.ctx.close();
});

test('cypherpunk: the manifest is an instrument; the probe fails honestly; the store is named simulated', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const first = await p.evaluate(() => ({ art: document.querySelectorAll('#etArtifact tr').length, steps: document.querySelectorAll('#etPipe li').length, receipt: document.getElementById('etReceipt').textContent,
    fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel) }));
  assert.equal(first.art, 6); assert.equal(first.steps, 6); assert.match(first.receipt, /network\s*no · simulated store in this browser/);
  assert.deepEqual(first.fork, ['noopener noreferrer']);
  await p.click('#etCyProbe');
  await p.waitForFunction(() => window.__eternal.data.probe === 'no daemon', null, { timeout: 8000 });
  assert.match(await p.textContent('#etChips'), /antd no daemon/);
  assert.match(await p.textContent('#etPipe li.fail'), /no daemon at http:\/\/127\.0\.0\.1:8082 · nothing reaches Autonomi/);
  assert.equal(await p.evaluate(() => window.BACKEND.name), 'SIMULATED', 'the vault itself stays simulated');
  await p.selectOption('#etCyMode', 'private');
  assert.equal(await p.evaluate(() => window.MODE), 'private');
  await p.click('#etCyStore');
  await p.waitForFunction(() => window.MANIFEST.length === 1 && document.querySelectorAll('#etManifest tr').length === 2);
  const r = await p.evaluate(() => ({ row: document.querySelectorAll('#etManifest tr')[1].textContent, receipt: document.getElementById('etReceipt').textContent, addr: window.MANIFEST[0].addr }));
  assert.match(r.row, /^1scoreprivate\d+ant[0-9a-f]{8}…$/);
  assert.ok(r.receipt.includes(r.addr), 'the receipt names the address the vault wrote');
  assert.match(r.receipt, /key\s*held here · never sent/); assert.match(r.receipt, /network\s*no · simulated store/);
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
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('bad value ' + (el.className.baseVal ?? el.className));
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A|INPUT|SELECT|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
