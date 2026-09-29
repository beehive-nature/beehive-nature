// blight-studio-music-eternal.test.mjs — the Music studio's three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three carry the SAME facts (the 8 × 16 pattern, the scale, the key, the wave, the
// tempo, the pitch of every row, the transport's state); no gesture composes, plays or saves on its
// own — every one clicks the studio's real control (a #grid square, #play, #stop, #dice, #undo, #link,
// the sound selects) and the fronts read the engine back; sound starts only on a press. The engine-only
// rig (e2e/first-click.test.mjs) keeps running the studio's own inline engine untouched.
// Run: node --test e2e/blight-studio-music-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9137, ORIGIN = `http://127.0.0.1:${PORT}`, PATH = '/surfaces/blight/studio-music.html';
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
  await p.goto(ORIGIN + PATH + (opts.q || ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.pitches.length === 8, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const engine = p => p.evaluate(() => ({ playing, ctx: !!ac, notes: pattern.flat().filter(Boolean).length, steps: score().steps, bpm: tempo(), scale: document.getElementById('scale').value }));

test('one front per register, each in its own dress; nothing sounds or leaves on arrival', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etWheel', action: null },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyRun', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face');
    if (w.action) assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    const e = await engine(p); assert.equal(e.playing, false); assert.equal(e.ctx, false, reg + ': no audio before a press');
    assert.deepEqual(out, [], reg + ': nothing leaves the page');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  // raver's action is the lit pad key: magenta, once a pitch is lit
  const { ctx, p } = await open('raver');
  await p.click('#etPad button[data-d="3"]');
  assert.equal(await p.$eval('#etPad button[data-d="3"]', b => getComputedStyle(b).backgroundColor), 'rgb(214, 85, 187)', 'raver action colour');
  await ctx.close();
});

test('the same facts in all three: the pattern, the sound, the tempo, the pitch of every row', async () => {
  const facts = {};
  // a shared song link: the same score lands in every register through the studio's own decoder
  const song = { v: 1, scale: 'dorian', root: 'D', bpm: 96, wave: 'square', steps: ['1000100010001000', '0010000000100000', '0000001000000010', '0', '0', '0', '0', '1000000000000001'].map(r => r.padEnd(16, '0')).join('|'), imported: null };
  const link = '#score=' + encodeURIComponent(Buffer.from(JSON.stringify(song)).toString('base64'));
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { q: link });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        notes: D.notes, steps: D.steps, scale: D.scale, root: D.root, wave: D.wave, bpm: D.bpm, names: D.pitches.map(x => x.name),
        page: { steps: score().steps, names: [0, 1, 2, 3, 4, 5, 6, 7].map(noteName), bpm: tempo() },
        bee: t('.et-b .et-b-rows'), beeGo: t('#etBeeGo'),
        lit: document.querySelectorAll('#etWheel .dot.on').length, spokes: document.querySelectorAll('#etWheel .et-s-spoke').length, hint: t('#etRaverHint'),
        map: [...document.querySelectorAll('#etMap tr')].slice(1).map(r => r.children[2].textContent).reverse(),
        bits: [...document.querySelectorAll('#etBits tr')].slice(1).map(r => r.children[1].textContent).reverse().join('|'), path: t('#eternal [data-et="path"]'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['notes', 'steps', 'scale', 'root', 'wave', 'bpm', 'names']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.equal(a.steps, song.steps); assert.equal(a.steps, a.page.steps, 'the data layer is the engine\'s own score()');
  assert.deepEqual(a.names, a.page.names); assert.equal(a.notes, 10); assert.deepEqual([a.scale, a.root, a.wave, a.bpm], ['dorian', 'D', 'square', 96]);
  assert.ok(a.bee.includes('10 notes placed') && a.bee.includes('D dorian, square') && a.bee.includes('96 beats a minute')); assert.equal(a.beeGo, 'play');
  assert.equal(facts.raver.spokes, 16); assert.equal(facts.raver.lit, 10, 'one lit dot per note'); assert.match(facts.raver.hint, /^10 notes · 96 bpm/);
  assert.deepEqual(facts.cypherpunk.map, a.names); assert.equal(facts.cypherpunk.bits, song.steps, 'cypherpunk shows the raw bit rows');
  assert.equal(facts.cypherpunk.path, 'score://v1 · 8 × 16 · D dorian · square');
});

test('bee: an empty studio offers a surprise, then play and stop — all through the studio\'s own buttons', async () => {
  const { ctx, p, errs } = await open('bee');
  assert.equal(await p.textContent('#etBeeGo'), 'surprise me with a tune', 'no notes: the one action is the studio\'s own dice');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => pattern.flat().some(Boolean) && /new variation/.test(document.getElementById('status').textContent));
  assert.equal((await engine(p)).playing, false, 'a surprise plays nothing');
  assert.equal(await p.textContent('#etBeeGo'), 'play');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => playing && ac && document.getElementById('play').getAttribute('aria-pressed') === 'true');
  assert.match(await p.textContent('#etBeeNow'), /playing your loop/);
  assert.equal(await p.textContent('#etBeeGo'), 'stop');
  await p.click('#etBeeGo');
  await p.waitForFunction(() => !playing && document.getElementById('stop').disabled);
  assert.match(await p.textContent('#status'), /Stopped/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a spoke, light a pitch on the pad (the studio\'s own square), undo it, spin the loop', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etWheel .et-s-spoke[data-s="4"]', { position: { x: 40, y: 20 } }); // on the spoke, clear of the heart
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 4);
  assert.match(await p.textContent('#etRaverCard'), /step 5 of 16 · a rest/);
  await p.click('#etPad button[data-d="2"]');
  assert.deepEqual(await p.evaluate(() => [pattern[2][4], document.querySelector('#grid .cell[data-d="2"][data-s="4"]').getAttribute('aria-pressed')]), [true, 'true'], 'the studio\'s own square is on');
  assert.equal(await p.getAttribute('#etPad button[data-d="2"]', 'aria-pressed'), 'true');
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etWheel .et-s-spoke[data-s="4"] .dot.on').length), 1);
  await p.click('#etRaverUndo');
  assert.equal(await p.evaluate(() => pattern[2][4]), false, 'undo is the studio\'s own');
  await p.click('#etPad button[data-d="2"]');
  await p.click('#etWheel .et-s-heart');
  await p.waitForFunction(() => playing && document.getElementById('etSweep').classList.contains('go'));
  assert.equal(await p.textContent('#etRaverTitle'), 'it turns');
  const du = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('etSweep')).animationDuration));
  assert.ok(du >= 1.2, 'the hand sweeps once a bar: under 1 Hz (' + du + ' s)');
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('etSweep')).animationPlayState), 'paused');
  await p.click('#etWheel .et-s-heart');
  await p.waitForFunction(() => !playing);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  await r.p.click('#etPad button[data-d="0"]');
  await r.p.click('#etWheel .et-s-heart');
  await r.p.waitForFunction(() => playing);
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.getElementById('etSweep')).animationName), 'none', 'reduced motion: the hand never moves');
  await r.p.click('#etWheel .et-s-heart');
  await r.ctx.close();
});

test('cypherpunk: knobs set the studio\'s own controls; transport and song link hand off', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ map: document.querySelectorAll('#etMap tr').length, bits: document.querySelectorAll('#etBits tr').length, steps: document.querySelectorAll('#etPipe li').length, receipt: document.getElementById('etReceipt').textContent, fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel) }));
  assert.deepEqual([d.map, d.bits, d.steps], [9, 9, 6]); assert.match(d.receipt, /writes\s*none/); assert.deepEqual(d.fork, ['noopener noreferrer']);
  await p.selectOption('#etCyScale', 'lydian');
  assert.equal((await engine(p)).scale, 'lydian', 'the studio\'s own scale select changed');
  assert.match(await p.textContent('#etPipe'), /lydian \[0,2,4,6,7,9,11\]/);
  await p.fill('#etCyBpm', '250'); await p.dispatchEvent('#etCyBpm', 'change');
  assert.equal((await engine(p)).bpm, 200, 'the studio clamps, the front shows its clamp');
  assert.equal(await p.inputValue('#etCyBpm'), '200');
  await p.click('#etCyRun');
  await p.waitForFunction(() => playing && /playing/.test(document.getElementById('etChips').textContent));
  await p.click('#etCyRun');
  await p.waitForFunction(() => !playing);
  await p.click('#etCyLink');
  await p.waitForFunction(() => /#score=/.test(document.getElementById('share-text').value));
  const url = await p.inputValue('#share-text');
  assert.ok(url.startsWith(await p.evaluate(() => location.origin + location.pathname + '#score=')), 'the studio\'s own song link');
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
