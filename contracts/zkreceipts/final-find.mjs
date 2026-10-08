// final-find.mjs — zkrself-final helper: read anchor rows from stdin
// (cleos get table JSON) and find a row matching (root,kind,count).
// Prints "seq <n>" on exact match, else "NONE". Kept as a FILE to dodge
// inline -e quoting (a missing paren in the inline form silently failed
// every reconcile, 2026-10-07).
//
// STRICT-CLASS LAW (live finding, 2026-10-08): discovery is CLASS-EXACT
// and never degrades. The old form silently fell back to ANY matching
// row when the requested class's pool was empty — under a transient
// row-shape anomaly on the first live v4 run (verified_at served
// string-typed: '!\"0\"' is false, so the unverified pool emptied), the
// forged leg silently picked a VERIFIED row (seq 1), got the wrong
// refusal reason, and duplicated the reverify claim. Downstream v4
// hardening caught it (wrong-reason FAIL + duplicate-seq exit 8), but
// the helper itself must fail LOUD: numeric fields are validated
// (seq/kind/count/verified_at must be numbers per the contract ABI —
// any other shape is READ-ERROR, retried by the caller, never trusted),
// and an empty requested pool is NONE — a missing target is a discovery
// failure, never a cross-class substitution.
import { readFileSync } from 'node:fs';
let s = '';
process.stdin.on('data', d => s += d);
process.stdin.on('end', () => {
  const [root, kindS, countS, wantVerified] = process.argv.slice(2);
  let j;
  try { j = JSON.parse(s); } catch { console.log('READ-ERROR'); return; }
  const rows = j.rows || [];
  const norm = r => (typeof r.root === 'string' ? r.root.replace(/^0x/, '') : Buffer.from(r.root).toString('hex'));
  const kind = +kindS, count = +countS;
  for (const r of rows) {
    if (typeof r.seq !== 'number' || typeof r.kind !== 'number' ||
        typeof r.count !== 'number' ||
        (r.verified_at !== undefined && typeof r.verified_at !== 'number')) {
      console.log('READ-ERROR'); // ABI anomaly: numeric field served non-numeric — retry, never trust
      return;
    }
  }
  const matches = rows.filter(r => r.kind === kind && r.count === count && norm(r) === root);
  const pool = wantVerified === 'verified' ? matches.filter(r => r.verified_at > 0) : matches.filter(r => !r.verified_at);
  const pick = pool[0];
  console.log(pick ? 'seq ' + pick.seq : 'NONE');
});
