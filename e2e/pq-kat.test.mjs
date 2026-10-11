// pq-kat.test.mjs — NIST ACVP known-answer vectors (surfaces/pq-kat.json)
// against @noble/post-quantum 0.7.1, the library inside
// surfaces/onboarding/vendor/bpq-lib.js that surfaces/bpq.js signs and seals
// with. The same file is checked by RustCrypto in crates/bsigner/src/kat.rs
// (cargo test -p bsigner kat). Rebuild or re-derive the file with
// scripts/build-pq-kat.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
const L = globalThis.BPQ_LIB;
const K = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'pq-kat.json'), 'utf8'));

const u8 = s => new Uint8Array(Buffer.from(s, 'base64url'));
const b64u = b => Buffer.from(b).toString('base64url');
const flip = b => { const c = b.slice(); c[0] ^= 1; return c; };
const cat = (a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };

test('the vectors name their NIST source and every case its tgId/tcId', () => {
  assert.equal(K.kat, 1);
  assert.equal(K.source.repo, 'https://github.com/usnistgov/ACVP-Server');
  assert.match(K.source.commit, /^[0-9a-f]{40}$/);
  for (const f of K.source.files) assert.ok(f.url.includes(`/${K.source.commit}/`), f.path);
  const sections = [K.mlDsa65.keyGen, K.mlDsa65.sigVer, K.mlKem768.keyGen, K.mlKem768.decapsulation];
  for (const s of sections) {
    assert.ok(s.cases.length >= 3, s.acvpFolder);
    for (const c of s.cases) {
      assert.equal(c.tgId, s.tgId);
      assert.ok(Number.isInteger(c.tcId));
    }
  }
  assert.equal(K.mlDsa65.keyGen.parameterSet, 'ML-DSA-65');
  assert.deepEqual(
    [K.mlDsa65.sigVer.parameterSet, K.mlDsa65.sigVer.signatureInterface, K.mlDsa65.sigVer.preHash, K.mlDsa65.sigVer.externalMu],
    ['ML-DSA-65', 'external', 'pure', false],
  );
  assert.ok(K.mlDsa65.sigVer.cases.some(c => c.testPassed === false));
  assert.ok(K.mlDsa65.sigVer.cases.some(c => c.testPassed === true));
  assert.equal(K.mlKem768.keyGen.parameterSet, 'ML-KEM-768');
  assert.deepEqual([K.mlKem768.decapsulation.parameterSet, K.mlKem768.decapsulation.function], ['ML-KEM-768', 'decapsulation']);
  assert.equal(L.versions['noble-post-quantum'], '0.7.1');
});

test('ML-DSA-65 keyGen: seed -> public key, byte for byte', () => {
  for (const c of K.mlDsa65.keyGen.cases) {
    const { publicKey } = L.ml_dsa65.keygen(u8(c.seed));
    assert.equal(b64u(publicKey), c.pk, `tcId ${c.tcId}`);
    // control: a different seed must not land on the same key
    assert.notEqual(b64u(L.ml_dsa65.keygen(flip(u8(c.seed))).publicKey), c.pk, `tcId ${c.tcId} control`);
  }
});

test('ML-DSA-65 sigVer (external, pure, given context): the verdict NIST expects', () => {
  for (const c of K.mlDsa65.sigVer.cases) {
    const sig = u8(c.signature), msg = u8(c.message), pk = u8(c.pk), context = u8(c.context);
    assert.equal(L.ml_dsa65.verify(sig, msg, pk, { context }), c.testPassed, `tcId ${c.tcId}: ${c.reason}`);
    if (context.length === 0) {
      // the call shape bpq.js uses: no options, so the empty context
      assert.equal(L.ml_dsa65.verify(sig, msg, pk), c.testPassed, `tcId ${c.tcId} estate call shape`);
    }
    if (c.testPassed) {
      // control: the same signature over a changed message or context is refused
      assert.equal(L.ml_dsa65.verify(sig, flip(msg), pk, { context }), false, `tcId ${c.tcId} message control`);
      assert.equal(L.ml_dsa65.verify(sig, msg, pk, { context: flip(context) }), false, `tcId ${c.tcId} context control`);
    }
  }
});

test('ML-KEM-768 keyGen: d || z -> ek and expanded dk, byte for byte', () => {
  for (const c of K.mlKem768.keyGen.cases) {
    const k = L.ml_kem768.keygen(cat(u8(c.d), u8(c.z)));
    assert.equal(b64u(k.publicKey), c.ek, `tcId ${c.tcId} ek`);
    assert.equal(b64u(k.secretKey), c.dk, `tcId ${c.tcId} dk`);
    assert.notEqual(b64u(L.ml_kem768.keygen(cat(flip(u8(c.d)), u8(c.z))).publicKey), c.ek, `tcId ${c.tcId} control`);
  }
});

test('ML-KEM-768 decapsulation (expanded dk): the shared key NIST expects, implicit rejection included', () => {
  for (const c of K.mlKem768.decapsulation.cases) {
    const dk = u8(c.dk), ct = u8(c.c);
    assert.equal(b64u(L.ml_kem768.decapsulate(ct, dk)), c.k, `tcId ${c.tcId}: ${c.reason}`);
    // control: one flipped ciphertext bit yields a different key
    assert.notEqual(b64u(L.ml_kem768.decapsulate(flip(ct), dk)), c.k, `tcId ${c.tcId} control`);
  }
});
