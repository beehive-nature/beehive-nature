// m7prep.js — the M7 per-asset payment witness builder.
//   node m7prep.js note <amount> <asset>        → m7-note.json (deposit note)
//   node m7prep.js payment <amountOut> <fee> <feeAsset>
//        → reads m7-note.json + tree-state.json; the out-note inherits the
//          spent note's asset (same-asset law, enforced in-circuit).
//   node m7prep.js crossasset <amountOut>       → writes input7-cross.json with
//        a DIFFERENT out-asset (the refusal fixture — witness gen must fail)
// commitment = Poseidon(secret, Poseidon(amount, asset)) per payment.circom.
// Run with NODE_PATH=<node_modules with circomlibjs>.
const fs = require('fs');
const crypto = require('crypto');
const { buildPoseidonOpt } = require('circomlibjs');
const { buildTree } = require('./tree.js');

(async () => {
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const commitmentOf = (secret, amount, asset) => P([secret, P([amount, asset])]);
  const tree = await buildTree();
  const mode = process.argv[2];

  if (mode === 'note') {
    const amount = process.argv[3] || '1000', asset = process.argv[4] || '1';
    const secret = BigInt('0x' + crypto.randomBytes(30).toString('hex'));
    const commitment = commitmentOf(secret, BigInt(amount), BigInt(asset));
    const out = { secret: secret.toString(), amount, asset, commitment };
    fs.writeFileSync('m7-note.json', JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out));
    return;
  }
  if (mode === 'payment' || mode === 'crossasset') {
    const amountOut = process.argv[3], fee = process.argv[4] || '0', feeAsset = process.argv[5];
    const note = JSON.parse(fs.readFileSync('m7-note.json'));
    const secret = BigInt(note.secret), amountIn = BigInt(note.amount), assetIn = BigInt(note.asset);
    const assetOut = mode === 'crossasset' ? assetIn + 1n : assetIn;   // crossasset: refused at witness
    const fa = feeAsset === undefined ? assetIn : BigInt(feeAsset);
    const leaves = tree.load();
    const idx = leaves.indexOf(note.commitment);
    if (idx < 0) throw new Error('note commitment not in the tree — tree.js insert first');
    const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
    const leafIdx = pathIndices.reduce((a, b, i) => a + BigInt(b) * (1n << BigInt(i)), 0n);
    const secretOut = BigInt('0x' + crypto.randomBytes(30).toString('hex'));
    const commitmentOut = commitmentOf(secretOut, BigInt(amountOut), assetOut);
    const nullifier = P([secret, leafIdx]);
    const feeFromNote = fa === assetIn ? BigInt(fee) : 0n;
    if (amountIn !== BigInt(amountOut) + feeFromNote)
      throw new Error(`UNBALANCED: ${amountIn} != ${amountOut} + ${feeFromNote} — the circuit would refuse`);
    const input = {
      secret: secret.toString(), amountIn: amountIn.toString(), assetIn: assetIn.toString(),
      pathElements, pathIndices,
      secretOut: secretOut.toString(), amountOut, assetOut: assetOut.toString(),
      root, nullifier, commitmentOut, fee, feeAsset: fa.toString(),
    };
    fs.writeFileSync(mode === 'crossasset' ? 'input7-cross.json' : 'input7.json', JSON.stringify(input, null, 1));
    fs.writeFileSync('m7-prev.json', JSON.stringify({
      secretOut: secretOut.toString(), amountOut, assetOut: assetOut.toString(), commitmentOut,
    }, null, 1));
    console.log(JSON.stringify({
      nullifier_hex: BigInt(nullifier).toString(16).padStart(64, '0'),
      commitmentOut_hex: BigInt(commitmentOut).toString(16).padStart(64, '0'),
      root_hex: BigInt(root).toString(16).padStart(64, '0'), fee, feeAsset: fa.toString(),
      assetIn: assetIn.toString(), assetOut: assetOut.toString(),
    }, null, 1));
    return;
  }
  throw new Error('usage: m7prep.js note <amount> <asset> | payment <amountOut> <fee> <feeAsset> | crossasset <amountOut>');
})();
