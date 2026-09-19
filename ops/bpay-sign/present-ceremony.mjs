// bPay Phase E UX — THE CEREMONY PRESENTATION (the founder's inspection walk).
// Mocked frozen backend contracts only (the bpay-sign wire shapes, verbatim):
// no invented backend semantics — the real organ/service settle in when the
// founder runs the live stack. Three journeys, every state screenshotted at
// 390px, zero page errors asserted:
//
//   J1  THE FIRST REAL SAFE 7 CEREMONY (mainnet-shaped rehearsal):
//       shelf → price → authorization review → AUTHORIZED (+ the ceremony
//       rail) → OBSERVATION A idle → A deliberately REJECTED (a normal,
//       user-controlled outcome) → A confirmed → OBSERVATION B review (the
//       two-signature manifest) → SIGNED / NOT BROADCAST — broadcast locked,
//       settlement absent, receipt offered for inspection.
//   J2  THE TESTNET-REPLICA HARDWARE REHEARSAL: the replica banner is
//       impossible to confuse with public Sepolia; SIGNED still refuses any
//       settlement action (first-Safe-7 law).
//   J3  THE HOT-KEY DEMO (the banked f3962879 pipeline proof): the settle
//       affordance survives where it lawfully belongs.
//
//   node ops/bpay-sign/present-ceremony.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', '..', 'surfaces');
const SHOTS = join(here, '..', '..', 'e2e', 'shots-bdata');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

const founderInv = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice-founder.json'), 'utf8'));
const fl = founderInv.lines.find(l => l.asset === 'ANT');
const payments = fl.quotes.map(q => ({ quote_hash: q.quote_hash, rewards_address: '0x' + q.quote_hash.slice(2, 42), amount_atto: q.amount_atto }));
const totalAtto = fl.amountAtto;
const commitment = 'sha256:' + createHash('sha256').update([...fl.quotes].map(q => q.quote_hash).sort().join('\n')).digest('hex');

// the ceremony shapes (frozen review fields; only presentation differs)
const PAYER = '0x35defbea2aad6323726fed45dc3388010ea85f9c'; // PUBLIC-CONSTANT: synthetic published test key address
const MAINNET = { mode: 'MAINNET', testnet: false, replica: false, chain_id: 42161, token: '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', vault: '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', payer: PAYER, path: "m/44'/60'/0'/0/0 (Trezor Safe 7 — hardware ceremony; Suite MCP as transport underneath)" };
const REPLICA_HW = { mode: 'TESTNET-REPLICA', testnet: true, replica: true, chain_id: 421614, token: '0x1111111111111111111111111111111111111111', vault: '0x2222222222222222222222222222222222222222', payer: PAYER, path: "m/44'/60'/0'/0/0 (Trezor Safe 7 — hardware ceremony; Suite MCP as transport underneath)" }; // PUBLIC-CONSTANT: synthetic replica fixture addresses
const DEMO = { mode: 'TESTNET-REPLICA-DEMO', testnet: true, replica: true, chain_id: 421614, token: '0x1111111111111111111111111111111111111111', vault: '0x2222222222222222222222222222222222222222', payer: PAYER, path: "m/44'/60'/0'/0/0 (hot TESTNET key in demo mode — the Safe 7 arrives with the hardware transport)" };

let reviewShape = MAINNET;

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const read = async () => { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; };
  if (url === '/mock-bridge/v1/upload/prepare') {
    await read();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ upload_id: 'up-MOCK-E', artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes, total_chunks: 3, already_stored: 0, payment_type: 'wave_batch', total_amount_atto: totalAtto, payments, policy: { audience: 'public', binding: 'founder-selected:public' }, note: 'MOCK-SYNTHETIC — never a network quote' }));
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
  if (url === '/mock-sign/v1/sign/state') {
    const b = await read();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, review: Object.assign({
      authorization_id: b.authorization_id, upload_id: b.upload_id,
      artifact_sha256: founderInv.domain.artifact.sha256, artifact_bytes: founderInv.domain.artifact.bytes,
      audience: 'public', invoice_digest: founderInv.identity.contentDigest,
      quote_count: (b.payments || []).length, ant_ceiling_atto: totalAtto,
      gas_ceiling: 'separate — wallet-side at signing', transaction_count: 2,
      plan_hash: '0x' + '3'.repeat(64), // PUBLIC-CONSTANT: synthetic fixture hash
      note: 'MOCK-SYNTHETIC — never a device session',
    }, reviewShape) }));
    return;
  }
  if (url === '/mock-sign/v1/sign/begin') {
    await read();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, receipt: {
      schema: 'bpay.sign-receipt/1', state: 'signed', transaction_count: 2,
      payer: reviewShape.payer, testnet: reviewShape.testnet, replica: reviewShape.replica,
      slots: [
        { slot: 1, operation: 'approve', tx_hash: '0x' + '1'.repeat(64), signer: reviewShape.payer, nonce: 7 }, // PUBLIC-CONSTANT: synthetic fixture hash
        { slot: 2, operation: 'pay_for_quotes', tx_hash: '0x' + '2'.repeat(64), signer: reviewShape.payer, nonce: 8 }, // PUBLIC-CONSTANT: synthetic fixture hash
      ],
      broadcast: false, paid: false, uploaded: false, finalized: false, note: 'MOCK-SYNTHETIC — never a device session',
    } }));
    return;
  }
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
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errs = [];
const say = (s) => console.log('  ' + s);

async function newJourney(name, shape) {
  reviewShape = shape;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errs.push(`[${name}] ` + String(e)));
  await page.addInitScript(({ bridge }) => {
    localStorage.setItem('bdata-v1', JSON.stringify({ inspection: 'newbee', automation: { mode: 'ask', boundAnt: '0.5' }, history: [], bridge, freshQuote: null, signing: { service: bridge.replace('/mock-bridge', '/mock-sign') } }));
  }, { bridge: origin + '/mock-bridge' });
  await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return page;
}
const shot = (page, n) => page.screenshot({ path: join(SHOTS, `ceremony-${n}-390.png`), fullPage: false });

console.log('== bPay Phase E UX — THE CEREMONY PRESENTATION (mocked frozen contracts, 390px) ==');
say('door: ' + origin);

// ── J1: the first real Safe 7 ceremony (mainnet-shaped rehearsal) ─────────
{
  const page = await newJourney('J1', MAINNET);
  await shot(page, '01-shelf'); say('J1.1 shelf');
  await page.click('[data-bdata-aud="public"]');
  await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot(page, '02-price'); say('J1.2 price + ceremony rail (PREPARED done, AUTHORIZATION REVIEW current)');
  await page.click('[data-bdata-review-open]');
  await page.waitForTimeout(300);
  await shot(page, '03-authorization-review'); say('J1.3 authorization review (Phase C object, in place)');
  await page.click('[data-bdata-auth-go]');
  await page.waitForSelector('[data-bdata-sign-open]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '04-authorized'); say('J1.4 AUTHORIZED — rail at DEVICE PREFLIGHT, Sign with Trezor the one door');
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '05-observation-a'); say('J1.5 OBSERVATION A — harmless preflight (SIMULATED transport labeled, B locked below)');
  await page.evaluate(() => { window.__bdataPreflightSim = 'reject'; });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-rejected]', { timeout: 4000 });
  await page.waitForTimeout(200);
  await shot(page, '06-observation-a-rejected'); say('J1.6 the deliberate Safe 7 REJECTION — a normal user-controlled outcome, B still locked');
  await page.evaluate(() => { window.__bdataPreflightSim = 'confirm'; });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-preflight-confirmed]', { timeout: 4000 });
  await page.evaluate(() => { const el = document.querySelector('[data-bdata-sig-manifest]'); if (el) el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  const dbg = await page.evaluate(() => { const el = document.querySelector('[data-bdata-sig-manifest]'); const r = el ? el.getBoundingClientRect() : null; return { y: window.scrollY, top: r ? Math.round(r.top) : null, vh: innerHeight }; });
  say('     [scroll-debug] scrollY=' + dbg.y + ' manifest.top=' + dbg.top + ' vh=' + dbg.vh);
  await shot(page, '07-observation-b-review'); say('J1.7 OBSERVATION B — the two real signatures: the manifest (1/2 approve bounded · 2/2 payForQuotes ALL payments)');
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  await page.evaluate(() => { const el = document.querySelector('[data-bdata-signed]'); if (el) el.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  await shot(page, '08-signed-not-broadcast'); say('J1.8 SIGNED / NOT BROADCAST — banner, locked broadcast, receipt for inspection, NO settlement action');
  const signed = await page.$eval('[data-bdata-signed]', e => e.innerText);
  say('     NOT BROADCAST banner: ' + (/NOT BROADCAST/i.test(signed) ? '✓' : 'MISSING') + ' · locked broadcast: ' + (!!(await page.$('[data-bdata-broadcast-locked]')) ? '✓' : 'MISSING') + ' · settle ABSENT: ' + (!(await page.$('[data-bdata-settle-go]')) ? '✓' : 'LEAKED'));
  await page.close();
}

// ── J2: the TESTNET-REPLICA hardware rehearsal — no settlement, ever ──────
{
  const page = await newJourney('J2', REPLICA_HW);
  await page.click('[data-bdata-aud="public"]');
  await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 8000 });
  await page.click('[data-bdata-review-open]');
  await page.click('[data-bdata-auth-go]');
  await page.waitForSelector('[data-bdata-sign-open]', { timeout: 5000 });
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
  await page.evaluate(() => { const el = document.querySelector('[data-bdata-sign-testnet]') || document.querySelector('[data-bdata-sign-review]'); if (el) el.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  await shot(page, '09-replica-review'); say('J2.1 the REPLICA sign review — full-phrase banner, impossible to confuse with public Sepolia');
  const review = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
  say('     REPLICA full phrase: ' + (/ARBITRUM-SEPOLIA-SHAPED TESTNET-REPLICA/i.test(review) ? '✓' : 'MISSING') + ' · NOT-public named: ' + (/NOT public Arbitrum Sepolia/i.test(review) ? '✓' : 'MISSING'));
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  await page.evaluate(() => { const el = document.querySelector('[data-bdata-signed]'); if (el) el.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  await shot(page, '10-replica-signed-no-settle'); say('J2.2 REPLICA SIGNED — the first-Safe-7 law holds: NO settlement action even testnet-shaped');
  say('     settle ABSENT: ' + (!(await page.$('[data-bdata-settle-go]')) ? '✓' : 'LEAKED') + ' · REPLICA receipt badge: ' + (!!(await page.$('[data-bdata-receipt-testnet]')) ? '✓' : 'MISSING'));
  await page.close();
}

// ── J3: the hot-key demo — the banked settle step survives where it belongs
{
  const page = await newJourney('J3', DEMO);
  await page.click('[data-bdata-aud="public"]');
  await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 8000 });
  await page.click('[data-bdata-review-open]');
  await page.click('[data-bdata-auth-go]');
  await page.waitForSelector('[data-bdata-sign-open]', { timeout: 5000 });
  await page.click('[data-bdata-sign-open]');
  await page.waitForSelector('[data-bdata-obs-a]', { timeout: 5000 });
  await page.click('[data-bdata-preflight-go]');
  await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
  await page.click('[data-bdata-sign-go]');
  await page.waitForSelector('[data-bdata-signed]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '11-demo-signed-settle-visible'); say('J3.1 the DEMO (hot-key testnet) SIGNED — settle affordance present (banked f3962879 proof)');
  await page.click('[data-bdata-settle-go]');
  await page.waitForSelector('[data-bdata-settled]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '12-demo-settled-replica'); say('J3.2 SETTLED ON THE TESTNET-REPLICA — the demo pipeline proof, REPLICA named');
  const settled = await page.$eval('[data-bdata-settled]', e => e.innerText);
  say('     settled banner: ' + (/SETTLED ON THE TESTNET-REPLICA/i.test(settled) ? '✓' : 'MISSING'));
  await page.close();
}

await browser.close();
server.close();
say('page errors: ' + (errs.length ? errs.join(' | ').slice(0, 300) : 'none'));
console.log('\nshots: e2e/shots-bdata/ceremony-{01..12}-390.png');
console.log(errs.length ? '== PRESENTATION FAILED — page errors ==' : '== PRESENTATION COMPLETE — zero page errors, UI ready for founder inspection ==');
process.exit(errs.length ? 1 : 0);
