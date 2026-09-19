#!/usr/bin/env bash
# stage-backend-worktree.sh — the board ruling's operational fix, staged as a
# ONE-PASTE run (board 2026-09-19, on af02247b: "backend and UX should not
# share the same worktree while coding concurrently — one writer per worktree
# is the safer extension of one writer per file family").
#
# Moves the Suite-MCP backend seat's uncommitted work OUT of wt-zcode-bpay-e
# (the UX lane's worktree) into a dedicated backend worktree, so both lanes
# resume with one writer each. Run it ONLY when the backend session is DONE
# writing — the LIVE-WRITER GUARD below refuses otherwise (a move under a
# live writer recreates the hazard in the other direction).
#
#   bash ops/bpay-sign/stage-backend-worktree.sh
set -euo pipefail

UX_WT="/c/Users/travi/wt-zcode-bpay-e"
BE_WT="/c/Users/travi/wt-zcode-bpay-mcp"
BE_BRANCH="zcode/bpay-suite-mcp-2026-09-19"
BASE="8a58e31a"   # the parked lane HEAD the backend diff was made against
                 # (af02247b touched no crates/ bytes, so the diff is
                 # identical against either — this base keeps the backend
                 # lane free of the UX rider)

# ── 1. LIVE-WRITER GUARD ─────────────────────────────────────────────────
# Refuse if any backend-owned file changed in the last 10 minutes.
GUARD_SECS=600
now=$(date +%s)
for f in \
  "$UX_WT/crates/bpay-sign/src/suite_mcp.rs" \
  "$UX_WT/crates/bpay-sign/src/lib.rs" \
  "$UX_WT/crates/bpay-sign/src/bin/safe7_preflight.rs" \
  "$UX_WT/crates/bpay-sign/src/main.rs"; do
  if [ -f "$f" ]; then
    m=$(stat -c %Y "$f")
    age=$((now - m))
    if [ "$age" -lt "$GUARD_SECS" ]; then
      echo "REFUSED: $f was modified ${age}s ago (< ${GUARD_SECS}s) — the backend"
      echo "writer looks LIVE. Re-run this script after that session closes."
      exit 3
    fi
  fi
done
echo "live-writer guard: PASS (no backend file touched in the last ${GUARD_SECS}s)"

# ── 2. the backend worktree, cut from the parked base ────────────────────
cd "$UX_WT"
if [ -e "$BE_WT" ]; then
  echo "REFUSED: $BE_WT already exists — if this move already ran, nothing to do."
  exit 0
fi
git worktree add "$BE_WT" -b "$BE_BRANCH" "$BASE"

# ── 3. copy the backend seat's uncommitted work (verify byte-identical) ──
copy_checked() { # src-in-ux relpath
  local rel="$1"
  mkdir -p "$BE_WT/$(dirname "$rel")"
  cp "$UX_WT/$rel" "$BE_WT/$rel"
  if ! cmp -s "$UX_WT/$rel" "$BE_WT/$rel"; then
    echo "VERIFY FAILED on $rel — aborting BEFORE any deletion (UX worktree untouched)."
    exit 4
  fi
}
copy_checked "crates/bpay-sign/src/lib.rs"
copy_checked "crates/bpay-sign/src/suite_mcp.rs"
copy_checked "crates/bpay-sign/src/bin/safe7_preflight.rs"
# the small main.rs import diff (crate::rlp → bpay_sign::rlp after lib.rs)
git -C "$UX_WT" diff crates/bpay-sign/src/main.rs > /tmp/bpay-mcp-main.diff
if [ -s /tmp/bpay-mcp-main.diff ]; then
  git -C "$BE_WT" apply /tmp/bpay-mcp-main.diff
fi
# their live-stack run's presentation shots (02:47 run evidence)
for shot in bpay-e-2-price-390.png bpay-e-3-authorize-review-390.png bpay-e-4-authorized-390.png; do
  if ! git -C "$UX_WT" diff --quiet -- "e2e/shots-bdata/$shot"; then
    copy_checked "e2e/shots-bdata/$shot"
  fi
done

# ── 4. only now clean the UX worktree (the move half) ────────────────────
git -C "$UX_WT" checkout -- crates/bpay-sign/src/main.rs
git -C "$UX_WT" checkout -- e2e/shots-bdata/bpay-e-2-price-390.png \
  e2e/shots-bdata/bpay-e-3-authorize-review-390.png \
  e2e/shots-bdata/bpay-e-4-authorized-390.png 2>/dev/null || true
rm -f "$UX_WT/crates/bpay-sign/src/suite_mcp.rs" \
      "$UX_WT/crates/bpay-sign/src/lib.rs" \
      "$UX_WT/crates/bpay-sign/src/bin/safe7_preflight.rs"
rmdir "$UX_WT/crates/bpay-sign/src/bin" 2>/dev/null || true

echo
echo "MOVE COMPLETE:"
echo "  backend lane → $BE_WT (branch $BE_BRANCH, base $BASE, work UNCOMMITTED — the backend seat commits it)"
echo "  UX worktree  → $UX_WT now clean of backend files (git status should show nothing crates/)"
git -C "$UX_WT" status -s | head -5
git -C "$BE_WT" status -s | head -8
