#!/bin/bash
# zkrself-parse-test.sh — LOCAL fixture tests for reconcile_row.mjs (no
# network, no wallet, no chain, no RAM — review order 2026-10-07:
# "fix and test the helpers with local fixtures first"). Proves the
# repaired parser classifies every response class correctly, including
# the exact input shape the defective inline form failed on (a complete,
# valid response delivered through a here-string).
#
# The defect being guarded against: `JSON.parse(process.stdin.read())`
# races its own stdin — read() with nothing buffered returns null, which
# is a STREAM STATE, never evidence about the HTTP response. Retrying a
# parser that can lose the race is not a fix; readFileSync(0) blocks to
# EOF, so the race is structurally eliminated.
REPO=${REPO:-$(cd "$(dirname "$0")" && pwd)}
F=$REPO/fixtures/parse
SEQ=1791354701
ROOT=a1b2c3d4e5f60718
PASS=0; FAILS=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; FAILS=$((FAILS+1)); }

check(){ # fixture expectedExit label
  local FICTURE=$1 WANT=$2 LBL=$3 GOT ERR
  ERR=$(node "$REPO/reconcile_row.mjs" "$SEQ" "$ROOT" 0 20 < "$FICTURE" 2>&1 >/dev/null)
  GOT=$?
  if [ "$GOT" = "$WANT" ]; then ok "$LBL (exit $GOT: ${ERR%%—*})"; else bad "$LBL — exit $GOT ≠ $WANT ($ERR)"; fi
}

check "$F/valid.json"     0 "valid response → visible-and-exact"
check "$F/malformed.json" 2 "truncated JSON → malformed (not transport)"
check "$F/empty.txt"      3 "zero-byte body → transport-empty"
check "$F/missing.json"   4 "rows present, seq absent → row-missing"
check "$F/mismatch.json"  5 "count 19 vs claimed 20 → field-mismatch"

# the here-string delivery path the runners actually use — the exact
# mechanism of the 2026-10-07 incident (a complete valid body through
# <<<) must classify as visible-and-exact, repeatedly
ROWJ=$(cat "$F/valid.json")
for i in 1 2 3 4 5; do
  if node "$REPO/reconcile_row.mjs" "$SEQ" "$ROOT" 0 20 <<< "$ROWJ" 2>/dev/null; then
    ok "here-string delivery run $i → visible-and-exact"
  else
    bad "here-string delivery run $i — valid body misclassified"
  fi
done

# ── final_table_assert.mjs — STRICT TIMESTAMP VALIDATION (review order
# 3, 2026-10-07): the verified_at field must be PRESENT and a VALID
# uint32 ABI timestamp BEFORE the positive-vs-zero assertion. The four
# mutations below are the reviewer's exact table — each once passed
# exit 0 under truthiness/Number() coercion and must now fail exit 6.
FF=$REPO/fixtures/final
ftcheck(){ # fixture expectedExit label
  local TBL=$1 WANT=$2 LBL=$3 GOT ERR
  ERR=$(node "$REPO/final_table_assert.mjs" "$FF/spec.json" 4 < "$TBL" 2>&1 >/dev/null)
  GOT=$?
  if [ "$GOT" = "$WANT" ]; then ok "$LBL (exit $GOT)"; else bad "$LBL — exit $GOT ≠ $WANT ($ERR)"; fi
}
ftcheck "$FF/table-valid.json"             0 "valid 4-row table → asserted"
ftcheck "$FF/table-missing-negative.json"  6 "rejected row OMITS verified_at → state not established"
ftcheck "$FF/table-null-negative.json"     6 "rejected row verified_at:null → invalid field"
ftcheck "$FF/table-string-positive.json"   6 "positive row verified_at:'not-a-timestamp' → invalid timestamp"
ftcheck "$FF/table-neg-one-positive.json"  6 "positive row verified_at:-1 → invalid timestamp"

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
