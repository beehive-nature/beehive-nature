#!/usr/bin/env node
// verify-bpq-signatures.mjs — every tracked `<file>.bpqsig.json` must be a valid
// SPEC-BPQ-1 §3b detached signature over `<file>`, exactly as committed.
// If docs/PQ-SIGNERS.json exists ({"signers":[{"id":"bzpq1…","name":"…"}]}),
// every signature must also come from a listed id. A signature that does not
// verify fails the build; zero signatures is reported as zero, never as "ok".
// A file that changed after it was signed is reported STALE, not failed, when its
// signature is still authentic over the earlier version's hash and its signer is
// listed: the change is unsigned until the next one-press "sign the law"
// (surfaces/wallet.html#pq-law), and the line says so.
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

const sigs = execFileSync('git', ['ls-files', '*.bpqsig.json'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const pinsPath = join(ROOT, 'docs', 'PQ-SIGNERS.json');
const pins = existsSync(pinsPath) ? new Set(JSON.parse(readFileSync(pinsPath, 'utf8')).signers.map(s => s.id)) : null;

let bad = 0, stale = 0;
for (const sig of sigs) {
  const target = sig.slice(0, -'.bpqsig.json'.length);
  let why = null, r = null;
  if (!existsSync(join(ROOT, target))) why = 'its file ' + target + ' is missing';
  else {
    const d = JSON.parse(readFileSync(join(ROOT, sig), 'utf8'));
    r = B.verifyFile(d, new Uint8Array(readFileSync(join(ROOT, target))));
    if (!r.ok && r.why === 'this is not the file that was signed') {
      const c = B.verifyDetachedClaim(d);
      if (c.ok && (!pins || pins.has(c.id))) {
        stale++;
        console.log(`STALE ${target}: signed by ${c.id} at ${c.at} for an earlier version; its current text is unsigned`);
        continue;
      }
      why = c.ok ? 'signer ' + c.id + ' is not listed in docs/PQ-SIGNERS.json' : c.why;
    } else if (!r.ok) why = r.why;
    else if (pins && !pins.has(r.id)) why = 'signer ' + r.id + ' is not listed in docs/PQ-SIGNERS.json';
  }
  if (why) { bad++; console.error(`FAIL ${sig}: ${why}`); }
  else console.log(`ok   ${target}: signed by ${r.id}, says it was signed at ${r.at}`);
}
console.log(`bpq signatures: ${sigs.length - bad - stale} of ${sigs.length} verify` + (stale ? `, ${stale} stale (changed since signed)` : '') + (pins ? `, signers pinned (${pins.size})` : ', no signer pin file yet'));
if (bad) process.exit(1);
