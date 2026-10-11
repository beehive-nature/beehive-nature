#!/usr/bin/env node
// build-intent-vector.mjs — writes surfaces/bpq-intent-vector.json: one intent
// authorization (SPEC-BPQ-1 §5c) made by surfaces/bpq.js, which crates/bsigner
// must verify (SPEC-BTUNGSTEN-PQ-1 PQ12). The key is vector root A's
// (bpq-vectors.json, a public sentence) and the envelope is WB001's pinned
// "base" positive, so nothing here is a secret. bpq.js signs hedged, so a
// rebuild gives other signature bytes.
//
// --check verifies, without writing: bpq.js's WB001 codec against every row
// of scripts/btungsten/wb001-vectors.json (positives byte for byte both ways,
// refusals by code), the committed browser-made authorization, and the
// bsigner-made one (surfaces/bpq-intent-rust.json).
//
//   node scripts/build-intent-vector.mjs          # write
//   node scripts/build-intent-vector.mjs --check  # verify
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'surfaces', 'bpq-intent-vector.json');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;
const V = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-vectors.json'), 'utf8'));
const WB = JSON.parse(readFileSync(join(ROOT, 'scripts', 'btungsten', 'wb001-vectors.json'), 'utf8'));
const row = V.keys.find(k => k.name === 'A');
const sha256 = s => createHash('sha256').update(s, 'utf8').digest();
const hex = h => Uint8Array.from(Buffer.from(h, 'hex'));
const fields = p => ({ domain: p.domain, nonce: hex(p.nonce), epoch: p.epoch, action: hex(p.action), destination: p.destination, capability: p.capability, amount: p.amount, expiry: p.expiry, payer: p.payer, payload: hex(p.payload) });
const base = WB.positives.find(p => p.name === 'base');

function fail(msg) { console.error(msg); process.exit(1); }

if (process.argv.includes('--check')) {
  let codec = 0;
  for (const p of WB.positives) {
    if (Buffer.from(B.encodeIntent(fields(p))).toString('hex') !== p.envelope) fail(`WB001 codec: "${p.name}" encodes to other bytes`);
    const d = B.decodeIntent(hex(p.envelope));
    for (const k of ['domain', 'epoch', 'destination', 'capability', 'amount', 'expiry', 'payer']) {
      if (d[k] !== p[k]) fail(`WB001 codec: "${p.name}" decodes ${k} differently`);
    }
    for (const k of ['nonce', 'action', 'payload']) {
      if (Buffer.from(d[k]).toString('hex') !== p[k]) fail(`WB001 codec: "${p.name}" decodes ${k} differently`);
    }
    codec++;
  }
  for (const r of WB.refusals) {
    let code = null;
    try { if (r.envelope) B.decodeIntent(hex(r.envelope)); else B.encodeIntent(fields(r.intent)); } catch (e) { code = e.code; }
    if (code !== r.code) fail(`WB001 codec: "${r.name}" refused with ${code}, not ${r.code}`);
    codec++;
  }
  const js = JSON.parse(readFileSync(OUT, 'utf8'));
  const a = B.verifyIntent(js.authorization);
  if (!a.ok || a.id !== row.id || Buffer.from(B.encodeIntent(fields(base))).toString('hex') !== Buffer.from(B.unb64u(js.authorization.envelope)).toString('hex')) {
    fail('bpq-intent-vector.json: the authorization does not verify for vector key A over the WB001 base envelope');
  }
  const rust = JSON.parse(readFileSync(join(ROOT, 'surfaces', 'bpq-intent-rust.json'), 'utf8'));
  const b = B.verifyIntent(rust.authorization);
  if (!b.ok || b.id !== row.id) fail('bpq-intent-rust.json: the bsigner-made authorization does not verify in bpq.js');
  console.log(`WB001 codec in bpq.js: ${codec} of ${WB.positives.length + WB.refusals.length} pinned rows; bpq-intent-vector.json and bpq-intent-rust.json verify (vector key A)`);
} else {
  const k = B.keys(sha256(row.rootFrom), row.context);
  const a = B.attestIntent(k, B.encodeIntent(fields(base)));
  const doc = { classification: 'PUBLIC-CONSTANT', about: 'An intent authorization (SPEC-BPQ-1 section 5c) made by surfaces/bpq.js with vector key A of bpq-vectors.json over the WB001 base positive of scripts/btungsten/wb001-vectors.json; crates/bsigner verifies it (SPEC-BTUNGSTEN-PQ-1 PQ12).', key: 'A', envelopeFrom: 'wb001-vectors.json positives[name=base]', authorization: a };
  writeFileSync(OUT, JSON.stringify(doc) + '\n');
  console.log(`wrote ${OUT}`);
}
