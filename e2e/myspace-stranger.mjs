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
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); const v = i > 0 ? process.argv[i + 1] : undefined; return v === undefined || v.startsWith('--') ? d : v; };

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

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)));
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
  // options: [{purpose, text}] — score each control's words against the intent.
  // A choice is only a choice when exactly one control leads: a zero score or a tie is
  // reported as "the words led nowhere", never as the first control in the DOM.
  const scored = options.map(o => {
    const t = o.text.toLowerCase();
    let score = 0;
    for (const k of intent.words) if (hasWord(t, k)) score += 2;
    for (const [other, ks] of Object.entries(STRONG)) if (other !== intent.id) for (const k of ks) if (hasWord(t, k)) score -= 1;
    return { ...o, score };
  });
  const top = Math.max(...scored.map(s => s.score));
  const leaders = scored.filter(s => s.score === top);
  if (top <= 0 || leaders.length > 1) return { none: true, score: top, tied: leaders.length > 1 ? leaders.map(l => l.purpose) : null };
  return leaders[0];
}
// implementation vocabulary, counted as whole words (singular or plural): "trail" is not "rail", "gasp" is not "gas"
const LEAK = ['adapter', 'rail', 'worker', 'indexeddb', 'aes', 'schnorr', 'blossom', 'ant', 'autonomi', 'nostr', 'relay', 'datamap', 'chunk', 'digest', 'sha-?\\d*', 'signer', 'wallet', 'gas', 'token', 'scheme', 'predicate', 'ciphertext', 'keyref', 'pubkey'];
const countLeak = text => { const t = text.toLowerCase(); const hits = {}; for (const k of LEAK) { const n = (t.match(new RegExp('\\b' + k + 's?\\b', 'g')) || []).length; if (n) hits[k.startsWith('sha') ? 'sha' : k] = n; } return hits; };
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
// finality: the words that say a removed file is not coming back. "gone" and "permanent" also occur in
// lifetime clauses, so the matched word is printed and a reader judges it.
const FINAL = /gone|cannot|can't|no way back|for good|permanent|not .*undo|nowhere else|anywhere else|no longer|will not exist|won't exist/i;
const OWN = /your wallet|you pay|own wallet/i;

// text a visitor can read: a hidden element, or one that is not rendered (no box), contributes nothing.
// "rendered" is not "in view without scrolling": the page is taller than the viewport.
// (getClientRects, not offsetParent — the confirmation sheet is position:fixed and has no offsetParent)
async function visibleText(page, sel) {
  return page.evaluate(s => { const el = document.querySelector(s); return el && !el.hidden && el.getClientRects().length > 0 ? (el.innerText || el.textContent || '') : ''; }, sel);
}
async function visibleTextAll(page, sel) {
  return page.evaluate(s => [...document.querySelectorAll(s)].filter(el => !el.hidden && el.getClientRects().length > 0).map(el => el.innerText || el.textContent || '').join('\n'), sel);
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
    await page.locator('#etOrbits').scrollIntoViewIfNeeded();
    const pt = await page.evaluate(p => { const svg = document.querySelector('#etOrbits'); const b = svg.getBoundingClientRect(); const k = b.width / 400; const r = +svg.querySelector(`.orbit[data-et-purpose="${p}"] .hit`).getAttribute('r'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 - r * k }; }, purpose);
    if (!(pt.x >= 0 && pt.x < VIEW.width && pt.y >= 0 && pt.y < VIEW.height)) throw new Error(`the ${purpose} ring's tap point (${pt.x | 0},${pt.y | 0}) is outside the ${VIEW.width}×${VIEW.height} viewport`);
    await page.touchscreen.tap(pt.x, pt.y);
  } else await page.click(`${CONTROLS[reg]}[data-et-purpose="${purpose}"]`, CLICK);
  await page.waitForFunction(p => window.__eternal.data.pick === p, purpose, { timeout: 5000 });
}

const CLICK = { timeout: 5000 }; // no press waits longer than the other waits in this file
async function stranger(reg) {
  // the record is built before anything can fail, so a run that dies keeps what it had gathered
  const R = { reg, revision: REVISION, wire: {}, offered: [], controlsReadableWithoutTap: null, learnTaps: 0, choices: [], firstFile: null, terms: {}, remove: null, recover: null, leakage: { front: {}, archive: {} }, funding: { foreverDeclaredPayer: null, visibleOwnWalletWording: false, ownWalletWordingWhere: [] }, settleMs: 0, pickAtRead: null, notes: [] };
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
    await page.goto(`${base}/surfaces/myspace.html`, { waitUntil: 'load', timeout: 30000 }).catch(e => R.notes.push('load: ' + e.message.split('\n')[0]));
    try {
      await page.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.purposes.some(x => x.offered), null, { timeout: 20000 });
    } catch { R.notes.push('the fronts never became ready with an offered purpose (no rail attached offline?)'); }
    // rails attach one by one and the pressed purpose follows the first open one, so the front's
    // text (cypherpunk's write path in particular) depends on WHEN it is read. Wait until the set
    // of offered purposes and the pressed one have held still for 250 ms (a purpose that is
    // legitimately never offered does not hold the wait; 5 s cap), then record what was read under.
    // (polled from this side; the instrument writes nothing into the page it measures)
    const tSettle = Date.now(); let sig = null, since = tSettle;
    for (;;) {
      const now = await page.evaluate(() => { const d = window.__eternal?.data; return d ? d.purposes.map(x => x.id + ':' + x.offered).join(',') + '|' + d.pick : null; });
      if (now !== sig) { sig = now; since = Date.now(); }
      else if (now !== null && Date.now() - since >= 250) break;
      if (Date.now() - tSettle > 5000) { R.notes.push('the offered purposes kept changing for 5 s; the front was read as it stood'); break; }
      await page.waitForTimeout(50);
    }
    R.settleMs = Date.now() - tSettle; // instrument time, counted inside "ms from open" and printed beside it
    R.pickAtRead = await page.evaluate(() => window.__eternal?.data?.pick ?? null);

    phase = 'read';
    // what the stranger can see: the register's front, and the whole shared archive below the
    // fronts (every child of main except the fronts, visible text only)
    const front = await visibleText(page, FRONT[reg]);
    const archive = await visibleTextAll(page, 'main > :not(#eternal)');
    R.leakage = { frontBeforeTaps: countLeak(front), front: countLeak(front), cardsRead: {}, archive: countLeak(archive), archiveWithRow: null };
    // the purpose controls: their own visible words, and separately what they tell a screen reader
    const options = await page.evaluate(sel => [...document.querySelectorAll(sel)].map(el => ({
      purpose: el.getAttribute('data-et-purpose'),
      visible: (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      aria: el.getAttribute('aria-label') || '',
      disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    })), CONTROLS[reg]);
    R.offered = options.map(o => o.purpose);
    // the front's words outside the controls, read now, before any learning tap changes the card
    const frontOutside = await visibleTextOutside(page, FRONT[reg], CONTROLS[reg]);
    // a control with no words of its own is learned by tapping it and reading the card that answers
    for (const o of options) {
      if (o.visible) { o.text = o.visible; o.learnedByTap = false; continue; }
      if (!CARD[reg] || o.disabled) { o.text = ''; o.learnedByTap = false; continue; }
      // the page's data mirror updates before the card re-renders, so after the tap wait for the
      // card's words to change (unless this ring was already the pressed one and nothing will change)
      const alreadyPressed = await page.evaluate(() => window.__eternal?.data?.pick) === o.purpose;
      const before = alreadyPressed ? null : (await visibleText(page, CARD[reg])).replace(/\s+/g, ' ').trim();
      await pressControl(page, reg, o.purpose); R.learnTaps++;
      if (before !== null) await page.waitForFunction(([sel, b]) => { const el = document.querySelector(sel); const t = (el?.innerText || '').replace(/\s+/g, ' ').trim(); return !!t && t !== b; }, [CARD[reg], before], { timeout: 3000 }).catch(() => R.notes.push(`the card did not change within 3 s after tapping ${o.purpose}`));
      o.text = (await visibleText(page, CARD[reg])).replace(/\s+/g, ' ').trim(); o.learnedByTap = true;
    }
    R.controlsReadableWithoutTap = options.filter(o => !o.learnedByTap && o.text).length;
    // the words read on the cards during the learning taps are words the visitor had to read: they count
    const cardsRead = options.filter(o => o.learnedByTap).map(o => o.text).join(' ');
    R.leakage.cardsRead = countLeak(cardsRead);
    R.leakage.front = countLeak(front + ' ' + cardsRead);
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
      const p = options.length ? pickByWords(intent, options) : null;
      picks[intent.id] = p;
      const pick = p && !p.none ? p : null;
      const wanted = declared.find(p => p.id === intent.id);
      R.choices.push({
        ask: intent.ask, means: intent.id,
        offered: !!(wanted && wanted.offered),
        chose: pick ? pick.purpose : null, control: pick ? pick.text.slice(0, 120) : null, learnedByTap: pick ? pick.learnedByTap : null, score: p ? p.score : null,
        tied: p && p.tied ? p.tied : null,
        wrong: pick ? pick.purpose !== intent.id : null,
      });
      // TERMS proxy: is a lifetime / readers sentence on the control (or its card) before the choice?
      if (pick && pick.purpose === intent.id) {
        const t = pick.text.toLowerCase();
        R.terms[intent.id] = {
          lifetimeStated: /\b(gone|closes|session|stays|until|forever|permanent|lasts|drop|remove)\b/.test(t),
          readersStated: /only this phone|this phone only|this device|\b(link|anyone|everyone|readers)\b/.test(t),
          payerStated: /\b(pay|pays|paid|payer|paying|wallet)\b/.test(t), // not "nobody"/"hive": those also occur in the deletable and lifetime clauses
        };
      }
    }

    // FIRST FILE: the stranger wants to keep a photo on this phone. Chooses by words, presses add, picks a file.
    const keepPick = picks.keep;
    const keep = keepPick && !keepPick.none ? keepPick : null;
    let steps = 0;
    if (keep && !keep.disabled) {
      phase = 'add';
      try {
        await pressControl(page, reg, keep.purpose);
        steps++;
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click(ADD[reg], CLICK)]);
        steps++;
        // the file picker is the device's dialog, not a press on the page: it is counted apart from the presses
        await chooser.setFiles({ name: 'stranger-note.txt', mimeType: 'text/plain', buffer: Buffer.from('a note from a stranger', 'utf8') });
        await page.waitForFunction(() => window.__eternal.data.count >= 1, null, { timeout: 15000 });
        const tStored = Date.now(); // the clock stops the moment the row is observed stored, before any further reads
        const stored = await page.evaluate(() => window.__myspace.rows().then(r => r.map(x => ({ purpose: x.purpose, scheme: x.addr && x.addr.scheme }))));
        const archivePressed = await page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') || null);
        // the archive is read again now that a row exists: the row's own words are what the visitor reads to find the remove control
        R.leakage.archiveWithRow = countLeak(await visibleTextAll(page, 'main > :not(#eternal)'));
        R.firstFile = { ok: true, purposeChosen: keep.purpose, archivePressedAfterAdd: archivePressed, stored, steps, picker: true, ms: tStored - t0, statusShown: await visibleText(page, '#status'), networkDuringAdd: [...wire.add].sort() };
      } catch (e) {
        R.firstFile = { ok: false, purposeChosen: keep.purpose, steps, ms: Date.now() - t0, error: String(e.message).split('\n')[0], networkDuringAdd: [...wire.add].sort() };
      }
      phase = 'after-add';
    } else {
      R.firstFile = { ok: false, steps: 0, ms: Date.now() - t0, error: !options.length ? 'no purpose controls visible' : keep ? 'chosen control disabled' : `no control's words led to keep (top score ${keepPick.score}${keepPick.tied ? ', tied ' + keepPick.tied.join('/') : ''})` };
    }

    // REMOVE: find a visible remove control on the stored row, read the confirmation, confirm, check the outcome is stated.
    if (R.firstFile?.ok) {
      phase = 'remove';
      // only a rendered control (one with a box) counts. It is selected with a playwright locator and
      // pressed through playwright's actionability checks: nothing is written into the page (the
      // page observes attribute changes on #list and would re-render its fronts on a tag write)
      const rmLoc = page.locator('#list button, #list a, #list [role=button]').filter({ hasText: /\b(remove|delete|drop|bin|trash)\b/i }).locator('visible=true');
      const candidates = await rmLoc.count();
      const rm = candidates ? { text: (await rmLoc.first().innerText()).trim(), candidates } : null;
      if (!rm) {
        // the whole-space list may be below the fold; cypherpunk's front points at "the rows below"
        R.remove = { control: null, ok: false, note: 'no rendered remove control on the stored row', networkDuringRemove: [...wire.remove].sort() };
        phase = 'after-remove';
      } else {
        try {
          const statusBefore = (await visibleText(page, '#status')).trim(); // the outcome must be a NEW sentence, not the add's leftover
          await rmLoc.first().click(CLICK);
          await page.waitForSelector('#del-body', { state: 'visible', timeout: 5000 });
          const sentence = (await visibleText(page, '#del-body')).trim();
          const confirmText = (await visibleText(page, '#delConfirm')).trim();
          await page.click('#delConfirm', CLICK);
          await page.waitForFunction(() => window.__eternal.data.count === 0, null, { timeout: 10000 });
          const after = (await visibleText(page, '#status')).trim();
          const removeWire = [...wire.remove].sort();
          phase = 'after-remove';
          await page.waitForTimeout(250); // let the post-delete render and any adapter follow-up reach the after-remove log
          const fin = t => (t.match(FINAL) || [null])[0];
          R.remove = { control: rm.text, candidates: rm.candidates, sentence, confirm: confirmText, ok: true, outcomeStated: !!after && after !== statusBefore, outcome: after.slice(0, 160), finalityBeforeConfirm: fin(sentence), finalityAfter: fin(after), networkDuringRemove: removeWire };
        } catch (e) { R.remove = { control: rm.text, candidates: rm.candidates, ok: false, error: String(e.message).split('\n')[0], networkDuringRemove: [...wire.remove].sort() }; phase = 'after-remove'; }
      }
      // RECOVER: does anything rendered on the page offer to bring it back? (rendered = has a box; the page is
      // taller than the viewport, so this is "on the page", not "in view without scrolling")
      // Only the page's own controls count: the estate's tour bar carries a "recover" link that is
      // about KEY recovery (surfaces/recover.html), and a stranger who followed it would not get
      // their file back. Anything inside #tbar or pointing at recover.html is excluded by name.
      const rec = await page.evaluate(() => {
        // same rendered rule as everywhere else (client rects): a position:fixed undo toast has no offsetParent and must still count
        const els = [...document.querySelectorAll('main button, main a, main [role=button], main summary, .sheet button, body > button, body > [role=button]')].filter(el => !el.hidden && el.getClientRects().length > 0 && !el.closest('#tbar') && !/recover\.html/.test(el.getAttribute('href') || ''));
        const hit = els.find(el => /\b(undo|restore|recover)\b|bring .* back|put .* back|get .* back/i.test(el.innerText || el.getAttribute('aria-label') || ''));
        return hit ? (hit.innerText || hit.getAttribute('aria-label')).trim() : null;
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
    R.notes.push(`run aborted during ${phase}: ${String(e.message).split('\n')[0]}`);
    if (!R.firstFile) R.firstFile = { ok: false, steps: 0, ms: Date.now() - t0, error: `instrument aborted during ${phase}` };
  } finally {
    phase = 'done';
    for (const [k, v] of Object.entries(wire)) if (v.size) R.wire[k] = [...v].sort();
    if (ctx) await ctx.close().catch(() => {});
  }
  return R;
}

// one summary per result, used by the stderr line and the table alike
const summarize = r => {
  const offered = r.choices.filter(c => c.offered);
  return { wrong: offered.filter(c => c.wrong).length, offered: offered.length, nowhere: offered.filter(c => c.chose === null).length, leakFront: sum(r.leakage.front), leakCards: sum(r.leakage.cardsRead), leakArchive: sum(r.leakage.archive), leakArchiveWithRow: r.leakage.archiveWithRow ? sum(r.leakage.archiveWithRow) : null };
};

const results = [];
for (const reg of REGS) {
  const r = await stranger(reg);
  results.push(r);
  const s = summarize(r);
  process.stderr.write(`${reg.padEnd(11)} offered ${r.offered.join(',') || 'none'} | readable without a tap ${r.controlsReadableWithoutTap}/${r.offered.length} | wrong choice ${s.wrong}/${s.offered} | first file ${r.firstFile?.ok ? r.firstFile.steps + ' presses+picker ' + r.firstFile.ms + 'ms' : 'FAILED: ' + r.firstFile?.error} | remove ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | recover ${r.recover ? (r.recover.offered ? 'offered' : 'none') : '—'} | leak front ${s.leakFront} (cards ${s.leakCards}) archive ${s.leakArchive}/${s.leakArchiveWithRow ?? '—'} | own-wallet wording ${r.funding.visibleOwnWalletWording}\n`);
}
await browser.close(); server.close();

const L = [];
L.push(`# MY SPACE — the stranger instrument, ${results.length} registers at ${VIEW.width}×${VIEW.height}, revision ${REVISION}`);
L.push('');
L.push('Machine-measured. CHOICE, FIRST FILE, REMOVE, RECOVER, LEAKAGE and FUNDING are observed behaviour and visible wording. TERMS is a proxy (the sentence is on the control, or on its card after a tap, before the choice), not comprehension. Task completion rate and comprehension of temporary vs forever are not measured here: they need people.');
L.push('');
L.push('| register | purposes offered | controls readable without a tap | wrong choice (of offered) | led nowhere | first file: page presses (+ the file picker) · ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front (incl. cards read) | leak words in archive (empty / with the stored row) | own-wallet wording visible | forever payer (declared) |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const s = summarize(r);
  const lt = id => r.terms[id] ? (r.terms[id].lifetimeStated ? 'y' : 'n') : '—';
  const yn = v => v ? 'y' : 'n';
  L.push(`| ${r.reg} | ${r.offered.join(', ') || 'none'} | ${r.controlsReadableWithoutTap ?? '—'}/${r.offered.length}${r.learnTaps ? ' (' + r.learnTaps + ' taps to learn the rest)' : ''} | ${s.wrong}/${s.offered} | ${s.nowhere} | ${r.firstFile?.ok ? `${r.firstFile.steps} (+ picker) · ${r.firstFile.ms} (${r.settleMs} of it instrument settle)` : 'FAILED'} | ${r.firstFile?.networkDuringAdd?.length ? '**' + r.firstFile.networkDuringAdd.length + ' request(s)**' : 'none'} | ${r.remove ? (r.remove.networkDuringRemove?.length ? '**' + r.remove.networkDuringRemove.length + ' request(s)**' : 'none') : '—'} | ${lt('now')} / ${lt('forever')} | ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | ${r.remove?.ok ? yn(r.remove.outcomeStated) : '—'} | ${r.remove?.ok ? yn(r.remove.finalityBeforeConfirm) + ' / ' + yn(r.remove.finalityAfter) : '—'} | ${r.recover ? yn(r.recover.offered) : '—'} | ${s.leakFront}${s.leakCards ? ' (' + s.leakCards + ' on the cards)' : ''}${r.reg === 'cypherpunk' ? ' (declared voice)' : ''} | ${s.leakArchive} / ${s.leakArchiveWithRow ?? '—'} | ${r.funding.visibleOwnWalletWording ? 'y (' + r.funding.ownWalletWordingWhere.join('; ') + ')' : 'n'} | ${r.funding.foreverDeclaredPayer ?? '—'} |`);
}
L.push('');
L.push('## Receipts');
L.push('');
for (const r of results) {
  L.push(`### ${r.reg}`);
  L.push(`- controls readable without a tap: ${r.controlsReadableWithoutTap ?? '—'} of ${r.offered.length}${r.learnTaps ? `; the other ${r.learnTaps} carry no words of their own and were learned by tapping each and reading the card` : ''}`);
  for (const c of r.choices) L.push(`- "${c.ask}" → ${c.offered ? (c.chose ? `chose **${c.chose}**${c.wrong ? ' (WRONG, meant ' + c.means + ')' : ''} (score ${c.score}) via "${c.control}"${c.learnedByTap ? ' (read on the card after tapping the ring)' : ''}` : `the words led nowhere (top score ${c.score}${c.tied ? ', tied between ' + c.tied.join(' / ') : ''})`) : 'not offered on this page'}`);
  if (r.firstFile) L.push(`- first file: ${r.firstFile.ok ? `stored under ${r.firstFile.purposeChosen} (rows: ${JSON.stringify(r.firstFile.stored)}; archive pressed after add (the page resets to the most private purpose): ${r.firstFile.archivePressedAfterAdd}) in ${r.firstFile.steps} presses on the page plus the file picker${r.learnTaps ? ' (after ' + r.learnTaps + ' taps to learn the rings)' : ''}, ${r.firstFile.ms} ms from page open to the row observed stored (of which ${r.settleMs} ms is the instrument waiting for the offered purposes and the pressed one to hold still before reading; ${r.setupMs} ms of browser-context setup before the open is not counted)${r.firstFile.statusShown ? '; status shown: "' + r.firstFile.statusShown.slice(0, 120) + '"' : '; no status sentence shown'}` : 'FAILED: ' + r.firstFile.error}${r.firstFile.networkDuringAdd?.length ? `; **requests attempted during the add: ${r.firstFile.networkDuringAdd.join(', ')}** (aborted by the harness)` : '; no request left the page during the add'}`);
  if (r.remove) L.push(`- remove: ${r.remove.ok ? `control "${r.remove.control}" (${r.remove.candidates} visible) → sentence "${r.remove.sentence}" (finality word: ${r.remove.finalityBeforeConfirm ? '"' + r.remove.finalityBeforeConfirm + '"' : 'none'}) → confirm "${r.remove.confirm}" → outcome "${r.remove.outcome || '(nothing stated)'}" (finality word: ${r.remove.finalityAfter ? '"' + r.remove.finalityAfter + '"' : 'none'})` : (r.remove.note || r.remove.error)}${r.remove.networkDuringRemove?.length ? `; **requests attempted during the remove: ${r.remove.networkDuringRemove.join(', ')}** (aborted by the harness)` : '; no request left the page during the remove'}`);
  if (r.recover) L.push(`- recover: ${r.recover.offered ? `offered as "${r.recover.control}"` : 'nothing rendered on the page offers to bring a removed file back'}${r.recover.tourBarKeyRecoveryLinkPresent ? `; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (${r.recover.tourBarKeyRecoveryLinkOnScreen ? 'on screen at this width' : 'in the bar\'s strip but NOT on screen at this width without scrolling the bar'})` : ''}`);
  L.push(`- leak words in the front (read with purpose "${r.pickAtRead}" pressed): ${JSON.stringify(r.leakage.frontBeforeTaps)}${r.learnTaps ? `; on the cards read during the learning taps: ${JSON.stringify(r.leakage.cardsRead)}; front including those cards: ${JSON.stringify(r.leakage.front)}` : ''}; in the shared archive below while empty: ${JSON.stringify(r.leakage.archive)}${r.leakage.archiveWithRow ? `; with the stored row showing: ${JSON.stringify(r.leakage.archiveWithRow)}` : ''}`);
  L.push(`- funding: own-wallet wording visible ${r.funding.visibleOwnWalletWording}${r.funding.visibleOwnWalletWording ? ' (in: ' + r.funding.ownWalletWordingWhere.join('; ') + ')' : ''}; the forever rail declares payer = ${r.funding.foreverDeclaredPayer ?? 'none (not offered)'}`);
  for (const [ph, hosts] of Object.entries(r.wire)) if (ph !== 'add' && ph !== 'remove') L.push(`- cross-origin attempted during ${ph} (aborted): ${hosts.join(', ')}`);
  if (r.notes.length) L.push(`- notes: ${r.notes.join(' | ')}`);
  L.push('');
}
process.stdout.write(L.join('\n') + '\n');
if (OUT) await writeFile(OUT, JSON.stringify({ revision: REVISION, results }, null, 1));
