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

1. `python check_manifest.py` must print MATCH (hash
   `acc9cb10…569c`, 40 items, 5,037 bytes). Abort otherwise.
2. Pass the frozen file explicitly: `--manifest <path>/manifest.json`
   (required flag; the runtime freezes byte-exact copies as
   `runs/<session>/frozen-manifest.bin` and `sandbox/input.bin` —
   re-verify both SHA-256 values against `acc9cb10…569c` after the run).
3. Pass `--order-id demo-task` EXPLICITLY in both execution and
   `--verify-only` (the executable's execution default differs, so an
   omitted flag binds the wrong order).

## 3. Public identity material

1. The runtime generates the run identity and writes
   `runs/<session>/public-material.json` BEFORE model execution.
   Archive that actual file (it must contain non-empty
   `genesis_op_b64u` alongside `did`, `alg`, `verifying_key_b64u`)
   and use THAT runtime's identity for all verification — never a
   different run's, never a hand-written one.
2. Never write private keys or credentials to this directory
   (`keys/`, `nostr-keys/` and vault phrases stay out of evidence).

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

1. Execute against a FRESH workdir and unique session per rehearsal,
   e.g. `--workdir <workdir> --session <session>`, preserving BOTH
   `<workdir>/runs/<session>/` (frozen manifest, `run-definition.json`,
   `public-material.json`, `receipt.json`, `evidence/` with canonical
   transcript + hash, `checkpoints.json`, `run-outcome.json`,
   `backend-health.json`) AND the matching
   `<workdir>/sessions/<session>.goal.json`,
   `<workdir>/sessions/<session>.jsonl` (plus
   `<session>.checkpoints.jsonl` when the run writes one). Never reuse
   a session until the same-session refusal correction is qualified —
   reuse is itself refusal case R5 (see `EXPECTED-REFUSALS.md`).
2. Capture stdout, stderr AND the process exit code for every
   invocation (execution and `--verify-only` alike); store all three
   with the run evidence. Verify with `--verify-only --workdir <same>
   --session <same> --order-id demo-task`, which re-checks manifest
   hash/count, saved goal, transcript, checkpoint pair, requested
   order and receipt signature via `verify_saved_run`.
   `EndTurn` without a verifying receipt fails; backend exhaustion,
   cancellation and turn-budget exhaustion fail even with a receipt on
   disk (case R8).

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
