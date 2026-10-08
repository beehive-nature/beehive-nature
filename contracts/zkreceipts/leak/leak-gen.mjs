// leak-gen.mjs — witness generation + proving for the pre-registered
// leak distinguisher (PREREGISTERED.md is the contract; this executes it).
//   REAL: 5× input_dead + 5× input_live (the canonical cohort witness)
//   SIM:  4 synthetic 40-member sets × 2-3 draws = 10 (same leaf
//         encoding as zkrprep; claims engineered to 20/20)
// Output: leak-samples.jsonl — {class, setId, claim, words[24 hex]}
// Words are the flatten.js wire order (points x‖y then 6 scalars).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const W = join(homedir(), 'plonkport');
const OUT = process.argv[2] || join(W, 'leak-samples.jsonl');
const NREAL = 10, NSIM_SETS = 4, NSIM_PER = [3, 3, 2, 2];   // 10 REAL (5 dead-claim + 5 live-claim per PREREGISTERED) + 10 SIM

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// ---- witness building (mirrors zkrprep encoding exactly) ----
const { buildPoseidonOpt } = require(join(W, 'node_modules', 'circomlibjs'));
const poseidon = await buildPoseidonOpt();
const p2 = (a, b) => BigInt(poseidon.F.toString(poseidon([a, b])));

function foldTree(fp, pheno, r1, r2, r3) {
  let h = [], d = [], l = [];
  for (let i = 0; i < 64; i++) {
    h.push(p2(fp[i], p2(pheno[i], r1[i] + 4n * r2[i] + 16n * r3[i])));
    const settled = [r1[i], r2[i], r3[i]].filter(v => v !== 0n).length;
    const flips = [r1[i], r2[i], r3[i]].filter(v => v !== 0n && v !== 1n + pheno[i]).length;
    const kept = (settled > 0 && flips === 0) ? 1n : 0n;
    d.push(kept * (1n - pheno[i])); l.push(kept * pheno[i]);
  }
  while (h.length > 1) {
    const nh = [], nd = [], nl = [];
    for (let j = 0; j < h.length / 2; j++) {
      nh.push(p2(h[2 * j], h[2 * j + 1]));
      nd.push(d[2 * j] + d[2 * j + 1]); nl.push(l[2 * j] + l[2 * j + 1]);
    }
    h = nh; d = nd; l = nl;
  }
  return { root: h[0], deadKept: d[0], liveKept: l[0] };
}

// ---- SIM sets: random fingerprints, engineered 20 dead-kept + 20 live-kept ----
function simSet(seedNum) {
  const fp = [], pheno = [], r1 = [], r2 = [], r3 = [];
  const rng = (i) => BigInt('0x' + createHash('sha256').update(`sim-${seedNum}-${i}`).digest('hex').slice(0, 16));
  for (let i = 0; i < 40; i++) {
    fp.push(rng(i));
    const isLive = i >= 20;                     // 20 dead-baseline, 20 live-baseline
    pheno.push(isLive ? 1n : 0n);
    // every member kept: settled verdicts match baseline; vary count 1..3
    const n = 1 + (Number(rng(1000 + i) % 3n));
    const v = isLive ? 2n : 1n;
    const runs = [n >= 1 ? v : 0n, n >= 2 ? v : 0n, n >= 3 ? v : 0n];
    r1.push(runs[0]); r2.push(runs[1]); r3.push(runs[2]);
  }
  for (let i = 40; i < 64; i++) { fp.push(0n); pheno.push(0n); r1.push(0n); r2.push(0n); r3.push(0n); }
  return { fp, pheno, r1, r2, r3 };
}

// ---- prove one input; return the 24 wire words ----
function proveWords(inputJson, tag) {
  const inp = join(W, `leak-in-${tag}.json`);
  const wit = join(W, `leak-wit-${tag}.wtns`);
  const prf = join(W, `leak-proof-${tag}.json`);
  const pub = join(W, `leak-pub-${tag}.json`);
  writeFileSync(inp, JSON.stringify(inputJson));
  execFileSync('node', [join(W, 'count_js', 'generate_witness.js'), join(W, 'count_js', 'count.wasm'), inp, wit], { stdio: 'pipe' });
  execFileSync('npx', ['--prefix', W, 'snarkjs', 'plonk', 'prove', join(W, 'count.zkey'), wit, prf, pub], { stdio: 'pipe', shell: process.platform === 'win32' });
  const p = JSON.parse(readFileSync(prf, 'utf8'));
  const order = ['A','B','C','Z','T1','T2','T3','Wxi','Wxiw','eval_a','eval_b','eval_c','eval_s1','eval_s2','eval_zw'];
  const words = [];
  for (const k of order) {
    const v = p[k];
    if (typeof v === 'string') words.push(BigInt(v).toString(16).padStart(64, '0'));
    else words.push(BigInt(v[0]).toString(16).padStart(64, '0'), BigInt(v[1]).toString(16).padStart(64, '0'));
  }
  if (words.length !== 24) throw new Error('expected 24 words, got ' + words.length);
  return words;
}

const lines = [];
// REGEN-REAL mode: keep existing SIM samples, regenerate the REAL half only
if (process.env.REGEN_REAL && existsSync(OUT)) {
  for (const l of readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean)) {
    const j = JSON.parse(l); if (j.class === 'SIM') lines.push(j);
  }
}
// REAL: canonical cohort witness
const realDead = JSON.parse(readFileSync(join(W, 'input_dead.json'), 'utf8'));
const realLive = JSON.parse(readFileSync(join(W, 'input_live.json'), 'utf8'));
for (let i = 0; i < NREAL; i++) {
    const inp = { ...(i % 2 === 0 ? realDead : realLive), kind: String(i % 2), count: '20' };
  const words = proveWords(inp, `real-${i}`);
  lines.push({ class: 'REAL', setId: 'cohort', claim: [inp.kind, inp.count], words });
  console.log(`REAL ${i} done`);
}
// SIM: engineered sets, kinds alternate
let simIdx = 0;
for (let s = 0; s < NSIM_SETS; s++) {
  const { fp, pheno, r1, r2, r3 } = simSet(s + 1);
  const { root, deadKept, liveKept } = foldTree(fp, pheno, r1, r2, r3);
  if (deadKept !== 20n || liveKept !== 20n) throw new Error(`sim set ${s + 1}: kept ${deadKept}/${liveKept} ≠ 20/20`);
  const base = { fp: fp.map(String), pheno: pheno.map(String), r1: r1.map(String), r2: r2.map(String), r3: r3.map(String), root: root.toString() };
  for (let j = 0; j < NSIM_PER[s]; j++) {
    const claim = simIdx % 2 === 0 ? { kind: '0', count: '20' } : { kind: '1', count: '20' };
    const words = proveWords({ ...base, ...claim }, `sim-${simIdx}`);
    lines.push({ class: 'SIM', setId: `sim-${s + 1}`, claim: [claim.kind, claim.count], words });
    simIdx++;
    console.log(`SIM ${simIdx} done`);
  }
}
writeFileSync(OUT, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
console.log(`wrote ${lines.length} samples to ${OUT}`);
