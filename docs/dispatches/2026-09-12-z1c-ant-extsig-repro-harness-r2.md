# z1.c — r2 corrections for the reproducible harness (Astra review 5648317459)

**Seat:** z1.c (Medium, same session) · **Review:**
[#10 comment 5648317459](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5648317459)
at `48faad8e` · **Deliverable:** descendant on PR #60 (branch
`zcode/ant-extsig-repro-2026-09-12`). Focused control-flow regressions only —
no rebuild, no production contact, no harness execution. The distinction the
review closed with is preserved unchanged: harness dependency
reproducibility is not the untested production upgrade hold, and the box
root-capacity observations remain dated evidence, not authority to compile
or resize there.

## 1 · Physical path guard (review r2-1)

- `validate_scratch_path` now canonicalizes BOTH the mktemp base and the
  target **physically** (`pwd -P`) and compares against the
  physically-resolved base; the logical `cd && pwd` resolution that let a
  base-external symlink pass as base-internal is gone.
- Cleanup is further restricted to **owned direct scratch children**: the
  path (logical AND physical) must be exactly
  `<base>/ant-extsig-repro.<mktemp-suffix>` — any deeper path segment after
  the mktemp name (e.g. `…/ant-extsig-repro.a/b`) is rejected.
- The selftest's own WORK cleanup now applies the same physical discipline.
- **Regression:** T5b builds the review's escape shape — `allowed/ant-extsig-repro.link
  → outside/` — and asserts the guard REJECTS it, with traversal and
  valid-directory controls retained in T5a (plus a new nested-subpath
  control). On this Windows host a true symlink cannot be created (`ln -s`
  copies by default; `MSYS=winsymlinks:nativestrict` → "Operation not
  permitted"; a `mklink /J` junction probe was also unavailable in the
  sandbox), so T5b reports a **named SKIP** here — the exact carve-out the
  review allowed — and exercises fully on Linux/CI where `ln -s` is real.
  Per the review's wording, the probe demonstrated **false acceptance**
  pre-fix; no deletion ever occurred and none is claimed.

## 2 · Failure/interruption finalization (review r2-2)

- A single finalizer is installed **the moment scratch ownership is
  acquired** (right after `mktemp` passes its own validation), on
  EXIT/HUP/INT/TERM. It: captures the original status as its FIRST command
  (an earlier assignment silently clobbered it — caught by T7/T8 and
  fixed), forces the conventional nonzero on signal traps (129/130/143),
  validates every scratch path physically before `rm -rf`, honors
  `REPRO_KEEP` with an explicit kept-path receipt, and asserts the
  **canonical baseline taken BEFORE staging** on every exit — success,
  failure, or interruption.
- The success-path inline cleanup is gone; there is exactly one cleanup
  path. A staging failure mid-copy can no longer strand a scratch tree
  silently, and every `die` after ownership is finalized.
- **Regressions:** T7 (injected staging failure via `REPRO_INJECT`,
  test-only and documented) — nonzero exit, scratch cleaned, neighbors
  intact; T8 (stub `cargo` failing at the metadata phase) — same contract;
  T8b (TERM delivered mid-cargo against a slow stub) — exit 143, scratch
  released (or explicitly named), neighbors intact; T9 — an unrelated
  neighbor directory planted beside the scratch base survives every path.
  Success path re-verified end to end (metadata-only, warm cache): ALL
  PHASES OK, finalizer released scratch, zero leftovers.

## 3 · T2b false-positive fix (review r2-3)

- T2b now REQUIRES the expected lock-refusal family in cargo's output —
  `(cannot (create|update) the lock file|needs to be updated).*--locked was
  passed` — in addition to nonzero exit and byte-unchanged lock. Any
  unrelated tool/network failure fails the case instead of passing it.
- **Control:** T2c runs an offline stub `cargo` whose failure is unrelated
  ("network unreachable") and asserts the matcher does NOT fire — proving
  the test-of-the-test. The stub case is fully offline; the real-cargo
  negative cases ride the ordinary warm cache.
- Development receipt for the strictness: the first strict run of T2b
  FAILED because cargo 1.98 spells the drifted-lock refusal "cannot update
  the lock file … because --locked was passed" — exactly the
  false-positive-with-real-failure shape the review warned about; the
  matcher now covers that spelling because it was observed, not guessed.

## Focused regression results (this host: z1.c laptop, Git Bash, cargo 1.98.1)

```
sh scripts/ant-extsig-repro/selftest.sh
T1a PASS — runner refused the missing committed lock
T1b PASS — cargo --locked refused to create a lock: cannot create the lock file …
T2a PASS — runner's banked-sha assertion refused the tampered committed lock
T2b PASS — cargo --locked refused with the expected lock-update text and left the lock byte-unchanged
T2c PASS — an UNRELATED cargo failure does NOT satisfy the refusal matcher
T3a PASS — orphan-workspace error reproduced verbatim (runbook §6)
T3b PASS — overlay [workspace] table detaches the nested copy — cargo accepts
T4  PASS — runner refused the drifted source tree (manifest check)
T5a PASS — path guard verdicts correct (1 valid direct child accepted; /, empty, foreign prefix, ..-traversal, not-a-dir, nested-subpath all rejected)
T5b SKIP — no true symlink on this platform (Git Bash copies by default); exercised on Linux/CI
T7  PASS — staging failure: nonzero exit, scratch cleaned by the finalizer, unrelated neighbors intact
T8  PASS — cargo failure: nonzero exit, scratch cleaned by the finalizer, unrelated neighbors intact
T8b PASS — TERM mid-cargo: exit 143, scratch released (or explicitly named) by the finalizer, neighbors intact
T9  PASS — unrelated neighbor survived all cleanup paths
T6  PASS — canonical ops/ant-extsig still matches the manifest byte-for-byte
selftest: 14 passed, 0 failed, 1 skipped
```

Plus one success-path run (metadata-only): ALL PHASES OK, second locked
resolution byte-stable, ops tree at its pre-staging baseline, zero scratch
left behind. The r1 locked compile evidence (check 7m32s / build 4m38s) is
unchanged by these control-flow fixes and was not repeated, per the review.

## Files touched (this r2)

`scripts/ant-extsig-repro/run.sh` (physical guard, finalizer, injections),
`scripts/ant-extsig-repro/selftest.sh` (T2b strict, T2c, T5a controls, T5b,
T7/T8/T8b/T9, physical WORK cleanup), `scripts/ant-extsig-repro/README.md`
(law text). The committed lock, overlay, and source manifest are untouched;
`ops/` and the root workspace remain untouched.
