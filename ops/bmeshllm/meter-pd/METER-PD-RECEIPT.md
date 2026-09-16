# P-D implemented and battery-passed — delivery-state semantics (2026-09-16)

Founder constraint, verbatim and structural: **distinguish `COMPLETE`,
`PARTIAL/CANCELLED`, `FAILED/TIMEOUT`, and `UNKNOWN/WEDGED` without
pretending partial token observations are completed billable work. Preserve
raw evidence separately from any future billing decision.** Payment and
delivery state are separate chains. No production deployment.

## The state → artifact mapping (the roll-forward answer)

| state | detection | artifact | billing |
|---|---|---|---|
| `COMPLETE` | timing pair (production parser unchanged) | payment receipt, the existing chain shape (`receipts/`, own tip) | the only billable artifact — unchanged semantics |
| `PARTIAL/CANCELLED` | `stop: cancel task` + `slot release … n_tokens = N` (or release without cancel) | evidence record (`evidence/`): `billing: null`, `observed.n_tokens_at_stop`, **raw log lines verbatim**, NO `line_items`/`total_computed` anywhere | none — a future billing decision re-derives from the preserved evidence |
| `FAILED/TIMEOUT` | the bounded gate's verdict line (`504`/`header-timeout`/`stream-idle-cut`/`502`) | failure receipt (`receipts-failure/`, **its own chain tip**), `payment: "none"` | none |
| `UNKNOWN/WEDGED` | task launched, never settled (no timing, no release) | failure receipt (source `meter-wedge-detector`, silence window `WEDGE_SILENCE_S`) + evidence record with raw launch lines | none |

A single append-only `state.jsonl` carries all four states — the delivery
ledger; the payment chain tip and the failure chain tip are distinct files
(proven unequal in B5). `B6` audits that **zero billable shapes exist outside
the payment chain**.

## Artifacts

- `meter-pd.py` — imports the production meter as a module (its emitter's
  sinks redirect to `PD_ROOT`; `/opt/buzz-meter/meter.py` and its state are
  never touched), adds the four-state parser `parse_delivery`, the gate
  verdict ingest `ingest_gate_verdict`, evidence/failure emitters, and a
  minimal `--watch` loop (llama log + gate log tails; offset-based, so
  artifacts are write-once per log segment).
- `run-pd-tests.sh` — the battery. **17/17 PASS** (2026-09-16 06:32:49Z,
  box, python3 stdlib, scratch `PD_ROOT`): B1 COMPLETE payment-only ·
  B2 PARTIAL evidence-only with `billing:null` + verbatim raw lines +
  `n_tokens=28` under `observed` · B3 gate 504 → `FAILED/TIMEOUT`,
  `payment:"none"` · B4 launch-without-settle → `UNKNOWN/WEDGED` · B5 chain
  separation + failure-chain linking + all four states in the stream ·
  B6 the non-pretense audit. Receipt log: `pd-receipt.log`.

## Bug found and fixed during the battery

First run 16/17: `COMPLETE` reached the payment chain but not the delivery
stream — the four-state law requires the stream to carry it. Fixed at the
emit seam (a payment receipt is the billing act; the stream line is the
delivery observation — same event, two ledgers, by design).

## Deployment posture

Staged, not installed — same posture as the watchdog and the bounded gate.
The three staged layers now compose: gate bounds (P-A/P-B) → watchdog
(server recovery) → meter states (P-D accounting closure). P-C
(cancellation propagation) remains last, behind the watchdog, per the
sequencing ruling.
