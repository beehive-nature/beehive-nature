/* vending-cert.test.mjs — the page's certificate composer is held to the tool's.
   Same inputs into surfaces/vending-cert.js (browser port) and
   contracts/vending/tool/cert.mjs (the receipted tool) must give the same
   canonical bytes and the same hash; the a1 genesis (v1 and v2) must verify
   under tool/a1.mjs, and the store binding must be the tool's. Offline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const require = createRequire(import.meta.url);
require(ROOT + '/surfaces/onboarding/vendor/bpq-lib.js');   // the page loads these two as plain <script> tags
require(ROOT + '/surfaces/bpq.js');
const T = await import('../contracts/vending/tool/cert.mjs');
const A1 = await import('../contracts/vending/tool/a1.mjs');
const pageIn = (extra) => {
  const sandbox = { self: undefined, crypto: webcrypto, TextEncoder, require, ...extra };
  vm.runInNewContext(readFileSync(ROOT + '/surfaces/vending-cert.js', 'utf8') + '\nthis.VendingCert = VendingCert;', sandbox);
  return sandbox.VendingCert;
};
const P = pageIn({ BPQ: globalThis.BPQ });

const inputs = { agentName: 'parity test', house: 'a', tongue: 'latvian', template: 'bqueenbee-genesis-1',
  memberKeyHex: 'ab'.repeat(32), memberAccount: 'bnrapolltest', mintedIso: '2026-09-26T00:00:00.000Z',
  storeBinding: { store: 'autonomi', binding: 'x', a1_genesis: { rev: 0, sha256: 'cd'.repeat(32), ts: '2026-09-26T00:00:00.000Z' }, funded_write_status: 'gated' } };

const seed = createHash('sha256').update('vending-cert parity member seed', 'utf8').digest();
const memberPriv = await A1.importMemberSeed(seed);
const memberPub = await A1.importMemberPub(Buffer.from((await webcrypto.subtle.exportKey('jwk', memberPriv)).x, 'base64url'));

test('page and tool compose byte-identical certificates with the same hash', async () => {
  const page = await P.composeCertificate(inputs);
  const tool = T.composeCertificate(inputs);
  assert.equal(P.canonicalJson(page), T.canonicalJson(tool));
  assert.equal(page.hash.value, tool.hash.value);
  assert.equal(await P.contentHash(page), T.contentHash(tool));
  assert.deepEqual(JSON.parse(JSON.stringify(P.certTags({ agentName: 'x', memberKeyHex: 'y' }))), T.certTags({ agentName: 'x', memberKeyHex: 'y', spec: 'SPEC-VENDING-1' }));
  const v = await P.verifyCertificate(page); assert.equal(v.ok, true);
  page.agent.name = 'tampered'; assert.equal((await P.verifyCertificate(page)).ok, false);
});

test('a certificate minted before a1 v2 (v1 recipe text) still hashes to its pinned value and verifies', async () => {
  /* inputs and hash pinned at fe4a88ae2: the store binding of a v1 genesis, the v1 recipe line */
  const g = { v: 1, agent: 'vector', rev: 0, prev: '', body: { note: 'genesis' }, ts: '2026-10-04T00:00:00.000Z', sig_ed25519: 'x' };
  const gh = Buffer.from('tB65Fjldzx5XBhErfw-0sHA1MLQY1Qdx4QoZFx1gLQg', 'base64url').toString('hex');
  const old = T.composeCertificate({ ...inputs, storeBinding: A1.storeBinding(g, gh) });
  old.recipe.layers.autonomi.format = 'a1-log v1: append-only hash-linked revisions, owner-signed; highest valid revision wins; deletable by the member';
  old.hash.value = Buffer.from('IsYHVxR7t3JHuFxzQQgupQLdLRAEGcCZ7zPRoNMSXAU', 'base64url').toString('hex');
  assert.deepEqual(T.verifyCertificate(old), { ok: true, hash: old.hash.value, reason: 'authentic' });
  assert.equal((await P.verifyCertificate(old)).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(P.storeBinding(g, gh))), A1.storeBinding(g, gh), 'the v1 binding is the tool\'s, byte for byte');
});

test('the page\'s a1 genesis verifies under the tool\'s a1 verifier', async () => {
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const g = await P.genesisRevision({ agent: 'parity test', body: { note: 'n' }, memberPrivateKey: kp.privateKey, ts: '2026-09-26T00:00:00.000Z' });
  assert.equal(await P.hashRevision(g), A1.hashRevision(g));
  const r = await A1.verifyChain([g], kp.publicKey);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('the page\'s a1 v2 genesis is the tool\'s format: pinned PQ id, both signatures, the same binding', async () => {
  const agent = 'parity test';
  const pq = P.a1PqKeys(seed, agent);
  assert.equal(pq.id, A1.a1PqKeys(seed, agent).id, 'page and tool derive the same PQ id from the same seed');
  const g = await P.genesisRevisionV2({ agent, body: { note: 'n' }, memberPrivateKey: memberPriv, pqKeys: pq, ts: '2026-10-04T00:00:00.000Z' });
  const gh = await P.hashRevision(g);
  assert.equal(gh, A1.hashRevision(g));
  assert.equal(g.v, 2); assert.equal(g.pq.id, pq.id);
  for (const pins of [{ genesisHash: gh }, { pqId: pq.id }]) {
    const r = await A1.verifyChain([g], memberPub, pins);
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  /* the tool extends the page's genesis, and the chain still resolves to the tool's head */
  const r1 = await A1.appendRevision({ agent, prevRevision: g, body: { note: 'one' }, memberPrivateKey: memberPriv, pqKeys: A1.a1PqKeys(seed, agent), ts: '2026-10-04T00:00:01.000Z' });
  assert.equal((await A1.resolveHead([r1, g], memberPub, { pqId: pq.id })).head, r1);
  const pb = P.storeBinding(g, gh), tb = A1.storeBinding(g, gh);
  assert.deepEqual(JSON.parse(JSON.stringify(pb)), tb);
  assert.equal(pb.a1_genesis.pq_id, pq.id);
  /* the certificate it lands in is page/tool identical too */
  const page = await P.composeCertificate({ ...inputs, storeBinding: pb });
  assert.equal(page.hash.value, T.composeCertificate({ ...inputs, storeBinding: tb }).hash.value);
  assert.match(page.recipe.layers.autonomi.format, /^a1-log v2: /);
  await assert.rejects(P.genesisRevisionV2({ agent: 'another', body: {}, memberPrivateKey: memberPriv, pqKeys: pq }), /derived for context/);
  pq.wipe();
});

test('the page\'s own script stack, in one global like a tab, mints a v2 genesis the tool verifies', async () => {
  /* vending.html loads ans104.js, bpq-lib.js, bpq.js, vending-cert.js as plain scripts; mintInPage
     steps 1-2 are: A.generateKey(), C.a1PqKeys(key.seed, name), C.genesisRevisionV2, C.storeBinding */
  const tab = { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, console };
  tab.self = tab; tab.window = tab; vm.createContext(tab);
  for (const f of ['ans104.js', 'onboarding/vendor/bpq-lib.js', 'bpq.js', 'vending-cert.js'])
    vm.runInContext(readFileSync(ROOT + '/surfaces/' + f, 'utf8'), tab, { filename: f });
  const A = tab.ANS104, C = tab.VendingCert;
  assert.ok(A && tab.BPQ && C, 'the three globals the mint uses are present');
  const key = await A.generateKey();
  const pq = C.a1PqKeys(key.seed, 'tab agent');
  const g = await C.genesisRevisionV2({ agent: 'tab agent', body: { note: 'n' }, memberPrivateKey: key.privateKey, pqKeys: pq });
  pq.wipe();
  const gh = await C.hashRevision(g);
  const r = await A1.verifyChain([JSON.parse(JSON.stringify(g))], key.publicKey, { genesisHash: gh });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(C.storeBinding(g, gh).a1_genesis.pq_id, g.pq.id);
});

test('a page without the PQ library is refused a v2 genesis, never handed a v1 one instead', async () => {
  const bare = pageIn({});
  assert.throws(() => bare.a1PqKeys(seed, 'x'), /post-quantum library .* did not load/);
  await assert.rejects(bare.genesisRevisionV2({ agent: 'x', body: {}, memberPrivateKey: memberPriv, pqKeys: {} }), /post-quantum library .* did not load/);
});
