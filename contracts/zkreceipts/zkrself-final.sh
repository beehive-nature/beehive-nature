#!/bin/bash
# zkrself-final.sh v3 — the FINALIZER, review order 2026-10-07 round 3.
# v2's decisive defect (offline-proven by the reviewer's stub): find_anchor
# called bad() INSIDE command substitution, so its FAILS never reached the
# parent — a missing prerequisite silently SKIPPED its leg and the run
# still exited 0 ("nothing recorded a failure" ≠ "everything passed"; a
# table without the seven claims scored 2 passed / 0 failed). v3 rules:
#   · PARENT-OWNED accounting — discovery emits `seq N` on stdout,
#     diagnostics on stderr, and ONLY a return status; every failure is
#     recorded by the caller, never in a subshell.
#   · REQUIRED-LEG LEDGER — closeout fails unless every expected leg has
#     a recorded result; absence is a failure, never success.
#   · EXACT build identity — on-chain hash must EQUAL the pinned release
#     wasm sha256 (non-empty is not a check; the zero-hash and
#     wrong-contract cases both passed v2's predicate, reviewer-proven).
#   · ASSERTED final state — via the shared final_table_assert.mjs:
#     exact claims, verified_at class per claim, rows == cap; an
#     unreadable final table is inconclusive, never green.
# Reconciles STANDING anchors (no deployment — shell logic is not a
# reason to buy another deploy). Positives for these claims were
# receipted by zkrself-run.sh (composite label preserved).
U=${U:-https://jungle4.greymass.com}
RURL=${RURL:-https://jungle4.api.eosnation.io}
# REPO = the directory CONTAINING the helpers (final-find.mjs,
# final_table_assert.mjs). NOTE: the v2 form `${REPO:-base}/contracts/
# zkreceipts` appended the suffix even when REPO was pre-set — a doubled
# path that unloaded every helper (found by the offline regressions).
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature/contracts/zkreceipts}
W=~/plonkport
A=${A:-zkrtst111111}
CLEOS=${CLEOS:-"/usr/bin/cleos -u $U"}
RCLEOS=${RCLEOS:-"/usr/bin/cleos -u $RURL"}
# PUBLIC-CONSTANT: zkrcount v1.1 release wasm sha256 (zkrcount.cpp @ this lane, deployed on zkrtst111111 2026-10-07)
EXPECTED_HASH=${EXPECTED_HASH:-7a86ac34ddf15489a90775a2e0e8f1baa7e5337a268af73e43e41c884af6f40d}  # PUBLIC-CONSTANT: zkrcount v1.1 release wasm sha256
PASS=0; FAILS=0; RESULTS=""
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; echo "----- output (first 4 lines) -----"; echo "$2" | head -4; echo "--------------------------------"; FAILS=$((FAILS+1)); }
record(){ RESULTS="$RESULTS
$1 $2"; [ "$2" = PASS ] || FAILS=$((FAILS+1)); }
LEGS="identity forged count21 rootflip kind1 reverify asym019 asym120 exhaust final"

$CLEOS wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key "$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key)" >/dev/null 2>&1 || true

push_raw(){ OUT=$($CLEOS push action $A "$1" "$2" -p $A 2>&1); RC=$?; }
expect_refuse(){ # label action json exact-message → status only (parent records)
  local LBL=$1 ACT=$2 ARGS=$3 MSG=$4
  push_raw "$ACT" "$ARGS"
  if echo "$OUT" | grep -q "executed transaction:"; then bad "$LBL — UNEXPECTEDLY EXECUTED"; echo "$OUT" | head -3; return 1; fi
  if echo "$OUT" | grep -qF "$MSG"; then ok "$LBL — refused: $MSG"; return 0; fi
  bad "$LBL — wrong/absent reason (expected: $MSG)"; echo "$OUT" | head -3; return 1
}
# discovery, subshell-safe: stdout `seq N` only; diagnostics to stderr;
# rc 0 found · 1 no-match · 2 inconclusive. NEVER records failures.
find_anchor(){ # root kind count [unverified|verified]
  local I RES
  for I in 1 2 3 4 5 6; do
    RES=$($RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node $REPO/final-find.mjs "$1" "$2" "$3" "${4:-unverified}")
    case "$RES" in
      "seq "*) echo "seq ${RES#seq } (attempt $I)" >&2; echo "${RES#seq }"; return 0 ;;
      NONE)    echo "find_anchor($1,$2,$3,${4:-unverified}): no standing row matches" >&2; return 1 ;;
      *)      echo "find_anchor($1,$2,$3): READ-ERROR attempt $I of 6" >&2 ;;
    esac
    sleep 4
  done
  echo "find_anchor($1,$2,$3): INCONCLUSIVE after 6 attempts" >&2
  return 2
}
discover(){ # leg-id root kind count [class] → sets SEQ; records on failure; logs for the final spec
  local R
  if R=$(find_anchor "$2" "$3" "$4" "${5:-unverified}" 2>/tmp/zkr-find.err); then
    SEQ=${R%% *}; echo "  [$1] prerequisite: seq $SEQ"
    node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4],verified:process.argv[5]==='verified'?'nonzero':'zero'}))" "$SEQ" "$2" "$3" "$4" "${5:-unverified}" >> /tmp/zkr-disc.log
    return 0
  fi
  record "$1" FAIL; echo "  [$1] discovery failed: $(tail -1 /tmp/zkr-find.err)"
  return 1
}

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
ROOTFLIP=$(node -pe "const r='$ROOT'.split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')")
FROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).root.replace(/^0x/,'')")
P_DEAD=$(node -pe "require('$W/calldata_dead.json').proof_hex")
P_FORG=$(node -pe "require('$W/calldata_forged.json').proof_hex")
FA_DEAD=$(node -pe "require('$W/asym/calldata_dead.json').proof_hex")
FA_LIVE=$(node -pe "require('$W/asym/calldata_live.json').proof_hex")
vargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],proof:process.argv[2]}))" "$@"; }
aargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4]}))" "$@"; }
PAIR="count proof REJECTED — plonk pairing false"
SPEC=/tmp/zkr-final-spec.json; : > $SPEC; : > /tmp/zkr-disc.log

echo "== [0] build identity (EXACT equality — pinned release wasm) =="
CH=$($RCLEOS get code $A 2>/dev/null | head -1 | grep -oE '[a-f0-9]{64}')
if [ -n "$CH" ] && [ "$CH" = "$EXPECTED_HASH" ]; then
  ok "on-chain code hash == pinned wasm sha256 (${CH:0:16}…, this exact build)"; record identity PASS
else
  bad "build identity: on-chain '$CH' ≠ pinned '$EXPECTED_HASH' — wrong build or no code" ""; record identity FAIL
fi

echo "== [1] negative legs against standing anchors (discovered, parent-owned) =="
if discover forged "$ROOT" 0 20; then
  expect_refuse "forged proof (eval_zw+1) @seq $SEQ" verify "$(vargs $SEQ "$P_FORG")" "$PAIR" && record forged PASS || record forged FAIL
fi
if discover count21 "$ROOT" 0 21; then
  expect_refuse "real dead proof vs count=21 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record count21 PASS || record count21 FAIL
fi
if discover rootflip "$ROOTFLIP" 0 20; then
  expect_refuse "real dead proof vs mutated root @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record rootflip PASS || record rootflip FAIL
fi
if discover kind1 "$ROOT" 1 20; then
  expect_refuse "real DEAD proof vs kind=1 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record kind1 PASS || record kind1 FAIL
fi
if discover reverify "$ROOT" 0 20 verified; then
  expect_refuse "re-verify @seq $SEQ (already verified)" verify "$(vargs $SEQ "$P_DEAD")" "anchor already verified (one proof per anchor)" && record reverify PASS || record reverify FAIL
fi
echo "== [2] asym REVERSED claims (the selector law, on-chain) =="
if discover asym019 "$FROOT" 0 19; then
  expect_refuse "valid asym-dead proof vs REVERSED (0,19) @seq $SEQ" verify "$(vargs $SEQ "$FA_DEAD")" "$PAIR" && record asym019 PASS || record asym019 FAIL
fi
if discover asym120 "$FROOT" 1 20; then
  expect_refuse "valid asym-live proof vs REVERSED (1,20) @seq $SEQ" verify "$(vargs $SEQ "$FA_LIVE")" "$PAIR" && record asym120 PASS || record asym120 FAIL
fi
echo "== [3] exhaustion — the bounded budget refuses in the open =="
CAP=$($RCLEOS get table $A $A law 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).rows[0].max_anchors)}catch(e){console.log('?')}})")
expect_refuse "anchor beyond cap (table full)" anchor "$(aargs 4294967295 "$ROOT" 0 20)" "anchor table FULL (bounded resource budget)" && record exhaust PASS || record exhaust FAIL
echo "== [4] final state (ASSERTED — the shared final_table_assert.mjs) =="
CAP=$($RCLEOS get table $A $A law 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).rows[0].max_anchors)}catch(e){console.log('?')}})")
# the assertion spec is the DISCOVERY LOG itself: every leg's claim in
# its expected verified class, table exactly at cap; unreadable = fail
node -e "
const fs=require('fs');
const spec=fs.readFileSync('/tmp/zkr-disc.log','utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
fs.writeFileSync(process.argv[1],JSON.stringify(spec));" "$SPEC"
if $RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node $REPO/final_table_assert.mjs "$SPEC" "$CAP"; then
  record final PASS
else
  record final FAIL
fi

echo "== LEDGER =="
MISSING=0
for L in $LEGS; do
  LINE=$(printf '%s\n' "$RESULTS" | grep "^$L " | head -1)
  case "${LINE#* }" in
    PASS) echo "  $L: PASS" ;;
    FAIL) echo "  $L: FAIL" ;;
    *)    echo "  $L: NEVER RAN — absence is a failure (the v2 defect, closed)"; MISSING=$((MISSING+1)); FAILS=$((FAILS+1)) ;;
  esac
done
echo "== RESULT: $PASS passed, $FAILS failed (incl. $MISSING never-ran) =="
[ $FAILS -eq 0 ] || exit 1
exit 0
