// blight-vaulta-reader-eternal.test.mjs — the bLighT Vaulta Reader (the b-indexer's keyless read path)
// as three products in one surface (founder blueprint 2026-09-26, docs/design/eternal).
// Proves at 390 px: exactly one front per register, each in its own dress; all three carry the SAME
// facts (the read that read() published: request, state, rows, hosts; the ladder VAPI); a failed read
// is said as failed in every front (the chain is outside this box), and a routed fixture read (a
// labelled stand-in for the chain, never a live result) flips all three to the same rows at once;
// every gesture hands the request to the reader's own inputs and read button (no front fetches on its
// own, a short hold does nothing); and the laws (no dash for a value, no forced capitals, 44 px
// actions, nothing past 390 px).
// Run: node --test e2e/blight-vaulta-reader-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/vaulta-reader.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/vaulta-reader.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9234, ORIGIN = `http://127.0.0.1:${PORT}`;
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

// a labelled stand-in for the chain: 13 registry rows, one page (never presented as a live read)
const NAMES = ['remington', 'king', 'hive', 'ant', 'bee', 'comb', 'dew', 'elm', 'fern', 'gold', 'honey', 'iris', 'jade'];
const FIXTURE = { rows: NAMES.map((d, i) => ({ id: String(1000 + i), domain_name: d, owner: d + 'owner', expires: `2027-0${1 + i % 9}-01T00:00:00` })), more: false, next_key: '' };

async function open(reg, { fixture = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const asks = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (/get_table_rows/.test(u)) {
      asks.push({ host: new URL(u).host, body: JSON.parse(r.request().postData() || '{}') });
      if (fixture) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) });
    }
    return r.abort('blockedbyclient'); // the chain is outside this box
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && /^(ok|empty|failed)$/.test(window.__eternal.data.state), null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  return { ctx, p, errs, asks };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const WANT = {
  bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
  raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
  cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
};

test('each register: its own front and dress, the laws, and the failed read said as failed', async () => {
  const facts = {};
  for (const [reg, w] of Object.entries(WANT)) {
    const { ctx, p, errs, asks } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (cs.display === 'none' || !r.width) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) bad.push('value ' + own);
        if (/^(BUTTON|A|INPUT)$/.test(el.tagName) && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.right > 390.5) bad.push('past 390 ' + el.tagName + '.' + el.className);
      }
      const D = window.__eternal.data;
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth, bad,
        state: D.state, endpoints: D.endpoints, hosts: D.hosts.map(h => h.state), vapi: VAPI.slice(), req: D.req,
        bee: document.getElementById('etVaBState').textContent, raver: document.getElementById('etVaMid').textContent + ' ' + document.getElementById('etVaRCard').textContent,
        rims: document.querySelectorAll('#etVaSky path').length, stars: document.querySelectorAll('#etVaSky .et-star').length,
        cy: document.getElementById('etVaReceipt').textContent, cyHosts: [...document.querySelectorAll('#etVaHosts tr')].map(r => r.cells[2].textContent),
        pageStatus: document.getElementById('status').textContent };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ' laws');
    assert.equal(errs.length, 0, errs.join(' | '));
    assert.equal(asks.length, 2, reg + ': the arrival read is the page\'s own, one knock per door, nothing more');
    facts[reg] = d; await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) { assert.equal(facts[reg].state, a.state); assert.deepEqual(facts[reg].hosts, a.hosts); assert.deepEqual(facts[reg].req, a.req); }
  assert.equal(a.state, 'failed', 'the chain is unreachable here, so the read failed');
  assert.deepEqual(a.endpoints, a.vapi, 'the ladder is the page\'s own VAPI'); assert.equal(a.vapi.length, 2);
  assert.deepEqual(a.hosts, ['unreachable', 'unreachable']);
  assert.deepEqual(a.req, { code: 'kingbeelovis', scope: 'kingbeelovis', table: 'domains', limit: 10 });
  assert.match(a.pageStatus, /all Vaulta endpoints failed/);
  // said as failed, in each register's own words, never as zero rows
  assert.match(a.bee, /didn’t answer/); assert.doesNotMatch(a.bee, /\b0\b/);
  assert.match(facts.raver.raver, /^shut 0\/2no door answered/); assert.equal(facts.raver.stars, 0); assert.equal(facts.raver.rims, 2, 'one rim arc per door');
  assert.match(facts.cypherpunk.cy, /statefailed/); assert.match(facts.cypherpunk.cy, /rowsnot read/);
  assert.deepEqual(facts.cypherpunk.cyHosts, ['unreachable', 'unreachable']);
});

test('a read that arrives flips all three to the same rows (routed fixture, labelled a stand-in)', async () => {
  const got = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { fixture: true });
    got[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, L = D.rows.map(window.__eternal.label);
      return { state: D.state, labels: L, hosts: D.hosts.map(h => h.state), pageRows: document.querySelectorAll('#tbody tr').length - 1,
        bee: [...document.querySelectorAll('#etVaBNames .et-b-person b')].map(b => b.textContent), beeH: document.querySelector('#etVaBState h3').textContent,
        raver: [...document.querySelectorAll('#etVaSky .et-star')].map(g => g.getAttribute('aria-label')), mid: document.getElementById('etVaMid').textContent,
        cy: [...document.querySelectorAll('#etVaRows tr.et-pick')].map(r => r.cells[1].textContent), cyMore: document.getElementById('etVaRows').textContent };
    });
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  const want = NAMES.map(n => n + '.b');
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.equal(got[reg].state, 'ok'); assert.deepEqual(got[reg].labels, want); assert.equal(got[reg].pageRows, 13, 'the reader\'s own table holds the same 13'); }
  assert.deepEqual(got.bee.hosts, ['answered', 'not asked'], 'the first door answered; the second was never needed');
  assert.deepEqual(got.bee.bee.slice(0, 6), want.slice(0, 6)); assert.match(got.bee.bee[6], /7 more/); assert.equal(got.bee.beeH, '13 names read just now.');
  assert.deepEqual(got.raver.raver, want, 'one star per row'); assert.equal(got.raver.mid, '13');
  assert.deepEqual(got.cypherpunk.cy, want.slice(0, 12)); assert.match(got.cypherpunk.cyMore, /1 more rows in the reader below/);
});

test('honest gestures: every read is the reader\'s own; a short hold does nothing; the control runs offline', async () => {
  const { ctx, p, errs, asks } = await open('raver');
  const n0 = asks.length;
  await p.evaluate(() => document.getElementById('etVaRHold').scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  const bx = await p.locator('#etVaRHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(asks.length, n0, 'a short hold sends nothing');
  const t0 = await p.evaluate(() => window.__vaultaRead.at);
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(t => window.__vaultaRead.at > t && window.__eternal.data.state === 'failed', t0);
  assert.equal(asks.length, n0 + 2, 'the full hold is the reader\'s own read: both doors knocked, once each');
  // cypherpunk: the form writes the reader's own inputs and presses its own button
  await p.evaluate(() => { localStorage.setItem('bregister', 'cypherpunk'); document.body.setAttribute('data-reg', 'cypherpunk'); });
  await p.fill('#etVaTable', 'chainaddrs'); await p.fill('#etVaScope', 'fva5q53rzb53e');
  await p.click('#etVaCyGo');
  await p.waitForFunction(() => window.__eternal.data.req.table === 'chainaddrs' && window.__eternal.data.state === 'failed');
  assert.equal(await p.inputValue('#table'), 'chainaddrs'); assert.equal(await p.inputValue('#scope'), 'fva5q53rzb53e');
  assert.deepEqual(asks.at(-1).body, { json: true, code: 'kingbeelovis', scope: 'fva5q53rzb53e', table: 'chainaddrs', limit: 10 });
  assert.match(await p.textContent('#etVaPath'), /^vaulta:\/\/kingbeelovis\/fva5q53rzb53e\/chainaddrs$/);
  const n1 = asks.length;
  await p.click('#etVaCtl');
  assert.match(await p.textContent('#etVaCtlOut'), /u64ToName\(6830934878284532282\) = fva5q53rzb53e · matches the control ✓/);
  // bee: opening a question row is only words; the one action is the reader's own .b preset
  await p.evaluate(() => document.body.setAttribute('data-reg', 'bee'));
  await p.click('#etVaBAsk [data-ask="empty"]');
  assert.match(await p.textContent('#etVaBAsk'), /never guesses which/);
  assert.equal(asks.length, n1, 'no front fetches on its own');
  await p.click('#etVaBGo');
  await p.waitForFunction(() => window.__eternal.data.req.table === 'domains' && window.__eternal.data.state === 'failed');
  assert.equal(asks.length, n1 + 2); assert.equal(asks.at(-1).body.table, 'domains');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
