// blight-pixelrefiner-eternal.test.mjs — the bLighT pixel refiner as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; three different products (bee: before and after with three plain rows; raver:
// the smear and the cells in one frame with a seam you drag and a hold that snaps; cypherpunk: the
// engine's identity, every parameter live, the pipeline, the receipt); the whole tool below keeps
// working and every front gesture is the tool's own control (#file, #fungi, #go, #shape, #dl); the SAME
// facts in all three for a real picture run through the real engine; honest gestures (a short hold
// runs nothing; only a full hold presses ⟳ REFINE); nothing leaves the machine (no request after
// load, counted by the front and by the test); and the laws (no dash for a value, no forced capitals,
// 44 px actions, no sideways page).
// Run: node --test e2e/blight-pixelrefiner-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/pixelrefiner.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/pixelrefiner.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9142, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], late = [];
  let loaded = false;
  await ctx.route('**/*', r => { const u = r.request().url(); if (loaded) late.push(u); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(400); loaded = true;
  // count the tool's own REFINE presses, so a gesture can be proved to hand off (or not)
  await p.evaluate(() => { window.__goPresses = 0; document.getElementById('go').addEventListener('click', () => window.__goPresses++); });
  return { ctx, p, errs, outside, late };
}
// a smeared picture made the way screenshots make them: a crisp 12-cell grid, scaled ×16 with smoothing
const SMEAR = `(() => { const b = document.createElement('canvas'); b.width = b.height = 12; const g = b.getContext('2d');
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { g.fillStyle = ['#7c288a', '#1d772f', '#f4c09a', '#2800ba'][(x * 3 + y * 5 + (x * y) % 3) % 4]; g.fillRect(x, y, 1, 1); }
  const c = document.createElement('canvas'); c.width = c.height = 192; const h = c.getContext('2d'); h.imageSmoothingEnabled = true; h.imageSmoothingQuality = 'high'; h.drawImage(b, 0, 0, 192, 192);
  return c.toDataURL('image/png').split(',')[1]; })()`;
async function bring(p, sel) {
  const b64 = await p.evaluate(SMEAR);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(sel)]);
  await fc.setFiles({ name: 'smear.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await p.waitForFunction(() => window.__eternal.data.state === 'done', null, { timeout: 30000 });
  await p.waitForTimeout(150);
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products, honest when empty', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    state: window.__eternal.data.state, engine: window.__eternal.data.engine, sub: document.querySelector('.sub a').textContent,
    pairEmpty: document.getElementById('etPxPair').classList.contains('et-empty'), beeRows: document.querySelectorAll('#etPxRows .et-b-row').length,
    stage: !!document.getElementById('etPxStage'), seam: document.getElementById('etPxSeam').type, holdOff: document.getElementById('etPxHold').disabled, tiles: document.querySelectorAll('#etPxShape .et-r-tile').length,
    params: document.querySelectorAll('#etPxParams tr').length, pipe: document.querySelectorAll('#etPxPipe li').length, receipt: document.getElementById('etPxReceipt').textContent,
  }));
  assert.equal(s.state, 'empty'); assert.ok(s.pairEmpty, 'new bee: before and after, empty and said so'); assert.equal(s.beeRows, 3);
  assert.ok(s.stage && s.seam === 'range' && s.tiles === 2, 'raver: one frame, a seam, two cell shapes'); assert.ok(s.holdOff, 'nothing to snap yet');
  assert.equal(s.params, 5); assert.equal(s.pipe, 6); assert.match(s.receipt, /nothing loaded/);
  assert.equal(s.engine.ver, '0.11.1'); assert.equal(s.engine.commit, 'bd5c1c7'); assert.match(s.sub, /v0\.11\.1 · bd5c1c7/, 'the identity is the page\'s own provenance line');
  await ctx.close();
});

test('the same picture through the real engine reads the same in all three', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, outside, late } = await open(reg);
    if (reg !== 'cypherpunk') await bring(p, reg === 'bee' ? '#etPxBeeGo' : '#etPxRaverGo');
    else { // cypherpunk has no picker of its own: it reads what the tool's own #file loaded
      const b64 = await p.evaluate(SMEAR);
      await p.setInputFiles('#file', { name: 'smear.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await p.waitForFunction(() => window.__eternal.data.state === 'done', null, { timeout: 30000 });
    }
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        d: [D.input.w, D.input.h, D.output.w, D.output.h, D.output.unit, D.grid.w, D.grid.h, D.forced, D.ready, D.calls],
        page: [document.getElementById('inSize').textContent, document.getElementById('outSize').textContent],
        outCv: [document.getElementById('outCv').width, document.getElementById('outCv').height],
        bee: document.getElementById('etPxPair').textContent + document.getElementById('etPxRows').textContent,
        raver: document.getElementById('etPxRaverCard').textContent, crisp: [document.getElementById('etPxCrisp').width > 8, document.getElementById('etPxSmear').width > 8],
        cy: document.getElementById('etPxReceipt').textContent,
      };
    });
    assert.deepEqual(outside, []); assert.deepEqual(late, [], reg + ': no request leaves the page after load');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  const a = seen.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].d, a.d, reg + ' = bee');
  const [iw, ih, ow, oh, unit, gw, gh] = a.d;
  assert.deepEqual([iw, ih], [192, 192]); assert.equal(unit, 'px'); assert.deepEqual(a.outCv, [ow, oh], 'the output is the engine\'s own canvas');
  assert.match(a.page[1], new RegExp(`^${ow} × ${oh} px`)); assert.equal(a.d[8], true); assert.equal(a.d[9], 0, 'the front counted no request');
  assert.match(a.bee, new RegExp(`192 by 192 dots.*${ow} by ${oh} squares`)); assert.match(a.bee, new RegExp(`the size it found${gw} by ${gh}`));
  assert.match(seen.raver.raver, new RegExp(`192 × 192 → ${ow} × ${oh} cells`)); assert.deepEqual(seen.raver.crisp, [true, true], 'raver: both canvases drawn from the tool\'s own');
  assert.match(seen.cypherpunk.cy, new RegExp(`detected ${gw} × ${gh}`)); assert.match(seen.cypherpunk.cy, /0 requests since the page loaded/);
});

test('honest gestures: a short hold runs nothing, a full hold presses the tool\'s own REFINE; shapes and save are the tool\'s own', async () => {
  const { ctx, p, errs } = await open('raver');
  await bring(p, '#etPxRaverGo');
  assert.equal(await p.evaluate(() => window.__goPresses), 0, 'loading refined through the tool\'s own auto path, not a press');
  await p.locator('#etPxHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etPxHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(450); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__goPresses), 0, 'a short hold runs nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__goPresses), 1, 'a full hold presses ⟳ REFINE once');
  // the seam moves the frame, nothing else
  await p.$eval('#etPxSeam', s => { s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.match(await p.$eval('#etPxCrisp', c => c.style.clipPath), /inset\(0(px)? 0(px)? 0(px)? 20%\)/);
  // hexes: the tool's own #shape, then its own REFINE
  await p.click('#etPxShape .et-r-tile[data-shape="hex"]');
  await p.waitForFunction(() => window.__eternal.data.output && window.__eternal.data.output.unit === 'hexes', null, { timeout: 30000 });
  assert.equal(await p.$eval('#shape', s => s.value), 'hex'); assert.equal(await p.evaluate(() => window.__goPresses), 2);
  assert.match(await p.textContent('#outSize'), /hexes/);
  await ctx.close();
  // bee: save is the tool's own ↓ PNG
  const b = await open('bee');
  assert.equal(await b.p.$eval('#etPxBeeSave', x => x.hidden), true, 'no save before a result');
  await bring(b.p, '#etPxBeeGo');
  const [dl] = await Promise.all([b.p.waitForEvent('download'), b.p.click('#etPxBeeSave')]);
  const o = await b.p.evaluate(() => window.__eternal.data.output);
  assert.equal(dl.suggestedFilename(), `refined_${o.w}x${o.h}.png`, 'the tool\'s own download');
  assert.equal(errs.length + b.errs.length, 0, errs.concat(b.errs).join(' | ')); await b.ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    if (reg !== 'cypherpunk') await bring(p, reg === 'bee' ? '#etPxBeeGo' : '#etPxRaverGo');
    if (reg === 'bee') await p.click('#etPxRows .et-b-row[data-row="grid"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('junk ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
