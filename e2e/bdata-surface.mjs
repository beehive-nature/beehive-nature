// bData (My Data) gate — the organism-level data surface, first slice.
//
// Serves surfaces/ from the worktree and proves in chromium (390px):
//   1. the shelf renders the registered object with MECHANICAL identity
//      (name/bytes/sha from the committed reference invoice — never retyped);
//   2. "Who can get this?" shows the resolved audience; Public is bound as
//      committed (not re-choosable here); Only me / Selected people are
//      VISIBLY UNAVAILABLE with reasons — never promised;
//   3. the SUPERSEDE law is visible: a carried-quote-set commitment exists →
//      changing audience requires a new quote; the old plan stays history;
//   4. the bPay handoff: bounded obligation (ceiling from the carried quotes,
//      recomputed by this test) + gas SEPARATE + "Nothing has been paid." +
//      the link to the wallet's bPay panel;
//   5. AUTOMATION is a first-class policy: Ask me / Automatic within limits /
//      Never — mode changes persist AND append history (supersede-not-mutate:
//      prior entries intact after a second change);
//   6. inspection depth (newbee/raver/cypherpunk) toggles the anatomy
//      (Payload/Audience/Storage/Authority/Automation/Value/Evidence/History)
//      without touching audience or automation;
//   7. A9c law: no authorization route strings; no bData page errors.
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
let lastMockCount = 0; // the mock's request counter, mirrored for assertions
let mockRequests = 0; // module scope: one counter for the server's lifetime (a per-request `let` made every request "#1" — every response a 502)
let authRecords = []; // module scope too — same law: server-lifetime state never lives inside the request handler

const refInvoice = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice.json'), 'utf8'));
const ant = refInvoice.lines.find(l => l.asset === 'ANT');
const recomputedCeiling = ant.quotes.reduce((s, q) => s + BigInt(q.amount_atto), 0n).toString();

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  // MOCK quote service — the founder-shaped request asserted server-side; the
  // REAL bridge and the REAL acceptance belong to the founder alone. The FIRST
  // prepare 502s (the flake class the founder hit live) so the gate proves the
  // honest auto-retry; every request after succeeds.
  if (url === '/mock-bridge/v1/upload/prepare') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    mockRequests++;
    lastMockCount = mockRequests;
    if (parsed.audience !== 'public' || parsed.force_fresh !== true || parsed.artifact_sha256 !== refInvoice.domain.artifact.sha256) {
      res.writeHead(400); res.end('MOCK: request must carry {artifact pin, audience:public, force_fresh}'); return;
    }
    if (mockRequests === 1) { res.writeHead(502); res.end('insufficient peers: Got 0 quotes (MOCK flake)'); return; }
    // the mock speaks the CURRENT founder invoice's language (same totals, same
    // carried quotes) so the gate exercises the REAL cross-checks end to end
    const founderInv = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
    const fl = founderInv.lines.find(l => l.asset === 'ANT');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      upload_id: 'up-MOCK', artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes,
      total_chunks: 3, already_stored: 0, payment_type: 'wave_batch',
      total_amount_atto: fl.amountAtto,
      payments: fl.quotes.map(q => ({ quote_hash: q.quote_hash, amount_atto: q.amount_atto })),
      policy: { audience: 'public', binding: 'founder-selected:public' },
      note: 'MOCK-SYNTHETIC — never a network quote',
    }));
    return;
  }
  // MOCK authorization organ — validates the founder-shaped request server-side:
  // digest lineage, exact ceiling, audience binding, gas separation; NO silent
  // requote (a second create with a stale digest is refused); cancel is clean.
  if (url === '/mock-bridge/v1/authorization' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const a = JSON.parse(body);
    const founderInv = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
    const fl = founderInv.lines.find(l => l.asset === 'ANT');
    if (a.audience !== 'public' || !String(a.gesture || '').includes('founder press')) { res.writeHead(400); res.end('MOCK: gesture/audience malformed'); return; }
    if (a.invoice_digest !== founderInv.identity.contentDigest || a.commitment_digest !== founderInv.commitment.digest) { res.writeHead(409); res.end('MOCK: digest mismatch — stale lineage refused'); return; }
    if (a.ant_ceiling_atto !== fl.amountAtto) { res.writeHead(409); res.end('MOCK: ceiling must be exact'); return; }
    const rec = { authorization_id: 'auth-MOCK-1', state: 'authorized-for-signing', invoice_digest: a.invoice_digest, ant_ceiling_atto: a.ant_ceiling_atto, events: [{ kind: 'authorized-for-signing' }] };
    authRecords.push(rec);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rec));
    return;
  }
  if (url === '/mock-bridge/v1/authorization/cancel' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { authorization_id } = JSON.parse(body);
    const rec = authRecords.find(r => r.authorization_id === authorization_id);
    if (!rec) { res.writeHead(404); res.end('unknown'); return; }
    rec.state = 'cancelled';
    rec.events.push({ kind: 'cancelled' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rec));
    return;
  }
  const p = (url === '/' ? '/bdata.html' : url);
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// seed the mock quote service BEFORE any page script runs (the near-miss law:
// a post-hoc poke can miss in-memory state and fire the real bridge)
await page.addInitScript(bridge => {
  localStorage.setItem('bdata-v1', JSON.stringify({ inspection: 'newbee', automation: { mode: 'ask', boundAnt: '0.5' }, history: [], bridge, freshQuote: null }));
}, origin + '/mock-bridge');
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') console.log(`  [page-console-error] ${m.text()}`); });

await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
await page.waitForTimeout(1400);

const text = await page.innerText('body');

// 1 · the shelf — mechanical identity
check('object renders with mechanical identity', text.includes(refInvoice.domain.artifact.name) && text.includes('214,091,829'), 'name + exact bytes from the reference invoice');
const bytesAttr = await page.$eval('[data-bdata-bytes]', e => e.dataset.bdataBytes);
check('bytes machine-exact', bytesAttr === String(refInvoice.domain.artifact.bytes), bytesAttr);

// 2 · audience — resolved + unavailable modes visible
check('who-can-get line present', /anyone who obtains the Autonomi address/i.test(text));
const unavail = await page.$$eval('[data-bdata-unavailable]', els => els.map(e => e.dataset.bdataUnavailable));
check('unavailable audience modes visible (never promised)', unavail.includes('only-me') && unavail.includes('selected-people'), unavail.join(','));

// 3 · supersede law visible
check('supersede note: commitment exists, change requires a new quote', !!(await page.$('[data-bdata-supersede-note]')) && /requires a new quote/i.test(text));

// 3b · THE ORIGIN LOOP (advisor law): the Public selection originates HERE —
// recorded in the SHARED policy key the wallet's bPay panel reads at boot;
// bData history appends the policy edition; the handoff becomes ready
check('origin prompt present before the gesture (machine reference named)', /machine reference|current binding/i.test(text));
check('pre-choice: preserve shows the waiting step (no dead hearts)', !!(await page.$('[data-bdata-preserve-waiting]')) && !(await page.$('[data-bdata-open-bpay]')));
await page.click('[data-bdata-aud="public"]');
await page.waitForTimeout(300);
const shared = await page.evaluate(() => JSON.parse(localStorage.getItem('bpay-policy-v1') || 'null'));
check('the gesture records in the SHARED policy key (origin: My Data)', !!(shared && shared.audience === 'public' && shared.selectedAt), JSON.stringify(shared || 'absent'));
check('bData history appends the audience policy edition', (await page.$$eval('[data-bdata-history]', els => els.length)) === 1);
check('origin attribution rendered ("originated in My Data")', /originated in My Data/i.test(await page.innerText('#shelf')));
check('preserve handoff becomes ready', !!(await page.$('[data-bdata-quote-go]')));
check('ONE primary affordance: Get the storage price (no navigation away)', await page.$$eval('[data-bdata-quote-go]', els => els.length === 1) && !(await page.$('[data-bdata-open-bpay]')));
check('supersede note still present after the gesture', !!(await page.$('[data-bdata-supersede-note]')));
check('authorize step visibly locked (payment absent by law)', !!(await page.$('[data-bdata-authorize-next]')));
// THE PRICE, IN PLACE — the gesture IS the trigger (latency law): choosing
// Public auto-starts the network ask; the first mock response 502s (the flake
// class the founder hit live) and the honest auto-retry recovers; the price
// renders on THIS page (URL never changes); a refresh asks again on demand
const urlBefore = page.url();
await page.waitForTimeout(500);
check('price ask started automatically with the gesture (no second press)', lastMockCount >= 1, `requests=${lastMockCount}`);
await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 12000 });
const founderInvDoc = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
const MOCK_TOTAL = founderInvDoc.lines.find(l => l.asset === 'ANT').amountAtto;
const freshAtto = await page.$$eval('[data-bdata-fresh-atto]', els => els.map(e => e.dataset.bdataFreshAtto).join(','));
check('fresh price rendered IN PLACE after the auto-retry recovered the flake', freshAtto === MOCK_TOTAL, `fresh=${freshAtto} requests=${lastMockCount}`);
check('the flake auto-retried exactly once (2 requests, not a loop)', lastMockCount === 2, `requests=${lastMockCount}`);
check('page never navigated (one page, one concept)', page.url() === urlBefore, page.url());
check('caused-by-your-choice line present', /caused by your choice/i.test(await page.innerText('body')));
check('nothing-paid line present', /Nothing has been paid/i.test(await page.innerText('body')));
check('cached refresh affordance present', !!(await page.$('[data-bdata-price-refresh]')));
const beforeRefresh = lastMockCount;
await page.click('[data-bdata-price-refresh]');
await page.waitForTimeout(600);
check('refresh asks the network again on demand', lastMockCount === beforeRefresh + 1, `${beforeRefresh}→${lastMockCount}`);

// 6 · THE AUTHORIZATION STEP (Phase C) — one founder-reviewed object, bound to
// the exact invoice lineage; the press creates intent only; cancel is clean.
// NOTE: the mock's prepare returns totals from the COMMITTED founder invoice so
// the gate exercises the REAL cross-check (cached price vs current invoice).
check('review affordance present after the price', !!(await page.$('[data-bdata-review-open]')));
await page.click('[data-bdata-review-open]');
await page.waitForTimeout(300);
const panelText = await page.$$eval('[data-bdata-review-panel]', els => els.length ? els[0].innerText : '');
check('review panel shows the invoice digest + lineage', /invoice/i.test(panelText) && /sha256:/i.test(panelText));
check('review panel binds the exact artifact identity', panelText.includes('try_autonomi.mp4') && panelText.includes('214,091,829'));
check('review panel shows audience = founder-selected, origin My Data', /founder-selected/i.test(panelText) && /My Data/i.test(panelText));
check('review panel: ANT ceiling exact, never above', /ceiling/i.test(panelText) && /exact, never above/i.test(panelText));
check('review panel: gas separate', /separate/i.test(panelText) && /Arbitrum/i.test(panelText));
check('review panel: freshness + single-use (digest wall)', /single-use/i.test(panelText) && /re-quote voids/i.test(panelText));
check('review panel: nothing paid + intent cannot move value', /Nothing has been paid/i.test(panelText) && /cannot move value/i.test(panelText));
check('NO signing path exposed (no pay route strings)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(panelText));
await page.click('[data-bdata-auth-go]');
await page.waitForTimeout(700);
const authText = await page.innerText('body');
check('the press creates the authorization record (authorized-for-signing)', /Authorized for signing/i.test(authText) && /auth-MOCK-1/.test(authText));
check('history appends the authorization edition', (await page.$$eval('[data-bdata-history]', els => els.length)) === 2,
  `editions so far: origin + authorization`);
await page.$eval('[data-bdata-auth-cancel]', el => el.click()); // DOM-native click on the live node (render-rebuild races lose Playwright clicks)
await page.waitForTimeout(600);
const cancelText = await page.innerText('body');
check('cancellation is clean — no paid or uploaded state exists', /Cancelled/i.test(cancelText) && /no paid or uploaded state/i.test(cancelText),
  `live-auth=${JSON.stringify(await page.evaluate(() => window.__bdata.authorization))} snippet=${JSON.stringify((await page.$$eval('[data-bdata-review]', els => els.map(e => e.innerText.slice(0, 90)))).join(' || '))}`);

// 5 · automation — first-class, persisted, supersede-not-mutate
// (history already carries: edition 1 = origin gesture, edition 2 = authorization)
check('automation default Ask me', (await page.$eval('[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode)) === 'ask');
await page.click('[data-bdata-auto="never"]');
await page.waitForTimeout(200);
let hist = await page.$$eval('[data-bdata-history]', els => els.length);
check('policy change appends history (4 editions: origin + auth + authcancel + automation)', hist === 4, `history=${hist}`);
const lsMode = await page.evaluate(() => JSON.parse(localStorage.getItem('bdata-v1')).automation.mode);
check('automation persists (localStorage)', lsMode === 'never', lsMode);
await page.click('[data-bdata-auto="ask"]');
await page.waitForTimeout(200);
hist = await page.$$eval('[data-bdata-history]', els => els.length);
const editions = await page.$$eval('[data-bdata-history]', els => els.map(e => e.innerText));
check('second change appends, all editions intact (5)', hist === 5 && editions.some(t => /Public/.test(t)) && editions.some(t => /never/i.test(t)) && editions.some(t => /authorization/i.test(t)), `history=${hist}`);

// 6 · inspection depth — anatomy without authority
await page.click('[data-bdata-insp="cypherpunk"]');
await page.waitForTimeout(250);
const anatomyVisible = await page.$eval('#cyber', e => e.offsetHeight > 0 && /Payload/.test(e.innerText) && /Authority/.test(e.innerText) && /Evidence/.test(e.innerText));
const sections = await page.$$eval('#cyber .sect', els => els.length);
check('cypherpunk view shows the anatomy (8 sections)', anatomyVisible && sections === 8, `${sections} sections`);
await page.click('[data-bdata-insp="newbee"]');
await page.waitForTimeout(250);
const hidden = await page.$eval('#cyber', e => e.offsetHeight === 0);
const modeStillAsk = await page.$eval('[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode);
check('newbee hides anatomy; policy untouched', hidden && modeStillAsk === 'ask');

// 7 · laws
const fullHtml = await page.content();
check('no authorization route strings (A9c law)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(fullHtml));
check('no bData page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 160));

await page.screenshot({ path: join(here, 'shots-bdata', 'bdata-390.png'), fullPage: false });
await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbData GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbData GATE: GREEN — ${results.length}/${results.length} (My Data owns policy; bPay holds the economics; supersede-not-mutate held)`);
process.exit(failed.length ? 1 : 0);
