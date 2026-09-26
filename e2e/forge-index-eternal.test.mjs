// forge-index-eternal.test.mjs — the bBuzz forge's front door as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per
// register, each in its own dress and structure; all three list the SAME rooms, read from the page's
// own cards, and every door is a real link to a room that exists; the raver curve is BuzzGain's own
// math — recomputed here in Node from the constants in the Rust crate — and bends under the finger;
// the cypherpunk receipt carries the committed receipts' own numbers. Nothing on the front builds,
// plays or sends. Run: node --test e2e/forge-index-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9157, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// BuzzGain, from its own source: the knee from safety.rs, the defaults from lib.rs, the chain from process()
const LIB = await readFile(join(ROOT, 'forge/crates/buzz-gain/src/lib.rs'), 'utf8');
const SAFETY = await readFile(join(ROOT, 'forge/crates/buzz-gain/src/safety.rs'), 'utf8');
const KNEE = +SAFETY.match(/const KNEE_FRACTION: f32 = ([\d.]+);/)[1];
const SAT = +LIB.match(/FloatParam::new\("Saturation", ([\d.]+)/)[1];
const CEIL = +LIB.match(/ceiling: FloatParam::new\([\s\S]*?db_to_gain\((-?[\d.]+)\)/)[1];
assert.match(LIB, /\(1\.0 - saturation\) \* driven \+ saturation \* driven\.tanh\(\)/, 'the saturation line this test ports');
assert.match(SAFETY, /let shaped = knee \+ \(ceiling - knee\) \* over\.tanh\(\);/, 'the limiter line this test ports');
const db = g => Math.pow(10, g / 20);
const limit = (y, c) => { if (!Number.isFinite(y)) return 0; const k = c * KNEE, m = Math.abs(y); if (m <= k) return y; const s = k + (c - k) * Math.tanh((m - k) / (c - k)); return Math.min(s, c) * Math.sign(y); };
const buzz = (x, drive = 0, sat = SAT, trim = 0, ceil = CEIL) => { const v = x * db(drive); return limit(((1 - sat) * v + sat * Math.tanh(v)) * db(trim), db(ceil)); };
const INTEG = await readFile(join(ROOT, 'docs/dispatches/RECEIPT_zCode_BF1_INTEGRATION_2026-08-21.md'), 'utf8');
const BUILD = await readFile(join(ROOT, 'docs/dispatches/RECEIPT_zCode_BF1_BUILD_2026-08-21.md'), 'utf8');

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/forge/index.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

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
      const vis = s => { const e = fr.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: vis('#etFgRows a.et-b-row'), curve: vis('#etFgCurve .curve'), manifest: vis('#etFgRooms') && fr.querySelectorAll('#etFgChain li').length === 6 };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.curve, reg === 'raver'); assert.equal(d.manifest, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same rooms in all three, read from the page\'s own cards; every door is real', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => ({
      cards: [...document.querySelectorAll('.wrap>.cards a.card')].map(a => a.getAttribute('href')),
      model: window.__eternal.data.rooms.map(r => r.href), loop: window.__eternal.data.loop,
      bee: [...document.querySelectorAll('#etFgRows a.et-b-row')].map(a => a.getAttribute('href')),
      raver: [...document.querySelectorAll('#etFgDoors a.et-r-door')].map(a => a.getAttribute('href')),
      cy: [...document.querySelectorAll('#etFgRooms a')].map(a => a.getAttribute('href')),
      hint: document.getElementById('etFgHint').textContent,
    }));
    await ctx.close();
  }
  const cards = facts.bee.cards;
  assert.deepEqual(cards, ['hexfield.html', 'orbit.html', 'room.html', 'huddle.html']);
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.deepEqual(facts[reg].model, cards, reg + ' reads the cards'); assert.deepEqual(facts[reg].loop, ['describe', 'build', 'preview', 'iterate', 'fork']); }
  assert.deepEqual(facts.bee.bee, cards); assert.deepEqual(facts.raver.raver, cards); assert.deepEqual(facts.cypherpunk.cy, cards);
  assert.equal(facts.raver.hint, 'sound + sight · 4 rooms · 1 plugin');
  for (const href of cards) { const r = await fetch(`${ORIGIN}/surfaces/forge/${href}`); assert.equal(r.status, 200, href + ' exists'); }
});

test('the curve is BuzzGain\'s own math, and the receipt is the committed one', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ xfer: [...document.querySelectorAll('#etFgXfer tr')].map(r => [...r.children].map(c => c.textContent)),
    receipt: document.getElementById('etFgReceipt').innerText.replace(/\s+/g, ' '), page: [0.1, 0.7, 1.3, 3].map(x => window.__eternal.buzz(x, { drive: 6, saturation: 0.6, trim: -3, ceiling: -2 })) }));
  assert.deepEqual(d.xfer.map(r => [+r[0], r[1]]), [0.25, 0.5, 1, 2, 4].map(x => [x, buzz(x).toFixed(4)]), 'the table is the Rust formula at the Rust defaults');
  d.page.forEach((y, i) => assert.ok(Math.abs(y - buzz([0.1, 0.7, 1.3, 3][i], 6, 0.6, -3, -2)) < 1e-9, 'the page\'s port agrees away from the defaults too'));
  const run2 = INTEG.slice(INTEG.indexOf('Run 2'));
  const [, run, passed, failed, warns, skipped] = run2.match(/(\d+) tests run, (\d+) passed, (\d+) failed, (\d+) warnings, (\d+) skipped/);
  assert.match(d.receipt, new RegExp(`validator clap-validator 0\\.4\\.1 · ${run} run · ${passed} passed · ${failed} failed · ${warns} warning · ${skipped} skipped`));
  const pin = run2.match(/sha256 `([0-9a-f]{64})`/)[1];
  assert.match(d.receipt, new RegExp('sha256 ' + pin));
  assert.match(d.receipt, new RegExp('unit tests cargo test --release · ' + BUILD.match(/test result: ok\. (\d+) passed/)[1] + ' passed · 0 failed'));
  assert.match(d.receipt, /ear test owed · a human in a DAW/, 'the one receipt still owed is shown as owed');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the curve bends under the finger; the doors and the pill are real links', async () => {
  const { ctx, p, errs } = await open('raver');
  const peak0 = await p.evaluate(() => window.__eternal.data.peak);
  assert.ok(Math.abs(peak0 - buzz(1)) < 1e-9, 'a full-scale peak, as the plugin would shape it');
  const bx = await p.locator('#etFgCurve').boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.5); await p.mouse.down();
  await p.mouse.move(bx.x + bx.width * 0.9, bx.y + bx.height * 0.1, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100);
  const q = await p.evaluate(() => Object.assign({}, window.__eternal.data.params, { peak: window.__eternal.data.peak }));
  assert.equal(q.drive, 20.5); assert.equal(q.saturation, 0.9);
  assert.ok(Math.abs(q.peak - buzz(1, 20.5, 0.9)) < 1e-9);
  assert.match(await p.evaluate(() => document.getElementById('etFgLegend').innerText.replace(/\s+/g, ' ')), /drive \+20\.5 dB saturation 90%/);
  await p.focus('#etFgCurve'); await p.keyboard.press('ArrowLeft');
  assert.equal(await p.evaluate(() => window.__eternal.data.params.drive), 19.5, 'the keys bend it too');
  assert.equal(await p.getAttribute('#etFgRaverGo', 'href'), 'hexfield.html');
  await Promise.all([p.waitForURL(/\/surfaces\/forge\/room\.html$/), p.click('#etFgDoors a[href="room.html"]')]);
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
        if (/^([—–-]|NaN|undefined|null)$/.test(own) || /undefined|\[object|NaN(?= ?(%|dB|px|°|$))/.test(own))   /* "NaN and ±inf become 0" is safety.rs's own sentence, not a value */ out.push('bad value ' + (el.className.baseVal ?? el.className) + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
