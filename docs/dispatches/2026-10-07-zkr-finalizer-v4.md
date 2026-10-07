# 2026-10-07 — vaulta/zk finalizer v4: the three round-4 counterexamples closed (identity gate · status propagation · run-local state)

Lane: SPEC-ZK-RECEIPT-AGGREGATES-1, review order 2026-10-07 round 4.
Review of pinned commit `10ae1437a` accepted the timestamp repair and
the v2 accounting repair, and reproduced three further failure modes in
the v3 finalizer. This dispatch is the ordered shell-only follow-up:
**the exact repaired SHA, the receipts, and nothing live** — no chain,
no wallet, no deployment, no ceremony. All execution below ran offline
with synthetic fixtures and a stubbed `cleos`; call counts are stubbed
CLI invocations, never transactions.

Branch `zcode/zkr-final-v4-2026-10-07` (fresh worktree per the seat
law; wt-zcode was on btungsten WB002).

## What closed (the three counterexamples)

### 1. The identity gate — failure now prevents actions, proven by call count

v3 (`zkrself-final.sh:92–102` old numbering) recorded `identity FAIL`
and fell straight into the action legs, with wallet operations before
the test. Reproduced against the pinned v3 with a wrong-hash fixture:

```text
actions after failed identity = 8   (7 verify + 1 anchor)
verify calls                   = 7
```

— the reviewer's numbers exactly. v4: identity is read-only
(`get code`, its own exit status checked) and completes BEFORE any
wallet access or action push; failed, absent or unreadable identity
records `identity FAIL` and goes straight to the ledger — nonzero exit
with **zero action calls**. The regression asserts the call count, not
the eventual exit code:

```text
PASS: ZERO action calls after failed identity (call-count assertion)
PASS: zero verify calls
```

The absent/zero-hash case gets the same gate (absent is not a check).

### 2. Command exit status now enters the verdict

Two v3 shapes reproduced red, then flipped:

- **Refusals** — `push_raw()` captured `RC`; `expect_refuse()` never
  used it. A stub whose every action exits 0 while printing the
  expected refusal text scored the whole run green on v3 (reproduced:
  exit 0, `forged: PASS`, `exhaust: PASS`). v4: a refusal is nonzero
  command status PLUS the contract's own message; clean exit with
  error-like text fails the leg. No blanket `set -e` — the
  classifications and diagnostics are kept.
- **Reads** — the final-table pipeline took the parser's status (last
  command in the pipe), so a read command exiting 17 with a valid body
  passed green on v3 (reproduced: exit 0, `final: PASS`). v4: every
  state-bearing read (discovery table reads, both law/cap reads, get
  code, final table) is captured with its own status, and only a
  successful command's body reaches a parser. Discovery read-failures
  retry as READ-FAILED (bounded, 6 attempts), never as data.

### 3. Run-local state; coverage is mandatory, never shrunk

v3's fixed paths (`/tmp/zkr-disc.log`, `/tmp/zkr-final-spec.json`,
`/tmp/zkr-find.err`) were another run's startup-truncation away from a
check of nothing: with the discovery log emptied, the spec became `[]`
and the helper graded a bare row count green (reproduced: `final: PASS`
on `total rows: 27 == cap 27` with zero claims inspected). v4:

- a private per-run `mktemp` dir — no fixed `/tmp/zkr-*` path exists in
  the script (battery proves sentinels at all three legacy paths survive
  a green run byte-identical, and that no executable line references
  them);
- the assertion spec is built from the **parent-owned discovery record**
  (a shell variable — not a file any process can truncate), written
  once as a proper JSON array, read back, and coverage-checked against
  the parent's own count and seqs;
- an EMPTY discovery record fails the final leg ("grading on row count
  alone would be a check of nothing") instead of shrinking the work;
- `final_table_assert.mjs` validates the spec itself — unreadable,
  non-array, EMPTY, malformed entries and duplicate seqs all exit 8
  BEFORE the table is looked at (the empty-spec-on-perfect-table case
  is a battery case; v3 exited 0, reproduced).

Worktrees and temp dirs stay separate concerns, as ordered: worktrees
isolate the checkout; the run-local dir isolates runtime state. Neither
substitutes for the other.

## Receipts (this seat, WSL bash 5.3.9 / node 22.22)

| Suite | Against pinned v3 | Against v4 |
|---|---|---|
| `zkrself-final-v4-offline-test.sh` (NEW, self-contained) | **11 passed / 14 failed** — all three counterexamples live | **23 passed / 0 failed** |
| `zkrself-parse-test.sh` (timestamp/parser battery) | — | 15/15 |
| `zkrself-final.test.sh` (verdict battery) | — | 6/6 |
| `zkrself-final-offline-test.sh` (accounting battery) | — | 3/3 |

Red-first order held: the new battery was written and run against the
unmodified pinned v3 BEFORE the repair (its 14 reds are the three
defects in the reviewer's own shapes), then the same battery, unedited,
against v4.

The new battery synthesizes its own lab stand-in (roots, calldata,
`~/plonkport` via `HOME` override) so it runs wherever bash + node run.
En route it found a real v3 bug: `W=~/plonkport` was hardcoded, so the
committed offline tests' `W=` override was silently ignored — they only
passed where a real lab happened to live. `W` is env-honored in v4.

`bash -n` clean on the finalizer and the battery.

## Boundaries (not crossed)

- No live execution of any kind — the reviewer's "no further live
  execution is needed to demonstrate those repairs" was followed.
- The selector/asymmetric regression and bounded-anchor closeouts are
  untouched; the completed setup-artifact receipt keeps its scope; the
  pinned release wasm hash is unchanged.
- The leak distinguisher and the 1k/10k scale work remain OPEN; the
  Autonomi coupling ban stands.
- `zkrself-run.sh`'s historical final-table call inherits the stricter
  helper (empty spec → exit 8, fail-closed); no committed test depends
  on the old lenient behavior — its live legs are already receipted.

## Artifacts

- `contracts/zkreceipts/zkrself-final.sh` — v4 (this repair)
- `contracts/zkreceipts/final_table_assert.mjs` — spec validation, exit 8
- `contracts/zkreceipts/zkrself-final-v4-offline-test.sh` — the
  counterexample battery (red-first receipt, now the standing regression)
- `contracts/zkreceipts/README.md` — the v4 laws documented

The repaired SHA and the committed blob hashes are recorded in the
commit message and verified post-push against the tested bytes.

## BANKING NOTE — CORRECTED (review handoff, 2026-10-07)

The earlier note that "10ae1437a closes the finalizer lane" over-closed:
that SHA closed the EARLIER repairs only; the review OF that same
commit left three finalizer findings open, and this dispatch's commit
(b4960dbfb, pushed 10ae1437a..b4960dbfb) is their repair. The accurate
ledger, in the reviewer's words:

> **Closed findings remain closed:** selector/asymmetric regressions,
> bounded-anchor exhaustion, stdin parsing, read-endpoint wiring,
> strict timestamp validation, original parent-owned accounting and
> required-leg tracking, and the completed setup-artifact verification
> receipt.
>
> **Finalizer repair @b4960dbfb (verified independently before push):**
> identity-before-actions (a failed/absent/unreadable identity ends the
> run with ZERO action calls — the regression asserts the call count,
> not the eventual exit), command-status propagation (a refusal must be
> a nonzero status; a failed read command's body cannot establish
> state), and run-local complete assertion coverage (private mktemp
> run dir; an empty or truncated discovery record refuses instead of
> degrading to row-count checking).
>
> **Two tungsten measurements remain open:** leak distinguisher and
> 1k/10k scale. The Autonomi coupling boundary remains closed.

The unexecuted leak distinguisher is recorded as **NOT RUN; test model
and acceptance criteria specified** — "sound by construction against
the pinned test set" is wording discipline on any future result, never
a substitute for one.

Shared-checkout interference and shared runtime-file interference
remain distinct: BT-WORKTREE-ISOLATION owns the general class; the
finalizer's fixed temporary paths and incomplete-assertion acceptance
were its own implementation defect, repaired here (cx3a/cx3b).

*Slēgtās lietas paliek slēgtas* — and that rule preserves scoped
closeouts; it cannot turn subsequently identified, unrepaired findings
into completed work. No new circuit work, funding, or ceremony rerun
followed from this correction.

Independent verification receipt (this seat, pre-push): v4's committed
tree extracted clean; zkrself-final-v4-offline-test.sh → 23 passed,
0 failed, exit 0; the v3 regression suite (zkrself-final.test.sh)
against the same tree → all scenarios green. No chain, wallet, or
deployment was touched by the repair or its verification.
