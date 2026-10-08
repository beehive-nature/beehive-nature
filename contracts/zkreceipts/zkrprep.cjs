// zkrprep.cjs — the witness builder for count.circom (SPEC-ZK-RECEIPT-
// AGGREGATES-1 v1). Reads the ant-reach COHORT receipt (the private
// evidence set's published summary + fingerprints), encodes the 40 member
// leaves, pads to 64, folds the SAME tree the circuit folds, cross-checks
// every aggregate against the receipt's own numbers, and emits:
//   input_dead.json / input_live.json  (circom witness inputs, kind 0/1)
//   expected.json                      (root, counters, cross-checks)
//
// The raw per-run exports stay OUT: the receipt's fingerprints + verdicts
// are the witness; nothing here publishes more than the receipt already
// does (the root and the two counts are the only new public values).
//
// Usage: node zkrprep.cjs <cohort.json> <outdir>
const fs = require('fs');
const path = require('path');
const { poseidon } = require(path.join(process.env.HOME || '', 'plonkport', 'node_modules', 'circomlibjs'));

const [,, cohortPath, outdirArg] = process.argv;
if (!cohortPath || !outdirArg) { console.error('usage: node zkrprep.cjs <cohort.json> <outdir>'); process.exit(1); }
const outdir = outdirArg;
fs.mkdirSync(outdir, { recursive: true });

const VERDICT = { null: 0, 'unsettled': 0, 'dead': 1, 'opened': 2 };   // 0 unsettled, 1 dead, 2 opened (the ant-reach vocabulary)
const PHENO = { dead: 0, opened: 1 };

const cohort = JSON.parse(fs.readFileSync(cohortPath, 'utf8'));
const members = cohort.members;

// ── cross-checks against the receipt's own aggregates (fail loud) ──
const xchk = {};
if (members.length !== 40) throw new Error(`members ${members.length} ≠ 40`);
const ids = members.map(m => m.id);
if (new Set(ids).size !== 40) throw new Error('duplicate fingerprints');
members.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);   // canonical order = id-sorted (the receipt's own order is not canonical)

let deadSettled = 0, liveSettled = 0, deadKept = 0, liveKept = 0, totalFlips = 0;
for (const m of members) {
  if (m.perRun.length !== 3) throw new Error(`${m.id}: perRun ${m.perRun.length} ≠ 3`);
  for (const v of m.perRun) if (!(v === null || v === 'unsettled' || v === 'dead' || v === 'opened')) throw new Error(`${m.id}: bad verdict ${v}`);
  const settled = m.perRun.filter(v => v === 'dead' || v === 'opened').length;
  const observations = m.perRun.filter(v => v !== null).length;
  const flips = m.perRun.filter(v => (v === 'dead' || v === 'opened') && v !== m.was).length;
  const keptObs = m.perRun.filter(v => v === m.was).length;   // the receipt's kept = kept OBSERVATIONS (0..3), not a boolean
  if (settled !== m.settled || observations !== m.observations || flips !== m.flipped || keptObs !== m.kept)
    throw new Error(`${m.id}: per-run recount disagrees with the receipt row`);
  if (m.was === 'dead') { deadSettled += settled; deadKept += (settled > 0 && flips === 0) ? 1 : 0; }
  else                  { liveSettled += settled; liveKept += (settled > 0 && flips === 0) ? 1 : 0; }
  totalFlips += flips;
}
if (deadSettled !== cohort.dead.settledObservations) throw new Error(`dead settled ${deadSettled} ≠ receipt ${cohort.dead.settledObservations}`);
if (liveSettled !== cohort.live.settledObservations) throw new Error(`live settled ${liveSettled} ≠ receipt ${cohort.live.settledObservations}`);
if (totalFlips !== cohort.dead.flipped + cohort.live.flipped) throw new Error(`flips ${totalFlips} ≠ receipt`);
if (deadKept !== cohort.dead.members || liveKept !== cohort.live.members)
  throw new Error(`kept members ${deadKept}/${liveKept} ≠ receipt ${cohort.dead.members}/${cohort.live.members}`);

// ── poseidon is an async factory (circomlibjs law — the m4prep precedent) ──
const { buildPoseidonOpt } = require(path.join(process.env.HOME || '', 'plonkport', 'node_modules', 'circomlibjs'));

(async () => {
const poseidon = await buildPoseidonOpt();
const p2 = (a, b) => BigInt(poseidon.F.toString(poseidon([a, b])));   // element → BigInt for chaining/serialization

// ── encode leaves: leaf = Poseidon(fp, Poseidon(pheno, packed)) ──
const fp = [], pheno = [], r1 = [], r2 = [], r3 = [];
for (let i = 0; i < 64; i++) {
  if (i < 40) {
    const m = members[i];
    fp.push(BigInt('0x' + m.id));                 // 16-hex fingerprint → 64-bit field element
    pheno.push(BigInt(PHENO[m.was]));
    r1.push(BigInt(VERDICT[m.perRun[0]])); r2.push(BigInt(VERDICT[m.perRun[1]])); r3.push(BigInt(VERDICT[m.perRun[2]]));
  } else {                                        // zero pads (slots 40..63)
    fp.push(0n); pheno.push(0n); r1.push(0n); r2.push(0n); r3.push(0n);
  }
}

const leafOf = i => p2(fp[i], p2(pheno[i], r1[i] + 4n * r2[i] + 16n * r3[i]));
let h = [], d = [], l = [];
for (let i = 0; i < 64; i++) {
  h.push(leafOf(i));
  const settled = [r1[i], r2[i], r3[i]].filter(v => v !== 0n).length;
  const flips = [r1[i], r2[i], r3[i]].filter(v => v !== 0n && v !== 1n + pheno[i]).length;
  const kept = (settled > 0 && flips === 0) ? 1n : 0n;
  d.push(kept * (1n - pheno[i])); l.push(kept * pheno[i]);
}
while (h.length > 1) {                            // the circuit's fold, mirrored
  const nh = [], nd = [], nl = [];
  for (let j = 0; j < h.length / 2; j++) {
    nh.push(p2(h[2 * j], h[2 * j + 1]));
    nd.push(d[2 * j] + d[2 * j + 1]); nl.push(l[2 * j] + l[2 * j + 1]);
  }
  h = nh; d = nd; l = nl;
}
const root = h[0];
if (d[0] !== BigInt(deadKept) || l[0] !== BigInt(liveKept)) throw new Error('JS counter fold disagrees with leaf recount');

// ── emit witness inputs (decimal strings; kind/count are the two claims) ──
const dec = a => a.map(String);
const base = { fp: dec(fp), pheno: dec(pheno), r1: dec(r1), r2: dec(r2), r3: dec(r3), root: root.toString() };
fs.writeFileSync(path.join(outdir, 'input_dead.json'), JSON.stringify({ ...base, kind: '0', count: String(deadKept) }, null, 1));
fs.writeFileSync(path.join(outdir, 'input_live.json'), JSON.stringify({ ...base, kind: '1', count: String(liveKept) }, null, 1));
fs.writeFileSync(path.join(outdir, 'expected.json'), JSON.stringify({
  receipt: cohortPath, members: 40, pads: 24, runs: cohort.runs.map(r => r.label),
  root: '0x' + root.toString(16).padStart(64, '0'),
  deadKept, liveKept, deadSettled, liveSettled, flipped: totalFlips,
  crosschecks: 'all-pass (members/settled/kept/flipped vs receipt)',
}, null, 1));
console.log('root', '0x' + root.toString(16).padStart(64, '0'), 'deadKept', deadKept, 'liveKept', liveKept, 'settled', deadSettled + '/' + liveSettled, 'flipped', totalFlips);
})().catch(e => { console.error(e); process.exit(1); });
