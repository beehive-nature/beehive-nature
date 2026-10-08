// count_scale.circom — the count-only workload, PARAMETRIZED for the
// bTunGsTeN 4 scale beats (founder order 2026-10-08: run the EXISTING
// workload at n=1k and n=10k — same leaf logic, same claim shape, same
// fold law as count.circom; only n and the pad fraction change).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//   n = leaf count (power of two); members = real slots; pads = n - members
//   are constrained-zero like the 64-leaf circuit.
// The main component is instantiated per scale run:
//   component main {public [root, kind, count]} = CountScale(<n>, <members>);
pragma circom 2.0.0;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Leaf() {
    signal input fp;
    signal input pheno;
    signal input r1, r2, r3;
    signal output leafHash;
    signal output keptDead;
    signal output keptLive;
    pheno * (pheno - 1) === 0;
    component rc1 = Num2Bits(2); rc1.in <== r1;
    component rc2 = Num2Bits(2); rc2.in <== r2;
    component rc3 = Num2Bits(2); rc3.in <== r3;
    signal packed <== r1 + 4 * r2 + 16 * r3;
    component pv = Poseidon(2); pv.inputs[0] <== pheno; pv.inputs[1] <== packed;
    component pl = Poseidon(2); pl.inputs[0] <== fp; pl.inputs[1] <== pv.out;
    leafHash <== pl.out;
    component ez1 = IsZero(); ez1.in <== r1;
    component ez2 = IsZero(); ez2.in <== r2;
    component ez3 = IsZero(); ez3.in <== r3;
    signal expected <== 1 + pheno;
    component eq1 = IsEqual(); eq1.in[0] <== r1; eq1.in[1] <== expected;
    component eq2 = IsEqual(); eq2.in[0] <== r2; eq2.in[1] <== expected;
    component eq3 = IsEqual(); eq3.in[0] <== r3; eq3.in[1] <== expected;
    signal mis1 <== (1 - ez1.out) * (1 - eq1.out);
    signal mis2 <== (1 - ez2.out) * (1 - eq2.out);
    signal mis3 <== (1 - ez3.out) * (1 - eq3.out);
    signal flips <== mis1 + mis2 + mis3;
    component ezf = IsZero(); ezf.in <== flips;
    signal settledSum <== (1 - ez1.out) + (1 - ez2.out) + (1 - ez3.out);
    component ezs = IsZero(); ezs.in <== settledSum;
    signal kept <== ezf.out * (1 - ezs.out);
    keptDead <== kept * (1 - pheno);
    keptLive <== kept * pheno;
}

template FoldLevel(n, half) {
    signal input hIn[n];
    signal input dIn[n];
    signal input lIn[n];
    signal output hOut[half];
    signal output dOut[half];
    signal output lOut[half];
    component ph[half];
    for (var j = 0; j < half; j++) {
        ph[j] = Poseidon(2);
        ph[j].inputs[0] <== hIn[2 * j];
        ph[j].inputs[1] <== hIn[2 * j + 1];
        hOut[j] <== ph[j].out;
        dOut[j] <== dIn[2 * j] + dIn[2 * j + 1];
        lOut[j] <== lIn[2 * j] + lIn[2 * j + 1];
    }
}

// recursive fold: compile-time unrolled by circom's template params
template Fold(n) {
    signal input hIn[n];
    signal input dIn[n];
    signal input lIn[n];
    signal output hOut;
    signal output dOut;
    signal output lOut;
    if (n == 1) {
        hOut <== hIn[0]; dOut <== dIn[0]; lOut <== lIn[0];
    } else {
        component fl = FoldLevel(n, n \ 2);
        fl.hIn <== hIn; fl.dIn <== dIn; fl.lIn <== lIn;
        component nxt = Fold(n \ 2);
        nxt.hIn <== fl.hOut; nxt.dIn <== fl.dOut; nxt.lIn <== fl.lOut;
        hOut <== nxt.hOut; dOut <== nxt.dOut; lOut <== nxt.lOut;
    }
}

template CountScale(n, members) {
    signal input fp[n];
    signal input pheno[n];
    signal input r1[n];
    signal input r2[n];
    signal input r3[n];
    signal input root;
    signal input kind;
    signal input count;
    component lf[n];
    signal h0[n]; signal d0[n]; signal l0[n];
    for (var i = 0; i < n; i++) {
        if (i >= members) { fp[i] === 0; pheno[i] === 0; r1[i] === 0; r2[i] === 0; r3[i] === 0; }
        lf[i] = Leaf();
        lf[i].fp <== fp[i]; lf[i].pheno <== pheno[i];
        lf[i].r1 <== r1[i]; lf[i].r2 <== r2[i]; lf[i].r3 <== r3[i];
        h0[i] <== lf[i].leafHash; d0[i] <== lf[i].keptDead; l0[i] <== lf[i].keptLive;
    }
    component fold = Fold(n);
    fold.hIn <== h0; fold.dIn <== d0; fold.lIn <== l0;
    fold.hOut === root;
    kind * (kind - 1) === 0;
    // THE SELECTOR LAW (same line as the repaired count.circom)
    signal picked <== fold.dOut + kind * (fold.lOut - fold.dOut);
    picked === count;
}
