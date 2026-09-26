// doors-plur-eternal.test.mjs — plur.earth's door as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal), all for the one person the door is written for: a raver. (Not
// e2e/plur-eternal.test.mjs, which proves surfaces/plur.html.) Proves at 390 px: exactly one front
// per register, each in its own dress; all three carry the SAME facts, and those facts are the door's
// own (the four ways onto the floor in section.d, its .n, the not-built list, the index's row, the one
// thing to do, and rule 3 and the kandi line, each found in the door's own words); the gestures only
// choose and open real pages (a hollow bead opens nothing new); the kandi turns the chosen bead to the
// clasp, its motion is slow and stops when asked; the recount is real; and the laws hold. The hex
// band is byte-true to HEAD.
// Run: node --test e2e/doors-plur-eternal.test.mjs
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
const PORT = 9113, ORIGIN = `http://127.0.0.1:${PORT}`, PAGE = 'surfaces/doors/plur.html';
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
  row: +/href="plur\.html"[^]*?<s>(\d+) open now<\/s>/.exec(ISEC)[1],
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

test('the same facts in all three, and they are the door\'s own, rule 3 included', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const E = window.__eternal, D = E.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        data: { tiles: D.tiles.map(x => x.href), verbs: D.tiles.map(x => x.name), n: D.n, limited: D.limited, notyet: D.notyet.map(x => x.title), act: D.act.href, row: D.index.row, floor: D.floorFound + '/' + D.floor.length },
        charms: document.querySelectorAll('#etKandi .bead:not(.hollow)').length, hollow: document.querySelectorAll('#etKandi .bead.hollow').length,
        beeRows: [...document.querySelectorAll('#etBeeRows a.et-b-row')].map(r => [r.getAttribute('href'), r.textContent.replace(/\s+/g, ' ').trim()]),
        table: document.querySelectorAll('#etTable tr').length, floor: t('#etFloor'), hint: t('#etRaverHint'), receipt: t('#etReceipt'),
        go: { bee: document.querySelector('#etBeeGo').getAttribute('href'), raver: document.querySelector('#etRaverGo').getAttribute('href') },
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ' reads the same door');
  assert.deepEqual(a.data.tiles, DISK.anchors, 'every tile of section.d, in order');
  assert.equal(a.data.n, DISK.n); assert.equal(a.data.limited, DISK.limited); assert.equal(a.data.row, DISK.row);
  assert.equal(a.data.tiles.length, 4); assert.equal(a.data.notyet.length, 2);
  assert.equal(a.data.act, '../kandi.html', 'the one thing to do is the door\'s own a.act');
  assert.equal(a.data.floor, '4/4', 'rule 3 and the kandi line are found in the door\'s own words');
  assert.deepEqual(a.beeRows.map(r => r[0]), a.data.tiles, 'the four ways in, as rows to their pages');
  a.beeRows.forEach((r, i) => assert.equal(r[1], a.data.verbs[i].replace(/\s*→$/, '')));
  assert.equal(a.charms, 4, 'a charm per way onto the floor'); assert.equal(a.hollow, 2, 'a hollow bead per thing not built');
  assert.match(a.hint, /4 charms · 2 hollow/);
  assert.equal(a.table, 6);
  assert.match(a.floor, /rule 3\s*no touching without consent · not decoration/); assert.match(a.floor, /4 of 4 rows found/);
  assert.match(facts.cypherpunk.receipt, /three numbers\s*4·4·4 ✓/);
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.equal(facts[reg].go.bee, a.data.act); assert.equal(facts[reg].go.raver, a.data.act); }
});

test('bee: four plain rows to four real pages; the not-built opens in place; the one action makes a kandi', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeRows .et-b-row[data-x="ny"]');
  const ny = await p.textContent('#eternal .et-b-more[data-x="ny"]');
  assert.match(ny, /A private raver marketplace/); assert.match(ny, /A live erc20i inscription art market/);
  await Promise.all([p.waitForURL(/\/surfaces\/festival\/index\.html$/), p.click('#etBeeRows a.et-b-row[href="../festival/index.html"]')]);
  await p.goBack(); await p.waitForFunction(() => window.__eternal && window.__eternal.data.tiles.length);
  await Promise.all([p.waitForURL(/\/surfaces\/kandi\.html$/), p.click('#etBeeGo')]);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: the chosen bead turns to the clasp; the pill opens exactly it; a hollow bead opens nothing new', async () => {
  const { ctx, p, errs } = await open('raver');
  const B = await p.evaluate(() => window.__eternal.beads.map(b => b.t ? b.t.href : 'hollow'));
  const n = B.length, kandi = B.indexOf('../kandi.html'), fest = B.indexOf('../festival/index.html'), hole = B.indexOf('hollow');
  const angle = () => p.$eval('#etKandi .ring', e => { const m = new DOMMatrix(getComputedStyle(e).transform); return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI); });
  const norm = x => ((Math.round(x) % 360) + 540) % 360 - 180;
  assert.equal(norm(await angle()), norm(-kandi * 360 / n), 'the one thing sits at the clasp first');
  await p.click(`#etKandi .bead[data-i="${fest}"]`); await p.waitForTimeout(1100);
  assert.equal(norm(await angle()), norm(-fest * 360 / n), 'the tapped bead turns to the clasp');
  assert.match(await p.textContent('#etRaverCard'), /Arrive with no ticket and no account/);
  assert.equal(await p.getAttribute('#etRaverGo', 'href'), '../festival/index.html'); assert.equal(await p.textContent('#etRaverGo'), 'Walk one day on the floor');
  await p.click(`#etKandi .bead[data-i="${hole}"]`); await p.waitForTimeout(1100);
  assert.match(await p.textContent('#etRaverCard'), /not built yet/);
  assert.equal(await p.getAttribute('#etRaverGo', 'href'), '../kandi.html'); assert.equal(await p.textContent('#etRaverGo'), 'make a kandi instead');
  assert.match(await p.$eval('#etKandi .spacer', e => getComputedStyle(e).animationDuration), /^6s$/, 'the spacers twinkle on a 6 s cycle');
  await p.click('#etMotion');
  assert.equal(await p.$eval('#etKandi .spacer', e => getComputedStyle(e).animationName), 'none', 'paused when asked');
  assert.equal(await p.$eval('#etKandi .ring', e => getComputedStyle(e).transitionDuration), '0s', 'and the turn becomes a step');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const still = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await still.addInitScript(() => { try { localStorage.setItem('bregister', 'raver'); } catch {} });
  const q = await still.newPage(); await q.goto(`${ORIGIN}/${PAGE}`); await q.waitForFunction(() => document.querySelector('#etKandi .spacer'));
  assert.equal(await q.$eval('#etKandi .spacer', e => getComputedStyle(e).animationName), 'none', 'still under reduced motion');
  await still.close();
});

test('cypherpunk: complete at first paint, and the recount is real: a drifted index row is named', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, now: document.querySelectorAll('#etPipe li.now').length, state: document.querySelector('#etState').textContent }));
  assert.equal(d.steps, 6); assert.equal(d.now, 0); assert.match(d.state, /three numbers read at \d\d:\d\d:\d\dZ/);
  await ctx.close();
  const drift = INDEX.replace(ISEC, ISEC.replace(/(href="plur\.html"[^]*?<s>)4( open now<\/s>)/, '$15$2'));
  assert.notEqual(drift, INDEX, 'the drifted index differs');
  const { ctx: c2, p: q } = await open('cypherpunk', { route: { url: `${ORIGIN}/surfaces/doors/index.html`, fn: r => r.fulfill({ status: 200, contentType: 'text/html', body: drift }) } });
  const v = await q.evaluate(() => ({ receipt: document.querySelector('#etReceipt').textContent, now: (document.querySelector('#etPipe li.now b') || {}).textContent }));
  assert.match(v.receipt, /5·4·4 · row/, 'the odd one out is the index row, by name'); assert.match(v.now, /verdict/);
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
