#!/usr/bin/env node
// build-nostr-vector.mjs — writes surfaces/bpq-nostr-vector.json: one Nostr
// event attestation (SPEC-BPQ-1 §5b) made by surfaces/bpq.js, which
// crates/bsigner must verify (SPEC-BTUNGSTEN-PQ-1 PQ13). The key is vector
// root A's (bpq-vectors.json, a public sentence), the event id is SHA-256 of a
// public sentence, so nothing here is a secret. bpq.js signs hedged, so a
// rebuild gives other signature bytes; --check verifies the committed file.
//
//   node scripts/build-nostr-vector.mjs          # write
//   node scripts/build-nostr-vector.mjs --check  # verify the committed file
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'surfaces', 'bpq-nostr-vector.json');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;
const V = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-vectors.json'), 'utf8'));
const row = V.keys.find(k => k.name === 'A');
const sha256 = s => createHash('sha256').update(s, 'utf8').digest();
const EVENT_FROM = 'bpq1 nostr vector event';

if (process.argv.includes('--check')) {
  const v = JSON.parse(readFileSync(OUT, 'utf8'));
  const r = B.verifyNostr(v.attestation);
  const want = sha256(EVENT_FROM).toString('hex');
  if (!r.ok || r.id !== row.id || r.event !== want) {
    console.error('bpq-nostr-vector.json: the attestation does not verify for vector key A and its event');
    process.exit(1);
  }
  console.log('bpq-nostr-vector.json: verifies (vector key A, event sha256 of the public sentence)');
} else {
  const k = B.keys(sha256(row.rootFrom), row.context);
  const a = B.attestNostr(k, sha256(EVENT_FROM).toString('hex'));
  // one line: the event id is 64 hex characters, a public constant
  const doc = { classification: 'PUBLIC-CONSTANT', about: 'A Nostr event attestation (SPEC-BPQ-1 section 5b) made by surfaces/bpq.js with vector key A of bpq-vectors.json over the event id sha256 of the eventFrom sentence; crates/bsigner verifies it (SPEC-BTUNGSTEN-PQ-1 PQ13).', key: 'A', eventFrom: EVENT_FROM, attestation: a };
  writeFileSync(OUT, JSON.stringify(doc) + '\n');
  console.log(`wrote ${OUT}`);
}
