// blight-gallery-eternal.test.mjs — the skaists gallery as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress; all three carry the SAME facts (the nine families from the viewer's own COLS, the
// live garden: pieces, failed reads, wallet); the chain is unreachable here, so every front says so
// and the tour stays shut; when pieces do arrive the fronts follow, and the tour gesture is the
// viewer's own #bPlay; a re-read is the viewer's own start().
// Run: node --test e2e/blight-gallery-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/gallery.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/gallery.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8947, ORIGIN = `http://127.0.0.1:${PORT}`;
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

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // the chain is outside this box: every RPC and indexer is refused, so the exhibits must say so
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = []; p.rpc = 0;
  p.on('request', q => { if (/publicnode|drpc/.test(q.url())) p.rpc++; });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.cols.length && !window.__eternal.data.busy, null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: (() => { const was = act.disabled; act.disabled = false; const c = getComputedStyle(act).backgroundColor; act.disabled = was; return c; })(), shut: act.disabled, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products: rows, a bloom, a manifest', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etGaBeeRows .et-b-row').length, petals: document.querySelectorAll('#etGaBloom .et-petal').length,
    table: document.querySelectorAll('#etGaCols tr').length, pipe: document.querySelectorAll('#etGaPipe li').length, rcpt: document.querySelectorAll('#etGaReceipt tr').length,
  }));
  assert.deepEqual(s, { rows: 3, petals: 9, table: 9, pipe: 6, rcpt: 6 });
  await ctx.close();
});

test('the same facts in all three: nine families, the live garden, the failure said plainly', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        cols: D.cols.map(c => c.sym + '|' + c.chain + '|' + c.contract), view: COLS.map(c => c.sym + '|' + (c.ch === 'eth' ? 'Ethereum' : 'Base') + '|' + c.c),
        pieces: D.pieces.length, failures: D.failures, wallet: D.wallet, garden: window.__garden.length, failuresView: readFailures,
        petals: [...document.querySelectorAll('#etGaBloom .et-petal')].map(g => g.getAttribute('aria-label').split(' · ')[0]),
        dashed: [...document.querySelectorAll('#etGaBloom .et-petal path')].filter(x => x.getAttribute('stroke-dasharray')).length,
        cy: [...document.querySelectorAll('#etGaCols tr')].map(r => r.cells[1].firstChild.textContent),
        chip: document.getElementById('etGaChips').textContent, bee: document.getElementById('etGaBeeCard').textContent,
        tourBee: document.getElementById('etGaBeeTour').disabled, tourRaver: document.getElementById('etGaRaverTour').disabled,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.cols, a.view, 'the fronts read the viewer\'s own COLS');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].cols, a.cols); assert.equal(facts[reg].pieces, a.pieces); assert.equal(facts[reg].failures, a.failures); }
  assert.equal(a.pieces, a.garden); assert.equal(a.failures, a.failuresView); assert.equal(a.pieces, 0, 'no chain here: no piece');
  assert.ok(a.failures > 0);
  assert.deepEqual(facts.raver.petals, a.cols.map(c => c.split('|')[0])); assert.equal(facts.raver.dashed, 9, 'every family dark, said as a dashed petal');
  assert.deepEqual(facts.cypherpunk.cy, a.cols.map(c => c.split('|')[0]));
  assert.match(facts.cypherpunk.chip, /state failed.*pieces 0.*failed reads \d+/);
  assert.match(a.bee, /the chain is quiet right now/);
  assert.equal(a.tourBee, true); assert.equal(facts.raver.tourRaver, true, 'no tour of nothing');
});

test('when pieces arrive, all three follow and the tour is the viewer\'s own #bPlay', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.evaluate(() => { pieces = [{ svg: '<svg viewBox="0 0 1 1"></svg>', sym: 'FUNGI', seed: 7, lvln: 1, chain: 'base', contract: COLS[3].c }]; window.__garden = pieces; readFailures = 0; updateTransport(); show(0); galleryStatus('Artwork loaded from public collection records.'); });
  await p.waitForFunction(() => window.__eternal.data.pieces.length === 1);
  const s = await p.evaluate(() => ({
    tour: document.getElementById('etGaBeeTour').disabled, lit: [...document.querySelectorAll('#etGaBloom .et-petal path')].filter(x => !x.getAttribute('stroke-dasharray')).length,
    cy: document.querySelector('#etGaCols tr:nth-child(4) td:last-child').textContent,
  }));
  assert.deepEqual(s, { tour: false, lit: 1, cy: '1' });
  await p.click('#etGaBeeTour');
  assert.equal(await p.getAttribute('#bPlay', 'aria-pressed'), 'true', 'the tour runs in the viewer');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a petal to read its family; ask again re-reads through the viewer', async () => {
  const { ctx, p } = await open('raver');
  await p.locator('#etGaBloom .et-petal[data-i="4"]').dispatchEvent('click');
  assert.equal(await p.getAttribute('#etGaBloom .et-petal[data-i="4"]', 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etGaRaverCard'), /\$FROGGI/);
  const before = p.rpc;
  await p.click('#etGaRaverRetry'); await p.waitForTimeout(600);
  assert.ok(p.rpc > before, 'a real re-read went to the chain');
  await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint', async () => {
  const { ctx, p } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ path: document.getElementById('etGaPath').textContent, fork: [...document.querySelectorAll('.et-c a[target]')].map(a => a.rel) }));
  assert.match(d.path, /^eth_call:\/\/garden\/0x[0-9a-f]{40}$/);
  assert.deepEqual(d.fork, ['noopener noreferrer']);
  await ctx.close();
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
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
