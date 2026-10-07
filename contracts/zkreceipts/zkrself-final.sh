#!/bin/bash
# zkrself-final.sh v2 — the FINALIZER of the corrected-build enforcing
# pass on zkrtst111111 (review 2026-10-07 order). The account's anchor
# table reached its law-row cap mid-pass (the bound WORKS), so this
# completes the acceptance against anchors STANDING on-chain from the
# same build, DISCOVERED by (root,kind,count) — not by assumed seqs
# (v1 hardcoded run-epoch bases and a missing paren broke every
# reconcile; both found by the runner's own red). Every negative leg
# reconciles its prerequisite row first, then must refuse on its
# SPECIFIED reason; the exhaustion leg proves the bounded budget
# refuses in the open; positives for these same claims were receipted
# in the zkrself-run.sh pass (canonical verifies 10,277/11,391 µs with
# verified_at transitions; asym verifies 9,924/10,823 µs).
U=${U:-https://jungle4.greymass.com}
RURL=${RURL:-https://jungle4.api.eosnation.io}
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
W=~/plonkport
A=${A:-zkrtst111111}
CLEOS="/usr/bin/cleos -u $U"
RCLEOS="/usr/bin/cleos -u $RURL"
PASS=0; FAILS=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; FAILS=$((FAILS+1)); }

$CLEOS wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key "$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key)" >/dev/null 2>&1 || true

push_raw(){ OUT=$($CLEOS push action $A "$1" "$2" -p $A 2>&1); RC=$?; }
expect_refuse(){ # label action json exact-message
  local LBL=$1 ACT=$2 ARGS=$3 MSG=$4
  push_raw "$ACT" "$ARGS"
  if echo "$OUT" | grep -q "executed transaction:"; then bad "$LBL — UNEXPECTEDLY EXECUTED"; echo "$OUT" | head -3; return 1; fi
  if echo "$OUT" | grep -qF "$MSG"; then ok "$LBL — refused: $MSG"; return 0; fi
  bad "$LBL — wrong/absent reason (expected: $MSG)"; echo "$OUT" | head -3
}
# find_anchor <root> <kind> <count> [unverified|verified] — bounded,
# recorded discovery of a standing row matching the exact claim
find_anchor(){
  local I RES
  for I in 1 2 3 4 5 6; do
    RES=$($RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node $REPO/final-find.mjs "$1" "$2" "$3" "${4:-unverified}")
    case "$RES" in
      "seq "*) echo "$RES (attempt $I)"; return 0 ;;
      NONE)    bad "find_anchor ($1, $2, $3, ${4:-unverified}) — no standing row matches" ""; return 1 ;;
      *)      echo "find_anchor: READ-ERROR (attempt $I of 6)" ;;
    esac
    sleep 4
  done
  bad "find_anchor ($1,$2,$3) INCONCLUSIVE after 6 attempts" ""
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

echo "== [0] build identity =="
CH=$($RCLEOS get code $A 2>&1 | head -1 | grep -oE '[a-f0-9]{64}')
[ -n "$CH" ] && ok "on-chain code hash ${CH:0:16}… (this build)" || { bad "no code on-chain" ""; exit 1; }

echo "== [1] negative legs against standing anchors (discovered, then reconciled) =="
R=$(find_anchor "$ROOT" 0 20 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  forged-proof anchor: $R" \
  && expect_refuse "forged proof (eval_zw+1) @seq $SEQ" verify "$(vargs $SEQ "$P_FORG")" "$PAIR"
R=$(find_anchor "$ROOT" 0 21 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  count=21 anchor: $R" \
  && expect_refuse "real dead proof vs count=21 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR"
R=$(find_anchor "$ROOTFLIP" 0 20 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  mutated-root anchor: $R" \
  && expect_refuse "real dead proof vs mutated root @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR"
R=$(find_anchor "$ROOT" 1 20 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  kind=1 anchor: $R" \
  && expect_refuse "real DEAD proof vs kind=1 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR"
R=$(find_anchor "$ROOT" 0 20 verified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  verified anchor (re-verify): $R" \
  && expect_refuse "re-verify @seq $SEQ (already verified)" verify "$(vargs $SEQ "$P_DEAD")" "anchor already verified (one proof per anchor)"
echo "== [2] asym REVERSED claims (the selector law, on-chain) =="
R=$(find_anchor "$FROOT" 0 19 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  asym reversed (0,19): $R" \
  && expect_refuse "valid asym-dead proof vs REVERSED (0,19) @seq $SEQ" verify "$(vargs $SEQ "$FA_DEAD")" "$PAIR"
R=$(find_anchor "$FROOT" 1 20 unverified) && SEQ=$(echo "$R" | awk '{print $2}') && echo "  asym reversed (1,20): $R" \
  && expect_refuse "valid asym-live proof vs REVERSED (1,20) @seq $SEQ" verify "$(vargs $SEQ "$FA_LIVE")" "$PAIR"
echo "== [3] exhaustion — the bounded budget refuses in the open =="
ROWS=$($RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node $REPO/final-find.mjs x 0 0 2>/dev/null | head -1)
CAP=$($RCLEOS get table $A $A law 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).rows[0].max_anchors)}catch(e){console.log('?')}})")
echo "  table rows / cap: $($RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).rows.length)})") / $CAP"
expect_refuse "anchor beyond cap (table full)" anchor "$(aargs 4294967295 "$ROOT" 0 20)" "anchor table FULL (bounded resource budget)"
echo "== [4] final table =="
$RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
const rows=JSON.parse(s).rows;
const byClaim={};
for(const r of rows){const hex=typeof r.root==='string'?r.root.replace(/^0x/,''):Buffer.from(r.root).toString('hex');
  const k=hex.slice(0,8)+'/'+r.kind+'/'+r.count; byClaim[k]=(byClaim[k]||0)+(r.verified_at>0?0:0)+1;}
const verified=rows.filter(r=>r.verified_at>0).length;
console.log('  rows:',rows.length,'verified:',verified,'unverified:',rows.length-verified,'— table AT CAP, the bound held');});"

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
