// blight-inscription-explorer-eternal.test.mjs — the Modern Inscription Art Gallery (explorer) as three
// products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly
// one front per register, each in its own dress; the old full-screen doorway now stands in the page's
// flow under the fronts (nothing covers them); three different products (bee: three doors and one
// button; raver: eight families as a constellation around the garden; cypherpunk: an address field,
// every selector, every host, the call pipeline); the SAME facts in all three (the explorer's own
// COLS, HOSTS and doors, and what a visit really did); honest visits in all three states — the chain
// silent (blocked here: every front says so and none calls the garden empty), the chain answering
// with nothing ("quiet"), and the chain answering with art (stubbed RPC: every front flips at once);
// every visit is the doorway's own door or form; and the laws (no dash for a value, no forced
// capitals, 44 px actions, no sideways page).
// Run: node --test e2e/blight-inscription-explorer-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/inscription-explorer.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/inscription-explorer.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9143, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// a stub Base RPC for the "chain answers" cases: FUNGI holds one record (seed 25,000), the rest hold nothing
const FUNGI = '0x7d9ce55d54ff3feddb611fc63ff63ec01f26d15f';
const W = v => BigInt(v).toString(16).padStart(64, '0');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#3f9c55"/></svg>';
const abiString = s => '0x' + W(0x20) + W(s.length) + Buffer.from(s).toString('hex').padEnd(Math.ceil(s.length / 32) * 64, '0');
function answer(call, holds) {
  const d = String(call.data).toLowerCase().replace(/^0x/, ''), to = String(call.to).toLowerCase();
  if (d.startsWith('70a08231')) return '0x' + W(holds && to === FUNGI ? 25000n * 1000000000n : 0);
  if (d.startsWith('a775188a') && holds && to === FUNGI) return '0x' + W(25000) + W(0);
  if (d.startsWith('422b9e23') && holds && to === FUNGI) return abiString(SVG);
  return '0x' + W(0);
}
async function open(reg, { rpc = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // the chain is outside this box: every RPC is refused, unless a test stands in for it
  await ctx.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (rpc && u.startsWith('https://base-rpc.publicnode.com')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const calls = JSON.parse(q.postData() || '[]');
      const body = Array.isArray(calls) ? calls.map((c, i) => ({ jsonrpc: '2.0', id: i, result: answer(c.params[0], rpc === 'holds') })) : { jsonrpc: '2.0', id: 1, result: '0x' };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    }
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.doors.length === 3, null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const settled = p => p.waitForFunction(() => !/^(idle|wait)$/.test(window.__eternal.data.visit.state), null, { timeout: 30000 });
const GO = { bee: '#etExBeeGo', raver: '#etExRaverGo' };

test('one front per register, each in its own dress, and the doorway no longer covers them', async () => {
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
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), r = title.getBoundingClientRect();
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      const door = document.getElementById('door'), arch = document.getElementById('etArchive');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        top: fr.contains(document.elementFromPoint(r.left + 4, r.top + r.height / 2)), doorPos: getComputedStyle(door).position,
        doorBelow: door.getBoundingClientRect().top > arch.getBoundingClientRect().top };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.ok(d.top, reg + ': the front is on top, not under the doorway'); assert.notEqual(d.doorPos, 'fixed'); assert.ok(d.doorBelow, 'the doorway stands under the whole-gallery heading');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products carrying the explorer\'s own collections, hosts and doors', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    cols: window.__eternal.data.cols.map(c => c.sym + ':' + (c.rungs ? c.rungs.length : 0)), src: COLS.map(c => c.sym + ':' + (c.lv ? c.lv.length - 1 : 0)),
    rpc: window.__eternal.data.rpc, hosts: HOSTS,
    doors: [...document.querySelectorAll('#door .seeds button')].map(b => b.getAttribute('data-a') || b.id),
    beeDoors: document.querySelectorAll('#etExDoors .et-b-row').length, fams: document.querySelectorAll('#etExSky .et-fam').length,
    labels: [...document.querySelectorAll('#etExLabels .et-fam-l')].map(l => l.textContent), tiles: document.querySelectorAll('#etExTiles .et-r-tile').length,
    cyRows: [...document.querySelectorAll('#etExCols tr.et-pick')].map(r => r.cells[1].firstChild.textContent), cyHosts: document.querySelectorAll('#etExHosts tr').length,
    pipe: document.querySelectorAll('#etExPipe li').length, input: !!document.querySelector('#etExAsk input'),
  }));
  assert.deepEqual(s.cols, s.src, 'the data layer is the page\'s own COLS'); assert.deepEqual(s.rpc, s.hosts, 'and its own HOSTS');
  assert.equal(s.doors.length, 3); assert.equal(s.beeDoors, 3, 'new bee: the three doors as plain rows');
  assert.equal(s.fams, 8); assert.deepEqual(s.labels, s.cols.map(c => c.split(':')[0]), 'raver: eight named families'); assert.equal(s.tiles, 3);
  assert.deepEqual(s.cyRows, s.labels, 'cypherpunk: one row per collection'); assert.ok(s.cyHosts >= 3); assert.equal(s.pipe, 6); assert.ok(s.input);
  await ctx.close();
});

test('honest silence: the chain does not answer, and every front says so without calling the garden empty', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg);
    if (reg === 'cypherpunk') { await p.fill('#etExAddr', '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876'); await p.click('#etExCyGo'); }
    else await p.click(GO[reg]);
    await settled(p);
    seen[reg] = await p.evaluate(() => ({
      v: [window.__eternal.data.visit.state, window.__eternal.data.visit.ok, window.__eternal.data.visit.input], sent: window.__eternal.data.visit.sent,
      msg: document.getElementById('dmsg').textContent, addr: document.getElementById('addr').value,
      bee: document.getElementById('etExBeeCard').textContent, raver: document.getElementById('etExRaverCard').textContent + document.getElementById('etExMid').textContent,
      cy: document.getElementById('etExReceipt').textContent + document.getElementById('etExPipe').textContent,
    }));
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const d = seen[reg];
    assert.deepEqual(d.v, ['noanswer', 0, '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876'], reg + ': the founder\'s garden was asked, nothing answered');
    assert.ok(d.sent >= 8, reg + ': the calls really went out (' + d.sent + ')');
    assert.match(d.msg, /the chain did not answer/, 'the doorway itself says so now');
    assert.doesNotMatch(d.msg + d.bee + d.raver + d.cy, /garden is quiet|living pieces\.|pieces drawn/, reg + ': silence is never called an empty garden');
  }
  assert.match(seen.bee.bee, /the chain did not answer today/); assert.match(seen.raver.raver, /did not answer/); assert.match(seen.cypherpunk.cy, /no answer · nothing drawn/);
  assert.equal(seen.cypherpunk.addr, '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876', 'cypherpunk wrote into the doorway\'s own form');
});

test('the chain answering: empty is "quiet", art is "found", and all three flip together', async () => {
  const quiet = {}, found = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    { const { ctx, p } = await open(reg, { rpc: 'empty' });
      if (reg === 'cypherpunk') { await p.fill('#etExAddr', '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876'); await p.click('#etExCyGo'); } else await p.click(GO[reg]);
      await settled(p);
      quiet[reg] = await p.evaluate(() => ({ st: window.__eternal.data.visit.state, ok: window.__eternal.data.visit.ok, msg: document.getElementById('dmsg').textContent, front: document.querySelector('#eternal').textContent }));
      await ctx.close(); }
    { const { ctx, p, errs } = await open(reg, { rpc: 'holds' });
      if (reg === 'cypherpunk') { await p.fill('#etExAddr', '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876'); await p.click('#etExCyGo'); } else await p.click(GO[reg]);
      await settled(p);
      found[reg] = await p.evaluate(() => ({
        st: window.__eternal.data.visit.state, pieces: window.__eternal.data.visit.pieces.map(x => x.sym + ':' + x.seed), wall: document.querySelectorAll('#wall .piece svg').length,
        bee: document.getElementById('etExBeeCard').textContent, lit: [...document.querySelectorAll('#etExLabels .et-lit')].map(l => l.textContent),
        mid: document.getElementById('etExMid').textContent, wide: document.documentElement.scrollWidth, cy: [...document.querySelectorAll('#etExCols tr.et-pick')].filter(r => /1 found/.test(r.textContent)).map(r => r.cells[1].firstChild.textContent),
      }));
      assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close(); }
  }
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    assert.equal(quiet[reg].st, 'quiet'); assert.ok(quiet[reg].ok > 0); assert.match(quiet[reg].msg, /garden is quiet/);
    assert.deepEqual(found[reg].pieces, ['FUNGI:25000'], reg + ': the one piece the chain returned'); assert.equal(found[reg].wall, 1);
    assert.equal(found[reg].st, 'found'); assert.ok(found[reg].wide <= 390, reg + ': the found wall keeps the page at 390 px');
  }
  assert.match(quiet.bee.front, /the chain answered, and it holds no living pieces/);
  assert.match(found.bee.bee, /one living piece/); assert.deepEqual(found.raver.lit, ['FUNGI']); assert.equal(found.raver.mid, '1');
  assert.deepEqual(found.cypherpunk.cy, ['FUNGI']);
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg === 'raver') await p.click('#etExSky .et-fam[data-i="2"]');
    if (reg === 'cypherpunk') await p.click('#etExCols tr.et-pick[data-i="2"]');
    if (reg !== 'cypherpunk') { await p.click(GO[reg]); await settled(p); }
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('junk ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
