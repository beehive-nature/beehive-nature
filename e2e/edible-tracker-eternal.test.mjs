// edible-tracker-eternal.test.mjs — the edible and effects tracker (surfaces/fleet-hosted/lab/edible-tracker.html),
// the founder's instrument for a daily baseline and how each session felt (bnBaseline, bnEdibleSessions), with
// three products above it (founder blueprint 2026-09-26, docs/design/eternal; fleet-hosted ruling: the tracker
// stays exactly as made, 0 lines removed). Proves at 390 px: one front per register in its own dress; the SAME
// pattern in all three, recomputed from the tracker's own sessions and equal to what updateAnalysis() prints, with
// no dash shown where the page prints one; honest gestures (a feeling is the tracker's own slider, a side effect
// its own box, the stars its own stars, logging its own button; "logged" only when bnEdibleSessions grew; a short
// hold writes nothing; a failed save is never called done; the baseline is never written by a front); the
// tracker's own words quoted, its advice not repeated; nothing leaves the origin; the tracker below still works.
// Run: node --test e2e/edible-tracker-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/fleet-hosted/lab/edible-tracker.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9212, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

const pos = (a) => ({ Energy: a[0], Creativity: a[1], Focus: a[2], Euphoria: a[3], Relaxation: a[4], 'Body Comfort': a[5] });
const SEED = {
  bnEdibleSessions: [
    { method: 'Spliff', strain: 'a', amount: 0.5, thca: 30, time: '14:00', sinceEdible: 4, positive: pos([7, 8, 6, 5, 4, 6]), sideEffects: ['Dry Mouth'], rating: 4, notes: '', baseline: { cbd: 0, thc: 0 }, timestamp: '2026-09-25T20:00:00Z' },
    { method: 'Bong', strain: 'b', amount: 0.3, thca: 25, time: '20:00', sinceEdible: 2, positive: pos([3, 5, 4, 7, 9, 8]), sideEffects: [], rating: 5, notes: '', baseline: { cbd: 0, thc: 0 }, timestamp: '2026-09-26T02:00:00Z' },
  ],
  bnBaseline: { cbd: 200, thc: 10, other: 5, carrier: 'Olive Oil', volume: 2, doses: 1, days: 12, saved: '2026-09-20T08:00:00.000Z' },
};
// updateAnalysis()'s own arithmetic, done here from the seed
const avgPos = ((36 / 6) + (36 / 6)) / 2, WANT = { count: '2', positive: avgPos.toFixed(1) + '/10', side: '50% (1/2)', rating: '4.5/5' };
async function open(reg, { seeded = true, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([r, S, seeded]) => {
    try { localStorage.setItem('bregister', r); if (seeded && !sessionStorage.getItem('seeded')) { for (const k in S) localStorage.setItem(k, JSON.stringify(S[k])); sessionStorage.setItem('seeded', '1'); } } catch {}
  }, [reg, SEED, seeded]);
  if (init) await ctx.addInitScript(init);
  const outside = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN)) return r.continue(); outside.push(u); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.install();
  await p.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && document.body.getAttribute('data-reg'), null, { timeout: 20000 });
  return { ctx, p, errs, outside };
}
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const logged = p => p.evaluate(() => JSON.parse(localStorage.getItem('bnEdibleSessions') || '[]'));
const baseKey = p => p.evaluate(() => localStorage.getItem('bnBaseline'));
const laws = p => p.evaluate(() => {
  const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
  if (document.documentElement.scrollWidth > 390 || innerWidth > 390) out.push('sideways ' + document.documentElement.scrollWidth);
  for (const el of fr.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || el.closest('[hidden]')) continue;
    if (cs.textTransform !== 'none') out.push('caps ' + el.className);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (/^[—–-]$/.test(own) || /(^|[\s·(])[—–](?=$|[\s·)])/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) out.push('value "' + own + '" in ' + (el.id || el.className));
    const r = el.getBoundingClientRect();
    if (r.width && r.right > 390.5) out.push('past 390: ' + (el.id || el.tagName) + ' ' + Math.round(r.right));
    if (/^(BUTTON|A|SELECT|LABEL)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'checkbox')) { if (r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small ' + el.tagName + ' ' + (el.id || el.textContent.trim().slice(0, 20))); }
    if (el.getAttribute('role') === 'button' && r.height && (r.height < 43.5 || r.width < 43.5)) out.push('small svg target');
  }
  return out;
});

test('one front per register in its own dress; the tracker keeps its own ground; the laws, seeded and empty, every step', async () => {
  const want = {
    bee: { bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    for (const seeded of [true, false]) {
      const { ctx, p, errs, outside } = await open(reg, { seeded });
      assert.deepEqual(await shown(p), [FRONT[reg]], reg + ': exactly its own front');
      const d = await p.evaluate(f => {
        const fr = document.querySelector('#eternal>' + f), title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-holdbtn,.et-c-primary');
        return { bg: getComputedStyle(document.getElementById('eternal')).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, art: getComputedStyle(document.body).backgroundColor };
      }, FRONT[reg]);
      assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
      assert.equal(d.art, 'rgb(10, 10, 20)', reg + ': the tracker keeps its own ground (#0a0a14)');
      assert.deepEqual(await laws(p), [], reg + (seeded ? ' seeded' : ' empty'));
      if (reg === 'bee' && seeded) { await p.click('#etBeeTell'); assert.deepEqual(await laws(p), [], 'bee tell step'); }
      assert.deepEqual(outside, [], reg + ': nothing leaves the origin');
      assert.equal(errs.length, 0, errs.join(' | '));
      await ctx.close();
    }
  }
});

test('the same pattern in all three: the tracker\'s own sessions, equal to what updateAnalysis() prints', async () => {
  const seen = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    seen[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        D: { n: D.n, avgPos: D.avgPos, sidePct: D.sidePct, sideCount: D.sideCount, avgRating: D.avgRating, page: D.page, want: D.want, agree: D.agree, baseSaved: D.baseSaved, hypothesis: D.hypothesis },
        bee: [...document.querySelectorAll('#etBeeStats .et-b-row>small')].map(t), base: [...document.querySelectorAll('#etBeeBase .et-b-row>small')].map(t),
        raver: { card: t(document.getElementById('etWebCard')), avg: !!document.querySelector('#etWeb .et-web-avg'), nodes: document.querySelectorAll('#etWeb .et-web-node').length },
        cy: [...document.querySelectorAll('#etcReceipt tr')].slice(0, 4).map(r => t(r.cells[1])), quote: t(document.getElementById('etcQuote')), baseNote: t(document.getElementById('etcBaseNote')),
      };
    });
    await ctx.close();
  }
  const D = seen.bee.D;
  assert.deepEqual(D.page, WANT, 'the tracker printed the seed'); assert.equal(D.agree, true);
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(seen[reg].D, D, reg + ' reads the same sessions');
  assert.deepEqual(seen.bee.bee, ['2', '6.0 of 10', '50% · 1 of 2', '4.5 of 5']);
  assert.deepEqual(seen.bee.base, ['200 mg a day', '10 mg a day', '5 mg a day', 'olive oil', '1', '12'], 'the saved baseline, not the form\'s starting numbers');
  assert.match(seen.raver.raver.card, /your average over 2: 6.0 of 10.*a side effect in 50% · 4.5 of 5/); assert.ok(seen.raver.raver.avg, 'the dashed average web'); assert.equal(seen.raver.raver.nodes, 6);
  assert.deepEqual(seen.cypherpunk.cy, ['2 · 2 ✓', `${WANT.positive} · ${WANT.positive} ✓`, `${WANT.side} · ${WANT.side} ✓`, `${WANT.rating} · ${WANT.rating} ✓`]);
  assert.match(D.hypothesis, /^This tool tests the hypothesis that daily cannabinoid nutrition/); assert.match(seen.cypherpunk.quote, /the tracker's own words · This tool tests the hypothesis/);
  assert.match(seen.cypherpunk.baseNote, /the summary box below reads the form, not the saved copy/);
});

test('an empty browser: no dash where the page prints one, and the tracker\'s advice is never repeated', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg, { seeded: false });
    const d = await p.evaluate(() => ({ page: window.__eternal.data.page, front: document.getElementById('eternal').innerText, bee: [...document.querySelectorAll('#etBeeStats .et-b-row>small')].map(e => e.textContent), cy: document.getElementById('etcReceipt').textContent, card: document.getElementById('etWebCard').textContent, base: document.getElementById('etBeeBase').textContent }));
    assert.deepEqual(d.page, { count: '0', positive: '—', side: '—', rating: '—' }, 'the page itself prints dashes');
    if (reg === 'bee') { assert.deepEqual(d.bee, ['0', 'nothing logged yet', 'nothing logged yet', 'nothing logged yet']); assert.match(d.base, /not saved in this browser yet/); assert.doesNotMatch(d.base, /1500|600/, 'the form\'s starting numbers are not shown as yours'); }
    if (reg === 'raver') assert.match(d.card, /no sessions yet, honestly/);
    if (reg === 'cypherpunk') assert.match(d.cy, /no sessions yet · nothing to average ✓/);
    assert.doesNotMatch(d.front, /Consider increasing|may improve your acute|supports the ECS optimization/, 'no advice sentence from #insight');
    await ctx.close();
  }
});

test('honest gestures: through the tracker\'s own controls; logged only when bnEdibleSessions grew; the baseline is never written by a front', async () => {
  // new bee: raise energy twice, tick paranoia, give 4 stars, log through the tracker's own button
  let o = await open('bee');
  const base0 = await baseKey(o.p);
  await o.p.click('#etBeeTell');
  await o.p.click('#etBeeFelt [data-pos="0"][data-d="1"]'); await o.p.click('#etBeeFelt [data-pos="0"][data-d="1"]');
  await o.p.check('#etBeeSide [data-side="Paranoia"]'); await o.p.click('#etBeeStars [data-star="4"]');
  assert.deepEqual(await o.p.evaluate(() => [document.getElementById('pos_0').value, document.getElementById('posv_0').textContent, document.querySelector('#sideEffects input[value="Paranoia"]').checked, window.starRating]), ['7', '7', true, 4], 'the tracker\'s own slider, label, box and stars moved');
  await o.p.click('#etBeeLog');
  let s = await logged(o.p);
  assert.equal(s.length, 3); assert.equal(s[2].positive.Energy, 7); assert.deepEqual(s[2].sideEffects, ['Paranoia']); assert.equal(s[2].rating, 4);
  assert.equal(await o.p.isVisible('#etBeeDone'), true); assert.match(await o.p.textContent('#etBeeSaid'), /session 3 is in this browser: spliff at 14:00, 4 of 5 overall/);
  assert.equal(await o.p.textContent('#a_count'), '3', 'the tracker itself shows it');
  assert.equal(await baseKey(o.p), base0, 'the baseline is untouched');
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // raver: a point raises its feeling; a short hold writes nothing; a full hold logs one session
  o = await open('raver');
  await o.p.click('#etWeb .et-web-node[data-pos="4"]', { force: true });
  assert.equal(await o.p.inputValue('#pos_4'), '6', 'the tap landed on the tracker\'s own slider');
  await o.p.click('#etWebStars [data-star="5"]');
  await o.p.dispatchEvent('#etWebHold', 'pointerdown'); await o.p.clock.runFor(500); await o.p.dispatchEvent('#etWebHold', 'pointerup'); await o.p.clock.runFor(1500);
  assert.equal((await logged(o.p)).length, 2, 'a short hold logs nothing');
  await o.p.dispatchEvent('#etWebHold', 'pointerdown'); await o.p.clock.runFor(1600); await o.p.dispatchEvent('#etWebHold', 'pointerup');
  s = await logged(o.p); assert.equal(s.length, 3); assert.equal(s[2].positive.Relaxation, 6); assert.equal(s[2].rating, 5);
  assert.match(await o.p.textContent('#etWebCard'), /logged · session 3.*bnEdibleSessions grew 2 → 3/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
  // cypherpunk: logSession() appends and the receipt says so
  o = await open('cypherpunk');
  await o.p.fill('#etcPos input[data-pos="2"]', '9'); await o.p.dispatchEvent('#etcPos input[data-pos="2"]', 'change');
  assert.equal(await o.p.inputValue('#pos_2'), '9');
  await o.p.click('#etcLog');
  s = await logged(o.p); assert.equal(s.length, 3); assert.equal(s[2].positive.Focus, 9);
  assert.match(await o.p.textContent('#etcLogged'), /bnEdibleSessions · 2 → 3 ✓/);
  assert.deepEqual(o.outside, []); await o.ctx.close();
});

test('a save that fails is never called done; the tracker below still works and moves the fronts', async () => {
  let o = await open('bee', { init: () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'bnEdibleSessions') throw new Error('quota'); return set.call(this, k, v); }; } });
  await o.p.click('#etBeeTell'); await o.p.click('#etBeeLog');
  assert.equal(await o.p.isVisible('#etBeeDone'), false, 'no "logged." screen');
  assert.match(await o.p.textContent('#etBeeLogNote'), /not logged: the tracker did not keep it/);
  await o.ctx.close();
  o = await open('cypherpunk', { seeded: false });
  assert.equal(await o.p.evaluate(() => document.querySelector('body>#etArchive').nextElementSibling.className), 'hdr');
  await o.p.click('button.btn[onclick="saveBaseline()"]');
  assert.ok(await baseKey(o.p), 'the tracker\'s own button saves the baseline');
  assert.match(await o.p.textContent('#etcChips'), /bnBaseline · saved/, 'and the front follows');
  await o.p.click('button.btn[onclick="logSession()"]');
  assert.equal((await logged(o.p)).length, 1); assert.match(await o.p.textContent('#etcChips'), /bnEdibleSessions · 1/);
  assert.equal(o.errs.length, 0, o.errs.join(' | ')); await o.ctx.close();
});
