#!/bin/sh
# identity-check.sh — §7 identity check on the pushed range.
#
# THIS SCRIPT IS THE ENFORCEMENT POINT: CI runs it on every push. The local
# pre-commit hook is ADVISORY ONLY and must never be called "enforced" on its
# own — a seat that skips core.hooksPath sees no local check at all.
#
# §7 shape (2026-08-24 upgrade): the AUTHOR of every commit is the founder
# (env-only: seats export GIT_AUTHOR_NAME/EMAIL as the founder). A seat
# self-identifies by exporting GIT_COMMITTER_NAME/EMAIL as ITSELF, making
# author != committer — and exactly those commits HARD-REQUIRE a
# Co-authored-by trailer crediting the seat. Founder-typed commits
# (author == committer) are unaffected.
#
# Local runs may override the range: S7_RANGE="origin/main~6..origin/main" sh scripts/identity-check.sh
set -u

FOUNDER_NAME="loVis waTer"
FOUNDER_EMAIL="loviswater44@gmail.com"

# On a fresh CI checkout origin/main may be absent (shallow/partial fetch).
# Degrade to checking HEAD only — never skip silently.
RANGE="${S7_RANGE:-origin/main..HEAD}"
if [ "$RANGE" = "origin/main..HEAD" ] && ! git rev-parse -q --verify origin/main >/dev/null 2>&1; then
  echo "§7: origin/main ref not present — checking HEAD only (range unavailable)"
  RANGE="-1 HEAD"
fi

count=$(git log --format='%H' $RANGE | wc -l | tr -d ' ')
if [ "$count" = "0" ]; then
  echo "ok   §7 — empty range ($RANGE): nothing beyond the base to check"
  exit 0
fi
echo "§7 — checking $count commit(s) in $RANGE"

status=0
while IFS='|' read -r commit an ae cn ce; do
  [ -z "$commit" ] && continue

  # Author is ALWAYS the founder — no exceptions, seat-typed or founder-typed.
  if [ "$an" != "$FOUNDER_NAME" ] || [ "$ae" != "$FOUNDER_EMAIL" ]; then
    echo "FAIL §7 $commit — author is '$an <$ae>', not the founder (seats are committers + trailers, never authors)"
    status=1
    continue
  fi

  trailers=$(git show -s --format='%(trailers:key=Co-authored-by)' "$commit" | grep -c 'Co-authored-by' || true)

  # A seat self-identifies by committer != founder: exactly those commits
  # hard-require a Co-authored-by trailer. Founder-typed commits (author ==
  # committer) are unaffected by §7's trailer clause.
  if [ "$cn" != "$FOUNDER_NAME" ] || [ "$ce" != "$FOUNDER_EMAIL" ]; then
    if [ "$trailers" -lt 1 ]; then
      echo "FAIL §7 $commit — seat-typed (committer '$cn <$ce>') without a Co-authored-by trailer; credit the seat in the commit"
      status=1
      continue
    fi
    echo "ok   §7 $commit — founder-authored · seat-committed by '$cn' · Co-authored-by trailers: $trailers"
  else
    echo "ok   §7 $commit — founder-typed (author == committer) · Co-authored-by trailers: $trailers"
  fi
done <<EOF
$(git log --format='%H|%an|%ae|%cn|%ce' $RANGE)
EOF

if [ "$status" -ne 0 ]; then
  echo "§7 FAIL — see above; the pushed range does not satisfy §7."
fi
exit "$status"
