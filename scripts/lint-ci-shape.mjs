// lint-ci-shape.mjs — the workflow asserting its own shape.
//
// GATE RULING (zA, 2026-08-24, run 32795535023): a sibling red SKIPPED the
// two detection steps (forge-freeze, §7) below a guarded trio — inside a
// commit claiming "every suite fires every run." The class fix is not two
// lines: EVERY suite step carries `if: always()`, and THIS check fails the
// run if any step with a `run:` lacks it, so the next step someone adds
// cannot reintroduce the gap invisibly — which is exactly what happened.
//
// EXEMPTIONS are infra, not suites, and each carries its reason here:
//   - "shared setup — install (exempt from always())" : the install step;
//     when IT fails, every always() suite still fires and fails noisily
//     with the missing dependency — visible, attributable, never skipped.
//   - uses:-only steps (checkout, setup-node, caches) have no run: at all.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const YML = join(HERE, '..', '.github', 'workflows', 'tests.yml');
const EXEMPT = new Set([
  'shared setup — install (exempt from always())',   // node job: npm ci + chromium
  'Build workspace'                                   // test job: cargo build — the
                                                      // suites after it need the bins
]);

const text = await readFile(YML, 'utf8');
const lines = text.split('\n');

// collect steps: a step starts at "      - name:" (or "- uses:"); capture
// until the next step at the same indent within the same job
const steps = [];
let cur = null;
for (const l of lines) {
  const m = l.match(/^(\s*)- name:\s*(.+?)\s*$/);
  if (m) { if (cur) steps.push(cur); cur = { name: m[2], lines: [] }; continue; }
  if (/^(\s*)- uses:/.test(l)) { if (cur) steps.push(cur); cur = null; continue; }
  if (cur) cur.lines.push(l);
}
if (cur) steps.push(cur);

// THE STATIC JOB DECLARES NO needs: (zA completion ruling, 2026-08-24): its
// immunity to a sibling suite red is one line from being lost the first time
// someone orders it after the node job. Asserted here so that line cannot
// land invisibly. Fails closed if the static job cannot be found.
let bad = 0, checked = 0;
{
  const m = text.match(/^  static:\n([\s\S]*?)(?=^  [a-z]+:|\Z)/m);
  if (!m) { console.log('FAIL static job not found — could-not-compute fails closed'); bad++; }
  else if (/^\s*needs:/.test(m[1])) { console.log('FAIL static job declares needs: — its immunity to sibling reds is one ordering away from being lost'); bad++; }
  else console.log('PASS static job declares no needs: — structurally immune to sibling reds');
}
for (const s of steps) {
  const hasRun = s.lines.some(l => /^\s*run:/.test(l));
  if (!hasRun) continue;                    // uses:-only step, not a suite
  checked++;
  const hasAlways = s.lines.some(l => /^\s*if:\s*always\(\)/.test(l));
  const exempt = EXEMPT.has(s.name);
  if (!hasAlways && !exempt) {
    bad++;
    console.log(`FAIL no if:always() — "${s.name}" (a sibling red can SKIP this step)`);
  } else {
    console.log(`PASS ${exempt ? 'exempt-infra' : 'always()'} — "${s.name}"`);
  }
}
if (checked === 0) { console.log('FAIL shape check read ZERO suite steps — a parse regression is a could-not-compute, and this check fails closed'); process.exit(1); }
console.log(`\n${checked - bad}/${checked} suite steps guarded — ${bad ? 'FIX BEFORE PUSH' : 'every suite fires every run, now provably'}`);
process.exit(bad ? 1 : 0);
