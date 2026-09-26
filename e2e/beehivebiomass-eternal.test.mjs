// beehivebiomass-eternal.test.mjs — the beehivebiomass.com door's three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). The door is written for one person (someone
// with a machine to contribute). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts, read from the door itself (its section.d tiles, its .n count,
// its ⚠ limits, its not-built list) and from its row in doors/index.html; every gesture is a link to a
// page that is really open, and a seed (not built) opens nothing — only its plan, named as a plan; the three-number check says "agree"
// only when the three numbers do; the door stays a door (h1, .act, section.d, the byte-true band).
// Run: node --test e2e/beehivebiomass-eternal.test.mjs
// Red on the page before the fronts: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/doors/beehivebiomass.html> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'doors/beehivebiomass.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9121, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// index: 'real' serves doors/index.html; a number rewrites this door's "N open now"; 404 refuses it
async function open(reg, { index = 'real' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) return r.abort('blockedbyclient');
    if (index !== 'real' && u.split('?')[0] === `${ORIGIN}/surfaces/doors/index.html`) {
      if (index === 404) return r.fulfill({ status: 404, body: '' });
      const html = (await readFile(join(ROOT, 'surfaces/doors/index.html'), 'utf8'))
        .replace(/(<a class="t" href="beehivebiomass\.html"(?:(?!<\/a>)[^])*?<s>)\d+( open now<\/s>)/, `$1${index}$2`);
      return r.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.index.state !== 'reading' && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
// the door, read by the test itself (not through the page's data layer)
const doorTruth = p => p.evaluate(() => {
  const sec = document.querySelector('section.d');
  return {
    n: +sec.querySelector('.shead .n').textContent.trim(),
    hrefs: [...sec.querySelectorAll('a.t')].map(a => a.getAttribute('href')),
    names: [...sec.querySelectorAll('a.t b')].map(b => b.textContent.trim()),
    limits: sec.querySelectorAll('a.t u').length,
    notyet: [...document.querySelectorAll('.notyet li b')].map(b => b.textContent.trim()),
    act: document.querySelector('header a.act').getAttribute('href'),
    plans: [...document.querySelectorAll('.notyet li a')].map(a => a.getAttribute('href')),
  };
});

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
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, read from the door itself', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const truth = await doorTruth(p);
    const D = await p.evaluate(() => { const D = window.__eternal.data; return { anchors: D.anchors, count: D.count, hrefs: D.tiles.map(t => t.href), names: D.tiles.map(t => t.name), limits: D.limits, notyet: D.notyet.map(n => n.name), act: D.act.href, index: D.index }; });
    // the data layer says exactly what the door says
    assert.equal(D.anchors, truth.hrefs.length); assert.equal(D.count, truth.n); assert.deepEqual(D.hrefs, truth.hrefs);
    assert.deepEqual(D.names, truth.names); assert.equal(D.limits, truth.limits); assert.deepEqual(D.notyet, truth.notyet); assert.equal(D.act, truth.act);
    assert.equal(D.index.state, 'read'); assert.equal(D.index.n, truth.n, 'the index row agrees with the door');
    seen[reg] = await p.evaluate(() => ({
      beeHrefs: [...document.querySelectorAll('#etBeeRows a')].map(a => a.getAttribute('href')),
      beeNot: [...document.querySelectorAll('#etBeeRows div.et-b-row')].map(r => r.textContent),
      cells: [...document.querySelectorAll('#etSeed .cell')].map(c => c.getAttribute('aria-label')),
      tab: [...document.querySelectorAll('#etTab a')].map(a => a.getAttribute('href')),
      tabRows: document.querySelectorAll('#etTab tr').length, tabText: document.getElementById('etTab').textContent,
      chips: document.getElementById('etChips').textContent,
      go: [...document.querySelectorAll('#etBeeGo,#etRGo,#etCGo')].map(a => a.getAttribute('href')),
    }));
    seen[reg].truth = truth;
    await ctx.close();
  }
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const s = seen[reg], t = s.truth;
    // bee: the groups hold every open page once, and the not-built thing is named, not linked
    assert.deepEqual(s.beeHrefs, t.hrefs, reg + ' bee rows = the door, in its order');
    t.notyet.forEach((n, i) => { assert.match(s.beeNot[i], new RegExp(n)); assert.match(s.beeNot[i], /not built yet/); });
    // raver: the heart plus one petal per open page and one seed per not-built thing
    assert.equal(s.cells.length, t.hrefs.length + t.notyet.length, reg + ' one cell per page');
    assert.match(s.cells[0], new RegExp(t.names[t.hrefs.indexOf(t.act)] + '.*the one thing to do'));
    t.names.forEach(n => assert.ok(s.cells.some(c => c.startsWith(n)), 'cell for ' + n));
    t.notyet.forEach(n => assert.ok(s.cells.includes(n + ' · not built yet')));
    // cypherpunk: the table lists every open page in the door's order, then each not-built row,
    // whose only link is its own plan, labelled as the plan and not the thing
    assert.deepEqual(s.tab.slice(0, t.hrefs.length), t.hrefs); assert.equal(s.tabRows, t.hrefs.length + t.notyet.length);
    assert.deepEqual(s.tab.slice(t.hrefs.length), t.plans); assert.equal((s.tabText.match(/the plan, not the thing/g) || []).length, t.plans.length);
    assert.match(s.chips, new RegExp(`open ${t.n}.*⚠ ${t.limits}.*not built ${t.notyet.length}.*three numbers agree`));
    // one outcome: every front's one action goes where the door's one thing goes
    assert.deepEqual(s.go, [t.act, t.act, t.act]);
  }
});

test('raver: a tap lights a petal and opens only what is open; a seed opens nothing', async () => {
  const { ctx, p, errs } = await open('raver');
  const t = await doorTruth(p);
  assert.equal(await p.getAttribute('#etSeed .cell[data-k="0"]', 'aria-pressed'), 'true', 'the heart starts lit');
  const bloom = await p.evaluate(() => window.__eternal.cells().findIndex(c => c.kind === 'tile' && !c.t.act));
  await p.click(`#etSeed .cell[data-k="${bloom}"]`);
  const d = await p.evaluate(k => ({ on: [...document.querySelectorAll('#etSeed .cell')].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => +c.dataset.k), href: document.getElementById('etRGo').getAttribute('href'), want: window.__eternal.cells()[k].t, card: document.getElementById('etRCard').textContent, pill: document.getElementById('etRGo').textContent }), bloom);
  assert.deepEqual(d.on, [bloom], 'exactly one petal lit'); assert.equal(d.href, d.want.href, 'the pill opens that page'); assert.ok(t.hrefs.includes(d.href));
  assert.match(d.pill, /open this petal/);
  if (d.want.limit) assert.ok(d.card.includes('⚠ ' + d.want.caveat), 'a named limit travels with its petal');
  // every seed: named, locked, nothing to open
  for (let i = 0; i < t.notyet.length; i++) {
    const k = t.hrefs.length + i;
    await p.focus(`#etSeed .cell[data-k="${k}"]`); await p.keyboard.press('Enter');
    const n = await p.evaluate(() => ({ pill: document.getElementById('etRGo').hidden, note: document.getElementById('etRNote').textContent, links: document.querySelectorAll('#etRCard a').length, card: document.getElementById('etRCard').textContent }));
    assert.equal(n.pill, true, 'no pill for a seed'); assert.equal(n.links, 0);
    assert.ok(n.card.includes(t.notyet[i])); assert.match(n.note, /still a seed/);
  }
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('bee: plain rows are real links; the one action is the door\'s own; no page runs a machine', async () => {
  const { ctx, p, errs } = await open('bee');
  const d = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#etBeeRows a')].map(a => a.getAttribute('href')), go: document.getElementById('etBeeGo').tagName, guard: document.querySelector('.et-b .et-b-guard').textContent }));
  assert.ok(d.rows.length >= 1 && d.rows.every(h => /^\.\.\//.test(h)));
  assert.equal(d.go, 'A', 'the magenta action is a link, never a button that pretends');
  assert.match(d.guard, /no page here runs your machine/);
  await p.click('#etBeeGo'); await p.waitForURL(/\/surfaces\/bantfarm\.html$/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the three numbers say "agree" only when they do', async () => {
  for (const [index, want, cls] of [[99, /three numbers differ/, 'fail'], [404, /three numbers not read/, 'fail']]) {
    const { ctx, p, errs } = await open('cypherpunk', { index });
    const d = await p.evaluate(() => ({ chips: document.getElementById('etChips').textContent, step: document.querySelectorAll('#etPipe li')[2].className, txt: document.querySelectorAll('#etPipe li')[2].textContent }));
    assert.match(d.chips, want, String(index)); assert.doesNotMatch(d.chips, /agree/);
    assert.equal(d.step, cls);
    if (index === 99) assert.match(d.txt, /"99 open now".*the anchors say 2/); else assert.match(d.txt, /not read · answered 404/);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px presses, reading floors', async () => {
  const floor = { bee: 14, raver: 14, cypherpunk: 12 };
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(min => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$|^(undefined|NaN|null)$/.test(own)) out.push('value ' + el.className + ' ' + own);
        if (own && parseFloat(cs.fontSize) < min) out.push('small text ' + el.tagName + ' ' + cs.fontSize);
        const press = /^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button';
        const r = el.getBoundingClientRect();
        if (press && (r.height < 44 || r.width < 44)) out.push('small press ' + el.tagName + ' ' + (el.textContent || el.getAttribute('aria-label')).trim().slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (el.tagName === 'A' && /^https?:/.test(el.getAttribute('href')) && !el.href.startsWith(location.origin) && !(el.target === '_blank' && /noopener/.test(el.rel) && /noreferrer/.test(el.rel) && /new tab/.test(el.textContent))) out.push('external link without a said new tab');
      }
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      return out;
    }, floor[reg]);
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});

test('the door stays a door: its headline, its one thing, its count and its byte-true band', async () => {
  const src = await readFile(process.env.ETERNAL_PAGE_FILE || join(ROOT, 'surfaces', PAGE), 'utf8');
  const L = src.split('\n'), h = x => createHash('sha256').update(x).digest('hex');
  const band = L.find(l => l.trim().startsWith('<div id="bandwrap"'));
  const a = L.findIndex(l => l.trim().startsWith('#bandwrap{')), b = L.findIndex(l => l.includes('@keyframes hexdriftb'));
  assert.equal(h(band), '7ea105237f41cb5392698e65f0c527d7b7e2fe037decd2b8a89a4106d3086060', 'the band line is byte-true'); // PUBLIC-CONSTANT: sha256 of the doors' hex-band line
  assert.equal(h(L.slice(a, b + 1).join('\n')), 'd961995fbcf755a43e6c075013c28596a85fd4162048733b7a5174d21713d616', 'the band CSS block is byte-true'); // PUBLIC-CONSTANT: sha256 of the band CSS block
  assert.doesNotMatch(src, /data-i18n="et\./, 'front strings ride T(), never the corpus attribute');
  const { ctx, p, errs } = await open('bee');
  const d = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, act: !!document.querySelector('.act'), front: !!document.getElementById('eternal') }));
  assert.equal(d.h1, 'beehivebiomass.com', 'the first h1 is still the door'); assert.ok(d.act, 'one thing to do'); assert.ok(d.front, 'the three fronts are here');
  const t = await doorTruth(p); assert.equal(t.n, t.hrefs.length, 'the door counts its own tiles');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
