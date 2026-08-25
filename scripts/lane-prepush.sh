#!/bin/sh
# lane-prepush.sh — the four-check protocol, with its SUBJECT asserted first.
#
# AMENDMENT (zC finding, founder ruling 2026-08-24): zC's first run reported
# 8 hex runs and secret-scan hits that were MAIN'S NEW CONTENT from other
# seats, seen through the REVERSE diff because its delta was empty. It
# nearly filed a peer's work as a finding on its own lane.
#
# THE LAW THIS ENCODES: assert the subject, then trust the output — a scan
# whose subject you have not confirmed is not a scan of your work. And: an
# empty delta means there is NOTHING to preserve — no scan, and never a
# "clean" reported as if something had been checked.
#
# Structural guarantees, not remembered ones:
#   - the script composes main..<lane> itself; the caller cannot invert it
#   - the subject commits print BEFORE any scanner runs, so the operator
#     sees whose work is being scanned
#   - empty delta prints its emptiness and exits 0 WITHOUT scanning
#
# Usage: sh scripts/lane-prepush.sh lane/<yours>
set -u

LANE="${1:-}"
if [ -z "$LANE" ]; then
  echo "usage: sh scripts/lane-prepush.sh lane/<yours>"
  exit 2
fi
git rev-parse -q --verify "$LANE" >/dev/null 2>&1 \
  || { echo "PREPUSH FAIL — $LANE does not resolve in this checkout"; exit 1; }

DELTA=$(git log --oneline "main..$LANE" 2>/dev/null)
if [ -z "$DELTA" ]; then
  echo "EMPTY DELTA — main..$LANE contains zero commits."
  echo "Nothing to scan, nothing to preserve. Push the ref if you like;"
  echo "report the emptiness, never a clean."
  exit 0
fi

N=$(printf '%s\n' "$DELTA" | wc -l | tr -d ' ')
echo "subject asserted · $N commit(s) · direction main..$LANE (composed by this script — cannot be inverted):"
printf '  %s\n' $DELTA
echo

# ── THE DOT LAW (zB mechanism, founder amendment 2026-08-24; footgun stated
#    per command — the dot count that means "only mine" is INVERTED between
#    log and diff):
#      git log  main..lane     TWO dots   — commits that are yours        ✓ subject
#      git diff main..lane     TWO dots   — diff of TIPS; peer work rides in
#                                           REVERSED as your deletions     ✗
#      git diff main...lane    THREE dots — merge-base to lane, only yours ✓ scan
#    Cowork's controlled reproduction: (A) a two-dot diff surfaced a PEER'S
#    token as a deletion inside a non-empty "delta"; (B) with an EMPTY
#    subject the two-dot diff STILL emitted the peer's secret — a seat with
#    no work can file a security finding about someone else's code. Live
#    Case-B receipt on this box: empty subject (0 commits), two-dot emitted
#    78 files / 10,731 deletions of main-side work; three-dot emitted
#    nothing. The EMPTY branch of this script exits BEFORE any scan, which
#    is the structural prevention of Case B; and this script never runs a
#    two-dot diff. secret-scan.sh TREE mode is directionless and immune —
#    this law binds the DELTA scan.
#    SIGN INVERSION (cc2 addendum): the reversed two-dot diff inverts signs —
#    peer ADDITIONS appear as your deletions, peer DELETIONS appear as your
#    ADDITIONS. The delta scan reads ^+ lines, so a secret surfacing through
#    a two-dot diff is one a peer had ALREADY REMOVED: the finding is wrong
#    about the owner AND the tense, and unfalsifiable against current state
#    (you grep the tree, find nothing, cannot tell false alarm from
#    concealment) — and may cost a peer a rotation they already performed.
#    ESCALATION RULE: a secret-scan hit you cannot locate in the working
#    tree → CHECK YOUR DOT COUNT BEFORE YOU ESCALATE. Live receipt on this
#    box: the reversed diff showed "+ ad-hoc smoke… not part of the
#    committed suite" — a line main had replaced; grep of every tree: 0.
MB=$(git merge-base "main" "$LANE" 2>/dev/null)
MT=$(git rev-parse main 2>/dev/null)
if [ "$MB" = "$MT" ]; then
  echo "dot state · main is AT the merge-base — two-dot and three-dot diffs coincide; nothing armed."
else
  echo "dot state · main HAS MOVED past the merge-base — the two-dot trap is ARMED:"
  echo "  any diff over this lane MUST be three-dot (main...$LANE); two-dot would render main's new content as your deletions."
fi
echo

echo "1/4 secret-scan, tree mode (secrets + the 48-hex PUBLIC-CONSTANT law)"
echo "  · if a hit cannot be located in the working tree, check your dot count BEFORE"
echo "    escalating — a reversed diff surfaces secrets a peer already REMOVED"
echo "    (wrong owner, wrong tense)."
sh scripts/secret-scan.sh tree || { echo "PREPUSH FAIL — secret-scan"; exit 1; }
echo "2/4 §7 identity on main..$LANE (its printed count must equal the asserted $N)"
S7_RANGE="main..$LANE" sh scripts/identity-check.sh || { echo "PREPUSH FAIL — §7"; exit 1; }
echo "3/4 shell-chain lint (the grep -c short-circuit law)"
sh scripts/lint-shell-chains.sh || { echo "PREPUSH FAIL — shell chains"; exit 1; }
echo "4/4 CI shape lint (always() on suites, static declares no needs)"
node scripts/lint-ci-shape.mjs || { echo "PREPUSH FAIL — CI shape"; exit 1; }

echo "FOUR CHECKS GREEN on $N asserted commit(s) — safe to push $LANE."
