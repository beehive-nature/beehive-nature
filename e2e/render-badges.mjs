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
//   DERIVED, NOT TYPED   every value in the SVG comes from docs/status/<name>.json,
//                        and every value in that document comes from an instrument's
//                        --json output plus the git revision it was measured at.
//   BOUND TO A REVISION  the message carries the short SHA the measurement was
//                        taken at ("… @5e03796"); a badge is a measurement, not a
//                        permanent property of the repository.
//   CHECKED IN CI        `--check` re-renders every status document and fails if
//                        the committed SVG differs: a hand-edited badge cannot ship.
//   EVIDENCE IN GIT      the instrument output is committed as <name>.source.json and
//                        the check verifies its git blob id equals the document's
//                        source_blob, so revision -> output -> document -> SVG resolves
//                        entirely inside the repository.
//   NOT SIGNED YET       the status document carries a `signature` slot; it stays
//                        null until the founder's key signs it. Unsigned is stated,
//                        never implied.
//
//   node render-badges.mjs meter --from meter.json --revision <sha>   # derive + render
//   node render-badges.mjs --check                                      # CI gate
//
// "Don't trust the badge — verify what generated it": each SVG links (via the
// README/surface markup, not inside the SVG) to its status document, and the
// document names the instrument, the revision and the CI job.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { makeBadge } = require('badge-maker');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATUS_DIR = join(ROOT, 'docs', 'status');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

/* ---- derivations: one per badge, each reads ONE instrument's JSON --------- */
const DERIVE = {
  // the skaists standards meter (e2e/skaists-conformance.mjs --json): rows of
  // {page, reg, total, score:{colour,type,radius,target,contrast,case}, bad}
  meter(rows, revision) {
    const pages = [...new Set(rows.map(r => r.page))];
    const total = rows.length;
    const at100 = rows.filter(r => r.total === 100).length;
    const min = Math.min(...rows.map(r => r.total));
    const kinds = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.score)) { kinds[k] ??= []; kinds[k].push(v); }
    const kindMin = Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, Math.min(...v)]));
    return {
      name: 'skaists-meter',
      label: 'skaists meter',
      instrument: 'e2e/skaists-conformance.mjs',
      ci_step: 'Skaists — the standards meter (three-UI fronts score 100%)',
      revision,
      surfaces: pages.length,
      fronts: total,             // page × register rows measured
      fronts_at_100: at100,
      min_score: min,
      kind_min: kindMin,
      // the message is numbers and a revision, never a tick: a measurement, not a property
      message: `${at100}/${total} fronts 100% @${revision.slice(0, 7)}`,
      color: at100 === total ? 'brightgreen' : min >= 90 ? 'yellow' : 'orange',
    };
  },
};

/* ---- the status document -> SVG, deterministic --------------------------- */
function render(doc) {
  return makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' });
}
// git's own blob id of the instrument output (40 hex): the same identifier git would give the
// file if it were committed, so the source can be checked with `git hash-object`.
const blobId = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

/* ---- modes ------------------------------------------------------------------ */
const mode = process.argv[2];
if (mode === '--check') {
  let fail = 0, n = 0;
  let files = [];
  try { files = (await readdir(STATUS_DIR)).filter(f => f.endsWith('.json') && !f.endsWith('.source.json')); } catch {}   // *.source.json is evidence, not a document
  if (!files.length) {
    // fail closed: a check that found nothing to check is not a pass (estate law, cf. secret-scan tree mode)
    console.error(`proof lights: REFUSING — no status documents under docs/status/. A check over zero badges is not a pass.`);
    process.exit(1);
  }
  for (const f of files) {
    n++;
    const doc = JSON.parse(await readFile(join(STATUS_DIR, f), 'utf8'));
    const svgPath = join(STATUS_DIR, f.replace(/\.json$/, '.svg'));
    const want = render(doc);
    let have = null;
    try { have = await readFile(svgPath, 'utf8'); } catch {}
    const ok = have === want;
    const rev = /^[0-9a-f]{40}$/.test(doc.revision || '');
    // the evidence link: when the instrument output is committed beside the document as
    // <name>.source.json, its git blob id must equal the document's source_blob — the chain
    // repo revision -> instrument output -> status document -> SVG then resolves entirely in git.
    let src = 'no source file committed';
    try {
      const bytes = await readFile(join(STATUS_DIR, f.replace(/\.json$/, '.source.json')));
      const id = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      src = id === doc.source_blob ? 'source blob matches' : `SOURCE BLOB MISMATCH (${id.slice(0, 7)} != ${String(doc.source_blob).slice(0, 7)})`;
      if (id !== doc.source_blob) fail++;
    } catch {}
    console.log(`${ok && rev ? 'PASS' : 'FAIL'} ${f}: "${doc.label} | ${doc.message}" ${ok ? 'svg == render(json)' : 'svg DIFFERS from render(json)'}${rev ? '' : ' · revision is not a full sha'} · ${src}${doc.signature ? '' : ' · unsigned (stated)'}`);
    if (!ok || !rev) fail++;
  }
  console.log(`proof lights: ${n - fail}/${n} badges are exactly what their status documents render`);
  process.exit(fail ? 1 : 0);
}

if (!DERIVE[mode]) { console.error('usage: render-badges.mjs <meter> --from <instrument.json> --revision <sha> | --check'); process.exit(2); }
const from = arg('from'); const revision = arg('revision');
if (!from || !/^[0-9a-f]{40}$/.test(revision || '')) { console.error('--from <json> and --revision <full 40-hex sha> are required'); process.exit(2); }
const rows = JSON.parse(await readFile(from, 'utf8'));
const derived = DERIVE[mode](rows, revision);
const source = await readFile(from);
const doc = {
  ...derived,
  measured_at: new Date().toISOString(),
  source_blob: blobId(source),   // git hash-object of the instrument's JSON as parsed
  renderer: `badge-maker ${JSON.parse(await readFile(join(ROOT, 'e2e', 'node_modules', 'badge-maker', 'package.json'), 'utf8')).version}`,
  signature: null,   // founder-key signature over this document's canonical bytes, when signed
  law: 'derived, not typed; bound to a revision; re-rendered and diffed in CI; unsigned until signed',
};
const jsonPath = join(STATUS_DIR, `${doc.name}.json`);
const svgPath = join(STATUS_DIR, `${doc.name}.svg`);
await writeFile(jsonPath, JSON.stringify(doc, null, 1) + '\n');
await writeFile(svgPath, render(doc));
console.log(`wrote ${jsonPath}\nwrote ${svgPath}\n${doc.label} | ${doc.message} (${doc.color})`);
