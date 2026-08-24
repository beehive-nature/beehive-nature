#!/bin/sh
# identity-check.sh — §7 identity check on the pushed range.
#
# THIS SCRIPT IS THE ENFORCEMENT POINT: CI runs it on every push. The local
# pre-commit hook is ADVISORY ONLY and must never be called "enforced" on its
# own — a seat that skips core.hooksPath sees no local check at all.
#
# §7: the author of every commit is the founder; machine seats are credited
# via Co-authored-by trailers. The trailer is printed per commit for the
# record; identity is the hard-fail.
#
# Local runs may override the range: S7_RANGE="origin/main~6..origin/main" sh scripts/identity-check.sh
set -u

EXPECTED_NAME="loVis waTer"
EXPECTED_EMAIL="loviswater44@gmail.com"

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
  [ "$an" = "$EXPECTED_NAME" ] && [ "$ae" = "$EXPECTED_EMAIL" ] \
    && [ "$cn" = "$EXPECTED_NAME" ] && [ "$ce" = "$EXPECTED_EMAIL" ] || {
      echo "FAIL §7 $commit — author '$an <$ae>' committer '$cn <$ce>'"
      status=1
      continue
    }
  trailers=$(git show -s --format='%(trailers:key=Co-authored-by)' "$commit" | grep -c 'Co-authored-by' || true)
  echo "ok   §7 $commit — $an <$ae> · Co-authored-by trailers: $trailers"
done <<EOF
$(git log --format='%H|%an|%ae|%cn|%ce' $RANGE)
EOF

if [ "$status" -ne 0 ]; then
  echo "§7 FAIL — every commit in the pushed range must be authored by the founder;"
  echo "           seats are credited via Co-authored-by trailers, never as author."
fi
exit "$status"
