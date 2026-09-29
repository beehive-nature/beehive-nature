// myspace-stranger.mjs — CAN A STRANGER FINISH MY SPACE WITHOUT LEARNING THE STORAGE ARCHITECTURE?
//
// A scripted stranger, one per register, who knows nothing about adapters, rails or
// schemes. It reads only the words the page shows, chooses a purpose by plain-language
// intent, stores a file, then tries to remove it and to get it back. It measures what
// a machine can measure and labels the rest as proxies:
//
//   CHOICE      wrong-storage-choice rate: for each intent ("just for now", "keep it on
//               this phone", "share it", "keep it forever") which purpose control the
//               visible words led it to, against the purpose the intent means.
//   FIRST FILE  steps (presses) and milliseconds from page open to the first stored row.
//   TERMS       whether the readers / lifetime / payer sentence is visible ON the control
//               before the choice is made — the proxy for "temporary vs forever is stated
//               before you commit", not a measure of whether a person understood it.
//   REMOVE      whether a visible remove control exists on the stored row, what the
//               confirmation sentence says, whether removal completes, whether the
//               outcome is stated on screen afterwards, and whether finality is stated
//               BEFORE the confirm (on the sentence) and after (on the outcome), judged
//               separately. Every cross-origin request during the remove is logged.
//   RECOVER     whether any visible control offers to undo or bring a removed file back.
//   LEAKAGE     count of implementation words (adapter, rail, worker, indexeddb, aes,
//               schnorr, blossom, ant, autonomi, nostr, relay, datamap, chunk, digest,
//               sha, signer, wallet, gas, token, scheme, predicate, ciphertext), whole
//               words only, in the register's own front and in the shared archive below
//               it (visible text only). cypherpunk is expected to say them — that is its
//               voice — so its count is reported as declared, not as leakage.
//   FUNDING     whether the visible words tell the visitor to pay from their own wallet
//               for the forever purpose (the known wording mismatch with the sponsored
//               model), and what the rail itself declares as payer.
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
const REGS = arg('reg', 'bee,raver,cypherpunk').split(',');
const OUT = arg('json', '');
const REVISION = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

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
  // options: [{purpose, text}] — score each control's visible words against the intent.
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
// finality: the words that say a removed file is not coming back
const FINAL = /gone|cannot|can't|no way back|for good|permanent|not .*undo|nowhere else|anywhere else|no longer|will not exist|won't exist/i;

const FRONT = { bee: '.et-b', raver: '.et-r', cypherpunk: '.et-c' };
const ADD = { bee: '#etBeeAdd', raver: '#etRaverAdd', cypherpunk: '#etCyAdd' };
const CONTROLS = {
  bee: '.et-b-row[data-et-purpose]',
  raver: '#etOrbits .orbit[data-et-purpose]',
  cypherpunk: '#etPurposes tr.pick[data-et-purpose]',
};

// text a visitor can see: a hidden element, or one with no box on screen, contributes nothing
// (getClientRects, not offsetParent — the confirmation sheet is position:fixed and has no offsetParent)
const SEE = `const vis = el => el && !el.hidden && el.getClientRects().length > 0; const txt = el => el.innerText || el.textContent || '';`;
async function visibleText(page, sel) {
  return page.evaluate(new Function('s', SEE + ` const el = document.querySelector(s); return vis(el) ? txt(el) : '';`), sel);
}
async function visibleTextAll(page, sel) {
  return page.evaluate(new Function('s', SEE + ` return [...document.querySelectorAll(s)].filter(vis).map(txt).join('\\n');`), sel);
}

async function stranger(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const page = await ctx.newPage();
  // every cross-origin request is aborted and logged under the phase it happened in
  const wire = { load: new Set(), read: new Set(), add: new Set(), 'after-add': new Set(), remove: new Set(), done: new Set() }; let phase = 'load';
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== base) { wire[phase].add(u.host + u.pathname); return route.abort(); } route.continue(); });
  const R = { reg, revision: REVISION, external: [], wire: {}, offered: [], choices: [], firstFile: null, terms: {}, remove: null, recover: null, leakage: null, funding: null, notes: [] };
  const t0 = Date.now();
  await page.goto(`${base}/surfaces/myspace.html`, { waitUntil: 'load', timeout: 30000 }).catch(e => R.notes.push('load: ' + e.message.split('\n')[0]));
  try {
    await page.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.purposes.some(x => x.offered), null, { timeout: 20000 });
  } catch { R.notes.push('the fronts never became ready with an offered purpose (no rail attached offline?)'); }
  // rails attach one by one and the pressed purpose follows the first open one, so the front's
  // text (cypherpunk's write path in particular) depends on WHEN it is read. Wait for every
  // purpose to be offered (or 5 s), then record the pressed purpose the text was read under.
  const tSettle = Date.now();
  await page.waitForFunction(() => window.__eternal.data.purposes.every(x => x.offered), null, { timeout: 5000 }).catch(() => R.notes.push('not every purpose was offered within 5 s; the front was read as it stood'));
  await page.waitForTimeout(250);
  R.settleMs = Date.now() - tSettle; // instrument time, counted inside "ms from open" and printed beside it
  R.pickAtRead = await page.evaluate(() => window.__eternal.data.pick);

  phase = 'read';
  // what the stranger can see: the register's front and its purpose controls, and the whole
  // shared archive below the fronts (every child of main except the fronts, visible text only)
  const front = await visibleText(page, FRONT[reg]);
  R.leakage = { front: countLeak(front), archive: countLeak(await visibleTextAll(page, 'main > :not(#eternal)')) };
  const options = await page.evaluate(sel => [...document.querySelectorAll(sel)].map(el => ({
    purpose: el.getAttribute('data-et-purpose'),
    text: (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
  })), CONTROLS[reg]);
  R.offered = options.map(o => o.purpose);
  const declared = await page.evaluate(() => (window.__eternal?.data?.purposes || []).map(p => ({ id: p.id, offered: p.offered, rail: p.rail, terms: p.terms })));
  R.funding = {
    foreverDeclaredPayer: (declared.find(p => p.id === 'forever') || {}).terms?.payer ?? null,
    visibleOwnWalletWording: /your wallet|you pay|own wallet/i.test(front + ' ' + options.map(o => o.text).join(' ')),
  };

  // CHOICE: for each intent, which control do the visible words lead to?
  for (const intent of INTENTS) {
    const p = options.length ? pickByWords(intent, options) : null;
    const pick = p && !p.none ? p : null;
    const wanted = declared.find(p => p.id === intent.id);
    R.choices.push({
      ask: intent.ask, means: intent.id,
      offered: !!(wanted && wanted.offered),
      chose: pick ? pick.purpose : null, control: pick ? pick.text.slice(0, 120) : null, score: p ? p.score : null,
      tied: p && p.tied ? p.tied : null,
      wrong: pick ? pick.purpose !== intent.id : null,
    });
    // TERMS proxy: is a lifetime / readers sentence on the control itself?
    if (pick && pick.purpose === intent.id) {
      const t = pick.text.toLowerCase();
      R.terms[intent.id] = {
        lifetimeStated: /gone|closes|session|stays|until|forever|permanent|lasts|drop|remove/.test(t),
        readersStated: /only this phone|this phone only|this device|link|anyone|everyone|readers/.test(t),
        payerStated: /pay|wallet|paid|payer|nobody|hive/.test(t),
      };
    }
  }

  // FIRST FILE: the stranger wants to keep a photo on this phone. Chooses by words, presses add, picks a file.
  const keepIntent = INTENTS[1];
  const keepPick = options.length ? pickByWords(keepIntent, options) : null;
  const keep = keepPick && !keepPick.none ? keepPick : null;
  let steps = 0;
  if (keep && !keep.disabled) {
    phase = 'add';
    try {
      const sel = `${CONTROLS[reg]}[data-et-purpose="${keep.purpose}"]`;
      if (reg === 'raver') {
        // a thumb on the ring itself: tap the orbit's top point, computed from the SVG's box.
        // (a playwright click at a fixed offset inside the .hit box lands on the NEXT ring out —
        // measured 2026-09-27: (5,60) on keep selected share — so no forced clicks here.)
        const pt = await page.evaluate(p => { const svg = document.querySelector('#etOrbits'); const b = svg.getBoundingClientRect(); const k = b.width / 400; const r = +svg.querySelector(`.orbit[data-et-purpose="${p}"] .hit`).getAttribute('r'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 - r * k }; }, keep.purpose);
        await page.touchscreen.tap(pt.x, pt.y);
      } else await page.click(sel);
      steps++;
      await page.waitForFunction(p => window.__eternal.data.pick === p, keep.purpose, { timeout: 5000 });
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click(ADD[reg])]);
      steps++;
      await chooser.setFiles({ name: 'stranger-note.txt', mimeType: 'text/plain', buffer: Buffer.from('a note from a stranger', 'utf8') });
      steps++;
      await page.waitForFunction(() => window.__eternal.data.count >= 1, null, { timeout: 15000 });
      const stored = await page.evaluate(() => window.__myspace.rows().then(r => r.map(x => ({ purpose: x.purpose, scheme: x.addr && x.addr.scheme }))));
      const archivePressed = await page.evaluate(() => document.querySelector('#modes .mode[aria-pressed="true"]')?.getAttribute('data-purpose') || null);
      R.firstFile = { ok: true, purposeChosen: keep.purpose, archivePressedAfterAdd: archivePressed, stored, steps, ms: Date.now() - t0, statusShown: await visibleText(page, '#status'), networkDuringAdd: [...wire.add].sort() };
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
    // only a control with a box on screen counts; the first one is tagged and then pressed
    // through playwright's own actionability checks, not a programmatic click on a hidden node
    const rm = await page.evaluate(() => {
      const cands = [...document.querySelectorAll('#list button, #list a, #list [role=button]')].filter(el => el.getClientRects().length > 0 && /remove|delete|drop|bin|trash/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      cands.forEach((el, i) => el.setAttribute('data-stranger-rm', String(i)));
      return cands.length ? { text: (cands[0].innerText || cands[0].getAttribute('aria-label') || '').trim(), candidates: cands.length } : null;
    });
    if (!rm) {
      // the whole-space list may be below the fold; cypherpunk's front points at "the rows below"
      R.remove = { control: null, ok: false, note: 'no visible remove control on the stored row', networkDuringRemove: [] };
    } else {
      try {
        await page.click('[data-stranger-rm="0"]');
        await page.waitForSelector('#del-body', { state: 'visible', timeout: 5000 });
        const sentence = (await visibleText(page, '#del-body')).trim();
        const confirmText = (await visibleText(page, '#delConfirm')).trim();
        await page.click('#delConfirm');
        await page.waitForFunction(() => window.__eternal.data.count === 0, null, { timeout: 10000 });
        const after = (await visibleText(page, '#status')).trim();
        // finality is judged twice: on the sentence the visitor reads BEFORE confirming, and on the outcome after
        R.remove = { control: rm.text, candidates: rm.candidates, sentence, confirm: confirmText, ok: true, outcomeStated: !!after, outcome: after.slice(0, 160), finalityBeforeConfirm: FINAL.test(sentence), finalityAfter: FINAL.test(after), networkDuringRemove: [...wire.remove].sort() };
      } catch (e) { R.remove = { control: rm.text, candidates: rm.candidates, ok: false, error: String(e.message).split('\n')[0], networkDuringRemove: [...wire.remove].sort() }; }
    }
    // RECOVER: does anything on screen offer to bring it back?
    // Only the page's own controls count: the estate's tour bar carries a "recover" link that is
    // about KEY recovery (surfaces/recover.html), and a stranger who followed it would not get
    // their file back. Anything inside #tbar or pointing at recover.html is excluded by name.
    const rec = await page.evaluate(() => {
      const els = [...document.querySelectorAll('main button, main a, main [role=button], main summary, .sheet button')].filter(el => el.offsetParent !== null && !el.closest('#tbar') && !/recover\.html/.test(el.getAttribute('href') || ''));
      const hit = els.find(el => /undo|restore|recover|bring .* back|put .* back|get .* back/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      return hit ? (hit.innerText || hit.getAttribute('aria-label')).trim() : null;
    });
    const tourBarRecover = await page.evaluate(() => !![...document.querySelectorAll('#tbar a')].find(a => /recover/i.test(a.innerText || '')));
    R.recover = { control: rec, offered: !!rec, tourBarKeyRecoveryLinkPresent: tourBarRecover };
  }
  phase = 'done';
  R.external = [...wire.load].sort();
  for (const [k, v] of Object.entries(wire)) if (v.size) R.wire[k] = [...v].sort();
  await ctx.close();
  return R;
}

const results = [];
for (const reg of REGS) {
  const r = await stranger(reg);
  results.push(r);
  const wrong = r.choices.filter(c => c.offered && c.wrong).length, offered = r.choices.filter(c => c.offered).length;
  const tot = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  process.stderr.write(`${reg.padEnd(11)} offered ${r.offered.join(',') || 'none'} | wrong choice ${wrong}/${offered} | first file ${r.firstFile?.ok ? r.firstFile.steps + ' steps ' + r.firstFile.ms + 'ms' : 'FAILED: ' + r.firstFile?.error} | remove ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | recover ${r.recover ? (r.recover.offered ? 'offered' : 'none') : '—'} | leak front ${tot(r.leakage.front)} archive ${tot(r.leakage.archive)} | own-wallet wording ${r.funding.visibleOwnWalletWording}\n`);
}
await browser.close(); server.close();

const L = [];
L.push(`# MY SPACE — the stranger instrument, ${results.length} registers at 390×844, revision ${REVISION}`);
L.push('');
L.push('Machine-measured. CHOICE, FIRST FILE, REMOVE, RECOVER, LEAKAGE and FUNDING are observed behaviour and visible wording. TERMS is a proxy (the sentence is on the control before the choice), not comprehension. Task completion rate and comprehension of temporary vs forever are not measured here: they need people.');
L.push('');
L.push('| register | purposes offered | wrong choice (of offered) | led nowhere | first file: steps · ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front | leak words in archive | own-wallet wording visible | forever payer (declared) |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
for (const r of results) {
  const wrong = r.choices.filter(c => c.offered && c.wrong).length, offered = r.choices.filter(c => c.offered).length, nowhere = r.choices.filter(c => c.offered && c.chose === null).length;
  const lt = id => r.terms[id] ? (r.terms[id].lifetimeStated ? 'y' : 'n') : '—';
  const yn = v => v ? 'y' : 'n';
  L.push(`| ${r.reg} | ${r.offered.join(', ') || 'none'} | ${wrong}/${offered} | ${nowhere} | ${r.firstFile?.ok ? `${r.firstFile.steps} · ${r.firstFile.ms} (${r.settleMs} of it instrument settle)` : 'FAILED'} | ${r.firstFile?.networkDuringAdd?.length ? '**' + r.firstFile.networkDuringAdd.length + ' request(s)**' : 'none'} | ${r.remove ? (r.remove.networkDuringRemove?.length ? '**' + r.remove.networkDuringRemove.length + ' request(s)**' : 'none') : '—'} | ${lt('now')} / ${lt('forever')} | ${r.remove ? (r.remove.ok ? 'ok' : 'no') : '—'} | ${r.remove?.ok ? yn(r.remove.outcomeStated) : '—'} | ${r.remove?.ok ? yn(r.remove.finalityBeforeConfirm) + ' / ' + yn(r.remove.finalityAfter) : '—'} | ${r.recover ? yn(r.recover.offered) : '—'} | ${sum(r.leakage.front)}${r.reg === 'cypherpunk' ? ' (declared voice)' : ''} | ${sum(r.leakage.archive)} | ${yn(r.funding.visibleOwnWalletWording)} | ${r.funding.foreverDeclaredPayer ?? '—'} |`);
}
L.push('');
L.push('## Receipts');
L.push('');
for (const r of results) {
  L.push(`### ${r.reg}`);
  for (const c of r.choices) L.push(`- "${c.ask}" → ${c.offered ? (c.chose ? `chose **${c.chose}**${c.wrong ? ' (WRONG, meant ' + c.means + ')' : ''} (score ${c.score}) via "${c.control}"` : `the words led nowhere (top score ${c.score}${c.tied ? ', tied between ' + c.tied.join(' / ') : ''})`) : 'not offered on this page'}`);
  if (r.firstFile) L.push(`- first file: ${r.firstFile.ok ? `stored under ${r.firstFile.purposeChosen} (rows: ${JSON.stringify(r.firstFile.stored)}; archive pressed after add (the page resets to the most private purpose): ${r.firstFile.archivePressedAfterAdd}) in ${r.firstFile.steps} presses, ${r.firstFile.ms} ms from open (of which ${r.settleMs} ms is the instrument waiting for every purpose to be offered before reading)${r.firstFile.statusShown ? '; status shown: "' + r.firstFile.statusShown.slice(0, 120) + '"' : '; no status sentence shown'}` : 'FAILED: ' + r.firstFile.error}${r.firstFile.networkDuringAdd?.length ? `; **requests attempted during the add: ${r.firstFile.networkDuringAdd.join(', ')}** (aborted by the harness)` : '; no request left the page during the add'}`);
  if (r.remove) L.push(`- remove: ${r.remove.ok ? `control "${r.remove.control}" (${r.remove.candidates} visible) → sentence "${r.remove.sentence}" (finality stated: ${r.remove.finalityBeforeConfirm}) → confirm "${r.remove.confirm}" → outcome "${r.remove.outcome || '(nothing stated)'}" (finality stated: ${r.remove.finalityAfter})` : (r.remove.note || r.remove.error)}${r.remove.networkDuringRemove?.length ? `; **requests attempted during the remove: ${r.remove.networkDuringRemove.join(', ')}** (aborted by the harness)` : '; no request left the page during the remove'}`);
  if (r.recover) L.push(`- recover: ${r.recover.offered ? `offered as "${r.recover.control}"` : 'nothing on screen offers to bring a removed file back'}${r.recover.tourBarKeyRecoveryLinkPresent ? '; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery' : ''}`);
  L.push(`- leak words in the front (read with purpose "${r.pickAtRead}" pressed): ${JSON.stringify(r.leakage.front)}; in the shared archive below: ${JSON.stringify(r.leakage.archive)}`);
  L.push(`- funding: own-wallet wording visible ${r.funding.visibleOwnWalletWording}; the forever rail declares payer = ${r.funding.foreverDeclaredPayer ?? 'none (not offered)'}`);
  for (const [ph, hosts] of Object.entries(r.wire)) if (ph !== 'add' && ph !== 'remove') L.push(`- cross-origin attempted during ${ph} (aborted): ${hosts.join(', ')}`);
  if (r.notes.length) L.push(`- notes: ${r.notes.join(' | ')}`);
  L.push('');
}
process.stdout.write(L.join('\n') + '\n');
if (OUT) await writeFile(OUT, JSON.stringify({ revision: REVISION, results }, null, 1));
