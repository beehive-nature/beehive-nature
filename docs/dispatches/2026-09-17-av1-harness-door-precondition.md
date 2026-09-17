# AV-1 HARNESS DOOR PRECONDITION — main-red 1.4c repaired at cause (harness, not meter) · 2026-09-17

**Order (founder, verbatim):** *"AV-1 HARNESS REPAIR — CLAIM APPROVED. Scope
is test harness only. No meter.py semantic changes. Preserve both laws
explicitly: A. door reachable → crash seam remains testable … B. door
unreachable → M-REPAIR park law … Negative control: demonstrate that
removing the stub from the crash case reproduces the current 1.4c failure,
so the repaired harness proves it detects its own missing precondition. …
Open a small PR naming the root cause: 'AV-1 harness supplies the M-REPAIR
door-health precondition.' Do not alter the ASSURANCE LEDGER's AV-1 D
classification; this is a CI/harness repair, not a new live assurance
promotion. If CI differs from the local stub behavior, investigate the
harness/environment only. Do not 'fix' the meter to satisfy the test."*

Seat: **bKiMi** (first lane). Claim announced in the skaists Buzz #general
orientation thread; review path per the founder's autonomy ruling: bKiMi →
CI → zCode/lane-owner review → merge.

## Root cause (measured, not inferred)

M-REPAIR `f065f76f` wired the AV-3 door-health gate into `_admin_charge`
(`gate_door_health()` → PARK on unreachable). The AV-1 serve-bridge battery
predates the gate and never set `GATE_PROBE_URL`, so in CI (and any
gate-less environment) every charge **parked** — 200 `{parked: true}`,
zero writes — and the 1.4c crash-header request received a live parked
response instead of a dead connection: `FAIL: 1.4c: crash header did not
kill the server`. First red of the class is `f065f76f`'s own CI run; every
main commit through `0e1c22ec` inherited it. The meter law was behaving
correctly the whole time; the harness was stale relative to M-REPAIR.
Evidence: identical failure reproduced locally at `0e1c22ec` (conservation
`84.0000 − 0 = 84.0000` — zero charges land); the unmodified battery with
a live stub door (`GATE_PROBE_URL=http://127.0.0.1:18091`) passes ALL
proofs (`84.0000 − 35.2000 = 48.8000` — charges land). No active branch
carried a fix (`git log --all --oneline --not main --
scripts/buzz-meter/test_serve_bridge.py scripts/buzz-meter/meter.py`
empty).

## The change (ONE file: `scripts/buzz-meter/test_serve_bridge.py`, +123/−10)

- **`DoorStub`** — a harness-owned readiness door (any HTTP answer counts
  as reachable, per `gate_door_health`). Every `Server` the battery spawns
  now gets its door state EXPLICITLY (`door_url` → `GATE_PROBE_URL`); no
  case rides ambient environment.
- **Cases 1.1–1.4 + negative control** run with the stub UP — 1.4c's crash
  seam is reachable again (charter arm A). The negative control's
  double-charge now also runs against an explicitly reachable door.
- **Case 1.5 (new): door-health admission law, on purpose** (charter arm
  B): a REFUSED door ⇒ the charge PARKS (typed `{parked: true,
  park_reason: "door"}`, zero writes, ledger bytes identical, process
  alive), the idempotency key is UNCONSUMED — proven by spending it for
  real once the door returns on the SAME ledger (exactly one CHARGE) — and
  a crash-header request behind the refused door gets the parked answer
  and kills NOTHING: admission precedes the crash seam. That last
  assertion is the charter's negative control — the pre-repair 1.4c
  failure shape, reproduced and asserted as law.

## Receipts (WSL python3 3.14.4, native /tmp copy — the nest has no native
## Windows python; worktree `wt-bkimi-av1` @ branch tip)

```
ok: 1.1: SIGKILL mid-settle → exactly-once across restart; identical resubmission returns the SAME event; chain verifies
ok: 1.2: 8×12 mixed ops — chain valid, conservation exact (84.0000 − 35.2000 = 48.8000), every response coherent
ok: 1.3: 15-shape hostile battery — every refusal typed 4xx, process alive, ledger bytes IDENTICAL
ok: 1.4: unknown-response recovery — settle AND charge resubmissions return the original outcome; no second effect
ok: 1.5: door-health admission law — refused door ⇒ typed park, zero writes, key UNCONSUMED, crash seam unreachable behind admission; door back ⇒ the same key charges exactly once
ok: negative control: idempotency-ignoring variant double-charged (distinct receipts, 2 charge events) and the battery caught it
=== AV-1 SERVE-BRIDGE — ALL PROOFS PASS ===  (exit 0)
```

Sibling batteries from the same copy (unchanged files, run to prove no
collateral): `test_voucher_escrow`, `test_x402_meter`,
`test_av3_split_brain`, `test_av4_handle_unlinkability`,
`test_av5_reorg_drill`, `test_av6_retry_storm` — all green (this run).

## Scope statements

- **No `meter.py` semantic change** — the diff touches only the battery
  (`git diff --stat`: one file). Runtime behavior unchanged.
- **ASSURANCE-LEDGER untouched** — AV-1 stays **D** per the founder order;
  this is a CI/harness repair, not an assurance promotion.
- Main's static job is expected green on this branch; if CI differs from
  the local stub behavior, the harness/environment is the investigation
  surface, never the meter.
