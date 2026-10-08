#!/bin/bash
# zkrself-run.sh v2 — the ENFORCING self-paid acceptance runner (review
# 2026-10-07: the v1 runner printed results without asserting them — a
# green exit proved nothing; a negative test now passes ONLY on its
# SPECIFIED failure reason, and a positive test only on execution + the
# expected table transition. Before any negative verify, the prerequisite
# anchor is RECONCILED against chain state with bounded, recorded
# retries; if visibility cannot be established the test counts
# INCONCLUSIVE (a failure), never passed. Exit 0 ⇔ every leg passed.)
#
# Self-paid on the founder-loaded account (plain self-signed pushes —
# the receipts carry the contract's own assertion messages). Artifacts
# from prove_count.sh: canonical $W/{expected,calldata_*}.json and the
# asym selector fixture $W/asym/* (deadKept=20, liveKept=19).
U=${U:-https://jungle4.greymass.com}
RURL=${RURL:-https://jungle4.api.eosnation.io}   # reads on a second endpoint so a stale write-endpoint read never gates a leg. (The 2026-10-07 null parses were a LOCAL stdin race — see reconcile; provider-level throttling UNVERIFIED.)
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
W=~/plonkport
A=${A:-zkrtst111111}
CLEOS="/usr/bin/cleos -u $U"
RCLEOS="/usr/bin/cleos -u $RURL"
PASS=0; FAILS=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; echo "----- output (first 4 lines) -----"; echo "$2" | head -4; echo "--------------------------------"; FAILS=$((FAILS+1)); }

$CLEOS wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key "$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key)" >/dev/null 2>&1 || true

# push and capture EVERYTHING (out + exit status) — no grep-piping that
# swallows transport failures into empty strings
push_raw(){ OUT=$($CLEOS push action $A "$1" "$2" -p $A 2>&1); RC=$?; }

expect_ok(){ # label contract action json
  local LBL=$1 ACT=$2 ARGS=$3
  push_raw "$ACT" "$ARGS"
  if [ $RC -ne 0 ] || ! echo "$OUT" | grep -q "executed transaction:"; then
    bad "$LBL — expected EXECUTION" "$OUT"; return 1
  fi
  local B; B=$(echo "$OUT" | grep -oE "[0-9]+ us" | head -1)
  ok "$LBL — executed, billed $B"
}

expect_refuse(){ # label contract action json EXPECTED-EXACT-MESSAGE
  local LBL=$1 ACT=$2 ARGS=$3 MSG=$4
  push_raw "$ACT" "$ARGS"
  if echo "$OUT" | grep -q "executed transaction:"; then
    bad "$LBL — UNEXPECTEDLY EXECUTED (expected refusal)" "$OUT"; return 1
  fi
  if echo "$OUT" | grep -qF "$MSG"; then
    ok "$LBL — refused: $MSG"; return 0
  fi
  bad "$LBL — wrong or absent refusal reason (expected: $MSG)" "$OUT"
}

# reconcile: the prerequisite anchor must be VISIBLE with the exact
# claimed fields before a negative test may classify a refusal; bounded
# retries, each recorded; failure = INCONCLUSIVE = FAIL, never pass.
# THE 2026-10-07 REPAIR: the inline `JSON.parse(process.stdin.read())`
# raced its own stdin — read() returns null when nothing is buffered,
# which failed parses against VALID responses (seven legs starved to
# INCONCLUSIVE on zkrtst444444). The parser is now the shared
# reconcile_row.mjs (readFileSync(0) — blocks to EOF; the race is
# structurally gone) and every failure class is NAMED: malformed ·
# transport · missing · mismatch. Fixture-proven in
# zkrself-parse-test.sh before any chain use. Reads use the second
# endpoint (RCLEOS); retries remain for genuine state-visibility lag.
reconcile(){ # seq root kind count
  local SEQ=$1 ROOT=$2 KIND=$3 COUNT=$4 I RC1 ERR1
  for I in 1 2 3 4 5 6 7 8; do
    ERR1=$($RCLEOS get table $A $A anchors --lower $SEQ --upper $SEQ 2>/dev/null | node "$REPO/reconcile_row.mjs" "$SEQ" "$ROOT" "$KIND" "$COUNT" 2>&1 >/dev/null)
    RC1=$?
    case $RC1 in
      0) echo "reconcile seq $SEQ: visible and exact (attempt $I)"; return 0 ;;
      2) echo "reconcile seq $SEQ: MALFORMED response (attempt $I of 8): $ERR1" ;;
      3) echo "reconcile seq $SEQ: TRANSPORT-empty (attempt $I of 8): $ERR1" ;;
      4) echo "reconcile seq $SEQ: row not yet visible (attempt $I of 8): $ERR1" ;;
      5) echo "reconcile seq $SEQ: FIELD mismatch — not the anchored claim (attempt $I of 8): $ERR1" ;;
      *) echo "reconcile seq $SEQ: UNCLASSIFIED parse failure rc=$RC1 (attempt $I of 8): $ERR1" ;;
    esac
    sleep 6
  done
  bad "prerequisite anchor seq $SEQ INCONCLUSIVE — not established after 8 recorded attempts" "($ERR1)"
  return 1
}

row_field(){ $RCLEOS get table $A $A anchors --lower $1 --upper $1 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s).rows[0];console.log(r?r.$2:'MISSING')}catch(e){console.log('MISSING')}})"; }
# law_field — the cap lives in the LAW table, not anchors (found live
# 2026-10-07: the cap readback used row_field, got MISSING for an
# initialized law row, and FATALed a healthy account)
law_field(){ $RCLEOS get table $A $A law 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s).rows[0];console.log(r?r.$1:'MISSING')}catch(e){console.log('MISSING')}})"; }
count_rows(){ $RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).rows.length)}catch(e){console.log(-1)}})"; }

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
ROOTFLIP=$(node -pe "const r='$ROOT'.split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')")
FROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).root.replace(/^0x/,'')")
DK=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).deadKept")
LK=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).liveKept")
ADK=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).deadKept")
ALK=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).liveKept")
P_DEAD=$(node -pe "require('$W/calldata_dead.json').proof_hex")
P_LIVE=$(node -pe "require('$W/calldata_live.json').proof_hex")
P_FORG=$(node -pe "require('$W/calldata_forged.json').proof_hex")
FA_DEAD=$(node -pe "require('$W/asym/calldata_dead.json').proof_hex")
FA_LIVE=$(node -pe "require('$W/asym/calldata_live.json').proof_hex")
for f in "$W/expected.json" "$W/asym/expected.json" "$W/calldata_forged.json"; do
  [ -f "$f" ] || { echo "FATAL: artifact $f missing — run prove_count.sh (incl. [9b] asym) first"; exit 1; }
done
aargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4]}))" "$@"; }
vargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],proof:process.argv[2]}))" "$@"; }
PAIR="count proof REJECTED — plonk pairing false"

echo "== [1] compile + deploy (self-paid) =="
# private build dir: a parallel session compiles the unbounded pre-v1.1
# source to $W/zkrcount.wasm — never race the shared artifact name. (The
# file itself must stay named zkrcount.wasm: cdt-cpp's abigen matches the
# contract class against the OUTPUT FILENAME.)
mkdir -p $W/zkr11
(cd $REPO && /usr/bin/cdt-cpp -O3 -I. -o $W/zkr11/zkrcount.wasm -abigen zkrcount.cpp) || { echo "FATAL: compile"; exit 1; }
echo "  setcode: $($CLEOS set code $A $W/zkr11/zkrcount.wasm -p $A 2>&1 | grep -c 'executed transaction')"
echo "  setabi:  $($CLEOS set abi $A $W/zkr11/zkrcount.abi -p $A 2>&1 | grep -c 'executed transaction')"
# deploy gate with bounded retry — greymass reads are not read-your-writes
# (found live 2026-10-07 on zkrtst444444: setcode EXECUTED, the immediate
# get-code hit a stale node still showing the pre-deploy ZERO hash, and the
# gate FATALed healthy evidence; a re-read 4 s later matched)
WH=$(sha256sum $W/zkr11/zkrcount.wasm | cut -d' ' -f1)
CH=""
for t in 1 2 3 4; do
  CH=$($CLEOS get code $A 2>&1 | head -1 | grep -oE '[a-f0-9]{64}')
  [ "$CH" = "$WH" ] && break
  echo "  deploy-gate read $t: hash not yet this build — retrying in 4s"
  sleep 4
done
if [ -z "$CH" ] || [ "$CH" != "$WH" ]; then
  echo "FATAL: on-chain code hash ($CH) ≠ built wasm sha256 ($WH) — stale or failed deploy; actions would run the WRONG build (the phantom-pass law, sharpened: non-zero is not enough, it must be THIS build)"
  exit 1
fi
ok "deploy gate: on-chain code hash == built wasm sha256 (${CH:0:16}…)"

# rerun-safe sequence numbers: every invocation gets its own epoch-based
# base (the account's anchor rows ACCUMULATE across runs — a fixed seq
# collides with rows landed by earlier runs, found live 2026-10-07 when
# a crashed run's silently-landed anchors turned the next run red)
BASE=$(( $(date +%s) ))
S101=$((BASE+101)); S102=$((BASE+102)); S103=$((BASE+103)); S104=$((BASE+104))
S105=$((BASE+105)); S106=$((BASE+106)); S107=$((BASE+107))
S201=$((BASE+201)); S202=$((BASE+202)); S203=$((BASE+203)); S204=$((BASE+204))
S999=$((BASE+999))


echo "== [2] law row: bounded anchor budget =="
ROWS=$(count_rows)
[ "$ROWS" -ge 0 ] 2>/dev/null || { echo "FATAL: row count unreadable"; exit 1; }
LAW=$($RCLEOS get table $A $A law 2>/dev/null | grep -c '"max_anchors"')
if [ "$LAW" = 0 ]; then
  # existing rows + 6 canonical/tamper anchors + 4 asym = room for the pass,
  # then the fillers climb to the cap and the budget must refuse in the open
  CAP=$((ROWS + 10))
  push_raw init "[ $CAP ]"
  if [ $RC -eq 0 ] && echo "$OUT" | grep -q "executed transaction:"; then
    ok "init(max_anchors=$CAP) — existing rows $ROWS"
  else
    bad "init(max_anchors=$CAP)" "$OUT"
  fi
else
  CAP=$(law_field max_anchors); echo "  law already initialized: cap $CAP (rows $ROWS)"
fi
[ "$CAP" -ge $((ROWS + 10)) ] || { echo "FATAL: cap $CAP leaves no room for the pass (need ≥$((ROWS+10)) rows total)"; exit 1; }

# verified_at with bounded visibility retries (the state-visibility rule
# applies to reads too: an immediate read can lag the just-executed write)
vcheck(){ # seq label
  local V I
  for I in 1 2 3 4 5; do
    V=$(row_field $1 verified_at)
    if [ -n "$V" ] && [ "$V" != "0" ] && [ "$V" != "MISSING" ]; then ok "$2 verified_at=$V (read attempt $I)"; return 0; fi
    sleep 3
  done
  bad "$2 not marked verified (verified_at=$V after 5 attempts)" "(verified_at=$V)"
}

echo "== [3] canonical claims (root ${ROOT:0:12}…, 20/20) =="
expect_ok "anchor $S101 (R,0,20)" anchor "$(aargs $S101 "$ROOT" 0 20)"
expect_ok "VERIFY dead-baseline REAL @$S101" verify "$(vargs $S101 "$P_DEAD")"
vcheck $S101 "table: $S101"
expect_ok "anchor $S102 (R,1,20)" anchor "$(aargs $S102 "$ROOT" 1 20)"
expect_ok "VERIFY live-baseline REAL @$S102" verify "$(vargs $S102 "$P_LIVE")"
vcheck $S102 "table: $S102"

echo "== [4] refusals (each on its SPECIFIED reason; prerequisite reconciled) =="
expect_ok "anchor $S103 (fresh, for forged proof)" anchor "$(aargs $S103 "$ROOT" 0 20)"
reconcile $S103 "$ROOT" 0 20 && expect_refuse "forged proof (eval_zw+1) @$S103" verify "$(vargs $S103 "$P_FORG")" "$PAIR"
expect_ok "anchor $S104 (count says 21)" anchor "$(aargs $S104 "$ROOT" 0 21)"
reconcile $S104 "$ROOT" 0 21 && expect_refuse "real dead proof vs count=21 @$S104" verify "$(vargs $S104 "$P_DEAD")" "$PAIR"
expect_ok "anchor $S105 (mutated root, last byte)" anchor "$(aargs $S105 "$ROOTFLIP" 0 20)"
reconcile $S105 "$ROOTFLIP" 0 20 && expect_refuse "real dead proof vs mutated root @$S105" verify "$(vargs $S105 "$P_DEAD")" "$PAIR"
expect_ok "anchor $S106 (kind says live)" anchor "$(aargs $S106 "$ROOT" 1 20)"
reconcile $S106 "$ROOT" 1 20 && expect_refuse "real DEAD proof vs kind=1 @$S106" verify "$(vargs $S106 "$P_DEAD")" "$PAIR"
reconcile $S101 "$ROOT" 0 20 && expect_refuse "re-verify @$S101" verify "$(vargs $S101 "$P_DEAD")" "anchor already verified (one proof per anchor)"
expect_refuse "bad kind (2) at anchor time" anchor "$(aargs $S107 "$ROOT" 2 20)" "kind must be 0 or 1"

echo "== [5] asym fixture on-chain (selector law: fRoot, 20 dead-kept / 19 live-kept) =="
expect_ok "anchor $S201 (fRoot,0,20) — CORRECT claim" anchor "$(aargs $S201 "$FROOT" 0 20)"
expect_ok "VERIFY 201 asym-dead (count=20) REAL" verify "$(vargs $S201 "$FA_DEAD")"
expect_ok "anchor $S202 (fRoot,1,19) — CORRECT claim" anchor "$(aargs $S202 "$FROOT" 1 19)"
expect_ok "VERIFY 202 asym-live (count=19) REAL" verify "$(vargs $S202 "$FA_LIVE")"
expect_ok "anchor $S203 (fRoot,0,19) — REVERSED claim" anchor "$(aargs $S203 "$FROOT" 0 19)"
reconcile $S203 "$FROOT" 0 19 && expect_refuse "valid asym-dead proof vs REVERSED (0,19) @$S203" verify "$(vargs $S203 "$FA_DEAD")" "$PAIR"
expect_ok "anchor $S204 (fRoot,1,20) — REVERSED claim" anchor "$(aargs $S204 "$FROOT" 1 20)"
reconcile $S204 "$FROOT" 1 20 && expect_refuse "valid asym-live proof vs REVERSED (1,20) @$S204" verify "$(vargs $S204 "$FA_LIVE")" "$PAIR"

echo "== [6] exhaustion regression (finite budget → CONTROLLED refusal) =="
F=0
while [ $((ROWS + F + 10)) -lt "$CAP" ]; do
  S=$((BASE + 9000 + F))
  push_raw anchor "$(aargs $S "$ROOT" 0 20)"
  echo "$OUT" | grep -q "executed transaction:" || { bad "filler anchor $S" "$OUT"; break; }
  F=$((F + 1))
done
ok "filled to cap (rows $((ROWS + F)) of $CAP; $F fillers)"
expect_refuse "anchor beyond cap — budget exhausted" anchor "$(aargs $S999 "$ROOT" 0 20)" "anchor table FULL (bounded resource budget)"

echo "== [7] final table state (ASSERTED — review 2026-10-07: printing is not evidence) =="
# the four INTENDED-VALID claims must exist with exact fields and nonzero
# verified_at (both canonical AND both asym positives); the six REJECTED
# claims must exist with their anchored (tampered where applicable)
# fields and verified_at == 0 at the observation; total rows == cap for
# the exhaustion fixture. A parse failure here FAILS the run.
cat > $W/final-spec.json <<EOF
[
 {"seq":$S101,"root":"$ROOT","kind":0,"count":$DK,"verified":"nonzero"},
 {"seq":$S102,"root":"$ROOT","kind":1,"count":$LK,"verified":"nonzero"},
 {"seq":$S201,"root":"$FROOT","kind":0,"count":$ADK,"verified":"nonzero"},
 {"seq":$S202,"root":"$FROOT","kind":1,"count":$ALK,"verified":"nonzero"},
 {"seq":$S103,"root":"$ROOT","kind":0,"count":$DK,"verified":"zero"},
 {"seq":$S104,"root":"$ROOT","kind":0,"count":$((DK+1)),"verified":"zero"},
 {"seq":$S105,"root":"$ROOTFLIP","kind":0,"count":$DK,"verified":"zero"},
 {"seq":$S106,"root":"$ROOT","kind":1,"count":$DK,"verified":"zero"},
 {"seq":$S203,"root":"$FROOT","kind":0,"count":$ALK,"verified":"zero"},
 {"seq":$S204,"root":"$FROOT","kind":1,"count":$ADK,"verified":"zero"}
]
EOF
FTOUT=$($RCLEOS get table $A $A anchors -l 1000 2>/dev/null | node "$REPO/final_table_assert.mjs" "$W/final-spec.json" "$CAP" 2>&1)
if [ $? -eq 0 ]; then
  echo "$FTOUT" | sed 's/^/  /'
  ok "final table: 4 positives verified (canonical AND asym), 6 rejected claims unverified at the observation, rows == cap $CAP"
else
  bad "final table assertion failed" "$FTOUT"
fi

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
