// Actual pinned native STARK + BEELOG, real ML-DSA and encrypted storage.
// Test-only local rails/RPC/keys: no chain broadcast, spend or deployed service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, sourceGraph, reseal } from './fixtures.mjs';
import { candidate, privacy, memoryRail, block, chain, hiveOrdering } from './storage-fixtures.mjs';
import { bytesDigest, canonicalDocument, commitment, acceptUpdate } from './contract.mjs';
import { CheckpointStore } from './checkpoint.mjs';
import { repositoryProofEngine } from './proof-engine.mjs';
import { initialBatch, preparePrivateBatch, publishPrivateBatch, retrievePrivateBatch, verifiedPrivateBatch, verifyPrivateBatch, verifyOpaqueReceipt } from './private-batch.mjs';
import { descriptor, reconcilePublication } from './storage.mjs';
import { hiveOperation, syncHiveBlock } from './hive.mjs';
import { directRequest, receiveNotice } from './x0x.mjs';
import { main as storageCli } from './storage-cli.mjs';

assert.ok(process.env.REPOSITORY_PROOF_BIN, 'REPOSITORY_PROOF_BIN must name the built pinned native organ; never skip');
const binary = resolve(process.env.REPOSITORY_PROOF_BIN), engine = repositoryProofEngine({ binary });
const stream = bytesDigest(Buffer.from('TEST-ONLY opaque stream substitute'));
const rejects = (fn, code) => assert.rejects(fn, e => e.code === code);
function updates(f, n = 2, label = 'private') {
  let state = structuredClone(f.state); const out = [];
  for (let i = 0; i < n; i++) {
    const x = fixture(), graph = sourceGraph(state.head, `private source ${label}:${i}\n`);
    x.state = state; x.manifest.source = graph.source; x.payloads = graph.payloads; reseal(x);
    const u = { candidate: candidate(x), payloads: x.payloads }; out.push(u);
    const verdict = acceptUpdate({ ...u.candidate, payloads: u.payloads, state, trustedStateDigest: commitment('state', state) }); assert.equal(verdict.accepted, true);
    state = verdict.next_state;
  } return out;
}
function setup(t, ordering) {
  const f = fixture(), dir = mkdtempSync(join(tmpdir(), 'repository-private-')), batch = initialBatch(stream);
  const bootstrap = { state: f.state, trusted_state_digest: f.trustedStateDigest, ordering: ordering ? { ...ordering, batch } : { mode: 'local-batch-shadow', batch } };
  const handles = [], open = (name = 'source.sqlite') => { const s = new CheckpointStore(join(dir, name), bootstrap); handles.push(s); return s; };
  t.after(() => { for (const h of handles) { try { h.close(); } catch {} } rmSync(dir, { recursive: true, force: true }); });
  return { f, dir, bootstrap, batch, open, manage: h => { handles.push(h); return h; }, source: open(), receiver: open('receiver.sqlite'), rail: memoryRail() };
}
async function prepared(s, list = updates(s.f), store = s.source) {
  return preparePrivateBatch({ store, state: s.f.state, trustedStateDigest: s.f.trustedStateDigest, previous: s.batch.pin, frontier: s.batch.frontier, updates: list, engine, bucket: 8 });
}
async function published(s, list) {
  const plan = await prepared(s, list); const p = await publishPrivateBatch({ plan, store: s.source, rails: [s.rail], privacy });
  const capability = await retrievePrivateBatch(p.bundle, { store: s.receiver, rails: [s.rail], privacy, engine, maxBytes: 1_000_000 });
  return { plan, ...p, capability, contents: verifiedPrivateBatch(capability) };
}
const apply = (s, capability, store = s.receiver) => store.applyPrivateBatch({ capability, expected: s.f.trustedStateDigest, previousBatch: s.batch.pin });

test('private PQ-authorized acceptance and a real hiding proof commit an entire batch atomically', async t => {
  const s = setup(t), p = await published(s); const r = apply(s, p.capability);
  assert.equal(r.accepted, true); assert.equal(r.results.length, 2); assert.equal(r.checkpoint.state.sequence, 2);
  assert.equal(r.checkpoint.batch.pin.epoch, 1); assert.equal(r.checkpoint.batch.pin.head.size, 1);
  assert.equal(s.open('receiver.sqlite').current().digest, r.checkpoint.digest);
  for (const u of p.contents.captured) for (const [id, bytes] of u.payloads) assert.deepEqual(s.receiver.get(id), bytes);
  assert.throws(() => apply(s, p.capability), e => e.code === 'CAS_CONFLICT');
  assert.throws(() => s.receiver.applyPrivateBatch({ capability: p.capability, expected: r.checkpoint.digest, previousBatch: r.checkpoint.batch.pin }), e => e.code === 'STALE_BATCH');
  assert.throws(() => s.receiver.applyLocal({}), e => e.code === 'ORDERING');
  for (const cipher of s.rail.data.values()) {
    assert.equal(globalThis.BPQ.isSealed(cipher), true);
    for (const value of ['private source', s.f.state.repository, s.f.state.ref, s.f.policy.keys[0].public_key]) assert.equal(cipher.includes(Buffer.from(value)), false);
  }
});

test('opaque relation is portable but cannot mint acceptance authority or expose private witness', async t => {
  const s = setup(t), p = await published(s), receipt = p.contents.receipt;
  assert.equal((await verifyOpaqueReceipt({ engine, receipt, previous: s.batch.pin })).valid_relation, true);
  const bytes = canonicalDocument(receipt);
  for (const value of ['private source', s.f.state.repository, s.f.state.ref, s.f.policy.keys[0].public_key, p.contents.document.records[0].salt]) assert.equal(bytes.includes(Buffer.from(value)), false, value);
  assert.throws(() => apply(s, { ...p.capability, verified: true }), e => e.code === 'PRIVATE_VERIFICATION_REQUIRED');
  const wrong = structuredClone(receipt); wrong.proof.root[0] ^= 1; await rejects(() => verifyOpaqueReceipt({ engine, receipt: wrong, previous: s.batch.pin }), 'BATCH_BINDING');
  assert.equal(s.receiver.current().state.sequence, 0);
});

test('the default 32-slot private bucket proves and accepts a one-update batch', async t => {
  const s = setup(t), plan = await preparePrivateBatch({ store: s.source, state: s.f.state, trustedStateDigest: s.f.trustedStateDigest,
    previous: s.batch.pin, frontier: s.batch.frontier, updates: updates(s.f, 1), engine });
  assert.equal(plan.bucket, 32);
  const p = await publishPrivateBatch({ plan, store: s.source, rails: [s.rail], privacy });
  const cap = await retrievePrivateBatch(p.bundle, { store: s.receiver, rails: [s.rail], privacy, engine, maxBytes: 1_000_000 });
  assert.equal(apply(s, cap).checkpoint.state.sequence, 1);
});

test('bad PQ signatures, broken state chains and forged engines fail before any paid put', async t => {
  const s = setup(t), list = updates(s.f); list[1].candidate.signatures[0].signature.b64u = 'A'.repeat(4400);
  await rejects(() => prepared(s, list), 'BATCH_ACCEPTANCE');
  const forked = updates(s.f); forked.reverse(); await rejects(() => prepared(s, forked), 'BATCH_ACCEPTANCE');
  await rejects(() => preparePrivateBatch({ store: s.source, state: s.f.state, trustedStateDigest: s.f.trustedStateDigest, previous: s.batch.pin, frontier: s.batch.frontier, updates: updates(s.f), engine: { run: () => ({ verified: true }) } }), 'PROOF_CONFIG');
  await rejects(() => preparePrivateBatch({ store: s.source, state: s.f.state, trustedStateDigest: s.f.trustedStateDigest, previous: s.batch.pin, frontier: s.batch.frontier, updates: updates(s.f), engine, maxBytes: 1 }), 'RESOURCE_LIMIT');
  assert.equal(s.rail.puts, 0);
});

test('private transcript, context, proof and append evidence substitutions are refused', async t => {
  const s = setup(t), p = await published(s), base = p.contents.document, list = p.contents.captured;
  for (const mutate of [d => d.records[0].next_state = d.records[0].previous_state, d => d.header.context = bytesDigest(Buffer.from('wrong context')),
    d => d.proof.chunks[0] = (d.proof.chunks[0][0] === '0' ? '1' : '0') + d.proof.chunks[0].slice(1), d => d.log.head.root = bytesDigest(Buffer.from('fork')),
    d => d.log.frontier.peaks[0] = bytesDigest(Buffer.from('bad frontier')), d => d.proof.zk_verified = true, d => d.proof.chunks = ['00']]) {
    const document = structuredClone(base); mutate(document); await assert.rejects(() => verifyPrivateBatch({ document, updates: list, engine }));
  }
  assert.equal(s.receiver.current().state.sequence, 0);
});

test('durable plan recovery reuses proof/randomness and never repeats an ambiguous root upload', async t => {
  const s = setup(t), list = updates(s.f), plan = await prepared(s, list), original = s.rail.put; let rootAddress;
  // Shared observations deduplicate between updates; detect the batch root by
  // decrypting the sealed publication, not by assuming a put count.
  s.rail.put = async bytes => { const address = await original(bytes); const plain = await privacy.open(bytes); if (plain.includes(Buffer.from('bnr.repository-private-batch/1'))) { rootAddress = address; throw new Error('root response lost'); } return address; };
  await assert.rejects(() => publishPrivateBatch({ plan, store: s.source, rails: [s.rail], privacy }), /root response lost/);
  const puts = s.rail.puts, reopened = s.open(), recovered = await prepared(s, list, reopened);
  await rejects(() => publishPrivateBatch({ plan: recovered, store: reopened, rails: [s.rail], privacy }), 'PUBLICATION_UNKNOWN'); assert.equal(s.rail.puts, puts);
  await reconcilePublication({ store: reopened, digest: 'sha256:' + rootAddress, rail: s.rail, location: { scheme: 'ant', address: rootAddress } });
  s.rail.put = original; const result = await publishPrivateBatch({ plan: recovered, store: reopened, rails: [s.rail], privacy }); assert.equal(s.rail.puts, puts);
  const c = await retrievePrivateBatch(result.bundle, { store: s.receiver, rails: [s.rail], privacy, engine, maxBytes: 1_000_000 }); assert.equal(apply(s, c).accepted, true);
});

test('a new signed qualification artifact is a distinct plan, while an exact retry is stable', async t => {
  const s = setup(t), list = updates(s.f), first = await prepared(s, list), retry = await prepared(s, list);
  assert.equal(retry.operation, first.operation);
  list[0].candidate.evidence[0].envelope.signed_at_ms = 1;
  const refreshed = await prepared(s, list); assert.notEqual(refreshed.operation, first.operation);
  assert.equal(s.rail.puts, 0, 'new plan preparation still grants no payment capability');
});

test('a second epoch appends through the compact frontier and advances two more private updates', async t => {
  const s = setup(t), first = await published(s); apply(s, first.capability); apply(s, first.capability, s.source);
  const c = s.source.current(), f = { ...s.f, state: c.state }, list = updates(f, 2, 'epoch2');
  const plan = await preparePrivateBatch({ store: s.source, state: c.state, trustedStateDigest: c.digest, previous: c.batch.pin, frontier: c.batch.frontier, updates: list, engine, bucket: 8 });
  const p = await publishPrivateBatch({ plan, store: s.source, rails: [s.rail], privacy });
  const cap = await retrievePrivateBatch(p.bundle, { store: s.receiver, rails: [s.rail], privacy, engine, maxBytes: 1_000_000 });
  const r = s.receiver.applyPrivateBatch({ capability: cap, expected: c.digest, previousBatch: c.batch.pin });
  assert.equal(r.checkpoint.state.sequence, 4); assert.equal(r.checkpoint.batch.pin.epoch, 2); assert.equal(r.checkpoint.batch.pin.head.size, 2);
  const order = { ...hiveOrdering, mode: 'hive-batch-shadow', batch: s.batch };
  const h = s.manage(new CheckpointStore(join(s.dir, 'two-epochs-hive.sqlite'), { ...s.bootstrap, ordering: order }));
  const n = bundle => ({ schema: 'bnr.repository-checkpoint/3', topic: order.topic, bundle });
  const blocks = new Map([[10, block(10)], [11, block(11, [hiveOperation(order.account, n(first.bundle)), hiveOperation(order.account, n(p.bundle))])]]);
  const address = p.bundle.locations[0].address, bytes = s.rail.data.get(address); s.rail.data.delete(address);
  const sync = () => syncHiveBlock({ store: h, rails: [s.rail], maxBytes: 1_000_000, privacy, engine, call: chain(blocks) });
  await rejects(sync, 'STORAGE_UNAVAILABLE'); assert.equal(h.current().state.sequence, 0); assert.equal(h.current().batch.pin.epoch, 0); assert.equal(h.current().cursor.height, 10);
  s.rail.data.set(address, bytes);
  await rejects(() => syncHiveBlock({ store: h, rails: [s.rail], maxBytes: 1_000_000, privacy, engine, maxBatchOperations: 1, call: chain(blocks) }), 'RESOURCE_LIMIT');
  assert.equal(h.current().state.sequence, 0); assert.equal(h.current().cursor.height, 10);
  await rejects(() => syncHiveBlock({ store: h, rails: [s.rail], maxBytes: first.contents.bytes, privacy, engine, call: chain(blocks) }), 'RESOURCE_LIMIT');
  assert.equal(h.current().state.sequence, 0); assert.equal(h.current().cursor.height, 10);
  const both = await sync(); assert.equal(both.checkpoint.state.sequence, 4); assert.equal(both.checkpoint.batch.pin.epoch, 2); assert.equal(both.checkpoint.cursor.height, 11);
});

test('Hive orders complete private batches; a later competitor cannot overtake unavailable earlier bytes', async t => {
  const s = setup(t), a = await published(s, updates(s.f, 2, 'a')), b = await published(s, updates(s.f, 2, 'b'));
  const order = { ...hiveOrdering, mode: 'hive-batch-shadow' }, h = s.manage(new CheckpointStore(join(s.dir, 'hive.sqlite'), { ...s.bootstrap, ordering: { ...order, batch: s.batch } }));
  const n = p => ({ schema: 'bnr.repository-checkpoint/3', topic: order.topic, bundle: p.bundle });
  const blocks = new Map([[10, block(10)], [11, block(11, [hiveOperation(order.account, n(a)), hiveOperation(order.account, n(b))])]]);
  const missing = a.bundle.locations[0].address, saved = s.rail.data.get(missing); s.rail.data.delete(missing);
  const sync = () => syncHiveBlock({ store: h, rails: [s.rail], maxBytes: 1_000_000, privacy, engine, call: chain(blocks) });
  await rejects(sync, 'STORAGE_UNAVAILABLE'); assert.equal(h.current().cursor.height, 10); assert.equal(h.current().state.sequence, 0);
  s.rail.data.set(missing, saved); const result = await sync(); assert.deepEqual(result.results.map(r => [r.accepted, r.code]), [[true, undefined], [false, 'STALE_BATCH']]);
  assert.equal(result.checkpoint.state.sequence, 2); assert.equal(result.checkpoint.batch.pin.epoch, 1);
  const request = directRequest('peer', n(a)); assert.equal(receiveNotice(h, 'sender', { logical_id: request.logical_id, payload: request.payload }).fresh, true);
  assert.equal(h.current().batch.pin.epoch, 1, 'discovery cannot advance ordering');
  // A storage adversary bypasses honest publication with a forged first proof.
  // Its definite refusal must not prevent the next valid ordered batch.
  const adversarial = structuredClone(a.contents.document); adversarial.proof.chunks[0] = 'ff' + adversarial.proof.chunks[0].slice(2);
  const ciphertext = await privacy.seal(canonicalDocument(adversarial)), address = await s.rail.put(ciphertext);
  const bad = { bundle: { ...descriptor(ciphertext), locations: [{ scheme: 'ant', address }] } };
  const other = s.manage(new CheckpointStore(join(s.dir, 'hive-adversarial.sqlite'), { ...s.bootstrap, ordering: { ...order, batch: s.batch } }));
  blocks.get(11).transactions[0].operations[0] = hiveOperation(order.account, n(bad));
  const settled = await syncHiveBlock({ store: other, rails: [s.rail], maxBytes: 1_000_000, privacy, engine, call: chain(blocks) });
  assert.deepEqual(settled.results.map(r => [r.accepted, r.code]), [[false, 'PROOF_REFUSED'], [true, undefined]]);
  assert.equal(settled.checkpoint.digest, commitment('state', b.contents.next));
});

test('CLI consumes local encrypted bytes, applies the private batch and verifies an opaque receipt', async t => {
  const s = setup(t), p = await published(s), pinFile = join(s.dir, 'pin.json'), bootstrapFile = join(s.dir, 'bootstrap.json'), readersFile = join(s.dir, 'readers.json'), pointerFile = join(s.dir, 'pointer.json');
  for (const [path, v] of [[pinFile, s.batch.pin], [bootstrapFile, s.bootstrap], [readersFile, []], [pointerFile, p.bundle]]) writeFileSync(path, canonicalDocument(v));
  const envName = 'REPOSITORY_PRIVATE_TEST_VAULT', prior = process.env[envName];
  process.env[envName] = Buffer.alloc(32, 22).toString('base64url'); // TEST-ONLY published fixture
  t.after(() => { if (prior === undefined) delete process.env[envName]; else process.env[envName] = prior; });
  const args = ['--database', join(s.dir, 'receiver.sqlite'), '--bootstrap', bootstrapFile, '--readers', readersFile, '--pointer', pointerFile, '--vault-env', envName, '--proof-binary', binary];
  const r = await storageCli(['batch-apply', ...args, '--checkpoint', s.f.trustedStateDigest, '--previous-batch', pinFile]); assert.equal(r.accepted, true);
  const receipt = await storageCli(['batch-receipt', ...args]), receiptFile = join(s.dir, 'receipt.json'); writeFileSync(receiptFile, canonicalDocument(receipt));
  const checked = await storageCli(['batch-verify', '--receipt', receiptFile, '--previous-batch', pinFile, '--proof-binary', binary]);
  assert.equal(checked.valid_relation, true); assert.equal('accepted' in checked, false);
  await rejects(() => storageCli(['batch-apply', ...args, '--checkpoint', s.f.trustedStateDigest, '--previous-batch', pinFile]), 'CAS_CONFLICT');
});

const childFile = fileURLToPath(new URL('./private-batch-child.mjs', import.meta.url));
function childInput(s, p, file) {
  const input = join(s.dir, file); writeFileSync(input, canonicalDocument({ bootstrap: s.bootstrap, document: p.contents.document,
    updates: p.contents.captured.map(u => ({ candidate: u.candidate, payloads: [...u.payloads].map(([k, b]) => [k, b.toString('base64')]) })) })); return input;
}
for (const mode of ['crash-before', 'crash-after']) test(`private batch ${mode}: receipt, objects and both checkpoints recover together`, async t => {
  const s = setup(t), p = await published(s), input = childInput(s, p, 'crash.json');
  const r = spawnSync(process.execPath, [childFile, join(s.dir, 'receiver.sqlite'), input, binary, mode], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, mode === 'crash-before' ? 70 : 71, r.stderr); const c = s.open('receiver.sqlite').current(), committed = mode === 'crash-after';
  assert.equal(c.state.sequence, committed ? 2 : 0); assert.equal(c.batch.pin.epoch, committed ? 1 : 0);
  assert.equal(s.receiver.decisions().length, committed ? 2 : 0);
  for (const u of p.contents.captured) for (const [id, bytes] of u.payloads) assert.deepEqual(s.receiver.get(id), committed ? bytes : null);
});

test('two OS processes race private batches; only one complete checkpoint wins', async t => {
  const s = setup(t), a = await published(s, updates(s.f, 2, 'a')), b = await published(s, updates(s.f, 2, 'b'));
  const inputs = [childInput(s, a, 'a.json'), childInput(s, b, 'b.json')];
  const children = inputs.map(input => fork(childFile, [join(s.dir, 'receiver.sqlite'), input, binary, 'race'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true })); t.after(() => children.forEach(c => c.kill()));
  const results = children.map(c => new Promise((resolve, reject) => { let out = '', err = ''; c.stdout.on('data', b => out += b); c.stderr.on('data', b => err += b); c.on('error', reject); c.on('exit', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))); }));
  await Promise.all(children.map(c => new Promise(r => c.once('message', r)))); children.forEach(c => c.send('go'));
  const settled = await Promise.all(results); assert.equal(settled.filter(r => r.accepted).length, 1); assert.equal(settled.find(r => !r.accepted).code, 'CAS_CONFLICT');
  const c = s.receiver.current(); assert.equal(c.state.sequence, 2); assert.equal(c.batch.pin.epoch, 1); assert.equal(s.receiver.decisions().length, 2);
});
