// design-system-eternal.test.mjs — the system's specimen sheet as three products in one surface
// (founder blueprint 2026-09-26, docs/design/eternal). THE RULING: the specimens stay exactly as they
// are — including the label and eyebrow specimens whose casing is a pending founder decision — and
// the footer-audit ratchet (e2e/footer-audit.baseline.json, design-system.html [cypherpunk]) may only
// go down. Any front ABOVE those specimens pushes them into the half of the page the audit measures,
// so the fronts come right after the type sheet (03); this file proves the specimens are untouched
// and stay out of the audited half in every register. It also proves at 390 px: exactly one front
// per register, each in its own dress; all three carry the SAME facts, read from the sheet (palette,
// grounds, rhythm, the four hue laws, the lattice) and cross-checked against the compiled skaists.css
// (itself checked here against docs/design/skaists/tokens.json); the gestures light, never change, a
// token; copy is honest; and the laws hold on the front.
// Run: node --test e2e/design-system-eternal.test.mjs
// Red-on-HEAD proof: git show HEAD:surfaces/design-system.html > /tmp/ds.html;
//   ETERNAL_OVERRIDE=/tmp/ds.html node --test e2e/design-system-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/design-system.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9273, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try {
    let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''); if (rel.endsWith('/')) rel += 'index.html';
    const f = rel === PAGE && process.env.ETERNAL_OVERRIDE ? process.env.ETERNAL_OVERRIDE : join(ROOT, rel);
    const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b);
  } catch { s.writeHead(404); s.end(); }
});
let browser; const cache = {};
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { for (const c of Object.values(cache)) await c.ctx.close(); if (browser) await browser.close(); srv.close(); });

async function open(reg, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  if (opts.clip) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.who.length && document.body.dataset.reg && document.getElementById('bregbar'), null, { timeout: 8000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  return { ctx, p, errs };
}
const view = async reg => (cache[reg] ||= await open(reg));
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
// the pending-decision specimens, exactly as the sheet documents them (keyed captions in 03)
const SPECIMENS = [
  ['label — the panel’s job, stated once', 'font-size:11.5px;color:#8FA79C;letter-spacing:.12em;text-transform:uppercase'],
  ['eyebrow — zero network · no password · no name', 'font-size:10px;color:#648176;letter-spacing:.34em;text-transform:uppercase'],
];

test('the ruling: the specimens are untouched, and the fronts keep them out of the audited half', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    const m = await p.evaluate(S => {
      const H = document.documentElement.scrollHeight, spec = S.map(([t]) => [...document.querySelectorAll('.spec div')].find(d => !d.children.length && d.textContent.replace(/'/g, '’') === t));
      const s03 = [...document.querySelectorAll('[data-i18n]')].find(e => e.dataset.i18n === 'ds.s03').closest('section'), ev = document.getElementById('eternal');
      return { styles: spec.map(e => e && e.getAttribute('style')), bottoms: spec.map(e => e && e.getBoundingClientRect().bottom + scrollY), mid: H / 2,
        after: !!(s03.compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING), caps: spec.map(e => e && getComputedStyle(e).textTransform) };
    }, SPECIMENS);
    assert.deepEqual(m.styles, SPECIMENS.map(s => s[1]), reg + ': the label and eyebrow specimens keep their documented values');
    assert.deepEqual(m.caps, ['uppercase', 'uppercase'], reg + ': their casing is left for the founder');
    assert.ok(m.after, reg + ': the fronts come after the type sheet');
    m.bottoms.forEach((b, i) => assert.ok(b < m.mid, `${reg}: specimen ${i} ends at ${Math.round(b)}, above the audited half (${Math.round(m.mid)})`));
  }
});

test('one front per register, each in its own dress (the sheet keeps its one dark dress)', async () => {
  const want = {
    bee: { front: '.et-b', ground: '#eternal', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, act: '.et-b-primary', action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', ground: 'body', bg: 'rgb(6, 17, 12)', title: /Unbounded/, act: '.et-r-pill', action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', ground: 'body', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, act: '#etDsCopy', action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { p, errs } = await view(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(w => {
      const fr = document.querySelector('#eternal>' + w.front), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path');
      return { bg: getComputedStyle(document.querySelector(w.ground)).backgroundColor, sheet: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(fr.querySelector(w.act)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, w);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.equal(d.sheet, 'rgb(6, 17, 12)', reg + ': the specimen sheet stays on its dark ground');
    assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
  }
});

test('the same system in all three, read from the sheet and cross-checked against skaists', async () => {
  const T = JSON.parse(await readFile(join(ROOT, 'docs/design/skaists/tokens.json'), 'utf8'));
  const byName = Object.fromEntries(T.color.tokens.map(t => [t.name, t]));
  const res = (n, r) => { const v = byName[n].value[r]; const m = /^\{([\w-]+)\}$/.exec(v); return m ? res(m[1], r) : v.toLowerCase(); };
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim(), all = s => [...document.querySelectorAll(s)];
      const pal = [...D.who, ...D.state, ...D.grounds];
      return {
        who: D.who.map(c => [c.name, c.value, c.meaning]), state: D.state.map(c => [c.name, c.value, c.meaning]), grounds: D.grounds.map(c => [c.name, c.value]), rhythm: D.rhythm, laws: D.laws.map(l => [l.text, l.names]), lattice: D.lattice,
        sk: pal.map(c => [c.name, c.sk]),
        page: { chips: all('.chipbox .cn').map(t), rhythm: all('.rhythm .r span').map(t), laws: t(document.querySelector('pre.laws')) },
        bee: all('#etDsRows .et-b-row small').map(t), cells: all('#etDsComb .et-cell').map(g => g.getAttribute('data-cell')),
        rows: all('#etDsTab tr.et-pick td:first-child').map(t), rhy: all('#etDsRhy tbody tr').map(t), lawList: all('#etDsLawList li').length, chips: t(document.getElementById('etDsChips')),
      };
    });
  }
  const a = facts.bee;
  for (const reg of ['raver', 'cypherpunk']) for (const k of ['who', 'state', 'grounds', 'rhythm', 'laws', 'lattice', 'sk']) assert.deepEqual(facts[reg][k], a[k], reg + ' ' + k);
  // read from the sheet, never typed
  assert.equal(a.who.length, 7); assert.equal(a.state.length, 5); assert.equal(a.grounds.length, 7);
  assert.deepEqual([...a.who, ...a.state].map(c => '--' + c[0]), a.page.chips.map(c => c.split(/\s/)[0]));
  assert.deepEqual(a.rhythm.map(r => r.px), [6, 12, 18, 24, 36, 48]); assert.equal(a.page.rhythm.length, 6);
  assert.equal(a.laws.length, 4); a.laws.forEach(([text]) => assert.ok(a.page.laws.includes(text), 'law quoted as printed'));
  assert.deepEqual(a.laws.map(l => l[1]), [['b-value'], ['ai'], ['biomass'], ['guard']], 'each law lights the colour it names');
  assert.deepEqual(a.lattice.rings, [1, 6, 12, 18, 24, 30]); assert.equal(a.lattice.rings.reduce((x, y) => x + y, 0), a.lattice.total);
  // skaists as compiled = skaists as ruled in tokens.json; the sheet's two extensions have no token
  for (const [name, sk] of a.sk) {
    const grad = T.gradient.tokens.find(t => t.name === name);
    if (grad) { for (const r of ['bee', 'raver', 'cypherpunk']) assert.equal(sk[r], grad.value, `${name} [${r}] is the one gradient`); continue; }
    if (!byName[name]) { assert.equal(sk, null, name + ' is this sheet only'); continue; }
    for (const r of ['bee', 'raver', 'cypherpunk']) assert.equal(sk[r].toLowerCase(), res(name, r), `${name} [${r}] matches tokens.json`);
  }
  assert.deepEqual(a.sk.filter(x => !x[1]).map(x => x[0]), ['ai-deep', 'well']);
  // each register draws all of it
  assert.deepEqual(a.bee, ['7 colours', '5 colours', '7 tones', '6 steps', '4 rules', '91 cells']);
  assert.deepEqual(facts.raver.cells, ['you', ...a.who.map(c => c[0]).filter(n => n !== 'you'), ...a.state.map(c => c[0]), ...a.grounds.map(c => c[0])], 'raver: you at the heart, who is who, then states and grounds');
  assert.equal(facts.cypherpunk.rows.length, 19); assert.equal(facts.cypherpunk.rhy.length, 6); assert.ok(facts.cypherpunk.rhy.every(r => /= \d+px/.test(r)), 'rhythm agrees with skaists');
  assert.equal(facts.cypherpunk.lawList, 4); assert.match(facts.cypherpunk.chips, /in skaists 17 of 19/); assert.match(facts.cypherpunk.chips, /= 91/);
});

test('gestures light, never change, a token: bee opens a row and shows the sheet, raver lights a law, cypherpunk copies honestly', async () => {
  const b = await open('bee');
  await b.p.click('.et-b-row[data-row="who"]');
  assert.equal(await b.p.$$eval('.et-b-open[data-row="who"] .et-ds-item', e => e.length), 7);
  await b.p.click('#eternal .et-b-primary'); await b.p.waitForTimeout(250);
  assert.ok(await b.p.evaluate(() => { const s = [...document.querySelectorAll('[data-i18n]')].find(e => e.dataset.i18n === 'ds.s01').closest('section').getBoundingClientRect(); return s.top < innerHeight && s.bottom > 0; }), 'the palette is on screen');
  await b.ctx.close();
  const { ctx, p, errs } = await open('raver');
  const before = await p.evaluate(() => JSON.stringify(window.__eternal.data.sk));
  await p.locator('#etDsLaws [data-law="3"]').click({ force: true });
  assert.equal(await p.evaluate(() => window.__eternal.raver.law), 3, 'the tap landed');
  assert.deepEqual(await p.$$eval('#etDsComb .et-cell.et-lit', e => e.map(g => g.getAttribute('data-cell'))), ['guard'], 'the refusal law lights guard');
  assert.match(await p.textContent('#etDsCard'), /never error-red/);
  await p.locator('#etDsComb .et-cell[data-cell="ai"] polygon').click({ force: true });
  assert.equal(await p.$eval('#etDsComb .et-cell[data-cell="ai"]', g => g.getAttribute('aria-pressed')), 'true');
  assert.match(await p.textContent('#etDsCard'), /machine base/);
  await p.locator('#etDsRhythm [data-step="2"]').click({ force: true });
  assert.equal(await p.$$eval('#etDsComb .et-ripple.et-on', e => e.map(c => c.getAttribute('r'))).then(x => x.length), 1);
  await p.locator('#etDsComb .et-cell[data-cell="ai"] polygon').click({ force: true });
  await p.click('#etDsStill');
  assert.equal(await p.$eval('#etDsComb .et-cell[aria-pressed="true"] polygon', e => getComputedStyle(e).animationPlayState), 'paused');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__eternal.data.sk)), before, 'no gesture changes a token');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  const { p: c } = await view('cypherpunk');
  await c.click('#etDsCopy'); await c.waitForTimeout(250);
  assert.doesNotMatch(await c.textContent('#etDsCopied'), /^copied/, 'no permission, no "copied"');
  await c.click('#etDsTab tr.et-pick[data-i="1"]');
  assert.match(await c.$eval('#etDsTab tr.et-more[data-i="1"]', e => e.hidden ? '' : e.textContent), /no skaists token/);
  const g = await open('cypherpunk', { clip: true });
  await g.p.click('#etDsCopy'); await g.p.waitForTimeout(250);
  assert.equal(await g.p.evaluate(() => navigator.clipboard.readText()), '<link rel="stylesheet" href="skaists.css">');
  assert.match(await g.p.textContent('#etDsCopied'), /^copied/);
  await g.ctx.close();
});

test('the laws hold on the front: no dash or NaN for a value, no forced capitals, 44 px actions, nothing past 390 px', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { p } = await view(reg);
    if (reg === 'bee') await p.click('.et-b-row[data-row="grounds"]');
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–·-]$|^(undefined|NaN|null|\?)$|not read/.test(own)) out.push('value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if ((/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
        if (r.width && (r.right > 391 || r.left < -1)) out.push('edge ' + el.tagName + ' ' + Math.round(r.right));
      }
      if (document.documentElement.scrollWidth > 390) out.push('wide ' + document.documentElement.scrollWidth);
      return out;
    });
    assert.deepEqual(bad, [], reg);
  }
});
