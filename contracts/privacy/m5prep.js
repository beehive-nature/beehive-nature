// m5prep.js — the private-PAYMENT witness builder (M5).
//   node m5prep.js note <amount>              → m5-note.json (the deposit note)
//   node m5prep.js payment <amountOut> <fee>
//        → reads m5-note.json + tree-state.json, builds input5.json (the
//          payment witness: membership path + conservation), prints the
//          chain-side artifacts (nullifier, commitment_out, root). The
//          nullifier = Poseidon(secret, leaf_index) — index derived from the
//          path (one spendable nullifier per leaf, in-circuit).
// Rehearsal values recorded on purpose (a real member's secret never leaves
// their wallet). Run with NODE_PATH=<node_modules with circomlibjs>.
const fs = require('fs');
const crypto = require('crypto');
const { buildPoseidonOpt } = require('circomlibjs');
const { buildTree } = require('./tree.js');

(async () => {
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const tree = await buildTree();
  const mode = process.argv[2];

  if (mode === 'note') {
    const amount = process.argv[3] || '1000';
    const secret = BigInt('0x' + crypto.randomBytes(30).toString('hex'));
    const commitment = P([secret, BigInt(amount)]);
    const out = { secret: secret.toString(), amount, commitment };
    fs.writeFileSync('m5-note.json', JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out));
    return;
  }
  if (mode === 'payment') {
    const amountOut = process.argv[3], fee = process.argv[4];
    const note = JSON.parse(fs.readFileSync('m5-note.json'));
    const secret = BigInt(note.secret), amountIn = BigInt(note.amount);
    const leaves = tree.load();
    const idx = leaves.indexOf(note.commitment);
    if (idx < 0) throw new Error('note commitment not in the tree — insert it first (tree.js insert)');
    const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
    const leafIdx = pathIndices.reduce((acc, b, i) => acc + BigInt(b) * (1n << BigInt(i)), 0n);
    if (leafIdx !== BigInt(idx)) throw new Error('path does not encode the leaf index');
    const secretOut = BigInt('0x' + crypto.randomBytes(30).toString('hex'));
    const commitmentOut = P([secretOut, BigInt(amountOut)]);
    const nullifier = P([secret, leafIdx]);
    // conservation sanity (the circuit enforces it; fail early off-chain)
    if (amountIn !== BigInt(amountOut) + BigInt(fee))
      throw new Error(`UNBALANCED: ${amountIn} != ${amountOut} + ${fee} — the circuit would refuse`);
    const input = {
      secret: secret.toString(), amountIn: amountIn.toString(),
      pathElements, pathIndices,
      secretOut: secretOut.toString(), amountOut,
      root, nullifier, commitmentOut, fee,
    };
    fs.writeFileSync('input5.json', JSON.stringify(input, null, 1));
    fs.writeFileSync('m5-prev.json', JSON.stringify({ secretOut: secretOut.toString(), amountOut, commitmentOut }, null, 1));
    console.log(JSON.stringify({
      root_dec: root, nullifier_dec: nullifier, commitmentOut_dec: commitmentOut,
      nullifier_hex: BigInt(nullifier).toString(16).padStart(64, '0'),
      commitmentOut_hex: BigInt(commitmentOut).toString(16).padStart(64, '0'),
      root_hex: BigInt(root).toString(16).padStart(64, '0'), fee,
      secretOut: secretOut.toString(), amountOut,
    }, null, 1));
    return;
  }
  throw new Error('usage: m5prep.js note <amount> | m5prep.js payment <amountOut> <fee>');
})();
