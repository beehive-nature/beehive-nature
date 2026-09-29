/* ant-pay.test.mjs — Phase E's shared payer, held to witnesses that are not us, and to its own refusals.
   · the calldata → a REAL payForQuotes transaction on Arbitrum One (e2e/ant-pay-vector.json, read from Blockscout)
   · RLP → the Ethereum wiki's own vectors
   · everything else → a mock bridge, a mock chain and a mock wallet. MAINNET SPEND: 0. no network is touched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const AntPay = require('../surfaces/ant-pay.js'), W = AntPay._wire;
const src = readFileSync(new URL('../surfaces/ant-pay.js', import.meta.url), 'utf8');
const vector = JSON.parse(readFileSync(new URL('./ant-pay-vector.json', import.meta.url), 'utf8'));

const TOKEN = '0x' + 'a1'.repeat(20), VAULT = '0x' + 'b2'.repeat(20), PAYER = '0x' + 'c3'.repeat(20);
const q = (n) => '0x' + n.toString(16).padStart(64, '0'), TX = (n) => '0x' + (0xf000 + n).toString(16).padStart(64, '0');
const prepareOf = (n, amt = 1000n, extra = {}) => ({ upload_id: 'up-1', payment_type: 'wave_batch', data_map_address: '0x' + 'dd'.repeat(32),
  payments: Array.from({ length: n }, (_, i) => ({ quote_hash: q(i + 1), rewards_address: '0x' + (i + 1).toString(16).padStart(40, '0'), amount_atto: String(amt) })),
  total_amount_atto: String(amt * BigInt(n)), ...extra });
const authOf = (p, ceiling) => ({ id: 'auth-1', state: 'authorized-for-signing', upload_id: p.upload_id, ant_ceiling_atto: String(ceiling ?? p.total_amount_atto) });

function world(o = {}) {
  const log = { sends: [], finalize: [], states: [], bridge: [], order: [] }, mem = new Map(), hex = (v) => '0x' + BigInt(v).toString(16);
  const health = 'health' in o ? o.health : { service: 'antd-bridge', evm: { chain_id: 42161, payment_token: TOKEN, payment_vault: VAULT } };
  const fetch = async (url, init) => {
    log.bridge.push(url);
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (url.endsWith('/health')) return json(200, health);
    if (url.endsWith('/v1/upload/finalize')) { log.order.push('finalize'); log.finalize.push(JSON.parse(init.body)); return o.finalizeFails ? json(502, 'storage failed') : json(200, { data_map_address: '0x' + 'dd'.repeat(32), chunks_stored: o.stored ?? 55, total_chunks: 55, status: 'finalized' }); }
    return json(404, 'no route');
  };
  const rpcCall = async (method, params) => {
    if (method === 'eth_getBalance') return hex(o.eth ?? 10n ** 15n);
    if (method === 'eth_call') return params[0].data.startsWith('0x70a08231') ? hex(o.ant ?? 10n ** 24n) : hex(o.allowance ?? 0n);
    if (method === 'eth_getTransactionReceipt') return { status: o.revert ? '0x0' : '0x1' };
    throw new Error('unexpected rpc ' + method);
  };
  const signer = 'signer' in o ? o.signer : { name: 'mock wallet', address: async () => PAYER, send: async (tx) => { log.sends.push(tx); log.order.push('send'); if (o.decline) throw new Error('user rejected'); return TX(log.sends.length); } };
  const store = { get: (k) => mem.get(k) ?? null, set: (k, v) => { mem.set(k, v); log.order.push('persist'); } };
  const payer = AntPay.create({ bridge: 'http://mock-bridge', fetch, rpcCall, signer, store, sleep: async () => {}, onState: (s) => log.states.push(s) });
  return { payer, log, mem };
}
const refused = async (promise, code) => { await assert.rejects(promise, (e) => { assert.equal(e.refusal, code, e.message); return true; }); };
const yes = async () => true;

test('the calldata is the chain’s own: a real payForQuotes transaction re-encodes byte for byte', () => {
  assert.equal(vector.method_call, 'payForQuotes((address,uint256,bytes32)[] _payments)');
  assert.equal(W.encodePayForQuotes(vector.payments), vector.raw_input.toLowerCase());
  assert.equal(W.SEL.payForQuotes, vector.raw_input.slice(0, 10));
  assert.equal(W.encodeApprove(VAULT, 5n), '0x095ea7b3' + '0'.repeat(24) + 'b2'.repeat(20) + '0'.repeat(63) + '5');
  assert.throws(() => W.encodePayForQuotes(Array.from({ length: 257 }, (_, i) => vector.payments[0])), /1 to 256/);
});

test('RLP holds to the Ethereum wiki’s vectors, and the 1559 envelope is typed 0x02', () => {
  assert.equal(W.rlp('0x646f67'), '83646f67'); assert.equal(W.rlp(['0x636174', '0x646f67']), 'c88363617483646f67');
  assert.equal(W.rlp(''), '80'); assert.equal(W.rlp([]), 'c0'); assert.equal(W.rlp('0x0f'), '0f'); assert.equal(W.rlp('0x0400'), '820400');
  assert.equal(W.rlp('0x' + '4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e7365637465747572206164697069736963696e6720656c6974'), 'b838' + '4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e7365637465747572206164697069736963696e6720656c6974'); /* PUBLIC-CONSTANT: the Ethereum wiki RLP test string (Lorem ipsum…) */
  const raw = W.serialize1559({ nonce: 0n, maxPriorityFeePerGas: 0n, maxFeePerGas: 1n, gasLimit: 21000n, to: VAULT, data: '0x' }, { v: '0x1', r: '0x01', s: '0x02' });
  assert.equal(raw, '0x02e482a4b180800182520894' + 'b2'.repeat(20) + '8080c0010102', 'hand-checked: 36-byte payload, empty value, empty data, empty access list'); assert.ok(raw.includes('82a4b1'), 'chain id 42161 rides inside');
});

test('the whole path: plan shown first, exact approve, one payment, hashes kept BEFORE finalize, a receipt', async () => {
  const p = prepareOf(55), w = world(); let shown = null;
  const r = await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (plan) => { shown = plan; assert.equal(w.log.sends.length, 0, 'nothing is signed before the press'); return true; } });
  assert.deepEqual([shown.wallet_confirmations, shown.payment_calls, shown.quotes, shown.approve_exact_atto, shown.spender, shown.token], [2, 1, 55, '55000', VAULT, TOKEN]);
  assert.equal(w.log.sends.length, 2); assert.equal(w.log.sends[0].to, TOKEN); assert.equal(w.log.sends[0].data, W.encodeApprove(VAULT, 55000n), 'approve is the exact total, never unlimited');
  assert.equal(w.log.sends[1].to, VAULT); assert.equal(w.log.sends[1].data, W.encodePayForQuotes(p.payments));
  assert.ok(w.log.order.indexOf('persist') < w.log.order.indexOf('finalize'), 'hashes persist before finalize');
  assert.equal(Object.keys(w.log.finalize[0].tx_hashes).length, 55); assert.equal(w.log.finalize[0].upload_id, 'up-1');
  assert.deepEqual([r.address, r.chunks, r.ant_atto, r.payer, r.quotes_paid], ['0x' + 'dd'.repeat(32), 55, '55000', PAYER, 55]);
  assert.deepEqual(w.log.states.map((s) => s.phase).filter((x, i, a) => a.indexOf(x) === i), ['plan', 'signing', 'finalizing', 'done']);
});

test('an allowance that already covers the price skips approve; 300 quotes ride in two calls; zero quotes are not paid', async () => {
  let p = prepareOf(3), w = world({ allowance: 10n ** 20n }), shown;
  await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (s) => { shown = s; return true; } });
  assert.equal(shown.wallet_confirmations, 1); assert.equal(w.log.sends.length, 1); assert.equal(w.log.sends[0].to, VAULT);
  p = prepareOf(300); p.payments[0].amount_atto = '0'; p.total_amount_atto = String(299n * 1000n); w = world();
  await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (s) => { shown = s; return true; } });
  assert.deepEqual([shown.wallet_confirmations, shown.payment_calls, shown.quotes], [3, 2, 299]);
  assert.equal(Object.keys(w.log.finalize[0].tx_hashes).length, 299); assert.ok(!(p.payments[0].quote_hash in w.log.finalize[0].tx_hashes));
});

test('refusal with a named reason, never a default — and nothing is ever signed on a refusal', async () => {
  const p = prepareOf(4), cases = [
    ['no-quote', {}, { prepare: null }], ['no-quote', {}, { prepare: { ...p, payments: [] } }],
    ['merkle-not-built', {}, { prepare: { ...p, payment_type: 'merkle' } }],
    ['quote-sum', {}, { prepare: { ...p, total_amount_atto: '1' } }],
    ['bad-plan', {}, { prepare: { ...p, payments: [p.payments[0], p.payments[0]], total_amount_atto: '2000' } }],
    ['bad-plan', {}, { prepare: { ...p, payments: [{ ...p.payments[0], amount_atto: '-5' }], total_amount_atto: null } }],
    ['not-authorized', {}, { authorization: null }], ['not-authorized', {}, { authorization: { ...authOf(p), state: 'cancelled' } }], ['not-authorized', {}, { authorization: { ...authOf(p), upload_id: 'up-other' } }],
    ['over-ceiling', {}, { authorization: authOf(p, 3999n) }],
    ['no-wallet', { signer: null }, {}],
    ['no-contracts', { health: { service: 'antd-bridge' } }, {}], ['no-contracts', { health: { evm: { chain_id: 42161, payment_token: 'ANT', payment_vault: VAULT } } }, {}],
    ['wrong-chain', { health: { evm: { chain_id: 421614, payment_token: TOKEN, payment_vault: VAULT } } }, {}],
    ['short-ant', { ant: 3999n }, {}], ['no-gas', { eth: 0n }, {}],
    ['not-confirmed', {}, { confirmPlan: async () => false }], ['not-confirmed', {}, { confirmPlan: async () => 'yes' }], ['not-confirmed', {}, { confirmPlan: undefined }],
  ];
  for (const [code, opts, over] of cases) { const w = world(opts); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, ...over }), code);
    assert.equal(w.log.sends.length, 0, code + ': nothing signed'); assert.equal(w.log.finalize.length, 0, code + ': nothing finalized'); assert.equal(w.log.states.at(-1).phase, 'refused'); }
  let w = world({ decline: true }); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'wallet-declined'); assert.equal(w.log.finalize.length, 0);
  w = world({ revert: true }); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'tx-reverted'); assert.equal(w.log.finalize.length, 0);
});

test('paid but not finished: the hashes are kept, a second pay is refused, resume finalizes without signing again', async () => {
  const p = prepareOf(5), w = world({ finalizeFails: true });
  await assert.rejects(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => { assert.equal(e.refusal, 'paid-not-finalized'); assert.equal(Object.keys(e.detail.tx_hashes).length, 5); return true; });
  const kept = JSON.parse([...w.mem.values()][0]); assert.equal(kept.finalized, false); assert.equal(Object.keys(kept.txHashes).length, 5);
  const sendsSoFar = w.log.sends.length; await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'already-paid'); assert.equal(w.log.sends.length, sendsSoFar, 'never pays twice');
  const w2 = world(); for (const [k, v] of w.mem) w2.mem.set(k, v);
  const r = await w2.payer.resume({ prepare: p, authorization: authOf(p) }); assert.equal(w2.log.sends.length, 0, 'resume never signs'); assert.equal(r.address, '0x' + 'dd'.repeat(32)); assert.equal(w2.log.finalize.length, 1);
  await refused(world().payer.resume({ prepare: p, authorization: authOf(p) }), 'nothing-to-resume');
  const w3 = world({ stored: 40 }); await refused(w3.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'partial-store');
});

test('stop waiting is honest: the hash is kept and named, nothing is cancelled and nothing is paid twice', async () => {
  const p = prepareOf(2), ctl = new AbortController(), w = world({ allowance: 10n ** 20n });
  const pending = w.payer.pay({ prepare: p, authorization: authOf(p), signal: ctl.signal, confirmPlan: async () => { ctl.abort(); return true; } });
  await assert.rejects(pending, (e) => { assert.equal(e.refusal, 'stopped-waiting'); assert.match(e.message, /may still land/); assert.match(e.detail.tx, /^0x[0-9a-f]{64}$/); return true; });
  assert.equal(JSON.parse([...w.mem.values()][0]).finalized, false);
});

test('the two signers: an injected wallet on the wrong chain is refused by name; the Trezor path signs on the device and the page broadcasts', async () => {
  assert.throws(() => AntPay.injectedSigner(undefined), (e) => e.refusal === 'no-wallet');
  const eth = (chain) => ({ calls: [], request(a) { this.calls.push(a); return Promise.resolve(a.method === 'eth_requestAccounts' ? [PAYER] : a.method === 'eth_chainId' ? chain : TX(1)); } });
  await refused(AntPay.injectedSigner(eth('0x1')).address(), 'wrong-chain');
  const good = eth('0xa4b1'), s = AntPay.injectedSigner(good); assert.equal(await s.address(), PAYER); await s.send({ to: VAULT, data: '0xb6c2141b' });
  assert.deepEqual(good.calls.at(-1).params[0], { from: PAYER, to: VAULT, data: '0xb6c2141b', value: '0x0' });
  const asked = [], rpc = async (m, prm) => { asked.push([m, prm]); return m === 'eth_sendRawTransaction' ? TX(9) : m === 'eth_gasPrice' ? '0x13d5260' : m === 'eth_estimateGas' ? '0x30d40' : '0x7'; };
  const connect = { signed: null, ethereumGetAddress: async () => ({ success: true, payload: { address: PAYER } }), ethereumSignTransaction: async (a) => { connect.signed = a; return { success: true, payload: { v: '0x1', r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32) } }; } };
  const t = AntPay.trezorSigner(connect, { rpc }); assert.equal(await t.address(), PAYER); assert.equal(await t.send({ to: VAULT, data: '0xb6c2141b' }), TX(9));
  assert.deepEqual([connect.signed.transaction.chainId, connect.signed.transaction.nonce, connect.signed.transaction.value, connect.signed.transaction.maxPriorityFeePerGas], [42161, '0x7', '0x0', '0x0']);
  assert.match(asked.at(-1)[1][0], /^0x02/); assert.ok(asked.at(-1)[1][0].includes('11'.repeat(32)), 'the page broadcasts the device’s signature');
  const no = AntPay.trezorSigner({ ...connect, ethereumSignTransaction: async () => ({ success: false, payload: { error: 'Cancelled' } }) }, { rpc }); await no.address(); await refused(no.send({ to: VAULT, data: '0x' }), 'wallet-declined');
  assert.throws(() => AntPay.trezorSigner(null, { rpc }), (e) => e.refusal === 'no-wallet');
  await refused(AntPay.loadTrezorConnect({}, null), 'no-wallet');
});

test('verify by downloading is prose until the bridge can do it; and the file keeps its laws', async () => {
  const v = await world().payer.verify('0x' + 'dd'.repeat(32), 'ab'.repeat(32)); assert.equal(v.available, false); assert.match(v.reason, /not available yet/);
  assert.doesNotMatch(src, /privateKey|mnemonic|seed phrase|SECRET_KEY|eth_sign|personal_sign/i, 'no key material, no blind message signing');
  assert.doesNotMatch(src, /f{64}|MaxUint|2n \*\* 256n/, 'no unlimited approval exists to be chosen');
  assert.doesNotMatch(src, /0x[0-9a-fA-F]{40}\b/, 'no contract address lives in this file — the bridge names them');
  assert.equal((src.match(/connect\.trezor\.io/g) || []).length >= 1, true); assert.match(src, /fetched on the person's gesture only/);
  assert.doesNotMatch(src, /localStorage|document\.cookie/, 'storage is handed in by the surface');
});
