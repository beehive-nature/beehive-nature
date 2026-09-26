// skaists-buzz-eternal.test.mjs — the skaists.buzz hive door's three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal). Written for one person: someone with the buzz desktop
// app. Proves at 390 px: exactly one front per register, each in its own dress; all three carry the
// SAME facts (both roads, the clean road for filtered networks, the invite, the relay's state), read
// from the door's own markup and its own single relay check; "live" is drawn only when the relay
// answers and "copied" only when the clipboard says so; served by the relay itself the invite stays
// relative; and with no design system (the one-file relay deploy) the fronts stand down and the door
// shows as it always did. Run: node --test e2e/skaists-buzz-eternal.test.mjs
// Red on the page before the fronts: ETERNAL_PAGE_FILE=<git show HEAD:surfaces/doors/skaists-buzz.html> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'doors/skaists-buzz.html', RELAY = 'skaists.buzz', CLEAN = 'relay.skaists.dev';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9123, ORIGIN = `http://127.0.0.1:${PORT}`, ON_RELAY = `http://${RELAY}:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const url = decodeURIComponent(q.url.split('?')[0]);
    const f = url === `/surfaces/${PAGE}` && process.env.ETERNAL_PAGE_FILE ? process.env.ETERNAL_PAGE_FILE : join(ROOT, url);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
// the relay's own name resolves to this test server, so "served by the relay" can be proven offline
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${RELAY} 127.0.0.1`] }); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, { live = false, base = ORIGIN, bare = false, clip = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (clip && base === ORIGIN) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const probes = [];
  await ctx.route('**/*', r => {
    const req = r.request(), u = req.url();
    if (!u.startsWith(base)) return r.abort('blockedbyclient');
    const path = new URL(u).pathname;
    if (path === '/api/join-policy') probes.push(path);
    if (bare && path.endsWith('/skaists.css')) return r.fulfill({ status: 404, body: '' });
    if (live && path === '/api/join-policy') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"mode":"roster"}' });
    if (live && path === '/' && /nostr\+json/.test(req.headers().accept || '')) return r.fulfill({ status: 200, contentType: 'application/nostr+json', body: JSON.stringify({ name: 'skaists', supported_nips: [1, 11, 42] }) });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${base}/surfaces/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.relay.state !== 'checking' && document.body.dataset.reg, null, { timeout: 20000 });
  await p.waitForTimeout(250);
  return { ctx, p, errs, probes };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const doorTruth = p => p.evaluate(() => ({
  roads: [...document.querySelectorAll('main .card button[data-copy]')].map(b => b.getAttribute('data-copy')),
  invite: document.querySelector('main a.btn').getAttribute('href'),
}));

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

test('the same facts in all three: both roads, the clean road for filtered networks, the invite, the relay', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg);
    const t = await doorTruth(p);
    assert.deepEqual(t.roads, [`wss://${RELAY}`, `wss://${CLEAN}`], 'the door lists both roads');
    const d = await p.evaluate(() => ({
      D: { roads: window.__eternal.data.roads.map(r => r.url), buzz: window.__eternal.data.roads.map(r => r.buzz), invite: window.__eternal.data.invite, state: window.__eternal.data.relay.state, policy: window.__eternal.data.relay.policy },
      bee: [...document.querySelectorAll('#etBeeRows .et-b-road')].map(r => r.textContent),
      raver: [...document.querySelectorAll('#etRoads .road')].map(g => g.getAttribute('aria-label')),
      cy: [...document.querySelectorAll('#etTab tr')].map(r => r.textContent),
      go: [...document.querySelectorAll('#etBeeGo,#etRGo,#etCGo')].map(a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, txt: a.textContent })),
      status: [document.getElementById('etBeeStatus').textContent, document.getElementById('etRStatus').textContent, document.getElementById('etKv').textContent, document.getElementById('etChips').textContent],
      stat: document.getElementById('stat').textContent, dot: document.getElementById('dot').className,
      legend: document.getElementById('etLegend').textContent,
    }));
    // the data layer is the door
    assert.deepEqual(d.D.roads, t.roads); assert.deepEqual(d.D.buzz, [true, false]);
    // both roads in every register, and the clean one named for filtered networks
    t.roads.forEach((u, i) => { assert.ok(d.bee[i].includes(u), 'bee ' + u); assert.ok(d.raver[i].endsWith(u), 'raver ' + u); assert.ok(d.cy[i].includes(u), 'cypherpunk ' + u); });
    assert.match(d.bee[1], /if your network blocks \.buzz/); assert.match(d.cy[1], /for filtered networks/); assert.match(d.cy[0], /sni says \.buzz/);
    assert.match(d.legend, /some networks cut \.buzz/);
    // one outcome: the door's own invite path, on the clean road because this address is not the relay, said as a new tab
    assert.equal(d.D.invite.href, `https://${CLEAN}${t.invite}`);
    for (const g of d.go) { assert.equal(g.href, d.D.invite.href); assert.equal(g.target, '_blank'); assert.match(g.rel, /noopener/); assert.match(g.rel, /noreferrer/); assert.match(g.txt, /opens in a new tab/); }
    // the relay was not read from here: said the same way everywhere, never "live"
    assert.equal(d.D.state, 'unreachable'); assert.equal(d.D.policy, 404);
    assert.match(d.status[0], /can't be checked from this copy/); assert.match(d.status[1], /not read from here/);
    assert.match(d.status[2], /GET \/api\/join-policy404/); assert.match(d.status[3], /relay not read here/);
    assert.doesNotMatch(d.status.join(' '), /\blive\b/);
    assert.equal(d.stat, 'relay unreachable right now — check back soon', 'the door\'s own status line is unchanged'); assert.doesNotMatch(d.dot, /live/);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('live only when the relay answers: the same answer in the door and in all three fronts', async () => {
  const { ctx, p, errs, probes } = await open('raver', { live: true });
  const d = await p.evaluate(() => ({
    state: window.__eternal.data.relay.state, stat: document.getElementById('stat').textContent, dot: document.getElementById('dot').className,
    bee: document.getElementById('etBeeStatus').textContent, raver: document.getElementById('etRStatus').textContent, kv: document.getElementById('etKv').textContent,
    hive: document.querySelector('#etRoads .hive polygon').getAttribute('fill'), bio: getComputedStyle(document.body).getPropertyValue('--sk-biomass').trim(),
  }));
  assert.equal(d.state, 'live'); assert.match(d.dot, /live/);
  assert.equal(d.stat, 'relay LIVE — membership enforced, auth required · “skaists” · NIPs 1,11,42');
  assert.match(d.bee, /open and answering/); assert.match(d.raver, /hive live · “skaists”/); assert.match(d.kv, /“skaists” · NIPs 1,11,42/);
  assert.equal(d.hive, d.bio, 'the hive lights biomass green only when live');
  assert.equal(probes.length, 1, 'one relay check for the door and its three fronts');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('served by the relay itself: the invite stays relative and the page says "quiet", not "not here"', async () => {
  const { ctx, p, errs } = await open('bee', { base: ON_RELAY });
  const t = await doorTruth(p);
  const d = await p.evaluate(() => ({ on: window.__eternal.data.onRelay, href: document.getElementById('etBeeGo').getAttribute('href'), target: document.getElementById('etBeeGo').target, small: [...document.querySelectorAll('#etBeeGo small')].filter(s => !s.hidden).length, status: document.getElementById('etBeeStatus').textContent }));
  assert.equal(d.on, true); assert.equal(d.href, t.invite, 'the door\'s own relative invite'); assert.equal(d.target, ''); assert.equal(d.small, 0);
  assert.match(d.status, /didn't answer just now/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('copy is honest: "copied" only when the clipboard took it; otherwise the address is selected', async () => {
  { // a secure page with clipboard access: the road really lands on the clipboard
    const { ctx, p, errs } = await open('bee');
    await p.click('#etBeeRows .et-b-road:nth-child(2) .et-b-copy');
    await p.waitForFunction(() => window.__eternal.data.copied);
    const d = await p.evaluate(async () => ({ btn: document.querySelector('#etBeeRows .et-b-road:nth-child(2) .et-b-copy').textContent, clip: await navigator.clipboard.readText(), copied: window.__eternal.data.copied }));
    assert.equal(d.btn, 'copied'); assert.equal(d.clip, `wss://${CLEAN}`); assert.equal(d.copied, `wss://${CLEAN}`);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  { // plain http on the relay's name has no clipboard: the page says so and selects the address instead
    const { ctx, p, errs } = await open('cypherpunk', { base: ON_RELAY });
    await p.click('#etTab tr:nth-child(2) .et-c-copy'); await p.waitForTimeout(200);
    const d = await p.evaluate(() => ({ btn: document.querySelector('#etTab tr:nth-child(2) .et-c-copy').textContent, sel: String(getSelection()), copied: window.__eternal.data.copied }));
    assert.equal(d.btn, 'select it'); assert.equal(d.sel, `wss://${CLEAN}`); assert.equal(d.copied, null, 'never claimed');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: a tap takes a road; the hive tells its state and offers nothing to copy', async () => {
  const { ctx, p, errs } = await open('raver');
  // tap ON the road, halfway along it (a curve's box centre is not on the curve)
  await p.locator('#etRoads').scrollIntoViewIfNeeded();
  const pt = await p.evaluate(() => { const w = document.querySelector('#etRoads .road[data-k="1"] .way'), q = w.getPointAtLength(w.getTotalLength() / 2), m = w.getScreenCTM(); return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f }; });
  await p.mouse.click(pt.x, pt.y);
  let d = await p.evaluate(() => ({ on: [...document.querySelectorAll('#etRoads [aria-pressed="true"]')].map(g => g.dataset.k), card: document.getElementById('etRCard').textContent, copy: document.getElementById('etRCopy').getAttribute('data-et-copy'), hidden: document.getElementById('etRCopy').hidden }));
  assert.deepEqual(d.on, ['1']); assert.match(d.card, /relay\.skaists\.dev.*clean road.*for filtered networks/); assert.equal(d.copy, `wss://${CLEAN}`); assert.equal(d.hidden, false);
  await p.focus('#etRoads .hive'); await p.keyboard.press('Enter');
  d = await p.evaluate(() => ({ on: [...document.querySelectorAll('#etRoads [aria-pressed="true"]')].map(g => g.dataset.k), card: document.getElementById('etRCard').textContent, hidden: document.getElementById('etRCopy').hidden }));
  assert.deepEqual(d.on, ['2']); assert.match(d.card, /hive not read from here/); assert.equal(d.hidden, true);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
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

test('the door keeps working, and stands down whole when the design system is absent (the one-file relay deploy)', async () => {
  const src = await readFile(process.env.ETERNAL_PAGE_FILE || join(ROOT, 'surfaces', PAGE), 'utf8');
  assert.doesNotMatch(src, /data-i18n="et\./, 'front strings ride T(), never the corpus attribute');
  { // the old door's ids and copy buttons still work
    const { ctx, p, errs } = await open('bee');
    const d = await p.evaluate(() => ({ ids: ['dot', 'stat', 'wss', 'invite', 'invnote'].every(id => document.getElementById(id)), h1: document.querySelector('h1').textContent }));
    assert.ok(d.ids, 'every old id is still here'); assert.equal(d.h1, 'skaists.buzz');
    await p.click('main .card button[data-copy="wss://' + RELAY + '"]'); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()), `wss://${RELAY}`);
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  { // no skaists.css: no half-dressed front, the old door as it was, its status line still honest
    const { ctx, p, errs } = await open('raver', { bare: true });
    const d = await p.evaluate(() => ({ bare: document.documentElement.hasAttribute('data-et-bare'), front: getComputedStyle(document.getElementById('eternal')).display, arch: getComputedStyle(document.getElementById('etArchive')).display, stat: document.getElementById('stat').textContent, card: document.querySelector('main .card').getClientRects().length }));
    assert.equal(d.bare, true); assert.equal(d.front, 'none'); assert.equal(d.arch, 'none'); assert.ok(d.card > 0);
    assert.equal(d.stat, 'relay unreachable right now — check back soon');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});
