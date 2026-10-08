// reconcile_row.mjs — the ONE reconciliation parser for the zkrself*
// runners and their fixture tests (review 2026-10-07: the inline
// `JSON.parse(process.stdin.read())` form raced its own stdin — read()
// returns null when nothing is buffered yet, which produced
// "Cannot read properties of null (reading 'rows')" against VALID
// responses and starved seven refusal legs into INCONCLUSIVE; the
// provider-throttling theory for those nulls is UNVERIFIED — the local
// race fully explains them). readFileSync(0) BLOCKS until stdin
// reaches EOF: the race is structurally gone, not retried away.
//
// argv: <seq> <rootHex(no 0x)> <kind> <count>   — stdin: get_table JSON
// exit: 0 visible-and-exact · 2 malformed · 3 transport-empty ·
//       4 row missing · 5 field mismatch
// diagnostics go to stderr so the caller can classify, not guess
import { readFileSync } from 'node:fs';

const [seq, rootHex, kind, count] = process.argv.slice(2);
let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch (e) {
  console.error('transport: stdin unreadable — ' + e.message);
  process.exit(3);
}
if (!raw.trim()) {
  console.error('transport: empty response body');
  process.exit(3);
}
let j;
try {
  j = JSON.parse(raw);
} catch (e) {
  console.error('malformed: response is not JSON — ' + e.message);
  process.exit(2);
}
if (!j || !Array.isArray(j.rows)) {
  console.error('malformed: no rows array in response');
  process.exit(2);
}
const r = j.rows.find(x => x.seq === Number(seq));
if (!r) {
  console.error('missing: no row with seq ' + seq + ' (' + j.rows.length + ' row(s) returned)');
  process.exit(4);
}
const hex = typeof r.root === 'string'
  ? r.root.replace(/^0x/, '')
  : Buffer.from(r.root).toString('hex');
const bad = [];
if (hex !== rootHex) bad.push('root ' + hex.slice(0, 12) + '… ≠ ' + rootHex.slice(0, 12) + '…');
if (r.kind !== Number(kind)) bad.push('kind ' + r.kind + ' ≠ ' + kind);
if (r.count !== Number(count)) bad.push('count ' + r.count + ' ≠ ' + count);
if (bad.length) {
  console.error('mismatch: ' + bad.join('; '));
  process.exit(5);
}
process.exit(0);
