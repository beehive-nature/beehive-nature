// bset-eternal.test.mjs — "the set the founder builds to" as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress; all three carry the SAME facts, re-derived from the page's own parse of #setdata
// (window.__bset): 100 songs, ru 23 · uk 1 · other 76, the wolf at 21, the same order, the same
// fnv-1a seeds and the same links as the list below; every "play" is a user-pressed link into his
// playlist in a new tab (nothing plays, embeds or leaves the page on its own); the raver record is
// scratched by a real pointer and pauses; the cypherpunk copy hands off to the page's own share.
// Run: node --test e2e/bset-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bset.html> node --test e2e/bset-eternal.test.mjs
const PAGE = 'bset.html', PORT = 9262;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// the source of record, read independently of the page's script
const SRC = await readFile(join(ROOT, 'surfaces', PAGE), 'utf8');
const SET = JSON.parse(SRC.match(/<script type="application\/json" id="setdata">([\s\S]*?)<\/script>/)[1]);
const COUNT = { ru: 0, uk: 0, other: 0 }; SET.tracks.forEach(t => COUNT[t.lang === 'ru' ? 'ru' : t.lang === 'uk' ? 'uk' : 'other']++);

async function open(reg, { reduced = false, clip = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (clip) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#etBeeRows .et-b-row[data-k]'), null, { timeout: 8000 });
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const LAWS = () => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)|\[object/.test(own)) out.push('bad value ' + el.className + ' ' + own);
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
    if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
  }
  if (document.documentElement.scrollWidth > innerWidth || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  return out;
};

test('one front per register, each in its own dress, the same facts, and the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, t = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        primaries: fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary').length,
        model: [D.tracks.length, D.counted.ru, D.counted.uk, D.counted.other, D.wolf], order: D.tracks.map(x => x.url),
        page: [...document.querySelectorAll('#tracks .track .tl a')].map(a => a.href),
        beeRows: t('#etBeeRows .et-b-row'), dots: ['ru', 'uk', 'other'].map(g => document.querySelectorAll('#etDisc .dot.' + g).length), legend: t('#etLegend span').join(' | '),
        counts: t('#etCounts tr'), recs: [...document.querySelectorAll('#etRecords tr')].map(r => [r.cells[0].textContent, r.cells[1].textContent, r.cells[2].textContent, r.querySelector('a').href]),
        fnv: D.tracks.slice(0, 10).map(x => ('00000000' + (window.__bset.fnv(x.artist + ' — ' + x.title) >>> 0).toString(16)).slice(-8)),
        playlist: [document.getElementById('etBeePlay').href, document.getElementById('etCySource').href], iframes: document.querySelectorAll('iframe,audio,video').length };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one filled action');
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' laws');
    assert.equal(d.iframes, 0, 'nothing embedded, nothing to play here');
    assert.deepEqual(outside, [], reg + ': nothing left the origin on arrival');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee;
  // the model is the source of record, re-derived
  assert.deepEqual(a.model, [SET.tracks.length, COUNT.ru, COUNT.uk, COUNT.other, 21]);
  assert.deepEqual([SET.count, SET.counts.ru, SET.counts.uk, SET.counts.other], [100, 23, 1, 76], 'the declared counts');
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(facts[reg].model, a.model); assert.deepEqual(facts[reg].order, a.order); }
  // the same order and links as the list below
  assert.deepEqual(a.order, a.page, 'every front link is the list\'s own link, in the list\'s order');
  // bee counts in words
  assert.deepEqual(a.beeRows, ['every song100 songs', 'sung in russian23 songs', 'sung in ukrainian1 song', 'everything else76 songs', 'the wolfsong 21']);
  // raver: one cell per song, coloured by the same tags; the legend names every colour
  assert.deepEqual(a.dots, [23, 1, 76]); assert.match(a.legend, /russian · 23.*ukrainian · 1.*everything else · 76.*the wolf · 21/);
  // cypherpunk: declared vs counted, the order and the page's own fnv seed
  assert.match(a.counts.join(' | '), /tracksdeclared 100 · counted 100 ✓ match/);
  assert.match(a.counts.join(' | '), /rudeclared 23 · counted 23 ✓ match.*ukdeclared 1 · counted 1 ✓ match.*otherdeclared 76 · counted 76 ✓ match/);
  assert.deepEqual(a.recs.map(r => r[0]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(a.recs.map(r => r[2]), a.fnv, 'the fnv column is the page\'s own sigil seed');
  assert.deepEqual(a.recs.map(r => r[3]), a.page.slice(0, 10));
  assert.deepEqual(a.playlist, [SET.playlist, SET.playlist], 'the one action opens the source of record');
});

test('bee: rows open to songs; every play is a user-pressed link to a new tab, nothing plays here', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await p.click('.et-b-row[data-k="ru"]');
  const ru = await p.evaluate(() => { const o = document.querySelector('.et-b-open[data-k="ru"]'); return { hidden: o.hidden, links: [...o.querySelectorAll('a')].map(a => [a.href, a.target, a.rel]), more: o.querySelector('.et-b-more').textContent }; });
  assert.equal(ru.hidden, false);
  assert.equal(ru.links.length, 5); assert.match(ru.more, /and 18 more in the list below/);
  const firstRu = SET.tracks.filter(t => t.lang === 'ru').slice(0, 5).map(t => `https://www.youtube.com/watch?v=${t.id}&list=${SET.playlist.split('list=')[1]}`);
  assert.deepEqual(ru.links.map(l => l[0]), firstRu);
  assert.ok(ru.links.every(l => l[1] === '_blank' && l[2] === 'noopener noreferrer'), 'new tab, no opener');
  await p.click('.et-b-row[data-k="wolf"]');
  assert.match(await p.textContent('.et-b-open[data-k="wolf"]'), /I'm The Wolf.*Domin8.*song 21 of 100/);
  const prim = await p.$eval('#etBeePlay', a => [a.target, a.rel, a.textContent.trim()]);
  assert.deepEqual(prim.slice(0, 2), ['_blank', 'noopener noreferrer']); assert.match(prim[2], /open his playlist/);
  assert.match(await p.textContent('.et-b'), /opens in a new tab/);
  assert.equal(await p.evaluate(() => document.querySelectorAll('audio,video,iframe').length), 0);
  assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: scratching the record picks the nearest song; the pill follows; the spin pauses and is still under reduced motion', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), 21, 'the needle rests on the wolf');
  assert.match(await p.textContent('#etRaverCard'), /21I'm The Wolf/);
  // tap straight on song 1's cell (the disc spins: tap by position, force, then assert the tap landed)
  await p.$eval('#etDisc', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const b = await p.$eval('#etDisc .dot[data-n="1"]', d => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(b.x, b.y); await p.mouse.down(); await p.mouse.up();
  const sel = await p.evaluate(() => window.__eternal.raver.sel);
  assert.ok(sel >= 1 && sel <= 3, 'the tap landed on the rim, where the record starts (got ' + sel + ')');
  const pill = await p.$eval('#etRaverPlay', a => [a.href, a.target, a.rel, a.textContent.trim()]);
  const listHref = await p.evaluate(n => document.querySelectorAll('#tracks .track .tl a')[n - 1].href, sel);
  assert.equal(pill[0], listHref, 'the pill is the list\'s own link for that song');
  assert.deepEqual(pill.slice(1, 3), ['_blank', 'noopener noreferrer']); assert.match(pill[3], new RegExp('play song ' + sel));
  await p.focus('#etDisc'); await p.keyboard.press('ArrowRight');
  assert.equal(await p.evaluate(() => window.__eternal.raver.sel), sel + 1, 'the arrow keys move the needle too');
  assert.equal(await p.$eval('#etDisc', s => s.getAttribute('aria-valuenow')), String(sel + 1));
  assert.equal(await p.$eval('#etDisc .spin', g => getComputedStyle(g).animationPlayState), 'running');
  await p.click('#etSpin');
  assert.equal(await p.$eval('#etDisc .spin', g => getComputedStyle(g).animationPlayState), 'paused');
  assert.equal(await p.$eval('#etSpin', b => b.getAttribute('aria-pressed')), 'true');
  const dur = await p.$eval('#etDisc .spin', g => parseFloat(getComputedStyle(g).animationDuration));
  assert.ok(dur >= 1 / 3, 'under 3 Hz: one turn takes ' + dur + ' s');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduced: true });
  assert.equal(await still.p.$eval('#etDisc .spin', g => getComputedStyle(g).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the dataset is complete at first paint; filters re-derive; copy hands off to the page\'s share', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { clip: true });
  const d = await p.evaluate(() => ({ kv: document.querySelectorAll('#etCounts tr').length, recs: document.querySelectorAll('#etRecords tr').length, pipe: document.querySelectorAll('#etPipe li').length,
    path: document.getElementById('etPath').textContent, fork: [...document.querySelectorAll('.et-c a')].filter(a => /fork/.test(a.textContent)).map(a => [a.target, a.rel, a.href])[0] }));
  assert.equal(d.kv, 9); assert.equal(d.recs, 10); assert.equal(d.pipe, 6);
  assert.equal(d.path, 'bset://for the wOlf · 100 records');
  assert.deepEqual(d.fork, ['_blank', 'noopener noreferrer', 'https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/bset.html']);
  await p.click('#etSeg button[data-f="ru"]');
  assert.deepEqual(await p.$$eval('#etRecords tr', r => [...new Set(r.map(x => x.cells[1].textContent))]), ['ru']);
  await p.click('#etMore');
  assert.equal(await p.$$eval('#etRecords tr', r => r.length), 23, 'all 23 tagged ru');
  await p.click('#etSeg button[data-f="uk"]');
  assert.deepEqual(await p.$$eval('#etRecords tr', r => r.map(x => x.cells[0].textContent)), ['5']);
  assert.equal(await p.$eval('#etMore', b => b.hidden), true);
  await p.click('#etCyShare'); await p.waitForTimeout(900);
  assert.equal(await p.textContent('#share'), '✓ copied as text', 'the page\'s own share did the copy');
  assert.match(await p.textContent('#etShareNote'), /the page says: ✓ copied as text/);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip.split('\n').length, 101, 'the copy is the whole set, one line per song');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
