// flatten.js — proof.json + public.json → the verifier's wire format.
// Order is the snarkjs Solidity calldata order (verifier_plonk.sol.ejs pA…pEval_zw):
// A, B, C, Z, T1, T2, T3, Wxi, Wxiw (points, x‖y 32B BE each) then
// eval_a, eval_b, eval_c, eval_s1, eval_s2, eval_zw (scalars) = 24 words total.
const fs = require('fs');
const proof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pubs  = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const w32 = v => BigInt(v).toString(16).padStart(64, '0');
const order = ['A','B','C','Z','T1','T2','T3','Wxi','Wxiw','eval_a','eval_b','eval_c','eval_s1','eval_s2','eval_zw'];
const words = [];
for (const k of order) {
  const v = proof[k];
  if (typeof v === 'string') words.push(w32(v));                       // scalar
  else {
   if (v.length > 2 && String(v[2]) !== '1') throw new Error(k + ' not affine (z=' + v[2] + ') — normalize first');
   words.push(w32(v[0]), w32(v[1]));                                   // point [x,y]
  }
}
const proof_hex = words.join('');
const pubs_hex = pubs.map(w32).join('');
console.log(JSON.stringify({ order, proof_words: words.length, proof_hex, pubs_hex, pubs_dec: pubs }, null, 1));
