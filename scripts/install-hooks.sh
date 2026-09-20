#!/bin/sh
# SS-2 (2026-09-20, order ed5fd3dc): wire the pre-commit hook that
# AGENTS.md documents. The estate's hook law had been enforced ONLY by CI
# tree mode on clones that never installed the hook - this box was one,
# and nothing detected the absence (bFUzZ PROVE of SS-1, 2026-09-20).
#
# Idempotent and worktree-aware: `git rev-parse --git-path hooks` resolves
# through the common dir, so ONE install covers the main checkout and every
# worktree of the same repository.
#
# The hook is a thin delegator - all scanning logic lives in
# scripts/secret-scan.sh (single source of truth, diff mode), so the hook
# can never drift from what CI re-scans with on push.
#
# Contract: e2e/hooks-installed.test.sh proves the wiring in a fresh
# repository (vector refused, PUBLIC-CONSTANT marker passes, clean passes)
# and fails by construction where this installer does not exist.
set -eu

cd "$(dirname "$0")/.."

if [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]; then
  echo "install-hooks: REFUSING - git cannot resolve this checkout." >&2
  echo "  Not a usable repository. Wiring nothing." >&2
  exit 2
fi

hooks_dir=$(git rev-parse --git-path hooks)
mkdir -p -- "$hooks_dir"
hook="$hooks_dir/pre-commit"

if [ -f "$hook" ] && ! grep -q 'installed by scripts/install-hooks.sh' "$hook"; then
  echo "install-hooks: REFUSING - $hook exists and was not written by this" >&2
  echo "  installer. Inspect it, remove it, then re-run." >&2
  exit 2
fi

cat >"$hook" <<'HOOK'
#!/bin/sh
# pre-commit - installed by scripts/install-hooks.sh (SS-2, 2026-09-20).
# The law: AGENTS.md - hex runs >=48 chars blocked unless a same-line
# PUBLIC-CONSTANT or TESTNET-ONLY marker rides the line. All logic lives
# in scripts/secret-scan.sh; this wrapper only delegates (diff mode,
# staged set). Fail-closed by inheritance - but a refusal carries its
# remedy, never a bare block (order 2b1d848a: a guard that blocks the
# documented workflow with no remedy line gets bypassed with --no-verify
# by the second person who hits it).
sh "$(git rev-parse --show-toplevel)/scripts/secret-scan.sh" diff
rc=$?
if [ "$rc" -eq 2 ]; then
  echo "pre-commit: the scanner REFUSED this environment - nothing was scanned." >&2
  echo "  This checkout does not resolve for the scan from this shell." >&2
  echo "  Remedy: commit from Git-for-Windows in this worktree (measured" >&2
  echo "  2026-09-20: hooks fire there; WSL cannot resolve gitfile worktrees" >&2
  echo "  at all - git itself fatals there before any hook runs)." >&2
  echo "  --no-verify is not a bypass: CI re-scans the whole tree on push." >&2
fi
exit "$rc"
HOOK
chmod +x "$hook" 2>/dev/null || true

echo "install-hooks: wired $hook"
echo "  proof: stage a 48+ hex line without a marker and commit - it must refuse."
