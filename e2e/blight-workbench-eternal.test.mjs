// blight-workbench-eternal.test.mjs — the bLighT Workbench (the tech bench) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per
// register, each in its own dress; all three carry the SAME facts (the bench's own CHAINS, TOKENS and
// SHAPES, and the bench's read exactly as it writes #diag and #art); nothing is read on arrival; every
// gesture writes the bench's own field and selects and presses its own View or Scan (a short hold does
// nothing); a routed JSON-RPC stand-in (labelled, never a live result) drawing one piece, and one
// refusing, flips all three fronts at once; and the laws (no dash for a value, no forced capitals,
// 44 px actions, nothing past 390 px).
// Run: node --test e2e/blight-workbench-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/workbench.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/workbench.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9235, ORIGIN = `http://127.0.0.1:${PORT}`;
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

const HOLDER = '0x1111111111111111111111111111111111111111';
const W = v => BigInt(v).toString(16).padStart(64, '0');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#86cc72"/></svg>';
const HEX = Buffer.from(SVG).toString('hex');
const STR = '0x' + W(32) + W(SVG.length) + HEX.padEnd(Math.ceil(HEX.length / 64) * 64, '0');
// a labelled stand-in for a public RPC: decimals 9, 3 whole tokens, a live triple, one shape that draws
const ANSWER = d => d.startsWith('0x313ce567') ? '0x' + W(9) : d.startsWith('0x70a08231') ? '0x' + W(3000000000n)
  : d.startsWith('0xa775188a') ? '0x' + W(3) + W(5) + W(7) : d.startsWith('0xa435130b') ? STR : d.startsWith('0x9c216508') ? '0x' + W(0) : '0x';

async function open(reg, rpc = 'blocked') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const calls = [];
  // a gate the test can close: while closed, a stubbed chain answer waits, so a transient state
  // ("reading") is observed on purpose, never by the luck of a slow runner (CI 2026-09-26: the
  // instant refusal landed between two reads of the page on one run)
  const gate = { on: false, wait: null, open: null };
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN)) return r.continue();
    if (r.request().method() === 'POST') {
      let body = null; try { body = JSON.parse(r.request().postData()); } catch {}
      calls.push({ u, body });
      if (body && rpc !== 'blocked' && !/%20|,/.test(u)) {
        if (gate.on) await gate.wait;
        const one = q => rpc === 'draws' ? { jsonrpc: '2.0', id: q.id, result: ANSWER(q.params[0].data) } : { jsonrpc: '2.0', id: q.id, error: { code: 3, message: 'execution reverted' } };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)) });
      }
    }
    return r.abort('blockedbyclient'); // the chain is outside this box
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.tokens.length && document.body.dataset.reg, null, { timeout: 15000 });
  return { ctx, p, errs, calls, gate };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const WANT = {
  bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
  raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
  cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
};
// every front's facts, read from each front's own DOM (all three are rendered; one is shown)
const FACTS = () => {
  const D = window.__eternal.data, t = id => document.getElementById(id).textContent;
  return {
    phase: D.phase, tokens: D.tokens.map(x => x.sym + '@' + x.chain + ':' + x.addr), shape: D.shape,
    page: { tokens: TOKENS.map(x => x.sym + '@' + CHAINS[x.chain || 0].name + ':' + x.addr), status: [...document.querySelectorAll('#diag tr')].map(r => r.textContent).find(x => x.startsWith('status')) || '', art: !!document.querySelector('#art svg') },
    bee: t('etWbBState'), raver: [...document.querySelectorAll('#etWbSky .et-gdn')].map(g => g.getAttribute('aria-label')), mid: t('etWbMid') + ' ' + t('etWbMidS'), rcard: t('etWbRCard'),
    cyCols: [...document.querySelectorAll('#etWbCols tr')].map(r => r.cells[1].firstChild.textContent + '@' + r.cells[1].querySelector('small').textContent),
    cyShapes: [...document.querySelectorAll('#etWbShapes tr')].map(r => r.textContent), cyRcpt: t('etWbReceipt'), cyPath: t('etWbPath'), cyPipe: t('etWbPipe'),
  };
};

test('each register: its own front and dress, the laws, the bench\'s constants, nothing read on arrival', async () => {
  for (const [reg, w] of Object.entries(WANT)) {
    const { ctx, p, errs, calls } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f), bad = [];
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (cs.display === 'none' || !r.width) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(NaN|undefined)\b/.test(own)) bad.push('value ' + own);
        if (/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) && (r.height < 44 || r.width < 44)) bad.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.right > 390.5) bad.push('past 390 ' + el.tagName + '.' + el.className);
      }
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth, bad };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ' laws');
    const f = await p.evaluate(FACTS);
    assert.equal(f.phase, 'idle'); assert.deepEqual(f.tokens, f.page.tokens, 'the collections are the bench\'s own TOKENS');
    assert.equal(f.tokens.length, 7); assert.equal(f.raver.length, 7, 'raver: one garden per collection');
    assert.deepEqual(f.cyCols, f.page.tokens.map(x => x.split(':')[0].split('@')[0] + '@' + x.split(':')[1]), 'cypherpunk: the same seven, keyed on address');
    assert.equal(f.cyShapes.length, 4); assert.match(f.bee, /nothing looked at yet/); assert.match(f.mid, /^7 gardens/);
    assert.equal(calls.length, 0, reg + ': nothing is read on arrival');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('raver: a short hold does nothing; the full hold is the bench\'s own View, and a drawn piece flips all three', async () => {
  const { ctx, p, errs, calls } = await open('raver', 'draws');
  await p.evaluate(() => document.getElementById('etWbRHold').scrollIntoView({ block: 'center' }));
  const bx = await p.locator('#etWbRHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up(); await p.waitForTimeout(100);
  assert.match(await p.textContent('#etWbRSay'), /paste a wallet above first · nothing was sent/); assert.equal(calls.length, 0);
  await p.fill('#etWbRAddr', HOLDER);
  assert.equal(await p.inputValue('#etWbCAddr'), HOLDER, 'the three fields are one field');
  await p.evaluate(() => document.getElementById('etWbRHold').scrollIntoView({ block: 'center' }));
  await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal(calls.length, 0, 'a short hold sends nothing');
  await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForFunction(() => window.__eternal.data.phase === 'rendered', null, { timeout: 12000 });
  assert.equal(await p.inputValue('#addr'), HOLDER, 'the bench\'s own field carries the wallet');
  const f = await p.evaluate(FACTS);
  assert.ok(f.page.art && /rendered from chain/.test(f.page.status), 'the bench itself drew it');
  assert.equal(f.shape, 'triple/a435130b');
  assert.match(f.bee, /found it\.drawn just now from PEPI \(base; v2\), by the chain itself\./);
  assert.match(f.mid, /^drawn by the chain/); assert.match(f.rcard, /the key that fit · triple\/a435130b/);
  assert.match(f.cyRcpt, /statusrendered from chain/); assert.match(f.cyRcpt, /ABI shapetriple\/a435130b/); assert.match(f.cyShapes[0], /matched this read/);
  assert.match(f.cyPath, /^eth_call:\/\/base\/0x28a5e71BFc02723eAC17E39c84c5190415C0de9F$/);
  assert.ok(calls.every(c => c.body && [].concat(c.body).every(q => q.method === 'eth_call')), 'every call is a read');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk and bee: a refused read is said in all three; the bee action is the bench\'s own Scan', async () => {
  const { ctx, p, errs, calls, gate } = await open('cypherpunk', 'refuses');
  await p.fill('#etWbCAddr', HOLDER);
  await p.selectOption('#etWbCCol', '2');
  assert.equal(await p.inputValue('#token'), await p.evaluate(() => TOKENS[2].addr), 'the bench\'s own select follows');
  await p.click('#etWbCyGo');
  await p.waitForFunction(() => window.__eternal.data.phase === 'failed', null, { timeout: 12000 });
  const f = await p.evaluate(FACTS);
  assert.match(f.page.status, /execution reverted/); assert.equal(f.page.art, false);
  assert.match(f.bee, /the chain didn’t answer\.nothing was drawn, and nothing old is shown/);
  assert.match(f.mid, /^quiet nothing drawn/); assert.match(f.cyRcpt, /execution reverted/); assert.match(f.cyPipe, /execution reverted/);
  assert.match(f.cyPath, /0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F$/, 'FUNGI, the collection chosen');
  // bee: an empty field asks for a wallet and sends nothing; a pasted one presses the bench's own Scan
  await p.evaluate(() => document.body.setAttribute('data-reg', 'bee'));
  const n = calls.length;
  await p.fill('#etWbBAddr', '');
  await p.click('#etWbBGo');
  assert.match(await p.textContent('#etWbBState'), /paste a wallet first/); assert.equal(calls.length, n);
  gate.wait = new Promise(res => { gate.open = res; }); gate.on = true; // hold the chain's answer
  await p.fill('#etWbBAddr', HOLDER); await p.click('#etWbBGo');
  // the bench says "scanning" first; the front's data layer re-reads that a moment later. With the answer
  // held, "reading" lasts, so wait for the front itself rather than racing it
  await p.waitForFunction(() => [...document.querySelectorAll('#diag td')].some(td => td.textContent === 'scanning') && window.__eternal.data.phase === 'reading', null, { timeout: 5000 });
  assert.match(await p.textContent('#etWbBState'), /looking…/);
  gate.on = false; gate.open(); // let the answers land: the Scan settles, and the bee says what the bench's own sweep found
  await p.waitForFunction(() => window.__eternal.data.phase !== 'reading', null, { timeout: 30000 });
  const end = await p.evaluate(() => ({ phase: window.__eternal.data.phase, found: window.__eternal.data.found }));
  assert.deepEqual(end, { phase: 'swept', found: 0 }, 'a Scan settles as the bench\'s own sweep (reverts are answers, not silence)');
  assert.match(await p.textContent('#etWbBState'), /no pieces found for this wallet/);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});
