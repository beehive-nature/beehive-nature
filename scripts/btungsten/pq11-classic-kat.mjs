#!/usr/bin/env node
// pq11-classic-kat.mjs — SPEC-BTUNGSTEN-PQ-1 PQ11: BIP-340 as the wallet
// runs it (surfaces/onboarding/vendor/bnr-sign.js `schnorr`, @noble/curves
// 2.3.0, what signs the wallet's Nostr events) on bitcoin/bips
// bip-0340/test-vectors.csv at the commit crates/btungsten-pq/
// classic-manifest.json pins. The file is fetched by CI and refused here
// unless its size and SHA-256 match that pin.
//
//   node scripts/btungsten/pq11-classic-kat.mjs <test-vectors.csv>
//
// Every row verifies as the CSV says; every row with a secret key derives its
// public key and signs, with its aux_rand, to the exact signature. Exits 1 on
// any mismatch, a pin mismatch, or a file with no rows (T-VACUOUS).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = { console, TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bnr-sign.js'), 'utf8'), ctx);
const schnorr = ctx.BnrSign.schnorr;

const manifest = JSON.parse(readFileSync(join(ROOT, 'crates', 'btungsten-pq', 'classic-manifest.json'), 'utf8'));
const pin = manifest.files.find(f => f.name === 'bip340');
const file = process.argv[2];
if (!file) { console.error('usage: pq11-classic-kat.mjs <test-vectors.csv>'); process.exit(2); }
const bytes = readFileSync(file);
const sha = 'sha256:' + createHash('sha256').update(bytes).digest('base64url');
if (bytes.length !== pin.bytes || sha !== pin.sha256) {
  console.error(`PQ11: ${file} is not the pinned bip-0340/test-vectors.csv (size ${bytes.length}, ${sha})`);
  process.exit(1);
}

const hex = s => Uint8Array.from((s || '').match(/../g) || [], b => parseInt(b, 16));
const toHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
let rows = 0, verifyOk = 0, signRows = 0, signOk = 0;
const fails = [];
for (const line of bytes.toString('utf8').split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [idx, sk, pk, aux, msg, sig, result] = line.split(',');
  rows++;
  let ok;
  try { ok = schnorr.verify(hex(sig), hex(msg), hex(pk)); } catch { ok = false; }
  if (ok === (result === 'TRUE')) verifyOk++; else fails.push(`verify ${idx}`);
  if (sk) {
    signRows++;
    let same = false;
    try { same = toHex(schnorr.sign(hex(msg), hex(sk), hex(aux))) === sig && toHex(schnorr.getPublicKey(hex(sk))) === pk; } catch { same = false; }
    if (same) signOk++; else fails.push(`sign ${idx}`);
  }
}
if (rows === 0) { console.error('PQ11: the CSV yielded no rows (T-VACUOUS)'); process.exit(1); }
console.log(`PQ11 BIP-340 verify [noble-curves 2.3.0]: executed ${rows} of ${rows}, passed ${verifyOk}`);
console.log(`PQ11 BIP-340 sign [noble-curves 2.3.0]: executed ${signRows} of ${signRows}, passed ${signOk}`);
for (const f of fails) console.log(`PQ11 FAIL BIP-340 ${f}`);
console.log(`PQ11 SUMMARY noble: ${verifyOk + signOk} of ${rows + signRows} passed`);
process.exit(fails.length ? 1 : 0);
