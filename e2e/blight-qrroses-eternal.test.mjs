// blight-qrroses-eternal.test.mjs — bLighT QR ROSES (a frozen code, a living garden) as three products in
// one surface (founder blueprint 2026-09-26, docs/design/eternal). THE QR RULING (wave 3): the code stays
// scannable and byte-identical; no front restyles, recolours or overlays its modules. Proves at 390 px:
// the engine and the garden's renderer are byte-identical to the page before the fronts; at this test's
// URL the module grid and the frozen core's pixels equal the ones HEAD produced (fingerprints recorded
// from `git show HEAD:surfaces/blight/qrroses.html` served on this same port); every code a front shows
// is the page's own core, pixel for pixel; exactly one front per register, each in its own dress; all
// three carry the SAME facts (payload, version, modules, the garden's odd counts); every gesture is the
// page's own PLANT or ↓ PNG (a short hold does nothing) and nothing leaves the origin; and the laws.
// Run: node --test e2e/blight-qrroses-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/qrroses.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/qrroses.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9231, ORIGIN = `http://127.0.0.1:${PORT}`;
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
// the code as the page holds it, and every code a front shows, as fingerprints
const CODE = async () => {
  const sha = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof b === 'string' ? new TextEncoder().encode(b) : b))].map(x => x.toString(16).padStart(2, '0')).join('');
  const S = window.__qrroses, q = S.qr; let g = '';
  for (let y = 0; y < q.size; y++) { for (let x = 0; x < q.size; x++) g += q.getModule(x, y) ? '1' : '0'; g += '\n'; }
  const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  return { url: S.url, grid: await sha(g), core: await sha(px(S.core)), fronts: await Promise.all([...document.querySelectorAll('#eternal canvas[data-et-qr]')].map(async c => (c.closest('.et-b,.et-r,.et-c').className.split(' ')[0]) + ':' + c.width + ':' + await sha(px(c)))) };
};

test('the code is untouched: engine and renderer byte-identical; grid and core equal HEAD\'s; every front shows the page\'s own core', async () => {
  const src = await readFile(pageFile(), 'utf8');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const sha = b => createHash('sha256').update(b || '').digest('hex');
  assert.equal(sha(blocks.find(b => b.startsWith('\n/* ── THE ENGINE'))), '72d545e54753603ac0d4d28a55bfe9c168513e3e453bc214297ac6288d75b959'); // PUBLIC-CONSTANT: sha256 of the vendored nayuki engine block at HEAD 0763f49e
  assert.equal(sha(blocks.find(b => b.startsWith('\n(function(){\n\'use strict\';\nvar Q=window'))), 'eecc8cc3341024183aff4d6ca52f1a9d124dd109d4a9f265e68ba9dfcfc96297'); // PUBLIC-CONSTANT: sha256 of the garden renderer block at HEAD 0763f49e
  const { ctx, p, errs } = await open('bee');
  const c = await p.evaluate(CODE);
  assert.equal(c.url, `${ORIGIN}/${PAGE}`);
  assert.equal(c.grid, '78710dc0536489b9276dd89a0b83d6ff25c8ad32ccc4c7f4efb23b2d68a41acb', 'module grid = HEAD\'s at this URL'); // PUBLIC-CONSTANT: sha256 of HEAD's module grid for this test URL
  assert.equal(c.core, '4015386234cef07f5c8792f5e84fd8278740834173b9fce7627ef8e9fabb5418', 'frozen core pixels = HEAD\'s'); // PUBLIC-CONSTANT: sha256 of HEAD's frozen-core pixels for this test URL
  assert.deepEqual(c.fronts, ['et-b:477:' + c.core, 'et-r:477:' + c.core, 'et-c:477:' + c.core], 'each front shows the core, 1:1, byte for byte');
  assert.equal(await p.evaluate(() => window.__eternal.data.grid), c.grid, 'the fronts\' own fingerprint is the page\'s');
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
      const S = window.__qrroses, D = window.__eternal.data, t = id => document.getElementById(id).textContent;
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, bad,
        page: { url: S.url, v: S.qr.version, n: S.qr.size, stems: S.garden.stems.map(s => s.leaves), bees: S.garden.bees.length, petals: window.__qrrosesAudit(1).petalLayers },
        data: { url: D.url, v: D.version, n: D.n, stems: D.stems.map(s => s.leaves), bees: D.bees, petals: D.petals },
        bee: document.querySelector('.et-b [data-et="url"]').textContent,
        raverStems: [...document.querySelectorAll('#etQrSky .et-stem')].map(g => +/(\d+) leaves/.exec(g.getAttribute('aria-label'))[1]),
        raverPetals: document.querySelectorAll('#etQrSky .et-rose ellipse').length, raverCode: t('etQrRCode'),
        cyPay: [...document.querySelectorAll('#etQrReceipt tr')].find(r => r.cells[0].textContent === 'payload').cells[1].textContent,
        cyStems: [...document.querySelectorAll('#etQrStems tr.et-pick')].map(r => +r.cells[2].textContent), cyPath: t('etQrPath') };
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
  assert.equal(facts.bee.bee, a.url, 'bee: the link the code opens');
  assert.deepEqual(facts.raver.raverStems, a.stems, 'raver: one stem per stem, its own leaves');
  assert.equal(facts.raver.raverPetals, a.petals.reduce((x, y) => x + y, 0), 'raver: the petal layers, petal for petal');
  assert.match(facts.raver.raverCode, new RegExp(`^v${a.v} · ${a.n}×${a.n} · ecc H`));
  assert.equal(facts.cypherpunk.cyPay, a.url); assert.deepEqual(facts.cypherpunk.cyStems, a.stems); assert.equal(facts.cypherpunk.cyPath, `qr://H/v${a.v}/${a.n}x${a.n}`);
  // the odd law, as the garden has it
  assert.equal(a.stems.length % 2, 1); assert.ok(a.stems.every(l => l % 2 === 1)); assert.deepEqual(a.petals, [9, 7, 5]); assert.equal(a.bees % 2, 1);
});

test('honest gestures: plant and save are the page\'s own; a short hold does nothing; the new code is shown 1:1', async () => {
  const { ctx, p, errs, out } = await open('raver');
  const before = await p.evaluate(CODE);
  await p.fill('#etQrRUrl', 'https://skaists.dev/roses-for-the-living');
  await p.evaluate(() => document.getElementById('etQrRGo').scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etQrRGo').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => window.__qrroses.url), before.url, 'a short hold plants nothing');
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.url === 'https://skaists.dev/roses-for-the-living' && window.__eternal.data.grid);
  assert.equal(await p.inputValue('#url'), 'https://skaists.dev/roses-for-the-living', 'the page\'s own field carries it');
  const after = await p.evaluate(CODE);
  assert.notEqual(after.grid, before.grid);
  assert.ok(after.fronts.every(f => f.endsWith(':' + after.core)), 'the new code, shown as the page drew it');
  assert.match(await p.textContent('#status'), /^planted — version/, 'the page\'s own PLANT answered');
  // bee: plant through the page's own button; save is the page's own ↓ PNG
  await p.evaluate(() => document.body.setAttribute('data-reg', 'bee'));
  await p.fill('#etQrBUrl', 'https://skaists.dev/');
  await p.click('#etQrBGo');
  await p.waitForFunction(() => window.__eternal.data.url === 'https://skaists.dev/');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#etQrBSave')]);
  assert.match(dl.suggestedFilename(), /^qrroses_v\d+_H\.png$/);
  await p.evaluate(() => document.body.setAttribute('data-reg', 'cypherpunk'));
  await p.click('#etQrRe');
  assert.match(await p.textContent('#etQrReOut'), /identical to the code above ✓/);
  assert.equal(out.length, 0, 'nothing left the origin'); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
