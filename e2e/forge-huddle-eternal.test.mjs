// forge-huddle-eternal.test.mjs — the huddle as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress and structure; all three carry the SAME facts, read from the page's own join form, error line,
// stage, peer chips and byte counters; every front hands off to the page's own form and its own
// #connect (a short hold does nothing); a failed join is shown as the page's own words, never as
// "joined"; and the pass (the join token) goes only into the page's own field and on to the venue:
// never into the address, storage, a cookie or the receipt. This box refuses jsDelivr, so the REAL
// failure renders; the JOINED state is proved with a named fixture that stands in for the venue and
// the two CDN modules (a fake livekit Room with one remote hand, a minimal Y). Run:
// node --test e2e/forge-huddle-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9156, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const LIVEKIT = 'https://cdn.jsdelivr.net/npm/livekit-client@2.13.5/+esm', YJS = 'https://cdn.jsdelivr.net/npm/yjs@13.6.20/+esm';
const VENUE = 'wss://venue.example.org', TOKEN = 'dev-pass-7f3a9c';
// FIXTURE (named): a fake venue with one remote hand, and a minimal Y — enough for the page's own join() to succeed
const FAKE_LIVEKIT = `export const RoomEvent={DataReceived:'dr',ParticipantConnected:'pc',ParticipantDisconnected:'pd'};
export class Room{constructor(){this.h={};this.remoteParticipants=new Map([['p1',{identity:'agent-bee'}]]);this.localParticipant={publishData:()=>Promise.resolve()};}
async connect(url,token,o){window.__fixtureVenue={url,token,room:o&&o.roomName};}on(e,f){(this.h[e]=this.h[e]||[]).push(f);return this;}}`;
const FAKE_Y = `export class Doc{constructor(){this.m=new Map();this.l=[];}getMap(){const d=this;return {set(k,v){d.m.set(k,v);d.l.forEach(f=>f(new Uint8Array([1]),undefined));},get(k){return d.m.get(k);},keys(){return d.m.keys();}};}on(e,f){this.l.push(f);}destroy(){}}
export function encodeStateAsUpdate(){return new Uint8Array([1]);}export function applyUpdate(){}`;

async function open(reg, { fixture = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    outside.push(u);
    if (fixture && (u === LIVEKIT || u === YJS)) return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: u === LIVEKIT ? FAKE_LIVEKIT : FAKE_Y });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/forge/huddle.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, outside };
}
const FIELDS = { bee: ['#etHdBeeUrl', '#etHdBeeTok'], raver: ['#etHdRvUrl', '#etHdRvTok'], cypherpunk: ['#etHdCyUrl', '#etHdCyTok'] };
async function bring(p, reg) { await p.fill(FIELDS[reg][0], VENUE); await p.fill(FIELDS[reg][1], TOKEN); await p.waitForTimeout(100); }
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const text = (p, s) => p.evaluate(s => { const e = document.querySelector(s); return (e.getBoundingClientRect().height ? e.innerText : e.textContent).replace(/\s+/g, ' ').trim(); }, s);

test('one front per register, each in its own dress and structure', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etHdBeeJoin', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHdHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etHdCyJoin', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    assert.equal(await p.$eval(w.act, b => b.disabled), true, reg + ': nothing to press before a venue and a pass');
    await bring(p, reg);
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const vis = s => { const e = fr.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor, on: !document.querySelector(act).disabled,
        wide: document.documentElement.scrollWidth, vw: innerWidth, form: vis('.et-b-form .et-b-field input'), orbit: vis('#etHdOrbit') && vis('#etHdHold'), bench: vis('table.et-c-params') && fr.querySelectorAll('#etHdPipe li').length === 6 };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.ok(d.on, reg + ': a venue and a pass enable it'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.form, reg === 'bee'); assert.equal(d.orbit, reg === 'raver'); assert.equal(d.bench, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'nothing leaves the origin until someone joins');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the page\'s own form', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await bring(p, reg);
    facts[reg] = await p.evaluate(() => { const D = window.__eternal.data; return [D.state, D.url, D.token, D.tokenLen, D.room, document.getElementById('vUrl').value, document.getElementById('vTok').value]; });
    facts[reg + 'Dom'] = reg === 'bee' ? await text(p, '.et-b-rows') : reg === 'raver' ? await text(p, '#etHdLegend') : await text(p, '#etHdReceipt');
    await ctx.close();
  }
  const want = ['idle', VENUE, true, TOKEN.length, 'forge', VENUE, TOKEN];
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.deepEqual(facts[reg], want, reg + ' wrote into the page\'s own form and reads it back');
  assert.equal(facts.beeDom, 'the room “forge” people here not joined yet');
  assert.equal(facts.raverDom, 'venue wss://venue.example.org pass held here room forge');
  assert.match(facts.cypherpunkDom, new RegExp('state not joined venue wss://venue.example.org · wss · encrypted token present · ' + TOKEN.length + ' chars · not repeated here'));
  assert.ok(!facts.cypherpunkDom.includes(TOKEN), 'the receipt never repeats the pass');
});

test('a real failure is the page\'s own words, never "joined"', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await bring(p, 'bee');
  await p.click('#etHdBeeJoin');
  await p.waitForFunction(() => window.__eternal.data.state === 'failed', null, { timeout: 10000 });
  const err = await p.textContent('#err');
  assert.match(err, /^LiveKit SDK failed to load \(CDN\)/, 'the page\'s own join ran and failed at the CDN');
  assert.deepEqual(outside, [LIVEKIT], 'the only request is the page\'s own pinned SDK');
  assert.equal(await text(p, '#etHdBeeSaid'), 'could not join. the part that talks to venues could not load in this browser. it comes from a public library online: check the connection and try again. what the page heard: ' + err.replace(/\s+/g, ' ').trim(), 'plain words first, then the page\'s own');
  assert.equal(await p.textContent('#etHdBeePeople'), 'not joined yet');
  assert.equal(await p.evaluate(() => document.getElementById('stage-wrap').classList.contains('hidden')), true);
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#etHdPipe li')].map(l => l.className)), ['done', 'fail', 'todo', 'todo', 'todo', 'todo']);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a short hold does nothing; the full hold presses the page\'s own join (fixture venue)', async () => {
  const { ctx, p, errs, outside } = await open('raver', { fixture: true });
  await bring(p, 'raver');
  await p.locator('#etHdHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHdHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(450); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__eternal.data.state), 'idle', 'a short hold is not a knock');
  assert.deepEqual(outside, [], 'nothing was asked of the network');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.state === 'joined', null, { timeout: 10000 });
  assert.deepEqual(await p.evaluate(() => window.__fixtureVenue), { url: VENUE, token: TOKEN, room: 'forge' }, 'the venue got exactly what was typed, through the page\'s own join');
  assert.equal(await p.textContent('#etHdHint'), '1 other hand on the ring');
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etHdOrbit .hand').length), 1);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the joined pipeline and receipt; the pass never reaches the address, storage or a cookie', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { fixture: true });
  await bring(p, 'cypherpunk');
  await p.click('#etHdCyJoin');
  await p.waitForFunction(() => window.__eternal.data.state === 'joined', null, { timeout: 10000 });
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ pipe: [...document.querySelectorAll('#etHdPipe li')].map(l => l.className), receipt: document.getElementById('etHdReceipt').innerText.replace(/\s+/g, ' '),
    href: location.href, ls: JSON.stringify(Object.assign({}, localStorage)), ss: JSON.stringify(Object.assign({}, sessionStorage)), cookie: document.cookie, sent: window.__hk.sent, btn: document.getElementById('etHdCyJoin').textContent }));
  assert.deepEqual(d.pipe, ['done', 'done', 'done', 'done', 'done', 'done']);
  assert.match(d.receipt, /state joined/); assert.match(d.receipt, /peers agent-bee/); assert.match(d.receipt, new RegExp('bytes sent ' + d.sent + ' · received 0'));
  assert.ok(d.sent >= 1, 'the page\'s own counter moved');
  for (const where of [d.receipt, d.href, d.ls, d.ss, d.cookie]) assert.ok(!where.includes(TOKEN), 'the pass is not repeated: ' + where.slice(0, 60));
  assert.equal(d.btn, 'connected · the stage is open below');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash, NaN or undefined for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined|null|\[object/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
