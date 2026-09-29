// receive-eternal.test.mjs — the bLighTnetWorK receiver as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress and structure; all three carry the SAME facts (the receiver's own capability
// probe and the bComb self-test it ran at load); no gesture scans or answers on its own — "open the
// eye" presses the page's own #start, and with a (fake) camera granted the real camera opens and
// every front says so; a refused camera is said plainly. Run: node --test e2e/receive-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8957, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { camera = false, via = browser } = {}) {
  const ctx = await via.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: camera ? ['camera'] : [] });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); localStorage.removeItem('bnr.blight.camera.granted'); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/onboarding/receive.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.probes.length === 4, null, { timeout: 20000 });
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
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: !!fr.querySelector('.et-b-rows [data-probe]'), graphic: !!fr.querySelector('svg .eye'), table: !!fr.querySelector('table.et-c-tab') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.graphic, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, []);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the probe the receiver ran, and the self-test it kept', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, st = window.__bcombSelfTest;
      return {
        truth: [!!secure, !!hasCam, !!hasDet, !!(st && st.ok)], model: D.probes.map(x => x.ok), st: st && [st.frames, st.bitsPerFrame],
        caps: document.getElementById('caps').textContent,
        bee: [...document.querySelectorAll('#etBeeRows [data-probe]')].map(r => r.querySelector('small').textContent.includes('yes')),
        arcs: [...document.querySelectorAll('#etEye > path.seg')].map(pth => pth.getAttribute('stroke-dasharray') === null),
        table: [...document.querySelectorAll('#etProbe tr')].map(r => [r.children[0].textContent, r.children[1].textContent, r.children[2].textContent]),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.deepEqual(facts[reg].model, facts[reg].truth, reg + ' reads the probe'); assert.deepEqual(facts[reg].truth, a.truth); }
  assert.deepEqual(a.bee, a.truth, 'bee says yes exactly where it works');
  assert.deepEqual(facts.raver.arcs, a.truth, 'raver lights exactly the arcs that work');
  assert.deepEqual(facts.cypherpunk.table.map(r => r[1] === 'known'), a.truth, 'cypherpunk marks known exactly where it works');
  if (a.st) assert.equal(facts.cypherpunk.table[3][2].startsWith(a.st[0] + '/' + a.st[0] + ' frames drawn and read back · ' + a.st[1] + ' bits per frame'), true);
  // and the page's own gauges agree with the front
  assert.match(a.caps, a.truth[0] ? /Secure context/ : /NOT a secure context/);
  assert.match(a.caps, a.truth[2] ? /Native QR decoder present/ : /No native decoder/);
});

test('refused camera: the eye presses the real start, and every word says it plainly', async () => {
  const plain = await chromium.launch(); // no fake camera: the browser's own refusal
  const { ctx, p, errs } = await open('bee', { via: plain });
  await p.click('#etBeeGo'); await p.waitForTimeout(800);
  assert.equal(await p.evaluate(() => window.__eternal.data.live), false, 'no permission, no camera');
  assert.equal(await p.textContent('#guide-title'), 'Camera refused.', 'the real start ran and was refused');
  assert.match(await p.textContent('#etBeeNow'), /the camera said no\.\s*nothing was captured/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close(); await plain.close();
});

test('granted camera: raver opens the eye through #start; cypherpunk shows it live; closing uses #stop', async () => {
  let { ctx, p, errs } = await open('raver', { camera: true });
  await p.evaluate(() => { if (!document.getElementById('vp').classList.contains('hide')) document.getElementById('stop').click(); });
  await p.waitForFunction(() => !window.__eternal.data.live);
  await p.evaluate(() => document.querySelector('#etEye .eye').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForFunction(() => window.__eternal.data.live, null, { timeout: 8000 });
  assert.equal(await p.evaluate(() => document.getElementById('cam').srcObject && document.getElementById('cam').srcObject.active), true, 'a real stream is running');
  assert.equal(await p.textContent('#etRaverTitle'), 'eye open');
  assert.equal(await p.textContent('#etRaverGo'), 'close the eye');
  await p.click('#etRaverGo'); await p.waitForFunction(() => !window.__eternal.data.live);
  assert.equal(await p.evaluate(() => document.getElementById('vp').classList.contains('hide')), true, 'closed through the real stop');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  ({ ctx, p, errs } = await open('cypherpunk', { camera: true }));
  await p.waitForFunction(() => window.__eternal.data.live, null, { timeout: 8000 }); // the page remembers a granted camera
  assert.match(await p.textContent('#etPipe li.done b'), /eye · camera/);
  assert.match(await p.textContent('#etChips'), /eye open/);
  assert.equal(await p.textContent('#etCyGo'), 'stop camera');
  const fork = await p.$eval('.et-c a[href*="github.com"]', a => [a.target, a.rel]);
  assert.deepEqual(fork, ['_blank', 'noopener noreferrer']);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined|null/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
