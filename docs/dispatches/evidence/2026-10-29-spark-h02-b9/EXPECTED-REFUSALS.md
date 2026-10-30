# EXPECTED-RESULT MATRIX — B9 rehearsal negative cases

Harness: PR #492 `a4e01714`, binary SHA-256
`2D83F1843A425B397E99AE6ADE40A0DFD743158CD54FD2C009FB1F04F3801395` <!-- PUBLIC-CONSTANT -->. <!-- PUBLIC-CONSTANT -->
Fixture: `manifest.json` SHA-256 `acc9cb10…569c`, 40 items,
`order_id: demo-task`. Backend: scripted loopback (`loopback_backend.py`,
same protocol as `tests/b9_binary.rs`); no provider credits used.
Golden fixture never modified — tampers apply to disposable copies
(`rehearsal-kit/` + per-case workdirs under `runs/`).

Verdict labels: EXPECTED REFUSAL (candidate refuses as required),
UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED (candidate accepts and must
not), control. Actual per-case outputs live in `runs/` (`R*-tamper/`,
`R5-reuse/`, `R6-session-swap/`, baselines): stdout, stderr, exit
code, tampered artifacts; narrative in `runs/RUN-LOG.md`.

| # | Case (lead definition) | Tamper (disposable copy only) | Expected | Actual |
|---|---|---|---|---|
| R1 | Failed run keeps its valid receipt; only `evidence/run-outcome.json` replaced with another run's successful outcome. Receipt actor untouched (changing the actor tests a different condition). | `sess-mt` (`Ok(MaxTurns)` + own valid receipt): receipt.json intact; run-outcome.json := baseline success file | REFUSAL: outcome must be bound to the executed run, not a pasted file | UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED — exit 0 `B9 ACCEPTANCE PASS (verify-only)` (`runs/R1-tamper/`) |
| R2a | Unsuccessful outcome whose text contains `EndTurn`. | `sess-mt` copy: `run` := `Ok(Cancelled before EndTurn)`; receipt intact | REFUSAL: an unsuccessful run must never satisfy the outcome gate | UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED — exit 0 PASS (`runs/R2a-tamper/`) |
| R2b | Falsified completion without valid terminal authentication. | `sess-mt` copy: run-outcome.json := hand-written minimal `{"run":"Ok(EndTurn)"}` (no did/order/session binding) | REFUSAL: terminal record must carry authenticated binding, not a bare string | UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED — exit 0 PASS (`runs/R2b-tamper/`) |
| R3 | ≥3 checkpoints, first and last valid; corrupt only the middle signature, preserving valid base64url encoding and prefix hashes. | `sess-f2` copy (pre-switch, pre-switch, backend-exhausted, all signed): one middle `signature_b64u` char flipped within the base64url alphabet; `transcript_sha256`/`turn_count` intact | REFUSAL: every signed envelope must verify, not only first/last | Checkpoint-stage silence recorded as defect — no checkpoint error raised (flow reached the later outcome gate). NOT an end-to-end PASS: the whole run failed later on its genuine `Err` substrate outcome (overall exit 3) (`runs/R3-tamper/`). Note: a passing-run triple is unconstructible — the third phase exists only on exhaustion, and a passing double-failover cannot beat the ~10 s prober window. |
| R4a | Remove an exported checkpoint entry, retaining the persisted checkpoint log. | `sess-f2` copy: middle array element deleted from `evidence/checkpoints.json` | record actual | Checkpoint omission not detected; retained pair verifies; inventory completeness remains unproved (`runs/R4a-tamper/`). No end-to-end PASS claimed (substrate outcome genuine `Err`, overall exit 3). |
| R4b | Strip an envelope. | `sess-f2` copy: `bsigner_envelope` removed from every entry | REFUSAL: gutted checkpoint evidence must fail closed, never skip silently | Checkpoint-stage silence recorded as defect (empty set skips all verification). NOT an end-to-end PASS: the whole run failed later on its genuine `Err` substrate outcome (overall exit 3) (`runs/R4b-tamper/`) |
| R4c | Replace the array with a non-array. | `sess-f2` copy: `evidence/checkpoints.json` := `{}` | REFUSAL: non-array checkpoint evidence must fail closed | Checkpoint-stage silence recorded as defect (non-array skips all verification). NOT an end-to-end PASS: the whole run failed later on its genuine `Err` substrate outcome (overall exit 3) (`runs/R4c-tamper/`) |
| R4d | Whole-file deletion (additional control). | `sess-f2` copy: `evidence/checkpoints.json` deleted | REFUSAL (missing evidence fails closed) | EXPECTED REFUSAL — exit 3 `read .../checkpoints.json ... (os error 2)` (`runs/R4d-tamper/`) |
| R5 | Reuse a completed session: must refuse before mutation. Compare first-run artifact hashes, re-run same workdir/session, compare again, verify afterward. | none (behavioral): execute twice into identical `--workdir`/`--session` | REFUSAL BEFORE MUTATION; post hashes identical; re-verify passes | UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED with double damage — reuse NOT refused (exit 0 PASS, identity ROTATED `did:b:t6io...` → `did:b:wk2t...`, all artifacts rewritten) AND post-reuse `--verify-only` FAILS exit 3 (`exported canonical transcript is not byte-exact the session transcript`: sessions log holds both runs, export only the second) (`runs/R5-reuse/`) |
| R6 | Two sessions, same order, so order mismatch cannot mask missing session binding. Session B's evidence presented as requested session A. | `runs/sess-A` content := session B artifacts (same order `demo-task`); `sessions/sess-B.*` retained | REFUSAL: evidence must be bound to the requested session | UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED — exit 0 `B9 ACCEPTANCE PASS (verify-only)` for B's `did:b:4fjm...` under requested session A (`runs/R6-session-swap/`) |
| R7 | Wrong requested order (retained). | none: `--verify-only --order-id WRONG-ORDER` on passing run | REFUSAL (definition order ≠ requested) | EXPECTED REFUSAL — exit 3 `run definition is for order demo-task, not the requested WRONG-ORDER` (`runs/R7-tamper/`) |
| R8 | Failed run with valid receipt (outcome-gating). | none: `sess-mt` (`Ok(MaxTurns)` + own valid receipt) verified as-is | REFUSAL: acceptance gates on run outcome, never receipt presence | EXPECTED REFUSAL — exit 3 `recorded run outcome is not EndTurn` (`runs/R8-tamper/`) |

Rule for all rows: a missing, unreadable or mismatched artifact is an
error, never a pass. Wonder owns harness implementation and
regression-test changes; if a case is accepted by the current
candidate, it is recorded UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED
with the actual output, and after Wonder's correction the affected
cases are rerun with both receipts preserved.
