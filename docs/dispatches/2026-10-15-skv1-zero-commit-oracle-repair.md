# 2026-10-15 · SKV-1 zero-commit oracle repair (corrective PR into #422)

Routing order: #422 comment of 2026-10-15 ("SKV-1 zero-commit oracle repair:
upstream owner routing"). Claimed by the #435 reporting seat under the order's
fallback (no repair claimed, SKV seat idle), from the independent worktree
`wt-skv1-repair`, branch `zcode/skv1-oracle-repair-2026-10-15`, parent
`86e39e37a` (#422's head). Claim: #422 comment 6192170666.

## The defect

`crates/adapter-store/tests/skv1_crash_recovery.rs` computed the committed
prefix as `max(present ∪ acked).unwrap_or(0)` and replayed `0..=prefix`. An
empty history therefore manufactured operation 0. A kill that landed before
the child's first commit then read as a lost commit: `acked=0 present=0
expected=1`, in #435's CI (`tests` run 38728617952, job `test`). The engines
were not at fault; the oracle invented the write.

## The repair (two files)

- **Oracle.** `committed_prefix` returns `Option<u64>`: `None` means no
  operation, and `Some(0)` means operation 0. `expected_state(None)` is
  empty, and the inclusive replay is unchanged for non-empty histories. The
  maximum still draws on BOTH recovered keys and acknowledgements, so a
  committed-but-unacknowledged tail (tombstones included) stays legal.
  `acked == 0` alone never means "expect empty". The oracle is one pure
  `judge` that the crash runs and the regressions share.
- **Kill modes.** The timed runs (150/400/800 ms) are unchanged. A
  deterministic pre-first-commit kill now uses a handshake on the child's
  `ready` marker (new optional child mode `hold-before-first-commit`). A
  never-vacuous post-commit kill waits for 96 acknowledged commits (past
  op 64, so tombstones are in play). An empty result prints
  `committed_prefix=none recovery=empty-startup (… NOT evidence that
  committed data survived)`.
- **Kill integrity.** A child that exits on its own before the kill fails
  the test (it is not crash evidence), and a killed child reporting success
  fails too. The old `killed = kill().is_ok()` passed for an already-dead
  child.

No sleep-as-fix, no skip, no retry, no weakened comparison, no engine or
durability change.

## Regressions and the negative control

Five oracle regressions: empty history → empty; op 0 recovered without an
ack → accepted; op 0 acked but missing → FAIL; unacked committed tail with
a tombstone → exact replay; missing interior key / corrupted value → FAIL.

Negative control: the old behavior re-inserted (`.max()` →
`.max().or(Some(0))`). `oracle_empty_history_expects_an_empty_store` FAILS,
and both engines' deterministic pre-first-commit legs FAIL with CI's exact
signature (`acked=0 … committed_prefix=0 … present=0 expected=1`). Receipt:
`docs/receipts/skv1-zero-commit/skv1-negative-control.txt` (exit 101).

## Receipts (WSL2, Linux 6.18 x86_64, 8 CPU, shared box)

- `skv1-repaired.txt`: `cargo test -p adapter-store --locked`, every suite
  `ok`, exit 0.
- `skv1-repaired-receipts.txt`: the same SKV-1 suite with `--nocapture`, all
  ten crash legs `verdict=PASS`. Both engines are `empty-startup` on the
  pre-first-commit leg and `post-commit` on the rest (e.g. sqlite
  `AfterAcks(96)`: acked=131, prefix=130, present=122; surrealkv:
  acked=97, prefix=96, present=92).
- `fmt.txt`: `cargo fmt --all -- --check` exit 0.

CI on the corrective PR's exact head is the verdict that counts.

## Boundaries unchanged

Process death is not power loss. SurrealKV stays the candidate, not
promoted. SKV-5 and aarch64 remain NOT RUN.
