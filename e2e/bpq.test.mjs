// bpq.test.mjs — post-quantum keys and sealed objects (surfaces/bpq.js).
// Spec: docs/specs/SPEC-BPQ-1.md. The shared vectors are checked here and by
// crates/bsigner (cargo test -p bsigner bpq): two implementations, one answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, createCipheriv, hkdfSync } from 'node:crypto';
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

test('ranges decrypt by seeking; flips at four structural points, a cut byte and a trailing byte are refused', async () => {
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

test('detached signatures verify for their file only, under the signer id', () => {
  const file = new Uint8Array(4096).map((_, i) => (i * 31 + 7) & 255);
  const d = V.detached.signature;
  assert.deepEqual(B.verifyFile(d, file), { ok: true, id: d.id, at: d.at });
  assert.equal(B.verifyFile(d, file.subarray(0, 4095)).ok, false);
  const other = file.slice(); other[9] ^= 1;
  assert.equal(B.verifyFile(d, other).ok, false);
  assert.equal(B.verifyFile({ ...d, at: '2026-10-05T00:00:00Z' }, file).ok, false);
  assert.equal(B.verifyFile({ ...d, id: V.keys[1].id }, file).ok, false);
  const fresh = B.signFile(keysOf('B'), file, '2026-10-04T12:00:00Z');
  assert.equal(B.verifyFile(fresh, file).id, V.keys[1].id);
});

// ── negatives; crates/bsigner/src/bpq.rs mirrors each of these ─────────────
const L = globalThis.BPQ_LIB;
const te = new TextEncoder();
const cat = (...xs) => new Uint8Array(Buffer.concat(xs.map(x => Buffer.from(x))));
// the exact string a binding signs, rebuilt naively from its fields
const signedText = b => b.id + '\n' + b.at + '\n' + Object.keys(b.claims).sort().map(k => k + '=' + b.claims[k] + '\n').join('');

test('bindings: a claim moved into `at`, a wrong version or kind, and claim shapes that sign alike are refused', () => {
  const b = V.bind, k = keysOf('A');
  assert.equal(B.verifyBind(b), true, 'control');
  // Move the first claim line into `at`: the signed bytes do not change.
  const { ed25519, ...rest } = b.claims;
  const stripped = { ...b, at: b.at + '\ned25519=' + ed25519, claims: rest };
  assert.equal(signedText(stripped), signedText(b), 'the attack keeps the signed bytes');
  assert.equal(B.verifyBind(stripped), false, 'a claim moved into `at` is refused');
  assert.equal(B.verifyBind({ ...b, bpq: 2 }), false);
  assert.equal(B.verifyBind({ ...b, kind: 'detached' }), false);
  assert.equal(B.verifyBind({ ...b, kind: null }), false);
  const { kind, ...noKind } = b;
  assert.equal(B.verifyBind(noKind), false);
  for (const at of ['2026-10-04', '2026-10-04T00:00:00', '2026-10-04T00:00:00+00:00', '2026-10-04T00:00:00Z\n', ' 2026-10-04T00:00:00Z', '2026-10-04T00:00:00.1234567890Z']) {
    assert.throws(() => B.bind(k, { evm: '0x1' }, at), e => e.code === 'at', JSON.stringify(at));
  }
  // fractional seconds, as toISOString writes them, are lawful
  assert.equal(B.verifyBind(B.bind(k, { evm: '0x1' }, '2026-10-04T12:34:56.789Z')), true, 'control');
  // {a: 'b=c'} and {'a=b': 'c'} sign the same line; only the first is lawful
  const eqv = B.bind(k, { a: 'b=c' }, b.at);
  assert.equal(B.verifyBind(eqv), true, 'control');
  assert.equal(B.verifyBind({ ...eqv, claims: { 'a=b': 'c' } }), false);
  // validly signed over "A=b=c\n": only the kind pattern refuses it
  const upperSig = B.b64u(k.dsa.sign(cat(te.encode('bpq1/bind'), L.sha3_256(te.encode(b.id + '\n' + b.at + '\nA=b=c\n')))));
  assert.equal(B.verifyBind({ ...eqv, claims: { A: 'b=c' }, sig: upperSig }), false);
  assert.throws(() => B.bind(k, { 'a=b': 'c' }, b.at), e => e.code === 'claim_kind');
  // {'0': 'x'} and ['x'] sign the same line; only the object is lawful
  const arr = B.bind(k, { 0: 'x' }, b.at);
  assert.equal(B.verifyBind(arr), true, 'control');
  assert.equal(B.verifyBind({ ...arr, claims: ['x'] }), false);
  assert.throws(() => B.bind(k, ['x'], b.at), e => e.code === 'claims');
});

test('cards: a wrong version or any kind is refused', () => {
  assert.equal(B.verifyCard(V.card), true, 'control');
  assert.equal(B.verifyCard({ ...V.card, bpq: 2 }), false);
  assert.equal(B.verifyCard({ ...V.card, kind: 'binding' }), false);
  const { bpq, ...noVersion } = V.card;
  assert.equal(B.verifyCard(noVersion), false);
});

test('detached signatures: a validly signed `at` that is not a UTC timestamp, a wrong version or kind are refused', () => {
  const k = keysOf('A'), d = V.detached.signature;
  const file = new Uint8Array(4096).map((_, i) => (i * 31 + 7) & 255), fh = L.sha3_256(file);
  const resign = at => ({ ...d, at, sig: B.b64u(k.dsa.sign(cat(te.encode('bpq1/detached'), fh, L.sha3_256(te.encode(d.id + '\n' + at + '\n' + 4096))))) });
  assert.equal(B.verifyFile(resign('2026-10-04T01:02:03.5Z'), file).ok, true, 'control');
  assert.equal(B.verifyFile(resign('2026-10-04T00:00:00Z\nx'), file).ok, false);
  assert.equal(B.verifyFile(resign('yesterday'), file).ok, false);
  assert.equal(B.verifyFile({ ...d, bpq: 2 }, file).ok, false);
  assert.equal(B.verifyFile({ ...d, kind: 'binding' }, file).ok, false);
  assert.throws(() => B.signFile(k, file, '2026-10-04'), e => e.code === 'at');
});

// byte ranges of KEYS, META, BODY and SEAL in a sealed object
function regions(obj) {
  const h = B.inspect(obj), keysStart = 12 + h.coreBytes.length + 4;
  return {
    keys: [keysStart, keysStart + h.keysBytes.length],
    meta: [h.bodyOffset - h.metaBytes.length, h.bodyOffset],
    body: [h.bodyOffset, h.sealOffset], seal: [h.sealOffset + 4, obj.length], seg: h.core.seg,
  };
}
// change the base64url character `after` bytes past `needle` inside range r
function changeB64(obj, r, needle, after) {
  const at = r[0] + Buffer.from(obj.subarray(r[0], r[1])).indexOf(needle) + needle.length + after;
  obj[at] = obj[at] === 0x41 ? 0x42 : 0x41;
}

test('a signed shared object (self + X-Wing reader + signer + meta): a change in KEYS, META, SEAL or BODY never passes (refused, or the seal reads not ok)', async () => {
  const o = V.objects[0], a = keysOf('A'), me = { self: a };
  assert.equal(o.name, 'self-and-x-wing-signed');
  const obj = B.unb64u(o.object), r = regions(obj);
  assert.equal((await B.open(obj, me)).sealedBy.ok, true, 'control');

  // KEYS is not under the AEAD; the seal signature covers it. A changed byte
  // in the other reader's slot still opens for A, and the seal no longer verifies.
  let x = obj.slice(); changeB64(x, r.keys, '"ct":"', 40);
  assert.equal((await B.open(x, me)).sealedBy.ok, false);
  x = obj.slice(); changeB64(x, r.keys, '"w":"', 20);
  await assert.rejects(B.open(x, me), e => e.code === 'no_key');

  x = obj.slice(); x[r.meta[0] + 5] ^= 1;
  await assert.rejects(B.open(x, me), e => e.code === 'auth');
  // altered SEAL bytes: the open stands (segments authenticate the bytes),
  // and the sealer is never reported ok
  x = obj.slice(); x[r.seal[0] + 5] ^= 1;
  const sb = (await B.open(x, me)).sealedBy;
  assert.equal(sb.ok, false); assert.equal(sb.id, null);
  x = obj.slice(); x[r.body[0] + 1500] ^= 1;
  await assert.rejects(B.open(x, me), e => e.code === 'auth');

  // swap segments 0 and 1 (both full length): each nonce names its index
  const s = r.seg + 16, s0 = r.body[0], s1 = s0 + s;
  x = obj.slice(); x.set(obj.subarray(s1, s1 + s), s0); x.set(obj.subarray(s0, s0 + s), s1);
  await assert.rejects(B.open(x, me), e => e.code === 'auth');
  // cut one byte from the final segment, or append a copy of segment 0: the
  // length the head implies no longer matches
  x = cat(obj.subarray(0, r.body[1] - 1), obj.subarray(r.body[1]));
  await assert.rejects(B.open(x, me));
  x = cat(obj.subarray(0, r.body[1]), obj.subarray(s0, s0 + s), obj.subarray(r.body[1]));
  await assert.rejects(B.open(x, me));
});

// A minimal object built here with node:crypto, independently of bpq.js: one
// "self" slot, a fixed file key, one segment, optional extra slots and SEAL.
const CORE_OK = '{"bpq":1,"aead":"aes-256-gcm","seg":1024,"len":{len},"oid":"{oid}","kc":"{kc}"}';
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const nonceOf = (flag, i) => { const n = Buffer.alloc(12); n.writeUInt32BE(flag, 0); n.writeBigUInt64BE(BigInt(i), 4); return n; };
const gcm = (key, iv, msg, aad) => { const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(aad); return Buffer.concat([c.update(msg), c.final(), c.getAuthTag()]); };
// signWith: keys that sign a valid ml-dsa-65 seal record (claiming `claimId`,
// default their own id); bom: prefix the SEAL plaintext with a UTF-8 BOM.
function craft(vault, { core = CORE_OK, extra = [], seal = null, signWith = null, claimId = null, bom = false } = {}) {
  const fk = Buffer.alloc(32, 7), oid = Buffer.alloc(16, 9), plain = te.encode('crafted');
  const coreB = Buffer.from(core.replace('{len}', String(plain.length)).replace('{oid}', B.b64u(oid))
    .replace('{kc}', B.b64u(L.sha3_256(cat(te.encode('bpq1/key-commit'), oid, fk)))));
  const aad = L.sha3_256(coreB);
  const kw = Buffer.from(hkdfSync('sha256', vault, oid, 'bpq1/wrap/self', 32));
  const keysB = Buffer.from(JSON.stringify([{ to: 'self', w: B.b64u(gcm(kw, Buffer.alloc(12), fk, aad)) }, ...extra]));
  const body = gcm(fk, nonceOf(1, 0), plain, aad);
  let rec = seal;
  if (signWith) {
    const msg = cat(te.encode('bpq1/seal'), aad, L.sha3_256(keysB), L.sha3_256(new Uint8Array(0)), L.sha3_256(body));
    rec = { alg: 'ml-dsa-65', pk: B.b64u(signWith.dsa.publicKey), sig: B.b64u(signWith.dsa.sign(msg)),
      id: claimId || signWith.id, succ: B.b64u(signWith.succession.commit) };
  }
  const recB = rec ? Buffer.concat([Buffer.from(bom ? [0xef, 0xbb, 0xbf] : []), Buffer.from(JSON.stringify(rec))]) : null;
  const sealB = recB ? gcm(fk, nonceOf(3, 0), recB, aad) : Buffer.alloc(0);
  return cat([0x89, 0x42, 0x50, 0x51, 0x31, 0x0d, 0x0a, 0x1a], u32(coreB.length), coreB, u32(keysB.length), keysB, u32(0), body, u32(sealB.length), sealB);
}

test('crafted objects: unknown slots and non-plain or oversized CORE numbers are refused; a failing seal record never reads ok', async () => {
  const a = keysOf('A'), me = { self: a }, vault = a.vault.key;
  const control = await B.open(craft(vault), me);
  assert.equal(new TextDecoder().decode(control.bytes), 'crafted', 'control');
  assert.equal(control.sealedBy, null);

  // SPEC-BPQ-1 §6: an unknown slot `to` is refused, even after one that opens
  for (const extra of [{ to: 'hqc', w: 'AA' }, { w: 'AA' }, 'self']) {
    await assert.rejects(B.open(craft(vault, { extra: [extra] }), me), e => e.code === 'slot', JSON.stringify(extra));
  }
  // JSON.parse reads 1024.0 as 1024; the Rust twin refuses it, so both do
  for (const bad of ['"seg":1024.0', '"seg":1.024e3', '"seg":1024,"x":-1']) {
    await assert.rejects(B.open(craft(vault, { core: CORE_OK.replace('"seg":1024', bad) }), me), e => e.code === 'number', bad);
  }
  // a len past 2^53 cannot be counted exactly: refused (Rust: does not fit the object)
  for (const len of ['18446744073709551615', '9223372036854775808', '9007199254740993']) {
    await assert.rejects(B.open(craft(vault, { core: CORE_OK.replace('{len}', len) }), me), e => e.code === 'len' && e.message === 'bad len', len);
  }
  // len = 2^53 - 1 is a safe integer, but len + 16 per segment is not: the body-length check refuses it
  await assert.rejects(B.open(craft(vault, { core: CORE_OK.replace('{len}', '9007199254740991') }), me),
    e => e.code === 'len' && /past 2\^53/.test(e.message));

  // Seal records. Every SEAL that fails reads as ok: false with id: null and
  // never fails the open; an id is reported only when ok. Rust (bpq.rs
  // seal_record) draws the same line; before this, an id without succ failed
  // the whole open in Rust and read as ok: false here.
  const b = keysOf('B');
  const valid = (await B.open(craft(vault, { signWith: a }), me)).sealedBy;
  assert.equal(valid.ok, true, 'control: a valid seal verifies'); assert.equal(valid.id, a.id, 'control: the id is read');
  // a BOM before the record: TextDecoder would strip it by default; serde_json refuses it, so both refuse
  const bomd = (await B.open(craft(vault, { signWith: a, bom: true }), me)).sealedBy;
  assert.equal(bomd.ok, false); assert.equal(bomd.id, null);
  // a valid signature by A claiming B's id: never reported as B
  const forged = (await B.open(craft(vault, { signWith: a, claimId: b.id }), me)).sealedBy;
  assert.equal(forged.ok, false); assert.equal(forged.id, null); assert.equal(forged.idOk, false);

  const pk = B.b64u(a.dsa.publicKey), id = a.id, succ = B.b64u(a.succession.commit);
  const sealer = async rec => (await B.open(craft(vault, { seal: rec }), me)).sealedBy;
  const s = await sealer({ alg: 'ml-dsa-65', pk, sig: 'AAAA', id, succ });
  assert.equal(s.ok, false, 'a bad signature reads as ok: false'); assert.equal(s.id, null); assert.equal(s.idOk, true);
  for (const rec of [
    { alg: 'ml-dsa-65', pk, sig: 'AAAA', id },            // an id without its succession commitment
    { alg: 'ml-dsa-65', pk, sig: 'AAAA', id: 5, succ },
    { alg: 'ml-dsa-65', sig: 'AAAA' },
    [1, 2],
    { alg: 'slh-dsa-shake-256f', pk: 'AA' },
  ]) {
    const x = await sealer(rec);
    assert.equal(x.ok, false, JSON.stringify(rec)); assert.equal(x.id, null, JSON.stringify(rec));
  }
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

// Founder ruling 2026-10-04 (SPEC-BPQ-1 §1, §2): "only me" opens from the phrase alone.
const hkdfExpand32 = (prk, info) => new Uint8Array(createHmac('sha256', prk).update(Buffer.concat([Buffer.from(info, 'utf8'), Buffer.from([1])])).digest());

test('the phrase-only vault key is the vault label under context root (an independent HKDF-Expand agrees), and is no persona vault', () => {
  assert.equal(V.rootVault.context, 'root');
  assert.equal(V.rootVault.label, 'BDID-v1/vault-key');
  for (const row of V.rootVault.keys) {
    const prk = rootOf(row.rootFrom), rv = B.rootVault(prk);
    assert.equal(rv.length, 32);
    assert.deepEqual(rv, hkdfExpand32(prk, 'BDID-v1/vault-keyroot'));
    assert.equal(B.b64u(createHash('sha3-256').update(rv).digest()), row.rootVaultKeySha3);
    assert.notDeepEqual(rv, B.keys(prk, 'pq:vector').vault.key);
  }
  assert.throws(() => B.rootVault(new Uint8Array(31)), e => e.code === 'length');
});

test('root vault vector objects open for their readers and refuse everyone else', async () => {
  const cred = (n, how) => {
    const r = V.keys.find(k => k.name === n);
    return how === 'root' ? { self: B.rootVault(rootOf(r.rootFrom)) } : how === 'self' ? { self: keysOf(n) } : { kem: keysOf(n) };
  };
  for (const o of V.rootVault.objects) {
    const obj = B.unb64u(o.object);
    for (const who of o.opens) {
      const r = await B.open(obj, cred(...who.split(':')));
      assert.equal(B.b64u(createHash('sha3-256').update(r.bytes).digest()), o.plaintextSha3, `${o.name} ${who}`);
      assert.deepEqual(r.meta, o.meta);
      if (o.sealedBy) { assert.equal(r.sealedBy.ok, true); assert.equal(r.sealedBy.id, o.sealedBy); }
      else assert.equal(r.sealedBy, null);
    }
    for (const who of o.refuses) {
      await assert.rejects(B.open(obj, cred(...who.split(':'))), e => e.code === 'no_key', `${o.name} must refuse ${who}`);
    }
  }
});

test('a self slot under the root vault looks like one under a persona vault, and two root seals share no slot bytes', async () => {
  const prk = rootOf(V.keys[0].rootFrom), plain = new TextEncoder().encode('same shape');
  // every field: its name, its JSON type, its length (and `to`, the only fixed value)
  const shape = slots => slots.map(s => Object.keys(s).sort().map(k => `${k}:${typeof s[k]}:${String(s[k]).length}${k === 'to' ? '=' + s[k] : ''}`).join(','));
  const root1 = B.inspect(await B.seal(plain, { self: B.rootVault(prk) }));
  const root2 = B.inspect(await B.seal(plain, { self: B.rootVault(prk) }));
  const persona = B.inspect(await B.seal(plain, { self: B.keys(prk, 'pq:vector') }));
  assert.deepEqual(shape(root1.slots), ['to:string:4=self,w:string:64']);
  assert.deepEqual(shape(root1.slots), shape(persona.slots));
  assert.deepEqual(Object.keys(root1.core).sort(), Object.keys(persona.core).sort());
  // the same key and the same plaintext still give unrelated slots: fresh oid and file key each time
  const w1 = B.unb64u(root1.slots[0].w), w2 = B.unb64u(root2.slots[0].w);
  assert.equal(w1.length, 48);
  assert.notEqual(root1.core.oid, root2.core.oid);
  assert.equal(includes(root2.keysBytes, root1.slots[0].w), false);
  for (let i = 0; i + 8 <= w1.length; i++) assert.equal(includes(w2, w1.subarray(i, i + 8)), false, 'an 8-byte run of one slot appears in the other');
});

test('the context "root" is reserved: keys() and successionKeys() refuse it, rootVault is the only way in', () => {
  const prk = rootOf(V.keys[0].rootFrom);
  assert.throws(() => B.keys(prk, 'root'), e => e.code === 'context_reserved');
  assert.throws(() => B.successionKeys(prk, 'root'), e => e.code === 'context_reserved');
  assert.equal(B.keys(prk, 'pq:root').context, 'pq:root');   // a persona named root is still a pq: context
});

test('contexts outside the bpq-core rule (1 to 64 printable ASCII) derive nothing, here and in the K1 derivation', () => {
  const prk = rootOf(V.keys[0].rootFrom);
  const vm = require('node:vm');
  vm.runInThisContext(readFileSync(join(ROOT, 'surfaces', 'onboarding', 'bzdid-key.js'), 'utf8') + '\n;globalThis.BZDIDKEY = BZDIDKEY;');
  const K = globalThis.BZDIDKEY;
  for (const bad of ['pq:\x01', 'pq:\x7f', 'pq:pé', 'x'.repeat(65)]) {
    assert.throws(() => B.keys(prk, bad), e => e.code === 'context_rule', JSON.stringify(bad));
    assert.throws(() => B.successionKeys(prk, bad), e => e.code === 'context_rule', JSON.stringify(bad));
    assert.throws(() => K.deriveK1Key(prk, bad), e => e.code === 'context_rule', JSON.stringify(bad));
  }
  // the pair the rule closes: context "a" at counter 1 would be context "a\x01" at counter 0
  assert.throws(() => K.deriveK1Key(prk, 'a\x01'), e => e.code === 'context_rule');
  assert.equal(B.keys(prk, 'x'.repeat(64)).context.length, 64);
  assert.equal(K.deriveK1Key(prk, 'nostr:bnr-devices').seed.length, 32);
});

test('an object sealed by the Rust sealer (crates/bsigner bpq::seal_self) opens in bpq.js and only for its vault', async () => {
  const R = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-rust-sealed.json'), 'utf8'));
  const obj = new Uint8Array(Buffer.from(R.object_b64u, 'base64url'));
  const o = await B.open(obj, { self: rootOf(R.vaultFrom) });
  assert.equal(B.b64u(o.bytes), R.plain_b64u);
  assert.equal(o.meta, null);
  await assert.rejects(B.open(obj, { self: rootOf('another vault') }));
});

test('Nostr event attestations (SPEC-BPQ-1 section 5b): one verifies, every forgery is refused, the committed vector verifies', () => {
  const k = keysOf('A');
  const event = 'ab'.repeat(32);
  const a = JSON.parse(JSON.stringify(B.attestNostr(k, event)));
  assert.deepEqual(B.verifyNostr(a), { ok: true, id: k.id, event });
  const bent = edit => { const x = JSON.parse(JSON.stringify(a)); edit(x); return B.verifyNostr(x).ok; };
  assert.equal(bent(x => { x.event = 'ac'.repeat(32); }), false, 'another event');
  assert.equal(bent(x => { x.event = 'AB'.repeat(32); }), false, 'uppercase hex');
  assert.equal(bent(x => { x.kind = 'binding'; }), false, 'another kind');
  assert.equal(bent(x => { x.id = keysOf('B').id; }), false, 'another id');
  const other = B.attestNostr(keysOf('B'), event);
  assert.equal(bent(x => { x.sig = other.sig; }), false, "another key's signature");
  assert.throws(() => B.attestNostr(k, 'zz'), e => e.code === 'event');
  const v = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-nostr-vector.json'), 'utf8'));
  const r = B.verifyNostr(v.attestation);
  assert.equal(r.ok, true);
  assert.equal(r.event, createHash('sha256').update(v.eventFrom, 'utf8').digest('hex'));
});
