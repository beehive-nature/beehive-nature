// blight-qrtree-eternal.test.mjs — bLighT QR TREE (the code carries the URL) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal). THE QR RULING (wave 3): the code stays
// scannable and byte-identical; no front restyles, recolours or overlays its modules. Proves at 390 px:
// the engine is byte-identical and the renderer differs from the page before the fronts by exactly one
// added hook line; at this test's URL the module grid and the page's own flat plate pixels equal the
// ones HEAD produced (fingerprints recorded from `git show HEAD:surfaces/blight/qrtree.html` served on
// this same port); every code a front shows is pixel-identical to the page's own flattened canvas; one
// front per register, each in its own dress; the SAME facts in all three; every gesture is the page's
// own (GROW, the tap that flattens, ↓ PNG; a short hold does nothing); nothing leaves the origin; the laws.
// Run: node --test e2e/blight-qrtree-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/qrtree.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/qrtree.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9233, ORIGIN = `http://127.0.0.1:${PORT}`;
const pageFile = () => process.env.ETERNAL_OVERRIDE || join(ROOT, PAGE);
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    const f = rel === PAGE ? pageFile() : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.grid && document.body.dataset.reg, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const WANT = {
  bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
  raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
  cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
};
// the page's own flat plate (flattened by the page's own tap, then put back) and every front's code
const CODE = async () => {
  const sha = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof b === 'string' ? new TextEncoder().encode(b) : b))].map(x => x.toString(16).padStart(2, '0')).join('');
  const S = window.__qrtree.state, q = S.qr, cv = document.getElementById('cv'); let g = '';
  for (let y = 0; y < q.size; y++) { for (let x = 0; x < q.size; x++) g += q.getModule(x, y) ? '1' : '0'; g += '\n'; }
  const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const was = S.flat; if (!was) cv.click();
  const flat = await sha(px(cv)); if (!was) cv.click();
  return { url: S.url, grid: await sha(g), flat, fronts: await Promise.all([...document.querySelectorAll('#eternal canvas[data-et-qr]')].map(async c => c.width + 'x' + c.height + ':' + await sha(px(c)))) };
};

test('the code is untouched: engine byte-identical, renderer + one hook line; grid and flat plate equal HEAD\'s; fronts show that plate', async () => {
  const src = await readFile(pageFile(), 'utf8');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const sha = b => createHash('sha256').update(b || '').digest('hex');
  assert.equal(sha(blocks.find(b => b.startsWith('\n/* ── THE ENGINE'))), 'cb020fb38db5035dd7d808b78151a2ca871de539c3004b25a14005a094ef01fb'); // PUBLIC-CONSTANT: sha256 of the vendored nayuki engine block at HEAD 0763f49e
  const renderer = blocks.find(b => b.startsWith('\n(function(){\n\'use strict\';\nvar Q=window')) || '';
  const hook = renderer.split('\n').filter(l => l.startsWith('window.__qrtree='));
  assert.equal(hook.length, 1, 'exactly one hook line');
  assert.equal(sha(renderer.split('\n').filter(l => !l.startsWith('window.__qrtree=')).join('\n')), 'f02f7e225af7b133ab71a75af222d54b1df61aa16ec3a9d3470c7464b5604c37', 'the renderer, minus the hook, is HEAD\'s'); // PUBLIC-CONSTANT: sha256 of the tree renderer block at HEAD 0763f49e
  const { ctx, p, errs } = await open('bee');
  const c = await p.evaluate(CODE);
  assert.equal(c.url, `${ORIGIN}/${PAGE}`);
  assert.equal(c.grid, '8392fc5f81f1fd906afdff0448ca46fbe10da5d75dafe596b708d56edea1657a', 'module grid = HEAD\'s at this URL'); // PUBLIC-CONSTANT: sha256 of HEAD's module grid for this test URL
  assert.equal(c.flat, '28a1f2bce169a63b8d60e82e41975b1954d7e4bcaf5054a47b9e64821e4d8ba1', 'the page\'s own flat plate = HEAD\'s, pixel for pixel'); // PUBLIC-CONSTANT: sha256 of HEAD's flat-plate pixels for this test URL
  assert.deepEqual(c.fronts, ['640x640:' + c.flat, '640x640:' + c.flat, '640x640:' + c.flat], 'each front shows the page\'s own flat plate');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('each register: its own front and dress, the laws, and the same facts', async () => {
  const facts = {};
  for (const [reg, w] of Object.entries(WANT)) {
    const { ctx, p, errs, out } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (cs.display === 'none' || !r.width) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) bad.push('value ' + own);
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.right > 390.5) bad.push('past 390 ' + el.tagName + '.' + el.className);
      }
      const S = window.__qrtree.state, q = S.qr, D = window.__eternal.data; let dark = 0;
      for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.getModule(x, y)) dark++;
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, bad,
        page: { url: S.url, v: q.version, n: q.size, dark, flat: S.flat }, data: { url: D.url, v: D.version, n: D.n, dark: D.dark, flat: D.flat },
        pageFacts: document.getElementById('facts').textContent, bee: document.querySelector('.et-b [data-et="url"]').textContent,
        bars: document.querySelectorAll('#etTrSky line').length, mid: document.getElementById('etTrMid').textContent, rcode: document.getElementById('etTrRCode').textContent,
        cyPay: [...document.querySelectorAll('#etTrReceipt tr')].find(r => r.cells[0].textContent === 'payload').cells[1].textContent, cyPath: document.getElementById('etTrPath').textContent };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(d.data, d.page, reg + ': the data layer is the page\'s own state');
    assert.equal(out.length, 0, reg + ': nothing leaves the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee.page;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].page, a);
  assert.match(facts.bee.pageFacts, new RegExp(`raised modules — ${a.dark} of ${a.n * a.n}`), 'the page\'s own facts say the same');
  assert.equal(facts.bee.bee, a.url);
  assert.equal(facts.raver.bars, 2 * a.n, 'raver: a bar per column and per row'); assert.equal(facts.raver.mid, String(a.dark)); assert.match(facts.raver.rcode, new RegExp(`^v${a.v} · ${a.n}×${a.n} · ecc H · about 17:1`));
  assert.equal(facts.cypherpunk.cyPay, a.url); assert.equal(facts.cypherpunk.cyPath, `qr://H/v${a.v}/${a.n}x${a.n}`);
});

test('honest gestures: the tap is the page\'s own flatten; grow and save are the page\'s own; a short hold does nothing', async () => {
  const { ctx, p, errs, out } = await open('raver');
  await p.locator('#etTrSky .et-hit').click({ force: true });
  await p.waitForFunction(() => window.__qrtree.state.flat === true && window.__eternal.data.flat === true);
  assert.equal(await p.textContent('#viewTitle'), 'the plate — tap to raise', 'the page\'s own view flattened');
  assert.equal(await p.getAttribute('#etTrSky .et-sky', 'aria-pressed'), 'true');
  const c0 = await p.evaluate(CODE);
  await p.fill('#etTrRUrl', 'https://skaists.dev/a-tree-for-the-link');
  await p.evaluate(() => document.getElementById('etTrRGo').scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etTrRGo').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => window.__qrtree.state.url), c0.url, 'a short hold grows nothing');
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.url === 'https://skaists.dev/a-tree-for-the-link' && window.__eternal.data.grid);
  assert.equal(await p.inputValue('#url'), 'https://skaists.dev/a-tree-for-the-link');
  const c1 = await p.evaluate(CODE);
  assert.notEqual(c1.grid, c0.grid); assert.ok(c1.fronts.every(f => f.endsWith(':' + c1.flat)), 'the new plate, pixel for pixel');
  await p.evaluate(() => document.body.setAttribute('data-reg', 'bee'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#etTrBSave')]);
  assert.match(dl.suggestedFilename(), /^qrtree_flat_v\d+_H\.png$/);
  await p.evaluate(() => document.body.setAttribute('data-reg', 'cypherpunk'));
  await p.click('#etTrRe');
  await p.waitForFunction(() => /identical/.test(document.getElementById('etTrReOut').textContent));
  assert.equal(out.length, 0, 'nothing left the origin'); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
