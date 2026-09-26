// festival-eternal.test.mjs — the festival's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts (the nine beats as the page declares them, the family doors,
// the day pass the page's own beads(name) strings, the calm state, the board's last read); and no
// gesture stores, sends or reads on its own — the pass is typed into the page's #passname, the calm
// is the page's #calm, the board is #eread, a beat is reached through the ribbon's own cell.
// Run: node --test e2e/festival-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8927, ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === '/surfaces/festival/index.html' ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('fcalm'); } catch {} }, reg);
  const sent = [];
  // the chain hosts are outside this box: they are refused here, so the board shows its declared failure
  await ctx.route('**/*', r => { const q = r.request(); if (!q.url().startsWith(ORIGIN)) sent.push(q.method() + ' ' + q.url()); return q.url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/festival/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.beats.length === 9 && window.__eternal.data.board.state !== 'reading', null, { timeout: 20000 });
  return { ctx, p, errs, sent };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const pageBeads = p => p.evaluate(() => [...document.querySelectorAll('#passout circle')].map(c => c.style.fill));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeePass', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etStringHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyRead', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the nine beats, the doors, the pass, the calm, the board', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        d: [D.beats.map(b => b.id + ':' + b.state), D.cells, D.gates, D.pass.name, D.pass.beads, D.calm, D.board.state],
        page: [...document.querySelectorAll('section.beat')].map(s => s.id + ':' + s.getAttribute('data-beat').split('·')[1].trim().toLowerCase()),
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        beeBeads: document.querySelectorAll('#etBeeStrand circle').length,
        cells: [...document.querySelectorAll('#etComb .cell')].map(c => c.getAttribute('class').split(' ')[1]),
        beads: [...document.querySelectorAll('#etComb .bead')].map(c => c.style.fill),
        rows: [...document.querySelectorAll('#etBeats tr.pick')].map(r => r.children[2].textContent),
        receipt: t('#etReceipt'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(facts.raver.d, a.d); assert.deepEqual(facts.cypherpunk.d, a.d);
  assert.deepEqual(a.d[0], a.page, 'the beats are the page\'s own declarations');
  assert.equal(a.d[1], 127); assert.deepEqual(a.d[2], { total: 8, open: 1 }); assert.equal(a.d[3], 'anonymous tonight');
  assert.equal(a.d[6], 'unreachable', 'the chain is not reachable from this box, and the data says so');
  // each register draws the same day its own way
  assert.equal(a.beeRows.length, 9); assert.match(a.beeRows[8], /7 not built yet · 1 open/); assert.match(a.beeRows[4], /not reachable here/);
  assert.equal(a.beeBeads, 7);
  assert.deepEqual(facts.raver.cells, a.d[0].map(x => x.split(':')[1]), 'one comb cell per beat, coloured by its state');
  assert.equal(facts.raver.beads.length, 7);
  assert.deepEqual(facts.cypherpunk.rows, a.d[0].map(x => x.split(':')[1]));
  assert.match(facts.cypherpunk.receipt, /stored\s*nowhere/); assert.match(facts.cypherpunk.receipt, /not reached from this browser/);
});

test('bee: the one action strings the page\'s own day pass; a row walks the ribbon', async () => {
  const { ctx, p, errs, sent } = await open('bee');
  await p.fill('#etBeeName', 'Lovis');
  await p.click('#etBeePass');
  assert.equal(await p.inputValue('#passname'), 'Lovis', 'the name went into the page\'s own day-pass field');
  const want = await p.evaluate(() => window.festivalDay.beads('Lovis').beads.map(k => 'var(--sk-' + window.festivalDay.tokens[k] + ')'));
  assert.deepEqual(await pageBeads(p), want, 'the page strung the pass');
  assert.match(await p.textContent('#etBeeStrand'), /Lovis/);
  await p.click('#etBeeRows .et-b-row[data-go="s-calm"]');
  await p.waitForFunction(() => { const r = document.getElementById('s-calm').getBoundingClientRect(); return r.top > -40 && r.top < innerHeight * 0.6; });
  await p.click('#etBeeCalm');
  assert.equal(await p.evaluate(() => document.body.classList.contains('still')), true, 'the calm tent is the page\'s own');
  assert.match(await p.textContent('#etBeeCalm'), /light it up again/);
  await p.click('#etBeeCalm');
  const external = sent.filter(u => !/arb1\.arbitrum\.io|publicnode\.com/.test(u));
  assert.deepEqual(external, [], 'nothing left the page but the board\'s own public reads');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a cell to read a beat; a short hold strings nothing, a full hold strings the pass', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etComb .cell[data-i="8"]', { force: true }); // the cells glow on a slow swing; a tap lands anyway
  assert.match(await p.textContent('#etRaverCard'), /the family.*7 gates, 1 open/);
  await p.fill('#etRaverName', 'kandi kid');
  await p.$eval('#etStringHold', b => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const bx = await p.locator('#etStringHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.inputValue('#passname'), '', 'a short hold strings nothing');
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
  await p.waitForFunction(() => document.getElementById('passname').value === 'kandi kid');
  const d = await p.evaluate(() => ({ front: [...document.querySelectorAll('#etComb .bead')].map(c => c.style.fill), page: [...document.querySelectorAll('#passout circle')].map(c => c.style.fill), on: document.querySelectorAll('#etComb .bead.on').length }));
  assert.deepEqual(d.front, d.page, 'the beads around the comb are the page\'s beads'); assert.equal(d.on, 7);
  // the calm tent is the pause: the glow stills with it, and under reduced motion it never moves
  await p.click('#etRaverCalm');
  assert.equal(await p.evaluate(() => document.body.classList.contains('still') && getComputedStyle(document.querySelector('.et-r-glow')).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('.et-r-glow')).animationName), 'none', 'still under reduced motion');
  await r.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; the board read is the page\'s own', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    beats: document.querySelectorAll('#etBeats tr.pick').length, steps: document.querySelectorAll('#etPipe li').length,
    receipt: document.querySelectorAll('#etReceipt tr').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    hash: (document.getElementById('etReceipt').textContent.match(/0x[0-9a-f]{8}/) || [])[0], h: window.__eternal.data.pass.hash,
    fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel),
  }));
  assert.equal(d.beats, 9); assert.equal(d.steps, 4); assert.equal(d.receipt, 7);
  assert.match(d.now, /render dials/, 'a failed read is declared, not hidden');
  assert.equal(d.hash, '0x' + d.h.toString(16).padStart(8, '0'));
  assert.deepEqual(d.fork, ['noopener noreferrer']);
  await p.fill('#etCyName', 'abc');
  assert.equal(await p.inputValue('#passname'), 'abc');
  const before = await p.textContent('#eraw');
  await p.click('#etCyRead');
  await p.waitForFunction(b => document.getElementById('eraw').textContent !== b || /unreachable/.test(b), before);
  await p.click('.et-c-beats tr.pick[data-go="s-econ"]');
  await p.waitForFunction(() => { const r = document.getElementById('s-econ').getBoundingClientRect(); return r.top > -40 && r.top < innerHeight * 0.6; });
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
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
