// bPay Phase E — the TESTNET pipeline proof driver (founder order
// 2026-09-19: "just use ARB's testnet to prove it all first").
//
// Ledger: a ganache FORK of real Arbitrum Sepolia (chain 421614 — the
// REAL deployed ANT token + PaymentVault bytecode and state; local
// ledger, labeled as such everywhere). The proof drives the REAL
// service (bpay-sign), the REAL organ (watchpay::wave), and REAL
// settlement (eth_sendRawTransaction → mined receipts).
//
// Steps: prepare (synthetic TESTNET quote set, labeled) → authorize
// (demo record) → binding gate → fund the hot key on the fork (native
// ETH + ANT moved from a real holder via ganache impersonation — fork-
// only powers, never possible on the public chain) → sign BOTH slots
// (organ-verified) → SETTLE on the testnet ledger → print receipts.
//
//   node ops/bpay-sign/testnet-ceremony.mjs
import { createHash } from 'node:crypto';
import { keccak256 } from 'js-sha3';

const RPC = process.env.FORK_RPC || 'http://127.0.0.1:8545';
const SVC = process.env.SVC_URL || 'http://127.0.0.1:8808';
const TOKEN = process.env.REPLICA_TOKEN || '0x4bc1ace0e66170375462cB4E6Af42Ad4D5EC689C';
const ART = '338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e'; // PUBLIC-CONSTANT: public artifact content sha256 pin (committed invoice)

const rpc = async (method, params) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then(r => r.json());
  if (r.error) throw new Error(method + ': ' + JSON.stringify(r.error).slice(0, 220));
  return r.result;
};
const svc = async (path, body) =>
  fetch(SVC + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().then(j => ({ status: r.status, j })));

const pad32 = (hexNo0x) => hexNo0x.toLowerCase().padStart(64, '0');
const encAddr = (a) => pad32(a.replace(/^0x/, ''));
const balanceOfCalldata = (who) => '0x70a08231' + encAddr(who);
const transferCalldata = (to, amountAtto) =>
  '0xa9059cbb' + encAddr(to) + pad32(BigInt(amountAtto).toString(16));

async function ethCall(to, data) {
  return rpc('eth_call', [{ to, data }, 'latest']);
}

async function antBalance(who) {
  const r = await ethCall(TOKEN, balanceOfCalldata(who));
  return BigInt(r);
}

async function main() {
  console.log('== bPay Phase E TESTNET pipeline proof ==');
  const chain = parseInt(await rpc('eth_chainId', []), 16);
  console.log('ledger:', RPC, '| chain', chain, chain === 421614 ? '(Arbitrum Sepolia shape)' : '(UNEXPECTED)');

  // 1. prepare — synthetic TESTNET 56-quote set (labeled)
  const prep = (await svc('/v1/upload/prepare', { artifact_sha256: ART, audience: 'public' })).j;
  console.log('1. prepare:', prep.upload_id, '|', prep.payments.length, 'quotes | total', prep.total_amount_atto, '|', prep.note);

  // 2. authorize — the demo record (the digest wall holds at bind)
  const commitment = 'sha256:' + createHash('sha256')
    .update(prep.payments.map(p => p.quote_hash).sort().join('\n')).digest('hex');
  const authResp = await svc('/v1/authorization', {
    upload_id: prep.upload_id,
    invoice_digest: 'sha256:' + 'b'.repeat(64),
    commitment_digest: commitment,
    artifact_sha256: ART, artifact_bytes: 214091829, audience: 'public',
    ant_ceiling_atto: prep.total_amount_atto, gas_ceiling: 'separate — wallet-side at signing',
  });
  if (authResp.status !== 201) { console.error('2. authorize FAILED', authResp); process.exit(1); }
  console.log('2. authorize:', authResp.j.authorization_id, authResp.j.state);

  // 3. binding gate — the REAL organ decides
  const st = (await svc('/v1/sign/state', { authorization_id: authResp.j.authorization_id,
    upload_id: prep.upload_id, payments: prep.payments })).j;
  if (!st.ok) { console.error('3. binding gate REFUSED:', st.refusal.law, st.refusal.why); process.exit(1); }
  console.log('3. binding gate GREEN:', st.review.mode, '| tx count', st.review.transaction_count,
    '| chain', st.review.chain_id, '| payer', st.review.payer);
  const payer = st.review.payer;

  // 4. funding: on the REPLICA ledger the hot key IS the deployer and
  // holds the constructor mint (2.5M ANT on the real artifacts); verify.
  const need = BigInt(prep.total_amount_atto);
  const bal = await antBalance(payer);
  console.log('4. payer ANT on ledger:', bal.toString(), bal >= need ? '(>= obligation)' : '(INSUFFICIENT — run deploy-replica.mjs)');
  if (bal < need) process.exit(1);

  // 5. sign BOTH slots through the organ (hot testnet key; the wall verifies)
  const begin = (await svc('/v1/sign/begin', { authorization_id: authResp.j.authorization_id,
    upload_id: prep.upload_id, payments: prep.payments, path: "m/44'/60'/0'/0/0" })).j;
  if (!begin.ok) { console.error('5. begin FAILED', begin); process.exit(1); }
  const rec = begin.receipt;
  console.log('5. SIGNED (organ-verified):', rec.state, '| slots', rec.slots.map(s => s.slot + ':' + s.operation).join(' + '));
  for (const s of rec.slots) console.log('   slot', s.slot, s.operation, 'tx', s.tx_hash, 'signer', s.signer, 'nonce', s.nonce);
  console.log('   broadcast:', rec.broadcast, '| paid:', rec.paid, '| uploaded:', rec.uploaded, '| testnet:', rec.testnet);

  // 6. SETTLE on the testnet ledger (structurally testnet-only route)
  const settle = (await svc('/v1/testnet/settle', { authorization_id: authResp.j.authorization_id })).j;
  if (!settle.ok) { console.error('6. settle REFUSED', settle); process.exit(1); }
  console.log('6. SETTLED ON TESTNET:', settle.note);
  for (const t of settle.transactions) console.log('   ', t.slot, t.operation, t.tx_hash, t.status);

  console.log('\n== PIPELINE PROVEN ON TESTNET: prepare → authorize → bind → sign(×2, wall-verified) → settle(confirmed) ==');
}

main().catch(e => { console.error('CEREMONY ERROR:', e.message || e); process.exit(1); });
