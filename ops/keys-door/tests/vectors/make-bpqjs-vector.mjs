#!/usr/bin/env node
// make-bpqjs-vector.mjs — writes bpqjs-genesis.json beside this script: a
// genesis bnr.keychain-release/1 record, its envelope, and the files it names,
// signed by surfaces/bpq.js (@noble/post-quantum). keys-door's cross-
// implementation test feeds it to BOTH of its ML-DSA-65 verifiers (fips204
// in-process and bsigner bpq-verify) and serves it end to end, so a drift in
// the canonical form, the id derivation or the §3b message between the
// browser and the edge fails there.
//
// The key's root is SHA-256 of a public sentence (the build-bpq-vectors.mjs
// convention), so nothing in the output is a secret, and it signs nothing but
// this vector. Every digest is base64url; the only hex is source.commit (40).
//
//   node ops/keys-door/tests/vectors/make-bpqjs-vector.mjs     (repo root)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ, L = globalThis.BPQ_LIB;

const te = new TextEncoder();
const root = new Uint8Array(createHash('sha256').update('keys-door cross-implementation vector, never a release key', 'utf8').digest());
const k = B.keys(root, 'pq:keys-door-vector');

const files = {
  'index.html': '<!doctype html><meta charset="utf-8"><title>keys-door vector</title><script src="keychain.js"></script>\n',
  'keychain.js': '// keys-door cross-implementation vector\n',
  'vendor/bnr-sign.js': '// vendor stand-in\n',
};
const paths = Object.keys(files).sort();
const sha256 = b => B.b64u(new Uint8Array(createHash('sha256').update(b).digest()));
const sha3 = b => B.b64u(L.sha3_256(b));
const bytesOf = p => te.encode(files[p]);
const pack = Uint8Array.from(paths.flatMap(p => [...bytesOf(p)]));

const record = {
  files: paths.map(p => ({ path: p, sha256: sha256(bytesOf(p)), sha3: sha3(bytesOf(p)), size: bytesOf(p).length })),
  kind: 'release',
  origin: 'https://keys.skaists.dev',
  pack: { sha256: sha256(pack), sha3: sha3(pack), size: pack.length },
  prev: null,
  rp_id: 'keys.skaists.dev',
  schema: 'bnr.keychain-release/1',
  seq: 1,
  signers: [k.id],
  source: { build: 'node scripts/build-keychain.mjs --out DIR', commit: '38c394fac7e9ad1b70b87b3b95e6702fd4b5c244' /* origin/main at this build */, repo: 'beehive-nature/beehive-nature' },
};
// canonical JSON (contract §1): keys sorted at every level, no whitespace
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v !== null && typeof v === 'object' ? '{' + Object.keys(v).sort().map(x => JSON.stringify(x) + ':' + canon(v[x])).join(',') + '}'
  : JSON.stringify(v);
const recordBytes = te.encode(canon(record));
const sig = B.signFile(k, recordBytes, '2026-10-12T00:00:00Z');
const check = B.verifyFile(sig, recordBytes);
if (!check.ok) throw new Error('bpq.js does not verify its own signature: ' + check.why);

const out = {
  about: 'keys-door cross-implementation vector: a genesis release signed by surfaces/bpq.js. Regenerate with node ops/keys-door/tests/vectors/make-bpqjs-vector.mjs (the signature is hedged, so the bytes change; the test does not pin them).',
  envelope: { bnr: 'keychain-release-envelope/1', hints: {}, record: B.b64u(recordBytes), sig },
  files: Object.fromEntries(paths.map(p => [p, B.b64u(bytesOf(p))])),
};
writeFileSync(join(HERE, 'bpqjs-genesis.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ written: 'bpqjs-genesis.json', id: k.id, record_sha3: sha3(recordBytes) }));
