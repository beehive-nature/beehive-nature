import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { getPublicKey } from 'nostr-tools/pure';
import { fixture } from './test-support.mjs';
import { EpochKeyring, signed, encode, hash } from './core.mjs';
import { BPQ, issueGrant, newEpoch, rekey, openGrant } from './keygrant.mjs';

// Test-only PQ identities derived from public strings; no real key material.
const pq = name => BPQ.keys(new Uint8Array(createHash('sha256').update(`connect-store keygrant test: ${name}`).digest()),
  'pq:connect-store-test');
const owner = pq('owner'), gateway = pq('gateway'), alice = pq('alice'), bob = pq('bob'), outsider = pq('outsider');
const card = BPQ.card;
const bind = { policyId: hash('connect-store keygrant test policy'), channel: 'canary-keygrant' };
const as = (keys, b = bind) => ({ keys, ownerId: owner.id, ...b });
const code = expected => e => { assert.equal(e.code, expected); return true; };
const u32 = n => Buffer.from([n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]);

test('an epoch grant opens for each verified member card and for nobody else', async () => {
  const e1 = await newEpoch({ owner, ...bind, epoch: 1, cards: [alice, bob].map(card) });
  for (const k of [alice, bob]) {
    const g = await openGrant(e1.grant, as(k));
    assert.equal(g.epoch, 1); assert.deepEqual(g.key, e1.key); assert.deepEqual(g.recipients, [alice.id, bob.id]);
  }
  await assert.rejects(openGrant(e1.grant, as(outsider)), code('grant-not-openable'));
  // The public head names no reader and no signer (SPEC-BPQ-1 §4).
  const head = BPQ.inspect(e1.grant);
  assert.deepEqual(head.slots.map(s => Object.keys(s).sort().join()), ['ct,to,w', 'ct,to,w']);
  for (const k of [owner, alice, bob]) assert.equal(Buffer.from(e1.grant).includes(Buffer.from(k.id)), false);
  // A card whose X-Wing key was swapped fails its own signature and gets no slot.
  const swapped = { ...card(alice), kem: card(outsider).kem };
  await assert.rejects(issueGrant({ owner, ...bind, epoch: 1, key: e1.key, cards: [swapped] }), code('invalid-card'));
  await assert.rejects(issueGrant({ owner, ...bind, epoch: 1, key: e1.key, cards: [card(alice), card(alice)] }),
    code('duplicate-recipient'));
});

test('the owner signature verifies under the pinned owner id and binds policy, channel and epoch', async () => {
  const e1 = await newEpoch({ owner, ...bind, epoch: 1, cards: [card(alice)] });
  const raw = await BPQ.open(e1.grant, { kem: alice });
  assert.equal(raw.sealedBy.ok, true); assert.equal(raw.sealedBy.id, owner.id);
  assert.deepEqual(raw.meta, { type: 'bnr-channel-key-grant-v1', policy_id: bind.policyId, channel: bind.channel,
    epoch: 1, recipients: [alice.id] });
  await assert.rejects(openGrant(e1.grant, { ...as(alice), ownerId: outsider.id }), code('grant-owner-signature'));
  const impostor = await newEpoch({ owner: outsider, ...bind, epoch: 1, cards: [card(alice)] });
  await assert.rejects(openGrant(impostor.grant, as(alice)), code('grant-owner-signature'));
  const unsigned = await BPQ.seal(e1.key, { to: [alice.kem.publicKey], meta: raw.meta });
  await assert.rejects(openGrant(unsigned, as(alice)), code('grant-owner-signature'));
  await assert.rejects(openGrant(e1.grant, as(alice, { ...bind, policyId: hash('another policy') })), code('grant-binding'));
  await assert.rejects(openGrant(e1.grant, as(alice, { ...bind, channel: 'another-channel' })), code('grant-binding'));
});

test('a tampered grant is refused wherever the change lands', async () => {
  const e1 = await newEpoch({ owner, ...bind, epoch: 1, cards: [card(alice)] });
  const h = BPQ.inspect(e1.grant), C = h.coreBytes.length, K = h.keysBytes.length;
  const flip = (i, change = b => b ^ 1) => { const t = Uint8Array.from(e1.grant); t[i] = change(t[i]); return t; };
  // Swap one base64url character for another valid one, so only the value changes.
  const otherChar = b => (b === 0x41 ? 0x42 : 0x41);
  const inCore = 12 + Buffer.from(h.coreBytes).indexOf('"oid":"') + 10;
  const inSlot = 12 + C + 4 + Buffer.from(h.keysBytes).indexOf('"ct":"') + 10;
  const cases = [
    ['core oid', flip(inCore, otherChar), 'grant-not-openable'],
    ['slot ct', flip(inSlot, otherChar), 'grant-not-openable'],
    ['meta', flip(12 + C + 4 + K + 4 + 3), 'grant-integrity'],
    ['body', flip(h.bodyOffset + 3), 'grant-integrity'],
    ['seal record', flip(e1.grant.length - 1), 'grant-owner-signature'],
    ['appended byte', Uint8Array.from([...e1.grant, 0]), 'grant-integrity'],
    ['truncated', e1.grant.subarray(0, e1.grant.length - 1), 'grant-integrity'],
  ];
  for (const [where, tampered, expected] of cases) {
    await assert.rejects(openGrant(tampered, as(alice)), code(expected), where);
  }
  assert.equal((await openGrant(e1.grant, as(alice))).epoch, 1); // control: the untouched grant still opens
});

test('a member who unwraps the key cannot extend the signed grant to an outsider', async () => {
  const e1 = await newEpoch({ owner, ...bind, epoch: 1, cards: [card(alice)] });
  const h = BPQ.inspect(e1.grant), C = h.coreBytes.length, K = h.keysBytes.length;
  const oid = BPQ.unb64u(h.core.oid), info = 'bpq1/wrap/x-wing';
  const kw = ss => Buffer.from(hkdfSync('sha256', ss, oid, info, 32));
  const slot = h.slots[0], unwrap = createDecipheriv('aes-256-gcm', kw(alice.kem.decapsulate(BPQ.unb64u(slot.ct))), Buffer.alloc(12));
  unwrap.setAAD(h.aad); const w = BPQ.unb64u(slot.w); unwrap.setAuthTag(w.subarray(32));
  const fileKey = Buffer.concat([unwrap.update(w.subarray(0, 32)), unwrap.final()]);
  const enc = globalThis.BPQ_LIB.xwing.encapsulate(outsider.kem.publicKey);
  const wrap = createCipheriv('aes-256-gcm', kw(enc.sharedSecret || enc.sharedKey), Buffer.alloc(12)); wrap.setAAD(h.aad);
  const extra = { to: 'x-wing', ct: BPQ.b64u(enc.cipherText),
    w: BPQ.b64u(Buffer.concat([wrap.update(fileKey), wrap.final(), wrap.getAuthTag()])) };
  const rebuild = slots => {
    const keys = Buffer.from(JSON.stringify(slots));
    return new Uint8Array(Buffer.concat([e1.grant.subarray(0, 12 + C), u32(keys.length), keys, e1.grant.subarray(12 + C + 4 + K)]));
  };
  // Control: the same rebuild with the original slot list is the original grant.
  assert.deepEqual(rebuild(h.slots), e1.grant);
  const extended = rebuild([...h.slots, extra]);
  const raw = await BPQ.open(extended, { kem: outsider });
  assert.deepEqual(raw.bytes, e1.key); assert.equal(raw.sealedBy.ok, false); // the slot works; the signature does not
  await assert.rejects(openGrant(extended, as(outsider)), code('grant-owner-signature'));
  await assert.rejects(openGrant(extended, as(alice)), code('grant-owner-signature'));
});

test('removing a member re-keys to epoch n+1, wrapped only to the members who remain', async () => {
  const e1 = await newEpoch({ owner, ...bind, epoch: 1, cards: [alice, bob].map(card) });
  const e2 = await rekey(e1, { owner, ...bind, remove: [bob.id] });
  assert.equal(e2.epoch, 2); assert.notDeepEqual(e2.key, e1.key);
  assert.equal(BPQ.inspect(e2.grant).slots.length, 1);
  const g2 = await openGrant(e2.grant, as(alice));
  assert.equal(g2.epoch, 2); assert.deepEqual(g2.key, e2.key); assert.deepEqual(g2.recipients, [alice.id]);
  await assert.rejects(openGrant(e2.grant, as(bob)), code('grant-not-openable'));
  // Revocation is prospective: the epoch-1 grant bob already holds still opens.
  assert.deepEqual((await openGrant(e1.grant, as(bob))).key, e1.key);
  await assert.rejects(rekey(e2, { owner, ...bind, remove: [bob.id] }), code('not-a-recipient'));
  await assert.rejects(rekey(e2, { owner, ...bind, remove: [alice.id] }), code('invalid-recipients'));
});

const checkpointRecord = async (f, pin) => JSON.parse(JSON.parse(await readFile(path.join(f.root, pin.ref.address))).content);

test('snapshots record their epoch; a removed member keeps epoch n but cannot read epoch n+1', async t => {
  const f = await fixture(); t.after(() => f.close());
  const b = { policyId: f.config.policyId, channel: f.channel };
  const ring = async (keys, ...grants) => {
    const r = new EpochKeyring();
    for (const grant of grants) { const g = await openGrant(grant, as(keys, b)); r.add(g.epoch, g.key); }
    return r;
  };
  const e1 = await newEpoch({ owner, ...b, epoch: 1, cards: [gateway, alice, bob].map(card) });
  const gw = await ring(gateway, e1.grant);
  const writer = f.create({ key: undefined, keyring: gw });
  await writer.publish(getPublicKey(f.alice), f.message(f.alice, 'before removal'));
  const pin1 = writer.pin;
  assert.equal((await checkpointRecord(f, pin1)).version, 2); assert.equal((await checkpointRecord(f, pin1)).epoch, 1);
  const bobRing = await ring(bob, e1.grant);
  const bobReader = f.create({ key: undefined, keyring: bobRing, writer: undefined });
  await bobReader.restore(pin1); assert.equal(bobReader.epoch, 1);

  const e2 = await rekey(e1, { owner, ...b, remove: [bob.id] });
  const g2 = await openGrant(e2.grant, as(gateway, b)); gw.add(g2.epoch, g2.key);
  await assert.rejects(openGrant(e2.grant, as(bob, b)), code('grant-not-openable'));
  await writer.publish(getPublicKey(f.alice), f.message(f.alice, 'after removal'));
  const pin2 = writer.pin;
  assert.equal(writer.epoch, 2); assert.equal((await checkpointRecord(f, pin2)).epoch, 2);

  await assert.rejects(bobReader.restore(pin2), code('epoch-key-unavailable'));
  assert.deepEqual(bobReader.pin, pin1); assert.equal(bobReader.query(getPublicKey(f.bob), [{ '#h': [f.channel] }]).length, 1);
  // Old epochs stay readable to whoever held them: a cold restore of pin1 still works.
  const bobCold = f.create({ key: undefined, keyring: bobRing, writer: undefined });
  await bobCold.restore(pin1); assert.equal(bobCold.query(getPublicKey(f.bob), [{ '#h': [f.channel] }]).length, 1);

  const aliceReader = f.create({ key: undefined, keyring: await ring(alice, e1.grant, e2.grant), writer: undefined });
  await aliceReader.restore(pin1); await aliceReader.restore(pin2);
  assert.equal(aliceReader.epoch, 2); assert.equal(aliceReader.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]).length, 2);
});

test('v1 single-key checkpoints are unchanged; key plus keyring reads v1 history and continues at v2', async t => {
  const f = await fixture(); t.after(() => f.close());
  const legacy = f.create();
  await legacy.publish(getPublicKey(f.alice), f.message(f.alice, 'v1 message'));
  const pin1 = legacy.pin, v1 = await checkpointRecord(f, pin1);
  assert.deepEqual(Object.keys(v1), ['version', 'policy_id', 'sequence', 'parent', 'event_count', 'data']);
  assert.equal(v1.version, 1); assert.equal(legacy.epoch, 0);

  const keyring = new EpochKeyring().add(1, randomBytes(32));
  const upgraded = f.create({ keyring });
  await upgraded.restore(pin1);
  await upgraded.publish(getPublicKey(f.bob), f.message(f.bob, 'v2 message'));
  const pin2 = upgraded.pin;
  assert.equal((await checkpointRecord(f, pin2)).version, 2); assert.equal(upgraded.epoch, 1);

  const keyOnly = f.create({ writer: undefined });
  await keyOnly.restore(pin1);
  await assert.rejects(keyOnly.restore(pin2), code('epoch-key-unavailable'));
  await assert.rejects(f.create({ key: undefined, keyring, writer: undefined }).restore(pin1), code('channel-key-unavailable'));
  const both = f.create({ keyring, writer: undefined });
  await both.restore(pin1); await both.restore(pin2);
  assert.equal(both.query(getPublicKey(f.alice), [{ '#h': [f.channel] }]).length, 2);

  assert.throws(() => keyring.add(1, randomBytes(32)), code('epoch-key-conflict'));
  assert.throws(() => f.create({ key: undefined }), code('invalid-channel-key'));
  assert.throws(() => f.create({ keyring: { latest: 1, get: () => randomBytes(32) } }), code('invalid-keyring'));
  const files = await readdir(f.root);
  await assert.rejects(f.create({ key: undefined, keyring: new EpochKeyring() }).publish(getPublicKey(f.alice),
    f.message(f.alice)), code('epoch-key-unavailable'));
  assert.deepEqual(await readdir(f.root), files);
});

test('a follower refuses a successor sealed under an older epoch; the same successor at the current epoch is accepted', async t => {
  const f = await fixture(); t.after(() => f.close());
  const keyring = new EpochKeyring().add(1, randomBytes(32)).add(2, randomBytes(32));
  const writer = f.create({ key: undefined, keyring });
  await writer.publish(getPublicKey(f.alice), f.message(f.alice, 'sealed under epoch 2'));
  const pin = writer.pin;
  // Independent AES-GCM over the documented v2 AAD; the writer key is a test value.
  const aad = epoch => Buffer.from(`bnr-channel-snapshot-v2:${f.config.policyId}:${epoch}`);
  async function successor(epoch) {
    const prev = await checkpointRecord(f, pin), sealed = await readFile(path.join(f.root, prev.data.address));
    const d = createDecipheriv('aes-256-gcm', keyring.get(2), sealed.subarray(0, 12));
    d.setAAD(aad(2)); d.setAuthTag(sealed.subarray(-16));
    const snapshot = JSON.parse(Buffer.concat([d.update(sealed.subarray(12, -16)), d.final()]));
    snapshot.sequence = pin.sequence + 1;
    const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', keyring.get(epoch), iv); c.setAAD(aad(epoch));
    const blob = Buffer.concat([iv, c.update(encode(snapshot)), c.final(), c.getAuthTag()]);
    const data = { address: await f.config.store.put(blob), sha256: hash(blob), size: blob.length };
    const cp = signed(f.writer, 30078, [['d', 'bnr-channel-checkpoint-v1']], JSON.stringify({ version: 2,
      policy_id: pin.policy_id, sequence: snapshot.sequence, parent: pin.id, event_count: snapshot.events.length, epoch, data }));
    const bytes = encode(cp);
    return { id: cp.id, sequence: snapshot.sequence, policy_id: pin.policy_id,
      ref: { address: await f.config.store.put(bytes), sha256: hash(bytes), size: bytes.length } };
  }
  const reader = f.create({ key: undefined, keyring, writer: undefined });
  await reader.restore(pin); assert.equal(reader.epoch, 2);
  await assert.rejects(reader.restore(await successor(1)), code('epoch-rollback'));
  assert.deepEqual(reader.pin, pin);
  await reader.restore(await successor(2));
  assert.equal(reader.pin.sequence, pin.sequence + 1); assert.equal(reader.epoch, 2);
});
