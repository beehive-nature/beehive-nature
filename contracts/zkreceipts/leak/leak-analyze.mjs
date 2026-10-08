// leak-analyze.mjs — executes the PRE-REGISTERED families F1–F5 over
// leak-samples.jsonl (PREREGISTERED.md is the contract; this computes
// and never re-scales thresholds). Pure node, no deps.
//   F1 per-word mean z (Welch two-sample z on 24 words)
//   F2 per-word Hamming weight two-sample t
//   F3 chi-square over byte values, words 10..15 pooled
//   F4 KS two-sample on word[15] low 64 bits
//   F5 weak learner: majority vote on per-sample mean byte value of
//      words 10..15 (pinned trivial learner — no ML deps; a stronger
//      learner would need re-registration)
// PASS (fixed): F1–F4 min p (Bonferroni within family, family-wise 0.05)
// and F5 accuracy binomial 95% CI includes 0.50.
import { readFileSync, writeFileSync } from 'node:fs';

const samples = readFileSync(process.argv[2] || (process.env.HOME + '/plonkport/leak-samples.jsonl'), 'utf8')
  .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const R = samples.filter(s => s.class === 'REAL'), S = samples.filter(s => s.class === 'SIM');
if (R.length < 10 || S.length < 10) { console.error(`need ≥10 per class (R=${R.length} S=${S.length})`); process.exit(9); }
const words = s => s.words.map(w => BigInt('0x' + w));
const bits = b => { let c = 0n, x = b; while (x) { c += x & 1n; x >>= 1n; } return Number(c); };

function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function varr(a, m) { return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); }
function welchP(a, b) { // two-sample z (large n~10 each: use t≈z; report as z)
  const ma = mean(a), mb = mean(b), va = varr(a, ma) / a.length, vb = varr(b, mb) / b.length;
  const z = (ma - mb) / Math.sqrt(va + vb || 1e-300);
  return { stat: z, p: 2 * (1 - normCdf(Math.abs(z))) };
}
function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y; }
function ksP(d, n1, n2) { const ne = Math.sqrt(n1 * n2 / (n1 + n2)); const lam = (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * d;
  let sum = 0; for (let j = 1; j <= 100; j++) sum += ((-1) ** (j - 1)) * Math.exp(-2 * j * j * lam * lam);
  return 2 * Math.max(sum, 0); }
function binomCI(k, n) { // Wilson
  const z = 1.959963985, p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d]; }

const fam = {};
// F1 + F2 per word
fam.F1 = [], fam.F2 = [];
for (let w = 0; w < 24; w++) {
  fam.F1.push({ word: w, ...welchP(R.map(s => Number(words(s)[w] % 1000003n)), S.map(s => Number(words(s)[w] % 1000003n))) });
  fam.F2.push({ word: w, ...welchP(R.map(s => bits(words(s)[w])), S.map(s => bits(words(s)[w]))) });
}
// F3 chi-square words 10..15 pooled byte values
{
  const buckets = 16, pools = { REAL: new Array(buckets).fill(0), SIM: new Array(buckets).fill(0) };
  for (const s of samples) for (let w = 10; w <= 15; w++) for (let i = 0; i < 64; i += 8) {
    const b = parseInt(s.words[w].slice(i, i + 2), 16) >> 4; pools[s.class][b]++;
  }
  const tot = pools.REAL.reduce((a, b) => a + b, 0) + pools.SIM.reduce((a, b) => a + b, 0);
  let chi = 0;
  for (let i = 0; i < buckets; i++) {
    const rC = pools.REAL.reduce((a, b) => a + b, 0), sC = pools.SIM.reduce((a, b) => a + b, 0);
    const eR = tot ? (pools.REAL[i] + pools.SIM[i]) * rC / tot : 0, eS = tot ? (pools.REAL[i] + pools.SIM[i]) * sC / tot : 0;
    if (eR > 0) chi += (pools.REAL[i] - eR) ** 2 / eR; if (eS > 0) chi += (pools.SIM[i] - eS) ** 2 / eS;
  }
  const df = buckets - 1;
  const p = 1 - chi2Cdf(chi, df); // chi2 survival via Wilson–Hilferty
  fam.F3 = [{ chi, df, p }];
}
function chi2Cdf(x, k) { const t = Math.cbrt(x / k - (1 - 2 / (9 * k))) * Math.sqrt(2 / (9 * k)); return normCdf(t); }
// F4 KS on word[15] low 64 bits
{
  const val = s => Number(words(s)[15] & 0xffffffffffffffffn);
  const a = R.map(val).sort((x, y) => x - y), b = S.map(val).sort((x, y) => x - y);
  let d = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    d = Math.max(d, Math.abs(i / a.length - j / b.length));
    if (a[i] < b[j]) i++; else j++;
  }
  fam.F4 = [{ d, p: ksP(d, a.length, b.length) }];
}
// F5 pinned learner: threshold on mean byte of words 10..15, LOO
{
  const feat = s => { let t = 0n, n = 0; for (let w = 10; w <= 15; w++) { const h = s.words[w]; for (let i = 0; i < 64; i += 2) { t += BigInt(parseInt(h.slice(i, i + 2), 16)); n++; } } return Number(t) / Number(n); };
  const data = samples.map(s => ({ x: feat(s), y: s.class === 'REAL' ? 1 : 0 }));
  let correct = 0;
  for (let i = 0; i < data.length; i++) {
    const train = data.filter((_, j) => j !== i);
    const thr = mean(train.map(t => t.x));
    // majority class above/below threshold learned from train
    const aboveR = train.filter(t => t.x >= thr && t.y === 1).length, aboveS = train.filter(t => t.x >= thr && t.y === 0).length;
    const predictAbove = aboveR >= aboveS ? 1 : 0;
    const pred = data[i].x >= thr ? predictAbove : 1 - predictAbove;
    if (pred === data[i].y) correct++;
  }
  const acc = correct / data.length, ci = binomCI(correct, data.length);
  fam.F5 = [{ accuracy: acc, ci, includes50: ci[0] <= 0.5 && 0.5 <= ci[1] }];
}

// Bonferroni within family; family-wise 0.05 across families
const famCount = 4; // statistical families F1-F4
let pass = true; const report = { families: {}, pass: null };
for (const [name, tests] of Object.entries({ F1: fam.F1, F2: fam.F2, F3: fam.F3, F4: fam.F4 })) {
  const m = tests.length, corrected = tests.map(t => ({ ...t, pBonf: Math.min(1, t.p * m) }));
  const minP = Math.min(...corrected.map(t => t.pBonf));
  const okF = minP > 0.05 / famCount;
  if (!okF) pass = false;
  report.families[name] = { tests: corrected.length, minBonfP: minP, threshold: 0.05 / famCount, ok: okF };
}
if (!fam.F5[0].includes50) pass = false;
report.families.F5 = fam.F5[0];
report.pass = pass;
report.samples = { REAL: R.length, SIM: S.length };
report.claim_scoping = "given (π, C) only — root M withheld (M separates classes BY DESIGN as the public commitment); PASS means: to the pinned families, π distinguishes REAL from SIM no better than chance; it is NOT a zero-knowledge proof (crypto-language law)";
writeFileSync(process.argv[3] || (process.env.HOME + '/plonkport/leak-receipt.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ pass: report.pass, F1: report.families.F1, F2: report.families.F2, F3: report.families.F3, F4: report.families.F4, F5: report.families.F5 }, null, 1).slice(0, 1200));
process.exit(pass ? 0 : 1);
