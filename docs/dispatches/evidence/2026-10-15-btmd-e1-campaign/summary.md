# E1 comparison campaign — 5 legs × 10 interleaved trials (2026-10-15)

Scale 9, pinned v0.47.1 release (baseline/shed/shedhi) + rebuilt candidate ff71bcac-era binaries (e1off/e1; digest in BUILD-RECEIPT), 180s windows, identical workload, fail-fast runner with verdict identity validation. Individual outcomes preserved; counts never averaged into a pass.

| leg | binary | config | within-gate pairs (per trial) | LATE latency s (min/med/max) | NEVER |
|---|---|---|---|---|---|
| baseline | release | observe_only | 20,20,20,20,20,20,20,20,20,20 | - | - |
| shed | release | shed_normal stock | 0,15,4,12,18,0,10,12,2,12 | 15.5 / 58.3 / 65.3 | 3 |
| shedhi | release | shed budget x10 | 20,20,20,20,20,20,20,20,20,20 | - | - |
| e1off | candidate | shed_normal share=0 | 3,12,10,12,11,5,20,13,12,12 | 46.3 / 56.8 / 91.3 | 0 |
| e1 | candidate | shed_normal share=250 peer=500 | 16,14,11,15,14,19,20,18,10,15 | 12.5 / 15.6 / 21.2 | 0 |

- e1 vs e1off (the ONLY difference: reservation share 0→250): within-gate ~76% of pairs vs ~55%; the LATE tail collapses from median 56.8s (the anti-entropy cycle) to median 15.6s; NEVER eliminated in both candidate legs (0 vs 3 in stock shed).
- e1off vs shed isolates the build difference (candidate binary, share 0): ~55% vs ~42.5% within-gate — within this sample's spread (0–18/20 per trial); recorded, not explained.
- 100% within-gate NOT reached by e1: the remaining late deliveries sit just past the gate (median 15.6s) — consistent with the founder's capacity ceiling: reservation redistributes bandwidth, it does not create it; announcement coalescing/dedup is the named next mechanism, not more priority.
- baseline and shedhi replicate 10/10 clean (consistent with the N=10 study).
