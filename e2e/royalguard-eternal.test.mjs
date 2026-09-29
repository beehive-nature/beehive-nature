// royalguard-eternal.test.mjs — the ROYAL GUARD (one deck: the DAO, the treasuries, the wallet) as
// three products in one surface (founder blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 2).
// Proves at 390 px: exactly one front per register, each in its own dress, structure and gesture;
// all three carry the SAME facts (the page's own three doors, what each parent reads, a LIVE count
// of every field on the deck, and the one external number the page publishes); and ZERO CUSTODY:
// no front takes an input or makes a request, no request leaves the origin, and the one gesture
// that "does" something only counts again, honestly (a planted field is counted).
// Run: node --test e2e/royalguard-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9173, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.addInitScript(() => { const w = window; w.__net = []; const f = w.fetch; w.fetch = function (u) { w.__net.push(String(u && u.url || u)); return f.apply(this, arguments); };
    const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { w.__net.push(String(u)); return o.apply(this, arguments); }; });
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push([r.request().resourceType(), u]); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/royalguard.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.doors.length === 3, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  return { ctx, p, errs, outside, requests };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const txt = s => (s || '').replace(/\s+/g, ' ').trim();
async function hold(p, ms) {
  await p.locator('#etArt .shield polygon').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etArt .shield polygon').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250);
}
const LIVE = () => ({ fields: [...document.querySelectorAll('input,textarea,select,[contenteditable]:not([contenteditable="false"])')].filter(e => !e.closest('#tbar,#bregbar,#adOrb,#adWin,#blangctl,#railsbadge')).length,
  forms: [...document.querySelectorAll('form')].filter(e => !e.closest('#tbar,#bregbar,#adOrb,#adWin,#blangctl,#railsbadge')).length });

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
        radios: fr.querySelectorAll('.et-b-rows [role="radio"]').length, arcs: fr.querySelectorAll('svg.et-r-art .ring').length, table: !!fr.querySelector('table.et-c-tab'), inputs: fr.querySelectorAll('input,textarea,select,form,[contenteditable]').length };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.radios === 3, reg === 'bee'); assert.equal(d.arcs === 3, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.equal(d.inputs, 0, reg + ': a front takes no input');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'no request left the origin'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the doors, what they read, the live count, the one number', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(LIVE => {
      const D = window.__eternal.data;
      return {
        model: D.doors.map(d => [d.k, d.href, d.name, d.reads]), count: [D.count.fields, D.count.forms], live: (new Function('return (' + LIVE + ')()'))(),
        dom: [...document.querySelectorAll('.doors a.door')].map(a => [a.getAttribute('href'), a.querySelector('.dt').textContent]),
        law: document.querySelector('.doors').parentElement.querySelector('.law[data-reg="cypherpunk"]').textContent.replace(/\s+/g, ' '),
        regs: document.querySelector('.regs').textContent.replace(/\s+/g, ' '),
        bee: [...document.querySelectorAll('#etBeeRows [role="radio"]')].map(r => r.dataset.door), beeNum: document.querySelector('#etBeeNumber').textContent, beeFoot: document.querySelector('#etBeeFoot').textContent,
        arcs: [...document.querySelectorAll('#etArt .ring')].map(g => g.dataset.door), raverNum: document.querySelector('#etRaverNumber').textContent,
        rows: [...document.querySelectorAll('#etDoors tr')].map(r => [...r.children].map(c => c.textContent)), receipt: document.querySelector('#etReceipt').textContent, S: D.sample,
      };
    }, LIVE.toString());
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model.map(m => [m[1], m[2]]), a.dom, 'the doors are the page\'s own');
  for (const r of ['raver', 'cypherpunk']) { assert.deepEqual(facts[r].model, a.model); assert.deepEqual(facts[r].count, a.count); }
  for (const m of a.model) assert.ok(a.law.includes(m[3]), 'what ' + m[0] + ' reads is quoted from the page: ' + m[3]);
  assert.deepEqual([a.live.fields, a.live.forms], a.count, 'the count is live, not declared');
  assert.deepEqual(a.count, [0, 0], 'the deck has no field and no form');
  // the one external number, exactly as the page publishes it
  const S = a.S;
  for (const v of ['$' + S.h1usd, S.h1ant + ' ANT', '$' + S.d7usd, S.d7ant + ' ANT', '$' + S.antUsd, '$' + S.ethUsd, ...S.theirs, S.src, S.read]) assert.ok(a.regs.includes(v), 'the page states ' + v);
  assert.match(a.beeNum, /about \$1\.49, or 21\.1 ANT/); assert.match(a.beeFoot, /nowhere on this page to type a key/);
  assert.match(txt(facts.raver.raverNum), /\$1\.49 · 1 GB · 1 h21\.1 ANT/);
  assert.match(txt(facts.cypherpunk.receipt), /sample1 h \$1\.49 \(21\.1 ANT\) · 7 d \$1\.26 \(23\.3 ANT\) · ANT \$0\.0408 · ETH \$2,435/);
  assert.match(txt(facts.cypherpunk.receipt), /fields0 · input, textarea, select, contenteditable/);
  assert.deepEqual(a.bee, ['dao', 'treas', 'wallet']); assert.deepEqual(facts.raver.arcs, ['dao', 'treas', 'wallet']);
  assert.deepEqual(facts.cypherpunk.rows.map(r => r[1]), a.model.map(m => m[1]));
});

test('bee: pick a door, and the one action is an ordinary same-tab link to it', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  await p.click('#etBeeRows [data-door="treas"]');
  assert.equal(await p.getAttribute('#etBeeRows [data-door="treas"]', 'aria-checked'), 'true');
  const go = await p.$eval('#etBeeGo', a => [a.textContent, a.getAttribute('href'), a.target]);
  assert.deepEqual(go, ['open the treasuries', 'bantfarm.html', '']);
  assert.equal(await p.evaluate(() => window.__net.length), 0, 'choosing fetched nothing');
  assert.deepEqual(outside, [], 'no request left the origin from this deck');
  await p.click('#etBeeGo'); await p.waitForURL('**/surfaces/bantfarm.html');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a door, and holding the shield counts every field on the deck, live; a short hold counts nothing', async () => {
  const { ctx, p, errs, outside, requests } = await open('raver');
  await p.click('#etArt .ring[data-door="wallet"] textPath');
  assert.deepEqual(await p.$eval('#etRaverGo', a => [a.textContent, a.getAttribute('href')]), ['enter the wallet', 'keys/addresses.html']);
  const req0 = requests.length;
  await hold(p, 400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.counted), false, 'a short hold counts nothing');
  await hold(p, 1500);
  assert.equal(await p.evaluate(() => window.__eternal.raver.counted), true);
  assert.equal(await p.$eval('#etArt .shield text', t => t.textContent), '0');
  assert.match(txt(await p.textContent('#etRaverCard')), /0 fields · 0 forms · counted just now/);
  // honesty: a planted field is counted by the next hold — the number is measured, never declared
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'planted'; document.querySelector('main header').appendChild(i); });
  await hold(p, 1500);
  assert.equal(await p.$eval('#etArt .shield text', t => t.textContent), '1', 'the guard counts what is really there');
  assert.deepEqual(requests.slice(req0).filter(([t]) => t !== 'font' && t !== 'stylesheet'), [], 'the hold makes no request');
  assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; a row picks the door; recount is live', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('#etDoors tr.pick').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    links: [...document.querySelectorAll('.et-c a[href^="http"]')].map(a => [a.target, a.rel, /new tab/.test(a.textContent)]) }));
  assert.deepEqual([d.rows, d.steps, d.receipt], [3, 6, 8]);
  assert.equal(d.now, 'choose · 3 doors');
  assert.ok(d.links.length === 2 && d.links.every(l => l[0] === '_blank' && l[1] === 'noopener noreferrer' && l[2]));
  await p.click('#etDoors tr.pick[data-door="treas"]');
  assert.deepEqual(await p.$eval('#etCyGo', a => [a.textContent, a.getAttribute('href')]), ['enter bantfarm.html', 'bantfarm.html']);
  await p.click('#etCyCount');
  assert.match(txt(await p.textContent('#etReceipt')), /counted\d\d:\d\d:\d\d utc · on your tap/);
  assert.equal(await p.evaluate(() => window.__net.length), 0, 'recount fetched nothing');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions, nothing past the screen edge', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /(^|\s)(NaN|undefined|null)(\s|$)/.test(own)) out.push('bad value ' + el.className);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push('offside ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20)); // a page's overflow-x:hidden must not hide a cut
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
