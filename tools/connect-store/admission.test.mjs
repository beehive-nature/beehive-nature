import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdir } from 'node:fs/promises';
import { getPublicKey } from 'nostr-tools/pure';
import { BoundedHttp } from './adapters.mjs';
import { AntdQuoteSource, SyntheticQuoteSource, PaymentAdmissionGate } from './admission.mjs';
import { fixture } from './test-support.mjs';

const aliceKey = fx => getPublicKey(fx.alice);

async function spy(t, handler) {
  const calls = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, route: req.url, body });
    handler(req, res, calls.at(-1));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { calls, base: `http://127.0.0.1:${server.address().port}` };
}

test('synthetic quote source is deterministic and chunk-aware', () => {
  const source = new SyntheticQuoteSource({ byteRate: 2n, chunkSize: 100, chunkOverhead: 10n, recordOverhead: 5n });
  const a = source.quote('snapshot', Buffer.alloc(250, 1));
  const b = source.quote('snapshot', Buffer.alloc(250, 7));
  assert.deepEqual(a, b);   // content-independent by design
  assert.equal(a.chunks, 3);
  assert.equal(a.cost, 250n * 2n + 3n * 10n + 5n);
  assert.equal(a.gas, 0n);
  assert.throws(() => source.quote('x', Buffer.alloc(0)), /invalid-quote-input/);
});

test('over-ceiling mutation is refused before any store write', async t => {
  const fx = await fixture();
  t.after(fx.close);
  const gate = new PaymentAdmissionGate({
    quoteSource: new SyntheticQuoteSource({ byteRate: 1n, chunkOverhead: 0n, recordOverhead: 0n }),
    ceiling: 30_000n,   // below even one minimal complete mutation here
  });
  const channel = fx.create({ admission: gate });
  await assert.rejects(channel.publish(aliceKey(fx), fx.message(fx.alice)), err =>
    err.code === 'payment-admission-refused' && err.status === 429 && BigInt(err.admission.deficit) > 0n);
  assert.deepEqual(await readdir(fx.root), []);   // nothing written, not even partially
  assert.equal(channel.pin, null);
  assert.deepEqual(channel.query(getPublicKey(fx.alice), [{ '#h': [fx.channel] }]), []);
  assert.equal(gate.remaining, gate.ceiling);     // a refused request reserves nothing
});

test('admitted mutation carries a synthetic receipt; Trezor stays downstream', async t => {
  const fx = await fixture();
  t.after(fx.close);
  const gate = new PaymentAdmissionGate({
    quoteSource: new SyntheticQuoteSource({ byteRate: 1n, chunkOverhead: 1n, recordOverhead: 1n }),
    ceiling: 200_000n,
  });
  const channel = fx.create({ admission: gate });
  const result = await channel.publish(aliceKey(fx), fx.message(fx.alice));
  assert.equal(result.stored, true);
  const receipt = result.admission;
  assert.equal(receipt.admitted, true);
  assert.equal(receipt.payment, 'synthetic-quote');
  assert.equal(receipt.funds_spent, '0');
  assert.equal(receipt.signed, false);
  assert.equal(receipt.approval, 'pending-trezor-downstream');
  assert.ok(BigInt(receipt.total) > 0n && BigInt(receipt.remaining) < gate.ceiling);
  assert.deepEqual(receipt.records.map(r => r.label), ['snapshot', 'checkpoint', 'notification']);
  assert.ok((await readdir(fx.root)).length >= 2);   // snapshot + checkpoint objects exist
});

test('the ledger is cumulative: a second mutation over the aggregate ceiling is refused', async t => {
  const fx = await fixture();
  t.after(fx.close);
  const gate = new PaymentAdmissionGate({
    quoteSource: new SyntheticQuoteSource({ byteRate: 1n, chunkOverhead: 0n, recordOverhead: 0n }),
    ceiling: 40_000n,   // sized for roughly one complete mutation
  });
  const channel = fx.create({ admission: gate });
  const first = await channel.publish(aliceKey(fx), fx.message(fx.alice));
  assert.equal(first.stored, true);
  const later = Math.floor(Date.now() / 1000) + 1;   // events must advance in time
  await assert.rejects(channel.publish(getPublicKey(fx.bob), fx.message(fx.bob, 'second', [], later)),
    /payment-admission-refused/);
  assert.ok(BigInt(first.admission.remaining) < 10_000n);   // ledger moved
  assert.equal(channel.query(getPublicKey(fx.alice), [{ '#h': [fx.channel] }]).length, 1);   // only the first landed
});

test('admitted retries multiply the reserved budget explicitly', async t => {
  const fx = await fixture();
  t.after(fx.close);
  const source = new SyntheticQuoteSource({ byteRate: 1n, chunkOverhead: 0n, recordOverhead: 0n });
  const withRetries = new PaymentAdmissionGate({ quoteSource: source, ceiling: 60_000n, retriesAdmitted: 1 });
  const channel = fx.create({ admission: withRetries });
  await assert.rejects(channel.publish(aliceKey(fx), fx.message(fx.alice)), err => {
    assert.equal(err.code, 'payment-admission-refused');
    assert.equal(err.admission.retries_admitted, 1);
    assert.ok(BigInt(err.admission.total) === BigInt(err.admission.per_attempt) * 2n);
    return true;
  });
  const withoutRetries = new PaymentAdmissionGate({ quoteSource: source, ceiling: 60_000n });
  const ok = await fx.create({ admission: withoutRetries }).publish(aliceKey(fx), fx.message(fx.alice));
  assert.equal(ok.stored, true);
});

test('uploads ride the same admission boundary as events', async t => {
  const fx = await fixture();
  t.after(fx.close);
  const gate = new PaymentAdmissionGate({
    quoteSource: new SyntheticQuoteSource({ byteRate: 3n, chunkOverhead: 0n, recordOverhead: 0n }),
    ceiling: 400_000n,
  });
  const channel = fx.create({ admission: gate });
  const small = await channel.upload(aliceKey(fx), Buffer.alloc(1024, 9));
  assert.equal(small.stored, true);
  await assert.rejects(channel.upload(aliceKey(fx), Buffer.alloc(600 * 1024, 9)), /payment-admission-refused/);
  assert.equal(channel.download(aliceKey(fx), small.sha256).length, 1024);   // only the admitted upload exists
});

test('antd quote source drives the real /v1/data/cost caller and parses the pinned response', async t => {
  const seen = await spy(t, (req, res, call) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/data/cost');
    const body = JSON.parse(call.body);
    assert.ok(typeof body.data === 'string' && body.data.length > 0);
    assert.equal(body.payment_mode, 'Auto');
    res.end(JSON.stringify({ cost: '1234', file_size: Buffer.from(body.data, 'base64').length,
      chunk_count: 2, estimated_gas_cost_wei: '50', payment_mode: 'Auto' }));
  });
  const source = new AntdQuoteSource(new BoundedHttp(seen.base, { maxBytes: 1024 * 1024 }));
  const quote = await source.quote('snapshot', Buffer.alloc(500, 1));
  assert.equal(quote.cost, 1234n);
  assert.equal(quote.gas, 50n);
  assert.equal(quote.chunks, 2);
  assert.equal(seen.calls.length, 1);
});

test('malformed antd quotes fail closed at the caller boundary', async t => {
  const badPayloads = [
    { cost: 'not-a-number', file_size: 500, chunk_count: 1, estimated_gas_cost_wei: '0' },   // cost not decimal
    { cost: '-1', file_size: 500, chunk_count: 1, estimated_gas_cost_wei: '0' },              // negative cost
    { cost: '1', file_size: 499, chunk_count: 1, estimated_gas_cost_wei: '0' },               // size mismatch
    { cost: '1' },                                                                            // missing fields
  ];
  for (const payload of badPayloads) {
    const seen = await spy(t, (req, res) => res.end(JSON.stringify(payload)));
    const source = new AntdQuoteSource(new BoundedHttp(seen.base));
    await assert.rejects(source.quote('snapshot', Buffer.alloc(500, 1)),
      err => err.code === 'invalid-quote-response');
  }
});

test('a dead quote source fails closed as quote-unavailable without consuming a sequence', async t => {
  const gate = new PaymentAdmissionGate({
    quoteSource: { quote: async () => { throw new Error('socket hung up'); } },
    ceiling: 1000n,
  });
  await assert.rejects(gate.checkMutation({ sealedSnapshot: Buffer.alloc(100, 1) }),
    err => err.code === 'quote-unavailable' && err.status === 502);
  assert.equal(gate.sequence, 0);
  assert.equal(gate.remaining, 1000n);
});

test('gate and channel reject invalid construction', async t => {
  const fx = await fixture();
  t.after(fx.close);
  assert.throws(() => new PaymentAdmissionGate({ quoteSource: null, ceiling: 10n }), /invalid-quote-source/);
  assert.throws(() => new PaymentAdmissionGate({ quoteSource: { quote() {} }, ceiling: 0n }), /invalid-ceiling/);
  assert.throws(() => new PaymentAdmissionGate({ quoteSource: { quote() {} }, ceiling: 10n ** 16n }), /invalid-ceiling/);
  assert.throws(() => new PaymentAdmissionGate({ quoteSource: { quote() {} }, ceiling: 10n, retriesAdmitted: 9 }), /invalid-retry-budget/);
  assert.throws(() => fx.create({ admission: { notAGate: true } }), /invalid-admission-gate/);
});

