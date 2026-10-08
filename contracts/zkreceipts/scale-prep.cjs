// scale-prep.cjs — synthetic scale witness builder for count_scale.circom
// (bTunGsTeN 4: n=1k / n=10k of the EXISTING workload). Generates a
// deterministic synthetic cohort of `members` members (seeded hashes,
// engineered kept counts), pads to n, folds the same tree, cross-checks
// the counters, and emits input_scale.json + expected_scale.json.
// Usage: node scale-prep.cjs <members> <n> <outdir> <seed>
const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');
const { execSync } = require('node:child_process');
const os = require('node:os');
const W = path.join(os.homedir(), 'plonkport');
const { buildPoseidonOpt } = require(path.join(W, 'node_modules', 'circomlibjs'));

(async () => {
const [membersS, nS, outdir, seed] = process.argv.slice(2);
const members = +membersS, n = +nS;
if (!members || !n || (n & (n - 1)) !== 0) throw new Error('need <members> <n=2^k> <outdir> <seed>');
const rng = (tag) => BigInt('0x' + createHash('sha256').update(`${seed}:${tag}`).digest('hex').slice(0, 16));

const fp = [], pheno = [], r1 = [], r2 = [], r3 = [];
let deadKept = 0, liveKept = 0;
for (let i = 0; i < n; i++) {
  if (i < members) {
    fp.push(rng(`fp${i}`));
    const isLive = i % 2 === 1;                       // half dead, half live baseline
    pheno.push(isLive ? 1n : 0n);
    const keep = i % 4 !== 3;                         // 3 of 4 members kept (1 of 4 flips twice)
    if (keep) {
      const v = isLive ? 2n : 1n;
      const cnt = 1 + Number(rng(`c${i}`) % 3n);
      r1.push(v); r2.push(cnt >= 2 ? v : 0n); r3.push(cnt >= 3 ? v : 0n);
      if (isLive) liveKept++; else deadKept++;
    } else {
      const base = isLive ? 2n : 1n, other = isLive ? 1n : 2n;
      r1.push(base); r2.push(other); r3.push(0n);     // one settled flip → NOT kept, still counted in neither kept
    }
  } else { fp.push(0n); pheno.push(0n); r1.push(0n); r2.push(0n); r3.push(0n); }
}

const poseidon = await buildPoseidonOpt();
const p2 = (a, b) => BigInt(poseidon.F.toString(poseidon([a, b])));
let h = [], d = [], l = [];
for (let i = 0; i < n; i++) {
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
if (Number(d[0]) !== deadKept || Number(l[0]) !== liveKept) throw new Error(`fold ${d[0]}/${l[0]} ≠ recount ${deadKept}/${liveKept}`);
const dec = a => a.map(String);
fs.writeFileSync(path.join(outdir, 'input_dead.json'), JSON.stringify({ fp: dec(fp), pheno: dec(pheno), r1: dec(r1), r2: dec(r2), r3: dec(r3), root: h[0].toString(), kind: '0', count: String(deadKept) }));
fs.writeFileSync(path.join(outdir, 'expected_scale.json'), JSON.stringify({ seed, members, n, deadKept, liveKept, root: '0x' + h[0].toString(16).padStart(64, '0') }, null, 1));
console.log(`members=${members} n=${n} deadKept=${deadKept} liveKept=${liveKept} root=0x${h[0].toString(16).slice(0, 16)}…`);
})().catch(e => { console.error(e); process.exit(1); });
