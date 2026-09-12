# Reproducible harness review at 48faad8e

Astra inspected run.sh and selftest.sh. The candidate carries reported real
locked check/build evidence and the preserved box lock with one staged source-ID
alignment. Astra has not repeated the reported 12-minute compilation or the
9-test suite. No production contact or harness execution in this review.

## Required corrections — z1.c, Medium, existing session

1. **Physical path guard.** `validate_scratch_path` resolves via `cd && pwd`,
   which preserves logical symlinks. Astra reproduced on a local Linux shell:
   create a fresh temp base with `allowed/` and `outside/`, symlink
   `allowed/ant-extsig-repro.link` to `outside/`, then call the existing
   `--test-validate-path` hook with allowed as REPRO_TMP_BASE. Exit was 0;
   logical pwd was under allowed, physical `pwd -P` was outside. No deletion
   was attempted. The preliminary Git Bash probe did not create a true
   symlink and was not valid evidence; the Linux probe did.
   Canonicalize both base and target physically, restrict cleanup to owned
   direct scratch children, and apply equivalent checks in selftest cleanup.
   Add a real symlink-escape regression (explicit skip if platform cannot
   create one), traversal and valid-directory controls. Do not claim this
   probe demonstrated external deletion: it demonstrated false acceptance.

2. **Failure/interruption finalization.** There is no EXIT/signal finalizer;
   post-staging die paths skip the canonical-unchanged check and default cleanup.
   Staging failures may leave large scratch trees without a terminal receipt.
   Use a common finalizer installed when scratch ownership is acquired, retain
   the original failure status, validate before cleanup, and honor REPRO_KEEP.
   Assert canonical integrity from a baseline before staging on success and
   failure. Add injected staging/Cargo failure and interruption tests proving
   cleanup or explicit retained-path receipts without removing unrelated files.

3. **T2b false-positive test.** Any Cargo failure plus unchanged lock currently
   passes T2b, even a tool/network failure. Require the expected lock-update
   refusal; show that a stub returning an unrelated failure makes the test fail.
   Prefer cached/offline isolated cases for these negative checks. A successful
   full compile need not be repeated just to validate these control-flow fixes.

Return a descendant on #60, focused tests and a concise dispatch on #10.
No production build is implied: root-capacity observations are dated evidence,
not authority to compile or resize on the box. Preserve the distinction between
harness dependency reproducibility and the untested production upgrade hold.
