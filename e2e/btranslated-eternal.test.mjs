// btranslated-eternal.test.mjs — "your name in your tongue" as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in
// its own dress; all three carry the SAME facts from the page's own picker, father-set table and
// renderings (six tongues; ru and ar founder-hardwired; ar right to left; every path ends at lovis.b);
// choosing only previews (nothing is stored), and the one keep goes through the page's own picker, so
// its save() is the only writer of btranslated_pref; Arabic is drawn right to left in every front, and
// the fronts keep the laws on a right-to-left page too. Run: node --test e2e/btranslated-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/btranslated.html> node --test e2e/btranslated-eternal.test.mjs
const PAGE = 'btranslated.html', PORT = 9264;
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

async function open(reg, { lang = null, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); if (l) localStorage.setItem('blang', l); } catch {} }, [reg, lang]);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#etBeeRows .et-b-row'), null, { timeout: 8000 });
  return { ctx, p, errs, outside };
}
const stored = p => p.evaluate(() => localStorage.getItem('btranslated_pref'));
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

test('one front per register, its own dress, the same six tongues and the same canonical name', async () => {
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
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data;
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        primaries: fr.querySelectorAll('.et-b-primary,.et-r-pill,.et-c-primary').length,
        model: D.tongues.map(t => [t.code, t.native, t.speakers, t.dir, t.hard]), name: D.name,
        picker: [...document.getElementById('father').options].map(o => o.value),
        table: [...document.querySelectorAll('main section table tbody tr')].map(r => [r.cells[1].textContent, r.cells[2].textContent]),
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.querySelector('bdi').textContent),
        petals: [...document.querySelectorAll('#etSun .petal')].map(g => [g.dataset.code, g.classList.contains('hard')]), heart: document.querySelector('#etSun .cn').textContent,
        rows: [...document.querySelectorAll('#etSet tr.pick')].map(r => [r.cells[0].textContent, r.cells[2].textContent]),
        path: document.getElementById('etPath').textContent, beePath: document.querySelector('#etBeePath .to').textContent };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.primaries, 1, reg + ': one filled action');
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' laws');
    assert.equal(await stored(p), null, reg + ': arrival stores nothing');
    assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model.map(t => t[0]), a.picker, 'the tongues are the page\'s own picker');
  assert.deepEqual(a.model.map(t => t[0]), ['en', 'es', 'hi', 'cmn', 'ru', 'ar']);
  assert.deepEqual(a.model.filter(t => t[3] === 'rtl').map(t => t[0]), ['ar'], 'the table says Arabic runs right to left');
  assert.deepEqual(a.model.filter(t => t[4]).map(t => t[0]), ['ru', 'ar'], 'founder-hardwired, from the picker');
  a.table.forEach(([code, sp]) => assert.equal(a.model.find(t => t[0] === code)[2], sp, code + ' speakers from the table'));
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model);
  assert.deepEqual(a.bee, a.model.map(t => t[1]));
  assert.deepEqual(a.petals, a.model.map(t => [t[0], t[4]]));
  assert.deepEqual(a.rows, a.model.map(t => [t[0], t[2]]));
  assert.equal(a.name, 'lovis.b'); assert.equal(a.heart, 'lovis.b'); assert.equal(a.beePath, 'lovis.b'); assert.equal(a.path, 'btranslated://lovis.b → canonical');
});

test('bee: choosing Arabic previews it right to left and stores nothing; keep goes through the page\'s own save', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b-row[data-code="ar"]'); await p.click('.et-b-row[data-code="hi"]'); await p.click('.et-b-row[data-code="ar"]');
  assert.equal(await stored(p), null, 'previews store nothing');
  const card = await p.evaluate(() => { const d = document.querySelector('#etBeePath div'); return { dir: d.getAttribute('dir'), lang: d.getAttribute('lang'), css: getComputedStyle(d).direction, first: d.querySelector('p').textContent, want: window.__btranslated.STR.alias.ar, draft: document.querySelector('#etBeePath .draft').textContent }; });
  assert.deepEqual([card.dir, card.lang, card.css], ['rtl', 'ar', 'rtl']);
  assert.equal(card.first, card.want, 'the page\'s own Arabic rendering');
  assert.match(card.draft, /machine draft/);
  assert.match(await p.textContent('#etBeeNow'), /nothing is kept yet/);
  await p.click('#etBeeKeep');
  const s = JSON.parse(await stored(p));
  assert.deepEqual(s, { father: 'ar', mother: '', students: [] }, 'the page\'s save() wrote its own shape');
  assert.equal(await p.$eval('#father', e => e.value), 'ar');
  assert.match(await p.textContent('#prefState'), /father=ar/, 'the page below agrees');
  assert.equal(await p.textContent('#flow .fnode .fk'), (await p.evaluate(() => window.__btranslated.STR.alias.ar)) + '⚙ machine draft');
  assert.match(await p.textContent('#etBeeNow'), /kept on this device: العربية/);
  const src = await p.$eval('#eternal-js', e => e.textContent);
  assert.doesNotMatch(src, /setItem|removeItem|fetch\(|XMLHttpRequest|sendBeacon/, 'the front never writes storage or sends anything itself');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a petal to preview; a short hold keeps nothing, a full hold keeps it; the glow pauses', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.$eval('#etSun', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const c = await p.$eval('#etSun .petal[data-code="ru"] path', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(c.x, c.y);
  assert.equal(await p.evaluate(() => window.__eternal.pick.pick), 'ru', 'the tap landed on the Russian petal');
  assert.match(await p.textContent('#etRaverCard'), /ru/);
  await p.click('#etSun .petal[data-code="ar"] path', { force: true });
  assert.equal(await p.evaluate(() => window.__eternal.pick.pick), 'ar');
  assert.equal(await p.$eval('#etRaverCard b', b => [b.getAttribute('dir'), getComputedStyle(b).direction].join()), 'rtl,rtl', 'Arabic drawn right to left');
  assert.equal(await p.$eval('#etSun .petal[data-code="ar"] tspan', t => t.getAttribute('dir')), 'rtl');
  assert.equal(await stored(p), null);
  await p.$eval('#etRaverKeep', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); // clear of the fixed tour bar
  const b = await p.locator('#etRaverKeep').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await stored(p), null, 'a short hold keeps nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(JSON.parse(await stored(p)).father, 'ar', 'the full hold kept it, through the page');
  assert.match(await p.textContent('#etRaverKeepL'), /kept here · العربية/);
  assert.equal(await p.$eval('#etSun .petal.on', g => getComputedStyle(g).animationPlayState), 'running');
  await p.click('#etSway');
  assert.equal(await p.$eval('#etSun .petal.on', g => getComputedStyle(g).animationPlayState), 'paused');
  assert.ok(await p.$eval('#etSun .petal.on', g => parseFloat(getComputedStyle(g).animationDuration)) >= 1 / 3, 'under 3 Hz');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await open('raver', { reduced: true });
  assert.equal(await still.p.$eval('#etSun .petal.on', g => getComputedStyle(g).animationName), 'none', 'still under reduced motion');
  await still.ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; a row picks; write pref is the page\'s save', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etSet tr.pick').length, pipe: document.querySelectorAll('#etPipe li').length, kv: document.querySelectorAll('#etReceipt tr').length,
    links: [...document.querySelectorAll('.et-c a')].map(a => [a.target, a.rel, a.href]), receipt: document.getElementById('etReceipt').textContent }));
  assert.equal(d.rows, 6); assert.equal(d.pipe, 4); assert.equal(d.kv, 8);
  assert.match(d.receipt, /storednothing stored yet/);
  assert.deepEqual(d.links, [['_blank', 'noopener noreferrer', 'https://github.com/beehive-nature/beehive-nature/blob/main/docs/register/FATHER-SET-1.md'], ['_blank', 'noopener noreferrer', 'https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/btranslated.html']]);
  await p.click('#etSet tr[data-code="ar"]');
  assert.equal(await p.$eval('#etPipe li p', e => [e.getAttribute('dir'), e.textContent].join('|')), 'rtl|' + await p.evaluate(() => window.__btranslated.STR.alias.ar));
  assert.equal(await p.textContent('#etCyWrite'), 'write pref · father=ar');
  assert.equal(await stored(p), null);
  await p.click('#etCyWrite');
  assert.equal(JSON.parse(await stored(p)).father, 'ar');
  assert.match(await p.textContent('#etReceipt'), /stored\{"father":"ar","mother":"","students":\[\]\}/);
  assert.match(await p.textContent('#etReceipt'), /pickar · ✓ stored/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('on a right-to-left page the fronts keep every law', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { lang: 'ar' });
    await p.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 8000 });
    assert.deepEqual(await p.evaluate(LAWS), [], reg + ' rtl laws');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});
