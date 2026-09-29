// vending-eternal.test.mjs — the vending machine's three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own
// dress; all three carry the SAME facts (the name, its canonical form and fnv1a-64 key, the law rows
// and the price) read from the page's own live state; with the chain unreachable every front says
// "not read yet" and no mint gesture can act; with the chain answering (a local mock of jungle4), every
// mint gesture only opens the page's own plan screen, where nothing moves before approve; a taken
// name is refused in every register; and the laws hold on the front.
// Run: node --test e2e/vending-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8915, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

// a local stand-in for the public jungle4 API and the price feed (the sandbox has no outside network)
const TABLES = {
  rates: { rows: [{ rail: 'vaulta', basis: '2.0000 A', updated: '2026-09-01T00:00:00' }] },
  tithe: { rows: [{ percent_bp: 500, destination: 'bnrtithe' }] },
  config: { rows: [{ certs_count: 1, max_certs: 7776 }] },
  certs: { rows: [{ id: 0, agent_name: 'taken1', member_key: 'k'.repeat(64), ar_id: 'a'.repeat(43), content_hash: 'c'.repeat(64), minted: '2026-09-02T00:00:00' }] },
};
async function open(reg, { chain = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => {
    const u = r.request().url(), json = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (chain && u.includes('jungle4.greymass.com')) {
      if (u.endsWith('/get_table_rows')) return json(TABLES[JSON.parse(r.request().postData()).table] || { rows: [] });
      if (u.endsWith('/get_info')) return json({ head_block_num: 1000, last_irreversible_block_num: 990 });
      if (u.endsWith('/get_actions')) return json({ actions: [] });
    }
    if (chain && u.includes('api.coingecko.com')) return json({ vaulta: { usd: 0.5 } });
    return u.startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/vending.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.key, null, { timeout: 20000 });
  if (chain) await p.waitForFunction(() => window.__eternal.data.lawRead && window.__eternal.data.canMint && window.__eternal.data.priceKind === 'live', null, { timeout: 20000 });
  else await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const planOpen = p => p.$eval('#plan', e => e.classList.contains('open'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etHold', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyGo', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg, { chain: true });
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the name, its key, the law rows, the price', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { chain: true });
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => ((document.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ');
      return { data: { c: D.canonical, key: D.key, hex: D.keyHex, total: D.totalA, usd: D.totalUsd },
        real: { name: document.getElementById('vname').value, total: document.getElementById('v-total').textContent },
        bee: t('#etBeePrice'), beeName: document.getElementById('etBeeName').value,
        raver: t('#etRaverPrice'), rings: [...document.querySelectorAll('#etKey .ring')].map(g => g.getAttribute('aria-label')),
        path: t('#etCyPath'), law: t('#etLawKv'), kv: t('#etNameKv') };
    });
    await ctx.close();
  }
  const a = facts.bee.data;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a, reg + ': the one data layer');
  // the page's own law: 2 A mint + 0.16 A room + 5% tithe, at the live price
  assert.equal(a.total.toFixed(4), '2.2600'); assert.equal(a.usd.toFixed(2), '1.13');
  assert.equal(facts.bee.real.total, '$1.13', 'the real price line agrees');
  assert.equal(a.c, facts.bee.real.name); assert.equal(facts.bee.beeName, facts.bee.real.name);
  assert.match(facts.bee.bee, /^\$1\.13 once$/);
  assert.match(facts.raver.raver, /^\$1\.13 · 2\.2600 A$/);
  facts.raver.rings.forEach((l, i) => assert.ok(l.includes(a.hex.slice(i * 4, i * 4 + 4)), 'ring ' + (i + 1) + ' carries its 16 bits of the key'));
  assert.equal(facts.cypherpunk.path, 'bnrapolltest::certs/' + a.key);
  assert.match(facts.cypherpunk.law, /2\.0000 A/); assert.match(facts.cypherpunk.law, /5\.00% → bnrtithe/); assert.match(facts.cypherpunk.law, /2\.2600 A ≈ \$1\.13/);
  assert.ok(facts.cypherpunk.kv.includes(a.key) && facts.cypherpunk.kv.includes(a.hex));
});

test('honest: with the chain unread no front shows a price, and no gesture can act', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg);
    const d = await p.evaluate(() => ({ D: window.__eternal.data, bee: document.getElementById('etBeeGo').disabled, hold: document.getElementById('etHold').disabled, cy: document.getElementById('etCyGo').disabled,
      text: [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').innerText }));
    assert.equal(d.D.lawRead, false); assert.equal(d.D.totalA, null); assert.equal(d.D.canMint, false);
    assert.ok(d.bee && d.hold && d.cy, reg + ': every mint gesture is disabled');
    assert.match(d.text, /not read yet/, reg + ': says so plainly');
    assert.doesNotMatch(d.text, /free to mint|\$(?!0\.00 · Arweave)\d/, reg + ": claims neither a price nor a free name (the certificate's fixed \$0.00 is a stated fact)");
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('bee and cypherpunk: the action only opens the page’s own plan screen; refuse moves nothing', async () => {
  for (const [reg, sel] of [['bee', '#etBeeGo'], ['cypherpunk', '#etCyGo']]) {
    const { ctx, p } = await open(reg, { chain: true });
    await p.click(sel); await p.waitForTimeout(300);
    assert.equal(await planOpen(p), true, reg + ': the plan opens');
    assert.equal(await p.$eval('#doorstate', e => e.classList.contains('show')), false, reg + ': nothing armed before approve');
    assert.equal(await p.textContent('#p-name'), await p.evaluate(() => window.__eternal.data.canonical));
    await p.click('#prefuse');
    assert.equal(await planOpen(p), false);
    assert.match(await p.textContent('#afterplan'), /nothing moved/);
    await ctx.close();
  }
});

test('raver: typing re-forms the key; a short hold does nothing; the full hold opens the plan', async () => {
  const { ctx, p } = await open('raver', { chain: true });
  const k0 = await p.evaluate(() => window.__eternal.data.key);
  await p.fill('#etRaverName', 'Mīlestība  Ir Karalis');
  const d = await p.evaluate(() => ({ key: window.__eternal.data.key, c: window.__eternal.data.canonical, real: document.getElementById('vname').value }));
  assert.notEqual(d.key, k0); assert.equal(d.c, 'mīlestība ir karalis', 'the canonical form, per the page law'); assert.equal(d.real, 'Mīlestība  Ir Karalis', 'typed into the real field');
  await p.evaluate(() => document.querySelector('#etKey .ring[data-g="3"] .bit').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const hex = await p.evaluate(() => window.__eternal.data.keyHex);
  assert.ok((await p.textContent('#etRaverCard')).includes('bits 32–47 · ' + hex.slice(8, 12)), 'a tapped ring reads its own 16 bits');
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await planOpen(p), false, 'a short hold opens nothing');
  await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await planOpen(p), true, 'the full hold opens the real plan');
  assert.equal(await p.$eval('#doorstate', e => e.classList.contains('show')), false, 'nothing armed before approve');
  await ctx.close();
});

test('a taken name is refused in every register', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { chain: true });
    const input = { bee: '#etBeeName', raver: '#etRaverName', cypherpunk: '#etCyName' }[reg];
    await p.fill(input, 'Taken1');
    const d = await p.evaluate(() => ({ taken: window.__eternal.data.taken, can: window.__eternal.data.canMint, bee: document.getElementById('etBeeGo').disabled, hold: document.getElementById('etHold').disabled, cy: document.getElementById('etCyGo').disabled,
      text: [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').innerText }));
    assert.equal(d.taken, true); assert.equal(d.can, false); assert.ok(d.bee && d.hold && d.cy);
    assert.match(d.text, /already minted|taken · refused/, reg);
    await ctx.close();
  }
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const chain of [false, true]) for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { chain });
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        if (/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) && el.getBoundingClientRect().height < 44) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg + (chain ? ' · chain' : ' · offline'));
    await ctx.close();
  }
});
