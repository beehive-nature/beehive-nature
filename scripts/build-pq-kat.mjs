#!/usr/bin/env node
// build-pq-kat.mjs — writes surfaces/pq-kat.json: a small, named subset of
// NIST's own ACVP known-answer vectors for ML-DSA-65 (FIPS 204) and
// ML-KEM-768 (FIPS 203), re-encoded from hex to base64url.
//
// Checked by two implementations:
//   crates/bsigner/src/kat.rs   RustCrypto ml-dsa 0.1.1 / ml-kem 0.3.2   (cargo test -p bsigner kat)
//   e2e/pq-kat.test.mjs         @noble/post-quantum 0.7.1 in bpq-lib.js  (node --test e2e/pq-kat.test.mjs)
//
// The source is pinned to one commit of github.com/usnistgov/ACVP-Server.
// Inputs come from prompt.json, answers from expectedResults.json, and the
// human-readable reason from internalProjection.json; this script refuses to
// write if internalProjection.json disagrees with the other two for any
// chosen case. Each source file's git blob id is recorded, so anyone can
// compare it with the blob GitHub serves at that commit.
//
// This needs the network (or --from DIR holding the same files); it is a
// maintenance tool and is not run in CI. CI runs the two checkers above.
//
//   node scripts/build-pq-kat.mjs                 # fetch at the pinned commit, write
//   node scripts/build-pq-kat.mjs --from DIR      # read DIR/<folder>/<file>.json instead
//   node scripts/build-pq-kat.mjs --check [...]   # rebuild and compare with the committed file
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'surfaces', 'pq-kat.json');
const REPO = 'https://github.com/usnistgov/ACVP-Server';
const COMMIT = '975de31eb83d87039ec88934fdc47d8c312b892d';
const RAW = `https://raw.githubusercontent.com/usnistgov/ACVP-Server/${COMMIT}/gen-val/json-files`;
const FILES = ['prompt.json', 'expectedResults.json', 'internalProjection.json'];

// The subset. Chosen by tgId/tcId so it can be re-derived exactly.
const PICK = {
  mlDsa65KeyGen: { folder: 'ML-DSA-keyGen-FIPS204', tgId: 2, tcIds: [26, 27, 28] },
  // tgId 3 = ML-DSA-65, signatureInterface external, preHash pure, externalMu false.
  // 39 is the only case in the group with an empty context.
  mlDsa65SigVer: { folder: 'ML-DSA-sigVer-FIPS204', tgId: 3, tcIds: [31, 33, 34, 38, 39, 41, 43] },
  mlKem768KeyGen: { folder: 'ML-KEM-keyGen-FIPS203', tgId: 2, tcIds: [26, 27, 28] },
  mlKem768Decap: { folder: 'ML-KEM-encapDecap-FIPS203', tgId: 5, tcIds: [86, 87, 88, 91] },
};

const args = process.argv.slice(2);
const check = args.includes('--check');
const fromIdx = args.indexOf('--from');
const fromDir = fromIdx >= 0 ? args[fromIdx + 1] : null;

const b64u = hex => {
  if (!/^([0-9A-Fa-f]{2})*$/.test(hex)) throw new Error(`not hex: ${hex.slice(0, 16)}...`);
  return Buffer.from(hex, 'hex').toString('base64url');
};
const gitBlob = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const sha256 = buf => 'sha256:' + createHash('sha256').update(buf).digest('base64url');

async function load(folder, file) {
  const url = `${RAW}/${folder}/${file}`;
  let buf;
  if (fromDir) buf = readFileSync(join(fromDir, folder, file));
  else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  }
  return { url, buf, json: JSON.parse(buf.toString('utf8')), path: `gen-val/json-files/${folder}/${file}` };
}

const sources = [];
async function pick({ folder, tgId, tcIds }) {
  const [p, e, i] = await Promise.all(FILES.map(f => load(folder, f)));
  for (const s of [p, e, i]) sources.push({ path: s.path, url: s.url, gitBlob: gitBlob(s.buf), sha256: sha256(s.buf) });
  const vsIds = new Set([p.json.vsId, e.json.vsId, i.json.vsId]);
  if (vsIds.size !== 1) throw new Error(`${folder}: vsId differs across files`);
  const group = f => {
    const g = f.json.testGroups.find(g => g.tgId === tgId);
    if (!g) throw new Error(`${folder}: no tgId ${tgId}`);
    return g;
  };
  const gp = group(p), ge = group(e), gi = group(i);
  const cases = tcIds.map(tcId => {
    const tp = gp.tests.find(t => t.tcId === tcId), te = ge.tests.find(t => t.tcId === tcId), ti = gi.tests.find(t => t.tcId === tcId);
    if (!tp || !te || !ti) throw new Error(`${folder} tg ${tgId}: no tcId ${tcId} in every file`);
    for (const [k, v] of Object.entries({ ...tp, ...te })) {
      if (JSON.stringify(ti[k]) !== JSON.stringify(v)) throw new Error(`${folder} tc ${tcId}: internalProjection.${k} disagrees`);
    }
    return { prompt: tp, expected: te, reason: ti.reason };
  });
  const attrsOf = g => Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'tests'));
  return { folder, vsId: p.json.vsId, algorithm: p.json.algorithm, mode: p.json.mode, revision: p.json.revision, attrs: { ...attrsOf(gi), ...attrsOf(gp) }, cases };
}

const dsaKg = await pick(PICK.mlDsa65KeyGen);
const dsaSv = await pick(PICK.mlDsa65SigVer);
const kemKg = await pick(PICK.mlKem768KeyGen);
const kemDc = await pick(PICK.mlKem768Decap);

const head = s => ({ acvpFolder: s.folder, vsId: s.vsId, algorithm: s.algorithm, mode: s.mode, revision: s.revision, ...s.attrs });
const need = (cond, msg) => { if (!cond) throw new Error(msg); };
need(dsaKg.attrs.parameterSet === 'ML-DSA-65', 'dsa keyGen group is not ML-DSA-65');
need(dsaSv.attrs.parameterSet === 'ML-DSA-65' && dsaSv.attrs.signatureInterface === 'external' && dsaSv.attrs.preHash === 'pure' && dsaSv.attrs.externalMu === false, 'sigVer group is not ML-DSA-65 external/pure');
need(kemKg.attrs.parameterSet === 'ML-KEM-768', 'kem keyGen group is not ML-KEM-768');
need(kemDc.attrs.parameterSet === 'ML-KEM-768' && kemDc.attrs.function === 'decapsulation', 'decap group is not ML-KEM-768 decapsulation');

const out = {
  kat: 1,
  note: 'NIST ACVP known-answer vectors, a small named subset, re-encoded from hex to base64url without padding. Public test data: none of these keys guards anything. Built by scripts/build-pq-kat.mjs.',
  checkedBy: {
    rust: 'crates/bsigner/src/kat.rs (RustCrypto ml-dsa 0.1.1, ml-kem 0.3.2): cargo test -p bsigner kat',
    js: 'e2e/pq-kat.test.mjs (@noble/post-quantum 0.7.1 via surfaces/onboarding/vendor/bpq-lib.js): node --test e2e/pq-kat.test.mjs',
  },
  source: {
    repo: REPO,
    commit: COMMIT,
    commitMessage: 'RELEASE/v1.1.0.43 including hotfix patches',
    fieldsFrom: 'inputs from prompt.json, answers from expectedResults.json, reason from internalProjection.json',
    files: sources,
  },
  mlDsa65: {
    keyGen: {
      ...head(dsaKg),
      interface: 'ML-DSA.KeyGen_internal (FIPS 204 Algorithm 6): 32-byte seed in, encoded public key out. The expanded secret key (sk) ACVP also publishes is not carried here; the estate stores seeds only.',
      cases: dsaKg.cases.map(c => ({ tgId: dsaKg.attrs.tgId, tcId: c.prompt.tcId, seed: b64u(c.prompt.seed), pk: b64u(c.expected.pk) })),
    },
    sigVer: {
      ...head(dsaSv),
      interface: 'ML-DSA.Verify (FIPS 204 Algorithm 3), external interface, pure (no pre-hash), with the given context string. RustCrypto: VerifyingKey::verify_with_context. noble: ml_dsa65.verify(sig, msg, pk, { context }). A case whose context is empty is also the estate path: pq::dsa_verify (Verifier::verify, empty context) and the same noble call bpq.js makes.',
      cases: dsaSv.cases.map(c => ({
        tgId: dsaSv.attrs.tgId, tcId: c.prompt.tcId, testPassed: c.expected.testPassed, reason: c.reason,
        pk: b64u(c.prompt.pk), message: b64u(c.prompt.message), context: b64u(c.prompt.context), signature: b64u(c.prompt.signature),
      })),
    },
  },
  mlKem768: {
    keyGen: {
      ...head(kemKg),
      interface: 'ML-KEM.KeyGen_internal (FIPS 203 Algorithm 16): d and z in; encapsulation key ek and expanded decapsulation key dk out. The 64-byte seed both libraries take is d || z.',
      cases: kemKg.cases.map(c => ({ tgId: kemKg.attrs.tgId, tcId: c.prompt.tcId, d: b64u(c.prompt.d), z: b64u(c.prompt.z), ek: b64u(c.expected.ek), dk: b64u(c.expected.dk) })),
    },
    decapsulation: {
      ...head(kemDc),
      interface: 'ML-KEM.Decaps (FIPS 203 Algorithm 18) with the expanded 2400-byte decapsulation key, the only form ACVP publishes for this function; no seed is given. RustCrypto ml-kem 0.3.2 reads that form only through DecapsulationKey::from_expanded, which the crate marks deprecated (decapsulation_key.rs:63-64); the Rust checker calls it anyway and the compiler says so. noble: ml_kem768.decapsulate(c, dk). Modified-ciphertext cases expect the implicit-rejection key.',
      cases: kemDc.cases.map(c => ({ tgId: kemDc.attrs.tgId, tcId: c.prompt.tcId, reason: c.reason, dk: b64u(c.prompt.dk), c: b64u(c.prompt.c), k: b64u(c.expected.k) })),
    },
  },
  notIncluded: [
    'ML-DSA sigGen: RustCrypto Signer::try_sign is deterministic with an empty context only (ml-dsa 0.1.1 signing.rs:181-182); not attempted in this file.',
    'ML-DSA sigVer internal interface, externalMu and HashML-DSA (pre-hash) groups: the estate signs and verifies pure with an empty context, so only the external/pure group is carried.',
    'ML-KEM encapsulation (ek, m -> c, k): RustCrypto exposes it only as the doc-hidden encapsulate_deterministic (encapsulation_key.rs:43-45, public docs under the hazmat feature); not attempted in this file.',
    'ML-KEM decapsulationKeyCheck / encapsulationKeyCheck groups: not attempted in this file.',
    'ML-DSA-44/87 and ML-KEM-512/1024: the estate uses ML-DSA-65 and ML-KEM-768 (inside X-Wing).',
    'SLH-DSA-SHAKE-256f (FIPS 205), the SPEC-BPQ-1 succession key: no known-answer vectors here, and the Rust twin (crates/bsigner/src/bpq.rs) never derives it, so it is not cross-checked by a second implementation either.',
  ],
};
const text = JSON.stringify(out, null, 1) + '\n';

if (check) {
  const committed = readFileSync(OUT, 'utf8');
  if (committed !== text) { console.error('pq-kat.json: committed file differs from a rebuild at', COMMIT); process.exit(1); }
  console.log('pq-kat.json: matches a rebuild from', REPO, 'at', COMMIT);
} else {
  writeFileSync(OUT, text);
  const n = [dsaKg, dsaSv, kemKg, kemDc].reduce((a, s) => a + s.cases.length, 0);
  console.log(`wrote ${OUT}: ${n} cases from ${REPO} at ${COMMIT}`);
}
