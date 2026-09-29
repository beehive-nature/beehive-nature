// law-of-the-sea-fold.test.mjs — first screen of Law of the Sea clears #tbar
// at 390x844. Limit is innerHeight - --tbar-h from the variable tour.js
// publishes. Empty --tbar-h fails closed (never parseFloat('')||0).
// Run: node --test e2e/law-of-the-sea-fold.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const PORT = 8867;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.css') ? 'text/css' : rel.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    s.writeHead(200, { 'content-type': ct }); s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
let b = null;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); b = await chromium.launch(); });
after(async () => { if (b) await b.close(); srv.close(); });

async function walk(reg) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => localStorage.setItem('bregister', r), reg);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/surfaces/law-of-the-sea.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#bregbar', { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--tbar-h').trim();
    const tbarH = parseFloat(raw);
    const ih = innerHeight;
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    };
    return {
      raw, tbarH, ih,
      finite: Number.isFinite(tbarH) && tbarH > 0,
      first: box(document.getElementById('first')),
      ruled: box(document.getElementById('ruled')),
      whySum: box(document.querySelector('#why > summary')),
      tbar: box(document.getElementById('tbar')),
      vis: document.getElementById('tbar') ? getComputedStyle(document.getElementById('tbar')).visibility : null,
      body: document.body.getAttribute('data-reg'),
    };
  });
  await ctx.close();
  return { m, errs };
}

for (const reg of ['bee', 'raver', 'cypherpunk']) {
  test(`Law of the Sea first screen clears the bar at 390x844 (${reg})`, async () => {
    const { m, errs } = await walk(reg);
    assert.equal(errs.length, 0, errs.join('; '));
    assert.equal(m.body, reg, `register is ${reg}`);
    assert.equal(m.vis, 'visible', 'tour bar is on screen');
    assert.ok(m.finite, `--tbar-h must be a positive number, got '${m.raw}' (fail closed)`);
    const limit = m.ih - m.tbarH;
    assert.ok(m.first, '#first is present');
    assert.ok(m.ruled, '#ruled Manifest card is present');
    assert.ok(m.whySum, '#why summary is present');
    assert.ok(m.first.bottom <= limit, `#first bottom ${m.first.bottom} <= innerHeight ${m.ih} - tbar-h ${m.tbarH} = ${Math.round(limit)}`);
    assert.ok(m.ruled.bottom <= limit, `Manifest card bottom ${m.ruled.bottom} <= ${Math.round(limit)}`);
    assert.ok(m.whySum.bottom <= limit, `#why summary bottom ${m.whySum.bottom} <= ${Math.round(limit)}`);
  });
}
