// bnames-eternal.test.mjs — the .b name desk as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; the SAME facts in all three (the desk's own live chain reads, here served by a fixture chain,
// and the custody gate's constants); and honest gestures — every check is the desk's real search, a
// silent chain is said plainly (never "free", never a dash), and nothing on the front signs or writes.
// Run: node --test e2e/bnames-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.ETERNAL_PAGE || 'surfaces/bnames.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8986, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const u = decodeURIComponent(q.url.split('?')[0]); const f = join(ROOT, u === '/surfaces/bnames.html' ? PAGE : u); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

/* a fixture chain: the desk's two confirmed hosts answer get_table_rows as Vaulta would */
const ROWS = [{ domain_name: 'king', owner: 'kingbeelovis', account: 'kingbeelovis', expires: '2027-08-01T00:00:00' },
  { domain_name: 'lovis', owner: 'kingbeelovis', account: 'kingbeelovis', expires: '2027-08-01T00:00:00' },
  { domain_name: 'hive', owner: 'someoneelse1', account: 'someoneelse1', expires: '2027-08-01T00:00:00' }];
function chain(route) {
  const b = JSON.parse(route.request().postData() || '{}');
  const body = b.table === 'domains' ? { rows: ROWS, more: false } : b.table === 'config' ? { rows: [{ registration_fee: '0.0000 A', registration_days: 365 }] }
    : b.table === 'rammarket' ? { rows: [{ base: { balance: '100000000 RAM' }, quote: { balance: '33.2000 A' } }] } : { rows: [] };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function open(reg, live = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : (live && /v1\/chain\/get_table_rows/.test(r.request().url()) ? chain(r) : r.abort('blockedbyclient')));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/bnames.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.reach !== 'asking', null, { timeout: 20000 });
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


test('the same facts in all three: the registry, the config, the gate', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, all = s => [...document.querySelectorAll(s)];
      return {
        model: JSON.stringify({ reach: D.reach, rows: D.rows, fee: D.fee, days: D.days, ram: D.ram, jewels: D.jewels, gate: D.gate, hosts: D.hosts }),
        D: { rows: D.rows, fee: D.fee, days: D.days, jewels: D.jewels, gate: { q: D.gate.quorum, v: D.gate.verifiers, h: D.gate.hardened }, hosts: D.hosts },
        deskCount: document.getElementById('count').textContent,
        beeRows: all('#etBeeRows .et-b-row').map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        jewels: all('#etCrown .jewel').map(g => g.getAttribute('aria-label')),
        reads: all('#etReads tr').map(r => [...r.cells].map(c => c.textContent.trim()).join(' ')),
        pipe: document.getElementById('etPipe').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee, D = a.D;
  for (const reg of ['raver', 'cypherpunk']) assert.equal(facts[reg].model, a.model, reg + ' reads the same desk');
  assert.equal(D.rows, ROWS.length); assert.equal(a.deskCount, String(ROWS.length), 'the desk\'s own readout agrees');
  assert.equal(D.fee, '0.0000 A'); assert.equal(D.days, 365);
  assert.deepEqual(D.jewels, { king: { state: 'held', owner: 'kingbeelovis', expires: '2027-08-01' }, k: { state: 'free' }, q: { state: 'free' } });
  assert.deepEqual(D.gate, { q: 2, v: 0, h: false }, 'the gate\'s own constants: two verifiers needed, none yet');
  assert.deepEqual(D.hosts, ['https://eos.api.eosnation.io', 'https://eos.greymass.com']);
  assert.ok(a.beeRows.some(r => new RegExp(`^names on the chain today ?${ROWS.length}$`).test(r)));
  assert.ok(a.beeRows.some(r => /a name is yours for ?365 days/.test(r)));
  assert.equal(facts.raver.jewels.length, ROWS.length + 2, 'every name on the chain is a cell, plus the two open jewels');
  assert.ok(facts.raver.jewels.includes('king.b, held') && facts.raver.jewels.includes('k.b, free'));
  assert.ok(facts.cypherpunk.reads.includes('domains rows ' + ROWS.length));
  assert.ok(facts.cypherpunk.reads.includes('config registration_days 365'));
  assert.match(facts.cypherpunk.pipe, /needs 2 independent verifiers · has 0/);
});

test('bee: the check is the desk\'s real search; taken and free are the chain\'s words', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.fill('#etBeeName', 'Hive.b'); await p.click('#etBeeCheck'); await p.waitForTimeout(300);
  assert.equal(await p.inputValue('#q'), 'hive', 'the name is handed to the desk\'s own search');
  assert.match(await p.textContent('#vwrap'), /hive\.b is TAKEN/);
  assert.match(await p.textContent('#etBeeAnswer'), /hive\.b is taken.*held by someoneelse1 until 2027-08-01/);
  await p.fill('#etBeeName', 'mira'); await p.click('#etBeeCheck'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#etBeeAnswer'), /mira\.b is free today.*founder-only for now/);
  assert.equal(await p.$eval('#sign-btn', b => b.disabled), true, 'a free name is still not signed by a tap');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('a silent chain is said plainly in every register, never "free"', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, false);
    assert.equal(await p.evaluate(() => window.__eternal.data.reach), 'failed');
    await p.evaluate(() => window.__eternal.check('mira'));
    const t = await p.evaluate(() => document.getElementById('eternal').innerText);
    assert.doesNotMatch(t, /is free today|\bAVAILABLE\b/, reg);
    assert.match(t, /did not answer|unreachable|silent/, reg);
    assert.doesNotMatch(await p.textContent('#vwrap'), /AVAILABLE/, 'the desk itself no longer says available on no data');
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('raver: tap a jewel to light it; the pill asks the chain through the desk', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('#etCrown .jewel[data-n="lovis"] .hit', { force: true });
  assert.equal(await p.getAttribute('#etCrown .jewel[data-n="lovis"]', 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etRaverCard'), /lovis\.b is taken/);
  await p.click('#etCrown .jewel[data-n="q"] .hit', { force: true });
  assert.match(await p.textContent('#etRaverCheck'), /ask the chain for q\.b/);
  await p.click('#etRaverCheck'); await p.waitForTimeout(300);
  assert.equal(await p.inputValue('#q'), 'q'); assert.match(await p.textContent('#etRaverCard'), /q\.b is free today/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; the check moves the pipeline', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etPipe li').length), 6);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#etReceipt tr').length), 7);
  assert.match(await p.textContent('#etPipe li.now'), /check/);
  await p.fill('#etCyName', 'king'); await p.click('#etCyCheck'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#etPipe'), /check · king\.b.*taken · owner kingbeelovis/);
  assert.match(await p.textContent('#etPipe li.now'), /consent/);
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('.et-c a[target]')].every(a => a.rel === 'noopener noreferrer')), true);
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
