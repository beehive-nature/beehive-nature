// bpq.test.mjs — post-quantum keys and sealed objects (surfaces/bpq.js).
// Spec: docs/specs/SPEC-BPQ-1.md. The shared vectors are checked here and by
// crates/bsigner (cargo test -p bsigner bpq): two implementations, one answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;
const V = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-vectors.json'), 'utf8'));
const rootOf = s => new Uint8Array(createHash('sha256').update(s, 'utf8').digest());
const keysOf = name => { const r = V.keys.find(k => k.name === name); return B.keys(rootOf(r.rootFrom), r.context); };
const includes = (hay, needle) => Buffer.from(hay).indexOf(Buffer.from(needle)) >= 0;

test('keys match the shared vectors (Rust derives the same bytes)', () => {
  for (const row of V.keys) {
    const k = B.keys(rootOf(row.rootFrom), row.context);
    assert.equal(B.b64u(k.dsa.publicKey), row.dsaPublicKey);
    assert.equal(B.b64u(k.kem.publicKey), row.kemPublicKey);
    assert.equal(B.b64u(k.succession.commit), row.successionCommit);
    assert.equal(k.id, row.id);
    assert.match(k.id, /^bzpq1[02-9ac-hj-np-z]+$/);
  }
});

test('vector objects open for their readers and refuse everyone else', async () => {
  for (const o of V.objects) {
    const obj = B.unb64u(o.object);
    for (const who of o.opens) {
      const [n, how] = who.split(':');
      const r = await B.open(obj, how === 'self' ? { self: keysOf(n) } : { kem: keysOf(n) });
      assert.equal(r.bytes.length, o.plaintextLength, `${o.name} ${who}`);
      assert.deepEqual(r.meta, o.meta);
      if (o.sealedBy) { assert.equal(r.sealedBy.ok, true); assert.equal(r.sealedBy.id, o.sealedBy); }
      else assert.equal(r.sealedBy, null);
    }
    for (const who of o.refuses) {
      const [n, how] = who.split(':');
      await assert.rejects(B.open(obj, how === 'self' ? { self: keysOf(n) } : { kem: keysOf(n) }), e => e.code === 'no_key');
    }
  }
});

test('the public head names no reader and no sealer', async () => {
  const a = keysOf('A'), b = keysOf('B');
  const obj = await B.seal(new TextEncoder().encode('only the two of us'), { self: a, to: [b.kem.publicKey], signer: a });
  const h = B.inspect(obj);
  const head = obj.subarray(0, h.bodyOffset), tail = obj.subarray(h.sealOffset);
  for (const pub of [a.dsa.publicKey, a.kem.publicKey, b.kem.publicKey, a.succession.commit]) {
    assert.equal(includes(head, pub) || includes(tail, pub), false, 'a public key leaked into clear bytes');
  }
  assert.equal(includes(obj, new TextEncoder().encode(a.id)), false, 'the sealer id leaked');
  assert.equal(includes(obj, new TextEncoder().encode('only the two of us')), false);
  assert.deepEqual(h.slots.map(s => Object.keys(s).sort().join(',')), ['to,w', 'ct,to,w']);
});

test('ranges decrypt by seeking, every flipped bit is refused', async () => {
  const a = keysOf('A');
  const plain = new Uint8Array(5000).map((_, i) => (i * 13) & 255);
  const obj = await B.seal(plain, { self: a, seg: 1024 });
  const op = await B.opener(obj, { self: a });
  assert.equal(op.head.segments, 5);
  const got = await op.read(1000, 3100, (x, y) => obj.subarray(x, y));
  assert.deepEqual(got, plain.subarray(1000, 3100));
  for (const at of [12, op.head.bodyOffset - 3, op.head.bodyOffset + 7, obj.length - 20]) {
    const bad = obj.slice(); bad[at] ^= 1;
    await assert.rejects(B.open(bad, { self: a }));
  }
  await assert.rejects(B.open(obj.subarray(0, obj.length - 1), { self: a }));
  await assert.rejects(B.open(new Uint8Array([...obj, 0]), { self: a }));
});

test('unknown versions are refused, never defaulted', async () => {
  const a = keysOf('A');
  const obj = await B.seal(new Uint8Array(10), { self: a });
  const h = B.inspect(obj);
  const core = JSON.parse(new TextDecoder().decode(h.coreBytes));
  core.bpq = 2;
  const c2 = new TextEncoder().encode(JSON.stringify(core));
  const forged = new Uint8Array([...obj.subarray(0, 8), 0, 0, (c2.length >> 8) & 255, c2.length & 255, ...c2, ...obj.subarray(12 + h.coreBytes.length)]);
  assert.throws(() => B.inspect(forged), e => e.code === 'version');
});

test('cards and bindings verify; edits do not', () => {
  assert.equal(B.verifyCard(V.card), true);
  assert.equal(B.verifyBind(V.bind), true);
  assert.equal(B.verifyCard({ ...V.card, kem: V.keys[1].kemPublicKey }), false);
  assert.equal(B.verifyBind({ ...V.bind, at: '2026-10-05T00:00:00Z' }), false);
  assert.throws(() => B.bind(keysOf('A'), { 'Bad Kind': 'x' }, '2026-10-04T00:00:00Z'), e => e.code === 'claim_kind');
});

test('the succession key re-derives from the root and matches the commitment', () => {
  const row = V.keys[0];
  const s = B.successionKeys(rootOf(row.rootFrom), row.context);
  assert.equal(B.b64u(s.commit), row.successionCommit);
  s.wipe();
});

test('wiped keys refuse to sign or decapsulate', () => {
  const k = keysOf('C');
  k.wipe();
  assert.throws(() => k.dsa.sign(new Uint8Array(1)), e => e.code === 'wiped');
  assert.throws(() => k.kem.decapsulate(new Uint8Array(1120)), e => e.code === 'wiped');
});
