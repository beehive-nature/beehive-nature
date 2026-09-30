// sign-badges.mjs — the CI-signing card's signing half (proof lights).
//
// Signs STAGED origin-ci status documents with the estate's own signer
// (bsigner, ML-DSA-65), inside the protected badge-signing environment, on
// pushes to main only — the workflow's job-level `if` keeps untrusted PR
// content away from the key, and this script adds its own three refusals so
// the property does not depend on the workflow alone:
//   1. HEAD BINDING   a document is signed only if its revision equals the
//                     --expect-sha the caller states (in CI: github.sha, the
//                     run's own head). The signature therefore binds run id,
//                     attempt and revision together — exactly what the gate's
//                     origin-ci check needs to stop being a fail-closed TODO.
//   2. TRUST FIRST    the seed's own key must be pinned, valid NOW and not
//                     revoked in docs/badge-trust.json, or nothing is signed.
//                     A key the gate would refuse never produces signatures.
//   3. GATE BEFORE INK  each staged document passes the full gate (evidence,
//                     coverage, derivation, manifest) BEFORE it is signed;
//                     after signing, the signed document is verified again —
//                     a signature can authenticate an attestation, it cannot
//                     make an unchecked derivation correct.
//
// The seed is env-delivered (default var BADGE_SIGNING_SEED_B64U): never an
// argument, never printed, never written to disk by this script. bsigner
// reads it from the process environment, derives the public key in memory,
// and emits only public material.
//
//   node sign-badges.mjs --stage <dir> --expect-sha <sha> --out <dir> [--trust <file>] [--verifier <path>] [--seed-env VAR]
//
// Exit 0 = signed, or the NAMED SKIP (no seed in the environment — the founder
// gesture outstanding; nothing to sign is not a failure). Exit 1 = refusal.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, serialise, render, loadTrust, resolveVerifier, verify } from './render-badges.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const STAGE = arg('stage'), OUT = arg('out'), EXPECT_SHA = arg('expect-sha');
const TRUST_PATH = arg('trust', join(ROOT, 'docs', 'badge-trust.json'));
const SEED_ENV = arg('seed-env', 'BADGE_SIGNING_SEED_B64U');
const ALG = 'ml-dsa-65';
const refuse = why => { console.error(`sign-badges: REFUSING — ${why}`); process.exit(1); };

if (!STAGE || !OUT || !/^[0-9a-f]{40}$/.test(EXPECT_SHA || '')) {
  console.error('usage: sign-badges.mjs --stage <dir> --out <dir> --expect-sha <40-hex sha> [--trust <file>] [--verifier <path>] [--seed-env VAR]');
  process.exit(2);
}

const verifier = resolveVerifier();
if (!verifier) refuse('no bsigner binary — build it first (cargo build --locked -p bsigner) and pass --verifier or set PROOF_LIGHTS_VERIFIER');
const { trust, errors: tErr } = loadTrust(TRUST_PATH);
if (tErr.length) refuse(`trust configuration does not validate:\n  - ${tErr.join('\n  - ')}`);

// the named skip: no seed, nothing to sign. The gate stays fully armed — an
// unsigned origin-ci document fails --check — so this is a pause, not a hole.
if (!process.env[SEED_ENV]) {
  console.log(`sign-badges: no ${SEED_ENV} in the environment — nothing to sign. (Founder gesture outstanding: the badge-signing environment secret. Unsigned origin-ci documents still fail the gate.)`);
  process.exit(0);
}

// the staged documents, sorted; *.source.json is evidence
const files = (await readdir(STAGE)).filter(f => f.endsWith('.json') && !f.endsWith('.source.json')).sort();
if (!files.length) refuse(`no status documents under ${STAGE}`);

// TRUST FIRST: sign one probe message to learn the seed's public identity
// (bsigner derives the key_id from the seed itself), then check the pin,
// validity and revocation before signing anything real.
const tmp = mkdtempSync(join(tmpdir(), 'sign-badges-'));
let keyId = null;
try {
  const probePath = join(tmp, 'probe.txt');
  writeFileSync(probePath, 'probe');   // throwaway bytes; only the key_id is read off the envelope
  const probeEnv = join(tmp, 'probe-envelope.json');
  try { execFileSync(verifier, ['sign', '--seed-env', SEED_ENV, '--alg', ALG, '--file', probePath, '--out', probeEnv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { refuse(`bsigner sign refused: ${(e.stdout || e.stderr || e.message).trim()}`); }
  keyId = JSON.parse(await readFile(probeEnv, 'utf8')).key_id;
  const key = trust.keys.find(k => k.key_id === keyId);
  if (!key) refuse(`the environment's key ${keyId} is not pinned in ${relative(ROOT, TRUST_PATH)} — a key the gate would refuse must never sign`);
  if (trust.revoked.includes(keyId)) refuse(`the environment's key ${keyId} is revoked`);
  const now = Date.now();
  if (now < Date.parse(key.valid_from) || now > Date.parse(key.valid_until)) refuse(`the environment's key ${keyId} is not valid now (${key.valid_from} .. ${key.valid_until})`);
  if (key.alg !== ALG) refuse(`the environment's key ${keyId} is ${key.alg}, this signer signs ${ALG}`);

  await mkdir(OUT, { recursive: true });
  const signed = [];
  for (const f of files) {
    const doc = JSON.parse(await readFile(join(STAGE, f), 'utf8'));
    // 1 HEAD BINDING: the run's own sha is the only revision this run can attest
    if (doc.revision !== EXPECT_SHA) refuse(`${f}: revision ${doc.revision} is not the run's head ${EXPECT_SHA} — refusing to bind a run to a revision it did not check out`);
    // 2 origin ci only: a local-origin document is an assertion, never attested
    if (!doc.measurement || doc.measurement.origin !== 'ci') refuse(`${f}: measurement origin is not ci — the signing job attests CI measurements only`);
    if (doc.signature !== null) refuse(`${f}: already carries a signature — refusing to re-sign`);
    // 3 GATE BEFORE INK: the unsigned document must already pass everything else
    const why = (await verify(doc, join(STAGE, f.replace(/\.json$/, '.source.json')), join(STAGE, f.replace(/\.json$/, '.svg')), { trust, ciUnsignedOk: true }))
      .filter(w => !/^svg /.test(w));
    if (why.length) refuse(`${f} fails the gate unsigned:\n  - ${why.join('\n  - ')}`);
    // sign the canonical bytes
    const msgPath = join(tmp, 'canonical.json'), envPath = join(tmp, 'envelope.json');
    writeFileSync(msgPath, canonicalBytes(doc));
    try { execFileSync(verifier, ['sign', '--seed-env', SEED_ENV, '--alg', ALG, '--file', msgPath, '--out', envPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { refuse(`bsigner sign refused on ${f}: ${(e.stdout || e.stderr || e.message).trim()}`); }
    const envelope = JSON.parse(await readFile(envPath, 'utf8'));
    const signedDoc = { ...doc, signature: envelope };
    // write the trio, then prove it: the signed document must pass the FULL gate
    await writeFile(join(OUT, f), serialise(signedDoc));
    await writeFile(join(OUT, f.replace(/\.json$/, '.svg')), render(signedDoc));
    await writeFile(join(OUT, f.replace(/\.json$/, '.source.json')), await readFile(join(STAGE, f.replace(/\.json$/, '.source.json'))));
    const after = (await verify(signedDoc, join(OUT, f.replace(/\.json$/, '.source.json')), join(OUT, f.replace(/\.json$/, '.svg')), { trust }))
      .filter(w => !/^svg /.test(w));
    if (after.length) refuse(`${f} fails the gate SIGNED (the signature is not written anywhere the gate refuses):\n  - ${after.join('\n  - ')}`);
    signed.push(f);
  }
  console.log(`sign-badges: ${signed.length} document(s) signed by ${keyId} (${ALG}), bound to ${EXPECT_SHA.slice(0, 7)}, written to ${OUT}`);
  for (const s of signed) console.log(`  signed ${s}`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
