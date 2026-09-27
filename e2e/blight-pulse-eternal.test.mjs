// blight-pulse-eternal.test.mjs — the pulse (bX pointers heard on a public nostr relay) as three products
// in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front
// per register, each in its own dress; three different products (bee: plain rows and one button; raver:
// a listening dish of relay rings and kind rays, held to tune in; cypherpunk: the relay table, the
// numbered pipeline, the grammar, the receipt); the SAME facts in all three (relay.js's own relay list
// and the one connect() opens, pointers.js's own kinds, the page's listen state); NOTHING opens a socket
// or asks a service on arrival; every listen gesture clicks the page's own #listen; an unreachable relay
// is said as unreachable in all three (never "listening", never a heard count it did not hear); a pointer
// is shown as heard only once it is in the feed; and the laws (no dash, no caps, 44 px, no sideways page).
// The relay is a scripted stand-in in every test (the box has no network, CI has one): "fail" answers
// with an error, "answer" opens and sends one [bX song] pointer.
// Run: node --test e2e/blight-pulse-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/pulse.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/pulse.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9223, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// the relay source, read by the test itself: the facts every front must carry
const RELAY_SRC = await readFile(join(ROOT, 'surfaces/blight/relay.js'), 'utf8');
const RELAYS = RELAY_SRC.match(/wss:\/\/[\w.-]+/g);
const USED = RELAYS[+RELAY_SRC.match(/new WebSocket\(RELAYS\[(\d+)\]\)/)[1]].replace('wss://', '');

// a scripted relay: counts every socket the page opens; "fail" errors, "answer" opens and sends one pointer
function relay(mode) {
  window.__et = { ws: [], sent: [] };
  window.WebSocket = class {
    constructor(u) { window.__et.ws.push(u); const me = this;
      setTimeout(() => {
        if (mode === 'fail') { me.onerror && me.onerror({}); me.onclose && me.onclose({}); return; }
        me.onopen && me.onopen({});
        setTimeout(() => me.onmessage && me.onmessage({ data: JSON.stringify(['EVENT', 'bx', { id: 'ab'.repeat(32), created_at: 1790000000,
          content: '[bX song] seed 4242 — https://example.test/surfaces/blight/midi-organ.html?seed=4242 — from: bind: https://example.test/keys' }]) }), 60);
      }, 60);
    }
    send(m) { window.__et.sent.push(m); }
    close() {}
  };
}
async function open(reg, mode = 'fail') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(relay, mode);
  const ext = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); ext.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.src === 'read' && window.__eternal.data.kinds.length, null, { timeout: 8000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, ext };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const facts = {};

test('per register: its own front and dress, silence on arrival, and the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, ext } = await open(reg);
    const d = await p.evaluate(f => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-pu-heart,.et-c-primary');
      if (document.documentElement.scrollWidth > 390 || innerWidth > 390) bad.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > 390.5) bad.push('edge ' + el.tagName + '.' + el.className + ' ' + Math.round(r.right));
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('junk ' + el.className + ' ' + own);
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      const D = window.__eternal.data;
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        listened: document.getElementById('listen').disabled, ws: window.__et.ws.length,
        data: { relays: D.relays, used: D.used, kinds: D.kinds.map(k => k.kind), state: D.state, heard: D.heard.length },
        text: { bee: document.querySelector('#eternal>.et-b').textContent, raver: document.querySelector('#eternal>.et-r').textContent, cy: document.querySelector('#eternal>.et-c').textContent },
        counts: { beeRows: document.querySelectorAll('#etPuBeeRows .et-b-row').length, rays: document.querySelectorAll('#etPuDish .et-ray').length,
          rings: document.querySelectorAll('#etPuDish > circle[r]').length, relayRows: document.querySelectorAll('#etPuRelays tr').length,
          pipe: document.querySelectorAll('#etPuPipe li').length, grammar: document.querySelectorAll('#etPuGrammar tr').length } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    // silence on arrival: no socket, no request off the origin, the page's own control untouched
    assert.equal(d.ws, 0, reg + ': no socket on arrival'); assert.deepEqual(ext, [], reg + ': nothing leaves the origin on arrival');
    assert.equal(d.listened, false); assert.equal(d.data.state, 'idle');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same facts: relay.js\'s relays, the one it opens, the grammar', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.deepEqual(a.data.relays, RELAYS, 'the relay list is relay.js\'s own');
  assert.equal(a.data.relays[a.data.used].replace('wss://', ''), USED);
  assert.deepEqual(a.data.kinds, ['room', 'order', 'kandi', 'song', 'score', 'accord', 'review', 'guard'], 'pointers.js\'s own kinds');
  // the same relay and the same idle state, in each register's own words
  assert.match(a.text.bee, new RegExp(USED.replace(/\./g, '\\.'))); assert.match(a.text.bee, /not listening yet/);
  assert.match(a.text.raver, new RegExp(USED.replace(/\./g, '\\.'))); assert.match(a.text.raver, /not listening yet/);
  assert.match(a.text.cy, new RegExp('wss://' + USED.replace(/\./g, '\\.'))); assert.match(a.text.cy, /idle · nothing sent/);
  // three structures, not one column recoloured
  const c = a.counts;
  assert.equal(c.beeRows, 4, 'new bee: four plain rows');
  assert.equal(c.rays, 8, 'raver: one ray per kind'); assert.equal(c.rings, RELAYS.length + 2, 'raver: one ring per relay (+ the hold track and its progress)');
  assert.equal(c.relayRows, RELAYS.length); assert.equal(c.pipe, 5); assert.equal(c.grammar, 8, 'cypherpunk: relay table, numbered pipeline, grammar');
});

test('an unreachable relay: the bee button hands off, and all three say no answer', async () => {
  const { ctx, p, errs } = await open('bee', 'fail');
  await p.click('#etPuBeeGo');
  await p.waitForFunction(() => window.__eternal.data.state === 'failed', null, { timeout: 5000 });
  await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ ws: window.__et.ws, listened: document.getElementById('listen').disabled, state: document.getElementById('state').textContent,
    bee: document.getElementById('etPuBeeRows').textContent, go: document.getElementById('etPuBeeGo').textContent, heart: document.getElementById('etPuHeart').textContent,
    card: document.getElementById('etPuCard').textContent, rcpt: document.getElementById('etPuReceipt').textContent, heard: document.getElementById('etPuHeardTab').textContent,
    front: document.getElementById('eternal').textContent }));
  assert.equal(d.ws.length, 1, 'one socket, opened by the page\'s own connect()'); assert.equal(d.ws[0].replace('wss://', '').replace(/\/$/, ''), USED);
  assert.equal(d.listened, true, 'the page\'s own #listen ran'); assert.equal(d.state, 'relay closed');
  assert.match(d.bee, /the relay did not answer here/); assert.match(d.go, /no answer here/);
  assert.match(d.heart, /quiet\s*0 heard/); assert.match(d.card, /the relay did not answer here/);
  assert.match(d.rcpt, /no answer/); assert.match(d.heard, /no answer · 0 heard/);
  assert.doesNotMatch(d.front, /listening now|1 heard/, 'never a state the relay did not give');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a short hold does nothing; a full hold tunes in; the heard pointer shows in all three', async () => {
  const { ctx, p, errs } = await open('raver', 'answer');
  await p.locator('#etPuHeart').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etPuHeart').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__et.ws.length), 0, 'a short hold opens nothing');
  assert.equal(await p.$eval('#listen', b => b.disabled), false);
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.heard.length === 1, null, { timeout: 5000 });
  await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ ws: window.__et.ws.length, sent: window.__et.sent, D: window.__eternal.data,
    feed: document.querySelectorAll('#feed .note').length, bee: document.getElementById('etPuBeeHeard').textContent, beeRows: document.getElementById('etPuBeeRows').textContent,
    heart: document.getElementById('etPuHeart').textContent, chip: document.querySelector('#etPuKinds .et-r-chip[data-k="song"]').textContent,
    cy: document.getElementById('etPuHeardTab').textContent, rcpt: document.getElementById('etPuReceipt').textContent }));
  assert.equal(d.ws, 1); assert.match(d.sent[0], /^\["REQ","bx_\d+",\{"kinds":\[1\],"limit":20\}\]$/, 'the page\'s own REQ');
  assert.equal(d.feed, 2, 'the page\'s own feed: the about note + one pointer');
  assert.equal(d.D.state, 'open'); assert.equal(d.D.heard[0].kind, 'song'); assert.equal(d.D.heard[0].label, 'seed 4242');
  assert.match(d.bee, /seed 4242/); assert.match(d.beeRows, /listening now/); assert.match(d.beeRows, /links heard\s*1/);
  assert.match(d.heart, /on\s*1 heard/); assert.match(d.chip, /song · 1/);
  assert.match(d.cy, /relay · song\s*seed 4242/); assert.match(d.rcpt, /open/);
  await p.click('#etPuKinds .et-r-chip[data-k="song"]');
  assert.match(await p.textContent('#etPuCard'), /song · 1 heard\s*seed 4242/, 'the lit ray shows what it heard');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the teal action opens the page\'s own socket, then says it allows one listen per load', async () => {
  const { ctx, p, errs } = await open('cypherpunk', 'answer');
  await p.click('#etPuCyGo');
  await p.waitForFunction(() => window.__eternal.data.state === 'open', null, { timeout: 5000 });
  const d = await p.evaluate(() => ({ ws: window.__et.ws.length, go: document.getElementById('etPuCyGo'), pipe: [...document.querySelectorAll('#etPuPipe li')].map(l => l.className) }));
  assert.equal(d.ws, 1); assert.equal(await p.$eval('#listen', b => b.disabled), true);
  assert.equal(await p.$eval('#etPuCyGo', b => b.disabled), true); assert.match(await p.textContent('#etPuCyGo'), /one listen per load/);
  assert.equal(d.pipe[0], 'et-done'); assert.equal(d.pipe[1], 'et-done', 'REQ sent on open');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
