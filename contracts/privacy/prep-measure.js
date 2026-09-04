// prep-measure.js — builds the 3 payment inputs for the measurement run on
// paynote4444, whose contract tree is [m0, m1, m2] (the three executed
// deposits from measure-notes.json). Each payment proves against the root
// AT ITS MOMENT: pay1 → root(3 leaves); the contract then appends OUT1 →
// pay2 → root(4); +OUT2 → pay3 → root(5). Run with NODE_PATH set.
const fs = require('fs');
const crypto = require('crypto');
const { buildPoseidonOpt } = require('circomlibjs');
const { buildTree } = require('./tree.js');

(async () => {
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const tree = await buildTree();
  const notes = JSON.parse(fs.readFileSync('measure-notes.json'));
  // rebuild the leaf list WITHOUT touching tree-state.json
  let leaves = notes.map(n => n.commitment);            // [m0, m1, m2]
  const mkOut = asset => {
    const secretOut = BigInt('0x' + crypto.randomBytes(30).toString('hex'));
    return { secretOut: secretOut.toString(), commitment: P([secretOut, P([990n, BigInt(asset)])]) };
  };
  for (let n = 0; n < 3; n++) {
    const idx = n;                                     // payment-N spends leaf N (m_n)
    const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
    const leafIdx = pathIndices.reduce((a, b, i) => a + BigInt(b) * (1n << BigInt(i)), 0n);
    const secret = BigInt(notes[n].secret);
    const out = mkOut(notes[n].asset);
    const input = {
      secret: notes[n].secret, amountIn: '1000', assetIn: notes[n].asset,
      pathElements, pathIndices,
      secretOut: out.secretOut, amountOut: '990', assetOut: notes[n].asset,
      root, nullifier: P([secret, leafIdx]), commitmentOut: out.commitment,
      fee: '10', feeAsset: notes[n].asset,
    };
    fs.writeFileSync(`input-pm${n + 1}.json`, JSON.stringify(input));
    fs.writeFileSync(`out-pm${n + 1}.json`, JSON.stringify(out));
    leaves.push(out.commitment);                       // the contract will append this too
  }
  console.log('3 payment inputs ready (per-step roots); projected final leaves:', leaves.length);
})();
