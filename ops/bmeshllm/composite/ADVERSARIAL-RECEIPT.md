# Adversarial composite — residuals closed, invariant held (2026-09-16)

Founder mission executed: **both residuals hardened off-production**, then
the composite rerun across **multiple kill/restart cycles and repeated task
ids**. **FAILED=0** (receipt: `adversarial-receipt.log`). P-C disabled
throughout; production untouched.

## Residual 1 closed — boot-epoch-qualified ledger identity

- Every ledger key is now `epoch:task` (`meter-pd.py: _q()`); the watch loop
  bumps the epoch on each `llama_server: model loaded` marker, carries no
  open/pending state across the boundary, and persists the counter.
- `replay()` re-enumerates boots from the log's own markers, so replay keys
  align with the live watch's numbering.
- **Deterministic collision proof (A10, scratch root):** the SAME numeric
  task id completing in two different boots bills **exactly twice** under
  distinct keys (`41:7`, `42:7`) — neither suppressed by collision nor
  duplicated — and replaying both boots again manufactures nothing.
- Live runs rarely sample a real collision by luck (llama's `/slots` probes
  consume task ids, drifting the numbering) — which is exactly why the
  deterministic scratch test is the right instrument.

## Residual 2 closed — evidence-backed sweep-window bounds

- `sweep-bound-evidence.py` measures every task's launch→settle interval per
  boot from a REAL log and recommends `WEDGE_SILENCE_S = max(3× observed_max,
  30 s)`. Measured on this box: **max 15.431 s → 46.3 s recommended** (run 2
  re-derived 30.0 s from its own calmer log — the window follows evidence,
  not a hand-picked constant).
- **Timestamp-format law found and fixed en route:** llama's elapsed prefix
  is `MINUTES . SECONDS . MILLISECONDS . micro` (verified against
  wall-clock: `0.08.315` = 8.315 s, `1.02.099` = 62.099 s) — not
  hours/minutes — the first cut of the measurer produced 913 s and negative
  intervals from the misparse.

## Third catch (the adversarial run earned its keep)

The **single-segment wedge branch fired on any launch whose settle landed in
a later 5 s poll** — no age check — double-marking settled tasks as wedged
(this polluted earlier runs' evidence counts too). Fix: the branch now fires
ONLY in the ledger-less pure/battery path; the watch path's aging sweep owns
wedge detection exclusively.

## The battery (real llama, plain decoding, loopback, ~2.5 min)

A1 boot0 completion → payment #1 · A2 clean SIGKILL (no in-flight work):
gap admission refused **503** (probed *during* the dead window — the first
run's probe landed after recovery and became an accidental real completion,
shifting every count; timing fixed), watchdog detected, boot1 recovered · A3
boot1 completion → payment #2 (repeated-id boot, billed independently) · A4
SIGSTOP mid-generation: idle-cut 504, watchdog TERM→KILL cycle, boot2
recovered · A5 direct abort → PARTIAL evidence · A6 boot2 completion →
payment #3 · A7 **exactly 3 payment receipts for 3 true completions across 3
boots** · A8 meter restart: zero new artifacts · A9 epoch-aware full-log
replay: **zero new artifacts** · A10 invariant audit: all ledger keys
epoch-qualified, ≥3 epochs, deterministic collision 2-for-2, zero billable
shapes outside the payment chain, tips differ.

## The central invariant — held under attack

**Restart (×2, clean and wedge class), replay (full log), cancellation,
timeout, and wedge recovery manufactured ZERO billable COMPLETE receipts.**
Every payment receipt corresponds to one true completed generation, counted
once, keyed by boot.
