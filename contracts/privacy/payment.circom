// payment.circom — the private PAYMENT statement (SPEC-PRIVACY-1, M5:
// MEMBERSHIP + CONSERVATION, founder-ordered 2026-09-04).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// Proves ALL of the following in ONE PLONK proof:
//  - MEMBERSHIP: the spent note's commitment Poseidon(secret, amountIn) is
//    a leaf of a depth-`levels` Poseidon merkle tree whose root is PUBLIC —
//    without revealing which leaf (the tree lives off-chain; the root is
//    carried in the contract's law row, rehearsal-maintained via setroot).
//  - NULLIFIER: nullifier = Poseidon(secret, leaf_index) where the index is
//    DERIVED IN-CIRCUIT from the membership path — exactly one spendable
//    nullifier per leaf; the chain's nullifier set refuses double-spends.
//  - OUTPUT: commitmentOut = Poseidon(secretOut, amountOut) — the new note
//    (amountOut hidden; for a withdraw, amountOut = 0 and fee carries all
//    the value out publicly).
//  - CONSERVATION: amountIn === amountOut + fee, amounts PRIVATE, fee
//    PUBLIC — the meter bills the public leg (Lane M's tithe surface).
//
// Labeled exactly: amounts are unbounded field elements in this pass (no
// range-check circuit — value semantics rest on the deposit amounts the
// rehearsal chain records openly at the on-ramp; a range-check lane is the
// honest next hardening). The empty-subtree hashes are the zero chain
// (zeros[0]=0, zeros[l]=Poseidon(zeros[l-1], zeros[l-1])) — tree.js must
// agree; pathIndices bit = 1 means the current node is the RIGHT child.
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Payment(levels) {
    // private
    signal input secret;
    signal input amountIn;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input secretOut;
    signal input amountOut;
    // public
    signal input root;
    signal input nullifier;
    signal input commitmentOut;
    signal input fee;

    // the spent note's commitment — stays PRIVATE (which leaf is hidden)
    component cIn = Poseidon(2);
    cIn.inputs[0] <== secret;
    cIn.inputs[1] <== amountIn;

    // NULLIFIER BOUND TO THE LEAF INDEX: the index is DERIVED from the very
    // path that proves membership (Σ pathIndices[i]·2^i), so each leaf has
    // exactly one spendable nullifier — a free "tag" input here would let
    // the same leaf be spent once per tag (inflation). One spend per leaf,
    // in-circuit.
    signal leafIdx[levels];
    leafIdx[0] <== pathIndices[0];
    for (var i = 1; i < levels; i++) {
        leafIdx[i] <== leafIdx[i-1] + pathIndices[i] * (2 ** i);
    }
    component cNull = Poseidon(2);
    cNull.inputs[0] <== secret;
    cNull.inputs[1] <== leafIdx[levels-1];
    cNull.out === nullifier;

    // the new note's commitment (public; the chain stores it as a leaf)
    component cOut = Poseidon(2);
    cOut.inputs[0] <== secretOut;
    cOut.inputs[1] <== amountOut;
    cOut.out === commitmentOut;

    // conservation — value in = value out + public fee/tithe
    amountIn === amountOut + fee;

    // RANGE CHECKS (SOUNDNESS, founder order 2026-09-05): every amount is
    // decomposed to 64 bits, so conservation cannot wrap mod p — an
    // "overflow" spend (e.g. amountIn = 2^64 with matching out+fee mod p)
    // has no satisfying witness.
    component rcIn = Num2Bits(64); rcIn.in <== amountIn;
    component rcOut = Num2Bits(64); rcOut.in <== amountOut;
    component rcFee = Num2Bits(64); rcFee.in <== fee;

    // membership — Poseidon merkle path from the spent commitment to root
    component hasher[levels];
    signal node[levels + 1];
    node[0] <== cIn.out;
    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;      // bit ∈ {0,1}
        hasher[i] = Poseidon(2);
        // bit=0: node is the LEFT child; bit=1: node is the RIGHT child
        // (one product per constraint — circom's quadratic rule)
        hasher[i].inputs[0] <== node[i] + pathIndices[i] * (pathElements[i] - node[i]);
        hasher[i].inputs[1] <== pathElements[i] + pathIndices[i] * (node[i] - pathElements[i]);
        node[i + 1] <== hasher[i].out;
    }
    node[levels] === root;
}

component main {public [root, nullifier, commitmentOut, fee]} = Payment(20);
