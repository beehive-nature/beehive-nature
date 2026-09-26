// attest-eternal.test.mjs — "one tongue, one evening" (the attestation campaign) as three products in
// one surface (founder blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 2). Proves at 390 px:
// exactly one front per register, each in its own dress, structure and gesture; all three carry the
// SAME facts, drawn from the page's own single read of lang-corpus.json (no second request); a corpus
// that cannot be read says so in all three (a failure, never a zero); and every "go" is a same-tab
// link to the DOCK workshop: nothing on the front signs or attests.
// Run: node --test e2e/attest-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9175, ORIGIN = `http://127.0.0.1:${PORT}`;
const CORPUS = JSON.parse(await readFile(join(ROOT, 'surfaces/lang-corpus.json'), 'utf8'));
const KEYS = Object.keys(CORPUS.strings), LANGS = CORPUS._meta.langs, ATT = CORPUS._meta.attested || {};
const PRI = ['ru', 'lv', 'uk', 'gd', 'cs', 'zh', 'ko', 'th', 'ar', 'nl-be'];
const DOCKED = Object.fromEntries(LANGS.map(c => [c, KEYS.filter(k => CORPUS.strings[k][c]).length]));
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { corpus = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], requests = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); }
    requests.push([r.request().resourceType(), u]);
    if (!corpus && /lang-corpus\.json\?v=9/.test(u)) return r.fulfill({ status: 503, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/attest.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.state !== 'pending', null, { timeout: 20000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs, outside, requests };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();

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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        radios: fr.querySelectorAll('[role="radio"]').length, stars: fr.querySelectorAll('svg.et-r-art [data-code]').length, table: !!fr.querySelector('table.et-c-tab') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.radios > 0, reg === 'bee'); assert.equal(d.stars > 0, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'no request left the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, from the page\'s single corpus read', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, requests } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return { model: D.langs.map(l => [l.code, l.n, l.pri, !!l.att]), tongues: D.tongues, keys: D.keys, signed: D.signed, pri: D.pri,
        bee: [...document.querySelectorAll('#etBeeRows [role="radio"]')].map(r => r.dataset.code), beeTally: document.querySelector('#etBeeTally').textContent,
        stars: [...document.querySelectorAll('#etArt [data-code]')].map(g => g.dataset.code), centre: document.querySelector('#etArt > text').textContent,
        board: [...document.querySelectorAll('#etBoard tr.pick')].map(r => [r.dataset.code, r.children[1].textContent]),
        lower: [...document.querySelectorAll('#board tr')].slice(1).map(r => r.children[1].textContent), tally: document.getElementById('tally').firstChild.textContent };
    });
    facts[reg].corpusReads = requests.filter(([, u]) => /lang-corpus\.json\?v=9/.test(u)).length;
    await ctx.close();
  }
  const a = facts.bee;
  for (const r of ['raver', 'cypherpunk']) for (const k of ['model', 'tongues', 'keys', 'signed', 'pri']) assert.deepEqual(facts[r][k], a[k], r + ' ' + k);
  assert.equal(a.tongues, LANGS.length); assert.equal(a.keys, KEYS.length); assert.equal(a.signed, Object.keys(ATT).length);
  assert.deepEqual(a.pri, PRI, 'the founder-ordered ten, from the page');
  for (const [c, n] of a.model.map(m => [m[0], m[1]])) assert.equal(n, DOCKED[c], c + ' lines, as Node counts them');
  assert.deepEqual(a.model.map(m => m[1] + ' / ' + KEYS.length), a.lower, 'the fronts and the board below agree line for line');
  assert.equal(a.tally.trim(), a.signed + ' / ' + a.tongues);
  assert.deepEqual(a.bee, PRI.filter(c => LANGS.includes(c)), 'bee asks first about the ten, in order');
  assert.match(a.beeTally, new RegExp('^' + a.signed + ' of ' + a.tongues + ' signed so far\\.$'));
  assert.equal(facts.raver.stars.length, LANGS.length, 'one star per tongue'); assert.equal(facts.raver.centre, String(a.signed));
  assert.deepEqual(facts.cypherpunk.board.map(b => b[0]), a.model.map(m => m[0]));
  for (const r of ['bee', 'raver', 'cypherpunk']) assert.equal(facts[r].corpusReads, 2, r + ': the page\'s own two reads; the fronts add none');
});

test('a corpus that cannot be read says so in all three: a failure, never a zero', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { corpus: false });
    const d = await p.evaluate(() => ({ state: window.__eternal.data.state, front: document.querySelector('#eternal').innerText }));
    assert.equal(d.state, 'failed');
    assert.match(d.front, reg === 'raver' ? /could not be read · a failure, never a zero/ : reg === 'bee' ? /could not be read just now\. a failure, never a zero/ : /not read · a failure, never a zero/);
    assert.doesNotMatch(d.front, /\b0 of \d+ signed|attested 0\/0|\b0 \/ 0/, reg + ': no zero drawn for an unread corpus');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('bee: pick your language; the one action is a same-tab link to the workshop', async () => {
  const { ctx, p, errs, requests } = await open('bee');
  const r0 = requests.length;
  await p.click('#etBeeRows [data-code="lv"]');
  assert.deepEqual(await p.$eval('#etBeeGo', a => [a.textContent, a.getAttribute('href'), a.target]), ['read latviešu in the workshop', 'blanguage.html#workshop', '']);
  await p.click('#etBeeMore');
  assert.equal(await p.$$eval('#etBeeRows [role="radio"]', r => r.length), LANGS.length, 'every tongue, on request');
  assert.deepEqual(requests.slice(r0).filter(([t]) => t !== 'font' && t !== 'stylesheet'), [], 'choosing fetched nothing');
  await p.click('#etBeeGo'); await p.waitForURL('**/surfaces/blanguage.html#workshop');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: every tongue a star, the ten joined in order; tap yours and carry it', async () => {
  const { ctx, p, errs } = await open('raver');
  const inner = await p.$$eval('#etArt [data-code] text', t => t.map(x => x.textContent));
  assert.deepEqual(inner, PRI.filter(c => LANGS.includes(c)), 'the ten are labelled on the inner ring, in order');
  await p.click('#etArt [data-code="uk"] circle >> nth=0');
  assert.equal(await p.getAttribute('#etArt [data-code="uk"]', 'aria-pressed'), 'true');
  assert.match(txt(await p.textContent('#etRaverCard')), new RegExp('українська · 3 of the ten.*machine draft · ' + DOCKED.uk.toLocaleString('en') + ' of ' + KEYS.length.toLocaleString('en') + ' lines'));
  assert.deepEqual(await p.$eval('#etRaverGo', a => [a.textContent, a.getAttribute('href')]), ['carry українська to the workshop', 'blanguage.html#workshop']);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; a row sets the pipeline', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etBoard tr.pick').length, steps: document.querySelectorAll('#etPipe li').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent,
    receipt: document.querySelectorAll('#etReceipt tr').length, links: [...document.querySelectorAll('.et-c a[href^="http"]')].map(a => [a.target, a.rel, /new tab/.test(a.textContent)]) }));
  assert.deepEqual([d.rows, d.steps, d.receipt], [LANGS.length, 6, 8]);
  assert.equal(d.now, 'open · blanguage.html#workshop → merge → ru');
  assert.ok(d.links.length === 2 && d.links.every(l => l[0] === '_blank' && l[1] === 'noopener noreferrer' && l[2]));
  await p.click('#etBoard tr.pick[data-code="gd"]');
  assert.equal(await p.textContent('#etPipe li.now b'), 'open · blanguage.html#workshop → merge → gd');
  assert.match(txt(await p.textContent('#etPipe')), /\{"attested":\{"gd":\{"by":"your name or silence","date":"YYYY-MM-DD"\}\}\}/);
  assert.match(txt(await p.textContent('#etReceipt')), Object.keys(ATT).length ? /attested\w/ : /attested\{\} · empty until a person signs/);
  await p.click('#etCyCall');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'copycall', 'the call\'s own copy button, focused, not pressed');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the screen edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20)); // a page's overflow-x:hidden must not hide a cut
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
