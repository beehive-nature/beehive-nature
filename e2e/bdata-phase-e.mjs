// bData PHASE E gate — the two-observation signing ceremony (UX lane rider):
// authorization → OBSERVATION A (harmless device preflight) → OBSERVATION B
// (the two real signatures, shown before anything signs) → locally verified
// signature → HARD STOP at SIGNED / NOT BROADCAST.
//
// Serves surfaces/ from the worktree and proves in chromium (390px):
//   1. after a completed Phase-C authorization, SIGN WITH TREZOR appears and
//      the CEREMONY RAIL surfaces the frozen states (PREPARED → AUTHORIZATION
//      REVIEW → AUTHORIZED → DEVICE PREFLIGHT → SIGNING REVIEW → SIGNED/NOT
//      BROADCAST) — orientation only, never an affordance;
//   2. OBSERVATION A is its own visually distinct state (cyan): harmless by
//      construction, transport named as infrastructure (this page the
//      cockpit), SIMULATED transport honestly labeled until the hardware
//      lane lands, and B LOCKED until A confirms (locked, not hidden);
//   3. a deliberate preflight REJECTION on the device reads as a NORMAL,
//      user-controlled outcome (never a system failure), B stays locked, and
//      the ceremony recovers only from the founder's own re-press;
//   4. OBSERVATION B (gold, visually distinct from A) shows EXACTLY 2 device
//      signatures and what each signs (ERC-20 approve bounded never
//      unlimited + ONE payForQuotes carrying all quotes) with every binding
//      line visible (artifact, audience, invoice lineage, job/quotes, exact
//      ANT ceiling, SEPARATE gas, contracts + chain, payer, path) and
//      SIGNING DOES NOT BROADCAST OR PAY;
//   5. ONE press begins the device session; the verified result renders
//      SIGNED with per-slot locally-computed hashes + recovered signer, a
//      banner-strength NOT BROADCAST · NOT PAID · NOT UPLOADED, the receipt
//      offered for inspection, broadcast visibly LOCKED — and NOTHING
//      further is offered;
//   6. a device rejection at signing ALSO reads as the calm user-controlled
//      outcome (exactly one dispatch, no loop);
//   7. refusal laws render as LAWS (the organ's exact refusal shapes):
//      missing authorization (TODAY'S LIVE STATE on the founder's machine);
//   8. SETTLEMENT LAW: a real-Safe-7-shaped ceremony NEVER shows a
//      settlement action — mainnet-shaped receipts (A14b) AND
//      testnet/replica-shaped hardware receipts both refuse the affordance;
//      the settle step exists ONLY under a TESTNET receipt born from the
//      hot-key DEMO ceremony (the banked f3962879 pipeline proof);
//   9. TESTNET-REPLICA is impossible to confuse with public Arbitrum
//      Sepolia (full-phrase banner on the review AND the receipt);
//  10. zero broadcast-route calls; zero page errors.
//
//   node e2e/bdata-phase-e.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const SHOTS = join(here, 'shots-bdata');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const founderInv = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
const fl = founderInv.lines.find(l => l.asset === 'ANT');
// deterministic rewards addresses for the mock payment set (digest wall
// covers hashes; amounts sum-checked; rewards ride calldata in the organ)
const payments = fl.quotes.map(q => ({
  quote_hash: q.quote_hash,
  rewards_address: '0x' + q.quote_hash.slice(2, 42),
  amount_atto: q.amount_atto,
}));
const totalAtto = fl.amountAtto;
const commitment = 'sha256:' + createHash('sha256').update([...fl.quotes].map(q => q.quote_hash).sort().join('\n')).digest('hex');

// the organ's refusal vocabulary (mirrors crates/watchpay/src/wave.rs laws)
const REFUSALS = {
  missing: { law: 'LAW 1 (missing-authorization)', why: 'no authorization record exists — the founder\'s Phase-C press has not landed on this machine; signing is refused until one does' },
};

// ── the ceremony SHAPES the mock vends (all frozen contract fields) ──────
// MAINNET-shaped (the real Safe 7 ceremony target — chain 42161 constants)
const SHAPE_MAINNET = {
  mode: 'MAINNET', testnet: false, replica: false, chain_id: 42161,
  token: '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', vault: '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26',
  payer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', // PUBLIC-CONSTANT: synthetic published test key address
  path: "m/44'/60'/0'/0/0 (Trezor Safe 7 — hardware ceremony; Suite MCP as transport underneath)",
};
// TESTNET-REPLICA-shaped HARDWARE ceremony (the first Safe 7 rehearsal
// shape — replica ledger constants, chain 421614, real device not hot key)
const SHAPE_REPLICA_HW = {
  mode: 'TESTNET-REPLICA', testnet: true, replica: true, chain_id: 421614,
  token: '0x1111111111111111111111111111111111111111', vault: '0x2222222222222222222222222222222222222222', // PUBLIC-CONSTANT: synthetic replica fixture addresses
  payer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', // PUBLIC-CONSTANT: synthetic published test key address
  path: "m/44'/60'/0'/0/0 (Trezor Safe 7 — hardware ceremony; Suite MCP as transport underneath)",
};
// the hot-key DEMO shape (the banked f3962879 pipeline proof)
const SHAPE_DEMO = {
  mode: 'TESTNET-REPLICA-DEMO', testnet: true, replica: true, chain_id: 421614,
  token: '0x1111111111111111111111111111111111111111', vault: '0x2222222222222222222222222222222222222222', // PUBLIC-CONSTANT: synthetic replica fixture addresses
  payer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', // PUBLIC-CONSTANT: synthetic published test key address
  path: "m/44'/60'/0'/0/0 (hot TESTNET key in demo mode — the Safe 7 arrives with the hardware transport)",
};

// server-lifetime state (never inside a request handler — the Phase C law)
let beginCalls = 0;
let deviceMode = 'ok'; // ok | reject
let reviewShape = SHAPE_MAINNET;

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const read = async () => { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; };

  // MOCK quote service (prepare speaks the founder invoice's own quotes)
  if (url === '/mock-bridge/v1/upload/prepare') {
    await read();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      upload_id: 'up-MOCK-E', artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes,
      total_chunks: 3, already_stored: 0, payment_type: 'wave_batch', total_amount_atto: totalAtto,
      payments, policy: { audience: 'public', binding: 'founder-selected:public' },
      note: 'MOCK-SYNTHETIC — never a network quote',
    }));
    return;
  }
  if (url === '/mock-bridge/v1/authorization' && req.method === 'POST') {
    const a = await read();
    if (a.commitment_digest !== commitment || a.ant_ceiling_atto !== totalAtto) { res.writeHead(409); res.end('MOCK: digest/ceiling mismatch'); return; }
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authorization_id: 'auth-MOCK-E1', state: 'authorized-for-signing', events: [{ kind: 'authorized-for-signing' }] }));
    return;
  }
  if (url === '/mock-bridge/v1/authorization/cancel') { await read(); res.writeHead(200); res.end('{}'); return; }

  // MOCK SIGNING COCKPIT (the frozen bpay-sign service contract) —
  // /v1/sign/state: re-derives the digest wall server-side and returns the
  // review (transaction count law) or the organ's refusal shape.
  if (url === '/mock-sign/v1/sign/state') {
    const b = await read();
    const presented = 'sha256:' + createHash('sha256').update((b.payments || []).map(p => p.quote_hash).sort().join('\n')).digest('hex');
    if (presented !== commitment) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, refusal: { law: 'LAW 9 (no-silent-requote)', why: `presented set re-derives ${presented.slice(0, 20)}… but the authorization pins the committed set` } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, review: Object.assign({
      authorization_id: b.authorization_id, upload_id: b.upload_id,
      artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes,
      audience: 'public', invoice_digest: founderInv.identity.contentDigest,
      quote_count: (b.payments || []).length, ant_ceiling_atto: totalAtto,
      gas_ceiling: 'separate — wallet-side at signing',
      transaction_count: 2,
      note: 'MOCK-SYNTHETIC — never a device session',
    }, reviewShape) }));
    return;
  }
  // /v1/sign/begin: ONE dispatch; ok → the verified receipt (synthetic
  // hashes/signer — the real organ computes them through the wall);
  // reject → the honest device failure; a SECOND begin for the same
  // authorization is refused (replay).
  if (url === '/mock-sign/v1/sign/begin') {
    beginCalls++;
    await read();
    if (deviceMode === 'reject') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'device session ended without a verified signature', why: 'MOCK device rejection — the founder held the button and said no; no retry, ever' }));
      return;
    }
    if (beginCalls > 1) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, refusal: { law: 'slot', why: 'slot 1 already carries a verified signature — duplicate/successful-signature replay refused; a restart never re-signs' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, receipt: {
      schema: 'bpay.sign-receipt/1', state: 'signed', transaction_count: 2,
      payer: reviewShape.payer,
      testnet: reviewShape.testnet, replica: reviewShape.replica,
      slots: [
        { slot: 1, operation: 'approve', tx_hash: '0x' + '1'.repeat(64), signer: reviewShape.payer, nonce: 7 }, // PUBLIC-CONSTANT: synthetic fixture hash
        { slot: 2, operation: 'pay_for_quotes', tx_hash: '0x' + '2'.repeat(64), signer: reviewShape.payer, nonce: 8 }, // PUBLIC-CONSTANT: synthetic fixture hash
      ],
      broadcast: false, paid: false, uploaded: false, finalized: false,
      note: 'MOCK-SYNTHETIC — never a device session',
    } }));
    return;
  }
  // /v1/testnet/settle — structurally testnet-only (the service's law)
  if (url === '/mock-sign/v1/testnet/settle') {
    await read();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, settled: 'TESTNET-REPLICA', note: 'settled on the Arbitrum-Sepolia-shaped TESTNET-REPLICA ledger (real Autonomi contract artifacts, local chain 421614 — NOT public Arbitrum Sepolia); never mainnet; proof-of-pipeline only', transactions: [
      { slot: 1, operation: 'approve', tx_hash: '0x' + '1'.repeat(64), status: 'sent/confirmed-on-testnet' }, // PUBLIC-CONSTANT: synthetic fixture hash
      { slot: 2, operation: 'pay_for_quotes', tx_hash: '0x' + '2'.repeat(64), status: 'sent/confirmed-on-testnet' }, // PUBLIC-CONSTANT: synthetic fixture hash
    ] }));
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

async function freshPage(scenario) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(({ bridge }) => {
    localStorage.setItem('bdata-v1', JSON.stringify({ inspection: 'newbee', automation: { mode: 'ask', boundAnt: '0.5' }, history: [], bridge, freshQuote: null, signing: { service: bridge.replace('/mock-bridge', '/mock-sign') } }));
  }, { bridge: origin + '/mock-bridge' });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { page, errs };
}

// walk to an authorized state (audience → price → review → authorize)
async function walkToAuthorized(page) {
  await page.click('[data-bdata-aud="public"]');
  await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 8000 });
  await page.click('[data-bdata-review-open]');
  await page.waitForTimeout(250);
  await page.click('[data-bdata-auth-go]');
  await page.waitForTimeout(600);
}

// walk through OBSERVATION A to a confirmed preflight (OBSERVATION B opens)
async function walkThroughPreflight(page) {
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-confirmed]', { timeout: 4000 });
}

// ── SCENARIO A: the full two-observation ceremony, mock-proven ───────────
{
  const { page, errs } = await freshPage('A');
  reviewShape = SHAPE_MAINNET; beginCalls = 0; deviceMode = 'ok';
  await walkToAuthorized(page);
  const body = await page.innerText('body');
  check('A1 authorized state shows SIGN WITH TREZOR (the Phase E door)', /Authorized for signing/i.test(body) && !!(await page.$('[data-bdata-sign-open]')));
  check('A1b the ceremony rail surfaces the frozen states (rail + preflight current)', !!(await page.$('[data-bdata-rail]')) && (await page.$eval('[data-bdata-rail-step="preflight"]', e => e.dataset.state)) === 'current');
  check('A1c rail names the terminal state SIGNED / NOT BROADCAST', /SIGNED \/ NOT BROADCAST/i.test(await page.$eval('[data-bdata-rail-step="signed"]', e => e.innerText)));

  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  const obsA = await page.$eval('[data-bdata-obs-a]', e => e.innerText);
  check('A2a OBSERVATION A renders as its own distinct harmless state', /OBSERVATION A/i.test(obsA) && /harmless/i.test(obsA) && /cannot spend/i.test(obsA));
  check('A2b the transport is named as infrastructure; this page the cockpit', /cockpit/i.test(obsA) && /Suite MCP/i.test(obsA));
  check('A2c the SIMULATED rehearsal is labeled (estate law)', /SIMULATED/i.test(obsA));
  check('A2d OBSERVATION B is LOCKED before A completes (locked, not hidden)', (await page.$eval('[data-bdata-obs-b]', e => e.dataset.obsB || e.getAttribute('data-bdata-obs-b'))) === 'locked' && /locked/i.test(await page.$eval('[data-bdata-obs-b]', e => e.innerText)));
  check('A2e no begin button while B is locked', !(await page.$('[data-bdata-sign-go]')));

  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-confirmed]', { timeout: 4000 });
  const confirmed = await page.$eval('[data-bdata-preflight-confirmed]', e => e.innerText);
  check('A3 preflight confirmed — derived address matches the expected payer', /matches the expected payer/i.test(confirmed) && /0x35defbea/i.test(confirmed));
  check('A3b rail advanced (preflight done, sign review current)', (await page.$eval('[data-bdata-rail-step="preflight"]', e => e.dataset.state)) === 'done' && (await page.$eval('[data-bdata-rail-step="signreview"]', e => e.dataset.state)) === 'current');

  await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
  const review = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
  check('A4 OBSERVATION B renders distinctly (the two real signatures)', /OBSERVATION B/i.test(review) && /two real signatures/i.test(review));
  const manifest = await page.$eval('[data-bdata-sig-manifest]', e => e.innerText);
  check('A5 the manifest shows EXACTLY 2 signatures, numbered', /1\/2/i.test(manifest) && /2\/2/i.test(manifest) && /signature 1 of 2/i.test(manifest) && /signature 2 of 2/i.test(manifest));
  check('A6 signature 1 = ERC-20 approve, bounded never unlimited', /ERC-20 approve/i.test(manifest) && /bounded, never unlimited/i.test(manifest));
  check('A7 signature 2 = payForQuotes ONE call carrying ALL payments', /payForQuotes, one call/i.test(manifest) && /ALL the quote payments/i.test(manifest) && /56 quotes/i.test(manifest));
  check('A8 review states EXACTLY 2 transactions expected', /2 expected/i.test(review), review.match(/transactions[^\n]*/i)?.[0] || '');
  check('A9 the 2 are explained (approve + payForQuotes carrying all quotes)', /approve/i.test(review) && /payForQuotes/i.test(review));
  check('A10 review shows the quote count (56 quotes on the job)', /56 quotes/i.test(review));
  check('A11 review: exact ANT ceiling, never above', /exact, never above/i.test(review));
  check('A12 review: gas SEPARATE (Arbitrum ETH)', /separate/i.test(review) && /Arbitrum/i.test(review));
  check('A13 review: contracts + chain named (ANT token, vault, 42161)', /0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684/i.test(review) && /0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26/i.test(review) && /42161/.test(review));
  check('A14 review: payer shown with the device path', /0x35defbea/i.test(review) && /m\/44'\/60'\/0'\/0\/0/i.test(review));
  check('A15 review: SIGNING DOES NOT BROADCAST OR PAY (prominent)', /SIGNING DOES NOT BROADCAST OR PAY/i.test(review));
  check('A16 ONE primary press (Begin device signing)', (await page.$$eval('[data-bdata-sign-go]', els => els.length)) === 1);
  await page.screenshot({ path: join(SHOTS, 'bdata-phase-e-obs-review-390.png'), fullPage: false });

  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  const signed = await page.$eval('[data-bdata-signed]', e => e.innerText);
  check('A17 SIGNED renders with both slot hashes', signed.includes('0x' + '1'.repeat(64)) && signed.includes('0x' + '2'.repeat(64)));
  check('A18 verified signer shown (recovered, synthetic)', /0x35defbea2aad6323726fed45dc3388010ea85f9c/i.test(signed));
  check('A19 banner-strength NOT BROADCAST · NOT PAID · NOT UPLOADED', !!(await page.$('[data-bdata-notbroadcast]')) && /NOT BROADCAST/i.test(signed) && /NOT PAID/i.test(signed) && /NOT UPLOADED/i.test(signed));
  check('A20 broadcast visibly LOCKED (locked, not hidden)', !!(await page.$('[data-bdata-broadcast-locked]')) && /locked/i.test(await page.$eval('[data-bdata-broadcast-locked]', e => e.innerText)));
  check('A21 the receipt is offered for inspection first', /inspect this receipt/i.test(signed));
  check('A22 HARD STOP — no further affordance of any kind (no sign buttons remain)', !(await page.$('[data-bdata-sign-go]')) && !(await page.$('[data-bdata-sign-open]')));
  check('A22b MAINNET-shaped receipt NEVER offers settlement (testnet-only law)', !(await page.$('[data-bdata-settle-go]')) && !(await page.$('[data-bdata-settled]')));
  check('A23 rail terminal state reached (SIGNED / NOT BROADCAST done)', (await page.$eval('[data-bdata-rail-step="signed"]', e => e.dataset.state)) !== 'future');
  check('A24 zero page errors (scenario A)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));

  await page.screenshot({ path: join(SHOTS, 'bdata-phase-e-signed-390.png') });
  await page.close();
}

// ── SCENARIO A2: a deliberate preflight REJECTION — normal, recoverable ──
{
  const { page, errs } = await freshPage('A2');
  reviewShape = SHAPE_MAINNET; beginCalls = 0; deviceMode = 'ok';
  await walkToAuthorized(page);
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  await page.evaluate(() => { window.__bdataPreflightSim = 'reject'; });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-rejected]', { timeout: 4000 });
  const rej = await page.$eval('[data-bdata-preflight-rejected]', e => e.innerText);
  check('A2R1 the rejection reads as the USER\'S choice (not a failure)', /nothing was signed, nothing was sent/i.test(rej) && /normal, user-controlled outcome/i.test(rej));
  check('A2R2 no amber system-failure styling on a deliberate rejection', !(await page.$('[data-bdata-preflight-mismatch]')));
  check('A2R3 OBSERVATION B stays locked after the rejection', (await page.$eval('[data-bdata-obs-b]', e => e.getAttribute('data-bdata-obs-b'))) === 'locked' && !(await page.$('[data-bdata-sign-go]')));
  await page.screenshot({ path: join(SHOTS, 'bdata-phase-e-preflight-rejected-390.png'), fullPage: false });
  // recovery is the founder's own re-press — never automatic
  await page.evaluate(() => { window.__bdataPreflightSim = 'confirm'; });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-confirmed]', { timeout: 4000 });
  check('A2R4 recovery by the founder\'s own re-press (B unlocks, no reload)', !!(await page.$('[data-bdata-sign-review]')));
  check('A2R5 zero page errors (scenario A2)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.close();
}

// ── SCENARIO B: TODAY'S LIVE STATE — the machine holds ZERO records ─────
{
  const { page, errs } = await freshPage('B');
  await walkToAuthorized(page); // the page BELIEVES it is authorized (its own press)
  // the SERVICE answers with the organ's LAW 1 — exactly the live machine
  // split: cached belief on the page, zero records in the organ
  await page.route('**/v1/sign/state', route => route.fulfill({
    status: 409, contentType: 'application/json',
    body: JSON.stringify({ ok: false, refusal: REFUSALS.missing }),
  }));
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-sign-refused]', { timeout: 5000 });
  const refused = await page.$eval('[data-bdata-sign-refused]', e => e.innerText);
  check('B1 missing-authorization refusal renders AS A LAW (today live machine state)', /LAW 1/.test(refused) && /missing-authorization/.test(refused), refused.slice(0, 110));
  check('B2 the refusal names what must change (the founder press has not landed)', /has not landed/i.test(refused));
  check('B3 no SIGNED state was fabricated', !(await page.$('[data-bdata-signed]')));
  check('B4 zero page errors (scenario B)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.close();
}

// ── SCENARIO C: device rejection at signing — normal outcome, no retry ───
{
  deviceMode = 'reject';
  beginCalls = 0;
  reviewShape = SHAPE_MAINNET;
  const { page, errs } = await freshPage('C');
  await walkToAuthorized(page);
  await walkThroughPreflight(page);
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-sign-rejected]', { timeout: 5000 });
  const rejText = await page.$eval('[data-bdata-sign-rejected]', e => e.innerText);
  check('C1 device rejection reads as the calm user-controlled outcome', /You rejected this on the device/i.test(rejText) && /user-controlled outcome/i.test(rejText) && /no automatic retry/i.test(rejText), rejText.slice(0, 110));
  check('C1b it is NOT styled as a system failure (amber error panel absent)', !(await page.$('[data-bdata-sign-error]')));
  check('C2 exactly ONE dispatch — no retry loop', beginCalls === 1, `beginCalls=${beginCalls}`);
  check('C3 no SIGNED state was fabricated', !(await page.$('[data-bdata-signed]')));
  check('C4 zero page errors (scenario C)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.close();
  deviceMode = 'ok';
}

// ── SCENARIO D: TESTNET-REPLICA HARDWARE shape — no settlement, ever ─────
{
  reviewShape = SHAPE_REPLICA_HW; beginCalls = 0; deviceMode = 'ok';
  const { page, errs } = await freshPage('D');
  await walkToAuthorized(page);
  await walkThroughPreflight(page);
  const review = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
  check('D1 the REPLICA banner is impossible to confuse with public Sepolia', /TESTNET-REPLICA/i.test(review) && /NOT public Arbitrum Sepolia/i.test(review) && /local ledger/i.test(review));
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  const signed = await page.$eval('[data-bdata-signed]', e => e.innerText);
  check('D2 the receipt names the TESTNET-REPLICA (NOT public Sepolia)', !!(await page.$('[data-bdata-receipt-testnet]')) && /TESTNET-REPLICA receipt/i.test(signed) && /NOT public Sepolia/i.test(signed));
  check('D3 FIRST-SAFE-7 LAW: a hardware ceremony NEVER shows a settlement action (even testnet-shaped)', !(await page.$('[data-bdata-settle-go]')) && !(await page.$('[data-bdata-settled]')));
  check('D4 SIGNED still unmistakably NOT BROADCAST on the replica shape', !!(await page.$('[data-bdata-notbroadcast]')) && /NOT BROADCAST/i.test(signed));
  check('D5 zero page errors (scenario D)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.screenshot({ path: join(SHOTS, 'bdata-phase-e-replica-signed-390.png') });
  await page.close();
}

// ── SCENARIO E: the hot-key DEMO shape keeps the banked settle step ──────
{
  reviewShape = SHAPE_DEMO; beginCalls = 0; deviceMode = 'ok';
  const { page, errs } = await freshPage('E');
  await walkToAuthorized(page);
  await walkThroughPreflight(page);
  const review = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
  check('E1 the demo review names the hot TESTNET key transport', /hot TESTNET key/i.test(review));
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  check('E2 the DEMO (testnet + hot-key) receipt KEEPS the settle affordance (banked f3962879 proof)', !!(await page.$('[data-bdata-settle-go]')));
  await page.click('[data-bdata-settle-go]');
  await page.waitForSelector('[data-bdata-settled]', { timeout: 5000 });
  const settled = await page.$eval('[data-bdata-settled]', e => e.innerText);
  check('E3 settled banner names the REPLICA precisely (never bare "testnet")', /SETTLED ON THE TESTNET-REPLICA/i.test(settled) && /NOT public Sepolia/i.test(settled));
  check('E4 zero page errors (scenario E)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.close();
}

await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbData PHASE E GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbData PHASE E GATE: GREEN — ${results.length}/${results.length} (two-observation ceremony; signing ends at a locally verified signature; NOT broadcast, NOT paid, NOT uploaded; settlement only on the demo testnet proof)`);
process.exit(failed.length ? 1 : 0);
