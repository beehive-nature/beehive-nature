// addresses-eternal.test.mjs — "your two addresses" (keys/addresses.html) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 2). Proves at 390 px:
// exactly one front per register, each in its own dress, structure and gesture; all three carry
// the SAME facts, read from this page's own cards and computed by the page's own sha256hex() on its
// documented empty-box default; and ZERO CUSTODY: no front reads the box (#root) or the rows the
// shape-maker writes, stores or sends anything, and no request leaves the origin. Every "try it"
// only focuses the box; derive() is the only thing that reads it.
// Run: node --test e2e/addresses-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9171, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

function spy() {
  const w = window; w.__spy = { reads: { root: 0 }, net: [], store: [], clip: [], log: [] };
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  Object.defineProperty(HTMLInputElement.prototype, 'value', { configurable: true, enumerable: d.enumerable,
    get() { if (this.id in w.__spy.reads) w.__spy.reads[this.id]++; return d.get.call(this); }, set(v) { d.set.call(this, v); } });
  const f = w.fetch; w.fetch = function (u) { w.__spy.net.push('fetch ' + (u && u.url || u)); return f.apply(this, arguments); };
  const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { w.__spy.net.push('xhr ' + u); return o.apply(this, arguments); };
  if (navigator.sendBeacon) { const b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, x) => { w.__spy.net.push('beacon ' + u); return b(u, x); }; }
  const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { w.__spy.store.push(k + '=' + v); return si.apply(this, arguments); };
  if (navigator.clipboard) { const c = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = t => { w.__spy.clip.push(t); return c(t); }; }
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { const c = console[m]; console[m] = function () { w.__spy.log.push([...arguments].map(String).join(' ')); return c.apply(this, arguments); }; }
}
async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(spy);
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push([r.request().resourceType(), u]); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/keys/addresses.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.rails.length === 3 && window.__eternal.data.demo, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs, outside, requests };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();
const DEMO = createHash('sha256').update('bnr.b/did-plc/demo-root').digest('hex').slice(0, 24);

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
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, rings: fr.querySelectorAll('svg.et-r-art .ring').length, table: !!fr.querySelector('table.et-c-tab'), inputs: fr.querySelectorAll('input,textarea,select,[contenteditable]').length };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee'); assert.equal(d.rings === 2, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.equal(d.inputs, 0, reg + ': a front has no field');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'no request left the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from this page\'s own cards', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      const dom = [...document.querySelectorAll('.wrap > .card')].map(c => [...c.querySelectorAll('.row')].map(r => { const v = r.querySelector('.v'); return [r.querySelector('.k').textContent.trim(), ['plcDoc', 'plcAka', 'npubV', 'nip05'].includes(v.id) ? '' : v.textContent.trim()]; }));
      return {
        model: D.rails.map(r => r.rows.map(x => [x.k, x.v])), dom, fields: D.fields, demo: D.demo,
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row small')].map(e => e.textContent.trim()),
        rings: [...document.querySelectorAll('#etArt .ring')].map(g => [g.dataset.ring, g.querySelectorAll('.seg').length]),
        stitches: document.querySelectorAll('#etArt .lens .seg').length - 1,
        table: document.querySelector('#etFields').textContent, pipe: document.querySelector('#etPipe').textContent, receipt: document.querySelector('#etReceipt').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model, a.dom, 'the data layer is the page\'s own rows (the shape-maker\'s four are never read)');
  for (const r of ['raver', 'cypherpunk']) { assert.deepEqual(facts[r].model, a.model); assert.deepEqual(facts[r].fields, a.fields); }
  assert.deepEqual(a.fields, ['root_fp', 'plc', 'npub', 'ts', 'sig'], 'the binding note\'s fields, parsed from the page');
  assert.equal(a.demo, DEMO, 'the empty-box shape, computed by the page\'s own sha256hex, equals Node\'s sha256');
  assert.deepEqual(a.bee, ['did:plc', 'npub', '5 parts', 'shows the shape']);
  assert.deepEqual(facts.raver.rings, [['plc', 24], ['npub', 32]], 'one segment per did:plc character and per npub key byte');
  assert.equal(facts.raver.stitches, 5, 'one stitch per field of the signed note');
  const c = facts.cypherpunk;
  for (const rows of a.dom) for (const [k, v] of rows) { assert.ok(c.table.includes(k), 'cypher shows ' + k); if (v) assert.ok(c.table.includes(v), 'cypher shows ' + v); }
  assert.ok(c.pipe.includes('did-bind {root_fp, plc, npub, ts, sig}') && c.pipe.includes('Vaulta custom_json lane'));
  assert.ok(txt(c.receipt).includes('did:plc:' + DEMO), 'the receipt quotes the computed empty-box shape');
  assert.match(txt(c.receipt), /real plcUNVERIFIED · not derived in this tree/);
  assert.match(txt(c.receipt), /nsecnever rendered, never on-chain, client-held only/);
});

test('ZERO CUSTODY: no front reads the box or its output, keeps or sends anything; no request leaves the origin', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, outside, requests } = await open(reg);
    await p.fill('#root', 'zebrasentinel');
    const before = await p.evaluate(() => { const s = window.__spy; s.reads = { root: 0 }; return { net: s.net.length, clip: s.clip.length }; });
    const req0 = requests.length;
    if (reg === 'bee') { for (const r of await p.$$('#etBeeRows .et-b-row')) await r.click(); await p.click('#etBeeGo'); await p.click('.et-b [data-go="ask"]'); await p.click('#etBeeGo'); }
    else if (reg === 'raver') { for (const k of ['plc', 'npub', 'bind']) await p.click(`#etArt [data-ring="${k}"] .seg >> nth=0`); await p.click('#etArt [data-ring="root"] polygon'); await p.click('#etRaverGo'); }
    else await p.click('#etCyGo');
    await p.waitForTimeout(300);
    const s = await p.evaluate(() => ({ spy: window.__spy, focus: document.activeElement && document.activeElement.id, plc: document.getElementById('plcDoc').textContent }));
    assert.equal(s.focus, 'root', reg + ': the gesture hands off to the box');
    assert.deepEqual(s.spy.reads, { root: 0 }, reg + ': no gesture read the box');
    assert.equal(s.plc, 'did:plc:<rotation-0-hash-of-root>', reg + ': no gesture derived anything');
    assert.equal(s.spy.net.length, before.net); assert.equal(s.spy.clip.length, before.clip);
    assert.deepEqual(requests.slice(req0).filter(([t]) => t !== 'font' && t !== 'stylesheet'), [], reg + ': a gesture makes no request');
    // the real flow, by the reader: derive() writes the sentinel into its own rows; the front never mirrors them
    await p.click('form button'); await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ aka: document.getElementById('plcAka').textContent, front: document.getElementById('eternal').innerHTML, data: JSON.stringify(window.__eternal), spy: window.__spy,
      ls: JSON.stringify(Object.assign({}, localStorage)), ss: JSON.stringify(Object.assign({}, sessionStorage)) }));
    assert.equal(after.aka, 'at://zebrasentinel.beehive', 'the shape-maker ran');
    for (const hay of [after.front, after.data, after.ls, after.ss, after.spy.store.join('\n'), after.spy.log.join('\n'), after.spy.clip.join('\n')]) assert.ok(!hay.includes('zebrasentinel'), reg + ': never kept, stored, copied or logged');
    assert.deepEqual(outside, [], reg + ': no request left the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the source law: the front script touches no network, storage, clipboard, field value or shape-maker row', async () => {
  const html = await readFile(join(ROOT, 'surfaces/keys/addresses.html'), 'utf8');
  const m = html.match(/<script>\s*\/\* ETERNAL FRONT — one data layer[\s\S]*?<\/script>/); assert.ok(m);
  for (const bad of [/fetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /clipboard/, /console\./, /\.value\b/, /innerText/, /sha256hex\((?!\)|"|'bnr\.b\/did-plc\/'\+DEMO\))/])
    assert.doesNotMatch(m[0], bad, 'front script must not use ' + bad + ' (the one sha256hex call hashes a constant, never the box)');
  for (const id of ['plcDoc', 'plcAka', 'npubV', 'nip05']) assert.ok(!m[0].includes(`$('${id}')`) && !m[0].includes(`getElementById('${id}')`), 'never reads #' + id);
});

test('bee: plain rows, one action that only focuses the box, the real ones in the wallet', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-row="npub"]');
  assert.match(await p.textContent('[data-more="npub"]'), /the secret half is never shown here/);
  const wallet = await p.$eval('.et-b-link[href="../wallet.html"]', a => [a.target, getComputedStyle(a).color]);
  assert.equal(wallet[0], '', 'the wallet is the same estate: same tab');
  await p.click('#etBeeGo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'root');
  assert.equal(await p.$eval('.et-b-step[data-step="asked"]', e => e.hidden), false);
  assert.match(await p.textContent('.et-b-step[data-step="asked"]'), /these are not your real addresses/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light both rails and they bind; the pill hands off; a tap never derives', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etArt [data-ring="bind"] .seg >> nth=0');
  assert.match(txt(await p.textContent('#etRaverCard')), /light both rings · they meet here/, 'the note waits for both rails');
  await p.click('#etArt .ring[data-ring="plc"] .seg >> nth=0');
  assert.equal(await p.getAttribute('#etArt .ring[data-ring="plc"]', 'aria-pressed'), 'true');
  await p.click('#etArt .ring[data-ring="npub"] .seg >> nth=0');
  assert.equal(await p.textContent('#etRaverTitle'), 'bound');
  const you = await p.evaluate(() => getComputedStyle(document.body).getPropertyValue('--sk-you').trim());
  assert.equal(await p.$$eval('#etArt .lens .seg', s => s.slice(1).map(x => x.getAttribute('stroke'))).then(a => a.every(c => c === you)), true, 'the stitches light in "you": signed');
  await p.click('#etArt [data-ring="bind"] .seg >> nth=0');
  assert.match(txt(await p.textContent('#etRaverCard')), /the note that binds · 5 fields.*root_fp · plc · npub · ts · sig · free at stake/);
  assert.equal(await p.textContent('#plcDoc'), 'did:plc:<rotation-0-hash-of-root>', 'a gesture derives nothing');
  await p.click('#etRaverGo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'root');
  assert.equal(await p.textContent('#etRaverHint'), 'any word · never your recovery words');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rails: document.querySelectorAll('#etFields tr.rail').length, rows: document.querySelectorAll('#etFields tr:not(.rail)').length,
    steps: document.querySelectorAll('#etPipe li').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    written: document.querySelectorAll('#etFields td.gd').length, links: [...document.querySelectorAll('.et-c a[href^="http"]')].map(a => [a.target, a.rel, /new tab/.test(a.textContent)]) }));
  assert.deepEqual([d.rails, d.rows, d.steps, d.receipt, d.written], [3, 14, 6, 7, 4]);
  assert.match(d.now, /^plc · bzDiD root ATTESTS the plc signing key/);
  assert.ok(d.links.length === 2 && d.links.every(l => l[0] === '_blank' && l[1] === 'noopener noreferrer' && l[2]));
  // verify it yourself: an empty box draws exactly the receipt's shape
  await p.click('form button'); await p.waitForTimeout(300);
  assert.equal(await p.textContent('#plcDoc'), 'did:plc:' + DEMO);
  await p.click('#etCyGo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'root');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
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
