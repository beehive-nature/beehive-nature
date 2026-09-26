// forge-hexfield-eternal.test.mjs — hexfield as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress and structure; all three carry the SAME facts, read from the page's own CORE (buildArt,
// hashSeed) fed by the page's own controls, and equal to what the page's own render() reports in
// #meta; a change made in any front lands in the real controls and on the real stage; the art's
// sha256 in the receipt is the one Node recomputes from the CORE in this file; the breath is under
// 3 Hz, pausable and still under reduced motion; and "copied" is never drawn until the page's own
// #link handler reports it. Run: node --test e2e/forge-hexfield-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9154, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// the page's own CORE, run here in Node: the receipt's fingerprint must be recomputable outside the page
const HTML = await readFile(join(ROOT, 'surfaces/forge/hexfield.html'), 'utf8');
const CORE = new Function(HTML.match(/\/\/ ---- CORE START ----([\s\S]*?)\/\/ ---- CORE END ----/)[1] + '\nreturn {buildArt, hashSeed};')();

async function open(reg, { search = '', motion = 'no-preference', clipboard = 'grant', init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion });
  if (clipboard === 'grant') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  if (init) await ctx.addInitScript(init);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/forge/hexfield.html${search}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready, null, { timeout: 20000 });
  await p.waitForTimeout(500);
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
        rows: vis('.et-b-rows .et-b-row[data-row]'), pad: vis('canvas#etHxPad'), table: vis('table.et-c-params') && fr.querySelectorAll('#etHxPipe li').length === 7 };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee', 'plain rows are new bee\'s'); assert.equal(d.pad, reg === 'raver', 'the pad is raver\'s'); assert.equal(d.table, reg === 'cypherpunk', 'the bench is cypherpunk\'s');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, equal to the CORE and to the page\'s own render', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => { const e = document.querySelector(s); return (e.getBoundingClientRect().height ? e.innerText : e.textContent).replace(/\s+/g, ' ').trim(); };
      return { d: [D.seed, D.cells, D.drawn, D.rests, D.rings, D.palette, D.hash, D.link], meta: t('#meta'),
        bee: t('#etHxRows'), hint: t('#etHxHint'), legend: t('#etHxLegend'), receipt: t('#etHxReceipt'), path: t('#etHxPath') };
    });
    await ctx.close();
  }
  const a = CORE.buildArt('1000', { density: 11, hueBase: 168, hueDrift: 72, symmetry: 1 });
  const drawn = a.hexes.filter(h => h.gate).length, rings = a.hexes.filter(h => h.gate && h.stroke).length;
  const want = ['1000', a.meta.cells, drawn, a.meta.cells - drawn, rings, a.meta.palette, CORE.hashSeed('1000').toString(16).padStart(8, '0'),
    `${ORIGIN}/surfaces/forge/hexfield.html?seed=1000&density=11&hueBase=168&hueDrift=72&symmetry=1`];
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.deepEqual(facts[reg].d, want, reg + ' reads the CORE');
  const f = facts.bee, fam = a.meta.palette.split(' ')[0];
  assert.match(f.meta, new RegExp('^' + a.meta.cells + ' cells · ' + a.meta.palette + ' · seed "1000"'), 'the page\'s own render agrees');
  assert.match(f.bee, new RegExp('places in the field ' + a.meta.cells + '.*colour family ' + fam + '.*a mirror down the middle on.*“1000”'));
  assert.equal(facts.raver.hint, a.meta.cells + ' cells · ' + fam);
  assert.match(facts.raver.legend, /seed “1000” hue 168° density 11 drift 72/);
  assert.match(facts.cypherpunk.receipt, new RegExp('fnv1a 0x' + want[6] + ' cells ' + a.meta.cells + ' · painted ' + drawn + ' · rests ' + (a.meta.cells - drawn) + ' · rings ' + rings + ' palette ' + a.meta.palette));
  assert.equal(facts.cypherpunk.path, 'hexfield://1000?density=11&hueBase=168&hueDrift=72&symmetry=1');
});

test('a change in any front lands in the real controls and on the real stage', async () => {
  const { ctx, p, errs } = await open('bee', { search: '?seed=moth&density=9' });
  assert.equal(await p.evaluate(() => window.__eternal.data.seed), 'moth', 'a shared seed-link opens in the fronts');
  await p.fill('#etHxWord', 'river'); await p.waitForTimeout(500);
  assert.equal(await p.inputValue('#seed'), 'river');
  assert.match(await p.textContent('#meta'), /seed "river"/, 'the page\'s own render drew it');
  assert.equal(await p.evaluate(() => window.__eternal.data.seed), 'river');
  await p.evaluate(() => { localStorage.setItem('bregister', 'cypherpunk'); document.getElementById('breg-cypherpunk').click(); });
  await p.fill('#etHxInDensity', '17'); await p.press('#etHxInDensity', 'Tab'); await p.waitForTimeout(200);
  assert.equal(await p.inputValue('#pDensity'), '17');
  assert.match(await p.textContent('#etHxPath'), /density=17/);
  await p.evaluate(() => document.getElementById('breg-raver').click()); await p.waitForTimeout(200);
  const bx = await p.locator('#etHxPad').boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.25, bx.y + bx.height * 0.5); await p.mouse.down();
  await p.mouse.move(bx.x + bx.width * 0.75, bx.y + bx.height * 0.9, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.inputValue('#pHue'), '270', 'sideways is the hue'); assert.equal(await p.inputValue('#pDensity'), '7', 'down is sparse');
  await p.click('#etHxMirror'); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('#pSym'), '0'); assert.equal(await p.getAttribute('#etHxMirror', 'aria-pressed'), 'false');
  const d0 = +(await p.inputValue('#pDrift'));
  const hb = await p.locator('#etHxDrift').boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  const d1 = +(await p.inputValue('#pDrift')); await p.waitForTimeout(400);
  assert.notEqual(d1, d0, 'holding sweeps the drift'); assert.equal(+(await p.inputValue('#pDrift')), d1, 'letting go stops it');
  assert.equal(await p.evaluate(() => window.__eternal.data.params.hueDrift), d1);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: complete at first paint, and the art\'s sha256 recomputes outside the page', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.waitForFunction(() => window.__eternal.data.shaState === 'done', null, { timeout: 5000 });
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etHxPipe li').length, now: document.querySelector('#etHxPipe li.now b').textContent,
    rows: document.querySelectorAll('#etHxReceipt tr').length, sha: window.__eternal.data.sha, shown: document.querySelector('#etHxReceipt').textContent,
    fork: [...document.querySelectorAll('.et-c a[href*="github.com"]')].map(a => [a.target, a.rel]) }));
  assert.equal(d.steps, 7); assert.equal(d.rows, 8); assert.match(d.now, /^fork/, 'the pipeline points at the one real action');
  const sha = createHash('sha256').update(JSON.stringify(CORE.buildArt('1000', { density: 11, hueBase: 168, hueDrift: 72, symmetry: 1 }))).digest('hex');
  assert.equal(d.sha, sha, 'the receipt\'s fingerprint is the CORE\'s, recomputed in Node'); assert.ok(d.shown.includes(sha));
  assert.deepEqual(d.fork, [['_blank', 'noopener noreferrer'], ['_blank', 'noopener noreferrer']]);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('honest copy: "copied" only when the page\'s own #link reports it; a closed or silent clipboard says so', async () => {
  {
    const { ctx, p, errs } = await open('bee');
    await p.click('#etHxBeeKeep');
    await p.waitForFunction(() => window.__eternal.data.copy === 'copied', null, { timeout: 4000 });
    const link = await p.evaluate(() => window.__eternal.data.link);
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()), link, 'the clipboard holds the link');
    assert.match(await p.textContent('#meta'), /^seed-link copied/, 'the page\'s own handler reported it');
    assert.match(await p.textContent('#etHxBeeSaid'), new RegExp('copied\\..*' + link.replace(/[.?*+^$()[\]\\|{}]/g, '\\$&')));
    await p.fill('#etHxWord', 'another'); await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => window.__eternal.data.copy), 'idle', 'a new field is not the copied one');
    assert.equal(await p.textContent('#etHxBeeSaid'), '');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  {
    const { ctx, p, errs } = await open('cypherpunk', { clipboard: 'none' });
    await p.click('#etHxCyKeep'); await p.waitForTimeout(600);
    assert.equal(await p.evaluate(() => window.__eternal.data.copy), 'refused', 'a closed clipboard is said at once, by the page\'s own handler');
    assert.equal(await p.textContent('#meta'), 'the browser kept its clipboard closed — nothing was copied');
    assert.equal(await p.textContent('#etHxCySaid'), await p.evaluate(() => window.__eternal.data.link));
    assert.equal(errs.length, 0, 'a refusal is said, never thrown: ' + errs.join(' | ')); await ctx.close();
  }
  {
    const hang = () => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => new Promise(() => {}) }, configurable: true }); };
    const { ctx, p, errs } = await open('raver', { clipboard: 'none', init: hang });
    await p.click('#etHxRaverKeep'); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__eternal.data.copy), 'asked');
    assert.doesNotMatch(await p.textContent('#etHxRaverSaid'), /copied|fork ·/, 'nothing is claimed while the clipboard is silent');
    await p.waitForTimeout(1900);
    assert.equal(await p.evaluate(() => window.__eternal.data.copy), 'refused');
    const link = await p.evaluate(() => window.__eternal.data.link);
    assert.ok((await p.textContent('#etHxRaverSaid')).includes(link), 'the link is shown to copy by hand');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('the breath: moving under 3 Hz, pausable, still under reduced motion', async () => {
  const snap = p => p.evaluate(() => document.getElementById('etHxPad').toDataURL());
  {
    const { ctx, p } = await open('raver');
    const a = await snap(p); await p.waitForTimeout(700); const b = await snap(p);
    assert.notEqual(a, b, 'the field breathes');
    await p.click('#etHxBreath'); await p.waitForTimeout(100);
    const c = await snap(p); await p.waitForTimeout(700); const e = await snap(p);
    assert.equal(c, e, 'paused means still'); assert.equal(await p.getAttribute('#etHxBreath', 'aria-pressed'), 'false');
    await ctx.close();
  }
  {
    const { ctx, p } = await open('raver', { motion: 'reduce' });
    const a = await snap(p); await p.waitForTimeout(700); const b = await snap(p);
    assert.equal(a, b, 'still under reduced motion');
    assert.equal(await p.$eval('#etHxBreath', b => b.disabled), true);
    await ctx.close();
  }
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
        if (/^(BUTTON|A|INPUT|CANVAS)$/.test(el.tagName) && (el.tagName !== 'CANVAS' || el.tabIndex >= 0) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20)));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
