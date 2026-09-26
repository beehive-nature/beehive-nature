// forge-room-eternal.test.mjs — the two-tab room as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each
// in its own dress and structure; all three carry the SAME facts, read from the room module's own
// state through window.__forgeRoom and from the room's own controls; an edit made in any front lands
// in the room's own controls (so it travels as a knob turn does); the one real action (a second tab)
// is a real link that opens room.html in a new tab; and no front claims sharing the module is not
// doing. This box refuses jsDelivr, so the room's real fallback ("this tab alone") is what renders
// here, and a held import shows the real "starting" state. Run: node --test e2e/forge-room-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9155, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const HTML = await readFile(join(ROOT, 'surfaces/forge/room.html'), 'utf8');
const CORE = new Function(HTML.match(/\/\/ ---- CORE START ----([\s\S]*?)\/\/ ---- CORE END ----/)[1] + '\nreturn {buildArt};')();
const CORPUS = JSON.parse(await readFile(join(ROOT, 'surfaces/lang-corpus.json'), 'utf8'));
const YJS = 'https://cdn.jsdelivr.net/npm/yjs@13.6.20/+esm';

async function open(reg, { hold = false, lang = null, settle = 'local' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); if (l) localStorage.setItem('blang', l); } catch {} }, [reg, lang]);
  const outside = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    outside.push(u);
    if (hold && u === YJS) return; // never answered: the room stays "starting"
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/forge/room.html`, { waitUntil: 'load' });
  await p.waitForFunction(m => window.__eternal && window.__eternal.data.ready && window.__eternal.data.mode === m, settle, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

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
      const vis = s => { const e = fr.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: vis('#etRmRows .et-b-row') && vis('canvas#etRmBee'), seats: vis('#etRmSeats') && fr.querySelectorAll('#etRmSeats .seat').length === 7, bench: vis('table.et-c-params') && fr.querySelectorAll('#etRmPipe li').length === 6 };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.seats, reg === 'raver'); assert.equal(d.bench, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [YJS], 'the only outside request is the room\'s own pinned Yjs import');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, from the room module; no front claims sharing it is not doing', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, F = window.__forgeRoom, t = s => { const e = document.querySelector(s); return (e.getBoundingClientRect().height ? e.innerText : e.textContent).replace(/\s+/g, ' ').trim(); };
      return { d: [D.mode, D.tabs, D.me === F.me, D.seed, D.cells, D.palette, D.live], meta: t('#meta'), err: t('#err'),
        rows: t('#etRmRows'), status: t('#etRmBeeStatus'), hint: t('#etRmHint'), seats: [...document.querySelectorAll('#etRmSeats .seat')].map(g => g.getAttribute('class').replace('seat ', '')),
        links: document.querySelectorAll('#etRmSeats a').length, receipt: t('#etRmReceipt'), pipe: [...document.querySelectorAll('#etRmPipe li')].map(l => l.className) };
    });
    await ctx.close();
  }
  const a = CORE.buildArt('hive-1000', { density: 11, hueBase: 168, hueDrift: 72, symmetry: 1 });
  const want = ['local', 1, true, 'hive-1000', a.meta.cells, a.meta.palette, true];
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.deepEqual(facts[reg].d, want, reg + ' reads the room');
  assert.match(facts.bee.meta, new RegExp('^' + a.meta.cells + ' cells · ' + a.meta.palette + ' · seed hive-1000$'), 'the room\'s own render agrees');
  assert.equal(facts.bee.err, 'Sharing is unavailable. You can still change the field in this tab.', 'the room itself fell back');
  assert.match(facts.bee.rows, new RegExp('Tabs in this room 1 · this tab alone the shared word “hive-1000” places in the field ' + a.meta.cells));
  assert.equal(facts.bee.status, facts.bee.err, 'bee says what the room says');
  assert.equal(facts.raver.hint, 'one hand · sharing is off here');
  assert.deepEqual(facts.raver.seats, ['me', 'off', 'off', 'off', 'off', 'off', 'off'], 'no open or lit seat while sharing is off');
  assert.equal(facts.raver.links, 0, 'no seat offers a tab that could not share');
  assert.match(facts.cypherpunk.receipt, /mode local · this tab only/); assert.match(facts.cypherpunk.receipt, /tabs seen none · presence is closed/);
  assert.match(facts.cypherpunk.receipt, new RegExp('cells ' + a.meta.cells + ' · painted ' + a.hexes.filter(h => h.gate).length));
  assert.deepEqual(facts.cypherpunk.pipe, ['fail', 'todo', 'todo', 'todo', 'todo', 'done'], 'the transport pipeline says where it stopped');
});

test('a held import is shown as starting: controls wait, nothing is claimed', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { hold: true, settle: 'starting' });
  const d = await p.evaluate(() => ({ live: window.__eternal.data.live, knob: document.getElementById('etRmInDensity').disabled, now: document.querySelector('#etRmPipe li.now b').textContent,
    first: document.querySelector('#etRmPipe li p').textContent, mode: document.querySelector('#etRmReceipt td').textContent, bee: document.getElementById('etRmBeeStatus').textContent }));
  assert.equal(d.live, false); assert.equal(d.knob, true, 'the bench waits with the room\'s own controls');
  assert.match(d.now, /^import/); assert.match(d.first, /loading/); assert.equal(d.mode, 'starting');
  assert.equal(d.bee, 'Starting the room…');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('an edit in any front lands in the room\'s own controls and its own render', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.locator('#etRmBeeDensity').evaluate(e => { e.value = '15'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(150);
  assert.equal(await p.inputValue('#pDensity'), '15'); assert.equal(await p.evaluate(() => window.__eternal.data.params.density), 15);
  await p.evaluate(() => document.getElementById('breg-raver').click()); await p.waitForTimeout(200);
  const bx = await p.locator('#etRmPad').boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.5); await p.mouse.down();
  await p.mouse.move(bx.x + bx.width * 0.25, bx.y + bx.height * 0.25, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('#pHue'), '90'); assert.equal(await p.inputValue('#pDensity'), '15');
  await p.click('#etRmMirror'); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('#pSym'), '0');
  await p.evaluate(() => document.getElementById('breg-cypherpunk').click()); await p.waitForTimeout(200);
  await p.fill('#etRmInSeed', 'two-hands'); await p.waitForTimeout(500);
  assert.equal(await p.inputValue('#seed'), 'two-hands');
  assert.match(await p.textContent('#meta'), /seed two-hands$/, 'the room\'s own render drew it');
  assert.match(await p.textContent('#etRmReceipt'), /seed"two-hands"/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the one real action: a second tab, opened by a real link, in a new tab', async () => {
  const { ctx, p, errs } = await open('bee');
  const links = await p.evaluate(() => ['#etRmBeeOpen', '#etRmRaverOpen', '#etRmCyOpen'].map(s => { const a = document.querySelector(s); return [a.getAttribute('href'), a.target, a.rel]; }));
  for (const l of links) assert.deepEqual(l, ['room.html', '_blank', 'noopener noreferrer']);
  const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('#etRmBeeOpen')]);
  await tab.waitForLoadState('load');
  assert.match(tab.url(), /\/surfaces\/forge\/room\.html$/);
  await tab.waitForFunction(() => window.__eternal && window.__eternal.data.mode === 'local', null, { timeout: 20000 });
  assert.notEqual(await tab.evaluate(() => window.__eternal.data.me), await p.evaluate(() => window.__eternal.data.me), 'a second tab is a second hand');
  assert.equal(await p.evaluate(() => window.__eternal.data.tabs), 1, 'and the first does not claim it joined: sharing is off here');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the room\'s own words translate in the front: its corpus keys, not new ones', async () => {
  const { ctx, p } = await open('bee', { lang: 'lv' });
  const d = await p.evaluate(() => ({ open: document.getElementById('etRmBeeOpen').textContent.trim(), status: document.getElementById('etRmBeeStatus').textContent.trim() }));
  assert.equal(d.open, CORPUS.strings['room.open'].lv); assert.equal(d.status, CORPUS.strings['room.loadError'].lv);
  await ctx.close();
});

test('the laws hold on the front: no dash, NaN or undefined for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined|null|\[object/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
