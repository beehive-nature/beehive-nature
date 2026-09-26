// bearth-eternal.test.mjs — bEarth as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress;
// all three carry the SAME scenario from the page's own calc (window.__bearth) and the SAME claim
// ledger read from its tables; the raver handfuls and emission-factor pills move the page's REAL
// dials (#gday, #ef), so the instrument's headline and every register agree after a tap; and the
// unsourced world-nitrogen denominator stays badged. Run: node --test e2e/bearth-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/bearth.html> node --test e2e/bearth-eternal.test.mjs
const PAGE = 'bearth.html', PORT = 8967;
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const ORIGIN = `http://127.0.0.1:${PORT}`;
// ETERNAL_PAGE_FILE serves another copy of the page (e.g. `git show HEAD:surfaces/PAGE`) to prove the red
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data && document.querySelector('#eternal .et-b-rows .et-b-row'), null, { timeout: 8000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g, ' ').trim()), sel);

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', t: '.et-b-h', a: '.et-b-primary' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', t: '.et-r-h', a: '.et-r-pill' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', t: '.et-c-path', a: '.et-c-primary' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front);
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.t)).fontFamily, action: getComputedStyle(fr.querySelector(w.a)).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth, first: document.querySelector('main').firstElementChild.id };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.first, 'eternal', reg + ': the front leads the page');
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      for (const b of document.querySelectorAll('#eternal [aria-expanded="false"]')) if (b.offsetParent) b.click();
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /^null$/.test(own) || /\b(NaN|undefined)\b/.test(own)) out.push('non-value ' + el.tagName + ' ' + own.slice(0, 30));
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && r.right > innerWidth + 1) out.push('past the edge ' + el.tagName + '.' + el.className);
      }
      for (const a of fr.querySelectorAll('a[href^="http"]')) if (a.target !== '_blank' || a.rel !== 'noopener noreferrer') out.push('external link ' + a.href);
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});

async function facts(p) {
  return p.evaluate(() => {
    const D = window.__eternal.data, t = s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g, ' ').trim());
    return { pct: D.pct, pct1: String(+D.c.pctCrop.toFixed(1)), mha: Math.round(D.c.mha), head: document.querySelector('#first-bee [data-land-value]').textContent, dials: D.dials,
      claims: D.claims.length, kinds: D.kinds, vd: document.querySelectorAll('#instrument .vd').length,
      bee: t('#etBeePct')[0], raver: t('#etRaverBig')[0], pipe: t('#etPipe li').join(' | '), guard: t('#etGuard')[0], ledger: t('#etClaims tr').length,
      gday: document.getElementById('gday').value, ef: document.getElementById('ef').value };
  });
}

test('the same scenario and the same ledger in all three, equal to the instrument', async () => {
  const f = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) { const { ctx, p } = await open(reg); f[reg] = await facts(p); await ctx.close(); }
  const a = f.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.equal(f[reg].pct, a.pct); assert.equal(f[reg].mha, a.mha); assert.deepEqual(f[reg].kinds, a.kinds); assert.deepEqual(f[reg].dials, a.dials); }
  assert.equal(a.head, a.pct + '%', 'the page headline and the data layer agree');
  assert.equal(a.bee, a.pct + '%'); assert.equal(f.raver.raver, a.pct + '%');
  assert.ok(f.cypherpunk.pipe.includes(`1,581 = ${a.pct1}%`), 'the pipeline shows the unrounded share');
  assert.equal(a.claims, a.vd, 'every verdict in the tables is in the ledger');
  assert.deepEqual(a.kinds, { refuted: 3, survived: 3, open: 4 });
  assert.equal(f.cypherpunk.ledger, a.vd);
  assert.match(f.cypherpunk.guard, /110 Mt\/yr denominator unsourced/);
  assert.deepEqual(a.dials, { pop: 8.2, gday: 100, rec: 36, yld: 1, nrate: 130, ef: 0.01 });
});

test('raver: a handful moves the real dial; every register and the headline follow', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etHandful [data-g="50"]'); await p.waitForTimeout(200);
  const d = await facts(p);
  assert.equal(d.gday, '50', 'the tap wrote the page’s own dial');
  assert.equal(d.head, d.pct + '%'); assert.equal(d.raver, d.pct + '%');
  assert.ok(d.pct < 53 && d.pct > 0);
  assert.equal(await p.getAttribute('#etHandful [data-g="50"]', 'aria-pressed'), 'true');
  const co2 = await p.evaluate(() => window.__eternal.data.c.co2e);
  await p.click('#etEf [data-ef="0.0020"]'); await p.waitForTimeout(200);
  const d2 = await facts(p);
  assert.equal(d2.ef, '0.0020'); assert.equal(d2.pct, d.pct, 'the emission factor does not move land');
  const co2b = await p.evaluate(() => window.__eternal.data.c.co2e);
  assert.ok(Math.abs(co2 / co2b - 5) < 0.01, 'the measured hemp factor is five times below the default');
  await p.click('#etRaverGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bearth-beat')), 'land');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('new bee: plain rows, the claims given up, and the one action opens the dials', async () => {
  const { ctx, p, errs } = await open('bee');
  const rows = await txt(p, '#etBeeRows .et-b-row');
  assert.deepEqual(rows, ['people 8.2 billion', 'each day 100 g', 'seed that becomes hearts 36%', 'harvest per hectare 1.0 t', 'claims we gave up 3']);
  await p.click('#etBeeRows .et-b-row[data-t="gave"]');
  assert.match((await txt(p, '#etBeeRows .et-b-open[data-t="gave"]'))[0], /hemp sequesters CO₂/);
  await p.click('#etBeeGo'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-bearth-beat')), 'deeper');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'gday', 'hands off to the real dial');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the arithmetic is a pipeline you can rerun', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  assert.equal(await p.locator('#etPipe li').count(), 6);
  assert.equal(await p.locator('#etPipe li.guard').count(), 1, 'the unsourced denominator is the guard step');
  const code = await p.textContent('#etVerify code');
  const m = code.match(/node -e "(.*)"/); assert.ok(m, code);
  const logged = []; const orig = console.log; console.log = v => logged.push(v); new Function(m[1])(); console.log = orig;
  const pct = await p.evaluate(() => window.__eternal.data.c.pctCrop);
  assert.ok(Math.abs(logged[0] - pct) < 1e-9, 'the one-liner recomputes the share exactly');
  await p.fill('#gday', '30'); await p.dispatchEvent('#gday', 'input'); await p.waitForTimeout(200);
  assert.match(await p.textContent('#etPath'), /g=30&/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
