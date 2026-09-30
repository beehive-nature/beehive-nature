// render-badges.mjs — PROOF LIGHTS, rendered at build time, never fetched at view time.
//
// The badge is a projection of a status document that a check already produced;
// nothing here measures anything. Shields' own renderer (the `badge-maker`
// package, the same code behind img.shields.io) runs offline in CI and writes
// a static SVG next to the status document. Today only the README shows it,
// from the repository itself; a surface that shows it later loads it
// same-origin, so the estate's rider law (design-acceptance I1: a cross-origin
// load at page-open is a FAIL) holds, and a page that says TELEMETRY NONE does
// not phone Cloudflare to say so.
//
// THE GATE (`--check`) re-derives, it does not re-read. Per document, in order,
// every failure collected and printed — a per-badge PASS means zero failures:
//   1 SCHEMA      the document has exactly the v2 fields, typed; its name is a
//                 known derivation.
//   2 REVISION    a full SHA that is a commit object in this repository (fetched
//                 at depth 1 if the clone is shallow) — not merely 40 hex chars.
//   3 MANIFEST    the page list is read from the workflow AT THAT REVISION (the
//                 CI step the document names), never from today's tree.
//   4 EVIDENCE    <name>.source.json must exist and be readable (a missing file is
//                 a FAIL, never "no source committed"); its git blob id equals
//                 source_blob (the repository locator) and its sha3-256 equals
//                 source_digest (the integrity commitment — SHA-1 is not one); it
//                 parses and every row is schema-valid.
//   5 COVERAGE    the rows cover manifest pages × registers exactly once each —
//                 a duplicated row cannot stand in for a missing one.
//   6 DERIVATION  every derived field (counts, minima, message, colour) is
//                 recomputed from the evidence and compared with the document.
//   7 PROVENANCE  origin "local" states the revision is the measurer's assertion
//                 (no run to bind it to). origin "ci" must carry run_id and
//                 run_attempt, and its proof is the CI-attestation signature
//                 (step 8): the signing job refuses any document whose revision
//                 differs from the run's own head_sha, so a valid signature over
//                 an origin-ci document IS the run-to-revision binding.
//   8 SIGNATURE   the unsigned representation is exactly `null` — for origin
//                 "local" only. An origin-ci document must be signed. A
//                 signature is a bheart.signature/1 envelope (bsigner, ML-DSA)
//                 verified against the keys pinned in docs/badge-trust.json —
//                 never a key carried inside the document — with key id,
//                 validity at signing time and revocation all checked. The
//                 signed byte string is the canonical serialization of the
//                 document with the signature field set to null (canonicalBytes
//                 below); the envelope's digest and byte count must match it.
//                 Without a verifier binary the check fails closed.
//   9 SVG         the committed SVG is byte-identical to render(document).
//
// A HISTORICAL MEASUREMENT, NOT LIVE STATUS: the message carries the revision
// measured ("… @7d6808d"). An older revision is legitimate; relabelling it as a
// later one is what origin "ci" + a signature makes detectable. A static SVG
// cannot go grey on its own; a badge claiming current health needs a freshness
// evaluator, which this is not.
//
//   node render-badges.mjs meter --from meter.json --revision <sha> --origin local [--measured-at <iso>]
//   node render-badges.mjs meter --from meter.json --revision <sha> --origin ci --run-id N --run-attempt M --stage <dir>
//   node render-badges.mjs --check [--dir <status dir>] [--trust <file>] [--verifier <bsigner>]   # CI gate
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { makeBadge } = require('badge-maker');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const STATUS_DIR = arg('dir', join(ROOT, 'docs', 'status'));
const SCHEMA = 'proof-lights/status/2';
const SHA = /^[0-9a-f]{40}$/;
const SHA3 = /^[0-9a-f]{64}$/;
// the digest is public (a hash of a committed public file); the repo's secret scan
// blocks 48+ hex runs unless the same line carries this marker, so the digest is
// serialised on one line with it — the reviewed public-data treatment, no path exemption.
const DIGEST_NOTE = 'PUBLIC-CONSTANT: sha3-256 of the committed public evidence file';

/* ---- trust: the pinned CI-attestation keys (never a key inside a document) -- */
// The card (docs/dispatches/2026-09-27-proof-lights-gate-repair.md): a reviewed
// file pins the trusted public key or keys — versioned key id, validity period,
// revocation list. Signature algorithms are bsigner's registry (crates/bsigner
// src/alg.rs), encoded verifying-key sizes per FIPS 204 parameter sets (pq.rs).
const TRUST_SCHEMA = 'proof-lights/trust/1';
const TRUST_PATH = arg('trust', join(ROOT, 'docs', 'badge-trust.json'));
// bsigner's registry (crates/bsigner/src/alg.rs) and FIPS 204 encoded sizes
// (pq.rs): verifying keys and signatures have DIFFERENT sizes per parameter set
const SIG_ALGS = { 'ml-dsa-44': 1312, 'ml-dsa-65': 1952, 'ml-dsa-87': 2592 };   // encoded verifying-key bytes
const SIG_BYTES = { 'ml-dsa-44': 2420, 'ml-dsa-65': 3309, 'ml-dsa-87': 4627 };  // encoded signature bytes
const KEY_ID = /^bheart-[A-Za-z0-9_-]{16}$/;   // keys.rs derive_key_id: 'bheart-' + 16 b64url chars
const B64U = /^[A-Za-z0-9_-]+$/;
const TRUST_KEY_FIELDS = ['key_id', 'alg', 'verifying_key_b64u', 'valid_from', 'valid_until', 'purpose', 'note'];
const TRUST_PURPOSE = 'ci-attestation';
const b64uBytes = s => { if (typeof s !== 'string' || !B64U.test(s)) return -1; try { return Buffer.from(s, 'base64url').length; } catch { return -1; } };
// strict loader: every field exact, every id well-formed, no duplicate or
// contradictory rows — a trust file this refuses is a configuration error,
// never a reason to fall back to trusting documents
export function loadTrust(path) {
  const e = [];
  let t = null;
  try { t = JSON.parse(readFileSync(path, 'utf8')); } catch { return { trust: null, errors: [`trust configuration ${relative(ROOT, path)} is missing or not JSON`] }; }
  if (!t || typeof t !== 'object' || Array.isArray(t)) return { trust: null, errors: ['trust configuration is not a JSON object'] };
  {
    const keys = Object.keys(t);
    const extra = keys.filter(k => !['schema', 'keys', 'revoked', 'law'].includes(k)), missing = ['schema', 'keys', 'revoked', 'law'].filter(k => !keys.includes(k));
    if (extra.length || missing.length) e.push(`trust fields: ${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' unknown ' + extra.join(',') : ''}`.trim());
    if (t.schema !== TRUST_SCHEMA) e.push(`trust schema is ${JSON.stringify(t.schema)}, want ${TRUST_SCHEMA}`);
  }
  if (!Array.isArray(t.keys)) e.push('trust keys is not an array');
  if (!Array.isArray(t.revoked)) e.push('trust revoked is not an array');
  if (typeof t.law !== 'string' || !t.law) e.push('trust law is not a string');
  const seen = new Set();
  if (Array.isArray(t.keys)) t.keys.forEach((k, i) => {
    const why = w => e.push(`trust key ${i}: ${w}`);
    if (!k || typeof k !== 'object' || Array.isArray(k)) return why('not an object');
    const kf = Object.keys(k);
    const extra = kf.filter(x => !TRUST_KEY_FIELDS.includes(x)), missing = TRUST_KEY_FIELDS.filter(x => !kf.includes(x));
    if (extra.length || missing.length) return why(`fields ${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' unknown ' + extra.join(',') : ''}`.trim());
    if (typeof k.key_id !== 'string' || !KEY_ID.test(k.key_id)) why(`key_id ${JSON.stringify(k.key_id)} is not bheart-<16 b64url chars>`);
    if (seen.has(k.key_id)) why(`key_id ${k.key_id} listed twice`); seen.add(k.key_id);
    if (typeof k.alg !== 'string' || !Object.hasOwn(SIG_ALGS, k.alg)) why(`alg ${JSON.stringify(k.alg)} is not in bsigner's signature registry`);
    else if (b64uBytes(k.verifying_key_b64u) !== SIG_ALGS[k.alg]) why(`verifying key is ${b64uBytes(k.verifying_key_b64u)} bytes, ${k.alg} encodes ${SIG_ALGS[k.alg]}`);
    if (typeof k.verifying_key_b64u !== 'string' || !B64U.test(k.verifying_key_b64u)) why('verifying_key_b64u is not base64url');
    for (const w of ['valid_from', 'valid_until']) if (!canonicalTime(k[w])) why(`${w} is not a canonical ISO-8601 UTC timestamp`);
    if (canonicalTime(k.valid_from) && canonicalTime(k.valid_until) && Date.parse(k.valid_from) > Date.parse(k.valid_until)) why('valid_from is after valid_until');
    if (k.purpose !== TRUST_PURPOSE) why(`purpose is ${JSON.stringify(k.purpose)}, want "${TRUST_PURPOSE}"`);
    if (typeof k.note !== 'string') why('note is not a string');
  });
  const rev = new Set();
  if (Array.isArray(t.revoked)) t.revoked.forEach((r, i) => {
    if (typeof r !== 'string' || !KEY_ID.test(r)) e.push(`trust revoked ${i}: ${JSON.stringify(r)} is not a key id`);
    else if (rev.has(r)) e.push(`trust revoked ${i}: ${r} listed twice`);
    else rev.add(r);   // a revoked key may stay pinned (see trust law): its public key remains known, its signatures all fail
  });
  return e.length ? { trust: null, errors: e } : { trust: t, errors: [] };
}
// the signer the gate shells out to for ML-DSA math; the gate never implements
// cryptography itself — one cited implementation (bsigner pq.rs), both directions
export function resolveVerifier() {
  const c = [arg('verifier'), process.env.PROOF_LIGHTS_VERIFIER,
    join(ROOT, 'target', 'debug', process.platform === 'win32' ? 'bsigner.exe' : 'bsigner'),
    join(ROOT, 'target', 'release', process.platform === 'win32' ? 'bsigner.exe' : 'bsigner')];
  return c.filter(Boolean).find(p => existsSync(p)) || null;
}

/* ---- git: the revision and the manifest are read from the repository --------- */
const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
function isCommit(rev) {
  const has = () => { try { return git('cat-file', '-t', rev).trim() === 'commit'; } catch { return false; } };
  if (has()) return true;
  try { git('fetch', '--no-tags', '--quiet', '--depth=1', 'origin', rev); } catch { return false; }   // shallow CI clone
  return has();
}
// the pages the CI step measured, from the workflow as it stood AT the measured revision
function manifestAt(rev, step) {
  const wf = git('show', `${rev}:.github/workflows/tests.yml`);
  const at = wf.indexOf(`- name: ${step}\n`);
  if (at < 0) throw new Error(`no step "${step}" in .github/workflows/tests.yml at ${rev.slice(0, 7)}`);
  const m = /\n\s+run: node skaists-conformance\.mjs --only (\S+)/.exec(wf.slice(at).split(/\n\s+- name: /)[0]);
  if (!m) throw new Error(`step "${step}" at ${rev.slice(0, 7)} has no --only page list`);
  return m[1].split(',');
}

/* ---- derivations: one per badge, each reads ONE instrument's JSON --------- */
const KINDS = ['COLOUR', 'TYPE', 'RADIUS', 'TARGET', 'CONTRAST', 'CASE'];
const REGS = ['bee', 'raver', 'cypherpunk'];
const pct = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const BADGES = {
  // the skaists standards meter (e2e/skaists-conformance.mjs --json): rows of
  // {page, reg, total, score:{COLOUR,TYPE,RADIUS,TARGET,CONTRAST,CASE}, bad}
  'skaists-meter': {
    label: 'skaists meter',
    instrument: 'e2e/skaists-conformance.mjs',
    ci_step: 'Skaists — the standards meter (three-UI fronts score 100%)',
    // every row well-formed; a {missing:true} row (no front on the page) is not a measurement
    rowErrors(rows) {
      if (!Array.isArray(rows)) return ['evidence is not an array of rows'];
      const e = [];
      rows.forEach((r, i) => {
        const bad = why => e.push(`row ${i}: ${why}`);
        if (!r || typeof r !== 'object' || Array.isArray(r)) return bad('not an object');
        if (Object.keys(r).sort().join() !== 'bad,page,reg,score,total') return bad(`fields ${Object.keys(r).sort().join()}`);
        if (typeof r.page !== 'string' || !r.page) bad('page');
        if (!REGS.includes(r.reg)) bad(`register ${JSON.stringify(r.reg)}`);
        if (!r.score || typeof r.score !== 'object' || Object.keys(r.score).sort().join() !== [...KINDS].sort().join() || !KINDS.every(k => pct(r.score[k]))) return bad('score is not the six kinds, each 0..100');
        // total is the pooled score over all checks, so it sits between the kind extremes
        const lo = Math.min(...KINDS.map(k => r.score[k])), hi = Math.max(...KINDS.map(k => r.score[k]));
        if (!pct(r.total) || r.total < lo - 0.1 || r.total > hi + 0.1) bad(`total ${r.total} outside its kinds [${lo}, ${hi}]`);
        if (!Array.isArray(r.bad) || !r.bad.every(s => typeof s === 'string')) bad('bad is not a list of strings');
        else if ((r.bad.length === 0) !== (r.total === 100)) bad(`total ${r.total} with ${r.bad.length} findings`);
        // no findings means every check passed (skaists-conformance.mjs ticks every failure into bad), so every kind is 100
        else if (r.bad.length === 0 && !KINDS.every(k => r.score[k] === 100)) bad(`all-clear row with a kind below 100 (${KINDS.filter(k => r.score[k] !== 100).join(',')})`);
      });
      return e;
    },
    coverageErrors(rows, pages) {
      const want = new Set(pages.flatMap(p => REGS.map(r => `${p} [${r}]`)));
      const seen = new Map();
      for (const r of rows) { const k = `${r.page} [${r.reg}]`; seen.set(k, (seen.get(k) || 0) + 1); }
      const e = [];
      if (new Set(pages).size !== pages.length) e.push('the manifest lists a page twice');
      for (const [k, n] of seen) { if (n > 1) e.push(`${k} measured ${n} times`); if (!want.has(k)) e.push(`${k} is not in the manifest`); }
      for (const k of want) if (!seen.has(k)) e.push(`${k} not measured`);
      return e.length > 6 ? [...e.slice(0, 6), `… ${e.length - 6} more`] : e;
    },
    derive(rows, revision) {
      const total = rows.length;
      const at100 = rows.filter(r => r.total === 100).length;
      const min = Math.min(...rows.map(r => r.total));
      return {
        surfaces: new Set(rows.map(r => r.page)).size,
        fronts: total,             // page × register rows measured
        fronts_at_100: at100,
        min_score: min,
        kind_min: Object.fromEntries(KINDS.map(k => [k, Math.min(...rows.map(r => r.score[k]))])),
        // the message is numbers and a revision, never a tick: a measurement, not a property
        message: `${at100}/${total} fronts 100% @${revision.slice(0, 7)}`,
        color: at100 === total ? 'brightgreen' : min >= 90 ? 'yellow' : 'orange',
      };
    },
  },
};

/* ---- the status document -> SVG, deterministic --------------------------- */
export function render(doc) {
  return makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' });
}
// git's own blob id (the repository locator) and the algorithm-tagged integrity digest
const blobId = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const sha3 = buf => createHash('sha3-256').update(buf).digest('hex');
// canonical ISO-8601 UTC that round-trips unchanged: Date.parse alone accepts '0' and rolls 2026-02-31 into March
const canonicalTime = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)) return false;
  const d = new Date(s);   // 2026-99-01 fits the shape but is an invalid date; toISOString would throw
  return !Number.isNaN(d.getTime()) && d.toISOString() === s;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const DOC_KEYS = ['schema', 'name', 'label', 'instrument', 'ci_step', 'revision', 'measurement', 'measured_at',
  'surfaces', 'fronts', 'fronts_at_100', 'min_score', 'kind_min', 'message', 'color',
  'source_blob', 'source_digest', 'renderer', 'signature', 'law'];
// fixed fields: derive writes exactly these, and the gate refuses anything else
const RENDERER = `badge-maker ${JSON.parse(await readFile(join(ROOT, 'e2e', 'node_modules', 'badge-maker', 'package.json'), 'utf8')).version}`;
const LAW = 'derived from committed evidence and re-derived in CI; bound to the revision measured; a historical measurement, not live status; unsigned until signed';
export const serialise = doc => JSON.stringify({ ...doc, source_digest: '\0SD\0' }, null, 1)
  .replace('"\\u0000SD\\u0000"', JSON.stringify(doc.source_digest)) + '\n';

// CANONICAL BYTES (the CI-signing card, scope item 1): the exact signed byte
// string of a status document is its canonical serialization — the fields in
// DOC_KEYS order, the source_digest one-line treatment serialise applies, a
// trailing newline — with the signature field set to null. The signer signs
// these bytes and nothing else; the verifier recomputes them from the parsed
// document, so a re-ordered or reformatted file cannot move the signed
// content, and the signature can never cover itself.
export const canonicalBytes = doc => {
  const o = {};
  for (const k of DOC_KEYS) o[k] = k === 'signature' ? null : doc[k];
  return Buffer.from(serialise(o));
};

// step 8's work: a bheart.signature/1 envelope verified against pinned trust.
// The gate does policy (key id, revocation, validity at signing time); bsigner
// does the ML-DSA math and the envelope's own digest/byte-count consistency
// over the canonical bytes — the gate never implements cryptography itself.
const ENVELOPE_FIELDS = ['type', 'alg', 'key_id', 'content', 'signature', 'signed_at_ms', 'agility'];
const AGILITY = 'verify dispatches on the alg fields above; unknown ids are refused, never defaulted';   // crates/bsigner/src/envelope.rs sign_envelope
function verifySignature(doc, trust) {
  const f = [];
  const sig = doc.signature;
  // shape first: exactly the envelope bsigner writes, nothing more
  if (!sig || typeof sig !== 'object' || Array.isArray(sig)) return ['signature is not a bheart.signature/1 envelope object'];
  {
    const kf = Object.keys(sig);
    const extra = kf.filter(k => !ENVELOPE_FIELDS.includes(k)), missing = ENVELOPE_FIELDS.filter(k => !kf.includes(k));
    if (extra.length || missing.length) f.push(`signature envelope fields: ${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' unknown ' + extra.join(',') : ''}`.trim());
    if (sig.type !== 'bheart.signature/1') f.push(`signature type is ${JSON.stringify(sig.type)}, want "bheart.signature/1"`);
    if (typeof sig.alg !== 'string' || !Object.hasOwn(SIG_ALGS, sig.alg)) f.push(`signature alg ${JSON.stringify(sig.alg)} is not in bsigner's signature registry`);
    if (typeof sig.key_id !== 'string' || !KEY_ID.test(sig.key_id)) f.push(`signature key_id ${JSON.stringify(sig.key_id)} is not bheart-<16 b64url chars>`);
    if (!Number.isInteger(sig.signed_at_ms) || sig.signed_at_ms < 0) f.push('signature signed_at_ms is not a non-negative integer');
    if (sig.agility !== AGILITY) f.push('signature agility statement is not the fixed statement bsigner writes');
    const c = sig.content, s2 = sig.signature;
    for (const [obj, name, fields] of [[c, 'content', ['bytes', 'digest']], [s2, 'signature', ['alg', 'b64u', 'bytes']]]) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { f.push(`signature ${name} is not an object`); continue; }
      const of_ = Object.keys(obj);
      const ex = of_.filter(k => !fields.includes(k)), mi = fields.filter(k => !of_.includes(k));
      if (ex.length || mi.length) f.push(`signature ${name} fields: ${mi.length ? 'missing ' + mi.join(',') : ''}${ex.length ? ' unknown ' + ex.join(',') : ''}`.trim());
    }
    if (c && typeof c === 'object') {
      if (!Number.isInteger(c.bytes) || c.bytes < 0) f.push('signature content.bytes is not a non-negative integer');
      // digest_envelope (bsigner envelope.rs): {alg, b64u, bytes} where bytes is
      // the length of the hashed message — the same count as content.bytes
      const d = c.digest;
      if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).length !== 3 || d.alg !== 'sha3-256' || typeof d.b64u !== 'string' || !B64U.test(d.b64u) || d.bytes !== c.bytes) f.push('signature content.digest is not {alg:"sha3-256", b64u, bytes:<content bytes>}');
    }
    if (s2 && typeof s2 === 'object') {
      if (typeof s2.alg !== 'string' || s2.alg !== sig.alg) f.push('signature.signature.alg disagrees with the envelope alg');
      if (typeof s2.b64u !== 'string' || !B64U.test(s2.b64u)) f.push('signature signature.b64u is not base64url');
      if (Object.hasOwn(SIG_BYTES, s2.alg) && s2.bytes !== SIG_BYTES[s2.alg]) f.push(`signature is ${s2.bytes} bytes, ${s2.alg} encodes ${SIG_BYTES[s2.alg]}`);
    }
    if (c && Number.isInteger(c.bytes)) {
      const want = canonicalBytes(doc).length;
      if (c.bytes !== want) f.push(`signature content.bytes is ${c.bytes}, the canonical document is ${want} bytes`);
    }
  }
  if (f.length) return f;   // shape failures alone: never hand a malformed envelope to the verifier
  // policy: pinned trust, never a key inside the document
  if (!trust || !Array.isArray(trust.keys)) return ['signature present but no valid trust configuration is loaded (fails closed)'];
  const key = trust.keys.find(k => k.key_id === sig.key_id);
  if (!key) return [`signature key_id ${sig.key_id} is not in the trust configuration`];
  if (trust.revoked.includes(sig.key_id)) return [`signature key ${sig.key_id} is revoked`];
  if (sig.alg !== key.alg) f.push(`signature alg ${sig.alg} disagrees with the trusted key's ${key.alg}`);
  const signedAt = sig.signed_at_ms, from = Date.parse(key.valid_from), until = Date.parse(key.valid_until);
  if (signedAt < from || signedAt > until) f.push(`signature key ${sig.key_id} was not valid at signing time (signed ${new Date(signedAt).toISOString()}, key valid ${key.valid_from} .. ${key.valid_until})`);
  // the math: bsigner verifies the envelope over the canonical bytes
  const verifier = resolveVerifier();
  if (!verifier) return [...f, 'signature verifier unavailable: build bsigner (cargo build --locked -p bsigner) and pass --verifier PATH or set PROOF_LIGHTS_VERIFIER (fails closed)'];
  const tmp = mkdtempSync(join(tmpdir(), 'proof-lights-sig-'));
  try {
    const msgPath = join(tmp, 'canonical.json'), envPath = join(tmp, 'envelope.json'), vkPath = join(tmp, 'vk.b64u');
    writeFileSync(msgPath, canonicalBytes(doc));
    writeFileSync(envPath, JSON.stringify(sig, null, 1) + '\n');
    writeFileSync(vkPath, key.verifying_key_b64u + '\n');
    let out = '';
    try { out = execFileSync(verifier, ['verify-env', '--file', msgPath, '--envelope', envPath, '--verifying-key-file', vkPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (err) { out = `${err.stdout || ''}${err.stderr || ''}`; }
    let verdict = null;
    try { verdict = JSON.parse(out); } catch { /* not JSON */ }
    if (!verdict || verdict.verified !== true) f.push(`signature does not verify (${verdict && verdict.reason ? verdict.reason : 'bsigner verify-env gave no verdict'})`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return f;
}

// everything the gate proves about one document; returns the failures (empty = PASS)
// opts.trust — the loaded trust configuration (required to verify any signature)
// opts.ciUnsignedOk — derive mode, staging an origin-ci document for signing: the
//   signature is the NEXT step's work, so its absence is expected, not a failure
export async function verify(doc, evidencePath, svgPath, opts = {}) {
  const f = [];
  // 1 SCHEMA
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['document is not a JSON object'];
  const keys = Object.keys(doc);
  const extra = keys.filter(k => !DOC_KEYS.includes(k)), missing = DOC_KEYS.filter(k => !keys.includes(k));
  if (extra.length || missing.length) f.push(`schema: ${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' unknown ' + extra.join(',') : ''}`.trim());
  if (doc.schema !== SCHEMA) f.push(`schema is ${JSON.stringify(doc.schema)}, want ${SCHEMA}`);
  const B = Object.hasOwn(BADGES, doc.name) ? BADGES[doc.name] : undefined;   // own keys only: 'constructor' is not a badge
  if (!B) return [...f, `no derivation for badge ${JSON.stringify(doc.name)}`];
  for (const k of ['label', 'instrument', 'ci_step']) if (doc[k] !== B[k]) f.push(`${k} is not the derivation's`);
  if (doc.renderer !== RENDERER) f.push(`renderer is ${JSON.stringify(doc.renderer)}, the installed renderer is ${RENDERER}`);
  if (doc.law !== LAW) f.push('law is not the fixed statement the renderer writes');
  // 2 REVISION
  const revOk = typeof doc.revision === 'string' && SHA.test(doc.revision) && isCommit(doc.revision);
  if (!revOk) f.push(`revision ${JSON.stringify(doc.revision)} is not a commit in this repository`);
  // 3 MANIFEST
  let pages = null;
  if (revOk) { try { pages = manifestAt(doc.revision, B.ci_step); } catch (e) { f.push(`manifest: ${e.message}`); } }
  // 4 EVIDENCE
  let rows = null, parsed = false, derived = false;
  let bytes = null;
  try { bytes = await readFile(evidencePath); } catch { f.push(`evidence ${relative(ROOT, evidencePath)} is missing or unreadable`); }
  if (bytes) {
    const id = blobId(bytes), d = sha3(bytes);
    if (id !== doc.source_blob) f.push(`source blob mismatch (${id.slice(0, 7)} != ${String(doc.source_blob).slice(0, 7)})`);
    const sd = doc.source_digest;
    if (!sd || sd.alg !== 'sha3-256' || !SHA3.test(sd.value || '') || sd.note !== DIGEST_NOTE || Object.keys(sd).length !== 3) f.push('source_digest is not {alg:"sha3-256", value, note}');
    else if (sd.value !== d) f.push(`source digest mismatch (sha3-256 ${d.slice(0, 7)} != ${sd.value.slice(0, 7)})`);
    try { rows = JSON.parse(bytes.toString('utf8')); parsed = true; } catch { f.push('evidence is not JSON'); }
    // every parsed value goes through the row law, JSON null included: null is not "no evidence to check"
    if (parsed) { const e = B.rowErrors(rows); if (e.length) { f.push(...e.slice(0, 6).map(x => 'evidence ' + x)); rows = null; } else if (!rows.length) { f.push('evidence has no rows'); rows = null; } }
  }
  // 5 COVERAGE
  if (rows && pages) f.push(...B.coverageErrors(rows, pages).map(x => 'coverage: ' + x));
  // 6 DERIVATION
  if (rows && revOk) { derived = true; for (const [k, v] of Object.entries(B.derive(rows, doc.revision))) if (!same(doc[k], v)) f.push(`${k} is ${JSON.stringify(doc[k])}, evidence derives ${JSON.stringify(v)}`); }
  // fail closed: a PASS requires that coverage and derivation actually ran, whatever path skipped them
  if (!derived || !pages) f.push('the document was not re-derived from its evidence (fails closed)');
  // 7 PROVENANCE
  const m = doc.measurement;
  if (!m || typeof m !== 'object') f.push('measurement provenance missing');
  else if (m.origin === 'local') { if (m.run_id !== null || m.run_attempt !== null || Object.keys(m).length !== 3) f.push('measurement origin local must be exactly {origin, run_id: null, run_attempt: null}'); }
  else if (m.origin === 'ci') {
    if (Object.keys(m).length !== 3) f.push('measurement origin ci must be exactly {origin, run_id, run_attempt}');
    else {
      const id = Number.isInteger(m.run_id) && m.run_id > 0, at = Number.isInteger(m.run_attempt) && m.run_attempt > 0;
      if (!id || !at) f.push(`measurement origin ci carries run ${JSON.stringify(m.run_id)} attempt ${JSON.stringify(m.run_attempt)} — both must be positive integers`);
    }
  }
  else f.push(`measurement origin ${JSON.stringify(m.origin)} is neither local nor ci`);
  if (!canonicalTime(doc.measured_at)) f.push(`measured_at ${JSON.stringify(doc.measured_at)} is not a canonical ISO-8601 UTC timestamp (YYYY-MM-DDTHH:MM:SS.sssZ)`);
  // 8 SIGNATURE — verified against the pinned trust, never a key inside the document
  if (doc.signature === null) {
    // the unsigned representation is exactly null; for origin ci that is only
    // acceptable mid-pipeline (derive staging the document for the signing job)
    if (m && m.origin === 'ci' && !opts.ciUnsignedOk) f.push('measurement origin ci requires a signature: without one, the run-to-revision binding is unproven');
  } else if (m && m.origin === 'local') {
    f.push('origin local documents are unsigned by definition; a signature on a measurer-asserted document attests nothing');
  } else {
    f.push(...verifySignature(doc, opts.trust));
  }
  // 9 SVG
  let have = null;
  try { have = await readFile(svgPath, 'utf8'); } catch {}
  let want = null;
  try { want = render(doc); } catch (e) { f.push(`render failed: ${e.message}`); }
  if (want !== null && have !== want) f.push(have === null ? 'svg missing' : 'svg DIFFERS from render(json)');
  return f;
}

/* ---- modes ------------------------------------------------------------------ */
// run as a script only when invoked directly; e2e/sign-badges.mjs imports the
// canonical-bytes and trust laws instead of re-stating them (one law, one copy)
const samePath = (a, b) => { try { return realpathSync(a).toLowerCase() === realpathSync(b).toLowerCase(); } catch { return false; } };
const isMain = !!process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url));
if (isMain) {
const mode = process.argv[2];
if (mode === '--check') {
  let fail = 0, n = 0;
  // the trust configuration is part of the gate, not of any document: load it
  // strictly, and refuse the whole check if it does not validate
  const { trust, errors: tErr } = loadTrust(TRUST_PATH);
  if (tErr.length) {
    console.error(`proof lights: REFUSING — trust configuration ${relative(ROOT, TRUST_PATH)} does not validate:\n  - ${tErr.join('\n  - ')}`);
    process.exit(1);
  }
  const nKeys = trust.keys.length, nRevoked = trust.revoked.length;
  let files = [];
  try { files = (await readdir(STATUS_DIR)).filter(f => f.endsWith('.json') && !f.endsWith('.source.json')).sort(); } catch {}   // *.source.json is evidence, not a document
  // an SVG or evidence file with no status document beside it is an unchecked badge: refuse it
  let all = [];
  try { all = await readdir(STATUS_DIR); } catch {}
  const orphans = all.filter(x => (x.endsWith('.svg') || x.endsWith('.source.json')) && !files.includes(x.replace(/(\.source\.json|\.svg)$/, '.json')));
  if (!files.length) {
    // fail closed: a check that found nothing to check is not a pass (estate law, cf. secret-scan tree mode)
    console.error(`proof lights: REFUSING — no status documents under ${relative(ROOT, STATUS_DIR) || STATUS_DIR}. A check over zero badges is not a pass.`);
    process.exit(1);
  }
  for (const f of files) {
    n++;
    let doc = null, why = [];
    try { doc = JSON.parse(await readFile(join(STATUS_DIR, f), 'utf8')); } catch { why = ['document is not JSON']; }
    if (!why.length && (doc === null || typeof doc !== 'object' || Array.isArray(doc))) { why = ['document is not a JSON object']; doc = null; }
    // one malformed document must never abort the check of the rest: an unexpected throw is that badge's FAIL
    if (doc !== null) {
      try { why = await verify(doc, join(STATUS_DIR, f.replace(/\.json$/, '.source.json')), join(STATUS_DIR, f.replace(/\.json$/, '.svg')), { trust }); }
      catch (e) { why = [`checker error (fails closed): ${e.message}`]; }
      // the published paths are the badge's identity: <name>.json/.source.json/.svg, never a renamed or swapped trio
      if (f !== `${doc.name}.json`) why.unshift(`file ${f} does not carry the document's name ${JSON.stringify(doc.name)}`);
    }
    const head = doc && typeof doc === 'object' ? `"${doc.label} | ${doc.message}"` : '';
    if (why.length) { fail++; console.log(`FAIL ${f}: ${head}\n  - ${why.join('\n  - ')}`); }
    else {
      const provenance = doc.measurement.origin === 'ci'
        ? `origin ci (run ${doc.measurement.run_id} attempt ${doc.measurement.run_attempt}; the CI-attestation signature binds them to ${doc.revision.slice(0, 7)}) · signed by ${doc.signature.key_id} (${doc.signature.alg}, valid at signing time, not revoked)`
        : `origin ${doc.measurement.origin} (revision asserted by the measurer, not attested) · unsigned (stated)`;
      console.log(`PASS ${f}: ${head} · re-derived from ${doc.fronts} evidence rows at ${doc.revision.slice(0, 7)} · source blob + sha3-256 match · svg == render(json) · ${provenance}`);
    }
  }
  for (const o of orphans) console.log(`FAIL ${o}: no status document ${o.replace(/(\.source\.json|\.svg)$/, '.json')} beside it — an unchecked badge`);
  console.log(`proof lights: ${n - fail}/${n} badges re-derive from their evidence and render exactly${orphans.length ? `; ${orphans.length} orphan file(s) refused` : ''} · trust: ${nKeys} pinned key(s), ${nRevoked} revoked`);
  process.exit(fail || orphans.length ? 1 : 0);
}

const B = mode === 'meter' ? BADGES['skaists-meter'] : undefined;
if (!B) { console.error('usage: render-badges.mjs meter --from <instrument.json> --revision <sha> --origin local [--measured-at <iso>] | meter --from <instrument.json> --revision <sha> --origin ci --run-id N --run-attempt M --stage <dir> | --check [--dir <dir>] [--trust <file>] [--verifier <bsigner>]'); process.exit(2); }
const from = arg('from'), revision = arg('revision'), origin = arg('origin');
if (!from || !SHA.test(revision || '')) { console.error('--from <json> and --revision <full 40-hex sha> are required'); process.exit(2); }
const runId = Number(arg('run-id', '')), runAttempt = Number(arg('run-attempt', ''));
if (origin !== 'local' && origin !== 'ci') { console.error('--origin must be local or ci'); process.exit(2); }
// ci origin: the run id and attempt are what the CI-attestation signature will
// bind to the revision; both are required up front, and the staged document is
// signed by e2e/sign-badges.mjs — which refuses any revision mismatch — before
// it can pass a gate
if (origin === 'ci' && (!Number.isInteger(runId) || runId <= 0 || !Number.isInteger(runAttempt) || runAttempt <= 0)) { console.error('--origin ci needs --run-id N and --run-attempt M (positive integers)'); process.exit(2); }
const stage = arg('stage');
if (origin === 'ci' && !stage) { console.error('--origin ci needs --stage <dir>: the unsigned document is staged for the signing job, never written straight into docs/status'); process.exit(2); }
if (origin === 'local' && stage) { console.error('--stage is for --origin ci staging only'); process.exit(2); }
const source = await readFile(from);
const doc = {
  schema: SCHEMA,
  name: 'skaists-meter', label: B.label, instrument: B.instrument, ci_step: B.ci_step,
  revision,
  measurement: origin === 'ci' ? { origin: 'ci', run_id: runId, run_attempt: runAttempt } : { origin: 'local', run_id: null, run_attempt: null },
  measured_at: arg('measured-at', new Date().toISOString()),
  ...B.derive(JSON.parse(source.toString('utf8')), revision),
  source_blob: blobId(source),   // git hash-object of the instrument's JSON: where it lives
  source_digest: { alg: 'sha3-256', value: sha3(source), note: DIGEST_NOTE },   // what it is
  renderer: RENDERER,
  signature: null,   // unsigned here; the signing job replaces this with the bheart.signature/1 envelope over the canonical bytes
  law: LAW,
};
const outDir = stage || STATUS_DIR;
const jsonPath = join(outDir, `${doc.name}.json`);
const svgPath = join(outDir, `${doc.name}.svg`);
const evPath = join(outDir, `${doc.name}.source.json`);
if (stage) {
  // staging (origin ci): write the evidence beside the document so the pair
  // travels as one artifact to the signing job and then to docs/status —
  // the local hand-flow's "evidence already committed" precondition does not
  // apply to a measurement that has just been made
  const { mkdir } = await import('node:fs/promises');
  await mkdir(stage, { recursive: true });
  await writeFile(evPath, source);
} else
  // derive refuses what the gate would refuse: the evidence must already be committed beside the document
  if (!(await readFile(evPath).then(b => b.equals(source), () => false))) { console.error(`copy the evidence to ${relative(ROOT, evPath)} first (byte-exact)`); process.exit(2); }
const why = await verify(doc, evPath, null, { ciUnsignedOk: origin === 'ci' });
const fatal = why.filter(w => !/^svg /.test(w));
if (fatal.length) { console.error(`refusing to write ${doc.name}:\n  - ${fatal.join('\n  - ')}`); process.exit(1); }
await writeFile(jsonPath, serialise(doc));
await writeFile(svgPath, render(doc));
console.log(`wrote ${jsonPath}\nwrote ${svgPath}\nwrote ${evPath}${stage ? ' (staged for signing)' : ''}\n${doc.label} | ${doc.message} (${doc.color})`);
}   // isMain
