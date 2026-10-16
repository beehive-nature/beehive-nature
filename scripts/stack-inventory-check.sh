#!/bin/sh
# stack-inventory-check.sh — the generated workspace inventory in
# surfaces/stack.html must match the workspace member list in the root
# Cargo.toml. CI's static job runs `node scripts/build-stack-inventory.mjs
# --check` on push (the "Engine Room — every surface included" step); on
# 2026-10-16 four heads went red on exactly that because new crates were added
# without regenerating the page. This is the commit-time half of the same
# check, ONE implementation (the generator's own --check), two enforcers.
#
# Mode `diff` (pre-commit): when neither the root Cargo.toml nor
# surfaces/stack.html is staged, say so and pass; when either is, extract the
# STAGED blobs (the commit is what is checked, never the working tree) and run
# the generator's --check against them through its env overrides. On a stale
# page the commit is refused with the remedy named. The page is never
# regenerated or staged on the committer's behalf: detection before
# publication, --no-verify-able, never prevention. CI re-runs the same
# --check on push.
set -u

mode="${1:-diff}"
case "$mode" in
  diff) ;;
  *) echo "usage: stack-inventory-check.sh diff" >&2; exit 2 ;;
esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "stack-inventory: REFUSED - not inside a git checkout; nothing was checked" >&2
  exit 2
}
cd "$root" || exit 2

# every status, deletions included: a staged deletion of either file is a
# commit CI would refuse and must not slip past as "not staged"
staged=$(git diff --cached --name-only -- Cargo.toml surfaces/stack.html)
if [ -z "$staged" ]; then
  echo "stack-inventory: not staged (Cargo.toml and surfaces/stack.html untouched) - skipped"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "stack-inventory: REFUSED - node is not on PATH, so the staged inventory cannot be checked" >&2
  echo "  remedy: commit from a shell that has node, or run the check yourself:" >&2
  echo "          node scripts/build-stack-inventory.mjs --check" >&2
  echo "  --no-verify is not a bypass: CI runs the same --check on push." >&2
  exit 2
fi
if [ ! -f scripts/build-stack-inventory.mjs ]; then
  echo "stack-inventory: REFUSED - scripts/build-stack-inventory.mjs is missing in this checkout" >&2
  exit 2
fi

tmp=$(mktemp -d 2>/dev/null || mktemp -d -t stackinv)
trap 'rm -rf -- "$tmp"' EXIT

# the index, not the working tree: a page regenerated but left unstaged is
# exactly the commit CI would refuse
for need in Cargo.toml surfaces/stack.html; do
  if ! git show ":$need" > "$tmp/$(basename "$need")" 2>/dev/null; then
    echo "stack-inventory: BLOCKED - $need is missing from the index (staged for deletion?); the inventory cannot be checked for this commit" >&2
    echo "  remedy: git reset -- $need   (or regenerate: node scripts/build-stack-inventory.mjs && git add surfaces/stack.html)" >&2
    echo "  --no-verify is not a bypass: CI runs the same --check on push." >&2
    exit 1
  fi
done
members=$(grep -c '"crates/' "$tmp/Cargo.toml" 2>/dev/null || echo 0)

if STACK_INVENTORY_CARGO="$tmp/Cargo.toml" STACK_INVENTORY_PAGE="$tmp/stack.html" \
   node scripts/build-stack-inventory.mjs --check >"$tmp/out" 2>"$tmp/err"; then
  echo "stack-inventory: ok - the staged surfaces/stack.html matches the staged Cargo.toml ($members member lines)"
  exit 0
fi

echo "stack-inventory: BLOCKED - surfaces/stack.html is stale for the staged Cargo.toml members" >&2
echo "  (CI's Engine Room check would fail on this commit)." >&2
echo "  remedy: node scripts/build-stack-inventory.mjs && git add surfaces/stack.html   then commit again" >&2
grep -m1 'Error' "$tmp/err" | sed 's/^/  generator: /' >&2
echo "  --no-verify is not a bypass: CI runs the same --check on push." >&2
exit 1
