// privacy-lens-eternal.test.mjs — the privacy lens (one private-note contract, both sides of the glass)
// as three products in one surface (founder blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 2).
// Proves at 390 px: exactly one front per register, each in its own dress, structure and gesture; all
// three carry the SAME facts (the lens's own public reads, its receipted flow txids, its four chip
// classes and the field schema its ledger draws, parsed from the page source); and THE PRIVATE NOTE:
// no front reads the view key or the note secret or any demo note's keys, no key reaches any request
// body, and the fronts add no request. The lens's own chain reader is the page's (present before this
// change); here the chain is either refused or answered by a fixture, so nothing leaves the box.
// Run: node --test e2e/privacy-lens-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9174, ORIGIN = `http://127.0.0.1:${PORT}`, CHAIN = 'https://jungle4.greymass.com/v1/';
const SRC = await readFile(join(ROOT, 'surfaces/privacy-lens.html'), 'utf8');
const FLOWS = Object.fromEntries([...SRC.matchAll(/^\s+(deposit|transfer|withdraw):\s+'([0-9a-f]{64})'/gm)].map(m => [m[1], m[2]]));
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// a chain that answers (fixture): the three receipted flows, final; two notes, one nullifier
function fixture(path, body) {
  if (path.endsWith('chain/get_info')) return { head_block_num: 1000, last_irreversible_block_num: 990 };
  if (path.endsWith('history/get_actions')) return { actions: ['deposit', 'transfer', 'withdraw'].map((n, i) => ({ account_action_seq: i, block_num: 100 + i, irreversible: true, block_time: '2026-09-03T00:00:0' + i,
    action_trace: { trx_id: FLOWS[n], act: { account: 'notelab11111', name: n, data: {} } } })) };
  const table = (JSON.parse(body || '{}').table) || '';
  const hex = (ch) => ch.repeat(64);
  if (table === 'commitments') return { rows: [{ c: hex('1'), viewtag: 11, amount: 5, deposited: 1756857600 }, { c: hex('2'), viewtag: 22, amount: 7, deposited: 1756857700 }] };
  if (table === 'nullifiers') return { rows: [{ n: hex('3'), spent_at: 1756857800 }] };
  if (table === 'law') return { rows: [{ alg_commit: 1, alg_proof: 1 }] };
  return { rows: [] };
}
function spy() {
  const w = window; w.__spy = { reads: { ovk: 0, osk: 0 }, net: [], store: [], log: [] };
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  Object.defineProperty(HTMLInputElement.prototype, 'value', { configurable: true, enumerable: d.enumerable,
    get() { if (this.id in w.__spy.reads) w.__spy.reads[this.id]++; return d.get.call(this); }, set(v) { d.set.call(this, v); } });
  const f = w.fetch; w.fetch = function (u) { w.__spy.net.push(String(u && u.url || u)); return f.apply(this, arguments); };
  const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { w.__spy.store.push(k + '=' + v); return si.apply(this, arguments); };
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { const c = console[m]; console[m] = function () { w.__spy.log.push([...arguments].map(String).join(' ')); return c.apply(this, arguments); }; }
}
async function open(reg, { chain = 'refuse', query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(spy);
  const outside = [], bodies = [], requests = [];
  await ctx.route('**/*', r => {
    const q = r.request(), u = q.url(); bodies.push(q.postData() || '');
    if (u.startsWith(ORIGIN)) { requests.push([q.resourceType(), u]); return r.continue(); }
    outside.push(u);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };
    if (chain === 'answer' && u.startsWith(CHAIN)) return q.method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(fixture(u, q.postData())) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/privacy-lens.html${query}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.read !== 'pending', null, { timeout: 25000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs, outside, bodies, requests };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();
const onlyTheLensReader = outside => outside.every(u => u.startsWith(CHAIN));
async function hold(p, ms) {
  const bx = await p.locator('#etArt .lens-hold circle').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + 24); // on the glass, above the cells
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250);
}

test('one front per register, each in its own dress and structure', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        radios: fr.querySelectorAll('[role="radio"]').length, cells: fr.querySelectorAll('svg.et-r-art [data-cell]').length, table: !!fr.querySelector('table.et-c-tab'), inputs: fr.querySelectorAll('input,textarea,select,form').length };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.radios === 2, reg === 'bee'); assert.equal(d.cells === 7, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.equal(d.inputs, 0, reg + ': a front has no field');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.ok(onlyTheLensReader(outside), 'the only outside attempts are the lens\'s own chain reads: ' + outside.join(' '));
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: flows, classes and the schema the ledger draws (parsed from the source)', async () => {
  // the ledger's own field → chip mapping, read from renderStranger() in the page source
  const own = {}; let cur = null;
  const body = SRC.slice(SRC.indexOf('function renderStranger'), SRC.indexOf('/* ═══ the owner\'s lens'));
  for (const line of body.split('\n')) { const n = line.match(/if \(n === '(\w+)'\)/); if (n) { cur = n[1]; own[cur] = []; } for (const m of line.matchAll(/f\('([^']+)',.*?CHIP\.(pub|priv|pm5|nev)\(\)\)/g)) if (cur && cur !== 'init') own[cur].push([m[1], m[2]]); }
  delete own.init;
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return { flows: D.flows.map(f => [f.name, f.tx, f.status]), classes: D.classes, counts: D.counts, read: D.read, account: D.account, lens: D.lens,
        beeRead: document.querySelector('#etBeeRead').textContent, cells: [...document.querySelectorAll('#etArt [data-cell]')].map(g => [g.dataset.cell, g.getAttribute('aria-label')]),
        rows: [...document.querySelectorAll('#etFields tr')].map(r => [...r.children].map(c => c.textContent)), receipt: document.querySelector('#etReceipt').textContent, pipe: document.querySelector('#etPipe').textContent };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.flows.map(f => [f[0], f[1]]), Object.entries(FLOWS), 'the receipted txids');
  for (const r of ['raver', 'cypherpunk']) for (const k of ['flows', 'classes', 'counts', 'read', 'account', 'lens']) assert.deepEqual(facts[r][k], a[k], r + ' ' + k);
  assert.deepEqual(a.classes.map(c => [c.k, c.glyph]), [['pub', '○'], ['priv', '●'], ['pm5', '◐'], ['nev', '◉']], 'the four classes, from the page legend');
  // the cypherpunk table IS the ledger's schema; the counts follow from it
  const flat = a.flows.flatMap(([f]) => own[f].map(([field, cls]) => [f, field, cls]));
  let last = ''; const tab = facts.cypherpunk.rows.map(r => { if (r[0]) last = r[0]; return [last, r[1], r[2]]; });
  assert.deepEqual(tab.map(r => [r[0], r[1]]), flat.map(r => [r[0], r[1]]), 'every field the ledger draws, in order');
  const glyph = Object.fromEntries(a.classes.map(c => [c.k, c.glyph]));
  tab.forEach((r, i) => assert.ok(r[2].startsWith(glyph[flat[i][2]]), r[1] + ' is ' + flat[i][2]));
  const count = { pub: 0, priv: 0, pm5: 0, nev: 0 }; flat.forEach(r => count[r[2]]++);
  assert.deepEqual(a.counts, count);
  assert.deepEqual(facts.raver.cells.slice(3).map(c => c[1].match(/: (\d+) fields/)[1]).map(Number), [count.pub, count.priv, count.pm5, count.nev], 'the glyph numbers are the schema counts');
  // the chain refused here: every register says so, and nothing is guessed
  assert.equal(a.read, 'failed'); assert.ok(a.flows.every(f => f[2] === 'unread'));
  assert.match(a.beeRead, /did not answer just now, so nothing here is guessed/);
  assert.ok(facts.raver.cells.slice(0, 3).every(c => /not read · the test chain did not answer/.test(c[1])));
  assert.match(txt(facts.cypherpunk.receipt), /readfailed · the chain did not answer · nothing guessed/);
  assert.match(txt(facts.cypherpunk.receipt), /commitsnot read/);
  for (const tx of Object.values(FLOWS)) assert.ok(facts.cypherpunk.receipt.includes(tx), 'the receipt carries each txid whole');
});

test('with the chain answering (fixture, intercepted), all three show the same finality', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, outside } = await open(reg, { chain: 'answer' });
    facts[reg] = await p.evaluate(() => ({ status: window.__eternal.data.flows.map(f => f.status), commits: window.__eternal.data.commits, bee: document.querySelector('#etBeeRead').textContent,
      fills: [...document.querySelectorAll('#etArt [data-cell] polygon')].map(x => x.getAttribute('fill')), verified: getComputedStyle(document.body).getPropertyValue('--sk-verified').trim(),
      pipe: [...document.querySelectorAll('#etPipe li')].slice(0, 3).map(l => l.className), receipt: document.querySelector('#etReceipt').textContent }));
    assert.ok(onlyTheLensReader(outside));
    await ctx.close();
  }
  for (const r of ['bee', 'raver', 'cypherpunk']) assert.deepEqual(facts[r].status, ['final', 'final', 'final'], r);
  assert.match(facts.bee.bee, /we just read it: 3 of 3 steps are final/);
  assert.ok(facts.raver.fills.every(f => f === facts.raver.verified), 'the three cells are sealed in verified');
  assert.deepEqual(facts.cypherpunk.pipe, ['done', 'done', 'done']);
  assert.match(txt(facts.cypherpunk.receipt), /readok · 3 of 3 flows final/); assert.match(txt(facts.cypherpunk.receipt), /head1,000 · irreversible 990/);
});

test('THE PRIVATE NOTE: no front reads a key or a demo note; no key reaches any request; fronts add no request', async () => {
  const VK = 'ab'.repeat(32), SK = 'cd'.repeat(32);
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, outside, bodies, requests } = await open(reg);
    await p.click('#lowner'); await p.fill('#ovk', VK); await p.fill('#osk', SK); await p.click('#lstranger');
    const n0 = await p.evaluate(() => { window.__spy.reads = { ovk: 0, osk: 0 }; return window.__spy.net.length; });
    const req0 = requests.length, out0 = outside.length;
    if (reg === 'bee') { await p.click('#etBeeRows [data-lens="owner"]'); await p.click('#etBeeRows [data-lens="stranger"]'); await p.click('#etBeeGo'); await p.click('#etBeeDemo'); }
    else if (reg === 'raver') { for (const c of ['deposit', 'transfer', 'withdraw', 'pub', 'priv', 'pm5', 'nev']) await p.click(`#etArt [data-cell="${c}"] circle, #etArt [data-cell="${c}"] polygon >> nth=0`); await hold(p, 1500); await p.click('#etRaverGo'); }
    else { await p.click('#etCyGo'); await p.click('#etCyStranger'); await p.click('#etCyDemo'); }
    await p.waitForTimeout(300);
    const s = await p.evaluate(() => window.__spy);
    assert.deepEqual(s.reads, { ovk: 0, osk: 0 }, reg + ': no gesture read the view key or the note secret');
    assert.equal(s.net.length, n0, reg + ': no gesture fetched');
    assert.deepEqual(requests.slice(req0).filter(([t]) => t !== 'font' && t !== 'stylesheet'), [], reg + ': no gesture requested anything');
    assert.ok(outside.slice(out0).every(u => u.startsWith(CHAIN + 'chain/get_info')), reg + ': nothing new went outside but the lens\'s own 15 s head check');
    // the real flow, by the reader: mint a demo note, unlock it; the keys stay out of every front
    await p.click('#lowner'); await p.click('#omint'); await p.click('#odemo-unlock'); await p.waitForTimeout(300);
    const d = await p.evaluate(() => ({ demo: window.__lens.demo, front: document.getElementById('eternal').innerHTML, data: JSON.stringify(window.__eternal), log: window.__spy.log.join('\n'), store: window.__spy.store.join('\n') }));
    assert.ok(d.demo && d.demo.sk && d.demo.vk, 'the page minted its demo note');
    for (const secret of [VK, SK, d.demo.sk, d.demo.vk, d.demo.nul]) {
      for (const hay of [d.front, d.data, d.log, d.store]) assert.ok(!hay.includes(secret) && !hay.includes(secret.slice(0, 10)), reg + ': a key or nullifier reached a front, its data, a log or storage');
      assert.ok(bodies.every(b => !b.includes(secret)), reg + ': a key reached a request body');
    }
    assert.ok(onlyTheLensReader(outside)); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the source law: the front script touches no network, storage, field value, key or demo note', async () => {
  const m = SRC.match(/<script>\s*\/\* ETERNAL FRONT — one data layer[\s\S]*?<\/script>/); assert.ok(m);
  const code = m[0].replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of [/fetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /clipboard/, /console\./, /\.value\b/, /innerText/, /\bpost\(/, /\.demo\b/, /localNotes/, /'ovk'|'osk'|#ovk|#osk/, /JSON\.stringify\(L\)/])
    assert.doesNotMatch(code, bad, 'front script must not use ' + bad);
});

test('bee: borrow a stranger\'s eyes or your own; the action opens the real lens; the demo is yours to press', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows [data-lens="owner"]');
  assert.deepEqual(await p.evaluate(() => [document.getElementById('lowner').getAttribute('aria-pressed'), document.getElementById('powner').classList.contains('on'), window.__lens.lens]), ['true', true, 'owner'], 'the page\'s own lens turned');
  assert.equal(await p.textContent('#etBeeGo'), 'look through your key');
  await p.click('#etBeeGo');
  assert.ok(await p.$eval('#powner', e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'scrolled to the owner\'s lens');
  await p.click('#etBeeDemo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'omint', 'the demo mint is focused');
  assert.equal(await p.textContent('#odemout'), '', 'nothing was minted by the front');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a cell; a short hold does nothing; the full hold turns the glass (the page\'s own lens)', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etArt [data-cell="transfer"] polygon');
  assert.match(txt(await p.textContent('#etRaverCard')), /transfer · value moves, sealed.*nullifier ◉ · to-amount ◐/);
  await hold(p, 400);
  assert.equal(await p.evaluate(() => window.__lens.lens), 'stranger', 'a short hold turns nothing');
  await hold(p, 1500);
  assert.deepEqual(await p.evaluate(() => [window.__lens.lens, document.getElementById('lowner').getAttribute('aria-pressed')]), ['owner', 'true']);
  assert.equal(await p.textContent('#etRaverTitle'), 'your lens');
  assert.equal(await p.getAttribute('#etArt [data-cell="priv"]', 'opacity'), '1', 'through your key, the private lights up');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; ?lens=owner reaches every front', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etFields tr').length, steps: document.querySelectorAll('#etPipe li').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    receipt: document.querySelectorAll('#etReceipt tr').length, links: [...document.querySelectorAll('.et-c a[href^="http"]')].map(a => [a.target, a.rel, /new tab/.test(a.textContent)]) }));
  assert.deepEqual([d.rows, d.steps, d.receipt], [13, 6, 10]);
  assert.equal(d.now, 'owner · view-tag match');
  assert.ok(d.links.length === 2 && d.links.every(l => l[0] === '_blank' && l[1] === 'noopener noreferrer' && l[2]));
  await p.click('#etCyGo');
  assert.equal(await p.evaluate(() => window.__lens.lens), 'owner');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  for (const reg of ['bee', 'raver']) {
    const o = await open(reg, { query: '?lens=owner' });
    assert.equal(await o.p.evaluate(() => window.__eternal.data.lens), 'owner', reg + ': the course deep link opens the owner side');
    await o.ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the screen edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20)); // a page's overflow-x:hidden must not hide a cut
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
