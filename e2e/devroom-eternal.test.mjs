// devroom-eternal.test.mjs — the builders' dev room as three products in one surface (founder
// blueprint 2026-09-26, docs/design/eternal; ETERNAL wave 3). Proves at 390 px: exactly one front per
// register, each in its own dress, structure and gesture; all three carry the SAME facts, read from
// the room's own DOM (its hand-synced counts, its articles, NEEDS chips, procedures and its findings
// ledger), and the counts agree with what the room actually holds; the one action is reading: every
// "open" unfolds the article's own <details>; nothing is fetched or submitted, and no front draws a
// citation or a submission the room does not have. Run: node --test e2e/devroom-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9254, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push(r.request().method() + ' ' + u.slice(ORIGIN.length)); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/devroom.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.articles.length, null, { timeout: 15000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, outside, requests };
}

test('each register: its own front, dress and structure; the same facts, true to the room; the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', actSel: '.et-b-primary', titleSel: '.et-b-h' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', actSel: '.et-r-pill', titleSel: '.et-r-h' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', actSel: '.et-c-primary', titleSel: '.et-c-path' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    const d = await p.evaluate(w => {
      const txt = s => (s || '').replace(/\s+/g, ' ').trim();
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, bad = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('value ' + own);
        const r = el.getBoundingClientRect(); if (r.right > 390.5) bad.push('edge ' + el.tagName + ' ' + Math.round(r.right));
        if ((/^(BUTTON|A|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) bad.push('small ' + el.tagName + ' ' + txt(el.textContent).slice(0, 20));
      }
      return { shown, bad, bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(fr.querySelector(w.titleSel)).fontFamily, action: getComputedStyle(fr.querySelector(w.actSel)).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, cells: fr.querySelectorAll('svg.et-r-art [data-et-cell]').length, tables: fr.querySelectorAll('table.et-c-tab').length,
        model: { counts: D.counts, articles: D.articles.map(a => [a.id, a.symptom, a.finders, a.needs.length, a.steps.length, a.cmds.length]), finders: D.finders.map(f => f.who), snapshot: D.snapshot, cites: D.citationsNeeded, reframes: D.reframes, threshold: D.threshold, va: D.vaBits },
        room: { arts: document.querySelectorAll('main .art').length, finders: document.querySelectorAll('main .finder').length, chips: document.querySelectorAll('main .art .chips span').length, pres: [...document.querySelectorAll('main .art')].map(a => a.querySelectorAll('.art-body pre').length) },
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => txt(r.textContent)), beeFoot: document.getElementById('etBeeFoot').textContent,
        river: { find: document.querySelectorAll('#etArt .rv-find').length, draft: document.querySelectorAll('#etArt .rv-draft').length, cite: document.querySelectorAll('#etArt .rv-cite').length, slots: document.querySelectorAll('#etArt .rv-slot').length }, hint: document.getElementById('etRaverHint').textContent,
        pipe: [...document.querySelectorAll('#etPipe li')].map(l => [l.className, txt(l.textContent)]), arts: document.querySelectorAll('#etArts tr.pick').length, receipt: txt(document.getElementById('etReceipt').textContent) };
    }, w);
    assert.deepEqual(d.shown, [w.front], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.cells > 0, reg === 'raver', 'raver is the river'); assert.equal(d.tables > 0, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ': the laws on the front');
    assert.deepEqual(outside, [], reg + ': no request left the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
  const a = facts.bee, m = a.model;
  // the hand-synced counts agree with what the room actually holds
  assert.deepEqual(m.counts, { found: 4, drafted: 3, cited: 0, submitted: 0 });
  assert.equal(m.counts.found, a.room.finders); assert.equal(m.counts.drafted, a.room.arts);
  assert.equal(m.cites + m.reframes, a.room.chips); assert.deepEqual(m.articles.map(x => x[5]), a.room.pres);
  assert.deepEqual(m.articles.map(x => [x[0], x[2]]), [['a1', ['storage_guy']], ['a2', ['TT3']], ['a3', ['traktion', 'aautonomicc']]], 'each write-up credits its finders by name');
  assert.equal(m.articles[0][1], 'my database got slower the more RAM the machine had');
  assert.equal(m.snapshot, '2026-08-23'); assert.equal(m.threshold, 'read_ahead_kb 1024 passes · 1025 fails'); assert.equal(m.va, 'VA_BITS 39 → 512 GiB · 48 → 256 TiB · 52 → 4 PiB');
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, m, reg + ' reads the same facts');
  // each register draws them, and none draws progress the room does not have
  assert.deepEqual(a.beeRows, m.articles.map(x => `${x[1]}found by ${x[2].join(' and ')}`)); assert.equal(a.beeFoot, 'none of this has been sent to any encyclopedia yet. 0 submitted.');
  const r = facts.raver; assert.deepEqual(r.river, { find: m.counts.found, draft: m.counts.drafted, cite: m.counts.cited, slots: m.counts.drafted - m.counts.cited });
  assert.equal(r.hint, '4 found · 3 drafted · 0 cited · 0 sent');
  const c = facts.cypherpunk; assert.equal(c.arts, 3); assert.deepEqual(c.pipe.map(x => x[0]), ['done', 'done', 'todo now', 'you']);
  assert.match(c.pipe[2][1], new RegExp(`still needs ${m.cites} citations \\+ ${m.reframes} scope reframe`));
  assert.match(c.receipt, /counts4 found · 3 drafted · 0 cited · 0 submitted/); assert.match(c.receipt, /submitted0 · no seat transmits/);
});

test('the one action is reading: each front opens the article\'s own details, and nothing is fetched', async () => {
  for (const [reg, pick, go] of [['bee', '#etBeeRows [data-et-art="1"]', '#etBeeGo'], ['raver', '#etArt [data-et-cell="finder:3"]', '#etRaverGo'], ['cypherpunk', '#etArts tr[data-et-art="1"]', '#etCyGo']]) {
    const { ctx, p, errs, requests } = await open(reg);
    const req0 = requests.length;
    await p.click(pick, { force: true });
    await p.click(go);
    await p.waitForTimeout(250);
    const want = reg === 'raver' ? 'a3' : 'a2'; // aautonomicc's finding lives in article ③
    const d = await p.evaluate(id => ({ open: [...document.querySelectorAll('main .art details')].filter(x => x.open).map(x => x.closest('.art').id), top: Math.round(document.getElementById(id).getBoundingClientRect().top) }), want);
    assert.deepEqual(d.open, [want], reg + ': the chosen article unfolded'); assert.ok(Math.abs(d.top) < 60, reg + ': and came into view');
    assert.deepEqual(requests.slice(req0), [], reg + ': reading costs no request');
    if (reg === 'cypherpunk') {
      assert.match(await p.textContent('#etCyProcH'), /^procedure · article 02 · 8 sections$/);
      assert.match(await p.textContent('#etCmd'), /strace -f -e trace=mmap,mmap2/, 'the commands are the article\'s own');
    }
    if (reg === 'raver') assert.match(await p.textContent('#etRaverCard'), /aautonomicc/);
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});
