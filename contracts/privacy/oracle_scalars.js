// oracle_scalars.js — the independent BigInt oracle for the C++ scalar
// phases. Mirrors the SAME snarkjs template lines plonk_verify.hpp cites
// (verifier_plonk.sol.ejs), implemented with native BigInt + js-sha3
// keccak256. Emits "KEY hex" lines for test_plonk_native.cpp.
// If C++ == oracle AND the on-chain pairing accepts, the port agrees with
// snarkjs three ways: template → oracle (JS), template → port (C++), and
// prover → chain (end to end).
const fs = require('fs');
const { keccak256 } = require('js-sha3');

const vk = JSON.parse(fs.readFileSync(process.argv[2] || '/home/travi/plonkport/vk.json', 'utf8'));
const proof = JSON.parse(fs.readFileSync(process.argv[3] || '/home/travi/plonkport/proof.json', 'utf8'));
const pubs = JSON.parse(fs.readFileSync(process.argv[4] || '/home/travi/plonkport/public.json', 'utf8')).map(BigInt);

const Q  = 21888242871839275222246405745257275088548364400416034343698204186575808495617n; // PUBLIC-CONSTANT BN254 scalar field
const m  = v => ((v % Q) + Q) % Q;
const w32h = v => m(BigInt(v)).toString(16).padStart(64, '0');
const kecMod = arr => BigInt('0x' + keccak256(Buffer.from(arr.join(''), 'hex'))) % Q;

// affine vk words (z==1 asserted by gen step); projective-tolerant read
const V = v => [BigInt(v[0]), BigInt(v[1])];      // affine (this vk: z=1 everywhere)
const [Qmx, Qmy] = V(vk.Qm), [Qlx, Qly] = V(vk.Ql), [Qrx, Qry] = V(vk.Qr);
const [Qox, Qoy] = V(vk.Qo), [Qcx, Qcy] = V(vk.Qc);
const [S1x, S1y] = V(vk.S1), [S2x, S2y] = V(vk.S2), [S3x, S3y] = V(vk.S3);
const W1 = BigInt(vk.w), K1 = BigInt(vk.k1), K2 = BigInt(vk.k2);
const n = 1n << BigInt(vk.power);

const P = {};
for (const k of ['A','B','C','Z','T1','T2','T3','Wxi','Wxiw']) {
  if (String(proof[k][2]) !== '1') throw new Error(k + ' not affine');
  P[k] = [BigInt(proof[k][0]), BigInt(proof[k][1])];
}
const e = k => BigInt(proof[k]);                    // eval_a..eval_zw
const ea=e('eval_a'), eb=e('eval_b'), ec=e('eval_c'), es1=e('eval_s1'), es2=e('eval_s2'), ezw=e('eval_zw');

// β (l.263-290)
const beta = kecMod([Qmx,Qmy,Qlx,Qly,Qrx,Qry,Qox,Qoy,Qcx,Qcy,S1x,S1y,S2x,S2y,S3x,S3y,
                     ...pubs, ...P.A, ...P.B, ...P.C].map(w32h));
// γ (l.294)
const gamma = kecMod([w32h(beta)]);
// α (l.297-303), α²
const alpha = kecMod([w32h(beta), w32h(gamma), ...P.Z.map(w32h)]);
const alpha2 = m(alpha * alpha);
// ξ (l.307-315)
const xi = kecMod([w32h(alpha), ...P.T1.map(w32h), ...P.T2.map(w32h), ...P.T3.map(w32h)]);
// v1 (l.319-327) + v2..v5
const v1 = kecMod([w32h(xi), w32h(ea), w32h(eb), w32h(ec), w32h(es1), w32h(es2), w32h(ezw)]);
const v2 = m(v1*v1), v3 = m(v2*v1), v4 = m(v3*v1), v5 = m(v4*v1);
// βξ, ξⁿ, Zh (l.331-341)
const betaxi = m(beta * xi);
let xin = xi; for (let i = 0; i < vk.power; ++i) xin = m(xin * xin);
const zh = m(xin - 1n);
// u (l.355-360)
const u = kecMod([...P.Wxi.map(w32h), ...P.Wxiw.map(w32h)]);

// Lagrange (l.363-419): batch invert [zh, n(ξ−1), n(ξ−ω)] by the template's
// inverseArray prefix/unwind, then L1 = iL1·Zh, L2 = ω·iL2·Zh
const inv = a => { let t=0n, nt=1n, r=Q, nr=m(a); while (nr) { const q=r/nr; [t,nt]=[nt,t-q*nt]; [r,nr]=[nr,r-q*nr]; } if (t<0n) t+=Q; return t; };
const l1raw = m(n * m(xi - 1n)), l2raw = m(n * m(xi - W1));
const pre1 = zh, pre2 = m(zh * l1raw), total = m(pre2 * l2raw);
const itotal = inv(total);
const iL2 = m(itotal * pre2);
const acc2 = m(itotal * l2raw);
const iL1 = m(acc2 * pre1);
const L1f = m(iL1 * zh);
const L2  = m(W1 * m(iL2 * zh));

// PI (l.424-445): pl = pl − pub·L (subtractions)
let pi = 0n;
pi = m(pi - m(L1f * pubs[0]));
pi = m(pi - m(L2  * pubs[1]));

// R0 (l.447-477)
const e2 = m(L1f * alpha2);
const e3a = m(ea + m(beta*es1) + gamma);
const e3b = m(eb + m(beta*es2) + gamma);
const e3c = m(ec + gamma);
const e3 = m(m(m(m(e3a*e3b)*e3c)*ezw)*alpha);
const r0 = m(m(pi - e2) - e3);

// D scalars (l.592-650)
const d2a = m(m(m(m(m(ea + betaxi + gamma) * m(eb + m(betaxi*K1) + gamma)) * m(ec + m(betaxi*K2) + gamma)) * alpha));
const d2b = m(L1f * alpha2);
const d2 = m(m(d2a + d2b) + u);
const d3 = m(m(m(m(ea + m(beta*es1) + gamma) * m(eb + m(beta*es2) + gamma)) * m(m(alpha*beta)*ezw)));

// E scalar (l.679-687)
let esc = m(Q - r0);
esc = m(esc + m(ea*v1)); esc = m(esc + m(eb*v2)); esc = m(esc + m(ec*v3));
esc = m(esc + m(es1*v4)); esc = m(esc + m(es2*v5)); esc = m(esc + m(ezw*u));

const out = {
  beta: w32h(beta), gamma: w32h(gamma), alpha: w32h(alpha), alpha2: w32h(alpha2),
  xi: w32h(xi), betaxi: w32h(betaxi), xin: w32h(xin), zh: w32h(zh),
  v1: w32h(v1), v2: w32h(v2), v3: w32h(v3), v4: w32h(v4), v5: w32h(v5), u: w32h(u),
  L1: w32h(L1f), L2: w32h(L2), PI: w32h(pi), r0: w32h(r0),
  d2: w32h(d2), d3: w32h(d3), e: w32h(esc),
};
for (const [k, v] of Object.entries(out)) console.log(k.toUpperCase(), v);
