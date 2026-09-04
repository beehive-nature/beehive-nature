// payment.circom — the private PAYMENT statement (SPEC-PRIVACY-1:
// M5 membership+conservation · M6 soundness (root+range) · M7 PER-ASSET
// conservation, founder-ruled: the pool holds many assets and b is never
// gas).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// Proves in ONE proof:
//  - MEMBERSHIP: the spent note's commitment is a leaf of the depth-`levels`
//    Poseidon tree whose root is PUBLIC (contract-computed since M6 — no
//    setter exists; the witness-side tree.js is a view of the same rule).
//  - NOTE SHAPE (M7): a note binds (secret, amount, asset) as
//    commitment = Poseidon(secret, Poseidon(amount, asset)) — every note is
//    single-asset by construction, and the tree hashing stays on the proven
//    t=3 Poseidon everywhere.
//  - NULLIFIER: Poseidon(secret, leaf_index), index derived in-circuit from
//    the membership path — one spendable nullifier per leaf.
//  - SAME-ASSET CONSERVATION (M7): assetIn === assetOut — a cross-asset
//    spend has NO satisfying witness (refused at generation); value
//    balances within that asset only: amountIn = amountOut + feeFromNote.
//  - THE FEE LEG (M7): fee + feeAsset are PUBLIC. The fee counts against
//    the note's value ONLY when feeAsset equals the note's asset
//    (feeFromNote = fee·[feeAsset == assetIn]); a fee in a DIFFERENT asset
//    (the meter's leg — e.g. A against a note earned in b) leaves the note
//    intact and settles outside the shielded balance, publicly declared
//    and transcript-bound.
//  - RANGE CHECKS (M6): amountIn, amountOut, fee each decompose to 64
//    bits — conservation cannot wrap mod p.
//
// Labeled bounds: asset ids are unbounded field elements (ids, not values
// — an id collision requires a Poseidon collision; a range-check lane is
// named hardening if ids ever carry semantics). Deposit amounts and asset
// ids are recorded openly at the on-ramp; payment notes keep both private.
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Payment(levels) {
    // private
    signal input secret;
    signal input amountIn;
    signal input assetIn;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input secretOut;
    signal input amountOut;
    signal input assetOut;
    // public
    signal input root;
    signal input nullifier;
    signal input commitmentOut;
    signal input fee;
    signal input feeAsset;

    // the spent note — commitment = Poseidon(secret, Poseidon(amount, asset))
    component vIn = Poseidon(2);
    vIn.inputs[0] <== amountIn;
    vIn.inputs[1] <== assetIn;
    component cIn = Poseidon(2);
    cIn.inputs[0] <== secret;
    cIn.inputs[1] <== vIn.out;

    // NULLIFIER — bound to the leaf index derived from the path itself
    signal leafIdx[levels];
    leafIdx[0] <== pathIndices[0];
    for (var i = 1; i < levels; i++) {
        leafIdx[i] <== leafIdx[i-1] + pathIndices[i] * (2 ** i);
    }
    component cNull = Poseidon(2);
    cNull.inputs[0] <== secret;
    cNull.inputs[1] <== leafIdx[levels-1];
    cNull.out === nullifier;

    // the new note — same shape, its asset hidden inside its commitment
    component vOut = Poseidon(2);
    vOut.inputs[0] <== amountOut;
    vOut.inputs[1] <== assetOut;
    component cOut = Poseidon(2);
    cOut.inputs[0] <== secretOut;
    cOut.inputs[1] <== vOut.out;
    cOut.out === commitmentOut;

    // SAME-ASSET — cross-asset spends die HERE, at witness generation
    assetIn === assetOut;

    // the fee counts against the note only in the note's own asset
    component feeSame = IsEqual();
    feeSame.in[0] <== assetIn;
    feeSame.in[1] <== feeAsset;
    signal feeFromNote;
    feeFromNote <== fee * feeSame.out;              // one product (circom rule)
    amountIn === amountOut + feeFromNote;

    // RANGE CHECKS (M6 carries over)
    component rcIn = Num2Bits(64); rcIn.in <== amountIn;
    component rcOut = Num2Bits(64); rcOut.in <== amountOut;
    component rcFee = Num2Bits(64); rcFee.in <== fee;

    // MEMBERSHIP — Poseidon path from the spent commitment to the root
    component hasher[levels];
    signal node[levels + 1];
    node[0] <== cIn.out;
    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;      // bit ∈ {0,1}
        hasher[i] = Poseidon(2);
        // bit=0: node is the LEFT child; bit=1: the RIGHT child
        hasher[i].inputs[0] <== node[i] + pathIndices[i] * (pathElements[i] - node[i]);
        hasher[i].inputs[1] <== pathElements[i] + pathIndices[i] * (node[i] - pathElements[i]);
        node[i + 1] <== hasher[i].out;
    }
    node[levels] === root;
}

component main {public [root, nullifier, commitmentOut, fee, feeAsset]} = Payment(20);
