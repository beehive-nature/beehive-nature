import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { artifactIdentity, signConsent, verifyConsent, TERMS } from './consent.mjs';

const economics = JSON.parse(await readFile(new URL('../../assets/profile-archive/lineage/zblood-storage-economics.json', import.meta.url)));
const engine = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, crypto });
vm.runInContext(await readFile(new URL('../../surfaces/onboarding/bzdid-key.js', import.meta.url), 'utf8'), engine);
const record = () => engine.BZDIDKEY.deriveRecordKey(Uint8Array.from({ length: 32 }, (_, i) => i + 1), 'bnr.b');

test('existing bzDiD record signer verifies independently with WebCrypto', async () => {
  const key = record();
  const receipt = await signConsent(economics, key);
  assert.equal(await verifyConsent(receipt, economics), true);
  assert.deepEqual(receipt.document.artifact, artifactIdentity(economics));
  assert.equal(receipt.document.terms, TERMS);
  assert.match(TERMS, /authorizes no payment/);
  assert.equal('seed' in receipt, false);
  key.seed.fill(0);
});

test('reject altered terms, destination, origin, purpose, key and signature', async () => {
  const key = record(), receipt = await signConsent(economics, key);
  key.seed.fill(0);
  for (const field of ['terms', 'destination', 'origin', 'purpose', 'keyContext', 'publicKey', 'signedAt', 'nonce']) {
    const altered = structuredClone(receipt); altered.document[field] += 'changed';
    assert.equal(await verifyConsent(altered, economics), false, field);
  }
  const altered = structuredClone(receipt); altered.signature = '00'.repeat(64);
  assert.equal(await verifyConsent(altered, economics), false);
  altered.signature = receipt.signature; altered.algorithm = 'post-quantum';
  assert.equal(await verifyConsent(altered, economics), false);
});

test('consent cannot be reused for another manifest, tar, size or file count', async () => {
  const key = record(), receipt = await signConsent(economics, key);
  key.seed.fill(0);
  for (const field of ['manifestSha256', 'sha256', 'bytes', 'files']) {
    const changed = structuredClone(economics);
    const object = ['sha256', 'bytes'].includes(field) ? changed.artifact.uploadObject : changed.artifact;
    object[field] = typeof object[field] === 'number' ? object[field] + 1 : 'ab'.repeat(32);
    assert.equal(await verifyConsent(receipt, changed), false, field);
  }
});

test('missing artifact bindings and unsigned or extra-field receipts are refused', async () => {
  assert.throws(() => artifactIdentity({ artifact: {} }));
  assert.equal(await verifyConsent(null, economics), false);
  const key = record(), receipt = await signConsent(economics, key);
  key.seed.fill(0);
  receipt.document.paymentAuthorized = true;
  assert.equal(await verifyConsent(receipt, economics), false);
});
