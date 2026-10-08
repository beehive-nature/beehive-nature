// final_table_assert.mjs — turn the runner's final table read into
// ASSERTIONS (review order 2026-10-07: the v2 final section PRINTED the
// four positive and six negative rows without asserting them — a
// failure in the printing pipeline never incremented FAILS).
//
// argv: <spec.json-path> <expectedTotalRows>
//   spec: [{"seq":n,"root":"hex(no 0x)","kind":k,"count":n,
//           "verified":"nonzero"|"zero"}, ...]
// stdin: the FULL get_table response (readFileSync(0) — blocks to EOF;
// no stdin race)
// exit: 0 all asserted · 2 malformed · 3 transport · 4 row missing ·
//       5 field mismatch · 6 verified_at wrong for the claim's class ·
//       7 total rows ≠ expected · 8 spec unusable (unreadable, not an
//       array, empty, malformed entries, or duplicate seqs)
// on success prints the human-readable per-row view (kept — it is the
// receipt); every failure line names the row and the violated check
//
// MANDATORY COVERAGE (review order 4, 2026-10-07): an EMPTY spec once
// sailed through to the row-count check — "total rows: 27 == cap 27"
// graded green while NO claim was inspected: a check of nothing. The
// spec itself is now validated: unreadable, non-array, empty, malformed
// entries and duplicate seqs all fail BEFORE the table is looked at.
import { readFileSync } from 'node:fs';

const [specPath, wantTotal] = process.argv.slice(2);
let spec;
try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
catch (e) { console.error('spec: unreadable/malformed — ' + e.message); process.exit(8); }
if (!Array.isArray(spec) || spec.length === 0) {
  console.error('spec: EMPTY assertion coverage — refusing to grade a table on row count alone (a check of nothing)');
  process.exit(8);
}
const seen = new Set();
for (const s of spec) {
  if (!s || typeof s.seq !== 'number' || typeof s.root !== 'string' ||
      typeof s.kind !== 'number' || typeof s.count !== 'number' ||
      (s.verified !== 'zero' && s.verified !== 'nonzero')) {
    console.error('spec: malformed entry ' + JSON.stringify(s) + ' — coverage construction is checked, not assumed');
    process.exit(8);
  }
  if (seen.has(s.seq)) {
    console.error('spec: duplicate seq ' + s.seq + ' — each claim is asserted once');
    process.exit(8);
  }
  seen.add(s.seq);
}

let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch (e) {
  console.error('transport: stdin unreadable — ' + e.message); process.exit(3);
}
if (!raw.trim()) { console.error('transport: empty response body'); process.exit(3); }
let j;
try { j = JSON.parse(raw); } catch (e) {
  console.error('malformed: response is not JSON — ' + e.message); process.exit(2);
}
if (!j || !Array.isArray(j.rows)) { console.error('malformed: no rows array'); process.exit(2); }
const rows = j.rows;

for (const s of spec) {
  const r = rows.find(x => x.seq === s.seq);
  if (!r) { console.error('missing: seq ' + s.seq + ' absent from the table'); process.exit(4); }
  const hex = typeof r.root === 'string'
    ? r.root.replace(/^0x/, '')
    : Buffer.from(r.root).toString('hex');
  if (hex !== s.root) { console.error('mismatch: seq ' + s.seq + ' root ' + hex.slice(0, 12) + '… ≠ spec'); process.exit(5); }
  if (r.kind !== s.kind) { console.error('mismatch: seq ' + s.seq + ' kind ' + r.kind + ' ≠ ' + s.kind); process.exit(5); }
  if (r.count !== s.count) { console.error('mismatch: seq ' + s.seq + ' count ' + r.count + ' ≠ ' + s.count); process.exit(5); }
  const v = r.verified_at;
  // STRICT TIMESTAMP VALIDATION (review order 3, 2026-10-07): the field
  // must be PRESENT and a VALID uint32 ABI timestamp BEFORE any
  // positive-vs-zero assertion — truthiness/Number() coercion once let
  // a missing field, null, "not-a-timestamp" (NaN ≠ 0) and -1 all pass
  // against the class predicates. Missing, null, nonnumeric, negative
  // (and > 2^32−1) are state-NOT-established: fail.
  const tsValid = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4294967295;
  if (!tsValid) {
    console.error('verified_at: seq ' + s.seq + ' carries ' + JSON.stringify(v) +
      ' — not a valid uint32 timestamp; the claim\'s state is NOT established'); process.exit(6);
  }
  if (s.verified === 'nonzero' && v === 0) {
    console.error('verified_at: seq ' + s.seq + ' is 0 — a POSITIVE claim must carry a nonzero verified_at'); process.exit(6);
  }
  if (s.verified === 'zero' && v !== 0) {
    console.error('verified_at: seq ' + s.seq + ' is ' + v + ' — a REJECTED claim must be exactly 0 at the observation'); process.exit(6);
  }
}
if (rows.length !== Number(wantTotal)) {
  console.error('row-count: ' + rows.length + ' ≠ expected ' + wantTotal + ' (the exhaustion fixture must end exactly at cap)'); process.exit(7);
}

for (const s of spec) {
  const r = rows.find(x => x.seq === s.seq);
  console.log('  seq ' + s.seq + ' (' + s.kind + ',' + s.count + ') verified_at ' + r.verified_at +
    (s.verified === 'nonzero' ? '' : ' (unverified at this observation)'));
}
console.log('  total rows: ' + rows.length + ' == cap ' + wantTotal);
process.exit(0);
