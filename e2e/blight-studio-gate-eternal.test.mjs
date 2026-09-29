// blight-studio-gate-eternal.test.mjs — the bLighT studio gate (trait pre-flight) as three products in one
// surface (founder blueprint 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per
// register, each in its own dress; three different products (bee: eight plain questions and one button;
// raver: the eight rules as a dial with the layer at its heart; cypherpunk: config, the eight tags, the
// pipeline, the receipt with the served wasm's sha256); the SAME facts in all three for a real layer run
// through the real WASM gate; honest gestures (the verdict is never computed by a front: bee's button
// opens the page's own picker, a layer dropped on the dial goes to the page's own entry point, "save"
// is the page's own #dl and only a PASS enables it); honest failure (no wasm → every front says the gate
// did not load, nothing claims a pass); and the laws (no dash for a value, no forced capitals, 44 px
// actions, no sideways page).
// Run: node --test e2e/blight-studio-gate-eternal.test.mjs
// Red-on-HEAD proof: ETERNAL_OVERRIDE=<file with `git show HEAD:surfaces/blight/studio-gate.html`> node --test …
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/studio-gate.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const PORT = 9144, ORIGIN = `http://127.0.0.1:${PORT}`;
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

const WASM_SHA = createHash('sha256').update(await readFile(join(ROOT, 'surfaces/blight/studio-gate.wasm'))).digest('hex');
// the page's own self-test cases, as paint recipes: a 4×4 block passes; a 10-cell one-pixel run is a hairline
const CLEAN = "g.fillStyle='rgb(255,0,0)';g.fillRect(8,8,4,4)";
const HAIR = "g.fillStyle='rgb(0,255,0)';g.fillRect(10,24,10,1)";

async function open(reg, { noWasm = false, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); }
    if (noWasm && u.includes('studio-gate.wasm')) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}${query}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.gate !== 'wait' && window.__eternal.data.wasm.state !== 'wait', null, { timeout: 20000 });
  await p.waitForFunction(() => document.body.dataset.reg, null, { timeout: 10000 });
  await p.waitForTimeout(150);
  return { ctx, p, errs, outside };
}
const png = (p, paint) => p.evaluate(src => { const cv = document.createElement('canvas'); cv.width = cv.height = 48; new Function('g', src)(cv.getContext('2d')); return cv.toDataURL('image/png').split(',')[1]; }, paint);
async function feed(p, sel, paint, name) {
  const b64 = await png(p, paint);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(sel)]);
  await fc.setFiles({ name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await p.waitForFunction(() => /pass|fail/.test(window.__eternal.data.run), null, { timeout: 10000 });
  await p.waitForTimeout(100);
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

test('three different products; the gate, the goldens and the served wasm are the same facts in all three', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        d: [D.gate, D.version, D.wasm.sha, D.wasm.bytes, D.goldens.ok, D.goldens.n, D.run, D.rules.map(r => r.name + ':' + r.state).join(',')],
        tags: typeof TAGS !== 'undefined' ? Object.keys(TAGS).map(k => TAGS[k].name).join(',') : '',
        beeRows: document.querySelectorAll('#etSgRules .et-b-row').length, beeCard: document.getElementById('etSgBeeCard').textContent,
        rules: document.querySelectorAll('#etSgDialSvg .et-rule').length, heart: !!document.getElementById('etSgHeart'),
        cyTags: [...document.querySelectorAll('#etSgTags tr.et-pick')].map(r => r.cells[1].firstChild.textContent).join(','),
        cyPipe: document.querySelectorAll('#etSgPipe li').length, receipt: document.getElementById('etSgReceipt').textContent,
        chips: document.getElementById('etSgChips').textContent, pageGold: document.getElementById('codec-goldens').textContent,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].d, a.d, reg + ' = bee');
  assert.equal(a.d[0], 'ok'); assert.equal(a.d[1], 2, 'report format v2, read from the loaded wasm');
  assert.equal(a.d[2], WASM_SHA, 'the sha256 of the served studio-gate.wasm, hashed in the tab');
  assert.deepEqual([a.d[4], a.d[5]], [5, 5]); assert.match(a.pageGold, /5\/5/);
  assert.equal(a.d[6], 'none');
  assert.equal(a.beeRows, 8); assert.match(a.beeCard, /ready/);
  assert.equal(facts.raver.rules, 8); assert.ok(facts.raver.heart);
  assert.equal(facts.cypherpunk.cyTags, a.tags, 'the eight tags are the page\'s own TAGS'); assert.equal(facts.cypherpunk.cyPipe, 6);
  assert.ok(facts.cypherpunk.receipt.includes(WASM_SHA)); assert.match(facts.cypherpunk.chips, /wasm loaded.*codec goldens 5\/5/);
});

test('bee: the one button is the page\'s own picker; a real PASS enables the page\'s own save', async () => {
  const { ctx, p, errs, outside } = await open('bee');
  assert.equal(await p.$eval('#etSgBeeSave', b => b.hidden), true, 'no save before a pass');
  await feed(p, '#etSgBeeGo', CLEAN, 'clean.png');
  const d = await p.evaluate(() => ({ verdict: document.getElementById('verdict').textContent, card: document.getElementById('etSgBeeCard').textContent, dl: document.getElementById('dl').disabled, save: document.getElementById('etSgBeeSave').hidden, rows: [...document.querySelectorAll('#etSgRules .et-b-row small')].map(s => s.textContent) }));
  assert.match(d.verdict, /^PASS/, 'the page\'s own WASM verdict'); assert.match(d.card, /it passes/);
  assert.equal(d.dl, false); assert.equal(d.save, false, 'save appears only after the pass');
  assert.equal(d.rows.filter(x => /fine/.test(x)).length, 7); assert.equal(d.rows.filter(x => /off for now/.test(x)).length, 1, 'the palette rule says it was not checked');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#etSgBeeSave')]);
  assert.equal(dl.suggestedFilename(), 'clean_hexrect_v2.hex', 'the page\'s own blob download');
  assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the same failing layer reads the same in all three: raver drop, bee button, cypherpunk button', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg);
    if (reg === 'raver') {
      const b64 = await png(p, HAIR);
      await p.evaluate(b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        const dt = new DataTransfer(); dt.items.add(new File([u], 'hair.png', { type: 'image/png' }));
        document.getElementById('etSgDial').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, b64);
      await p.waitForFunction(() => window.__eternal.data.run === 'fail', null, { timeout: 10000 });
      await p.waitForTimeout(100);
    } else await feed(p, reg === 'bee' ? '#etSgBeeGo' : '#etSgCyGo', HAIR, 'hair.png');
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data;
      return {
        rules: D.rules.map(r => r.k + ':' + r.state + ':' + r.hits.length).join(','), verdict: document.getElementById('verdict').textContent,
        pageRows: [...document.querySelectorAll('#fbody tr')].map(r => r.cells[0].textContent).join('|'),
        bee: [...document.querySelectorAll('#etSgRules .et-b-row')].map(r => r.textContent).join('|'),
        raver: [...document.querySelectorAll('#etSgDialSvg .et-rule')].map(g => g.getAttribute('aria-label')).join('|'),
        heart: !document.getElementById('etSgHeartCv').hidden,
        cy: [...document.querySelectorAll('#etSgTags tr.et-pick')].map(r => r.cells[2].textContent).join('|'),
        dl: document.getElementById('dl').disabled,
      };
    });
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
  const a = seen.bee;
  assert.match(a.verdict, /^FAIL — 1 gate finding/); assert.match(a.pageRows, /hairline/);
  for (const reg of ['raver', 'cypherpunk']) { assert.equal(seen[reg].rules, a.rules, reg + ' same rule states'); assert.equal(seen[reg].verdict, a.verdict); }
  assert.match(a.rules, /6:fix:1/); assert.match(a.rules, /3:off:0/);
  assert.match(a.bee, /no lines too thin.*needs a fix/);
  assert.match(seen.raver.raver, /hairline: 1 finding/); assert.ok(seen.raver.heart, 'the layer as the gate saw it sits at the heart');
  assert.equal(seen.cypherpunk.cy.split('|')[5], '1 ×');
  assert.ok(a.dl && seen.raver.dl && seen.cypherpunk.dl, 'a failing layer never unlocks the save');
});

test('honest failure: without the wasm every front says the gate did not load, and nothing passes', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p, errs } = await open(reg, { noWasm: true });
    const d = await p.evaluate(() => ({ gate: window.__eternal.data.gate, verdict: document.getElementById('verdict').textContent, bee: document.getElementById('etSgBeeCard').textContent, raver: document.getElementById('etSgHint').textContent, cy: document.getElementById('etSgChips').textContent + document.getElementById('etSgReceipt').textContent }));
    assert.equal(d.gate, 'no'); assert.match(d.verdict, /DID NOT LOAD/);
    if (reg === 'bee') assert.match(d.bee, /did not load/);
    if (reg === 'raver') assert.match(d.raver, /did not load/);
    if (reg === 'cypherpunk') { assert.match(d.cy, /wasm failed/); assert.match(d.cy, /did not arrive/); }
    assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  }
});

test('the page\'s own self-test is read back, never restated', async () => {
  const { ctx, p } = await open('cypherpunk', { query: '?selftest' });
  await p.waitForFunction(() => window.__eternal.data.run === 'selftest', null, { timeout: 20000 });
  const d = await p.evaluate(() => ({ st: window.__eternal.data.selftest, verdict: document.getElementById('verdict').textContent }));
  const m = d.verdict.match(/SELF-TEST (\d+)\/(\d+)/);
  assert.deepEqual([d.st.pass, d.st.n], [+m[1], +m[2]]); assert.equal(d.st.n, 7);
  await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await feed(p, reg === 'bee' ? '#etSgBeeGo' : reg === 'raver' ? '#etSgRaverGo' : '#etSgCyGo', HAIR, 'hair.png');
    if (reg === 'bee') await p.click('#etSgRules .et-b-row[data-rule="6"]');
    if (reg === 'raver') await p.click('#etSgDialSvg .et-rule[data-rule="6"]');
    if (reg === 'cypherpunk') await p.click('#etSgTags tr.et-pick[data-tag="6"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      if (document.documentElement.scrollWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('junk ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
