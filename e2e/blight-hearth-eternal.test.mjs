// blight-hearth-eternal.test.mjs — the hearth (a prompt window that routes plain words to the estate's own
// makers) as three products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at
// 390 px: exactly one front per register, each in its own dress; three different products (bee: four plain
// rows and one button; raver: the twelve-note wheel, a scale you light and an ember you hold; cypherpunk:
// a live route(q) classifier, the seed table, the pipeline, the receipt); the SAME facts in all three
// (the page's own route() on its own four seed asks, its SCALES); NOTHING is asked, read from the chain or
// played on arrival; every gesture goes through the page's own seed buttons or #q + #send; a picture is
// said to be drawn only when the chain's reply carries one (blocked here: all three say so; a stubbed
// answer flips them); the melody drawn on the wheel is the one respond() composed from its own seed; and
// the laws (no dash for a value, no forced capitals, 44 px actions, no sideways page).
// Run: node --test e2e/blight-hearth-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/hearth.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/hearth.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9224, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// a chain answer for the art route: one abi-encoded svg string, as getSvg returns it
const W = v => BigInt(v).toString(16).padStart(64, '0');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#86cc72"/></svg>';
const ABI = '0x' + W(0x20) + W(SVG.length) + Buffer.from(SVG).toString('hex').padEnd(Math.ceil(SVG.length / 32) * 64, '0');

async function open(reg, { chain = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(() => { window.__et = { ac: 0 }; const A = window.AudioContext; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__et.ac++; } }; });
  const ext = [];
  await ctx.route('**/*', r => {
    const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue();
    ext.push(u);
    if (chain && r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ jsonrpc: '2.0', id: 0, result: ABI }]) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.seeds.length, null, { timeout: 8000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 8000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, ext };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const facts = {};
const reply = p => p.waitForFunction(() => { const D = window.__eternal.data; return D.ex.length && D.ex[D.ex.length - 1].reply; }, null, { timeout: 8000 });

test('per register: its own front and dress, silence on arrival, and the laws', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, ext } = await open(reg);
    if (reg === 'cypherpunk') await p.fill('#etHtQ', 'play me a blues song');   // the action lights once there are words
    const d = await p.evaluate(f => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-ht-ember,.et-c-primary');
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
        chat: document.querySelectorAll('#chat > *').length, ac: window.__et.ac,
        data: { seeds: D.seeds.map(s => [s.q, s.kind, s.what, s.scale]), scales: D.scales.map(s => s.name) },
        page: { seeds: [...document.querySelectorAll('#seeds button')].map(b => [b.dataset.q, route(b.dataset.q).kind]), scales: Object.keys(SCALES), fix: route('play me a song in harmonic major').scale },
        counts: { beeRows: document.querySelectorAll('#etHtBeeRows .et-b-row').length, routes: document.querySelectorAll('#etHtRoutes .et-r-chip').length,
          scales: document.querySelectorAll('#etHtScales .et-r-chip').length, notes: document.querySelectorAll('#etHtWheel g > circle').length,
          seedRows: document.querySelectorAll('#etHtSeedTab tr').length, scaleRows: document.querySelectorAll('#etHtScaleTab tr').length, pipe: document.querySelectorAll('#etHtPipe li').length },
        text: { bee: document.getElementById('etHtBeeRows').textContent, raver: document.getElementById('etHtRoutes').textContent + document.getElementById('etHtCard').textContent, cy: document.getElementById('etHtSeedTab').textContent } };
    }, FRONT[reg]);
    assert.deepEqual(d.shown, [FRONT[reg]], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(ext, [], reg + ': nothing leaves the origin on arrival'); assert.equal(d.ac, 0, reg + ': no sound on arrival'); assert.equal(d.chat, 0, reg + ': nothing asked on arrival');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
});

test('three different products, the same facts: the page\'s own route() on its own seeds, its SCALES', () => {
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' data layer');
  assert.deepEqual(a.data.seeds.map(s => [s[0], s[1]]), a.page.seeds, 'the seeds are the page\'s own, routed by its own route()');
  assert.deepEqual(a.data.seeds.map(s => s[2]), ['grow', 'song', 'crown', 'deal']);
  assert.deepEqual(a.data.scales, a.page.scales);
  assert.equal(a.page.fix, 'harmonic major', 'the harmonic-major seed ask plays harmonic major (the longest scale named wins)');
  assert.match(a.text.bee, /a mushroom.*a short melody.*the founder’s crown.*an offer note/);
  assert.match(a.text.raver, /grow.*play.*crown.*deal/); assert.match(a.text.raver, /play me a song in harmonic major/, 'raver: the words it will send');
  assert.match(a.text.cy, /grow me a mushroom.*art · grow.*seed random.*play me a song in harmonic major.*song.*show me the crown of the vault.*art · crown.*seed 2140426.*deal/);
  const c = a.counts;
  assert.equal(c.beeRows, 4, 'new bee: four plain rows');
  assert.equal(c.routes, 4); assert.equal(c.scales, 6); assert.equal(c.notes, 12, 'raver: four makers, six scales, the twelve-note wheel');
  assert.equal(c.seedRows, 4); assert.equal(c.scaleRows, 6); assert.equal(c.pipe, 5, 'cypherpunk: seed table, scale table, numbered pipeline');
});

test('bee: the button asks through the page\'s own seed; the chain does not answer here, and all three say so', async () => {
  const { ctx, p, errs, ext } = await open('bee');
  await p.click('#etHtBeeRows [data-pick="0"]');
  assert.equal(await p.$eval('#etHtBeeRows [data-pick="0"]', b => b.getAttribute('aria-pressed')), 'true');
  await p.click('#etHtBeeGo');
  await reply(p); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ user: document.querySelector('#chat .msg.user').textContent, art: !!document.querySelector('#chat .art svg'),
    bee: document.getElementById('etHtBeeAnswer').textContent, cls: document.getElementById('etHtBeeAnswer').className,
    rcpt: document.getElementById('etHtReceipt').textContent, pipe: document.getElementById('etHtPipe').textContent, front: document.getElementById('eternal').textContent }));
  assert.equal(d.user, 'grow me a mushroom', 'the page\'s own seed ask'); assert.equal(d.art, false);
  assert.ok(ext.some(u => /publicnode|drpc/.test(u)), 'the page\'s own chain read was attempted');
  assert.match(d.bee, /FUNGI seed [\d,]+ · level \d · the chain did not answer here, so no picture/); assert.match(d.cls, /et-no/);
  assert.match(d.rcpt, /the chain did not answer here/); assert.match(d.pipe, /no answer from/);
  assert.doesNotMatch(d.front, /drawn from the chain/, 'never a picture the chain did not send');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee, chain answering (stubbed): the picture arrives and all three say drawn', async () => {
  const { ctx, p, errs } = await open('bee', { chain: true });
  await p.click('#etHtBeeRows [data-pick="2"]'); await p.click('#etHtBeeGo');
  await reply(p); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => !!document.querySelector('#chat .art svg')), true);
  for (const id of ['etHtBeeAnswer', 'etHtReceipt']) assert.match(await p.textContent('#' + id), /FUNGI seed 2,140,426 · level 5 · drawn from the chain/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light a scale, a short hold sends nothing, a full hold asks; the wheel draws the melody respond() played', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etHtScales [data-scale="blues"]');
  assert.match(await p.textContent('#etHtCard'), /play me a song in blues/);
  await p.locator('#etHtHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHtHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#chat > *').length), 0, 'a short hold asks nothing');
  await p.mouse.down(); await p.waitForTimeout(1300); await p.mouse.up();
  await reply(p); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ user: document.querySelector('#chat .msg.user').textContent, link: document.querySelector('#chat .msg.ai .link').textContent, ac: window.__et.ac,
    pts: document.querySelector('#etHtWheel polyline').getAttribute('points').split(' ').length, card: document.getElementById('etHtCard').textContent, steps: SCALES.blues }));
  assert.equal(d.user, 'play me a song in blues'); assert.equal(d.ac, 1, 'the page\'s own respond() made the sound');
  const seed = +d.link.match(/^seed (\d+) in blues/)[1];
  assert.equal(d.pts, 8, 'eight notes on the wheel');
  const want = [...Array(8)].map((_, i) => ((seed % 12) + d.steps[(seed >> i) % d.steps.length]) % 12);
  // read the drawn melody back off the wheel: each point's angle is its pitch class (12 o'clock = c)
  const drawn = await p.evaluate(() => document.querySelector('#etHtWheel polyline').getAttribute('points').split(' ').map(xy => { const [x, y] = xy.split(',').map(Number); return ((Math.round((Math.atan2(y, x) * 180 / Math.PI + 90) / 30) % 12) + 12) % 12; }));
  assert.deepEqual(drawn, want, 'the melody on the wheel is respond()\'s own: root = seed mod 12, note i = SCALES[scale][(seed >> i) mod n]');
  assert.match(d.card, new RegExp('8 notes in blues, composed from seed ' + seed));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: route(q) classifies locally and sends nothing; the teal action sends through #q + #send', async () => {
  const { ctx, p, errs, ext } = await open('cypherpunk');
  assert.equal(await p.$eval('#etHtCyGo', b => b.disabled), true, 'no words, no action');
  await p.fill('#etHtQ', 'help me make a deal on a FUNGI');
  const cls = await p.textContent('#etHtClass');
  assert.match(cls, /route\s*deal/); assert.match(cls, /network\s*none · this browser only/);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#chat > *').length), 0); assert.deepEqual(ext, [], 'classifying sends nothing');
  await p.click('#etHtCyGo');
  await reply(p); await p.waitForTimeout(200);
  assert.equal(await p.textContent('#chat .msg.user'), 'help me make a deal on a FUNGI');
  assert.match(await p.textContent('#etHtReceipt'), /an offer note to copy: \[bX room\] FUNGI seed 2140426/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
