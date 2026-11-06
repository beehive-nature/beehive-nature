# QUALIFICATION — H01 correction `a55e27bd` (2026-10-29)

Kept separate from the pre-correction (`a4e01714`) preservation
record. Reference material independently retained: golden
`manifest.json` (`acc9cb10…569c`, 40 items) + `EXPECTED.json`.

- Harness source: PR #492 `a55e27bd2b32098e42d74f1b0523c0d64b8d60cf`
  ("authenticated terminal outcome, complete checkpoint inventory,
  atomic occupied-session refusal"), built detached (no commits).
- Binary digest: `235821F652CAC5A40DFBC51B9491A160FDE82EFF45E840A7F217A5EAC2D8D646` <!-- PUBLIC-CONSTANT -->.
- Backends: same scripted loopback; no providers/credits. New signed
  `TerminalOutcome` record observed (`outcome_kind`, bound
  session/order/actor/manifest/transcript/inventory + `envelope`).

## Fresh valid controls (`runs/qual-a55e27bd/`)

- `control-baseline` (`sess-qbase`): exit 0 PASS, 187 ms; verify-only
  PASS afterwards.
- `control-failover` (`sess-qf1`): one dead backend then loopback,
  exit 0 PASS in 10.2 s; `pre-switch` + `post-switch` signed pair;
  verify-only PASS (`checkpoints_verified=2 same_actor=true`).

## Lead's two new cases

- N1a — whole valid actor-B bundle substituted for actor A under the
  same session dir (`sess-A`), order (`demo-task`) and manifest
  bytes: exit 3 `run definition is for session sess-qB, not the
  requested session sess-A` → session binding ENFORCED (defect fixed).
- N1b — same swap with `public-material.json` omitted: exit 3 read
  error, fail-closed → PASS (missing material fails closed).
- N2 — `[pre, post]` replaced by `[pre, pre]` in BOTH checkpoint
  inventories (`evidence/checkpoints.json` AND
  `sessions/sess-qf1.checkpoints.jsonl`), original terminal signature
  retained: exit 0 PASS → duplication/omission NOT detected
  (duplicated pair genuinely verifies; same class as R4a). Recorded
  as actual, no defect claim beyond inventory-completeness scope.

## Affected-refusal rerun (corrected binary)

- R1' outcome swap: exit 3 `terminal outcome does not bind the
  executed run` → FIXED.
- R2a' edited kind: exit 3 `terminal outcome signature does not
  verify` → FIXED.
- R2b' minimal hand-written outcome: exit 3 `record shape: missing
  field session_id` → FIXED.
- R4b' stripped envelopes: exit 3 `exported checkpoint inventory is
  not the complete ordered persisted log` → FIXED.
- R4c' non-array: exit 3 `exported checkpoint evidence is not an
  array` → FIXED.
- R5' occupied-session reuse: exit 2 `session sess-qbase is already
  occupied (...jsonl exists); refusing before any mutation` →
  FIXED; post verify-only PASS, DID unchanged → preservation control
  holds.
- R7' wrong order, R8' failed+receipt: still refuse with specific
  errors (no regression).
- R3 middle-signature on a passing run: still unconstructible (third
  signed phase exists only on exhaustion; prober window unchanged) —
  carried as the genuine interior-signature case for the next round.

Pre-correction evidence (`runs/`, replay packages) preserved
unchanged as the historical record.
