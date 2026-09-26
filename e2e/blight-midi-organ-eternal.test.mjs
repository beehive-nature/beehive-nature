// blight-midi-organ-eternal.test.mjs — the bLighT Organ's three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three carry the SAME facts (the seed, its root key, the deploy, the calldata, the
// state of the chain read); the chain is asked only by a press and a failed read is said plainly in all
// three; and no gesture reads, plays or stops on its own — every one clicks the organ's real control
// (#read, #play, #stop) and the fronts read META and #meta back. The chain is never reached from this
// box: the one "answered" path uses a local fixture for the RPC host, never a fake inside the page.
// Run: node --test e2e/blight-midi-organ-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9134, ORIGIN = `http://127.0.0.1:${PORT}`, PATH = '/surfaces/blight/midi-organ.html';
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === PATH ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// the fixture a getMeta answer looks like: an ABI string (offset 0x20, length, utf-8 JSON)
const TRAITS = { scale: 'dorian', duration: 12, durationMs: 200, barColorTop: '#9c6fd6', barColorBottom: '#171028' };
function abiString(obj) {
  const hex = Buffer.from(JSON.stringify(obj), 'utf8').toString('hex'), n = hex.length / 2;
  return '0x' + (32).toString(16).padStart(64, '0') + n.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(n / 32) * 64, '0');
}

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const calls = [];
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : (calls.push({ url: r.request().url(), body: r.request().postData() }), r.abort('blockedbyclient')));
  if (opts.answer) await ctx.route('https://base-rpc.publicnode.com/**', r => { calls.push({ url: r.request().url(), body: r.request().postData(), answered: true }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: abiString(TRAITS) }) }); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(ORIGIN + PATH, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.deploys.length === 3, null, { timeout: 15000 });
  return { ctx, p, errs, calls };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const state = p => p.evaluate(() => window.__eternal.data.state);

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyRead', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, calls } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(calls.length, 0, reg + ': nothing leaves the page before a press');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, and the same honest failure when the chain does not answer', async () => {
  const facts = {}, press = { bee: '#etBeeGo', raver: null, cypherpunk: '#etCyRead' };
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, calls } = await open(reg);
    const before = await p.evaluate(() => { const D = window.__eternal.data; return { seed: D.seed, key: D.key, addr: D.addr, calldata: D.calldata, state: D.state }; });
    if (press[reg]) await p.click(press[reg]);
    else { await p.$eval('#etHold', b => b.scrollIntoView({ block: 'center' })); const bx = await p.locator('#etHold').boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); }
    await p.waitForFunction(() => window.__eternal.data.state === 'unreachable', null, { timeout: 15000 });
    facts[reg] = { ...before, asked: calls.filter(c => /eth_call/.test(c.body || '')).length, after: await p.evaluate(() => ({
      beeSong: document.querySelector('#eternal [data-et="beeSong"]').textContent, beeNow: document.getElementById('etBeeNow').textContent, beeSeed: document.getElementById('etBeeSeed').value,
      hint: document.getElementById('etRaverHint').textContent, card: document.getElementById('etRaverCard').textContent, rootKey: document.querySelector('#etWheel .k-root text').textContent,
      path: document.querySelector('#eternal [data-et="path"]').textContent, chips: document.getElementById('etChips').textContent, req: document.getElementById('etRequest').textContent,
      pipeFail: [...document.querySelectorAll('#etPipe li.fail b')].map(b => b.textContent),
    })) };
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['seed', 'key', 'addr', 'calldata']) assert.equal(facts[reg][k], a[k], reg + ' ' + k);
  assert.equal(a.seed, 1000); assert.equal(a.key, 'E3', '1000 mod 12 = 4 → E'); assert.equal(a.state, 'idle');
  assert.equal(a.calldata, '0xc3f4552a' + (1000).toString(16).padStart(64, '0') + '0'.repeat(64));
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.ok(facts[reg].asked >= 1, reg + ': the press asked the chain (through the organ\'s own read)');
  const f = reg => facts[reg].after;
  // each register draws the same seed and the same failure its own way
  assert.equal(f('bee').beeSeed, '1000'); assert.match(f('bee').beeSong, /the network did not answer/); assert.match(f('bee').beeNow, /nothing is broken/);
  assert.match(f('raver').hint, /seed 1000 · root E · scale not read/); assert.equal(f('raver').rootKey, 'E'); assert.match(f('raver').card, /the network did not answer/);
  assert.match(f('cypherpunk').path, /getMeta\(1000, 0\)/); assert.match(f('cypherpunk').chips, /read failed/); assert.ok(f('cypherpunk').req.includes(a.addr) && f('cypherpunk').req.includes(a.calldata));
  assert.ok(f('cypherpunk').pipeFail.some(b => /host 2/.test(b)), 'the pipeline marks the host that went quiet');
});

test('bee: ask, then play, then stop — each through the organ\'s own controls, sound only on a press', async () => {
  const { ctx, p, errs, calls } = await open('bee', { answer: true });
  assert.equal(await p.textContent('#etBeeGo'), 'ask for its song');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => window.__eternal.data.state === 'read' && window.__eternal.data.fresh);
  assert.equal(calls.filter(c => c.answered).length, 1, 'one eth_call, to host 1');
  assert.ok(calls[0].body.includes('0xc3f4552a' + (1000).toString(16).padStart(64, '0')), 'the calldata carries the seed');
  assert.equal(await p.evaluate(() => typeof ac === 'undefined' || ac === null), true, 'reading makes no sound');
  assert.match(await p.textContent('#eternal [data-et="beeSong"]'), /dorian · E · 12 notes · 2.4 s/);
  assert.equal(await p.textContent('#etBeeGo'), 'play the song');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => window.__eternal.data.playing && ac && voices.length === 12);
  assert.match(await p.textContent('#etBeeNow'), /playing 12 notes, 2.4 seconds in all/);
  assert.equal(await p.textContent('#etBeeGo'), 'stop the song');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => !window.__eternal.data.playing && voices.length === 0);
  // a new number is a new song: the old traits are never passed off as its song
  await p.fill('#etBeeSeed', '1001'); await p.dispatchEvent('#etBeeSeed', 'change');
  assert.equal(await p.inputValue('#s'), '1001', 'the number lands in the organ\'s own seed field');
  assert.match(await p.textContent('#eternal [data-et="beeSong"]'), /another number/);
  assert.equal(await p.textContent('#etBeeGo'), 'ask for its song');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a short hold asks nothing, a full hold reads, the wheel lights the scale, the heart plays', async () => {
  const { ctx, p, errs, calls } = await open('raver', { answer: true });
  await p.click('#etWheel .et-o-key[data-k="7"]');
  assert.match(await p.textContent('#etRaverCard'), /3 semitones above the root/, 'G sits 3 above the root E');
  assert.match(await p.textContent('#etRaverCard'), /the scale is not read yet/);
  assert.equal(await p.getAttribute('#etWheel .et-o-heart', 'aria-disabled'), 'true', 'no play before the chain names the scale');
  await p.$eval('#etHold', b => b.scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(calls.length, 0, 'a short hold asks nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.state === 'read');
  assert.equal(calls.filter(c => c.answered).length, 1);
  const lit = await p.evaluate(() => ({ inScale: document.querySelectorAll('#etWheel .k-in').length, root: document.querySelectorAll('#etWheel .k-root').length, thread: !!document.getElementById('etThread') }));
  assert.deepEqual(lit, { inScale: 6, root: 1, thread: true }, 'dorian: the root plus six more keys, and the melody thread');
  await p.click('#etWheel .et-o-heart');
  await p.waitForFunction(() => window.__eternal.data.playing && document.getElementById('etThread').classList.contains('run'));
  assert.equal(await p.textContent('#etRaverTitle'), 'it sings');
  await p.click('#etWheel .et-o-heart');
  await p.waitForFunction(() => !window.__eternal.data.playing);
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => document.body.classList.contains('et-still') && getComputedStyle(document.querySelector('#etWheel .et-spin')).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('#etWheel .et-spin')).animationName), 'none', 'still under reduced motion');
  assert.equal(await r.p.$eval('#etMotion', b => b.disabled), true);
  await r.ctx.close();
});

test('cypherpunk: the read is an instrument, complete at first paint, verifiable by hand', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { answer: true });
  const d = await p.evaluate(() => ({
    req: document.querySelectorAll('#etRequest tr').length, derive: document.querySelectorAll('#etDerive tr').length, steps: document.querySelectorAll('#etPipe li').length,
    verify: document.getElementById('etVerify').textContent, calldata: window.__eternal.data.calldata, play: document.getElementById('etCyPlay').disabled,
    links: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel), scan: document.getElementById('etCyScan').href, addr: window.__eternal.data.addr,
  }));
  assert.equal(d.req, 6); assert.equal(d.derive, 7); assert.equal(d.steps, 6);
  assert.ok(d.verify.includes(d.calldata) && d.verify.includes('curl -s https://base-rpc.publicnode.com'), 'the verify step is a command anyone can run');
  assert.equal(d.play, true, 'play waits for the traits');
  assert.deepEqual(d.links, ['noopener noreferrer', 'noopener noreferrer']); assert.equal(d.scan, 'https://basescan.org/address/' + d.addr);
  await p.fill('#etCySeed', '1200'); await p.dispatchEvent('#etCySeed', 'change');
  assert.equal(await p.evaluate(() => window.__eternal.data.key), 'C3', '1200 mod 12 = 0');
  await p.click('#etCyRead');
  await p.waitForFunction(() => window.__eternal.data.state === 'read');
  const r = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#etResponse th')].map(t => t.textContent), walk: [...document.querySelectorAll('#etDerive tr')].find(t => t.firstChild.textContent === 'walk').lastChild.textContent, done: document.querySelectorAll('#etPipe li.done').length }));
  assert.deepEqual(r.rows, Object.keys(TRAITS), 'the response table is the chain\'s own answer, key for key');
  assert.equal(r.walk.split(' ').length, 12);
  assert.ok(r.done >= 4);
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
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('bad value ' + (el.className.baseVal ?? el.className));
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A|INPUT|SELECT|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
