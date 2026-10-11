#!/usr/bin/env node
// apply-law-signatures.mjs <receipt.json> [--name NAME]
// Takes the receipt the wallet's one-press "sign the law" saves (surfaces/wallet.html#pq-law)
// and writes, beside each signed law file, <file>.bpqsig.json, and the signer's id and public
// card into docs/PQ-SIGNERS.json. Only files listed in docs/PQ-LAW.json are written, and only
// when every signature verifies against the file exactly as it is in this checkout and comes
// from the receipt's own card. Otherwise nothing is written.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const name = args.includes('--name') ? args[args.indexOf('--name') + 1] : 'founder';
const die = m => { console.error('apply-law-signatures: ' + m + ' (nothing written)'); process.exit(1); };
if (!file) die('usage: apply-law-signatures.mjs <receipt.json> [--name NAME]');

const rc = JSON.parse(readFileSync(file, 'utf8'));
if (!rc || rc.bpq !== 1 || rc.kind !== 'law-signatures' || !Array.isArray(rc.signatures)) die('not a law-signatures receipt');
if (!B.verifyCard(rc.card)) die('the receipt card does not verify');
const law = new Set(JSON.parse(readFileSync(join(ROOT, 'docs', 'PQ-LAW.json'), 'utf8')).files);
const out = [];
for (const s of rc.signatures) {
  if (!s || typeof s.path !== 'string' || !law.has(s.path)) die('path not in docs/PQ-LAW.json: ' + (s && s.path));
  const target = join(ROOT, s.path);
  if (!existsSync(target)) die('missing file ' + s.path);
  const r = B.verifyFile(s.sig, new Uint8Array(readFileSync(target)));
  if (!r.ok) die(s.path + ': ' + r.why);
  if (r.id !== rc.card.id) die(s.path + ': signed by ' + r.id + ', not by the receipt card ' + rc.card.id);
  out.push([target + '.bpqsig.json', JSON.stringify(s.sig, null, 1) + '\n', s.path]);
}
if (!out.length) die('the receipt signs nothing');

const pinsPath = join(ROOT, 'docs', 'PQ-SIGNERS.json');
const pins = existsSync(pinsPath) ? JSON.parse(readFileSync(pinsPath, 'utf8')) : { about: 'Post-quantum ids whose signatures CI accepts on law files (scripts/verify-bpq-signatures.mjs). Public cards only.', signers: [] };
if (!pins.signers.some(p => p.id === rc.card.id)) pins.signers.push({ id: rc.card.id, name, card: rc.card });
for (const [p, body] of out) writeFileSync(p, body);
writeFileSync(pinsPath, JSON.stringify(pins, null, 1) + '\n');
for (const [, , path] of out) console.log('signed  ' + path);
console.log(`apply-law-signatures: ${out.length} signatures by ${rc.card.id} (${name}) written; signer pinned in docs/PQ-SIGNERS.json`);
