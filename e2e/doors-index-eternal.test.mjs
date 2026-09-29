// doors-index-eternal.test.mjs — the six doors as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal), for the stranger who does not yet know which door is theirs.
// Proves at 390 px: exactly one front per register, each in its own dress; all three carry the SAME
// six doors, and those facts are the list's own rows plus each door page's own count, read the way
// e2e/door-counts.mjs reads them; choosing a door only chooses, and the action opens that real door;
// the in-browser recount is real (a door that drifts or cannot be read is named, never agreed); the
// export is the data; the laws hold; and the hex band, lifted byte-true into the hub, is untouched.
// Run: node --test e2e/doors-index-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9110, ORIGIN = `http://127.0.0.1:${PORT}`, PAGE = 'surfaces/doors/index.html';
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

/* the list and each door as the gates read them, straight from disk */
function sectionD(html) {
  const open = /<section\b[^>]*\bclass="[^"]*\bd\b[^"]*"[^>]*>/.exec(html), tag = /<section\b[^>]*>|<\/section>/g;
  tag.lastIndex = open.index + open[0].length; let depth = 1, m;
  while ((m = tag.exec(html))) { depth += m[0] === '</section>' ? -1 : 1; if (!depth) return html.slice(open.index, m.index); }
}
const HTML = await readFile(join(ROOT, PAGE), 'utf8'), ISEC = sectionD(HTML);
const ROWS = [...ISEC.matchAll(/<a class="t" href="([^"]+)"[^>]*><b[^>]*>([^<]+)<\/b>.*?<s>(\d+) open now<\/s><\/a>/g)].map(m => ({ href: m[1], host: m[2], open: +m[3] }));
for (const r of ROWS) {
  const sec = sectionD(await readFile(join(ROOT, 'surfaces/doors', r.href), 'utf8'));
  r.n = +/<span class="n">(\d+)<\/span>/.exec(sec)[1];
  r.anchors = (sec.match(/<a\b[^>]*\bclass="t\b/g) || []).length;
}

async function open(reg, { routes = [], reduce } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  for (const x of routes) await ctx.route(x.url, x.fn);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.doors.length && window.__eternal.data.read !== 'reading', null, { timeout: 20000 });
  await p.waitForFunction(r => document.body.getAttribute('data-reg') === r, reg, { timeout: 10000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress, before the list', async () => {
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
      const order = [...document.body.children].map(e => e.id || e.tagName.toLowerCase());
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth, frontFirst: order.indexOf('eternal') < order.indexOf('header') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.frontFirst, 'the front comes first; the list follows');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same six doors in all three, and they are the list\'s own rows and each door\'s own count', async () => {
  assert.equal(ROWS.length, 6, 'six rows on disk');
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        doors: D.doors.map(d => ({ href: d.href, host: d.host, open: d.open, n: d.live.n, anchors: d.live.anchors, state: d.live.state })),
        total: D.total, agree: D.agree,
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        combs: [...document.querySelectorAll('#etFlower .door')].map(g => g.querySelectorAll('.cell').length),
        table: [...document.querySelectorAll('#etTable tr')].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())),
        go: [document.querySelector('#etBeeGo').getAttribute('href'), document.querySelector('#etRaverGo').getAttribute('href')],
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].doors, a.doors, reg + ' reads the same six doors');
  assert.deepEqual(a.doors.map(d => [d.href, d.host, d.open]), ROWS.map(r => [r.href, r.host, r.open]), 'the rows are the list\'s own');
  assert.deepEqual(a.doors.map(d => [d.n, d.anchors, d.state]), ROWS.map(r => [r.n, r.anchors, 'read']), 'each door\'s .n and real anchors, as door-counts reads them');
  assert.equal(a.total, ROWS.reduce((s, r) => s + r.open, 0)); assert.equal(a.agree, 6);
  a.beeRows.forEach((t, i) => assert.match(t, new RegExp(ROWS[i].open + ' open')));
  assert.deepEqual(a.combs, ROWS.map(r => r.open), 'one cell per page, comb by comb');
  a.table.forEach((c, i) => { assert.match(c[0], new RegExp('^' + ROWS[i].host.replace(/\./g, '\\.'))); assert.equal(+c[1], ROWS[i].open); assert.equal(c[2], `${ROWS[i].open}·${ROWS[i].n}·${ROWS[i].anchors} ✓`); });
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.deepEqual(facts[reg].go, ['beehivenature.html', 'beehivenature.html'], 'the first door is the default in every register');
});

test('bee: choosing a sentence only chooses; the one action opens that real door', async () => {
  const { ctx, p, errs } = await open('bee');
  const i = ROWS.findIndex(r => r.href === 'plur.html');
  await p.click(`#etBeeRows .et-b-row[data-i="${i}"]`);
  assert.equal(await p.getAttribute(`#etBeeRows .et-b-row[data-i="${i}"]`, 'aria-pressed'), 'true');
  const more = await p.textContent('#etBeeRows .et-b-more');
  assert.match(more, /plur\.earth/); assert.match(more, /first thing there: Make a kandi and give it away/);
  assert.equal(await p.getAttribute('#etBeeGo', 'href'), 'plur.html'); assert.equal(await p.textContent('#etBeeGo'), 'open plur.earth');
  assert.match(p.url(), /doors\/index\.html$/, 'a choice is not a visit');
  await Promise.all([p.waitForURL(/\/doors\/plur\.html$/), p.click('#etBeeGo')]);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: a tap lights one comb from its heart outward; the pill enters that door; motion is slow and stops', async () => {
  const { ctx, p, errs } = await open('raver');
  const i = ROWS.findIndex(r => r.href === 'skaists.html');
  await p.click(`#etFlower .door[data-i="${i}"]`);
  const d = await p.evaluate(() => {
    const on = document.querySelector('#etFlower .door.on'), cells = [...on.querySelectorAll('.cell')];
    return { on: on.getAttribute('data-i'), lit: document.querySelectorAll('#etFlower .door.on').length, delays: cells.map(c => parseFloat(c.style.transitionDelay)),
      card: document.querySelector('#etRaverCard').textContent, go: document.querySelector('#etRaverGo').getAttribute('href'), label: document.querySelector('#etRaverGo').textContent };
  });
  assert.equal(+d.on, i); assert.equal(d.lit, 1, 'one comb lit at a time');
  assert.ok(d.delays.length === 8 && d.delays[7] > d.delays[0], 'its cells come up one after another');
  assert.match(d.card, /skaists\.social/); assert.equal(d.go, 'skaists.html'); assert.equal(d.label, 'enter skaists.social');
  await p.focus(`#etFlower .door[data-i="${i}"]`); await p.keyboard.press('ArrowRight');
  assert.equal(+(await p.getAttribute('#etFlower .door.on', 'data-i')), i + 1, 'the keys walk the hive too');
  assert.match(await p.$eval('#etFlower .door.on .plot', e => getComputedStyle(e).animationDuration), /^4s$/, 'a 4 s breath: well under 3 Hz');
  await p.click('#etMotion');
  assert.equal(await p.$eval('#etFlower .door.on .plot', e => getComputedStyle(e).animationName), 'none', 'paused when asked');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const { ctx: c2, p: q } = await open('raver', { reduce: true });
  assert.equal(await q.$eval('#etFlower .door.on .plot', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await c2.close();
});

test('cypherpunk: the recount is real: a drifted door and an unreadable door are named, never agreed; the export is the data', async () => {
  const nat = await readFile(join(ROOT, 'surfaces/doors/beehivenature.html'), 'utf8');
  const one = nat.replace(/<a class="t" href="\.\.\/b4b\.html"[^\n]*\n/, '');
  assert.notEqual(one, nat, 'a door with one tile taken out');
  const { ctx, p, errs } = await open('cypherpunk', { routes: [
    { url: `${ORIGIN}/surfaces/doors/beehivenature.html`, fn: r => r.fulfill({ status: 200, contentType: 'text/html', body: one }) },
    { url: `${ORIGIN}/surfaces/doors/plur.html`, fn: r => r.fulfill({ status: 404, body: '' }) },
  ] });
  const d = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#etTable tr')].map(r => r.cells[2].textContent.replace(/\s+/g, ' ').trim()), agree: document.querySelector('#etAgree').textContent,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, state: document.querySelector('#etState').textContent }));
  const nIx = ROWS.findIndex(r => r.href === 'beehivenature.html'), pIx = ROWS.findIndex(r => r.href === 'plur.html');
  assert.match(d.rows[nIx], /^38·38·37\s*odd one: a\.t$/, 'the missing anchor is named as the odd number');
  assert.match(d.rows[pIx], /^not read\s*http 404$/, 'an unreadable door says so');
  assert.equal(d.agree, '4 of 6 agree'); assert.match(d.now, /\.n · each door/); assert.match(d.state, /read 5 of 6 door pages/);
  await ctx.close();
  const { ctx: c2, p: q } = await open('cypherpunk');
  await q.waitForFunction(() => window.__eternal.data.sha && window.__eternal.data.sha.state !== 'reading');
  const [dl] = await Promise.all([q.waitForEvent('download'), q.click('#etExport')]);
  const out = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(dl.suggestedFilename(), 'doors-counts.json');
  assert.deepEqual(out.doors.map(d => [d.door, d.row, d.n, d.anchors, d.agree]), ROWS.map(r => [r.href, r.open, r.n, r.anchors, true]));
  // the page's own bytes, hashed in the browser, are the file on disk
  const sha = createHash('sha256').update(await readFile(join(ROOT, PAGE))).digest('hex');
  assert.match(await q.textContent('#etReceipt'), new RegExp('sha256\\s*' + sha));
  assert.equal(out.page_sha256, sha);
  assert.match(await q.textContent('#etVerifyHash'), /curl -s http:\/\/127\.0\.0\.1:\d+\/surfaces\/doors\/index\.html \| sha256sum/);
  assert.equal(errs.length, 0, errs.join(' | ')); await c2.close();
});

test('the laws hold on the front, and the band the hub lifts is byte-true', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      if (document.documentElement.scrollWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
  const head = execFileSync('git', ['show', 'HEAD:' + PAGE], { cwd: ROOT, encoding: 'utf8' });
  const band = h => h.split('\n').find(l => l.trim().startsWith('<div id="bandwrap"'));
  assert.equal(band(HTML), band(head), 'the hex band line is byte-true');
  const css = h => { const L = h.split('\n'); return L.slice(L.findIndex(l => l.trim().startsWith('#bandwrap{')), L.findIndex(l => /@keyframes hexdriftb/.test(l)) + 1).join('\n'); };
  assert.equal(css(HTML), css(head), 'and so is its CSS block');
  const hub = await readFile(join(ROOT, 'surfaces/index.html'), 'utf8');
  assert.ok(hub.includes(band(HTML)), 'the hub still carries the band as lifted');
});
