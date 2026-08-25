// report-lint.mjs — a gate on seat REPORTS, not code. ORDER (gate seat,
// 2026-08-24): every assertion in a report carries either (a) its raw tool
// output, or (b) an explicit UNVERIFIED tag. Untagged claims are not ruled on.
//
// WHY: six claims traveled ahead of their verification tonight — a vacuous
// grep, a path-normalization probe, an ABI question at the wrong artifact, a
// chronology never measured, a stale hero number, a merge status inferred
// from a commit. All six were caught DOWNSTREAM of a decision. Every other
// failure shape from tonight has a mechanism; this builds the missing one.
//
// DETECTION OVER ENFORCEMENT: default mode lists claims and prints the ratio,
// exit 0 always. --strict exits 1 on any UNTAGGED claim — the enforcement
// switch exists but stays off until the ratio has been measured on real
// reports (same discipline as the && lint).
//
//   node scripts/report-lint.mjs report.md [more.md …]
//   node scripts/report-lint.mjs --strict report.md
//   node scripts/report-lint.mjs --selftest
//
// HONESTY ABOUT THE HEURISTIC (this linter untagged-claims its own limits):
// "assertion" is detected by vocabulary — verification verbs, test counts,
// digests, landed/merged/pushed/proven/matches. A claim phrased outside the
// bank is a false negative and will not be listed; the bank grows from the
// claims that actually burned, not from imagination. Receipt detection is
// likewise shape-based (fenced tool output, inline output tokens, digest
// spans). The linter MEASURES claim discipline; the judgment stays human.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSERTION = [
  /\b\d+\s+(passed|failed|tests?|checks?|assertions?|files? changed)\b/i,
  /\b\d+\/\d+\b/,
  /\b(GREEN|RED)\b/,
  /\b(landed|committed|pushed|merged|rebased|verified|proven|byte-exact|mutation-proven|matches|matched|match\b|reconciles?|reconciled|fails? closed|fail-closed|accepted)\b/i,
  /\b(exit( code)?\s*[:=]?\s*\d+|errno)/i,
  /\b[0-9a-f]{32,}\b/i,
  /\b(sha256|digest)\b.*\b[0-9a-f]{8,}/i,
  /\bgates?\s+(pass|fail|are green|hold)/i,
  /\b\d+(\.\d+)?\s?(ms|KB|bytes?|files?)\b/i
];
const RECEIPT_SHAPE = [
  /^\s*[$>❯]\s/m,                       // a pasted prompt line inside the unit
  /\b(PASS|FAIL)\s+\S/m,                // gate output lines
  /\d+\s+(passed|failed)/i,
  /\d+(\.\d+)?\s?ms\b/,                 // a timing is a measurement output, never an opinion
  /[0-9a-f]{32,}/,                      // a real digest span
  /(->|→|=>)\s*\S/,                     // command → output
  /\binsertions?\(?\+?\)?|\bfiles? changed\b/i,
  /\b(HTTP\/\d|errno|exit( code)?\s*[:=]?\s*\d+)\b/i
];
const RECEIPT_INLINE = [
  /`[^`]*[0-9a-f]{16,}[^`]*`/,
  /`[^`]*\d+\s+(passed|failed)[^`]*`/,
  /`[^`]*(PASS |FAIL |exit |errno|->|→)[^`]*`/,
  /\d+(\.\d+)?\s?ms\b/,
  /\breceipt\b[ :]/i
];
const UNVERIFIED_TAG = /\bUNVERIFIED\b/;

// a unit wearing the UNVERIFIED tag is a claim BY DEFINITION — the tag exists
// to flag an assertion, so it counts as one even when phrased off-bank
const isAssert = t => UNVERIFIED_TAG.test(t) || ASSERTION.some(re => re.test(t));
const hasReceipt = t =>
  (t.fence && RECEIPT_SHAPE.some(re => re.test(t.fence))) ||
  RECEIPT_INLINE.some(re => re.test(t.text));

// parse into units: a paragraph plus the fenced block that follows it
function units(text) {
  const out = [];
  const parts = text.split(/```/);
  for (let i = 0; i < parts.length; i += 2) {
    const paras = parts[i].split(/\n\s*\n/).filter(p => p.trim());
    for (const p of paras) out.push({ text: p });
    const fence = parts[i + 1];
    if (fence !== undefined && out.length) out[out.length - 1].fence = fence;
    else if (fence !== undefined) out.push({ text: '', fence });
  }
  return out.map(u => ({ ...u, line: 0 }));
}

async function lint(path) {
  const text = await readFile(path, 'utf8');
  const lineOf = idx => text.slice(0, idx).split('\n').length;
  const us = [];
  const parts = text.split(/```/);
  let charCursor = 0;
  for (let i = 0; i < parts.length; i += 2) {
    const paras = parts[i].split(/\n\s*\n/).filter(p => p.trim());
    for (const p of paras) {
      const at = text.indexOf(p, charCursor);
      us.push({ text: p.trim(), fence: null, line: at >= 0 ? lineOf(at) : '?' });
      charCursor = at >= 0 ? at + p.length : charCursor;
    }
    if (parts[i + 1] !== undefined && us.length) {
      const fat = text.indexOf('```' + parts[i + 1], charCursor);
      us[us.length - 1].fence = parts[i + 1];
      charCursor = fat >= 0 ? fat + parts[i + 1].length + 3 : charCursor;
    }
  }
  const claims = us.filter(u => isAssert(u.text));
  let receipted = 0, tagged = 0;
  const untagged = [];
  for (const c of claims) {
    if (UNVERIFIED_TAG.test(c.text)) { tagged++; c.cls = 'UNVERIFIED'; }
    else if (hasReceipt(c)) { receipted++; c.cls = 'RECEIPTED'; }
    else { untagged.push(c); c.cls = 'UNTAGGED'; }
  }
  console.log(`\n### ${path}`);
  for (const c of claims) {
    const excerpt = c.text.replace(/\s+/g, ' ').slice(0, 88);
    console.log(`  L${c.line} ${c.cls.padEnd(10)} "${excerpt}${c.text.length > 88 ? '…' : ''}"`);
  }
  const ratio = claims.length ? Math.round((receipted / claims.length) * 100) : 100;
  console.log(`  ratio · ${receipted}/${claims.length} assertion units carry receipts (${ratio}%) · ${tagged} declared UNVERIFIED · ${untagged.length} untagged${claims.length ? '' : ' · (no assertion-shaped units detected — coverage caveat applies)'}`);
  return { claims: claims.length, receipted, tagged, untagged: untagged.length };
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) {
  const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'report-lint.fixture.md');
  const text = await readFile(fixture, 'utf8');
  const us = units(text).filter(u => isAssert(u.text));
  const cls = u => UNVERIFIED_TAG.test(u.text) ? 'UNVERIFIED' : hasReceipt(u) ? 'RECEIPTED' : 'UNTAGGED';
  const got = us.map(cls);
  const want = ['RECEIPTED', 'UNTAGGED', 'UNVERIFIED', 'UNTAGGED'];
  const pass = got.length === want.length && got.every((g, i) => g === want[i]);
  console.log(`selftest · classifications ${got.join(', ')} — ${pass ? 'PASS (fixture classified exactly as designed)' : 'FAIL (expected ' + want.join(', ') + ')'}`);
  // mutation: strip the UNVERIFIED tag and the receipt fence; the flipped
  // classifications prove the detector reads what it claims to read
  const mutated = units(text.replace(/UNVERIFIED[^\n]*/, '').replace(/```[\s\S]*?```/, ''))
    .filter(u => isAssert(u.text)).map(cls);
  const flipped = mutated.length === want.length && mutated.every(g => g === 'UNTAGGED');
  console.log(`selftest · mutation (tag stripped, receipt removed) reads ${mutated.join(', ')} — ${flipped ? 'PASS (all now UNTAGGED: the detector sees the difference)' : 'FAIL (mutation invisible — hollow detector)'}`);
  process.exit(pass && flipped ? 0 : 1);
}

const strict = argv.includes('--strict');
const files = argv.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: report-lint.mjs [--strict|--selftest] report.md […]'); process.exit(2); }
let total = { claims: 0, receipted: 0, tagged: 0, untagged: 0 };
for (const f of files) { const r = await lint(f); for (const k in total) total[k] += r[k]; }
console.log(`\ntotal · ${total.receipted}/${total.claims} receipted (${total.claims ? Math.round(total.receipted / total.claims * 100) : 100}%) · ${total.tagged} UNVERIFIED · ${total.untagged} untagged`);
if (strict && total.untagged) { console.log(`STRICT · ${total.untagged} untagged claim(s) — untagged claims are not ruled on`); process.exit(1); }
process.exit(0);
