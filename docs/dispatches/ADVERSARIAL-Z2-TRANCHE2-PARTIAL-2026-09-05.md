# z2 tranche 2 — partial (≤150 words, per order)

**Poseidon2:** structure read (t=3, x⁵ sbox, 3+57+3 rounds, M8 Montgomery-baked constants; 479 lines not 1248 — shrunk by M8). **OPEN DISCREPANCY:** my standalone harness (tpos_adv.cpp, committed) gets poseidon2([1,2]) = `2b492b…` while awaited circomlibjs gives `76d103…` — yet the on-chain 10-leaf differential (200 contract poseidon2 calls vs tree.js/circomlibjs roots) matched at every step, and the empty-root (zeros-chain) calibration matched. Standalone-vs-contract disagreement this consistent suggests MY harness context (not their deployed path) is wrong — but it is NOT yet proven which. Filed OPEN, one debugging pass owed. Their own test_poseidon: 2/2.

**Ceremony provenance + forged/replay probes:** not yet run this pass.

**Filed:** F4 OPEN (above); harness + vectors committed (`tpos_adv.cpp`, posvec generation inline in dispatch history).
