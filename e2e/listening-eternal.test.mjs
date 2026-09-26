// listening-eternal.test.mjs — the Listening Room's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts (the piece the renderer derives from the seed: key, notes,
// length, and the engine's live state); and no gesture plays or forks on its own — every one clicks
// the room's real control (#play, #stop, #fork) and the fronts only read the engine back.
// Run: node --test e2e/listening-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8925, ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === '/surfaces/listening.html' ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/listening.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.notes.length === 32, null, { timeout: 15000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const engine = p => p.evaluate(() => ({ playing: window.listeningDemo.playing, audio: window.listeningDemo.audioState, forks: window.listeningDemo.forks, now: document.getElementById('now').textContent }));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeePlay', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etForkHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyRun', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the seed, the key, the notes, the length, the forks', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      const fresh = window.listeningDemo.derive(document.getElementById('seed').value.trim());
      return {
        seed: D.seed, key: D.key, n: D.notes.length, secs: D.durationS, forks: D.forks,
        same: JSON.stringify(fresh.notes) === JSON.stringify(D.notes) && fresh.hash === D.hash,
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        petals: document.querySelectorAll('#etRing .pet').length, card: t('#etRaverCard'),
        derive: t('#etDerive'), notes: [...document.querySelectorAll('#etNotes td')].map(td => td.textContent).filter(Boolean).length / 2,
        hz: [...document.querySelectorAll('#etNotes tr')].slice(1).map(r => r.children[1].textContent),
        path: t('#eternal [data-et="path"]'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['seed', 'key', 'n', 'secs', 'forks']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.ok(a.same, 'the data layer is the renderer\'s own derive(seed), not a copy');
  assert.equal(a.n, 32); assert.equal(a.secs, 5.12); assert.equal(a.forks, 0);
  // each register draws the same piece its own way
  assert.match(a.beeRows[0], /32 notes · about 5 seconds/); assert.ok(a.beeRows[1].includes(a.key), 'bee names the key');
  assert.equal(facts.raver.petals, 32, 'one petal per note'); assert.ok(facts.raver.card.includes(a.key), 'raver names the key');
  const [root, ...scale] = a.key.split(' ');
  assert.ok(facts.cypherpunk.derive.includes(scale.join(' ')) && facts.cypherpunk.derive.includes(root), 'cypherpunk shows the scale and the root');
  assert.equal(facts.cypherpunk.notes, 32, 'cypherpunk lists all 32 notes');
  assert.equal(facts.cypherpunk.path, 'seed://' + a.seed);
});

test('bee: the one action hands off to the room\'s play and stop; the words follow the engine', async () => {
  const { ctx, p, errs } = await open('bee');
  assert.match(await p.textContent('#etBeeNow'), /ready when you are/);
  assert.equal((await engine(p)).playing, false, 'nothing plays on arrival');
  await p.click('#etBeePlay');
  await p.waitForFunction(() => window.listeningDemo.playing && /^playing - /.test(document.getElementById('now').textContent));
  await p.waitForFunction(() => /playing · \d+ of 32 notes/.test(document.getElementById('etBeeNow').textContent));
  assert.equal(await p.textContent('#etBeePlay'), 'stop');
  await p.click('#etBeePlay');
  await p.waitForFunction(() => /^stopped - /.test(document.getElementById('now').textContent));
  await p.waitForFunction(() => /stopped after \d+ of 32 notes/.test(document.getElementById('etBeeNow').textContent));
  assert.equal((await engine(p)).playing, false);
  await p.click('#etBeeFork');
  await p.waitForFunction(() => window.listeningDemo.forks === 1 && document.querySelectorAll('#lineage .forkrow').length === 1);
  await p.waitForFunction(() => /1 version made/.test(document.getElementById('etBeeRows').textContent));
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the heart plays the ring; a short hold forks nothing, a full hold forks once', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etRing .pet[data-i="4"]', { force: true }); // the ring breathes (6 s); a tap lands anyway
  assert.match(await p.textContent('#etRaverCard'), /step 5 · [\d.]+ Hz · beat 1/);
  await p.click('#etRing .heart');
  await p.waitForFunction(() => window.listeningDemo.playing);
  await p.waitForFunction(() => document.querySelectorAll('#etRing .pet.on').length > 0);
  const lit = await p.evaluate(() => [document.querySelectorAll('#etRing .pet.on').length, window.listeningDemo.steps]);
  assert.ok(lit[0] <= lit[1] + 1 && lit[0] >= 1, 'the lit petals are the engine\'s own step count ' + lit);
  await p.click('#etRing .heart');
  await p.waitForFunction(() => !window.listeningDemo.playing);
  await p.$eval('#etForkHold', b => b.scrollIntoView({ block: 'center' })); // clear of the tour bar
  const bx = await p.locator('#etForkHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal((await engine(p)).forks, 0, 'a short hold forks nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
  await p.waitForFunction(() => window.listeningDemo.forks === 1);
  assert.equal(await p.locator('#lineage .forkrow').count(), 1, 'the room\'s own lineage records the fork');
  assert.match(await p.textContent('#etRaverForks'), /nibble \d+ \+1/);
  // motion: the breath pauses on the switch and stays still under reduced motion
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => document.body.classList.contains('et-still') && getComputedStyle(document.querySelector('.et-r-breath')).animationPlayState), 'paused');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('.et-r-breath')).animationName), 'none', 'still under reduced motion');
  assert.equal(await r.p.$eval('#etMotion', b => b.disabled), true);
  await r.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint, runs the real renderer, links out safely', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    derive: document.querySelectorAll('#etDerive tr').length, steps: document.querySelectorAll('#etPipe li').length,
    receipt: document.querySelectorAll('#etReceipt tr').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    hash: document.getElementById('etDerive').textContent.match(/0x[0-9a-f]{8}/)?.[0], h: window.__eternal.data.hash,
    fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel),
  }));
  assert.equal(d.derive, 6); assert.equal(d.steps, 6); assert.equal(d.receipt, 6);
  assert.match(d.now, /web audio/, 'the pipeline points at the engine step');
  assert.equal(d.hash, '0x' + d.h.toString(16).padStart(8, '0'));
  assert.deepEqual(d.fork, ['noopener noreferrer'], 'the template link opens a new tab, safely');
  await p.click('#etCyRun');
  await p.waitForFunction(() => window.listeningDemo.playing && /timer running/.test(document.getElementById('etReceipt').textContent));
  await p.click('#etCyRun');
  await p.waitForFunction(() => !window.listeningDemo.playing);
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
