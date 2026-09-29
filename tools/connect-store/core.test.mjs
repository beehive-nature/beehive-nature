import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { getPublicKey } from 'nostr-tools/pure';
import { fixture } from './test-support.mjs';
import { Channel, LIMITS, signed, encode, hash, checkedEvent, now } from './core.mjs';
import { DirectoryStore } from './adapters.mjs';

test('recover exact signed thread and file on a fresh read-only gateway, no original process state', async t => {
  const f = await fixture(); t.after(() => f.close());
  let first = f.create();
  const a = f.message(f.alice, 'root message');
  const b = f.message(f.bob, 'reply', [['e', a.id, '', 'reply']]);
  const bytes = randomBytes(300 * 1024);
  await first.publish(getPublicKey(f.alice), a);
  await first.upload(getPublicKey(f.alice), bytes);
  await first.publish(getPublicKey(f.bob), b);
  const pin = JSON.parse(JSON.stringify(first.pin));
  first = null;
  const second = f.create({ writer: undefined, store: new DirectoryStore(f.root) });
  await second.restore(pin);
  const recovered = second.query(getPublicKey(f.bob), [{ '#h': [f.channel] }]);
  assert.deepEqual(new Set(recovered.map(e => e.id)), new Set([a.id, b.id]));
  assert.deepEqual(recovered.find(e => e.id === b.id), b);
  assert.deepEqual(second.download(getPublicKey(f.bob), hash(bytes)), bytes);
  await assert.rejects(second.publish(getPublicKey(f.alice), f.message(f.alice)), /read-only-gateway/);
});
test('object directory contains no channel messages or attachment bytes in plaintext', async t => {
  const f = await fixture(); t.after(() => f.close());
  const c = f.create(); const marker = 'PRIVATE-CHANNEL-CONTENT-CANARY';
  await c.publish(getPublicKey(f.alice), f.message(f.alice, marker));
  await c.upload(getPublicKey(f.alice), Buffer.from(marker));
  for (const name of await readdir(f.root)) {
    const bytes = await readFile(path.join(f.root, name));
    assert.equal(bytes.includes(Buffer.from(marker)), false);
    assert.equal(bytes.includes(Buffer.from(Buffer.from(marker).toString('base64'))), false);
  }
});
test('duplicate event does not append, store again, or announce again', async t => {
  const f = await fixture(); t.after(() => f.close());
  let announcements = 0;
  const c = f.create({ live: { async publish() { announcements++; } } }); const e = f.message(f.alice);
  await c.publish(getPublicKey(f.alice), e); const pin = c.pin;
  const files = await readdir(f.root);
  const result = await c.publish(getPublicKey(f.alice), e);
  assert.equal(result.duplicate, true); assert.deepEqual(c.pin, pin);
  assert.deepEqual(await readdir(f.root), files); assert.equal(announcements, 1);
});
test('nonmembers, wrong authors, foreign channels and event kinds fail before storage', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  await assert.rejects(c.publish(getPublicKey(f.outsider), f.message(f.outsider)), /membership-required/);
  await assert.rejects(c.publish(getPublicKey(f.alice), f.message(f.bob)), /author-or-time/);
  await assert.rejects(c.publish(getPublicKey(f.alice), signed(f.alice, 9, [['h', 'foreign']], 'x')), /unsupported-event/);
  await assert.rejects(c.publish(getPublicKey(f.alice), signed(f.alice, 9002, [['h', f.channel]], 'x')), /unsupported-event/);
  assert.deepEqual(await readdir(f.root), []); assert.equal(c.pin, null);
});
test('signature verification cannot be bypassed through an already verified mutable event', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  const e = f.message(f.alice); checkedEvent(e); e.content = 'changed';
  await assert.rejects(c.publish(getPublicKey(f.alice), e), /invalid-signature/);
  assert.equal(c.pin, null);
});
test('wrong owner, policy pin, signing authority and content key are refused', async t => {
  const f = await fixture(); t.after(() => f.close());
  assert.throws(() => f.create({ owner: getPublicKey(f.outsider) }), /policy-pin/);
  assert.throws(() => f.create({ policyId: hash('wrong') }), /policy-pin/);
  assert.throws(() => f.create({ writer: f.bob }), /writer-not-authorized/);
  const c = f.create(); await c.publish(getPublicKey(f.alice), f.message(f.alice));
  const reader = f.create({ key: randomBytes(32), writer: undefined });
  await assert.rejects(reader.restore(c.pin), /ciphertext-authentication/); assert.equal(reader.pin, null);
});
test('expired owner policy refuses access and admission without storing anything', async t => {
  const f = await fixture(); t.after(() => f.close());
  const policy = signed(f.owner, 30078, f.config.policy.tags,
    JSON.stringify({ ...JSON.parse(f.config.policy.content), expires_at: now() - 1 }), now() - 120);
  const c = f.create({ policy, policyId: policy.id });
  assert.throws(() => c.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]), /policy-expired/);
  await assert.rejects(c.publish(getPublicKey(f.alice), f.message(f.alice)), /policy-expired/);
  assert.deepEqual(await readdir(f.root), []);
});
test('missing/truncated/corrupt stored data never exposes a partial restored history', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  await c.publish(getPublicKey(f.alice), f.message(f.alice));
  const cp = JSON.parse(await readFile(path.join(f.root, c.pin.ref.address)));
  const ref = JSON.parse(cp.content).data; const file = path.join(f.root, ref.address); const original = await readFile(file);
  for (const bad of [Buffer.alloc(0), original.subarray(0, original.length - 1), Buffer.from(original).fill(42, 0, 1)]) {
    await writeFile(file, bad); const reader = f.create({ writer: undefined });
    await assert.rejects(reader.restore(c.pin), /object-integrity/);
    assert.equal(reader.pin, null); assert.deepEqual(reader.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]), []);
  }
  await unlink(file); await assert.rejects(f.create({ writer: undefined }).restore(c.pin), /object-missing/);
});
test('provider cannot choose a different checkpoint or forge its author', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  await c.publish(getPublicKey(f.alice), f.message(f.alice));
  const old = JSON.parse(await readFile(path.join(f.root, c.pin.ref.address)));
  const fake = signed(f.outsider, old.kind, old.tags, old.content);
  const bytes = encode(fake); const address = await f.config.store.put(bytes);
  const pin = { ...c.pin, id: fake.id, ref: { address, sha256: hash(bytes), size: bytes.length } };
  await assert.rejects(f.create({ writer: undefined }).restore(pin), /checkpoint-signature/);
  await assert.rejects(f.create({ writer: undefined }).restore({ ...pin, id: old.id }), /checkpoint-signature/);
});
test('live follower rejects skipped predecessors, stale tips and forks; duplicate notices are harmless', async t => {
  const f = await fixture(); t.after(() => f.close()); const notices = [];
  const c = f.create({ live: { async publish(n) { notices.push(n); } } });
  for (let i = 0; i < 3; i++) await c.publish(getPublicKey(f.alice), f.message(f.alice, `message ${i}`));
  const reader = f.create({ writer: undefined }); await reader.follow(notices[0]); const first = reader.pin;
  const fork = f.create(); await fork.publish(getPublicKey(f.alice), f.message(f.alice, 'competing genesis'));
  await assert.rejects(reader.restore(fork.pin), /stale-or-conflicting-checkpoint/);
  await assert.rejects(reader.follow(notices[2]), /checkpoint-gap-or-fork/); assert.deepEqual(reader.pin, first);
  await reader.follow(notices[1]); await reader.follow(notices[1]);
  await assert.rejects(reader.follow(notices[0]), /stale-or-conflicting-checkpoint/);
  await reader.follow(notices[2]); assert.deepEqual(reader.pin, c.pin);
});
test('store/read-back/checkpoint-write failures preserve the previous visible tip and refuse acknowledgement', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const mode of ['put', 'get', 'checkpoint']) {
    let fail = false, writes = 0;
    const store = { async put(bytes) { writes++; if (fail && (mode === 'put' || (mode === 'checkpoint' && writes % 2 === 0))) throw new Error('injected-store-failure');
      return f.config.store.put(bytes); }, async get(...args) { if (fail && mode === 'get') return Buffer.from('corrupt'); return f.config.store.get(...args); } };
    const c = f.create({ store }); await c.publish(getPublicKey(f.alice), f.message(f.alice, mode)); const pin = c.pin; fail = true;
    await assert.rejects(c.publish(getPublicKey(f.alice), f.message(f.alice, `failed ${mode}`)));
    assert.deepEqual(c.pin, pin); assert.equal(c.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]).length, 1);
  }
});
test('notification failure does not misreport storage loss or remote delivery', async t => {
  const f = await fixture(); t.after(() => f.close());
  const c = f.create({ live: { async publish() { throw new Error('offline'); } } });
  const result = await c.publish(getPublicKey(f.alice), f.message(f.alice));
  assert.equal(result.stored, true); assert.equal(result.notification_accepted, false); assert.equal(result.accepted, true);
  await f.create({ writer: undefined }).restore(result.checkpoint);
});
test('admission limits and unsupported query filters fail closed', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = f.create();
  await assert.rejects(c.publish(getPublicKey(f.alice), f.message(f.alice, 'x'.repeat(LIMITS.event))), /size-limit/);
  await assert.rejects(c.upload(getPublicKey(f.alice), Buffer.alloc(LIMITS.file + 1)), /file-limit/);
  assert.throws(() => c.query(getPublicKey(f.alice), [{}]), /channel-required/);
  assert.throws(() => c.query(getPublicKey(f.alice), [{ '#h': [f.channel], search: 'ignored?' }]), /unsupported-filter/);
  assert.throws(() => c.query(getPublicKey(f.alice), [{ '#h': [f.channel], limit: -1 }]), /invalid-filter-bound/);
  assert.throws(() => c.query(getPublicKey(f.outsider), [{ '#h': [f.channel] }]), /membership-required/);
});
test('concurrent mutations refuse admission instead of losing an acknowledged update', async t => {
  const f = await fixture(); t.after(() => f.close()); let unblock; let started;
  const held = new Promise(resolve => { unblock = resolve; }); const entered = new Promise(resolve => { started = resolve; });
  const store = { async put(bytes) { started(); await held; return f.config.store.put(bytes); }, get: (...args) => f.config.store.get(...args) };
  const c = f.create({ store }); const first = c.publish(getPublicKey(f.alice), f.message(f.alice, 'first'));
  await entered; await assert.rejects(c.publish(getPublicKey(f.bob), f.message(f.bob, 'second')), /operation-in-progress/);
  unblock(); await first; assert.equal(c.query(getPublicKey(f.bob), [{ '#h': [f.channel] }]).length, 1);
});
test('failed large storage attempts exhaust the process budget without a false acknowledgement', async t => {
  const f = await fixture(); t.after(() => f.close()); let attempts = 0;
  const c = f.create({ store: { async put() { attempts++; throw new Error('storage-offline'); }, async get() { throw new Error('unreachable'); } } });
  const bytes = Buffer.alloc(LIMITS.file, 42);
  for (let i = 0; i < 24; i++) await assert.rejects(c.upload(getPublicKey(f.alice), bytes));
  const exhausted = attempts;
  await assert.rejects(c.upload(getPublicKey(f.alice), bytes), /process-write-budget/);
  assert.equal(attempts, exhausted); assert.equal(c.pin, null);
});
