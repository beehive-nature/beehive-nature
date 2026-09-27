// blight-qrroses-smil-eternal.test.mjs — bLighT QR ROSES · SMIL (the same garden, declarative) as three
// products in one surface (founder blueprint 2026-09-26, docs/design/eternal). THE QR RULING (wave 3):
// the code stays scannable and byte-identical; no front restyles, recolours or overlays its modules.
// Proves at 390 px: the engine and the SMIL assembler are byte-identical to the page before the fronts;
// at this test's URL the module grid and the #plate markup equal the ones HEAD produced (fingerprints
// recorded from `git show HEAD:surfaces/blight/qrroses-smil.html` served on this same port); every code
// a front shows is #plate's own children, serialized as they are; #plate keeps zero animation children;
// one front per register, each in its own dress; the SAME facts in all three (payload, version, modules,
// the timing read from the SVG's own animations); every gesture is the page's own (PLANT, ↓ PNG, or its
// own SMIL clock — which never reaches the plate); nothing leaves the origin; and the laws.
// Run: node --test e2e/blight-qrroses-smil-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/qrroses-smil.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/qrroses-smil.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9232, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
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
const CODE = async () => {
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const S = window.__qrrosesSMIL, q = S.qr; let g = '';
  for (let y = 0; y < q.size; y++) { for (let x = 0; x < q.size; x++) g += q.getModule(x, y) ? '1' : '0'; g += '\n'; }
  const plate = document.getElementById('plate'), ser = new XMLSerializer();
  const kids = [...plate.children].map(c => ser.serializeToString(c)).join('');
  const shownKids = [...document.querySelectorAll('#eternal img[data-et-qr]')].map(i => {
    const svg = new DOMParser().parseFromString(decodeURIComponent(i.getAttribute('src').split(',').slice(1).join(',')), 'image/svg+xml').documentElement;
    return [...svg.children].map(c => ser.serializeToString(c)).join('');
  });
  return { url: S.url, grid: await sha(g), plate: await sha(plate.outerHTML), kids: await sha(kids), shown: await Promise.all(shownKids.map(sha)),
    plateAnims: document.querySelectorAll('#plate animate, #plate set, #plate animateMotion, #plate animateTransform').length, ids: document.querySelectorAll('#qrs, #plate').length };
};

test('the code is untouched: engine and assembler byte-identical; grid and #plate equal HEAD\'s; every front shows #plate as it is', async () => {
  const src = await readFile(pageFile(), 'utf8');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const sha = b => createHash('sha256').update(b || '').digest('hex');
  assert.equal(sha(blocks.find(b => b.startsWith('\n/* ── THE ENGINE'))), '3407537eae1baca50a5c35b0a659c21686f4dbf8312abe684386807f9abbbdb1'); // PUBLIC-CONSTANT: sha256 of the vendored nayuki engine block at HEAD 0763f49e
  assert.equal(sha(blocks.find(b => b.startsWith('\n(function(){\n\'use strict\';\n/* THE SMIL'))), 'c84e66f90a9d5ba61f05e2b14ff9b637dd1c3c11d60ae65fed413bcc4d6c6587'); // PUBLIC-CONSTANT: sha256 of the SMIL assembler block at HEAD 0763f49e
  const { ctx, p, errs } = await open('bee');
  const c = await p.evaluate(CODE);
  assert.equal(c.url, `${ORIGIN}/${PAGE}`);
  assert.equal(c.grid, 'ce1bef3604d28ce835b8d9dba742d50b5af8b93742493173bfae09dc66fcc491', 'module grid = HEAD\'s at this URL'); // PUBLIC-CONSTANT: sha256 of HEAD's module grid for this test URL
  assert.equal(c.plate, '26927e97bc9b2cabb95af046cf32d903e60fce944e309f208d13fa0571740834', '#plate markup = HEAD\'s'); // PUBLIC-CONSTANT: sha256 of HEAD's #plate outerHTML for this test URL
  assert.deepEqual(c.shown, [c.kids, c.kids, c.kids], 'each front shows #plate\'s own children, byte for byte');
  assert.equal(c.plateAnims, 0, 'the plate keeps zero animation children'); assert.equal(c.ids, 2, 'no front duplicates #qrs or #plate');
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
      const S = window.__qrrosesSMIL, D = window.__eternal.data, qrs = document.getElementById('qrs');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, bad,
        page: { url: S.url, v: S.qr.version, n: S.qr.size, dark: S.darkCount, stems: qrs.querySelectorAll(':scope > path[stroke-dasharray]').length,
          bees: [...qrs.querySelectorAll('.bee > animateMotion')].map(a => a.getAttribute('begin') + '/' + a.getAttribute('dur')), smil: qrs.querySelectorAll('animate,set,animateMotion,animateTransform').length },
        data: { url: D.url, v: D.version, n: D.n, dark: D.dark, stems: D.stems.length, bees: D.bees.map(b => b.begin + 's/' + b.dur + 's'), smil: D.smil },
        bee: document.querySelector('.et-b [data-et="url"]').textContent,
        raverStemArcs: document.querySelectorAll('#etSmSky [data-band="stems"] path').length, raverBeeArcs: document.querySelectorAll('#etSmSky [data-band="bees"] path').length, raverMid: document.getElementById('etSmMid').textContent,
        cyPay: [...document.querySelectorAll('#etSmReceipt tr')].find(r => r.cells[0].textContent === 'payload').cells[1].textContent,
        cyBees: [...document.querySelectorAll('#etSmTime tr')].filter(r => /^bee /.test(r.cells[1].textContent)).map(r => r.cells[2].textContent), cyGuard: document.getElementById('etSmGuardN').textContent };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.deepEqual(d.data, d.page, reg + ': the data layer is the page\'s own svg');
    assert.equal(out.length, 0, reg + ': nothing leaves the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee.page;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].page, a);
  assert.equal(facts.bee.bee, a.url);
  assert.equal(facts.raver.raverStemArcs, a.stems, 'raver: one arc per stem'); assert.equal(facts.raver.raverBeeArcs, a.bees.length, 'raver: one ring per bee'); assert.equal(facts.raver.raverMid, String(a.smil));
  assert.equal(facts.cypherpunk.cyPay, a.url); assert.deepEqual(facts.cypherpunk.cyBees, a.bees.map(b => (Math.round(parseFloat(b) * 10) / 10).toFixed(1) + ' s')); assert.equal(facts.cypherpunk.cyGuard, '0 ✓');
});

test('honest gestures: the clock is the page\'s own and never moves the plate; plant and save are the page\'s own', async () => {
  const { ctx, p, errs, out } = await open('raver');
  await p.locator('#etSmSky [data-band="bees"] .et-hit').click({ force: true });
  const t = await p.evaluate(() => document.getElementById('qrs').getCurrentTime());
  assert.ok(t >= 12 && t < 14, 'the page\'s own SMIL clock jumped to the bees: ' + t);
  assert.match(await p.textContent('#etSmRCard'), /bees arrive at 6\.5 · 6\.9 · 7\.3 s/);
  const c0 = await p.evaluate(CODE);
  assert.equal(c0.plateAnims, 0); assert.deepEqual(c0.shown, [c0.kids, c0.kids, c0.kids], 'the plate is the same after the jump');
  await p.fill('#etSmRUrl', 'https://skaists.dev/the-same-garden');
  await p.evaluate(() => document.getElementById('etSmRGo').scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etSmRGo').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => window.__qrrosesSMIL.url), c0.url, 'a short hold plants nothing');
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.url === 'https://skaists.dev/the-same-garden' && window.__eternal.data.grid);
  const c1 = await p.evaluate(CODE);
  assert.notEqual(c1.grid, c0.grid); assert.deepEqual(c1.shown, [c1.kids, c1.kids, c1.kids], 'the new plate, shown as it is'); assert.equal(c1.ids, 2);
  await p.evaluate(() => document.body.setAttribute('data-reg', 'bee'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#etSmBSave')]);
  assert.match(dl.suggestedFilename(), /^qrroses-smil_v\d+_H\.png$/);
  await p.evaluate(() => document.body.setAttribute('data-reg', 'cypherpunk'));
  await p.click('#etSmCount');
  await p.waitForFunction(() => /identical/.test(document.getElementById('etSmCountOut').textContent));
  assert.match(await p.textContent('#etSmCountOut'), /#plate animation children: 0 ✓ · re-encoded: .*identical to the code above ✓/);
  assert.equal(out.length, 0, 'nothing left the origin'); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
