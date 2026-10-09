#!/usr/bin/env node
// build-derive-vectors.mjs — writes surfaces/bzdid-derive-vectors.json: the
// HKDF outputs of every bzDiD derivation label as the browser computes them,
// which crates/bsigner (through crates/bpq-core's info string) must reproduce
// byte for byte (SPEC-BTUNGSTEN-PQ-1 PQ03, the DIFFERENTIAL beside the SAW
// proof that the info strings are distinct).
//
// The three classical labels come from surfaces/onboarding/bzdid-key.js's own
// functions (deriveRecordKey, deriveK1Key, personaNullifier); the four PQ
// labels from surfaces/bpq.js's HKDF, the same call its keys() makes. The
// root is SHA-256 of a public sentence, so nothing here is a secret.
//
//   node scripts/build-derive-vectors.mjs          # write
//   node scripts/build-derive-vectors.mjs --check  # rebuild in memory and compare
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'surfaces', 'bzdid-derive-vectors.json');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ, L = globalThis.BPQ_LIB;
vm.runInThisContext(readFileSync(join(ROOT, 'surfaces', 'onboarding', 'bzdid-key.js'), 'utf8') + '\n;globalThis.BZDIDKEY = BZDIDKEY;');
const K = globalThis.BZDIDKEY;

const SENTENCE = 'bzdid derive vector root';
const root = new Uint8Array(createHash('sha256').update(SENTENCE, 'utf8').digest());
const utf8 = s => new TextEncoder().encode(s);
const pqExpand = (label, context, len) => L.hkdfExpand(L.sha256, root, new Uint8Array([...utf8(label), ...utf8(context)]), len);

// [label, context, length, how the browser derives it]
const ROWS = [
  ['BDID-v1/ed25519-record-key', 'sol:vector', 32, () => K.deriveRecordKey(root, 'sol:vector').seed],
  ['BDID-v1/secp256k1-record-key', 'nostr:bnr-devices', 32, () => K.deriveK1Key(root, 'nostr:bnr-devices').seed],
  ['BDID-v1/secp256k1-record-key', 'btc-spend:kingbee', 32, () => K.deriveK1Key(root, 'btc-spend:kingbee').seed],
  ['BDID-v1/persona-nullifier', 'ctx-1', 32, () => K.personaNullifier(root, 'ctx-1')],
  ['BDID-v1/ml-dsa-65-record-key', 'pq:vector', 32, () => pqExpand('BDID-v1/ml-dsa-65-record-key', 'pq:vector', 32)],
  ['BDID-v1/x-wing-kem-key', 'pq:vector', 32, () => pqExpand('BDID-v1/x-wing-kem-key', 'pq:vector', 32)],
  ['BDID-v1/vault-key', 'root', 32, () => B.rootVault(root)],
  ['BDID-v1/vault-key', 'pq:vector', 32, () => pqExpand('BDID-v1/vault-key', 'pq:vector', 32)],
  ['BDID-v1/slh-dsa-shake-256f-succession', 'pq:vector', 96, () => pqExpand('BDID-v1/slh-dsa-shake-256f-succession', 'pq:vector', 96)],
];

function build() {
  const rows = ROWS.map(([label, context, len, derive]) => {
    const okm = derive();
    if (okm.length !== len) throw new Error(`${label} ${context}: ${okm.length} bytes, want ${len}`);
    // the K1 rows must be the counter-0 path: their output is the plain expand
    if (label.includes('secp256k1') && B.b64u(okm) !== B.b64u(pqExpand(label, context, 32)))
      throw new Error(`${context}: the K1 key took a retry; pick another context`);
    return { label, context, length: len, okm: B.b64u(okm) };
  });
  return {
    schema: 'bzdid.derive.vectors.v1',
    about: 'HKDF-Expand(SHA-256, PRK = root, info = UTF-8(label) || UTF-8(context), length) for every bzDiD derivation label, as surfaces/onboarding/bzdid-key.js and surfaces/bpq.js compute it. crates/bsigner reproduces each row through crates/bpq-core (SPEC-BTUNGSTEN-PQ-1 PQ03). The K1 rows are the counter-0 path.',
    root: `sha256(utf8(${JSON.stringify(SENTENCE)}))`,
    rootFrom: SENTENCE,
    rows,
  };
}

const next = JSON.stringify(build(), null, 2) + '\n';
if (process.argv.includes('--check')) {
  const have = readFileSync(OUT, 'utf8');
  if (have !== next) { console.error('bzdid-derive-vectors.json: does not match a rebuild from the browser derivations'); process.exit(1); }
  console.log(`bzdid-derive-vectors.json: ${ROWS.length} rows match the browser derivations`);
} else {
  writeFileSync(OUT, next);
  console.log(`wrote ${OUT} (${ROWS.length} rows)`);
}
