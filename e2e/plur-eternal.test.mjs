// plur-eternal.test.mjs — PLUR's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress; all
// three carry the SAME facts (the word cards the page carries, the voices the page's bvoice module
// found, the tutor's real state); and no gesture speaks or sends on its own — a word is heard only by
// pressing the page's own card, the pair only by #vsalam, and the conversation is the page's #talk.
// A deterministic fake speech engine stands in for the browser's voices (no audio path is opened).
// Run: node --test e2e/plur-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8928, ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === '/surfaces/plur.html' ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([r, voices]) => {
    try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.motion.paused'); } catch {}
    window.__spokes = [];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    const stub = { _voices: voices, getVoices() { return this._voices; }, cancel() {}, speak(u) { window.__spokes.push(u.text); setTimeout(() => { if (u.onend) u.onend(); }, 5); } };
    Object.defineProperty(window, 'speechSynthesis', { value: stub, writable: true, configurable: true });
  }, [reg, opts.voices || []]);
  const sent = [];
  await ctx.route('**/*', r => { const q = r.request(); if (!q.url().startsWith(ORIGIN)) sent.push(q.method() + ' ' + q.url());
    if (q.url() === 'https://api.anthropic.com/v1/messages') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"type":"authentication_error"}}' });
    return q.url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/plur.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.total > 0, null, { timeout: 15000 });
  return { ctx, p, errs, sent };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const VOICES = [{ name: 'Hebrew Local', lang: 'he-IL' }, { name: 'Arabic Local', lang: 'ar-SA' }, { name: 'Latvian Local', lang: 'lv-LV' }];

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeStart', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRaverTalk', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyTalk', action: 'rgb(69, 194, 220)' },
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
    assert.equal(d.h1, 1, reg + ': the floor keeps its one h1');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the words, the tongues, the voices, the tutor', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { voices: VOICES });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        d: [D.fields.map(f => [f.key, f.n, f.tongues, f.voiced]), D.total, D.tongues, D.voiced, D.pair, D.tutor],
        page: ['peace', 'love', 'unity', 'respect'].map(k => [document.querySelectorAll(`.field.f-${k} .w`).length, document.querySelectorAll(`.field.f-${k} .w:not(.novoice)`).length]),
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), beeNow: t('#etBeeNow'),
        stars: document.querySelectorAll('#etStars .star').length, filled: document.querySelectorAll('#etStars .star:not(.mute)').length, hint: t('#etRaverHint'),
        fields: [...document.querySelectorAll('#etFields tr')].slice(1).map(r => [...r.children].map(c => c.textContent)),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(facts.raver.d, a.d); assert.deepEqual(facts.cypherpunk.d, a.d);
  assert.deepEqual(a.d[0].map(f => [f[1], f[3]]), a.page, 'the counts are the page\'s own cards and voices');
  assert.equal(a.d[1], 76); assert.ok(a.d[3] > 0, 'the stub voices light some words'); assert.equal(a.d[4], true, 'a Hebrew or Arabic voice exists'); assert.equal(a.d[5], 'not verified');
  // each register draws the same corpus its own way
  assert.deepEqual(a.beeRows.map(r => r.match(/\d+/)[0]), a.d[0].map(f => String(f[1])));
  assert.match(a.beeNow, new RegExp(`say ${a.d[3]} of these 76 words`));
  assert.equal(facts.raver.stars, 76, 'one star per word'); assert.equal(facts.raver.filled, a.d[3], 'filled stars are the voiced words');
  assert.match(facts.raver.hint, new RegExp(`76 words · ${a.d[2]} tongues · ${a.d[3]} with a voice`));
  assert.deepEqual(facts.cypherpunk.fields.at(-1), ['total', '76', String(a.d[2]), `${a.d[3]}/76`]);
});

test('without voices every register says so plainly, and nothing pretends to speak', async () => {
  const { ctx, p } = await open('bee');
  assert.equal(await p.evaluate(() => window.__eternal.data.voiced), 0);
  assert.match(await p.textContent('#etBeeNow'), /no voices for these words yet/);
  await ctx.close();
  const c = await open('cypherpunk');
  assert.equal(await c.p.$eval('#etCyPair', b => b.disabled), true, 'the pair hand-off is honestly off');
  assert.match(await c.p.textContent('#etReceipt'), /no Hebrew or Arabic voice/);
  await c.ctx.close();
});

test('bee: the one action walks to the page\'s own words; the talk link opens the conversation', async () => {
  const { ctx, p, errs, sent } = await open('bee');
  await p.click('#etBeeStart');
  await p.waitForFunction(() => { const r = document.getElementById('words').getBoundingClientRect(); return r.top > -40 && r.top < 200; });
  assert.equal(await p.evaluate(() => document.activeElement.classList.contains('w') && document.activeElement.closest('.f-peace') !== null), true, 'focus lands on the first peace card');
  await p.click('.et-b-link[data-go="talk"]');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'say');
  assert.equal(await p.evaluate(() => window.__spokes.length), 0, 'nothing spoke');
  assert.deepEqual(sent, [], 'nothing was sent');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a field, tap a word: the page\'s own card speaks it, or it says it has no voice', async () => {
  const { ctx, p, errs, sent } = await open('raver', { voices: VOICES });
  await p.click('#etStars .field-w[data-k="0"]', { force: true }); // the sky turns (3 minutes); a tap lands anyway
  assert.match(await p.textContent('#etRaverCard'), /peace/);
  const chips = await p.$$eval('#etChipsR button', bs => bs.map(b => [b.textContent, b.classList.contains('mute')]));
  assert.equal(chips.length, 22);
  const he = chips.findIndex(c => c[0] === 'שלום'), ru = chips.findIndex(c => c[0] === 'мир');
  await p.click(`#etChipsR button[data-w="${he}"]`);
  await p.waitForFunction(() => window.__spokes.includes('שלום'));
  assert.match(await p.textContent('#etRaverCard'), /shalom · hebrew · sent to your voice/);
  await p.click(`#etChipsR button[data-w="${ru}"]`);
  assert.match(await p.textContent('#etRaverCard'), /no voice for this tongue here/);
  assert.equal(await p.evaluate(() => window.__spokes.filter(w => w === 'мир').length), 0, 'a silent tongue is never faked');
  await p.click('#etRaverTalk');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'say');
  await p.click('#etMotion');
  assert.equal(await p.evaluate(() => document.body.classList.contains('et-still') && getComputedStyle(document.querySelector('.et-r-turn')).animationPlayState), 'paused');
  assert.deepEqual(sent, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const r = await open('raver', { reduce: true });
  assert.equal(await r.p.evaluate(() => getComputedStyle(document.querySelector('.et-r-turn')).animationName), 'none', 'still under reduced motion');
  await r.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; the tutor state follows the real reply', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { voices: VOICES });
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etFields tr').length, steps: document.querySelectorAll('#etPipe li').length,
    receipt: document.querySelectorAll('#etReceipt tr').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    fork: [...document.querySelectorAll('#eternal .et-c a[target="_blank"]')].map(a => a.rel),
  }));
  assert.equal(d.rows, 6); assert.equal(d.steps, 4); assert.equal(d.receipt, 6);
  assert.match(d.now, /ai provider/); assert.deepEqual(d.fork, ['noopener noreferrer']);
  await p.click('#etCyPair');
  await p.waitForFunction(() => window.__spokes.length === 2);
  assert.deepEqual(await p.evaluate(() => window.__spokes), ['שלום', 'سلام'], 'the pair is the page\'s own #vsalam');
  await p.click('#etCyTalk');
  await p.fill('#say', 'Synthetic offline test'); await p.click('#send'); // the reader sends; the provider refuses (401 here)
  await p.waitForFunction(() => window.__eternal.data.tutor === 'unavailable');
  assert.match(await p.textContent('#etReceipt'), /tutor\s*unavailable/);
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
