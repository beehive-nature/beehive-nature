# BTMD scale-9 dependability study — individual outcomes (2026-10-13/14)

30 independent trials, interleaved by round (shed, baseline, shedhi back-to-back per round), scale 9, pinned v0.47.1, identical workload profile, 180 s observation window. Per-op gate: 10 s from publish. Individual outcomes preserved — legs summarize as counts, never means. The milestone observations (10/20, 20/20) remain separate rows in the study JSON header.

## Leg summaries (counts)

- **baseline**: 10/10 trials fully within gate; 0 with LATE recoveries; 0 with NEVER (not converged in 180 s).
- **shed**: 1/10 trials fully within gate; 7 with LATE recoveries; 2 with NEVER (not converged in 180 s).
- **shedhi**: 10/10 trials fully within gate; 0 with LATE recoveries; 0 with NEVER (not converged in 180 s).

## Per-trial rows (shed leg detail; full detail in study.json)

| trial | sync within gate | failure detail |
|---|---|---|
| s9study-r1-shed | 0/20 | n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER; n1 NEVER; n2 NEVER |
| s9study-r10-shed | 20/20 | clean |
| s9study-r2-shed | 10/20 | n2 LATE-RECOVERED 55s; n2 LATE-RECOVERED 55s; n2 LATE-RECOVERED 55s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 52s |
| s9study-r3-shed | 11/20 | n2 LATE-RECOVERED 55s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 52s; n2 LATE-RECOVERED 52s |
| s9study-r4-shed | 4/20 | n1 LATE-RECOVERED 64s; n1 LATE-RECOVERED 64s; n1 LATE-RECOVERED 63s; n1 LATE-RECOVERED 63s; n1 LATE-RECOVERED 63s; n2 LATE-RECOVERED 63s; n1 LATE-RECOVERED 62s; n2 LATE-RECOVERED 62s; n1 LATE-RECOVERED 62s; n2 LATE-RECOVERED 62s; n1 LATE-RECOVERED 62s; n2 LATE-RECOVERED 62s; n1 LATE-RECOVERED 61s; n2 LATE-RECOVERED 61s; n1 LATE-RECOVERED 61s; n2 LATE-RECOVERED 61s |
| s9study-r5-shed | 10/20 | n1 LATE-RECOVERED 52s; n1 LATE-RECOVERED 51s; n1 LATE-RECOVERED 51s; n1 LATE-RECOVERED 51s; n1 LATE-RECOVERED 50s; n1 LATE-RECOVERED 50s; n1 LATE-RECOVERED 50s; n1 LATE-RECOVERED 49s; n1 LATE-RECOVERED 49s; n1 LATE-RECOVERED 49s |
| s9study-r6-shed | 4/20 | n1 LATE-RECOVERED 55s; n2 LATE-RECOVERED 55s; n1 LATE-RECOVERED 55s; n2 LATE-RECOVERED 55s; n1 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n1 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n1 LATE-RECOVERED 54s; n2 LATE-RECOVERED 54s; n1 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n1 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n1 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s |
| s9study-r7-shed | 9/20 | n1 LATE-RECOVERED 54s; n2 LATE-RECOVERED 51s; n1 LATE-RECOVERED 54s; n2 LATE-RECOVERED 51s; n2 LATE-RECOVERED 51s; n2 LATE-RECOVERED 50s; n2 LATE-RECOVERED 50s; n2 LATE-RECOVERED 50s; n2 LATE-RECOVERED 49s; n1 LATE-RECOVERED 52s; n2 LATE-RECOVERED 49s |
| s9study-r8-shed | 10/20 | n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER; n2 NEVER |
| s9study-r9-shed | 2/20 | n2 LATE-RECOVERED 53s; n2 LATE-RECOVERED 53s; n1 LATE-RECOVERED 52s; n2 LATE-RECOVERED 52s; n1 LATE-RECOVERED 52s; n2 LATE-RECOVERED 52s; n1 LATE-RECOVERED 52s; n2 LATE-RECOVERED 52s; n1 LATE-RECOVERED 51s; n2 LATE-RECOVERED 51s; n1 LATE-RECOVERED 51s; n2 LATE-RECOVERED 51s; n1 LATE-RECOVERED 51s; n2 LATE-RECOVERED 51s; n1 LATE-RECOVERED 51s; n2 LATE-RECOVERED 51s; n1 LATE-RECOVERED 50s; n2 LATE-RECOVERED 50s |

Baseline and shedhi legs: 10/10 clean each (per-trial rows in study.json).

LATE recovery times (shed leg): 48.8–63.9 s, median 53.0 s — clustered on the ~50 s anti-entropy cycle, not random.
Failures by node: constrained leaf 49, desktop leaf 71 — both roles affected.
