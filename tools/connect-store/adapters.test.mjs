import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { getPublicKey } from 'nostr-tools/pure';
import { BoundedHttp, AutonomiReadStore, X0xNotifications, X0xCheckpointReceiver } from './adapters.mjs';
import { hash, encode, fetchRef } from './core.mjs';
import { fixture } from './test-support.mjs';

async function spy(t, handler) {
  const calls = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, route: req.url, authorization: req.headers.authorization, body });
    handler(req, res, calls.at(-1));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { calls, base: `http://127.0.0.1:${server.address().port}` };
}

async function x0xFixture(t, { group, message, origin }) {
  const topic = `x0x.groups.public.${group}`;
  const seen = { authorization: null, subscribe: null };
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  wss.on('connection', (ws, request) => {
    seen.authorization = request.headers.authorization;
    ws.send(JSON.stringify({ type: 'connected', session_id: 'synthetic-session', agent_id: 'a'.repeat(64) }));
    ws.on('message', raw => {
      const command = JSON.parse(raw.toString());
      if (command.type !== 'subscribe') return;
      seen.subscribe = command;
      ws.send(JSON.stringify({ type: 'subscribed', topics: command.topics }));
      const frame = { type: 'message', topic, payload: Buffer.from(JSON.stringify(message)).toString('base64') };
      if (origin !== undefined) frame.origin = origin;
      setImmediate(() => ws.send(JSON.stringify(frame)));
    });
  });
  await once(wss, 'listening');
  t.after(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
  });
  return { url: `ws://127.0.0.1:${wss.address().port}`, seen };
}
test('production x0x adapter sends only the exact checkpoint notice and refuses extra plaintext fields', async t => {
  const api = await spy(t, (req, res) => { res.setHeader('content-type', 'application/json'); res.end('{"ok":true}'); });
  const http = new BoundedHttp(api.base, { token: 'synthetic-scoped-token' }); const group = hash('isolated group');
  const notice = { type: 'bnr-channel-checkpoint-v1', id: hash('checkpoint'), policy_id: hash('policy'), sequence: 1,
    ref: { address: hash('address'), sha256: hash('checkpoint bytes'), size: 1000 } };
  const bus = new X0xNotifications(http, group); await bus.publish(notice);
  assert.equal(api.calls.length, 1); assert.equal(api.calls[0].route, `/groups/${group}/send`);
  assert.deepEqual(JSON.parse(api.calls[0].body), { kind: 'announcement', body: JSON.stringify(notice) });
  assert.equal(api.calls[0].authorization, 'Bearer synthetic-scoped-token');
  await assert.rejects(bus.publish({ ...notice, content: 'private message' }), /invalid-fields/);
  assert.equal(api.calls.length, 1);
});

test('x0x receiver follows an opaque checkpoint from the actual WS protocol', async t => {
  const f = await fixture(); t.after(() => f.close()); const writer = f.create();
  const stored = await writer.publish(getPublicKey(f.alice), f.message(f.alice));
  const group = hash('synthetic x0x group');
  const message = { group_id: group, state_hash_at_send: 'state', revision_at_send: 1,
    author_agent_id: 'a'.repeat(64), author_public_key: 'b'.repeat(128), author_user_id: null,
    kind: 'announcement', body: JSON.stringify({ type: 'bnr-channel-checkpoint-v1', ...stored.checkpoint }),
    timestamp: Date.now(), signature: 'c'.repeat(128) };
  const daemon = await x0xFixture(t, { group, message }); const reader = f.create({ writer: undefined });
  const receiver = new X0xCheckpointReceiver({ wsUrl: daemon.url, token: 'synthetic-bearer-token', group, channel: reader });
  const result = await receiver.receiveOnce();
  assert.deepEqual(result.checkpoint, stored.checkpoint); assert.deepEqual(reader.pin, stored.checkpoint);
  assert.equal(reader.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]).length, 1);
  assert.equal(daemon.seen.authorization, 'Bearer synthetic-bearer-token');
  assert.deepEqual(daemon.seen.subscribe, { type: 'subscribe', topics: [`x0x.groups.public.${group}`] });
});

test('x0x receiver exposes no state when a checkpoint hint fails Channel.follow', async t => {
  const f = await fixture(); t.after(() => f.close()); const writer = f.create();
  const stored = await writer.publish(getPublicKey(f.alice), f.message(f.alice));
  const group = hash('synthetic x0x group with bad hint');
  const badNotice = { type: 'bnr-channel-checkpoint-v1', ...stored.checkpoint,
    ref: { ...stored.checkpoint.ref, sha256: hash('wrong object') } };
  const message = { group_id: group, state_hash_at_send: 'state', revision_at_send: 1,
    author_agent_id: 'a'.repeat(64), author_public_key: 'b'.repeat(128), author_user_id: null,
    kind: 'announcement', body: JSON.stringify(badNotice), timestamp: Date.now(), signature: 'c'.repeat(128) };
  const daemon = await x0xFixture(t, { group, message }); const reader = f.create({ writer: undefined });
  const receiver = new X0xCheckpointReceiver({ wsUrl: daemon.url, token: 'synthetic-bearer-token', group, channel: reader });
  await assert.rejects(receiver.receiveOnce(), /object-integrity/);
  assert.equal(reader.pin, null);
  assert.deepEqual(reader.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]), []);
});

test('x0x receiver refuses unsafe endpoints and unbounded receive budgets', () => {
  const channel = { follow() {} }; const group = hash('receiver validation');
  for (const wsUrl of ['ws://remote.example', 'wss://user@remote.example', 'wss://remote.example/path',
    'ws://127.0.0.1:12345?token=secret']) {
    assert.throws(() => new X0xCheckpointReceiver({ wsUrl, token: 'token', group, channel }), /unsafe-x0x-endpoint/);
  }
  for (const options of [{ maxMessages: 0 }, { maxMessages: 999 }, { timeoutMs: 0 }, { timeoutMs: 30001 }]) {
    assert.throws(() => new X0xCheckpointReceiver({ wsUrl: 'ws://127.0.0.1:12345', token: 'token', group, channel, ...options }),
      /invalid-x0x-receiver-budget/);
  }
});
test('production Autonomi read path validates retrieved bytes, and paid writes make zero requests', async t => {
  const bytes = Buffer.from('encrypted test object, no user content');
  const api = await spy(t, (req, res) => res.end(JSON.stringify({ data: bytes.toString('base64') })));
  const store = new AutonomiReadStore(new BoundedHttp(api.base)); const address = hash('network address');
  const ref = { address, sha256: hash(bytes), size: bytes.length };
  assert.deepEqual(await fetchRef(store, ref, 4096), bytes);
  assert.equal(api.calls[0].route, `/v1/data/public/${address}`);
  await assert.rejects(store.put(bytes), /autonomi-paid-write-not-enabled/); assert.equal(api.calls.length, 1);
  await assert.rejects(fetchRef(store, { ...ref, sha256: hash('wrong') }, 4096), /object-integrity/);
});
test('bad Autonomi envelopes fail closed at the caller boundary', async t => {
  let payload = 'null';
  const api = await spy(t, (req, res) => res.end(payload)); const store = new AutonomiReadStore(new BoundedHttp(api.base));
  for (const bad of ['null', '{}', '{"data": "a?!="}', '{"data":0}', '[1]', '{']) {
    payload = bad; await assert.rejects(store.get(hash('object'), 100));
  }
});
test('request budget, response size, redirects and body deadline are enforced by actual HTTP clients', async t => {
  const api = await spy(t, (req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: api.base + '/leak' }); res.end(); }
    else if (req.url === '/slow') { res.writeHead(200); res.write('{'); }
    else if (req.url === '/large') res.end('x'.repeat(4096));
    else res.end('{}');
  });
  const one = new BoundedHttp(api.base, { maxCalls: 1 }); await one.request('GET', '/ok');
  await assert.rejects(one.request('GET', '/ok'), /adapter-call-budget/); assert.equal(api.calls.length, 1);
  await assert.rejects(new BoundedHttp(api.base).request('GET', '/large', undefined, 64), /adapter-response-limit/);
  await assert.rejects(new BoundedHttp(api.base).request('GET', '/redirect'), /adapter-request-failed/);
  assert.equal(api.calls.some(c => c.route === '/leak'), false);
  await assert.rejects(new BoundedHttp(api.base, { timeoutMs: 40 }).request('GET', '/slow'), /adapter-request-failed/);
  const capped = new BoundedHttp(api.base, { maxBytes: 1 });
  const before = api.calls.length; await assert.rejects(capped.request('POST', '/ok', { request: 'too large' }), /adapter-byte-budget/);
  assert.equal(api.calls.length, before);
});
test('non-loopback unencrypted endpoints, embedded credentials and unbounded adapter options are refused', () => {
  for (const base of ['http://remote.example', 'https://key@remote.example', 'https://remote.example/nested'])
    assert.throws(() => new BoundedHttp(base));
  for (const options of [{ maxCalls: 9999 }, { maxBytes: Infinity }, { timeoutMs: 0 }])
    assert.throws(() => new BoundedHttp('http://127.0.0.1:12345', options), /invalid-adapter-budget/);
});
