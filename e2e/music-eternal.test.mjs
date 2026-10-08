// music-eternal.test.mjs — SKAISTS mUsiC's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts (the room module's verified envelope: channel, epoch,
// sequence, the set, the creator, the admission gate; the joined flag); and no gesture joins or
// verifies on its own — every one presses the room's real control (#join, #verify-store), "in" is
// drawn only when the module says joined, and nothing is ever written (no POST, no socket).
// Run: node --test e2e/music-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8926, ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === '/surfaces/music.html' ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });
const ENV = JSON.parse(await readFile(join(ROOT, 'fixtures/connect-store-manifest-envelope-v1.json'), 'utf8')).manifest;

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const writes = [];
  await ctx.route('**/*', r => { const q = r.request(); if (q.method() !== 'GET' || q.url().includes('/ws')) writes.push(q.method() + ' ' + q.url()); return q.url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/music.html${opts.query || ''}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && (window.__eternal.data.ready || window.__eternal.data.error), null, { timeout: 15000 });
  return { ctx, p, errs, writes };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const joined = p => p.evaluate(() => window.musicRoom.joined);

// the founder's chosen UI (2026-10-05): new bee is paper with bold system sans titles and a forest
// green action; raver is night purple (the sovereign tint) with plain bold sans titles and its
// magenta pill; cypherpunk is unchanged. Each value is asserted exactly.
test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /^ui-sans-serif, system-ui/, act: '#etBeeJoin', action: 'rgb(38, 77, 54)' },
    raver: { front: '.et-r', bg: 'rgb(18, 14, 30)', title: /^ui-sans-serif, system-ui/, act: '#etStepHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyJoin', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, h1: [...document.querySelectorAll('h1')].filter(h => h.checkVisibility()).length };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.h1, 1, reg + ': the room keeps its one h1');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the channel, the set, the creator, the gate', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        d: [D.channel, D.epoch, D.sequence, D.items.map(i => i.kind + ':' + i.size), D.creator, D.admission.payment, D.admission.approval, D.joined, D.doors],
        beeSheet: !!document.getElementById('etBeeRows'), beeRows: document.querySelectorAll('#eternal > .et-b .et-b-row').length, beeInner: (document.querySelector('#eternal > .et-b')||{}).innerText||'', beeNow: (document.getElementById('etBeeNow')||{}).textContent||'', beePrimary: (document.getElementById('etBeeJoin')||{}).textContent||'', beeDisabled: !!(document.getElementById('etBeeJoin')||{}).disabled,
        planets: document.querySelectorAll('#etSky .planet').length, epochs: document.querySelectorAll('#etSky .epoch').length, ticks: document.querySelectorAll('#etSky .tick').length,
        hint: t('#etRaverHint'), env: t('#etEnvelope'), items: [...document.querySelectorAll('#etItems tr')].slice(1).map(r => r.children[0].textContent),
        pageFacts: [t('#f-channel'), t('#f-epoch'), t('#f-sequence'), t('#f-items'), t('#g-payment')],
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(facts.raver.d, a.d); assert.deepEqual(facts.cypherpunk.d, a.d);
  // the data layer is the module's own envelope: it agrees with the fixture and with the room below
  assert.deepEqual(a.d.slice(0, 5), [ENV.channel, ENV.epoch, ENV.sequence, ENV.encrypted_items.map(i => i.kind + ':' + i.ref.size), ENV.credits.creator[0].display_name]);
  assert.deepEqual(a.pageFacts, [ENV.channel, String(ENV.epoch), String(ENV.sequence), String(ENV.encrypted_items.length), ENV.admission.payment]);
  assert.equal(a.d[7], false, 'nobody is in the room on arrival');
  // New bee: no four-row status sheet — one primary only (Floor A). Facts still live in __eternal.data + Raver/Cypherpunk.
  assert.equal(a.beeSheet, false, 'New bee has no etBeeRows status sheet');
  assert.equal(a.beeRows, 0, 'New bee has no .et-b-row status rows');
  assert.ok(!/in the set|who made it|could not|try again/i.test(a.beeInner), 'no status sheet or fail copy on New bee');
  assert.match(a.beePrimary, /listen now/i);
  assert.equal(a.beeDisabled, false, 'listen primary always works');
  assert.equal(facts.raver.planets, 4, 'one planet per encrypted item'); assert.equal(facts.raver.epochs, ENV.epoch, 'one ring per epoch'); assert.equal(facts.raver.ticks, ENV.sequence, 'one tick per sequence');
  assert.match(facts.raver.hint, /plur · epoch 3 · seq 12/);
  assert.ok(facts.cypherpunk.env.includes(ENV.checkpoint.id) && facts.cypherpunk.env.includes('payment disabled · approval trezor'), 'cypherpunk shows the checkpoint whole and the gate');
  assert.deepEqual(facts.cypherpunk.items, ENV.encrypted_items.map(i => i.kind));
});

test('bee: the one action opens a listen place (utility, not a status lesson)', async () => {
  const { ctx, p, errs, writes } = await open('bee');
  assert.equal(await p.$eval('#etBeeJoin', b => b.disabled), false);
  assert.match(await p.textContent('#etBeeJoin'), /listen now/i);
  assert.ok(!(await p.textContent('#eternal > .et-b')).match(/could not|try again|did not load/i));
  // click should activate an external door (new tab) or scroll to sources — popup listener
  const [popup] = await Promise.all([
    p.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
    p.click('#etBeeJoin'),
  ]);
  if (popup) await popup.close();
  else {
    // fallback: scrolled to source panel
    await p.waitForFunction(() => { const r = document.querySelector('.source-panel').getBoundingClientRect(); return r.top >= -2 && r.top < 400; });
  }
  assert.deepEqual(writes, [], 'nothing was written'); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee: a refused envelope stays silent — listen primary still works', async () => {
  const { ctx, p } = await open('bee', { query: '?manifest=/fixtures/does-not-exist.json' });
  assert.equal(await p.$eval('#etBeeJoin', b => b.disabled), false, 'listen still available');
  const beeText = await p.textContent('#eternal > .et-b');
  assert.equal(/could not|try again|did not load|unavailable/i.test(beeText), false, 'zero fail copy on New bee');
  assert.equal(await p.evaluate(() => document.querySelectorAll('#eternal > .et-b .et-b-row').length), 0);
  await ctx.close();
});

test('raver: tap a planet to read it; a short hold does nothing, a full hold steps in', async () => {
  const { ctx, p, errs, writes } = await open('raver');
  await p.click('#etSky .planet[data-i="1"]', { force: true }); // the orbits turn (a minute or slower); a tap lands anyway
  assert.match(await p.textContent('#etRaverCard'), /the recording.*512 KiB/);
  await p.$eval('#etStepHold', b => b.scrollIntoView({ block: 'center', behavior: 'instant' })); // the room scrolls smoothly; measure after
  const bx = await p.locator('#etStepHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await joined(p), false, 'a short hold does not step in');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.musicRoom.joined === true);
  assert.equal(await p.textContent('#etRaverTitle'), "you're in");
  assert.equal(await p.evaluate(() => document.querySelector('#etSky').classList.contains('in') && getComputedStyle(document.querySelector('#etSky .you-g')).display !== 'none'), true, 'you appear on the rim only when joined');
  // motion: the switch presses the room's own #motion; the orbits pause with it
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-motion-paused')), 'true');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.et-r-spin')).animationPlayState), 'paused');
  assert.deepEqual(writes, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('.et-r-spin')).animationName), 'none', 'still under reduced motion');
  await r.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and hands off honestly', async () => {
  const { ctx, p, errs, writes } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    env: document.querySelectorAll('#etEnvelope tr').length, steps: document.querySelectorAll('#etPipe li').length,
    receipt: document.querySelectorAll('#etReceipt tr').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    verify: document.getElementById('etCyVerify').disabled, fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel),
  }));
  assert.equal(d.env, 8); assert.equal(d.steps, 6); assert.equal(d.receipt, 5);
  assert.match(d.now, /join/, 'the pipeline points at the first step not yet done');
  assert.equal(d.verify, true, 'no store endpoint: the verify hand-off is honestly off');
  assert.deepEqual(d.fork, ['noopener noreferrer']);
  await p.click('#etCyJoin');
  await p.waitForFunction(() => window.musicRoom.joined === true && /yes · local preview/.test(document.getElementById('etReceipt').textContent));
  assert.deepEqual(writes, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
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
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
