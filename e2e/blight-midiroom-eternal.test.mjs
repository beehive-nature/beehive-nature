// blight-midiroom-eternal.test.mjs — bMiDi · the room's three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three carry the SAME facts (the seed on the stage, its draw, the 32-step score, the
// setlist bMiDi queued); no gesture plays, asks or queues on its own — every one clicks the room's real
// control (#voice, #ask, a .prop card, a setlist ▶) and the fronts read the room back; sound never starts
// on arrival, and under reduced motion the room and its fronts stay silent.
// Run: node --test e2e/blight-midiroom-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9135, ORIGIN = `http://127.0.0.1:${PORT}`, PATH = '/surfaces/blight/midiroom.html';
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

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : (out.push(r.request().url()), r.abort('blockedbyclient')));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(ORIGIN + PATH, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.seed === 20260826 && window.__eternal.data.queue.length === 3, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const room = p => p.evaluate(() => ({ sounding: window.sounding, ctx: !!window.actx, seed: window.currentSeed, queue: window.queue.map(q => q.seed) }));
async function hold(p, ms) {
  await p.$eval('#etHold', b => b.scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250);
}

test('one front per register, each in its own dress; nothing sounds or leaves on arrival', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeePlay', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyRun', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    const r = await room(p); assert.equal(r.sounding, false, reg + ': nothing sounds on arrival'); assert.equal(r.ctx, false, reg + ': no audio context before a press');
    assert.deepEqual(out, [], reg + ': nothing leaves the page');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the seed, its draw, the 32 steps, the setlist', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        seed: D.seed, mode: D.modeName, bpm: D.bpm, shape: D.shape, sym: D.sym, queue: D.queue.map(q => q.seed), notes: D.steps.map(s => s.name),
        page: { seed: window.currentSeed, mode: window.P.mode.n, bpm: window.P.bpm, queue: window.queue.map(q => q.seed), notes: window.P.pat.map(s => noteName(s.midi)) },
        beeRows: [...document.querySelectorAll('.et-b .et-b-rows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        spokes: document.querySelectorAll('#etRecord .et-m-spoke').length, discs: [...document.querySelectorAll('#etRecord .et-m-disc')].map(d => d.getAttribute('aria-label')), hint: t('#etRaverHint'),
        score: [...document.querySelectorAll('#etScore td')].reduce((o, td, i, all) => { if (i % 2 === 0 && td.textContent) o[+td.textContent - 1] = all[i + 1].textContent; return o; }, []),
        set: [...document.querySelectorAll('#etSet tr')].slice(1).map(r => +r.children[1].textContent), draw: t('#etDraw'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['seed', 'mode', 'bpm', 'shape', 'sym', 'queue', 'notes']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.page, { seed: a.seed, mode: a.mode, bpm: a.bpm, queue: a.queue, notes: a.notes }, 'the data layer is the room\'s own seed, draw, score and setlist');
  assert.equal(a.queue.length, 3, 'bMiDi\'s opening set');
  assert.ok(a.beeRows[0].includes('20,260,826') && a.beeRows[1].includes(a.mode) && a.beeRows[1].includes(a.bpm + ' beats a minute') && /3 songs/.test(a.beeRows[2]), 'bee names the song, its mood and what is next');
  assert.equal(facts.raver.spokes, 32, 'one spoke per step'); assert.equal(facts.raver.discs.length, 3);
  facts.raver.discs.forEach((l, i) => assert.ok(l.includes(Number(a.queue[i]).toLocaleString()), 'disc ' + i + ' is setlist seed ' + a.queue[i]));
  assert.match(facts.raver.hint, new RegExp('C' + a.sym + 'n · 3 lined up'));
  assert.deepEqual(facts.cypherpunk.score, a.notes, 'cypherpunk lists all 32 notes'); assert.deepEqual(facts.cypherpunk.set, a.queue);
  assert.ok(facts.cypherpunk.draw.includes(a.mode) && facts.cypherpunk.draw.includes(a.bpm + ' bpm'));
});

test('bee: play and rest through the room\'s own button; ask in plain words, add an answer to the line', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeePlay');
  await p.waitForFunction(() => window.sounding && window.actx);
  assert.match(await p.textContent('#voice'), /silence/, 'the room\'s own control flipped');
  assert.match(await p.textContent('#etBeeNow'), /the room is playing song 20,260,826/);
  assert.equal(await p.textContent('#etBeePlay'), 'let the room rest');
  await p.click('#etBeePlay');
  await p.waitForFunction(() => !window.sounding && !window.actx);
  await p.fill('#etBeeQ', 'dorian slow');
  await p.click('#etBeeAskGo');
  await p.waitForFunction(() => document.querySelectorAll('#proposals .prop').length === 3 && document.querySelectorAll('#etBeeProps [data-prop]').length === 3);
  assert.equal(await p.inputValue('#askin'), 'dorian slow', 'the words land in bMiDi\'s own ask');
  const props = await p.evaluate(() => [...document.querySelectorAll('#proposals .prop')].map(e => +e.querySelector('b').textContent.replace(/\D/g, '')));
  const lines = await p.evaluate(() => [...document.querySelectorAll('#etBeeProps [data-prop]')].map(e => e.textContent));
  lines.forEach(l => assert.match(l, /^Dorian · /));
  await p.click('#etBeeProps [data-prop="0"]');
  await p.waitForFunction(n => window.queue.length === 4 && window.queue[3].seed === n, props[0]);
  assert.match(await p.textContent('.et-b'), /lined up next\s*4 songs/, 'the new song joins the line');
  assert.equal((await room(p)).sounding, false, 'adding to the line plays nothing');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a disc, a short hold drops nothing, a full hold drops the needle; the heart plays; motion pauses', async () => {
  const { ctx, p, errs } = await open('raver');
  const q = (await room(p)).queue;
  await p.click('#etRecord .et-m-disc[data-i="1"]');
  assert.match(await p.textContent('#etRaverCard'), new RegExp('seed ' + Number(q[1]).toLocaleString()));
  await hold(p, 400);
  assert.equal((await room(p)).seed, 20260826, 'a short hold changes nothing');
  await hold(p, 1500);
  await p.waitForFunction(s => window.currentSeed === s, q[1]);
  assert.equal(await p.getAttribute('#etRecord .et-m-disc[data-i="1"]', 'class'), 'et-m-disc now');
  assert.equal((await room(p)).sounding, false, 'dropping the needle on a silent room stays silent');
  await p.click('#etRecord .et-m-heart');
  await p.waitForFunction(() => window.sounding && document.getElementById('etTurn').classList.contains('go'));
  assert.equal(await p.textContent('#etRaverTitle'), 'it spins');
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('etTurn')).animationPlayState), 'paused');
  await p.click('#etRecord .et-m-heart');
  await p.waitForFunction(() => !window.sounding);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.getAttribute('#etRecord .et-m-heart', 'aria-disabled'), 'true');
  await r.p.click('#etRecord .et-m-heart', { force: true }); // a press on a resting heart must still do nothing
  await r.p.waitForTimeout(300);
  assert.deepEqual([(await room(r.p)).sounding, (await room(r.p)).ctx], [false, false], 'reduced motion: the room rests silent');
  assert.equal(await r.p.$eval('#etMotion', b => b.disabled), true);
  await r.ctx.close();
});

test('cypherpunk: the room is an instrument at first paint; the ask scans seed space; run hands off', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ draw: document.querySelectorAll('#etDraw tr').length, steps: document.querySelectorAll('#etPipe li').length, receipt: document.getElementById('etReceipt').textContent,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, chips: document.getElementById('etChips').textContent, fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel) }));
  assert.equal(d.draw, 6); assert.equal(d.steps, 6); assert.equal(d.now, 'web audio');
  assert.match(d.chips, /relay LOCAL/); assert.match(d.receipt, /writes\s*none/); assert.deepEqual(d.fork, ['noopener noreferrer']);
  await p.fill('#etCyQ', 'fast lydian');
  await p.click('#etCyAsk');
  await p.waitForFunction(() => document.querySelectorAll('#proposals .prop').length === 3);
  await p.click('#etCyRun');
  await p.waitForFunction(() => window.sounding && /sounding/.test(document.getElementById('etChips').textContent));
  await p.click('#etCyRun');
  await p.waitForFunction(() => !window.sounding);
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
