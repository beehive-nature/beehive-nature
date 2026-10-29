# CAPTURE PROCEDURE — B9 recorded run (H02 lane)

All slots below are EMPTY in this prepared layout. Executing these
steps produces the recorded run; until then, no run is claimed.

Prerequisites (blockers, not assumed): the PR #492 candidate's hosted
harness checks are green for its exact head, and two backends are
verified usable by successful provider calls (not credit claims).
No paid calls are made by preparation; the run itself needs an
authorized payer (see §7) before any backend request.

## 1. Source and binary provenance

1. `git rev-parse HEAD` in the run worktree; record branch and status.
2. `cargo --version`; pinned toolchain per the H01 dispatch (1.98.1).
3. Build the harness binary; record its SHA-256 and the Windows
   bSigner artifact job reference. Store under `timing/` with the log.

## 2. Frozen input and expected order

1. Copy `manifest.json` (this directory) into the sandbox as
   `input.bin`. The copy must preserve the frozen bytes exactly
   (re-verify SHA-256 after copying); the same holds for any copy
   named `frozen-manifest.bin`.
2. `python check_manifest.py` must print MATCH (hash
   `acc9cb10…569c`, 40 items, 5,037 bytes). Abort otherwise.
3. `order_id` for the run: `demo-task` (matches EXPECTED.json).
   Execution and independent verification must use this pinned value.

## 3. Public identity material

1. Generate the demo bSigner identity; export public material
   (`did`, `alg`, `verifying_key_b64u`) into `identity/` BEFORE the run.
2. Never write private keys or credentials to this directory.

## 4. Canonical pre/post transcripts and signed checkpoints

1. The coordinator seeds the B9 task once (`seed_task_once`) and
   captures the pre-switch checkpoint; kill the primary backend
   mid-task and capture failover + post-switch checkpoint.
2. Store canonical newline-joined transcripts in `transcripts/`
   (pre, post) and signed checkpoint envelopes in `checkpoints/`.
3. Verify SAME ACTOR with `IdentityHook::verify_same_actor`
   against the exported material from step 3 (same key, recomputed
   DID binding, complete-message continuation).

## 5. B9 receipt and independent verifier output

1. Execute against a FRESH workdir and session per rehearsal, e.g.
   `--workdir runs/rehearsal-<date> --session <session>` producing
   isolated evidence at `runs/<session>/` (frozen `frozen-manifest.bin`,
   transcripts, checkpoints, receipt). Never reuse a session
   directory until the same-session refusal correction lands — reuse
   is itself a refusal case (see `EXPECTED-REFUSALS.md`).
2. Pass `--order-id demo-task` EXPLICITLY in both execution and
   `--verify-only` (the executable's execution default differs, so an
   omitted flag binds the wrong order). Verify with `--verify-only
   --workdir <same> --session <same> --order-id demo-task`, which
   re-checks hash, count, requested order and signature via
   `verify_saved_run`; store its stdout beside the receipt.
   `EndTurn` without a verifying receipt fails; backend exhaustion
   (`BackendsExhausted`) fails even with a receipt on disk.

## 6. Actual fault/backend timing

1. Record wall-clock timestamps for: first backend request, fault
   injection (primary kill), failover, second-backend completion.
2. Store raw timing log in `timing/`. No simulated or fabricated
   durations; gaps or inconclusive timing are reported as such.

## 7. Authorized payer, budget and usage

1. Record the authorized payer (DID or account id), the budget cap
   for the run, and per-backend usage (requests, tokens) from
   provider receipts — not estimates.
2. B9 custody verification is separate from economic settlement
   (the settle lane owns settlement); this section proves the run
   paid its own way and stayed within budget.

## 8. Screen recording and clearly labeled event replay

1. Screen-record the full run (fault injection visible).
2. Store the recording reference in `recording/` plus an event-replay
   log with labeled markers aligned to §6 timestamps:
   `TASK-SEEDED`, `FIRST-REQUEST`, `FAULT-INJECTED`,
   `FAILOVER`, `CHECKPOINT-POST`, `RECEIPT-WRITTEN`, `ACCEPTED`.
