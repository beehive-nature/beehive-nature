# 2026-10-13 · BTMD scale-9 dependability study — the N≥10 quantification and the carve-out determination

Order: founder disposition 2026-10-13 (milestone 1 closed; "scale-9
dependability and the upstream carve-out advance as the next
evidence-driven experiment"). Delivered from `wt-zcode-btmd-001`, branch
`zcode/btmd-scale9-study` (cut from main `71e334e58`, post-merge of
milestone 1).

## Design

30 independent trials, **interleaved by round** (each round runs shed →
baseline → shedhi back-to-back, so fleet/thermal conditions distribute
across legs), scale 9, pinned v0.47.1 (sha256 in the milestone dispatch),
identical workload profile, **180 s observation window** so late
convergence is recorded per op — never truncated to the gate. Per-op
gate: 10 s from publish (the trial op deadline — stricter than the 30 s
budget gate; any LATE row fails it).

| Leg | Config | Question it answers |
|---|---|---|
| `shed` | `byte_policy=shed_normal`, stock thresholds | does the milestone failure reproduce? |
| `baseline` | `observe_only` | the rig's own false-failure rate |
| `shedhi` | `shed_normal` + leaf budget ×10 | **carve-out proxy** — separates class-animus from budget-magnitude (upstream has no store-topic class knob) |

Runner: `scripts/btmd/scale9-study-run.sh`; analyzer:
`scripts/btmd/scale9-study-analyze.mjs` (individual outcomes preserved;
legs summarized as **counts**, never means; the milestone's 10/20 and
20/20 observations remain separate rows). Raw receipts: WSL
`~/btmd/runs/s9study-*` (durable, outside temp dirs). Distilled
evidence: `docs/dispatches/evidence/2026-10-13-btmd-scale9-study/`.

## Results (counts, per-trial rows in the evidence)

- **baseline: 10/10 fully within gate** — zero false failures; the rig
  is not the failure source.
- **shed (stock thresholds): 1/10 fully within gate.** 7 trials with
  LATE recoveries, 2 trials with NEVER (not converged within 180 s —
  one of them a total 0/20 collapse on both leaves).
- **shedhi (budget ×10, same policy): 10/10 fully within gate.**

Failure anatomy: LATE recoveries cluster at **48.8–63.9 s (median
53.0 s)** — the ~50 s anti-entropy cycle refills what eager forwarding
shed; it is a mechanism, not noise. Both leaf roles are hit (constrained
49, desktop 71 missing pairs). The two NEVER trials show the tail risk:
starvation can outlast a 180 s window outright.

## The carve-out determination (founder's three options, answered)

**For state-sync traffic at this workload/scale, an exemption ELIMINATES
the failure — proven by proxy**: raising the budget ×10 under the SAME
`shed_normal` policy restores 10/10 delivery, so the failure is
budget-exhaustion of Normal-class transit, not a defect in the shedding
verdicts themselves. A per-topic carve-out for joined-store topics (the
upstream S4 "revocation topics exempt first" precedent extended to
subscribed store convergence) would remove exactly this traffic from
budget pressure with the same effect.

**But the boundary is shifted, not abolished**: the mechanism still
governs every other Normal-class topic; a carve-out re-sizes the budget
pressure those topics feel (and makes leaf store traffic unbounded — a
NEW boundary the carve-out's own design must then bound). And for the
leaf profile as shipped — stock thresholds, no carve-out — scale-9
state-sync is **failed outright**: 9/10 trials miss the gate, 2/10 miss
a 180 s window.

## Standing conclusions (unchanged, now quantified)

- **Scale-9 stays FAIL / unreliable-within-gate** for
  `LEAF-SHED-NORMAL-1` at stock budgets — with a measured distribution:
  1/10 clean, 7/10 late (~53 s anti-entropy recovery), 2/10 never (≤180 s).
- LEAF-SHED-NORMAL-1 remains **unqualified for state-sync-heavy
  (W@tch-shaped) leaves**. The profile header constraint now cites this
  study. Desktop/announce-only leaves at scales 3–6 remain supported by
  the milestone evidence.
- The upstream questions this hands Track E: (1) the joined-store-topic
  carve-out (S4 precedent), with the budget-shift caveat above; (2)
  whether the ~50 s anti-entropy recovery should count as "delivered"
  for store convergence gates upstream defines; (3) #1170 per-kind
  counters would attribute the starved bytes per topic directly.

HUMAN INTERACTION: NONE · NEXT OWNER: authorized merger (this PR), then
the upstream Track E conversation via the standing watch (no unsolicited
posts from this seat).
