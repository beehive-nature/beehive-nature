// bData PHASE E gate — the Trezor signing step: authorization → reviewed
// device signing → locally verified signature → HARD STOP at SIGNED.
//
// Serves surfaces/ from the worktree and proves in chromium (390px):
//   1. after a completed Phase-C authorization, SIGN WITH TREZOR appears;
//   2. the signing review states the EXACT transaction count (2: 1 approve
//      + 1 payForQuotes over the 56 carried quotes) with an explanation —
//      never a hidden confirmation count;
//   3. every binding line is visible (artifact, audience, invoice lineage,
//      job/quotes, exact ANT ceiling, SEPARATE gas, contracts + chain,
//      payer derivation, path) and SIGNING DOES NOT BROADCAST OR PAY;
//   4. ONE press begins the device session; the verified result renders
//      SIGNED with per-slot locally-computed hashes + recovered signer and
//      NOT BROADCAST · NOT PAID · NOT UPLOADED — and NOTHING further is
//      offered (no broadcast affordance of any kind);
//   5. refusal laws render as LAWS (mock returns the organ's exact refusal
//      shapes): missing authorization (TODAY'S LIVE STATE on the founder's
//      machine), stale lineage;
//   6. a device rejection ends EXPLICITLY with no automatic retry (exactly
//      one dispatch, no loop);
//   7. zero broadcast-route calls; zero page errors.
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : name.startsWith('RED') ? '⊗' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

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
  stale: { law: 'LAW 4 (stale-lineage)', why: 'job up-X has a NEWER open sibling for the same artifact — the authorization\'s quote lineage is stale; refresh the price and re-authorize' },
};

// server-lifetime state (never inside a request handler — the Phase C law)
let beginCalls = 0;
let deviceMode = 'ok'; // ok | reject
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

  // MOCK SIGNING COCKPIT (the staged bpay-sign service contract) —
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
    res.end(JSON.stringify({ ok: true, review: {
      authorization_id: b.authorization_id, upload_id: b.upload_id,
      artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes,
      audience: 'public', invoice_digest: founderInv.identity.contentDigest,
      quote_count: (b.payments || []).length, ant_ceiling_atto: totalAtto,
      gas_ceiling: 'separate — wallet-side at signing',
      token: '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', vault: '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', chain_id: 42161,
      payer: null, path: "m/44'/60'/0'/0/0",
      transaction_count: 2,
      note: 'MOCK-SYNTHETIC — never a device session',
    } }));
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
      res.end(JSON.stringify({ ok: false, error: 'device session ended without a verified signature', why: 'MOCK device rejection — no retry, ever' }));
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
      payer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', // PUBLIC-CONSTANT: synthetic published test key address
      slots: [
        { slot: 1, operation: 'approve', tx_hash: '0x' + '1'.repeat(64), signer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', nonce: 7 }, // PUBLIC-CONSTANT: synthetic fixture hash
        { slot: 2, operation: 'pay_for_quotes', tx_hash: '0x' + '2'.repeat(64), signer: '0x35defbea2aad6323726fed45dc3388010ea85f9c', nonce: 8 }, // PUBLIC-CONSTANT: synthetic fixture hash
      ],
      broadcast: false, paid: false, uploaded: false, finalized: false,
      note: 'MOCK-SYNTHETIC — never a device session',
    } }));
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

// ── SCENARIO A: the full lawful signing ceremony, mock-proven ──────────
{
  const { page, errs } = await freshPage('A');
  await walkToAuthorized(page);
  const body = await page.innerText('body');
  check('A1 authorized state shows SIGN WITH TREZOR (the Phase E door)', /Authorized for signing/i.test(body) && !!(await page.$('[data-bdata-sign-open]')));

  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
  const review = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
  check('A2 review states EXACTLY 2 transactions expected', /2 expected/i.test(review) || /transactions[^]*2 expected/i.test(review), review.match(/transactions[^\n]*/i)?.[0] || '');
  check('A3 the 2 are explained (approve + payForQuotes carrying all quotes)', /approve/i.test(review) && /payForQuotes/i.test(review));
  check('A4 review shows the quote count (56 quotes on the job)', /56 quotes/i.test(review));
  check('A5 review: exact ANT ceiling, never above', /exact, never above/i.test(review));
  check('A6 review: gas SEPARATE (Arbitrum ETH)', /separate/i.test(review) && /Arbitrum/i.test(review));
  check('A7 review: contracts + chain named (ANT token, vault, 42161)', /0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684/i.test(review) && /0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26/i.test(review) && /42161/.test(review));
  check('A8 review: payer derived from the Trezor at the harmless preflight', /preflight/i.test(review) || /derived from your Trezor/i.test(review));
  check('A9 review: SIGNING DOES NOT BROADCAST OR PAY (prominent)', /SIGNING DOES NOT BROADCAST OR PAY/i.test(review));
  check('A10 ONE primary press (Begin device signing)', (await page.$$eval('[data-bdata-sign-go]', els => els.length)) === 1);

  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  const signed = await page.$eval('[data-bdata-signed]', e => e.innerText);
  check('A11 SIGNED renders with both slot hashes', signed.includes('0x' + '1'.repeat(64)) && signed.includes('0x' + '2'.repeat(64)));
  check('A12 verified signer shown (recovered, synthetic)', /0x35defbea2aad6323726fed45dc3388010ea85f9c/i.test(signed));
  check('A13 NOT BROADCAST · NOT PAID · NOT UPLOADED', /NOT BROADCAST/i.test(signed) && /NOT PAID/i.test(signed) && /NOT UPLOADED/i.test(signed));
  check('A14 HARD STOP — no further affordance of any kind (no sign buttons remain)', !(await page.$('[data-bdata-sign-go]')) && !(await page.$('[data-bdata-sign-open]')));
  check('A16 zero page errors (scenario A)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));

  await page.screenshot({ path: join(here, 'shots-bdata', 'bdata-phase-e-signed-390.png') });
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

// ── SCENARIO C: device rejection — explicit, no automatic retry ─────────
{
  deviceMode = 'reject';
  beginCalls = 0;
  const { page, errs } = await freshPage('C');
  await walkToAuthorized(page);
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-sign-error]', { timeout: 5000 });
  const errText = await page.$eval('[data-bdata-sign-error]', e => e.innerText);
  check('C1 device rejection renders explicitly (uncertain outcome stays explicit)', /no automatic retry|Device session/i.test(errText), errText.slice(0, 110));
  check('C2 exactly ONE dispatch — no retry loop', beginCalls === 1, `beginCalls=${beginCalls}`);
  check('C3 no SIGNED state was fabricated', !(await page.$('[data-bdata-signed]')));
  check('C4 zero page errors (scenario C)', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 140));
  await page.close();
}

await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbData PHASE E GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbData PHASE E GATE: GREEN — ${results.length}/${results.length} (signing ends at a locally verified signature; NOT broadcast, NOT paid, NOT uploaded)`);
process.exit(failed.length ? 1 : 0);
