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
//       7 total rows ≠ expected
// on success prints the human-readable per-row view (kept — it is the
// receipt); every failure line names the row and the violated check
import { readFileSync } from 'node:fs';

const [specPath, wantTotal] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

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
  const v = Number(r.verified_at);
  if (s.verified === 'nonzero' && (!r.verified_at || v === 0)) {
    console.error('verified_at: seq ' + s.seq + ' is ' + r.verified_at + ' — a POSITIVE claim must carry a nonzero verified_at'); process.exit(6);
  }
  if (s.verified === 'zero' && r.verified_at && v !== 0) {
    console.error('verified_at: seq ' + s.seq + ' is ' + r.verified_at + ' — a REJECTED claim must remain unverified at the observation'); process.exit(6);
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
