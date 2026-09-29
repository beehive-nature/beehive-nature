// myspace-stranger.mjs — CAN A STRANGER FINISH MY SPACE WITHOUT LEARNING THE STORAGE ARCHITECTURE?
//
// A scripted stranger, one per register, who knows nothing about adapters, rails or
// schemes. It reads only the words the page shows, chooses a purpose by plain-language
// intent, stores a file, then tries to remove it and to get it back. It measures what
// a machine can measure and labels the rest as proxies:
//
//   CHOICE      wrong-storage-choice rate: for each intent ("just for now", "keep it on
//               this phone", "share it", "keep it forever") which purpose control the
//               visible words led it to, against the purpose the intent means. A control
//               that shows no words of its own (raver's rings) is learned the way a
//               visitor learns it: by tapping it and reading the card that answers. Those
//               taps are counted and the number of controls readable WITHOUT a tap is
//               reported.
//   FIRST FILE  steps (presses) and milliseconds from page open to the first stored row.
//   TERMS       whether the readers / lifetime / payer sentence is visible ON the control
//               (or on its card after the tap) before the choice is made — the proxy for
//               "temporary vs forever is stated before you commit", not a measure of
//               whether a person understood it.
//   REMOVE      whether a visible remove control exists on the stored row, what the
//               confirmation sentence says, whether removal completes, whether the
//               outcome is stated on screen afterwards, and whether finality is stated
//               BEFORE the confirm (on the sentence) and after (on the outcome), judged
//               separately with the matching word printed. Every cross-origin request
//               during and just after the remove is logged.
//   RECOVER     whether any visible control offers to undo or bring a removed file back.
//   LEAKAGE     count of implementation words (adapter, rail, worker, indexeddb, aes,
//               schnorr, blossom, ant, autonomi, nostr, relay, datamap, chunk, digest,
//               sha, signer, wallet, gas, token, scheme, predicate, ciphertext, keyref,
//               pubkey), whole words only, in the register's own front and in the shared
//               archive below it (visible text only). cypherpunk is expected to say them —
//               that is its voice — so its count is reported as declared, not as leakage.
//   FUNDING     whether the visible words, anywhere the visitor can read them (front
//               outside the controls, the controls, the shared archive), say they pay
//               from their own wallet for the forever purpose (the known wording mismatch
//               with the sponsored model), where they say it, and what the rail itself
//               declares as payer.
//
// What it cannot measure and does not claim: task completion rate with real strangers,
// and comprehension of temporary vs forever. Those stay human.
//
//   node myspace-stranger.mjs [--json out.json] [--reg bee,raver,cypherpunk]
//   PW_CHROMIUM_PATH=/path/to/chrome for a box without a playwright-managed browser.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveTree } from './lib/serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const USAGE = 'usage: node myspace-stranger.mjs [--json out.json] [--reg bee,raver,cypherpunk]';
// a flag given without a value is a mistake, not a request for the default
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); if (i < 0) return d; const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) { process.stderr.write(`--${k} needs a value\n${USAGE}\n`); process.exit(2); } return v; };

/* where each register keeps its front, its purpose controls, its add control, and (if the
   controls carry no words of their own) the card that answers a tap */
const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const ADD = { bee: '#etBeeAdd', raver: '#etRaverAdd', cypherpunk: '#etCyAdd' };
const CONTROLS = {
  bee: '.et-b-row[data-et-purpose]',
  raver: '#etOrbits .orbit[data-et-purpose]',
  cypherpunk: '#etPurposes tr.pick[data-et-purpose]',
};
const CARD = { bee: null, raver: '#etRaverCard', cypherpunk: null };

const REGS = arg('reg', 'bee,raver,cypherpunk').split(',').map(s => s.trim()).filter(Boolean);
const unknown = REGS.filter(r => !FRONT[r]);
if (!REGS.length || unknown.length) { process.stderr.write(`--reg: unknown register(s) ${unknown.join(', ') || '(none given)'}; known: ${Object.keys(FRONT).join(', ')}\n`); process.exit(2); }
const OUT = arg('json', '');
const REVISION = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const VIEW = { width: 390, height: 844 };

const { base, close: closeServer } = await serveTree(ROOT);
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

/* the stranger's vocabulary: plain words an intent is made of, and the words that mean a DIFFERENT intent */
const INTENTS = [
  { id: 'now', ask: 'keep this just for now', words: ['now', 'tab', 'session', 'temporary', 'gone', 'closes'] },
  { id: 'keep', ask: 'keep it on this phone', words: ['keep', 'here', 'phone', 'device', 'stays', 'retained'] },
  { id: 'share', ask: 'share it with people', words: ['share', 'show', 'link', 'world', 'published', 'readable'] },
  { id: 'forever', ask: 'keep it forever', words: ['forever', 'permanent', 'lasts', 'everyone', 'record'] },
];
const STRONG = { now: ['now', 'session', 'tab'], keep: ['phone', 'device', 'here'], share: ['share', 'show', 'link'], forever: ['forever', 'permanent'] };
// whole words only: "know" is not "now", "anywhere" is not "here", "table" is not "tab"
const hasWord = (t, k) => new RegExp('\\b' + k + '\\b', 'i').test(t);
function pickByWords(intent, options) {
  // options: [{purpose, text, disabled}] — score each usable control's words against the intent.
  // A choice is only a choice when exactly one control leads: a zero score or a tie is
  // reported as "the words led nowhere", never as the first control in the DOM. A disabled
  // control, or one whose words the instrument could not read, is not a choice at all.
  const scored = options.filter(o => !o.disabled && o.text).map(o => {
    const t = o.text.toLowerCase();
    let score = 0;
    for (const k of intent.words) if (hasWord(t, k)) score += 2;
    for (const [other, ks] of Object.entries(STRONG)) if (other !== intent.id) for (const k of ks) if (hasWord(t, k)) score -= 1;
    return { ...o, score };
  });
  if (!scored.length) return { none: true, score: null, tied: null };
  const top = Math.max(...scored.map(s => s.score));
  const leaders = scored.filter(s => s.score === top);
  if (top <= 0 || leaders.length > 1) return { none: true, score: top, tied: leaders.length > 1 ? leaders.map(l => l.purpose) : null };
  return leaders[0];
}
// implementation vocabulary, counted as whole words (singular or plural): "trail" is not "rail", "gasp" is not "gas".
// The four rail names the page can print (temp, local, blossom, ant) are all in, so the count does not depend on
// which rail a row happened to land on; so are the networks it names (autonomi, arbitrum). Some of these are also
// plain English (local, temp, token, scheme, gas): they are counted wherever they appear, and the receipts print
// every word with its count so a reader can see whether a hit is a rail name or ordinary prose. On this page today
// they appear only as rail and network names.
const LEAK = ['adapter', 'rail', 'worker', 'indexeddb', 'aes', 'schnorr', 'temp', 'local', 'blossom', 'ant', 'nostr', 'relay', 'datamap', 'chunk', 'digest', 'sha-?\\d*', 'signer', 'wallet', 'gas', 'token', 'scheme', 'predicate', 'ciphertext', 'keyref', 'pubkey'];
// …plus whatever rail schemes and networks the page declares at run time (autonomi, arbitrum-one, skaists.buzz today),
// each as one whole phrase, so a fifth rail is counted the day it attaches and a phrase is never counted twice
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countLeak = (text, extra = []) => {
  const t = text.toLowerCase(); const hits = {};
  const terms = [...LEAK.map(k => ({ key: k.startsWith('sha') ? 'sha' : k, src: k })), ...extra.filter(p => !LEAK.includes(p)).map(p => ({ key: p, src: esc(p) }))];
  // edges are "not a word character", so a phrase that ends in "/" or ":" still matches whole
  for (const { key, src } of terms) { const n = (t.match(new RegExp('(?<!\\w)' + src + 's?(?!\\w)', 'g')) || []).length; if (n) hits[key] = (hits[key] || 0) + n; }
  return hits;
};
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
// finality: the words that say a removed file is not coming back. A bare "gone" never counts: the page's
// own non-final outcome begins "Gone from this phone. The copy out there stays where it is.", and the
// temp rail's sweep says "it is gone" of a file that was only for one visit. A sentence that says a copy
// stays is never final. "permanent" also occurs in lifetime clauses; the matched words are printed and
// a reader judges them.
const FINAL = /cannot|can't|no way back|for good|permanent|not .*undo|nowhere else|anywhere else|existed nowhere|no longer|will not exist|won't exist/i;
// …and a sentence that says a copy stays, or that the page cannot promise what happens elsewhere, is never final
const STAYS = /copy .* stays|stays where it is|still (there|out there|exists)|cannot reach|not something this page can promise/i;
const finalWord = t => STAYS.test(t) ? null : (t.match(FINAL) || [null])[0];
const OWN = /your wallet|you pay|own wallet/i;

// text a visitor can read: a hidden element, or one that is not rendered (no box), contributes nothing.
// "rendered" is not "in view without scrolling": the page is taller than the viewport.
// (getClientRects, not offsetParent — the confirmation sheet is position:fixed and has no offsetParent)
// innerText only: it already honours rendering, and a textContent fallback would hand back words under
// visibility:hidden or inside a closed details that no visitor read
async function visibleText(page, sel) {
  return page.evaluate(s => { const el = document.querySelector(s); return el && !el.hidden && el.getClientRects().length > 0 ? (el.innerText ?? '') : ''; }, sel);
}
async function visibleTextAll(page, sel) {
  return page.evaluate(s => [...document.querySelectorAll(s)].filter(el => !el.hidden && el.getClientRects().length > 0).map(el => el.innerText ?? '').join('\n'), sel);
}
// the front's visible words OUTSIDE its purpose controls, so a sentence on a control is not counted twice
async function visibleTextOutside(page, rootSel, skipSel) {
  return page.evaluate(([rs, ss]) => {
    const root = document.querySelector(rs); if (!root) return '';
    const vis = el => el && !el.hidden && el.getClientRects().length > 0;
    const parts = []; const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = walk.nextNode())) { const p = n.parentElement; if (!p || p.closest(ss) || !vis(p)) continue; parts.push(n.nodeValue); }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }, [rootSel, skipSel]);
}

// press a purpose control the way a thumb would, and wait until the page says it is the pick
async function pressControl(page, reg, purpose) {
  if (reg === 'raver') {
    // a thumb on the ring itself: the orbit's top point, computed from the SVG's box after it is
    // scrolled into view. (a playwright click at a fixed offset inside the .hit box lands on the
    // NEXT ring out — measured 2026-09-27: (5,60) on keep selected share — so no forced clicks.)
    await page.locator('#etOrbits').scrollIntoViewIfNeeded(CLICK);
    // the browser maps the ring's own top point (0, -r) to client space, whatever the SVG's layout
    const pt = await page.evaluate(p => { const svg = document.querySelector('#etOrbits'); const c = svg.querySelector(`.orbit[data-et-purpose="${p}"] .hit`); const q = svg.createSVGPoint(); q.x = 0; q.y = -(+c.getAttribute('r')); const m = q.matrixTransform(c.getScreenCTM()); return { x: m.x, y: m.y }; }, purpose);
    if (!(pt.x >= 0 && pt.x < VIEW.width && pt.y >= 0 && pt.y < VIEW.height)) throw new Error(`the ${purpose} ring's tap point (${pt.x | 0},${pt.y | 0}) is outside the ${VIEW.width}×${VIEW.height} viewport`);
    // a tap lands on whatever is on top at that point: if it is not this ring, name the occluder instead of tapping it
    const under = await page.evaluate(([x, y, p]) => { const e = document.elementFromPoint(x, y); const ring = e && e.closest(`.orbit[data-et-purpose="${p}"]`); return ring ? null : (e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/).join('.') : '')) : 'nothing'); }, [pt.x, pt.y, purpose]);
    if (under) throw new Error(`the ${purpose} ring's tap point is covered by ${under}`);
    await page.touchscreen.tap(pt.x, pt.y);
  } else await page.click(`${CONTROLS[reg]}[data-et-purpose="${purpose}"]`, CLICK);
  // the page's own truth (the archive's pressed mode button, or the control's own pressed state) or its
  // data mirror, whichever answers first: the mirror is debounced and can miss a change
  await page.waitForFunction(([p, sel]) => !!document.querySelector(`#modes .mode[aria-pressed="true"][data-purpose="${p}"]`) || document.querySelector(`${sel}[data-et-purpose="${p}"]`)?.getAttribute('aria-pressed') === 'true' || document.querySelector(`${sel}[data-et-purpose="${p}"]`)?.getAttribute('aria-selected') === 'true' || window.__eternal?.data?.pick === p, [purpose, CONTROLS[reg]], { timeout: 5000 });
}

const CLICK = { timeout: 5000 }; // no press waits longer than the other waits in this file
const errText = e => String(e && e.message ? e.message : e).split('\n')[0]; // a page can throw a bare string
async function stranger(reg) {
  // the record is built before anything can fail, so a run that dies keeps what it had gathered
  const R = { reg, revision: REVISION, wire: {}, offered: [], controlsReadableWithoutTap: null, learnTaps: 0, failedTaps: 0, railWords: [], choices: [], firstFile: null, terms: {}, remove: null, recover: null, leakage: { frontBeforeTaps: {}, cardsRead: {}, archive: {}, archiveWithRow: null }, funding: { foreverDeclaredPayer: null, visibleOwnWalletWording: false, ownWalletWordingWhere: [] }, settleMs: 0, pickAtRead: null, notes: [] };
  // every cross-origin request is aborted and logged under the phase it happened in
  const wire = { setup: new Set(), load: new Set(), read: new Set(), add: new Set(), 'after-add': new Set(), remove: new Set(), 'after-remove': new Set(), done: new Set() }; let phase = 'setup';
  let t0 = Date.now(); // restarted right before the page opens; setup time is printed on its own
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: VIEW, isMobile: true, hasTouch: true });
    await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
    const page = await ctx.newPage();
    await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== base) { wire[phase].add(u.host + u.pathname); return route.abort(); } route.continue(); });
    R.setupMs = Date.now() - t0;
    phase = 'load'; t0 = Date.now();
    await page.goto(`${base}/surfaces/myspace.html`, { waitUntil: 'load', timeout: 30000 }).catch(e => { throw new Error('the page did not load: ' + errText(e)); }); // nothing below can be measured on a blank page
    try {
      await page.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.purposes.some(x => x.offered), null, { timeout: 20000 });
    } catch { R.notes.push('the fronts never became ready with an offered purpose (no rail attached offline?)'); }
    // the register is applied by register.js, which the tour bar loads asynchronously: until body[data-reg]
    // is this register, the requested front is still display:none and every read would be of the wrong one
    await page.waitForFunction(r => document.body.dataset.reg === r, reg, { timeout: 10000 }).catch(() => R.notes.push(`body[data-reg] never became "${reg}" (register.js not applied?); the page was read as it stood`));
    const tReady = Date.now(); R.loadMs = tReady - t0; // page open → fronts ready in this register
    // rails attach one by one and the pressed purpose follows the first open one, so the front's
    // text (cypherpunk's write path in particular) depends on WHEN it is read. Wait until the set
    // of offered purposes and the pressed one have held still for 250 ms (a purpose that is
    // legitimately never offered does not hold the wait; 5 s cap), then record what was read under.
    // (polled from this side; the instrument writes nothing into the page it measures)
    const tSettle = Date.now(); let sig = null, since = tSettle;
    for (;;) {
      // the signature is the page's own state (register, the archive's mode buttons and which is pressed) plus the mirror's offered set
      const now = await page.evaluate(() => { const d = window.__eternal?.data; if (!d) return null; const modes = [...document.querySelectorAll('#modes .mode')].map(m => m.getAttribute('data-purpose') + (m.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','); return document.body.dataset.reg + '|' + modes + '|' + d.purposes.map(x => x.id + ':' + x.offered).join(','); });
      if (now !== sig) { sig = now; since = Date.now(); }
      else if (now !== null && Date.now() - since >= 250) break;
      if (Date.now() - tSettle > 5000) { R.notes.push('the offered purposes kept changing for 5 s; the front was read as it stood'); break; }
      await page.waitForTimeout(50);
    }
    R.settleMs = Date.now() - tSettle; // instrument time, counted inside "ms from open" and printed beside it
    R.pickAtRead = await page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') ?? window.__eternal?.data?.pick ?? null); // the page's pressed mode first, the mirror only if there is none

    phase = 'read'; const tRead = Date.now();
    // what the stranger can see: the register's front (without its card, whose words belong to
    // whichever ring is pressed and are counted with the cards), and the whole shared archive below
    // the fronts (every child of main except the fronts, visible text only)
    const front = CARD[reg] ? await visibleTextOutside(page, FRONT[reg], CARD[reg]) : await visibleText(page, FRONT[reg]);
    const archive = await visibleTextAll(page, 'main > :not(#eternal)');
    // the rail schemes and networks the page itself declares join the leak vocabulary (printed, so a reader sees them)
    // (a network name is one phrase, "skaists.buzz" or "arbitrum-one", never split into words like "one" or "buzz")
    R.railWords = await page.evaluate(() => { const d = window.__eternal?.data; if (!d) return []; const w = new Set(); for (const r of d.rails || []) { if (r.scheme) w.add(String(r.scheme).toLowerCase()); for (const n of r.networks || []) if (String(n).trim()) w.add(String(n).toLowerCase().trim()); } return [...w]; });
    const leak = t => countLeak(t, R.railWords);
    R.leakage.frontBeforeTaps = leak(front); R.leakage.archive = leak(archive); // .front is set once the cards are known
    // the purpose controls: their own visible words, and separately what they tell a screen reader
    const options = await page.evaluate(sel => [...document.querySelectorAll(sel)].map(el => ({
      purpose: el.getAttribute('data-et-purpose'),
      // the same rendered rule as every other read: a control that has no box shows no words
      visible: !el.hidden && el.getClientRects().length > 0 ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : '', // innerText only: an SVG control has none, and a <title> inside it is not shown
      aria: el.getAttribute('aria-label') || '',
      disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    })), CONTROLS[reg]);
    R.offered = options.map(o => o.purpose);
    // the front's words outside the controls, read now, before any learning tap changes the card
    const frontOutside = await visibleTextOutside(page, FRONT[reg], CARD[reg] ? `${CONTROLS[reg]}, ${CARD[reg]}` : CONTROLS[reg]); // the card is the pressed control's words, not the front's own
    // a control with no words of its own is learned by tapping it and reading the card that answers.
    // The ring that is pressed when the visitor arrives already has its card on the page: those
    // words are read for free, before any tap moves the card on.
    const initialPick = R.pickAtRead; // the one pressed purpose the front was read under
    const initialCard = CARD[reg] ? (await visibleText(page, CARD[reg])).replace(/\s+/g, ' ').trim() : '';
    for (const o of options) {
      if (o.visible) { o.text = o.visible; o.learnedByTap = false; continue; }
      if (!CARD[reg] || o.disabled) { o.text = ''; o.learnedByTap = false; continue; }
      if (o.purpose === initialPick && initialCard) { o.text = initialCard; o.learnedByTap = false; o.readOnCard = true; continue; }
      // the page's data mirror updates before the card re-renders, so after the tap wait for the card's words to change.
      // A tap that fails, or a card that does not answer, leaves that ring's words unknown: the ring is not scored and
      // the run goes on (a dying learning tap must not discard everything else this register gathered)
      const before = (await visibleText(page, CARD[reg])).replace(/\s+/g, ' ').trim();
      o.learnedByTap = true;
      try { await pressControl(page, reg, o.purpose); } catch (e) { R.notes.push(`tapping the ${o.purpose} ring failed (${errText(e)}): that ring's words are unknown to the instrument, not scored`); o.text = ''; o.stale = true; R.failedTaps++; continue; }
      const changed = await page.waitForFunction(([sel, b]) => { const el = document.querySelector(sel); const t = (el?.innerText || '').replace(/\s+/g, ' ').trim(); return !!t && t !== b; }, [CARD[reg], before], { timeout: 3000 }).then(() => true, () => false);
      if (!changed) { R.notes.push(`the card did not change within 3 s after tapping ${o.purpose}: that ring's words are unknown to the instrument, not scored`); o.text = ''; o.stale = true; R.failedTaps++; continue; }
      o.text = (await visibleText(page, CARD[reg])).replace(/\s+/g, ' ').trim();
      R.learnTaps++; // a learning tap is one that revealed a card
    }
    R.controlsReadableWithoutTap = options.filter(o => !o.learnedByTap && o.text).length;
    R.pressedCardReadFree = options.some(o => o.readOnCard);
    // every card the visitor read — the pressed ring's, shown on arrival, and the ones reached by a tap —
    // carries words the visitor had to read: they count, in one bucket, whichever ring happened to be pressed
    const cardsRead = options.filter(o => o.readOnCard || o.learnedByTap).map(o => o.text).join(' ');
    R.leakage.cardsRead = leak(cardsRead); // the front figure is the sum of frontBeforeTaps and cardsRead, computed where it is printed
    R.readMs = Date.now() - tRead; // instrument time spent reading and learning, printed beside the first-file figure
    const declared = await page.evaluate(() => (window.__eternal?.data?.purposes || []).map(p => ({ id: p.id, offered: p.offered, rail: p.rail, terms: p.terms })));
    // own-wallet wording is looked for everywhere the visitor can read it, without counting a sentence twice
    const ownWhere = {
      'front outside the controls': OWN.test(frontOutside),
      [options.some(o => o.learnedByTap) ? 'controls (after a tap)' : 'controls']: OWN.test(options.map(o => o.text).join(' ')),
      archive: OWN.test(archive),
    };
    R.funding = {
      foreverDeclaredPayer: (declared.find(p => p.id === 'forever') || {}).terms?.payer ?? null,
      visibleOwnWalletWording: Object.values(ownWhere).some(Boolean),
      ownWalletWordingWhere: Object.keys(ownWhere).filter(k => ownWhere[k]),
    };

    // CHOICE: for each intent, which control do the words lead to?
    const picks = {}; // one scoring per intent; FIRST FILE reuses the keep one
    for (const intent of INTENTS) {
      const p = pickByWords(intent, options); // an empty option list scores as "led nowhere"
      picks[intent.id] = p;
      const pick = p.none ? null : p;
      const wanted = declared.find(dp => dp.id === intent.id);
      const own = options.find(o => o.purpose === intent.id);
      R.choices.push({
        ask: intent.ask, means: intent.id,
        offered: !!(wanted && wanted.offered),
        usable: own ? !own.disabled && !own.stale : null, // the intent's own control: rendered, enabled, and readable by the instrument
        chose: pick ? pick.purpose : null, control: pick ? pick.text.slice(0, 120) : null, learnedByTap: pick ? !!pick.learnedByTap : null, readOnCard: pick ? !!pick.readOnCard : null, score: p.score,
        tied: p.tied || null,
        wrong: pick ? pick.purpose !== intent.id : null,
      });
      // TERMS proxy: is a lifetime / readers sentence on the control (or its card) before the choice?
      if (pick && pick.purpose === intent.id) {
        // matched on the VALUES a term can take, never on the label words "lifetime / readers / payer"
        // that cypherpunk's rows print for every purpose (a label with an empty value states nothing)
        const t = pick.text.toLowerCase();
        R.terms[intent.id] = {
          lifetimeStated: /\b(gone|closes|session|stays|while|until|forever|permanent|lasts)\b/.test(t), // not "drop"/"remove": those state deletability, not lifetime
          readersStated: /only this phone|this phone only|this[ -]device|\b(link|anyone|everyone)\b/.test(t), // "link-holders" is matched by "link"
          payerStated: /\b(pay|pays|paid|paying|wallet)\b|payer (nobody|the-hive|you)\b/.test(t), // bare "nobody"/"hive" also occur in the deletable and lifetime clauses
        };
      }
    }

    // FIRST FILE: the stranger wants to keep a photo on this phone. Chooses by words, presses add, picks a file.
    const keepPick = picks.keep;
    const keep = keepPick.none ? null : keepPick; // disabled and unreadable controls were never candidates
    let steps = 0, confirmingPress = false;
    if (keep) {
      phase = 'add'; const tAdd = Date.now();
      try {
        // if the chosen purpose is already the pressed one on arrival, this press only confirms it: counted, and said so.
        // (page.click checks that the control receives the pointer at the action point, so the press is known to
        // have landed even though it changes nothing; the raver tap is never a confirming one, the learning taps
        // having moved the pick)
        confirmingPress = (await page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') ?? window.__eternal?.data?.pick ?? null)) === keep.purpose; // the page's pressed mode, not the mirror
        await pressControl(page, reg, keep.purpose);
        steps++;
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click(ADD[reg], CLICK).then(() => { steps++; })]);
        // the file picker is the device's dialog, not a press on the page: it is counted apart from the presses
        await chooser.setFiles({ name: 'stranger-note.txt', mimeType: 'text/plain', buffer: Buffer.from('a note from a stranger', 'utf8') });
        // the page's own truth, not only its data mirror: a row painted into the archive, the body's file
        // state, or the mirror's count — whichever the page shows first
        await page.waitForFunction(() => document.querySelector('#list').children.length > 0 || document.body.dataset.state === 'file' || (window.__eternal?.data?.count ?? 0) >= 1, null, { timeout: 15000 });
        const tStored = Date.now(); // the clock stops the moment the row is observed stored, before any further reads
        // the receipt reads the index itself, not the debounced mirror (which can miss the change and never catch up)
        const stored = await page.evaluate(() => window.__myspace.rows().then(r => r.map(x => ({ purpose: x.purpose, scheme: x.addr && x.addr.scheme }))));
        if (!stored.length) throw new Error('the page showed a stored row but the index has none');
        const archivePressed = await page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') || null);
        // the archive is read again now that a row exists: the row's own words are what the visitor reads to find the remove control
        R.leakage.archiveWithRow = leak(await visibleTextAll(page, 'main > :not(#eternal)'));
        phase = 'after-add'; // the add's own wire is copied only after its phase has ended, so nothing lands after the copy
        R.firstFile = { ok: true, purposeChosen: keep.purpose, archivePressedAfterAdd: archivePressed, stored, steps, confirmingPress, picker: true, ms: tStored - t0, addMs: tStored - tAdd, pageMs: R.loadMs + (tStored - tAdd), statusShown: await visibleText(page, '#status'), networkDuringAdd: [...wire.add].sort() };
      } catch (e) {
        phase = 'after-add';
        R.firstFile = { ok: false, purposeChosen: keep.purpose, steps, confirmingPress, ms: Date.now() - t0, error: errText(e), networkDuringAdd: [...wire.add].sort() };
      }
      await page.waitForTimeout(250); // a follow-up request to the add belongs here, not to the remove
    } else {
      R.firstFile = { ok: false, steps: 0, ms: Date.now() - t0, error: !options.length ? 'no purpose controls rendered' : `no usable control's words led to keep (top score ${keepPick.score}${keepPick.tied ? ', tied ' + keepPick.tied.join('/') : ''})` };
    }

    // REMOVE: find a visible remove control on the stored row, read the confirmation, confirm, check the outcome is stated.
    if (R.firstFile?.ok) {
      phase = 'remove';
      // only a rendered control (one with a box) counts. It is selected with a playwright locator and
      // pressed through playwright's actionability checks: nothing is written into the page (the
      // page observes attribute changes on #list and would re-render its fronts on a tag write)
      // matched on the accessible name, which is the control's words or its aria-label (an icon button named "Remove" counts)
      const RM = /\b(remove|delete|drop|bin|trash)\b/i;
      const rmLoc = page.locator('#list').getByRole('button', { name: RM }).or(page.locator('#list').getByRole('link', { name: RM })).locator('visible=true');
      const candidates = await rmLoc.count();
      const rm = candidates ? { text: ((await rmLoc.first().innerText()).trim() || (await rmLoc.first().getAttribute('aria-label')) || '').trim(), candidates } : null; // its words, or its accessible name when it shows only an icon
      if (!rm) {
        // no match: print every rendered control on the rows, so a reader can tell a product gap from an instrument vocabulary miss
        const rowControls = await page.locator('#list button, #list a, #list [role=button]').locator('visible=true').allInnerTexts();
        phase = 'after-remove';
        R.remove = { control: null, ok: false, note: `no rendered control on the stored row says remove / delete / drop / bin / trash; the row's controls say: ${rowControls.map(t => '"' + t.trim() + '"').join(', ') || 'nothing'}`, networkDuringRemove: [...wire.remove].sort() };
        await page.waitForTimeout(250); // the after-remove window is opened on every path, not only the successful one
      } else {
        try {
          const statusBefore = (await visibleText(page, '#status')).trim(); // the outcome must be a NEW sentence, not the add's leftover
          await rmLoc.first().click(CLICK);
          await page.waitForSelector('#del-body', { state: 'visible', timeout: 5000 });
          const sentence = (await visibleText(page, '#del-body')).trim();
          const confirmText = (await visibleText(page, '#delConfirm')).trim();
          await page.click('#delConfirm', CLICK);
          // the page's own truth only: the row leaves the archive or the body says empty. (The mirror's count is
          // not consulted: it can still read 0 from before the add and would end the wait before the delete.)
          await page.waitForFunction(() => document.querySelector('#list').children.length === 0 || document.body.dataset.state === 'empty', null, { timeout: 10000 });
          const after = (await visibleText(page, '#status')).trim();
          phase = 'after-remove'; // the remove's own wire is copied only after its phase has ended
          const removeWire = [...wire.remove].sort();
          await page.waitForTimeout(250); // let the post-delete render and any adapter follow-up reach the after-remove log
          R.remove = { control: rm.text, candidates: rm.candidates, sentence, confirm: confirmText, ok: true, outcomeStated: !!after && after !== statusBefore, outcome: after.slice(0, 160), finalityBeforeConfirm: finalWord(sentence), finalityAfter: finalWord(after), networkDuringRemove: removeWire };
        } catch (e) { phase = 'after-remove'; R.remove = { control: rm.text, candidates: rm.candidates, ok: false, error: errText(e), networkDuringRemove: [...wire.remove].sort() }; await page.waitForTimeout(250); }
      }
      // RECOVER: does anything rendered on the page offer to bring it back? (rendered = has a box; the page is
      // taller than the viewport, so this is "on the page", not "in view without scrolling")
      // Only the page's own controls count: the estate's tour bar carries a "recover" link that is
      // about KEY recovery (surfaces/recover.html), and a stranger who followed it would not get
      // their file back. Anything inside #tbar or pointing at recover.html is excluded by name.
      const rec = await page.evaluate(() => {
        // same rendered rule as everywhere else (client rects): a position:fixed undo toast has no offsetParent and must still count
        // anywhere on the page but the tour bar (a toast can be nested anywhere under body); the words on the
        // control and its accessible name are both read, so an icon button named "Undo" counts
        const els = [...document.querySelectorAll('button, a, [role=button], summary')].filter(el => !el.hidden && el.getClientRects().length > 0 && !el.closest('#tbar') && !/recover\.html/.test(el.getAttribute('href') || ''));
        const words = el => ((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '')).trim();
        const hit = els.find(el => /\b(undo|restore|recover)\b|\b(bring|put|get)\b[^.]{0,40}?\bback\b/i.test(words(el)));
        return hit ? words(hit) : null;
      });
      // the tour bar's "recover" link: present in the DOM, and actually on screen at this width? The bar's
      // link strip scrolls and is masked at 390 px, so presence alone would overstate what a visitor sees.
      const tourBar = await page.evaluate(() => {
        const a = [...document.querySelectorAll('#tbar a')].find(a => /recover/i.test(a.innerText || ''));
        if (!a) return { present: false, onScreen: false };
        const b = a.getBoundingClientRect();
        const inView = b.width > 0 && b.height > 0 && b.right > 0 && b.left < innerWidth && b.bottom > 0 && b.top < innerHeight;
        const atPoint = inView && (() => { const e = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2))); return !!e && (e === a || a.contains(e)); })();
        return { present: true, onScreen: atPoint };
      });
      R.recover = { control: rec, offered: !!rec, tourBarKeyRecoveryLinkPresent: tourBar.present, tourBarKeyRecoveryLinkOnScreen: tourBar.onScreen };
    }
  } catch (e) {
    // the run died: keep everything gathered so far and say where it stopped
    R.notes.push(`run aborted during ${phase}: ${errText(e)}`);
    if (!R.firstFile) R.firstFile = { ok: false, steps: 0, ms: Date.now() - t0, error: `instrument aborted during ${phase}` };
  } finally {
    // the wire log is copied only after the context has closed, so a request fired at teardown is kept too
    phase = 'done';
    if (ctx) { await ctx.pages()[0]?.waitForTimeout(250).catch(() => {}); await ctx.close().catch(() => {}); }
    for (const [k, v] of Object.entries(wire)) if (v.size) R.wire[k] = [...v].sort();
  }
  return R;
}

// one summary per result, used by the stderr line and the table alike
const summarize = r => {
  const offered = r.choices.filter(c => c.offered);
  return { wrong: offered.filter(c => c.wrong).length, offered: offered.length, nowhere: offered.filter(c => c.chose === null).length, leakFront: sum(r.leakage.frontBeforeTaps) + sum(r.leakage.cardsRead), leakCards: sum(r.leakage.cardsRead), leakArchive: sum(r.leakage.archive), leakArchiveWithRow: r.leakage.archiveWithRow ? sum(r.leakage.archiveWithRow) : null };
};

const results = [];
try {
for (const reg of REGS) {
  const r = await stranger(reg);
  results.push(r);
  const s = summarize(r);
  process.stderr.write(`${reg.padEnd(11)} offered ${r.offered.join(',') || 'none'} | readable without a tap ${r.controlsReadableWithoutTap}/${r.offered.length} | wrong choice ${s.wrong}/${s.offered} | first file ${r.firstFile?.ok ? r.firstFile.steps + ' presses+picker ' + r.firstFile.ms + 'ms' : 'FAILED: ' + r.firstFile?.error} | remove ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | recover ${r.recover ? (r.recover.offered ? 'offered' : 'none') : '—'} | leak front ${s.leakFront} (cards ${s.leakCards}) archive ${s.leakArchive}/${s.leakArchiveWithRow ?? '—'} | own-wallet wording ${r.funding.visibleOwnWalletWording}\n`);
}
} finally { await browser.close().catch(() => {}); await closeServer(); } // nothing is left running whatever threw above

const L = [];
L.push(`# MY SPACE — the stranger instrument, ${results.length} registers at ${VIEW.width}×${VIEW.height}, revision ${REVISION}`);
L.push('');
L.push('Machine-measured. CHOICE, FIRST FILE, REMOVE, RECOVER, LEAKAGE and FUNDING are observed behaviour and visible wording. TERMS is a proxy (the sentence is on the control, or on its card after a tap, before the choice), not comprehension. Task completion rate and comprehension of temporary vs forever are not measured here: they need people.');
L.push('');
L.push('| register | purposes offered | controls readable without a tap | wrong choice (of offered) | led nowhere | first file: page presses (+ the file picker) · page ms (load + add) · whole run ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime·readers·payer | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front (incl. cards read) | leak words in archive (empty / with the stored row) | own-wallet wording visible | forever payer (declared) |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const s = summarize(r);
  const lt = id => r.terms[id] ? ['lifetimeStated', 'readersStated', 'payerStated'].map(k => r.terms[id][k] ? 'y' : 'n').join('·') : '—';
  const yn = v => v ? 'y' : 'n';
  L.push(`| ${r.reg} | ${r.offered.join(', ') || 'none'} | ${r.controlsReadableWithoutTap ?? '—'}/${r.offered.length}${r.learnTaps ? ' (' + r.learnTaps + ' taps to learn the rest)' : ''} | ${s.wrong}/${s.offered} | ${s.nowhere} | ${r.firstFile?.ok ? `${r.firstFile.steps}${r.firstFile.confirmingPress ? ' (1 confirming the already-pressed purpose)' : ''} (+ picker) · page ${r.firstFile.pageMs} (load ${r.loadMs} + the add itself ${r.firstFile.addMs}) · whole run ${r.firstFile.ms} (instrument ${r.settleMs} settle + ${r.readMs} reading)` : 'FAILED'} | ${r.firstFile?.networkDuringAdd?.length ? '**' + r.firstFile.networkDuringAdd.length + ' request(s)**' : 'none'} | ${r.remove ? (r.remove.networkDuringRemove?.length ? '**' + r.remove.networkDuringRemove.length + ' request(s)**' : 'none') : '—'} | ${lt('now')} / ${lt('forever')} | ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | ${r.remove?.ok ? yn(r.remove.outcomeStated) : '—'} | ${r.remove?.ok ? yn(r.remove.finalityBeforeConfirm) + ' / ' + yn(r.remove.finalityAfter) : '—'} | ${r.recover ? yn(r.recover.offered) : '—'} | ${s.leakFront}${s.leakCards ? ' (' + s.leakCards + ' on the cards)' : ''}${r.reg === 'cypherpunk' ? ' (declared voice)' : ''} | ${s.leakArchive} / ${s.leakArchiveWithRow ?? '—'} | ${r.funding.visibleOwnWalletWording ? 'y (' + r.funding.ownWalletWordingWhere.join('; ') + ')' : 'n'} | ${r.funding.foreverDeclaredPayer ?? '—'} |`);
}
L.push('');
L.push('## Receipts');
L.push('');
for (const r of results) {
  L.push(`### ${r.reg}`);
  L.push(`- controls readable without a tap: ${r.controlsReadableWithoutTap ?? '—'} of ${r.offered.length}${r.pressedCardReadFree ? " (the pressed ring's card was already on the page)" : ''}${r.learnTaps ? `; ${r.learnTaps} carry no words of their own and were learned by tapping each and reading the card` : ''}${r.failedTaps ? `; ${r.failedTaps} could not be learned (tap failed or the card did not answer; see notes)` : ''}`);
  for (const [id, t] of Object.entries(r.terms)) L.push(`- terms on the ${id} control before the choice: lifetime ${t.lifetimeStated ? 'stated' : 'not stated'}, readers ${t.readersStated ? 'stated' : 'not stated'}, payer ${t.payerStated ? 'stated' : 'not stated'}`);
  for (const c of r.choices) L.push(`- "${c.ask}" → ${c.offered ? (c.chose ? `chose **${c.chose}**${c.wrong ? ' (WRONG, meant ' + c.means + ')' : ''} (score ${c.score}) via "${c.control}"${c.learnedByTap ? ' (read on the card after tapping the ring)' : c.readOnCard ? ' (read on the card the pressed ring already showed)' : ''}` : `the words led nowhere (top score ${c.score}${c.tied ? ', tied between ' + c.tied.join(' / ') : ''})`) : 'not offered on this page'}${c.offered && c.usable === false ? ' — the control for this purpose is disabled or unreadable, so it could not be chosen' : ''}`);
  if (r.firstFile) L.push(`- first file: ${r.firstFile.ok ? `stored under ${r.firstFile.purposeChosen} (rows: ${JSON.stringify(r.firstFile.stored)}; archive pressed after add (the page resets to the most private purpose): ${r.firstFile.archivePressedAfterAdd}) in ${r.firstFile.steps} presses on the page${r.firstFile.confirmingPress ? ' (the first only confirmed ' + r.firstFile.purposeChosen + ', already pressed on arrival)' : ''} plus the file picker${r.learnTaps ? ' (after ' + r.learnTaps + ' taps to learn the rings)' : ''}, ${r.firstFile.ms} ms from page open to the row observed stored: ${r.loadMs} ms until the fronts were ready in this register, ${r.settleMs} ms of the instrument waiting for the offered purposes and the pressed one to hold still, ${r.readMs} ms of the instrument reading the page and learning the controls, ${r.firstFile.addMs} ms for the add itself from the purpose press to the row, and the rest between those (${r.setupMs} ms of browser-context setup before the open is not counted)${r.firstFile.statusShown ? '; status shown: "' + r.firstFile.statusShown.slice(0, 120) + '"' : '; no status sentence shown'}` : 'FAILED: ' + r.firstFile.error}${r.firstFile.networkDuringAdd?.length ? `; **requests attempted during the add: ${r.firstFile.networkDuringAdd.join(', ')}** (aborted by the harness)` : '; no request left the page during the add'}`);
  if (r.remove) L.push(`- remove: ${r.remove.ok ? `control "${r.remove.control}" (${r.remove.candidates} visible) → sentence "${r.remove.sentence}" (finality word: ${r.remove.finalityBeforeConfirm ? '"' + r.remove.finalityBeforeConfirm + '"' : 'none'}) → confirm "${r.remove.confirm}" → outcome "${r.remove.outcome || '(nothing stated)'}" (finality word: ${r.remove.finalityAfter ? '"' + r.remove.finalityAfter + '"' : 'none'})` : (r.remove.note || r.remove.error)}${r.remove.networkDuringRemove?.length ? `; **requests attempted during the remove: ${r.remove.networkDuringRemove.join(', ')}** (aborted by the harness)` : '; no request left the page during the remove'}`);
  if (r.recover) L.push(`- recover: ${r.recover.offered ? `offered as "${r.recover.control}"` : 'nothing rendered on the page offers to bring a removed file back'}${r.recover.tourBarKeyRecoveryLinkPresent ? `; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (${r.recover.tourBarKeyRecoveryLinkOnScreen ? 'on screen at this width' : 'in the bar\'s strip but NOT on screen at this width without scrolling the bar'})` : ''}`);
  L.push(`- leak words in the front (read with purpose "${r.pickAtRead}" pressed): ${JSON.stringify(r.leakage.frontBeforeTaps)}${r.pressedCardReadFree || r.learnTaps ? `; on the cards the visitor read (the pressed ring's and the ones reached by a tap): ${JSON.stringify(r.leakage.cardsRead)}` : ''}; rail and network words the page declared and that joined the vocabulary: ${r.railWords.join(', ') || 'none'}; in the shared archive below while empty: ${JSON.stringify(r.leakage.archive)}${r.leakage.archiveWithRow ? `; with the stored row showing: ${JSON.stringify(r.leakage.archiveWithRow)}` : ''}`);
  L.push(`- funding: own-wallet wording visible ${r.funding.visibleOwnWalletWording}${r.funding.visibleOwnWalletWording ? ' (in: ' + r.funding.ownWalletWordingWhere.join('; ') + ')' : ''}; the forever rail declares payer = ${r.funding.foreverDeclaredPayer ?? 'none (not offered)'}`);
  for (const [ph, hosts] of Object.entries(r.wire)) L.push(`- cross-origin attempted during ${ph} (aborted): ${hosts.join(', ')}`); // every phase, nothing dropped
  if (r.notes.length) L.push(`- notes: ${r.notes.join(' | ')}`);
  L.push('');
}
process.stdout.write(L.join('\n') + '\n');
if (OUT) await writeFile(OUT, JSON.stringify({ revision: REVISION, results }, null, 1));
// a register that did not get its first file, or whose run aborted, is a failed measurement: say so in the exit code
if (results.some(r => !r.firstFile?.ok || r.notes.some(n => n.startsWith('run aborted')))) process.exitCode = 1;
