// biq-eternal.test.mjs — the bIQ Composer as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal; ETERNAL wave 3). Proves at 390 px: exactly one front per register,
// each in its own dress, structure and gesture; all three carry the SAME facts, read from the
// composer's own state (window.__biq) and DOM; every gesture drives the composer's real controls
// (#subject, #sents, the tone-check button, #cp), "ready" and "woven" are drawn only when the
// composer's own #draft exists, and NOTHING POSTS: no request leaves the page while composing or
// copying. Run: node --test e2e/biq-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 9250, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [], requests = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort('blockedbyclient'); } requests.push(u); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/biq.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.subjects.length, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  return { ctx, p, errs, outside, requests };
}
const txt = s => (s || '').replace(/\s+/g, ' ').trim();

test('each register: exactly its own front, its own dress and structure, the same facts, the laws', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)', actSel: '.et-b-primary', titleSel: '.et-b-h' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)', actSel: '.et-hold', titleSel: '.et-r-h' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)', actSel: '.et-c-primary', titleSel: '.et-c-path' },
  };
  const facts = {};
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    const d = await p.evaluate(w => {
      const shown = ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none');
      const txt = s => (s || '').replace(/\s+/g, ' ').trim();
      const fr = document.querySelector('#eternal>' + w.front), D = window.__eternal.data, B = window.__biq;
      const bad = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue;
        if (cs.textTransform !== 'none') bad.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /\b(undefined|NaN|null)\b/.test(own)) bad.push('value ' + own);
        const r = el.getBoundingClientRect();
        if (r.right > 390.5) bad.push('edge ' + el.tagName + ' ' + Math.round(r.right));
        if ((/^(BUTTON|A|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button') && r.height && (r.height < 43.5 || r.width < 43.5)) bad.push('small ' + el.tagName + ' ' + txt(el.textContent).slice(0, 20));
      }
      return {
        shown, bad, bg: getComputedStyle(document.body).backgroundColor,
        title: getComputedStyle(fr.querySelector(w.titleSel)).fontFamily, action: getComputedStyle(fr.querySelector(w.actSel)).backgroundColor,
        wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: fr.querySelectorAll('.et-b-rows .et-b-row').length, stars: fr.querySelectorAll('svg.et-r-art [data-et-star]').length, tables: fr.querySelectorAll('table.et-c-tab').length,
        model: { subjects: D.subjects.map(s => [s.id, s.n]), sel: D.sel, sents: D.sents.map(s => [s.c, s.on, s.flags.length]), rules: D.rules.length, picked: D.picked, cites: D.cites },
        page: { subjects: B.subjects.map(s => [s.id, s.sents.length]), sel: B.cur().id, options: document.querySelectorAll('#subject option').length, sents: document.querySelectorAll('#sents .sent').length, picked: document.querySelectorAll('#sents .pick:checked').length, rules: B.tone.length },
        beeRows: [...document.querySelectorAll('#etBeeSubjects .et-b-row')].map(r => txt(r.textContent)),
        beeSents: document.querySelectorAll('#etBeeSents [data-et-sent]').length,
        tiles: [...document.querySelectorAll('#etTiles .et-r-tile')].map(t => txt(t.textContent)), hub: txt((document.querySelector('#etArt .cst-hubt') || {}).textContent), ears: document.querySelectorAll('#etArt .cst-ear').length,
        cySubj: [...document.querySelectorAll('#etCySubj tr')].map(r => [...r.cells].map(c => txt(c.textContent)).join(' ')), cySent: document.querySelectorAll('#etCySent tr[data-et-row]').length, cyTone: document.querySelectorAll('#etCyTone tr').length, receipt: txt(document.querySelector('#etReceipt').textContent),
      };
    }, w);
    assert.deepEqual(d.shown, [w.front], reg + ': exactly its own front');
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows > 0, reg === 'bee', 'bee is a card of rows'); assert.equal(d.stars > 0, reg === 'raver', 'raver is the constellation'); assert.equal(d.tables > 0, reg === 'cypherpunk', 'cypherpunk is the instrument');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(d.bad, [], reg + ': the laws on the front');
    assert.deepEqual(outside, [], reg + ': no request left the origin');
    assert.equal(errs.length, 0, errs.join(' | '));
    facts[reg] = d;
    await ctx.close();
  }
  const a = facts.bee;
  // the data layer IS the composer: same subjects, same selection, same sentences, same rules
  assert.deepEqual(a.model.subjects, a.page.subjects); assert.equal(a.model.sel, a.page.sel);
  assert.equal(a.page.options, 4); assert.equal(a.model.sents.length, a.page.sents); assert.equal(a.model.picked, a.page.picked); assert.equal(a.model.rules, a.page.rules);
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model, reg + ' reads the same facts');
  // each register draws them: bee rows, raver tiles/stars/hub/rim, cypherpunk tables and receipt
  assert.equal(a.beeRows.length, 4); assert.match(a.beeRows[0], new RegExp('^bzDiD✓ ' + a.model.subjects[0][1] + ' cited sentences'));
  a.model.subjects.forEach((s, i) => assert.match(a.beeRows[i], new RegExp(s[1] + ' cited sentences')));
  assert.equal(a.beeSents, a.model.sents.length);
  const r = facts.raver; assert.equal(r.stars, a.model.sents.length); assert.equal(r.tiles.length, 4); assert.equal(r.tiles[0], 'bzDiD');
  assert.equal(r.hub, a.model.picked + '/' + a.model.sents.length); assert.equal(r.ears, a.model.rules, 'one rim listener per tone rule');
  const c = facts.cypherpunk; assert.equal(c.cySubj.length, 4); assert.match(c.cySubj[0], /^bzdid 4 selected$/);
  assert.equal(c.cySent, a.model.sents.length); assert.equal(c.cyTone, a.model.rules);
  assert.match(c.receipt, new RegExp('sentences' + a.model.picked + ' of ' + a.model.sents.length + ' in'));
  assert.match(c.receipt, /draftnot composed yet/); assert.match(c.receipt, /postednever · this page has no write path/);
});

test('bee: choose, check, write, copy — every step is the composer\'s own, and nothing posts', async () => {
  const { ctx, p, errs, outside, requests } = await open('bee');
  await p.click('#etBeeSubjects [data-et-subject="1"]');
  assert.equal(await p.$eval('#subject', s => s.selectedIndex), 1, 'the row chose the composer\'s own subject');
  await p.click('#etBeeNext');
  assert.equal(await p.$eval('.et-b-step[data-step="sents"]', e => e.hidden), false);
  assert.equal(await p.$eval('#etBeeWrite', b => b.disabled), true, 'nothing to write before a sentence is chosen');
  await p.click('#etBeeSents .et-b-check >> nth=0');
  assert.equal(await p.$eval('#sents .pick[data-i="0"]', c => c.checked), true, 'the tick is the composer\'s own tick');
  const req0 = requests.length;
  await p.click('#etBeeWrite');
  assert.equal(await p.$eval('#draft', d => getComputedStyle(d).display), 'block', 'the composer wrote the draft');
  assert.equal(await p.$eval('.et-b-step[data-step="ready"]', e => e.hidden), false, '"ready to paste." follows the real draft');
  assert.equal(await p.$eval('#etBeeDraft', e => e.textContent), await p.$eval('#draft', e => e.textContent), 'the bee card shows the composer\'s draft, byte for byte');
  await p.click('#etBeeCopy'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#cp'), /copied/, 'the composer\'s own copy ran');
  assert.match(await p.textContent('#etBeeCopy'), /copied\. now paste it yourself\./);
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), await p.$eval('#draft', e => e.textContent));
  assert.deepEqual(requests.slice(req0), [], 'composing and copying sent nothing');
  // a flagged sentence (entered through the composer's own form) holds the draft until a human decides
  await p.fill('#c-text', 'The registry is the best naming layer ever built.'); await p.fill('#c-label', 'a label'); await p.fill('#c-url', 'https://example.org/x');
  await p.click('text=attach citation & add sentence');
  await p.click('.et-b-step[data-step="ready"] [data-go="sents"]');
  await p.click('#etBeeSents .et-b-check >> nth=-1');
  assert.equal(await p.$eval('#etBeeHold', e => e.hidden), false, 'the advert flag is said in plain words');
  assert.match(await p.textContent('#etBeeSents'), /this may sound like an advert: superlative/);
  await p.click('#etBeeWrite');
  assert.match(await p.textContent('#toneOut'), /unacknowledged flag/, 'the composer refused, as built');
  assert.equal(await p.$eval('.et-b-step[data-step="ready"]', e => e.hidden), true, 'no "ready" over a refusal');
  await p.click('#etBeeSents .et-b-keep');
  await p.click('#etBeeWrite');
  assert.match(await p.$eval('#draft', e => e.textContent), /best naming layer/, 'keep-anyway is the human\'s call, on the record');
  assert.deepEqual(outside, []); assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('raver: a star is a sentence; a short hold does nothing; the full hold weaves the real draft', async () => {
  const { ctx, p, errs, requests } = await open('raver');
  await p.click('#etArt [data-et-star="1"]', { force: true });
  assert.equal(await p.$eval('#sents .pick[data-i="1"]', c => c.checked), false, 'the tap dimmed the composer\'s own sentence');
  assert.equal(await p.$eval('#etArt [data-et-star="1"]', g => g.getAttribute('aria-pressed')), 'false');
  assert.match(await p.textContent('#etRaverHint'), /^3 of 4 lit/);
  assert.equal(await p.$eval('#etWoven', e => e.hidden), true, '"woven" is never drawn before a draft');
  const req0 = requests.length;
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(450); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.$eval('#draft', d => getComputedStyle(d).display), 'none', 'a short hold composes nothing');
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up(); await p.waitForTimeout(300);
  assert.equal(await p.$eval('#draft', d => getComputedStyle(d).display), 'block', 'the full hold ran the composer');
  assert.equal(await p.$eval('#etWoven', e => e.hidden), false);
  const draft = await p.$eval('#draft', e => e.textContent);
  assert.equal((draft.split('\n\nCitations:')[0].match(/\[\d+\] /g) || []).length, 3, 'the dark star stayed out of the draft');
  assert.match(await p.textContent('#etWovenNote'), /^3 stars · 3 sources · every thread a citation · nothing posted$/);
  assert.equal(await p.$eval('#etArt', s => s.classList.contains('woven')), true);
  assert.deepEqual(requests.slice(req0), [], 'weaving sent nothing');
  // light it again: the weave is stale and says so, it never pretends
  await p.click('#etArt [data-et-star="1"]', { force: true });
  assert.equal(await p.$eval('#etWoven', e => e.hidden), true); assert.match(await p.textContent('#etHoldHint'), /the stars changed/);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint; the receipt hash is the draft\'s own', async () => {
  const { ctx, p, errs, requests } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: [...document.querySelectorAll('#etPipe li')].map(l => l.className), now: (document.querySelector('#etPipe li.now b') || {}).textContent, path: document.querySelector('#etCyPath').textContent, kv: document.querySelectorAll('#etReceipt tr').length }));
  assert.equal(d.steps.length, 6); assert.equal(d.kv, 8); assert.equal(d.path, 'bIQ://iq.wiki/suggest/bzdid');
  assert.match(d.now, /^compose/, 'the pipeline points at the first step not yet done');
  assert.match(d.steps[5], /you/, 'the last step is always the human\'s');
  await p.click('#etCySubj tr[data-i="3"]');
  assert.equal(await p.$eval('#subject', s => s.value), 'bnrose');
  for (const i of [0, 1]) await p.click(`#etCySent tr[data-i="${i}"]`);
  const req0 = requests.length;
  await p.click('#etCyCompose'); await p.waitForTimeout(300);
  const draft = await p.$eval('#draft', e => e.textContent);
  assert.match(draft, /^Proposed wiki: bNRoSe\n/);
  const sha = createHash('sha256').update(draft, 'utf8').digest('hex');
  assert.match(txt(await p.textContent('#etReceipt')), new RegExp('draft' + draft.length + ' chars · sha256 ' + sha));
  assert.match(txt(await p.textContent('#etReceipt')), /matches pickyes/);
  assert.equal(await p.$eval('#etCyDraft', e => e.textContent), draft);
  assert.deepEqual(requests.slice(req0), [], 'the instrument composed without a request');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
