#!/usr/bin/env node
// make-profile-vectors.mjs — writes profile-separation.json beside this script: one genesis
// record and a list of envelopes over it, each with the verdict BOTH readers must reach on it:
// keys-door (Rust: parse_envelope, then both verifiers) and tools/keychain-release (JS:
// openEnvelope, then verifySig). The cases hold the two signature profiles apart (no fallback
// from one to the other), hold vk to its profile, and show that signed_at_ms, which no signature
// covers, changes nothing.
//
// The keys are release.mjs's throwaway test keys from public seeds: nothing here is a secret or
// authorizes anything. Signatures are fresh each run (noble signs hedged); the verdicts are not.
//
//   node ops/keys-door/tests/vectors/make-profile-vectors.mjs     (repo root)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPQ, assemble, b64u, canon, testBheartKey, testKeys } from '../../../../tools/keychain-release/release.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const bpqKey = testKeys('keys-door profile-separation vector'), hKey = testBheartKey('keys-door profile-separation vector');
const files = [
  { path: 'index.html', bytes: Buffer.from('<!doctype html><title>profile vector</title>\n') },
  { path: 'keychain.js', bytes: Buffer.from('// keys-door profile-separation vector\n') }
];
const { bytes } = assemble({ files, seq: 1, prev: null, signers: [bpqKey.id, hKey.id], commit: '38c394fac7e9ad1b70b87b3b95e6702fd4b5c244' });
const record = b64u(bytes), vk = b64u(hKey.vk);
const bpq = BPQ.signFile(bpqKey, new Uint8Array(bytes), '2026-10-12T00:00:00Z');
const heart = hKey.sign(bytes);
const other = testBheartKey('keys-door profile-separation vector, another key');
const env = (sig, withVk) => ({ bnr: 'keychain-release-envelope/1', hints: {}, record, sig, ...(withVk ? { vk } : {}) });
const edit = (o, f) => { const c = structuredClone(o); f(c); return c; };
const cases = [
  ['bpq_valid', env(bpq, false), 'accept', bpqKey.id],
  ['bheart_valid', env(heart, true), 'accept', hKey.id],
  // the same signature bytes, signed_at_ms changed: not signed, so nothing changes
  ['bheart_signed_at_ms_zero', env(edit(heart, s => { s.signed_at_ms = 0; }), true), 'accept', hKey.id],
  ['bheart_signed_at_ms_far_future', env(edit(heart, s => { s.signed_at_ms = 253402300799999; }), true), 'accept', hKey.id],
  // profile separation: no fallback from one profile to the other
  ['bheart_type_removed', env(edit(heart, s => { delete s.type; }), true), 'refuse'],
  ['bheart_type_removed_no_vk', env(edit(heart, s => { delete s.type; }), false), 'refuse'],
  ['bpq_with_type_added', env(edit(bpq, s => { s.type = 'bheart.signature/1'; }), false), 'refuse'],
  ['bpq_with_type_added_and_vk', env(edit(bpq, s => { s.type = 'bheart.signature/1'; }), true), 'refuse'],
  ['bpq_with_vk', env(bpq, true), 'refuse'],
  ['bheart_without_vk', env(heart, false), 'refuse'],
  // key_id is consistency with vk, never an authority of its own
  ['bheart_key_id_of_another_key', env(edit(heart, s => { s.key_id = other.key_id; }), true), 'refuse'],
  ['bheart_alg_ml_dsa_87', env(edit(heart, s => { s.alg = 'ml-dsa-87'; s.signature.alg = 'ml-dsa-87'; }), true), 'refuse'],
  ['bheart_alg_ml_dsa_65_hedged', env(edit(heart, s => { s.alg = 'ml-dsa-65-hedged'; s.signature.alg = 'ml-dsa-65-hedged'; }), true), 'refuse'],
].map(([name, envelope, expect, signer]) => ({ name, envelope, expect, ...(signer ? { signer } : {}) }));
bpqKey.wipe(); hKey.wipe(); other.wipe();
const out = { about: 'keys-door + tools/keychain-release profile-separation vector: throwaway test keys from public seeds; each case is one envelope and the verdict both readers must reach', record_signers: 'genesis record; signers = [the bzpq1 id, the mldsa65: id]', cases };
writeFileSync(join(HERE, 'profile-separation.json'), canon(out) + '\n');
console.log(`wrote ${cases.length} cases`);
