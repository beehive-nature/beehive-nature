# EXPECTED-REFUSAL MATRIX — B9 rehearsal negative cases

Status: UNEXECUTED. No run has been performed; no outputs recorded.
Each row states the tamper, the expected refusal, and the location for
the actual output once executed. Wonder owns harness implementation
and its regression tests — this matrix only pins what this lane will
accept as a refusal. The golden `manifest.json` is never modified by
these cases; tampering happens on disposable copies (see
`rehearsal-kit/`).

| # | Case | Tamper (on disposable copy) | Expected refusal | Actual output |
|---|---|---|---|---|
| R1 | Foreign terminal-run outcome | present a `runs/<session>/` whose receipt/signature came from a different actor's key | `--verify-only` FAIL: signature/identity mismatch against exported public material | UNEXECUTED |
| R2 | Forged terminal-run outcome | flip bits in `receipt.json` signature (or rewrite `item_count`) | `--verify-only` FAIL: count/signature mismatch on recompute | UNEXECUTED |
| R3 | Corrupted middle checkpoint signature | alter one checkpoint envelope signature in `runs/<session>/` | saved-run verification FAIL: checkpoint chain broken | UNEXECUTED |
| R4 | Removed checkpoint evidence | delete a checkpoint file from `runs/<session>/` | saved-run verification FAIL: missing evidence, fail closed (never pass) | UNEXECUTED |
| R5 | Reused session | execute twice into the same `--workdir/--session` | refusal (same-session reuse) until the correction lands; second run must not silently overwrite | UNEXECUTED |
| R6 | Copied evidence under wrong session | copy a passing `runs/<good>/` tree to `runs/<other>/` and verify with `--session <other>` | FAIL: evidence bound to its session/order, not portable | UNEXECUTED |
| R7 | Wrong requested order | verify a `demo-task` run with `--order-id <other>` | FAIL: receipt is for the requested order only | UNEXECUTED |

Rule for all rows: a missing, unreadable or mismatched artifact is an
error, never a pass. Record stdout/stderr verbatim in the executed
run's `runs/<session>/` evidence; link it here when it exists.
