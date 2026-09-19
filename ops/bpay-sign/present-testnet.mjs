// bPay Phase E — the TESTNET presentation driver: walks the REAL bData
// UI through the FULL ceremony against the LIVE bpay-sign service and
// the LIVE chain-421614 replica ledger, capturing a 390px screenshot of
// every state for the founder's inspection.
//
//   node ops/bpay-sign/present-testnet.mjs
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { keccak256 } from 'js-sha3';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', '..', 'surfaces');
const SHOTS = join(here, '..', '..', 'e2e', 'shots-bdata');
const SVC = process.env.SVC_URL || 'http://127.0.0.1:8808';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

// The demo invoice: EXACTLY the deterministic set bpay-sign's demo
// prepare vends for this artifact (same algorithm, ported verbatim), so
// the UI's authorize-step cross-check (cached total == invoice total)
// passes with the REAL product logic — nothing weakened for the demo.
const ART = '338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e'; // PUBLIC-CONSTANT: public artifact content sha256 pin (committed invoice)
const enc = new TextEncoder();
function demoPayments() {
  // port of bpay-sign's demo_prepare, verbatim:
  // seed = artifact_sha256 ASCII bytes ++ i as 8-byte BE; h = keccak(seed);
  // rewards = h[12..32]; quote_hash = keccak(h)
  const out = [];
  const artBytes = Buffer.from(ART, 'utf8');
  for (let i = 0; i < 56; i++) {
    const buf = Buffer.concat([artBytes, (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(i)); return b; })()]);
    const h = Buffer.from(keccak256(buf), 'hex');
    out.push({
      quote_hash: '0x' + keccak256(h),
      rewards_address: '0x' + h.subarray(12, 32).toString('hex'),
      amount_atto: String(1_000_000_000_000_000 + (i % 7) * 111_111_111_111_111),
    });
  }
  return out;
}
const demoPs = demoPayments();
const demoTotal = demoPs.reduce((a, p) => a + BigInt(p.amount_atto), 0n).toString();
const demoInvoice = {
  schema: 'bpay-invoice/1', invoiceId: 'demo-testnet-2026-09-19', issuedAt: new Date().toISOString(),
  lines: [{ kind: 'storage', asset: 'ANT', amountAtto: demoTotal, quotes: demoPs.map(p => ({ quote_hash: p.quote_hash, amount_atto: p.amount_atto })), ceilingAtto: demoTotal }],
  commitment: { kind: 'carried-quote-set', digest: 'sha256:' + createHash('sha256').update(demoPs.map(p => p.quote_hash).sort().join(String.fromCharCode(10))).digest('hex') },
  domain: { artifact: { name: 'try_autonomi.mp4', sha256: ART, bytes: 214091829 }, policy: { audience: { access: 'anyone who obtains the Autonomi address' } } },
  identity: { contentDigest: 'sha256:' + 'b'.repeat(64), priorDigest: 'sha256:' + 'a'.repeat(64) },
  authorization: { stopConditions: ['quote set superseded or consumed', 'artifact identity mismatch'] },
  note: 'TESTNET-DEMO synthetic invoice — generated to match the demo prepare byte-for-byte; never a founder mainnet invoice',
};

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/bpay-invoice-founder.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(demoInvoice));
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(({ bridge, svc }) => {
  localStorage.setItem('bdata-v1', JSON.stringify({
    inspection: 'newbee', automation: { mode: 'ask', boundAnt: '0.5' }, history: [],
    bridge, freshQuote: null, signing: { service: svc, phase: null, review: null, receipt: null, refusal: null, error: null, settled: null },
  }));
}, { bridge: SVC, svc: SVC });

const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('response', async r => { if (r.url().includes('/v1/sign')) { try { console.log('  [sign-call]', r.status(), (await r.text()).slice(0, 260)); } catch {} } });
const shot = (n) => page.screenshot({ path: join(SHOTS, `bpay-e-${n}-390.png`), fullPage: false });
const say = (s) => console.log('  ' + s);

console.log('== bPay Phase E — TESTNET presentation (founder inspection) ==');
say('door: ' + origin + ' | service/ledger: ' + SVC);

await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await shot('1-shelf');
say('1. shelf rendered');

await page.click('[data-bdata-aud="public"]');
await page.waitForSelector('[data-bdata-fresh-atto]', { timeout: 20000 });
await page.waitForTimeout(400);
await shot('2-price');
say('2. price (TESTNET-DEMO quote) rendered in place');

await page.click('[data-bdata-review-open]');
await page.waitForTimeout(300);
await shot('3-authorize-review');
say('3. authorization review open');

await page.click('[data-bdata-auth-go]');
await page.waitForSelector('[data-bdata-sign-open]', { timeout: 5000 });
await shot('4-authorized');
say('4. authorized-for-signing — SIGN WITH TREZOR visible');

await page.click('[data-bdata-sign-open]');
await page.waitForSelector('[data-bdata-sign-review]', { timeout: 5000 });
await page.waitForTimeout(300);
await shot('5-sign-review');
const revText = await page.$eval('[data-bdata-sign-review]', e => e.innerText);
say('5. signing review: ' + (/2 expected/i.test(revText) ? '2 transactions expected ✓' : 'COUNT LINE MISSING'));
say('   testnet badge: ' + (!!(await page.$('[data-bdata-sign-testnet]')) ? '✓' : 'MISSING'));

await page.click('[data-bdata-sign-go]');
await page.waitForSelector('[data-bdata-signed]', { timeout: 30000 });
await page.waitForTimeout(300);
await shot('6-signed');
say('6. SIGNED — both slot hashes + verified signer; NOT BROADCAST/PAID/UPLOADED');

await page.click('[data-bdata-settle-go]');
await page.waitForSelector('[data-bdata-settled]', { timeout: 30000 });
await page.waitForTimeout(300);
await shot('7-settled-testnet');
const settledText = await page.$eval('[data-bdata-settled]', e => e.innerText);
say('7. settled banner: ' + (/SETTLED ON (THE )?TESTNET/i.test(settledText) ? '✓' : 'MISSING'));
say('   REPLICA named on the settled banner: ' + (/REPLICA/i.test(settledText) ? '✓' : 'MISSING'));
say('   REPLICA named on the receipt (signed panel): ' + ((await page.$eval('[data-bdata-receipt-testnet]', e => e.innerText)).includes('REPLICA') ? '✓' : 'MISSING'));
say('   hashes on screen: ' + (settledText.match(/0x[0-9a-f]{64}/g) || []).length);

say('page errors: ' + (errs.length ? errs.join(' | ').slice(0, 200) : 'none'));
await browser.close();
server.close();
console.log('\nshots: e2e/shots-bdata/bpay-e-{1..7}-390.png');
console.log('== presentation complete — UI ready for founder inspection ==');
process.exit(errs.length ? 1 : 0);
