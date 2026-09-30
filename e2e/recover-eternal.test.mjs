// recover-eternal.test.mjs — the offline recovery tool as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 2). Proves at 390 px: exactly one front
// per register, each in its own dress, structure and gesture; all three carry the SAME facts, read
// from the vendored engine's own constants (BZDIDKEY), the context field's markup default and the
// tool's own result state; and THE RECOVERY RULING: no front reads, stores, copies, logs or sends a
// recovery word or a key, and no request leaves the origin. Every "go" only focuses the tool's own
// box (#in); "your keys are back" is drawn only after the tool's own Recover (#go) shows a result.
// Run: node --test e2e/recover-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9170, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// Instruments the page's main world before any script runs: every read of the tool's fields, every
// network API, storage write, clipboard write and console line is recorded.
function spy() {
  const w = window; w.__spy = { reads: { in: 0, ctx: 0, msg: 0 }, net: [], store: [], clip: [], log: [] };
  for (const P of [HTMLTextAreaElement.prototype, HTMLInputElement.prototype]) {
    const d = Object.getOwnPropertyDescriptor(P, 'value');
    Object.defineProperty(P, 'value', { configurable: true, enumerable: d.enumerable,
      get() { if (this.id in w.__spy.reads) w.__spy.reads[this.id]++; return d.get.call(this); },
      set(v) { d.set.call(this, v); } });
  }
  const f = w.fetch; w.fetch = function (u) { w.__spy.net.push('fetch ' + (u && u.url || u)); return f.apply(this, arguments); };
  const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { w.__spy.net.push('xhr ' + u); return o.apply(this, arguments); };
  if (navigator.sendBeacon) { const b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, d) => { w.__spy.net.push('beacon ' + u); return b(u, d); }; }
  const WS = w.WebSocket; w.WebSocket = function (u) { w.__spy.net.push('ws ' + u); return new WS(...arguments); };
  const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { w.__spy.store.push(k + '=' + v); return si.apply(this, arguments); };
  if (navigator.clipboard) { const c = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = t => { w.__spy.clip.push(t); return c(t); }; }
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { const c = console[m]; console[m] = function () { w.__spy.log.push([...arguments].map(String).join(' ')); return c.apply(this, arguments); }; }
}

async function open(reg, { noSkaists = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(spy);
  const outside = [], requests = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); }
    requests.push([r.request().resourceType(), u]);
    if (noSkaists && /skaists\.css/.test(u)) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/recover.html`, { waitUntil: 'load' });
  if (!noSkaists) await p.waitForFunction(() => window.__eternal && window.__eternal.data.words > 0, null, { timeout: 20000 });
  await p.waitForTimeout(700);
  return { ctx, p, errs, outside, requests };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();
async function hold(p, ms) {
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250);
}
const SENTINEL = 'zebra quartz sentinel';

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
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, rings: fr.querySelectorAll('svg.et-r-art .ring').length, table: !!fr.querySelector('table.et-c-tab'), inputs: fr.querySelectorAll('input,textarea,select,[contenteditable]').length };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.rings > 0, reg === 'raver', 'raver is the circle'); assert.equal(d.table, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.equal(d.inputs, 0, reg + ': a front has no field to type a word into');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'no request left the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the engine, never declared twice', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, K = window.BZDIDKEY;
      return {
        model: [D.words, D.hrp, D.version, D.tagLen, D.labelRecord, D.labelFp, D.ctx, D.exports],
        engine: [K.WORDS_DECISION, K.RECOVERY_HRP, K.REC_VERSION, K.CONTEXT_TAG_LEN, K.LABEL_RECORD_KEY, K.LABEL_FINGERPRINT, document.getElementById('ctx').defaultValue, Object.keys(K).length],
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        beeMore: document.querySelector('#etBeeRows').textContent,
        rings: [...document.querySelectorAll('#etArt .ring')].map(g => [g.dataset.ring, g.querySelectorAll('.seg').length, g.getAttribute('aria-label')]),
        inputs: document.querySelector('#etInputs').textContent, pipe: document.querySelector('#etPipe').textContent, receipt: document.querySelector('#etReceipt').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model, a.engine, 'the data layer is the engine\'s own constants');
  assert.deepEqual(facts.raver.model, a.model); assert.deepEqual(facts.cypherpunk.model, a.model);
  const [words, hrp, ver, tag, lrec, lfp, cx] = a.model;
  assert.equal(words, 24); assert.equal(hrp, 'bdidrec'); assert.equal(cx, 'bnr.b');
  // bee: plain rows, the same numbers
  assert.equal(a.bee[0], 'what you need' + words + ' words'); assert.equal(a.bee[2], 'how you will know6 words');
  assert.match(txt(a.beeMore), new RegExp('your ' + words + ' recovery words, in order\\. or a recovery code that starts with ' + hrp + '1'));
  // raver: one segment per word, per context-tag byte, per seed byte, per fingerprint word
  assert.deepEqual(facts.raver.rings.map(r => [r[0], r[1]]), [['words', words], ['ctx', tag], ['key', 32], ['six', 6]]);
  assert.match(facts.raver.rings[0][2], new RegExp(words + ' words · 256 bits \\+ an 8-bit check · held by you, never here'));
  assert.match(facts.raver.rings[1][2], new RegExp('the context · ' + cx.replace('.', '\\.') + '.*' + tag + '-byte tag'));
  // cypherpunk: the inputs, the derivation and the receipt quote the same constants
  const c = facts.cypherpunk;
  assert.match(txt(c.inputs), new RegExp('phrase' + words + ' words · bip-39, 8-bit checkdecodeRecoveryPhrase'));
  assert.match(txt(c.inputs), new RegExp('code' + hrp + '1… · bech32m v' + ver + ', 33 BdecodeRecoveryCode'));
  assert.match(txt(c.inputs), new RegExp('ctx' + cx.replace('.', '\\.') + ' · tag ' + tag + ' BcontextTag'));
  assert.ok(c.pipe.includes('"' + lrec + '" ‖ ctx') && c.pipe.includes('sha256("' + lfp + '" ‖ pk) → 6 words + 8 hex'), 'the pipeline quotes the engine labels');
  assert.match(txt(c.receipt), new RegExp('words' + words + ' · WORDS_DECISION'));
  assert.match(txt(c.receipt), /net\d+ files from this origin · 0 from anywhere else/);
  assert.match(txt(c.receipt), /resultnot yet/); assert.match(txt(c.receipt), /front0 words · 0 keys · 0 requests/);
});

test('THE RULING: no front reads, keeps, copies, logs or sends a word; no request leaves the origin', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, outside, requests } = await open(reg);
    await p.fill('#in', SENTINEL);
    const before = await p.evaluate(() => { const s = window.__spy; s.reads = { in: 0, ctx: 0, msg: 0 }; return { net: s.net.length, store: s.store.length, clip: s.clip.length }; });
    const req0 = requests.length;
    // every gesture of this register's front, end to end
    if (reg === 'bee') {
      for (const r of await p.$$('#etBeeRows .et-b-row')) await r.click();
      await p.click('#etBeeGo'); await p.click('.et-b [data-go="ask"]'); await p.click('#etBeeGo');
    } else if (reg === 'raver') {
      for (const k of ['words', 'ctx', 'key', 'six']) await p.click(`#etArt .ring[data-ring="${k}"] .seg`);
      await p.click('#etArt .you');
      for (const t of [1, 2, 3, 4]) await p.click(`#etTiles button[data-t="${t}"]`);
      await hold(p, 1600);
    } else {
      await p.click('#etCyGo');
    }
    await p.waitForTimeout(300);
    const s = await p.evaluate(() => ({ spy: window.__spy, focus: document.activeElement && document.activeElement.id, front: document.getElementById('eternal').innerHTML, data: JSON.stringify(window.__eternal),
      ls: JSON.stringify(Object.assign({}, localStorage)), ss: JSON.stringify(Object.assign({}, sessionStorage)) }));
    assert.equal(s.focus, 'in', reg + ': the gesture hands off to the tool\'s own box');
    assert.deepEqual(s.spy.reads, { in: 0, ctx: 0, msg: 0 }, reg + ': no field of the tool was read by any gesture');
    assert.equal(s.spy.net.length, before.net, reg + ': no fetch, xhr, beacon or socket');
    assert.equal(s.spy.clip.length, before.clip, reg + ': nothing copied');
    for (const hay of [s.front, s.data, s.ls, s.ss, s.spy.store.join('\n'), s.spy.log.join('\n'), s.spy.clip.join('\n')]) assert.ok(!hay.includes('sentinel'), reg + ': the words were never kept, stored, copied or logged');
    const late = requests.slice(req0).filter(([type]) => type !== 'font' && type !== 'stylesheet');
    assert.deepEqual(late, [], reg + ': a gesture makes no request');
    assert.deepEqual(outside, [], reg + ': no request left the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the source law: the front script calls no engine function and touches no network, storage, clipboard or field value', async () => {
  const html = await readFile(join(ROOT, 'surfaces/recover.html'), 'utf8');
  const m = html.match(/<script>\s*\/\* ETERNAL FRONT — one data layer[\s\S]*?<\/script>/);
  assert.ok(m, 'the front script is marked');
  const src = m[0];
  for (const bad of [/fetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /localStorage/, /sessionStorage/, /indexedDB/, /clipboard/, /console\./, /\.value\b/, /innerText/, /postMessage/, /\bK\.[a-z]\w*\s*\(/, /BZDIDKEY\.\w+\s*\(/])
    assert.doesNotMatch(src, bad, 'front script must not use ' + bad);
  for (const id of ['fp', 'fphex', 'pub', 'sig', 'msg', 'err']) assert.ok(!src.includes(`$('${id}')`), 'the front never touches #' + id);
});

test('bee: plain rows, one action that only focuses the box; "your keys are back" only after the tool shows a result', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-row="leave"]');
  assert.equal(await p.getAttribute('#etBeeRows .et-b-row[data-row="leave"]', 'aria-expanded'), 'true');
  assert.match(await p.textContent('#etBeeRows [data-more="leave"]'), /nothing is saved/);
  await p.click('#etBeeGo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'in');
  assert.equal(await p.$eval('.et-b-step[data-step="asked"]', e => e.hidden), false);
  assert.equal(await p.$eval('.et-b-step[data-step="shown"]', e => e.hidden), true, 'a tap never claims your keys are back');
  assert.equal(await p.$eval('#out', e => e.hidden), true, 'the tool did nothing on its own');
  // the real flow: a test phrase from fixed public bytes, through the tool's own Recover
  const phrase = await p.evaluate(() => BZDIDKEY.encodeRecoveryPhrase(new Uint8Array(32).fill(7)));
  await p.fill('#in', phrase); await p.click('#go'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#out', e => e.hidden), false, 'the tool recovered');
  assert.equal(await p.$eval('.et-b-step[data-step="shown"]', e => e.hidden), false, 'the front follows the tool\'s real result');
  const d = await p.evaluate(() => ({ fp: document.getElementById('fp').textContent, pub: document.getElementById('pub').textContent, front: document.getElementById('eternal').innerHTML, data: JSON.stringify(window.__eternal) }));
  const w = phrase.split(' '), pairs = w.slice(1).map((x, i) => w[i] + ' ' + x);
  for (const hay of [d.front, d.data]) {
    assert.ok(!hay.includes(d.fp) && !hay.includes(d.pub), 'the front never shows the fingerprint or the key');
    assert.ok(pairs.every(pr => !hay.includes(pr)), 'no two words of the phrase appear in the front or its data');
  }
  await p.click('#etBeeSee');
  assert.ok(await p.$eval('#out', e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'show me the six words scrolls to the tool\'s result');
  assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap the rings, light all four, then the hold opens the box; a short hold does nothing', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etArt .ring[data-ring="ctx"] .seg');
  assert.match(txt(await p.textContent('#etRaverCard')), /^r2the context · bnr\.ban 8-byte tag · same words, other keys per context$/);
  await p.click('#etArt .you');
  assert.equal(await p.$eval('#etHold', b => b.disabled), true, 'no hold before the four');
  for (const t of [1, 2, 3]) await p.click(`#etTiles button[data-t="${t}"]`);
  assert.match(await p.textContent('#etSealHint'), /3 of 4 lit/);
  await p.click('#etTiles button[data-t="4"]');
  await hold(p, 400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'seal', 'a short hold does not open');
  assert.notEqual(await p.evaluate(() => document.activeElement.id), 'in');
  await hold(p, 1600);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'open');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'in', 'the full hold hands off to the box');
  assert.equal(await p.$eval('.et-r-kept', e => e.hidden), true, '"rebuilt" is never claimed by a gesture');
  const phrase = await p.evaluate(() => BZDIDKEY.encodeRecoveryPhrase(new Uint8Array(32).fill(7)));
  await p.fill('#in', phrase); await p.click('#go'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'rebuilt', 'the art turns only on the tool\'s real result');
  assert.equal(await p.$eval('.et-r-kept', e => e.hidden), false);
  assert.equal(await p.$$eval('#etArt .ring[data-ring="words"] .seg', s => s.every(x => x.getAttribute('fill') === 'none')), true, 'the words ring stays hollow: never here');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ inputs: document.querySelectorAll('#etInputs tr').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    path: document.querySelector('#eternal .et-c-path').textContent,
    links: [...document.querySelectorAll('.et-c a[href^="http"]')].map(a => [a.target, a.rel, /new tab/.test(a.textContent)]) }));
  assert.deepEqual([d.inputs, d.steps, d.receipt], [3, 6, 8]);
  assert.equal(d.now, 'input · #in', 'the pipeline points at the first step not yet done');
  assert.equal(txt(d.path), 'bzDiD://recover/bnr.b · offline');
  assert.ok(d.links.length === 2 && d.links.every(l => l[0] === '_blank' && l[1] === 'noopener noreferrer' && l[2]), 'outside links open a new tab and say so');
  await p.click('#etCyGo');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'in');
  const phrase = await p.evaluate(() => BZDIDKEY.encodeRecoveryPhrase(new Uint8Array(32).fill(7)));
  await p.fill('#in', phrase); await p.click('#go'); await p.waitForTimeout(400);
  assert.equal(await p.textContent('#etPipe li.now b'), 'prove · sign + verifyRecordSig', 'the pipeline follows the tool\'s real result');
  assert.match(txt(await p.textContent('#etReceipt')), /resultshown below/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('saved alone (no design system beside it), the fronts step aside and the tool still recovers', async () => {
  const { ctx, p, errs } = await open('bee', { noSkaists: true });
  assert.equal(await p.evaluate(() => [document.documentElement.classList.contains('et-off'), getComputedStyle(document.getElementById('eternal')).display, !!window.__eternal]).then(x => x.join()), 'true,none,false');
  const phrase = await p.evaluate(() => BZDIDKEY.encodeRecoveryPhrase(new Uint8Array(32).fill(7)));
  await p.fill('#in', phrase); await p.click('#go'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#out', e => e.hidden), false);
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
