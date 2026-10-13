# 2026-10-13 — BNROSE-RUST-001: PR #411's two reds healed (the demo under CI's sh, the stack-inventory rider)

Pickup order: the failing recovery demonstration on PR #411, already
traced to invalid root initialization and an unset shell parameter.
This beat confirms the diagnosis with receipts, cures both defects,
and heals the second red the same push carried (the `static` job).

## The diagnosis, confirmed

CI runs the demo as `sh scripts/bnrose-rust-001/recovery-demo.sh` —
dash on ubuntu-22.04. Two defects, both mine, both invisible under
the Git Bash the lane was delivered from:

1. **Invalid root initialization.** `ROOT_HEX=$(printf 'fe%.0s'
   {1..32})` is a bash brace expansion. Live dash receipt (WSL):
   the same command renders `fe` — 2 hex chars. `cli.rs cmd_init`
   requires exactly 64 (`--root-hex is 64 hex characters (32
   bytes)`), init refused, no supervisor state ever existed, and
   phase 1 exited 1 instead of 3.
2. **The unset shell parameter.** `trap 'rm -rf "$S" "$S2" "$S3"'
   EXIT` references S2/S3 before their phase-4/5 assignments. Any
   early exit under `set -u` aborts the trap itself ("S2: parameter
   not set") and dash replaces the exit status with 2 — the exact CI
   signature (job exit 2).

## The cure (commit e66710e07, branch zcode/bnrose-rust-001)

- The 64-hex demo root is now built in a POSIX `while` loop — no
  shell-specific construct remains in the lane's scripts (scanned:
  this was the only bashism; `teeth.sh` was already clean).
- `S2`/`S3` are pre-bound before the trap and reach `rm` only when
  non-empty (`${S2:+"$S2"}`), so the trap is safe at every point it
  can fire.
- **Stack-inventory rider:** the same push's `static` failure
  ("Stack inventory needs regeneration") was the PR's three
  `bnrose-exec-*` crates making the 71→74 member list stale inside
  the generated section of `surfaces/stack.html`. Regenerated with
  `node scripts/build-stack-inventory.mjs` (3 generated lines).
  Ownership verified, not inherited: origin/main is 71 members /
  stack.html 71, in sync.

Rust code untouched — the battery, teeth and CLI are as delivered.

## Receipts

- **Red-first (the harness catches the bug):** WSL dash + a
  CLI-contract stub host (`scripts/tmp/bnrose-dash-harness/`,
  untracked scratch). The OLD script reproduces CI exactly — init
  refused, phase 1 exit 1, `S2: parameter not set` on stderr, rc=2.
  The FIXED script: all five phases, rc=0.
- **Local, real binaries (Git Bash, release host + wasm):** rc=0 —
  exit 3 on the lost response; recover exit 0 with the receipt
  verifying under the public key alone; nonce-reuse refused; UNKNOWN
  preserved twice; one flipped journal byte convicted by HMAC tag
  mismatch. Receipt: `scripts/tmp/bnrose-demo-local.txt`.
- **CI, the lane job (run 38455879690, ubuntu dash): SUCCESS.**
  The demo passes on CI's own shell — `recovery-demo: PASS` — and
  the bench step, previously unreachable behind the demo, ran. Same
  supervisor fingerprint (447a5d32aa5ccb70) and the same
  deterministic op id as the local run.
- **Static:** `build-stack-inventory.mjs --check` passes on this
  tree (74/74). Because `static` runs on the PR's merge commit and
  main had since moved `surfaces/stack.html` (the #417 heal, one
  unrelated generated line), origin/main was merged into the branch
  (b4c9be986) and `--check` re-run on the merged tree: PASS — the
  two heals coexist; the push re-runs lane + tests on that merge.

## Boundaries not crossed

- The `eternal` job's one-run failure on the earlier checks is the
  known estate-wide bDroP flake (it passed in the sibling run);
  nothing widened here, per the lane's no-widening law.
- The held `-002` branch still carries the pre-fix script at its
  tip; it inherits this cure at its planned rebase onto #411's
  merge SHA. Verified: `origin/zcode/bnrose-rust-002` shows the old
  trap and brace line.
- Exactly-once remains NOT claimed from the local journal; the
  formal twin remains the next natural beat.
