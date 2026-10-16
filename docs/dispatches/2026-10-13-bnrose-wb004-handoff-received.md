# 2026-10-13 · BNROSE-RUST-001 receives the WB004/#408 handoff — receiving owner recorded, corrections exercised on the Rust boundaries

**Receiving owner:** the BNROSE-RUST-001 / #411 lane (this seat, this
branch — `zcode/bnrose-rust-002`, rebased onto the merged `2fb6293e3`).
The sending session stays ARCHIVED per the ruling. Received:
`docs/handoffs/2026-10-13-wb004-jungle-live-settle-rust.md` and the
committed regression `scripts/btungsten/wb004-retry-safety.test.mjs`,
read in full.

## The founder's source-inspection findings, verified here

Read against the committed JS on main: `submitStep()` (line 235) builds
and signs before any already-submitted check; `restartReconcile()`
(line 251) takes the signed bytes as an argument on the SAME object —
not a reconstruction from disk in a new process; the first simulator's
propose path overwrites the same proposal-name entry (successive
proposals accepted; proposal-existence refusal unmodeled). Confirmed as
written — characterization evidence, test-design oracle, NOT an
authoritative implementation. The stand-in-signature and simulated-chain
classifications stand.

## What the Rust core now exercises (4 new battery rows, 39 total, 0 failures)

- **ONE authorization, MANY legitimate steps** (`run_steps` +
  `E_STEP_ADMITTED` + `step_op_id`): propose/approve/execute run as
  ordered steps under one WB001 envelope; each step gets at most one
  admission, one dispatch, one effect (`effect_digest(step_id, env_sha)`
  — the ledger's own re-derivation formula, so a step row is checkable
  by the same code); one invocation advances one step; the nonce maps to
  the LOGICAL root, so steps continue their workflow while the same
  authorization under a DIFFERENT root is the alarm.
- **The killed step refuses replacement, recovers, and the workflow
  resumes**: crash after step 2's effect → a genuinely new supervisor
  reconstructs from the journal and REFUSES (`step:approve:unresolved`)
  with the journal record count UNCHANGED — memory loss created no new
  signed attempt; the step's admission record carries the EXACT signed
  bytes (envelope + signature, byte-asserted against the intent);
  `recover` resolves it through ledger evidence; re-invocation then runs
  step 3; three effects total; single-shot replay of the whole
  authorization still refused.
- **Orphan rows fail closed**: an effect row no admission accounts for
  is unaccounted history — recovery errors `ledger:orphan-row`, never
  silently downgrades.
- **False duplicates never promote UNKNOWN**: a lying row applied after
  the true one is ABSORBED (the ledger's idempotency refuses to write
  it; count stays one; recovery completes from the TRUE binding); a
  false row pre-seeded for a deterministic future id lets the run
  complete against it, and recovery then fails CLOSED on the binding —
  including a NEW check that binds every completed operation's row to
  its journaled effect (completed ops were previously unchecked; the
  hole is closed and convicted).

## Narrowed prose, adopted as law here

- A duplicate response is a reconciliation OBSERVATION — not proof of
  inclusion, execution, or irreversibility (three separate checks; the
  slice's evidence-class table keeps them separate).
- An RPC refusal on retry establishes nothing about an earlier attempt's
  disposition; replacement under uncertainty stays refused; UNKNOWN
  resolves only through trustworthy evidence — and the path from UNKNOWN
  to verified completion EXISTS and is exercised (the stuck-forever
  system would not count).
- The CI record stays mixed where mixed: local 39/0 is THIS box's run;
  PR #411's checks remain queued on the estate-wide runner stall — no
  green claimed, no flake-rate estimated.

## Routed onward

- **bDroP mid-handoff reconcile timeout → Agent 30**: issue #413 with
  the exact evidence (main's own runs 38322545384; the 20s→45s widening
  at `e59d41913` named as symptom-calming, per the order's no-widening
  constraint). Diagnose-the-mechanism is Agent 30's, not mine.
- #378 follow-through and aggregation cryptography stay separately
  owned; RB05 stays retired; no new signer or cryptographic
  implementation entered this lane.

Non-spending fixtures throughout; no live transactions; no new founder
supervision loop.
