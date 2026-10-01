// blight-index-eternal.test.mjs — the bLighT fLeeT front door as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal).
// Proves at 390 px: exactly one front per register, each in its own dress; all three carry the SAME
// facts (the six doors read from the page's own cards, the funnel order, the wallet state); and the
// one real action, connect wallet, is handed to the page's own #connect in every register: with no
// wallet the fronts say so, with a wallet they show only the account the wallet answered with.
// Run: node --test e2e/blight-index-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/index.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8946, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, wallet) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  if (wallet) await ctx.addInitScript(a => { window.ethereum = { request: async q => q.method === 'eth_requestAccounts' ? [a] : [], on() {} }; }, wallet);
  // the chain is outside this box: every RPC and indexer is refused, so the exhibits must say so
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.doors.length, null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

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
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      const act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('three different products: rows, an orbit, a manifest', async () => {
  const { ctx, p } = await open('bee');
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etFlRooms a.et-b-row').length,
    planets: document.querySelectorAll('#etFlOrbit .et-planet').length, orbits: document.querySelectorAll('#etFlOrbit > circle').length,
    table: document.querySelectorAll('#etFlDoors tr').length, pipe: document.querySelectorAll('#etFlPipe li').length,
  }));
  assert.deepEqual(s, { rows: 6, planets: 6, orbits: 4, table: 6, pipe: 4 });
  await ctx.close();
});

test('the same facts in all three: the six doors, their phases and paths', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        doors: D.doors.map(d => d.name + '|' + d.phase + '|' + d.href),
        cards: [...document.querySelectorAll('.grid > a.card')].map(a => a.querySelector('h2').textContent.trim() + '|' + a.querySelector('.phase').textContent.trim() + '|' + a.getAttribute('href')),
        bee: [...document.querySelectorAll('#etFlRooms a.et-b-row')].map(a => a.querySelector('span').textContent + '|' + a.getAttribute('href')),
        raver: [...document.querySelectorAll('#etFlOrbit .et-planet')].map(g => g.getAttribute('aria-label')).sort(),
        cy: [...document.querySelectorAll('#etFlDoors tr')].map(r => r.cells[1].querySelector('a').textContent + '|' + r.cells[2].textContent),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.doors, a.cards, 'the fronts read the page\'s own cards');
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].doors, a.doors);
  assert.deepEqual(a.bee, a.doors.map(d => d.split('|')[0] + '|' + d.split('|')[2]));
  assert.deepEqual(facts.raver.raver, a.doors.map(d => d.split('|')[0] + ' · ' + d.split('|')[1]).sort());
  assert.deepEqual(facts.cypherpunk.cy, a.doors.map(d => d.split('|')[0] + '|' + d.split('|')[1]));
  assert.equal(a.doors.filter(d => /docked/.test(d)).length, 1, 'one door waits, docked');
});

test('connect, honestly: no wallet is said plainly; a wallet shows only what it answered', async () => {
  for (const [reg, btn] of [['bee', '#etFlBeeConnect'], ['raver', '#etFlRaverConnect'], ['cypherpunk', '#etFlCyConnect']]) {
    const { ctx, p, errs } = await open(reg);
    await p.click(btn); await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ connect: document.getElementById('connect').textContent, front: document.querySelector('#eternal').textContent }));
    assert.equal(s.connect, 'connect wallet', reg + ': nothing connected without a wallet');
    assert.doesNotMatch(s.front, /(?<!not )connected · 0x/, reg + ': no front claims a connection');
    assert.match(s.front, /no wallet was found in this browser|none in this browser/, reg + ': the absence is said');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  const acct = '0x' + 'ab'.repeat(20);
  const { ctx, p } = await open('cypherpunk', acct);
  await p.click('#etFlCyConnect'); await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({ connect: document.getElementById('connect').textContent, acct: window.__eternal.data.wallet.account, rcpt: document.getElementById('etFlReceipt').textContent, bee: document.getElementById('etFlBeeWallet').textContent }));
  assert.match(s.connect, /^connected · 0xabab/, 'the page\'s own #connect did the work');
  assert.equal(s.acct, s.connect.split('· ')[1]); assert.ok(s.rcpt.includes(s.acct)); assert.ok(s.bee.includes(s.acct), 'all three fronts carry the same account');
  await ctx.close();
});

test('raver: tap a planet to choose a door; the pill flies there', async () => {
  const { ctx, p } = await open('raver');
  await p.locator('#etFlOrbit .et-planet[data-i="2"]').dispatchEvent('click');
  const d = await p.evaluate(() => window.__eternal.data.doors[2]);
  assert.equal(await p.getAttribute('#etFlOrbit .et-planet[data-i="2"]', 'aria-pressed'), 'true');
  assert.ok((await p.textContent('#etFlRaverCard')).includes(d.name));
  assert.equal(await p.getAttribute('#etFlRaverGo', 'href'), d.href);
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
