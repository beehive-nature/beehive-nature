import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryPrivacy } from './privacy.mjs';
import { publishBundle, retrieveBundle, notice } from './storage.mjs';
import { CheckpointStore } from './checkpoint.mjs';
import { bootstrap, candidate, memoryRail, privacy, hiveOrdering } from './storage-fixtures.mjs';
import { fixture } from './fixtures.mjs';
import { canonicalDocument } from './contract.mjs';
import { directRequest } from './x0x.mjs';
const B = globalThis.BPQ;

test('stored bytes and x0x/Hive notices hide source, evidence, identity keys and ref names', async t => {
  const f = fixture(), source = new CheckpointStore(':memory:', bootstrap(f)), target = new CheckpointStore(':memory:', bootstrap(f));
  t.after(() => { source.close(); target.close(); });
  const rail = memoryRail(); const pub = await publishBundle({ store: source, state: f.state, trustedStateDigest: f.trustedStateDigest, candidate: candidate(f), payloads: f.payloads, rails: [rail], privacy });
  const n = notice({ topic: hiveOrdering.topic, bundle: pub.bundle }), request = directRequest('peer', n);
  const publicBytes = [Buffer.from(request.payload, 'base64'), ...rail.data.values()];
  for (const bytes of rail.data.values()) assert.equal(B.isSealed(bytes), true);
  for (const value of ['portable source', 'TEST-ONLY executor', 'urn:bnr:test-repository', 'refs/heads/main', f.policy.keys[0].public_key])
    assert.equal(publicBytes.some(b => b.includes(Buffer.from(value))), false, value);
  const loaded = await retrieveBundle(pub.bundle, { store: target, rails: [rail], maxBytes: 1_000_000, privacy });
  assert.deepEqual(loaded.candidate, candidate(f));
});

test('private publication refuses absent or forged privacy profiles before any rail call', async t => {
  const f = fixture(), store = new CheckpointStore(':memory:', bootstrap(f)), rail = memoryRail(); t.after(() => store.close());
  const input = { store, state: f.state, trustedStateDigest: f.trustedStateDigest, candidate: candidate(f), payloads: f.payloads, rails: [rail] };
  for (const p of [undefined, { profile: 'bpq1-padded/1', seal: b => b, open: b => b }])
    await assert.rejects(() => publishBundle({ ...input, privacy: p }), e => e.code === 'PRIVATE_REPOSITORY_REQUIRED');
  assert.equal(rail.puts, 0);
});

test('existing hybrid X-Wing recipients open padded repository bytes; outsiders and tampering refuse', async t => {
  const alice = B.keys(new Uint8Array(32).fill(71), 'pq:repository-test-alice');
  const bob = B.keys(new Uint8Array(32).fill(72), 'pq:repository-test-bob');
  t.after(() => { alice.wipe(); bob.wipe(); });
  const sharing = repositoryPrivacy({ recipients: [B.card(alice)], credentials: { kem: alice.kem } });
  const outside = repositoryPrivacy({ recipients: [B.card(bob)], credentials: { kem: bob.kem } });
  const plain = canonicalDocument({ source: 'private source', evidence: 'private qualification' });
  const sealed = await sharing.seal(plain);
  assert.equal(B.inspect(sealed).core.len, 4096);
  assert.deepEqual(await sharing.open(sealed), plain);
  await assert.rejects(() => outside.open(sealed));
  const bad = Buffer.from(sealed); bad[B.inspect(bad).bodyOffset + 10] ^= 1; await assert.rejects(() => sharing.open(bad));
  await assert.rejects(() => sharing.open(plain), e => e.code === 'PLAINTEXT_STORAGE_REFUSED');
  assert.notDeepEqual(await sharing.seal(plain), sealed, 'fresh encryption is randomized; persistent reuse belongs to the local cache');
});

test('ZK labels cannot replace signed repository qualification evidence', async t => {
  const f = fixture(), store = new CheckpointStore(':memory:', bootstrap(f)), rail = memoryRail(); t.after(() => store.close());
  f.evidence[0].statement.zk_verified = true;
  await assert.rejects(() => publishBundle({ store, state: f.state, trustedStateDigest: f.trustedStateDigest, candidate: candidate(f), payloads: f.payloads, rails: [rail], privacy }), e => e.code === 'SHAPE');
  assert.equal(rail.puts, 0);
});
