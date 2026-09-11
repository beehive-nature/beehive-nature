import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { getPublicKey } from 'nostr-tools/pure';
import WebSocket from 'ws';
import { fixture, request, authorization, socket } from './test-support.mjs';
import { hash, signed, now } from './core.mjs';
import { startGateway } from './server.mjs';

test('two authenticated wire clients receive a live thread, then recover it and the file on a replacement gateway', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  const a = await startGateway(c); t.after(() => a.close()); const origin = c.policy.origin;
  const info = await (await fetch(a.url + '/info')).json();
  assert.equal(info.push.origin, origin.replace('https:', 'wss:'));
  const alice = await socket(a), bob = await socket(a); t.after(() => alice.close()); t.after(() => bob.close());
  assert.equal((await alice.authenticate(f.alice, origin))[2], true);
  assert.equal((await bob.authenticate(f.bob, origin))[2], true);
  bob.send(['REQ', 'room', { '#h': [f.channel], kinds: [9] }]); await bob.next(v => v[0] === 'EOSE');
  const root = f.message(f.alice, 'one isolated root'); alice.send(['EVENT', root]);
  assert.equal((await alice.next(v => v[0] === 'OK'))[2], true);
  assert.deepEqual((await bob.next(v => v[0] === 'EVENT'))[2], root);
  const reply = f.message(f.bob, 'one isolated reply', [['e', root.id, '', 'reply']]);
  bob.send(['EVENT', reply]); assert.equal((await bob.next(v => v[0] === 'OK'))[2], true);
  const bytes = randomBytes(300 * 1024);
  const upload = await request(a, f.alice, origin, '/media/upload', bytes, 'PUT'); assert.equal(upload.status, 200);
  const receipt = await upload.json(); assert.equal(receipt.sha256, hash(bytes));
  const query = await request(a, f.alice, origin, '/query', [{ '#h': [f.channel] }]);
  const expectedEvents = await query.json(); const clientHeldPin = JSON.parse(query.headers.get('x-bnr-checkpoint'));
  await alice.close(); await bob.close(); await a.close();
  const recovered = f.create({ writer: undefined }); await recovered.restore(clientHeldPin);
  const b = await startGateway(recovered); t.after(() => b.close());
  const rows = await request(b, f.bob, origin, '/query', [{ '#h': [f.channel] }]);
  assert.deepEqual(await rows.json(), expectedEvents);
  const restored = await socket(b); t.after(() => restored.close()); await restored.authenticate(f.bob, origin);
  restored.send(['REQ', 'history', { '#h': [f.channel] }]);
  const one = await restored.next(v => v[0] === 'EVENT'), two = await restored.next(v => v[0] === 'EVENT');
  assert.deepEqual(new Set([one[2].id, two[2].id]), new Set([root.id, reply.id])); await restored.next(v => v[0] === 'EOSE');
  const mediaAuth = signed(f.bob, 24242, [['t', 'get'], ['server', new URL(origin).host], ['expiration', String(now() + 300)]], '');
  const file = await request(b, f.bob, origin, `/media/${receipt.sha256}`, undefined, 'GET', `Nostr ${Buffer.from(JSON.stringify(mediaAuth)).toString('base64url')}`);
  assert.equal(file.status, 200); assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  const denied = await request(b, f.outsider, origin, `/media/${receipt.sha256}`, undefined, 'GET'); assert.equal(denied.status, 403);
});
test('HTTP canonical target, payload, replay and author boundary are enforced by the actual server', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create(), g = await startGateway(c); t.after(() => g.close());
  const event = f.message(f.alice), bytes = Buffer.from(JSON.stringify(event));
  const token = authorization(f.alice, 'POST', c.policy.origin + '/events', bytes);
  assert.equal((await request(g, f.alice, c.policy.origin, '/events', event, 'POST', token)).status, 200);
  assert.equal((await request(g, f.alice, c.policy.origin, '/events', event, 'POST', token)).status, 401);
  const aliasToken = authorization(f.alice, 'POST', g.url + '/events', bytes);
  assert.equal((await request(g, f.alice, c.policy.origin, '/events', event, 'POST', aliasToken)).status, 401);
  const mismatched = authorization(f.alice, 'POST', c.policy.origin + '/events', Buffer.from('{}'));
  assert.equal((await request(g, f.alice, c.policy.origin, '/events', event, 'POST', mismatched)).status, 401);
  assert.equal((await request(g, f.bob, c.policy.origin, '/events', f.message(f.alice, 'wrong sender'))).status, 403);
  assert.equal((await fetch(g.url + '/query', { method: 'POST', headers: { 'x-pubkey': getPublicKey(f.alice) }, body: '[{}]' })).status, 401);
});
test('WebSocket connection is not authentication: no subscription or event without the right challenge and member', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create(), g = await startGateway(c); t.after(() => g.close());
  const bad = await socket(g); t.after(() => bad.close());
  bad.send(['REQ', 'stolen', { '#h': [f.channel] }]); assert.equal((await bad.next(v => v[0] === 'NOTICE'))[1], 'authentication-required');
  bad.send(['AUTH', signed(f.alice, 22242, [['relay', c.policy.origin.replace('https:', 'wss:')], ['challenge', 'wrong']], '')]);
  assert.equal((await bad.next(v => v[0] === 'NOTICE'))[1], 'invalid-ws-auth');
  const outsider = await socket(g); t.after(() => outsider.close());
  assert.equal((await outsider.authenticate(f.outsider, c.policy.origin))[1], 'membership-required');
  assert.equal(c.pin, null);
});

function captureServerSocket(t) {
  let captured;
  const original = WebSocket.prototype.send;
  t.mock.method(WebSocket.prototype, 'send', function (...args) {
    if (this._isServer) captured ??= this;
    return original.apply(this, args);
  });
  return () => captured;
}
async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'gateway did not close the stalled consumer');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function checkStalledBurst(t, client, serverSocket, trigger) {
  let receivedBytes = 0, events = 0, completed = false, binaryFrames = 0;
  client.ws.on('message', (raw, binary) => {
    if (binary) binaryFrames++;
    const frame = JSON.parse(raw);
    if (frame[0] === 'EVENT') { receivedBytes += raw.length; events++; }
    if (frame[0] === 'EOSE') completed = true;
  });
  let closeResult;
  client.ws.once('close', (code, reason) => { closeResult = { code, reason: reason.toString() }; });
  // A paused reader alone can still fit the whole burst in the OS TCP buffers.
  // Cork the real server stream as well to deterministically retain pending
  // writes. The real ws bufferedAmount is used; no fake queue length or sender.
  const stream = serverSocket._socket;
  client.ws._socket.pause(); stream.cork();
  t.after(() => { stream.uncork(); client.ws._socket?.resume(); });
  await trigger();
  await waitFor(() => serverSocket.readyState === WebSocket.CLOSING);
  assert.ok(serverSocket.bufferedAmount <= 128 * 1024 + 125, 'data queue exceeded its ceiling plus bounded close frame');
  stream.uncork(); client.ws._socket.resume();
  await waitFor(() => closeResult !== undefined);
  assert.deepEqual(closeResult, { code: 1008, reason: 'consumer-lag' });
  assert.ok(events > 0 && events < 40, 'the full burst must not be admitted');
  assert.ok(receivedBytes <= 128 * 1024, 'delivered data exceeded the admitted queue');
  assert.equal(binaryFrames, 0, 'Nostr replies must remain WebSocket text frames');
  assert.equal(completed, false, 'a refused history burst must not claim EOSE');
}
test('initial REQ enforces the output bound against a real stalled transport before enqueueing the full history', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  for (let i = 0; i < 40; i++) await c.publish(getPublicKey(f.alice), f.message(f.alice,
    `${i}:` + (i % 2 ? '🌹'.repeat(3500) : 'x'.repeat(15000))));
  const capture = captureServerSocket(t), g = await startGateway(c); t.after(() => g.close());
  const client = await socket(g); t.after(() => client.close()); await client.authenticate(f.bob, c.policy.origin);
  client.send(['REQ', 'healthy', { '#h': [f.channel], limit: 4 }]);
  for (let i = 0; i < 4; i++) await client.next(v => v[0] === 'EVENT' && v[1] === 'healthy');
  await client.next(v => v[0] === 'EOSE' && v[1] === 'healthy');
  client.send(['CLOSE', 'healthy']);
  await checkStalledBurst(t, client, capture(), () => client.send(['REQ', 'burst', { '#h': [f.channel], limit: 40 }]));
});
test('post-restore live notifications use the same pre-enqueue output bound', async t => {
  const f = await fixture(); t.after(() => f.close()); const writer = f.create();
  for (let i = 0; i < 16; i++) await writer.publish(getPublicKey(f.alice), f.message(f.alice, `${i}:` + 'x'.repeat(15000)));
  const reader = f.create({ writer: undefined });
  const capture = captureServerSocket(t), g = await startGateway(reader); t.after(() => g.close());
  const client = await socket(g); t.after(() => client.close()); await client.authenticate(f.bob, reader.policy.origin);
  client.send(['REQ', 'live', { '#h': [f.channel] }]); await client.next(v => v[0] === 'EOSE');
  await checkStalledBurst(t, client, capture(), () => reader.restore(writer.pin));
});
test('1024 authenticated nonmember refusals leave replay capacity available to a member and replay protection intact', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create(), g = await startGateway(c); t.after(() => g.close());
  const filters = [{ '#h': [f.channel] }];
  for (let i = 0; i < 1024; i++) {
    const denied = await request(g, f.outsider, c.policy.origin, '/query', filters);
    assert.equal(denied.status, 403, `outsider attempt ${i}`); await denied.arrayBuffer();
  }
  const token = authorization(f.alice, 'POST', c.policy.origin + '/query', Buffer.from(JSON.stringify(filters)));
  const member = await request(g, f.alice, c.policy.origin, '/query', filters, 'POST', token);
  assert.equal(member.status, 200); assert.deepEqual(await member.json(), []);
  const replay = await request(g, f.alice, c.policy.origin, '/query', filters, 'POST', token);
  assert.equal(replay.status, 401); assert.equal((await replay.json()).error, 'auth-replay');
});
