/* ant-pay.test.mjs — Phase E's shared payer, held to witnesses that are not us, and to its own refusals.
   · the calldata → a REAL payForQuotes transaction on Arbitrum One (e2e/ant-pay-vector.json, read from Blockscout)
   · RLP → the Ethereum wiki's own vectors
   · the contracts → upstream evmlib v0.9.1 (fbf879b1), src/lib.rs:64-65 and :71-72, copied here by hand from that tag
   · everything else → a mock door (the wire of ops/ant-writedoor/README.md), a mock chain and a mock wallet.
     MAINNET SPEND: 0. no network is touched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const AntPay = require('../surfaces/ant-pay.js'), W = AntPay._wire;
const src = readFileSync(new URL('../surfaces/ant-pay.js', import.meta.url), 'utf8');
const vector = JSON.parse(readFileSync(new URL('./ant-pay-vector.json', import.meta.url), 'utf8'));

/* evmlib v0.9.1 src/lib.rs:64-65 and :71-72. The vault is also the vector's own `vault`, a second witness. */
const TOKEN = '0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684', VAULT = '0x9A3EcAc693b699Fc0B2B6A50B5549e50c2320A26', PAYER = '0x' + 'c3'.repeat(20);
const DOOR = 'http://mock-door', FINALIZE = DOOR + '/ant/v1/upload/finalize', ADDR = '0x' + 'dd'.repeat(32);
const q = (n) => '0x' + n.toString(16).padStart(64, '0'), TX = (n) => '0x' + (0xf000 + n).toString(16).padStart(64, '0');
/* the door's prepare answer, field for field (README.md, POST /ant/v1/upload/prepare) */
const prepareOf = (n, amt = 1000n, extra = {}) => ({ upload_id: 'up-1', payment_type: 'wave_batch', data_map_address: ADDR, chunks: { total: n, already_stored: 0 },
  quotes: Array.from({ length: n }, (_, i) => ({ quote_hash: q(i + 1), rewards_address: '0x' + (i + 1).toString(16).padStart(40, '0'), amount_atto: String(amt) })),
  total_atto: String(amt * BigInt(n)), ...extra });
const authOf = (p, ceiling) => ({ id: 'auth-1', state: 'authorized-for-signing', upload_id: p.upload_id, ant_ceiling_atto: String(ceiling ?? p.total_atto) });

function world(o = {}) {
  const log = { sends: [], finalize: [], states: [], urls: [], order: [] }, mem = new Map(), hex = (v) => '0x' + BigInt(v).toString(16);
  const fetch = async (url, init) => {
    log.urls.push(url);
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (url === FINALIZE && init && init.method === 'POST') {
      log.order.push('finalize'); log.finalize.push(JSON.parse(init.body));
      /* failOnce: the door is down for one call and back for the next — a recovery, not an outage. */
      if (o.finalizeFails && !(o.failOnce && log.finalize.length > 1)) return json(o.finalizeFails, { error: o.finalizeFails >= 500 ? 'gateway' : 'missing_quote_tx' });
      return json(200, { data_map_address: 'stored' in o ? o.stored : ADDR });
    }
    return json(404, { error: 'no route' });
  };
  const rpcCall = async (method, params) => {
    if (method === 'eth_getBalance') return hex(o.eth ?? 10n ** 15n);
    if (method === 'eth_call') { log.urls.push('rpc:' + params[0].to); return params[0].data.startsWith('0x70a08231') ? hex(o.ant ?? 10n ** 24n) : hex(o.allowance ?? 0n); }
    /* revertHashes: the chain refused THAT transaction and confirmed the others — per-hash, because
       a kept payment and the payment being made now are not the same transaction. */
    if (method === 'eth_getTransactionReceipt') return { status: (o.revert || (o.revertHashes || []).includes(params[0])) ? '0x0' : '0x1' };
    throw new Error('unexpected rpc ' + method);
  };
  const signer = 'signer' in o ? o.signer : { name: 'mock wallet', address: async () => PAYER, send: async (tx) => { log.sends.push(tx); log.order.push('send');
    if (o.decline || (o.declineAfter != null && log.sends.filter((t) => t.to === VAULT).length > o.declineAfter)) throw new Error('user rejected'); return TX(log.sends.length); } };
  /* denyClear: a store that took the record and refuses to clear it — true for every clear, or a
     count for the first N. Distinct from storeThrows, which refuses every write including the one
     that created the record; only a store that ACCEPTED the record can strand it. */
  let clears = 0;
  const store = { get: (k) => mem.get(k) ?? null, set: (k, v) => { if (o.storeThrows) throw new Error('storage denied');
    if (v === '' && o.denyClear && (o.denyClear === true || ++clears <= o.denyClear)) throw new Error('storage denied');
    mem.set(k, v); log.order.push('persist'); } };
  /* throwOnState: the surface's own renderer blows up on that phase — a caller's failure, not this page's. */
  const onState = (s) => { log.states.push(s); if (o.throwOnState === s.phase) throw new Error('the surface’s renderer blew up'); };
  const payer = AntPay.create({ door: DOOR, fetch, rpcCall, signer, store, sleep: async () => {}, onState });
  return { payer, log, mem };
}
const refused = async (promise, code) => { await assert.rejects(promise, (e) => { assert.equal(e.refusal, code, e.message); return true; }); };
const yes = async () => true;

test('the calldata is the chain’s own: a real payForQuotes transaction re-encodes byte for byte', () => {
  assert.equal(vector.method_call, 'payForQuotes((address,uint256,bytes32)[] _payments)');
  assert.equal(W.encodePayForQuotes(vector.payments), vector.raw_input.toLowerCase());
  assert.equal(W.SEL.payForQuotes, vector.raw_input.slice(0, 10));
  assert.equal(W.encodeApprove(VAULT, 5n), '0x095ea7b3' + '0'.repeat(24) + VAULT.slice(2).toLowerCase() + '0'.repeat(63) + '5');
  assert.throws(() => W.encodePayForQuotes(Array.from({ length: 257 }, (_, i) => vector.payments[0])), /1 to 256/);
});

test('the contracts are evmlib’s, pinned: the cited token and vault, frozen, and the vault the real transaction paid', () => {
  assert.deepEqual({ ...AntPay.CONTRACTS }, { token: TOKEN, vault: VAULT });
  assert.equal(AntPay.CONTRACTS.vault.toLowerCase(), vector.vault.toLowerCase(), 'the Blockscout vector paid this vault');
  assert.ok(Object.isFrozen(AntPay.CONTRACTS), 'no page can move them');
  assert.match(src, /fbf879b1f7068b5b072a936589721272c62f2ca0/, 'the pin is named in the file');
  assert.match(src, /src\/lib\.rs:64-65 the token, :71-72 the vault/, 'file:line is named in the file');
  const addrs = [...new Set((src.match(/0x[0-9a-fA-F]{40}\b/g) || []).map((a) => a.toLowerCase()))].sort();
  assert.deepEqual(addrs, [TOKEN.toLowerCase(), VAULT.toLowerCase()].sort(), 'no address lives in this file but the two cited ones');
});

test('RLP holds to the Ethereum wiki’s vectors, and the 1559 envelope is typed 0x02', () => {
  const V = '0x' + 'b2'.repeat(20);
  assert.equal(W.rlp('0x646f67'), '83646f67'); assert.equal(W.rlp(['0x636174', '0x646f67']), 'c88363617483646f67');
  assert.equal(W.rlp(''), '80'); assert.equal(W.rlp([]), 'c0'); assert.equal(W.rlp('0x0f'), '0f'); assert.equal(W.rlp('0x0400'), '820400');
  assert.equal(W.rlp('0x' + '4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e7365637465747572206164697069736963696e6720656c6974'), 'b838' + '4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e7365637465747572206164697069736963696e6720656c6974'); /* PUBLIC-CONSTANT: the Ethereum wiki RLP test string (Lorem ipsum…) */
  const raw = W.serialize1559({ nonce: 0n, maxPriorityFeePerGas: 0n, maxFeePerGas: 1n, gasLimit: 21000n, to: V, data: '0x' }, { v: '0x1', r: '0x01', s: '0x02' });
  assert.equal(raw, '0x02e482a4b180800182520894' + 'b2'.repeat(20) + '8080c0010102', 'hand-checked: 36-byte payload, empty value, empty data, empty access list'); assert.ok(raw.includes('82a4b1'), 'chain id 42161 rides inside');
});

test('the whole path on the door’s wire: plan shown first, exact approve, one payment, hashes kept BEFORE finalize, per-quote pairs, a receipt', async () => {
  const p = prepareOf(55), w = world(); let shown = null;
  const r = await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (plan) => { shown = plan; assert.equal(w.log.sends.length, 0, 'nothing is signed before the press'); return true; } });
  assert.deepEqual([shown.wallet_confirmations, shown.payment_calls, shown.quotes, shown.approve_exact_atto, shown.spender, shown.token], [2, 1, 55, '55000', VAULT, TOKEN]);
  assert.equal(w.log.sends.length, 2); assert.equal(w.log.sends[0].to, TOKEN); assert.equal(w.log.sends[0].data, W.encodeApprove(VAULT, 55000n), 'approve is the exact total, never unlimited');
  assert.equal(w.log.sends[1].to, VAULT); assert.equal(w.log.sends[1].data, W.encodePayForQuotes(p.quotes));
  assert.ok(w.log.order.indexOf('persist') < w.log.order.indexOf('finalize'), 'hashes persist before finalize');
  assert.deepEqual(w.log.urls.filter((u) => !u.startsWith('rpc:')), [FINALIZE], 'the door is asked once, at its finalize route, and at nothing else');
  const body = w.log.finalize[0];
  assert.deepEqual(Object.keys(body).sort(), ['txs', 'upload_id']); assert.equal(body.upload_id, 'up-1');
  assert.equal(body.txs.length, 55); assert.deepEqual(body.txs.map((x) => x.quote_hash), p.quotes.map((x) => x.quote_hash));
  assert.ok(body.txs.every((x) => Object.keys(x).sort().join() === 'quote_hash,tx_hash' && x.tx_hash === TX(2)), 'one {quote_hash, tx_hash} per quote, each naming the payment that carried it');
  assert.deepEqual([r.address, r.chunks_quoted, r.ant_atto, r.ant_paid_now_atto, r.payer, r.quotes_paid, r.quotes_already_paid, r.txs.length], [ADDR, 55, '55000', '55000', PAYER, 55, 0, 55]);
  assert.ok(!('chunks' in r), 'the receipt no longer carries a bare `chunks`: it was copied from PREPARE, an input, and sat among outputs');
  assert.deepEqual(w.log.states.map((s) => s.phase).filter((x, i, a) => a.indexOf(x) === i), ['plan', 'signing', 'sent', 'finalizing', 'done']);
  assert.deepEqual(w.log.states.filter((s) => s.phase === 'sent').map((s) => [s.what, s.tx]), [['payment', TX(2)]], 'each payment is announced with its hash as it leaves the wallet; the approve is not a payment');
});

test('an allowance that already covers the price skips approve; 300 quotes ride in two calls; zero quotes are not paid', async () => {
  let p = prepareOf(3), w = world({ allowance: 10n ** 20n }), shown;
  await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (s) => { shown = s; return true; } });
  assert.equal(shown.wallet_confirmations, 1); assert.equal(w.log.sends.length, 1); assert.equal(w.log.sends[0].to, VAULT);
  p = prepareOf(300); p.quotes[0].amount_atto = '0'; p.total_atto = String(299n * 1000n); w = world();
  await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: async (s) => { shown = s; return true; } });
  assert.deepEqual([shown.wallet_confirmations, shown.payment_calls, shown.quotes], [3, 2, 299]);
  const txs = w.log.finalize[0].txs; assert.equal(txs.length, 299); assert.ok(!txs.some((x) => x.quote_hash === p.quotes[0].quote_hash), 'a zero quote is neither paid nor named');
  assert.equal(new Set(txs.map((x) => x.tx_hash)).size, 2, 'two payment calls, two hashes, each quote naming its own');
});

test('the total is REQUIRED: a price with no total_atto is refused by name, never summed and paid', async () => {
  const p = prepareOf(4);
  for (const total of [undefined, null, 4000, '', '0x' + (4000).toString(16), '4000.0']) {
    const w = world(); await refused(w.payer.pay({ prepare: { ...p, total_atto: total }, authorization: authOf(p), confirmPlan: yes }), 'no-total');
    assert.equal(w.log.sends.length, 0, String(total) + ': nothing signed');
  }
  /* the private bridge's shape — `payments` and an optional `total_amount_atto` — is not this door's price */
  const bridgeShaped = { upload_id: 'up-1', payment_type: 'wave_batch', data_map_address: ADDR, payments: p.quotes, total_amount_atto: p.total_atto };
  let w = world(); await refused(w.payer.pay({ prepare: bridgeShaped, authorization: authOf(p), confirmPlan: yes }), 'no-total'); assert.equal(w.log.sends.length, 0);
  w = world(); await refused(w.payer.settle({ prepare: bridgeShaped, authorization: authOf(p), confirmPlan: yes }), 'no-total'); assert.equal(w.log.sends.length, 0);
});

test('refusal with a named reason, never a default — and nothing is ever signed on a refusal', async () => {
  const p = prepareOf(4), cases = [
    ['no-quote', {}, { prepare: null }], ['no-quote', {}, { prepare: { ...p, quotes: [], total_atto: '0' } }],
    ['merkle-not-built', {}, { prepare: { ...p, payment_type: 'merkle' } }], ['merkle-not-built', {}, { prepare: { ...p, payment_type: undefined } }],
    ['quote-sum', {}, { prepare: { ...p, total_atto: '1' } }], ['quote-sum', {}, { prepare: { ...p, total_atto: '4001' } }],
    ['bad-plan', {}, { prepare: { ...p, quotes: [p.quotes[0], p.quotes[0]], total_atto: '2000' } }],
    ['bad-plan', {}, { prepare: { ...p, quotes: [{ ...p.quotes[0], amount_atto: '-5' }], total_atto: '0' } }],
    ['not-authorized', {}, { authorization: null }], ['not-authorized', {}, { authorization: { ...authOf(p), state: 'cancelled' } }], ['not-authorized', {}, { authorization: { ...authOf(p), upload_id: 'up-other' } }],
    ['over-ceiling', {}, { authorization: authOf(p, 3999n) }],
    ['no-wallet', { signer: null }, {}],
    ['short-ant', { ant: 3999n }, {}], ['no-gas', { eth: 0n }, {}],
    ['not-confirmed', {}, { confirmPlan: async () => false }], ['not-confirmed', {}, { confirmPlan: async () => 'yes' }], ['not-confirmed', {}, { confirmPlan: undefined }],
  ];
  for (const [code, opts, over] of cases) { const w = world(opts); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, ...over }), code);
    assert.equal(w.log.sends.length, 0, code + ': nothing signed'); assert.equal(w.log.finalize.length, 0, code + ': nothing finalized'); assert.equal(w.log.states.at(-1).phase, 'refused'); }
  let w = world({ decline: true }); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'wallet-declined'); assert.equal(w.log.finalize.length, 0);
  w = world({ revert: true }); await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'tx-reverted'); assert.equal(w.log.finalize.length, 0);
});

test('settle pays and hands back the pairs without calling the door; the hashes are kept first, and it never pays twice', async () => {
  const p = prepareOf(5), w = world();
  const txs = await w.payer.settle({ prepare: p, authorization: authOf(p), confirmPlan: yes });
  assert.deepEqual(txs.map((x) => x.quote_hash), p.quotes.map((x) => x.quote_hash)); assert.ok(txs.every((x) => /^0x[0-9a-f]{64}$/.test(x.tx_hash)));
  assert.deepEqual(w.log.urls.filter((u) => !u.startsWith('rpc:')), [], 'settle never calls the door: the surface’s own adapter finalizes');
  const kept = JSON.parse(w.mem.get('ant-pay.paid.up-1')); assert.equal(kept.finalized, false); assert.equal(Object.keys(kept.txHashes).length, 5);
  assert.equal(w.log.states.at(-1).phase, 'paid');
  const n = w.log.sends.length; await refused(w.payer.settle({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'already-paid'); assert.equal(w.log.sends.length, n, 'never pays twice');
});

test('paid but not finished: the pairs are kept and named, a second pay is refused, resume finalizes without signing again', async () => {
  const p = prepareOf(5), w = world({ finalizeFails: 422 });
  await assert.rejects(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => {
    assert.equal(e.refusal, 'paid-not-finalized'); assert.equal(e.detail.txs.length, 5); assert.equal(e.detail.door, 'missing_quote_tx', 'the door’s own refusal name rides along'); return true; });
  const kept = JSON.parse(w.mem.get('ant-pay.paid.up-1')); assert.equal(kept.finalized, false); assert.equal(Object.keys(kept.txHashes).length, 5);
  const sendsSoFar = w.log.sends.length; await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'already-paid'); assert.equal(w.log.sends.length, sendsSoFar, 'never pays twice');
  const w2 = world(); for (const [k, v] of w.mem) w2.mem.set(k, v);
  const r = await w2.payer.resume({ prepare: p, authorization: authOf(p) }); assert.equal(w2.log.sends.length, 0, 'resume never signs'); assert.equal(r.address, ADDR); assert.equal(w2.log.finalize.length, 1);
  assert.equal(w2.log.finalize[0].txs.length, 5);
  await refused(world().payer.resume({ prepare: p, authorization: authOf(p) }), 'nothing-to-resume');
});

/* THE IDENTITY OF A PAYMENT IS THE QUOTE HASH, NOT THE upload_id. Keyed on upload_id, the page
   paid the same quotes twice: bee-laborer demonstrated it on #211 and it reproduced here — new
   upload_id, byte-identical quote hashes, a second payForQuotes and no refusal. The same-upload_id
   CONTROL is kept in the same row so the fix cannot pass by disabling the guard, and the
   different-quotes arm is kept so it cannot pass by refusing everything. */
test('a re-prepare of the same bytes is not paid again: the guard and resume are keyed on the QUOTE SET, not on upload_id', async () => {
  const payCalls = (w) => w.log.sends.filter((t) => t.to === VAULT).length;
  const w = world(), p1 = prepareOf(2);
  await w.payer.pay({ prepare: p1, authorization: authOf(p1), confirmPlan: yes });
  assert.equal(payCalls(w), 1);

  /* CONTROL — the same upload_id. This is what the old guard caught, and it must keep catching it. */
  await refused(w.payer.pay({ prepare: p1, authorization: authOf(p1), confirmPlan: yes }), 'already-paid');
  assert.equal(payCalls(w), 1, 'the same upload_id is still refused');

  /* PROBE — a NEW upload_id carrying byte-identical quote hashes. The door's README says identical
     bytes re-prepare to the same quote HASHES; it says nothing about upload_id. */
  const p2 = { ...p1, upload_id: 'up-2' };
  assert.deepEqual(p2.quotes.map((x) => x.quote_hash), p1.quotes.map((x) => x.quote_hash), 'precondition: the quote hashes are byte-identical');
  assert.notEqual(p2.upload_id, p1.upload_id, 'precondition: the upload_id differs');
  await refused(w.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'already-paid');
  assert.equal(payCalls(w), 1, 'a re-prepare of the same bytes signs nothing');
  assert.equal(w.log.finalize.length, 1, 'and it does not finalize a second time');

  /* resume() used to answer nothing-to-resume about a payment that exists, and the only move left
     — pay() — charged again. It now finds the kept payment by its quotes. */
  const r = await w.payer.resume({ prepare: { ...p1, upload_id: 'up-9' }, authorization: authOf({ ...p1, upload_id: 'up-9' }) });
  assert.equal(r.address, ADDR); assert.equal(payCalls(w), 1, 'resume never signs');

  /* AND IT IS NOT A BLANKET REFUSAL: different quotes under a new upload_id are paid normally. */
  const other = prepareOf(2); other.upload_id = 'up-3';
  other.quotes = other.quotes.map((x, i) => ({ ...x, quote_hash: q(900 + i) }));
  assert.equal(other.quotes.filter((x) => p1.quotes.some((y) => y.quote_hash === x.quote_hash)).length, 0, 'precondition: no quote is shared');
  await w.payer.pay({ prepare: other, authorization: authOf(other), confirmPlan: yes });
  assert.equal(payCalls(w), 2, 'a genuinely new price still pays');
});

test('a crash between batches is finished, not re-paid: only the unpaid quotes are signed for and finalize carries every priced quote', async () => {
  /* 300 quotes = two payment calls. The wallet declines the second, so batch one is on chain and
     kept; the person asks for the price again and gets a new upload_id. */
  const p = prepareOf(300), w = world(), sends = [];
  w.payer = AntPay.create({
    door: DOOR, sleep: async () => {}, onState: () => {}, store: { get: (k) => w.mem.get(k) ?? null, set: (k, v) => w.mem.set(k, v) },
    fetch: async (url, init) => ({ ok: true, status: 200, json: async () => { w.log.finalize.push(JSON.parse(init.body)); return { data_map_address: ADDR }; }, text: async () => '' }),
    rpcCall: async (m, params) => (m === 'eth_getBalance' ? '0x' + (10n ** 15n).toString(16)
      : m === 'eth_call' ? '0x' + (params[0].data.startsWith('0x70a08231') ? (10n ** 24n) : 0n).toString(16)
      : m === 'eth_getTransactionReceipt' ? { status: '0x1' } : (() => { throw new Error('unexpected rpc ' + m); })()),
    signer: { name: 'mock wallet', address: async () => PAYER, send: async (tx) => { sends.push(tx); if (sends.filter((t) => t.to === VAULT).length > 1) throw new Error('user rejected'); return TX(sends.length); } },
  });
  await assert.rejects(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => { assert.equal(e.refusal, 'wallet-declined'); return true; });
  const kept = JSON.parse(w.mem.get('ant-pay.paid.up-1'));
  assert.equal(Object.keys(kept.txHashes).length, 256, 'precondition: exactly the first batch is kept');

  /* the allowance already covers the remainder, so w2 signs no approve — which keeps its first
     payment hash distinct from the kept one and lets the next assertion mean something. */
  const again = { ...p, upload_id: 'up-2' }, w2 = world({ allowance: 10n ** 20n });
  for (const [k, v] of w.mem) w2.mem.set(k, v);
  let shown = null;
  const r = await w2.payer.pay({ prepare: again, authorization: authOf(again), confirmPlan: async (s) => { shown = s; return true; } });
  assert.deepEqual([shown.quotes, shown.quotes_already_paid, shown.payment_calls], [44, 256, 1], 'only the 44 unpaid quotes are signed for');
  assert.equal(shown.ant_total_atto, '44000', 'the wallet is asked for the remainder, not the whole price');
  assert.equal(w2.log.sends.filter((t) => t.to === VAULT).length, 1);
  assert.equal(w2.log.finalize[0].txs.length, 300, 'finalize still carries a tx for every priced quote');
  assert.equal(new Set(w2.log.finalize[0].txs.map((x) => x.tx_hash)).size, 2, 'the kept hash rides along beside the new one');
  assert.deepEqual([r.quotes_paid, r.quotes_already_paid, r.ant_atto, r.ant_paid_now_atto], [300, 256, '300000', '44000']);
});

/* THE RECOVERY MUST NOT DEAD-END. bee-laborer took the crash-between-batches row above, changed
   exactly one thing — the door fails ONCE on the recovery run — and both remaining doors shut:
   resume said the kept payment "belongs to a different plan" and pay said "already paid", with 44
   quotes of real ANT on chain and the device holding all 300 quote-to-tx mappings. The cause was
   one expression: coverage was judged over kept.txHashes, which holds THIS upload's hashes only,
   while pairs() — the body finalize actually sends — reads the merged map. Coverage now reads the
   same map. The same-upload_id control is kept in the row so the fix cannot pass by loosening the
   guard, and the never-paid arm is kept so it cannot pass by resuming anything. */
test('a door that fails once does not strand the payment: resume finalizes the partial recovery and still signs nothing', async () => {
  const p = prepareOf(300), w = world({ declineAfter: 1 });
  await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'wallet-declined');
  assert.equal(Object.keys(JSON.parse(w.mem.get('ant-pay.paid.up-1')).txHashes).length, 256, 'precondition: exactly batch one is kept');

  /* the recovery run: a new upload_id over the same bytes, and the door is down for that one call. */
  const again = { ...p, upload_id: 'up-2' }, w2 = world({ allowance: 10n ** 20n, finalizeFails: 502, failOnce: true });
  for (const [k, v] of w.mem) w2.mem.set(k, v);
  let shown = null;
  await refused(w2.payer.pay({ prepare: again, authorization: authOf(again), confirmPlan: async (s) => { shown = s; return true; } }), 'paid-not-finalized');
  assert.deepEqual([shown.quotes, shown.quotes_already_paid], [44, 256], 'precondition: 44 paid now, 256 already');
  assert.equal(Object.keys(JSON.parse(w2.mem.get('ant-pay.paid.up-2')).txHashes).length, 44, 'precondition: this upload kept 44 of the 300');

  const signedBefore = w2.log.sends.filter((t) => t.to === VAULT).length;
  const r = await w2.payer.resume({ prepare: again, authorization: authOf(again) });
  assert.equal(w2.log.sends.filter((t) => t.to === VAULT).length, signedBefore, 'resume signs nothing');
  assert.equal(r.address, ADDR);
  const body = w2.log.finalize[w2.log.finalize.length - 1];
  assert.equal(body.txs.length, 300, 'finalize carries every priced quote, not only this upload’s 44');
  assert.equal(body.txs.filter((x) => !x.tx_hash).length, 0, 'and no quote rides with a null hash');

  /* CONTROL — the guard it must not have loosened. */
  await refused(w2.payer.pay({ prepare: again, authorization: authOf(again), confirmPlan: yes }), 'already-paid');
  /* CONTROL — a price this device never paid is still not resumable. */
  const never = { ...prepareOf(2), upload_id: 'up-9' };
  never.quotes = never.quotes.map((x, i) => ({ ...x, quote_hash: q(8000 + i) }));
  await refused(w2.payer.resume({ prepare: never, authorization: authOf(never) }), 'nothing-to-resume');
});

/* AND WHAT IS FINALIZED IS WHAT WAS CONFIRMED. Judging coverage over the merged map without also
   WAITING on it would finalize a body containing a transaction this page never watched: the index
   is written before the wait (deliberately — a crash must not lose a hash), so a kept quote can
   carry a tx the chain went on to refuse. The wait list is built from the same merged map. */
test('resume waits on every hash it is about to finalize, including the ones another upload kept', async () => {
  /* the kept hash is UNCONFIRMED, which is the only way a device holds one the chain went on to
     refuse: the person stopped waiting, and the file keeps the hash on purpose (':203'). A hash
     pay() itself watched revert is now unwound on the spot, so it can no longer be the fixture. */
  const p = prepareOf(300), w = world({ revertHashes: [TX(2)] });
  const stopped = { get aborted() { return w.log.sends.some((t) => t.to === VAULT); } };
  await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, signal: stopped }), 'stopped-waiting');
  const kept1 = JSON.parse(w.mem.get('ant-pay.paid.up-1'));
  assert.equal(Object.keys(kept1.txHashes).length, 256, 'precondition: batch one is kept');
  assert.equal(kept1.txHashes[q(1)], TX(2), 'precondition: and the hash it kept is one this chain refuses');

  const again = { ...p, upload_id: 'up-2' }, w2 = world({ allowance: 10n ** 20n, finalizeFails: 502, failOnce: true, revertHashes: [TX(2)] });
  for (const [k, v] of w.mem) w2.mem.set(k, v);
  await refused(w2.payer.pay({ prepare: again, authorization: authOf(again), confirmPlan: yes }), 'paid-not-finalized');
  assert.equal(Object.keys(JSON.parse(w2.mem.get('ant-pay.paid.up-2')).txHashes).length, 44, 'precondition: up-2 kept only its own 44, all confirmed');

  /* CONTROL — snapshot taken BEFORE the refusal, because the refusal now unwinds what it refused. */
  const w3 = world({ allowance: 10n ** 20n });
  for (const [k, v] of w2.mem) w3.mem.set(k, v);

  const finalizedBefore = w2.log.finalize.length;
  await refused(w2.payer.resume({ prepare: again, authorization: authOf(again) }), 'tx-reverted');
  assert.equal(w2.log.finalize.length, finalizedBefore, 'it never reached the door with a refused transaction in the body');
  const marks = (w, tx) => [...w.mem].filter(([k, v]) => k.startsWith('ant-pay.paid.quote.') && v && JSON.parse(v).tx_hash === tx).length;
  assert.equal(marks(w2, TX(2)), 0, 'and the refused hash no longer marks any quote as paid — resume unwinds what it watched revert');
  /* the unwind is per TRANSACTION. resume covers two of them and only one was refused; clearing
     by upload would throw away 44 quotes of ANT the chain did confirm. */
  assert.equal(marks(w2, TX(1)), 44, 'while every quote paid by the transaction that DID land keeps its entry');

  /* the same shape with nothing reverted finalizes, so the refusal above is the chain’s verdict
     and not a rig that refuses. */
  const r = await w3.payer.resume({ prepare: again, authorization: authOf(again) });
  assert.equal(r.address, ADDR); assert.equal(w3.log.finalize[0].txs.length, 300);
});

/* A KEPT RECEIPT IS HANDED BACK ONLY WHEN IT IS THIS UPLOAD'S. The finalized shortcut used to run
   BEFORE the coverage check, and the by-quote lookup is the one path on which `kept` can belong to
   a different upload — so a person who asked about file B was told file A was finished, at file A's
   address. Both arms are here: coverage failing (file B shares a quote and has an unpaid one) and
   coverage PASSING (file D is one chunk, byte-identical to A's first chunk, so its only quote is
   already paid — nothing but the address tells the two apart). */
test('resume never hands back another upload’s receipt: the kept record must cover this price AND name this address', async () => {
  const A = prepareOf(2, 1000n, { data_map_address: '0x' + 'aa'.repeat(32) }), w = world({ stored: '0x' + 'aa'.repeat(32) });
  const rA = await w.payer.pay({ prepare: A, authorization: authOf(A), confirmPlan: yes });
  assert.equal(JSON.parse(w.mem.get('ant-pay.paid.up-1')).finalized, true, 'precondition: A is finalized and its receipt is kept');
  const signed = () => w.log.sends.filter((t) => t.to === VAULT).length, signedAfterA = signed();

  /* CONTROL — A's own resume still answers with A's receipt. */
  assert.equal((await w.payer.resume({ prepare: A, authorization: authOf(A) })).address, rA.address);

  const B = { ...A, upload_id: 'up-B', data_map_address: '0x' + 'bb'.repeat(32),
    quotes: [A.quotes[0], { quote_hash: q(9), rewards_address: '0x' + (9).toString(16).padStart(40, '0'), amount_atto: '1000' }] };
  assert.equal(w.mem.get('ant-pay.paid.quote.' + q(9)), undefined, 'precondition: B’s second quote was never paid');
  await refused(w.payer.resume({ prepare: B, authorization: authOf(B) }), 'nothing-to-resume');

  const D = { ...A, upload_id: 'up-D', data_map_address: '0x' + 'dead'.repeat(16), chunks: { total: 1, already_stored: 0 }, quotes: [A.quotes[0]], total_atto: '1000' };
  assert.ok(w.mem.get('ant-pay.paid.quote.' + D.quotes[0].quote_hash), 'precondition: D’s only quote IS already paid, so coverage passes');
  const rD = await w.payer.resume({ prepare: D, authorization: authOf(D) }).then(() => null, (e) => e);
  assert.ok(rD && rD.refusal, 'D is refused rather than handed A’s receipt');
  assert.notEqual(rD.address, rA.address);
  assert.equal(signed(), signedAfterA, 'nothing was signed on either arm');
});

/* A RECORD THAT IS PRESENT AND UNREADABLE IS NOT 'UNPAID'. It used to read as unknown and be paid
   again — the silent, permanent direction — while a refusal is visible and recoverable. */
test('an unreadable payment record is refused by name, never guessed into a second payment', async () => {
  const p = prepareOf(2), w = world();
  await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes });
  const p2 = { ...p, upload_id: 'up-2' }, paid = (x) => x.log.sends.filter((t) => t.to === VAULT).length;

  const ctl = world(); for (const [k, v] of w.mem) ctl.mem.set(k, v);
  await refused(ctl.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'already-paid');
  assert.equal(paid(ctl), 0, 'CONTROL: an intact index refuses, and refuses for the already-paid reason');

  const probe = world(); for (const [k, v] of w.mem) probe.mem.set(k, v);
  probe.mem.set('ant-pay.paid.quote.' + q(1), '{"upload_id":"up-1","tx_h');
  await refused(probe.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'unreadable-record');
  assert.equal(paid(probe), 0, 'a truncated entry pays nothing');

  /* a record that parses but names no hash is the same answer — the shape is judged, not the JSON. */
  const probe2 = world(); for (const [k, v] of w.mem) probe2.mem.set(k, v);
  probe2.mem.set('ant-pay.paid.quote.' + q(1), '{"upload_id":"up-1","tx_hash":"0xnope"}');
  await refused(probe2.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'unreadable-record');
  assert.equal(paid(probe2), 0);
});

/* THE SURFACE'S RECORD OF WHAT LEFT THE WALLET MUST SURVIVE A DENIED STORE. The comment on that
   line claimed it already did; the tell sat under both writes, where a throwing store reached the
   caller and it never fired. The resilience bee-laborer measured lives in myspace.js's caller, not
   here — so the line now earns its own sentence. */
test('the payment hash is announced before it is written down: a denied store cannot swallow it', async () => {
  /* the allowance already covers the price, so the payment is the FIRST send and its hash is TX(1). */
  const p = prepareOf(2), w = world({ storeThrows: true, allowance: 10n ** 20n });
  const sent = () => w.log.states.filter((s) => s.phase === 'sent').map((s) => s.tx);
  await assert.rejects(w.payer.settle({ prepare: p, authorization: authOf(p), confirmPlan: yes }));
  assert.equal(w.log.sends.filter((t) => t.to === VAULT).length, 1, 'precondition: a payment did leave the wallet');
  assert.equal(w.mem.size, 0, 'precondition: the store kept nothing');
  assert.deepEqual(sent(), [TX(1)], 'and its hash was still announced');

  const ctl = world({ allowance: 10n ** 20n });
  await ctl.payer.settle({ prepare: p, authorization: authOf(p), confirmPlan: yes });
  assert.deepEqual(ctl.log.states.filter((s) => s.phase === 'sent').map((s) => s.tx), [TX(1)], 'CONTROL: the working store announces the same hash');
  assert.ok(ctl.mem.size > 0, 'CONTROL: and it does write it down');
});

/* ISOLATION, NOT ORDERING. bee-laborer's row asked this line for a true comment; the reorder that
   delivered it opened a DOUBLE PAYMENT — a renderer that throws on 'sent' destroyed the record
   before either write, so a re-prepare of the same bytes paid again. Ordering cannot make two
   effects survive each other, it only chooses which one dies. The denied-store CONTROL is the
   failure the ordering existed for and is kept in the row, so the fix cannot pass by moving it back. */
test('a renderer that throws does not cost a second payment: the sent tell is isolated, not merely ordered', async () => {
  const payCalls = (w) => w.log.sends.filter((t) => t.to === VAULT).length;
  /* the allowance already covers the price, so the payment is the FIRST send and its hash is TX(1). */
  const p1 = prepareOf(2), w = world({ allowance: 10n ** 20n, throwOnState: 'sent' });
  await w.payer.pay({ prepare: p1, authorization: authOf(p1), confirmPlan: yes });
  assert.equal(payCalls(w), 1);
  assert.deepEqual(w.log.states.filter((s) => s.phase === 'sent').map((s) => s.tx), [TX(1)], 'precondition: the throwing tell did fire');
  assert.equal(w.mem.size, 3, 'and the record survived it: the upload record and one key per quote');

  const p2 = { ...p1, upload_id: 'up-2' };
  await refused(w.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'already-paid');
  assert.equal(payCalls(w), 1, 'a re-prepare of the same bytes still signs nothing');

  const ctl = world({ allowance: 10n ** 20n, storeThrows: true });
  await assert.rejects(ctl.payer.settle({ prepare: p1, authorization: authOf(p1), confirmPlan: yes }));
  assert.deepEqual(ctl.log.states.filter((s) => s.phase === 'sent').map((s) => s.tx), [TX(1)], 'CONTROL: a denied store still cannot swallow the hash');
});

/* THE CHAIN SAID NOTHING MOVED. The per-quote index is written BEFORE the wait, deliberately, and
   nothing cleared it when the receipt came back 0x0 — so the quotes read paid-forever on a device
   that spent no ANT: pay() answered already-paid and resume() answered tx-reverted, two refusals
   pointing at each other. Before this file kept an index, a re-prepare simply signed again; closing
   that route is what makes the clear owed. The confirmed-payment CONTROL is kept in the row so the
   clear cannot pass by disabling the guard. */
test('a payment the chain refused is not paid-forever: its quotes are cleared and the price can be signed for again', async () => {
  const payCalls = (w) => w.log.sends.filter((t) => t.to === VAULT).length;
  const readable = (w) => [...w.mem].filter(([k, v]) => k.startsWith('ant-pay.paid.quote.') && v).length;
  const p1 = prepareOf(2), p2 = { ...prepareOf(2), upload_id: 'up-2' }, w = world({ allowance: 10n ** 20n, revert: true });
  await refused(w.payer.pay({ prepare: p1, authorization: authOf(p1), confirmPlan: yes }), 'tx-reverted');
  assert.equal(payCalls(w), 1, 'precondition: a payment was signed and the chain refused it');
  assert.equal(readable(w), 0, 'no quote is left marked paid by a transaction that moved nothing');
  assert.ok(!w.mem.get('ant-pay.paid.up-1'), 'and the upload record does not name the refused hash');
  await refused(w.payer.resume({ prepare: p2, authorization: authOf(p2) }), 'nothing-to-resume');
  await refused(w.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'tx-reverted');
  assert.equal(payCalls(w), 2, 'the price can be signed for again — the chain refused, so nothing was spent');

  const ctl = world({ allowance: 10n ** 20n });
  await ctl.payer.pay({ prepare: p1, authorization: authOf(p1), confirmPlan: yes });
  await refused(ctl.payer.pay({ prepare: p2, authorization: authOf(p2), confirmPlan: yes }), 'already-paid');
  assert.equal(payCalls(ctl), 1, 'CONTROL: a payment the chain CONFIRMED is still refused a second time');
});

/* and the unwind is per transaction, not per upload: 300 quotes ride in two calls, the first lands
   and the second is refused. Clearing the lot would throw away 256 quotes of real ANT. */
test('only the refused transaction is unwound: a batch that did land keeps its quotes marked paid', async () => {
  const p = prepareOf(300), w = world({ allowance: 10n ** 20n, revertHashes: [TX(2)] });
  await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), 'tx-reverted');
  assert.equal(w.log.sends.filter((t) => t.to === VAULT).length, 2, 'precondition: two payment calls, one landed and one refused');
  const entries = [...w.mem].filter(([k, v]) => k.startsWith('ant-pay.paid.quote.') && v);
  assert.equal(entries.length, 256, 'exactly the landed batch is still marked paid');
  assert.ok(entries.every(([, v]) => JSON.parse(v).tx_hash === TX(1)), 'and every kept entry names the transaction that landed');
  assert.equal(Object.keys(JSON.parse(w.mem.get('ant-pay.paid.up-1')).txHashes).length, 256, 'the upload record keeps the landed hashes and drops the refused one');

  const again = { ...p, upload_id: 'up-2' }, w2 = world({ allowance: 10n ** 20n });
  for (const [k, v] of w.mem) w2.mem.set(k, v);
  let shown = null;
  await w2.payer.pay({ prepare: again, authorization: authOf(again), confirmPlan: async (s) => { shown = s; return true; } });
  assert.deepEqual([shown.quotes, shown.quotes_already_paid], [44, 256], 'only the refused batch is asked for again');
  assert.equal(w2.log.finalize[0].txs.length, 300, 'and finalize still carries a tx for every priced quote');
});

/* THE INDEX AND THE RECORD ARE ONE VERDICT. charge() unwound both; resume() unwound only the index,
   so the same chain verdict was answered with two different sentences depending on which upload_id
   the person happened to be holding — and resume went on re-announcing a dead transaction its own
   index no longer believed in. The record is rewritten under the id it was READ under, which on the
   by-quote path is not this prepare's. */
test('the record is unwound with the index: resume stops naming a transaction the chain refused, under the id it read', async () => {
  const p = prepareOf(2), w = world({ allowance: 10n ** 20n, revert: true });
  const stopped = (x) => ({ get aborted() { return x.log.sends.some((t) => t.to === VAULT); } });
  await refused(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, signal: stopped(w) }), 'stopped-waiting');
  assert.equal(Object.keys(JSON.parse(w.mem.get('ant-pay.paid.up-1')).txHashes).length, 2, 'precondition: the device holds an unconfirmed hash for both quotes');
  await refused(w.payer.resume({ prepare: p, authorization: authOf(p) }), 'tx-reverted');
  assert.equal(w.mem.get('ant-pay.paid.up-1'), '', 'the record stops naming the refused transaction, emptied because no hash is left');
  await refused(w.payer.resume({ prepare: p, authorization: authOf(p) }), 'nothing-to-resume');

  /* CONTROL — the same shape with the chain CONFIRMING: resume finalizes, so the refusals above are
     the chain's verdict and not a rig that refuses. */
  const ctl = world({ allowance: 10n ** 20n });
  await refused(ctl.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, signal: stopped(ctl) }), 'stopped-waiting');
  assert.equal((await ctl.payer.resume({ prepare: p, authorization: authOf(p) })).address, ADDR);

  /* the BY-QUOTE path: the record read is up-1's while the prepare is up-2's. Rewriting under the
     prepare's id would leave the refused transaction named where it actually came from AND mint an
     empty record for an upload that never held a payment. */
  const w2 = world({ allowance: 10n ** 20n, revert: true }), again = { ...p, upload_id: 'up-2' };
  await refused(w2.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes, signal: stopped(w2) }), 'stopped-waiting');
  await refused(w2.payer.resume({ prepare: again, authorization: authOf(again) }), 'tx-reverted');
  assert.equal(w2.mem.get('ant-pay.paid.up-1'), '', 'the record it READ is the record it rewrote');
  assert.equal(w2.mem.get('ant-pay.paid.up-2'), undefined, 'and no empty record is minted for an upload that never held one');
});

/* A FINALIZED RECORD IS LEFT WHOLE. A is paid and finalized while the chain confirms; the same
   device is then read by a chain that refuses A's transaction, and the two worlds differ in nothing
   else. File D is one chunk sharing A's first quote, so resume(D) reaches A's record by quote, is
   correctly refused the receipt by the address guard, and then watches A's transaction revert.
   Emptying A's record there would withdraw an address the DOOR confirmed — the data is stored —
   because the chain later refused a transaction that paid for it. The index is cleared either way,
   and that is what stops a second payment. */
test('a finalized record is left whole: the chain refusing its transaction does not withdraw an address the door confirmed', async () => {
  const AA = '0x' + 'aa'.repeat(32), w3 = world({ allowance: 10n ** 20n, stored: AA }), A = prepareOf(2, 1000n, { data_map_address: AA });
  const rA = await w3.payer.pay({ prepare: A, authorization: authOf(A), confirmPlan: yes });
  assert.equal(JSON.parse(w3.mem.get('ant-pay.paid.up-1')).finalized, true, 'precondition: A is finalized and its receipt kept');
  const w4 = world({ allowance: 10n ** 20n, stored: AA, revertHashes: [TX(1)] });
  for (const [k, v] of w3.mem) w4.mem.set(k, v);
  assert.equal(JSON.parse(w4.mem.get('ant-pay.paid.up-1')).txHashes[A.quotes[0].quote_hash], TX(1), 'precondition: and the hash it names is the one this chain now refuses');
  const D = { ...A, upload_id: 'up-D', data_map_address: '0x' + 'dead'.repeat(16), chunks: { total: 1, already_stored: 0 }, quotes: [A.quotes[0]], total_atto: '1000' };
  await refused(w4.payer.resume({ prepare: D, authorization: authOf(D) }), 'tx-reverted');
  assert.equal(w4.mem.get('ant-pay.paid.quote.' + A.quotes[0].quote_hash), '', 'the index entry for the quote THIS plan named is cleared, so nothing it asked about reads as paid by a refused transaction');
  /* SCOPE, named: A's other quote is not in D's plan, so resume cannot see it and its entry stays.
     It self-heals on the next contact — a plan containing it waits on the same hash and unwinds it
     there — and the harm meanwhile is a quote left OUT of a payment, which the door refuses by name
     (missing_quote_tx): visible and recoverable, never a second signature. */
  assert.equal(JSON.parse(w4.mem.get('ant-pay.paid.quote.' + A.quotes[1].quote_hash)).tx_hash, TX(1), 'while a quote outside this plan is beyond its reach');
  assert.equal((await w4.payer.resume({ prepare: A, authorization: authOf(A) })).address, rA.address, 'and A can still be handed the address the door confirmed');
});

/* A DENIED CLEAR MUST NOT BECOME A STORAGE ERROR. The chain's verdict is what the person acts on —
   renaming it 'wallet-declined' names a wallet that did not decline and erases whether the money
   moved. But a repair that could not validate its own output owes that fact to the reader: without
   the second half of the sentence the next attempt meets 'already paid' and nothing says why. */
test('a clear the store refuses stays the chain’s verdict, and the refusal says the record is still stale', async () => {
  const marked = (x) => [...x.mem].filter(([k, v]) => k.startsWith('ant-pay.paid.quote.') && v).length;
  const p = prepareOf(2), w = world({ allowance: 10n ** 20n, revert: true, denyClear: true });
  await assert.rejects(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => {
    assert.equal(e.refusal, 'tx-reverted', e.message);
    assert.match(e.message, /refused by the chain/, 'the chain’s verdict is not replaced');
    assert.match(e.message, /could not clear its own record/, 'and the reader is told the record is stale');
    return true;
  });
  assert.equal(marked(w), 2, 'the stale entries stay — the lesser harm, and now a named one');

  /* only the FIRST clear denied: every remaining key is still attempted rather than the loop ending
     on the refusal, so a store that refuses one key cannot leave the rest naming a dead transaction.
     This is also the ONE arm where the record's own clear lands while a quote key did not, so it is
     the only place the per-key report is not masked by the record write's — without it a mutation
     that stops recording a refused KEY passes, which the battery on this commit measured. */
  const w2 = world({ allowance: 10n ** 20n, revert: true, denyClear: 1 });
  await assert.rejects(w2.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => {
    assert.equal(e.refusal, 'tx-reverted', e.message);
    assert.match(e.message, /could not clear its own record/, 'one refused key is enough to owe the reader the second half');
    return true;
  });
  assert.equal(marked(w2), 1, 'one key refused it, the other was cleared anyway');
  assert.equal(w2.mem.get('ant-pay.paid.up-1'), '', 'and the record itself was cleared — this is the arm where only a QUOTE key was refused');

  /* CONTROL — a store that allows the clear says the chain’s verdict and nothing more. */
  const ctl = world({ allowance: 10n ** 20n, revert: true });
  await assert.rejects(ctl.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => {
    assert.equal(e.refusal, 'tx-reverted'); assert.doesNotMatch(e.message, /could not clear/); return true; });
  assert.equal(marked(ctl), 0, 'and nothing is left marked paid');
});

test('the door must confirm the address it quoted: a different one is refused by name, and the payment ids are kept', async () => {
  const p = prepareOf(2);
  for (const stored of ['0x' + 'ee'.repeat(32), '', null]) {
    const w = world({ stored });
    await assert.rejects(w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes }), (e) => { assert.equal(e.refusal, 'address-mismatch', String(stored)); assert.equal(e.detail.txs.length, 2); return true; });
    assert.equal(JSON.parse(w.mem.get('ant-pay.paid.up-1')).finalized, false, 'not marked finished');
  }
  const w = world({ stored: ADDR.toUpperCase().replace('0X', '0x') }); await w.payer.pay({ prepare: p, authorization: authOf(p), confirmPlan: yes });
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

test('the file keeps its laws: the door’s wire only, no bridge route, no verify it cannot do, no key, no unlimited approve', () => {
  assert.doesNotMatch(src, /['"]\/v1\//, 'no bridge route is called');
  assert.doesNotMatch(src, /\/health|download\/verify/, 'no bridge health and no download-verify: the door has neither');
  assert.equal(typeof world().payer.verify, 'undefined', 'verify is named out of this slice, not kept as a call that cannot work');
  assert.doesNotMatch(src, /privateKey|mnemonic|seed phrase|SECRET_KEY|eth_sign|personal_sign/i, 'no key material, no blind message signing');
  assert.doesNotMatch(src, /f{64}|MaxUint|2n \*\* 256n/, 'no unlimited approval exists to be chosen');
  assert.equal((src.match(/connect\.trezor\.io/g) || []).length >= 1, true); assert.match(src, /fetched on the person's gesture only/);
  assert.doesNotMatch(src, /localStorage|document\.cookie/, 'storage is handed in by the surface');
});
