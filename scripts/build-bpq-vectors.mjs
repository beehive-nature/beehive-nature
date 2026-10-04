#!/usr/bin/env node
// build-bpq-vectors.mjs — writes surfaces/bpq-vectors.json, the shared vectors
// that surfaces/bpq.js (JS) and crates/bsigner/src/bpq.rs (Rust) must both pass.
//
// Every root here is SHA-256 of a public sentence, so nothing in the file is a
// secret. Sealed objects use fresh randomness, so regenerating gives different
// bytes; `--check` therefore re-derives the keys and re-opens the committed
// objects instead of comparing bytes.
//
//   node scripts/build-bpq-vectors.mjs          # write
//   node scripts/build-bpq-vectors.mjs --check  # verify the committed file
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'surfaces', 'bpq-vectors.json');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ, L = globalThis.BPQ_LIB;

const rootOf = s => new Uint8Array(createHash('sha256').update(s, 'utf8').digest());
const sha3 = b => B.b64u(L.sha3_256(b));
const SENTENCES = { A: 'bpq1 test vector root A', B: 'bpq1 test vector root B', C: 'bpq1 test vector root C' };
const CONTEXT = 'pq:vector';

// onboarding/bzdid-key.js encodeRecoveryCode: bech32m('bdidrec', 0x01 || root)
const recoveryCode = root => L.bech32m.encode('bdidrec', L.bech32m.toWords(Uint8Array.of(1, ...root)), 1023);

function keyRow(name) {
  const k = B.keys(rootOf(SENTENCES[name]), CONTEXT);
  return {
    name, rootFrom: SENTENCES[name], rootHash: 'sha256(utf8(rootFrom))', recoveryCode: recoveryCode(rootOf(SENTENCES[name])), context: CONTEXT,
    dsaPublicKey: B.b64u(k.dsa.publicKey), kemPublicKey: B.b64u(k.kem.publicKey),
    slhPublicKey: B.b64u(k.succession.publicKey), successionCommit: B.b64u(k.succession.commit),
    vaultKeySha3: sha3(k.vault.key), id: k.id, keys: k,
  };
}

function plaintext(n) {   // a public, reproducible byte pattern
  const p = new Uint8Array(n);
  for (let i = 0; i < n; i++) p[i] = (i * 31 + 7) & 255;
  return p;
}

async function build() {
  const A = keyRow('A'), Bk = keyRow('B'), C = keyRow('C');
  const objects = [];
  const cases = [
    { name: 'self-and-x-wing-signed', len: 3000, seg: 1024, self: A, to: [Bk], signer: A, meta: { name: 'vector.bin', type: 'application/octet-stream' }, opens: ['A:self', 'B:x-wing'], refuses: ['C:self', 'C:x-wing'] },
    { name: 'self-only-unsigned-empty', len: 0, seg: 65536, self: A, to: [], signer: null, meta: null, opens: ['A:self'], refuses: ['B:self', 'B:x-wing'] },
    { name: 'x-wing-only-two-readers', len: 2049, seg: 1024, self: null, to: [Bk, C], signer: Bk, meta: { name: 'two.bin' }, opens: ['B:x-wing', 'C:x-wing'], refuses: ['A:self', 'A:x-wing'] },
  ];
  for (const c of cases) {
    const p = plaintext(c.len);
    const obj = await B.seal(p, {
      seg: c.seg, self: c.self ? c.self.keys : null, to: c.to.map(r => r.keys.kem.publicKey),
      signer: c.signer ? c.signer.keys : null, meta: c.meta || undefined,
    });
    objects.push({
      name: c.name, plaintext: `bytes i -> (i*31+7) mod 256, length ${c.len}`, plaintextLength: c.len,
      plaintextSha3: sha3(p), seg: c.seg, meta: c.meta, sealedBy: c.signer ? c.signer.id : null,
      opens: c.opens, refuses: c.refuses, object: B.b64u(obj),
    });
  }
  const card = B.card(A.keys);
  const bind = B.bind(A.keys, { ed25519: 'vector-ed25519-public-key', evm: '0x000000000000000000000000000000000000dEaD', vaulta: 'vector.b' }, '2026-10-04T00:00:00Z');
  const strip = r => { const { keys, ...rest } = r; return rest; };
  return {
    bpq: 1,
    spec: 'docs/specs/SPEC-BPQ-1.md',
    note: 'TEST VECTORS. Each root is SHA-256 of the public sentence in rootFrom; none of these keys guards anything.',
    library: B.library,
    keys: [strip(A), strip(Bk), strip(C)],
    objects, card, bind,
  };
}

async function check(v) {
  const fails = [];
  const want = (cond, what) => { if (!cond) fails.push(what); };
  const ks = {};
  for (const row of v.keys) {
    const k = B.keys(rootOf(row.rootFrom), row.context);
    ks[row.name] = k;
    want(B.b64u(k.dsa.publicKey) === row.dsaPublicKey, `${row.name}: ML-DSA-65 public key`);
    want(B.b64u(k.kem.publicKey) === row.kemPublicKey, `${row.name}: X-Wing public key`);
    want(B.b64u(k.succession.publicKey) === row.slhPublicKey, `${row.name}: SLH-DSA public key`);
    want(B.b64u(k.succession.commit) === row.successionCommit, `${row.name}: succession commitment`);
    want(sha3(k.vault.key) === row.vaultKeySha3, `${row.name}: vault key`);
    want(k.id === row.id, `${row.name}: id`);
    want(recoveryCode(rootOf(row.rootFrom)) === row.recoveryCode, `${row.name}: recovery code`);
  }
  for (const o of v.objects) {
    const obj = B.unb64u(o.object);
    for (const who of o.opens) {
      const [n, how] = who.split(':');
      try {
        const r = await B.open(obj, how === 'self' ? { self: ks[n] } : { kem: ks[n] });
        want(sha3(r.bytes) === o.plaintextSha3, `${o.name}: ${who} plaintext`);
        want(JSON.stringify(r.meta) === JSON.stringify(o.meta), `${o.name}: ${who} meta`);
        want(o.sealedBy ? (r.sealedBy && r.sealedBy.ok && r.sealedBy.id === o.sealedBy) : r.sealedBy === null, `${o.name}: ${who} sealer`);
      } catch (e) { fails.push(`${o.name}: ${who} could not open (${e.code || e.message})`); }
    }
    for (const who of o.refuses) {
      const [n, how] = who.split(':');
      let opened = false;
      try { await B.open(obj, how === 'self' ? { self: ks[n] } : { kem: ks[n] }); opened = true; } catch (e) { want(e.code === 'no_key', `${o.name}: ${who} refused for the wrong reason (${e.code})`); }
      want(!opened, `${o.name}: ${who} must not open`);
    }
  }
  want(B.verifyCard(v.card), 'card verifies');
  want(B.verifyBind(v.bind), 'binding verifies');
  return fails;
}

if (process.argv.includes('--check')) {
  const v = JSON.parse(readFileSync(OUT, 'utf8'));
  const fails = await check(v);
  if (fails.length) { console.error('bpq vectors: FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log(`bpq vectors: ok (${v.keys.length} key rows, ${v.objects.length} sealed objects, card, binding)`);
} else {
  const v = await build();
  const fails = await check(v);
  if (fails.length) { console.error('fresh vectors fail their own check:\n  ' + fails.join('\n  ')); process.exit(1); }
  writeFileSync(OUT, JSON.stringify(v, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
}
