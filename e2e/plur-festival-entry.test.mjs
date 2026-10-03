// plur-festival-entry.test.mjs — explicit entry to the festival inside PLUR. The embedded festival
// (surfaces/festival/index.html) reads Arbitrum on load, so the frame must not load until the reader
// presses an "Enter the festival" control. Proves in each register, with the REAL festival page (no
// fixture): loading PLUR and scrolling the festival section into view requests nothing off-origin and
// never fetches the festival; a #festival deep link alone does not enter; pressing either control
// loads the frame, in the reader's register, sized to its content.
// Run: node --test e2e/plur-festival-entry.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PAGE = process.env.ETERNAL_PAGE_SRC || ''; // optional: serve another copy of the page (the red run on HEAD)
const srv = createServer(async (q, s) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = PAGE && p === '/surfaces/plur.html' ? PAGE : join(ROOT, p);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser, ORIGIN;
before(async () => { await new Promise(r => srv.listen(0, '127.0.0.1', r)); ORIGIN = `http://127.0.0.1:${srv.address().port}`; browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const REGS = ['bee', 'raver', 'cypherpunk'];
const NAV = 'nav.plur-actions a[href="#festival"]', INSIDE = '#festival a[href="#festival"]';

async function open(reg, hash = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // The route ledger: every off-origin request is recorded and refused; every festival fetch is recorded.
  const sent = [], festival = [];
  await ctx.route('**/*', r => { const q = r.request(), u = q.url();
    if (!u.startsWith(ORIGIN)) { sent.push(q.method() + ' ' + u); return r.abort('blockedbyclient'); }
    if (u.includes('/surfaces/festival/')) festival.push(u);
    return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/plur.html${hash}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.total > 0, null, { timeout: 15000 });
  return { ctx, p, errs, sent, festival };
}
// Bring the section fully through the viewport and give a lazy frame every chance to start.
async function dwell(p) {
  await p.evaluate(() => document.getElementById('festival').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('festival').scrollIntoView({ block: 'end' }));
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(900);
}
async function entered(p, reg) {
  await p.waitForFunction(r => { const d = document.getElementById('plurFestival').contentDocument;
    return d && d.readyState === 'complete' && d.documentElement.classList.contains('plur-embedded') && d.body.dataset.reg === r; }, reg, { timeout: 15000 });
  await p.waitForFunction(() => { const f = document.getElementById('plurFestival'), h = f.contentDocument.body.getBoundingClientRect().height;
    return h > 0 && f.checkVisibility() && Math.abs(f.offsetHeight - (Math.ceil(h) + 8)) <= 2; }, null, { timeout: 15000 });
}

for (const reg of REGS) {
  test(`${reg}: scrolling PLUR's festival section sends nothing; the nav's Enter the festival loads it`, async () => {
    const { ctx, p, errs, sent, festival } = await open(reg);
    await dwell(p);
    assert.deepEqual(sent, [], reg + ': nothing off-origin before entry');
    assert.deepEqual(festival, [], reg + ': the festival is not fetched before entry');
    assert.equal(await p.$eval('#plurFestival', f => f.checkVisibility()), false, reg + ': no empty frame is shown');
    assert.equal(await p.$eval('#festival a[href="festival/index.html"]', a => a.checkVisibility()), true, reg + ': the standalone link stays');
    await p.locator(NAV).click();
    await entered(p, reg);
    assert.ok(festival.some(u => u.includes('/surfaces/festival/index.html?embed=plur')), reg + ': the press fetched the festival');
    assert.equal(await p.$eval('#plurFestival', f => new URL(f.src).pathname), '/surfaces/festival/index.html');
    assert.equal(await p.$eval('#festival', s => { const r = s.getBoundingClientRect(); return r.top > -40 && r.top < 200; }), true, reg + ': the press lands on the section');
    assert.equal(await p.locator(INSIDE).isVisible(), false, reg + ': the section\'s own entry control retires once entered');
    assert.equal(await p.$eval('#festival a[href="festival/index.html"]', a => a.checkVisibility()), true);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  });

  test(`${reg}: a #festival deep link does not enter; the section's own control does, and the register sync follows`, async () => {
    const { ctx, p, errs, sent, festival } = await open(reg, '#festival');
    await dwell(p);
    assert.deepEqual(sent, [], reg + ': nothing off-origin on a deep link');
    assert.deepEqual(festival, [], reg + ': a deep link is not a press');
    await p.locator(INSIDE).click();
    await entered(p, reg);
    assert.equal(await p.evaluate(() => document.activeElement.id), 'plurFestival', reg + ': focus moves into the festival');
    const other = REGS[(REGS.indexOf(reg) + 1) % 3];
    await p.evaluate(r => document.getElementById('breg-' + r).click(), other);
    await entered(p, other);
    assert.equal(festival.filter(u => u.includes('/surfaces/festival/index.html')).length, 1, reg + ': one frame load, however often entry is pressed');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  });
}
