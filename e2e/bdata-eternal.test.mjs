// bdata-eternal.test.mjs — My Data's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress;
// all three carry the SAME facts (the invoice, the verified store receipt, the policy) read from
// the one data layer bdata.js draws the whole page from; "stored" and "watch it" appear ONLY when
// the store receipt verifies (a missing receipt turns every front honest, and the action hands off
// to the real audience chooser without writing any policy); the laws hold on the front.
// Run: node --test e2e/bdata-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8914, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const INV = JSON.parse(await readFile(join(ROOT, 'surfaces/bpay-invoice.json'), 'utf8'));
const REC = JSON.parse(await readFile(join(ROOT, 'surfaces/bdata-stored-bux-try-autonomi.json'), 'utf8'));
const ADDR = REC.data_map_address.replace(/^0x/, '').toLowerCase();

async function open(reg, { noReceipt = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (noReceipt && u.includes('bdata-stored-bux-try-autonomi.json')) return r.fulfill({ status: 404, body: '' });
    return u.startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient');
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/bdata.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.storedState !== 'loading', null, { timeout: 20000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '#etBeeGo', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '#etRaverGo', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etCyVerify', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(([f, a]) => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(document.querySelector(a)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, [w.front, w.act]);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the object, the receipt, the pieces, the address', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => ((document.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ');
      return {
        data: { name: D.name, bytes: D.bytes, sha: D.sha256, addr: D.address, stored: D.stored, chunks: D.chunks, quotes: D.quotes.length, paid: D.paidAtto, aud: D.audience },
        beeFile: t('#etBeeRows .et-b-file'), beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        beeGo: document.querySelector('#etBeeGo').getAttribute('href'),
        petals: document.querySelectorAll('#etBloom .pt').length, raverGo: document.querySelector('#etRaverGo').getAttribute('href'), raverTitle: t('#etRaverTitle'),
        path: t('#etCyPath'), object: t('#etObject'), pipe: t('#etPipe'), cyWatch: document.querySelector('#etCyWatch').getAttribute('href'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].data, a.data, reg + ': the one data layer');
  // the data layer is the invoice and the receipt, not a copy
  assert.equal(a.data.name, INV.domain.artifact.name); assert.equal(a.data.bytes, INV.domain.artifact.bytes); assert.equal(a.data.sha, INV.domain.artifact.sha256);
  assert.equal(a.data.addr, ADDR); assert.equal(a.data.stored, true); assert.equal(a.data.quotes, INV.lines[0].quotes.length);
  assert.equal(a.data.paid, /(\d+) atto/.exec(REC.evidence.find(e => e.state === 'purchased').what)[1]);
  // bee: the file, its size and the plain rows
  assert.match(a.beeFile, new RegExp(Math.round(INV.domain.artifact.bytes / 1e6) + ' MB'));
  assert.match(a.beeRows[0], /anyone with the address/); assert.match(a.beeRows[1], /on Autonomi/); assert.match(a.beeRows[2], /paid once/);
  // raver: one petal per quoted piece
  assert.equal(facts.raver.petals, INV.lines[0].quotes.length); assert.match(facts.raver.raverTitle, /^56 pieces$/);
  // cypherpunk: the whole address and the whole sha, never cut
  assert.equal(facts.cypherpunk.path, 'autonomi://' + ADDR);
  assert.ok(facts.cypherpunk.object.includes(INV.domain.artifact.sha256) && facts.cypherpunk.object.includes(ADDR));
  assert.match(facts.cypherpunk.pipe, /56 of 56 chunks stored/);
  // the one real action is the same everywhere: the stored video at its address
  for (const href of [a.beeGo, facts.raver.raverGo, facts.cypherpunk.cyWatch]) assert.equal(href, 'bview.html#' + ADDR);
});

test('honest: without a verified receipt no front says stored, and the action hands off, never writes', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { noReceipt: true });
    const d = await p.evaluate(() => ({
      stored: window.__eternal.data.stored, addr: window.__eternal.data.address,
      text: [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none').innerText,
      watch: [...document.querySelectorAll('#eternal a')].filter(a => /bview/.test(a.getAttribute('href') || '')).length,
    }));
    assert.equal(d.stored, false, reg); assert.equal(d.addr, null, reg);
    assert.equal(d.watch, 0, reg + ': no watch link without the receipt');
    assert.doesNotMatch(d.text, /on Autonomi|paid once|stored ✓|watch it/i, reg + ': nothing claims stored');
    if (reg !== 'cypherpunk') {
      const go = reg === 'bee' ? '#etBeeGo' : '#etRaverGo';
      await p.click(go); await p.waitForTimeout(700);
      const after = await p.evaluate(() => ({ focus: document.activeElement && document.activeElement.getAttribute('data-act'), policy: localStorage.getItem('bpay-policy-v1') }));
      assert.equal(after.focus, 'public', reg + ': the real chooser takes the hand-off');
      assert.equal(after.policy, null, reg + ': a hand-off never writes the policy');
    }
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('bee: a row opens to its plain answer; the full paid figure, never rounded', async () => {
  const { ctx, p } = await open('bee');
  await p.click('.et-b-row[data-ek="b-cost"]');
  const fig = (await p.textContent('.et-b-open[data-open="cost"] .et-b-fig')).replace(/\s+/g, '');
  assert.equal(fig, '4.2125503974609375ANT');
  assert.equal(await p.$eval('.et-b-row[data-ek="b-cost"]', e => e.getAttribute('aria-expanded')), 'true');
  await ctx.close();
});

test('raver: a tap lights a petal and the card reads that piece', async () => {
  const { ctx, p } = await open('raver');
  await p.click('#etBloom .pt[data-i="7"]', { force: true });
  const q = INV.lines[0].quotes[7];
  const card = await p.textContent('#etRaverCard');
  assert.match(card, /piece 8 of 56/); assert.ok(card.includes((Number(BigInt(q.amount_atto) / 1000000000000n) / 1e6).toFixed(4)));
  assert.ok(card.includes(q.quote_hash.slice(0, 10)));
  await p.click('.et-r-step button[data-step="1"]');
  assert.match(await p.textContent('#etRaverCard'), /piece 9 of 56/);
  assert.match(await p.textContent('#etRaverNote'), /^2 of 56 lit/);
  await ctx.close();
});

test('cypherpunk: complete at first paint, and the check runs here', async () => {
  const { ctx, p } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, done: document.querySelectorAll('#etPipe li.done').length, rows: document.querySelectorAll('#etVerify li').length, fails: document.querySelectorAll('#etVerify li.no').length, fork: document.querySelector('.et-c a[target="_blank"]').getAttribute('rel') }));
  assert.equal(d.steps, 7); assert.equal(d.done, 6, 'every step the receipt proves, and only those'); assert.equal(d.rows, 7); assert.equal(d.fails, 0);
  assert.equal(d.fork, 'noopener noreferrer');
  await p.click('#etCyVerify');
  const v = await p.evaluate(() => window.__eternal.ui.verified);
  assert.equal(v.pass, true); assert.ok(v.rows.some(r => /sum\(56 quotes\)/.test(r.k) && r.pass));
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined|null)\b/.test(own)) out.push('value ' + own);
        if (/^(BUTTON|A)$/.test(el.tagName) && el.getBoundingClientRect().height < 44) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
