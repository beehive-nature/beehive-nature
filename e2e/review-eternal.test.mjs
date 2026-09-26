// review-eternal.test.mjs — the Royal Review's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts (the deck's own roster, verdicts, note limit, bind state and tally,
// exported as window.ReviewDeck); and every gesture hands off to the page's own composer: the
// fields land in #surf / #verdict / #rnote, #mkReview writes the draft, #cpReview copies it, and
// nothing is ever published. The receipt's ref is checked against sha256 computed here.
// Run: node --test e2e/review-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8976, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { lang = 'en', clip = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (clip) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); } catch {} }, [reg, lang]);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/review.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.ReviewDeck && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const composer = p => p.evaluate(() => ({ surf: document.getElementById('surf').value, verdict: document.getElementById('verdict').value, note: document.getElementById('rnote').value,
  out: getComputedStyle(document.getElementById('reviewOut')).display !== 'none' || document.getElementById('reviewOut').style.display === 'block' ? document.getElementById('reviewOut').textContent : '' }));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBGo', action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [FRONT[reg], w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the roster, the four marks, the limit, the bind state, the tally', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return { surfaces: D.surfaces, roster: [...document.getElementById('surf').options].map(o => o.value), verdicts: D.verdicts.map(v => v.value),
        page: [...document.getElementById('verdict').options].map(o => o.value), max: D.max, signed: D.signed, surface: D.surface,
        beeSel: [...document.getElementById('etBSurf').options].map(o => o.value), cySel: [...document.getElementById('etCSurf').options].map(o => o.value),
        beeMarks: document.querySelectorAll('#etBMarks [data-verdict]').length, tiles: document.querySelectorAll('#etRTiles [data-verdict]').length,
        stars: document.querySelectorAll('#etRSky circle[data-i]').length, card: document.getElementById('etRCard').textContent,
        tally: document.getElementById('etCTally').textContent, count: document.getElementById('etBCount').textContent };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.surfaces, a.roster, 'the one roster, read from the deck');
  assert.deepEqual([...a.verdicts].sort(), [...a.page].sort(), 'the four verdicts are the composer\'s own');
  assert.equal(a.max, 140); assert.equal(a.signed, false, 'nothing bound here: unsigned');
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['surfaces', 'verdicts', 'max', 'signed', 'surface']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  assert.deepEqual(a.beeSel, a.roster); assert.deepEqual(a.cySel, a.roster);
  assert.equal(a.beeMarks, 4); assert.equal(a.tiles, 4);
  assert.equal(a.stars, a.roster.length, 'one star per surface on the roster');
  assert.match(a.card, new RegExp('star 1 of ' + a.roster.length));
  assert.match(a.tally, new RegExp('roster' + a.roster.length + ' surfaces')); assert.match(a.tally, /receiptsnot read yet/, 'an unheard tally says so, never 0');
  assert.match(a.count, /0 of 140 characters/);
});

test('bee: the fields land in the real composer; its draft is shown; copy is the page\'s own', async () => {
  const { ctx, p, errs } = await open('bee', { clip: true });
  await p.selectOption('#etBSurf', 'read.html');
  await p.click('#etBMarks [data-verdict="💡 idea"]');
  await p.fill('#etBNote', 'the hold ring could say how long');
  assert.deepEqual((await composer(p)).surf, 'read.html');
  const c = await composer(p);
  assert.equal(c.verdict, '💡 idea'); assert.equal(c.note, 'the hold ring could say how long'); assert.equal(c.out, '', 'no draft before the action');
  assert.equal(await p.getAttribute('#mark-words [data-verdict="💡 idea"]', 'aria-pressed'), 'true', 'the page\'s own marks follow');
  await p.click('#etBGo');
  await p.waitForFunction(() => !document.getElementById('etBDraft').hidden, null, { timeout: 5000 });
  const out = await p.textContent('#reviewOut'), shownDraft = await p.textContent('#etBDraftTxt');
  assert.equal(shownDraft, out, 'the draft shown is exactly what the composer wrote');
  assert.match(out, /^\[bX review\] 💡 idea read\.html — .* — note: the hold ring could say how long\nUNSIGNED/);
  assert.match(await p.textContent('#etBDraftSay'), /nothing has been published/);
  await p.click('#etBCopy');
  await p.waitForFunction(() => !document.getElementById('review-copied').hidden, null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), out, 'the page copied its own draft');
  assert.match(await p.textContent('#etBDraftSay'), /copied/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee: a refused copy is never reported as copied', async () => {
  const { ctx, p } = await open('bee');
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  await p.click('#etBGo');
  await p.waitForFunction(() => !document.getElementById('etBDraft').hidden, null, { timeout: 5000 });
  await p.click('#etBCopy');
  await p.waitForFunction(() => !document.getElementById('review-copy-failed').hidden, null, { timeout: 5000 });
  assert.match(await p.textContent('#etBDraftSay'), /copy did not work/);
  assert.doesNotMatch(await p.textContent('#etBDraftSay'), /^copied/);
  await ctx.close();
});

test('raver: tap a star, light a mark; only a full hold drafts, and it drafts through the composer', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etRCard [data-step="1"]');
  const roster = await p.evaluate(() => window.ReviewDeck.surfaces);
  assert.equal((await composer(p)).surf, roster[1]);
  await p.click('#etRTiles [data-verdict="🐛 bug"]');
  assert.equal((await composer(p)).verdict, '🐛 bug');
  await p.fill('#etRNote', 'the rail went quiet');
  await p.locator('#etRHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etRHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal((await composer(p)).out, '', 'a short hold drafts nothing');
  assert.equal(await p.$eval('#etRGift', e => e.hidden), true);
  await p.mouse.down(); await p.waitForTimeout(1200); await p.mouse.up();
  await p.waitForFunction(() => !document.getElementById('etRGift').hidden, null, { timeout: 5000 });
  const c = await composer(p);
  assert.match(c.out, new RegExp('^\\[bX review\\] 🐛 bug ' + roster[1].replace(/[./]/g, '\\$&') + ' — .* — note: the rail went quiet'));
  assert.equal(await p.textContent('#etRGiftTxt'), c.out);
  assert.match(await p.textContent('#etRSay'), /nothing published/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the receipt, its ref and the pipeline are verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: [...document.querySelectorAll('#etCPipe li')].map(l => l.className), rec: document.querySelectorAll('#etCRec tr').length,
    fork: (() => { const a = [...document.querySelectorAll('.et-c a')].find(x => /fork/.test(x.textContent)); return a && [a.target, a.rel, a.href, a.textContent]; })() }));
  assert.equal(d.steps.length, 6); assert.equal(d.rec, 6);
  assert.equal(d.steps[1], 'guard', 'guest binding is the guard: unsigned, marked unverified');
  assert.deepEqual(d.fork.slice(0, 2), ['_blank', 'noopener noreferrer']); assert.match(d.fork[2], /surfaces\/blight\/pointers\.js$/); assert.match(d.fork[3], /opens in a new tab/);
  await p.selectOption('#etCSurf', 'blanguage.html'); await p.selectOption('#etCVerdict', '🕳 gap'); await p.fill('#etCNote', 'no tatar audio yet');
  await p.click('#etCGo');
  await p.waitForFunction(() => window.__eternal.data.ref, null, { timeout: 5000 });
  const r = await p.evaluate(() => ({ line: window.__eternal.data.line, ref: window.__eternal.data.ref, out: document.getElementById('reviewOut').textContent, rec: document.getElementById('etCRec').textContent }));
  assert.equal(r.line, r.out.split('\n')[0]);
  assert.match(r.line, /^\[bX review\] 🕳 gap blanguage\.html — .* — note: no tatar audio yet$/);
  assert.equal(r.ref, createHash('sha256').update(r.line).digest('hex').slice(0, 12), 'the ref a guard would cite, recomputed here');
  assert.match(r.rec, new RegExp('ref' + r.ref)); assert.match(r.rec, /publishednever by this page/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front, left to right and right to left', async () => {
  for (const [reg, lang] of [['bee', 'en'], ['raver', 'en'], ['cypherpunk', 'en'], ['bee', 'he'], ['cypherpunk', 'ar']]) {
    const { ctx, p } = await open(reg, { lang });
    if (lang !== 'en') await p.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 8000 });
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT|LABEL|SELECT|TEXTAREA)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg + ' ' + lang);
    await ctx.close();
  }
});
