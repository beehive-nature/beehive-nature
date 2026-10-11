#!/usr/bin/env node
// verify-bpq-signatures.mjs — every tracked `<file>.bpqsig.json` must be a valid
// SPEC-BPQ-1 §3b detached signature over `<file>`, exactly as committed, and every
// law file must carry one (SPEC-BTUNGSTEN-PQ-1 §PQ08: a current signature per law
// file).
//
// - docs/PQ-LAW.json names the law files. A tracked law-shaped file
//   (docs/CONSTITUTION.md, ORDERS-1.md, docs/RULINGS-*.md) missing from it fails;
//   a list that names nothing fails; a listed file without a signature fails.
// - docs/PQ-SIGNERS.json pins the ids whose signatures count. With law files
//   listed, a missing pin file fails: a signature by an unlisted key proves only
//   that some bzpq1 key signed.
// - A file that changed after it was signed fails as STALE: its current text is
//   unsigned until the next one-press "sign the law" (surfaces/wallet.html#pq-law).
//   (Until 2026-10-08 STALE was reported and passed; the review folded into the
//   PQ handoff that day made it a failure: a stale pass is a signal prettier than the truth.)
// Zero signatures is reported as zero, never as "ok". crates/bsigner verifies the
// same law files natively in CI (scripts/verify-law-signatures-rust.sh).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean);
const sigs = git('ls-files', '*.bpqsig.json');
const pinsPath = join(ROOT, 'docs', 'PQ-SIGNERS.json');
const pins = existsSync(pinsPath) ? new Set(JSON.parse(readFileSync(pinsPath, 'utf8')).signers.map(s => s.id)) : null;
const lawPath = join(ROOT, 'docs', 'PQ-LAW.json');
const law = existsSync(lawPath) ? JSON.parse(readFileSync(lawPath, 'utf8')).files : [];
const tracked = new Set(law.length ? git('ls-files', '--', ...law, ...law.map(f => f + '.bpqsig.json')) : []);

let bad = 0;
const fail = msg => { bad++; console.error(`FAIL ${msg}`); };

// the law set: listed, complete, signed, pinned
if (!law.length) fail('docs/PQ-LAW.json names no law file: a law gate over nothing is vacuous');
for (const f of git('ls-files', '--', 'docs/CONSTITUTION.md', 'ORDERS-1.md', 'docs/RULINGS-*.md')) {
  if (!law.includes(f)) fail(`${f} is a law file missing from docs/PQ-LAW.json`);
}
for (const f of law) {
  if (!tracked.has(f)) fail(`docs/PQ-LAW.json lists ${f}, which is not a tracked file`);
  else if (!tracked.has(f + '.bpqsig.json')) fail(`${f} is a law file with no signature (${f}.bpqsig.json)`);
}
if (law.length && !pins) fail('law files are listed but docs/PQ-SIGNERS.json does not exist, so no signer is pinned');

let good = 0, lawCurrent = 0;
for (const sig of sigs) {
  const target = sig.slice(0, -'.bpqsig.json'.length);
  if (!existsSync(join(ROOT, target))) { fail(`${sig}: its file ${target} is missing`); continue; }
  const d = JSON.parse(readFileSync(join(ROOT, sig), 'utf8'));
  const r = B.verifyFile(d, new Uint8Array(readFileSync(join(ROOT, target))));
  if (!r.ok && r.why === 'this is not the file that was signed') {
    const c = B.verifyDetachedClaim(d);
    fail(c.ok
      ? `STALE ${target}: signed by ${c.id} at ${c.at} for an earlier version; its current text is unsigned (press "sign the law")`
      : `${sig}: ${c.why}`);
  } else if (!r.ok) fail(`${sig}: ${r.why}`);
  else if (pins && !pins.has(r.id)) fail(`${sig}: signer ${r.id} is not listed in docs/PQ-SIGNERS.json`);
  else {
    good++;
    if (law.includes(target)) lawCurrent++;
    console.log(`ok   ${target}: signed by ${r.id}, says it was signed at ${r.at}`);
  }
}
console.log(`bpq signatures: ${good} of ${sigs.length} verify` + (pins ? `, signers pinned (${pins.size})` : ', no signer pin file yet') +
  `; law files: ${lawCurrent} of ${law.length} current`);
if (bad) process.exit(1);
