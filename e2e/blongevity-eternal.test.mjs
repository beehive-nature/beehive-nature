// blongevity-eternal.test.mjs — the fat education as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register,
// each in its own dress; all three carry the SAME mirror (window.__blong, the page's own numbers)
// and the SAME six stages read from #line, each with its grade; the one real gesture — running the
// reversal hypothesis — presses the page's own #revBtn (a short raver hold does nothing), and every
// register reads the direction back from the page. Run: node --test e2e/blongevity-eternal.test.mjs
// Red proof: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/blongevity.html> node --test e2e/blongevity-eternal.test.mjs
const PAGE = 'blongevity.html', PORT = 8968;
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
    return { xAla: Math.round(D.xAla * 10) / 10, xLa: Math.round(D.xLa * 10) / 10, serve: Math.round(D.m.serve), stages: D.stages.map(s => [s.title, s.hyp]),
      line: document.querySelectorAll('#line .stage').length, mirror: document.getElementById('mirror').textContent, reversed: D.reversed,
      bee: t('#etBeeRows .et-b-row'), river: document.querySelectorAll('#etRiver [data-i]').length, table: t('#etStages tr.pick'), receipt: t('#etReceipt tr').join(' | ') };
  });
}

test('the same mirror and the same six stages in all three, equal to the page', async () => {
  const f = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) { const { ctx, p } = await open(reg); f[reg] = await facts(p); await ctx.close(); }
  const a = f.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.deepEqual(f[reg].stages, a.stages, reg); assert.equal(f[reg].xAla, a.xAla); assert.equal(f[reg].xLa, a.xLa); }
  assert.equal(a.line, 6); assert.equal(a.stages.length, 6);
  assert.deepEqual([a.xAla, a.xLa, a.serve], [5.4, 1.6, 100], 'the page’s own mirror at 80 kg');
  assert.ok(a.mirror.includes('5.4') && a.mirror.includes('1.6'), 'the instrument prints the same');
  assert.ok(a.bee.includes('omega-3 · alpha-linolenic acid 5.4×') && a.bee.includes('omega-6 · linoleic acid 1.6×'), a.bee.join(' / '));
  assert.ok(a.bee.includes('the right balance of the two not known'), 'no invented ratio');
  assert.equal(f.raver.river, 6);
  assert.equal(f.cypherpunk.table.length, 6);
  a.stages.forEach(([title, hyp], i) => { assert.ok(f.cypherpunk.table[i].startsWith(`s${i + 1} ${title}`), title); assert.equal(/hypothesis/.test(f.cypherpunk.table[i]), hyp, 'grade ' + title); });
  assert.equal(a.stages.filter(s => s[1]).length, 2, 'two stages carry the graded hypothesis');
  assert.match(f.cypherpunk.receipt, /ala · n-3 8\.7 g vs AI 1\.6 g = 5\.4×/);
});

test('raver: a short hold does nothing; a full hold presses the page’s own reversal', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etRiver [data-i="5"]');
  assert.match(await p.textContent('#etRaverCard'), /the long horizon/);
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.body.classList.contains('reversed')), false, 'a short hold does not reverse');
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.classList.contains('reversed')), true, 'the full hold pressed #revBtn');
  assert.match(await p.textContent('#revBtn'), /return to the receipted downstream flow/, 'the page’s own toggle changed');
  assert.equal(await p.textContent('#etRaverTitle'), 'upstream');
  assert.match(await p.textContent('#etRiver'), /upstream · hypothesis, graded/, 'the grade travels with the reversal');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the button is the same toggle; the mirror follows the real weight', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  await p.click('#etCyRev'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.body.classList.contains('reversed')), true);
  assert.match(await p.textContent('#etReceipt'), /upstream · graded hypothesis/);
  await p.click('#revBtn'); await p.waitForTimeout(200);
  assert.match(await p.textContent('#etCyRev'), /^run the reversal hypothesis$/, 'the front reads the page, whoever pressed');
  await p.fill('#m-wt', '60'); await p.dispatchEvent('#m-wt', 'input'); await p.waitForTimeout(200);
  const d = await facts(p);
  assert.equal(d.xAla, 4.1); assert.ok(d.mirror.includes('4.1'));
  assert.match(await p.textContent('#etPath'), /wt=60/);
  await p.click('#etStages tr.pick[data-i="1"]');
  assert.ok(await p.locator('#etStages tr.more[data-i="1"] a[href*="pubmed"]').count() >= 1, 'a stage opens to its receipt');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('new bee: calm rows, the one action opens the story, the link opens your own weight', async () => {
  const { ctx, p, errs } = await open('bee');
  const text = await p.evaluate(() => document.querySelector('#eternal .et-b').innerText);
  assert.doesNotMatch(text, /ACiD|CB1|CB2/, 'nothing technical on the first screen');
  await p.click('#etBeeGo'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-blong-beat')), 'story');
  await p.click('#etBeeMine'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-blong-beat')), 'deeper');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'm-wt', 'hands off to the real weight input');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
