/* vending-cert.test.mjs — the page's certificate composer is held to the tool's.
   Same inputs into surfaces/vending-cert.js (browser port) and
   contracts/vending/tool/cert.mjs (the receipted tool) must give the same
   canonical bytes and the same hash; the a1 genesis must verify under
   tool/a1.mjs. Offline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const sandbox = { self: undefined, crypto: webcrypto, TextEncoder, require: (await import('node:module')).createRequire(import.meta.url) };
vm.runInNewContext(readFileSync(ROOT + '/surfaces/vending-cert.js', 'utf8') + '\nthis.VendingCert = VendingCert;', sandbox);
const P = sandbox.VendingCert;
const T = await import('../contracts/vending/tool/cert.mjs');
const A1 = await import('../contracts/vending/tool/a1.mjs');

const inputs = { agentName: 'parity test', house: 'a', tongue: 'latvian', template: 'bqueenbee-genesis-1',
  memberKeyHex: 'ab'.repeat(32), memberAccount: 'bnrapolltest', mintedIso: '2026-09-26T00:00:00.000Z',
  storeBinding: { store: 'autonomi', binding: 'x', a1_genesis: { rev: 0, sha256: 'cd'.repeat(32), ts: '2026-09-26T00:00:00.000Z' }, funded_write_status: 'gated' } };

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

test('the page\'s a1 genesis verifies under the tool\'s a1 verifier', async () => {
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const g = await P.genesisRevision({ agent: 'parity test', body: { note: 'n' }, memberPrivateKey: kp.privateKey, ts: '2026-09-26T00:00:00.000Z' });
  assert.equal(await P.hashRevision(g), A1.hashRevision(g));
  const r = await A1.verifyChain([g], kp.publicKey);
  assert.equal(r.ok, true, JSON.stringify(r));
});
