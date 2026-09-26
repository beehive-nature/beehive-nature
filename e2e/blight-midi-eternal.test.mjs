// blight-midi-eternal.test.mjs — bMiDi's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts (the seed, its level, the contract's draw: scale, instrument, notes; the
// live getMeta read and the pitch numbers, which do not answer in this box and are said so); and no
// gesture reads, plays or swaps on its own — every one clicks the page's real control (#in + #read,
// #voice, #voice2, #swapbtn) and the fronts read S back. Level zero is silent and reduced motion is
// silent, in every register, exactly as the page's own law says.
// Run: node --test e2e/blight-midi-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9133, ORIGIN = `http://127.0.0.1:${PORT}`, PATH = '/surfaces/blight/midi.html';
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
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(ORIGIN + PATH, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.seed === 7 && window.PITCH && document.getElementById('pi-owner').textContent !== '…', null, { timeout: 20000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const score = p => p.evaluate(() => ({ seed: window.S.seed, tier: window.S.tier, sounding: window.sounding, ctx: !!window.actx, mode: window.playMode }));
async function ringClick(p, k) { // a tap on the ring's own edge (the ring's centre is the heart)
  const b = await p.$eval(`#etRes .et-l-ring[data-k="${k}"] .hexo`, e => { const r = e.getBoundingClientRect(); return { x: r.right - 3, y: r.top + r.height / 2 }; });
  await p.mouse.click(b.x, b.y);
}
async function hold(p, ms) {
  await p.$eval('#etHold', b => b.scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250);
}

test('one front per register, each in its own dress; nothing sounds on arrival', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/ },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/ },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/ },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    // the action colour is proved where the action is live: at level 5 (level 0 is silent, so its play is off)
    await p.evaluate(() => { document.getElementById('in').value = '1500000'; document.getElementById('read').click(); });
    await p.waitForFunction(() => window.S.tier === 5 && window.__eternal.data.tier === 5);
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face');
    assert.equal(d.action, { bee: 'rgb(168, 35, 140)', raver: 'rgb(214, 85, 187)', cypherpunk: 'rgb(69, 194, 220)' }[reg], reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    const s = await score(p); assert.equal(s.sounding, false, reg + ': nothing sounds before a press'); assert.equal(s.ctx, false);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the seed, its level, the draw, the silent live read, the unread pitch', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '', g = generateMelody(window.S.seed, window.S.extra);
      return {
        seed: D.seed, tier: D.tier, scale: D.scale, instrument: D.instrumentName, notes: D.notes.map(n => n.note), live: D.live, pitch: D.pitch.ok,
        page: { seed: window.S.seed, tier: window.S.tier, scale: g.scale[0], instrument: GM[g.instrument], notes: window.S.melody.map(n => n.note), meta: window.S.meta },
        bee: t('.et-b .et-b-rows'), beeNow: t('#etBeeNow'), beePlay: [t('#etBeePlay'), document.getElementById('etBeePlay').disabled],
        hint: t('#etRaverHint'), card: t('#etRaverCard'), mine: document.querySelector('#etRes .et-l-ring.mine').getAttribute('data-k'), dots: document.querySelectorAll('#etRes .et-l-note').length,
        draw: t('#etDraw'), noteRows: document.querySelectorAll('#etNotes tr').length - 1, pitchT: t('#etPitch'), fail: [...document.querySelectorAll('#etPipe li.fail b')].map(b => b.textContent),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['seed', 'tier', 'scale', 'instrument', 'notes', 'live', 'pitch']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual({ seed: a.seed, tier: a.tier, scale: a.scale, instrument: a.instrument, notes: a.notes }, { seed: a.page.seed, tier: a.page.tier, scale: a.page.scale, instrument: a.page.instrument, notes: a.page.notes }, 'the data layer is the page\'s own S and the contract\'s draw');
  assert.equal(a.seed, 7); assert.equal(a.tier, 0); assert.equal(a.page.meta, null, 'no live getMeta answer reaches this box'); assert.equal(a.live, 'unavailable'); assert.equal(a.pitch, false);
  // each register says the same thing its own way
  assert.ok(a.bee.includes('level 0 of 5 · silent, still static') && a.bee.includes(a.scale) && a.bee.includes(a.instrument));
  assert.match(a.beeNow, /7 is under 1,000, so its song is still silent static/); assert.deepEqual(a.beePlay, ['silent below 1,000', true]);
  assert.match(facts.raver.hint, new RegExp('^7 · L0 · ' + a.notes.length + ' notes')); assert.equal(facts.raver.mine, '0'); assert.equal(facts.raver.dots, a.notes.length, 'one star per note');
  assert.match(facts.raver.card, /still static · no music below 1,000/);
  const c = facts.cypherpunk;
  assert.ok(c.draw.includes('lvlOf(7) = 0') && c.draw.includes(a.scale) && c.draw.includes(a.instrument)); assert.match(c.draw, /page default · live read unavailable/);
  assert.equal(c.noteRows, a.notes.length); assert.match(c.pitchT, /not read · the live read failed; nothing is invented/);
  assert.deepEqual(c.fail, ['getMeta · live', 'perform · web audio'], 'the pipeline marks the silent read and the silent level');
});

test('bee: choose a number, then listen and stop — through the page\'s own read and play', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b [role="radio"][data-seed="1500000"]');
  await p.waitForFunction(() => window.S.seed === 1500000 && window.__eternal.data.tier === 5);
  assert.equal(await p.inputValue('#in'), '1500000', 'the number went through the page\'s own field');
  assert.equal(await p.getAttribute('.et-b [role="radio"][data-seed="1500000"]', 'aria-checked'), 'true');
  assert.equal(await p.textContent('#etBeePlay'), 'listen · the 3:33 journey');
  assert.equal((await score(p)).sounding, false, 'choosing plays nothing');
  await p.click('#etBeePlay');
  await p.waitForFunction(() => window.sounding && window.actx && window.playMode === 'container');
  assert.match(await p.textContent('#voice'), /the container runs/, 'the page\'s own control is the one that runs');
  assert.match(await p.textContent('#etBeeNow'), /playing 1,500,000/);
  await p.click('#etBeePlay');
  await p.waitForFunction(() => !window.sounding && !window.actx);
  await p.fill('#etBeeSeed', '25000'); await p.press('#etBeeSeed', 'Enter');
  await p.waitForFunction(() => window.S.seed === 25000 && window.__eternal.data.tier === 2);
  assert.match(await p.textContent('.et-b .et-b-rows'), /level 2 of 5 · a melody and a low drone/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a ring to climb, a short hold plays nothing, a full hold plays; the heart stops it; motion pauses', async () => {
  const { ctx, p, errs } = await open('raver');
  await ringClick(p, 3);
  await p.waitForFunction(() => window.S.seed === 105000 && window.__eternal.data.seed === 105000 && window.__eternal.data.tier === 3);
  assert.equal(await p.getAttribute('#etRes .et-l-ring[data-k="3"]', 'class'), 'et-l-ring mine sel');
  assert.match(await p.textContent('#etRaverCard'), /L3.*melody, drone and an echo.*from 105,000 whole tokens/);
  await hold(p, 400);
  assert.equal((await score(p)).sounding, false, 'a short hold plays nothing');
  await hold(p, 1500);
  await p.waitForFunction(() => window.sounding && document.getElementById('etTurn').classList.contains('go'));
  assert.equal(await p.textContent('#etRaverTitle'), 'it sings');
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('etTurn')).animationPlayState), 'paused');
  await p.click('#etRes .et-l-heart');
  await p.waitForFunction(() => !window.sounding);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  await ringClick(r.p, 5);
  await r.p.waitForFunction(() => window.S.tier === 5 && window.__eternal.data.tier === 5);
  assert.equal(await r.p.$eval('#etHold', b => b.disabled), true, 'reduced motion: the hold is off');
  await r.p.click('#etRes .et-l-heart', { force: true });
  await r.p.waitForTimeout(300);
  assert.equal((await score(r.p)).sounding, false, 'reduced motion: the score rests silent');
  assert.equal(await r.p.textContent('#etHoldLbl'), 'resting · less motion');
  await r.ctx.close();
});

test('cypherpunk: the score is an instrument at first paint; resolve, perform, bare score and the swap hand off', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ draw: document.querySelectorAll('#etDraw tr').length, steps: document.querySelectorAll('#etPipe li').length, pitch: document.querySelectorAll('#etPitch tr').length,
    verify: document.getElementById('etVerify').textContent, extra: window.__eternal.data.extra, links: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel), play: document.getElementById('etCyPlay').disabled }));
  assert.equal(d.draw, 8); assert.equal(d.steps, 6); assert.equal(d.pitch, 4);
  assert.ok(d.verify.includes('0xc3f4552a' + (7).toString(16).padStart(64, '0') + d.extra.slice(2)), 'the verify command carries getMeta(seed, extra)');
  assert.deepEqual(d.links, ['noopener noreferrer', 'noopener noreferrer']); assert.equal(d.play, true, 'level zero: perform is off');
  await p.fill('#etCyIn', '1500000'); await p.click('#etCyResolve');
  await p.waitForFunction(() => window.S.tier === 5 && /level 5/.test(document.getElementById('etChips').textContent));
  await p.click('#etCyPlay');
  await p.waitForFunction(() => window.sounding && window.playMode === 'container' && /container · 162 bpm/.test(document.getElementById('etChips').textContent));
  await p.click('#etCyPlay');
  await p.waitForFunction(() => !window.sounding);
  await p.click('#etCyBare');
  await p.waitForFunction(() => window.sounding && window.playMode === 'score' && /bare score/.test(document.getElementById('etChips').textContent));
  await p.click('#etCyPlay');
  await p.waitForFunction(() => !window.sounding);
  await p.click('#etCySwap');
  assert.deepEqual(await p.evaluate(() => [document.getElementById('swapmodal').hidden, document.getElementById('sw-trade').hidden, typeof window.ethereum]), [false, true, 'undefined'], 'the swap popup opens at its connect step; nothing connects');
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
