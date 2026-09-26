// doors-skaists-eternal.test.mjs — skaists.social's door as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal), all for the one person the door is written for: an
// artist, a DJ, a festival vendor. Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts, and those facts are the door's own (the eight tiles of
// section.d, its .n, the ⚠ limits, the not-built list, the index's row, the one thing to do, and the
// word's origin paragraph, taken apart row by row and each row found in it); the gestures only choose
// and open real pages (a seed that is not built opens only its plan); the rose turns slowly and stops
// when asked; the recount is real; and the laws hold on the front. The hex band is byte-true to HEAD.
// Run: node --test e2e/doors-skaists-eternal.test.mjs
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
const PORT = 9112, ORIGIN = `http://127.0.0.1:${PORT}`, PAGE = 'surfaces/doors/skaists.html';
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

/* the door as the gates read it, straight from disk: section.d's anchors and .n, the index row */
const HTML = await readFile(join(ROOT, PAGE), 'utf8');
const INDEX = await readFile(join(ROOT, 'surfaces/doors/index.html'), 'utf8');
function sectionD(html) {
  const open = /<section\b[^>]*\bclass="[^"]*\bd\b[^"]*"[^>]*>/.exec(html), tag = /<section\b[^>]*>|<\/section>/g;
  tag.lastIndex = open.index + open[0].length; let depth = 1, m;
  while ((m = tag.exec(html))) { depth += m[0] === '</section>' ? -1 : 1; if (!depth) return html.slice(open.index, m.index); }
}
const SEC = sectionD(HTML), ISEC = sectionD(INDEX);
const DISK = {
  anchors: [...SEC.matchAll(/<a\b[^>]*\bclass="t\b[^"]*"[^>]*\bhref="([^"]+)"/g)].map(m => m[1]),
  n: +/<span class="n">(\d+)<\/span>/.exec(SEC)[1],
  limited: (SEC.match(/<u data-i18n=/g) || []).length,
  row: +/href="skaists\.html"[^]*?<s>(\d+) open now<\/s>/.exec(ISEC)[1],
};

async function open(reg, { route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  if (route) await ctx.route(route.url, route.fn);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.tiles.length && window.__eternal.data.index.state !== 'reading', null, { timeout: 20000 });
  await p.waitForFunction(r => document.body.getAttribute('data-reg') === r, reg, { timeout: 10000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress, before the door itself', async () => {
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
        wide: document.documentElement.scrollWidth, vw: innerWidth, frontFirst: order.indexOf('eternal') < order.indexOf('header') && order.indexOf('etArchive') < order.indexOf('header') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.frontFirst, 'the front comes first; the door follows under "the whole door"');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, and they are the door\'s own, the word included', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const E = window.__eternal, D = E.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        data: { tiles: D.tiles.map(x => x.href), n: D.n, limited: D.limited, notyet: D.notyet.map(x => x.title), act: D.act.href, row: D.index.row, word: D.word.found + '/' + D.word.rows.length, entry: D.word.entry },
        petals: document.querySelectorAll('#etRose .pt:not(.seed)').length, seeds: document.querySelectorAll('#etRose .seed').length, dashed: document.querySelectorAll('#etRose .pt.lim').length,
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        table: document.querySelectorAll('#etTable tr').length, word: t('#etWord'), hint: t('#etRaverHint'), receipt: t('#etReceipt'),
        go: { bee: document.querySelector('#etBeeGo').getAttribute('href'), raver: document.querySelector('#etRaverGo').getAttribute('href') },
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' reads the same door');
  assert.deepEqual(a.data.tiles, DISK.anchors, 'every tile of section.d, in order');
  assert.equal(a.data.n, DISK.n); assert.equal(a.data.limited, DISK.limited); assert.equal(a.data.row, DISK.row);
  assert.equal(a.data.tiles.length, 8); assert.equal(a.data.limited, 2); assert.equal(a.data.notyet.length, 4);
  assert.equal(a.data.act, '../blight/studio-music.html', 'the one thing to do is the door\'s own a.act');
  assert.equal(a.data.word, '5/5', 'every row of the word is found in the door\'s origin paragraph'); assert.equal(a.data.entry, '../blanguage.html#skaists');
  assert.match(a.beeRows[0], /8 instruments/); assert.match(a.beeRows[1], /skaists means beautiful/); assert.match(a.beeRows[2], /limit named\s*2/); assert.match(a.beeRows[3], /not built yet\s*4/);
  assert.equal(a.petals, 8, 'one petal per instrument'); assert.equal(a.seeds, 4, 'one seed per thing not built'); assert.equal(a.dashed, 2);
  assert.match(a.hint, /8 petals · 4 seeds/);
  assert.equal(a.table, 12, 'eight instruments and four not built, one row each');
  assert.match(a.word, /skaidrs, clear · kaist, to glow/); assert.match(a.word, /hot → flushed → bright → beautiful/); assert.match(a.word, /5 of 5 rows found/);
  assert.match(facts.cypherpunk.receipt, /three numbers\s*8·8·8 ✓/);
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.equal(facts[reg].go.bee, a.data.act); assert.equal(facts[reg].go.raver, a.data.act); }
});

test('bee: the word opens in place with its entry; the one action is the door\'s own', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-x="word"]');
  const w = await p.$eval('#eternal .et-b-more[data-x="word"]', e => ({ text: e.textContent, href: e.querySelector('a').getAttribute('href') }));
  assert.match(w.text, /Karulis traces it to two roots/); assert.equal(w.href, '../blanguage.html#skaists');
  await p.click('#etBeeRows .et-b-row[data-x="ny"]');
  assert.equal(await p.$$eval('#eternal .et-b-more[data-x="ny"] .et-b-item', e => e.length), 4);
  assert.equal(await p.$$eval('#eternal .et-b-more[data-x="ny"] a', e => e.map(a => a.getAttribute('href')).join()), '../dao-dashboard/index.html', 'only the item with a plan links anywhere');
  await Promise.all([p.waitForURL(/\/surfaces\/blight\/studio-music\.html$/), p.click('#etBeeGo')]);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the rose turns slowly and stops when asked; a tap lights one petal and the pill opens exactly it; a seed opens only its plan', async () => {
  const { ctx, p, errs } = await open('raver');
  assert.match(await p.$eval('#etRose .spin', e => getComputedStyle(e).animationDuration), /^120s$/, 'one turn in two minutes');
  await p.click('#etMotion');
  assert.equal(await p.$eval('#etRose .spin', e => getComputedStyle(e).animationName), 'none', 'paused when asked');
  const P = await p.evaluate(() => window.__eternal.petals.map(x => x.t ? x.t.href : 'seed:' + (x.ghost.plan || '')));
  const orbit = P.indexOf('../forge/orbit.html');
  await p.click(`#etRose .pt[data-i="${orbit}"]`);
  assert.equal(+(await p.getAttribute('#etRose .pt.on', 'data-i')), orbit); assert.equal(await p.$$eval('#etRose .pt.on', e => e.length), 1);
  assert.match(await p.textContent('#etRaverCard'), /forge\/orbit\.html/); assert.equal(await p.getAttribute('#etRaverGo', 'href'), '../forge/orbit.html');
  const plan = P.indexOf('seed:../dao-dashboard/index.html'), bare = P.indexOf('seed:');
  await p.click(`#etRose .pt[data-i="${plan}"]`);
  assert.match(await p.textContent('#etRaverCard'), /not built yet/); assert.equal(await p.getAttribute('#etRaverGo', 'href'), '../dao-dashboard/index.html');
  await p.click(`#etRose .pt[data-i="${bare}"]`);
  assert.equal(await p.getAttribute('#etRaverGo', 'href'), '../blight/studio-music.html'); assert.equal(await p.textContent('#etRaverGo'), 'compose something instead');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await still.addInitScript(() => { try { localStorage.setItem('bregister', 'raver'); } catch {} });
  const q = await still.newPage(); await q.goto(`${ORIGIN}/${PAGE}`); await q.waitForFunction(() => document.querySelector('#etRose .spin'));
  assert.equal(await q.$eval('#etRose .spin', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.close();
});

test('cypherpunk: complete at first paint, and the recount is real: a drifted index row is named', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, now: document.querySelectorAll('#etPipe li.now').length, state: document.querySelector('#etState').textContent }));
  assert.equal(d.steps, 6); assert.equal(d.now, 0); assert.match(d.state, /three numbers read at \d\d:\d\d:\d\dZ/);
  await ctx.close();
  const drift = INDEX.replace(ISEC, ISEC.replace(/(href="skaists\.html"[^]*?<s>)8( open now<\/s>)/, '$19$2'));
  assert.notEqual(drift, INDEX, 'the drifted index differs');
  const { ctx: c2, p: q } = await open('cypherpunk', { route: { url: `${ORIGIN}/surfaces/doors/index.html`, fn: r => r.fulfill({ status: 200, contentType: 'text/html', body: drift }) } });
  const v = await q.evaluate(() => ({ receipt: document.querySelector('#etReceipt').textContent, now: (document.querySelector('#etPipe li.now b') || {}).textContent }));
  assert.match(v.receipt, /9·8·8 · row/, 'the odd one out is the index row, by name'); assert.match(v.now, /verdict/);
  // the page's own bytes, hashed in the browser, are the file on disk: curl and sha256sum say the same
  await q.waitForFunction(() => window.__eternal.data.sha && window.__eternal.data.sha.state !== 'reading');
  const sha = createHash('sha256').update(await readFile(join(ROOT, PAGE))).digest('hex');
  assert.match(await q.textContent('#etReceipt'), new RegExp('sha256\\s*' + sha));
  assert.match(await q.textContent('#etVerifyHash'), /^curl -s http:\/\/127\.0\.0\.1:\d+\/surfaces\/doors\/[\w-]+\.html \| sha256sum/);
  assert.equal(errs.length, 0, errs.join(' | ')); await c2.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px, and the band is byte-true', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await p.evaluate(() => document.querySelectorAll('#eternal [aria-expanded="false"]').forEach(e => e.click()));
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
});
