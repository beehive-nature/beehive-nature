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
   The condition as cut in CORE (7b7d9a63), repaired for arm 13 (8f60093c, e608744d, 4c3dbb2d, 1ae9793c):
   - instrument: a plain DOM query inside page.evaluate, never Playwright actionability. The register switch
     hides whole fronts, and an actionability count cannot tell "hidden by register" from "no control here".
     So the absence gate runs in all three registers and must give the same answer in each.
   - shape 2: the absence region is LOCATED by a literal held in this file (ZB_NEEDLE), so a docs edit can
     never blind it. Conformance to docs/CONTRACT.md:12 is a separate named test. The derivation from
     CONTRACT.md asserts its own output before it is used: missing, empty or stub -> the test refuses in a
     sentence that blames docs/CONTRACT.md, never the page.
   - non-vacuity: #etCySign, counted by the same function in the same evaluate, must read operable by tag
     AND by recorded listener. A broken selector or a dead listener record then goes red, never green.
   Coupling cost, named: relabelling zbData in docs/CONTRACT.md:12 moves the contract, this page's
   declaration, and 87 corpus strings across 3 keys (flow.r.state.in, flow.p.boundary.cy, flow.p.state.rav;
   29 entries each, every one carrying the token; measured at bdd34ed9). On that day the conformance test
   goes red and says so; the absence test does not move. */
const ZB_DEF = 'private encrypted bytes';   // docs/CONTRACT.md:12 at bdd34ed9, held literally
const ZB_NEEDLE = 'zbData = ' + ZB_DEF;
const ZB_COST = 'a zbData relabel moves docs/CONTRACT.md:12, surfaces/blood.html and 87 corpus strings across 3 keys (flow.r.state.in, flow.p.boundary.cy, flow.p.state.rav)';
function deriveZb(text) {
  // every refusal names docs/CONTRACT.md: the seat that trips it is editing the contract, not the page
  if (typeof text !== 'string') return { ok: false, why: 'docs/CONTRACT.md is missing or unreadable' };
  const line = text.split('\n').map(l => l.trim()).find(l => /^\*\*zbData\*\*/.test(l));
  if (!line) return { ok: false, why: 'docs/CONTRACT.md has no "**zbData** = ..." definition line' };
  const def = (line.match(/^\*\*zbData\*\*\s*=\s*([^(]*)/) || [, ''])[1].trim().replace(/\.$/, '').trim();
  if (!def) return { ok: false, why: 'docs/CONTRACT.md defines zbData as an empty string' };
  if (def.length < 12 || !/private/i.test(def) || !/encrypt/i.test(def))
    return { ok: false, why: 'docs/CONTRACT.md defines zbData as a stub ("' + def + '"): under 12 characters, or without the private + encrypted meaning' };
  return { ok: true, def };
}
let CONTRACT = null;
try { CONTRACT = await readFile(join(ROOT, 'docs/CONTRACT.md'), 'utf8'); } catch {}
const BOUND = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'keypress', 'change', 'input', 'submit', 'contextmenu'];

test('zbData: the private branch is declared with its reason, and nothing in it can be operated', async () => {
  assert.ok(ZB_NEEDLE.length > 'zbData = '.length + 11, 'the locator literal is not a stub');
  for (const reg of ['cypherpunk', 'bee', 'raver']) {
    const { ctx, p, errs } = await open(reg, BOUND);
    const r = await p.evaluate(reason => {
      const norm = s => s.replace(/\s+/g, ' ').trim(), bound = window.__bound;
      if (!bound) return { hook: false };
      // ONE instrument for the region and the control: why is this element operable?
      const why = el => {
        const w = [];
        if (el.matches('button,input,select,textarea,summary,a[href]:not([href="#"]),[role=button],[role=link],[role=checkbox],[role=switch],[role=menuitem],[contenteditable=""],[contenteditable="true"],[onclick],[data-go]')) w.push('tag');
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') w.push('tabindex');
        if (bound.has(el) || typeof el.onclick === 'function') w.push('listener');
        if (getComputedStyle(el).cursor === 'pointer') w.push('cursor');
        return w;
      };
      const operable = root => [root, ...root.querySelectorAll('*')].map(el => ({ el, w: why(el) })).filter(x => x.w.length);
      const name = x => x.el.tagName.toLowerCase() + (x.el.id ? '#' + x.el.id : '') + ' [' + x.w + ']';
      const front = document.querySelector('#eternal>.et-c'), sign = document.getElementById('etCySign');
      const ctl = sign ? operable(sign).filter(x => x.el === sign).map(x => x.w)[0] || [] : null;
      const carriers = [...front.querySelectorAll('*')].filter(el => norm(el.textContent).includes(reason) &&
        ![...el.children].some(c => norm(c.textContent).includes(reason)));
      if (carriers.length !== 1) return { hook: true, ctl, carriers: carriers.length };
      const region = carriers[0].parentElement, box = region.getBoundingClientRect();
      return {
        hook: true, ctl, carriers: 1, text: norm(region.textContent), inside: operable(region).map(name),
        tight: region !== front && front.contains(region) && !(sign && region.contains(sign)),
        laid: box.width > 0 && box.height > 0 && getComputedStyle(front).display !== 'none' && getComputedStyle(region).visibility === 'visible',
      };
    }, ZB_NEEDLE);
    assert.ok(r.hook, reg + ': the listener record is installed');
    // non-vacuity first: the same instrument, in the same run, sees the live control, and the listener arm
    // must fire on its own (the tag arm is guaranteed on a <button> and cannot witness it)
    assert.ok(r.ctl, reg + ': #etCySign exists');
    assert.ok(r.ctl.includes('tag') && r.ctl.includes('listener'), reg + ': the instrument sees #etCySign by tag and by listener, got ' + JSON.stringify(r.ctl));
    // the region is where the reason is, and nowhere else
    assert.equal(r.carriers, 1, reg + ': surfaces/blood.html: exactly one block on the cypherpunk front carries "' + ZB_NEEDLE + '"');
    assert.ok(r.tight, reg + ': the region is a tight block, not the front and not around #etCySign');
    assert.match(r.text, /not wired yet/, reg + ': the branch says it is not wired');
    assert.match(r.text, /reason: \S.{20,}/, reg + ': and says why');
    assert.deepEqual(r.inside, [], reg + ': nothing in the private branch can be operated');
    if (reg === 'cypherpunk') assert.ok(r.laid, 'cypherpunk: the declaration is on screen');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('zbData: the page names the noun exactly as docs/CONTRACT.md:12 defines it', async () => {
  const d = deriveZb(CONTRACT);
  assert.ok(d.ok, 'REFUSED, not a page fault: ' + d.why + '. Fix docs/CONTRACT.md:12.');
  assert.equal(d.def, ZB_DEF, 'docs/CONTRACT.md:12 now defines zbData as "' + d.def + '", this gate holds "' + ZB_DEF + '". Coupling cost: ' + ZB_COST + '.');
  const { ctx, p, errs } = await open('cypherpunk');
  const front = await p.evaluate(() => document.querySelector('#eternal>.et-c').textContent.replace(/\s+/g, ' '));
  assert.ok(front.includes('zbData = ' + d.def + ' (docs/CONTRACT.md)'), 'surfaces/blood.html: the cypherpunk front cites "zbData = ' + d.def + ' (docs/CONTRACT.md)"');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
