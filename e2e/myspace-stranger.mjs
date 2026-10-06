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
//   LEAKAGE     count of implementation words: a fixed list (adapter, rail, worker, indexeddb,
//               aes, schnorr, nostr, relay, datamap, chunk, digest, sha, signer, wallet, gas,
//               token, scheme, predicate, ciphertext, keyref, pubkey) plus every rail scheme
//               and network the page itself declares at run time (temp, local, blossom, ant,
//               autonomi, arbitrum-one, skaists.buzz today), each declared name as one phrase
//               counted once; whole words only, in the register's own front and in the shared
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
import { serveTree, offBox as leftBox } from './lib/serve.mjs';
import { argReader, UsageError } from './lib/args.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
// --k v or --k=v; a missing value or an unknown flag is a UsageError. The flags are read before anything
// is open, so a usage error can simply exit 2 here
const readFlags = () => { try { const arg = argReader('usage: node myspace-stranger.mjs [--json out.json] [--reg bee,raver,cypherpunk]', ['json', 'reg']); return { regs: arg('reg', 'bee,raver,cypherpunk'), out: arg('json', '') }; } catch (e) { if (e instanceof UsageError) { process.stderr.write(e.message + '\n'); process.exit(2); } throw e; } };
const FLAGS = readFlags();

/* where each register keeps its front, its purpose controls, its add control, and (if the
   controls carry no words of their own) the card that answers a tap. Since the founder's chosen
   UI (2026-10-04) the three registers are ONE DOM: the same cards and the same add button, worn
   three ways, and every card carries its own words, so no register needs a card to learn from. */
const FRONT = { bee: '#eternal', raver: '#eternal', cypherpunk: '#eternal' };
const ADD = { bee: '#eternal .primary[data-attach]', raver: '#eternal .primary[data-attach]', cypherpunk: '#eternal .primary[data-attach]' };
const CONTROLS = {
  bee: '#modes .mode[data-purpose]',
  raver: '#modes .mode[data-purpose]',
  cypherpunk: '#modes .mode[data-purpose]',
};
const CARD = { bee: null, raver: null, cypherpunk: null };
// the page's own state, read the way the fronts used to mirror it (one shape for every read below)
const MODEL = `(() => { const M = window.__myspace; if (!M || !M.purposes) return null; const open = M.purposes(); const ads = M.adapters() || {};
  const pressed = document.querySelector('#modes .mode[aria-pressed="true"]');
  return { ready: open.length > 0 && document.querySelectorAll('#modes .mode').length > 0, pick: pressed ? pressed.getAttribute('data-purpose') : null,
    purposes: ['now', 'keep', 'share', 'forever'].map(id => { const rail = open.includes(id) ? M.railFor(id) : null; return { id, offered: open.includes(id), rail, terms: rail ? M.terms(rail) : null }; }),
    rails: Object.keys(ads).map(s => ({ scheme: s, networks: (ads[s] && ads[s].caps && ads[s].caps.networks) || [] })) }; })()`;

const REGS = FLAGS.regs.split(',').map(s => s.trim()).filter(Boolean);
const unknown = REGS.filter(r => !Object.hasOwn(FRONT, r)); // hasOwn: "constructor" is not a register
if (!REGS.length || unknown.length) { process.stderr.write(`--reg: unknown register(s) ${unknown.join(', ') || '(none given)'}; known: ${Object.keys(FRONT).join(', ')}\n`); process.exit(2); }
const repeated = REGS.filter((r, i) => REGS.indexOf(r) !== i); // a register twice would print two rows for one page: a mistake, not a request
if (repeated.length) { process.stderr.write(`--reg: repeated register(s) ${[...new Set(repeated)].join(', ')}\n`); process.exit(2); }
const OUT = FLAGS.out;
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
// the fixed implementation vocabulary, counted as whole words (singular or plural): "trail" is not "rail", "gasp"
// is not "gas". Rail and network names are NOT here: they come from the page's own declarations at run time
// (R.railWords, read from the page's own adapters, __myspace.adapters()), so a page that declares no rails counts none. Some of these are
// also plain English (token, scheme, gas): they are counted wherever they appear, and the receipts print every word
// with its count so a reader can see whether a hit is a rail name or ordinary prose.
const LEAK = ['adapter', 'rail', 'worker', 'indexeddb', 'aes', 'schnorr', 'nostr', 'relay', 'datamap', 'chunk', 'digest', 'sha-?\\d*', 'signer', 'wallet', 'gas', 'token', 'scheme', 'predicate', 'ciphertext', 'keyref', 'pubkey'];
// …plus the rail schemes and networks the page itself declares at run time (temp, local, blossom, ant; autonomi,
// arbitrum-one, skaists.buzz today), each as one whole phrase: one source of truth for the rail names, so a renamed
// or fifth rail is counted the day it attaches and a phrase is never counted twice
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countLeak = (text, extra = []) => {
  let t = text.toLowerCase(); const hits = {};
  // edges are "not a word character", so a phrase that ends in "/" or ":" still matches whole; every match is
  // blanked out of the text, so a fixed word inside a declared phrase is never counted a second time
  const count = (key, src) => { const re = new RegExp('(?<!\\w)' + src + 's?(?!\\w)', 'g'); const n = (t.match(re) || []).length; if (n) { hits[key] = (hits[key] || 0) + n; t = t.replace(re, ' '); } };
  for (const p of [...new Set(extra.filter(p => !LEAK.includes(p)))].sort((a, b) => b.length - a.length)) count(p, esc(p)); // declared phrases first, longest first
  for (const k of LEAK) count(k.startsWith('sha') ? 'sha' : k, k);
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
// own-wallet wording: a sentence that says the visitor pays from their own wallet. A sentence that says the
// opposite ("asks your wallet for nothing", "you pay nothing") is not a hit, so the column can go to "n" once
// the wording is fixed; the sentence that earned a hit is printed so a reader can judge it.
const OWN = /your wallet|you pay|own wallet/i;
// the negation must be about the paying: a negating word within four words of "pay" or "wallet" in the same
// sentence ("pays nothing", "nothing leaves your wallet", "you do not pay", "asks your wallet for nothing").
// The sentence that earned a hit is printed, so a reader can judge the two edge shapes this rule gets wrong:
// "you pay, not from ours" (negation near "pay", counted as not paying) and a negation more than four words away.
const NEG = "(nothing|never|not|no|without|nobody|\\w+n't)"; // "don't", "won't", "doesn't" are negations too (a bare n't has no word boundary of its own)
const PAY = '(pays?|paid|paying|wallet)';
const NEGATED = new RegExp(`\\b${NEG}\\b\\W+(?:\\w+\\W+){0,4}?\\b${PAY}\\b|\\b${PAY}\\b\\W+(?:\\w+\\W+){0,4}?\\b${NEG}\\b`, 'i');
const ownWalletSentence = text => (text.match(/[^.!?·\n]+[.!?]?/g) || []).map(s => s.trim()).find(s => OWN.test(s) && !NEGATED.test(s)) || null;

// text a visitor can read: a hidden element, or one that is not rendered (no box), contributes nothing.
// "rendered" is not "in view without scrolling": the page is taller than the viewport.
// (getClientRects, not offsetParent — the confirmation sheet is position:fixed and has no offsetParent)
// ONE rule for "words a visitor can read", used by every read in this file: a text node counts when
// its element is rendered (has a box), is not hidden or visibility:hidden, is not a screen-reader-only
// sliver (a box under 2 px, the clip-path / clip sr-only idiom), and is not inside a closed <details>
// body. innerText alone would keep the sr-only words; a bare tree walk would keep visibility:hidden.
const SEEN_TEXT = `
  const seen = el => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); if (!(r.width > 1 && r.height > 1)) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open && !el.closest('summary')) return false; return true; };
  // text from different blocks (or across a <br>) is joined by a line break, not a space, so a sentence never runs
  // from one element into its neighbour (a "no" in a sibling <small> is not a negation of the button's "you pay")
  const block = (el, root) => { for (let e = el; e && e !== root; e = e.parentElement) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'contents') return e; } return root; };
  const wordsIn = (root, skipSel) => { const parts = []; let last = null; const memo = new Map(); const shown = el => { if (!memo.has(el)) memo.set(el, seen(el)); return memo.get(el); }; const blocks = new Map(); const blockOf = el => { if (!blocks.has(el)) blocks.set(el, block(el, root)); return blocks.get(el); }; const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n; while ((n = walk.nextNode())) { if (n.nodeType === 1) { if (n.tagName === 'BR' && shown(n.parentElement)) parts.push('\\n'); continue; } const p = n.parentElement; if (!p || (skipSel && p.closest(skipSel)) || !shown(p)) continue; const b = blockOf(p); if (last && b !== last) parts.push('\\n'); last = b; parts.push(n.nodeValue); } return parts.join(' ').replace(/[^\\S\\n]+/g, ' ').replace(/ *\\n */g, '\\n').trim(); };`;
// one page-side reader for all three shapes: the first match, every match joined, or one root with a selector
// skipped inside it (so a sentence on a control is not counted twice); reused by the card-changed wait too
const VISIBLE_WORDS = new Function('a', SEEN_TEXT + ` const [sel, all, skip] = a; if (all) return [...document.querySelectorAll(sel)].map(el => wordsIn(el, null)).filter(Boolean).join('\\n'); const el = document.querySelector(sel); return el ? wordsIn(el, skip || null) : '';`);
const visibleText = (page, sel) => page.evaluate(VISIBLE_WORDS, [sel, false, null]);
const visibleTextAll = (page, sel) => page.evaluate(VISIBLE_WORDS, [sel, true, null]);
const visibleTextOutside = (page, rootSel, skipSel) => page.evaluate(VISIBLE_WORDS, [rootSel, false, skipSel]);

// the purpose the archive shows pressed: the page's own truth, and nothing else (the mirror derives its pick from
// this same button, and would only differ when it is stale)
async function pressedMode(page) {
  return page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') ?? null);
}

// press a purpose control the way a thumb would, and wait until the page says it is the pick
async function pressControl(page, reg, purpose) {
  await page.click(`${CONTROLS[reg]}[data-purpose="${purpose}"]`, CLICK);
  // the archive's pressed mode button is the page's own state (the fronts' aria-pressed is rendered from the
  // debounced mirror, which can hold a stale equal value, so it is not enough on its own)
  await page.waitForFunction(p => !!document.querySelector(`#modes .mode[aria-pressed="true"][data-purpose="${p}"]`), purpose, { timeout: 5000 });
}

const CLICK = { timeout: 5000 }; // no press waits longer than the other waits in this file
const errText = e => String(e && e.message ? e.message : e).split('\n')[0]; // a page can throw a bare string
const cut = (s, n) => { if (s.length <= n) return s; const i = s.slice(0, n + 1).search(/\s\S*$/); return s.slice(0, i > 0 ? i : n) + ' …'; }; // cut at a word boundary, marked
const line = s => String(s ?? '').replace(/\n/g, ' / '); // a line break inside quoted text (one element ending, the next beginning) prints as " / " in the receipts
async function stranger(reg) {
  // the record is built before anything can fail, so a run that dies keeps what it had gathered
  const R = { reg, revision: REVISION, unsound: [], wire: {}, offered: [], controlsReadableWithoutTap: null, learnTaps: 0, failedTaps: 0, railWords: [], choices: [], firstFile: null, terms: {}, remove: null, recover: null, leakage: { frontBeforeTaps: {}, cardsRead: {}, archive: {}, archiveWithRow: null }, funding: { foreverDeclaredPayer: null, visibleOwnWalletWording: false, ownWalletWordingWhere: [] }, settleMs: 0, pickAtRead: null, notes: [] };
  // every cross-origin request is aborted and logged under the phase it happened in
  const wire = { setup: new Set(), load: new Set(), read: new Set(), add: new Set(), 'after-add': new Set(), remove: new Set(), 'after-remove': new Set(), done: new Set() }; let phase = 'setup';
  let t0 = Date.now(); // restarted right before the page opens; setup time is printed on its own
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: VIEW, isMobile: true, hasTouch: true });
    await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
    const page = await ctx.newPage();
    // only requests that leave the origin are intercepted (and aborted, logged under the phase); same-origin
    // requests are never paused, so the page's own timings are not stretched by the interception
    // the route only aborts; the context's request event is the one logger (it fires for routed requests and for a
    // worker's own requests alike). WebSockets are not requests: logged apart, and a socket cannot be aborted from here
    await page.route(u => leftBox(u.href, base), route => route.abort());
    const where = url => { try { const u = new URL(url); return u.host + u.pathname; } catch { return String(url); } };
    ctx.on('request', req => { if (leftBox(req.url(), base)) wire[phase].add(where(req.url())); });
    page.on('websocket', ws => { if (leftBox(ws.url(), base)) wire[phase].add('ws ' + where(ws.url())); });
    R.setupMs = Date.now() - t0;
    phase = 'load'; t0 = Date.now();
    await page.goto(`${base}/surfaces/myspace.html`, { waitUntil: 'load', timeout: 30000 }).catch(e => { throw new Error('the page did not load: ' + errText(e)); }); // nothing below can be measured on a blank page
    try {
      await page.waitForFunction(m => { const d = eval(m); return !!d && d.ready; }, MODEL, { timeout: 20000 });
    } catch { R.unsound.push('the fronts never became ready with an offered purpose (no rail attached offline?)'); }
    // the register is applied by register.js, which the tour bar loads asynchronously: until body[data-reg]
    // is this register, the requested front is still display:none and every read would be of the wrong one
    await page.waitForFunction(r => document.body.dataset.reg === r, reg, { timeout: 10000 }).catch(() => R.unsound.push(`body[data-reg] never became "${reg}" (register.js not applied?); the page was read as it stood`));
    const tReady = Date.now(); R.loadMs = tReady - t0; // page open → fronts ready in this register
    // rails attach one by one and the pressed purpose follows the first open one, so the front's
    // text (cypherpunk's write path in particular) depends on WHEN it is read. Wait until the set
    // of offered purposes and the pressed one have held still for 250 ms (a purpose that is
    // legitimately never offered does not hold the wait; 5 s cap), then record what was read under.
    // (polled from this side; the instrument writes nothing into the page it measures)
    const tSettle = Date.now(); let sig = null, since = tSettle;
    for (;;) {
      // the signature is the page's own state (register, the archive's mode buttons and which is pressed) plus the mirror's offered set
      const now = await page.evaluate(m => { const d = eval(m); if (!d) return null; const modes = [...document.querySelectorAll('#modes .mode')].map(m => m.getAttribute('data-purpose') + (m.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','); return document.body.dataset.reg + '|' + modes + '|' + d.pick + '|' + d.purposes.map(x => x.id + ':' + x.offered).join(','); }, MODEL); // the page's own pick and offered set
      if (now !== sig) { sig = now; since = Date.now(); }
      else if (now !== null && Date.now() - since >= 250) break;
      if (Date.now() - tSettle > 5000) { R.unsound.push('the offered purposes kept changing for 5 s; the front was read as it stood'); break; }
      await page.waitForTimeout(50);
    }
    R.settleMs = Date.now() - tSettle; // instrument time, counted inside "ms from open" and printed beside it
    R.pickAtRead = await pressedMode(page);

    phase = 'read'; const tRead = Date.now();
    // what the stranger can see: the register's front (without its card, whose words belong to
    // whichever ring is pressed and are counted with the cards), and the whole shared archive below
    // the fronts (every child of main except the fronts, visible text only)
    const front = CARD[reg] ? await visibleTextOutside(page, FRONT[reg], CARD[reg]) : await visibleText(page, FRONT[reg]);
    const archive = await visibleTextAll(page, 'main > :not(#eternal)');
    // the rail schemes and networks the page itself declares join the leak vocabulary (printed, so a reader sees them)
    // (a network name is one phrase, "skaists.buzz" or "arbitrum-one", never split into words like "one" or "buzz")
    R.railWords = await page.evaluate(m => { const d = eval(m); if (!d) return []; const w = new Set(); for (const r of d.rails || []) { if (r.scheme) w.add(String(r.scheme).toLowerCase()); for (const n of r.networks || []) if (String(n).trim()) w.add(String(n).toLowerCase().trim()); } return [...w]; }, MODEL);
    const leak = t => countLeak(t, R.railWords);
    R.leakage.frontBeforeTaps = leak(front); R.leakage.archive = leak(archive); // .front is set once the cards are known
    // the purpose controls' own words under the one visibility rule (an SVG ring has no text of its own; a <title>
    // inside it is not shown, and its aria-label is not read: words no sighted visitor sees are not scored)
    const options = await page.evaluate(new Function('sel', SEEN_TEXT + ` return [...document.querySelectorAll(sel)].map(el => ({
      purpose: el.getAttribute('data-purpose'),
      visible: wordsIn(el, null),
      disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    }));`), CONTROLS[reg]);
    R.offered = options.map(o => o.purpose);
    // the front's words outside the controls, read now, before any learning tap changes the card
    const frontOutside = await visibleTextOutside(page, FRONT[reg], CARD[reg] ? `${CONTROLS[reg]}, ${CARD[reg]}` : CONTROLS[reg]); // the card is the pressed control's words, not the front's own
    // a control with no words of its own is learned by tapping it and reading the card that answers.
    // The ring that is pressed when the visitor arrives already has its card on the page: those
    // words are read for free, before any tap moves the card on.
    // the card on the page renders from the fronts' mirror, so the ring it belongs to is the mirror's pick (which
    // the settle wait has just seen hold still together with the archive's pressed mode)
    const initialPick = CARD[reg] ? await page.evaluate(m => eval(m)?.pick ?? null, MODEL) : R.pickAtRead;
    const initialCard = CARD[reg] ? await visibleText(page, CARD[reg]) : '';
    if (CARD[reg] && initialPick !== R.pickAtRead) R.notes.push(`the card on arrival belonged to "${initialPick}" while the archive showed "${R.pickAtRead}" pressed`);
    for (const o of options) {
      if (o.visible) { o.text = o.visible; o.learnedByTap = false; continue; }
      if (!CARD[reg] || o.disabled) { o.text = ''; o.learnedByTap = false; continue; }
      if (o.purpose === initialPick && initialCard) { o.text = initialCard; o.learnedByTap = false; o.readOnCard = true; continue; }
      // the page's data mirror updates before the card re-renders, so after the tap wait for the card's words to change.
      // A tap that fails, or a card that does not answer, leaves that ring's words unknown: the ring is not scored and
      // the run goes on (a dying learning tap must not discard everything else this register gathered)
      const before = await visibleText(page, CARD[reg]);
      o.learnedByTap = true;
      try { await pressControl(page, reg, o.purpose); } catch (e) { R.unsound.push(`tapping the ${o.purpose} ring failed (${errText(e)}): that ring's words are unknown to the instrument, not scored`); o.text = ''; o.stale = true; R.failedTaps++; continue; }
      // the card's words under the same rule as "before", so only a real change counts
      const changed = await page.waitForFunction(new Function('a', `const t = (${VISIBLE_WORDS.toString()})([a[0], false, null]); return !!t && t !== a[1];`), [CARD[reg], before], { timeout: 3000 }).then(() => true, () => false);
      if (!changed) { R.unsound.push(`the card did not change within 3 s after tapping ${o.purpose}: that ring's words are unknown to the instrument, not scored`); o.text = ''; o.stale = true; R.failedTaps++; continue; }
      o.text = await visibleText(page, CARD[reg]);
      R.learnTaps++; // a learning tap is one that revealed a card
    }
    R.controlsReadableWithoutTap = options.filter(o => !o.learnedByTap && o.text).length;
    R.pressedCardReadFree = options.some(o => o.readOnCard);
    // every card the visitor read — the pressed ring's, shown on arrival, and the ones reached by a tap —
    // carries words the visitor had to read: they count, in one bucket, whichever ring happened to be pressed
    const cardsRead = options.filter(o => o.readOnCard || o.learnedByTap).map(o => o.text).join(' ');
    R.leakage.cardsRead = leak(cardsRead); // the front figure is the sum of frontBeforeTaps and cardsRead, computed where it is printed
    R.readMs = Date.now() - tRead; // instrument time spent reading and learning, printed beside the first-file figure
    const declared = await page.evaluate(m => (eval(m)?.purposes || []).map(p => ({ id: p.id, offered: p.offered, rail: p.rail, terms: p.terms })), MODEL);
    // own-wallet wording is looked for everywhere the visitor can read it, without counting a sentence twice; the
    // controls' hit is labelled by how the visitor reached THAT control's words (a tap, the card already showing, the
    // control itself), not by whether any control needed a tap
    const ctrlHit = options.map(o => ({ o, s: o.text ? ownWalletSentence(o.text) : null })).find(x => x.s) || null;
    const ownWhere = {
      'front outside the controls': ownWalletSentence(frontOutside),
      [ctrlHit?.o.learnedByTap ? 'controls (after a tap)' : ctrlHit?.o.readOnCard ? 'controls (on the card already showing)' : 'controls']: ctrlHit ? ctrlHit.s : null,
      archive: ownWalletSentence(archive),
    };
    R.funding = {
      foreverDeclaredPayer: (declared.find(p => p.id === 'forever') || {}).terms?.payer ?? null,
      visibleOwnWalletWording: Object.values(ownWhere).some(Boolean),
      ownWalletWordingWhere: Object.keys(ownWhere).filter(k => ownWhere[k]),
      ownWalletSentences: Object.fromEntries(Object.entries(ownWhere).filter(([, s]) => s)),
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
        chose: pick ? pick.purpose : null, control: pick ? cut(pick.text, 160) : null, learnedByTap: pick ? !!pick.learnedByTap : null, readOnCard: pick ? !!pick.readOnCard : null, score: p.score,
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
          payerStated: /\b(pay|pays|paid|paying|wallet)\b|\bpayer (?!(?:undefined|null|none)\b)(?![—\-·](?:\s|$))\S+/.test(t), // bee/raver say it in prose; cypherpunk prints "payer <value>" — any real value counts, an empty one ("undefined", "none") does not
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
        // if the chosen purpose is already the pressed one when the add begins, this press only confirms it: counted,
        // and said so. (page.click checks that the control receives the pointer at the action point, so the press is
        // known to have landed even though it changes nothing. In raver the learning taps move the pick, so the press
        // is a confirming one only if keep happened to be the last ring learned; the flag is computed, not assumed.)
        confirmingPress = (await pressedMode(page)) === keep.purpose;
        await pressControl(page, reg, keep.purpose);
        steps++;
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click(ADD[reg], CLICK).then(() => { steps++; })]);
        // the file picker is the device's dialog, not a press on the page: it is counted apart from the presses
        await chooser.setFiles({ name: 'stranger-note.txt', mimeType: 'text/plain', buffer: Buffer.from('a note from a stranger', 'utf8') });
        // the page's own truth only (a row painted into the archive, or the body's file state): the mirror's count can
        // arrive a few ms before the row is painted, and the archive is read "with the row showing" right after this
        await page.waitForFunction(() => document.querySelector('#list').children.length > 0 || document.body.dataset.state === 'file', null, { timeout: 15000 });
        const tStored = Date.now(); // the clock stops the moment the row is observed stored, before any further reads
        // the receipt reads the index itself, not the debounced mirror (which can miss the change and never catch up).
        // __myspace.rows() is the page's own loadRows, which would also migrate a legacy row it found; this context is
        // always cold (one file, written by this run), so there is nothing for it to migrate and it writes nothing
        const stored = await page.evaluate(() => window.__myspace.rows().then(r => r.map(x => ({ purpose: x.purpose, scheme: x.addr && x.addr.scheme }))));
        if (!stored.length) throw new Error('the page showed a stored row but the index has none');
        if (!stored.some(x => x.purpose === keep.purpose)) throw new Error(`the file was stored under "${stored.map(x => x.purpose).join('/')}", not the pressed "${keep.purpose}"`); // a wrong purpose is never recorded silently
        const archivePressed = await pressedMode(page);
        // the archive is read again now that a row exists: the row's own words are what the visitor reads to find the remove control
        R.leakage.archiveWithRow = leak(await visibleTextAll(page, 'main > :not(#eternal)'));
        phase = 'after-add'; // the add's own wire is copied only after its phase has ended, so nothing lands after the copy
        R.firstFile = { ok: true, purposeChosen: keep.purpose, archivePressedAfterAdd: archivePressed, stored, steps, confirmingPress, picker: true, ms: tStored - t0, addMs: tStored - tAdd, pageMs: R.loadMs + (tStored - tAdd), statusShown: await visibleText(page, '#status'), networkDuringAdd: [...wire.add].sort() };
      } catch (e) {
        phase = 'after-add';
        R.firstFile = { ok: false, purposeChosen: keep.purpose, steps, confirmingPress, ms: Date.now() - t0, error: errText(e), networkDuringAdd: [...wire.add].sort() };
        R.unsound.push(`the first file did not land: ${errText(e)}`);
      }
      await page.waitForTimeout(250); // a follow-up request to the add belongs here, not to the remove
    } else {
      // a measured result, not an instrument failure: the page's words led nowhere, or offered no control at all
      R.firstFile = { ok: false, measured: true, steps: 0, ms: Date.now() - t0, error: !options.length ? 'no purpose controls rendered' : `no usable control's words led to keep (top score ${keepPick.score}${keepPick.tied ? ', tied ' + keepPick.tied.join('/') : ''})` };
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
      // its words under the one visibility rule, or its accessible name when it shows only an icon
      const rm = candidates ? { text: await rmLoc.first().evaluate(new Function('el', SEEN_TEXT + ` return wordsIn(el, null) || (el.getAttribute('aria-label') || '').trim();`)), candidates } : null;
      if (!rm) {
        // no match: print every rendered control on the rows, so a reader can tell a product gap from an instrument vocabulary miss
        const rowControls = await page.evaluate(new Function(SEEN_TEXT + ` return [...document.querySelectorAll('#list button, #list a, #list [role=button]')].filter(seen).map(el => wordsIn(el, null) || (el.getAttribute('aria-label') || '').trim());`));
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
        } catch (e) { phase = 'after-remove'; R.remove = { control: rm.text, candidates: rm.candidates, ok: false, error: errText(e), networkDuringRemove: [...wire.remove].sort() }; R.unsound.push(`the remove did not complete: ${errText(e)}`); await page.waitForTimeout(250); }
      }
      // RECOVER: does anything rendered on the page offer to bring it back? (rendered = has a box; the page is
      // taller than the viewport, so this is "on the page", not "in view without scrolling")
      // Only the page's own controls count: the estate's tour bar carries a "recover" link that is
      // about KEY recovery (surfaces/recover.html), and a stranger who followed it would not get
      // their file back. Anything inside #tbar or pointing at recover.html is excluded by name.
      const rec = await page.evaluate(new Function(SEEN_TEXT + `
        // the one visibility rule (a position:fixed undo toast has no offsetParent and must still count), anywhere on
        // the page but the tour bar; the control's own words and its accessible name are both read, so an icon
        // button named "Undo" counts
        const els = [...document.querySelectorAll('button, a, [role=button], summary')].filter(el => seen(el) && !el.closest('#tbar') && !/recover\\.html/.test(el.getAttribute('href') || ''));
        const words = el => (wordsIn(el, null) + ' ' + (el.getAttribute('aria-label') || '')).trim();
        const hit = els.find(el => /\\b(undo|restore|recover)\\b|\\b(bring|put|get)\\b[^.]{0,40}?\\bback\\b/i.test(words(el)));
        return hit ? words(hit) : null;`));
      // the tour bar's "recover" link: present in the DOM, and actually on screen at this width? The bar's
      // link strip scrolls and is masked at 390 px, so presence alone would overstate what a visitor sees.
      // "on screen" = at least half of the link's width lies inside both the viewport and its scrolling strip,
      // and the centre of that visible part hits the link itself (not the bar's overflow button or a mask edge)
      const tourBar = await page.evaluate(() => {
        const a = [...document.querySelectorAll('#tbar a')].find(a => /recover/i.test(a.innerText || ''));
        if (!a) return { present: false, onScreen: false, visibleFraction: 0 };
        const b = a.getBoundingClientRect();
        const stripEl = a.closest('#tlinks'); const strip = stripEl?.getBoundingClientRect() || { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
        // the strip fades its last pixels to transparent with a mask (hit-testing ignores masks): that fade is not readable
        const mask = stripEl ? (getComputedStyle(stripEl).maskImage || getComputedStyle(stripEl).webkitMaskImage || '') : '';
        const fade = /calc\(100% - (\d+)px\)/.exec(mask); const fadePx = fade ? +fade[1] : 0;
        const L = Math.max(b.left, strip.left, 0), R = Math.min(b.right, strip.right - fadePx, innerWidth), T = Math.max(b.top, strip.top, 0), B = Math.min(b.bottom, strip.bottom, innerHeight);
        const frac = b.width > 0 && R > L && B > T ? (R - L) / b.width : 0;
        const hit = frac >= 0.5 && (() => { const e = document.elementFromPoint((L + R) / 2, (T + B) / 2); return !!e && (e === a || a.contains(e)); })();
        return { present: true, onScreen: hit, visibleFraction: Math.round(frac * 100) / 100 };
      });
      R.recover = { control: rec, offered: !!rec, tourBarKeyRecoveryLinkPresent: tourBar.present, tourBarKeyRecoveryLinkOnScreen: tourBar.onScreen, tourBarKeyRecoveryLinkVisibleFraction: tourBar.visibleFraction };
    }
  } catch (e) {
    // the run died: keep everything gathered so far and say where it stopped
    R.unsound.push(`run aborted during ${phase}: ${errText(e)}`);
    if (!R.firstFile) R.firstFile = { ok: false, steps: 0, ms: Date.now() - t0, error: `instrument aborted during ${phase}` };
  } finally {
    // the wire log is copied only after the context has closed, so a request fired at teardown is kept too
    phase = 'done';
    if (ctx) { await ctx.pages()[0]?.waitForTimeout(250).catch(() => {}); await ctx.close().catch(() => {}); }
    for (const [k, v] of Object.entries(wire)) if (v.size) R.wire[k] = [...v].sort();
  }
  return R;
}

// a failed or unreliable measurement: no first file, an aborted run, a remove that errored, a ring that could not be
// learned, a page that never became ready or never took the register, an offered set still changing at the cap.
// One predicate, used by the table's row marker and the exit code alike.
// (a first file that failed because the page's words led nowhere is a measured result, not an unsound run).
// Unsoundness is recorded as data where it is detected (R.unsound) and read from there alone.
const unsound = r => r.unsound.length > 0;
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
  process.stderr.write(`${reg.padEnd(11)} ${unsound(r) ? 'UNSOUND | ' : ''}offered ${r.offered.join(',') || 'none'}${r.offered.length !== s.offered ? ' (' + r.offered.length + ' rendered, ' + s.offered + ' declared)' : ''} | readable without a tap ${r.controlsReadableWithoutTap}/${r.offered.length} | wrong choice ${s.wrong}/${s.offered} | first file ${r.firstFile?.ok ? r.firstFile.steps + ' presses+picker ' + r.firstFile.ms + 'ms' : (r.firstFile?.measured ? 'no file: ' : 'FAILED (instrument): ') + r.firstFile?.error} | remove ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | recover ${r.recover ? (r.recover.offered ? 'offered' : 'none') : '—'} | leak front ${s.leakFront} (cards ${s.leakCards}) archive ${s.leakArchive}/${s.leakArchiveWithRow ?? '—'} | own-wallet wording ${r.funding.visibleOwnWalletWording}\n`);
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
  L.push(`| ${r.reg}${unsound(r) ? ' **(unsound, see notes)**' : ''} | ${r.offered.join(', ') || 'none'}${r.offered.length !== s.offered ? ` (${r.offered.length} rendered, ${s.offered} declared offered)` : ''} | ${r.controlsReadableWithoutTap ?? '—'}/${r.offered.length}${r.learnTaps ? ' (' + r.learnTaps + ' taps to learn the rest)' : ''} | ${s.wrong}/${s.offered} | ${s.nowhere} | ${r.firstFile?.ok ? `${r.firstFile.steps}${r.firstFile.confirmingPress ? ' (1 confirming the already-pressed purpose)' : ''} (+ picker) · page ${r.firstFile.pageMs} (load ${r.loadMs} + the add itself ${r.firstFile.addMs}) · whole run ${r.firstFile.ms} (instrument ${r.settleMs} settle + ${r.readMs} reading)` : r.firstFile?.measured ? `no file: ${r.firstFile.error}` : 'FAILED (instrument)'} | ${r.firstFile?.networkDuringAdd?.length ? '**' + r.firstFile.networkDuringAdd.length + ' request(s)**' : 'none'} | ${r.remove ? (r.remove.networkDuringRemove?.length ? '**' + r.remove.networkDuringRemove.length + ' request(s)**' : 'none') : '—'} | ${lt('now')} / ${lt('forever')} | ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | ${r.remove?.ok ? yn(r.remove.outcomeStated) : '—'} | ${r.remove?.ok ? yn(r.remove.finalityBeforeConfirm) + ' / ' + yn(r.remove.finalityAfter) : '—'} | ${r.recover ? yn(r.recover.offered) : '—'} | ${s.leakFront}${s.leakCards ? ' (' + s.leakCards + ' on the cards)' : ''}${r.reg === 'cypherpunk' ? ' (declared voice)' : ''} | ${s.leakArchive} / ${s.leakArchiveWithRow ?? '—'} | ${r.funding.visibleOwnWalletWording ? 'y (' + r.funding.ownWalletWordingWhere.join('; ') + ')' : 'n'} | ${r.funding.foreverDeclaredPayer ?? '—'} |`);
}
L.push('');
L.push('## Receipts');
L.push('');
for (const r of results) {
  L.push(`### ${r.reg}`);
  L.push(`- controls readable without a tap: ${r.controlsReadableWithoutTap ?? '—'} of ${r.offered.length}${r.pressedCardReadFree ? " (the pressed ring's card was already on the page)" : ''}${r.learnTaps ? `; ${r.learnTaps} carry no words of their own and were learned by tapping each and reading the card` : ''}${r.failedTaps ? `; ${r.failedTaps} could not be learned (tap failed or the card did not answer; see notes)` : ''}`);
  for (const [id, t] of Object.entries(r.terms)) L.push(`- terms on the ${id} control before the choice: lifetime ${t.lifetimeStated ? 'stated' : 'not stated'}, readers ${t.readersStated ? 'stated' : 'not stated'}, payer ${t.payerStated ? 'stated' : 'not stated'}`);
  for (const c of r.choices) L.push(`- "${c.ask}" → ${c.offered ? (c.chose ? `chose **${c.chose}**${c.wrong ? ' (WRONG, meant ' + c.means + ')' : ''} (score ${c.score}) via "${line(c.control)}"${c.learnedByTap ? ' (read on the card after tapping the ring)' : c.readOnCard ? ' (read on the card the pressed ring already showed)' : ''}` : `the words led nowhere (top score ${c.score}${c.tied ? ', tied between ' + c.tied.join(' / ') : ''})`) : 'not offered on this page'}${c.offered && c.usable === false ? ' — the control for this purpose is disabled or unreadable, so it could not be chosen' : ''}`);
  if (r.firstFile) L.push(`- first file: ${r.firstFile.ok ? `stored under ${r.firstFile.purposeChosen} (rows: ${JSON.stringify(r.firstFile.stored)}; archive pressed after add (the page resets to the most private purpose): ${r.firstFile.archivePressedAfterAdd}) in ${r.firstFile.steps} presses on the page${r.firstFile.confirmingPress ? ' (the first only confirmed ' + r.firstFile.purposeChosen + ', already pressed on arrival)' : ''} plus the file picker${r.learnTaps ? ' (after ' + r.learnTaps + ' taps to learn the rings)' : ''}, ${r.firstFile.ms} ms from page open to the row observed stored: ${r.loadMs} ms until the fronts were ready in this register, ${r.settleMs} ms of the instrument waiting for the offered purposes and the pressed one to hold still, ${r.readMs} ms of the instrument reading the page and learning the controls, ${r.firstFile.addMs} ms for the add itself from the purpose press to the row (the press, the add press, the picker and their round-trips through the harness are inside it), and the rest between those (${r.setupMs} ms of browser-context setup before the open is not counted)${r.firstFile.statusShown ? '; status shown: "' + r.firstFile.statusShown.slice(0, 120) + '"' : '; no status sentence shown'}` : (r.firstFile.measured ? 'no file, measured: ' : 'FAILED (instrument): ') + r.firstFile.error}${r.firstFile.networkDuringAdd?.length ? `; **requests attempted during the add: ${r.firstFile.networkDuringAdd.join(', ')}** (aborted by the harness)` : '; no request left the page during the add'}`);
  if (r.remove) L.push(`- remove: ${r.remove.ok ? `control "${line(r.remove.control)}" (${r.remove.candidates} visible) → sentence "${line(r.remove.sentence)}" (finality word: ${r.remove.finalityBeforeConfirm ? '"' + r.remove.finalityBeforeConfirm + '"' : 'none'}) → confirm "${line(r.remove.confirm)}" → outcome "${line(r.remove.outcome) || '(nothing stated)'}" (finality word: ${r.remove.finalityAfter ? '"' + r.remove.finalityAfter + '"' : 'none'})` : (r.remove.note || r.remove.error)}${r.remove.networkDuringRemove?.length ? `; **requests attempted during the remove: ${r.remove.networkDuringRemove.join(', ')}** (aborted by the harness)` : '; no request left the page during the remove'}`);
  if (r.recover) L.push(`- recover: ${r.recover.offered ? `offered as "${r.recover.control}"` : 'nothing rendered on the page offers to bring a removed file back'}${r.recover.tourBarKeyRecoveryLinkPresent ? `; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (${r.recover.tourBarKeyRecoveryLinkOnScreen ? 'on screen at this width' : 'in the bar\'s strip but NOT on screen at this width without scrolling the bar'}; ${Math.round(r.recover.tourBarKeyRecoveryLinkVisibleFraction * 100)}% of its width inside the viewport and the strip)` : ''}`);
  L.push(`- leak words in the front (read with purpose "${r.pickAtRead}" pressed): ${JSON.stringify(r.leakage.frontBeforeTaps)}${r.pressedCardReadFree || r.learnTaps ? `; on the cards the visitor read (the pressed ring's and the ones reached by a tap): ${JSON.stringify(r.leakage.cardsRead)}` : ''}; rail and network words the page declared and that joined the vocabulary: ${r.railWords.join(', ') || 'none'}; in the shared archive below while empty: ${JSON.stringify(r.leakage.archive)}${r.leakage.archiveWithRow ? `; with the stored row showing: ${JSON.stringify(r.leakage.archiveWithRow)}` : ''}`);
  L.push(`- funding: own-wallet wording visible ${r.funding.visibleOwnWalletWording}${r.funding.visibleOwnWalletWording ? ' (' + Object.entries(r.funding.ownWalletSentences || {}).map(([k, s]) => `${k}: "${s.slice(0, 100)}"`).join('; ') + ')' : ''}; the forever rail declares payer = ${r.funding.foreverDeclaredPayer ?? 'none (not offered)'}`);
  for (const [ph, hosts] of Object.entries(r.wire)) L.push(`- cross-origin attempted during ${ph} (aborted): ${hosts.join(', ')}`); // every phase, nothing dropped
  if (r.unsound.length) L.push(`- **unsound:** ${r.unsound.join(' | ')}`);
  if (r.notes.length) L.push(`- notes: ${r.notes.join(' | ')}`);
  L.push('');
}
process.stdout.write(L.join('\n') + '\n');
if (OUT) await writeFile(OUT, JSON.stringify({ revision: REVISION, results }, null, 1));
if (results.some(unsound)) process.exitCode = 1;
