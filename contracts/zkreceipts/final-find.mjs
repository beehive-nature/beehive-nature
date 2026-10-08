// final-find.mjs — zkrself-final helper: read anchor rows from stdin
// (cleos get table JSON) and find a row matching (root,kind,count).
// Prints "seq <n>" on exact match (prefer unverified unless --any),
// else "NONE". Kept as a FILE to dodge inline -e quoting (a missing
// paren in the inline form silently failed every reconcile, 2026-10-07).
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
  const matches = rows.filter(r => r.kind === kind && r.count === count && norm(r) === root);
  const pool = wantVerified === 'verified' ? matches.filter(r => r.verified_at > 0) : matches.filter(r => !r.verified_at);
  const pick = (pool.length ? pool : (wantVerified === 'verified' ? [] : matches))[0];
  console.log(pick ? 'seq ' + pick.seq : 'NONE');
});
