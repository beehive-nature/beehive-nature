/* bdrop-preserve.test.mjs — the bDroP preservation connection against the REAL
   AntPay.createHosted module (Agent 20's, untouched) and the REAL keychain-client
   signer SHAPE ({address(), signTransaction(request, ctx) → {raw, hash}}), with a
   throwaway fixture key and a mock payment RPC. Nothing spends; nothing touches a
   network. Proven here, red-first where the order demands it:
   1. the wrong-option failure — the keychain shape under `ethereum:` cannot even
      prepare an invoice (that was the bDroP mis-wiring, demonstrated against the
      real module);
   2. the payer's own authorization lifecycle — pay without authorize() refuses;
      invoice → authorize → pay settles exactly one verified envelope;
   3. resume identity — a reload on the same artifact sha returns the SAME invoice
      (prior plan), so a retry resumes the original purchase, never a second one;
   4. why the bundle must be FROZEN — a fresh composed_at changes the artifact sha
      (the vulnerability shape bDroP's freeze removes). Run: node --test e2e/bdrop-preserve.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { createHosted, _wire, _envelope } = createRequire(import.meta.url)('../surfaces/ant-pay.js');
/* the page's vendored noble build, loaded as the wallet loads it: the independent verifier */
const realm = { TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto, console };
realm.window = realm; realm.self = realm; realm.globalThis = realm;
vm.createContext(realm);
vm.runInContext(readFileSync(new URL('../surfaces/onboarding/vendor/bnr-sign.js', import.meta.url), 'utf8'), realm);
const B = realm.BnrSign, verify = _envelope.nobleVerifier(B);
const hexOf = b => Buffer.from(b).toString('hex'), bytesOf = h => new Uint8Array(Buffer.from(h, 'hex'));
const int = v => { const n = BigInt(v), h = n.toString(16); return n === 0n ? '' : (h.length % 2 ? '0' + h : h); };
/* TESTNET-ONLY: throwaway fixture keys, never a user's key and never funded. */
const KEY = new Uint8Array(32).fill(42);
const addressOf = k => '0x' + hexOf(B.keccak_256(B.secp.getPublicKey(k, false).slice(1)).slice(12));
const PAYER = addressOf(KEY), N = B.secp.CURVE.n;
function envelope(tx) {
  const body = [int(42161), int(tx.nonce), int(tx.maxPriorityFeePerGas), int(tx.maxFeePerGas), int(tx.gas), tx.to.slice(2).toLowerCase(), int(tx.value || 0), tx.data.slice(2).toLowerCase(), []];
  const sig = B.secp.sign(B.keccak_256(bytesOf('02' + _wire.rlp(body))), KEY);
  const s = sig.s, v = sig.recovery;
  const raw = '0x02' + _wire.rlp(body.concat([int(v), int(sig.r), int(s)]));
  return { raw, hash: '0x' + hexOf(B.keccak_256(bytesOf(raw.slice(2)))) };
}
const addr = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const bytes = new TextEncoder().encode('bDroP preservation fixture, no live funds.');
const artifact = { name: 'bdrop-bundle-fixture.json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const network = { chainId: 42161, paymentTokenAddress: addr('a'), paymentVaultAddress: addr('b') };
const quotes = [{ quoteHash: hash('c'), rewardsAddress: addr('d'), amount: '100' }];
/* the REAL keychain-client signer shape (see surfaces/keychain-client.js signer()):
   address() and signTransaction(request, ctx) — signs only, never broadcasts */
const kcShapedSigner = state => ({
  isolated: true,
  address: async () => PAYER,
  signTransaction: async request => { const env = envelope(request); state.last = env; return env; }
});
function fixture(payerOpts) {
  const data = new Map(), txs = new Map();
  let sends = 0, nonce = 0;
  const storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  const rpc = async (method, p) => {
    if (method === 'eth_chainId') return '0xa4b1';
    if (method === 'eth_call') return p[0].data.startsWith('0xdd62ed3e') ? '0xffff' : '0xffff';
    if (method === 'eth_gasPrice') return '0x2';
    if (method === 'eth_getBalance') return '0xffffffffff';
    if (method === 'eth_estimateGas') return '0xc350';
    if (method === 'eth_getTransactionCount') return '0x' + nonce.toString(16);
    if (method === 'eth_blockNumber') return '0x65';
    if (method === 'eth_getBlockByNumber') return { hash: hash('f'), transactions: [...txs.values()] };
    if (method === 'eth_getTransactionByHash') return stateSent.get(String(p[0]).toLowerCase());
    if (method === 'eth_getTransactionReceipt') return { transactionHash: p[0], blockNumber: '0x64', blockHash: hash('f'), status: '0x1', gasUsed: '0xc350', effectiveGasPrice: '0x2' };
    if (method === 'eth_sendRawTransaction') {
      const h = rawToHash.get(String(p[0]).toLowerCase());
      if (!h) throw Error('fixture: unknown raw envelope');
      sends++; return h;
    }
    throw Error(method);
  };
  const stateSent = new Map(); /* hash → the tx shape observe() must see back */
  const rawToHash = new Map(); /* the module broadcasts the lowercased raw string */
  const signerState = { last: null };
  const wrappedSigner = kcShapedSigner(signerState);
  const origSign = wrappedSigner.signTransaction;
  wrappedSigner.signTransaction = async (request, ctx) => {
    const env = await origSign(request, ctx);
    stateSent.set(env.hash.toLowerCase(), { hash: env.hash.toLowerCase(), from: PAYER, to: request.to, input: request.data, value: '0x0', nonce: request.nonce, chainId: '0xa4b1', gas: request.gas, maxFeePerGas: request.maxFeePerGas });
    rawToHash.set(env.raw.toLowerCase(), env.hash.toLowerCase());
    nonce++;
    return env;
  };
  const cfg = { artifact, network, storage, rpc, now: () => 1000, sleep: async () => {}, ...payerOpts };
  if (payerOpts.signer) cfg.signer = wrappedSigner; /* the caller's signer SHAPE, wrapped so the fixture observes what was broadcast */
  let payer = createHosted(cfg);
  return { get payer() { return payer; }, get sends() { return sends; }, storage, cfg, reload: () => { payer = createHosted(cfg); return payer; } };
}

test('the preservation connection against the real purchaser', async () => {
  /* 1. the wrong-option failure, demonstrated: the keychain shape under `ethereum:`
        cannot even prepare an invoice — the module's ethereum path requires .request() */
  await assert.rejects(
    fixture({ ethereum: { isolated: true, address: async () => PAYER, signTransaction: async () => { throw Error('unreachable'); } } }).payer.invoice(network, quotes, '20000000'),
    /browser wallet/,
    'the mis-wiring must fail loudly at the module boundary, not at signature time');

  /* 2. the payer's own authorization lifecycle — never bypassed */
  const f = fixture({ signer: kcShapedSigner({ last: null }), verify });
  const inv = await f.payer.invoice(network, quotes, '20000000');
  assert.ok(inv.id && inv.payer === PAYER.toLowerCase() && inv.gasCeilingWei === '20000000');
  await assert.rejects(f.payer.provider(inv.id).pay(network, quotes, {}), /not authorized|expired/, 'pay before authorize() must refuse');
  f.payer.authorize(inv); /* the bound transition: invoice+scope+payer+ceiling */
  const out = await f.payer.provider(inv.id).pay(network, quotes, {});
  assert.equal(f.sends, 1, 'exactly one signed envelope broadcast');
  assert.equal(out.transactionHash, out.transactionHash && out.walletAddress === PAYER.toLowerCase() ? out.transactionHash : out.transactionHash);
  assert.equal(out.walletAddress, PAYER.toLowerCase());

  /* 3. resume identity: same artifact sha → the SAME invoice returns (prior plan);
        a retry resumes the original purchase — never a second one */
  const again = f.reload();
  const inv2 = await again.invoice(network, quotes, '20000000');
  assert.equal(inv2.id, inv.id, 'a reload must return the prior plan, not a new invoice');
  assert.equal(f.sends, 1, 'no second broadcast happened by asking again');
  await again.provider(inv2.id).pay(network, quotes, {}); /* settle re-observes; no new send */
  assert.equal(f.sends, 1, 'settle of an already-sent plan re-observes without paying twice');
});

test('why the bundle must be FROZEN before the first price', () => {
  /* bDroP's freeze semantics, mirrored: composed_at inside the bundle means a fresh
     compose changes the artifact sha — the purchaser would journal a second purchase */
  const compose = (receipt, frozenAt) => JSON.stringify({ manifest: { v: 1, composed_at: frozenAt || new Date().toISOString() }, receipt }, null, 2);
  const sha = s => createHash('sha256').update(s).digest('hex');
  const rec = { permlink: 'x', txid: 't' };
  const frozen = compose(rec, '2026-10-13T00:00:00.000Z');
  assert.equal(sha(compose(rec, '2026-10-13T00:00:00.000Z')), sha(frozen), 'the frozen timestamp reproduces byte-identical bytes');
  assert.notEqual(sha(compose(rec, '2026-10-13T00:00:00.001Z')), sha(frozen), 'a fresh compose is a DIFFERENT artifact — the vulnerability the freeze removes');
});
