// bData (My Data) gate — the organism-level data surface.
//
// Serves surfaces/ from the worktree and proves in chromium (390px). The
// A+ rebuild (founder 2026-09-18: "D+ — buttons don't even work") turned the
// old 30 selector checks into TRANSITIONS — a 30/30 green once sat on top of a
// page whose most prominent buttons did nothing, so every class of dead,
// decoy or double-firing control below can now FAIL:
//   1. mechanical identity (name/bytes/sha from the reference invoice);
//   2. New bee is the hub's light, readable canvas (founder 2026-09-07) with a
//      44px touch floor and no sideways scroll; there is NO private view picker;
//   3. "Who can get this?": one live choice; Only me / Selected people are
//      PROSE with their reasons in plain sight — never buttons (dead
//      affordances are banned); the laws are one tap away, never deleted;
//   4. THE GESTURE: persisted first (shared policy key + origin stamp), then
//      the ask starts by itself (latency law) and the wait is VISIBLE — no
//      price button exists while asking (no decoy), seconds tick, the reader
//      may stop waiting; a redraw mid-ask can neither wipe the wait nor fire a
//      second ask; the 5xx flake auto-retries exactly once;
//   5. the price lands IN PLACE, full precision, gas separate, nothing paid,
//      cached = instant on revisit; asking again is single-flight;
//   6. honest failures: an unreachable quote service is named as such (never
//      "Autonomi"), fails fast, and Try again really tries again; an
//      AUTOMATED browser can never reach the live quote service by omission;
//   7. withdrawal is first-class: Stop waiting, Undo this choice (history
//      appended, never rewritten), and a second tab follows without reload;
//   8. the estate's riders are obeyed: the top-bar register drives the
//      anatomy (8 sections), the language select re-words the JS-drawn page;
//   9. automation: a labelled, validated bound; every change appends history;
//  10. PHASE C: after a price stands, ONE founder-reviewed authorization — every
//      binding on screen (invoice digest + lineage, artifact, audience, exact
//      ceiling, gas separate, single-use); the press creates intent only; cancel
//      is clean; a re-quote unbinds it; no pay route, no signing path;
//  11. A9c law: no pay-route strings; no page errors anywhere.
//
//   node e2e/bdata-surface.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
// module scope: one counter per mock for the server's lifetime (a per-request
// `let` once made every request "#1" — every response a 502)
const hits = { ok: 0, dead: 0, hang: 0, auth: 0 };
const authRecords = []; // server-lifetime state never lives inside the request handler
const hung = new Set();

const refInvoice = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice.json'), 'utf8'));
const corpus = JSON.parse(await readFile(join(SURFACES, 'lang-corpus.json'), 'utf8'));
// THE STORE RECEIPT (founder order 2026-09-25): the Bux video IS on Autonomi
// mainnet — the founder paid and uploaded by his own hand. The page may say
// STORED only when this receipt verifies against the invoice, line by line;
// the negative controls below mutate every pin and refuse the file itself.
const storeReceipt = JSON.parse(await readFile(join(SURFACES, 'bdata-stored-bux-try-autonomi.json'), 'utf8'));
const bareAddr = String(storeReceipt.data_map_address).replace(/^0x/, '');
// the mock speaks the CURRENT founder invoice's language (same total, same
// carried quotes) so the gate exercises the REAL cross-check: cached price vs
// current invoice. Its figure is long enough to exercise the lead/tail typography.
const founderInv = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
const founderLine = founderInv.lines.find(l => l.asset === 'ANT');
const MOCK_TOTAL = founderLine.amountAtto;
const MOCK_ANT = (() => { const n = BigInt(MOCK_TOTAL), fr = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, ''); return (n / 10n ** 18n) + (fr ? '.' + fr : ''); })();
const readBody = async req => { let b = ''; for await (const c of req) b += c; return JSON.parse(b); };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  // MOCK quote services — the REAL bridge and the REAL acceptance belong to the
  // founder alone. /mock-bridge: the founder-shaped request is asserted
  // server-side; the FIRST prepare 502s (the flake class the founder hit live)
  // and every later one answers after a beat, so "in flight" is observable.
  if (url === '/mock-bridge/v1/upload/prepare') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    hits.ok++;
    if (parsed.audience !== 'public' || parsed.force_fresh !== true || parsed.artifact_sha256 !== refInvoice.domain.artifact.sha256) {
      res.writeHead(400); res.end('MOCK: request must carry {artifact pin, audience:public, force_fresh}'); return;
    }
    if (hits.ok === 1) { res.writeHead(502); res.end('insufficient peers: Got 0 quotes (MOCK flake)'); return; }
    await new Promise(r => setTimeout(r, 1500));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      upload_id: 'up-MOCK', artifact_sha256: refInvoice.domain.artifact.sha256, artifact_bytes: refInvoice.domain.artifact.bytes,
      total_chunks: 3, already_stored: 0, payment_type: 'wave_batch',
      total_amount_atto: MOCK_TOTAL,
      payments: founderLine.quotes.map(q => ({ quote_hash: q.quote_hash, amount_atto: q.amount_atto })),
      policy: { audience: 'public', binding: 'founder-selected:public' },
      note: 'MOCK-SYNTHETIC — never a network quote',
    }));
    return;
  }
  // MOCK authorization organ — validates the founder-shaped request server-side:
  // digest lineage, exact ceiling, audience binding; cancel is clean.
  if (url === '/mock-bridge/v1/authorization' && req.method === 'POST') {
    const a = await readBody(req); hits.auth++;
    if (a.audience !== 'public' || !String(a.gesture || '').includes('founder press')) { res.writeHead(400); res.end('MOCK: gesture/audience malformed'); return; }
    if (a.invoice_digest !== founderInv.identity.contentDigest || a.commitment_digest !== founderInv.commitment.digest) { res.writeHead(409); res.end('MOCK: digest mismatch — stale lineage refused'); return; }
    if (a.ant_ceiling_atto !== founderLine.amountAtto || a.upload_id !== 'up-MOCK') { res.writeHead(409); res.end('MOCK: ceiling must be exact, job must be the open one'); return; }
    const rec = { authorization_id: 'auth-MOCK-' + (authRecords.length + 1), state: 'authorized-for-signing', invoice_digest: a.invoice_digest, ant_ceiling_atto: a.ant_ceiling_atto, events: [{ kind: 'authorized-for-signing' }] };
    authRecords.push(rec);
    await new Promise(r => setTimeout(r, 400));
    res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(rec));
    return;
  }
  if (url === '/mock-bridge/v1/authorization/cancel' && req.method === 'POST') {
    const { authorization_id } = await readBody(req);
    const rec = authRecords.find(r => r.authorization_id === authorization_id);
    if (!rec) { res.writeHead(404); res.end('unknown'); return; }
    rec.state = 'cancelled'; rec.events.push({ kind: 'cancelled' });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(rec));
    return;
  }
  // a quote service that never answers
  if (url === '/mock-hang/v1/upload/prepare') { hits.hang++; hung.add(req.socket); return; }
  // lang.js fetches its corpus from the production alias /surfaces/ — same files
  const p = (url === '/' ? '/bdata.html' : url.indexOf('/surfaces/') === 0 ? url.slice('/surfaces'.length) : url);
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const pageErrors = [];
// THE NEAR-MISS LAW, structural: no context in this gate can reach the live
// quote service — 8807 is aborted at the browser and every touch is counted
let liveBridgeTouches = 0;
async function openContext(bridgePath) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('http://127.0.0.1:8807/**', route => { liveBridgeTouches++; route.abort(); });
  // seed the mock quote service BEFORE any page script runs — ONE-SHOT, so a
  // reload measures the surface (its cached price), not the seeder
  if (bridgePath) await ctx.addInitScript(bridge => {
    if (localStorage.getItem('bdata-v1')) return;
    localStorage.setItem('bdata-v1', JSON.stringify({ automation: { mode: 'ask', boundAnt: '0.5' }, history: [], bridge, freshQuote: null }));
  }, /^http/.test(bridgePath) ? bridgePath : origin + bridgePath);
  return ctx;
}
async function openPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
  await page.waitForSelector('[data-bdata-object]', { timeout: 8000 });
  await page.waitForSelector('#breg-cypherpunk', { timeout: 8000 });
  return page;
}
// non-throwing probes: a missing element FAILS its check instead of crashing the gate
const val = (p, sel, fn, dflt = null) => p.$eval(sel, fn).catch(() => dflt);
const tap = (p, sel) => p.click(sel, { timeout: 4000 }).catch(() => check('press ' + sel, false, 'nothing there to press'));
const words = (p, sel) => p.innerText(sel, { timeout: 4000 }).catch(() => '');
const state = page => val(page, '[data-bdata-price-state]', e => e.dataset.bdataPriceState, 'absent');
const sharedKey = page => page.evaluate(() => JSON.parse(localStorage.getItem('bpay-policy-v1') || 'null'));
const historyKinds = page => page.$$eval('[data-bdata-history]', els => els.map(e => e.dataset.bdataHistory));

const ctx = await openContext('/mock-bridge');
const page = await openPage(ctx);
const text = await words(page, 'body');

// 1 · the shelf — mechanical identity
check('object renders with mechanical identity', text.includes(refInvoice.domain.artifact.name) && text.includes('214,091,829'), 'name + exact bytes from the reference invoice');
const bytesAttr = await val(page, '[data-bdata-bytes]', e => e.dataset.bdataBytes);
check('bytes machine-exact', bytesAttr === String(refInvoice.domain.artifact.bytes), bytesAttr);

// 1b · THE STORED TRUTH — the receipt verifies against the invoice, so the page
// says what the founder's own upload made true: ✓ Stored on Autonomi, the whole
// address (bee-address law: never an ellipsis), and a Watch press, in EVERY register.
await page.waitForSelector('[data-bdata-stored]', { timeout: 8000 }).catch(() => {});
const storedText = await words(page, '[data-bdata-stored]');
check('stored card renders: ✓ Stored on Autonomi + the whole data-map address', /Stored on Autonomi/i.test(storedText) && (await words(page, '[data-bdata-stored-address]')).includes(bareAddr) && !/…/.test(await words(page, '[data-bdata-stored-address]')), storedText.replace(/\s+/g, ' ').slice(0, 80));
const watchHref = await val(page, '[data-bdata-watch]', e => e.getAttribute('href'));
check('Watch link targets bview.html with the BARE address (no 0x anywhere in it)', watchHref === 'bview.html#' + bareAddr && !watchHref.includes('0x'), watchHref);

// 2 · the canvas — New bee is light and readable; controls are thumb-sized
const canvas = await page.evaluate(() => ({ reg: document.body.dataset.reg, bg: getComputedStyle(document.body).backgroundColor, size: parseFloat(getComputedStyle(document.body).fontSize), theme: document.body.dataset.beeTheme }));
check('New bee renders the hub\'s light canvas (no dark page under a light toolbar)', canvas.reg === 'bee' && canvas.bg === 'rgb(251, 247, 240)' && canvas.theme === 'shared', JSON.stringify(canvas));
check('reading text is at least 16px', canvas.size >= 16, `${canvas.size}px`);
const smallType = p => p.$$eval('main *', els => els.filter(e => e.children.length === 0 && e.textContent.trim() && e.checkVisibility({ contentVisibilityAuto: true }) && parseFloat(getComputedStyle(e).fontSize) < 13.9).map(e => e.textContent.trim().slice(0, 30) + '=' + getComputedStyle(e).fontSize));
let tiny = await smallType(page);
check('no visible type below the 14px secondary floor (before the gesture)', tiny.length === 0, tiny.slice(0, 3).join(' | '));
check('there is NO private view picker (the estate\'s register control is the only one)', (await page.$$('[data-bdata-insp]')).length === 0);
const touchFloor = () => page.$$eval('main button, main summary, main input, main a', els => els.filter(e => e.getClientRects().length).map(e => ({ t: (e.textContent || e.id || e.tagName).trim().slice(0, 28), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44));
let small = await touchFloor();
check('every control clears the 44px touch floor (before the gesture)', small.length === 0, small.map(x => `${x.t}=${x.h}px`).join(', '));
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no sideways scroll at 390px', (await overflow()) <= 0, `overflow=${await overflow()}px`);

// 3 · audience — one live choice; the unavailable are prose with reasons in sight
const unavail = await page.$$eval('[data-bdata-unavailable]', els => els.map(e => ({ id: e.dataset.bdataUnavailable, tag: e.tagName, text: e.innerText, cursor: getComputedStyle(e).cursor })));
check('unavailable audience modes visible (never promised)', unavail.some(u => u.id === 'only-me') && unavail.some(u => u.id === 'selected-people'), unavail.map(u => u.id).join(','));
check('unavailable modes are PROSE, never buttons (dead affordances are banned)', unavail.length === 2 && unavail.every(u => u.tag !== 'BUTTON' && u.cursor !== 'pointer'), unavail.map(u => `${u.tag}/${u.cursor}`).join(','));
check('their reasons are in plain sight before any press', unavail.every(u => /not available yet/i.test(u.text) && /not ready/i.test(u.text)), unavail.map(u => u.text.replace(/\s+/g, ' ')).join(' | '));
check('pre-choice: the price step waits in words (no dead button, no price button)', !!(await page.$('[data-bdata-preserve-waiting]')) && !(await page.$('[data-bdata-quote-go]')) && !(await page.$('[data-bdata-open-bpay]')) && (await state(page)) === 'waiting');
check('the machine reference figure is already in the room', /reference \(machine, not chosen by you\)/i.test(text) && /ANT/.test(text));
// the laws are one tap away in New bee — moved, never deleted
check('the law prose is collapsed for New bee…', !/requires a new quote/i.test(text) && !!(await page.$('[data-bdata-supersede-note]')));
await tap(page, 'details[data-dk="aud-rules"] > summary');
const rules = await words(page, 'details[data-dk="aud-rules"]');
check('…and ONE tap shows it: supersede law, machine-reference binding, who-can-get line', /requires a new quote/i.test(rules) && /machine reference|current binding/i.test(rules) && /anyone who obtains the Autonomi address/i.test(rules));
check('automation default Ask me', (await val(page, '[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode)) === 'ask');

// 4 · THE GESTURE — persisted first, then the ask starts by itself and the wait is VISIBLE
const urlBefore = page.url();
await tap(page, '[data-bdata-aud="public"]');
await page.waitForTimeout(250);
const shared = await sharedKey(page);
check('the gesture records in the SHARED policy key (origin: My Data)', !!(shared && shared.audience === 'public' && shared.selectedAt && shared.origin === 'bdata' && shared.originAt === shared.selectedAt), JSON.stringify(shared || 'absent'));
check('bData history appends the audience policy edition', (await historyKinds(page)).join(',') === 'audience.chosen', (await historyKinds(page)).join(','));
check('the choice is shown: a checked radio + "You chose Public"', (await val(page, '[data-bdata-aud="public"]', e => e.getAttribute('role') + ':' + e.getAttribute('aria-checked'))) === 'radio:true' && /You chose .*Public/i.test(await words(page, '#shelf')));
check('origin attribution rendered on evidence ("originated in My Data")', /originated in My Data/i.test(await words(page, 'details[data-dk="aud-rules"]')));
check('price ask started automatically with the gesture (no second press)', hits.ok >= 1, `requests=${hits.ok}`);
const waiting = await page.evaluate(() => { const s = document.querySelector('[data-bdata-price-state]'); if (!s) return { state: 'absent', busy: null, go: document.querySelectorAll('[data-bdata-quote-go]').length, stop: false, elapsed: '' }; return { state: s.dataset.bdataPriceState, busy: s.getAttribute('aria-busy'), go: document.querySelectorAll('[data-act="ask"]').length, stop: !!document.querySelector('[data-bdata-stop]'), elapsed: (document.querySelector('[data-bdata-elapsed]') || {}).textContent || '' }; });
check('the wait is VISIBLE at once: a named state, seconds so far, aria-busy', /^(asking|retrying)$/.test(waiting.state) && waiting.busy === 'true' && /\d+ s/.test(waiting.elapsed), JSON.stringify(waiting));
check('NO price button exists while asking (no decoy to press) — Stop waiting does', waiting.go === 0 && waiting.stop, `ask-controls=${waiting.go}`);
check('the press hands keyboard focus to what replaced it (never dropped to the page)', (await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-fk')) || 'BODY')) !== 'BODY', await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-fk')) || 'BODY'));
check('authorize step visibly locked (payment absent by law)', !!(await page.$('[data-bdata-authorize-next]')) && !(await page.$('[data-bdata-authorize-next] button')));
check('supersede note still present after the gesture', !!(await page.$('[data-bdata-supersede-note]')));
// a redraw mid-ask (any other press) can neither wipe the wait nor fire a second ask
await tap(page, '[data-bdata-auto="never"]');
await page.waitForTimeout(200);
check('a redraw mid-ask keeps the wait on screen and re-arms nothing', /^(asking|retrying)$/.test(await state(page)) && (await page.$$('[data-act="ask"]')).length === 0 && hits.ok === 1, `state=${await state(page)} requests=${hits.ok}`);
check('policy change appends history (2 editions: origin + automation)', (await historyKinds(page)).join(',') === 'auto.mode,audience.chosen', (await historyKinds(page)).join(','));
check('automation persists (localStorage)', (await page.evaluate(() => JSON.parse(localStorage.getItem('bdata-v1')).automation.mode)) === 'never');

// 5 · THE PRICE, IN PLACE
await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 12000 }).catch(() => {});
const freshAtto = await val(page, '[data-bdata-fresh-atto]', e => e.dataset.bdataFreshAtto);
check('fresh price rendered IN PLACE after the auto-retry recovered the flake', freshAtto === MOCK_TOTAL && (await state(page)) === 'priced', `fresh=${freshAtto} requests=${hits.ok}`);
check('the flake auto-retried exactly once (2 requests, not a loop)', hits.ok === 2, `requests=${hits.ok}`);
check('page never navigated (one page, one concept)', page.url() === urlBefore, page.url());
const priced = await words(page, '[data-bdata-price-state]');
check('the FULL figure is on screen — lead and tail together (typography, never rounding)', priced.replace(/\s+/g, ' ').includes(MOCK_ANT + ' ANT') && MOCK_ANT.split('.')[1].length > 4 && (await val(page, '.amount .tail', e => e.textContent)) === MOCK_ANT.slice(MOCK_ANT.indexOf('.') + 5), priced.replace(/\s+/g, ' ').slice(0, 70));
tiny = await smallType(page);
check('no visible type below the 14px secondary floor (priced)', tiny.length === 0, tiny.slice(0, 3).join(' | '));
await page.screenshot({ path: join(here, 'shots-bdata', 'bdata-390.png'), fullPage: false });
check('caused-by-your-choice line present, and labelled current while fresh', /current price — caused by your choice/i.test(priced) && (await val(page, '[data-bdata-price-age]', e => e.dataset.bdataPriceAge)) === 'current');
check('nothing-paid line present, scoped to this page (the founder paid elsewhere — the page vouches for itself only)', /Nothing has been paid from this page/i.test(priced) && !!(await page.$('[data-bdata-nothing-paid]')));
check('gas stays a SEPARATE asset on the consent surface', !!(await page.$('[data-bdata-gas-separate]')) && /Arbitrum ETH/.test(priced));
check('the obtained price is evidence: a quote edition returns to history', (await historyKinds(page)).join(',') === 'quote,auto.mode,audience.chosen', (await historyKinds(page)).join(','));
small = await touchFloor();
check('every control clears the 44px touch floor (priced)', small.length === 0, small.map(x => `${x.t}=${x.h}px`).join(', '));
check('no sideways scroll at 390px (priced)', (await overflow()) <= 0);
// 10 · THE AUTHORIZATION STEP (Phase C) — one founder-reviewed object, bound to the
// exact quote + invoice lineage; the press creates intent only; cancel is clean
check('once a price stands, step 3 offers the review (the lock is gone; nothing else to press)', !!(await page.$('[data-bdata-review-open]')) && !(await page.$('[data-bdata-authorize-next]')) && !(await page.$('[data-bdata-auth-go]')));
await tap(page, '[data-bdata-review-open]');
await page.waitForTimeout(200);
const panelText = (await words(page, '[data-bdata-review]')).replace(/\s+/g, ' ');
check('review shows the invoice digest + lineage', panelText.includes(founderInv.identity.contentDigest) && panelText.includes(String(founderInv.identity.priorDigest).slice(0, 23)));
check('review binds the exact artifact identity', panelText.includes(refInvoice.domain.artifact.name) && panelText.includes('214,091,829'));
check('review shows audience = founder-selected, origin My Data', /founder-selected/i.test(panelText) && /My Data/i.test(panelText));
check('review: ANT ceiling is the FULL figure — exact, never above', panelText.includes(MOCK_ANT) && /exact, never above/i.test(panelText));
check('review: gas separate', /separate/i.test(panelText) && /Arbitrum/i.test(panelText));
check('review: freshness + single-use (digest wall) + stop conditions', /single-use/i.test(panelText) && /re-quote voids/i.test(panelText) && /stop conditions/i.test(panelText));
check('review: nothing paid FROM THIS PAGE + the intent cannot move value', /Nothing has been paid from this page/i.test(panelText) && /cannot move value/i.test(panelText));
check('NO signing path exposed (no pay route strings)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(panelText));
tiny = await smallType(page); small = await touchFloor();
check('the review holds the type floor, the touch floor and the 390px width', tiny.length === 0 && small.length === 0 && (await overflow()) <= 0, tiny.concat(small.map(x => `${x.t}=${x.h}px`)).slice(0, 3).join(' | '));
await page.screenshot({ path: join(here, 'shots-bdata', 'bdata-review-390.png'), fullPage: true });
await tap(page, '[data-bdata-auth-go]');
await page.waitForTimeout(120);
check('the authorize press answers at once and leaves NOTHING to press twice', (await val(page, '[data-bdata-review]', e => e.getAttribute('aria-busy'))) === 'true' && !(await page.$('[data-bdata-auth-go]')));
await page.waitForSelector('[data-bdata-auth-cancel]', { timeout: 4000 }).catch(() => {});
const authText = await words(page, '[data-bdata-review]');
check('the press creates ONE authorization record (authorized-for-signing)', /Authorized for signing/i.test(authText) && /auth-MOCK-1/.test(authText) && hits.auth === 1 && authRecords.length === 1, `requests=${hits.auth}`);
check('history appends the authorization edition', (await historyKinds(page))[0] === 'auth', (await historyKinds(page)).join(','));
await tap(page, '[data-bdata-auth-cancel]');
await page.waitForSelector('[data-bdata-auth-state="cancelled"]', { timeout: 4000 }).catch(() => {});
check('cancellation is clean — no paid or uploaded state exists; the review is offered again', /no paid or uploaded state/i.test(await words(page, '[data-bdata-review]')) && authRecords[0].state === 'cancelled' && !!(await page.$('[data-bdata-review-open]')) && (await historyKinds(page))[0] === 'auth.cancelled', (await historyKinds(page)).join(','));
// asking again is single-flight: the press answers at once and leaves nothing to press twice
const beforeRefresh = hits.ok;
await tap(page, '[data-bdata-price-refresh]');
await page.waitForTimeout(150);
check('refresh answers at once and is single-flight (no ask control remains while asking)', (await state(page)) === 'asking' && (await page.$$('[data-act="ask"]')).length === 0 && /earlier price/i.test(await words(page, '[data-bdata-price-state]')));
tiny = await smallType(page);
check('no visible type below the 14px secondary floor (asking again, earlier price shown)', tiny.length === 0, tiny.slice(0, 3).join(' | '));
const midTab = await openPage(ctx);
await midTab.waitForTimeout(250);
check('a SECOND TAB opened mid-ask shows the wait and offers NO price button (single-flight across tabs)', (await state(midTab)) === 'elsewhere' && (await midTab.$$('[data-act="ask"]')).length === 0, `state=${await state(midTab)}`);
await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 8000 }).catch(() => {});
await midTab.waitForSelector('[data-bdata-fresh-atto]', { timeout: 4000 }).catch(() => {});
check('refresh asked the network exactly once more — and the answer landed in BOTH tabs', hits.ok === beforeRefresh + 1 && (await state(midTab)) === 'priced', `${beforeRefresh}→${hits.ok} other-tab=${await state(midTab)}`);
await midTab.close();
// cached = instant (latency law): a revisit paints the price with no new ask
const beforeReload = hits.ok;
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 3000 }).catch(() => {});
check('cached = instant: a revisit shows the price with NO new ask', hits.ok === beforeReload && (await state(page)) === 'priced', `requests ${beforeReload}→${hits.ok}`);
check('a re-quote unbinds the earlier authorization (the digest wall, mirrored): a fresh review is offered', !(await page.$('[data-bdata-auth-state]')) && !!(await page.$('[data-bdata-review-open]')));

// 8 · the riders — the estate's own top-bar controls drive this page
await page.waitForSelector('#breg-cypherpunk', { timeout: 8000 }).catch(() => {});
await tap(page, '#breg-cypherpunk');
await page.waitForTimeout(300);
const anatomy = await val(page, '#cyber', e => ({ shown: e.checkVisibility({ contentVisibilityAuto: true }), ok: /Payload/.test(e.innerText) && /Authority/.test(e.innerText) && /Evidence/.test(e.innerText), sects: e.querySelectorAll('.sect').length }));
check('the TOP-BAR cypherpunk button opens the anatomy (8 sections)', anatomy.shown && anatomy.ok && anatomy.sects === 8, JSON.stringify(anatomy));
const anatText = (await words(page, '#cyber')).replace(/\s+/g, ' ');
check('anatomy Storage row = STORED on Autonomi, whole address, Watch press (cypherpunk)', /Stored on Autonomi/i.test(anatText) && anatText.includes(bareAddr) && !!(await page.$('#cyber [data-bdata-watch]')));
check('anatomy Evidence row NAMES the receipts (store receipt rows + invoice pin)', /bdata-stored-bux-try-autonomi\.json/.test(anatText) && /bpay-invoice\.json/.test(anatText) && /purchased/i.test(anatText) && /uploaded/i.test(anatText) && /retrieved/i.test(anatText));
check('stored truth shows in cypherpunk too (unmarked content, every register)', (await val(page, 'main [data-bdata-stored]', e => e.checkVisibility({ contentVisibilityAuto: true }))) === true);
check('cypherpunk shows the quote-service field and the dark canvas', (await val(page, '[data-bdata-bridge-row]', e => e.getClientRects().length > 0)) && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== 'rgb(246, 247, 242)');
check('same facts in every register: the figure is unchanged', (await val(page, '[data-bdata-fresh-atto]', e => e.dataset.bdataFreshAtto)) === MOCK_TOTAL);
await tap(page, '#breg-bee');
await page.waitForTimeout(300);
check('New bee folds the anatomy away; policy untouched', (await val(page, '#cyber', e => !e.checkVisibility({ contentVisibilityAuto: true }))) && (await val(page, '[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode)) === 'never' && (await sharedKey(page)).audience === 'public');
check('stored truth shows in New bee too — the card is unmarked content (every register)', (await val(page, 'main [data-bdata-stored]', e => e.checkVisibility({ contentVisibilityAuto: true }))) === true);
// the language select re-words the JS-drawn page (it used to change five static lines only)
await page.selectOption('#blangsel', 'ru', { timeout: 4000 }).catch(() => {});
await page.waitForFunction(want => { const e = document.querySelector('[data-bdata-price-refresh] [data-i18n]'); return e && e.textContent === want; }, corpus.strings['bd.price.refresh'].ru, { timeout: 20000 }).catch(() => {});
const ru = await page.evaluate(() => ({ refresh: (document.querySelector('[data-bdata-price-refresh] [data-i18n]') || {}).textContent, pub: (document.querySelector('[data-bdata-aud="public"] .name') || {}).textContent }));
check('the language select re-words the JS-drawn controls', ru.refresh === corpus.strings['bd.price.refresh'].ru && ru.pub === corpus.strings['wl.bpay.aud.public'].ru, JSON.stringify(ru));
await page.selectOption('#blangsel', 'en', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(300);

// 9 · automation — labelled, validated, append-only
await tap(page, '[data-bdata-auto="auto"]');
await page.waitForTimeout(150);
check('the bound field is a labelled control', await val(page, '#bdata-bound', e => !!document.querySelector('label[for="bdata-bound"]') && e.getBoundingClientRect().height >= 44));
await page.fill('#bdata-bound', '1e-7', { timeout: 4000 }).catch(() => {});
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
check('a bad bound is refused IN WORDS, never stored, and the reader\'s own text stays in the field', !!(await page.$('#bdata-bound-err')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('bdata-v1')).automation.boundAnt)) === '0.5' && (await val(page, '#bdata-bound', e => e.value)) === '1e-7');
// type a good bound, then press ANOTHER control ONCE with a real mouse: the field commits on that press's
// mousedown — a redraw there would destroy the button before its click lands ("buttons don't even work")
await page.fill('#bdata-bound', '0.75', { timeout: 4000 }).catch(() => {});
await tap(page, '[data-bdata-auto="never"]');
await page.waitForTimeout(250);
check('editing a field never eats the NEXT press: one real click lands after typing', (await val(page, '[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode)) === 'never');
await tap(page, '[data-bdata-auto="auto"]');
await page.waitForTimeout(150);
const kinds = await historyKinds(page);
check('a good bound is stored exactly and appends history; earlier editions intact', (await page.evaluate(() => JSON.parse(localStorage.getItem('bdata-v1')).automation.boundAnt)) === '0.75' && kinds.includes('auto.bound') && kinds[kinds.length - 1] === 'audience.chosen' && kinds.length === 10, kinds.join(','));
const editions = await page.$$eval('[data-bdata-history]', els => els.map(e => e.textContent));
check('editions read as whole sentences (Public origin, the Never change)', editions.some(t => /Public/.test(t)) && editions.some(t => /Never/.test(t) && /Ask me/.test(t)) && editions.some(t => /authorization auth-MOCK-1/.test(t)));

// 7 · withdrawal is first-class — and a second tab follows WITHOUT a reload
const tab2 = await openPage(ctx);
check('a second tab opens already agreeing (chosen + priced)', (await state(tab2)) === 'priced');
await tap(page, '[data-bdata-undo]');
await page.waitForTimeout(250);
const undone = await sharedKey(page);
check('Undo this choice withdraws the policy (history appended, never rewritten)', undone.audience === null && undone.selectedAt === null && (await state(page)) === 'waiting' && (await historyKinds(page))[0] === 'audience.undone' && (await historyKinds(page)).includes('audience.chosen'));
await tab2.waitForFunction(() => document.querySelector('[data-bdata-price-state]').dataset.bdataPriceState === 'waiting', null, { timeout: 3000 }).catch(() => {});
check('the other tab follows without a reload (no stale, dead Public button)', (await state(tab2)) === 'waiting' && (await val(tab2, '[data-bdata-aud="public"]', e => e.getAttribute('aria-checked'))) === 'false');
await tab2.close();
const fullHtml = await page.content();
await ctx.close();

// 7b · Stop waiting — a quote service that never answers cannot strand the page
const hangCtx = await openContext('/mock-hang');
const hang = await openPage(hangCtx);
await tap(hang, '[data-bdata-aud="public"]');
await hang.waitForTimeout(1300);
check('a silent quote service shows a live wait (seconds advance)', (await state(hang)) === 'asking' && /[1-9]\d* s/.test(await val(hang, '[data-bdata-elapsed]', e => e.textContent)), await val(hang, '[data-bdata-elapsed]', e => e.textContent));
await tap(hang, '[data-bdata-stop]');
await hang.waitForTimeout(150);
check('Stop waiting returns a LIVE price button at once', (await state(hang)) === 'idle' && (await val(hang, '[data-bdata-quote-go]', e => !e.disabled && e.getBoundingClientRect().height >= 44)) && hits.hang === 1);
await tap(hang, '[data-bdata-quote-go]');
await hang.waitForTimeout(200);
check('…and that button really asks again', (await state(hang)) === 'asking' && hits.hang === 2, `requests=${hits.hang}`);
// a reload mid-ask leaves an ask marker nobody owns: the page must notice and give the button back
await hang.reload({ waitUntil: 'load' });
await hang.waitForSelector('[data-bdata-quote-go]', { timeout: 4000 }).catch(() => {});
check('a reload mid-ask never strands the page behind a dead wait (the live button returns)', (await state(hang)) === 'idle' && (await val(hang, '[data-bdata-quote-go]', e => !e.disabled)) === true, `state=${await state(hang)}`);
await hangCtx.close();

// 6 · honest failures
// a quote service that is not there = a port nothing listens on (counted at the browser)
const closed = createServer(); await new Promise(r => closed.listen(0, '127.0.0.1', r));
const deadOrigin = `http://127.0.0.1:${closed.address().port}`; await new Promise(r => closed.close(r));
const deadCtx = await openContext(deadOrigin);
const dead = await openPage(deadCtx);
dead.on('request', r => { if (r.url().indexOf(deadOrigin) === 0 && r.method() === 'POST') hits.dead++; });
await tap(dead, '[data-bdata-aud="public"]');
await dead.waitForSelector('[data-bdata-fail]', { timeout: 6000 }).catch(() => {});
const deadText = await words(dead, '[data-bdata-price-state]');
check('an unreachable quote service is named as such — never blamed on Autonomi', (await val(dead, '[data-bdata-fail]', e => e.dataset.bdataFail)) === 'unreachable' && /quote service on this device did not answer/i.test(deadText) && !/Autonomi did not answer/i.test(deadText));
check('it fails fast and still says nothing was paid from this page', hits.dead === 1 && /Nothing has been paid from this page/i.test(deadText), `requests=${hits.dead}`);
await tap(dead, '[data-bdata-quote-go]');
await dead.waitForTimeout(150);
check('…the press fired exactly one more request', hits.dead === 2, `requests=${hits.dead}`);
await dead.waitForSelector('[data-bdata-fail]', { timeout: 8000 }).catch(() => {}); // a refused connection can take ~2 s on Windows
check('…and its honest failure leaves a live Try again (never a dead end)', hits.dead === 2 && (await state(dead)) === 'failed' && (await val(dead, '[data-bdata-quote-go]', e => !e.disabled)) === true, `requests=${hits.dead}`);
await deadCtx.close();

// an AUTOMATED browser can never reach the live quote service by omission
const bareCtx = await openContext(null);
const bare = await openPage(bareCtx);
await tap(bare, '[data-bdata-aud="public"]');
await bare.waitForTimeout(500);
check('an automated browser with NO seeded mock is refused in words — the live quote service is never touched', (await val(bare, '[data-bdata-fail]', e => e.dataset.bdataFail).catch(() => 'none')) === 'automation' && liveBridgeTouches === 0, `live-bridge touches=${liveBridgeTouches}`);
await bareCtx.close();

// 1c · THE NEGATIVE CONTROLS (founder order 2026-09-25): the page says STORED
// only on a line-by-line match — a 404, a wrong size, sha, address, network,
// audience or a missing upload evidence row all render EXACTLY AS BEFORE; an
// UNREADABLE receipt is NAMED and Try again really recovers.
async function storedVariant(name, { mutate, status } = {}) {
  const c = await openContext(null);
  if (status || mutate) {
    await c.route('**/bdata-stored-bux-try-autonomi.json*', route => {
      if (status) return route.fulfill({ status, body: 'MOCK: ' + name });
      const r = JSON.parse(JSON.stringify(storeReceipt));
      mutate(r);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    });
  }
  const p = await openPage(c);
  await p.waitForTimeout(600);   // the receipt fetch settles (or fails) — then the verdict is stable
  const res = {
    stored: !!(await p.$('[data-bdata-stored]')),
    err: (await val(p, '[data-bdata-stored-err]', e => e.innerText)) || '',
    retry: !!(await p.$('[data-act="reload-stored"]')),
    ctx: c, page: p,
  };
  return res;
}
const flip = s => (s[0] === 'a' ? 'b' : 'a') + s.slice(1);

for (const [name, opt] of [
  ['404 — no receipt on file', { status: 404 }],
  ['wrong size', { mutate: r => { r.artifact.bytes = r.artifact.bytes + 1; } }],
  ['wrong sha256', { mutate: r => { r.artifact.sha256 = flip(r.artifact.sha256); } }],
  ['wrong data-map address', { mutate: r => { r.data_map_address = '0x' + flip(bareAddr); } }],
  ['wrong network', { mutate: r => { r.network = 'autonomi-testnet'; } }],
  ['wrong audience', { mutate: r => { r.audience = 'only-me'; } }],
  ['no upload evidence row', { mutate: r => { r.evidence = r.evidence.filter(e => e.state !== 'uploaded'); } }],
]) {
  const v = await storedVariant(name, opt);
  check(`negative control · ${name}: renders exactly as before (no STORED claim, no alarm)`, !v.stored && !v.err && !v.retry, v.err.slice(0, 60));
  await v.ctx.close();
}

// an unreadable receipt is NAMED in words — and Try again recovers to the truth
const bad = await storedVariant('HTTP 500 garbage', { status: 500 });
check('negative control · unreadable receipt: NAMED, never silent, never STORED', !bad.stored && /could not be read/i.test(bad.err) && /HTTP 500/.test(bad.err) && bad.retry, bad.err.replace(/\s+/g, ' ').slice(0, 90));
await bad.ctx.unroute('**/bdata-stored-bux-try-autonomi.json*');
await tap(bad.page, '[data-act="reload-stored"]');
await bad.page.waitForSelector('[data-bdata-stored]', { timeout: 8000 }).catch(() => {});
check('Try again really recovers: the good receipt lands and STORED shows', !!(await bad.page.$('[data-bdata-stored]')) && !(await bad.page.$('[data-bdata-stored-err]')));
await bad.ctx.close();

// 10 · laws
check('no pay-route strings anywhere (A9c law)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(fullHtml));
check('no request ever reached for the live quote service', liveBridgeTouches === 0, `touches=${liveBridgeTouches}`);
check('no bData page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 160));

await browser.close();
for (const s of hung) s.destroy();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbData GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbData GATE: GREEN — ${results.length}/${results.length} (every press answers; My Data owns policy; bPay holds the economics; supersede-not-mutate held)`);
process.exit(failed.length ? 1 : 0);
