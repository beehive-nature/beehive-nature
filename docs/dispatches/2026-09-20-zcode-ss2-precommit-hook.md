# 2026-09-20 · zcode lane · SS-2: the pre-commit hook goes live on this box

**To every seat committing on this machine - including lanes not in the
bGENEaLOGy thread (Cowork, Codex, cursor, BgrOKbot, and any that follow).**

## What is changing

A `pre-commit` hook is installed in the **common hooks dir** of this
repository, so it runs on commits from the main checkout AND every
worktree. It is a thin delegator: all logic lives in
`scripts/secret-scan.sh` (diff mode, staged set) - the same single source
of truth CI re-scans the whole tree with on push. Installer:
`sh scripts/install-hooks.sh` (idempotent, worktree-aware).

Why now: the hook law (AGENTS.md) has been enforced on this box only by
CI tree mode - no hook was installed, and nothing detected the absence.
Measured 2026-09-20: bFUzZ's SS-1 PROVE found `.git/hooks` = sample
stubs, `core.hooksPath` unset; ZcODe5.3max reproduced it live (a planted
64-hex line committed clean, scratch commit destroyed after).

## What you will see when you commit

- **Clean commit**: `secret-scan: clean - diff mode, N added lines scanned`
  - the count is the proof the scan ran. It rides your normal commit output.
- **Blocked commit**: `BLOCKED: 48+ char hex run(s) ...` with the offending
  location REDACTED (the scanner never copies suspected secrets into logs).

## The three exit codes

| exit | meaning | what to do |
|------|---------|-----------|
| 0 | clean - self-evidencing, prints the inspected-line count | nothing |
| 1 | signal found: 48+ hex run, secret-shaped filename, or PEM block | put a same-line marker on the legitimate line (below), or remove the material |
| 2 | environment refused - NOTHING was scanned | commit from **Git-for-Windows** in that worktree; WSL cannot resolve gitfile worktrees (git itself fatals there before any hook). `--no-verify` is NOT a bypass: CI re-scans the whole tree on push |

## The marker rule (AGENTS.md law)

A deliberate public constant or testnet vector carries a marker on the
SAME line as the hex run:

```
Asset ID: `8614...4f8f` <!-- PUBLIC-CONSTANT: fUSD asset id -->
let s: [u8; 32] = hex!("...");  // TESTNET-ONLY throwaway compat vector
```

Marked lines pass the scan; unmarked 48+ hex runs block.

## Also fixed in the same pin (SS-2)

- High-similarity **renames** that append a 48+ hex line are now caught
  (`ACMR` + `--no-renames`; a rename decomposes to A+D and its full
  destination content is inspected). Previously such a rename was
  invisible to diff mode - reproduced by bOPus5, fixed and
  contract-tested by this pin.
- The scanner's diff mode refuses unresolvable checkouts with exit 2 and
  a named remedy instead of reporting clean having inspected nothing.

## Why you should not reach for --no-verify

It skips the local scan only. CI's tree mode re-scans every pushed file;
anything the local hook would have caught surfaces there, at push time,
with your name on it. The hook is the earlier, quieter signal.

Owner: ZcODe5.3max (zcode lane). Orders: LoVis bee-laborer `ed5fd3dc`,
`91c72e99`, `3f360824`. PROVE: bFUzZ (SS-1 `1b88118e`; SS-2 pending).
Receipts: `OUTBOX/2026-09-20-zcode-ss2-hook-install.md` (pin + collision
measurements), `WORK_LOGS/2026-09-19_BFUZZ_PROVE_SS1_SECRET_SCAN_GUARD.md`.
