// count.circom — the COUNT-ONLY aggregate receipt statement
// (SPEC-ZK-RECEIPT-AGGREGATES-1 §shape v1; RAID-VAULTA-ZK-1).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// Proves in ONE proof, over a PRIVATE witness the prover never uploads:
//  - COMMITMENT: the 64-leaf Poseidon tree folds — inside the circuit —
//    from the witness leaves themselves to the PUBLIC root. This is a
//    FULL-TREE fold, not 40 separate membership paths: the root is proven
//    to derive from EXACTLY this leaf set (no phantom, no skipped leaf —
//    every tree position is a witness input or a constrained zero pad).
//  - LEAF SHAPE: leaf = Poseidon(fp, Poseidon(pheno, packed)) where fp is
//    the 64-bit truncated endpoint fingerprint (the ant-reach pseudonym
//    discipline: identities enter as fingerprints, never raw addresses),
//    pheno ∈ {0=dead-baseline, 1=live-baseline}, packed = r1 + 4·r2 + 16·r3
//    with per-vantage verdict r ∈ {0=unsettled, 1=dead, 2=live}.
//  - THE CLAIM (publics root, kind K, count N):
//      count( members with ≥1 settled verdict AND zero flips ) == N
//    restricted to kind K (K=0 counts dead-baseline members, K=1 live) —
//    a flip is a settled verdict ≠ 1+pheno. Counts only, never contents:
//    the v1 law (sums/bounds are the SECOND circuit).
//
// Labeled bounds:
//  - r is range-checked to ≤3 bits, not enumerated: r=3 cannot INFLATE the
//    count (expected verdict is 1 or 2, so r=3 always reads as a flip and
//    excludes the member); the witness generator never emits it.
//  - keptDead/keptLive counters fold up the tree as plain field sums
//    (max 20 each by construction on the cohort witness; the circuit does
//    not bound them — the picked counter is checked against the public N,
//    which is the claim).
//  - Padding slots 40..63 are constrained to the all-zero preimage; their
//    leaves are circuit-deterministic and contribute 0 to both counters.
//  - fp is NOT range-checked to 64 bits: the root commits the fp values as
//    given; the fingerprint→receipt mapping is an off-circuit concern
//    (selective disclosure), and dropping the check keeps the tree inside
//    one pot (measured after compile; see prove_count.sh step 1 receipt).
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// One cohort member. kept = (≥1 settled run) AND (no settled run whose
// verdict differs from the member's baseline phenotype).
template Leaf() {
    signal input fp;
    signal input pheno;
    signal input r1, r2, r3;
    signal output leafHash;
    signal output keptDead;
    signal output keptLive;

    pheno * (pheno - 1) === 0;                    // baseline bit

    component rc1 = Num2Bits(2); rc1.in <== r1;   // verdicts ≤ 3 (see header)
    component rc2 = Num2Bits(2); rc2.in <== r2;
    component rc3 = Num2Bits(2); rc3.in <== r3;

    // leaf = Poseidon(fp, Poseidon(pheno, packed)) — the note-shape nested
    // t=3 Poseidon everywhere (payment.circom precedent)
    signal packed <== r1 + 4 * r2 + 16 * r3;      // < 64 by the rc checks
    component pv = Poseidon(2); pv.inputs[0] <== pheno; pv.inputs[1] <== packed;
    component pl = Poseidon(2); pl.inputs[0] <== fp; pl.inputs[1] <== pv.out;
    leafHash <== pl.out;

    // settled_k = r_k ≠ 0 ; flip_k = settled_k ∧ (r_k ≠ 1+pheno)
    component ez1 = IsZero(); ez1.in <== r1;
    component ez2 = IsZero(); ez2.in <== r2;
    component ez3 = IsZero(); ez3.in <== r3;
    signal expected <== 1 + pheno;
    component eq1 = IsEqual(); eq1.in[0] <== r1; eq1.in[1] <== expected;
    component eq2 = IsEqual(); eq2.in[0] <== r2; eq2.in[1] <== expected;
    component eq3 = IsEqual(); eq3.in[0] <== r3; eq3.in[1] <== expected;
    signal mis1 <== (1 - ez1.out) * (1 - eq1.out);   // one product each (circom rule)
    signal mis2 <== (1 - ez2.out) * (1 - eq2.out);
    signal mis3 <== (1 - ez3.out) * (1 - eq3.out);
    signal flips <== mis1 + mis2 + mis3;             // 0..3

    component ezf = IsZero(); ezf.in <== flips;   // 1 ⇔ zero flips
    signal settledSum <== (1 - ez1.out) + (1 - ez2.out) + (1 - ez3.out);
    component ezs = IsZero(); ezs.in <== settledSum;  // 1 ⇔ no settled runs
    signal kept <== ezf.out * (1 - ezs.out);

    keptDead <== kept * (1 - pheno);
    keptLive <== kept * pheno;
}

// One fold level: pairs (hash, deadKept, liveKept) up the tree. The
// counters ride the same fold as the hashes — the root's counters are
// proven to derive from the same leaves as the root's hash.
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

template CountTree() {
    // 40 cohort members padded to 64 leaves (all-zero preimage pads)
    signal input fp[64];
    signal input pheno[64];
    signal input r1[64];
    signal input r2[64];
    signal input r3[64];
    // public claim
    signal input root;
    signal input kind;    // K: 0 = count dead-baseline kept, 1 = live
    signal input count;   // N: the claimed count

    component lf[64];
    signal h0[64]; signal d0[64]; signal l0[64];
    for (var i = 0; i < 64; i++) {
        if (i >= 40) {                    // zero pads — circuit-deterministic
            fp[i] === 0; pheno[i] === 0; r1[i] === 0; r2[i] === 0; r3[i] === 0;
        }
        lf[i] = Leaf();
        lf[i].fp <== fp[i]; lf[i].pheno <== pheno[i];
        lf[i].r1 <== r1[i]; lf[i].r2 <== r2[i]; lf[i].r3 <== r3[i];
        h0[i] <== lf[i].leafHash;
        d0[i] <== lf[i].keptDead;
        l0[i] <== lf[i].keptLive;
    }

    component f1 = FoldLevel(64, 32); f1.hIn <== h0; f1.dIn <== d0; f1.lIn <== l0;
    component f2 = FoldLevel(32, 16); f2.hIn <== f1.hOut; f2.dIn <== f1.dOut; f2.lIn <== f1.lOut;
    component f3 = FoldLevel(16, 8);  f3.hIn <== f2.hOut; f3.dIn <== f2.dOut; f3.lIn <== f2.lOut;
    component f4 = FoldLevel(8, 4);   f4.hIn <== f3.hOut; f4.dIn <== f3.dOut; f4.lIn <== f3.lOut;
    component f5 = FoldLevel(4, 2);   f5.hIn <== f4.hOut; f5.dIn <== f4.dOut; f5.lIn <== f4.lOut;
    component f6 = FoldLevel(2, 1);   f6.hIn <== f5.hOut; f6.dIn <== f5.dOut; f6.lIn <== f5.lOut;

    f6.hOut[0] === root;                 // the committed set IS this leaf set

    kind * (kind - 1) === 0;             // K binary
    component selDead = IsEqual(); selDead.in[0] <== kind; selDead.in[1] <== 0;
    // one product (circom rule): mux the counter the claim counts
    signal picked <== f6.dOut[0] + selDead.out * (f6.lOut[0] - f6.dOut[0]);
    picked === count;                    // the claim, checked
}

component main {public [root, kind, count]} = CountTree();
