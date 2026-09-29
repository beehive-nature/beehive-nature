// render-badges.mjs — PROOF LIGHTS, rendered at build time, never fetched at view time.
//
// The badge is a projection of a status document that a check already produced;
// nothing here measures anything. Shields' own renderer (the `badge-maker`
// package, the same code behind img.shields.io) runs offline in CI and writes
// a static SVG next to the status document. Surfaces and the README load that
// SVG same-origin, so the estate's rider law (design-acceptance I1: a
// cross-origin load at page-open is a FAIL) holds, and a page that says
// TELEMETRY NONE does not phone Cloudflare to say so.
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
//                 (no run to bind it to); origin "ci" needs its run id + attempt
//                 bound to the revision, which nothing here can verify yet, so it
//                 FAILS until the CI-signing card lands.
//   8 SIGNATURE   the unsigned representation is exactly `null`. Any supplied value
//                 FAILS as unverified: no verifier exists yet, and a signature
//                 nothing checks is a typed claim.
//   9 SVG         the committed SVG is byte-identical to render(document).
//
// A HISTORICAL MEASUREMENT, NOT LIVE STATUS: the message carries the revision
// measured ("… @7d6808d"). An older revision is legitimate; relabelling it as a
// later one is what origin "ci" + a signature will make detectable. A static SVG
// cannot go grey on its own; a badge claiming current health needs a freshness
// evaluator, which this is not.
//
//   node render-badges.mjs meter --from meter.json --revision <sha> --origin local [--measured-at <iso>]
//   node render-badges.mjs --check [--dir <status dir>]                  # CI gate
import { readFile, writeFile, readdir } from 'node:fs/promises';
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
function render(doc) {
  return makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' });
}
// git's own blob id (the repository locator) and the algorithm-tagged integrity digest
const blobId = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const sha3 = buf => createHash('sha3-256').update(buf).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DOC_KEYS = ['schema', 'name', 'label', 'instrument', 'ci_step', 'revision', 'measurement', 'measured_at',
  'surfaces', 'fronts', 'fronts_at_100', 'min_score', 'kind_min', 'message', 'color',
  'source_blob', 'source_digest', 'renderer', 'signature', 'law'];
// fixed fields: derive writes exactly these, and the gate refuses anything else
const RENDERER = `badge-maker ${JSON.parse(await readFile(join(ROOT, 'e2e', 'node_modules', 'badge-maker', 'package.json'), 'utf8')).version}`;
const LAW = 'derived from committed evidence and re-derived in CI; bound to the revision measured; a historical measurement, not live status; unsigned until signed';
const serialise = doc => JSON.stringify({ ...doc, source_digest: '\0SD\0' }, null, 1)
  .replace('"\\u0000SD\\u0000"', JSON.stringify(doc.source_digest)) + '\n';

// everything the gate proves about one document; returns the failures (empty = PASS)
async function verify(doc, evidencePath, svgPath) {
  const f = [];
  // 1 SCHEMA
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['document is not a JSON object'];
  const keys = Object.keys(doc);
  const extra = keys.filter(k => !DOC_KEYS.includes(k)), missing = DOC_KEYS.filter(k => !keys.includes(k));
  if (extra.length || missing.length) f.push(`schema: ${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' unknown ' + extra.join(',') : ''}`.trim());
  if (doc.schema !== SCHEMA) f.push(`schema is ${JSON.stringify(doc.schema)}, want ${SCHEMA}`);
  const B = BADGES[doc.name];
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
  let rows = null;
  let bytes = null;
  try { bytes = await readFile(evidencePath); } catch { f.push(`evidence ${relative(ROOT, evidencePath)} is missing or unreadable`); }
  if (bytes) {
    const id = blobId(bytes), d = sha3(bytes);
    if (id !== doc.source_blob) f.push(`source blob mismatch (${id.slice(0, 7)} != ${String(doc.source_blob).slice(0, 7)})`);
    const sd = doc.source_digest;
    if (!sd || sd.alg !== 'sha3-256' || !SHA3.test(sd.value || '') || sd.note !== DIGEST_NOTE || Object.keys(sd).length !== 3) f.push('source_digest is not {alg:"sha3-256", value, note}');
    else if (sd.value !== d) f.push(`source digest mismatch (sha3-256 ${d.slice(0, 7)} != ${sd.value.slice(0, 7)})`);
    try { rows = JSON.parse(bytes.toString('utf8')); } catch { f.push('evidence is not JSON'); }
    if (rows !== null) { const e = B.rowErrors(rows); if (e.length) { f.push(...e.slice(0, 6).map(x => 'evidence ' + x)); rows = null; } else if (!rows.length) { f.push('evidence has no rows'); rows = null; } }
  }
  // 5 COVERAGE
  if (rows && pages) f.push(...B.coverageErrors(rows, pages).map(x => 'coverage: ' + x));
  // 6 DERIVATION
  if (rows && revOk) for (const [k, v] of Object.entries(B.derive(rows, doc.revision))) if (!same(doc[k], v)) f.push(`${k} is ${JSON.stringify(doc[k])}, evidence derives ${JSON.stringify(v)}`);
  // 7 PROVENANCE
  const m = doc.measurement;
  if (!m || typeof m !== 'object') f.push('measurement provenance missing');
  else if (m.origin === 'local') { if (m.run_id !== null || m.run_attempt !== null || Object.keys(m).length !== 3) f.push('measurement origin local must be exactly {origin, run_id: null, run_attempt: null}'); }
  else if (m.origin === 'ci') f.push(`measurement origin ci (run ${m.run_id} attempt ${m.run_attempt}): run binding to the revision is not verifiable yet — FAIL until the CI-signing card`);
  else f.push(`measurement origin ${JSON.stringify(m.origin)} is neither local nor ci`);
  if (typeof doc.measured_at !== 'string' || Number.isNaN(Date.parse(doc.measured_at))) f.push('measured_at is not a timestamp');
  // 8 SIGNATURE
  if (doc.signature !== null) f.push('signature supplied but no verifier exists: UNVERIFIED');
  // 9 SVG
  let have = null;
  try { have = await readFile(svgPath, 'utf8'); } catch {}
  let want = null;
  try { want = render(doc); } catch (e) { f.push(`render failed: ${e.message}`); }
  if (want !== null && have !== want) f.push(have === null ? 'svg missing' : 'svg DIFFERS from render(json)');
  return f;
}

/* ---- modes ------------------------------------------------------------------ */
const mode = process.argv[2];
if (mode === '--check') {
  let fail = 0, n = 0;
  let files = [];
  try { files = (await readdir(STATUS_DIR)).filter(f => f.endsWith('.json') && !f.endsWith('.source.json')).sort(); } catch {}   // *.source.json is evidence, not a document
  if (!files.length) {
    // fail closed: a check that found nothing to check is not a pass (estate law, cf. secret-scan tree mode)
    console.error(`proof lights: REFUSING — no status documents under ${relative(ROOT, STATUS_DIR) || STATUS_DIR}. A check over zero badges is not a pass.`);
    process.exit(1);
  }
  for (const f of files) {
    n++;
    let doc = null, why = [];
    try { doc = JSON.parse(await readFile(join(STATUS_DIR, f), 'utf8')); } catch { why = ['document is not JSON']; }
    if (doc !== null) why = await verify(doc, join(STATUS_DIR, f.replace(/\.json$/, '.source.json')), join(STATUS_DIR, f.replace(/\.json$/, '.svg')));
    const head = doc && typeof doc === 'object' ? `"${doc.label} | ${doc.message}"` : '';
    if (why.length) { fail++; console.log(`FAIL ${f}: ${head}\n  - ${why.join('\n  - ')}`); }
    else console.log(`PASS ${f}: ${head} · re-derived from ${doc.fronts} evidence rows at ${doc.revision.slice(0, 7)} · source blob + sha3-256 match · svg == render(json) · origin ${doc.measurement.origin} (revision asserted by the measurer, not attested) · unsigned (stated)`);
  }
  console.log(`proof lights: ${n - fail}/${n} badges re-derive from their evidence and render exactly`);
  process.exit(fail ? 1 : 0);
}

const B = { meter: BADGES['skaists-meter'] }[mode];
if (!B) { console.error('usage: render-badges.mjs meter --from <instrument.json> --revision <sha> --origin local [--measured-at <iso>] | --check [--dir <dir>]'); process.exit(2); }
const from = arg('from'), revision = arg('revision'), origin = arg('origin');
if (!from || !SHA.test(revision || '')) { console.error('--from <json> and --revision <full 40-hex sha> are required'); process.exit(2); }
// ci origin arrives with the CI-signing card, which can bind run id + attempt to the revision
if (origin !== 'local') { console.error('--origin local is required (ci-origin documents need the CI-signing card)'); process.exit(2); }
const source = await readFile(from);
const doc = {
  schema: SCHEMA,
  name: 'skaists-meter', label: B.label, instrument: B.instrument, ci_step: B.ci_step,
  revision,
  measurement: { origin: 'local', run_id: null, run_attempt: null },
  measured_at: arg('measured-at', new Date().toISOString()),
  ...B.derive(JSON.parse(source.toString('utf8')), revision),
  source_blob: blobId(source),   // git hash-object of the instrument's JSON: where it lives
  source_digest: { alg: 'sha3-256', value: sha3(source), note: DIGEST_NOTE },   // what it is
  renderer: RENDERER,
  signature: null,   // unsigned, stated; a CI-attestation key signs this document when that card lands
  law: LAW,
};
const jsonPath = join(STATUS_DIR, `${doc.name}.json`);
const svgPath = join(STATUS_DIR, `${doc.name}.svg`);
const evPath = join(STATUS_DIR, `${doc.name}.source.json`);
// derive refuses what the gate would refuse: the evidence must already be committed beside the document
if (!(await readFile(evPath).then(b => b.equals(source), () => false))) { console.error(`copy the evidence to ${relative(ROOT, evPath)} first (byte-exact)`); process.exit(2); }
const why = await verify(doc, evPath, null);
const fatal = why.filter(w => !/^svg /.test(w));
if (fatal.length) { console.error(`refusing to write ${doc.name}:\n  - ${fatal.join('\n  - ')}`); process.exit(1); }
await writeFile(jsonPath, serialise(doc));
await writeFile(svgPath, render(doc));
console.log(`wrote ${jsonPath}\nwrote ${svgPath}\n${doc.label} | ${doc.message} (${doc.color})`);
