// bantfarm-eternal.test.mjs — the bANTfarm (the node farm and the two treasuries, read keylessly) as three
// products in one surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly
// one front per register, each in its own dress; three different products (bee: the treasuries as plain
// rows; raver: one ring of ten live cells, the ant side and the dao side; cypherpunk: every lane with its
// method, hosts and the time this tab saw it, the read path, the constants from the page's own script);
// the SAME facts in all three in both worlds — the chains silent (blocked here: every register says the
// read failed and none shows a zero) and the chains answering (stubbed Arbitrum and Vaulta RPC fixtures,
// named below: every register flips to the same numbers the page's own reads print); the one gesture is
// the page's own read-only vault button (only read methods leave, never a signing call, never the
// Trezor bridge); and the laws (no dash for a value, no forced capitals, 44 px actions, nothing past 390 px).
// Run: node --test e2e/bantfarm-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/bantfarm.html`> node --test e2e/bantfarm-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/bantfarm.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9243, ORIGIN = `http://127.0.0.1:${PORT}`;
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

const PAGE_SRC = await readFile(join(ROOT, PAGE), 'utf8');
const ANT = /var ANT='(0x[0-9a-fA-F]{40})'/.exec(PAGE_SRC)[1], VAULT = /var VAULT='(0x[0-9a-fA-F]{40})'/.exec(PAGE_SRC)[1];
// FIXTURES (the chains are outside this box). Arbitrum One: 18 decimals, supply 1,200,000,000 ANT, the
// vault holds 25.5 ANT and 0.01234 ETH, gas 0.01 gwei, 2,000,000 gas in block 500. Vaulta: the fund's
// account 2.5 MB of 5 MB RAM and 12.3456 A, finality lag 2, three .b names, rammarket 1e11 RAM : 1e6 A.
const W = v => BigInt(v).toString(16).padStart(64, '0');
function evm(m, params) {
  if (m === 'eth_call') { const d = params[0].data; if (d === '0x313ce567') return '0x' + W(18); if (d === '0x18160ddd') return '0x' + W(1200000000n * 10n ** 18n); if (d.startsWith('0x70a08231')) return '0x' + W(255n * 10n ** 17n); }
  if (m === 'eth_getBalance') return '0x' + (12340000000000000n).toString(16);
  if (m === 'eth_gasPrice') return '0x989680';
  if (m === 'eth_getBlockByNumber') return { number: '0x1f4', gasUsed: '0x1e8480', gasLimit: '0x4000000000000' };
  return null;
}
function vaulta(path, body) {
  if (path.endsWith('/get_account')) return { account_name: body.account_name, ram_quota: 5242880, ram_usage: 2621440, cpu_limit: { used: 120, max: 4000 }, net_limit: { used: 300, max: 9000 } };
  if (path.endsWith('/get_currency_balance')) return body.code === 'core.vaulta' ? ['12.3456 A'] : [];
  if (path.endsWith('/get_info')) return { head_block_num: 1000, last_irreversible_block_num: 998 };
  if (path.endsWith('/get_table_rows')) return body.table === 'domains' ? { rows: [{}, {}, {}], more: false } : { rows: [{ base: { balance: '100000000000 RAM' }, quote: { balance: '1000000.0000 A' } }] };
  return null;
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };

async function open(reg, { chains = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const sent = [];
  await ctx.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (q.method() !== 'OPTIONS') sent.push({ u, body: q.postData() || '' });
    if (chains && q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (chains && u === 'https://arb1.arbitrum.io/rpc') { const j = JSON.parse(q.postData()); return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ jsonrpc: '2.0', id: j.id, result: evm(j.method, j.params) }) }); }
    if (chains && u.startsWith('https://eos.greymass.com/')) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(vaulta(new URL(u).pathname, JSON.parse(q.postData() || '{}'))) });
    return r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.lanes.supply, null, { timeout: 15000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  // settle: every lane that the first tick reads has answered or failed
  await p.waitForFunction(() => { const L = window.__eternal.data.lanes; return ['supply', 'dec', 'gas', 'block', 'lag', 'names', 'cost', 'bal', 'ram'].every(k => L[k] && /ok|fail|absent/.test(L[k].s)); }, null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs, sent };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const front = p => p.evaluate(() => [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').textContent.replace(/\s+/g, ' '));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /^(undefined|NaN|null)$|\bNaN\b|\[object/.test(own)) out.push('junk ' + el.tagName + ' ' + own.slice(0, 30));
    const r = el.getBoundingClientRect();
    if (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') { if (r.height < 43.5 || r.width < 43.5) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 24)); }
    if (r.width && r.right > 390.5) out.push('offside ' + el.tagName + ' ' + (el.className.baseVal ?? el.className) + ' ' + Math.round(r.right));
  }
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
  return out;
});
const READS = new Set(['eth_call', 'eth_getBalance', 'eth_gasPrice', 'eth_getBlockByNumber']);
const VREADS = /\/v1\/chain\/(get_account|get_currency_balance|get_info|get_table_rows)$/;
function onlyReads(sent) {
  for (const { u, body } of sent) {
    assert.doesNotMatch(u, /trezor/i, 'the Trezor bridge is never loaded from a front');
    if (/arbitrum/.test(u)) assert.ok(READS.has(JSON.parse(body).method), 'read method only: ' + body.slice(0, 80));
    else assert.match(new URL(u).pathname, VREADS, 'Vaulta read path only: ' + u);
  }
}

test('one front per register, each in its own dress, and the laws hold on each', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBfGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etBfPill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etBfCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, sent } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, act]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(act)).backgroundColor, shape: [fr.querySelectorAll('.et-b-row').length, fr.querySelectorAll('svg [role="button"]').length, fr.querySelectorAll('table').length] };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    // three different products: rows / a ring of cells / tables
    if (reg === 'bee') assert.deepEqual(d.shape, [5, 0, 0]);
    if (reg === 'raver') assert.deepEqual(d.shape, [0, 11, 0]);
    if (reg === 'cypherpunk') assert.ok(d.shape[0] === 0 && d.shape[1] === 0 && d.shape[2] >= 3);
    assert.deepEqual(await laws(p), [], reg + ' laws');
    onlyReads(sent);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the chains silent: every register says the read failed, none shows a zero', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = { D: await p.evaluate(() => JSON.parse(JSON.stringify(window.__eternal.data.lanes))), text: await front(p),
      cells: await p.$$eval('#etBfRing .et-cell', c => c.map(x => x.getAttribute('class'))) };
    await ctx.close();
  }
  const L = seen.bee.D;
  for (const k of ['supply', 'dec', 'gas', 'block', 'lag', 'names', 'cost', 'bal', 'ram']) assert.equal(L[k].s, 'fail', k + ' failed here');
  assert.equal(L.rate.s, 'wait', 'block rate needs two samples: still waiting, not zero');
  assert.equal((seen.bee.text.match(/not reachable from here/g) || []).length, 4, 'bee: four rows say so');
  assert.equal(seen.raver.cells.filter(c => /et-fail/.test(c)).length, 9); assert.equal(seen.raver.cells.filter(c => /et-ok/.test(c)).length, 0);
  assert.match(seen.raver.text, /0 of 10 answered/); assert.match(seen.raver.text, /never a zero/);
  assert.equal((seen.cypherpunk.text.match(/failed · declared, not zeroed/g) || []).length, 9);
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.doesNotMatch(seen[reg].text, /\b0(\.0+)? (ANT|A|ETH|gwei)\b/, reg + ': no zero stands in for a failure');
});

test('the chains answering (fixtures): all three show the same numbers the page\'s own reads print', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs, sent } = await open(reg, { chains: true });
    await p.waitForFunction(() => ['supply', 'names', 'cost', 'bal', 'gas'].every(k => window.__eternal.data.lanes[k].s === 'ok'), null, { timeout: 15000 });
    if (reg === 'bee') await p.click('.et-b-row[data-row="2"]');
    seen[reg] = { D: await p.evaluate(() => JSON.parse(JSON.stringify(window.__eternal.data.lanes))), text: await front(p),
      page: await p.evaluate(() => ['antsupply', 'vbal', 'dnamesv', 'dncost', 'dgasv'].map(i => document.getElementById(i).textContent.trim())),
      labels: await p.$$eval('#etBfRing .et-cell', c => c.map(x => x.getAttribute('aria-label')).join(' | ')) };
    onlyReads(sent); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  const L = seen.bee.D, v = k => L[k].v;
  assert.deepEqual(seen.bee.page, ['1,200,000,000 ANT', '12.3456 A', '3', '0.0254', '0.0100 gwei'], 'the page\'s own reads');
  assert.equal(v('supply'), '1,200,000,000 ANT'); assert.equal(v('bal'), '12.3456 A'); assert.equal(v('names'), '3'); assert.equal(v('cost'), '0.0254 A'); assert.equal(v('ram'), '2.50 MB / 5.00 MB');
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['supply', 'bal', 'names', 'cost', 'gas', 'lag']) assert.equal(seen[reg].D[k].v, L[k].v, reg + ' ' + k);
  for (const x of ['1,200,000,000 ANT', '12.3456 A', '0.0254 A', '2.50 MB / 5.00 MB']) assert.ok(seen.bee.text.includes(x), 'bee shows ' + x);
  for (const x of ['1,200,000,000 ANT', '12.3456 A', '0.0254 A', '0.0100 gwei', '2 blocks']) assert.ok(seen.raver.labels.includes(x), 'raver cell carries ' + x);
  assert.match(seen.raver.text, /9 of 10 answered/);
  for (const x of ['1,200,000,000 ANT', '12.3456 A', '0.0254 A', '0.0100 gwei', '2 blocks', '2.0 Mgas']) assert.ok(seen.cypherpunk.text.includes(x), 'cypherpunk shows ' + x);
});

test('the one gesture is the page\'s own read-only vault read, in every register', async () => {
  for (const [reg, btn] of [['bee', '#etBfGo'], ['raver', '#etBfPill'], ['cypherpunk', '#etBfCyGo']]) {
    const { ctx, p, errs, sent } = await open(reg, { chains: true });
    await p.evaluate(() => { window.__vaultPress = 0; document.getElementById('evmvault').addEventListener('click', () => window.__vaultPress++); });
    await p.click(btn);
    assert.equal(await p.evaluate(() => window.__vaultPress), 1, reg + ': the page\'s own button, pressed once');
    assert.equal(await p.inputValue('#evmaddr'), VAULT, 'the vault address is the page\'s own constant');
    await p.waitForFunction(() => window.__eternal.data.vault.ant && window.__eternal.data.vault.ant.s === 'ok', null, { timeout: 10000 });
    const t = await front(p);
    assert.ok(t.includes('25.5000 ANT') && t.includes('0.01234 ETH'), reg + ' shows the vault as read: ' + t.slice(0, 200));
    assert.doesNotMatch(t, /\b(sent|signed|verified|done)\b|\bpaid(?! in ANT)/i, reg + ' claims nothing it did not do');
    assert.equal(await p.textContent('#tzstate'), 'not connected', 'the signing wing is untouched');
    onlyReads(sent); assert.ok(sent.some(s => /0x70a08231/.test(s.body)), 'balanceOf left'); assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
  // and with the chains silent the gesture says the read failed; no zero stands in
  const { ctx, p } = await open('bee');
  await p.click('#etBfGo');
  await p.waitForFunction(() => window.__eternal.data.vault.ant && window.__eternal.data.vault.ant.s === 'fail', null, { timeout: 10000 });
  assert.match(await p.textContent('#etBfAsked'), /didn't answer from here\. nothing changed, and no zero is shown/);
  await ctx.close();
});

test('raver cells and cypherpunk lanes open to their method; constants come from the page\'s own script', async () => {
  let { ctx, p, errs } = await open('raver', { chains: true });
  await p.waitForFunction(() => window.__eternal.data.lanes.names.s === 'ok', null, { timeout: 15000 });
  await p.$eval('#etBfRing', e => e.scrollIntoView({ block: 'center' })); // clear of the fixed tour bar
  await p.locator('#etBfRing [data-lane="names"]').click({ force: true });
  assert.equal(await p.getAttribute('#etBfRing [data-lane="names"]', 'aria-pressed'), 'true', 'the tap landed');
  assert.match(await p.textContent('#etBfCard'), /\.b names on the registry · 3.*get_table_rows/);
  await p.click('#etBfStill');
  assert.equal(await p.evaluate(() => document.querySelector('#eternal .et-r').classList.contains('et-still-on')), true, 'the light pauses');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  ({ ctx, p, errs } = await open('cypherpunk'));
  await p.click('.et-c-tab tr.et-pick[data-lane="bal"]');
  const more = await p.textContent('.et-c-tab tr.et-more');
  assert.match(more, /get_currency_balance/); assert.match(more, /eos\.greymass\.com → https:\/\/eos\.api\.eosnation\.io/);
  const k = await p.textContent('#etBfConst');
  assert.ok(k.includes(ANT) && k.includes(VAULT) && k.includes('2,537 B'), 'constants read from the page script');
  assert.match(k, /display lane only · re-derive/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
