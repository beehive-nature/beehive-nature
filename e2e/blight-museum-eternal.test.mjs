// blight-museum-eternal.test.mjs — the bLighT museum as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal; founder order: "PLEASE MAKE IT A/A- LEVEL MUSEUM").
// Proves at 390 px: exactly one front per register, each in its own dress; all three carry the SAME
// facts (the six classes and the chronology read from the museum's own walls, the exhibit rooms,
// and the live chain reads observed where the exhibits land them); a read is shown as live ONLY
// when its exhibit holds what the chain returned (here the chain is unreachable, so every front
// shows the honest failure state, and a simulated arrival flips all three at once); and the laws
// (no dash for a value, no forced capitals, 44 px actions, no sideways page).
// Run: node --test e2e/blight-museum-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/museum.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/museum.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8945, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.reads.length && window.__eternal.data.reads.every(r => r.state !== 'wait'), null, { timeout: 20000 });
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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products: layout, graphic and gesture differ, not only colour', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    beeRows: document.querySelectorAll('#etMuHalls .et-b-row').length,
    rings: document.querySelectorAll('#etMuRings .et-ring').length,
    stars: document.querySelectorAll('#etMuRings .et-star').length,
    cyTables: document.querySelectorAll('.et-c table').length,
    cyPipe: document.querySelectorAll('#etMuPipe li').length,
  }));
  assert.equal(s.beeRows, 5, 'new bee: five plain halls');
  assert.equal(s.rings, 6, 'raver: six rings'); assert.equal(s.stars, 8, 'raver: one star per work in the chronology');
  assert.ok(s.cyTables >= 3 && s.cyPipe === 6, 'cypherpunk: tables, a numbered pipeline');
  await ctx.close();
});

test('the same facts in all three: classes, chronology, rooms and the live reads', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      const wallClasses = [...document.querySelectorAll('#ex3 ~ .panel table tr')].filter(r => !r.querySelector('th')).slice(0, 6).map(r => r.cells[1].textContent.trim());
      return {
        classes: D.classes.map(c => c.c + ':' + c.means), wallClasses,
        chron: D.chron.map(w => w.date + ' ' + w.what), rooms: D.rooms.map(r => r.id),
        reads: D.reads.map(r => r.k + ':' + r.state),
        beeRooms: [...document.querySelectorAll('#etMuHalls .et-b-row small')].reduce((a, e) => a + parseInt(e.textContent, 10), 0),
        beeNo: [...document.querySelectorAll('#etMuToday .et-b-person span')].filter(e => /not read today/.test(e.textContent)).length,
        raverDash: document.querySelectorAll('#etMuTiles .et-r-tile.et-dash').length,
        raverTiles: document.querySelectorAll('#etMuTiles .et-r-tile').length,
        cyNo: [...document.querySelectorAll('#etMuReads tr.et-pick')].filter(r => /no answer/.test(r.textContent)).length,
        cyRows: document.querySelectorAll('#etMuReads tr.et-pick').length,
        cyClasses: [...document.querySelectorAll('#etMuClasses tr')].map(r => r.cells[0].textContent + ':' + r.cells[1].textContent),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].classes, a.classes); assert.deepEqual(facts[reg].chron, a.chron); assert.deepEqual(facts[reg].reads, a.reads); }
  assert.equal(a.classes.length, 6); assert.deepEqual(a.classes.map(c => c.split(':')[1]), a.wallClasses, 'classes are the wall\'s own table');
  assert.equal(a.chron.length, 8); assert.match(a.chron[0], /^2014-01-02 Counterparty genesis/);
  assert.equal(a.rooms.length, 11); assert.equal(a.beeRooms, 11, 'every room sits in exactly one bee hall');
  const no = a.reads.filter(r => r.endsWith(':no')).length;
  assert.equal(a.reads.length, 7);
  assert.equal(no, 7, 'the chain is unreachable here, so every read is said to have failed');
  assert.equal(a.beeNo, no); assert.equal(facts.raver.raverDash, no); assert.equal(facts.raver.raverTiles, 7);
  assert.equal(facts.cypherpunk.cyNo, no); assert.equal(facts.cypherpunk.cyRows, 7);
  assert.deepEqual(facts.cypherpunk.cyClasses, a.classes);
});

test('honest reads: live is claimed only when the exhibit holds the chain\'s answer', async () => {
  const { ctx, p, errs } = await open('bee');
  const before = await p.evaluate(() => ({
    pepi: !!document.querySelector('#pepiArt svg'), note: document.querySelector('#pepiArt').textContent,
    claims: [...document.querySelectorAll('#etMuToday .et-b-person')].some(e => /read just now/.test(e.textContent)) || /every work was read/.test(document.getElementById('etMuToday').textContent)
      || document.querySelectorAll('#etMuTiles .et-r-tile.et-on').length > 0 || /read ✓/.test(document.getElementById('etMuReads').textContent),
  }));
  assert.equal(before.pepi, false); assert.match(before.note, /unreachable/);
  assert.equal(before.claims, false, 'no front claims a live read the exhibit does not hold');
  // a PEPi answer arriving in the exhibit flips the same fact in every renderer
  await p.evaluate(() => { document.getElementById('pepiArt').innerHTML = '<svg viewBox="0 0 1 1"></svg>'; document.getElementById('pepiBytes').textContent = '1 bytes of SVG'; });
  await p.waitForFunction(() => window.__eternal.data.reads.find(r => r.k === 'pepi').state === 'ok');
  const after = await p.evaluate(() => ({
    bee: [...document.querySelectorAll('#etMuToday .et-b-person')].filter(e => /read just now/.test(e.textContent)).length,
    raver: document.querySelectorAll('#etMuTiles .et-r-tile.et-on').length,
    cy: [...document.querySelectorAll('#etMuReads tr.et-pick')].filter(r => /read ✓/.test(r.textContent)).length,
  }));
  assert.deepEqual(after, { bee: 1, raver: 1, cy: 1 });
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee: a hall opens to its rooms; every way in lands on a real exhibit', async () => {
  const { ctx, p } = await open('bee');
  await p.click('#etMuHalls [data-hall="process"]');
  const links = await p.$$eval('#etMuHalls .et-b-go', as => as.map(a => [a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))]));
  assert.deepEqual(links.map(l => l[0]), ['#ex6', '#ex7', '#ex8']); assert.ok(links.every(l => l[1]));
  assert.equal(await p.getAttribute('#etMuBeeGo', 'href'), '#ex1');
  assert.ok(await p.evaluate(() => !!document.getElementById('ex1')));
  await ctx.close();
});

test('raver: tap a ring to light it, tap a star to read its date', async () => {
  const { ctx, p } = await open('raver');
  await p.locator('#etMuRings .et-ring[data-c="c"]').dispatchEvent('click');
  assert.equal(await p.getAttribute('#etMuRings .et-ring[data-c="c"]', 'aria-pressed'), 'true');
  const means = await p.evaluate(() => window.__eternal.data.classes.find(c => c.c === 'c').means);
  assert.ok((await p.textContent('#etMuRaverCard')).includes(means));
  await p.locator('#etMuRings .et-star[data-i="3"]').dispatchEvent('click');
  const w = await p.evaluate(() => window.__eternal.data.chron[3]);
  assert.ok((await p.textContent('#etMuRaverCard')).includes(w.date + ' · ' + w.what));
  await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etMuReads tr.et-pick').length, steps: document.querySelectorAll('#etMuPipe li').length,
    receipt: document.querySelectorAll('#etMuReceipt tr').length, verify: document.querySelectorAll('#etMuVerify li').length,
    path: document.getElementById('etMuPath').textContent,
    fork: [document.getElementById('etMuCyFork').target, document.getElementById('etMuCyFork').rel],
  }));
  assert.equal(d.rows, 7); assert.equal(d.steps, 6); assert.equal(d.receipt, 6); assert.equal(d.verify, 3);
  assert.match(d.path, /^bLighT:\/\/museum · 10 exhibits · 7 live reads/);
  assert.deepEqual(d.fork, ['_blank', 'noopener noreferrer']);
  await p.click('#etMuReads tr.et-pick[data-k="btc"]');
  assert.equal(await p.$eval('#etMuReads tr.et-more[data-k="btc"]', e => e.hidden), false, 'a read opens to its target and outcome');
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
