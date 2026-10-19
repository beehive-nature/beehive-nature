import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './fixtures.mjs';
import { canonicalDocument, bytesDigest, commitment } from './contract.mjs';
import { candidate, bootstrap, competing, memoryRail, block, blockId, chain, hiveOrdering, privacy } from './storage-fixtures.mjs';
import { CheckpointStore } from './checkpoint.mjs';
import { publishBundle, retrieveBundle, reconcilePublication, notice, descriptor, retrieve } from './storage.mjs';
import { hiveOperation, syncHiveBlock } from './hive.mjs';
import { directRequest, receiveNotice } from './x0x.mjs';
import { restoreSnapshot } from './package.mjs';
import { mkdirSync } from 'node:fs';
import { main as storageCli } from './storage-cli.mjs';

function setup(t, f = fixture(), ordering) {
  const dir = mkdtempSync(join(tmpdir(), 'repository-storage-')), path = join(dir, 'replica.sqlite'), pin = bootstrap(f, ordering);
  const handles = [], open = () => { const s = new CheckpointStore(path, pin); handles.push(s); return s; };
  t.after(() => { for (const s of handles) { try { s.close(); } catch {} } rmSync(dir, { recursive: true, force: true }); });
  return { f, dir, path, pin, open, store: open() };
}
const publish = (s, f, rails) => publishBundle({ store: s, state: f.state, trustedStateDigest: f.trustedStateDigest, candidate: candidate(f), payloads: f.payloads, rails, privacy });
const rejects = (fn, code) => assert.rejects(fn, e => e.code === code);

test('independent replica restores exact Git bytes from both rail contracts without GitHub', async t => {
  const a = setup(t), b = setup(t), rails = [memoryRail('ant'), memoryRail('ar')];
  const published = await publish(a.store, a.f, rails);
  const loaded = await retrieveBundle(published.bundle, { store: b.store, rails, maxBytes: 1_000_000, privacy });
  const result = b.store.applyLocal({ ...loaded, expected: b.f.trustedStateDigest });
  assert.equal(result.accepted, true); assert.equal(b.open().current().digest, result.next_state_digest);
  const pkg = join(b.dir, 'package'); mkdirSync(join(pkg, 'objects'), { recursive: true });
  writeFileSync(join(pkg, 'manifest.json'), canonicalDocument(loaded.candidate.manifest));
  for (const [id, bytes] of loaded.payloads) writeFileSync(join(pkg, 'objects', id.slice(7)), bytes);
  const restored = restoreSnapshot(pkg, join(b.dir, 'restored.git'));
  assert.equal(restored.commit, a.f.manifest.source.commit); assert.equal(restored.tree, a.f.manifest.source.tree);
  assert.equal(spawnSync('git', ['-C', restored.directory, 'remote'], { encoding: 'utf8' }).stdout, '');
  assert.equal(rails[0].puts, a.f.payloads.size + 1);
});

test('publication deduplicates across reopen but reads every replica again', async t => {
  const s = setup(t), rail = memoryRail(); await publish(s.store, s.f, [rail]); const puts = rail.puts, gets = rail.gets;
  await publish(s.open(), s.f, [rail]); assert.equal(rail.puts, puts); assert.equal(rail.gets, gets * 2);
});

test('unknown put stays reserved across restart, then exact readback permits recovery', async t => {
  const s = setup(t), rail = memoryRail(), put = rail.put; let address;
  rail.put = async b => { address = await put(b); throw new Error('response lost after store'); };
  await assert.rejects(() => publish(s.store, s.f, [rail]), /response lost/);
  const fresh = s.open(); await rejects(() => publish(fresh, s.f, [rail]), 'PUBLICATION_UNKNOWN'); assert.equal(rail.puts, 1);
  const id = 'sha256:' + address;
  await reconcilePublication({ store: fresh, digest: id, rail, location: { scheme: 'ant', address } });
  rail.put = put; await publish(fresh, s.f, [rail]); assert.equal(rail.puts, s.f.payloads.size + 1);
});

test('invalid signature and missing wallet writer produce no put or payment', async t => {
  const s = setup(t), rail = memoryRail(); s.f.signatures[0].signature.b64u = 'A'.repeat(4400);
  await rejects(() => publish(s.store, s.f, [rail]), 'SIGNATURE'); assert.equal(rail.puts, 0);
  await rejects(() => publish(s.store, fixture(), [{ ...rail, put: undefined }]), 'USER_FUNDED_WRITER_REQUIRED'); assert.equal(rail.puts, 0);
});

test('corrupt replica fails over, missing bytes and caller budget fail closed', async t => {
  const s = setup(t), bytes = Buffer.from('verified bytes'), rail = memoryRail('ar'), good = await rail.put(bytes);
  const p = { ...descriptor(bytes), locations: [{ scheme: 'ar', address: 'a'.repeat(43) }, { scheme: 'ar', address: good }] };
  rail.data.set('a'.repeat(43), Buffer.from('corrupt bytes'));
  assert.deepEqual(await retrieve(p, { store: s.store, rails: [rail], maxBytes: 100 }), bytes);
  await rejects(() => retrieve(p, { store: s.store, rails: [rail], maxBytes: 1 }), 'RESOURCE_LIMIT');
  const missing = { ...p, digest: bytesDigest(Buffer.from('missing')) };
  await rejects(() => retrieve(missing, { store: s.store, rails: [rail], maxBytes: 100 }), 'STORAGE_UNAVAILABLE');
});

test('corrupt local bytes and a changed bootstrap never reset trust', t => {
  const s = setup(t), id = s.store.put(Buffer.from('original'));
  const db = new DatabaseSync(s.path); db.prepare('UPDATE objects SET data=? WHERE digest=?').run(Buffer.from('changed'), id); db.close();
  assert.throws(() => s.open().get(id), e => e.code === 'STORAGE_CORRUPT');
  const changed = structuredClone(s.pin); changed.state.sequence = 1; changed.state.last_proposal = bytesDigest(Buffer.from('other')); changed.trusted_state_digest = commitment('state', changed.state);
  assert.throws(() => new CheckpointStore(s.path, changed), e => e.code === 'BOOTSTRAP_MISMATCH');
  assert.equal(s.store.current().digest, s.f.trustedStateDigest);
});

function childInput(s, f, name) {
  const path = join(s.dir, name); writeFileSync(path, canonicalDocument({ bootstrap: s.pin, candidate: candidate(f), payloads: [...f.payloads].map(([k, b]) => [k, Buffer.from(b).toString('base64')]) })); return path;
}
const childFile = fileURLToPath(new URL('./checkpoint-child.mjs', import.meta.url));
test('two independent processes race eligible proposals: one checkpoint wins and replay loses', async t => {
  const s = setup(t); const inputs = [childInput(s, s.f, 'a.json'), childInput(s, competing(), 'b.json')];
  const children = inputs.map(input => fork(childFile, [s.path, input, 'race'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true }));
  t.after(() => children.forEach(c => c.kill()));
  const outputs = children.map(c => new Promise((resolve, reject) => { let out = '', err = ''; c.stdout.on('data', b => out += b); c.stderr.on('data', b => err += b); c.on('error', reject); c.on('exit', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))); }));
  await Promise.all(children.map(c => new Promise(r => c.once('message', r)))); children.forEach(c => c.send('go'));
  const results = await Promise.all(outputs); assert.equal(results.filter(r => r.accepted).length, 1); assert.equal(results.find(r => !r.accepted).code, 'CAS_CONFLICT');
  assert.equal(s.open().current().state.sequence, 1); assert.equal(s.store.decisions().length, 1);
  assert.throws(() => s.store.applyLocal({ candidate: candidate(s.f), payloads: s.f.payloads, expected: s.f.trustedStateDigest }), e => e.code === 'CAS_CONFLICT');
});

for (const mode of ['crash-before', 'crash-after']) test(`${mode}: abrupt process exit recovers the whole transaction or none`, t => {
  const s = setup(t), input = childInput(s, s.f, 'crash.json');
  const r = spawnSync(process.execPath, [childFile, s.path, input, mode], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, mode === 'crash-before' ? 70 : 71, r.stderr);
  const reopened = s.open(), committed = mode === 'crash-after';
  assert.equal(reopened.current().state.sequence, committed ? 1 : 0); assert.equal(reopened.decisions().length, committed ? 1 : 0);
  for (const [id, bytes] of s.f.payloads) assert.deepEqual(reopened.get(id), committed ? bytes : null);
});

async function hiveSetup(t, second = true) {
  const source = setup(t), target = setup(t, source.f, hiveOrdering), rail = memoryRail();
  const f2 = competing(), a = await publish(source.store, source.f, [rail]), b = second ? await publish(source.store, f2, [rail]) : null;
  const n1 = notice({ topic: hiveOrdering.topic, bundle: a.bundle }), n2 = b ? notice({ topic: hiveOrdering.topic, bundle: b.bundle }) : null;
  const ops = [n1, n2].filter(Boolean).map(n => hiveOperation(hiveOrdering.account, n));
  return { ...target, rail, n1, n2, blocks: new Map([[10, block(10)], [11, block(11, ops)]]) };
}
const sync = (h, call = chain(h.blocks)) => syncHiveBlock({ store: h.store, rails: [h.rail], maxBytes: 1_000_000, privacy, call });

test('Hive complete block order chooses the first valid proposal on independent replicas', async t => {
  const h = await hiveSetup(t), other = setup(t, h.f, hiveOrdering);
  const a = await sync(h), b = await syncHiveBlock({ store: other.store, rails: [h.rail], maxBytes: 1_000_000, privacy, call: chain(h.blocks) });
  assert.deepEqual(a.results.map(r => [r.accepted, r.code]), [[true, undefined], [false, 'STALE_STATE']]);
  assert.equal(a.checkpoint.digest, b.checkpoint.digest); assert.equal(h.open().current().cursor.height, 11);
  assert.throws(() => h.store.applyLocal({}), e => e.code === 'ORDERING');
});

test('unavailable earlier proposal blocks the entire Hive checkpoint, then resumes', async t => {
  const h = await hiveSetup(t), address = h.n1.bundle.locations[0].address, bytes = h.rail.data.get(address); h.rail.data.delete(address);
  await rejects(() => sync(h), 'STORAGE_UNAVAILABLE'); assert.equal(h.open().current().cursor.height, 10); assert.equal(h.store.decisions().length, 0);
  h.rail.data.set(address, bytes); assert.equal((await sync(h)).results[0].accepted, true);
});

test('reversible blocks are not applied; RPC disagreement, fork and finality regression refuse', async t => {
  const h = await hiveSetup(t, false);
  assert.equal((await sync(h, chain(h.blocks, 10))).waiting, true);
  await rejects(() => sync(h, chain(h.blocks, 9)), 'FINALITY_REGRESSION');
  const base = chain(h.blocks);
  await rejects(() => sync(h, async (node, method, p) => { const r = await base(node, method, p); if (node.includes('two') && method.endsWith('get_block') && p[0] === 11) r.transactions = []; return r; }), 'BLOCK_SHAPE');
  await rejects(() => sync(h, async (node, method, p) => { const r = await base(node, method, p); if (node.includes('two') && method.endsWith('get_block')) r.block_id = blockId(p[0], 'b'); return r; }), 'ORACLE_DIVERGENCE');
  h.blocks.get(10).block_id = blockId(10, 'c'); await rejects(() => sync(h), 'FINALIZED_FORK');
  assert.equal(h.store.current().state.sequence, 0);
});

test('duplicate RPC operator spellings cannot manufacture agreement', t => {
  const order = structuredClone(hiveOrdering); order.nodes[1] = 'https://one.example.';
  assert.throws(() => setup(t, fixture(), order), e => e.code === 'ORACLES');
});

test('malformed notice is a refusal; empty finalized blocks still advance the cursor', async t => {
  const h = await hiveSetup(t, false); h.blocks.get(11).transactions[0].operations[0][1].json = '{}';
  const r = await sync(h); assert.equal(r.results[0].code, 'NOTICE_MALFORMED'); assert.equal(h.store.current().state.sequence, 0);
  h.blocks.set(12, block(12)); const next = await sync(h, chain(h.blocks, 12)); assert.equal(next.checkpoint.cursor.height, 12);
});

test('x0x notices are discovery only and deduplicate logical content across restart', async t => {
  const h = await hiveSetup(t, false), request = directRequest('peer-id', h.n1), inbound = { logical_id: request.logical_id, payload: request.payload };
  assert.equal(receiveNotice(h.store, 'sender', inbound).fresh, true);
  assert.equal(receiveNotice(h.open(), 'sender', inbound).fresh, false);
  assert.equal(h.store.current().state.sequence, 0); assert.equal(h.store.current().cursor.height, 10);
  assert.throws(() => receiveNotice(h.store, 'sender', { ...inbound, payload: Buffer.from('{}').toString('base64') }), e => e.code === 'TRANSPORT_BINDING');
  assert.throws(() => h.store.receive('sender', request.logical_id, Buffer.from('different')), e => e.code === 'LOGICAL_ID_COLLISION');
});

test('a forged first qualification loses to the next valid ordered proposal', async t => {
  const h = await hiveSetup(t);
  // Publish a byte-committed malformed packet as an adversarial storage peer,
  // bypassing the honest publisher's validation. The ordering replica must
  // still run the real verifier, never trust the publisher's claimed verdict.
  const rootAddress = h.n1.bundle.locations[0].address;
  const root = JSON.parse((await privacy.open(h.rail.data.get(rootAddress))).toString());
  root.candidate.signatures[0].signature.b64u = 'A'.repeat(4400);
  const cipher = await privacy.seal(canonicalDocument(root)), address = await h.rail.put(cipher);
  const n = notice({ topic: hiveOrdering.topic, bundle: { ...descriptor(cipher), locations: [{ scheme: 'ant', address }] } });
  h.blocks.get(11).transactions[0].operations[0] = hiveOperation(hiveOrdering.account, n);
  const result = await sync(h);
  assert.deepEqual(result.results.map(r => [r.accepted, r.code]), [[false, 'SIGNATURE'], [true, undefined]]);
  assert.equal(result.checkpoint.state.head, competing().manifest.source.commit);
});

test('two Hive sync workers cannot commit the same block twice', async t => {
  const h = await hiveSetup(t, false), sibling = h.open();
  const results = await Promise.allSettled([sync(h), syncHiveBlock({ store: sibling, rails: [h.rail], maxBytes: 1_000_000, privacy, call: chain(h.blocks) })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CAS_CONFLICT');
  assert.equal(h.store.decisions().length, 1);
});

test('CLI applies a verified local package and refuses a stale checkpoint on restart', async t => {
  const s = setup(t), pkg = join(s.dir, 'input'); mkdirSync(join(pkg, 'objects'), { recursive: true });
  for (const [id, bytes] of s.f.payloads) writeFileSync(join(pkg, 'objects', id.slice(7)), bytes);
  writeFileSync(join(pkg, 'manifest.json'), canonicalDocument(s.f.manifest));
  const pin = join(s.dir, 'bootstrap.json'), p = join(s.dir, 'packet.json');
  writeFileSync(pin, canonicalDocument(s.pin));
  const { manifest: _manifest, ...body } = candidate(s.f); writeFileSync(p, canonicalDocument({ state: s.f.state, ...body }));
  const args = ['--database', s.path, '--bootstrap', pin];
  const r = await storageCli(['apply', ...args, '--package', pkg, '--packet', p, '--checkpoint', s.f.trustedStateDigest]); assert.equal(r.accepted, true);
  assert.equal((await storageCli(['status', ...args])).digest, r.next_state_digest);
  await rejects(() => storageCli(['apply', ...args, '--package', pkg, '--packet', p, '--checkpoint', s.f.trustedStateDigest]), 'CAS_CONFLICT');
  await rejects(() => storageCli(['fetch', ...args, '--pointer', p, '--readers', p, '--out', join(s.dir, 'never')]), 'RAILS');
});
