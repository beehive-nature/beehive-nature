// or-board-eternal.test.mjs — the OR board as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal; ETERNAL wave 3). Proves at 390 px: exactly one front per register,
// each in its own dress, structure and gesture; all three carry the SAME facts, read from the board's
// own state (window.__orboard: the read door's answer, else the labelled file floor from
// #orboard-data, and the bug rows); a file row is never drawn as live presence; every "check again"
// is the page's own readHive() against the keyless read door (the only off-origin request, and this
// box refuses it). The live path is proved with a fixture answer for the door (named below).
// Run: node --test e2e/or-board-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9253, ORIGIN = `http://127.0.0.1:${PORT}`, FEED = 'https://relay.skaists.dev/hive/board.json';
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const HTML = await readFile(join(ROOT, 'surfaces/or-board.html'), 'utf8');
const FILE = JSON.parse(/<script id="orboard-data" type="application\/json">([\s\S]*?)<\/script>/.exec(HTML)[1]);
// FIXTURE (not a live read): what the keyless read door answers when two seats are present
const LIVE = { generated: '2026-09-26T10:00:00Z', seats: [
  { name: 'z2.1', comb: 'capped', agent: 'profiled', roster_role: 'workhorse', pubkey: 'ab'.repeat(32), profile_10100: JSON.stringify({ session: 's-fixture', model: '5.3', lane: 'buzz-directory' }), last_general: 'fixture presence post', last_general_at: '2026-09-26 09:59', general_posts: 3 },
  { name: 'zQ', comb: 'honey', agent: 'profiled', roster_role: '', pubkey: 'cd'.repeat(32), profile_10100: JSON.stringify({ lane: 'fixture-lane' }) } ] };

async function open(reg, { live = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    outside.push(u);
    if (live && u === FEED) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(LIVE) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/or-board.html`, { waitUntil: 'load' });
  await p.waitForFunction(l => window.__eternal && window.__eternal.data.source === (l ? 'live' : 'file'), live, { timeout: 15000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, outside };
}
const drawn = p => p.evaluate(() => ({
  D: window.__eternal.data,
  bee: [...document.querySelectorAll('#etBeeRows .et-b-seatrow')].map(r => { const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT), out = []; while (w.nextNode()) if (w.currentNode.textContent.trim()) out.push(w.currentNode.textContent.trim()); return out.join(' '); }), bugsRow: document.querySelector('#etBeeRows [data-et-open="bugs"]').textContent,
  sectors: [...document.querySelectorAll('#etArt [data-et-seat]')].map(g => [g.getAttribute('class'), g.getAttribute('aria-label')]), moons: [...document.querySelectorAll('#etArt circle.moon')].map(c => c.getAttribute('class')), hive: document.querySelector('#etArt .wh-t').textContent,
  rows: [...document.querySelectorAll('#etSeats tr.pick')].map(r => [...r.cells].map(c => c.textContent)), bugs: [...document.querySelectorAll('#etBugs tr')].map(r => [...r.cells].map(c => c.textContent)), receipt: document.querySelector('#etReceipt').textContent.replace(/\s+/g, ' '),
}));

test('each register: its own front, dress and structure; the file floor, labelled; the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', actSel: '.et-b-primary', titleSel: '.et-b-h' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', actSel: '.et-r-pill', titleSel: '.et-r-h' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', actSel: '.et-c-primary', titleSel: '.et-c-path' },
  };
  const models = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    const d = await p.evaluate(w => {
      const txt = s => (s || '').replace(/\s+/g, ' ').trim();
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + w.front), bad = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('value ' + own);
        const r = el.getBoundingClientRect(); if (r.right > 390.5) bad.push('edge ' + el.tagName + ' ' + Math.round(r.right));
        if ((/^(BUTTON|A|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) bad.push('small ' + el.tagName + ' ' + txt(el.textContent).slice(0, 20));
      }
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.titleSel)).fontFamily, action: getComputedStyle(fr.querySelector(w.actSel)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, wheel: fr.querySelectorAll('svg.et-r-art [data-et-seat]').length, tables: fr.querySelectorAll('table.et-c-tab').length, fallback: document.getElementById('fallback').classList.contains('show'),
        model: (({ source, seats, bugs, live, retired, pollS, feed }) => ({ source, seats, bugs, live, retired, pollS, feed }))(window.__eternal.data) };
    }, w);
    assert.deepEqual(d.shown, [w.front], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.wheel > 0, reg === 'raver', 'raver is the wheel'); assert.equal(d.tables > 0, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ': the laws on the front');
    assert.equal(d.fallback, true, 'the page itself says: file floor');
    assert.ok(outside.length && outside.every(u => u === FEED), reg + ': the one off-origin request is the page\'s own read door (' + outside.join(', ') + ')');
    assert.equal(errs.length, 0, errs.join(' | '));
    models[reg] = d.model;
    if (reg === 'bee') {
      const x = await drawn(p);
      // the facts are #orboard-data's own, and every renderer labels them as the file
      assert.deepEqual(x.D.seats.map(s => [s.name, s.lane, s.progress, s.src]), FILE.agents.map(a => [a.name, a.lane, a.progress, 'file']));
      assert.deepEqual(x.D.bugs.map(b => [b.id, b.status]), FILE.bugs.map(b => [b.id, b.status]));
      assert.deepEqual(x.bee, FILE.agents.map(a => `${a.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)} ${a.name} working on: ${a.lane} ${a.progress}% · saved`));
      assert.equal(x.bugsRow, `problems being fixed${FILE.bugs.length} · ${FILE.bugs.filter(b => b.status === 'closed').length} fixed`);
      assert.equal(x.sectors.length, FILE.agents.length); assert.ok(x.sectors.every(s => /^file/.test(s[0]) && /file row, not live$/.test(s[1])), 'every petal is a dashed file row');
      assert.deepEqual(x.moons, FILE.bugs.map(b => 'moon' + (b.status === 'closed' ? ' closed' : ''))); assert.equal(x.hive, 'file');
      assert.deepEqual(x.rows.map(r => r[0] + '|' + r[2] + '|' + r[3]), FILE.agents.map(a => `${a.name}|${a.progress}%|file`));
      assert.deepEqual(x.bugs.map(r => r[0] + '|' + r[2]), FILE.bugs.map(b => b.id + '|' + b.status));
      assert.match(x.receipt, /statusfailed · file floorgeneratednot readlive seats0file rows4 shown · 0 retired · of 4/);
    }
    await ctx.close();
  }
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(models[reg], models.bee, reg + ' reads the same facts');
  assert.deepEqual([models.bee.source, models.bee.live.length, models.bee.pollS, models.bee.feed], ['file', 0, 30, FEED]);
});

test('the live door (fixture answer): live seats drawn as live, their file rows retired, in all three renderers', async () => {
  const { ctx, p, errs } = await open('cypherpunk', { live: true });
  const x = await drawn(p);
  assert.equal(x.D.source, 'live'); assert.equal(x.D.generated, LIVE.generated); assert.equal(x.D.retired, 1, 'z2.1 is live, so its file row retires');
  assert.deepEqual(x.D.seats.map(s => s.name + ':' + s.src), ['z2.1:live', 'zQ:live', 'z2.2:file', 'z1.1:file', 'bClaude:file']);
  assert.match(x.bee[0], /^z2 z2\.1 said: fixture presence post here now$/); assert.match(x.bee[1], /zQ .*profiled, not here yet$/);
  assert.deepEqual(x.sectors.map(s => s[0].split(' ')[0]), ['c-capped', 'c-honey', 'file', 'file', 'file']); assert.equal(x.hive, 'live');
  assert.deepEqual(x.rows.map(r => r[3]), ['live', 'live', 'file', 'file', 'file']);
  assert.match(x.receipt, /statuslivegenerated2026-09-26T10:00:00Zlive seats2file rows3 shown · 1 retired · of 4/);
  assert.equal(await p.evaluate(() => document.querySelector('#agents [data-name="z2.1"]').style.display), 'none', 'the page itself retired the same row');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('every "check again" is the page\'s own readHive(): bee\'s button, raver\'s hive, cypherpunk\'s GET', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  const n0 = outside.length;
  await p.click('#etBeeGo'); await p.waitForFunction(() => window.__orboard.status === 'failed', null, { timeout: 5000 });
  await p.evaluate(() => document.querySelector('#etArt [data-et-hive]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForFunction(() => window.__orboard.status === 'failed', null, { timeout: 5000 });
  await p.evaluate(() => document.getElementById('etCyGo').click());
  await p.waitForFunction(() => window.__orboard.status === 'failed', null, { timeout: 5000 }); await p.waitForTimeout(200);
  assert.deepEqual(outside.slice(n0), [FEED, FEED, FEED], 'three gestures, three reads of the one keyless door, nothing else');
  assert.match(await p.textContent('#hive'), /live board did not answer/, 'the page\'s own calm failure, unchanged');
  assert.equal(await p.textContent('#etBeeGo'), 'check the live board again');
  await p.click('#etBeeRows [data-et-open="s0"]');
  assert.match(await p.textContent('#etBeeRows .et-b-detail'), /^saved row, not live presence\. /);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
