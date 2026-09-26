// bview-eternal.test.mjs — bViEw as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress
// (ground, title face, action colour); ONE real action (the engine's own form, carried into the front
// that is showing, the address written once); the SAME facts in all three, read from
// window.__eternal.data and from each front's DOM; honest gestures (the ring and the rows read, they
// never fetch or claim); and the laws (no dash, no forced capitals, 44 px actions, no sideways page).
// The door is MOCKED; the real relay is touched zero times. Run: node --test e2e/bview-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8934, ORIGIN = `http://127.0.0.1:${PORT}`;
const DOOR = 'https://relay.skaists.dev/ant/v1/data/public/';
// VP9 + Opus: this Chromium has no H.264, and the file must really play for the state to read "done".
const MP4 = await readFile(join(ROOT, 'fixtures', 'bview', 'vp9-opus-10s-faststart.mp4'));
const A1 = 'ab'.repeat(32);
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const door = [], stray = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (u.startsWith(DOOR)) {
      door.push(u);
      if (u.endsWith('/stream')) return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': ORIGIN, 'content-type': 'application/octet-stream', 'content-length': String(MP4.length) }, body: MP4 });
      return r.abort('connectionrefused');
    }
    stray.push(u); return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.live, null, { timeout: 15000 });
  return { ctx, p, errs, door, stray };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress, and the one real action inside it', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', radius: '16px' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', radius: '999px' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', radius: '6px' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = document.querySelector('#f button[type=submit]');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, radius: getComputedStyle(act).borderTopLeftRadius,
        inFront: fr.contains(document.getElementById('f')) && fr.contains(document.getElementById('out')), forms: document.querySelectorAll('form').length, fields: document.querySelectorAll('input:not([type=checkbox])').length,
        submits: document.querySelectorAll('button[type=submit]').length, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, FRONT[reg]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour'); assert.equal(d.radius, w.radius, reg + ' action corner (a skaists radius)');
    assert.ok(d.inFront, reg + ': the field, its button and the stage sit in the front that is showing');
    assert.deepEqual([d.forms, d.fields, d.submits], [1, 1, 1], reg + ': one field, one action — never a second address box');
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the door, the state, what has arrived — from the one data layer', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, stray } = await open(reg);
    const idle = await p.evaluate(() => window.__eternal.data.view.state);
    assert.equal(idle, 'idle', reg + ': nothing claimed before an address');
    await p.fill('#addr', 'autonomi://' + 'ab'.repeat(32));
    await p.click('#f button[type=submit]');
    await p.waitForFunction(() => window.__eternal.data.live.doneMs != null, null, { timeout: 30000 });
    await p.waitForTimeout(300);
    facts[reg] = await p.evaluate(f => {
      const D = window.__eternal.data, fr = document.querySelector('#eternal>' + f), txt = document.body.innerText;
      return {
        view: { arrived: D.view.arrived, state: D.view.state, network: D.door.network, host: D.door.host },
        arrived: [...fr.querySelectorAll('[data-et="arrived"]')].map(e => e.textContent),
        network: [...fr.querySelectorAll('[data-et="network"]')].map(e => e.textContent),
        state: [...fr.querySelectorAll('[data-et="state"]')].map(e => e.getAttribute('data-state')),
        hex: (txt.match(/(ab){32}/g) || []).length, schemes: (txt.match(/autonomi:\/\//g) || []).length,
        size: D.live.bytes,
      };
    }, FRONT[reg]);
    assert.deepEqual(stray, []); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  const a = facts.bee.view;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].view, a, reg + ': the same data layer');
  assert.equal(facts.bee.size, MP4.length, 'every byte of the file arrived');
  const whole = (MP4.length / 1048576).toFixed(1) + ' MB';
  assert.equal(a.arrived, `${whole} of ${whole}`); assert.equal(a.state, 'done'); assert.equal(a.host, 'relay.skaists.dev');
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const f = facts[reg];
    assert.ok(f.arrived.length >= 1 && f.arrived.every(x => x === a.arrived), reg + ' draws what arrived: ' + f.arrived.join(' | '));
    assert.ok(f.network.length >= 1 && f.network.every(x => x.includes('Autonomi')), reg + ' names the network');
    assert.ok(f.state.length >= 1 && f.state.every(x => x === 'done'), reg + ' state');
    assert.equal(f.hex, 0, reg + ': the address is never echoed in the text (it stays in the field)');
    assert.equal(f.schemes, 0, reg + ': no "autonomi://" in the text');
  }
});

test('honest gestures: rows, ring and tiles read the data; they never fetch, play or claim', async () => {
  const { ctx: c1, p: b1, door: d1 } = await open('bee');
  await b1.click('.et-b-row[data-row="when"]');
  assert.equal(await b1.$eval('.et-b-say[data-say="when"]', e => e.hidden), false, 'a row opens to its plain sentence');
  assert.match(await b1.textContent('.et-b-row[data-row="when"]'), /by itself/);
  await b1.click('#f button[type=submit]'); await b1.waitForTimeout(300);
  assert.deepEqual(d1, [], 'watch with an empty field asks the door nothing');
  await b1.fill('#addr', 'not an address'); await b1.click('#f button[type=submit]'); await b1.waitForTimeout(300);
  assert.deepEqual(d1, [], 'a bad address asks the door nothing');
  assert.equal(await b1.evaluate(() => window.__eternal.data.view.state), 'refused');
  assert.equal(await b1.$eval('#s-bad', e => e.hidden), false, 'the engine says why, in the front');
  await c1.close();

  const { ctx: c2, p: r2, door: d2, errs } = await open('raver');
  const before = await r2.evaluate(() => window.__eternal.raver.mode);
  // the dial breathes (its spokes scale, 1.6 s): a person taps it mid-breath, so the tap does not wait
  // for a still frame. Under a full parallel battery Playwright never saw two equal frames in 30 s
  // (2026-09-26). The tap is still a real pointer click at the same point, and the next line still
  // proves it landed.
  await r2.click('#etRing .dial', { force: true });
  assert.notEqual(await r2.evaluate(() => window.__eternal.raver.mode), before, 'tapping the ring reads it another way');
  await r2.click('#etTiles button[data-mode="flow"]');
  assert.equal(await r2.evaluate(() => window.__eternal.raver.mode), 'flow');
  assert.equal(await r2.$eval('#etTiles button[data-mode="flow"]', e => e.getAttribute('aria-pressed')), 'true', 'the tile lights');
  assert.match(await r2.textContent('#etRing'), /0×/, 'no flow is drawn before one is measured');
  assert.equal(await r2.evaluate(() => document.querySelectorAll('#etRing .beat.lit,#etRing .beat.hot').length), 0, 'nothing lit as arrived before a byte arrives');
  assert.deepEqual(d2, [], 'the gestures never touch the door');
  await r2.click('#motion');
  assert.equal(await r2.evaluate(() => getComputedStyle(document.querySelector('#etRing .beat')).animationName), 'none', 'the ring is still when paused');
  assert.equal(errs.length, 0, errs.join(' | '));
  await c2.close();

  const { ctx: c3, p: y3 } = await open('cypherpunk');
  const d = await y3.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, done: document.querySelectorAll('#etPipe li.done').length, receipt: document.querySelectorAll('#etReceipt tr').length, panes: document.querySelectorAll('.et-c #inst .pane').length, sha: document.querySelector('#etReceipt').textContent }));
  assert.equal(d.steps, 7); assert.equal(d.done, 0, 'no step is done before an address'); assert.equal(d.receipt, 7); assert.equal(d.panes, 4, 'byte map, rule, decodingInfo, receipts at first paint');
  assert.match(d.sha, /sha256\s*not yet/, 'no hash is claimed before the last byte');
  assert.equal(await y3.$eval('.et-c a[target="_blank"]', a => a.rel), 'noopener noreferrer', 'the fork link opens a new tab safely');
  await c3.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^([—–-]|NaN|undefined|null)$/.test(own)) out.push('dash ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    }, FRONT[reg]);
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
