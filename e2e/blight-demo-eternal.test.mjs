// blight-demo-eternal.test.mjs — the bLiGhTbeAM ("the logo IS the transmission") as three products in
// one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front
// per register, each in its own dress; the logo and its transmission are untouched (the codec, the
// encoder and the loop are byte-identical to the page before the fronts, and while a front's gesture
// runs the beam, the page's own canvas still decodes with the page's own codec, in every register);
// all three fronts carry the SAME facts (the codec's geometry and frame layout, the page's payloads,
// the live loop: pieces caught by the in-page receiver, self-verify); every gesture presses the page's
// own send / payload / mode buttons (a short hold does nothing); nothing leaves the origin; and the
// laws (no dash for a value, no forced capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/blight-demo-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/demo.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/demo.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9230, ORIGIN = `http://127.0.0.1:${PORT}`;
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const out = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); out.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.payloads.length && document.body.dataset.reg, null, { timeout: 15000 });
  return { ctx, p, errs, out };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const WANT = {
  bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
  raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
  cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
};
const FACTS = () => {
  const D = window.__eternal.data, t = id => document.getElementById(id).textContent.replace(/\s+/g, ' ').trim();
  const cells = [0, 0, 0, 0, 0, 0, 0]; bcomb.CELLS.forEach(c => cells[c.ring]++);
  return {
    cells: D.cells, dataBits: D.dataBits, geo: D.geo.map(g => g.cells), codec: { cells: bcomb.CELLS.length, bits: bcomb.DATA_BITS, rings: cells },
    payloads: D.payloads.map(x => [x.key, x.bytes, x.frames, x.chunks]),
    page: Object.keys(PAYLOADS).map(k => { const b = JSON.stringify(PAYLOADS[k].obj); return [k, new TextEncoder().encode(b).length, bcomb.framesFor(b).length, Math.ceil(b.length / CHUNK)]; }),
    beaming: D.beaming, have: D.have, K: D.K, sel: D.sel, pageSel: payloadKey, pageBeaming: !!timer,
    bee: t('etDmBRows'), beads: document.querySelectorAll('#etDmSky .et-bead').length, lit: [...document.querySelectorAll('#etDmSky .et-bead')].filter(b => !b.getAttribute('stroke-dasharray')).length,
    mid: t('etDmMid') + ' ' + t('etDmMidS'), tiles: [...document.querySelectorAll('#etDmTiles .et-r-tile')].map(b => b.dataset.pay + ':' + b.getAttribute('aria-pressed')),
    geoRows: [...document.querySelectorAll('#etDmGeo tr')].map(r => r.cells[2].textContent), frameRows: [...document.querySelectorAll('#etDmFrame tr')].map(r => r.cells[2].textContent),
    rcpt: t('etDmReceipt'), chips: t('etDmChips'), pageTxt: t('txt'), app: t('app-state'),
  };
};

test('the logo is the transmission: codec, encoder, loop and stage are byte-identical to the page before the fronts', async () => {
  const src = await readFile(pageFile(), 'utf8');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const sha = b => createHash('sha256').update(b).digest('hex');
  const find = start => blocks.find(b => b.startsWith(start));
  assert.equal(sha(find('\n/*! VENDORED — Project Nayuki') || ''), 'e6d294e7c98b422b17e08fe64f45535bc0b99cc8b1f6433f598c948b304dd24a'); // PUBLIC-CONSTANT: sha256 of the page's vendored QR encoder block at HEAD 0763f49e
  assert.equal(sha(find('\n/*! bcomb.js') || ''), 'ba41f4074161f7d80232db7ea4e74b45ac1963d36be23e32bb2d1084e98baa77'); // PUBLIC-CONSTANT: sha256 of the page's bComb codec block at HEAD 0763f49e
  assert.equal(sha(find('\n"use strict";\nconst $=id') || ''), 'ad5954584f0437026043f6eaa8fa1d1091379282206004ae6eb276ae696b5f7d'); // PUBLIC-CONSTANT: sha256 of the page's beam/loop block at HEAD 0763f49e
  assert.match(src, /<div class="stage" id="stage">\s*<canvas id="beam" width="860" height="860" aria-label="bLiGhTbeAM hexagonal stream"><\/canvas>\s*<canvas id="qr" width="420" height="420" aria-label="stock-camera QR frame"><\/canvas>\s*<\/div>/);
  assert.ok(/id="eternal"/.test(src), 'the fronts exist');
  const front = find('\n/* ETERNAL FRONT') || '';
  assert.ok(front.length > 1000, 'the fronts\' one script');
  assert.doesNotMatch(front, /\$\('(beam|qr)'\)|getElementById\('(beam|qr)'\)|bcomb\.draw|setInterval|clearInterval/, 'no front draws on, reaches for or re-times the logo');
});

test('each register: its own front and dress, the laws, and the same codec and payload facts', async () => {
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
        if (/^(BUTTON|A)$/.test(el.tagName) && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.right > 390.5) bad.push('past 390 ' + el.tagName + '.' + el.className);
      }
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, bad };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ' laws');
    const f = await p.evaluate(FACTS);
    assert.equal(f.cells, 127); assert.equal(f.dataBits, 84); assert.deepEqual(f.codec.rings, [1, 6, 12, 18, 24, 30, 36]);
    assert.deepEqual(f.geo, [1, 6, 84, 36]); assert.deepEqual(f.geoRows, ['1', '6', '84', '36', '127'], 'cypherpunk: the codec\'s own geometry');
    assert.deepEqual(f.frameRows, ['6', '6', '64', '8', '84'], 'cypherpunk: the frame sums to the codec\'s DATA_BITS');
    assert.deepEqual(f.payloads, f.page, 'the payloads are the page\'s own, measured the page\'s way');
    const sel = f.page.find(x => x[0] === f.pageSel);
    assert.equal(f.beads, sel[3], 'raver: one bead per piece of the chosen message'); assert.equal(f.lit, 0, 'nothing is lit before a beam');
    assert.match(f.bee, /what it sendsa plugin.*caught on this pagenot started/);
    assert.equal(f.beaming, false); assert.equal(f.pageBeaming, false);
    assert.equal(out.length, 0, reg + ': nothing leaves the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('raver: a short hold does nothing; the full hold runs the page\'s own beam; the logo still decodes; all three agree', async () => {
  const { ctx, p, errs, out } = await open('raver');
  await p.evaluate(() => document.getElementById('etDmRGo').scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etDmRGo').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => !!timer), false, 'a short hold does not beam');
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(() => !!timer && window.__eternal.data.beaming, null, { timeout: 3000 });
  assert.match(await p.textContent('#go'), /Stop the beam/, 'the page\'s own button is running it');
  await p.waitForFunction(() => got.length && got.every(Boolean) && /self-verified ✓/.test(document.getElementById('txt').textContent), null, { timeout: 6000 });
  await p.waitForFunction(() => window.__eternal.data.have === K, null, { timeout: 2000 });
  // the transmission is intact in this dress: the page's own codec reads the page's own canvas
  const read = await p.evaluate(() => { const c = document.getElementById('beam'); const fr = bcomb.decode(c.getContext('2d').getImageData(0, 0, c.width, c.height)); return fr ? fr.total : 0; });
  assert.equal(read, await p.evaluate(() => COMB.length), 'the logo decodes to a frame of this beam');
  const f = await p.evaluate(FACTS);
  assert.equal(f.K, 5); assert.equal(f.have, 5);
  assert.match(f.bee, /caught on this page5 of 5 pieces/); assert.equal(f.mid, '5/5 caught here'); assert.equal(f.lit, 5, 'every piece lit');
  assert.match(f.rcpt, /caught here5 \/ 5 chunks/); assert.match(f.rcpt, /self-verifyself-verified ✓/); assert.match(f.chips, /state beaming.*self-verify ✓/);
  assert.match(f.app, /Payload assembled/, 'the page\'s own receiver says it too');
  assert.ok(f.tiles.length === 4 && await p.$$eval('#etDmTiles button', bs => bs.every(b => b.disabled)), 'the message cannot change mid-beam');
  await p.click('#etDmRGo', { force: true });
  await p.waitForFunction(() => !timer && !window.__eternal.data.beaming, null, { timeout: 2000 });
  assert.equal(out.length, 0, 'nothing left the origin'); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee and cypherpunk: the payload, the mode and the start are the page\'s own buttons; the self-test runs on its own canvas', async () => {
  const { ctx, p, errs, out } = await open('bee');
  await p.click('#etDmBWhat');
  assert.equal(await p.evaluate(() => payloadKey), 'bzdid'); assert.equal(await p.textContent('#payload'), 'Payload: bzDiD');
  assert.match(await p.textContent('#etDmBRows'), /what it sendsan identity/);
  await p.click('#etDmBMode');
  assert.equal(await p.evaluate(() => qrMode && document.getElementById('stage').classList.contains('qrmode')), true);
  assert.match(await p.textContent('#etDmBRows'), /who can catch itany phone camera/);
  await p.click('#etDmBGo');
  await p.waitForFunction(() => !!timer && window.__eternal.data.beamKey === 'bzdid');
  assert.equal(await p.textContent('#etDmBGo'), 'stop the beam');
  await p.evaluate(() => document.body.setAttribute('data-reg', 'cypherpunk'));
  assert.match(await p.textContent('#etDmPath'), /^bcomb:\/\/mono-v2\/bnr-bzdid-handoff$/);
  await p.click('#etDmCyGo');
  await p.waitForFunction(() => !timer);
  await p.click('#etDmSelf');
  assert.match(await p.textContent('#etDmSelfOut'), /text recovered exactly ✓ · 84 bits a frame/);
  assert.equal(out.length, 0); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
