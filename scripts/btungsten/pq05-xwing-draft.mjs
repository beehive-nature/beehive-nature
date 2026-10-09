#!/usr/bin/env node
// pq05-xwing-draft.mjs — SPEC-BTUNGSTEN-PQ-1 PQ05: X-Wing as the browser runs
// it (surfaces/onboarding/vendor/bpq-lib.js `xwing`, what surfaces/bpq.js
// calls for keygen, encapsulation and decapsulation) against the test vectors
// of draft-connolly-cfrg-xwing-kem at a pinned revision (Appendix C).
//
// The draft text is fetched by CI at the revision in
// scripts/btungsten/pq05-xwing-draft.json and handed here as a path; this
// script refuses it unless its size and SHA-256 match that pin. No vector
// bytes enter the repo. crates/bsigner checks its own X-Wing (keygen and
// decapsulation, the two it runs) against the same file.
//
//   node scripts/btungsten/pq05-xwing-draft.mjs <draft.txt>
//
// Prints one line per vector, a TEETH line (one shared-secret byte changed
// must be caught) and a SUMMARY; exits 1 on any mismatch, a pin mismatch, or
// a file that yields no vectors (T-VACUOUS).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
const L = globalThis.BPQ_LIB;
const PIN = JSON.parse(readFileSync(join(HERE, 'pq05-xwing-draft.json'), 'utf8'));

/// Appendix C as records {seed, sk, pk, eseed, ct, ss} of hex strings. Page
/// headers and footers split the hex blocks; a field runs until the next
/// field name.
export function parseVectors(text) {
  // the headings at line start, not their table-of-contents entries
  const start = text.indexOf('\nAppendix C.  Test vectors');
  const end = text.indexOf('\nAppendix D.', start + 1);
  if (start < 0 || end < 0) throw new Error('no Appendix C in this draft text');
  const names = new Set(['seed', 'sk', 'pk', 'eseed', 'ct', 'ss']);
  const out = [];
  let cur = null, field = null;
  for (const raw of text.slice(start, end).split(/\r?\n/).slice(1)) {
    const line = raw.trim();
    const m = /^([a-z]+)\b\s*([0-9a-f]*)$/.exec(line);
    if (m && names.has(m[1])) {
      if (m[1] === 'seed') { cur = {}; out.push(cur); }
      if (!cur) throw new Error(`field ${m[1]} before any seed`);
      field = m[1];
      cur[field] = m[2];
    } else if (field && /^[0-9a-f]+$/.test(line)) {
      cur[field] += line;
    }
  }
  return out;
}

const hex = s => Uint8Array.from(s.match(/../g) || [], b => parseInt(b, 16));
const toHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

function check(v) {
  const want = { pk: 1216, ct: 1120, ss: 32, seed: 32, eseed: 64 };
  for (const [k, n] of Object.entries(want)) {
    if (hex(v[k]).length !== n) throw new Error(`vector field ${k} is ${hex(v[k]).length} bytes, want ${n}`);
  }
  const kp = L.xwing.keygen(hex(v.seed));
  const pkOk = toHex(kp.publicKey) === v.pk;
  const enc = L.xwing.encapsulate(hex(v.pk), hex(v.eseed));
  const ctOk = toHex(enc.cipherText) === v.ct && toHex(enc.sharedSecret) === v.ss;
  const ssOk = toHex(L.xwing.decapsulate(hex(v.ct), kp.secretKey)) === v.ss;
  return { pkOk, ctOk, ssOk, ok: pkOk && ctOk && ssOk };
}

const file = process.argv[2];
if (!file) { console.error('usage: pq05-xwing-draft.mjs <draft.txt>'); process.exit(2); }
const bytes = readFileSync(file);
const sha = createHash('sha256').update(bytes).digest('base64url');
if (bytes.length !== PIN.size || sha !== PIN.sha256) {
  console.error(`PQ05-XWING: ${file} is not ${PIN.draft}-${PIN.revision} as pinned (size ${bytes.length}, sha256 ${sha})`);
  process.exit(1);
}
const vectors = parseVectors(bytes.toString('utf8'));
if (vectors.length === 0) { console.error('PQ05-XWING: the draft yielded no vectors (T-VACUOUS)'); process.exit(1); }
let pass = 0;
vectors.forEach((v, i) => {
  const r = check(v);
  if (r.ok) pass++;
  console.log(`PQ05-XWING bpq-lib vector ${i + 1}: keygen ${r.pkOk ? 'ok' : 'MISMATCH'}, encapsulate ${r.ctOk ? 'ok' : 'MISMATCH'}, decapsulate ${r.ssOk ? 'ok' : 'MISMATCH'}`);
});
// TEETH: the same check with one shared-secret byte changed must fail
const bent = { ...vectors[0], ss: vectors[0].ss.slice(0, -2) + (vectors[0].ss.slice(-2) === '00' ? '01' : '00') };
const caught = !check(bent).ok;
console.log(`PQ05-XWING TEETH one shared-secret byte changed: ${caught ? 'caught' : 'MISSED'}`);
console.log(`PQ05-XWING SUMMARY bpq-lib: ${pass} of ${vectors.length} vectors pass, ${PIN.draft}-${PIN.revision}`);
process.exit(pass === vectors.length && caught ? 0 : 1);
