// blood-eternal.test.mjs — bGENEaLOGy's three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register; each has its own
// dress, structure and gesture; all three carry the SAME facts (the line walked from the model,
// the living guard, the storage receipt); and no gesture pays or claims "kept" on its own —
// every keep-forever hands off to the page's preservation flow, and "kept" is drawn only when the
// receipt says uploaded. Run: node --test e2e/blood-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8861, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, bound) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  // optional: remember every element that gets a listener of these types (read by the zbData gate)
  if (bound) await ctx.addInitScript(types => {
    const seen = window.__bound = new WeakSet(), add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t, ...a) { if (types.includes(t) && this instanceof Element) seen.add(this); return add.call(this, t, ...a); };
  }, bound);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/blood.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.gens.length && window.__eternal.data.E, null, { timeout: 20000 });
  return { ctx, p, errs };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const RECEIPT = JSON.parse(await readFile(join(ROOT, 'assets/profile-archive/lineage/zblood-storage-economics.json'), 'utf8'));

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
    assert.ok(d.wide <= 391 && d.vw <= 391, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: the line, the guard, the price, the receipt', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const D = window.__eternal.data, t = s => (document.querySelector(s) || {}).textContent || '';
      return {
        gens: D.gens.slice(0, 5).map(g => [g.slots, g.pub, g.living]),
        beeRows: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        mandala: [1, 2, 3, 4, 5].map(g => document.querySelectorAll(`#etMandala .ring[data-g="${g}"] .seg`).length),
        manifest: [...document.querySelectorAll('#etManifest tr.pick')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        living: [...document.querySelectorAll('#eternal [data-et="living"]')].map(e => e.textContent),
        ant: t('#eternal [data-et="antShort"]'), pipe: t('#etPipe'), receipt: t('#etReceipt'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(facts.raver.gens, a.gens); assert.deepEqual(facts.cypherpunk.gens, a.gens);
  // the line as each register draws it: rows, rings and table agree with the model
  assert.equal(a.gens[0][2], 2, 'the parents are living'); assert.match(a.beeRows[0], /kept out while living/);
  assert.deepEqual(a.mandala, [2, 4, 8, 16, 32], 'one ring segment per place');
  a.gens.forEach(([slots, pub], i) => { if (pub) assert.match(a.manifest[i], new RegExp(`${slots}.*published ${pub}`)); });
  // the guard and the price, from the same sources
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.ok(facts[reg].living.every(x => x === '5'), reg + ' living guard');
  const ant = RECEIPT.quotes.autonomi.computed.storageANT;
  assert.equal(a.ant, ant.toFixed(2) + ' ANT');
  assert.match(facts.cypherpunk.pipe, new RegExp(String(ant).replace('.', '\\.') + ' ANT'));
  // the receipt says what is true: nothing purchased, nothing uploaded
  assert.equal(RECEIPT.states.purchased, false); assert.equal(RECEIPT.states.uploaded, false);
  assert.match(facts.cypherpunk.receipt, /paid\s*not yet/); assert.match(facts.cypherpunk.receipt, /address\s*not yet/);
});

test('bee: consent before the one action; the action hands off, it never pays', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('.et-b [data-go="keep"]');
  assert.equal(await p.$eval('#etBeePay', b => b.disabled), true, 'no pay before consent');
  await p.check('#etBeeOk');
  assert.equal(await p.$eval('#etBeePay', b => b.disabled), false);
  await p.click('#etBeePay'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), false, 'the real preservation flow opens');
  assert.equal(await p.$eval('.et-b-step[data-step="kept"]', e => e.hidden), true, '"kept." is never claimed by a tap');
  assert.equal(await p.$eval('.et-b-step[data-step="asked"]', e => e.hidden), false);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: light all four, then the hold is the consent — a short hold does nothing', async () => {
  const { ctx, p, errs } = await open('raver');
  await p.click('.ring[data-g="3"] .seg');
  assert.match(await p.textContent('#etRaverCard'), /ring 3 · great · 8 of 8 found/);
  await p.click('.you');
  assert.equal(await p.$eval('#etHold', b => b.disabled), true, 'no hold before the four terms');
  for (const t of [1, 2, 3]) await p.click(`#etTiles button[data-t="${t}"]`);
  assert.match(await p.textContent('#etSealHint'), /3 of 4 lit/);
  await p.click('#etTiles button[data-t="4"]');
  assert.equal(await p.$eval('#etHold', b => b.disabled), false);
  await p.locator('#etHold').scrollIntoViewIfNeeded();
  const bx = await p.locator('#etHold').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'seal', 'a short hold does not seal');
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), true);
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__eternal.raver.mode), 'asked');
  assert.equal(await p.$eval('#preservepanel', e => e.hidden), false, 'the full hold opens the real flow');
  assert.notEqual(await p.textContent('#etRaverTitle'), 'kept', '"kept" is never claimed by a gesture');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: the instrument is complete at first paint and verifiable', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({
    rows: document.querySelectorAll('#etManifest tr.pick').length, steps: document.querySelectorAll('#etPipe li').length,
    now: (document.querySelector('#etPipe li.now b') || {}).textContent, receipt: document.querySelectorAll('#etReceipt tr').length,
    path: document.querySelector('#eternal [data-et="bdata"]').textContent,
  }));
  assert.equal(d.rows, 7); assert.equal(d.steps, 6); assert.equal(d.receipt, 7);
  assert.match(d.now, /settle/, 'the pipeline points at the first step not yet done');
  assert.match(d.path, /^bData:\/\/genealogy\/[0-9a-f]{6,}/);
  await p.click('.et-c-tab tr.pick[data-g="4"]');
  assert.equal(await p.$eval('.et-c-tab tr.names[data-g="4"]', e => e.hidden), false, 'a generation opens to its people');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform === 'uppercase') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own)) out.push('dash ' + el.className);
        if (/^(BUTTON|A)$/.test(el.tagName) && el.getBoundingClientRect().height && el.getBoundingClientRect().height < 44) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});

/* zbData: the private branch is declared with its governed reason, and nothing in it can be operated.
   The condition as cut in CORE (7b7d9a63), repaired for arm 13 (8f60093c .. 1ae9793c) and for the #245
   reviewer attack (a9bc9692 .. 555a255c):
   - instrument: a plain DOM query inside page.evaluate, never Playwright actionability. The register switch
     hides whole fronts, and an actionability count cannot tell "hidden by register" from "no control here".
     So the absence gate runs in all three registers and must give the same answer in each.
   - the needle: the declaration is FOUND by a literal held in this file (ZB_NEEDLE), so a docs edit can never
     blind it. Conformance to docs/CONTRACT.md:12 is a separate named test whose derivation asserts itself.
   - region B': the direct child of the cypherpunk front that holds the declaration. It never reads #etCySign
     to find its bound (a landmark used to locate lets the landmark move the region); #etCySign is used only
     to ASSERT (tight). If that child is the declaration itself, no block wraps it and the gate REFUSES in
     that sentence, never in a false one. This replaces carriers[0].parentElement (the A6 false green).
   - inventory: every operable element of the front, THE ROOT INCLUDED (a handler delegated on .et-c shows
     as the root's own row), pinned and compared as a COUNTED multiset, name -> count (ZB_PIN). It needs no
     region, so no locator hole can hide a new control (F1, F2), and counting sees a reused name (G1) or a
     second row under a pinned name (G2) that a set of names cannot. The label is `tag#id [why]`, classes
     never: a class in the label would red on every CSS rename of a front control (the D2 false red B'
     was chosen to avoid). The `span [cursor]` pin is the span.et-sr that sits in the fork anchor
     (a.et-c-ghost, target=_blank), measured at ab4db03a.
     Region and inventory are blind in opposite directions: the inventory cannot see a pinned control MOVED
     in (D1) or a swap of equals (G3); the region cannot see a control beside a declaration with no box
     (F2). Both are required.
   - the definition is this file's why(), nobody else's. e2e/skaists-conformance.mjs press() is narrower on
     this front today (no cursor arm), and the two sets cross the day a <label> reaches the front (press()
     matches LABEL, why() does not; the page carries labels outside the front already). footer-audit
     speaks for itself.
   - ZB_PIN is a HARD-CODED LITERAL of 4 entries (root slot empty today) and must never be derived at run
     time: a walk that caught its own error would return [] on both sides and the gate would be its own
     witness. The non-zero literal is what makes an empty or partial inventory red (non-vacuity).
   - ZB_UNPINNED is load-bearing: at ab4db03a it removes 42 of the 46 elements why() sees on this front
     (the manifest table's rows; 35 of the 42 are seen only by why(), 7 also by press()). Tidy that
     selector and they all become pins in one stroke; the gate prints the live count.
   - NOT COVERED, by ruling (G5): a control's LABEL TEXT. A pinned control relabelled in place outside the
     branch keeps its signature, and neither half reads text; closing it means pinning label text against
     the corpus, which is a ruled choice, not a quiet addition. The G5 test below keeps the gap executable.
     Also not covered: a handler delegated from document onto an element with no tag, tabindex, listener
     or pointer cursor. Costs: every new front control is a ZB_PIN edit.
   - non-vacuity: #etCySign must be UNIQUE before it is used (a control selected by a non-unique key can be
     captured by the thing it controls for, G1); then, read by the same function in the same evaluate, it
     must be operable by tag AND by recorded listener; every arm test first runs the gate green.
   - every clause that fails is reported, each in a sentence that is true of the page and names the file
     the next seat must open.
   Coupling cost, named: relabelling zbData in docs/CONTRACT.md:12 moves the contract, this page's
   declaration, and 87 corpus strings across 3 keys (flow.r.state.in, flow.p.boundary.cy, flow.p.state.rav;
   29 entries each, every one carrying the token; measured at bdd34ed9). On that day the conformance test
   goes red and says so; the absence test does not move. */
const ZB_DEF = 'private encrypted bytes';   // docs/CONTRACT.md:12, held literally
const ZB_NEEDLE = 'zbData = ' + ZB_DEF;
const ZB_COST = 'a zbData relabel moves docs/CONTRACT.md:12, surfaces/blood.html and 87 corpus strings across 3 keys (flow.r.state.in, flow.p.boundary.cy, flow.p.state.rav)';
// the cypherpunk front's operable inventory at ab4db03a, identical in all three registers: name -> count
// a literal, never derived at run time (see above)
const ZB_PIN = { 'a [tag,cursor]': 2, 'button#etCySign [tag,listener,cursor]': 1, 'span [cursor]': 1 };   // span = span.et-sr in the fork anchor
const ZB_UNPINNED = '.et-c-tab, .et-c-chips, .et-c-guard';   // data-driven rows, excluded by selector
function deriveZb(text) {
  // every refusal names docs/CONTRACT.md: the seat that trips it is editing the contract, not the page
  if (typeof text !== 'string') return { ok: false, why: 'docs/CONTRACT.md is missing or unreadable' };
  const line = text.split('\n').map(l => l.trim()).find(l => /^\*\*zbData\*\*/.test(l));
  if (!line) return { ok: false, why: 'docs/CONTRACT.md has no "**zbData** = ..." definition line' };
  const def = (line.match(/^\*\*zbData\*\*\s*=\s*([^(]*)/) || [, ''])[1].trim().replace(/\.$/, '').trim();
  if (!def) return { ok: false, why: 'docs/CONTRACT.md defines zbData as an empty string' };
  if (def.length < 12) return { ok: false, why: 'docs/CONTRACT.md defines zbData as a stub ("' + def + '", under 12 characters)' };
  return { ok: true, def };   // any other wording is a definition; if it differs it is a RELABEL (test 8)
}
let CONTRACT = null;
try { CONTRACT = await readFile(join(ROOT, 'docs/CONTRACT.md'), 'utf8'); } catch {}
const BOUND = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'keypress', 'change', 'input', 'submit', 'contextmenu'];

// the gate, one in-page function: region B' + counted inventory. Returns every failed clause as a sentence.
function zbGate([needle, pin, unpinned, onScreen]) {
  const norm = s => s.replace(/\s+/g, ' ').trim(), bound = window.__bound;
  if (!bound) return { hook: false };
  // ONE instrument for the region, the inventory and the control: why is this element operable?
  const why = el => {
    const w = [];
    if (el.matches('button,input,select,textarea,summary,a[href]:not([href="#"]),[role=button],[role=link],[role=checkbox],[role=switch],[role=menuitem],[contenteditable=""],[contenteditable="true"],[onclick],[data-go]')) w.push('tag');
    if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') w.push('tabindex');
    if (bound.has(el) || typeof el.onclick === 'function') w.push('listener');
    if (getComputedStyle(el).cursor === 'pointer') w.push('cursor');
    return w;
  };
  const operable = root => [root, ...root.querySelectorAll('*')].map(el => ({ el, w: why(el) })).filter(x => x.w.length);
  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
  const front = document.querySelector('#eternal>.et-c');
  // the inventory label: tag#id [why], never classes (ruled, 7872c439)
  const name = x => x.el.tagName.toLowerCase() + (x.el.id ? '#' + x.el.id : '') + ' [' + x.w + ']';
  // the control must be unique before it is used: a duplicate id earlier in the page would be measured instead
  const signs = document.querySelectorAll('[id="etCySign"]'), sign = signs.length === 1 ? signs[0] : null;
  const bad = [];
  if (signs.length > 1) bad.push('surfaces/blood.html: #etCySign is not unique (' + signs.length + ' elements carry id="etCySign"); the non-vacuity control could be captured by what it controls for, so the gate refuses to use it');
  const ctl = sign ? why(sign) : null;
  // 1. inventory: the whole front, COUNTED (name -> count), never deduplicated to a set of names
  const inv = {}; let excluded = 0, census = 0;
  for (const x of operable(front)) { census++; if (x.el.closest(unpinned)) { excluded++; continue; } const k = name(x); inv[k] = (inv[k] || 0) + 1; }
  const keys = [...new Set([...Object.keys(pin), ...Object.keys(inv)])].sort();
  const drift = keys.filter(k => (inv[k] || 0) !== (pin[k] || 0)).map(k => k + ': ' + (inv[k] || 0) + ' ≠ ' + (pin[k] || 0));
  if (drift.length) bad.push('surfaces/blood.html: the front\'s operable inventory moved: ' + drift.join('; ') +
    ' (counted multiset, root included, by e2e/blood-eternal.test.mjs why(); skaists-conformance press() is narrower on this front today: no cursor arm, and it matches <label>, which why() does not; ' +
    'ZB_UNPINNED removes ' + excluded + ' of the ' + census + ' elements why() sees). If the change is intended, re-pin ZB_PIN in e2e/blood-eternal.test.mjs.');
  const setSame = Object.keys(inv).sort().join('|') === Object.keys(pin).sort().join('|');
  // 2. region B': the direct child of the front that holds the declaration
  const carriers = [...front.querySelectorAll('*')].filter(el => norm(el.textContent).includes(needle) &&
    ![...el.children].some(c => norm(c.textContent).includes(needle)));
  let region = null, inside = null;
  if (carriers.length !== 1) bad.push('surfaces/blood.html: exactly one element on the cypherpunk front carries "' + needle + '", found ' + carriers.length);
  else {
    region = carriers[0];
    while (region.parentElement !== front) region = region.parentElement;
    if (region === carriers[0]) {
      bad.push('REFUSED: the region resolved to the carrier itself (' + label(region) + ') - surfaces/blood.html has no block wrapping the zbData declaration');
      region = null;
    } else {
      const where = ' (region ' + label(region) + ')', text = norm(region.textContent), box = region.getBoundingClientRect();
      if (sign && region.contains(sign)) bad.push('surfaces/blood.html: the private branch is not a tight block: it contains #etCySign' + where);
      if (!/not wired yet/.test(text)) bad.push('surfaces/blood.html: the private branch does not say "not wired yet"' + where);
      if (!/reason: \S.{20,}/.test(text)) bad.push('surfaces/blood.html: the private branch gives no "reason:" clause' + where);
      inside = operable(region).map(name);
      if (inside.length) bad.push('surfaces/blood.html: something in the private branch can be operated: ' + JSON.stringify(inside) + where);
      if (onScreen && !(box.width > 0 && box.height > 0 && getComputedStyle(front).display !== 'none' && getComputedStyle(region).visibility === 'visible'))
        bad.push('surfaces/blood.html: the declaration is not on screen in cypherpunk' + where);
      region = label(region);
    }
  }
  return { hook: true, ctl, bad, inv, setSame, region, inside, excluded };
}
const gateArgs = reg => [ZB_NEEDLE, ZB_PIN, ZB_UNPINNED, reg === 'cypherpunk'];

test('zbData: the private branch is declared with its reason, and nothing in it can be operated', async () => {
  assert.ok(ZB_NEEDLE.length > 'zbData = '.length + 11, 'the locator literal is not a stub');
  for (const reg of ['cypherpunk', 'bee', 'raver']) {
    const { ctx, p, errs } = await open(reg, BOUND);
    const r = await p.evaluate(zbGate, gateArgs(reg));
    assert.ok(r.hook, reg + ': e2e/blood-eternal.test.mjs: the listener record is installed');
    // non-vacuity first: the same instrument, in the same run, sees the live control, and the listener arm
    // must fire on its own (the tag arm is guaranteed on a <button> and cannot witness it)
    assert.ok(r.ctl, reg + ': surfaces/blood.html: exactly one #etCySign exists | ' + r.bad.join(' | '));
    assert.ok(r.ctl.includes('tag') && r.ctl.includes('listener'), reg + ': surfaces/blood.html #etCySign, or the listener record in e2e/blood-eternal.test.mjs: the instrument sees #etCySign by tag and by listener, got ' + JSON.stringify(r.ctl));
    assert.deepEqual(r.bad, [], reg + ': ' + r.bad.join(' | '));
    assert.equal(r.region, 'div.et-c-branch', reg + ': surfaces/blood.html: the region is the dashed private-branch block');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('zbData: the page names the noun exactly as docs/CONTRACT.md:12 defines it', async () => {
  const d = deriveZb(CONTRACT);
  assert.ok(d.ok, 'REFUSED, not a page fault: ' + d.why + '. Fix docs/CONTRACT.md:12.');
  const kept = /private/i.test(d.def) && /encrypt/i.test(d.def);
  assert.equal(d.def, ZB_DEF, 'docs/CONTRACT.md:12 relabels zbData as "' + d.def + '"' + (kept ? '' : ', dropping the private + encrypted meaning') + '; this gate holds "' + ZB_DEF + '". Relabel coupling cost: ' + ZB_COST + '.');
  const { ctx, p, errs } = await open('cypherpunk');
  const front = await p.evaluate(() => document.querySelector('#eternal>.et-c').textContent.replace(/\s+/g, ' '));
  assert.ok(front.includes('zbData = ' + d.def + ' (docs/CONTRACT.md)'), 'surfaces/blood.html: the cypherpunk front cites "zbData = ' + d.def + ' (docs/CONTRACT.md)"');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

/* The reviewer arms (#245: a9bc9692, 6e5d0ab8, f7b7994e, 52ffb62f, 6331e724, dec8cec8, 555a255c), planted
   in-page so blood.html is never edited. Each arm first runs the gate green on the pristine page, then plants,
   then must see the gate go red IN THE NAMED SENTENCE. `blind` says which half cannot see the arm, and the
   test asserts that half stays silent: the other half is what catches it, so neither half is redundant.
   None may produce the A4 false reason ("not wired yet" missing when the page still says it). */
const EVIL = `const b = document.createElement('button'); b.type = 'button'; b.className = 'et-c-primary'; b.id = 'zbEvil'; b.textContent = 'export the private branch';`;
const INNER = `const br = document.querySelector('.et-c-branch'), inner = document.createElement('div'); inner.className = 'zb-inner'; inner.append(...br.childNodes);`;
const ZB_ARMS = [
  { arm: 'A6', what: 'inner wrapper around the declaration, operable button as its sibling inside the box',
    plant: `${INNER} br.append(inner); ${EVIL} br.append(b);`,
    want: [/something in the private branch can be operated: .*button#zbEvil/, /inventory moved.*button#zbEvil \[tag,cursor\]: 1 ≠ 0/] },
  { arm: 'F1', what: 'the box flattened away, declaration loose in the front, button beside it',
    plant: `const br = document.querySelector('.et-c-branch'); ${EVIL} br.after(b); br.replaceWith(...br.childNodes);`,
    want: [/REFUSED: the region resolved to the carrier itself .* no block wrapping the zbData declaration/, /inventory moved.*button#zbEvil \[tag,cursor\]: 1 ≠ 0/] },
  { arm: 'F2', what: 'the box deleted, an inner wrapper kept, button beside it',
    plant: `${INNER} br.replaceWith(inner); ${EVIL} inner.after(b);`,
    want: [/inventory moved.*button#zbEvil \[tag,cursor\]: 1 ≠ 0/], blind: 'region' },
  { arm: 'D1', what: 'a named control (#etCySign) moved into the box',
    plant: `document.querySelector('.et-c-branch').append(document.getElementById('etCySign'));`,
    want: [/not a tight block: it contains #etCySign/, /something in the private branch can be operated: .*button#etCySign/], blind: 'inventory' },
  { arm: 'G1', what: 'a second real button reusing the pinned name #etCySign, inside the box',
    plant: `${EVIL} b.id = 'etCySign'; b.addEventListener('click', () => {}); document.querySelector('.et-c-branch').append(b);`,
    want: [/inventory moved.*button#etCySign \[tag,listener,cursor\]: 2 ≠ 1/, /#etCySign is not unique \(2 elements/, /something in the private branch can be operated: .*button#etCySign/], setBlind: true },
  { arm: 'G1-F2', what: 'the reused name beside a box-less declaration: only the count can see it',
    plant: `${INNER} br.replaceWith(inner); ${EVIL} b.id = 'etCySign'; b.addEventListener('click', () => {}); inner.after(b);`,
    want: [/inventory moved.*button#etCySign \[tag,listener,cursor\]: 2 ≠ 1/, /#etCySign is not unique \(2 elements/], blind: 'region', setBlind: true },
  { arm: 'G2', what: 'a cursor-only span, handler delegated from document, inside the box',
    plant: `const s = document.createElement('span'); s.className = 'zb-evil'; s.style.cursor = 'pointer'; s.textContent = 'export'; document.querySelector('.et-c-branch').append(s); document.addEventListener('click', e => e.target.closest('.zb-evil'));`,
    want: [/inventory moved.*span \[cursor\]: 2 ≠ 1/, /something in the private branch can be operated: .*span \[cursor\]/], setBlind: true },
  { arm: 'G2-F2', what: 'the delegated cursor span beside a box-less declaration: only the count can see it',
    plant: `${INNER} br.replaceWith(inner); const s = document.createElement('span'); s.className = 'zb-evil'; s.style.cursor = 'pointer'; s.textContent = 'export'; inner.after(s); document.addEventListener('click', e => e.target.closest('.zb-evil'));`,
    want: [/inventory moved.*span \[cursor\]: 2 ≠ 1/], blind: 'region', setBlind: true },
  { arm: 'G2-root', what: 'the cursor span in the box with its handler delegated on the front itself: the root is in the inventory',
    plant: `const s = document.createElement('span'); s.className = 'zb-evil'; s.style.cursor = 'pointer'; s.textContent = 'export'; document.querySelector('.et-c-branch').append(s); document.querySelector('#eternal>.et-c').addEventListener('click', e => e.target.closest('.zb-evil'));`,
    want: [/inventory moved.*div \[listener\]: 1 ≠ 0/, /something in the private branch can be operated/] },
  { arm: 'G3', what: 'a swap of equals: one pinned link removed from the front, a same-shaped link added in the box',
    plant: `const v = document.querySelector('.et-c-row a[download]'); if (v.querySelector('*')) throw new Error('G3 victim has an operable descendant'); const a = document.createElement('a'); a.href = v.getAttribute('href'); a.textContent = 'export the private branch'; v.remove(); document.querySelector('.et-c-branch').append(a);`,
    want: [/something in the private branch can be operated: .*a \[tag,cursor\]/], blind: 'inventory', setBlind: true },
];
test('zbData: NOT covered, by ruling (G5): a pinned control relabelled in place outside the branch stays green, label text is not guarded', async () => {
  const { ctx, p, errs } = await open('cypherpunk', BOUND);
  assert.deepEqual((await p.evaluate(zbGate, gateArgs('cypherpunk'))).bad, [], 'G5: the gate is green on the pristine page first');
  await p.evaluate(`document.querySelector('.et-c-row a[download]').textContent = 'export the private branch';`);
  const r = await p.evaluate(zbGate, gateArgs('cypherpunk'));
  // if this ever goes red, label text has become guarded: rule it, then move G5 into ZB_ARMS
  assert.deepEqual(r.bad, [], 'G5 is a ruled gap: neither half reads a control\'s text; the gate said ' + JSON.stringify(r.bad));
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
for (const a of ZB_ARMS) test('zbData arm ' + a.arm + ': ' + a.what, async () => {
  const { ctx, p, errs } = await open('cypherpunk', BOUND);
  const r0 = await p.evaluate(zbGate, gateArgs('cypherpunk'));
  assert.deepEqual(r0.bad, [], a.arm + ': the gate is green on the pristine page first');
  await p.evaluate(a.plant);
  const r = await p.evaluate(zbGate, gateArgs('cypherpunk'));
  const said = ' | the gate said: ' + JSON.stringify(r.bad);
  for (const re of a.want) assert.ok(r.bad.some(s => re.test(s)), a.arm + ': red in the named sentence ' + re + said);
  const unnamed = r.bad.filter(s => !/surfaces\/blood\.html|e2e\/blood-eternal\.test\.mjs|docs\/CONTRACT\.md/.test(s));
  assert.deepEqual(unnamed, [], a.arm + ': every failure sentence names the file the next seat must open' + said);
  assert.ok(!r.bad.some(s => /not wired yet|no "reason:"/.test(s)), a.arm + ': no false reason (the page still carries the declaration)' + said);
  if (a.blind === 'region') assert.ok(!r.bad.some(s => /private branch|REFUSED|exactly one element/.test(s)), a.arm + ': the region half is blind here by construction, the inventory is what catches it' + said);
  if (a.blind === 'inventory') assert.ok(r.inv && !r.bad.some(s => /inventory moved/.test(s)), a.arm + ': the inventory half is blind here by construction (the tally is preserved), the region is what catches it' + said);
  assert.ok(r.inv, a.arm + ': the gate computes a counted inventory' + said);
  if (a.setBlind) assert.equal(r.setSame, true, a.arm + ': a set of names would not see this arm; the comparison must be counted' + said);
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
