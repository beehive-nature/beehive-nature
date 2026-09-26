// buzz-directory-eternal.test.mjs — the buzz directory as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; the SAME facts in all three (read from the page's own hand-checked records: two estate hives,
// the public rooms, open and expired, the named seats); and no gesture claims presence or fakes a
// door — every door is the record's own link, and the page still fetches nothing.
// Run: node --test e2e/buzz-directory-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.ETERNAL_PAGE || 'surfaces/buzz-directory.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8985, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const u = decodeURIComponent(q.url.split('?')[0]); const f = join(ROOT, u === '/surfaces/buzz-directory.html' ? PAGE : u); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
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
  await p.goto(`${ORIGIN}/surfaces/buzz-directory.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.rooms && window.__eternal.data.rooms.length, null, { timeout: 30000 });
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


const HTML = await readFile(join(ROOT, 'surfaces/buzz-directory.html'), 'utf8');
const PUB = HTML.slice(HTML.indexOf('id="public-directory"'), HTML.indexOf('4 · invite / expiry honesty'));
const OPEN = (PUB.match(/class="chip ok"/g) || []).length, EXP = (PUB.match(/class="chip bad"/g) || []).length;

test('the same facts in all three: the hives, the rooms open and expired, the seats', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, all = s => [...document.querySelectorAll(s)], t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        model: JSON.stringify({ h: D.hives, r: D.rooms, s: D.seats, c: D.checked }),
        n: { hives: D.hives.length, rooms: D.rooms.length, open: D.open, expired: D.expired, seats: D.seats.length, checked: D.checked },
        beeRows: all('#etBeeRows .et-b-row').map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        beeSeats: all('#etBeeSeats .et-name').map(e => e.textContent),
        cells: all('#etComb .comb').length, dashed: all('#etComb .comb .cell[stroke-dasharray]').length,
        rooms: all('#etRooms tr').map(r => r.textContent), cyReceipt: t('#etReceipt'), cySeats: all('#etSeats .et-name').map(e => e.textContent),
        pageSeats: all('#people-agents .lname').map(e => e.textContent),
      };
    });
    await ctx.close();
  }
  const a = facts.bee, n = a.n;
  for (const reg of ['raver', 'cypherpunk']) assert.equal(facts[reg].model, a.model, reg + ' reads the same records');
  assert.deepEqual([n.rooms, n.open, n.expired, n.hives], [OPEN + EXP, OPEN, EXP, 2], 'the counts are the page\'s own chips');
  assert.equal(n.checked, '2026-08-31');
  assert.ok(a.beeRows.some(r => r.includes(`${n.rooms} rooms · ${n.open} open`)));
  assert.ok(a.beeRows.some(r => r.includes('invites that have expired') && r.endsWith(String(n.expired))));
  assert.deepEqual(a.beeSeats, a.pageSeats, 'names exactly as the roster cases them');
  assert.equal(facts.raver.cells, n.rooms + n.hives, 'one cell per door'); assert.equal(facts.raver.dashed, n.expired, 'an expired invite is drawn hollow');
  assert.equal(facts.cypherpunk.rooms.length, n.rooms);
  assert.equal(facts.cypherpunk.rooms.filter(r => /verified 2026-08-31/.test(r)).length, n.open);
  assert.match(facts.cypherpunk.cyReceipt, new RegExp(`${n.rooms} · ${n.open} open · ${n.expired} expired`));
  assert.deepEqual(facts.cypherpunk.cySeats, facts.cypherpunk.pageSeats);
});

test('bee: the one action is the real door, in a new tab; "every room" opens the instrument', async () => {
  const { ctx, p, errs } = await open('bee');
  const door = await p.$eval('#etBeeDoor', a => [a.href, a.target, a.rel]);
  assert.deepEqual(door, ['https://relay.skaists.dev/', '_blank', 'noopener noreferrer']);
  await p.click('#etBeeAll'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.body.getAttribute('data-dir-beat')), 'deeper');
  assert.equal(await p.isVisible('#public-directory'), true, 'the whole directory is shown, not a summary of it');
  await p.click('#etBeeSeatsBtn');
  assert.equal(await p.isVisible('#etBeeSeats'), true);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a cell to light it; the pill is that room\'s own door, never a claim', async () => {
  const { ctx, p, errs } = await open('raver');
  const k = await p.evaluate(() => window.__eternal.data.rooms.findIndex(r => !r.ok) + 2);
  await p.click(`#etComb .comb[data-k="${k}"] .hit`, { force: true });
  assert.equal(await p.getAttribute(`#etComb .comb[data-k="${k}"]`, 'aria-pressed'), 'true');
  const exp = await p.evaluate(k => window.__eternal.data.rooms[k - 2], k);
  assert.match(await p.textContent('#etRaverCard'), /the invite expired/);
  assert.deepEqual(await p.$eval('#etRaverDoor', a => [a.getAttribute('href'), a.target, a.rel]), [exp.source, '_blank', 'noopener noreferrer'], 'an expired room points at its source, not a dead invite');
  const j = await p.evaluate(() => window.__eternal.data.rooms.findIndex(r => r.ok && r.code) + 2);
  await p.click(`#etComb .comb[data-k="${j}"] .hit`, { force: true });
  const room = await p.evaluate(j => window.__eternal.data.rooms[j - 2], j);
  assert.equal(await p.getAttribute('#etRaverDoor', 'href'), room.join, 'an open room is its own buzz:// invite');
  assert.match(room.join, /^buzz:\/\/join\?/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and says how to check it', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    hives: document.querySelectorAll('#etHives tr').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    verify: document.querySelector('.et-c-verify').textContent, fork: document.querySelector('.et-c a[href*="github.com"]').rel,
  }));
  assert.equal(d.hives, 2); assert.equal(d.steps, 6); assert.equal(d.receipt, 6); assert.equal(d.now, 'join');
  assert.match(d.verify, /base64url/); assert.equal(d.fork, 'noopener noreferrer');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
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
        if (/^[—–-]$|NaN|undefined/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
